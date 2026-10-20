import test from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { demoSectors } from '../src/demo.js';
import { sectorsForExport } from '../src/export-selection.js';
import { excelBuffer, toCSV, toGeoJSON } from '../src/exports.js';

function twentyCommunes() {
  return Array.from({ length: 20 }, (_, index) => demoSectors().slice(0, 2).map((sector, part) => ({
    ...sector, id: `${index}-${part}`, commune: `Comuna ${index + 1}`, name: `Comuna ${index + 1} sector ${part + 1}`,
    rings: sector.rings.map((ring) => ({ ...ring, id: `${index}-${part}-ring`,
      points: ring.points.map((point, p) => ({ ...point, id: `${index}-${part}-${p}`, lat: point.lat + index * .01 })) })),
  }))).flat();
}

test('elegir cinco de veinte comunas incluye todos sus sectores y conserva su orden y coordenadas', () => {
  const sectors = twentyCommunes(), original = structuredClone(sectors);
  const communes = ['Comuna 2', 'Comuna 5', 'Comuna 7', 'Comuna 13', 'Comuna 20'];
  const selected = sectorsForExport(sectors, sectors[0].id, 'communes', communes);
  assert.equal(selected.length, 10);
  assert.deepEqual([...new Set(selected.map((sector) => sector.commune))], communes);
  assert.deepEqual(selected.map((sector) => sector.id), ['1-0', '1-1', '4-0', '4-1', '6-0', '6-1', '12-0', '12-1', '19-0', '19-1']);
  assert.deepEqual(sectors, original);
});

test('la selección de comunas funciona aunque no coincida con el sector visible, y no incluye otras si está vacía', () => {
  const sectors = twentyCommunes();
  assert.equal(sectorsForExport(sectors, null, 'communes', ['Comuna 5']).length, 2);
  assert.deepEqual(sectorsForExport(sectors, sectors[0].id, 'communes', []), []);
  assert.deepEqual(sectorsForExport(sectors, sectors[0].id, 'communes', ['No existe']), []);
  assert.equal(sectorsForExport(sectors, sectors[0].id, 'communes', ['Comuna 5', 'Comuna 5']).length, 2);
});

test('los alcances de sector, comuna actual y archivo completo conservan su comportamiento', () => {
  const sectors = twentyCommunes();
  assert.deepEqual(sectorsForExport(sectors, sectors[0].id, 'sector'), [sectors[0]]);
  assert.deepEqual(sectorsForExport(sectors, sectors[0].id, 'commune'), sectors.slice(0, 2));
  assert.equal(sectorsForExport(sectors, null, 'all'), sectors);
  assert.deepEqual(sectorsForExport(sectors, null, 'sector'), []);
  assert.deepEqual(sectorsForExport(sectors, null, 'commune'), []);
});

test('Excel, CSV y GeoJSON exportan solo las cinco comunas elegidas', async () => {
  const sectors = twentyCommunes();
  const communes = ['Comuna 2', 'Comuna 5', 'Comuna 7', 'Comuna 13', 'Comuna 20'];
  const chosen = sectorsForExport(sectors, sectors[0].id, 'communes', communes);
  const expected = chosen.flatMap((sector) => sector.rings.flatMap((ring) => ring.points));
  const workbook = XLSX.read(await excelBuffer(chosen), { type: 'array' });
  assert.deepEqual(workbook.SheetNames, communes);
  const excelPoints = workbook.SheetNames.flatMap((name) => XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, blankrows: true }).slice(2));
  assert.equal(excelPoints.length, 60);
  assert.deepEqual(excelPoints.map((row) => row.slice(2)), expected.map((point) => [point.lat, point.lon]));
  const csvBook = XLSX.read(toCSV(chosen).slice(1), { type: 'string', raw: true });
  const csvPoints = XLSX.utils.sheet_to_json(csvBook.Sheets[csvBook.SheetNames[0]], { header: 1 }).slice(1);
  assert.deepEqual(csvPoints.map((row) => row.slice(2).map(Number)), expected.map((point) => [point.lat, point.lon]));
  const geojson = toGeoJSON(chosen);
  assert.equal(geojson.features.filter((feature) => feature.geometry.type === 'Polygon').length, 10);
  assert.deepEqual(geojson.features.filter((feature) => feature.geometry.type === 'Point').map((feature) => feature.geometry.coordinates), expected.map((point) => [point.lon, point.lat]));
});
