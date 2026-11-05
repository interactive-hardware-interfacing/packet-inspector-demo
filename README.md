# packet-inspector-demo

A browser demo that shows **ESP-NOW packets arriving byte by byte** between two
Seeed XIAO ESP32-C3 boards — a “Wireshark lite.” A colored hex dump, a decoded
field table, and live loss / RSSI counters, all over Web Serial. No install, no
server.

**Live page:** <https://interactive-hardware-interfacing.github.io/packet-inspector-demo/>
· **Try without hardware** runs the whole page against a built-in simulator.

Part of [Interactive Hardware Interfacing](https://interactive-hardware-interfacing.github.io/).
Self-contained — copies nothing from the other demos at runtime.

## What you see

- **Raw packet** — 32 bytes, each field a different color; hover to identify it.
- **Decoded** — the fields pulled out of those bytes, with a CRC pass/fail.
- **Counters** — packets/s, lost packets (from sequence gaps), CRC fails, last RSSI (dBm).

## Hardware

Two identical XIAO ESP32-C3 boards, each with a u.FL antenna:

- **Bridge** — plugged into the laptop; runs [`firmware/bridge/code.py`](firmware/bridge/code.py).
- **TX** — battery/USB-bank powered; runs [`firmware/tx/code.py`](firmware/tx/code.py).

No wiring between them — they talk over the air. See [`wiring/`](wiring/).

Both run **CircuitPython**. The bridge’s serial format and the 32-byte payload
are documented in [`PROTOCOL.md`](PROTOCOL.md) — this is the shared format the
rest of the demo family builds on.

## Run locally

```
python -m http.server 8000
```

then open <http://localhost:8000/> — ES modules won’t load from `file://`, and
Web Serial needs HTTPS or localhost.

## Browser support

Chrome or Edge on a laptop/desktop (Web Serial). The simulator works anywhere.

## License

GPL-2.0 (see [`LICENSE`](LICENSE)). Maintained by [LC Linkous](https://github.com/LC-Linkous).
