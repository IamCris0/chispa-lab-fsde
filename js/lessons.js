// Lecciones cortas: lo básico de la electricidad para niños y jóvenes.
import { TYPES, bigSVG } from './components.js';

const circuitSVG = (closed) => `
<svg viewBox="0 0 260 150" class="lesson-svg" aria-hidden="true">
  <rect x="20" y="55" width="44" height="60" rx="6" fill="#1f6f43" stroke="#1C2B3A" stroke-width="2"/>
  <rect x="20" y="55" width="44" height="14" rx="4" fill="#b9f0cf"/><text x="42" y="66" text-anchor="middle" font-size="12" font-weight="800" fill="#17324D">+</text>
  <text x="42" y="108" text-anchor="middle" font-size="14" font-weight="800" fill="#fff">−</text>
  <path d="M42 55V25H120" stroke="#e53e3e" stroke-width="5" fill="none" stroke-linecap="round"/>
  ${closed ? '<path d="M120 25H150" stroke="#E0A62E" stroke-width="6" stroke-linecap="round"/>' : '<path d="M120 25L146 8" stroke="#E0A62E" stroke-width="6" stroke-linecap="round"/>'}
  <circle cx="120" cy="25" r="4" fill="#1C2B3A"/><circle cx="150" cy="25" r="4" fill="#1C2B3A"/>
  <path d="M150 25H215V60" stroke="#e53e3e" stroke-width="5" fill="none" stroke-linecap="round"/>
  ${closed ? '<circle cx="215" cy="78" r="30" fill="#FFE27A" opacity=".55"/>' : ''}
  <circle cx="215" cy="78" r="17" fill="${closed ? '#fff2a8' : '#eef6fb'}" stroke="#1C2B3A" stroke-width="2"/>
  <rect x="207" y="94" width="16" height="10" fill="#aab5c0" stroke="#1C2B3A" stroke-width="2"/>
  <path d="M215 104V135H42V115" stroke="#1C2B3A" stroke-width="5" fill="none" stroke-linecap="round"/>
  ${closed ? '<path d="M42 50V25H215V60M215 104V135H42" stroke="#FFE27A" stroke-width="2.5" fill="none" stroke-dasharray="3 12" class="flow-demo"/>' : ''}
  <text x="135" y="${closed ? 60 : 60}" text-anchor="middle" font-size="13" font-weight="800" fill="${closed ? '#16a34a' : '#c53030'}">${closed ? 'CERRADO: ¡prende!' : 'ABIERTO: no prende'}</text>
</svg>`;

const waterSVG = `
<svg viewBox="0 0 300 150" class="lesson-svg" aria-hidden="true">
  <rect x="14" y="14" width="60" height="70" rx="6" fill="#cfe5ff" stroke="#1C2B3A" stroke-width="2"/>
  <rect x="16" y="36" width="56" height="46" rx="4" fill="#4aa3ff"/>
  <text x="44" y="104" text-anchor="middle" font-size="12" font-weight="800" fill="#17324D">VOLTAJE</text>
  <text x="44" y="118" text-anchor="middle" font-size="11" fill="#55697C">el empuje</text>
  <path d="M74 70H130" stroke="#4aa3ff" stroke-width="16"/>
  <path d="M130 70H190" stroke="#4aa3ff" stroke-width="6"/>
  <rect x="130" y="58" width="60" height="24" fill="none" stroke="#1C2B3A" stroke-width="2" stroke-dasharray="4 3"/>
  <text x="160" y="104" text-anchor="middle" font-size="12" font-weight="800" fill="#17324D">RESISTENCIA</text>
  <text x="160" y="118" text-anchor="middle" font-size="11" fill="#55697C">tubo angosto que frena</text>
  <path d="M190 70H270" stroke="#4aa3ff" stroke-width="16"/>
  <path d="M206 70h8M226 70h8M246 70h8" stroke="#fff" stroke-width="4" stroke-linecap="round" class="flow-demo"/>
  <text x="235" y="44" text-anchor="middle" font-size="12" font-weight="800" fill="#17324D">CORRIENTE</text>
  <text x="235" y="58" text-anchor="middle" font-size="11" fill="#55697C">cuánta agua pasa</text>
</svg>`;

const seriesParallelSVG = `
<svg viewBox="0 0 320 140" class="lesson-svg" aria-hidden="true">
  <text x="80" y="16" text-anchor="middle" font-size="13" font-weight="800" fill="#17324D">SERIE: un solo camino</text>
  <path d="M20 40H140V110H20Z" fill="none" stroke="#1C2B3A" stroke-width="4" stroke-linejoin="round"/>
  <rect x="8" y="62" width="24" height="26" rx="3" fill="#1f6f43"/>
  <circle cx="60" cy="40" r="11" fill="#fff2a8" stroke="#1C2B3A" stroke-width="2"/><circle cx="105" cy="40" r="11" fill="#fff2a8" stroke="#1C2B3A" stroke-width="2"/>
  <text x="240" y="16" text-anchor="middle" font-size="13" font-weight="800" fill="#17324D">PARALELO: varios caminos</text>
  <path d="M180 40H300V110H180Z M240 40V110" fill="none" stroke="#1C2B3A" stroke-width="4" stroke-linejoin="round"/>
  <rect x="168" y="62" width="24" height="26" rx="3" fill="#1f6f43"/>
  <circle cx="240" cy="75" r="16" fill="#FFE27A" opacity=".5"/><circle cx="240" cy="75" r="11" fill="#fff2a8" stroke="#1C2B3A" stroke-width="2"/>
  <circle cx="300" cy="75" r="16" fill="#FFE27A" opacity=".5"/><circle cx="300" cy="75" r="11" fill="#fff2a8" stroke="#1C2B3A" stroke-width="2"/>
</svg>`;

export const LESSONS = [
  {
    title: '¿Qué es la electricidad?',
    html: `<p>La <b>electricidad</b> es una forma de energía. Viaja por los cables gracias a unas partículas pequeñísimas llamadas <b>electrones</b>, que se mueven como hormiguitas en fila.</p>
      <ul><li>Con electricidad prendemos <b>luces</b>, hacemos sonar <b>timbres</b> y movemos <b>motores</b>.</li>
      <li>La <b>pila</b> es la que empuja a los electrones para que se muevan.</li>
      <li>Al movimiento de electricidad por un cable lo llamamos <b>corriente</b>.</li></ul>
      <div class="did-you-know"><b>¿Sabías que…?</b> Tu celular, la refrigeradora y hasta un carro eléctrico funcionan con circuitos parecidos a los que vas a armar aquí.</div>`,
  },
  {
    title: 'El circuito: un camino cerrado',
    html: `<p>Un <b>circuito</b> es el camino por donde viaja la corriente. Sale del <b>+</b> de la pila, pasa por los aparatos y regresa al <b>−</b>.</p>
      <div class="lesson-pair">${circuitSVG(true)}${circuitSVG(false)}</div>
      <p>Si el camino está cortado en cualquier parte, es un <b>circuito abierto</b> y nada funciona. El <b>interruptor</b> sirve justamente para abrir y cerrar el camino.</p>`,
  },
  {
    title: 'Voltaje, corriente y resistencia',
    html: `<p>Imagina que la electricidad es <b>agua</b> que corre por un tubo:</p>${waterSVG}
      <table class="lesson-table"><tr><th>Palabra</th><th>Es como…</th><th>Se mide en</th></tr>
      <tr><td><b>Voltaje</b></td><td>la fuerza con que la pila empuja</td><td>voltios (V)</td></tr>
      <tr><td><b>Corriente</b></td><td>cuánta electricidad pasa</td><td>amperios (A) o miliamperios (mA)</td></tr>
      <tr><td><b>Resistencia</b></td><td>lo que frena el paso</td><td>ohmios (Ω)</td></tr></table>
      <div class="did-you-know"><b>Regla de oro:</b> más resistencia → menos corriente. Más voltaje → más corriente.</div>`,
  },
  {
    title: 'Las piezas del laboratorio',
    html: () => `<p>Cada pieza tiene un <b>dibujo</b> y un <b>símbolo</b>. Los ingenieros usan los símbolos para dibujar circuitos rápido. Prueba el botón <b>Vista: Símbolos</b> arriba.</p>
      <div class="parts-gallery">${Object.entries(TYPES).map(([k, t]) => `
        <div class="part-card"><div class="part-pics">${bigSVG(k, 'dibujo', k === 'switch' ? { on: true } : null)}${bigSVG(k, 'simbolo', k === 'switch' ? { on: true } : null)}</div>
        <b>${t.name}</b><span>${t.short}</span></div>`).join('')}</div>`,
  },
  {
    title: 'Serie y paralelo',
    html: `${seriesParallelSVG}
      <p><b>En serie</b> las piezas van una detrás de otra, como una fila india. Hay un solo camino: si una pieza falla, todo se apaga. Los focos brillan menos porque se reparten el empuje de la pila.</p>
      <p><b>En paralelo</b> cada pieza tiene su propio camino hasta la pila. Si una falla, las demás siguen funcionando y brillan fuerte.</p>
      <div class="did-you-know"><b>¿Sabías que…?</b> Las luces y enchufes de tu casa están conectados en paralelo. Por eso puedes apagar la luz de la cocina y la de la sala sigue prendida.</div>`,
  },
  {
    title: 'Conductores y aislantes',
    html: `<p>Algunos materiales dejan pasar la electricidad y otros no:</p>
      <div class="two-cols"><div class="col-card good"><b>Conductores</b> (sí dejan pasar)<ul><li>Cobre (dentro de los cables)</li><li>Aluminio, hierro y otros metales</li><li>El agua con sales</li></ul></div>
      <div class="col-card bad"><b>Aislantes</b> (no dejan pasar)<ul><li>Plástico</li><li>Goma (caucho)</li><li>Madera seca, vidrio, papel</li></ul></div></div>
      <p>Por eso los cables tienen <b>cobre por dentro</b> y <b>plástico por fuera</b>: el cobre lleva la corriente y el plástico nos protege.</p>`,
  },
  {
    title: 'Reglas de seguridad',
    html: `<div class="safety"><p>En la simulación puedes equivocarte sin peligro. En la vida real, recuerda:</p>
      <ol><li><b>Nunca</b> metas objetos ni cables en los enchufes de la pared. Esa electricidad es muy peligrosa.</li>
      <li>Para practicar en la vida real usa solo <b>pilas</b>, y siempre con un adulto.</li>
      <li><b>No unas el + y el − de una pila con un cable solo</b> (cortocircuito): se calienta y puede quemarte.</li>
      <li>Mantén la electricidad <b>lejos del agua</b> y tus manos secas.</li>
      <li>Si ves un cable pelado o algo que huele a quemado, <b>avisa a un adulto</b>.</li></ol></div>`,
  },
  {
    title: 'Cómo usar el laboratorio',
    html: `<ol class="howto"><li><b>Agregar piezas:</b> arrástralas desde la izquierda o haz clic sobre ellas.</li>
      <li><b>Poner cables:</b> haz clic en un puntito amarillo de una pieza y luego en otro puntito.</li>
      <li><b>Mover:</b> arrastra la pieza. <b>Girar:</b> botón Girar o la tecla R.</li>
      <li><b>Borrar:</b> selecciona la pieza o el cable y presiona Borrar (o la tecla Supr).</li>
      <li><b>Interruptor:</b> haz clic sobre él. <b>Pulsador:</b> mantén presionado el clic.</li>
      <li><b>Deshacer:</b> Ctrl + Z. <b>Mover la mesa:</b> arrastra el fondo. <b>Zoom:</b> rueda del ratón.</li>
      <li><b>Guardar:</b> tu trabajo se guarda solo en esta computadora. Para llevarlo a otra, usa <b>Descargar</b> y luego <b>Abrir archivo</b>.</li></ol>`,
  },
];
