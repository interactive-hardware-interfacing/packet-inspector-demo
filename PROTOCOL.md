# Protocol — packet-inspector-demo

Two parts: the **bridge serial format** (line-JSON over USB) that the page
reads, and the **32-byte payload** the TX node sends over ESP-NOW. Everything
the page needs is defined here.

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
{"t":"pkt","seq":1234,"mac":"7c9ebda10f20","rssi":-42,
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

**Changing the payload:** keep bytes 0–3 (magic/version/node_id/msg_type)
and the trailing `crc32`, pick a new `msg_type`, and define bytes 4–27 as you
like. Update `FIELD_MAP` on the page and the decoder in the bridge firmware to
match. The line-JSON format above does not need to change.

## Checking it by hand

Plug in the bridge and open the page's serial log — you'll see the raw JSON
lines stream past. Or open any serial monitor at 115200 to read them directly.

## Installing (the Firmware tab)

Not part of the demo protocol — this is how the page gets a `code.py` onto a
board. Same port, 115200 8N1 (the C3's USB-JTAG/serial ignores the rate).
It is CircuitPython's raw REPL, the exchange Thonny and mpremote use:

| step | page sends | expects |
|---|---|---|
| interrupt | `\r\x03\x03` (up to 4×, with `\r` and `\x02` fallbacks) | `>>> ` |
| enter raw | `\r\x01` | `raw REPL; CTRL-B to exit\r\n>` |
| exec | code in 128-byte chunks, 8 ms apart, then `\x04` | `OK` · stdout · `\x04` · stderr · `\x04` · `>` |
| exit raw | `\r\x02` | `>>> ` |
| soft reboot | `\x04` at the friendly prompt | boot output until the firmware's first line (15 s max) |

The page sends `firmware/bridge/code.py` or `firmware/tx/code.py`, whichever
role was clicked. The write is `f=open('code.py','wb')`, then one
`f.write(b'…')` per 384-byte chunk, `f.close()`, then the board prints
`os.stat` size and `binascii.crc32` of the file read back in 512-byte pieces.
Both must match what was sent.

The first line the page waits for after the reboot is the bridge's
`{"t":"hello",...}` JSON, or the TX node's `tx node ready: ...` text.

A bare board (no REPL answers) gets CircuitPython first through
`flasher/` — the ROM bootloader protocol, handled by esptool-js.
