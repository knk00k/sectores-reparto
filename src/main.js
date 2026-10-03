import L from 'leaflet';
import '@geoman-io/leaflet-geoman-free';
import './style.css';
import { icon, fileIcon } from './icons.js';
import { readMapFile } from './kml.js';
import { orderRing, signedArea, validateSector, clone, geojsonIoUrl } from './geometry.js';
import { downloadBlob, safeFilename, toCSV, toGeoJSON, excelBuffer } from './exports.js';
import { demoSectors } from './demo.js';
import { setupCatPaws } from './cat-paws.js';
import { captureWorkspace, createWorkspaceStore } from './workspace-storage.js';
import { isWorkspaceResetShortcut } from './workspace-reset.js';

document.querySelector('#app').innerHTML = `
  <main class="app-shell">
  	<header class="header">
  		<div class="brand">${icon('sector')}<div>
  				<h1>Sectores de reparto</h1>
  				<p class="subtitle">Convierte tu polígono en coordenadas listas para entregar.</p>
  			</div>
  		</div>
  		<button class="quiet help-button" id="help-button">${icon('help')} Ayuda</button>
  	</header>

    <section class="feedback" aria-label="Estado y avisos">
      <div class="status-line info" id="status" role="status" aria-live="polite" aria-atomic="true"><span id="status-icon">${icon('upload')}</span><span id="status-text">Sube un archivo para empezar, o prueba el ejemplo.</span></div>
      <p class="validation-warning" id="validation-warning" hidden></p>
      <details class="warnings" id="import-warnings" hidden>
        <summary id="warnings-title"></summary>
        <ul id="warnings-list"></ul>
      </details>
    </section>

  	<section class="toolbar" aria-label="Acciones del sector">
  		<div class="field upload-column">
        <span class="field-label">Selecciona un archivo</span>
  			<button class="primary" id="upload-button" aria-describedby="upload-note">${icon('upload')} Subir KMZ</button>
  		</div>
  		<input type="file" id="file-input" accept=".kmz,.kml" class="screen-reader-only" tabindex="-1" aria-label="Archivo KMZ o KML" />
  		<div class="field">
  			<label for="start-point">Punto inicial</label>
  			<select id="start-point" disabled>
  				<option>—</option>
  			</select>
  		</div>
  		<div class="field">
  			<label for="direction">Sentido del contorno</label>
  			<select id="direction" disabled>
        <option value="cw">↷ Horario</option>
  				<option value="ccw">↶ Antihorario</option>
  			</select>
  		</div>
  		<button id="reorder-button" disabled>${icon('reorder')} Reordenar</button>
  		<div class="toolbar-spacer"></div>
  		<button id="external-map" disabled title="Abrir el sector en geojson.io">${icon('map')} Ver en GeoJSON</button>
  		<div class="download-wrap">
  			<button class="primary" id="download-button" disabled aria-expanded="false" aria-controls="download-popover">${icon('download')} Descargar ${icon('chevron')}</button>
  			<section class="download-popover" id="download-popover" role="dialog" aria-label="Descargar coordenadas" hidden>
  				<div class="popover-heading">
  					<h2>Descargar coordenadas</h2><button class="icon-button" id="close-download" aria-label="Cerrar descargas">${icon('close')}</button>
  				</div>
  				<p class="popover-description" id="download-description"></p>
  				<div class="export-scope">
  					<label for="export-scope">Qué quieres descargar</label>
  					<select id="export-scope">
  						<option value="sector">Solo el sector seleccionado</option>
  						<option value="commune">Todos los sectores de esta comuna</option>
  						<option value="all">Todos los sectores del archivo</option>
  					</select>
  				</div>
        <div class="format-grid">
          <button class="format-card xlsx" data-format="xlsx">${fileIcon('xlsx')}<strong>Excel</strong><span>.xlsx</span></button>
          <button class="format-card" data-format="csv">${fileIcon('csv')}<strong>CSV</strong><span>.csv</span></button>
          <button class="format-card" data-format="geojson">${fileIcon('geojson')}<strong>GeoJSON</strong><span>.geojson</span></button>
        </div>
  				<p class="popover-help">Excel: X e Y separados. CSV: X e Y en una celda. <br> X = latitud; Y = longitud. La geometría GeoJSON usa longitud y latitud.</p>
  			</section>
  		</div>
      <div class="toolbar-note">
        <span class="source-summary"><span id="upload-note">KMZ o KML · hasta 10 MB</span><strong class="file-name" id="file-name" hidden></strong></span>
      </div>
  	</section>

  	<section class="workspace" aria-label="Sectores y coordenadas">
  		<div class="selector-line">
  			<div class="field">
  				<label for="commune-select">Comuna</label>
  				<select id="commune-select" disabled>
  					<option>—</option>
  				</select>
  			</div>
  			<div class="field sector-field">
  				<label for="sector-select">Zona / sector</label>
  				<select id="sector-select" disabled>
  					<option>—</option>
  				</select>
  			</div>
  			<div class="field search-container">
  				<label for="sector-search">Buscar un sector</label>${icon('search')}
  				<input class="search-input" id="sector-search" type="search" placeholder="Nombre o número" disabled />
  			</div>
  			<div class="sector-meta">
  				<strong id="point-count">Sin puntos</strong>
  				<span class="sector-count" id="sector-count">Sube tu archivo</span>
  			</div>
  		</div>
  		<div class="main-grid">
  			<section class="card table-card" aria-labelledby="coordinates-title">
  				<div class="card-header">
  					<div>
  						<h2 id="coordinates-title">Coordenadas del sector</h2>
  						<p id="coordinates-subtitle">Se obtienen automáticamente del archivo.</p>
  					</div>
  					<span class="badge" id="demo-badge" hidden>Demostración</span>
  				</div>
  				<div class="ring-field" id="ring-field" hidden>
  					<label class="field-label" for="ring-select">Contorno</label>
  					<select id="ring-select"></select>
  				</div>
  				<div class="empty-state" id="empty-table">${icon('sector')}<strong>Empieza con tu mapa</strong>
  					<p>Sube un KMZ o KML y encontrarás cada zona con sus coordenadas, sin escribir punto por punto.</p>
  					<button id="demo-button">Probar con un ejemplo ${icon('arrow')}</button>
          <button id="reset-filters" hidden>Limpiar búsqueda y filtros ${icon('search')}</button>
  				</div>
  				<div class="table-scroll" id="table-scroll" hidden>
  					<table>
  						<caption class="screen-reader-only">Vértices del contorno seleccionado. X es latitud; Y es longitud.</caption>
  						<thead>
  							<tr>
  								<th scope="col">Punto</th>
  								<th scope="col">X · Latitud</th>
  								<th scope="col">Y · Longitud</th>
  							</tr>
  						</thead>
  						<tbody id="coordinates-body"></tbody>
  					</table>
  				</div>
  				<div class="table-footer" id="table-footer" hidden>
  					<p id="table-count"></p>
  					<p>X = latitud · Y = longitud, como en tu plantilla.</p>
  					<p>El cierre del polígono no se cuenta como un punto adicional.</p>
  				</div>
  			</section>

  			<section class="card map-card" aria-labelledby="map-title">
  				<div class="card-header">
  					<div>
  						<h2 id="map-title">Vista del sector</h2>
  						<p id="map-subtitle">Elige una zona para revisar su límite.</p>
  					</div>
  					<div class="map-actions">
  						<button class="small" id="fit-map" disabled aria-label="Mostrar todos los sectores">${icon('expand')} Ver todos los polígonos</button>
  						<button class="small" id="edit-boundary" disabled>${icon('edit')} Ajustar límite</button>
  						<button class="small" id="undo-button" disabled aria-label="Deshacer el último ajuste del sector">${icon('undo')} Deshacer</button>
  						<button class="small" id="cancel-edit" hidden>Cancelar</button>
  					</div>
  				</div>
  				<div class="map-wrap">
  					<div class="map" id="map" aria-label="Mapa de sectores"></div>
  					<div class="map-cover" id="map-cover">${icon('map')}<strong>Tu sector, con sus puntos</strong>
  						<p>Al subir el archivo podrás seleccionar una zona directamente en el mapa.</p>
  					</div>
  					<div class="tile-note" id="tile-note" hidden>El fondo no pudo cargar. Los polígonos siguen disponibles.</div>
  				</div>
  				<div class="map-footer">
  					<div class="legend"><span class="legend-item"><i class="legend-dot"></i>Punto inicial</span><span class="legend-item"><i class="legend-line"></i>Sector seleccionado</span><span class="legend-item"><i class="legend-line other"></i>Otros sectores</span></div>
  					<p id="map-help">Haz clic en una zona para seleccionarla. El punto 1 es el inicio de la lista, no una parada de reparto.</p>
  				</div>
  			</section>
  		</div>
  	</section>
  	<footer class="page-footer">
      <button type="button" class="footer-signature" id="cat-paws-trigger" aria-label="ฅ knk00k ฅ · Mostrar huellas de gato" title="Miau">ฅ knk00k ฅ</button>
      <span>Sectores de reparto · v1.0</span>
    </footer>
  </main>
  <dialog class="help-dialog" id="help-dialog" aria-labelledby="help-title">
  	<h2 id="help-title">Cómo preparar un sector</h2>
  	<ol>
  		<li><strong>Sube tu KMZ o KML.</strong> Cada polígono se mantiene como un sector separado.</li>
  		<li><strong>Elige la comuna y la zona.</strong> También puedes buscar por nombre o hacer clic en el mapa.</li>
  		<li><strong>Define el punto inicial y el sentido.</strong> Pulsa Reordenar para actualizar la lista. Los números del selector identifican los puntos del archivo original.</li>
  		<li><strong>Ajusta el límite si lo necesitas.</strong> Arrastra los vértices, añade uno con los puntos intermedios o haz clic en un vértice para eliminarlo. Guarda o cancela el ajuste.</li>
  		<li><strong>Descarga las coordenadas.</strong> Elige Excel, CSV o GeoJSON y si quieres un sector, una comuna o todo el archivo.</li>
  	</ol>
  	<p>El sentido ordena el contorno del polígono; no calcula un recorrido de reparto. Ajustar una zona no modifica las zonas vecinas.</p>
    <p>Para borrar los datos pulsa <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>R</kbd> (en Mac, <kbd>⌘</kbd> + <kbd>Shift</kbd> + <kbd>R</kbd>). <br> Se borran los datos cargados y sus ajustes.</p>
  	<div class="dialog-footer"><button class="primary" id="close-help">Entendido</button></div>
  </dialog>
`;

const $ = (id) => document.getElementById(id);
setupCatPaws($('cat-paws-trigger'));
const state = { sectors: [], selectedId: null, ringIndex: 0, filters: { commune: 'all', search: '' }, originals: new Map(), controls: new Map(), history: new Map(), issues: new Map(), editing: false, pending: false, busy: true, demo: false, modified: false, source: { filename: '', warnings: [], ignored: 0 } };
const workspaceStore = createWorkspaceStore();
let restoringWorkspace = true, resettingWorkspace = false, persistenceFailed = false, pendingWrites = 0, writeQueue = Promise.resolve();
const selected = () => state.sectors.find((s) => s.id === state.selectedId);
const ring = () => selected()?.rings[state.ringIndex];
const settings = () => state.controls.get(ring()?.id);
const localeSort = (a, b) => a.localeCompare(b, 'es', { numeric: true, sensitivity: 'base' });
const normalize = (text) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const status = (message, type = 'success') => {
  $('status-icon').innerHTML = icon(type === 'error' || type === 'notice' ? 'warning' : type === 'info' ? 'help' : 'check');
  $('status').className = `status-line ${type}`;
  $('status').setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');
  $('status-text').textContent = message;
  const issue = state.issues.get(state.selectedId);
  $('validation-warning').hidden = !issue || message.includes(issue);
};
const tooltip = (text) => { const node = document.createElement('span'); node.textContent = text; return node; };

const map = L.map('map', { preferCanvas: true, pmIgnore: false }).setView([-33.45, -70.65], 10);
const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).addTo(map);
tiles.on('tileerror', () => { $('tile-note').hidden = false; });
tiles.on('load', () => { /* Los errores de conexión permanecen visibles si hubo alguno. */ });
const contextLayers = L.featureGroup().addTo(map);
const vertexLayers = L.layerGroup().addTo(map);
let selectedLayer;
const resizeObserver = new ResizeObserver(() => map.invalidateSize());
resizeObserver.observe($('map'));

function persistWorkspace() {
  if (restoringWorkspace || resettingWorkspace || !state.sectors.length) return;
  const center = map.getCenter();
  const draft = state.editing && selectedLayer ? {
    selectedId: state.selectedId,
    coordinates: selectedLayer.getLatLngs().map((contour) => contour.map((p) => [p.lat, p.lng])),
  } : null;
  const saved = captureWorkspace(state, { lat: center.lat, lon: center.lng, zoom: map.getZoom() }, $('export-scope').value, draft);
  pendingWrites++;
  writeQueue = writeQueue.then(() => workspaceStore.save(saved)).then(() => {
    persistenceFailed = false;
  }).catch((error) => {
    console.error(error);
    if (!persistenceFailed) status('No se pudieron conservar los cambios en este navegador. Descarga tus resultados antes de salir.', 'notice');
    persistenceFailed = true;
  }).finally(() => {
    pendingWrites--;
  });
}
map.on('moveend', persistWorkspace);

function allBounds() { return L.latLngBounds(state.sectors.flatMap((s) => s.rings.flatMap((r) => r.points.map((p) => [p.lat, p.lon])))); }
function fitSelected() {
  const sector = selected();
  if (sector) map.fitBounds(L.latLngBounds(sector.rings.flatMap((r) => r.points.map((p) => [p.lat, p.lon]))), { padding: [45, 45], maxZoom: 16, animate: false });
}

function renderMap(fit = false) {
  contextLayers.clearLayers(); vertexLayers.clearLayers();
  if (selectedLayer) { selectedLayer.pm?.disable(); map.removeLayer(selectedLayer); selectedLayer = undefined; }
  const current = selected();
  $('map-cover').hidden = Boolean(current);
  $('map-cover').querySelector('strong').textContent = state.sectors.length ? 'No hay sectores que coincidan' : 'Tu sector, con sus puntos';
  $('map-cover').querySelector('p').textContent = state.sectors.length ? 'Limpia la búsqueda o selecciona otra comuna para volver a ver tus sectores.' : 'Al subir el archivo podrás seleccionar una zona directamente en el mapa.';
  state.sectors.forEach((sector) => {
    if (sector.id === current?.id) return;
    const coordinates = sector.rings.map((r) => r.points.map((p) => [p.lat, p.lon]));
    // El halo separa el límite de las calles y etiquetas del mapa base.
    contextLayers.addLayer(L.polygon(coordinates, { color: '#ffffff', weight: 4.5, opacity: .85, fill: false, interactive: false, pmIgnore: true }));
    const poly = L.polygon(coordinates, { color: '#475569', weight: 2.2, opacity: 1, fillColor: '#b6cbd9', fillOpacity: .10, pmIgnore: true });
    poly.bindTooltip(tooltip(sector.name), { sticky: true });
    poly.on('click', () => { if (!state.editing && !state.busy) selectSector(sector.id, true); });
    contextLayers.addLayer(poly);
  });
  if (!current) return;
  selectedLayer = L.polygon(current.rings.map((r) => r.points.map((p) => [p.lat, p.lon])), { color: '#246bdf', weight: 3.3, fillColor: '#4b93e5', fillOpacity: .17, pmIgnore: false }).addTo(map);
  if (fit) fitSelected();
  const currentRing = ring();
  const labeledPositions = [];
  currentRing.points.forEach((p, index) => {
    const position = map.latLngToContainerPoint([p.lat, p.lon]);
    const dense = index !== 0 && labeledPositions.some((old) => old.distanceTo(position) < 28);
    if (!dense) labeledPositions.push(position);
    const label = L.divIcon({ className: 'vertex-pin', html: `<span class="vertex-label ${index === 0 ? 'start' : ''}">${index + 1}</span>`, iconSize: index === 0 ? [29, 29] : [24, 24], iconAnchor: index === 0 ? [14.5, 14.5] : [12, 12] });
    const marker = dense ? L.circleMarker([p.lat, p.lon], { radius: 3.5, color: '#246bdf', weight: 1, fillColor: 'white', fillOpacity: 1, pmIgnore: true }) : L.marker([p.lat, p.lon], { icon: label, pmIgnore: true });
    marker.bindTooltip(tooltip(`${index === 0 ? 'Inicio · ' : ''}Punto ${index + 1} · clic para comenzar aquí`), { className: 'vertex-tooltip' });
    marker.on('click', (event) => {
      L.DomEvent.stopPropagation(event);
      if (state.editing || state.busy || state.issues.get(current.id)) return;
      settings().startId = p.id;
      applyOrder(true);
    });
    vertexLayers.addLayer(marker);
  });
}

function availableSectors() {
  const query = normalize(state.filters.search.trim());
  // La búsqueda abarca el archivo completo, aunque antes se eligiera una comuna.
  return state.sectors.filter((s) => query ? normalize(s.name).includes(query) : state.filters.commune === 'all' || s.commune === state.filters.commune).sort((a, b) => localeSort(a.name, b.name));
}
function addOption(select, value, text) { const option = document.createElement('option'); option.value = value; option.textContent = text; select.append(option); }

function renderSelector() {
  const list = availableSectors();
  if (!list.some((s) => s.id === state.selectedId)) { state.selectedId = list[0]?.id ?? null; state.ringIndex = 0; state.pending = false; }
  $('sector-select').replaceChildren();
  if (!list.length) addOption($('sector-select'), '', state.sectors.length ? 'Sin resultados' : '—');
  list.forEach((s) => addOption($('sector-select'), s.id, `${s.name} · ${s.rings.reduce((n, r) => n + r.points.length, 0)} puntos`));
  $('sector-select').value = state.selectedId || '';
  if (state.filters.search.trim()) state.filters.commune = selected()?.commune ?? 'all';
  $('commune-select').value = state.filters.commune;
  $('sector-count').textContent = `${list.length} de ${state.sectors.length} sectores`;
}

function updateEnabled() {
  const has = Boolean(selected()), editable = has && !state.busy && !state.editing;
  for (const id of ['start-point', 'direction', 'reorder-button', 'external-map', 'download-button', 'edit-boundary']) $(id).disabled = !editable;
  $('download-button').disabled ||= state.pending || Boolean(state.issues.get(state.selectedId));
  $('external-map').disabled ||= state.pending || Boolean(state.issues.get(state.selectedId));
  $('reorder-button').disabled ||= Boolean(state.issues.get(state.selectedId));
  $('edit-boundary').disabled = !has || state.busy;
  if (state.editing && !state.busy) $('edit-boundary').disabled = false;
  for (const id of ['commune-select', 'sector-select', 'sector-search', 'fit-map']) $(id).disabled = !state.sectors.length || state.busy || state.editing;
  $('sector-select').disabled ||= !has;
  for (const id of ['upload-button', 'demo-button', 'reset-filters']) $(id).disabled = state.busy || state.editing;
  $('undo-button').disabled = !has || !state.history.get(state.selectedId)?.length || state.editing || state.busy;
  document.querySelectorAll('[data-format]').forEach((button) => { button.disabled = !editable || state.pending; });
  $('cancel-edit').hidden = !state.editing;
  $('edit-boundary').innerHTML = `${icon(state.editing ? 'check' : 'edit')} ${state.editing ? 'Guardar cambios' : 'Ajustar límite'}`;
}

function renderDetails(fit = false) {
  const sector = selected(), currentRing = ring();
  $('empty-table').hidden = Boolean(sector);
  $('empty-table').querySelector('strong').textContent = state.sectors.length ? 'No encontramos ese sector' : 'Empieza con tu mapa';
  $('empty-table').querySelector('p').textContent = state.sectors.length ? 'Prueba otro nombre o número, cambia la comuna o limpia los filtros.' : 'Sube un KMZ o KML y encontrarás cada zona con sus coordenadas, sin escribir punto por punto.';
  $('demo-button').hidden = state.sectors.length > 0;
  $('reset-filters').hidden = !state.sectors.length;
  for (const id of ['table-scroll', 'table-footer']) $(id).hidden = !sector;
  $('demo-badge').hidden = !state.demo;
  $('start-point').replaceChildren(); $('ring-select').replaceChildren();
  $('ring-field').hidden = !sector || sector.rings.length === 1;
  const issue = state.issues.get(sector?.id);
  $('validation-warning').hidden = !issue || $('status-text').textContent.includes(issue);
  $('validation-warning').textContent = issue ? `${issue} Ajusta el límite antes de exportar.` : '';
  $('coordinates-body').replaceChildren();
  if (sector) {
    sector.rings.forEach((r, i) => addOption($('ring-select'), i, `${i + 1} · ${r.kind === 'outer' ? 'Exterior' : 'Interior (hueco)'} · ${r.points.length} puntos`));
    $('ring-select').value = state.ringIndex;
    const original = state.originals.get(sector.id).rings[state.ringIndex]?.points || [];
    const indices = new Map(original.map((p, i) => [p.id, i + 1]));
    const pointOptions = currentRing.points.map((p, i) => ({ id: p.id, index: indices.get(p.id), label: indices.has(p.id) ? `Punto ${indices.get(p.id)}` : `Nuevo punto ${i + 1}` })).sort((a, b) => (a.index ?? Infinity) - (b.index ?? Infinity));
    pointOptions.forEach((p) => addOption($('start-point'), p.id, p.label));
    $('start-point').value = settings().startId;
    $('direction').value = settings().direction;
    const fragment = document.createDocumentFragment();
    currentRing.points.forEach((p, i) => {
      const tr = document.createElement('tr');
      if (i === 0) tr.className = 'start-row';
      const pointCell = document.createElement('td'); pointCell.textContent = i + 1;
      if (i === 0) { const tag = document.createElement('span'); tag.className = 'start-tag'; tag.textContent = 'Inicio'; pointCell.append(tag); }
      tr.append(pointCell);
      [p.lat, p.lon].forEach((value) => { const cell = document.createElement('td'); cell.textContent = String(value); tr.append(cell); });
      fragment.append(tr);
    });
    $('coordinates-body').append(fragment);
    $('table-count').textContent = `${currentRing.points.length} puntos en este contorno${sector.rings.length > 1 ? ` · ${sector.rings.length} contornos en el sector` : ''}`;
    $('point-count').textContent = `${sector.rings.reduce((n, r) => n + r.points.length, 0)} puntos`;
    $('coordinates-subtitle').textContent = sector.name;
    $('map-subtitle').textContent = sector.name;
    $('table-scroll').scrollTop = 0;
  } else {
    addOption($('start-point'), '', '—');
    $('direction').value = 'cw';
    $('point-count').textContent = state.sectors.length ? 'Sin resultados' : 'Sin puntos';
    $('coordinates-subtitle').textContent = 'Se obtienen automáticamente del archivo.';
    $('map-subtitle').textContent = 'Elige una zona para revisar su límite.';
  }
  updateEnabled(); renderMap(fit); updateExportDescription();
  persistWorkspace();
}

function sectorIssue(sector) {
  return validateSector(sector);
}

function snapshot(sector) {
  const stack = state.history.get(sector.id) || [];
  stack.push({ rings: clone(sector.rings), controls: sector.rings.map((r) => [r.id, { startId: r.points[0].id, direction: signedArea(r.points) >= 0 ? 'ccw' : 'cw' }]) });
  if (stack.length > 20) stack.shift();
  state.history.set(sector.id, stack);
}

function discardPending() {
  if (!state.pending || !ring()) return;
  state.controls.set(ring().id, { startId: ring().points[0].id, direction: signedArea(ring().points) >= 0 ? 'ccw' : 'cw' });
  state.pending = false;
}

function loadSectors(sectors, filename, demo = false, warnings = [], ignored = 0) {
  closeDownload(); state.sectors = clone(sectors); state.originals = new Map(); state.controls = new Map(); state.history = new Map(); state.issues = new Map();
  state.filters = { commune: 'all', search: '' }; state.demo = demo; state.modified = false; state.pending = false; state.ringIndex = 0;
  state.sectors.forEach((sector) => {
    state.originals.set(sector.id, clone(sector));
    const issue = sectorIssue(sector); state.issues.set(sector.id, issue);
    if (issue) warnings.push(`${sector.name}: ${issue} Revisa su límite antes de exportar.`);
    sector.rings.forEach((r) => {
      const direction = issue ? (signedArea(r.points) >= 0 ? 'ccw' : 'cw') : 'cw';
      state.controls.set(r.id, { startId: r.points[0].id, direction });
      if (!issue) r.points = orderRing(r.points, r.points[0].id, direction);
    });
  });
  state.source = { filename, warnings: [...warnings], ignored };
  state.selectedId = state.sectors[0]?.id;
  renderSource();
  renderSelector(); renderDetails(false);
  map.fitBounds(allBounds(), { padding: [25, 25], maxZoom: 15, animate: false });
  persistWorkspace();
  const total = state.sectors.reduce((n, s) => n + s.rings.reduce((m, r) => m + r.points.length, 0), 0);
  status(`${state.sectors.length} sectores y ${total.toLocaleString('es-CL')} puntos cargados.${warnings.length || ignored ? ' Hay avisos de importación; revisa los detalles.' : ' Elige una zona para revisarla.'}`, warnings.length || ignored ? 'notice' : 'success');
}

function renderSource() {
  const { filename, warnings, ignored } = state.source;
  $('commune-select').replaceChildren(); addOption($('commune-select'), 'all', 'Todas las comunas');
  [...new Set(state.sectors.map((s) => s.commune))].sort(localeSort).forEach((c) => addOption($('commune-select'), c, c));
  $('commune-select').value = state.filters.commune; $('sector-search').value = state.filters.search;
  $('file-name').textContent = filename; $('file-name').title = filename; $('file-name').hidden = false;
  $('upload-button').innerHTML = `${icon('upload')} ${state.demo ? 'Subir KMZ' : 'Cambiar KMZ'}`;
  $('import-warnings').hidden = warnings.length === 0 && ignored === 0;
  $('import-warnings').open = false;
  $('warnings-title').textContent = `${warnings.length} ${warnings.length === 1 ? 'aviso al cargar el archivo' : 'avisos al cargar el archivo'}${ignored ? ` · ${ignored} elemento(s) de puntos o líneas omitidos` : ''}. Ver detalles`;
  $('warnings-list').replaceChildren(); warnings.forEach((message) => { const li = document.createElement('li'); li.textContent = message; $('warnings-list').append(li); });
}

function selectionStatus() {
  const sector = selected();
  if (!sector) { status('No encontramos sectores con estos filtros. Prueba otra búsqueda o limpia los filtros.', 'notice'); return; }
  const issue = state.issues.get(sector.id);
  status(issue ? `${sector.name}: ${issue} Ajusta el límite antes de descargar.` : `${sector.name}: ${ring().points.length} puntos en el contorno seleccionado.`, issue ? 'notice' : 'success');
}

function selectSector(id, fromMap = false) {
  discardPending(); closeDownload(); state.selectedId = id; state.ringIndex = 0; state.pending = false;
  if (fromMap) { state.filters = { commune: selected()?.commune ?? 'all', search: '' }; $('sector-search').value = ''; }
  renderSelector(); renderDetails(true);
  selectionStatus();
}

function applyOrder(clickedPoint = false) {
  const sector = selected(); if (!sector || state.editing) return;
  try {
    const ordered = orderRing(ring().points, settings().startId, settings().direction);
    snapshot(sector); ring().points = ordered; state.pending = false;
    state.modified = true;
    renderDetails(false);
    status(`${sector.name}: lista reordenada en sentido ${settings().direction === 'cw' ? 'horario' : 'antihorario'}.${clickedPoint ? ' El punto elegido ahora es el número 1.' : ''}`);
  } catch (error) { status(error.message, 'error'); }
}

function openDownload() {
  if ($('download-button').disabled) return;
  $('download-popover').hidden = false; $('download-button').setAttribute('aria-expanded', 'true'); updateExportDescription();
  $('export-scope').focus();
}
function closeDownload(focus = false) {
  const wasOpen = !$('download-popover').hidden;
  $('download-popover').hidden = true; $('download-button').setAttribute('aria-expanded', 'false');
  if (focus && wasOpen) $('download-button').focus();
}
function exportSectors() {
  const sector = selected(); if (!sector) return [];
  if ($('export-scope').value === 'all') return state.sectors;
  if ($('export-scope').value === 'commune') return state.sectors.filter((s) => s.commune === sector.commune);
  return [sector];
}
function updateExportDescription() {
  const group = exportSectors();
  $('download-description').textContent = group.length === 1 ? `${group[0].name} · ${group[0].rings.reduce((n, r) => n + r.points.length, 0)} puntos` : `${group.length} sectores · ${group.reduce((n, s) => n + s.rings.reduce((m, r) => m + r.points.length, 0), 0)} puntos`;
}

async function exportFormat(format) {
  const group = exportSectors(); if (!group.length || state.editing || state.pending || state.busy) return;
  const invalid = group.find((s) => state.issues.get(s.id));
  if (invalid) { status(`Revisa ${invalid.name}: ${state.issues.get(invalid.id)} No se ha descargado un archivo parcial.`, 'error'); closeDownload(true); return; }
  const basename = safeFilename(group.length === 1 ? group[0].name : $('export-scope').value === 'commune' ? group[0].commune : 'sectores-del-archivo');
  state.busy = true; closeDownload(); updateEnabled(); status('Preparando la descarga…');
  try {
    if (format === 'xlsx') downloadBlob(await excelBuffer(group), `${basename}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    else if (format === 'csv') downloadBlob(toCSV(group), `${basename}.csv`, 'text/csv;charset=utf-8');
    else downloadBlob(JSON.stringify(toGeoJSON(group), null, 2), `${basename}.geojson`, 'application/geo+json;charset=utf-8');
    status(`Descarga preparada: ${basename}.${format === 'xlsx' ? 'xlsx' : format}. ${group.length} sector(es) incluidos.`);
  } catch (error) { console.error(error); status('No se pudo preparar la descarga. Intenta de nuevo.', 'error'); }
  finally { state.busy = false; updateEnabled(); }
}

function beginEdit() {
  if (!selectedLayer || state.busy) return;
  discardPending(); closeDownload();
  try {
    selectedLayer.pm.enable({ allowSelfIntersection: false, preventMarkerRemoval: false, hideMiddleMarkers: false, snapDistance: 15, snappable: false });
  } catch (error) {
    console.error(error); selectedLayer.pm?.disable(); renderMap(false);
    status('No se pudo activar el ajuste del límite. Vuelve a seleccionar el sector e intenta de nuevo.', 'error');
    return;
  }
  state.editing = true; vertexLayers.clearLayers();
  selectedLayer.on('pm:markerdragend pm:vertexadded pm:vertexremoved', persistWorkspace);
  updateEnabled();
  $('map-help').textContent = 'Arrastra los vértices para moverlos. Los puntos intermedios añaden vértices; un clic elimina uno. Guarda o cancela el ajuste.';
  status('Ajustando el límite: guarda los cambios para actualizar las coordenadas, o cancela para conservar el sector.', 'notice');
  persistWorkspace();
}

function finishEdit(save) {
  const sector = selected(); if (!sector || !state.editing) return;
  if (save) {
    const coordinates = selectedLayer.getLatLngs();
    if (coordinates.length !== sector.rings.length) { status('No se pudo reconocer la estructura del polígono. Cancela y vuelve a intentar.', 'error'); return; }
    const rings = sector.rings.map((r, ringIndex) => {
      const used = new Set();
      return { ...r, points: coordinates[ringIndex].map((p, i) => {
        const unchanged = r.points.find((old) => !used.has(old.id) && old.lat === p.lat && old.lon === p.lng);
        const id = unchanged?.id || (coordinates[ringIndex].length === r.points.length && !used.has(r.points[i]?.id) ? r.points[i].id : `${r.id}:new:${crypto.randomUUID()}`);
        used.add(id); return { id, lat: p.lat, lon: p.lng };
      }) };
    });
    const candidate = { ...sector, rings };
    const issue = sectorIssue(candidate);
    if (issue) { status(`${issue} Corrige el límite o cancela el ajuste.`, 'error'); return; }
    snapshot(sector); sector.rings = rings;
    rings.forEach((r) => { const control = state.controls.get(r.id); if (!r.points.some((p) => p.id === control.startId)) control.startId = r.points[0].id; r.points = orderRing(r.points, control.startId, control.direction); });
    state.issues.set(sector.id, null); state.modified = true;
  }
  selectedLayer.pm.disable(); state.editing = false; state.pending = false;
  renderSelector(); renderDetails(false);
  $('map-help').textContent = 'Haz clic en una zona para seleccionarla, o en uno de sus puntos para comenzar la lista allí.';
  status(save ? `${sector.name}: límite actualizado.` : 'Ajuste cancelado. Se conservó el límite anterior.');
}

$('upload-button').addEventListener('click', () => $('file-input').click());
$('file-input').addEventListener('change', async (event) => {
  const file = event.target.files[0]; event.target.value = ''; if (!file || state.busy || state.editing) return;
  state.busy = true; closeDownload(); updateEnabled(); status(`Leyendo ${file.name}…`);
  try { const { sectors, warnings, ignored } = await readMapFile(file); loadSectors(sectors, file.name, false, warnings, ignored); }
  catch (error) { console.error(error); status(`${error.message} ${state.sectors.length ? 'El archivo anterior sigue disponible.' : ''}`, 'error'); }
  finally { state.busy = false; updateEnabled(); }
});
$('demo-button').addEventListener('click', () => loadSectors(demoSectors(), 'Demostración · 3 sectores', true));
$('commune-select').addEventListener('change', () => { discardPending(); state.filters.commune = $('commune-select').value; state.filters.search = ''; $('sector-search').value = ''; renderSelector(); renderDetails(true); closeDownload(); selectionStatus(); });
$('sector-search').addEventListener('input', () => { discardPending(); state.filters.search = $('sector-search').value; state.filters.commune = 'all'; renderSelector(); renderDetails(true); closeDownload(); selectionStatus(); });
$('reset-filters').addEventListener('click', () => { discardPending(); state.filters = { commune: 'all', search: '' }; $('sector-search').value = ''; renderSelector(); renderDetails(true); closeDownload(); selectionStatus(); $('sector-search').focus(); });
$('sector-select').addEventListener('change', () => selectSector($('sector-select').value));
$('ring-select').addEventListener('change', () => { discardPending(); state.ringIndex = Number($('ring-select').value); renderDetails(false); closeDownload(); });
for (const [id, key] of [['start-point', 'startId'], ['direction', 'direction']]) $(id).addEventListener('change', () => { settings()[key] = $(id).value; state.pending = true; closeDownload(); updateEnabled(); status('Pulsa Reordenar para aplicar el punto inicial y el sentido elegidos.', 'notice'); persistWorkspace(); });
$('reorder-button').addEventListener('click', () => applyOrder());
$('download-button').addEventListener('click', () => $('download-popover').hidden ? openDownload() : closeDownload(true));
$('close-download').addEventListener('click', () => closeDownload(true));
$('export-scope').addEventListener('change', () => { updateExportDescription(); persistWorkspace(); });
document.querySelectorAll('[data-format]').forEach((button) => button.addEventListener('click', () => exportFormat(button.dataset.format)));
document.addEventListener('click', (event) => { if (!event.target.closest('.download-wrap')) closeDownload(); });
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeDownload(true);
  // Mantener el foco en el popup mientras está abierto.
  if (event.key === 'Tab' && !$('download-popover').hidden) {
    const focusable = Array.from($('download-popover').querySelectorAll('button, select')).filter((el) => !el.disabled);
    const first = focusable[0], last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
});
$('external-map').addEventListener('click', () => {
  const sector = selected(); if (!sector) return;
  const url = geojsonIoUrl(sector);
  if (url.length > 8000) {
    downloadBlob(JSON.stringify(toGeoJSON([sector]), null, 2), `${safeFilename(sector.name)}.geojson`, 'application/geo+json');
    status('El sector supera el tamaño preventivo del enlace. Se descargó el GeoJSON; arrástralo a geojson.io.', 'notice');
    window.open('https://geojson.io/', '_blank', 'noopener,noreferrer');
  } else window.open(url, '_blank', 'noopener,noreferrer');
});
$('fit-map').addEventListener('click', () => map.fitBounds(allBounds(), { padding: [25, 25], animate: false }));
$('edit-boundary').addEventListener('click', () => state.editing ? finishEdit(true) : beginEdit());
$('cancel-edit').addEventListener('click', () => finishEdit(false));
$('undo-button').addEventListener('click', () => {
  const sector = selected(), entry = state.history.get(sector?.id)?.pop(); if (!entry) return;
  sector.rings = entry.rings; entry.controls.forEach(([id, control]) => state.controls.set(id, control));
  state.issues.set(sector.id, sectorIssue(sector)); state.pending = false;
  renderSelector(); renderDetails(false); status(`${sector.name}: se deshizo el último ajuste.`);
});
$('help-button').addEventListener('click', () => $('help-dialog').showModal());
$('close-help').addEventListener('click', () => $('help-dialog').close());
window.addEventListener('beforeunload', (event) => { if (!resettingWorkspace && (pendingWrites || persistenceFailed && state.sectors.length)) { event.preventDefault(); event.returnValue = ''; } });

async function resetWorkspace() {
  resettingWorkspace = true; state.busy = true; updateEnabled();
  try {
    // Terminar las escrituras anteriores antes de borrar: ninguna debe volver
    // a guardar los datos después del reinicio.
    await writeQueue;
    await workspaceStore.clear();
    window.location.reload();
  } catch (error) {
    console.error(error); resettingWorkspace = false; state.busy = false; updateEnabled();
    status('No se pudieron reiniciar los datos. Intenta de nuevo.', 'error');
  }
}
document.addEventListener('keydown', (event) => {
  if (!isWorkspaceResetShortcut(event)) return;
  // Esperar al borrado antes de recargar; la navegación nativa podría abortarlo.
  event.preventDefault();
  if (!resettingWorkspace) resetWorkspace();
}, true);

async function restoreWorkspace() {
  try {
    const saved = await workspaceStore.load();
    if (!saved || resettingWorkspace) return;
    Object.assign(state, {
      sectors: saved.sectors, originals: new Map(saved.originals), controls: new Map(saved.controls), history: new Map(saved.history),
      selectedId: saved.selectedId, ringIndex: saved.ringIndex, filters: saved.filters, pending: saved.pending,
      demo: saved.demo, modified: saved.modified, source: saved.source,
      issues: new Map(saved.sectors.map((sector) => [sector.id, sectorIssue(sector)])),
    });
    $('export-scope').value = saved.exportScope;
    renderSource(); renderSelector(); renderDetails(false);
    map.setView([saved.view.lat, saved.view.lon], saved.view.zoom, { animate: false });
    if (saved.pending) status('Pulsa Reordenar para aplicar el punto inicial y el sentido elegidos.', 'notice');
    else selectionStatus();
    if (saved.draft && selectedLayer) {
      selectedLayer.setLatLngs(saved.draft.coordinates);
      state.busy = false;
      beginEdit();
    }
  } catch (error) {
    console.error(error); persistenceFailed = true;
    status('No se pudieron recuperar los datos guardados. Vuelve a cargar tu archivo.', 'notice');
  } finally { restoringWorkspace = false; if (!resettingWorkspace) state.busy = false; updateEnabled(); }
}
updateEnabled();
restoreWorkspace();
