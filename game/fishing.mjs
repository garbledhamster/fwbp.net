import { apply, lures, publicRun, skills, start } from './rules.mjs?v=9';

const endpoint = document.querySelector('meta[name="fishing-api"]')?.content;
const scenes = [...document.querySelectorAll('.dive[data-dive]')].slice(0, 6);
const lake = document.querySelector('.lake');
const iceCeiling = lake.querySelector('.dive-ceiling');
const icon = id => `<svg class="tackle-icon" viewBox="0 0 24 24" aria-hidden="true"><use href="./assets/tackle-icons.svg#${id}"/></svg>`;
const tray = document.createElement('section');
tray.className = 'fishing-tray';
tray.hidden = true;
tray.setAttribute('aria-label', 'Fishing controls');
tray.innerHTML = `
  <div class="fishing-tray-inner">
    <div class="fishing-row"><img class="fishing-brand" src="./assets/fwbp-logo.jpg" alt="" width="27" height="27"><strong data-score></strong><button type="button" data-exit>Exit fishing</button></div>
    <p class="fishing-status" role="status"></p>
    <div class="fishing-timing" aria-hidden="true" hidden><i></i></div>
    <div class="fishing-pressure" hidden>
      <label>Line tension <meter min="0" max="100" high="60" optimum="0"></meter></label>
      <span data-pulls></span>
    </div>
    <div class="fishing-row" aria-label="Lures and action">
      ${Object.entries(lures).map(([id, name]) => `<button type="button" data-lure="${id}">${icon(id)}<span>${name}</span></button>`).join('')}
      <button type="button" class="fishing-action"></button>
      <button type="button" data-loosen hidden>${icon('loosen')}<span>Loosen</span></button>
    </div>
    <div class="fishing-row fishing-skills" hidden aria-label="Spend one skill point">
      ${Object.entries(skills).map(([id, name]) => `<button type="button" data-skill="${id}">${icon(id)}<span>${name}</span></button>`).join('')}
    </div>
    <details hidden><summary>Catch log</summary><ul></ul></details>
    <form hidden><label>Nickname <input name="nickname" maxlength="20" required></label> <button>Post score</button></form>
    <ol data-board hidden></ol>
  </div>`;
const bobber = document.createElement('div');
bobber.className = 'fishing-bobber';
bobber.hidden = true;
bobber.setAttribute('aria-hidden', 'true');
lake.append(bobber);
const celebration = document.createElement('div');
celebration.className = 'fishing-celebration';
celebration.hidden = true;
celebration.innerHTML = `
  <div class="fishing-splash" aria-hidden="true">
    ${[-130, -87, -53, 53, 87, 130].map((x, i) => `
      <svg style="--dx:${x}px;--dy:${-30 - i % 3 * 16}px;--delay:${i * 45}ms" viewBox="0 0 32 18">
        <path d="M1 3l7 3C14 0 24 1 31 9c-7 8-17 9-23 3l-7 3 3-6z"/>
      </svg>`).join('')}
  </div>
  <img src="./assets/bryan-level-up.webp" alt="" width="320" height="320" loading="lazy">
  <div class="fishing-ribbon"><strong data-level></strong><span>+1 skill point</span></div>`;
const announcement = document.createElement('span');
announcement.className = 'fishing-announcement';
announcement.setAttribute('role', 'status');
document.body.append(tray, celebration, announcement);

let celebrationTimer;

function dismissCelebration() {
  clearTimeout(celebrationTimer);
  celebration.hidden = true;
  announcement.textContent = '';
}

function celebrateCatch(level) {
  dismissCelebration();
  celebration.querySelector('[data-level]').textContent = `Level ${level}`;
  celebration.hidden = false;
  announcement.textContent = `Level ${level}. You earned one skill point.`;
  celebrationTimer = setTimeout(dismissCelebration, 3600);
}

const action = tray.querySelector('.fishing-action');
const loosen = tray.querySelector('[data-loosen]');
const pressure = tray.querySelector('.fishing-pressure');
const timing = tray.querySelector('.fishing-timing');
const status = tray.querySelector('[role="status"]');
const exit = tray.querySelector('[data-exit]');
const form = tray.querySelector('form');
const log = tray.querySelector('details');
const board = tray.querySelector('[data-board]');
const skillRow = tray.querySelector('.fishing-skills');
const slots = [...tray.querySelectorAll('[data-lure]')];
let launch, previousScroll, run, state, token, target, busy, failed, biteAt, frame;
let lure = 'jig';
let practiceError;
let generation = 0;

async function api(action, data = {}, auth = token) {
  const response = await fetch(endpoint, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(auth && { Authorization: `Bearer ${auth}` }) },
    body: JSON.stringify({ action, ...data }), signal: AbortSignal.timeout(6500),
  });
  if (!response.ok) throw Error('Ranking connection interrupted.');
  return response.json();
}

function positionLine() {
  const scene = scenes[state?.index];
  if (!scene || !state.fish) {
    bobber.hidden = true;
    return;
  }
  const water = lake.getBoundingClientRect();
  const encounter = scene.getBoundingClientRect();
  const hole = iceCeiling.getBoundingClientRect();
  bobber.style.setProperty('--line-start', `${hole.top - water.top + hole.height * 20 / 110}px`);
  bobber.style.setProperty('--line-depth', `${encounter.top - water.top + encounter.height * .44}px`);
  bobber.hidden = tray.hidden;
}

function setStatus(message) {
  if (status.textContent !== message) status.textContent = message;
}

function showPracticeBite(elapsed) {
  const wait = elapsed < state.window.from;
  const passed = elapsed > state.window.until;
  setStatus(wait ? 'Bite! Wait for gold.' : passed ? 'Window passed. Reel, then jig again.' : 'Yeah, reel it!');
  action.classList.toggle('fishing-action-quiet', wait);
}

function clearBite() {
  cancelAnimationFrame(frame);
  timing.style.removeProperty('--position');
}

function animateBite() {
  if (tray.hidden || state?.stage !== 'bite') return;
  const elapsed = (token ? performance.now() : Date.now()) - biteAt;
  timing.style.setProperty('--position', `${Math.min(100, elapsed / state.window.until * 100)}%`);
  if (!token && !practiceError) showPracticeBite(elapsed);
  if (elapsed < state.window.until || (!token && elapsed === state.window.until)) {
    frame = requestAnimationFrame(animateBite);
  }
}

function placeFish() {
  target?.remove();
  target = null;
  positionLine();
  if (!state.fish) return;
  const { art: [file, symbol, box], x, y } = state.fish;
  target = document.createElement('div');
  target.className = 'fishing-target';
  target.classList.toggle('gilded', state.fish.gilded);
  target.setAttribute('aria-hidden', 'true');
  target.style.setProperty('--x', `${x}%`);
  target.style.setProperty('--y', `${y}%`);
  target.innerHTML = `<svg viewBox="${box}" aria-hidden="true"><use href="./assets/${file}.svg#${symbol}"/></svg>`;
  scenes[state.index].append(target);
}

function render() {
  tray.querySelector('[data-score]').textContent = state
    ? `${state.lake} · ${token ? 'Ranked' : 'Practice'} · ${state.score} pts · ${Math.min(state.index + 1, state.count)}/${state.count}`
    : 'Fishing beneath the ice';
  const practiceFight = !token && state?.stage === 'fight';
  const tight = practiceFight && state.fight.tension >= 60;
  const pullUp = state?.fight?.pulls === 1;
  const practiceBite = !token && state?.stage === 'bite';
  let cue = state?.cue ?? 'Opening the lake…';
  if (failed) cue = 'Ranking disconnected. You can start a practice outing.';
  else if (practiceError) cue = practiceError;
  else if (practiceFight) cue = tight ? 'Tight line. Loosen.' : `Line clear. ${pullUp ? 'Pull up' : 'Reel'}.`;
  else if (state?.stage === 'landed' && cue.endsWith('points')) cue = `All right! ${cue}`;
  if (!practiceBite || practiceError) setStatus(cue);
  const [actionIcon, label] = failed ? ['next', 'Practice'] : ({
    seek: ['jig', 'Jig'], bite: ['reel', 'Reel'], fight: state?.fight?.pulls === 1 ? ['lift', 'Pull up'] : ['reel', 'Reel'],
    landed: ['next', 'Next fish'], done: ['next', 'Fish again'],
  }[state?.stage] ?? ['next', 'Wait']);
  action.innerHTML = `${icon(actionIcon)}<span>${label}</span>`;
  action.disabled = busy || !state;
  action.parentElement.toggleAttribute('data-practice-fight', practiceFight);
  action.classList.toggle('fishing-action-quiet', tight);
  loosen.classList.toggle('fishing-recommended', tight);
  if (practiceBite && !practiceError) showPracticeBite(Date.now() - biteAt);
  if (bobber.dataset.lure !== lure) {
    bobber.dataset.lure = lure;
    bobber.innerHTML = icon(lure);
  }
  pressure.hidden = !state?.fight || failed;
  loosen.hidden = pressure.hidden;
  loosen.disabled = busy;
  if (state?.fight) {
    pressure.querySelector('meter').value = state.fight.tension;
    pressure.querySelector('[data-pulls]').textContent =
      `${state.fight.tension >= 60 ? 'Tight line' : 'Line clear'} · ${state.fight.pulls} to land`;
  }
  slots.forEach(slot => {
    slot.hidden = !pressure.hidden;
    slot.disabled = busy || state?.stage !== 'seek';
    slot.setAttribute('aria-pressed', String(slot.dataset.lure === lure));
  });
  target?.classList.toggle('is-biting', ['bite', 'fight'].includes(state?.stage));
  if (target) target.hidden = state?.stage === 'landed';
  skillRow.hidden = state?.stage !== 'landed' || !state.skillPoints || failed;
  for (const button of skillRow.children) {
    const skill = button.dataset.skill;
    const level = state?.skills[skill] ?? 0;
    button.querySelector('span').textContent = `${skills[skill]} ${level}/2`;
    button.disabled = busy || level === 2;
  }
  if (state) timing.style.setProperty('--window-start', `${state.window.from / state.window.until * 100}%`);
  timing.hidden = state?.stage !== 'bite' || failed;
  form.hidden = !token || state?.stage !== 'done' || state.submitted || failed;
  log.hidden = !state?.discoveries.length;
  log.querySelector('ul').replaceChildren(...(state?.discoveries ?? []).map(entry => {
    const li = document.createElement('li');
    li.textContent = `${entry.fish} · ${lures[entry.lure]}`;
    return li;
  }));
}

async function begin(practice = false) {
  const fromAction = document.activeElement === action;
  dismissCelebration();
  clearBite();
  practiceError = undefined;
  const current = ++generation;
  busy = true;
  failed = false;
  token = null;
  state = null;
  board.hidden = true;
  target?.remove();
  render();
  if (endpoint && !practice) {
    try {
      const opened = await api('start', {}, null);
      if (current !== generation) return;
      ({ token, state } = opened);
    } catch {
      if (current !== generation) return;
    }
  }
  if (!state) {
    lure = 'jig';
    run = start(Date.now());
    state = publicRun(run);
  }
  busy = false;
  placeFish();
  window.scrollTo({ top: 0, behavior: 'instant' });
  render();
  if (!token && fromAction && document.activeElement === document.body) action.focus({ preventScroll: true });
}

function enter(event) {
  event.preventDefault();
  launch = event.currentTarget;
  previousScroll = window.scrollY;
  tray.hidden = false;
  document.body.classList.add('fishing');
  exit.focus({ preventScroll: true });
  begin();
}

function leave() {
  dismissCelebration();
  generation++;
  clearBite();
  target?.remove();
  tray.hidden = bobber.hidden = true;
  document.body.classList.remove('fishing');
  window.scrollTo({ top: previousScroll, behavior: 'instant' });
  launch.focus({ preventScroll: true });
}

document.querySelectorAll('.game-entry, .fish-entry').forEach(entry => entry.addEventListener('click', enter));
exit.addEventListener('click', leave);
document.addEventListener('keydown', event => {
  if (tray.hidden) return;
  if (event.key === 'Escape') leave();
  if (!token && event.repeat && ['Enter', ' '].includes(event.key) && tray.contains(event.target)) {
    event.preventDefault();
  }
});
window.addEventListener('resize', positionLine);
slots.forEach(slot => slot.addEventListener('click', () => {
  lure = slot.dataset.lure;
  render();
}));

async function perform(move, input = {}) {
  const prior = state;
  const focused = document.activeElement;
  const current = generation;
  if (move === 'jig') {
    bobber.classList.remove('is-jigging');
    void bobber.offsetWidth;
    bobber.classList.add('is-jigging');
    target?.classList.remove('is-curious');
    if (target) void target.offsetWidth;
    target?.classList.add('is-curious');
  }
  busy = true;
  render();
  const sentAt = performance.now();
  const appliedAt = Date.now();
  try {
    const result = token
      ? (await api(move, { ...input, version: state.version })).state
      : apply(run, { action: move, ...input }, appliedAt);
    if (current !== generation) return;
    state = result;
    practiceError = undefined;
    if (!token && move === 'jig' && state.stage === 'seek') {
      state = { ...state, cue: 'It looked. Try a different lure and jig again.' };
    }
    if (state.stage === 'landed' && prior.stage !== 'landed') celebrateCatch(state.index + 2);
    if (state.index !== prior.index) dismissCelebration();
    if (state.index !== prior.index) placeFish();
    if (state.stage === 'bite') {
      biteAt = token ? sentAt : appliedAt;
      clearBite();
      animateBite();
    } else if (prior.stage === 'bite') {
      clearBite();
    }
  } catch (error) {
    if (current !== generation) return;
    if (token) failed = true;
    else practiceError = error.message;
  }
  busy = false;
  render();
  if (focused === action || (move === 'upgrade' && skillRow.hidden)) action.focus({ preventScroll: true });
  if (focused === loosen) (loosen.hidden ? action : loosen).focus({ preventScroll: true });
}

loosen.addEventListener('click', () => perform('loosen'));

action.addEventListener('click', () => {
  if (failed || state.stage === 'done') return begin(failed);
  const move = { seek: 'jig', bite: 'reel', fight: 'lift', landed: 'next' }[state.stage];
  return perform(move, move === 'jig' ? { lure } : {});
});
for (const button of skillRow.children) {
  button.addEventListener('click', () => perform('upgrade', { skill: button.dataset.skill }));
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  const current = generation;
  const submit = form.querySelector('button');
  submit.disabled = true;
  try {
    const result = await api('submit', { nickname: new FormData(form).get('nickname'), version: state.version });
    if (current !== generation) return;
    state = result.state;
    board.replaceChildren(...result.board.map(row => {
      const li = document.createElement('li');
      li.textContent = `${row.nickname} · ${row.score} pts`;
      return li;
    }));
    board.hidden = false;
    render();
    status.textContent = 'Score posted.';
  } catch {
    if (current === generation) status.textContent = 'Score could not be confirmed. Try posting again.';
  } finally {
    submit.disabled = false;
  }
});
