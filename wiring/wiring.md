# Wiring — packet-inspector-demo

Source of truth for the hardware/wiring tables on the page. `wiring.svg` is the
diagram; the page embeds an inline, theme-aware copy.

Two identical XIAO ESP32-C3 boards. There is **no wiring between them** — they
talk over the air with ESP-NOW. The only connections are USB.

## Bridge node (required)

| Signal          | XIAO C3 pin | Goes to  | Note                                   |
|-----------------|-------------|----------|----------------------------------------|
| USB data + power| USB-C       | Laptop   | The only required connection           |
| Antenna         | u.FL        | Whip     | Clip on firmly — the only antenna      |

Runs `../firmware/bridge/code.py`.

## TX node (required)

| Signal    | XIAO C3 pin | Goes to            | Note                     |
|-----------|-------------|--------------------|--------------------------|
| USB power | USB-C       | USB bank / laptop  | Power only               |
| Antenna   | u.FL        | Whip               | Clip on firmly           |

Runs `../firmware/tx/code.py`.

## Notes

- Same hardware, different `code.py`. Label them BRIDGE and TX.
- Both pin Wi-Fi channel 6. Change one and you must change the other.
- No level shifters, no jumpers.
