const VERSION = 1;
const STORE = 'workspace';
const KEY = 'current';

export function captureWorkspace(state, view, exportScope, draft = null) {
  return structuredClone({
    version: VERSION, savedAt: Date.now(),
    sectors: state.sectors, originals: [...state.originals], controls: [...state.controls], history: [...state.history],
    selectedId: state.selectedId, ringIndex: state.ringIndex, filters: state.filters,
    pending: state.pending, demo: state.demo, modified: state.modified, source: state.source,
    view, exportScope, draft,
  });
}

// Validar la copia antes de incorporarla a la interfaz; un registro incompatible
// no debe impedir cargar un archivo nuevo ni sobrescribir la copia existente.
export function validateWorkspace(saved) {
  const invalid = () => { throw new Error('La sesión guardada no es compatible o está incompleta.'); };
  const string = (value) => typeof value === 'string';
  const coordinate = (lat, lon) => Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
  const validRings = (rings) => Array.isArray(rings) && rings.length > 0 && rings.every((ring) =>
    string(ring?.id) && ['outer', 'inner'].includes(ring.kind) && Array.isArray(ring.points) && ring.points.length >= 3 &&
    ring.points.every((point) => string(point?.id) && coordinate(point.lat, point.lon)));
  const validSector = (sector) => sector && ['id', 'name', 'commune', 'zone'].every((key) => string(sector[key])) && validRings(sector.rings);
  const entries = (value) => Array.isArray(value) && value.every((entry) => Array.isArray(entry) && entry.length === 2 && string(entry[0]));
  if (!saved || saved.version !== VERSION || !Array.isArray(saved.sectors) || !saved.sectors.length || !saved.sectors.every(validSector)) invalid();
  if (!entries(saved.originals) || !saved.originals.every(([, sector]) => validSector(sector)) ||
      !entries(saved.controls) || !entries(saved.history)) invalid();
  const originals = new Map(saved.originals), controls = new Map(saved.controls);
  for (const sector of saved.sectors) {
    const original = originals.get(sector.id);
    if (!original || original.rings.length !== sector.rings.length) invalid();
    for (const ring of sector.rings) {
      const control = controls.get(ring.id);
      if (!control || !['cw', 'ccw'].includes(control.direction) || !ring.points.some((p) => p.id === control.startId)) invalid();
    }
  }
  if (!saved.history.every(([id, stack]) => saved.sectors.some((s) => s.id === id) && Array.isArray(stack) && stack.length <= 20 &&
      stack.every((entry) => validRings(entry?.rings) && entries(entry.controls) && entry.rings.every((ring) => {
        const control = new Map(entry.controls).get(ring.id);
        return control && ['cw', 'ccw'].includes(control.direction) && ring.points.some((p) => p.id === control.startId);
      })))) invalid();
  const selected = saved.sectors.find((sector) => sector.id === saved.selectedId);
  if (saved.selectedId !== null && !selected || !Number.isInteger(saved.ringIndex) || saved.ringIndex < 0 || selected && saved.ringIndex >= selected.rings.length) invalid();
  if (!string(saved.filters?.commune) || !string(saved.filters?.search) ||
      !['pending', 'demo', 'modified'].every((key) => typeof saved[key] === 'boolean') ||
      !string(saved.source?.filename) || !Array.isArray(saved.source.warnings) || !saved.source.warnings.every(string) ||
      !Number.isInteger(saved.source.ignored) || saved.source.ignored < 0 ||
      !['sector', 'commune', 'all'].includes(saved.exportScope) ||
      !Number.isFinite(saved.view?.lat) || !Number.isFinite(saved.view?.lon) || !Number.isFinite(saved.view.zoom) || saved.view.zoom < 0 || saved.view.zoom > 19) invalid();
  if (saved.draft && (!selected || saved.draft.selectedId !== selected.id || !Array.isArray(saved.draft.coordinates) ||
      saved.draft.coordinates.length !== selected.rings.length || !saved.draft.coordinates.every((ring) => Array.isArray(ring) && ring.length >= 3 &&
        ring.every((point) => Array.isArray(point) && point.length === 2 && coordinate(...point))))) invalid();
  return saved;
}

export function createWorkspaceStore(factory = globalThis.indexedDB) {
  let database;
  function open() {
    if (!database) database = new Promise((resolve, reject) => {
      if (!factory) { reject(new Error('Este navegador no permite guardar la sesión.')); return; }
      const request = factory.open('sectores-reparto', VERSION);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('Cierra otras pestañas de la aplicación para habilitar el guardado.'));
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => { db.close(); database = undefined; };
        resolve(db);
      };
    }).catch((error) => { database = undefined; throw error; });
    return database;
  }
  async function transaction(mode, operation) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const request = operation(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(request.result);
      tx.onabort = () => reject(tx.error || request.error || new Error('No se pudo guardar la sesión.'));
      tx.onerror = () => { /* El aborto informa el error y conserva el registro anterior. */ };
    });
  }
  return {
    load: async () => { const saved = await transaction('readonly', (store) => store.get(KEY)); return saved ? validateWorkspace(saved) : null; },
    save: (saved) => transaction('readwrite', (store) => store.put(saved, KEY)),
    clear: () => transaction('readwrite', (store) => store.delete(KEY)),
  };
}
