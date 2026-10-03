import JSZip from 'jszip';
import { inferZone, openRing } from './geometry.js';

const elements = (node) => Array.from(node.childNodes || []).filter((n) => n.nodeType === 1);
const local = (node) => node.localName || node.nodeName.split(':').at(-1);
const descendants = (node, name) => Array.from(node.getElementsByTagNameNS('*', name));
const child = (node, name) => elements(node).find((n) => local(n) === name);

export function parseKMLDocument(xml, sourceId = 'kml') {
  if (descendants(xml, 'parsererror').length || !xml.documentElement || local(xml.documentElement) !== 'kml')
    throw new Error('El archivo no contiene un KML válido.');
  const sectors = [], warnings = [];
  const placemarks = descendants(xml, 'Placemark');
  let ignored = 0;
  placemarks.forEach((placemark, placemarkIndex) => {
    const name = child(placemark, 'name')?.textContent?.trim() || `Sector ${placemarkIndex + 1}`;
    let ancestor = placemark.parentNode, folder = '';
    while (ancestor && !folder) {
      if (local(ancestor) === 'Folder') folder = child(ancestor, 'name')?.textContent?.trim() || '';
      ancestor = ancestor.parentNode;
    }
    const polygons = descendants(placemark, 'Polygon');
    if (!polygons.length) ignored++;
    polygons.forEach((polygon, polygonIndex) => {
      const id = `${sourceId}:${placemarkIndex}:${polygonIndex}`;
      const label = polygons.length > 1 ? `${name} · Parte ${polygonIndex + 1}` : name;
      try {
        const boundaries = elements(polygon).filter((n) => ['outerBoundaryIs', 'innerBoundaryIs'].includes(local(n)))
          .sort((a, b) => (local(a) === 'outerBoundaryIs' ? 0 : 1) - (local(b) === 'outerBoundaryIs' ? 0 : 1));
        if (boundaries.filter((b) => local(b) === 'outerBoundaryIs').length !== 1) throw new Error('falta un contorno exterior único');
        const rings = boundaries.map((boundary, ringIndex) => {
          const coordinates = descendants(boundary, 'coordinates')[0]?.textContent?.trim();
          if (!coordinates) throw new Error('faltan coordenadas');
          const tokens = coordinates.split(/\s+/);
          if (tokens.length > 10000) throw new Error('el contorno supera los 10.000 puntos admitidos');
          const points = openRing(tokens.map((token, pointIndex) => {
            const parts = token.split(',');
            const lon = Number(parts[0]), lat = Number(parts[1]);
            if (parts.length < 2 || !parts[0].trim() || !parts[1].trim() || !Number.isFinite(lon) || !Number.isFinite(lat) || Math.abs(lon) > 180 || Math.abs(lat) > 90)
              throw new Error('hay coordenadas inválidas');
            return { id: `${id}:${ringIndex}:${pointIndex}`, lon, lat };
          }));
          if (points.length < 3) throw new Error('hay menos de tres vértices');
          return { id: `${id}:ring:${ringIndex}`, kind: local(boundary) === 'outerBoundaryIs' ? 'outer' : 'inner', points };
        });
        sectors.push({ id, name: label, ...inferZone(name, folder), part: polygonIndex + 1, rings });
      } catch (error) {
        warnings.push(`${label}: ${error.message}.`);
      }
    });
  });
  const links = descendants(xml, 'NetworkLink').length;
  if (links) warnings.push(`${links} enlace(s) externo(s) no se cargaron. Usa un KMZ con los polígonos incluidos.`);
  return { sectors, warnings, ignored };
}

export function parseKML(text, sourceId, Parser = DOMParser) {
  if (/<!DOCTYPE|<!ENTITY/i.test(text)) throw new Error('El KML contiene una declaración XML no admitida.');
  return parseKMLDocument(new Parser().parseFromString(text, 'application/xml'), sourceId);
}

export async function readMapFile(file, Parser = DOMParser) {
  const name = file.name.toLowerCase();
  if (!/\.(kmz|kml)$/.test(name)) throw new Error('Elige un archivo KMZ o KML.');
  if (file.size > 10 * 1024 * 1024) throw new Error('El archivo supera los 10 MB admitidos.');
  let sources;
  if (name.endsWith('.kmz')) {
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const entries = Object.values(zip.files).filter((entry) => !entry.dir && /\.kml$/i.test(entry.name));
    if (!entries.length) throw new Error('El KMZ no contiene ningún archivo KML.');
    if (entries.length > 20) throw new Error('El KMZ contiene más de 20 archivos KML.');
    sources = [];
    for (const entry of entries) {
      const text = await entry.async('text');
      if (text.length > 20 * 1024 * 1024) throw new Error('El KML descomprimido supera los 20 MB admitidos.');
      sources.push({ name: entry.name, text });
    }
  } else sources = [{ name: file.name, text: await file.text() }];
  const result = { sectors: [], warnings: [], ignored: 0 };
  sources.forEach((source, i) => {
    const parsed = parseKML(source.text, `source-${i}`, Parser);
    result.sectors.push(...parsed.sectors);
    result.warnings.push(...parsed.warnings);
    result.ignored += parsed.ignored;
  });
  if (!result.sectors.length) throw new Error(result.warnings[0] || 'No se encontraron polígonos. Los puntos y líneas no se convierten automáticamente en sectores.');
  if (result.sectors.length > 1000) throw new Error('El archivo supera los 1.000 sectores admitidos.');
  return result;
}
