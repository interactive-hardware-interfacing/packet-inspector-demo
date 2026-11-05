'use strict';

/*
 * app.js — packet-inspector-demo UI.
 * Consumes the bridge line-JSON and shows each packet three ways:
 *  - a colored hex dump (each field a different color, hover to highlight)
 *  - a decoded field table
 *  - live counters: packets/sec, loss (from seq gaps), CRC fails, last RSSI
 */

import { Bridge, FIELD_MAP } from './bridge.js';
import { SimBridge } from './sim.js';

const $ = s => document.querySelector(s);
const logEl = $('#log');
function log(line) {
  logEl.textContent += line;
  if (logEl.textContent.length > 20000) logEl.textContent = logEl.textContent.slice(-15000);
  logEl.scrollTop = logEl.scrollHeight;
}

let bridge = null, simulated = false;

// ---- counters ----
const C = { total: 0, lost: 0, crcFail: 0, windowCount: 0, windowStart: performance.now(), lastRssi: null, linkUp: false };

function offsetColor(off) {
  for (const f of FIELD_MAP) if (off >= f.off && off < f.off + f.len) return f;
  return null;
}

// ---- hex dump ----
const hexEl = $('#hex');
function renderHex(hexStr) {
  const bytes = [];
  for (let i = 0; i < hexStr.length; i += 2) bytes.push(hexStr.slice(i, i + 2));
  hexEl.innerHTML = '';
  bytes.forEach((h, i) => {
    const f = offsetColor(i);
    const span = document.createElement('span');
    span.className = 'hb';
    span.textContent = h;
    span.dataset.key = f ? f.key : '';
    if (f) span.style.color = f.color;
    if (i % 8 === 7) span.classList.add('group');
    span.addEventListener('mouseenter', () => highlightField(f ? f.key : ''));
    span.addEventListener('mouseleave', () => highlightField(''));
    hexEl.appendChild(span);
  });
}
function highlightField(key) {
  document.querySelectorAll('.hb').forEach(s => s.classList.toggle('hot', key && s.dataset.key === key));
  document.querySelectorAll('#decoded tr').forEach(r => r.classList.toggle('hot', key && r.dataset.key === key));
}

// ---- decoded table ----
const decodedEl = $('#decoded');
function renderDecoded(pkt) {
  const f = pkt.fields || {};
  const rows = [
    ['node_id', 'Node ID', f.node_id],
    ['msg_type', 'Msg type', f.msg_type != null ? '0x' + f.msg_type.toString(16) : '—'],
    ['seq', 'Sequence', pkt.seq],
    ['uptime_ms', 'Uptime ms', f.uptime_ms],
    ['value', 'Value', f.value],
    ['batt_mV', 'Battery mV', f.batt_mV],
    ['label', 'Label', f.label],
    ['crc32', 'CRC', pkt.crc_ok ? 'OK' : 'FAIL'],
  ];
  decodedEl.innerHTML = rows.map(([key, label, val]) => {
    const fm = FIELD_MAP.find(x => x.key === key);
    const dot = fm ? `<span class="swatch" style="background:${fm.color}"></span>` : '';
    const cls = key === 'crc32' ? (pkt.crc_ok ? 'ok' : 'bad') : '';
    return `<tr data-key="${key}"><td>${dot}${label}</td><td class="${cls}">${val ?? '—'}</td></tr>`;
  }).join('');
  decodedEl.querySelectorAll('tr').forEach(r => {
    r.addEventListener('mouseenter', () => highlightField(r.dataset.key));
    r.addEventListener('mouseleave', () => highlightField(''));
  });
}

// ---- counters UI ----
function refreshCounters() {
  const now = performance.now();
  const dt = now - C.windowStart;
  if (dt > 500) {
    $('#rate').textContent = (C.windowCount / dt * 1000).toFixed(1);
    C.windowCount = 0; C.windowStart = now;
  }
  $('#total').textContent = C.total;
  $('#lost').textContent = C.lost;
  const lossPct = C.total + C.lost > 0 ? (C.lost / (C.total + C.lost) * 100) : 0;
  $('#losspct').textContent = lossPct.toFixed(1) + '%';
  $('#crcfail').textContent = C.crcFail;
  $('#rssi').textContent = C.lastRssi == null ? '—' : C.lastRssi;
}

let gapFlashTimer = null;
function flashGap() {
  const el = $('#gapind');
  el.classList.add('flash');
  clearTimeout(gapFlashTimer);
  gapFlashTimer = setTimeout(() => el.classList.remove('flash'), 400);
}

function setLink(up) {
  C.linkUp = up;
  const el = $('#link');
  el.textContent = up ? 'LINK UP' : 'LINK LOST';
  el.className = up ? 'ok' : 'bad';
}

// ---- line handler ----
function onLine(obj) {
  if (obj.t === 'hello') {
    log(`[bridge] channel ${obj.channel}, proto ${obj.proto}${obj.simulated ? ' (sim)' : ''}\n`);
    return;
  }
  if (obj.t === 'idle') { setLink(false); return; }
  if (obj.t !== 'pkt') return;

  setLink(true);
  C.total++; C.windowCount++;
  if (typeof obj.gap === 'number' && obj.gap > 0) { C.lost += obj.gap; flashGap(); }
  if (obj.crc_ok === false) C.crcFail++;
  if (typeof obj.rssi === 'number') C.lastRssi = obj.rssi;

  if (obj.hex) renderHex(obj.hex);
  renderDecoded(obj);
  refreshCounters();
}

// ---- connect / disconnect ----
function setStatus(text, connected) {
  $('#status').textContent = text;
  $('#status').className = connected ? 'ok' : '';
  $('#connect').disabled = connected;
  $('#sim').disabled = connected;
  $('#disconnect').disabled = !connected;
}

async function start(useSim) {
  simulated = useSim;
  bridge = useSim ? new SimBridge() : new Bridge();
  bridge.onLine = onLine;
  bridge.onRaw = t => { if (!useSim) log(t); };
  bridge.onClose = e => { log(`\n[closed] ${e?.message || ''}\n`); setStatus('Disconnected', false); setLink(false); bridge = null; };
  try {
    log(useSim ? '[sim] starting\n' : '[serial] requesting port\n');
    await bridge.connect();
    setStatus(useSim ? 'Simulator running' : 'Bridge connected', true);
  } catch (e) {
    log(`[error] ${e.message}\n`); setStatus(e.message, false); bridge = null;
  }
}

async function stop() {
  if (bridge) { try { await bridge.disconnect(); } catch {} }
  bridge = null;
  setStatus('Not connected', false); setLink(false);
  log('[disconnected]\n');
}

$('#connect').addEventListener('click', () => start(false));
$('#sim').addEventListener('click', () => start(true));
$('#disconnect').addEventListener('click', stop);
$('#reset').addEventListener('click', () => {
  C.total = C.lost = C.crcFail = C.windowCount = 0; C.windowStart = performance.now(); C.lastRssi = null;
  refreshCounters();
});
$('#logsend').addEventListener('click', async () => {
  const cmd = $('#logcmd').value.trim();
  if (!cmd) return;
  if (simulated || !bridge) { log('(no command sent)\n'); return; }
  try { await bridge.send(cmd); log('→ ' + cmd + '\n'); } catch (e) { log('[error] ' + e.message + '\n'); }
});

if (!navigator.serial) $('#nowebserial').hidden = false;
setStatus('Not connected', false);
setLink(false);
log('Ready. "Try without hardware" for the simulator, or "Connect bridge" with the bridge XIAO plugged in.\n');
// keep the rate readout decaying to 0 when nothing arrives
setInterval(refreshCounters, 500);
