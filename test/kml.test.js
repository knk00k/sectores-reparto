import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { DOMParser } from '@xmldom/xmldom';
import { parseKML, readMapFile } from '../src/kml.js';
import { buildGeoJSON, validateRing, orderRing } from '../src/geometry.js';
import { excelBuffer } from '../src/exports.js';

const outer = '0,0,0 2,0,0 2,2,0 0,2,0 0,0,0';
const hole = '.5,.5 1,.5 1,1 .5,1 .5,.5';
const polygon = `<Polygon><outerBoundaryIs><LinearRing><coordinates>${outer}</coordinates></LinearRing></outerBoundaryIs></Polygon>`;
const kml=(inner)=>`<kml xmlns="http://www.opengis.net/kml/2.2"><Document>${inner}</Document></kml>`;

test('cada Placemark se lee por separado y se ignoran líneas y puntos',()=>{
  const source=kml(`<Placemark><name>Comuna 1</name>${polygon}</Placemark><Placemark><name>Comuna 2</name>${polygon}</Placemark><Placemark><Point><coordinates>0,0</coordinates></Point></Placemark>`);
  const {sectors,ignored}=parseKML(source,'test',DOMParser);
  assert.equal(sectors.length,2);assert.equal(ignored,1);assert.equal(sectors[0].rings[0].points.length,4);assert.notEqual(sectors[0].id,sectors[1].id);
});
test('un MultiGeometry y sus huecos conservan cada parte y cada contorno',()=>{
  const withHole=polygon.replace('</Polygon>',`<innerBoundaryIs><LinearRing><coordinates>${hole}</coordinates></LinearRing></innerBoundaryIs></Polygon>`);
  const {sectors}=parseKML(kml(`<Placemark><name>Comuna 3</name><MultiGeometry>${withHole}${polygon}</MultiGeometry></Placemark>`),'test',DOMParser);
  assert.equal(sectors.length,2);assert.equal(sectors[0].rings.length,2);assert.equal(sectors[0].rings[1].kind,'inner');assert.equal(sectors[1].part,2);
});
test('KML con prefijos XML y nombres escapados sigue funcionando',()=>{
  const prefixed=`<k:kml xmlns:k="http://www.opengis.net/kml/2.2"><k:Document><k:Placemark><k:name>A &amp; B 1</k:name>${polygon.replace(/<(\/)?([A-Za-z]+)/g,'<$1k:$2')}</k:Placemark></k:Document></k:kml>`;
  assert.equal(parseKML(prefixed,'prefixed',DOMParser).sectors[0].name,'A & B 1');
});
test('una coordenada dañada no se elimina silenciosamente para cambiar la figura',()=>{
  const source=kml(`<Placemark><name>Mal 1</name>${polygon.replace('2,2,0','2abc,2,0')}</Placemark><Placemark><name>Bien 1</name>${polygon}</Placemark>`);
  const result=parseKML(source,'test',DOMParser);assert.equal(result.sectors.length,1);assert.equal(result.warnings.length,1);assert.equal(result.sectors[0].name,'Bien 1');
});
test('no se resuelven entidades ni NetworkLinks externos',()=>{
  assert.throws(()=>parseKML('<!DOCTYPE kml><kml/>','test',DOMParser),/declaración/);
  const result=parseKML(kml(`<NetworkLink><Link><href>https://example.com/remote.kml</href></Link></NetworkLink><Placemark>${polygon}</Placemark>`),'test',DOMParser);
  assert.equal(result.warnings.length,1);assert.equal(result.sectors.length,1);
});
test('KMZ real RM: 109 sectores y 2302 vértices; separación y exportación comprobadas', {skip: !existsSync('datos-locales/RM.kmz')}, async()=>{
  const bytes=await fs.readFile('datos-locales/RM.kmz');
  const file={name:'RM.kmz',size:bytes.length,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)};
  const result=await readMapFile(file,DOMParser);
  assert.equal(result.sectors.length,109);assert.equal(result.warnings.length,0);
  assert.equal(result.sectors.reduce((n,s)=>n+s.rings[0].points.length,0),2302);
  assert.equal(new Set(result.sectors.map(s=>s.id)).size,109);
  const lasCondes=result.sectors.find(s=>s.name==='Las Condes 21');assert.equal(lasCondes.rings[0].points.length,29);
  for(const s of result.sectors){for(const r of s.rings){assert.equal(validateRing(r.points),null,s.name);const start=r.points[Math.floor(r.points.length/2)];assert.equal(orderRing(r.points,start.id,'cw')[0].id,start.id);}}
  assert.equal(buildGeoJSON(result.sectors,false).features.length,109);
  const buffer=await excelBuffer(result.sectors);const XLSX=await import('xlsx');const book=XLSX.read(buffer,{type:'array'});
  assert.equal(XLSX.utils.sheet_to_json(book.Sheets.Resumen).length,109);
  assert.equal(book.Sheets['Las Condes'].C3.v,lasCondes.rings[0].points[0].lat);
});
