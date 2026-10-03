import test from 'node:test';
import assert from 'node:assert/strict';
import { demoSectors } from '../src/demo.js';
import { orderRing } from '../src/geometry.js';
import { captureWorkspace, validateWorkspace, createWorkspaceStore } from '../src/workspace-storage.js';

function workspace() {
  const sectors = demoSectors();
  const originals = new Map(sectors.map((s) => [s.id, structuredClone(s)]));
  const controls = new Map(sectors.flatMap((s) => s.rings.map((r) => [r.id, { startId: r.points[0].id, direction: 'cw' }])));
  return { sectors, originals, controls, history: new Map(), selectedId: sectors[1].id, ringIndex: 0,
    filters: { commune: 'Comuna de ejemplo', search: '2' }, pending: false, demo: true, modified: false,
    source: { filename: 'Ejemplo.kml', warnings: ['Un elemento fue omitido.'], ignored: 1 } };
}
const capture = (state, draft = null) => captureWorkspace(state, { lat: -33.44, lon: -70.65, zoom: 14 }, 'commune', draft);

test('la copia conserva geometría, numeración original, filtros y ajustes pendientes sin referencias al estado vivo', () => {
  const state = workspace(), ring = state.sectors[1].rings[0];
  const original = structuredClone(ring.points);
  ring.points = orderRing(ring.points, ring.points[2].id, 'ccw');
  state.controls.set(ring.id, { startId: original[4].id, direction: 'cw' });
  state.pending = true;
  const saved = validateWorkspace(capture(state));
  state.sectors[1].rings[0].points[0].lat = 0;
  state.controls.get(ring.id).direction = 'ccw';
  state.filters.search = '';
  assert.equal(saved.selectedId, 'demo-2');
  assert.equal(saved.filters.search, '2');
  assert.equal(saved.pending, true);
  assert.deepEqual(new Map(saved.originals).get('demo-2').rings[0].points, original);
  assert.deepEqual(new Map(saved.controls).get(ring.id), { startId: original[4].id, direction: 'cw' });
  assert.deepEqual(saved.sectors[1].rings[0].points, orderRing(original, original[2].id, 'ccw'));
});

test('conserva el historial para deshacer y un borrador por separado del límite confirmado', () => {
  const state = workspace(), sector = state.sectors[1];
  state.history.set(sector.id, [{ rings: structuredClone(sector.rings), controls: sector.rings.map((r) => [r.id, state.controls.get(r.id)]) }]);
  const coordinates = sector.rings.map((r) => r.points.map((p) => [p.lat, p.lon]));
  coordinates[0][0][0] += .001;
  const saved = validateWorkspace(capture(state, { selectedId: sector.id, coordinates }));
  assert.equal(new Map(saved.history).get(sector.id).length, 1);
  assert.notEqual(saved.draft.coordinates[0][0][0], saved.sectors[1].rings[0].points[0].lat);
});

test('una búsqueda sin resultados y un mapa desplazado a otra vuelta del mundo también se recuperan', () => {
  const state = workspace(); state.selectedId = null; state.filters.search = 'sin coincidencias';
  const saved = capture(state); saved.view.lon = 290;
  assert.equal(validateWorkspace(saved).selectedId, null);
});

test('rechaza versiones incompatibles y datos incompletos antes de reconstruir la interfaz', () => {
  for (const corrupt of [
    (saved) => { saved.version = 2; },
    (saved) => { saved.sectors[0].rings[0].points[0].lat = NaN; },
    (saved) => { saved.controls = []; },
    (saved) => { saved.ringIndex = 99; },
    (saved) => { saved.originals = []; },
    (saved) => { saved.history = [['demo-2', [{ rings: [], controls: [] }]]]; },
    (saved) => { saved.draft = { selectedId: 'otro', coordinates: [] }; },
  ]) {
    const saved = capture(workspace()); corrupt(saved);
    assert.throws(() => validateWorkspace(saved), /incompatible|incompleta/);
  }
});

test('el almacenamiento no disponible informa el fallo y permite volver a intentar', async () => {
  const store = createWorkspaceStore(null);
  await assert.rejects(store.load(), /no permite guardar/);
  await assert.rejects(store.save(capture(workspace())), /no permite guardar/);
});
