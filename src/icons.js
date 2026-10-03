const paths = {
  sector: '<path d="m5 6 9-3 6 8-5 10-11-4Z"/><circle cx="5" cy="6" r="2"/><circle cx="14" cy="3" r="2"/><circle cx="20" cy="11" r="2"/><circle cx="15" cy="21" r="2"/><circle cx="4" cy="17" r="2"/>',
  upload: '<path d="M12 16V3m-5 5 5-5 5 5M4 14v6h16v-6"/>',
  download: '<path d="M12 3v13m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  chevron: '<path d="m7 10 5 5 5-5"/>',
  reorder: '<path d="M20 7v5h-5M4 17v-5h5M6 7a7 7 0 0 1 12-1l2 3M18 17a7 7 0 0 1-12 1l-2-3"/>',
  map: '<path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2Zm6-2v16m6-14v16"/>',
  file: '<path d="M14 2H5v20h14V7Zm0 0v6h5M8 12h8m-8 4h8"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  warning: '<path d="m12 3 10 18H2Z"/><path d="M12 9v5m0 3h.01"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 4m0 3h.01"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  edit: '<path d="m15 4 5 5-11 11-6 1 1-6ZM13 6l5 5"/>',
  undo: '<path d="M4 10h9a6 6 0 0 1 0 12M4 10l5-5m-5 5 5 5"/>',
  search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
  expand: '<path d="M9 3H3v6m12-6h6v6M3 15v6h6m12-6v6h-6"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
};
export function icon(name, className = '') {
  return `<svg class="icon ${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.file}</svg>`;
}

export function fileIcon(type) {
  const content = type === 'xlsx' ? '<path d="M15 23l10 14m0-14L15 37" stroke="white" stroke-width="3"/>' :
    type === 'csv' ? '<path d="M14 24h18v16H14Zm0 5h18m-18 5h18m-12-10v16m6-16v16" stroke="white" stroke-width="2" fill="none"/>' :
    '<text x="10" y="38" fill="white" font-family="monospace" font-size="25" font-weight="bold">{}</text>';
  return `<svg class="file-illustration ${type}" viewBox="0 0 48 56" aria-hidden="true"><path d="M8 2h23l11 12v38H8Z" fill="currentColor"/><path d="M31 2v12h11" fill="white" opacity=".25"/>${content}</svg>`;
}
