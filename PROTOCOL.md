# Protocol — packet-inspector-demo (and the demo family)

This file defines two things the whole ESP-NOW demo family shares:

1. the **bridge serial format** (line-JSON over USB), and
2. the **32-byte demo payload** sent over ESP-NOW.

`rssi-demo`, `telemetry-demo`, `morse-key-demo` and `wireless-address-demo`
copy the bridge format as-is and change only the payload body and how the page
decodes it. Keeping this stable is what lets the pages share one serial client
(`js/bridge.js`).

## Link

- USB serial (native USB Serial/JTAG on the XIAO C3), **115200 baud, 8N1**.
- The bridge is **print-only**: it emits lines, it doesn't require commands.
  The page may send text lines (the serial-log box); firmware may ignore them.
- Both nodes pin **Wi-Fi channel 6**.

## Bridge → page: line-JSON

One compact JSON object per line, newline-terminated. The page parses each line
and **ignores unknown `t` values and extra keys** (forward-compatible). Partial
lines are buffered until the newline arrives.

### `hello` — once at startup
```json
{"t":"hello","role":"bridge","proto":1,"channel":6}
```

### `pkt` — one per received ESP-NOW packet
```json
{"t":"pkt","seq":1234,"mac":"7c9ebd a10f20","rssi":-42,
 "len":32,"hex":"a501...","crc_ok":true,"ms":987654,
 "fields":{...decoded body...},"gap":0}
```
- `seq` — sequence number from the payload (or `null` if undecodable).
- `mac` — sender MAC, hex (no separators in the wire format).
- `rssi` — radio RSSI in **dBm** (real, from the ESP-NOW packet).
- `hex` — the full raw payload as hex, for the byte dump.
- `crc_ok` — did the payload's CRC32 check out.
- `ms` — ms since the sender booted, from the ESP-NOW packet metadata.
- `gap` — packets missing since the last one (seq delta − 1). Drives the loss count.
- `fields` — decoded payload (see below). Each demo puts its own fields here.

### `idle` — heartbeat when nothing arrives
```json
{"t":"idle","ms":987654}
```
Sent after ~750 ms of silence so the page can show **LINK LOST** instead of
freezing.

## The 32-byte inspector payload

Little-endian. Offsets/lengths match `firmware/tx/code.py` and the page's
`FIELD_MAP` (used to color the hex dump).

| Off | Len | Field       | Type   | Notes                               |
|-----|-----|-------------|--------|-------------------------------------|
| 0   | 1   | `magic`     | u8     | 0xA5                                |
| 1   | 1   | `version`   | u8     | 0x01                                |
| 2   | 1   | `node_id`   | u8     | sender id                           |
| 3   | 1   | `msg_type`  | u8     | 0x10 = inspector telemetry          |
| 4   | 4   | `seq`       | u32    | sequence number                     |
| 8   | 4   | `uptime_ms` | u32    | ms since sender boot                |
| 12  | 2   | `value`     | u16    | rotating demo "sensor" value        |
| 14  | 2   | `batt_mV`   | u16    | fake battery millivolts             |
| 16  | 12  | `label`     | 12×ASCII | space-padded                      |
| 28  | 4   | `crc32`     | u32    | CRC32 (zlib poly) of bytes 0..27    |

**Reusing in another demo:** keep bytes 0–3 (magic/version/node_id/msg_type)
and the trailing `crc32`, pick a new `msg_type`, and define bytes 4–27 for your
payload. Update that demo's `FIELD_MAP` to match. The bridge format above does
not change.

## Checking it by hand

Plug in the bridge and open the page's serial log — you'll see the raw JSON
lines stream past. Or open any serial monitor at 115200 to read them directly.
