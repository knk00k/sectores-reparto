// Datos sintéticos para mostrar el proyecto sin distribuir archivos de trabajo.
export function demoSectors() {
  const create = (id, name, coords) => ({
    id, name, commune: 'Comuna de ejemplo', zone: name.split(' ').at(-1), part: 1,
    rings: [{ id: `${id}-ring`, kind: 'outer', points: coords.map(([lon, lat], i) => ({ id: `${id}-${i}`, lon, lat })) }],
  });
  return [
    create('demo-1', 'Sector de ejemplo 1', [[-70.658, -33.441], [-70.656, -33.435], [-70.650, -33.433], [-70.644, -33.437], [-70.646, -33.443], [-70.652, -33.445]]),
    create('demo-2', 'Sector de ejemplo 2', [[-70.644, -33.437], [-70.638, -33.434], [-70.632, -33.436], [-70.631, -33.442], [-70.638, -33.446], [-70.646, -33.443]]),
    create('demo-3', 'Sector de ejemplo 3', [[-70.652, -33.445], [-70.646, -33.443], [-70.638, -33.446], [-70.640, -33.451], [-70.649, -33.453], [-70.655, -33.449]]),
  ];
}
