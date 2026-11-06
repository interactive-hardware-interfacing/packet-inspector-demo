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
are documented in [`PROTOCOL.md`](PROTOCOL.md).

## Putting the firmware on a board

The page does it. Open the **Firmware** tab, plug in a XIAO ESP32-C3, click
**Install bridge** or **Install TX**, pick the port. The page writes `code.py`
through CircuitPython's raw REPL over Web Serial (the C3 has no `CIRCUITPY`
drive, so this is the only USB path), verifies size and CRC32 on the board,
reboots it, and waits for the firmware's first line.

A board that has never run CircuitPython needs it installed once: download
the `.bin` for the XIAO ESP32-C3 from
[circuitpython.org](https://circuitpython.org/board/seeed_xiao_esp32c3/),
pick it on the Firmware tab, click **Flash CircuitPython**. That path uses
[esptool-js](https://github.com/espressif/esptool-js), kept in
[`flasher/`](flasher/) under its own licence.

## What's in the repo

| Path | What it is |
|---|---|
| `index.html`, `css/`, `js/app.js` | The page: instrument, plus Hardware / Firmware / About views (`js/views.js`). |
| `js/bridge.js`, `js/sim.js` | Web Serial reader for the bridge's line-JSON and the hex-dump field map; a simulator that builds the same packets. |
| `js/install.js`, `js/device/` | The Firmware tab: CircuitPython raw REPL over Web Serial (write, verify, reboot). |
| `flasher/` | CircuitPython flashing for a bare board (esptool-js). Apache-2.0, see `LICENSES.md`. |
| `firmware/bridge/code.py`, `firmware/tx/code.py` | One CircuitPython file per role. |
| `PROTOCOL.md`, `wiring/` | The serial contract, the payload layout, and the hookup. |

## Run locally

```
python -m http.server 8000
```

then open <http://localhost:8000/> — ES modules won’t load from `file://`, and
Web Serial needs HTTPS or localhost.

## Browser support

Chrome or Edge on a laptop/desktop (Web Serial). The simulator works anywhere.

## License

GPL-2.0 (see [`LICENSE`](LICENSE)), except `flasher/`, which is Apache-2.0
because it bundles esptool-js — see [`LICENSES.md`](LICENSES.md).
Maintained by [LC Linkous](https://github.com/LC-Linkous).
