import test from 'node:test';
import assert from 'node:assert/strict';
import { openRing, orderRing, signedArea, validateRing, validateSector, inferZone, buildGeoJSON, geojsonIoUrl } from '../src/geometry.js';
import { toCSV, excelBuffer } from '../src/exports.js';
import { demoSectors } from '../src/demo.js';

const square = [{id:'a',lon:0,lat:0},{id:'b',lon:1,lat:0},{id:'c',lon:1,lat:1},{id:'d',lon:0,lat:1}];

test('el cierre se elimina una vez por contorno, sin alterar los puntos de entrada', () => {
  const closed = [...square, { ...square[0], id: 'closure' }];
  assert.equal(openRing(closed).length, 4); assert.equal(closed.length, 5);
});
test('horario y antihorario mantienen la identidad del punto elegido', () => {
  for (const original of [square, [...square].reverse()]) for (const start of square) {
    const cw = orderRing(original, start.id, 'cw'), ccw = orderRing(original, start.id, 'ccw');
    assert.equal(cw[0].id, start.id); assert.equal(ccw[0].id, start.id);
    assert.ok(signedArea(cw) < 0); assert.ok(signedArea(ccw) > 0);
    assert.deepEqual(new Set(cw.map(p=>p.id)), new Set(square.map(p=>p.id)));
  }
});
test('reordenar repetidamente es estable y no suma cierres ni pierde precisión', () => {
  const points = demoSectors()[0].rings[0].points;
  const first = orderRing(points, points[2].id, 'ccw');
  assert.deepEqual(orderRing(first, points[2].id, 'ccw'), first);
  assert.deepEqual(orderRing(orderRing(first, points[2].id, 'cw'), points[2].id, 'ccw'), first);
});
test('se identifican contornos degenerados, repetidos y cruzados', () => {
  assert.equal(validateRing(square), null);
  assert.match(validateRing([square[0],square[2],square[1],square[3]]), /cruza/);
  assert.match(validateRing([square[0],square[0],square[2]]), /repetidos/);
  assert.match(validateRing([{lon:0,lat:0},{lon:1,lat:1},{lon:2,lat:2}]), /área/);
  assert.match(validateRing([{lon:0,lat:0},{lon:181,lat:1},{lon:2,lat:2}]), /rango/);
});
test('comuna y zona se extraen sin confundir números que se repiten entre comunas', () => {
  assert.deepEqual(inferZone('Las Condes 21'), {commune:'Las Condes',zone:'21'});
  assert.deepEqual(inferZone('Puente Alto 21'), {commune:'Puente Alto',zone:'21'});
  assert.deepEqual(inferZone('Zona sin número', 'Comuna A'), {commune:'Comuna A',zone:'Zona sin número'});
});
test('GeoJSON conserva polígonos separados, cierres y orden longitud/latitud', () => {
  const sectors = demoSectors();
  const geojson = buildGeoJSON(sectors);
  const polys = geojson.features.filter(f=>f.geometry.type==='Polygon');
  const points = geojson.features.filter(f=>f.geometry.type==='Point');
  assert.equal(polys.length,3); assert.equal(points.length,18);
  assert.deepEqual(points[0].geometry.coordinates,[-70.658,-33.441]);
  polys.forEach((f,i)=>{const ring=f.geometry.coordinates[0];assert.equal(ring.length,7);assert.deepEqual(ring[0],ring.at(-1));assert.equal(f.properties.name,sectors[i].name);});
});
test('GeoJSON interior mantiene un hueco con el sentido reglamentario', () => {
  const sector={id:'x',name:'A 1',commune:'A',zone:'1',rings:[{kind:'outer',points:square},{kind:'inner',points:square.map((p,i)=>({id:`hole${i}`,lon:p.lon*.2+.3,lat:p.lat*.2+.3}))}]};
  const polygon = buildGeoJSON([sector],false).features[0];
  const [outer,inner] = polygon.geometry.coordinates.map(r=>r.slice(0,-1).map(([lon,lat])=>({lon,lat})));
  assert.ok(signedArea(outer)>0);assert.ok(signedArea(inner)<0);
  assert.equal(validateSector(sector),null);
  sector.rings[1].points.forEach(p=>p.lon+=2);
  assert.match(validateSector(sector),/interior/);
});
test('el enlace a geojson.io evita # y otros separadores sin cambiar el JSON', () => {
  const sector=demoSectors()[0];sector.name='A #1 & 50%?';
  const url=geojsonIoUrl(sector);assert.equal(url.includes('%23'),false);assert.equal(url.includes('%26'),false);
  const parsed=JSON.parse(decodeURIComponent(url.split('data:application/json,')[1]));
  assert.deepEqual(parsed,buildGeoJSON([sector]));
});
test('CSV protege nombres con fórmulas, conserva coordenadas negativas y escapa comillas', () => {
  const sector=demoSectors()[0];sector.zone='=HYPERLINK("example")';
  const csv=toCSV([sector]);assert.ok(csv.startsWith('\uFEFFZona,Puntos,X e Y\r\n'));
  assert.ok(csv.includes('"-33.441, -70.658"'));assert.ok(csv.includes("'=HYPERLINK"));assert.ok(csv.includes('""example""'));
});
test('Excel tiene resumen, X latitud, Y longitud y una hoja por comuna, sin imágenes', async () => {
  const buffer=await excelBuffer(demoSectors());
  const XLSX=await import('xlsx');const book=XLSX.read(buffer,{type:'array'});
  assert.deepEqual(book.SheetNames,['Resumen','Comuna de ejemplo']);
  assert.equal(book.Sheets.Resumen.D2.v,6);
  const sheet=book.Sheets['Comuna de ejemplo'];
  assert.equal(sheet.C2.v,'X');assert.equal(sheet.D2.v,'Y');
  assert.equal(sheet.C3.v,-33.441);assert.equal(sheet.D3.v,-70.658);assert.equal(sheet.C3.t,'n');
});
