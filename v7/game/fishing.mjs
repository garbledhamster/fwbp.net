import { apply, lures, publicRun, skills, start } from './rules.mjs';

const endpoint = document.querySelector('meta[name="fishing-api"]')?.content;
const scenes = [...document.querySelectorAll('.dive[data-dive]')].slice(0, 6);
const tray = document.createElement('section');
tray.className = 'fishing-tray';
tray.hidden = true;
tray.setAttribute('aria-label', 'Fishing controls');
tray.innerHTML = `
  <div class="fishing-tray-inner">
    <div class="fishing-row"><strong data-score></strong><button type="button" data-exit>Exit fishing</button></div>
    <p class="fishing-status" role="status"></p>
    <div class="fishing-timing" aria-hidden="true" hidden><i></i></div>
    <div class="fishing-row" aria-label="Lures and action">
      ${Object.entries(lures).map(([id, name]) => `<button type="button" data-lure="${id}">${name}</button>`).join('')}
      <button type="button" class="fishing-action"></button>
    </div>
    <div class="fishing-row fishing-skills" hidden aria-label="Spend one skill point">
      ${Object.entries(skills).map(([id, name]) => `<button type="button" data-skill="${id}">${name}</button>`).join('')}
    </div>
    <details hidden><summary>Catch log</summary><ul></ul></details>
    <form hidden><label>Nickname <input name="nickname" maxlength="20" required></label> <button>Post score</button></form>
    <ol data-board hidden></ol>
  </div>`;
const bobber = document.createElement('div');
bobber.className = 'fishing-bobber';
bobber.hidden = true;
bobber.setAttribute('aria-hidden', 'true');
document.body.append(tray, bobber);

const action = tray.querySelector('.fishing-action');
const timing = tray.querySelector('.fishing-timing');
const status = tray.querySelector('[role="status"]');
const exit = tray.querySelector('[data-exit]');
const form = tray.querySelector('form');
const log = tray.querySelector('details');
const board = tray.querySelector('[data-board]');
const skillRow = tray.querySelector('.fishing-skills');
const slots = [...tray.querySelectorAll('[data-lure]')];
let launch, previousScroll, run, state, token, target, selected, busy, failed, biteAt, frame;
let lure = 'jig';
let generation = 0;

async function api(action, data = {}, auth = token) {
  const response = await fetch(endpoint, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(auth && { Authorization: `Bearer ${auth}` }) },
    body: JSON.stringify({ action, ...data }), signal: AbortSignal.timeout(6500),
  });
  if (!response.ok) throw Error('Ranking connection interrupted.');
  return response.json();
}

function moveBobber(x, y) {
  bobber.style.setProperty('--x', `${x}px`);
  bobber.style.setProperty('--y', `${y}px`);
}

function animateBite() {
  if (tray.hidden || state?.stage !== 'bite') return;
  const elapsed = performance.now() - biteAt;
  timing.style.setProperty('--position', `${Math.min(100, elapsed / state.window.until * 100)}%`);
  if (elapsed < state.window.until) frame = requestAnimationFrame(animateBite);
}

function placeFish() {
  target?.remove();
  target = null;
  selected = false;
  if (!state.fish) return;
  const { art: [file, symbol, box], x, y } = state.fish;
  target = document.createElement('button');
  target.type = 'button';
  target.className = 'fishing-target';
  target.classList.toggle('gilded', state.fish.gilded);
  target.setAttribute('aria-label', 'Aim at fish');
  target.style.setProperty('--x', `${x}%`);
  target.style.setProperty('--y', `${y}%`);
  target.innerHTML = `<svg viewBox="${box}" aria-hidden="true"><use href="./assets/${file}.svg#${symbol}"/></svg>`;
  target.addEventListener('click', () => {
    selected = true;
    const bounds = target.getBoundingClientRect();
    moveBobber(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    render();
    action.focus({ preventScroll: true });
  });
  scenes[state.index].append(target);
}

function render() {
  tray.querySelector('[data-score]').textContent = state
    ? `${state.lake} · ${token ? 'Ranked' : 'Practice'} · ${state.score} pts · ${Math.min(state.index + 1, state.count)}/${state.count}`
    : 'Fishing beneath the ice';
  status.textContent = failed ? 'Ranking disconnected. You can start a practice outing.' : state?.cue ?? 'Opening the lake…';
  action.textContent = failed ? 'Practice' : ({ seek: 'Jig', bite: 'Reel', lift: 'Pull up', landed: 'Next fish', done: 'Fish again' }[state?.stage] ?? 'Wait');
  action.disabled = busy || !state || (!failed && state.stage === 'seek' && !selected);
  slots.forEach(slot => {
    slot.disabled = busy || state?.stage !== 'seek';
    slot.setAttribute('aria-pressed', String(slot.dataset.lure === lure));
  });
  target?.setAttribute('aria-pressed', String(Boolean(selected)));
  target?.classList.toggle('is-biting', state?.stage === 'bite');
  if (target) target.hidden = state?.stage === 'landed';
  skillRow.hidden = state?.stage !== 'landed' || !state.skillPoints || failed;
  for (const button of skillRow.children) {
    const skill = button.dataset.skill;
    const level = state?.skills[skill] ?? 0;
    button.textContent = `${skills[skill]} ${level}/2`;
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
    run = start(Date.now());
    state = publicRun(run);
  }
  busy = false;
  placeFish();
  window.scrollTo({ top: 0, behavior: 'instant' });
  render();
}

function enter(event) {
  event.preventDefault();
  launch = event.currentTarget;
  previousScroll = window.scrollY;
  tray.hidden = bobber.hidden = false;
  document.body.classList.add('fishing');
  exit.focus({ preventScroll: true });
  begin();
}

function leave() {
  generation++;
  cancelAnimationFrame(frame);
  target?.remove();
  tray.hidden = bobber.hidden = true;
  document.body.classList.remove('fishing');
  window.scrollTo({ top: previousScroll, behavior: 'instant' });
  launch.focus({ preventScroll: true });
}

document.querySelectorAll('.brand, .fish-entry').forEach(entry => entry.addEventListener('click', enter));
exit.addEventListener('click', leave);
document.addEventListener('keydown', event => {
  if (!tray.hidden && event.key === 'Escape') leave();
});
document.querySelector('.lake').addEventListener('pointermove', event => {
  if (!tray.hidden && event.pointerType === 'mouse') moveBobber(event.clientX, event.clientY);
});
slots.forEach(slot => slot.addEventListener('click', () => {
  lure = slot.dataset.lure;
  render();
}));

async function perform(move, input = {}) {
  const prior = state;
  const current = generation;
  if (move === 'jig') {
    bobber.classList.remove('is-jigging');
    void bobber.offsetWidth;
    bobber.classList.add('is-jigging');
  }
  busy = true;
  render();
  const sentAt = performance.now();
  try {
    const result = token
      ? (await api(move, { ...input, version: state.version })).state
      : apply(run, { action: move, ...input }, Date.now());
    if (current !== generation) return;
    state = result;
    if (state.index !== prior.index) placeFish();
    if (state.stage === 'bite') {
      biteAt = sentAt;
      cancelAnimationFrame(frame);
      animateBite();
    }
  } catch (error) {
    if (current !== generation) return;
    if (token) failed = true;
    else state = { ...state, cue: error.message };
  }
  busy = false;
  render();
  if (move === 'upgrade' && skillRow.hidden) action.focus({ preventScroll: true });
}

action.addEventListener('click', () => {
  if (failed || state.stage === 'done') return begin(failed);
  const move = { seek: 'jig', bite: 'reel', lift: 'lift', landed: 'next' }[state.stage];
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
