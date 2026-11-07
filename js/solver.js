// Solucionador de circuitos de corriente continua (análisis nodal modificado simplificado).
// Cada terminal de cada componente es un nodo. Los cables son resistencias muy pequeñas,
// así podemos saber cuánta corriente pasa por cada cable y animarla.

export const LED_COLORS = {
  rojo:     { vf: 1.8, hex: '#ff3b3b', glow: '#ff6b6b', name: 'rojo' },
  amarillo: { vf: 2.0, hex: '#ffd21f', glow: '#ffe066', name: 'amarillo' },
  verde:    { vf: 2.1, hex: '#22c55e', glow: '#5eea8f', name: 'verde' },
  azul:     { vf: 3.0, hex: '#3b82f6', glow: '#7cb3ff', name: 'azul' },
  blanco:   { vf: 3.0, hex: '#f1f5f9', glow: '#ffffff', name: 'blanco' },
};

export const CONST = {
  WIRE_R: 0.002,
  SWITCH_R: 0.01,
  BATTERY_R: 0.5,
  LED_RS: 15,
  LED_MAX_I: 0.04,     // 40 mA: más que esto y el LED se quema
  LED_FULL_I: 0.018,   // brillo completo
  BULB_R: 20,
  BULB_FULL_I: 0.15,
  BULB_MAX_I: 0.6,
  MOTOR_R: 15,
  MOTOR_FULL_I: 0.2,
  BUZZER_R: 150,
  BUZZER_MIN_I: 0.004,
  SHORT_I: 2,          // más de 2 A en una pila = cortocircuito
  GMIN: 1e-9,
};

export function ldrResistance(light) { // light 0..100
  const L = Math.max(0, Math.min(100, light)) / 100;
  return Math.pow(10, 5.3 - 3 * L); // 200 kΩ (oscuro) .. 200 Ω (mucha luz)
}
export function potResistance(v) { // v 0..100
  const t = Math.max(0, Math.min(100, v)) / 100;
  return 100 * Math.pow(100, t); // 100 Ω .. 10 kΩ
}

function gauss(A, b) {
  const n = b.length;
  for (let c = 0; c < n; c++) {
    let p = c, best = Math.abs(A[c][c]);
    for (let r = c + 1; r < n; r++) { const v = Math.abs(A[r][c]); if (v > best) { best = v; p = r; } }
    if (best < 1e-300) continue;
    if (p !== c) { [A[c], A[p]] = [A[p], A[c]]; [b[c], b[p]] = [b[p], b[c]]; }
    const piv = A[c][c], rowC = A[c];
    for (let r = c + 1; r < n; r++) {
      const f = A[r][c] / piv;
      if (f === 0) continue;
      const row = A[r];
      for (let k = c; k < n; k++) row[k] -= f * rowC[k];
      b[r] -= f * b[c];
    }
  }
  const x = new Array(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = b[r];
    for (let k = r + 1; k < n; k++) s -= A[r][k] * x[k];
    x[r] = Math.abs(A[r][r]) < 1e-300 ? 0 : s / A[r][r];
  }
  return x;
}

// Resistencia (o modelo) de cada componente en este instante
function linearR(c, runtime) {
  const p = c.props || {};
  switch (c.type) {
    case 'resistor': return p.ohms || 220;
    case 'bulb': return p.burned ? null : CONST.BULB_R;
    case 'motor': return CONST.MOTOR_R;
    case 'buzzer': return CONST.BUZZER_R;
    case 'switch': return p.on ? CONST.SWITCH_R : null;
    case 'button': return runtime.pressed.has(c.id) ? CONST.SWITCH_R : null;
    case 'ldr': return ldrResistance(p.light ?? 50);
    case 'pot': return potResistance(p.value ?? 50);
    default: return undefined;
  }
}

/**
 * Resuelve el circuito.
 * @returns {{comps: Object, wires: Object, shorts: string[], burnedNow: string[]}}
 */
export function solve(project, runtime) {
  const comps = project.components;
  const n = comps.length * 2;
  const index = new Map();
  comps.forEach((c, k) => index.set(c.id, k * 2));
  const node = (cid, t) => index.get(cid) + t;
  const burnedNow = [];
  const ledOn = runtime.ledOn || (runtime.ledOn = {});
  let V = new Array(n).fill(0);

  const build = () => {
    const A = Array.from({ length: n }, () => new Float64Array(n));
    const b = new Float64Array(n);
    const G = (a, c, g) => { A[a][a] += g; A[c][c] += g; A[a][c] -= g; A[c][a] -= g; };
    const J = (from, to, j) => { b[from] -= j; b[to] += j; }; // fuente de corriente: sale de "from", entra a "to"
    for (let i = 0; i < n; i++) A[i][i] += CONST.GMIN;
    for (const w of project.wires) {
      if (!index.has(w.a.c) || !index.has(w.b.c)) continue;
      G(node(w.a.c, w.a.t), node(w.b.c, w.b.t), 1 / CONST.WIRE_R);
    }
    for (const c of comps) {
      const a = node(c.id, 0), k = node(c.id, 1), p = c.props || {};
      if (c.type === 'battery') {
        const r = CONST.BATTERY_R, v = p.volts || 3;
        G(a, k, 1 / r); J(k, a, v / r);
      } else if (c.type === 'led') {
        if (p.burned) continue;
        if (ledOn[c.id]) {
          const g = 1 / CONST.LED_RS, vf = (LED_COLORS[p.color] || LED_COLORS.rojo).vf;
          G(a, k, g); J(k, a, g * vf);
        } else G(a, k, 1e-9);
      } else {
        const R = linearR(c, runtime);
        if (R) G(a, k, 1 / R);
      }
    }
    return [A.map(r => Array.from(r)), Array.from(b)];
  };

  let guard = 0;
  while (guard++ < 6) {
    for (let it = 0; it < 40; it++) {
      const [A, b] = build();
      V = n ? gauss(A, b) : [];
      let changed = false;
      for (const c of comps) {
        if (c.type !== 'led' || c.props?.burned) continue;
        const vd = V[node(c.id, 0)] - V[node(c.id, 1)];
        const vf = (LED_COLORS[c.props?.color] || LED_COLORS.rojo).vf;
        const want = ledOn[c.id] ? vd > vf - 1e-9 : vd > vf + 1e-6;
        if (want !== !!ledOn[c.id]) { ledOn[c.id] = want; changed = true; }
      }
      if (!changed) break;
    }
    // ¿se quemó algo?
    let burnt = false;
    for (const c of comps) {
      const p = c.props || (c.props = {});
      const vd = V[node(c.id, 0)] - V[node(c.id, 1)];
      if (c.type === 'led' && !p.burned && ledOn[c.id]) {
        const vf = (LED_COLORS[p.color] || LED_COLORS.rojo).vf;
        const i = (vd - vf) / CONST.LED_RS;
        if (i > CONST.LED_MAX_I) { p.burned = true; ledOn[c.id] = false; burnedNow.push(c.id); burnt = true; }
      }
      if (c.type === 'bulb' && !p.burned) {
        if (Math.abs(vd) / CONST.BULB_R > CONST.BULB_MAX_I) { p.burned = true; burnedNow.push(c.id); burnt = true; }
      }
    }
    if (!burnt) break;
  }

  const res = { comps: {}, wires: {}, shorts: [], burnedNow };
  for (const c of comps) {
    const p = c.props || {};
    const v = (V[node(c.id, 0)] ?? 0) - (V[node(c.id, 1)] ?? 0);
    let i = 0;
    const out = { v };
    switch (c.type) {
      case 'battery': {
        i = ((p.volts || 3) - v) / CONST.BATTERY_R; // corriente que sale por el +
        if (Math.abs(i) < 1e-7) i = 0;
        out.short = i > CONST.SHORT_I;
        if (out.short) res.shorts.push(c.id);
        break;
      }
      case 'led': {
        const vf = (LED_COLORS[p.color] || LED_COLORS.rojo).vf;
        i = (!p.burned && ledOn[c.id]) ? Math.max(0, (v - vf) / CONST.LED_RS) : 0;
        out.bright = Math.min(1, Math.sqrt(i / CONST.LED_FULL_I)); // brillo como lo percibe el ojo
        out.reverse = v < -0.5;
        break;
      }
      case 'bulb': i = p.burned ? 0 : v / CONST.BULB_R; out.bright = Math.min(1, Math.abs(i) / CONST.BULB_FULL_I); break;
      case 'motor': i = v / CONST.MOTOR_R; out.speed = Math.max(-1, Math.min(1, i / CONST.MOTOR_FULL_I)); break;
      case 'buzzer': i = v / CONST.BUZZER_R; out.sound = i > CONST.BUZZER_MIN_I ? Math.min(1, i / 0.03) : 0; break;
      default: {
        const R = linearR(c, runtime);
        i = R ? v / R : 0;
      }
    }
    if (Math.abs(i) < 1e-7) i = 0;
    out.i = i;
    res.comps[c.id] = out;
  }
  for (const w of project.wires) {
    if (!index.has(w.a.c) || !index.has(w.b.c)) continue;
    let i = (V[node(w.a.c, w.a.t)] - V[node(w.b.c, w.b.t)]) / CONST.WIRE_R;
    if (Math.abs(i) < 2e-5) i = 0;
    res.wires[w.id] = i;
  }
  return res;
}
