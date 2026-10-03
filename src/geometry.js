/** Geometría interna: { id, lat, lon }. GeoJSON: [longitud, latitud]. */
export const samePosition = (a, b) => a.lat === b.lat && a.lon === b.lon;

export function openRing(points) {
  const result = points.map((p) => ({ ...p }));
  while (result.length > 1 && samePosition(result[0], result.at(-1))) result.pop();
  return result;
}

export function signedArea(points) {
  if (!points.length) return 0;
  // Trasladar al primer vértice evita cancelación con coordenadas grandes.
  const { lon: x0, lat: y0 } = points[0];
  return points.reduce((sum, p, i) => {
    const q = points[(i + 1) % points.length];
    return sum + (p.lon - x0) * (q.lat - y0) - (q.lon - x0) * (p.lat - y0);
  }, 0) / 2;
}

export function orderRing(points, startId, direction) {
  if (!['cw', 'ccw'].includes(direction)) throw new Error('Sentido desconocido.');
  const ordered = openRing(points);
  if (!ordered.some((p) => p.id === startId)) throw new Error('El punto inicial ya no existe.');
  const area = signedArea(ordered);
  if (Math.abs(area) < 1e-14) throw new Error('El contorno no tiene un área válida.');
  if ((direction === 'ccw' && area < 0) || (direction === 'cw' && area > 0)) ordered.reverse();
  const index = ordered.findIndex((p) => p.id === startId);
  return [...ordered.slice(index), ...ordered.slice(0, index)];
}

const cross = (a, b, c) => (b.lon - a.lon) * (c.lat - a.lat) - (b.lat - a.lat) * (c.lon - a.lon);
const onSegment = (a, b, p) => Math.abs(cross(a, b, p)) < 1e-14 &&
  p.lon >= Math.min(a.lon, b.lon) - 1e-12 && p.lon <= Math.max(a.lon, b.lon) + 1e-12 &&
  p.lat >= Math.min(a.lat, b.lat) - 1e-12 && p.lat <= Math.max(a.lat, b.lat) + 1e-12;

function intersects(a, b, c, d) {
  const c1 = cross(a, b, c), c2 = cross(a, b, d), c3 = cross(c, d, a), c4 = cross(c, d, b);
  return ((c1 > 0 && c2 < 0 || c1 < 0 && c2 > 0) && (c3 > 0 && c4 < 0 || c3 < 0 && c4 > 0)) ||
    onSegment(a, b, c) || onSegment(a, b, d) || onSegment(c, d, a) || onSegment(c, d, b);
}

export function validateRing(points) {
  if (points.length < 3) return 'El contorno necesita al menos tres puntos.';
  if (points.some((p) => !Number.isFinite(p.lat) || !Number.isFinite(p.lon) || Math.abs(p.lat) > 90 || Math.abs(p.lon) > 180))
    return 'Hay coordenadas fuera de rango.';
  if (new Set(points.map((p) => `${p.lon},${p.lat}`)).size !== points.length)
    return 'El contorno tiene vértices repetidos.';
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      if (j === i + 1 || i === 0 && j === points.length - 1) continue;
      if (intersects(points[i], points[(i + 1) % points.length], points[j], points[(j + 1) % points.length]))
        return 'El contorno se cruza consigo mismo.';
    }
  }
  if (Math.abs(signedArea(points)) < 1e-14) return 'El contorno no tiene un área válida.';
  return null;
}

function pointInside(point, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i], b = points[j];
    if ((a.lat > point.lat) !== (b.lat > point.lat) &&
      point.lon < (b.lon - a.lon) * (point.lat - a.lat) / (b.lat - a.lat) + a.lon) inside = !inside;
  }
  return inside;
}

function ringsIntersect(a, b) {
  for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++)
    if (intersects(a[i], a[(i + 1) % a.length], b[j], b[(j + 1) % b.length])) return true;
  return false;
}

export function validateSector(sector) {
  for (const ring of sector.rings) { const error = validateRing(ring.points); if (error) return error; }
  const [outer, ...holes] = sector.rings.map((r) => r.points);
  for (let i = 0; i < holes.length; i++) {
    if (!pointInside(holes[i][0], outer) || ringsIntersect(holes[i], outer))
      return 'Un contorno interior sale del límite exterior o lo toca.';
    for (let j = 0; j < i; j++) {
      if (ringsIntersect(holes[i], holes[j]) || pointInside(holes[i][0], holes[j]) || pointInside(holes[j][0], holes[i]))
        return 'Dos contornos interiores se superponen.';
    }
  }
  return null;
}

export function inferZone(name, folder = '') {
  const match = name.trim().match(/^(.*?)\s+(\d+)$/u);
  return match ? { commune: match[1].trim(), zone: match[2] } : { commune: folder || 'Sin comuna', zone: name.trim() };
}

export function rowsForSector(sector) {
  return sector.rings.flatMap((ring, ringIndex) => ring.points.map((p, i) => ({
    Comuna: sector.commune,
    Zona: sector.zone,
    Sector: sector.name,
    Contorno: ringIndex + 1,
    Tipo: ring.kind === 'outer' ? 'Exterior' : 'Interior',
    Punto: i + 1,
    X: p.lat,
    Y: p.lon,
  })));
}

export function buildGeoJSON(sectors, includePoints = true) {
  const features = [];
  for (const sector of sectors) {
    const coordinates = sector.rings.map((ring, i) => {
      // RFC 7946: exterior antihorario e interiores horarios.
      const points = orderRing(ring.points, ring.points[0].id, i === 0 ? 'ccw' : 'cw');
      const coords = points.map((p) => [p.lon, p.lat]);
      return [...coords, [...coords[0]]];
    });
    features.push({
      type: 'Feature',
      properties: { name: sector.name, Comuna: sector.commune, Zona: sector.zone, Puntos: sector.rings.reduce((n, r) => n + r.points.length, 0), stroke: '#2563eb', 'stroke-width': 2, fill: '#2563eb', 'fill-opacity': 0.12 },
      geometry: { type: 'Polygon', coordinates },
    });
    if (!includePoints) continue;
    sector.rings.forEach((ring, ringIndex) => ring.points.forEach((p, i) => features.push({
      type: 'Feature',
      properties: { name: `${sector.name} · Punto ${i + 1}`, Comuna: sector.commune, Zona: sector.zone, Contorno: ringIndex + 1, Tipo: ring.kind === 'outer' ? 'Exterior' : 'Interior', Punto: i + 1, 'marker-color': i === 0 ? '#d97706' : '#2563eb', 'marker-symbol': i < 9 ? String(i + 1) : '' },
      geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
    })));
  }
  return { type: 'FeatureCollection', features };
}

export function geojsonIoUrl(sector) {
  const text = JSON.stringify(buildGeoJSON([sector])).replace(/#/g, '\\u0023').replace(/&/g, '\\u0026').replace(/\?/g, '\\u003f').replace(/%/g, '\\u0025');
  return `https://geojson.io/#data=data:application/json,${encodeURIComponent(text)}`;
}

export const clone = (value) => JSON.parse(JSON.stringify(value));
