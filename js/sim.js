'use strict';

/*
 * sim.js — fake Bridge that emits the same line-JSON the real bridge does,
 * so "Try without hardware" exercises the whole page. Deterministic-ish:
 * same payload rotation as firmware/tx/code.py, with an occasional dropped
 * sequence number so the loss indicator has something to show.
 */

const VALUES = [100, 250, 512, 777, 1000, 333];
const LABEL = 'HELLO-TOUR';

// zlib CRC32 so the simulated crc_ok matches what the page would compute.
const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, i) => {
  let c = i; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0;
});
function crc32(bytes) { let c = 0xffffffff; for (const b of bytes) c = CRC_TABLE[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }

function buildPayload(seq) {
  const b = new Uint8Array(32);
  const dv = new DataView(b.buffer);
  b[0] = 0xa5; b[1] = 0x01; b[2] = 0x01; b[3] = 0x10;
  dv.setUint32(4, seq >>> 0, true);
  dv.setUint32(8, (seq * 250) >>> 0, true);     // uptime-ish
  dv.setUint16(12, VALUES[seq % VALUES.length], true);
  dv.setUint16(14, 3700 - (seq % 50) * 3, true);
  const lab = LABEL.padEnd(12, ' ');
  for (let i = 0; i < 12; i++) b[16 + i] = lab.charCodeAt(i);
  dv.setUint32(28, crc32(b.subarray(0, 28)), true);
  return b;
}
const hex = b => Array.from(b, x => x.toString(16).padStart(2, '0')).join('');

export class SimBridge {
  constructor() { this.onLine = () => {}; this.onRaw = () => {}; this.onClose = () => {}; this._timer = null; this.connected = false; }

  async connect() {
    this.connected = true;
    this.seq = 0; this.lastSeq = null;
    this._emit({ t: 'hello', role: 'bridge', proto: 1, channel: 6, simulated: true });
    this._timer = setInterval(() => this._tick(), 250);  // 4 Hz, like the TX node
    return true;
  }

  _emit(obj) {
    const line = JSON.stringify(obj);
    this.onRaw(line + '\n');
    this.onLine(obj);
  }

  _tick() {
    // Drop ~1 in 25 packets to exercise the gap/loss display.
    const dropped = Math.random() < 0.04;
    this.seq++;
    if (dropped) return;
    const b = buildPayload(this.seq);
    let gap = 0;
    if (this.lastSeq !== null) gap = this.seq - this.lastSeq - 1;
    this.lastSeq = this.seq;
    const rssi = -45 + Math.round(8 * Math.sin(this.seq / 7) + (Math.random() * 6 - 3));
    this._emit({
      t: 'pkt', seq: this.seq, mac: '7c9ebd' + (this.seq % 2 ? 'a10f20' : 'a10f20'),
      rssi, len: 32, hex: hex(b), crc_ok: true, ms: this.seq * 250,
      fields: {
        node_id: 1, version: 1, msg_type: 0x10, seq: this.seq, uptime_ms: this.seq * 250,
        value: VALUES[this.seq % VALUES.length], batt_mV: 3700 - (this.seq % 50) * 3, label: LABEL,
      },
      gap,
    });
  }

  async send() { /* simulator ignores commands */ }

  async disconnect() { this.connected = false; clearInterval(this._timer); this._timer = null; }
}
