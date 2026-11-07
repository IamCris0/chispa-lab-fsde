// Guardado: navegador (localStorage) + archivos .json para llevar a otra computadora.
const K = {
  projects: 'chispa:v1:projects',
  current: 'chispa:v1:current',
  progress: 'chispa:v1:progress',
  settings: 'chispa:v1:settings',
};
const memory = {}; // respaldo si el navegador no deja guardar (modo incógnito, etc.)

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return memory[key] ?? fallback;
    return JSON.parse(raw);
  } catch { return memory[key] ?? fallback; }
}
function write(key, value) {
  memory[key] = value;
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
}

export const uid = (p = 'id') => p + '-' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3);

export function newProject(name = 'Mi circuito') {
  const now = new Date().toISOString();
  return { id: uid('p'), name, components: [], wires: [], created: now, updated: now };
}

export const listProjects = () => Object.values(read(K.projects, {})).sort((a, b) => (b.updated || '').localeCompare(a.updated || ''));
export const getProject = (id) => read(K.projects, {})[id] || null;
export function saveProject(p) {
  const all = read(K.projects, {});
  p.updated = new Date().toISOString();
  all[p.id] = p;
  const ok = write(K.projects, all);
  write(K.current, p.id);
  return ok;
}
export function deleteProject(id) {
  const all = read(K.projects, {});
  delete all[id];
  write(K.projects, all);
}
export const currentId = () => read(K.current, null);

export const getProgress = () => read(K.progress, { missions: {} });
export const saveProgress = (pr) => write(K.progress, pr);

export const getSettings = () => ({ view: 'dibujo', flow: true, sound: true, meter: false, student: '', welcomed: false, clase: 1, ...read(K.settings, {}) });
export const saveSettings = (s) => write(K.settings, s);

const slug = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'circuito';

export function exportProject(p, progress, student) {
  const data = {
    app: 'laboratorio-chispa', version: 1, exported: new Date().toISOString(),
    student: student || '', project: p, progress,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${student ? slug(student) + '_' : ''}${slug(p.name)}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  return a.download;
}

const VALID = new Set(['battery', 'bulb', 'led', 'motor', 'buzzer', 'switch', 'button', 'resistor', 'pot', 'ldr']);
export function parseImport(text) {
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('El archivo no es un .json válido.'); }
  const p = data && data.project ? data.project : data;
  if (!p || !Array.isArray(p.components) || !Array.isArray(p.wires)) throw new Error('Este archivo no es un circuito del Laboratorio de Chispa.');
  const comps = p.components.filter(c => c && VALID.has(c.type) && Number.isFinite(c.x) && Number.isFinite(c.y))
    .map(c => ({ id: String(c.id), type: c.type, x: c.x, y: c.y, rot: [0, 90, 180, 270].includes(c.rot) ? c.rot : 0, props: typeof c.props === 'object' && c.props ? c.props : {} }));
  const ids = new Set(comps.map(c => c.id));
  const wires = p.wires.filter(w => w && w.a && w.b && ids.has(String(w.a.c)) && ids.has(String(w.b.c)))
    .map(w => ({ id: String(w.id || uid('w')), a: { c: String(w.a.c), t: w.a.t ? 1 : 0 }, b: { c: String(w.b.c), t: w.b.t ? 1 : 0 }, color: typeof w.color === 'string' ? w.color : 'rojo' }));
  const now = new Date().toISOString();
  return {
    project: { id: uid('p'), name: String(p.name || 'Circuito importado').slice(0, 60), components: comps, wires, created: p.created || now, updated: now },
    progress: data.progress && data.progress.missions ? data.progress : null,
    student: typeof data.student === 'string' ? data.student : '',
  };
}
