export function sectorsForExport(sectors, selectedId, scope, communes = []) {
  if (scope === 'all') return sectors;
  if (scope === 'communes') {
    const chosen = new Set(communes);
    return sectors.filter((sector) => chosen.has(sector.commune));
  }
  const sector = sectors.find((item) => item.id === selectedId);
  if (!sector) return [];
  return scope === 'commune' ? sectors.filter((item) => item.commune === sector.commune) : [sector];
}
