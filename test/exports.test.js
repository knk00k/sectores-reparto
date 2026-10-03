import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { DOMParser } from '@xmldom/xmldom';
import * as XLSX from 'xlsx';
import { excelBuffer, toCSV, toGeoJSON } from '../src/exports.js';
import { demoSectors } from '../src/demo.js';
import { buildGeoJSON, rowsForSector } from '../src/geometry.js';



async function openExport(sectors) {
  const buffer = await excelBuffer(sectors);
  const zip = await JSZip.loadAsync(buffer);
  const parse = async (path) => new DOMParser().parseFromString(await zip.file(path).async('string'), 'application/xml');
  const styles = await parse('xl/styles.xml');
  const fonts = styles.getElementsByTagName('fonts')[0].getElementsByTagName('font');
  const formats = styles.getElementsByTagName('cellXfs')[0].getElementsByTagName('xf');
  const cellFormat = (cell) => {
    const format = formats[Number(cell.getAttribute('s') || 0)];
    assert.ok(format, `Estilo válido para ${cell.getAttribute('r')}`);
    const alignment = format.getElementsByTagName('alignment')[0];
    return {
      horizontal: alignment?.getAttribute('horizontal'),
      vertical: alignment?.getAttribute('vertical'),
      bold: fonts[Number(format.getAttribute('fontId'))].getElementsByTagName('b').length > 0,
      numFmtId: format.getAttribute('numFmtId'),
    };
  };
  return { book: XLSX.read(buffer, { type: 'array' }), parse, styles, cellFormat };
}

test('las hojas por comuna tienen cuatro columnas, encabezados combinados y todas las coordenadas', async () => {
  const sectors = demoSectors();
  // Un interior conserva todos sus vértices aunque no se exporten columnas de metadatos.
  sectors[0].rings.push({ id: 'hole', kind: 'inner', points: sectors[0].rings[0].points.map((p, i) => ({ id: `hole-${i}`, lat: p.lat + .001, lon: p.lon + .001 })) });
  const { book } = await openExport(sectors);
  const sheet = book.Sheets['Comuna de ejemplo'];
  assert.equal(XLSX.utils.decode_range(sheet['!ref']).e.c, 3);
  assert.deepEqual(['A1', 'B1', 'C1', 'C2', 'D2'].map((a) => sheet[a].v), ['Zona', 'Puntos', 'Coordenadas', 'X', 'Y']);
  const merges = sheet['!merges'].map(XLSX.utils.encode_range);
  for (const range of ['A1:A2', 'B1:B2', 'C1:D1', 'A3:A14']) assert.ok(merges.includes(range), range);
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }).slice(2).filter((row) => typeof row[1] === 'number');
  const points = sectors.flatMap((s) => s.rings.flatMap((r) => r.points));
  assert.equal(rows.length, points.length);
  assert.deepEqual(rows.map((row) => row.slice(2)), points.map((p) => [p.lat, p.lon]));
  assert.equal(book.Sheets.Resumen.D2.v, 12);
  assert.equal(book.Sheets.Resumen.E2.v, 2);
});

test('el XLSX guarda negrita y centrado reales, sin redondear ni convertir coordenadas a texto', async () => {
  const sectors = demoSectors();
  sectors[0].rings[0].points[0].lat = -33.441123456789;
  sectors[0].rings[0].points[0].lon = -70.658987654321;
  sectors[1].commune = 'Otra comuna';
  const { book, parse, styles, cellFormat } = await openExport(sectors);
  for (let index = 1; index <= book.SheetNames.length; index++) {
    const sheet = await parse(`xl/worksheets/sheet${index}.xml`);
    for (const cell of Array.from(sheet.getElementsByTagName('c'))) {
      const [, column, row] = cell.getAttribute('r').match(/^([A-Z]+)(\d+)$/);
      if (index === 1 && Number(row) > 1) continue;
      const format = cellFormat(cell);
      assert.equal(format.horizontal, 'center');
      assert.equal(format.vertical, 'center');
      assert.equal(format.bold, index === 1 || Number(row) <= 2 || column === 'A');
      if (index > 1 && Number(row) > 2 && ['C', 'D'].includes(column)) {
        const numericFormat = Array.from(styles.getElementsByTagName('numFmt')).find((f) => f.getAttribute('numFmtId') === format.numFmtId);
        assert.equal(numericFormat.getAttribute('formatCode'), '0.###############');
      }
    }
  }
  const sheet = book.Sheets['Comuna de ejemplo'];
  assert.equal(sheet.C3.t, 'n'); assert.equal(sheet.D3.t, 'n');
  assert.equal(sheet.C3.v, sectors[0].rings[0].points[0].lat);
  assert.equal(sheet.D3.v, sectors[0].rings[0].points[0].lon);
});

test('CSV agrupa X e Y en la tercera columna y conserva los mismos vértices y precisión del Excel', async () => {
  const sectors = demoSectors().slice(0, 2);
  sectors[0].zone = 'Zona "A", norte';
  sectors[0].rings[0].points[0].lat = -33.441123456789;
  sectors[0].rings[0].points[0].lon = -70.658987654321;
  sectors[0].rings.push({ kind: 'inner', points: sectors[0].rings[0].points.map((p, i) => ({ id: `hole-${i}`, lat: -33.439 + (p.lat + 33.439) * .2, lon: -70.651 + (p.lon + 70.651) * .2 })) });
  sectors[1].commune = 'Otra comuna';
  const source = structuredClone(sectors);
  const csv = toCSV(sectors);
  // El lector de cadenas raw conserva el BOM como texto; la firma UTF-8 se
  // comprueba aparte y se retira al analizar los registros de la prueba.
  const csvBook = XLSX.read(csv.slice(1), { type: 'string', raw: true });
  const csvRows = XLSX.utils.sheet_to_json(csvBook.Sheets[csvBook.SheetNames[0]], { header: 1 });
  assert.deepEqual(csvRows[0], ['Zona', 'Puntos', 'X e Y']);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('"-33.441123456789, -70.658987654321"'));
  const actual = csvRows.slice(1).map(([zone, point, coordinates]) => {
    const pair = coordinates.split(', ');
    assert.equal(pair.length, 2);
    return [zone, Number(point), ...pair.map(Number)];
  });
  const expected = sectors.flatMap(rowsForSector).map((row) => [row.Zona, row.Punto, row.X, row.Y]);
  assert.deepEqual(actual, expected);
  assert.ok(csvRows.every((row) => row.length === 3));
  const { book } = await openExport(sectors);
  const excelRows = book.SheetNames.slice(1).flatMap((name) => {
    let zone;
    return XLSX.utils.sheet_to_json(book.Sheets[name], { header: 1 }).slice(2).filter((row) => typeof row[1] === 'number').map((row) => {
      if (row[0] != null) zone = row[0];
      return [zone, ...row.slice(1)];
    });
  });
  assert.deepEqual(excelRows, actual);
  assert.deepEqual(sectors, source);
});

test('la descarga GeoJSON alinea los campos de puntos con CSV y conserva polígonos, huecos y numeración', () => {
  const sectors = demoSectors().slice(0, 2);
  sectors[0].rings.push({ kind: 'inner', points: sectors[0].rings[0].points.map((p, i) => ({ id: `hole-${i}`, lat: -33.439 + (p.lat + 33.439) * .2, lon: -70.651 + (p.lon + 70.651) * .2 })) });
  const source = structuredClone(sectors);
  const geojson = toGeoJSON(sectors);
  const styled = buildGeoJSON(sectors);
  assert.deepEqual(geojson.features.map((f) => f.geometry), styled.features.map((f) => f.geometry));
  assert.equal(geojson.features[0].geometry.coordinates.length, 2);
  const points = geojson.features.filter((f) => f.geometry.type === 'Point');
  const rows = sectors.flatMap(rowsForSector);
  assert.equal(points.length, rows.length);
  points.forEach((feature, index) => {
    const row = rows[index];
    assert.deepEqual(feature.properties, { Zona: row.Zona, Puntos: row.Punto, X: row.X, Y: row.Y });
    assert.deepEqual(feature.geometry.coordinates, [row.Y, row.X]);
  });
  geojson.features.filter((f) => f.geometry.type === 'Polygon').forEach((feature, i) => {
    assert.deepEqual(feature.properties, { Zona: sectors[i].zone, Puntos: sectors[i].rings.reduce((n, r) => n + r.points.length, 0) });
  });
  assert.deepEqual(sectors, source);
});
