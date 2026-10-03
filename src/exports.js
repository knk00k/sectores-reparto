import { rowsForSector, buildGeoJSON } from './geometry.js';
import { styleCoordinateWorkbook } from './excel-style.js';

// Campos de coordenadas del Excel y de los puntos GeoJSON.
const coordinateColumns = [
  { title: 'Zona', key: 'Zona' },
  { title: 'Puntos', key: 'Punto' },
  { title: 'X', key: 'X' },
  { title: 'Y', key: 'Y' },
];
const coordinateValues = (row) => coordinateColumns.map(({ key }) => row[key]);
const csvQuote = (text) => /[",\r\n]/u.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
export const csvEscape = (value) => {
  // Evitar que Excel interprete nombres del KML como fórmulas.
  let text = String(value ?? '');
  if (typeof value === 'string' && /^[\s]*[=+\-@]/u.test(text)) text = `'${text}`;
  return csvQuote(text);
};

export function toCSV(sectors) {
  const lines = ['Zona,Puntos,X e Y'];
  sectors.forEach((sector) => rowsForSector(sector).forEach((row) => {
    // Las comillas conservan la pareja de coordenadas en una sola celda.
    // Sus valores numéricos no requieren el escape de fórmulas para nombres.
    lines.push([csvEscape(row.Zona), csvEscape(row.Punto), csvQuote(`${row.X}, ${row.Y}`)].join(','));
  }));
  return '\uFEFF' + lines.join('\r\n');
}

export function toGeoJSON(sectors) {
  const geojson = buildGeoJSON(sectors);
  const rows = sectors.flatMap(rowsForSector);
  let pointIndex = 0;
  return {
    ...geojson,
    features: geojson.features.map((feature) => {
      if (feature.geometry.type === 'Point') {
        const row = rows[pointIndex++];
        const properties = Object.fromEntries(coordinateColumns.map(({ title, key }) => [title, row[key]]));
        return { ...feature, properties };
      }
      return { ...feature, properties: { Zona: feature.properties.Zona, Puntos: feature.properties.Puntos } };
    }),
  };
}

export function downloadBlob(contents, filename, type) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const safeFilename = (value) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9_-]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'sectores';

export async function createWorkbook(sectors) {
  const XLSX = await import('xlsx');
  const workbook = XLSX.utils.book_new();
  const summary = [['Sector', 'Comuna', 'Zona', 'Cantidad de puntos', 'Contornos'],
    ...sectors.map((s) => [s.name, s.commune, s.zone, s.rings.reduce((n, r) => n + r.points.length, 0), s.rings.length])];
  const summarySheet = XLSX.utils.aoa_to_sheet(summary);
  summarySheet['!cols'] = [{ wch: 32 }, { wch: 24 }, { wch: 12 }, { wch: 22 }, { wch: 14 }];
  summarySheet['!autofilter'] = { ref: summarySheet['!ref'] };
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Resumen');
  const used = new Set(['resumen']);
  const communes = [...new Set(sectors.map((s) => s.commune))];
  communes.forEach((commune) => {
    const group = sectors.filter((s) => s.commune === commune);
    // Formato de la plantilla: Zona, Puntos y Coordenadas X/Y.
    const data = [['Zona', 'Puntos', 'Coordenadas', null], [null, null, 'X', 'Y']];
    const merges = [
      { s: { r: 0, c: 0 }, e: { r: 1, c: 0 } },
      { s: { r: 0, c: 1 }, e: { r: 1, c: 1 } },
      { s: { r: 0, c: 2 }, e: { r: 0, c: 3 } },
    ];
    group.forEach((sector) => {
      const first = data.length;
      const rows = rowsForSector(sector);
      rows.forEach((row, i) => {
        const values = coordinateValues(row);
        if (i > 0) values[0] = null;
        data.push(values);
      });
      if (rows.length > 1) merges.push({ s: { r: first, c: 0 }, e: { r: data.length - 1, c: 0 } });
      data.push([]);
    });
    const sheet = XLSX.utils.aoa_to_sheet(data);
    sheet['!merges'] = merges;
    sheet['!cols'] = [{ wch: 12 }, { wch: 12 }, { wch: 21 }, { wch: 21 }];
    sheet['!rows'] = [{ hpt: 22 }, { hpt: 22 }];
    Object.entries(sheet).forEach(([address, cell]) => {
      if (/^[CD]\d+$/.test(address) && cell.t === 'n') cell.z = '0.###############';
    });
    const base = commune.replace(/[\\/?*\[\]:]/g, ' ').trim().slice(0, 31) || 'Coordenadas';
    let name = base, count = 2;
    while (used.has(name.toLowerCase())) { const suffix = ` ${count++}`; name = base.slice(0, 31 - suffix.length) + suffix; }
    used.add(name.toLowerCase());
    XLSX.utils.book_append_sheet(workbook, sheet, name);
  });
  return { workbook, XLSX };
}

export async function excelBuffer(sectors) {
  const { workbook, XLSX } = await createWorkbook(sectors);
  const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
  return styleCoordinateWorkbook(buffer, workbook.SheetNames.length);
}
