// Misiones guiadas. Cada una revisa la simulación para saber si el estudiante lo logró.
const near = (a, b, tol = 0.06) => Math.abs(Math.abs(a) - Math.abs(b)) <= tol * Math.max(Math.abs(a), Math.abs(b), 1e-6);

function helpers(project, res, runtime) {
  const of = (t) => project.components.filter(c => c.type === t);
  const st = (c) => res.comps[c.id] || { v: 0, i: 0 };
  const litLeds = () => of('led').filter(c => !c.props.burned && (st(c).bright || 0) > 0.3);
  const litBulbs = () => of('bulb').filter(c => !c.props.burned && (st(c).bright || 0) > 0.2);
  const lights = () => [...litLeds(), ...litBulbs()];
  const pressed = (c) => runtime.pressed.has(c.id);
  const wired = (c, t) => project.wires.some(w => (w.a.c === c.id && w.a.t === t) || (w.b.c === c.id && w.b.t === t));
  const connected = (c) => wired(c, 0) && wired(c, 1);
  return { of, st, litLeds, litBulbs, lights, pressed, connected, ok: res.shorts.length === 0 };
}

export const CLASES = {
  1: { title: 'Clase 1 · Mi primer circuito', color: '#E0A62E' },
  2: { title: 'Clase 2 · Serie, paralelo e interruptores', color: '#2B6CB0' },
  3: { title: 'Clase 3 · Proyectos con sensores', color: '#16a34a' },
};

export const MISSIONS = [
  // ───────── CLASE 1 ─────────
  {
    id: 'c1-pila', clase: 1, title: 'Conoce la pila',
    goal: 'Coloca una pila en la mesa de trabajo.',
    steps: ['Busca la Pila en la columna de la izquierda (Energía).', 'Arrástrala al centro o haz clic sobre ella.', 'Mira sus dos lados: + (positivo) y − (negativo).'],
    hint: 'La pila es la que dice "3V". Haz clic encima de ella en la lista de piezas.',
    learn: 'La pila es la fuente de energía. Sin pila, no hay corriente.',
    check: (h) => h.of('battery').length > 0,
  },
  {
    id: 'c1-foco', clase: 1, title: '¡Enciende el foco!',
    goal: 'Haz un circuito cerrado para que el foco se encienda.',
    steps: ['Pon un Foco cerca de la pila.', 'Haz clic en el puntito + de la pila y luego en un puntito del foco: ¡aparece un cable!', 'Une el otro puntito del foco con el − de la pila.'],
    hint: 'La corriente necesita un camino de ida y vuelta: sale del + y debe regresar al −.',
    learn: 'Un circuito cerrado es un camino completo: la corriente sale de la pila, pasa por el foco y vuelve a la pila.',
    check: (h) => h.litBulbs().length > 0 && h.ok,
  },
  {
    id: 'c1-interruptor', clase: 1, title: 'Abierto y cerrado',
    goal: 'Agrega un interruptor al camino. Ciérralo para encender y ábrelo para apagar.',
    steps: ['Quita uno de los cables (selecciónalo y presiona Borrar).', 'Pon un Interruptor en ese lugar y conéctalo con dos cables.', 'Haz clic en el interruptor: ENCENDIDO prende el foco y APAGADO lo apaga.'],
    hint: 'El interruptor tiene que estar en el mismo camino que el foco, como un puente en la carretera.',
    learn: 'Interruptor cerrado = circuito cerrado = la luz prende. Interruptor abierto = circuito abierto = la luz se apaga.',
    check: (h, seen) => {
      const sws = h.of('switch');
      if (sws.some(s => s.props.on && Math.abs(h.st(s).i) > 0.005) && h.lights().length) seen.on = true;
      if (seen.on && sws.some(s => !s.props.on && Math.abs(h.st(s).v) > 0.5) && h.lights().length === 0) seen.off = true;
      return !!(seen.on && seen.off);
    },
  },
  {
    id: 'c1-linterna', clase: 1, title: 'Linterna de bolsillo',
    goal: 'Construye una linterna: el foco prende solo mientras presionas el botón.',
    steps: ['Presiona "Nuevo" para empezar un circuito limpio.', 'Une: + de la pila → Pulsador → Foco → − de la pila.', 'Mantén presionado el clic sobre el pulsador: ¡luz! Suéltalo: se apaga.'],
    hint: 'El pulsador va en el mismo camino que el foco, igual que el interruptor.',
    learn: 'Las linternas, los timbres y los controles remotos usan pulsadores: funcionan solo mientras los presionas.',
    check: (h) => h.litBulbs().length > 0 && h.of('button').some(b => h.pressed(b) && Math.abs(h.st(b).i) > 0.01),
  },
  {
    id: 'c1-led', clase: 1, title: 'Enciende un LED sin quemarlo',
    goal: 'Conecta un LED con una resistencia para protegerlo.',
    steps: ['Pon una Pila, una Resistencia y un LED.', 'Une: + de la pila → resistencia → pata + del LED.', 'Une la pata − del LED con el − de la pila. La resistencia va EN EL CAMINO del LED, no al lado.'],
    hint: 'Si el LED se quema, selecciónalo y presiona "Poner un LED nuevo". Revisa que la corriente pase PRIMERO por la resistencia y DESPUÉS por el LED: un solo camino.',
    learn: 'La resistencia frena la corriente para que el LED no reciba demasiada y se queme.',
    check: (h) => h.litLeds().length > 0 && h.of('resistor').some(r => Math.abs(h.st(r).i) > 0.001),
  },
  {
    id: 'c1-polaridad', clase: 1, title: 'El LED tiene lado',
    goal: 'Gira el LED al revés y descubre qué pasa. Luego déjalo bien.',
    steps: ['Selecciona el LED de tu circuito.', 'Presiona el botón "Voltear (+ ↔ −)" para darle la vuelta.', 'Observa: ¿se apagó? Voltéalo otra vez para que vuelva a prender.'],
    hint: 'La pata larga (+) del LED debe mirar hacia el + de la pila.',
    learn: 'El LED solo deja pasar la corriente en un sentido. Por eso tiene una pata + y una pata −.',
    check: (h, seen) => {
      if (h.of('led').some(c => !c.props.burned && h.st(c).reverse)) seen.rev = true;
      return !!seen.rev && h.litLeds().length > 0;
    },
  },
  {
    id: 'c1-brillo', clase: 1, title: 'Más o menos brillo',
    goal: 'Cambia el valor de la resistencia y compara cómo brilla el LED.',
    steps: ['Selecciona la resistencia de tu circuito con LED.', 'Prueba con 220 Ω y mira el brillo.', 'Ahora prueba con 10 kΩ. ¿Brilla más o menos?'],
    hint: 'Las resistencias se cambian en el panel de la derecha cuando las seleccionas.',
    learn: 'Más resistencia = menos corriente = menos brillo. Menos resistencia = más brillo.',
    check: (h, seen) => {
      const leds = h.of('led').filter(c => !c.props.burned && Math.abs(h.st(c).i) > 0.00005);
      if (!leds.length) return false;
      for (const r of h.of('resistor')) {
        const ir = Math.abs(h.st(r).i);
        if (!leds.some(l => near(h.st(l).i, ir, 0.1))) continue;
        if (r.props.ohms <= 330) seen.low = true;
        if (r.props.ohms >= 4700) seen.high = true;
      }
      return !!(seen.low && seen.high);
    },
  },
  {
    id: 'c1-arcoiris', clase: 1, title: 'Arcoíris de LED',
    goal: 'Prende 3 LED de colores diferentes a la vez, sin quemar ninguno.',
    steps: ['Pon una pila de 9 V y 3 LED. Cambia su color en el panel Pieza (rojo, verde, azul…).', 'Cada LED necesita SU PROPIA resistencia en su camino.', 'Usa Puntos de unión (sección Cables) para que los 3 caminos salgan del + y lleguen al − de la pila.'],
    hint: 'Son 3 circuitos de "resistencia + LED" que comparten la misma pila (en paralelo).',
    learn: 'Cada LED con su propia resistencia: así funcionan las tiras de luces y las pantallas.',
    check: (h) => new Set(h.litLeds().map(l => l.props.color)).size >= 3,
  },
  // ───────── CLASE 2 ─────────
  {
    id: 'c2-serie', clase: 2, title: 'Dos focos en serie',
    goal: 'Conecta dos focos uno detrás del otro, en un solo camino.',
    steps: ['Pon una pila y dos focos.', 'Une: + → foco 1 → foco 2 → −  (como una fila india).', 'Observa el brillo. ¿Brillan igual que un foco solo?'],
    hint: 'En serie hay un solo camino: la corriente pasa primero por un foco y luego por el otro.',
    learn: 'En serie la corriente es la misma en todo el camino y los focos brillan menos. Si uno se quita, se apagan todos.',
    check: (h) => {
      const b = h.of('bulb').filter(c => !c.props.burned && Math.abs(h.st(c).i) > 0.02);
      for (let i = 0; i < b.length; i++) for (let j = i + 1; j < b.length; j++) {
        if (!near(h.st(b[i]).i, h.st(b[j]).i, 0.04)) continue;
        if (h.of('battery').some(p => near(h.st(p).i, h.st(b[i]).i, 0.08))) return true;
      }
      return false;
    },
  },
  {
    id: 'c2-paralelo', clase: 2, title: 'Dos focos en paralelo',
    goal: 'Conecta dos focos cada uno con su propio camino hasta la pila.',
    steps: ['Pon una pila y dos focos.', 'Une el + de la pila con un lado de CADA foco.', 'Une el otro lado de CADA foco con el − de la pila. Compara el brillo con la serie.'],
    hint: 'A un mismo puntito le puedes conectar varios cables.',
    learn: 'En paralelo cada foco tiene su propio camino: brillan fuerte y, si uno se quita, el otro sigue prendido. Así están las luces de tu casa.',
    check: (h) => {
      const b = h.of('bulb').filter(c => !c.props.burned && (h.st(c).bright || 0) > 0.5);
      if (b.length < 2) return false;
      return h.of('battery').some(p => b.filter(x => Math.abs(h.st(p).i) >= 1.8 * Math.abs(h.st(x).i)).length >= 2);
    },
  },
  {
    id: 'c2-motor', clase: 2, title: 'Haz girar el motor',
    goal: 'Conecta un motor y un interruptor para hacerlo girar.',
    steps: ['Pon una pila, un interruptor y un Motor.', 'Haz un circuito cerrado con los tres.', 'Enciende el interruptor y mira girar el ventilador.'],
    hint: 'El motor funciona como el foco: necesita un camino completo.',
    learn: 'El motor convierte la electricidad en movimiento.',
    check: (h) => h.of('motor').some(m => Math.abs(h.st(m).speed || 0) > 0.25),
  },
  {
    id: 'c2-reversa', clase: 2, title: 'Motor en reversa',
    goal: 'Haz que el motor gire hacia el otro lado.',
    steps: ['Con el motor girando, fíjate hacia qué lado gira.', 'Selecciona el motor y presiona "Voltear (+ ↔ −)" (o cambia los cables de lado).', '¿Ahora hacia dónde gira?'],
    hint: 'Si cambias el + y el − del motor, cambia la dirección.',
    learn: 'Cambiar la polaridad (el + y el −) hace que el motor gire al revés. Así funcionan los carritos que van hacia adelante y atrás.',
    check: (h, seen) => {
      for (const m of h.of('motor')) { const s = h.st(m).speed || 0; if (s > 0.2) seen.a = true; if (s < -0.2) seen.b = true; }
      return !!(seen.a && seen.b);
    },
  },
  {
    id: 'c2-timbre', clase: 2, title: 'Timbre con pulsador',
    goal: 'Haz un timbre que suene solo mientras presionas el botón.',
    steps: ['Pon una pila, un Pulsador y un Timbre.', 'Conéctalos en serie. Cuidado: el + del timbre va hacia el + de la pila.', 'Mantén presionado el clic sobre el pulsador: ¡biiip!'],
    hint: 'El pulsador solo deja pasar la corriente mientras lo mantienes presionado.',
    learn: 'El pulsador vuelve a abrirse cuando lo sueltas. El interruptor, en cambio, se queda como lo dejas.',
    check: (h) => h.of('buzzer').some(z => (h.st(z).sound || 0) > 0) && h.of('button').some(b => h.pressed(b) && Math.abs(h.st(b).i) > 0.003),
  },
  {
    id: 'c2-y', clase: 2, title: 'Llave secreta "Y"',
    goal: 'Un LED que prende SOLO si los dos interruptores están encendidos.',
    steps: ['Haz un circuito con pila, resistencia y LED.', 'Pon DOS interruptores uno detrás del otro (en serie).', 'Prueba: ¿prende con uno solo? ¿Y con los dos?'],
    hint: 'Es como una caja fuerte con dos llaves: se necesitan las dos.',
    learn: 'Interruptores en serie forman una puerta "Y": funciona solo si el primero Y el segundo están cerrados. ¡Como el bloque "y" de Scratch!',
    check: (h) => {
      const leds = h.litLeds();
      if (!leds.length) return false;
      const sw = h.of('switch').filter(s => s.props.on);
      return leds.some(l => sw.filter(s => near(h.st(s).i, h.st(l).i, 0.05)).length >= 2);
    },
  },
  {
    id: 'c2-o', clase: 2, title: 'Llave secreta "O"',
    goal: 'Un LED que prende con CUALQUIERA de los dos interruptores.',
    steps: ['Haz un circuito con pila, resistencia y LED.', 'Pon DOS interruptores lado a lado (en paralelo): sus puntitos unidos entre sí.', 'Prueba: ¿prende con uno solo? ¿Con el otro?'],
    hint: 'Une la entrada de los dos interruptores juntas, y la salida de los dos juntas.',
    learn: 'Interruptores en paralelo forman una puerta "O": funciona si el primero O el segundo está cerrado. Como los interruptores de una escalera.',
    check: (h) => {
      const leds = h.litLeds();
      if (!leds.length) return false;
      const sw = h.of('switch');
      const closed = sw.filter(s => s.props.on && leds.some(l => near(h.st(s).i, h.st(l).i, 0.05)));
      const open = sw.filter(s => !s.props.on && h.connected(s) && Math.abs(h.st(s).v) < 0.05);
      return closed.length >= 1 && open.length >= 1;
    },
  },
  {
    id: 'c2-perilla', clase: 2, title: 'Regula el brillo',
    goal: 'Usa una perilla para subir y bajar el brillo de un LED.',
    steps: ['Haz un circuito: pila → perilla → resistencia → LED → pila.', 'Selecciona la perilla y mueve la barra.', 'Haz que el LED brille poquito y luego mucho.'],
    hint: 'Deja la resistencia fija en el circuito para que el LED no se queme al girar la perilla.',
    learn: 'La perilla (potenciómetro) es una resistencia que cambia. Así funcionan los botones de volumen y los reguladores de luz.',
    check: (h, seen) => {
      for (const l of h.of('led')) {
        if (l.props.burned) continue;
        const il = h.st(l).i;
        if (!h.of('pot').some(p => near(h.st(p).i, il, 0.05) && Math.abs(il) > 0.0001)) continue;
        const b = h.st(l).bright || 0;
        if (b < 0.45) seen.low = true;
        if (b > 0.85) seen.high = true;
      }
      return !!(seen.low && seen.high);
    },
  },
  // ───────── CLASE 3 ─────────
  {
    id: 'c3-sensor', clase: 3, title: 'Luz que siente la luz',
    goal: 'Conecta un sensor de luz a un LED y cambia la luz del ambiente.',
    steps: ['Haz un circuito: pila → sensor de luz → resistencia → LED → pila.', 'Selecciona el sensor y sube la barra de luz: ¿qué pasa?', 'Bájala hasta la oscuridad. ¿Qué pasa ahora?'],
    hint: 'Usa la pila de 9 V para que se note mejor.',
    learn: 'Un sensor convierte algo del mundo (luz, calor, sonido) en una señal eléctrica. ¡Los robots usan sensores para "sentir"!',
    check: (h, seen) => {
      for (const l of h.of('led')) {
        if (l.props.burned) continue;
        const il = h.st(l).i;
        const sensed = h.of('ldr').find(s => near(h.st(s).i, il, 0.05) || (Math.abs(il) < 0.0002 && Math.abs(h.st(s).v) > 0.2));
        if (!sensed) continue;
        if ((h.st(l).bright || 0) > 0.4) seen.on = true;
        if ((h.st(l).bright || 0) < 0.08 && (sensed.props.light ?? 50) < 30) seen.off = true;
      }
      return !!(seen.on && seen.off);
    },
  },
  {
    id: 'c3-semaforo', clase: 3, title: 'Semáforo',
    goal: 'Construye un semáforo con LED rojo, amarillo y verde, cada uno con su interruptor.',
    steps: ['Pon 3 LED: rojo, amarillo y verde (cambia el color en el panel).', 'Cada LED con su resistencia y su interruptor, en paralelo a la pila.', 'Enciende las luces en orden: verde → amarillo → rojo.'],
    hint: 'Es como hacer tres circuitos de "LED con interruptor" que comparten la misma pila.',
    learn: 'Un semáforo real hace lo mismo, pero un pequeño computador (microcontrolador) mueve los interruptores por ti.',
    check: (h, seen) => {
      for (const l of h.litLeds()) seen[l.props.color] = true;
      return !!(seen.rojo && seen.amarillo && seen.verde) && h.of('switch').length + h.of('button').length >= 3;
    },
  },
  {
    id: 'c3-alarma', clase: 3, title: 'Alarma de la puerta',
    goal: 'Cuando se presiona el botón, suena el timbre y se prende una luz.',
    steps: ['Pon una pila, un pulsador, un timbre y un LED con su resistencia.', 'El timbre y el LED (con su resistencia) van en paralelo, después del pulsador.', 'Mantén presionado el pulsador: ¡alarma!'],
    hint: 'Primero pasa por el pulsador, luego la corriente se divide: un camino al timbre y otro al LED.',
    learn: 'Un solo botón puede controlar varias cosas a la vez si están en paralelo después de él.',
    check: (h) => h.of('buzzer').some(z => (h.st(z).sound || 0) > 0) && h.litLeds().length > 0 && h.of('button').some(b => h.pressed(b) && Math.abs(h.st(b).i) > 0.01),
  },
  {
    id: 'c3-ventilador', clase: 3, title: 'Ventilador con velocidades',
    goal: 'Un ventilador que se enciende con interruptor y cambia de velocidad con la perilla.',
    steps: ['Pon pila de 9 V, interruptor, perilla y motor en serie.', 'Enciende el interruptor.', 'Mueve la perilla: haz que gire rápido y luego lento.'],
    hint: 'Si la perilla está muy alta, el motor casi no gira. Bájala.',
    learn: 'Muchos aparatos de casa (ventiladores, licuadoras) cambian su velocidad controlando cuánta corriente llega al motor.',
    check: (h, seen) => {
      for (const m of h.of('motor')) {
        const s = Math.abs(h.st(m).speed || 0), im = h.st(m).i;
        if (!h.of('pot').some(p => near(h.st(p).i, im, 0.05))) continue;
        if (!h.of('switch').some(w => w.props.on && near(h.st(w).i, im, 0.05))) continue;
        if (s > 0.3) seen.fast = true;
        if (s > 0.02 && s < 0.15) seen.slow = true;
      }
      return !!(seen.fast && seen.slow);
    },
  },
  {
    id: 'c3-casa', clase: 3, title: 'Proyecto final: Mi casa eléctrica',
    goal: 'Diseña tu propio circuito con al menos 3 aparatos funcionando a la vez y 2 interruptores.',
    steps: ['Piensa qué tendrá tu casa: luces, ventilador, timbre…', 'Usa interruptores para controlar cada parte.', 'Enciende 3 aparatos o más a la vez, sin quemar nada. ¡Ponle nombre a tu proyecto y descárgalo!'],
    hint: 'Usa conexiones en paralelo para que cada aparato tenga su propio camino.',
    learn: '¡Eres electricista digital! Tu casa usa las mismas ideas que una casa real: pila (energía), cables, interruptores y aparatos en paralelo.',
    check: (h) => {
      const working = h.lights().length + h.of('motor').filter(m => Math.abs(h.st(m).speed || 0) > 0.2).length + h.of('buzzer').filter(z => (h.st(z).sound || 0) > 0).length;
      const burned = h.of('led').some(c => c.props.burned) || h.of('bulb').some(c => c.props.burned);
      return working >= 3 && h.of('switch').length >= 2 && !burned && h.ok;
    },
  },
];

export function evaluate(project, res, runtime, progress, seenStore) {
  const h = helpers(project, res, runtime);
  const newly = [];
  for (const m of MISSIONS) {
    if (progress.missions[m.id]) continue;
    const seen = seenStore[m.id] || (seenStore[m.id] = {});
    let ok = false;
    try { ok = m.check(h, seen); } catch (e) { console.warn(e); }
    if (ok) { progress.missions[m.id] = { at: new Date().toISOString() }; newly.push(m); }
  }
  return newly;
}
