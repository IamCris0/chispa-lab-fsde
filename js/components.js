// Catálogo de piezas y sus dibujos (vista "Dibujo" y vista "Símbolo").
// Coordenadas locales: el terminal 0 está en (-40, 0) y el terminal 1 en (40, 0).
import { LED_COLORS, potResistance, ldrResistance } from './solver.js';

export const TYPES = {
  battery: {
    name: 'Pila', cat: 'Energía', props: { volts: 3 },
    short: 'Da la energía. Empuja la corriente desde el + hasta el −.',
    desc: 'La pila es la fuente de energía. Tiene dos lados: el positivo (+) y el negativo (−). La corriente sale por el + , recorre el circuito y vuelve por el −. Más voltios = más empuje.',
    terms: ['+ (positivo)', '− (negativo)'],
  },
  bulb: {
    name: 'Foco', cat: 'Salidas', props: {},
    short: 'Se ilumina cuando pasa corriente.',
    desc: 'El foco tiene un hilo muy fino (filamento) que se calienta y brilla cuando pasa la corriente. No importa hacia qué lado lo conectes.',
    terms: ['lado A', 'lado B'],
  },
  led: {
    name: 'LED', cat: 'Salidas', props: { color: 'rojo' },
    short: 'Luz pequeña. ¡Tiene lado + y lado −!',
    desc: 'El LED es una luz que gasta muy poca energía. Solo deja pasar la corriente en un sentido: la pata larga (+) va hacia el + de la pila. Necesita una resistencia para no quemarse.',
    terms: ['+ pata larga (ánodo)', '− pata corta (cátodo)'],
  },
  motor: {
    name: 'Motor', cat: 'Salidas', props: {},
    short: 'Gira. Si lo volteas, gira al revés.',
    desc: 'El motor convierte la electricidad en movimiento. Si cambias el lado de los cables, gira hacia el otro lado.',
    terms: ['lado A', 'lado B'],
  },
  buzzer: {
    name: 'Timbre', cat: 'Salidas', props: {},
    short: 'Hace "biiip". Tiene lado + y lado −.',
    desc: 'El timbre (zumbador) suena cuando pasa la corriente. Igual que el LED, tiene lado + y lado −.',
    terms: ['+', '−'],
  },
  switch: {
    name: 'Interruptor', cat: 'Control', props: { on: false },
    short: 'Abre o cierra el camino. Haz clic para cambiarlo.',
    desc: 'El interruptor es como un puente: cerrado deja pasar la corriente, abierto la corta. Se queda en la posición que lo dejes, como el de la luz de tu casa.',
    terms: ['lado A', 'lado B'],
  },
  button: {
    name: 'Pulsador', cat: 'Control', props: {},
    short: 'Funciona solo mientras lo mantienes presionado.',
    desc: 'El pulsador deja pasar la corriente solo mientras lo presionas, como el timbre de una casa. Mantén presionado el clic sobre él.',
    terms: ['lado A', 'lado B'],
  },
  resistor: {
    name: 'Resistencia', cat: 'Control', props: { ohms: 330 },
    short: 'Frena la corriente. Protege al LED.',
    desc: 'La resistencia frena la corriente, como un tubo angosto frena el agua. Se mide en ohmios (Ω). Las rayas de colores dicen su valor.',
    terms: ['lado A', 'lado B'],
  },
  pot: {
    name: 'Perilla', cat: 'Control', props: { value: 50 },
    short: 'Resistencia que puedes girar (potenciómetro).',
    desc: 'La perilla (potenciómetro) es una resistencia que cambia al girarla. Sirve para subir o bajar el brillo o la velocidad, como el volumen de un parlante.',
    terms: ['lado A', 'lado B'],
  },
  ldr: {
    name: 'Sensor de luz', cat: 'Control', props: { light: 70 },
    short: 'Con mucha luz deja pasar más corriente.',
    desc: 'El sensor de luz (fotorresistencia o LDR) cambia según la luz: con mucha luz deja pasar más corriente y en la oscuridad casi nada. Mueve la barra de luz para probar.',
    terms: ['lado A', 'lado B'],
  },
};

TYPES.node = {
  name: 'Punto de unión', cat: 'Cables', props: {},
  short: 'Une varios cables en un solo punto, como una regleta.',
  desc: 'El punto de unión sirve para juntar varios cables en un mismo lugar. Es muy útil en los circuitos en paralelo: lleva un cable del + de la pila al punto y desde ahí reparte cables a cada aparato. Arrastra el anillo para moverlo y haz clic en el centro para sacar un cable.',
  terms: ['punto de unión', ''],
};
export const CATS = ['Energía', 'Salidas', 'Control', 'Cables'];

const BAND = ['#1a1a1a', '#8b4513', '#e02424', '#f97316', '#facc15', '#16a34a', '#2563eb', '#7c3aed', '#9ca3af', '#ffffff'];
export function resistorBands(ohms) {
  let e = 0, v = ohms;
  while (v >= 100) { v /= 10; e++; }
  v = Math.round(v);
  if (v < 10) { v *= 10; e--; }
  return [BAND[Math.floor(v / 10)], BAND[v % 10], BAND[Math.max(0, e)]];
}
export function fmtOhms(r) {
  if (r >= 1e6) return (r / 1e6).toFixed(r >= 1e7 ? 0 : 1).replace('.0', '') + ' MΩ';
  if (r >= 1000) return (r / 1000).toFixed(r >= 10000 ? 0 : 1).replace('.0', '') + ' kΩ';
  return Math.round(r) + ' Ω';
}
export function fmtCurrent(i) {
  const a = Math.abs(i);
  if (a >= 1) return a.toFixed(2) + ' A';
  if (a >= 0.001) return (a * 1000).toFixed(a >= 0.01 ? 0 : 1) + ' mA';
  if (a > 0) return '< 1 mA';
  return '0 mA';
}
export function fmtVolt(v) { return (Math.abs(v) < 0.005 ? 0 : v).toFixed(1).replace('-0.0', '0.0') + ' V'; }

export function compLabel(c) {
  const p = c.props || {};
  switch (c.type) {
    case 'battery': return `${p.volts} V`;
    case 'resistor': return fmtOhms(p.ohms);
    case 'led': return `LED ${p.color}`;
    case 'switch': return p.on ? 'ENCENDIDO' : 'APAGADO';
    case 'pot': return fmtOhms(potResistance(p.value ?? 50));
    case 'ldr': return `Luz ${Math.round(p.light ?? 0)}%`;
    default: return TYPES[c.type]?.name || '';
  }
}

const LEAD = '#8d9cad';
const INK = '#1C2B3A';

// texto que siempre queda derecho aunque la pieza esté girada
function T(x, y, txt, rot, attrs = '') {
  return `<text x="${x}" y="${y}" transform="rotate(${-rot} ${x} ${y})" ${attrs}>${txt}</text>`;
}
const leads = (a = 30) => `<path d="M-40 0H${-a}M${a} 0H40" stroke="${LEAD}" stroke-width="4" stroke-linecap="round"/>`;
const sleads = (a = 24) => `<path d="M-40 0H${-a}M${a} 0H40" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`;

function glow(r, color, k, cy = 0) {
  if (!k) return '';
  return `<circle cx="0" cy="${cy}" r="${r}" fill="url(#glow-${color})" opacity="${(0.25 + 0.75 * k).toFixed(2)}" pointer-events="none"/>`;
}

export function drawComponent(c, st = {}, view = 'dibujo') {
  const p = c.props || {}, rot = c.rot || 0;
  if (c.type === 'node') return `<circle r="17" fill="transparent" class="hit"/><circle r="13" fill="none" stroke="#9fb3c8" stroke-width="2" stroke-dasharray="3 3" class="node-ring"/><circle r="6" fill="${INK}"/>`;
  const s = view === 'simbolo' ? drawSymbol(c, st, rot) : drawPicture(c, st, rot);
  // zona transparente para poder agarrar la pieza con facilidad
  return `<rect x="-34" y="-30" width="68" height="60" rx="10" fill="transparent" class="hit"/>` + s;
}

function drawPicture(c, st, rot) {
  const p = c.props || {};
  switch (c.type) {
    case 'battery': {
      const v = p.volts;
      const col = v === 9 ? ['#17324D', '#E0A62E'] : v === 4.5 ? ['#6b2d7a', '#e7c3f0'] : v === 3 ? ['#1f6f43', '#b9f0cf'] : ['#2b2b2b', '#c77b30'];
      const shortTag = st.short ? `<g class="blink">${T(0, -30, '¡CORTO!', rot, 'class="tag tag-danger" text-anchor="middle"')}</g>` : '';
      return `${leads(32)}
        <rect x="-35" y="-8" width="6" height="16" rx="2" fill="#b9c4cf" stroke="${INK}" stroke-width="1.5"/>
        <rect x="-30" y="-19" width="60" height="38" rx="6" fill="${col[0]}" stroke="${st.short ? '#e53e3e' : INK}" stroke-width="${st.short ? 4 : 2}"/>
        <rect x="-30" y="-19" width="16" height="38" rx="6" fill="${col[1]}"/>
        <rect x="-18" y="-19" width="4" height="38" fill="${col[1]}"/>
        ${T(-22, 5, '+', rot, 'class="pol" fill="#17324D" text-anchor="middle"')}
        ${T(23, 5, '−', rot, 'class="pol" fill="#fff" text-anchor="middle"')}
        ${T(5, 5, `${v}V`, rot, 'class="bat-v" text-anchor="middle"')}
        ${shortTag}`;
    }
    case 'resistor': {
      const [b1, b2, b3] = resistorBands(p.ohms || 220);
      return `${leads(24)}
        <rect x="-25" y="-10" width="50" height="20" rx="10" fill="#e9d5ac" stroke="#a88a55" stroke-width="2"/>
        <rect x="-15" y="-10" width="5" height="20" fill="${b1}"/><rect x="-6" y="-10" width="5" height="20" fill="${b2}"/>
        <rect x="3" y="-10" width="5" height="20" fill="${b3}"/><rect x="14" y="-10" width="4" height="20" fill="#d4a017"/>`;
    }
    case 'led': {
      const col = LED_COLORS[p.color] || LED_COLORS.rojo;
      const k = st.bright || 0;
      if (p.burned) {
        return `${leads(10)}<path d="M-10 0V10M10 0V10" stroke="${LEAD}" stroke-width="4"/>
          <path d="M-14 10V-6a14 14 0 0 1 28 0V10Z" fill="#4b4b4b" stroke="${INK}" stroke-width="2"/>
          <rect x="-17" y="8" width="34" height="6" rx="2" fill="#333"/>
          <circle cx="-6" cy="-26" r="6" fill="#9ca3af" opacity=".7" class="smoke"/><circle cx="5" cy="-32" r="8" fill="#9ca3af" opacity=".5" class="smoke s2"/>
          ${T(0, 30, '¡QUEMADO!', rot, 'class="tag tag-danger" text-anchor="middle"')}`;
      }
      return `${glow(38, p.color || 'rojo', k, -4)}
        ${leads(10)}<path d="M-10 0V10M10 0V10" stroke="${LEAD}" stroke-width="4"/>
        <path d="M-14 10V-6a14 14 0 0 1 28 0V10Z" fill="${col.hex}" fill-opacity="${(0.55 + 0.45 * k).toFixed(2)}" stroke="${INK}" stroke-width="2"/>
        <path d="M-8 -8a8 8 0 0 1 6 -6" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" opacity=".8"/>
        <path d="M-17 8H13V14H-17Z" fill="${col.hex}" stroke="${INK}" stroke-width="1.5"/>
        <path d="M13 8H17V14H13Z" fill="${INK}"/>
        ${T(-27, -8, '+', rot, 'class="pol" text-anchor="middle"')}${T(27, -8, '−', rot, 'class="pol" text-anchor="middle"')}`;
    }
    case 'bulb': {
      const k = st.bright || 0;
      const glass = p.burned ? '#cfd5db' : k > 0.05 ? '#fff2a8' : '#eef6fb';
      const fil = p.burned ? `<path d="M-6 6L-3 -6M6 6L3 -4" stroke="#555" stroke-width="2" fill="none"/>`
        : `<path d="M-6 6L-4 -8L-1 -2L2 -8L4 -2L6 6" stroke="${k > 0.05 ? '#ff9b00' : '#777'}" stroke-width="2" fill="none" stroke-linejoin="round"/>`;
      return `${glow(44, 'foco', p.burned ? 0 : k, -6)}
        <path d="M-40 0H-18L-8 16M40 0H18L8 16" stroke="${LEAD}" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="0" cy="-6" r="19" fill="${glass}" stroke="${INK}" stroke-width="2"/>
        ${fil}
        <rect x="-10" y="11" width="20" height="13" rx="3" fill="#aab5c0" stroke="${INK}" stroke-width="2"/>
        <path d="M-10 16H10M-10 20H10" stroke="${INK}" stroke-width="1.2"/>
        ${p.burned ? T(0, 38, '¡FUNDIDO!', rot, 'class="tag tag-danger" text-anchor="middle"') : ''}`;
    }
    case 'motor': {
      return `${leads(20)}
        <circle cx="0" cy="0" r="21" fill="#c7d0d9" stroke="${INK}" stroke-width="2"/>
        <circle cx="0" cy="0" r="15" fill="#e6ebf0" stroke="#7a8896" stroke-width="1.5"/>
        <g class="rotor" data-rotor="${c.id}">
          <path d="M0 0L-4 -14Q0 -17 4 -14Z M0 0L14 4Q15 9 10 11Z M0 0L-10 11Q-15 9 -14 4Z" fill="#E0A62E" stroke="${INK}" stroke-width="1.5"/>
          <circle r="3.5" fill="${INK}"/>
        </g>`;
    }
    case 'buzzer': {
      const k = st.sound || 0;
      return `${leads(19)}
        <circle cx="0" cy="0" r="19" fill="#232323" stroke="${INK}" stroke-width="2"/>
        <circle cx="0" cy="0" r="12" fill="none" stroke="#3d3d3d" stroke-width="2"/>
        <circle cx="0" cy="0" r="4" fill="#0e0e0e"/>
        <g class="waves" opacity="${k ? 1 : 0}" data-waves="${c.id}">
          <path d="M22 -16a14 14 0 0 1 0 14M28 -22a22 22 0 0 1 0 26" stroke="#E0A62E" stroke-width="3" fill="none" stroke-linecap="round"/>
        </g>
        ${T(-27, -8, '+', rot, 'class="pol" text-anchor="middle"')}${T(27, -8, '−', rot, 'class="pol" text-anchor="middle"')}`;
    }
    case 'switch': {
      const on = !!p.on;
      return `${leads(22)}
        <rect x="-30" y="-6" width="60" height="18" rx="5" fill="#D9E4EF" stroke="${INK}" stroke-width="2"/>
        <circle cx="-22" cy="0" r="5" fill="${INK}"/><circle cx="22" cy="0" r="5" fill="${INK}"/>
        <path d="${on ? 'M-22 0L20 -1' : 'M-22 0L12 -24'}" stroke="#E0A62E" stroke-width="7" stroke-linecap="round"/>
        <path d="${on ? 'M-22 0L20 -1' : 'M-22 0L12 -24'}" stroke="${INK}" stroke-width="2" stroke-linecap="round" opacity=".35"/>
        ${T(0, 28, on ? 'ENCENDIDO' : 'APAGADO', rot, `class="tag ${on ? 'tag-on' : 'tag-off'}" text-anchor="middle"`)}`;
    }
    case 'button': {
      const pr = !!st.pressed;
      return `${leads(22)}
        <rect x="-23" y="-14" width="46" height="28" rx="5" fill="#17324D" stroke="${INK}" stroke-width="2"/>
        <circle cx="0" cy="${pr ? 1 : -1}" r="${pr ? 9 : 11}" fill="${pr ? '#a61b1b' : '#e53e3e'}" stroke="#7a1010" stroke-width="2"/>
        ${pr ? '' : '<circle cx="-3" cy="-5" r="3" fill="#fff" opacity=".55"/>'}`;
    }
    case 'ldr': {
      const L = (p.light ?? 50) / 100;
      return `${leads(16)}
        <circle cx="0" cy="0" r="17" fill="#f2c27a" stroke="#a7701f" stroke-width="2"/>
        <path d="M-10 -8H8V-4H-8V0H8V4H-8V8H10" stroke="#b42318" stroke-width="2" fill="none"/>
        <g transform="translate(0 -32)">
          <circle r="${4 + 5 * L}" fill="${L > 0.15 ? '#FFC93C' : '#7b8aa0'}" opacity="${(0.35 + 0.65 * L).toFixed(2)}"/>
        </g>`;
    }
    case 'pot': {
      const a = -135 + 270 * ((p.value ?? 50) / 100);
      return `${leads(18)}
        <rect x="-19" y="-19" width="38" height="38" rx="6" fill="#2B6CB0" stroke="${INK}" stroke-width="2"/>
        <circle cx="0" cy="0" r="12" fill="#f5f9fd" stroke="${INK}" stroke-width="2"/>
        <path d="M0 0L0 -10" stroke="${INK}" stroke-width="3" stroke-linecap="round" transform="rotate(${a})"/>`;
    }
  }
  return '';
}

function drawSymbol(c, st, rot) {
  const p = c.props || {};
  const S = `stroke="${INK}" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"`;
  switch (c.type) {
    case 'battery':
      return `<path d="M-40 0H-6M6 0H40" ${S}/><path d="M-6 -20V20" ${S}/><path d="M6 -10V10" stroke="${INK}" stroke-width="6"/>
        ${T(-16, -12, '+', rot, 'class="pol" text-anchor="middle"')}${T(0, 34, p.volts + ' V', rot, 'class="sym-label" text-anchor="middle"')}
        ${st.short ? T(0, -28, '¡CORTO!', rot, 'class="tag tag-danger blink" text-anchor="middle"') : ''}`;
    case 'resistor':
      return `<path d="M-40 0H-24L-20 -9L-12 9L-4 -9L4 9L12 -9L20 9L24 0H40" ${S}/>`;
    case 'led': {
      const col = LED_COLORS[p.color] || LED_COLORS.rojo, k = st.bright || 0;
      return `${glow(30, p.color || 'rojo', p.burned ? 0 : k)}<path d="M-40 0H-12M12 0H40" ${S}/>
        <path d="M-12 -13L12 0L-12 13Z" fill="${p.burned ? '#666' : k > 0.05 ? col.hex : '#fff'}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
        <path d="M12 -13V13" ${S}/><path d="M2 -16L10 -26M10 -26H4M10 -26V-20M10 -12L18 -22M18 -22H12M18 -22V-16" stroke="${INK}" stroke-width="2" fill="none"/>
        ${p.burned ? T(0, 30, '¡QUEMADO!', rot, 'class="tag tag-danger" text-anchor="middle"') : ''}`;
    }
    case 'bulb': {
      const k = p.burned ? 0 : st.bright || 0;
      return `${glow(34, 'foco', k)}${sleads(16)}<circle r="16" fill="${k > 0.05 ? '#fff2a8' : '#fff'}" ${S.replace('fill="none"', '')}/><path d="M-11 -11L11 11M11 -11L-11 11" ${S}/>`;
    }
    case 'motor':
      return `${sleads(17)}<circle r="17" fill="#fff" stroke="${INK}" stroke-width="3"/>${T(0, 6, 'M', rot, 'class="sym-m" text-anchor="middle"')}`;
    case 'buzzer':
      return `${sleads(14)}<path d="M-14 0V-14H14V0" ${S}/><path d="M-14 -14a14 14 0 0 1 28 0" ${S}/>
        <g class="waves" opacity="${st.sound ? 1 : 0}" data-waves="${c.id}"><path d="M20 -22a10 10 0 0 1 0 12M26 -28a18 18 0 0 1 0 22" stroke="#E0A62E" stroke-width="3" fill="none"/></g>
        ${T(-24, -8, '+', rot, 'class="pol" text-anchor="middle"')}`;
    case 'switch':
      return `<path d="M-40 0H-18M18 0H40" ${S}/><circle cx="-18" cy="0" r="3.5" fill="${INK}"/><circle cx="18" cy="0" r="3.5" fill="${INK}"/>
        <path d="${p.on ? 'M-18 0L18 0' : 'M-18 0L14 -18'}" ${S}/>`;
    case 'button': {
      const pr = !!st.pressed;
      return `<path d="M-40 0H-18M18 0H40" ${S}/><circle cx="-18" cy="0" r="3.5" fill="${INK}"/><circle cx="18" cy="0" r="3.5" fill="${INK}"/>
        <path d="M-20 ${pr ? -3 : -12}H20M0 ${pr ? -3 : -12}V-24M-6 -24H6" ${S}/>`;
    }
    case 'ldr':
      return `<path d="M-40 0H-20M20 0H40" ${S}/><rect x="-20" y="-8" width="40" height="16" fill="#fff" ${S.replace('fill="none"', '')}/>
        <path d="M-18 -26L-8 -14M-8 -14H-14M-8 -14V-20M-6 -30L4 -18M4 -18H-2M4 -18V-24" stroke="${INK}" stroke-width="2" fill="none"/>`;
    case 'pot':
      return `<path d="M-40 0H-24L-20 -9L-12 9L-4 -9L4 9L12 -9L20 9L24 0H40" ${S}/><path d="M-18 18L18 -18M18 -18H10M18 -18V-10" stroke="${INK}" stroke-width="2.5" fill="none"/>`;
  }
  return '';
}

// Ícono pequeño para la paleta (siempre en vista dibujo, sin efectos)
export function paletteSVG(type) {
  if (type === 'node') return `<svg viewBox="-44 -34 88 68" aria-hidden="true"><path d="M-36 -18L0 0M-36 18L0 0M36 -18L0 0M36 18L0 0" stroke="#2b6cb0" stroke-width="5" stroke-linecap="round"/><circle r="8" fill="${INK}"/></svg>`;
  const c = { id: 'pal-' + type, type, rot: 0, props: { ...TYPES[type].props } };
  if (type === 'switch') c.props.on = true;
  return `<svg viewBox="-44 -34 88 68" aria-hidden="true">${drawPicture(c, {}, 0)}</svg>`;
}
export function bigSVG(type, view = 'dibujo', props) {
  if (type === 'node') return paletteSVG('node');
  const c = { id: 'big-' + type, type, rot: 0, props: { ...TYPES[type].props, ...(props || {}) } };
  return `<svg viewBox="-46 -40 92 80" aria-hidden="true">${view === 'simbolo' ? drawSymbol(c, {}, 0) : drawPicture(c, {}, 0)}</svg>`;
}
