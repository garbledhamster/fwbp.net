import { advanceCampaignFight, apply, lures, practiceLevelXp, practiceSkills, publicRun, skills, start } from './rules.mjs?v=15';
import { applyProfile, loadProfile, shopItems } from './profile.mjs?v=15';

const endpoint = document.querySelector('meta[name="fishing-api"]')?.content;
const scenes = [...document.querySelectorAll('.dive[data-dive]')].slice(0, 6);
const lake = document.querySelector('.lake');
const iceCeiling = lake.querySelector('.dive-ceiling');
const icon = id => `<svg class="tackle-icon" viewBox="0 0 24 24" aria-hidden="true"><use href="./assets/tackle-icons.svg#${id}"/></svg>`;
const picker = document.createElement('dialog');
picker.className = 'fishing-picker';
picker.setAttribute('aria-labelledby', 'fishing-picker-title');
picker.innerHTML = `
  <h2 id="fishing-picker-title">Choose an outing</h2>
  <div class="fishing-picker-options">
    <button type="button" data-mode="campaign" aria-describedby="campaign-description">Campaign</button>
    <p id="campaign-description">Fish Mille Lacs with your own tackle.</p>
    <button type="button" data-open-shop aria-describedby="shop-description">Tackle shop</button>
    <p id="shop-description">Spend coins and choose your gear between outings.</p>
    <button type="button" data-mode="practice" aria-describedby="practice-description">Practice</button>
    <p id="practice-description">Find fish, try lures and earn a skill for this outing.</p>
    ${endpoint ? `<button type="button" data-mode="ranked" aria-describedby="ranked-description">Ranked</button>
      <p id="ranked-description">Fish for a score on the public board.</p>` : ''}
  </div>
  <form method="dialog"><button>Back to the site</button></form>`;
const shop = document.createElement('dialog');
shop.className = 'fishing-picker fishing-shop';
shop.setAttribute('aria-labelledby', 'fishing-shop-title');
shop.innerHTML = `
  <div class="fishing-shop-heading">
    <h2 id="fishing-shop-title" tabindex="-1" autofocus>Tackle shop</h2>
    <strong data-shop-balance></strong>
  </div>
  <p data-shop-message role="status"></p>
  <div data-shop-items></div>
  <form method="dialog"><button>Back to outings</button></form>`;
const tray = document.createElement('section');
tray.className = 'fishing-tray';
tray.hidden = true;
tray.setAttribute('aria-label', 'Fishing controls');
tray.innerHTML = `
  <div class="fishing-tray-inner">
    <div class="fishing-row fishing-heading"><img class="fishing-brand" src="./assets/fwbp-logo.jpg" alt="" width="27" height="27"><strong data-score></strong><button type="button" data-exit>Exit fishing</button></div>
    <p class="fishing-status" role="status"></p>
    <div class="fishing-row fishing-encounter">
      <p class="fishing-wallet" data-wallet hidden></p>
      <p class="fishing-practice-progress" hidden></p>
      <p class="fishing-countdown" role="timer" hidden></p>
    </div>
    <div class="fishing-timing" aria-hidden="true" hidden><i></i></div>
    <div class="fishing-rack">
      <div class="fishing-pressure" hidden>
        <label><span>Line tension</span><meter min="0" max="100" high="60" optimum="0"></meter></label>
        <span data-pulls></span>
      </div>
      <div class="fishing-row fishing-tools">
        <div class="fishing-lures" role="group" aria-label="Lures">
          ${Object.entries(lures).map(([id, name]) => `<button type="button" data-lure="${id}">${icon(id)}<span>${name}</span></button>`).join('')}
        </div>
        <div class="fishing-actions" role="group" aria-label="Fishing actions">
          <button type="button" class="fishing-action"></button>
          <button type="button" data-loosen hidden>${icon('loosen')}<span>Loosen</span></button>
        </div>
      </div>
    </div>
    <div class="fishing-row fishing-skills" hidden aria-label="Spend one skill point">
      ${Object.entries(skills).map(([id, name]) => `<button type="button" data-skill="${id}">${icon(id)}<span>${name}</span></button>`).join('')}
    </div>
    <div class="fishing-practice-choice" role="group" aria-label="Choose a skill" hidden>
      <p>Next fish skips the choice.</p>
      <div class="fishing-row">
        ${Object.entries(practiceSkills).map(([id, description]) =>
          `<button type="button" data-skill="${id}"><span>${icon(id)} ${skills[id]}</span><small>${description}</small></button>`).join('')}
      </div>
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
const line = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
line.classList.add('fishing-line');
line.setAttribute('hidden', '');
line.setAttribute('aria-hidden', 'true');
line.innerHTML = `<path class="fishing-line-path"/><g class="fishing-line-rig">
  <use width="24" height="24"/><circle class="fishing-line-eye" r="2.6"/>
</g>`;
lake.append(line);
const linePath = line.querySelector('path');
const lineRig = line.querySelector('g');
const lineLure = line.querySelector('use');
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
  <img src="./assets/bryan-level-up.webp" alt="" width="320" height="320">
  <div class="fishing-ribbon"><strong data-level></strong><span>+1 skill point</span></div>`;
const announcement = document.createElement('span');
announcement.className = 'fishing-announcement';
announcement.setAttribute('role', 'status');
document.body.append(picker, shop, tray, celebration, announcement);

let celebrationTimer;

function dismissCelebration() {
  clearTimeout(celebrationTimer);
  celebration.hidden = true;
  announcement.textContent = '';
}

function celebrateCatch(level, practice = false) {
  dismissCelebration();
  celebration.querySelector('[data-level]').textContent = `Level ${level}`;
  celebration.querySelector('.fishing-ribbon span').textContent = practice ? 'Choose a skill' : '+1 skill point';
  if (practice) celebration.setAttribute('aria-hidden', 'true');
  else celebration.removeAttribute('aria-hidden');
  celebration.hidden = false;
  if (!practice) announcement.textContent = `Level ${level}. You earned one skill point.`;
  celebrationTimer = setTimeout(dismissCelebration, 3600);
}

const action = tray.querySelector('.fishing-action');
const loosen = tray.querySelector('[data-loosen]');
const pressure = tray.querySelector('.fishing-pressure');
const meter = pressure.querySelector('meter');
const pullsText = pressure.querySelector('[data-pulls]');
const timing = tray.querySelector('.fishing-timing');
const status = tray.querySelector('[role="status"]');
const exit = tray.querySelector('[data-exit]');
const form = tray.querySelector('form');
const log = tray.querySelector('details');
const board = tray.querySelector('[data-board]');
const skillRow = tray.querySelector('.fishing-skills');
const practiceChoice = tray.querySelector('.fishing-practice-choice');
const practiceProgress = tray.querySelector('.fishing-practice-progress');
const wallet = tray.querySelector('[data-wallet]');
const countdown = tray.querySelector('.fishing-countdown');
const practiceButtons = [...practiceChoice.querySelectorAll('button')];
const slots = [...tray.querySelectorAll('[data-lure]')];
let launch, previousScroll, run, state, token, target, busy, failed, biteAt, frame;
let mode, rigFrame, fightFrame, jigAt = -Infinity;
let profile, outingId, catchReward;
let shopBusy = false;
let shopGeneration = 0;
let countdownTimer, rankedSeekUntil, rankedServerSeekUntil, escapeTimer;
let jigActivation = false;
let fightActivation = false;
let lure = 'jig';
let practiceError;
let generation = 0;
const scrollKeys = { ArrowUp: -1, ArrowDown: 1, PageUp: -1, PageDown: 1, Home: -1, End: 1 };

const coins = amount => `${amount} ${amount === 1 ? 'coin' : 'coins'}`;
const shopLabels = { line: 'Fishing line', hook: 'Hooks', training: 'Training', license: 'Licenses' };
const shopBalance = shop.querySelector('[data-shop-balance]');
const shopMessage = shop.querySelector('[data-shop-message]');
const shopList = shop.querySelector('[data-shop-items]');

function shopItem(item) {
  const owned = profile.owned.includes(item.id);
  const equipped = profile.equipped[item.category] === item.id;
  const canEquip = Object.hasOwn(profile.equipped, item.category);
  const shortfall = item.cost - profile.coins;
  const action = (type, label, disabled = false) =>
    `<button type="button" data-shop-action="${type}" aria-label="${label} ${item.name}" ${disabled ? 'disabled' : ''}>${label}</button>`;
  return `<li data-item="${item.id}" tabindex="-1">
    <div><strong>${item.name}</strong><p>${item.effect}</p></div>
    <div class="fishing-shop-action">
      <span>${owned ? equipped ? 'Equipped' : 'Owned' : coins(item.cost)}</span>
      ${owned ? canEquip && !equipped ? action('equip', 'Equip') : '' : action('buy', 'Buy', shortfall > 0)}
    </div>
  </li>`;
}

function renderShop() {
  shopBalance.textContent = coins(profile.coins);
  shopList.innerHTML = Object.entries(shopLabels).map(([category, label]) => {
    const items = shopItems.filter(item => item.category === category);
    if (!items.length) return '';
    return `<section aria-labelledby="shop-${category}">
      <h3 id="shop-${category}">${label}</h3>
      <ul>${items.map(shopItem).join('')}</ul>
    </section>`;
  }).join('');
}

async function openShop() {
  const current = ++shopGeneration;
  picker.close();
  shopBusy = true;
  shopBalance.textContent = '';
  shopList.replaceChildren();
  shopMessage.textContent = 'Opening the tackle shop…';
  shop.showModal();
  shop.scrollTop = 0;
  try {
    const loaded = await loadProfile();
    if (current !== shopGeneration || !shop.open) return;
    profile = loaded;
    renderShop();
    shopMessage.textContent = '';
  } catch {
    if (current === shopGeneration) shopMessage.textContent = 'Couldn’t open your saved tackle. Try opening the shop again.';
  } finally {
    if (current === shopGeneration) shopBusy = false;
  }
}

shop.addEventListener('close', () => {
  shopGeneration++;
  picker.showModal();
  picker.querySelector('[data-open-shop]').focus();
});

shop.addEventListener('click', async event => {
  const control = event.target.closest('[data-shop-action]');
  if (!control || shopBusy) return;
  const current = shopGeneration;
  const id = control.closest('[data-item]').dataset.item;
  const type = control.dataset.shopAction;
  shopBusy = true;
  try {
    const result = await applyProfile({ type, id, revision: profile.revision });
    if (current !== shopGeneration || !shop.open) return;
    profile = result.profile;
    renderShop();
    const item = shopItems.find(item => item.id === id);
    const notices = {
      bought: `${item.name} purchased.`,
      equipped: `${item.name} equipped.`,
      stale: 'Your tackle changed in another tab. Check your updated gear and balance.',
      unaffordable: 'You need more coins for that purchase.',
      'already-owned': 'You already own that item.',
      'already-equipped': 'That item is already equipped.',
    };
    shopMessage.textContent = notices[result.status] ?? 'That change is unavailable.';
    const updated = shopList.querySelector(`[data-item="${id}"]`);
    const next = updated.querySelector('button:not(:disabled)') ?? updated;
    next.focus({ preventScroll: true });
  } catch {
    if (current === shopGeneration) shopMessage.textContent = 'Couldn’t save that change. Try again.';
  } finally {
    if (current === shopGeneration) shopBusy = false;
  }
});

async function api(action, data = {}, auth = token) {
  const response = await fetch(endpoint, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(auth && { Authorization: `Bearer ${auth}` }) },
    body: JSON.stringify({ action, ...data }), signal: AbortSignal.timeout(6500),
  });
  if (!response.ok) throw Error('Ranking connection interrupted.');
  return response.json();
}

function positionLine() {
  const scene = scenes[state?.fish?.depth ?? state?.index];
  if (!scene || !state.fish) {
    bobber.hidden = true;
    return;
  }
  const water = lake.getBoundingClientRect();
  const encounter = scene.getBoundingClientRect();
  const hole = iceCeiling.getBoundingClientRect();
  bobber.style.setProperty('--line-start', `${hole.top - water.top + hole.height * 20 / 110}px`);
  bobber.style.setProperty('--line-depth', `${encounter.top - water.top + encounter.height * .44}px`);
}

function campaignSearchEye(hole) {
  const water = lake.getBoundingClientRect();
  const top = Math.max(window.visualViewport?.offsetTop ?? 0, water.top);
  const bottom = Math.min(tray.getBoundingClientRect().top, water.bottom);
  return { x: hole.left + hole.width * .62, y: Math.max(water.top + 35, top + (bottom - top) * .52) };
}

// Mouth coordinates in each fish's SVG viewBox, relative to the drawn image.
const fishMouths = {
  perch: [16 / 172, 37 / 66], 'rock-bass': [8 / 160, 53 / 92], walleye: [14 / 172, 39 / 66],
  pike: [7 / 230, 42 / 72], smallmouth: [8 / 172, 48 / 80], muskie: [7 / 245, 42 / 72],
};
const lureEyes = { jig: [8, 3], spoon: [14, 3], minnow: [4, 12] };

function campaignMouth() {
  const fish = target.getBoundingClientRect();
  const [x, y] = fishMouths[state.fish.id];
  return { x: fish.left + fish.width * x, y: fish.top + fish.height * y };
}

function drawCampaignLine(eye, slack = 0) {
  const visible = !tray.hidden && mode === 'campaign' && state?.fish && !failed && state.stage !== 'landed';
  line.toggleAttribute('hidden', !visible);
  if (!visible) return;

  // All points use the same unscaled SVG coordinate space inside the lake.
  const water = lake.getBoundingClientRect();
  const hole = iceCeiling.getBoundingClientRect();
  const x0 = hole.left + hole.width * .62 - water.left;
  const y0 = hole.top + hole.height * 20 / 110 - water.top;
  const elapsed = (performance.now() - jigAt) / 340;
  const bounce = elapsed < 1 ? 12 * Math.sin(Math.PI * elapsed) : 0;
  const end = eye ?? campaignSearchEye(hole);
  const x = end.x - water.left;
  const y = end.y - water.top - (eye ? 0 : bounce);
  linePath.setAttribute('d', `M${x0} ${y0} Q${x0 + slack} ${y0 + (y - y0) * .72} ${x} ${y}`);
  lineRig.setAttribute('transform', `translate(${x} ${y})`);
  const [lureX, lureY] = lureEyes[lure];
  lineLure.setAttribute('href', `./assets/tackle-icons.svg#${lure}`);
  lineLure.setAttribute('x', -lureX);
  lineLure.setAttribute('y', -lureY);
  lineLure.toggleAttribute('hidden', Boolean(eye));
}

function positionCampaignLine() {
  const attached = mode === 'campaign' && target && ['bite', 'fight'].includes(state?.stage);
  const fight = attached && state.fight;
  let curve = 0;
  if (fight) {
    target.classList.add('is-hooked');
    target.style.setProperty('--fight-x', `${fight.x * Math.min(82, innerWidth * .10)}px`);
    target.style.setProperty('--fight-y', `${fight.y * 16}px`);
    const loadRatio = Math.min(1, fight.tension / fight.lineStrength);
    curve = Math.min(54, fight.slack * 7 + (1 - loadRatio) * 14);
  }
  drawCampaignLine(attached ? campaignMouth() : undefined, curve);
}

function fightCue(fight) {
  if (fight.tight) return 'Line tight. Loosen.';
  return fight.pullUp ? 'Line clear. Pull up.' : 'Line clear. Reel.';
}

function setAction(actionIcon, label) {
  if (action.lastElementChild?.textContent !== label) {
    action.innerHTML = `${icon(actionIcon)}<span>${label}</span>`;
  }
}

function renderCampaignLoad() {
  const load = state?.fight?.tension ?? state?.snap?.tension ?? 0;
  meter.max = state?.lineStrength ?? 8;
  meter.high = 4.8;
  meter.value = load;
  const reading = `${load} / ${meter.max} lb`;
  if (pullsText.textContent !== reading) pullsText.textContent = reading;
}

function animateCampaignFight() {
  if (tray.hidden || mode !== 'campaign' || state?.stage !== 'fight') return;
  if (advanceCampaignFight(run, Date.now())) {
    state = publicRun(run);
    if (!state.fight) {
      const focused = document.activeElement;
      swimAway();
      render();
      if (focused === loosen) action.focus({ preventScroll: true });
      return;
    }
    const { fight } = state;
    renderCampaignLoad();
    setStatus(fightCue(fight));
    setAction(fight.pullUp ? 'lift' : 'reel', fight.pullUp ? 'Pull up' : 'Reel');
    action.classList.toggle('fishing-action-quiet', fight.tight);
    loosen.classList.toggle('fishing-recommended', fight.tight);
    positionCampaignLine();
  }
  fightFrame = requestAnimationFrame(animateCampaignFight);
}

function jigCampaignLine() {
  cancelAnimationFrame(rigFrame);
  if (document.body.hasAttribute('data-reduced') || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  jigAt = performance.now();
  const animate = () => {
    positionCampaignLine();
    if (performance.now() - jigAt < 340) rigFrame = requestAnimationFrame(animate);
  };
  rigFrame = requestAnimationFrame(animate);
}

function fishToLure() {
  const eye = campaignSearchEye(iceCeiling.getBoundingClientRect());
  const fish = target.getBoundingClientRect();
  const scene = target.parentElement.getBoundingClientRect();
  const [x, y] = fishMouths[state.fish.id];
  target.style.setProperty('--bite-x', `calc(var(--line-x) + ${fish.width * (.5 - x)}px)`);
  target.style.setProperty('--bite-y', `${eye.y - scene.top + fish.height * (.5 - y)}px`);
}

function setStatus(message) {
  if (status.textContent !== message) status.textContent = message;
}

function stopCountdown() {
  clearTimeout(countdownTimer);
  rankedSeekUntil = rankedServerSeekUntil = undefined;
  countdown.hidden = true;
}

function updateCountdown() {
  const deadline = token ? rankedSeekUntil : state?.seekUntil;
  if (tray.hidden || failed || state?.stage !== 'seek' || !Number.isFinite(deadline)) {
    countdown.hidden = true;
    return;
  }
  const remaining = deadline - (token ? performance.now() : Date.now());
  countdown.hidden = false;
  countdown.textContent = `Fish leaves in ${Math.max(0, Math.ceil(remaining / 1000))}s`;
  if (remaining <= 0) {
    if (!busy) void perform('expire');
  } else {
    countdownTimer = setTimeout(updateCountdown, remaining % 1000 || 1000);
  }
}

function syncCountdown(serverNow) {
  clearTimeout(countdownTimer);
  if (Number.isFinite(serverNow) && Number.isFinite(state?.seekUntil)) {
    const receivedDeadline = performance.now() + Math.max(0, state.seekUntil - serverNow);
    // A slow response can only tighten an existing countdown, never add time to it.
    rankedSeekUntil = state.seekUntil === rankedServerSeekUntil
      ? Math.min(rankedSeekUntil, receivedDeadline) : receivedDeadline;
    rankedServerSeekUntil = state.seekUntil;
  }
  updateCountdown();
  updateSearch();
}

function fishInView() {
  if (!target || target.hidden) return false;
  const { left, top, width, height } = target.getBoundingClientRect();
  const x = left + width / 2;
  const y = top + height / 2;
  const {
    offsetLeft = 0, offsetTop = 0, width: viewWidth = innerWidth, height: viewHeight = innerHeight,
  } = window.visualViewport ?? {};
  return x >= offsetLeft && x < offsetLeft + viewWidth
    && y >= offsetTop && y < Math.min(offsetTop + viewHeight, tray.getBoundingClientRect().top);
}

function updateSearch() {
  if (tray.hidden) return;
  const searching = !failed && state?.stage === 'seek';
  const inView = searching && fishInView();
  if (searching && !inView) action.setAttribute('aria-disabled', 'true');
  else action.removeAttribute('aria-disabled');
  bobber.hidden = mode === 'campaign' || !state?.fish || (searching && !inView);
  positionCampaignLine();
  if (searching) setStatus(inView ? practiceError ?? state.cue : 'Scroll up or down to find the fish.');
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
  if (mode === 'campaign') positionCampaignLine();
  if (elapsed < state.window.until || (!token && elapsed === state.window.until)) {
    frame = requestAnimationFrame(animateBite);
  }
}

function removeTarget() {
  clearTimeout(escapeTimer);
  target?.remove();
  target = null;
}

function swimAway() {
  if (!target || document.body.hasAttribute('data-reduced') || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    removeTarget();
    return;
  }
  target.classList.remove('is-curious', 'is-biting');
  target.classList.add('is-escaping');
  escapeTimer = setTimeout(removeTarget, 450);
}

function placeFish() {
  removeTarget();
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
  target.addEventListener('animationend', updateSearch);
  target.addEventListener('transitionend', updateSearch);
  scenes[state.fish.depth ?? state.index].append(target);
}

function render() {
  const campaign = mode === 'campaign';
  const modeName = { campaign: 'Campaign', practice: 'Practice', ranked: 'Ranked' }[mode];
  tray.dataset.mode = mode;
  tray.querySelector('[data-score]').textContent = state
    ? `${state.lake} · ${modeName} · ${state.score} pts · ${Math.min(state.index + 1, state.count)}/${state.count}`
    : 'Fishing beneath the ice';
  const practiceFight = !campaign && !token && state?.stage === 'fight';
  const tight = campaign ? state?.fight?.tight : practiceFight && state.fight.tension >= 60;
  const pullUp = campaign ? state?.fight?.pullUp : state?.fight?.pulls === 1;
  const practiceBite = !token && state?.stage === 'bite';
  let cue = state?.cue ?? 'Opening the lake…';
  if (failed) cue = 'Ranking disconnected. You can start a practice outing.';
  else if (campaign && state?.fight) cue = fightCue(state.fight);
  else if (practiceError) cue = practiceError;
  else if (practiceFight) cue = tight ? 'Tight line. Loosen.' : `Line clear. ${pullUp ? 'Pull up' : 'Reel'}.`;
  else if (state?.stage === 'landed' && cue.endsWith('points')) {
    cue = `All right! ${cue}`;
    if (campaign && Number.isFinite(catchReward)) cue += ` · +${coins(catchReward)}`;
    if (state.practice?.xp === practiceLevelXp) {
      if (state.skillPoints) cue += '. Level 2! Choose a skill.';
      else cue += `. ${state.skills.control ? skills.control : skills.lift} selected.`;
    }
  }
  if ((state?.stage !== 'seek' || failed) && (!practiceBite || practiceError)) setStatus(cue);
  wallet.hidden = !campaign || !profile;
  if (campaign && profile) wallet.textContent = coins(profile.coins);
  practiceProgress.hidden = !state?.practice || failed;
  if (state?.practice) {
    const { xp, level } = state.practice;
    const progress = level === 1 ? `${xp} / ${practiceLevelXp} XP to Level 2` : `Level 2 · ${xp} XP`;
    if (practiceProgress.textContent !== progress) practiceProgress.textContent = progress;
  }
  const [actionIcon, label] = failed ? ['next', 'Practice'] : ({
    seek: ['jig', 'Jig'], bite: ['reel', 'Reel'], fight: pullUp ? ['lift', 'Pull up'] : ['reel', 'Reel'],
    landed: ['next', 'Next fish'], missed: ['next', 'Next fish'], done: ['next', 'Fish again'],
  }[state?.stage] ?? ['next', 'Wait']);
  setAction(actionIcon, label);
  action.disabled = busy || !state;
  action.closest('.fishing-tools').toggleAttribute('data-practice-fight', practiceFight);
  action.classList.toggle('fishing-action-quiet', tight);
  loosen.classList.toggle('fishing-recommended', tight);
  if (practiceBite && !practiceError) showPracticeBite(Date.now() - biteAt);
  if (bobber.dataset.lure !== lure) {
    bobber.dataset.lure = lure;
    bobber.innerHTML = icon(lure);
  }
  pressure.hidden = (!campaign && !state?.fight) || failed;
  loosen.hidden = !campaign && pressure.hidden;
  loosen.disabled = busy || !state?.fight;
  if (campaign) {
    renderCampaignLoad();
  } else if (state?.fight) {
    const { tension, pulls } = state.fight;
    meter.max = 100;
    meter.high = 60;
    meter.value = tension;
    pullsText.textContent = practiceFight
      ? `${pulls} ${pulls === 1 ? 'pull' : 'pulls'} left`
      : `${tension >= 60 ? 'Tight line' : 'Line clear'} · ${pulls} to land`;
  }
  slots.forEach(slot => {
    slot.hidden = !campaign && !pressure.hidden;
    slot.disabled = busy || state?.stage !== 'seek';
    slot.setAttribute('aria-pressed', String(slot.dataset.lure === lure));
  });
  target?.classList.toggle('is-biting', ['bite', 'fight'].includes(state?.stage));
  if (target) target.hidden = state?.stage === 'landed';
  const canUpgrade = state?.stage === 'landed' && state.skillPoints && !failed;
  skillRow.hidden = campaign || !canUpgrade || Boolean(state?.practice);
  practiceChoice.hidden = !canUpgrade || !state?.practice;
  for (const button of practiceButtons) button.disabled = busy;
  for (const button of skillRow.children) {
    const skill = button.dataset.skill;
    const level = state?.skills[skill] ?? 0;
    button.querySelector('span').textContent = `${skills[skill]} ${level}/2`;
    button.disabled = busy || level === 2;
  }
  if (state) timing.style.setProperty('--window-start', `${state.window.from / state.window.until * 100}%`);
  timing.hidden = state?.stage !== 'bite' || failed;
  form.hidden = !token || state?.stage !== 'done' || state.score <= 0 || state.submitted || failed;
  log.hidden = !state?.discoveries.length;
  log.querySelector('ul').replaceChildren(...(state?.discoveries ?? []).map(entry => {
    const li = document.createElement('li');
    li.textContent = `${entry.fish} · ${lures[entry.lure]}`;
    return li;
  }));
  updateSearch();
}

async function begin(selectedMode = mode) {
  const fromAction = document.activeElement === action;
  dismissCelebration();
  clearBite();
  stopCountdown();
  cancelAnimationFrame(rigFrame);
  cancelAnimationFrame(fightFrame);
  jigAt = -Infinity;
  jigActivation = fightActivation = false;
  practiceError = undefined;
  profile = outingId = catchReward = undefined;
  const current = ++generation;
  busy = true;
  failed = false;
  mode = selectedMode;
  token = null;
  state = null;
  board.hidden = true;
  removeTarget();
  render();
  let serverNow;
  if (mode === 'campaign') {
    try {
      const loaded = await loadProfile();
      if (current !== generation) return;
      profile = loaded;
      outingId = crypto.randomUUID();
    } catch {
      if (current !== generation) return;
      busy = false;
      setStatus('Couldn’t open your saved tackle. Exit fishing and try Campaign again.');
      return;
    }
  }
  if (endpoint && mode === 'ranked') {
    try {
      const opened = await api('start', {}, null);
      if (current !== generation) return;
      ({ token, state, serverNow } = opened);
    } catch {
      if (current !== generation) return;
    }
  }
  if (!state) {
    if (mode === 'ranked') mode = 'practice';
    lure = 'jig';
    const lineStrength = shopItems.find(item => item.id === profile?.equipped.line)?.strength;
    run = start(Date.now(), undefined, undefined, {
      practice: mode === 'practice',
      campaign: mode === 'campaign' ? { lineStrength } : undefined,
    });
    state = publicRun(run);
  }
  busy = false;
  placeFish();
  window.scrollTo({ top: 0, behavior: 'instant' });
  render();
  syncCountdown(serverNow);
  if (!token && fromAction && document.activeElement === document.body) action.focus({ preventScroll: true });
}

function enter(event) {
  event.preventDefault();
  launch = event.currentTarget;
  previousScroll = window.scrollY;
  picker.showModal();
}

function startSelected(selectedMode) {
  picker.close();
  tray.hidden = false;
  document.body.classList.add('fishing');
  exit.focus({ preventScroll: true });
  begin(selectedMode);
}

function leave() {
  dismissCelebration();
  generation++;
  clearBite();
  stopCountdown();
  cancelAnimationFrame(rigFrame);
  cancelAnimationFrame(fightFrame);
  removeTarget();
  tray.hidden = bobber.hidden = true;
  line.setAttribute('hidden', '');
  document.body.classList.remove('fishing');
  window.scrollTo({ top: previousScroll, behavior: 'instant' });
  launch.focus({ preventScroll: true });
}

document.querySelectorAll('.game-entry, .fish-entry').forEach(entry => entry.addEventListener('click', enter));
picker.addEventListener('click', event => {
  if (event.target.closest('[data-open-shop]')) return openShop();
  const choice = event.target.closest('button[data-mode]');
  if (choice) startSelected(choice.dataset.mode);
});
exit.addEventListener('click', leave);
document.addEventListener('keydown', event => {
  if (tray.hidden) return;
  if (event.key === 'Escape') return leave();
  if (Object.hasOwn(scrollKeys, event.key) && !event.defaultPrevented
    && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey
    && !event.target.closest('input')) {
    // Keep a page step inside the visible water and avoid a scroll that outlasts the game.
    const step = event.key.startsWith('Arrow') ? 48
      : event.key.startsWith('Page') ? tray.getBoundingClientRect().top * .85
      : document.documentElement.scrollHeight;
    event.preventDefault();
    window.scrollBy({ top: step * scrollKeys[event.key], behavior: 'instant' });
    updateSearch();
  }
  if (!token && event.repeat && ['Enter', ' '].includes(event.key) && tray.contains(event.target)) {
    event.preventDefault();
  }
});
window.addEventListener('scroll', updateSearch, { passive: true });
window.addEventListener('resize', () => {
  positionLine();
  updateSearch();
});
window.visualViewport?.addEventListener('scroll', updateSearch, { passive: true });
window.visualViewport?.addEventListener('resize', updateSearch);
const lineResize = new ResizeObserver(() => {
  if (mode === 'campaign') updateSearch();
});
lineResize.observe(lake);
lineResize.observe(tray);
log.addEventListener('toggle', updateSearch);
slots.forEach(slot => slot.addEventListener('click', () => {
  lure = slot.dataset.lure;
  render();
}));

async function perform(move, input = {}) {
  const prior = state;
  const focused = document.activeElement;
  const current = generation;
  if (move === 'jig') {
    if (mode === 'campaign') jigCampaignLine();
    else {
      bobber.classList.remove('is-jigging');
      void bobber.offsetWidth;
      bobber.classList.add('is-jigging');
    }
    target?.classList.remove('is-curious');
    if (target) void target.offsetWidth;
    target?.classList.add('is-curious');
  }
  busy = true;
  render();
  const sentAt = performance.now();
  const appliedAt = Date.now();
  let serverNow;
  try {
    const result = token
      ? await api(move, { ...input, version: state.version })
      : { state: apply(run, { action: move, ...input }, appliedAt) };
    if (current !== generation) return;
    ({ state, serverNow } = result);
    practiceError = undefined;
    if (!token && move === 'jig' && state.stage === 'seek') {
      state = { ...state, cue: 'It looked. Try a different lure and jig again.' };
    }
    if (mode === 'campaign' && state.stage === 'landed' && prior.stage !== 'landed') {
      const key = `${outingId}:${state.index}`;
      try {
        const result = await applyProfile({ type: 'award', key, outcome: state.stage, catch: state.catch });
        if (current !== generation) return;
        profile = result.profile;
        catchReward = result.earned;
      } catch {
        if (current !== generation) return;
        state = { ...state, cue: `${state.cue}. Couldn’t save coins for this catch.` };
      }
    }
    if (mode !== 'campaign' && state.stage === 'landed' && prior.stage !== 'landed') {
      if (!state.practice) celebrateCatch(state.index + 2);
      else if (state.practice.xp === practiceLevelXp) celebrateCatch(state.practice.level, true);
    }
    if (state.index !== prior.index) dismissCelebration();
    if (state.stage === 'missed' || (state.stage === 'done' && prior.stage !== 'landed')) swimAway();
    else if (state.index !== prior.index) placeFish();
    if (state.stage === 'bite') {
      if (mode === 'campaign') fishToLure();
      biteAt = token ? sentAt : appliedAt;
      clearBite();
      animateBite();
    } else if (prior.stage === 'bite') {
      clearBite();
      if (mode === 'campaign' && state.stage === 'fight') {
        fightFrame = requestAnimationFrame(animateCampaignFight);
      }
    }
  } catch (error) {
    if (current !== generation) return;
    if (token) failed = true;
    else {
      practiceError = error.message;
      if (appliedAt >= run.expires) {
        state = { ...state, stage: 'done', fish: null, fight: null };
        clearBite();
        removeTarget();
      }
    }
  }
  busy = false;
  render();
  syncCountdown(serverNow);
  if (focused === action || (move === 'upgrade' && skillRow.hidden && practiceChoice.hidden)) {
    action.focus({ preventScroll: true });
  }
  if (focused === loosen) (loosen.disabled || loosen.hidden ? action : loosen).focus({ preventScroll: true });
}

loosen.addEventListener('click', () => perform('loosen'));

function rememberAction() {
  jigActivation = state?.stage === 'seek';
  fightActivation = mode === 'campaign' && state?.stage === 'fight';
}
action.addEventListener('pointerdown', event => {
  if (event.isPrimary && event.button === 0) rememberAction();
});
action.addEventListener('pointercancel', () => { jigActivation = fightActivation = false; });
action.addEventListener('keydown', event => {
  if (!event.repeat && ['Enter', ' '].includes(event.key)) rememberAction();
});
action.addEventListener('click', () => {
  const startedBeforeMiss = jigActivation || fightActivation;
  jigActivation = fightActivation = false;
  if (startedBeforeMiss && ['missed', 'done'].includes(state.stage)) return;
  if (failed || state.stage === 'done') return begin(failed ? 'practice' : mode);
  if (state.stage === 'seek' && !fishInView()) return updateSearch();
  const fightMove = mode === 'campaign' && !state.fight?.pullUp ? 'reel' : 'lift';
  const move = { seek: 'jig', bite: 'reel', fight: fightMove, landed: 'next', missed: 'next' }[state.stage];
  return perform(move, move === 'jig' ? { lure } : {});
});
for (const button of [...skillRow.children, ...practiceButtons]) {
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
