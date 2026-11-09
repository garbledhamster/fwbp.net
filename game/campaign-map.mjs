import lakeMap from './lake-map-data.mjs';
export const mapCells = lakeMap.cells;
export const firstShoreHole = mapCells.find((cell) => cell.area === 'starter-shore').id;
const map = document.createElement('dialog');
map.className = 'fishing-picker fishing-map';
map.setAttribute('aria-labelledby', 'lake-map-title');
map.innerHTML = `<h2 id="lake-map-title">Campaign · Mille Lacs</h2>
  <p>Choose a hole. Moving uses no attempt until you jig.</p>
  <div class="fishing-map-overlays"><label><input type="checkbox" data-map-depth checked> Depth</label>
  <label><input type="checkbox" data-map-temperature> Temperature</label></div>
  <div class="fishing-map-layout"><div class="fishing-map-water" role="group" aria-label="Mille Lacs water cells">
    <img src="./assets/maps/mille-lacs.svg" alt="Mille Lacs shoreline and depth contours, north at the top" width="500" height="500">
    <div class="fishing-map-cells">${mapCells.map((cell) => `<button type="button" data-map-cell="${cell.id}" style="left:${cell.x / 5}%;top:${cell.y / 5}%"></button>`).join('')}</div></div>
    <section class="fishing-map-inspector" aria-labelledby="map-hole-title"><h3 id="map-hole-title"></h3><p data-map-info></p><p data-map-permit></p><p data-map-fish></p><p data-map-budget></p></section></div>
  <p data-map-legend>Depth in feet: light cells 5–15 ft; medium 20–25 ft; dark 30–35 ft.</p>
  <p class="fishing-map-note">Depths rounded from Minnesota DNR contours. Temperature and likely fish are gameplay estimates.</p>
  <div class="fishing-map-actions"><button type="button" data-map-back>Back</button><button type="button" data-map-drill>Drill hole</button></div>
  <small>Bathymetry © Minnesota Department of Natural Resources. Simplified for gameplay; not for navigation.
    <a href="https://www.dnr.state.mn.us/sitetools/data_software_license.html" target="_blank" rel="noopener">Data terms</a></small>`;
const drill = document.createElement('dialog');
drill.className = 'fishing-picker fishing-drill';
drill.setAttribute('aria-labelledby', 'drill-title');
drill.innerHTML = `<h2 id="drill-title">Drill the hole</h2><p data-drill-hole></p>
  <div class="fishing-auger-scene"><img src="./assets/branding/bryan-front-facing.webp" alt="Bryan beside the auger">
  <svg viewBox="0 0 160 180" role="img" aria-label="Hand auger opening the ice"><path d="M35 27H115V43M76 27V153" stroke="#e2bc77" stroke-width="10" fill="none"/><path class="auger-bit" d="M58 62Q105 72 58 88Q105 98 58 114Q105 124 66 145" stroke="#9bdce4" stroke-width="12" fill="none"/><ellipse cx="76" cy="158" rx="55" ry="13" fill="#102d3d" stroke="#dceff0" stroke-width="6"/></svg></div>
  <progress max="8" value="0" aria-label="Drilling progress"></progress><p data-drill-progress role="status">0 of 8 turns</p>
  <div class="fishing-map-actions"><button type="button" data-drill-turn>Drill · press repeatedly</button><button type="button" data-drill-skip>Skip drilling</button><button type="button" data-drill-back>Back to map</button></div>`;
const confirm = document.createElement('dialog');
confirm.className = 'fishing-picker fishing-end-attempt';
confirm.setAttribute('aria-labelledby', 'end-attempt-title');
confirm.innerHTML =
  '<h2 id="end-attempt-title">End this attempt?</h2><p data-end-message></p><button type="button" data-end-confirm>End attempt</button> <button type="button" data-end-cancel>Keep fishing</button>';
document.body.append(map, drill, confirm);
let context,
  selected = firstShoreHole,
  turns = 0,
  confirmCallback;
const names = {
  perch: 'Yellow perch',
  pike: 'Northern pike',
  'rock-bass': 'Rock bass',
  walleye: 'Walleye',
  smallmouth: 'Smallmouth bass',
  muskie: 'Muskie',
};
function drawMap() {
  const cell = mapCells.find((c) => c.id === selected);
  const temperature = map.querySelector('[data-map-temperature]').checked;
  const depth = map.querySelector('[data-map-depth]').checked;
  for (const button of map.querySelectorAll('[data-map-cell]')) {
    const c = mapCells.find((c) => c.id === button.dataset.mapCell);
    const owned = context.hasAccess(c.area);
    button.textContent = c.id;
    button.setAttribute(
      'aria-label',
      `${c.id}, ${c.habitat}, ${c.depthFt} ft${temperature ? `, ${c.temperatureF} °F` : ''}, ${owned ? 'permit owned' : 'permit required'}`,
    );
    button.setAttribute('aria-pressed', String(c.id === selected));
    button.dataset.depth = depth
      ? c.depthFt <= 15
        ? 'shallow'
        : c.depthFt <= 25
          ? 'middle'
          : 'deep'
      : 'off';
    button.dataset.temperature = temperature ? String(c.temperatureF) : 'off';
    button.toggleAttribute('data-locked', !owned);
  }
  map.querySelector('#map-hole-title').textContent = `${cell.id} · ${cell.habitat}`;
  map.querySelector('[data-map-info]').textContent =
    `${cell.depthFt} ft deep · ${cell.temperatureF} °F modeled water`;
  map.querySelector('[data-map-permit]').textContent =
    `${cell.area === 'starter-shore' ? 'Starter Shore' : 'Deep Reef'} permit · ${context.hasAccess(cell.area) ? 'Owned' : 'Required'}`;
  map.querySelector('[data-map-fish]').textContent =
    `Likely fish: ${cell.likely.map((id) => names[id]).join(', ')}.`;
  map.querySelector('[data-map-budget]').textContent =
    context.budget === undefined
      ? 'Six encounters in this outing.'
      : `${context.budget} of 6 encounters remain. Your rig and clock carry across holes.`;
  map.querySelector('[data-map-drill]').textContent = context.opened?.includes(cell.id)
    ? 'Fish this hole'
    : context.hasAccess(cell.area)
      ? 'Drill hole'
      : 'Check permit';
  map.querySelector('[data-map-legend]').textContent = [
    depth ? 'Depth: light 5–15 ft · medium 20–25 ft · dark 30–35 ft.' : '',
    temperature ? 'Temperature: cyan 35 °F → violet 38 °F (modeled).' : '',
  ]
    .filter(Boolean)
    .join(' ');
}
export function openCampaignMap(options) {
  context = options;
  selected = options.selected ?? selected;
  drawMap();
  map.showModal();
  map.querySelector(`[data-map-cell="${selected}"]`).focus();
}
map.addEventListener('click', (e) => {
  const b = e.target.closest('[data-map-cell]');
  if (!b) return;
  selected = b.dataset.mapCell;
  context.onSelect?.(selected);
  drawMap();
  const cell = mapCells.find((c) => c.id === selected);
  if (!context.hasAccess(cell.area)) {
    map.close();
    context.onPermit(cell);
  }
});
map.addEventListener('keydown', (e) => {
  if (
    !e.target.matches('[data-map-cell]') ||
    !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)
  )
    return;
  e.preventDefault();
  const current = mapCells.find((c) => c.id === selected);
  const vertical = ['ArrowUp', 'ArrowDown'].includes(e.key);
  const sign = ['ArrowUp', 'ArrowLeft'].includes(e.key) ? -1 : 1;
  const next = mapCells
    .filter((c) => sign * ((vertical ? c.y : c.x) - (vertical ? current.y : current.x)) > 1)
    .sort((a, b) => {
      const distance = (c) =>
        Math.abs((vertical ? c.y : c.x) - (vertical ? current.y : current.x)) +
        Math.abs((vertical ? c.x : c.y) - (vertical ? current.x : current.y)) * 4;
      return distance(a) - distance(b);
    })[0];
  if (next) {
    selected = next.id;
    context.onSelect?.(selected);
    drawMap();
    map.querySelector(`[data-map-cell="${selected}"]`).focus();
  }
});
map.querySelectorAll('input').forEach((input) => input.addEventListener('change', drawMap));
function back() {
  map.close();
  context.onBack();
}
map.addEventListener('cancel', (e) => {
  e.preventDefault();
  back();
});
map.querySelector('[data-map-back]').onclick = back;
map.querySelector('[data-map-drill]').onclick = () => {
  const cell = mapCells.find((c) => c.id === selected);
  map.close();
  if (!context.hasAccess(cell.area)) return context.onPermit(cell);
  if (context.opened?.includes(cell.id)) return context.onOpen(cell);
  turns = 0;
  drill.querySelector('progress').value = 0;
  drill.querySelector('[data-drill-progress]').textContent = '0 of 8 turns';
  drill.querySelector('[data-drill-hole]').textContent = `${cell.id} · ${cell.habitat} · ${cell.depthFt} ft`;
  drill.showModal();
  drill.querySelector('[data-drill-turn]').focus();
};
function finish() {
  drill.close();
  context.onOpen(mapCells.find((c) => c.id === selected));
}
drill.querySelector('[data-drill-turn]').onclick = () => {
  turns++;
  drill.querySelector('progress').value = turns;
  drill.querySelector('[data-drill-progress]').textContent = `${turns} of 8 turns`;
  drill.style.setProperty('--auger-turn', `${turns % 2 ? 12 : -12}deg`);
  if (turns === 8) finish();
};
drill.querySelector('[data-drill-skip]').onclick = finish;
function backToMap() {
  drill.close();
  openCampaignMap({ ...context, selected });
}
drill.querySelector('[data-drill-back]').onclick = backToMap;
drill.addEventListener('cancel', (e) => {
  e.preventDefault();
  backToMap();
});
export function confirmEndAttempt(fighting, onConfirm, onCancel) {
  confirmCallback = { onConfirm, onCancel };
  confirm.querySelector('[data-end-message]').textContent = fighting
    ? 'Release this fish and spend this attempt? The fish earns no catch reward.'
    : 'Give up this fish and spend this attempt? Your first jig started it.';
  confirm.querySelector('[data-end-confirm]').textContent = fighting ? 'Release fish' : 'End attempt';
  confirm.showModal();
  confirm.querySelector('[data-end-cancel]').focus();
}
confirm.querySelector('[data-end-confirm]').onclick = () => {
  confirm.close();
  confirmCallback.onConfirm();
};
function cancelConfirm() {
  confirm.close();
  confirmCallback.onCancel();
}
confirm.querySelector('[data-end-cancel]').onclick = cancelConfirm;
confirm.addEventListener('cancel', (e) => {
  e.preventDefault();
  cancelConfirm();
});
