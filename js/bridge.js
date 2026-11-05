'use strict';

/*
 * bridge.js — Web Serial reader for the demo-family bridge format.
 *
 * The bridge node prints one compact JSON object per line over USB serial at
 * 115200 baud. This reader opens the port, splits on newlines, parses each
 * line, and calls onLine(obj). It tolerates partial lines and junk. The whole
 * demo family (rssi/telemetry/morse/address) reuses this unchanged; only the
 * payload decoding on the page differs.
 *
 * Shared line types: {"t":"hello",...} {"t":"pkt",...} {"t":"idle",...}
 */

export class Bridge {
  constructor({ baudRate = 115200 } = {}) {
    this.baudRate = baudRate;
    this.port = null; this.reader = null; this.writer = null;
    this.keepReading = false;
    this.onLine = () => {};
    this.onRaw = () => {};      // raw text, for the serial log
    this.onClose = () => {};
  }

  get connected() { return !!this.port; }

  async connect() {
    if (!navigator.serial) throw new Error('This browser has no Web Serial. Use Chrome or Edge on a laptop or desktop.');
    if (!isSecureContext) throw new Error('Serve this page over HTTPS or localhost.');
    const port = await navigator.serial.requestPort();
    await port.open({ baudRate: this.baudRate, bufferSize: 65536 });
    this.port = port;
    this.writer = port.writable?.getWriter() ?? null;
    this.keepReading = true;
    this._readLoop();            // runs in background
    return true;
  }

  async _readLoop() {
    const decoder = new TextDecoder();
    let buf = '';
    try {
      while (this.keepReading && this.port?.readable) {
        this.reader = this.port.readable.getReader();
        try {
          for (;;) {
            const { value, done } = await this.reader.read();
            if (done) break;
            if (!value) continue;
            const text = decoder.decode(value, { stream: true });
            this.onRaw(text);
            buf += text;
            let nl;
            while ((nl = buf.indexOf('\n')) >= 0) {
              const line = buf.slice(0, nl).trim();
              buf = buf.slice(nl + 1);
              if (!line) continue;
              let obj;
              try { obj = JSON.parse(line); } catch { continue; } // skip junk/partials
              this.onLine(obj);
            }
            if (buf.length > 1 << 20) buf = buf.slice(-65536); // runaway guard
          }
        } finally {
          try { this.reader.releaseLock(); } catch {}
          this.reader = null;
        }
      }
    } catch (e) {
      if (this.keepReading) this.onClose(e);
    }
  }

  async send(text) {
    if (!this.writer) return;
    await this.writer.write(new TextEncoder().encode(text.endsWith('\n') ? text : text + '\n'));
  }

  async disconnect() {
    this.keepReading = false;
    try { await this.reader?.cancel(); } catch {}
    try { this.writer?.releaseLock(); } catch {}
    this.writer = null;
    try { await this.port?.close(); } catch {}
    this.port = null;
  }
}

// ---- field map for the 32-byte inspector payload (byte spans + colors) ----
// Used to color the hex dump and to label the decoded table. Offsets/lengths
// match firmware/tx/code.py.
export const FIELD_MAP = [
  { key: 'magic',     off: 0,  len: 1,  label: 'Magic',      color: '#8a8a8a' },
  { key: 'version',   off: 1,  len: 1,  label: 'Version',    color: '#8a8a8a' },
  { key: 'node_id',   off: 2,  len: 1,  label: 'Node ID',    color: '#b5460f' },
  { key: 'msg_type',  off: 3,  len: 1,  label: 'Msg type',   color: '#b5460f' },
  { key: 'seq',       off: 4,  len: 4,  label: 'Sequence',   color: '#2f6fb0' },
  { key: 'uptime_ms', off: 8,  len: 4,  label: 'Uptime ms',  color: '#6a4fb0' },
  { key: 'value',     off: 12, len: 2,  label: 'Value',      color: '#2f7d32' },
  { key: 'batt_mV',   off: 14, len: 2,  label: 'Battery mV', color: '#2f7d32' },
  { key: 'label',     off: 16, len: 12, label: 'Label',      color: '#9a6a00' },
  { key: 'crc32',     off: 28, len: 4,  label: 'CRC32',      color: '#b03a3a' },
];
