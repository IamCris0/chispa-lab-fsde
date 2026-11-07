// Laboratorio de Chispa — simulador de circuitos para niños y jóvenes.
import { solve, LED_COLORS, potResistance, ldrResistance } from './solver.js';
import { TYPES, CATS, drawComponent, paletteSVG, bigSVG, compLabel, fmtOhms, fmtCurrent, fmtVolt } from './components.js';
import { MISSIONS, CLASES, evaluate } from './missions.js';
import { LESSONS } from './lessons.js';
import * as store from './storage.js';
import { icon } from './icons.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const NS = 'http://www.w3.org/2000/svg';
const GRID = 20;
const WIRE_COLORS = { rojo: '#e53e3e', negro: '#2d3748', azul: '#2b6cb0', verde: '#16a34a', amarillo: '#eab308' };
const POLAR = new Set(['battery', 'led', 'buzzer', 'motor']);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

// ───────────────────────── Estado ─────────────────────────
let settings = store.getSettings();
let progress = store.getProgress();
let project = null;
let result = { comps: {}, wires: {}, shorts: [], burnedNow: [] };
const runtime = { pressed: new Set(), ledOn: {} };
let seen = {};
let selection = null; // {kind:'comp'|'wire', id}
let undoStack = [], redoStack = [];
let view = { x: 0, y: 0, s: 1 };
let gesture = null, pendingWire = null;
let anim = { flows: [], rotors: [], waves: [] };
const rotorAngle = {};
let lastStatus = '';

const board = $('#board'), world = $('#world');
const L = { wires: $('#layerWires'), comps: $('#layerComps'), terms: $('#layerTerms'), temp: $('#layerTemp') };

// ───────────────────────── Utilidades geométricas ─────────────────────────
const ROT = { 0: [1, 0], 90: [0, 1], 180: [-1, 0], 270: [0, -1] };
function termPos(c, t) {
  if (c.type === 'node') return { x: c.x, y: c.y };
  const [cs, sn] = ROT[c.rot || 0];
  const lx = t ? 40 : -40;
  return { x: c.x + lx * cs, y: c.y + lx * sn };
}
function termDir(c, t) { if (c.type === 'node') return { x: 0, y: 0 }; const [cs, sn] = ROT[c.rot || 0]; const d = t ? 1 : -1; return { x: d * cs, y: d * sn }; }
const byId = (id) => project.components.find((c) => c.id === id);
const snap = (v) => Math.round(v / GRID) * GRID;

// Cables en ángulo recto: prueba varias rutas y elige la más corta que no atraviese piezas
function boxes() {
  return project.components.filter((c) => c.type !== 'node').map((c) => {
    const v = (c.rot || 0) % 180 !== 0, hw = v ? 24 : 32, hh = v ? 32 : 24;
    return { id: c.id, x0: c.x - hw, x1: c.x + hw, y0: c.y - hh, y1: c.y + hh };
  });
}
function segHits(p, q, b) {
  const x0 = Math.min(p.x, q.x), x1 = Math.max(p.x, q.x), y0 = Math.min(p.y, q.y), y1 = Math.max(p.y, q.y);
  return x1 > b.x0 && x0 < b.x1 && y1 > b.y0 && y0 < b.y1;
}
function orthoPathD(pa, da, pb, db, bx) {
  const S = 20;
  const a = { x: pa.x + da.x * S, y: pa.y + da.y * S }, b = { x: pb.x + db.x * S, y: pb.y + db.y * S };
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  const top = Math.min(a.y, b.y) - 40, bot = Math.max(a.y, b.y) + 40, lef = Math.min(a.x, b.x) - 40, rig = Math.max(a.x, b.x) + 40;
  const mids = [
    [{ x: mx, y: a.y }, { x: mx, y: b.y }], [{ x: a.x, y: my }, { x: b.x, y: my }],
    [{ x: b.x, y: a.y }], [{ x: a.x, y: b.y }],
    [{ x: a.x, y: top }, { x: b.x, y: top }], [{ x: a.x, y: bot }, { x: b.x, y: bot }],
    [{ x: lef, y: a.y }, { x: lef, y: b.y }], [{ x: rig, y: a.y }, { x: rig, y: b.y }],
  ];
  let best = null, bestScore = Infinity;
  for (const m of mids) {
    const pts = [a, ...m, b];
    let score = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const p = pts[i], q = pts[i + 1], dx = q.x - p.x, dy = q.y - p.y, len = Math.abs(dx) + Math.abs(dy);
      score += len;
      if (len < 0.5) continue;
      if (i === 0 && (Math.sign(dx) * da.x + Math.sign(dy) * da.y) < 0) score += 800; // sale hacia atrás
      if (i === pts.length - 2 && (Math.sign(dx) * db.x + Math.sign(dy) * db.y) > 0) score += 800; // entra por detrás
      for (const bb of bx) if (segHits(p, q, bb)) score += 400;
      if (i > 0 && i < pts.length - 2) score += 10; // cada esquina extra cuesta un poco
    }
    if (score < bestScore) { bestScore = score; best = pts; }
  }
  const all = [pa, ...best, pb].filter((p, i, arr) => i === 0 || Math.abs(p.x - arr[i - 1].x) + Math.abs(p.y - arr[i - 1].y) > 0.5);
  return 'M' + all.map((p) => `${p.x} ${p.y}`).join('L');
}
function wirePathD(pa, da, pb, db, bx) {
  if (settings.wires !== 'curvos' && bx) return orthoPathD(pa, da, pb, db, bx);
  const dist = Math.hypot(pb.x - pa.x, pb.y - pa.y);
  const k = Math.min(90, Math.max(28, dist * 0.35));
  return `M${pa.x} ${pa.y}C${pa.x + da.x * k} ${pa.y + da.y * k} ${pb.x + db.x * k} ${pb.y + db.y * k} ${pb.x} ${pb.y}`;
}
function toWorld(clientX, clientY) {
  const r = board.getBoundingClientRect();
  return { x: (clientX - r.left - view.x) / view.s, y: (clientY - r.top - view.y) / view.s };
}
function applyView() { world.setAttribute('transform', `translate(${view.x} ${view.y}) scale(${view.s})`); }

// ───────────────────────── Proyecto / guardado ─────────────────────────
function loadInitialProject() {
  const id = store.currentId();
  project = (id && store.getProject(id)) || store.listProjects()[0] || store.newProject('Mi primer circuito');
  sanitize();
}
function sanitize() {
  for (const c of project.components) { c.props = c.props || {}; c.rot = c.rot || 0; }
}
function persist() {
  const ok = store.saveProject(project);
  const s = $('#saveState');
  s.textContent = ok ? '✓ Guardado' : '⚠ Descarga tu archivo';
  s.style.color = ok ? '' : '#ffb4b4';
  s.title = ok ? 'Se guarda solo en esta computadora' : 'El navegador no deja guardar. Usa Descargar para no perder tu trabajo.';
}
function snapshot() {
  undoStack.push(JSON.stringify(project));
  if (undoStack.length > 80) undoStack.shift();
  redoStack = [];
  updateUndoButtons();
}
function changed({ physics = true } = {}) {
  persist();
  if (physics) resolve(); else renderBoard();
}
function undo() {
  if (!undoStack.length) return;
  redoStack.push(JSON.stringify(project));
  project = JSON.parse(undoStack.pop()); sanitize();
  runtime.ledOn = {}; selection = null;
  changed(); renderInspector(); updateUndoButtons();
}
function redo() {
  if (!redoStack.length) return;
  undoStack.push(JSON.stringify(project));
  project = JSON.parse(redoStack.pop()); sanitize();
  runtime.ledOn = {}; selection = null;
  changed(); renderInspector(); updateUndoButtons();
}
function updateUndoButtons() {
  $('[data-act=undo]').disabled = !undoStack.length;
  $('[data-act=redo]').disabled = !redoStack.length;
}
function openProject(p) {
  project = p; sanitize();
  undoStack = []; redoStack = []; seen = {}; selection = null; runtime.ledOn = {}; runtime.pressed.clear();
  $('#projectName').value = project.name;
  persist(); resolve(); renderInspector(); updateUndoButtons(); fitView();
}

// ───────────────────────── Simulación ─────────────────────────
function resolve() {
  result = solve(project, runtime);
  if (result.burnedNow.length) {
    persist();
    const c = byId(result.burnedNow[0]);
    sfx('pop');
    say(c.type === 'led'
      ? '¡Uy! El LED se quemó: le llegó demasiada corriente. Ponle una <b>resistencia</b> en el camino y cámbialo por uno nuevo.'
      : '¡El foco se fundió! Tenía demasiada corriente.', 'warn', 'burn');
  }
  const newly = evaluate(project, result, runtime, progress, seen);
  if (newly.length) { store.saveProgress(progress); onMissionsDone(newly); }
  statusMessage();
  renderBoard();
  updateReadings();
  updateBuzzerSound();
}

function statusMessage() {
  if (result.shorts.length) return say('¡<b>Cortocircuito</b>! Un cable une el + y el − de la pila sin pasar por nada. La pila se calienta. ¡Quita ese cable!', 'warn', 'short');
  if (result.burnedNow.length) return;
  const comps = project.components;
  if (!comps.length) return say('¡Hola! Soy <b>Chispa</b>. Arrastra una <b>pila</b> y un <b>foco</b> a la mesa para empezar.', 'info', 'empty');
  const bats = comps.filter((c) => c.type === 'battery');
  const loads = comps.filter((c) => ['bulb', 'led', 'motor', 'buzzer'].includes(c.type));
  if (!bats.length) return say('Falta la energía: agrega una <b>pila</b>.', 'info', 'nobat');
  if (!loads.length) return say('Ahora agrega algo que funcione con electricidad: un <b>foco</b>, un <b>LED</b>, un <b>motor</b> o un <b>timbre</b>.', 'info', 'noload');
  const working = loads.filter((c) => { const s = result.comps[c.id] || {}; return (s.bright || 0) > 0.05 || Math.abs(s.speed || 0) > 0.05 || (s.sound || 0) > 0; });
  if (!project.wires.length) return say('Une los <b>puntitos</b> con cables: haz clic en un puntito y luego en otro.', 'info', 'nowires');
  if (!working.length) {
    const rev = comps.find((c) => c.type === 'led' && result.comps[c.id]?.reverse);
    if (rev) return say('Ese LED está <b>al revés</b>: la pata + debe ir hacia el + de la pila. Selecciónalo y presiona <b>Voltear</b>.', 'info', 'rev');
    const anyI = bats.some((b) => Math.abs(result.comps[b.id]?.i || 0) > 1e-4);
    return say(anyI ? 'La corriente pasa, pero es muy poquita. Prueba con menos resistencia o más voltios.' : 'Nada funciona todavía: el circuito está <b>abierto</b>. ¿Hay un camino completo del + al − de la pila? ¿El interruptor está encendido?', 'info', anyI ? 'weak' : 'open');
  }
  const k = working.map((c) => c.id).sort().join(',');
  const msgs = ['¡Funciona! La corriente recorre todo el camino. ⚡', '¡Muy bien! El circuito está <b>cerrado</b>.', '¡Excelente trabajo, electricista!'];
  say(msgs[k.length % msgs.length], 'good', 'ok:' + k);
}

function say(html, kind = 'info', key = html) {
  if (key === lastStatus) return;
  lastStatus = key;
  const b = $('#chispaMsg');
  b.innerHTML = html;
  b.className = 'bubble ' + (kind === 'info' ? '' : kind);
  if (kind !== 'info') { const m = $('#chispaMini'); m.classList.remove('jump'); void m.offsetWidth; m.classList.add('jump'); }
}

// ───────────────────────── Dibujo del tablero ─────────────────────────
function el(tag, attrs = {}, html = '') {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (html) e.innerHTML = html;
  return e;
}
function renderBoard() {
  anim = { flows: [], rotors: [], waves: [] };
  // cables
  L.wires.replaceChildren();
  const bx = boxes();
  for (const w of project.wires) {
    const ca = byId(w.a.c), cb = byId(w.b.c);
    if (!ca || !cb) continue;
    const d = wirePathD(termPos(ca, w.a.t), termDir(ca, w.a.t), termPos(cb, w.b.t), termDir(cb, w.b.t), bx);
    const g = el('g', { class: 'wire' + (selection?.kind === 'wire' && selection.id === w.id ? ' sel' : ''), 'data-wire': w.id });
    g.append(el('path', { d, class: 'w-out', 'stroke-width': 10, fill: 'none', 'stroke-linecap': 'round' }));
    g.append(el('path', { d, stroke: WIRE_COLORS[w.color] || WIRE_COLORS.azul, 'stroke-width': 6, fill: 'none', 'stroke-linecap': 'round' }));
    g.append(el('path', { d, stroke: 'transparent', 'stroke-width': 18, fill: 'none' }));
    const flow = el('path', { d, class: 'flow', 'stroke-width': 3.5, fill: 'none', 'stroke-dasharray': '2 16' });
    g.append(flow);
    L.wires.append(g);
    anim.flows.push({ el: flow, i: result.wires[w.id] || 0, off: 0 });
  }
  // piezas
  L.comps.replaceChildren();
  L.terms.replaceChildren();
  for (const c of project.components) {
    const st = { ...(result.comps[c.id] || {}), pressed: runtime.pressed.has(c.id) };
    const sel = selection?.kind === 'comp' && selection.id === c.id;
    const g = el('g', {
      class: `comp t-${c.type}${sel ? ' sel' : ''}${c.type === 'switch' || c.type === 'button' ? ' clicky' : ''}`,
      'data-comp': c.id, transform: `translate(${c.x} ${c.y}) rotate(${c.rot || 0})`,
    }, drawComponent(c, st, settings.view));
    L.comps.append(g);
    const r = g.querySelector('[data-rotor]'); if (r) anim.rotors.push({ el: r, id: c.id, speed: st.speed || 0 });
    const wv = g.querySelector('[data-waves]'); if (wv) anim.waves.push({ el: wv, k: st.sound || 0 });
    // etiqueta y medidor (siempre derechos)
    const vertical = (c.rot || 0) % 180 !== 0;
    const lx = vertical ? c.x + 30 : c.x, ly = vertical ? c.y : c.y + (c.type === 'switch' ? 46 : 40);
    const anchor = vertical ? 'start' : 'middle';
    let lines = [];
    if (['resistor', 'pot', 'ldr'].includes(c.type)) lines.push({ t: compLabel(c), cls: 'label' });
    if (settings.meter && !['switch', 'button', 'node'].includes(c.type)) lines.push({ t: `${fmtVolt(st.v || 0)} · ${fmtCurrent(st.i || 0)}`, cls: 'meter' });
    lines.forEach((ln, k) => {
      const y = ly + 4 + k * 15;
      if (ln.cls === 'meter') {
        const w = ln.t.length * 6.6 + 10;
        L.comps.append(el('rect', { x: anchor === 'middle' ? lx - w / 2 : lx - 4, y: y - 11, width: w, height: 15, rx: 5, class: 'meter-bg' }));
      }
      const tx = el('text', { x: lx, y, 'text-anchor': anchor, class: ln.cls }); tx.textContent = ln.t; L.comps.append(tx);
    });
    // terminales
    for (const t of c.type === 'node' ? [0] : [0, 1]) {
      const p = termPos(c, t);
      const pol = POLAR.has(c.type) && c.type !== 'motor' ? (t === 0 ? ' pos' : ' neg') : '';
      const tg = el('g', { class: 'term' + pol, 'data-term': `${c.id}:${t}`, transform: `translate(${p.x} ${p.y})` });
      tg.append(el('circle', { r: c.type === 'node' ? 8 : 14, class: 'halo' }), el('circle', { r: 7, class: 'dot' }));
      const title = el('title'); title.textContent = `${TYPES[c.type].name}: ${TYPES[c.type].terms[t]}`; tg.append(title);
      L.terms.append(tg);
    }
  }
  $('#emptyHint').hidden = project.components.length > 0;
}

// ───────────────────────── Animación ─────────────────────────
let lastT = performance.now();
function tick(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
  for (const f of anim.flows) {
    const a = Math.abs(f.i);
    if (!settings.flow || a < 3e-4) { f.el.style.visibility = 'hidden'; continue; }
    f.el.style.visibility = 'visible';
    const speed = Math.min(170, 22 + 42 * Math.log10(1 + a * 1000));
    f.off -= Math.sign(f.i) * speed * dt;
    f.el.setAttribute('stroke-dashoffset', f.off.toFixed(1));
    f.el.style.opacity = Math.min(1, 0.45 + a * 30).toFixed(2);
  }
  for (const r of anim.rotors) {
    rotorAngle[r.id] = ((rotorAngle[r.id] || 0) + r.speed * 900 * dt) % 360;
    r.el.setAttribute('transform', `rotate(${rotorAngle[r.id].toFixed(1)})`);
  }
  for (const w of anim.waves) if (w.k) w.el.style.opacity = (0.4 + 0.6 * Math.abs(Math.sin(now / 90))).toFixed(2);
  requestAnimationFrame(tick);
}

// ───────────────────────── Sonido ─────────────────────────
let actx = null, buzzOsc = null, buzzGain = null;
function ensureAudio() {
  if (actx) { if (actx.state === 'suspended') actx.resume(); return; }
  try {
    actx = new (window.AudioContext || window.webkitAudioContext)();
    buzzOsc = actx.createOscillator(); buzzGain = actx.createGain();
    buzzOsc.type = 'square'; buzzOsc.frequency.value = 880; buzzGain.gain.value = 0;
    buzzOsc.connect(buzzGain).connect(actx.destination); buzzOsc.start();
  } catch { actx = null; }
}
function updateBuzzerSound() {
  if (!actx || !buzzGain) return;
  const k = Math.max(0, ...project.components.filter((c) => c.type === 'buzzer').map((c) => result.comps[c.id]?.sound || 0));
  buzzGain.gain.setTargetAtTime(settings.sound ? 0.035 * k : 0, actx.currentTime, 0.02);
}
function sfx(kind) {
  if (!actx || !settings.sound) return;
  const t = actx.currentTime;
  const tone = (f, d, type = 'sine', v = 0.12, at = 0) => {
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t + at);
    g.gain.setValueAtTime(v, t + at); g.gain.exponentialRampToValueAtTime(0.0001, t + at + d);
    o.connect(g).connect(actx.destination); o.start(t + at); o.stop(t + at + d + 0.02);
  };
  if (kind === 'click') tone(1400, 0.04, 'square', 0.05);
  if (kind === 'wire') tone(660, 0.08, 'triangle', 0.08);
  if (kind === 'pop') { tone(160, 0.25, 'sawtooth', 0.12); tone(90, 0.3, 'square', 0.06, 0.05); }
  if (kind === 'win') [523, 659, 784, 1047].forEach((f, k) => tone(f, 0.25, 'triangle', 0.1, k * 0.11));
}

// ───────────────────────── Acciones de edición ─────────────────────────
function addComponent(type, x, y) {
  snapshot();
  const c = { id: store.uid('c'), type, x: snap(x), y: snap(y), rot: 0, props: { ...TYPES[type].props } };
  project.components.push(c);
  selection = { kind: 'comp', id: c.id };
  changed(); renderInspector(); switchTab('inspect', false);
  return c;
}
function freeSpot() {
  const r = board.getBoundingClientRect();
  const center = toWorld(r.left + r.width / 2, r.top + r.height / 2);
  for (let ring = 0; ring < 12; ring++) {
    for (let k = 0; k < Math.max(1, ring * 6); k++) {
      const a = (k / Math.max(1, ring * 6)) * Math.PI * 2;
      const x = snap(center.x + Math.cos(a) * ring * 110), y = snap(center.y + Math.sin(a) * ring * 90);
      if (project.components.every((c) => Math.abs(c.x - x) > 110 || Math.abs(c.y - y) > 80)) return { x, y };
    }
  }
  return center;
}
function addWire(a, b) {
  if (a.c === b.c && a.t === b.t) return;
  const dup = project.wires.some((w) => (w.a.c === a.c && w.a.t === a.t && w.b.c === b.c && w.b.t === b.t) || (w.a.c === b.c && w.a.t === b.t && w.b.c === a.c && w.b.t === a.t));
  if (dup) return;
  const ca = byId(a.c), cb = byId(b.c);
  let color = 'azul';
  if ((ca.type === 'battery' && a.t === 0) || (cb.type === 'battery' && b.t === 0)) color = 'rojo';
  else if ((ca.type === 'battery' && a.t === 1) || (cb.type === 'battery' && b.t === 1)) color = 'negro';
  snapshot();
  project.wires.push({ id: store.uid('w'), a, b, color });
  sfx('wire');
  changed();
}
function deleteSelection() {
  if (!selection) return;
  snapshot();
  if (selection.kind === 'comp') {
    project.components = project.components.filter((c) => c.id !== selection.id);
    project.wires = project.wires.filter((w) => w.a.c !== selection.id && w.b.c !== selection.id);
    runtime.pressed.delete(selection.id);
  } else project.wires = project.wires.filter((w) => w.id !== selection.id);
  selection = null;
  changed(); renderInspector();
}
function rotateSelected() {
  const c = selection?.kind === 'comp' && byId(selection.id);
  if (!c) return;
  snapshot(); c.rot = ((c.rot || 0) + 90) % 360;
  changed({ physics: false }); renderInspector();
}
// Voltear: la pieza da media vuelta y sus patas cambian de cable (cambia + por −)
function flipSelected() {
  const c = selection?.kind === 'comp' && byId(selection.id);
  if (!c) return;
  snapshot();
  c.rot = ((c.rot || 0) + 180) % 360;
  for (const w of project.wires) for (const end of [w.a, w.b]) if (end.c === c.id) end.t = end.t ? 0 : 1;
  changed(); renderInspector();
}
function setProp(c, key, value, withSnapshot = true) {
  if (withSnapshot) snapshot();
  c.props[key] = value;
  changed();
}

// ───────────────────────── Interacción con el tablero ─────────────────────────
function termFromEl(t) { if (!t) return null; const [c, n] = t.dataset.term.split(':'); return { c, t: Number(n) }; }
function termUnder(x, y) { const e = document.elementFromPoint(x, y); return e && e.closest && e.closest('[data-term]'); }
function drawTemp(from, to) {
  const c = byId(from.c); if (!c) return;
  const pa = termPos(c, from.t), da = termDir(c, from.t);
  L.temp.replaceChildren(el('path', { class: 'temp-wire', d: wirePathD(pa, da, to, { x: 0, y: 0 }) }));
}
function clearTemp() { L.temp.replaceChildren(); $$('.term.hot').forEach((t) => t.classList.remove('hot')); }

board.addEventListener('pointerdown', (e) => {
  if (e.button !== 0 && e.pointerType === 'mouse') return;
  ensureAudio();
  board.focus({ preventScroll: true });
  const termEl = e.target.closest('[data-term]');
  const compEl = e.target.closest('[data-comp]');
  const wireEl = e.target.closest('[data-wire]');
  if (pendingWire) {
    const to = termFromEl(termEl);
    const from = pendingWire; pendingWire = null; clearTemp();
    if (to && !(to.c === from.c && to.t === from.t)) { addWire(from, to); return; }
    if (to) return;
  }
  if (termEl) {
    gesture = { kind: 'wire', from: termFromEl(termEl), sx: e.clientX, sy: e.clientY, moved: false };
    board.setPointerCapture(e.pointerId);
    drawTemp(gesture.from, toWorld(e.clientX, e.clientY));
    return;
  }
  if (compEl) {
    const c = byId(compEl.dataset.comp);
    const prevSel = selection?.id;
    selection = { kind: 'comp', id: c.id };
    gesture = { kind: 'comp', id: c.id, sx: e.clientX, sy: e.clientY, ox: c.x, oy: c.y, moved: false, before: JSON.stringify(project) };
    if (c.type === 'button') { runtime.pressed.add(c.id); sfx('click'); resolve(); } else renderBoard();
    if (prevSel !== c.id) renderInspector();
    switchTab('inspect', false);
    board.setPointerCapture(e.pointerId);
    return;
  }
  if (wireEl) {
    selection = { kind: 'wire', id: wireEl.dataset.wire };
    renderBoard(); renderInspector(); switchTab('inspect', false);
    return;
  }
  gesture = { kind: 'pan', sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y, moved: false };
  board.classList.add('panning');
  board.setPointerCapture(e.pointerId);
});

board.addEventListener('pointermove', (e) => {
  if (!gesture) {
    if (pendingWire) {
      drawTemp(pendingWire, toWorld(e.clientX, e.clientY));
      $$('.term.hot').forEach((t) => t.classList.remove('hot'));
      termUnder(e.clientX, e.clientY)?.classList.add('hot');
    }
    return;
  }
  const dx = e.clientX - gesture.sx, dy = e.clientY - gesture.sy;
  if (Math.hypot(dx, dy) > 4) gesture.moved = true;
  if (gesture.kind === 'wire') {
    drawTemp(gesture.from, toWorld(e.clientX, e.clientY));
    $$('.term.hot').forEach((t) => t.classList.remove('hot'));
    termUnder(e.clientX, e.clientY)?.classList.add('hot');
  } else if (gesture.kind === 'comp' && gesture.moved) {
    const c = byId(gesture.id);
    const nx = snap(gesture.ox + dx / view.s), ny = snap(gesture.oy + dy / view.s);
    if (nx !== c.x || ny !== c.y) { c.x = nx; c.y = ny; renderBoard(); }
  } else if (gesture.kind === 'pan') {
    view.x = gesture.vx + dx; view.y = gesture.vy + dy; applyView();
  }
});

function endGesture(e) {
  const g = gesture; gesture = null;
  board.classList.remove('panning');
  if (!g) return;
  if (g.kind === 'wire') {
    const to = termFromEl(termUnder(e.clientX, e.clientY));
    if (to && !(to.c === g.from.c && to.t === g.from.t)) { clearTemp(); addWire(g.from, to); }
    else if (!g.moved) { pendingWire = g.from; say('Ahora haz clic en <b>otro puntito</b> para poner el cable. (Esc para cancelar)', 'info', 'pending' + Date.now()); }
    else clearTemp();
  } else if (g.kind === 'comp') {
    const c = byId(g.id);
    if (c?.type === 'button' && runtime.pressed.has(c.id)) { runtime.pressed.delete(c.id); resolve(); }
    if (g.moved) {
      undoStack.push(g.before); redoStack = []; updateUndoButtons();
      changed({ physics: false });
    } else if (c?.type === 'switch') {
      sfx('click'); setProp(c, 'on', !c.props.on); renderInspector();
    }
  } else if (g.kind === 'pan' && !g.moved) {
    if (selection) { selection = null; renderBoard(); renderInspector(); }
  }
}
board.addEventListener('pointerup', endGesture);
board.addEventListener('pointercancel', endGesture);
board.addEventListener('wheel', (e) => {
  e.preventDefault();
  zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.0015));
}, { passive: false });
function zoomAt(cx, cy, f) {
  const r = board.getBoundingClientRect();
  const ns = Math.min(2.5, Math.max(0.35, view.s * f));
  const px = cx - r.left, py = cy - r.top;
  view.x = px - (px - view.x) * (ns / view.s);
  view.y = py - (py - view.y) * (ns / view.s);
  view.s = ns; applyView();
}
function fitView() {
  const r = board.getBoundingClientRect();
  const cs = project.components;
  if (!cs.length) { view = { x: r.width / 2, y: r.height / 2 - 40, s: 1 }; applyView(); return; }
  const xs = cs.flatMap((c) => [c.x - 60, c.x + 60]), ys = cs.flatMap((c) => [c.y - 60, c.y + 70]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const s = Math.min(1.15, Math.max(0.4, Math.min((r.width - 80) / (maxX - minX), (r.height - 160) / (maxY - minY))));
  view = { s, x: r.width / 2 - ((minX + maxX) / 2) * s, y: (r.height - 70) / 2 - ((minY + maxY) / 2) * s };
  applyView();
}

document.addEventListener('keydown', (e) => {
  const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName) && document.activeElement.type !== 'range';
  if (e.key === 'Escape') {
    if (!$('#modal').hidden) { closeModal(); return; }
    if (pendingWire) { pendingWire = null; clearTemp(); return; }
    if (selection) { selection = null; renderBoard(); renderInspector(); }
    return;
  }
  if (typing) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
  if (!$('#modal').hidden) return;
  if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSelection(); }
  else if (e.key.toLowerCase() === 'r' && !e.ctrlKey) rotateSelected();
  else if (e.key.toLowerCase() === 'f' && !e.ctrlKey) { const c = selection?.kind === 'comp' && byId(selection.id); if (c && POLAR.has(c.type)) flipSelected(); }
});

// ───────────────────────── Paleta ─────────────────────────
function buildPalette() {
  const pal = $('#palette');
  pal.innerHTML = CATS.map((cat) => `<div class="pal-cat">${cat}</div>` + Object.entries(TYPES).filter(([, t]) => t.cat === cat).map(([k, t]) =>
    `<button class="pal-item" data-type="${k}" title="${esc(t.short)}">${paletteSVG(k)}<span><b>${t.name}</b><small>${t.short}</small></span></button>`).join('')).join('');
  pal.addEventListener('pointerdown', (e) => {
    const item = e.target.closest('.pal-item'); if (!item) return;
    ensureAudio();
    e.preventDefault();
    const type = item.dataset.type;
    const pg = { type, sx: e.clientX, sy: e.clientY, moved: false, ghost: null };
    const move = (ev) => {
      if (!pg.moved && Math.hypot(ev.clientX - pg.sx, ev.clientY - pg.sy) > 6) {
        pg.moved = true;
        pg.ghost = document.createElement('div'); pg.ghost.className = 'drag-ghost'; pg.ghost.innerHTML = paletteSVG(type);
        document.body.append(pg.ghost);
      }
      if (pg.ghost) { pg.ghost.style.left = ev.clientX + 'px'; pg.ghost.style.top = ev.clientY + 'px'; }
    };
    const up = (ev) => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
      pg.ghost?.remove();
      const r = board.getBoundingClientRect();
      const inBoard = ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom;
      if (pg.moved && inBoard) { const w = toWorld(ev.clientX, ev.clientY); addComponent(type, w.x, w.y); }
      else if (!pg.moved) { const p = freeSpot(); addComponent(type, p.x, p.y); }
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  });
}

// ───────────────────────── Panel lateral: pestañas ─────────────────────────
let currentTab = 'missions';
function switchTab(tab, force = true) {
  if (!force && tab === 'inspect' && currentTab === 'missions' && !selection) return;
  currentTab = tab;
  $$('.tab').forEach((t) => t.setAttribute('aria-selected', t.dataset.tab === tab));
  $('#panelMissions').hidden = tab !== 'missions';
  $('#panelInspect').hidden = tab !== 'inspect';
}
$$('.tab').forEach((t) => t.addEventListener('click', () => switchTab(t.dataset.tab)));

// ───────────────────────── Panel: Pieza seleccionada ─────────────────────────
function renderInspector() {
  const P = $('#panelInspect');
  if (!selection) {
    P.innerHTML = `<h3 class="panel-title">Nada seleccionado</h3>
      <p class="muted small">Haz clic en una pieza o en un cable para ver qué es y cambiarlo.</p>
      <ul class="tips">
        <li><b>Agregar:</b> arrastra una pieza desde la izquierda.</li>
        <li><b>Cable:</b> clic en un puntito amarillo y luego en otro.</li>
        <li><b>Varios cables</b> pueden salir del mismo puntito.</li>
        <li><b>Girar:</b> tecla R · <b>Borrar:</b> tecla Supr.</li>
        <li><b>Mover la mesa:</b> arrastra el fondo.</li>
      </ul>`;
    return;
  }
  if (selection.kind === 'wire') {
    const w = project.wires.find((x) => x.id === selection.id);
    if (!w) { selection = null; return renderInspector(); }
    P.innerHTML = `<h3 class="panel-title">Cable</h3>
      <p class="insp-desc">Los cables llevan la corriente de una pieza a otra. Por dentro son de <b>cobre</b> (conductor) y por fuera de <b>plástico</b> (aislante).</p>
      <div class="field"><span class="flabel">Color del cable</span><div class="wire-colors">${Object.entries(WIRE_COLORS).map(([k, v]) =>
        `<button class="swatch${w.color === k ? ' on' : ''}" style="background:${v}" data-wcolor="${k}" title="${k}"></button>`).join('')}</div>
        <p class="muted small">Consejo: rojo para el +, negro para el −.</p></div>
      <div class="readings"><div class="reading" style="grid-column:span 2"><small>Corriente por este cable</small><b id="rdI">${fmtCurrent(result.wires[w.id] || 0)}</b></div></div>
      <div class="actions"><button class="btn danger" data-do="delete">${icon('trash-2')} Borrar cable</button></div>`;
    return;
  }
  const c = byId(selection.id);
  if (!c) { selection = null; return renderInspector(); }
  const t = TYPES[c.type], p = c.props, st = result.comps[c.id] || {};
  let fields = '';
  if (c.type === 'battery') fields = seg('Voltaje de la pila', 'volts', [[1.5, '1.5 V'], [3, '3 V'], [4.5, '4.5 V'], [9, '9 V']], p.volts);
  if (c.type === 'resistor') fields = seg('Valor (ohmios)', 'ohms', [[100, '100 Ω'], [220, '220 Ω'], [330, '330 Ω'], [470, '470 Ω'], [1000, '1 kΩ'], [4700, '4.7 kΩ'], [10000, '10 kΩ']], p.ohms);
  if (c.type === 'led') {
    fields = `<div class="field"><span class="flabel">Color del LED</span><div class="seg">${Object.entries(LED_COLORS).map(([k, v]) =>
      `<button class="swatch${p.color === k ? ' on' : ''}" style="background:${v.hex}" data-prop="color" data-val="${k}" title="${k}"></button>`).join('')}</div></div>`;
    if (p.burned) fields = `<div class="alert"><b>Este LED se quemó.</b> Recibió más de 40 mA. Pon una resistencia en el camino y luego cámbialo.</div>
      <button class="btn gold" data-do="repair">${icon('sparkles')} Poner un LED nuevo</button>` + fields;
  }
  if (c.type === 'bulb' && p.burned) fields = `<div class="alert"><b>El foco se fundió.</b> Tenía demasiada corriente.</div><button class="btn gold" data-do="repair">${icon('sparkles')} Cambiar foco</button>`;
  if (c.type === 'switch') fields = `<div class="field"><button class="btn ${p.on ? 'primary' : ''}" data-do="toggle">${p.on ? '● ENCENDIDO (cerrado)' : '○ APAGADO (abierto)'}</button><p class="muted small">También puedes hacer clic sobre el interruptor en la mesa.</p></div>`;
  if (c.type === 'button') fields = `<p class="muted small"><b>Mantén presionado</b> el clic sobre el pulsador en la mesa para que funcione.</p>`;
  if (c.type === 'ldr') fields = `<div class="field"><label for="rng">Luz del ambiente: <span id="rngVal">${Math.round(p.light)}%</span></label>
      <div class="range-row">🌙<input type="range" id="rng" min="0" max="100" value="${p.light}" data-range="light">☀️</div>
      <p class="muted small">Resistencia ahora: <b id="rngR">${fmtOhms(ldrResistance(p.light))}</b></p></div>`;
  if (c.type === 'pot') fields = `<div class="field"><label for="rng">Gira la perilla: <span id="rngVal">${Math.round(p.value)}%</span></label>
      <div class="range-row">↺<input type="range" id="rng" min="0" max="100" value="${p.value}" data-range="value">↻</div>
      <p class="muted small">Resistencia ahora: <b id="rngR">${fmtOhms(potResistance(p.value))}</b></p></div>`;
  const polarNote = POLAR.has(c.type) ? `<button class="btn" data-do="flip" title="Tecla F">${icon('rotate-cw')} Voltear (+ ↔ −)</button>` : '';
  P.innerHTML = `<div class="insp-head">${bigSVG(c.type, settings.view, { ...p, burned: false })}<div><h3 class="panel-title">${t.name}</h3><span class="muted small">${esc(t.short)}</span></div></div>
    <p class="insp-desc">${t.desc}</p>
    ${fields}
    ${c.type === 'node' ? '' : `<div class="readings">
      <div class="reading"><small>Voltaje (empuje)</small><b id="rdV">${fmtVolt(st.v || 0)}</b></div>
      <div class="reading"><small>${c.type === 'battery' ? 'Corriente que entrega' : 'Corriente que pasa'}</small><b id="rdI">${fmtCurrent(st.i || 0)}</b></div>
    </div>`}
    <div class="actions">
      ${c.type === 'node' ? '' : `<button class="btn" data-do="rotate" title="Tecla R">${icon('rotate-cw')} Girar</button>`}
      ${polarNote}
      <button class="btn danger" data-do="delete" title="Tecla Supr">${icon('trash-2')} Borrar</button>
    </div>`;
}
function seg(label, prop, opts, cur) {
  return `<div class="field"><span class="flabel">${label}</span><div class="seg">${opts.map(([v, l]) =>
    `<button class="${cur === v ? 'on' : ''}" data-prop="${prop}" data-val="${v}" data-num="1">${l}</button>`).join('')}</div></div>`;
}
function updateReadings() {
  if (!selection || currentTab !== 'inspect') return;
  if (selection.kind === 'wire') { const e = $('#rdI'); if (e) e.textContent = fmtCurrent(result.wires[selection.id] || 0); return; }
  const st = result.comps[selection.id] || {};
  const v = $('#rdV'), i = $('#rdI');
  if (v) v.textContent = fmtVolt(st.v || 0);
  if (i) i.textContent = fmtCurrent(st.i || 0);
}
let rangeSnap = false;
$('#panelInspect').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  const c = selection?.kind === 'comp' ? byId(selection.id) : null;
  if (b.dataset.wcolor) {
    const w = project.wires.find((x) => x.id === selection.id);
    snapshot(); w.color = b.dataset.wcolor; changed({ physics: false }); renderInspector(); return;
  }
  if (b.dataset.prop && c) {
    const v = b.dataset.num ? Number(b.dataset.val) : b.dataset.val;
    if (c.type === 'led' && b.dataset.prop === 'color') runtime.ledOn[c.id] = false;
    setProp(c, b.dataset.prop, v); renderInspector(); return;
  }
  switch (b.dataset.do) {
    case 'delete': deleteSelection(); break;
    case 'rotate': rotateSelected(); break;
    case 'flip': flipSelected(); break;
    case 'toggle': sfx('click'); setProp(c, 'on', !c.props.on); renderInspector(); break;
    case 'repair': snapshot(); c.props.burned = false; runtime.ledOn[c.id] = false; lastStatus = ''; changed(); renderInspector(); break;
  }
});
$('#panelInspect').addEventListener('input', (e) => {
  const r = e.target.closest('[data-range]'); if (!r) return;
  const c = byId(selection.id); if (!c) return;
  if (!rangeSnap) { snapshot(); rangeSnap = true; }
  c.props[r.dataset.range] = Number(r.value);
  $('#rngVal').textContent = r.value + '%';
  $('#rngR').textContent = fmtOhms(c.type === 'ldr' ? ldrResistance(c.props.light) : potResistance(c.props.value));
  changed();
});
$('#panelInspect').addEventListener('change', () => { rangeSnap = false; });

// ───────────────────────── Panel: Misiones ─────────────────────────
function activeMission() {
  const list = MISSIONS.filter((m) => m.clase === settings.clase);
  return list.find((m) => m.id === settings.mission) || list.find((m) => !progress.missions[m.id]) || list[0];
}
function renderMissions() {
  const P = $('#panelMissions');
  const list = MISSIONS.filter((m) => m.clase === settings.clase);
  const done = list.filter((m) => progress.missions[m.id]).length;
  const act = activeMission();
  const isDone = !!progress.missions[act.id];
  P.innerHTML = `
    <div class="clase-tabs">${[1, 2, 3].map((n) => `<button class="${settings.clase === n ? 'on' : ''}" data-clase="${n}">Clase ${n}</button>`).join('')}</div>
    <h3 class="panel-title">${CLASES[settings.clase].title.split('· ')[1]}</h3>
    <div class="progress" aria-label="Progreso"><span style="width:${(done / list.length) * 100}%"></span></div>
    <span class="muted small"><b>${done}</b> de ${list.length} misiones completadas ${'★'.repeat(done)}</span>
    <div class="mission-card">
      <header><small>Misión ${list.indexOf(act) + 1} ${isDone ? '· <span class="done-badge">✓ Lograda</span>' : ''}</small><h3>${act.title}</h3></header>
      <div class="body">
        <p class="goal">${act.goal}</p>
        <ol>${act.steps.map((s) => `<li>${s}</li>`).join('')}</ol>
        ${isDone ? `<div class="learn"><b>Aprendiste:</b> ${act.learn}</div>` : `<button class="hint-btn" data-hint>💡 Pista de Chispa</button><div class="hint" hidden>${act.hint}</div>`}
      </div>
    </div>
    <ul class="mission-list">${list.map((m, k) => `<li><button class="mission-item${progress.missions[m.id] ? ' done' : ''}${m.id === act.id ? ' active' : ''}" data-mission="${m.id}">
      <span class="num">${progress.missions[m.id] ? '✓' : k + 1}</span>${m.title}</button></li>`).join('')}</ul>`;
}
$('#panelMissions').addEventListener('click', (e) => {
  const cl = e.target.closest('[data-clase]');
  if (cl) { settings.clase = Number(cl.dataset.clase); settings.mission = null; store.saveSettings(settings); renderMissions(); return; }
  const m = e.target.closest('[data-mission]');
  if (m) { settings.mission = m.dataset.mission; store.saveSettings(settings); renderMissions(); return; }
  if (e.target.closest('[data-hint]')) { const h = $('#panelMissions .hint'); h.hidden = !h.hidden; }
});
function onMissionsDone(list) {
  sfx('win'); confetti();
  const m = list[list.length - 1];
  say(`¡Misión lograda: <b>${m.title}</b>! ${m.learn}`, 'good', 'mission:' + m.id);
  toast(`⭐ ¡Misión lograda: ${m.title}!`);
  if (m.clase === settings.clase && (settings.mission === m.id || !settings.mission)) {
    const next = MISSIONS.find((x) => x.clase === m.clase && !progress.missions[x.id]);
    settings.mission = next ? next.id : m.id; store.saveSettings(settings);
  }
  renderMissions();
  const clase = m.clase, all = MISSIONS.filter((x) => x.clase === clase);
  if (all.every((x) => progress.missions[x.id]) && list.some((x) => x.clase === clase)) {
    setTimeout(() => openModal(`<div class="celebrate"><img src="img/chispa.svg" alt="">
      <h2 style="padding:0">¡Completaste la Clase ${clase}!</h2><div class="stars">${'★'.repeat(all.length)}</div>
      <p>${esc(settings.student || 'Electricista')}, terminaste todas las misiones de <b>${CLASES[clase].title.split('· ')[1]}</b>.<br>¡Muéstrale a tu docente!</p>
      <button class="btn primary" data-act="close">¡Genial!</button></div>`), 900);
  }
}

// ───────────────────────── Modales ─────────────────────────
function openModal(html) { $('#modalBody').innerHTML = html; $('#modal').hidden = false; hydrateIcons($('#modal')); }
function closeModal() { $('#modal').hidden = true; $('#modalBody').innerHTML = ''; }
$('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal') closeModal(); });

function showWelcome() {
  openModal(`<div class="welcome"><img src="img/chispa.svg" alt="Chispa">
    <div><h2>¡Hola! Soy Chispa ⚡</h2>
    <p>Soy un <b>LED</b>: mi pata larga es el <b>+</b> y la corta es el <b>−</b>. En este laboratorio vas a construir circuitos eléctricos sin peligro.</p>
    <label for="stName"><b>¿Cómo te llamas?</b></label>
    <input id="stName" maxlength="40" placeholder="Escribe tu nombre" value="${esc(settings.student)}" autocomplete="off">
    <p class="muted small">Tus proyectos se guardan solos en esta computadora. Para llevarlos a otra, usa <b>Descargar</b>.</p>
    <button class="btn primary" id="startBtn">${icon('zap')} ¡Empezar!</button></div></div>`);
  const go = () => { settings.student = $('#stName').value.trim(); settings.welcomed = true; store.saveSettings(settings); closeModal(); say(`¡Bienvenido${settings.student ? ', <b>' + esc(settings.student) + '</b>' : ''}! Mira la primera misión a la derecha.`, 'good', 'welcome'); };
  $('#startBtn').addEventListener('click', go);
  $('#stName').addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  setTimeout(() => $('#stName')?.focus(), 50);
}

let lessonIdx = 0;
function showLessons(i = lessonIdx) {
  lessonIdx = (i + LESSONS.length) % LESSONS.length;
  const ls = LESSONS[lessonIdx];
  openModal(`<div class="lesson-nav">${LESSONS.map((l, k) => `<button class="${k === lessonIdx ? 'on' : ''}" data-lesson="${k}">${k + 1}. ${l.title}</button>`).join('')}</div>
    <h2>${ls.title}</h2><div class="lesson-body">${typeof ls.html === 'function' ? ls.html() : ls.html}</div>
    <div class="lesson-foot"><button class="btn" data-lesson="${lessonIdx - 1}">${icon('chevron-left')} Anterior</button>
    <button class="btn primary" data-lesson="${lessonIdx + 1}">Siguiente ${icon('chevron-right')}</button></div>`);
}
$('#modalBody').addEventListener('click', (e) => {
  const b = e.target.closest('[data-lesson]');
  if (b) { showLessons(Number(b.dataset.lesson)); $('.modal-card').scrollTop = 0; }
});

function showProjects() {
  const list = store.listProjects();
  if (!list.some((p) => p.id === project.id)) list.unshift(project);
  const fmt = (d) => { try { return new Date(d).toLocaleString('es-EC', { dateStyle: 'medium', timeStyle: 'short' }); } catch { return ''; } };
  openModal(`<h2>Mis proyectos</h2>
    <p class="muted small">Guardados en <b>esta computadora</b>${settings.student ? ' · ' + esc(settings.student) : ''}. Para llevarlos a otra computadora usa <b>Descargar</b>.</p>
    <ul class="proj-list">${list.map((p) => `<li class="proj${p.id === project.id ? ' current' : ''}" data-pid="${p.id}">
      <div class="info"><b>${esc(p.name)}</b><small>${p.components.length} piezas · ${p.wires.length} cables · ${fmt(p.updated)}</small></div>
      ${p.id === project.id ? '<span class="done-badge">Abierto</span>' : `<button class="btn primary" data-pact="open">Abrir</button>`}
      <button class="btn" data-pact="dup" title="Duplicar">${icon('copy')}</button>
      <button class="btn danger" data-pact="del" title="Borrar">${icon('trash-2')}</button></li>`).join('')}</ul>
    <div class="actions"><button class="btn gold" data-act="new">${icon('file-plus')} Nuevo proyecto</button>
    <button class="btn" data-act="import">${icon('upload')} Abrir archivo .json</button>
    <button class="btn" data-pact="name">${icon('user')} Cambiar mi nombre</button></div>`);
}
$('#modalBody').addEventListener('click', (e) => {
  const b = e.target.closest('[data-pact]'); if (!b) return;
  const pid = b.closest('[data-pid]')?.dataset.pid;
  if (b.dataset.pact === 'open') { openProject(store.getProject(pid)); closeModal(); }
  if (b.dataset.pact === 'dup') {
    const src = pid === project.id ? project : store.getProject(pid);
    const copy = JSON.parse(JSON.stringify(src)); copy.id = store.uid('p'); copy.name = (src.name + ' (copia)').slice(0, 60);
    store.saveProject(copy); store.saveProject(project); showProjects();
  }
  if (b.dataset.pact === 'del') {
    const p = pid === project.id ? project : store.getProject(pid);
    const li = b.closest('.proj');
    li.innerHTML = `<div class="info"><b>¿Borrar "${esc(p.name)}"?</b><small>No se puede deshacer.</small></div>
      <button class="btn" data-pact="cancel">No</button><button class="btn danger" data-pact="confirmdel">Sí, borrar</button>`;
  }
  if (b.dataset.pact === 'cancel') showProjects();
  if (b.dataset.pact === 'confirmdel') {
    store.deleteProject(pid);
    if (pid === project.id) { const rest = store.listProjects(); openProject(rest[0] || store.newProject('Mi circuito')); }
    showProjects();
  }
  if (b.dataset.pact === 'name') showWelcome();
});

// ───────────────────────── Archivos ─────────────────────────
function doExport() {
  persist();
  const name = store.exportProject(project, progress, settings.student);
  toast(`📁 Descargado: ${name}`);
  say(`Listo. Tu archivo <b>${esc(name)}</b> está en la carpeta <b>Descargas</b>. Guárdalo en tu USB o en OneDrive.`, 'good', 'exp' + Date.now());
}
function importText(text) {
  try {
    const { project: p, progress: pr, student } = store.parseImport(text);
    if (pr) { for (const [k, v] of Object.entries(pr.missions)) if (!progress.missions[k]) progress.missions[k] = v; store.saveProgress(progress); }
    if (student && !settings.student) { settings.student = student; store.saveSettings(settings); }
    openProject(p); closeModal(); renderMissions();
    toast(`📂 Abierto: ${p.name}`);
  } catch (err) { toast('⚠ ' + err.message); }
}
$('#fileInput').addEventListener('change', async (e) => {
  const f = e.target.files[0]; e.target.value = '';
  if (f) importText(await f.text());
});
$('#stage').addEventListener('dragover', (e) => { e.preventDefault(); });
$('#stage').addEventListener('drop', async (e) => {
  e.preventDefault();
  const f = e.dataTransfer.files[0];
  if (f && /json$/i.test(f.name)) importText(await f.text());
});

// ───────────────────────── Barra de herramientas ─────────────────────────
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  ensureAudio();
  switch (b.dataset.act) {
    case 'new': { const p = store.newProject(`Circuito ${store.listProjects().length + 1}`); store.saveProject(project); openProject(p); closeModal(); toast('✨ Proyecto nuevo'); $('#projectName').select(); break; }
    case 'projects': showProjects(); break;
    case 'export': doExport(); break;
    case 'import': $('#fileInput').click(); break;
    case 'undo': undo(); break;
    case 'redo': redo(); break;
    case 'wires': settings.wires = settings.wires === 'curvos' ? 'rectos' : 'curvos'; saveToggles(); renderBoard(); break;
    case 'view': settings.view = settings.view === 'dibujo' ? 'simbolo' : 'dibujo'; saveToggles(); renderBoard(); renderInspector(); break;
    case 'flow': settings.flow = !settings.flow; saveToggles(); break;
    case 'meter': settings.meter = !settings.meter; saveToggles(); renderBoard(); break;
    case 'sound': settings.sound = !settings.sound; saveToggles(); updateBuzzerSound(); break;
    case 'learn': showLessons(); break;
    case 'zoomin': { const r = board.getBoundingClientRect(); zoomAt(r.left + r.width / 2, r.top + r.height / 2, 1.2); break; }
    case 'zoomout': { const r = board.getBoundingClientRect(); zoomAt(r.left + r.width / 2, r.top + r.height / 2, 1 / 1.2); break; }
    case 'fit': fitView(); break;
    case 'close': closeModal(); break;
  }
});
function saveToggles() {
  store.saveSettings(settings);
  $('[data-act=view]').classList.toggle('on', settings.view === 'simbolo');
  $('#viewLabel').textContent = settings.view === 'simbolo' ? 'Símbolos' : 'Dibujo';
  $('#wiresLabel').textContent = settings.wires === 'curvos' ? 'Curvos' : 'Rectos';
  $('[data-act=flow]').classList.toggle('on', settings.flow);
  $('[data-act=meter]').classList.toggle('on', settings.meter);
  const s = $('[data-act=sound]'); s.classList.toggle('on', settings.sound); s.innerHTML = `<i>${icon(settings.sound ? 'volume-2' : 'volume-x')}</i>`;
}
$('#projectName').addEventListener('input', (e) => { project.name = e.target.value.slice(0, 60) || 'Sin nombre'; persist(); });
$('#projectName').addEventListener('keydown', (e) => { if (e.key === 'Enter') e.target.blur(); });

// ───────────────────────── Extras visuales ─────────────────────────
let toastTimer;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.hidden = true), 2800); }
function confetti() {
  const cv = $('#confetti'), ctx = cv.getContext('2d');
  cv.width = innerWidth; cv.height = innerHeight;
  const cols = ['#E0A62E', '#FFD24A', '#17324D', '#2B6CB0', '#16a34a', '#e53e3e'];
  const ps = Array.from({ length: 120 }, () => ({ x: innerWidth / 2 + (Math.random() - 0.5) * 300, y: innerHeight / 3, vx: (Math.random() - 0.5) * 12, vy: -Math.random() * 12 - 4, r: Math.random() * 6 + 3, c: cols[Math.floor(Math.random() * cols.length)], a: Math.random() * 6 }));
  let f = 0;
  (function step() {
    ctx.clearRect(0, 0, cv.width, cv.height);
    for (const p of ps) { p.x += p.vx; p.y += p.vy; p.vy += 0.35; p.a += 0.2; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.fillStyle = p.c; ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r); ctx.restore(); }
    if (++f < 110) requestAnimationFrame(step); else ctx.clearRect(0, 0, cv.width, cv.height);
  })();
}
function hydrateIcons(root = document) { $$('i[data-icon]', root).forEach((i) => { if (!i.innerHTML) i.innerHTML = icon(i.dataset.icon); }); }

// ───────────────────────── Inicio ─────────────────────────
function init() {
  hydrateIcons();
  buildPalette();
  loadInitialProject();
  $('#projectName').value = project.name;
  saveToggles();
  persist();
  resolve();
  renderInspector();
  renderMissions();
  switchTab('missions');
  updateUndoButtons();
  requestAnimationFrame(() => { fitView(); });
  addEventListener('resize', () => { if (!project.components.length) fitView(); });
  requestAnimationFrame(tick);
  if (!settings.welcomed) showWelcome();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
}
init();
// Para pruebas y para el docente desde la consola
window.chispa = { get project() { return project; }, get result() { return result; }, progress: () => progress, resolve };
