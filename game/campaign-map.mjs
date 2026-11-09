import lakeMap from './lake-map-data.mjs';
export const mapCells = lakeMap.cells;
export const firstShoreHole = mapCells.find((cell) => cell.area === 'starter-shore').id;
const map = document.createElement('dialog');
map.className = 'fishing-picker fishing-map';
map.setAttribute('aria-labelledby', 'lake-map-title');
map.innerHTML = `<h2 id="lake-map-title">Campaign · Mille Lacs</h2>
  <p>Choose a spot to check the water. You can return to a hole you opened today.</p>
  <p data-map-allowance role="status"></p>
  <div class="fishing-map-overlays"><label><input type="checkbox" data-map-depth checked> Depth</label>
  <label><input type="checkbox" data-map-temperature> Temperature</label></div>
  <div class="fishing-map-layout"><div class="fishing-map-water" role="group" aria-label="Mille Lacs water cells">
    <img src="./assets/maps/mille-lacs.svg" alt="Mille Lacs shoreline and depth contours, north at the top" width="500" height="500">
    <div class="fishing-map-cells">${mapCells.map((cell) => `<button type="button" data-map-cell="${cell.id}" style="left:${cell.x / 5}%;top:${cell.y / 5}%"></button>`).join('')}</div></div>
    <section class="fishing-map-inspector" aria-labelledby="map-hole-title"><h3 id="map-hole-title"></h3><p data-map-info></p><p data-map-permit></p><p data-map-fish></p><p data-map-budget></p></section></div>
  <p data-map-legend>Depth in feet: light cells 5–15 ft; medium 20–25 ft; dark 30–35 ft.</p>
  <p class="fishing-map-note">Depths rounded from Minnesota DNR contours. Temperature and likely fish are gameplay estimates.</p>
  <p data-map-message role="status"></p>
  <div class="fishing-map-actions"><button type="button" data-map-back>Back</button><button type="button" data-map-end>End day</button><button type="button" data-map-drill>Drill hole</button></div>
  <small>Bathymetry © Minnesota Department of Natural Resources. Simplified for gameplay; not for navigation.
    <a href="https://www.dnr.state.mn.us/sitetools/data_software_license.html" target="_blank" rel="noopener">Data terms</a></small>`;
const drill = document.createElement('dialog');
drill.className = 'fishing-picker fishing-drill';
drill.setAttribute('aria-labelledby', 'drill-title');
drill.innerHTML = `<h2 id="drill-title">Drill the hole</h2><p data-drill-hole></p>
  <div class="fishing-auger-scene"><img src="./assets/branding/bryan-front-facing.webp" alt="Bryan beside the auger">
  <svg viewBox="0 0 160 180" role="img" aria-label="Hand auger opening the ice"><path d="M35 27H115V43M76 27V153" stroke="#e2bc77" stroke-width="10" fill="none"/><path class="auger-bit" d="M58 62Q105 72 58 88Q105 98 58 114Q105 124 66 145" stroke="#9bdce4" stroke-width="12" fill="none"/><ellipse cx="76" cy="158" rx="55" ry="13" fill="#102d3d" stroke="#dceff0" stroke-width="6"/></svg></div>
  <progress value="0" aria-label="Drilling progress"></progress><p data-drill-progress role="status"></p>
  <p data-map-message role="status"></p>
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
  requiredTurns,
  saving = false,
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
  const { allowance, opened } = context.day;
  const remaining = allowance - opened.length;
  const accessible = context.hasAccess(cell.area);
  const alreadyOpen = opened.includes(cell.id);
  const temperature = map.querySelector('[data-map-temperature]').checked;
  const depth = map.querySelector('[data-map-depth]').checked;
  for (const button of map.querySelectorAll('[data-map-cell]')) {
    const c = mapCells.find((c) => c.id === button.dataset.mapCell);
    const owned = context.hasAccess(c.area);
    button.setAttribute(
      'aria-label',
      `${c.id}, ${c.habitat}, ${c.depthFt} ft${temperature ? `, ${c.temperatureF} °F` : ''}, ${owned ? 'permit owned' : 'permit required'}${opened.includes(c.id) ? ', hole open' : ''}`,
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
    button.toggleAttribute('data-hole-open', opened.includes(c.id));
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
  map.querySelector('[data-map-allowance]').textContent = `${remaining} of ${allowance} new holes available today.`;
  const open = map.querySelector('[data-map-drill]');
  open.disabled = accessible && !alreadyOpen && !remaining;
  open.textContent = !accessible ? 'Check permit' : alreadyOpen ? 'Fish this hole' : 'Drill hole';
  map.querySelector('[data-map-message]').textContent = open.disabled
    ? 'You’ve opened all your new holes for today. Return to a marked hole or end the day.'
    : '';
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
  if (!b || saving) return;
  selected = b.dataset.mapCell;
  context.onSelect?.(selected);
  drawMap();
});
map.addEventListener('keydown', (e) => {
  if (
    saving || !e.target.matches('[data-map-cell]') ||
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
map.querySelectorAll('input').forEach((input) => input.addEventListener('change', () => { if (!saving) drawMap(); }));
function back() {
  if (saving) return;
  map.close();
  context.onBack();
}
map.addEventListener('cancel', (e) => {
  e.preventDefault();
  back();
});
map.querySelector('[data-map-back]').onclick = back;
map.querySelector('[data-map-end]').onclick = () => void save(map, { type: 'end-day' }, context.onEnd);
map.querySelector('[data-map-drill]').onclick = () => {
  if (saving) return;
  const cell = mapCells.find((c) => c.id === selected);
  if (!context.hasAccess(cell.area)) {
    map.close();
    return context.onPermit(cell);
  }
  if (context.day.opened.includes(cell.id)) return void openHole(map, cell);
  map.close();
  // Give each cell a consistent gameplay resistance.
  requiredTurns = 4 + cell.depthFt / 5;
  turns = 0;
  drill.querySelector('progress').max = requiredTurns;
  drill.querySelector('[data-map-message]').textContent = '';
  showDrillProgress();
  drill.querySelector('[data-drill-hole]').textContent = `${cell.id} · ${cell.habitat} · ${cell.depthFt} ft`;
  drill.showModal();
  drill.querySelector('[data-drill-turn]').focus();
};

async function save(surface, command, next) {
  if (saving) return;
  saving = true;
  surface.setAttribute('aria-busy', 'true');
  const message = surface.querySelector('[data-map-message]');
  message.textContent = 'Saving…';
  try {
    const { status, profile } = await context.save({ ...command, dayId: context.day.id });
    if (status === 'stale-day') {
      surface.close();
      context.onStale();
    } else if (['hole-opened', 'hole-current', 'day-ended'].includes(status)) {
      surface.close();
      next();
    } else {
      context.day = profile.day;
      if (surface === drill) {
        drill.close();
        openCampaignMap({ ...context, selected });
      } else drawMap();
      if (status !== 'daily-limit') {
        map.querySelector('[data-map-message]').textContent = status === 'permit-required'
          ? 'Check the permit for this spot before fishing here.'
          : 'Couldn’t open this spot. Choose a spot and try again.';
      }
    }
  } catch {
    message.textContent = command.type === 'end-day'
      ? 'Couldn’t end the day. Try again.'
      : 'Couldn’t save this hole. Try again.';
  } finally {
    surface.removeAttribute('aria-busy');
    saving = false;
  }
}

function openHole(surface, cell) {
  return save(surface, { type: 'open-hole', cellId: cell.id }, () => context.onFish(cell));
}

function finish() {
  void openHole(drill, mapCells.find((c) => c.id === selected));
}
function showDrillProgress() {
  drill.querySelector('progress').value = turns;
  drill.querySelector('[data-drill-progress]').textContent = `${turns} of ${requiredTurns} turns`;
  drill.style.setProperty('--auger-turn', `${turns === 0 ? 0 : turns % 2 ? 12 : -12}deg`);
  drill.style.setProperty('--auger-depth', `${8 * turns / requiredTurns}px`);
}
drill.querySelector('[data-drill-turn]').onclick = () => {
  if (saving) return;
  turns = Math.min(requiredTurns, turns + 1);
  showDrillProgress();
  if (turns === requiredTurns) finish();
};
drill.querySelector('[data-drill-skip]').onclick = finish;
function backToMap() {
  if (saving) return;
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
    : 'Give up this fish and spend this attempt? The fish already bit.';
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
