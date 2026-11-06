# code.py — TX node for packet-inspector-demo
#
# Runs on a XIAO ESP32-C3 in CircuitPython. Broadcasts a fixed 32-byte ESP-NOW
# payload a few times a second. The payload has named fields so the web page
# can color each byte span and decode it. It rotates through a few canned
# "sensor" values so the screen isn't static, but it's deterministic: the same
# sequence every run, which is what we want for a tour demo.
#
# Payload layout (32 bytes, little-endian), see PROTOCOL.md:
#   off 0   1B   magic      0xA5
#   off 1   1B   version    0x01
#   off 2   1B   node_id    this node's id (0x01)
#   off 3   1B   msg_type   0x10 = "inspector telemetry"
#   off 4   4B   seq        u32 sequence number
#   off 8   4B   uptime_ms  u32 milliseconds since boot
#   off 12  2B   value      u16 rotating demo "sensor" value
#   off 14  2B   batt_mV    u16 fake battery millivolts
#   off 16  12B  label      ASCII, space-padded ("HELLO-TOUR  ")
#   off 28  4B   crc32      u32 CRC32 of bytes 0..27 (zlib poly)
#
# The bridge recomputes and checks that CRC; the page shows pass/fail.

import time
import struct
import binascii
import wifi
import espnow

NODE_ID = 0x01
MSG_TYPE = 0x10
LABEL = b"HELLO-TOUR  "          # exactly 12 bytes
BROADCAST = b"\xff\xff\xff\xff\xff\xff"
CHANNEL = 6                       # pin the channel so the bridge matches
RATE_HZ = 4                       # packets per second

# Rotating demo values so the decoded table visibly changes.
VALUES = [100, 250, 512, 777, 1000, 333]

wifi.radio.enabled = True
try:
    # Pinning the channel keeps TX and bridge on the same one. Starting an AP
    # is a reliable way to fix the channel on CircuitPython/ESP32.
    wifi.radio.start_ap(ssid="pkt-inspector-tx", channel=CHANNEL)
except Exception as ex:
    print("channel pin warning:", ex)

e = espnow.ESPNow()
peer = espnow.Peer(mac=BROADCAST, channel=CHANNEL)
e.peers.append(peer)

seq = 0
print("tx node ready: broadcasting on channel", CHANNEL, "at", RATE_HZ, "Hz")

while True:
    value = VALUES[seq % len(VALUES)]
    batt_mV = 3700 - (seq % 50) * 3        # slowly "draining" battery
    uptime_ms = time.monotonic_ns() // 1_000_000 & 0xFFFFFFFF

    body = struct.pack(
        "<BBBB I I H H 12s",
        0xA5, 0x01, NODE_ID, MSG_TYPE,
        seq & 0xFFFFFFFF,
        uptime_ms,
        value & 0xFFFF,
        batt_mV & 0xFFFF,
        LABEL,
    )  # 28 bytes
    crc = binascii.crc32(body) & 0xFFFFFFFF
    packet = body + struct.pack("<I", crc)   # 32 bytes

    try:
        e.send(packet, peer)
    except Exception as ex:
        print("send error:", ex)

    seq += 1
    time.sleep(1.0 / RATE_HZ)
