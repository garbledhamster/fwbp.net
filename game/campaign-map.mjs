import lakeMap from './lake-map-data.mjs';
import { collectibleSpecies } from './species-catalog.mjs';
export const mapCells = lakeMap.cells;
export const firstShoreHole = mapCells.find((cell) => cell.area === 'starter-shore').id;
const map = document.createElement('dialog');
map.className = 'fishing-picker fishing-map';
map.setAttribute('aria-labelledby', 'lake-map-title');
const lockMark = '<span class="fishing-map-lock-mark" aria-hidden="true"><svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3.5" y="7" width="9" height="7" rx="1"/><path d="M5.5 7V4.5a2.5 2.5 0 0 1 5 0V7"/></svg></span>';
map.innerHTML = `<div class="fishing-map-scroll">
  <header class="fishing-map-heading">
    <h2 id="lake-map-title">Campaign · Mille Lacs</h2>
    <button type="button" data-map-help aria-haspopup="dialog" aria-controls="map-help">
      <img src="./assets/branding/bryan-headshot.webp" alt="" width="38" height="40"> Ask Bryan
    </button>
  </header>
  <div class="fishing-map-tools">
    <fieldset class="fishing-map-overlays"><legend>Map layer</legend>
      <label><input type="radio" name="map-layer" data-map-depth checked> Depth</label>
      <label><input type="radio" name="map-layer" data-map-temperature> Temperature</label>
    </fieldset>
    <div data-map-legend>
      <ul data-depth-legend aria-label="Depth legend">
        <li><span data-depth="shallow" aria-hidden="true"></span>10–15 ft</li>
        <li><span data-depth="middle" aria-hidden="true"></span>16–25 ft</li>
        <li><span data-depth="deep" aria-hidden="true"></span>26–35 ft</li>
      </ul>
      <ul data-temperature-legend aria-label="Water temperature legend" hidden>
        <li><span data-temperature="35" aria-hidden="true"></span>35 °F</li>
        <li><span data-temperature="36" aria-hidden="true"></span>36 °F</li>
        <li><span data-temperature="37" aria-hidden="true"></span>37 °F</li>
        <li><span data-temperature="38" aria-hidden="true"></span>38 °F</li>
      </ul>
    </div>
    <ul class="fishing-map-markers fishing-map-access-key" aria-label="Spot access legend">
      <li><span class="fishing-map-unlocked-mark" aria-hidden="true"></span>Unlocked</li>
      <li>${lockMark}Locked · permit needed</li>
    </ul>
    <p data-map-info></p>
  </div>
  <div class="fishing-map-layout"><div class="fishing-map-water" role="group" aria-label="Mille Lacs water cells">
    <img src="./assets/maps/mille-lacs.svg" alt="Mille Lacs shoreline and depth contours, north at the top" width="500" height="500">
    <div class="fishing-map-cells">${mapCells.map((cell) => `<button type="button" data-map-cell="${cell.id}" style="left:${cell.x / 5}%;top:${cell.y / 5}%">${cell.id}${lockMark}</button>`).join('')}</div></div>
    <section class="fishing-map-inspector" aria-labelledby="map-hole-title"><h3 id="map-hole-title"></h3>
      <p data-map-permit><strong data-map-access-label></strong> <span data-map-permit-name></span></p><p data-map-fish></p>
      <p data-map-history hidden>Past catch here. See Your Lake for your catch history.</p><p data-map-budget></p>
      <ul class="fishing-map-markers" aria-label="Map markers">
        <li><span class="fishing-map-open-mark" aria-hidden="true"></span>Open hole today</li>
        <li><span class="fishing-map-past-mark" aria-hidden="true"></span>Past catch</li>
      </ul>
      <p data-map-goal></p>
    </section>
  </div>
  <p class="fishing-map-note">Depths are rounded from Minnesota DNR contours. Near-bottom temperatures are game estimates.</p>
  <small>Bathymetry © Minnesota Department of Natural Resources. Simplified for gameplay only.
    <a href="https://www.dnr.state.mn.us/sitetools/data_software_license.html" target="_blank" rel="noopener">Data terms</a></small>
  </div>
  <div class="fishing-map-actions">
    <div class="fishing-map-plan">
      <p data-map-message role="status"></p>
      <p data-map-allowance role="status"></p>
    </div>
    <button type="button" data-map-back>Back</button>
    <button type="button" data-map-end>End day</button>
    <button type="button" data-map-drill>Drill hole</button>
  </div>`;
const help = document.createElement('dialog');
help.id = 'map-help';
help.className = 'fishing-picker fishing-frame fishing-map-help';
help.setAttribute('aria-labelledby', 'map-help-title');
help.innerHTML = `<h2 id="map-help-title">Bryan’s map tips</h2>
  <p data-map-layer-tip></p><p data-map-habitat-tip></p>
  <button type="button" data-map-help-close>Back to the map</button>`;
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
document.body.append(map, help, drill, confirm);
let context,
  selected = firstShoreHole,
  turns = 0,
  requiredTurns,
  saving = false,
  confirmCallback;
const habitatTips = {
  'Weed edge': 'In early winter, look for the outside edge of the weeds. Healthy weeds give small fish cover, and larger fish can feed along that edge.',
  'Reef edge': 'Look for the slope where the reef drops into deeper water. Fish can move along that edge to feed, especially in the lower light around dawn or dusk.',
  'Deep basin': 'Compare the basin with the nearest shallower spot. Start near the slope if you want to try the edge where those two depths meet.',
};
const quietMessage = 'This hole is quiet. Choose another spot to fish.';
function drawMap() {
  const cell = mapCells.find((c) => c.id === selected);
  const { allowance, opened, rosters } = context.day;
  const remaining = allowance - opened.length;
  const accessible = context.hasAccess(cell.area);
  const access = accessible ? 'Unlocked' : 'Locked';
  const alreadyOpen = opened.includes(cell.id);
  const roster = alreadyOpen ? rosters?.[cell.id] : undefined;
  const quiet = roster?.length === 0;
  const recognized = new Set(context.recognizedSpecies);
  const pastCatches = new Set(context.pastCatchSpots);
  const temperature = map.querySelector('[data-map-temperature]').checked;

  for (const button of map.querySelectorAll('[data-map-cell]')) {
    const c = mapCells.find((c) => c.id === button.dataset.mapCell);
    const owned = context.hasAccess(c.area);
    const open = opened.includes(c.id);
    const pastCatch = pastCatches.has(c.id);
    button.setAttribute(
      'aria-label',
      `${c.id}, ${c.habitat}, ${c.depthFt} ft${temperature ? `, ${c.temperatureF} °F modeled near the bottom` : ''}, ${owned ? 'permit owned' : 'permit required'}${open ? ', hole open' : ''}${pastCatch ? ', past catch' : ''}`,
    );
    button.setAttribute('aria-pressed', String(c.id === selected));
    button.dataset.spotAccess = owned ? 'unlocked' : 'locked';
    const depthBand = c.depthFt <= 15 ? 'shallow' : c.depthFt <= 25 ? 'middle' : 'deep';
    button.dataset.depth = temperature ? 'off' : depthBand;
    button.dataset.temperature = temperature ? String(c.temperatureF) : 'off';
    button.toggleAttribute('data-hole-open', open);
    button.toggleAttribute('data-past-catch', pastCatch);
  }
  map.querySelector('[data-depth-legend]').hidden = temperature;
  map.querySelector('[data-temperature-legend]').hidden = !temperature;
  map.querySelector('#map-hole-title').textContent = `${cell.id} · ${cell.habitat}`;
  map.querySelector('[data-map-info]').textContent = temperature
    ? `${cell.id} · ${access} · ${cell.temperatureF} °F near-bottom estimate · ${cell.depthFt} ft deep`
    : `${cell.id} · ${access} · ${cell.depthFt} ft deep`;
  const accessLabel = map.querySelector('[data-map-access-label]');
  accessLabel.dataset.spotAccess = accessible ? 'unlocked' : 'locked';
  accessLabel.textContent = access;
  map.querySelector('[data-map-permit-name]').textContent =
    `Mille Lacs permit · ${accessible ? 'Owned' : 'Required'}`;
  const present = new Set(roster?.map((fish) => fish.speciesId));
  const familiar = collectibleSpecies.filter(({ id }) => present.has(id) && recognized.has(id)).map(({ name }) => name);
  const fishInfo = map.querySelector('[data-map-fish]');
  fishInfo.hidden = !alreadyOpen;
  fishInfo.textContent = quiet ? quietMessage : familiar.length
    ? `Recognized at this hole · ${familiar.join(', ')}`
    : alreadyOpen ? 'No familiar fish spotted here yet.' : '';
  map.querySelector('[data-map-history]').hidden = !pastCatches.has(cell.id);
  map.querySelector('[data-map-budget]').textContent =
    context.budget === undefined
      ? 'Six encounters in this outing.'
      : `${context.budget} of 6 encounters remain. Your rig and clock carry across holes.`;
  map.querySelector('[data-map-goal]').textContent = context.goalClue;
  map.querySelector('[data-map-allowance]').textContent = `${remaining} of ${allowance} new holes available today.`;
  const open = map.querySelector('[data-map-drill]');
  const outOfHoles = accessible && !alreadyOpen && !remaining;
  open.disabled = accessible && (quiet || outOfHoles);
  open.textContent = !accessible ? 'Check permit' : alreadyOpen ? 'Fish this hole' : 'Drill hole';
  map.querySelector('[data-map-message]').textContent = outOfHoles
    ? 'You’ve opened all your new holes for today. Return to an open hole or end the day.'
    : '';
}
const helpButton = map.querySelector('[data-map-help]');
const helpClose = help.querySelector('[data-map-help-close]');
helpButton.onclick = () => {
  if (saving) return;
  const cell = mapCells.find((c) => c.id === selected);
  const temperature = map.querySelector('[data-map-temperature]').checked;
  help.querySelector('[data-map-layer-tip]').textContent = temperature
    ? 'In winter, the water just under the ice can be colder than the water near the bottom. These shades show an estimate near the bottom. Compare them with the habitat and the time of day when you decide where to fish.'
    : 'Look for spots that change shade over a short distance. That’s where the bottom drops away. Try a spot near the change so you can fish along the slope.';
  help.querySelector('[data-map-habitat-tip]').textContent = habitatTips[cell.habitat];
  help.showModal();
  helpClose.focus();
};
helpClose.onclick = () => help.close();
help.addEventListener('close', () => helpButton.focus());
function focusSelectedCell() {
  const cell = map.querySelector(`[data-map-cell="${selected}"]`);
  cell.focus({ preventScroll: true });
  cell.scrollIntoView({ block: 'nearest' });
}

export function openCampaignMap(options) {
  context = options;
  selected = options.selected ?? selected;
  showMap();
}
function showMap() {
  drawMap();
  map.showModal();
  focusSelectedCell();
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
    focusSelectedCell();
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
  if (saving || map.querySelector('[data-map-drill]').disabled) return;
  const cell = mapCells.find((c) => c.id === selected);
  if (!context.hasAccess(cell.area)) {
    map.close();
    return context.onPermit(cell);
  }
  if (context.day.opened.includes(cell.id)) return void openHole(map, cell);
  map.close();
  // Give each cell a consistent gameplay resistance.
  requiredTurns = Math.max(3, 4 + cell.depthFt / 5 - (context.day.drillReduction ?? 0));
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
        showMap();
      } else drawMap();
      const mapMessage = map.querySelector('[data-map-message]');
      if (status === 'hole-quiet') {
        mapMessage.textContent = quietMessage;
        focusSelectedCell();
      } else if (status !== 'daily-limit') {
        mapMessage.textContent = status === 'permit-required'
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
  showMap();
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
