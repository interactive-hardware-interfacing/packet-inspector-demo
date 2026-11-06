# code.py — BRIDGE node for packet-inspector-demo
#
# Runs on a XIAO ESP32-C3 in CircuitPython, tethered to the laptop over USB.
# Receives ESP-NOW packets and prints ONE JSON line per packet to USB serial.
# The page decodes the payload; this file only frames it. See PROTOCOL.md.
#
# Line format (newline-terminated JSON), one per received packet:
#   {"t":"pkt","seq":<u32|null>,"mac":"aabbcc...","rssi":-42,
#    "len":32,"hex":"a501...","crc_ok":true,"ms":12345,
#    "fields":{...decoded...},"gap":0}
#
# Plus a heartbeat line when nothing has arrived for a while, so the page can
# show "link lost" instead of silently freezing:
#   {"t":"idle","ms":12345}
#
# And one banner line at startup:
#   {"t":"hello","role":"bridge","proto":1,"channel":6}
#
# The page must tolerate unknown "t" values and extra keys (forward-compatible).

import time
import struct
import binascii
import json
import sys
import wifi
import espnow

PROTO = 1
CHANNEL = 6
IDLE_MS = 750          # emit an idle heartbeat if no packet for this long
MAGIC = 0xA5

wifi.radio.enabled = True
try:
    # Match the TX node's channel. Starting an AP pins it.
    wifi.radio.start_ap(ssid="pkt-inspector-br", channel=CHANNEL)
except Exception:
    pass

e = espnow.ESPNow()

def emit(obj):
    # One compact JSON line. Flush so the laptop sees it immediately even when
    # the board is bus-powered (avoids the C3 USB-CDC buffering gotcha).
    sys.stdout.write(json.dumps(obj, separators=(",", ":")))
    sys.stdout.write("\n")

emit({"t": "hello", "role": "bridge", "proto": PROTO, "channel": CHANNEL})

def decode(msg):
    """Decode the 32-byte inspector payload. Returns (fields, crc_ok)."""
    if len(msg) != 32 or msg[0] != MAGIC:
        return None, False
    body, crc_rx = msg[:28], struct.unpack_from("<I", msg, 28)[0]
    crc_ok = (binascii.crc32(body) & 0xFFFFFFFF) == crc_rx
    magic, ver, node_id, msg_type, seq, uptime_ms, value, batt = struct.unpack_from("<BBBB I I H H", body, 0)
    label = bytes(body[16:28]).decode("ascii", "replace").rstrip()
    fields = {
        "node_id": node_id, "version": ver, "msg_type": msg_type,
        "seq": seq, "uptime_ms": uptime_ms, "value": value,
        "batt_mV": batt, "label": label,
    }
    return fields, crc_ok

last_seq = None
last_rx = time.monotonic_ns() // 1_000_000
idle_sent = False

while True:
    now = time.monotonic_ns() // 1_000_000
    if e:
        p = e.read()
        if p is not None:
            idle_sent = False
            last_rx = now
            msg = bytes(p.msg)
            mac = binascii.hexlify(bytes(p.mac)).decode()
            fields, crc_ok = decode(msg)
            seq = fields["seq"] if fields else None
            gap = 0
            if seq is not None and last_seq is not None:
                gap = (seq - last_seq - 1) & 0xFFFFFFFF
                if gap > 1000:   # wrap / reset, don't report a huge bogus gap
                    gap = 0
            if seq is not None:
                last_seq = seq
            emit({
                "t": "pkt", "seq": seq, "mac": mac, "rssi": p.rssi,
                "len": len(msg), "hex": binascii.hexlify(msg).decode(),
                "crc_ok": crc_ok, "ms": p.time, "fields": fields, "gap": gap,
            })
    else:
        if (now - last_rx) > IDLE_MS and not idle_sent:
            emit({"t": "idle", "ms": now})
            idle_sent = True
        time.sleep(0.002)
