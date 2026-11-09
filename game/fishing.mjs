import { createSuspensionClock } from './suspension.mjs';
import { advanceLineFight, apply, campaignAreas, campaignPhase, lakes, lures, practiceLevelXp, practiceSkills, publicRun, skills, start, starterArea } from './rules.mjs?v=lake-balance';
import { applyProfile, loadProfile, shopItems } from './profile.mjs?v=16';
import { lureTip } from './species-catalog.mjs';

const outingTime = createSuspensionClock();
const endpoint = document.querySelector('meta[name="fishing-api"]')?.content;
const lake = document.querySelector('.lake');
const water = [...lake.querySelectorAll(':scope > .dive')];
const scenes = water.slice(0, 6);
const backgroundFish = {
  pike: [['pike', 78, 56]],
  perch: [['perch', 23, 27], ['rock-bass', 76, 75]],
  weeds: [['smallmouth', 78, 30], ['perch', 30, 70]],
  midwater: [['pike', 21, 29], ['walleye', 76, 74]],
  camera: [['rock-bass', 27, 34], ['smallmouth', 84, 79]],
  coldwater: [['walleye', 77, 26], ['muskie', 23, 73]],
  bottomfish: [['muskie', 76, 31], ['rock-bass', 22, 71]],
};

const fishArt = new Map(lakes['mille-lacs'].fish.map(({ id, art }) => [id, art]));
const fishSvg = ([file, symbol, box]) =>
  `<svg viewBox="${box}" aria-hidden="true"><use href="./assets/${file}.svg#${symbol}"/></svg>`;

for (const band of water) {
  for (const [id, x, y] of backgroundFish[band.dataset.dive] ?? []) {
    const fish = document.createElement('div');
    fish.className = 'fishing-background-fish';
    fish.setAttribute('aria-hidden', 'true');
    fish.toggleAttribute('data-facing-right', x < 50);
    fish.style.left = `${x}%`;
    fish.style.top = `${y}%`;
    fish.innerHTML = fishSvg(fishArt.get(id));
    band.append(fish);
  }
}
const iceCeiling = lake.querySelector('.dive-ceiling');
const icon = id => `<svg class="tackle-icon" viewBox="0 0 24 24" aria-hidden="true"><use href="./assets/tackle-icons.svg#${id}"/></svg>`;
const reefArea = 'deep-reef';
const reefLicense = shopItems.find(item => item.area === reefArea);
const reefRequirement = `Requires the ${reefLicense.name}, ${reefLicense.cost} coins at the tackle shop.`;
const picker = document.createElement('dialog');
picker.className = 'fishing-picker';
picker.setAttribute('aria-labelledby', 'fishing-picker-title');
picker.innerHTML = `
  <div class="fishing-dialog-intro">
    <h2 id="fishing-picker-title">Choose an outing</h2>
    <img class="fishing-dialog-art" src="./assets/fishing/mille-lacs-dawn.webp" alt="" width="1104" height="460" loading="lazy">
  </div>
  <div class="fishing-picker-options">
    <button type="button" data-mode="campaign" data-area="${starterArea}" aria-describedby="campaign-description">Campaign</button>
    <p id="campaign-description">Fish ${campaignAreas[starterArea].name} on Mille Lacs with your own tackle.</p>
    <button type="button" data-mode="campaign" data-area="${reefArea}" aria-describedby="reef-description">${campaignAreas[reefArea].name}</button>
    <p id="reef-description">${reefRequirement}</p>
    <button type="button" data-open-shop aria-describedby="shop-description">Tackle shop</button>
    <p id="shop-description">Spend coins and choose your gear between outings.</p>
    <button type="button" data-mode="practice" aria-describedby="practice-description">Practice</button>
    <p id="practice-description">Practice the Campaign controls with starter gear.</p>
    ${endpoint ? `<button type="button" data-mode="ranked" aria-describedby="ranked-description">Ranked</button>
      <p id="ranked-description">Fish for a score on the public board.</p>` : ''}
  </div>
  <form method="dialog"><button>Back to the site</button></form>`;
const shop = document.createElement('dialog');
shop.className = 'fishing-picker fishing-shop';
shop.setAttribute('aria-labelledby', 'fishing-shop-title');
shop.innerHTML = `
  <div class="fishing-dialog-intro">
    <div class="fishing-shop-heading">
      <div class="fishing-shopkeeper">
        <img src="./assets/fishing/marnie.webp" alt="" width="256" height="256" loading="lazy">
        <div>
          <h2 id="fishing-shop-title" tabindex="-1" autofocus>Tackle shop</h2>
          <p><strong>Marnie</strong> · Shopkeeper</p>
        </div>
      </div>
      <strong data-shop-balance></strong>
    </div>
    <img class="fishing-dialog-art" src="./assets/fishing/tackle-shop.webp" alt="" width="1104" height="460" loading="lazy">
  </div>
  <p data-shop-message role="status"></p>
  <div data-shop-items></div>
  <form method="dialog"><button data-shop-back>Back to outings</button></form>`;
const permitDialog = document.createElement('dialog');
permitDialog.className = 'fishing-picker fishing-permit';
permitDialog.setAttribute('aria-labelledby', 'fishing-permit-title');
permitDialog.innerHTML = `
  <div class="fishing-permit-guide">
    <img src="./assets/fishing/conservation-officer.webp" alt="" width="160" height="160" loading="lazy">
    <div><h2 id="fishing-permit-title" tabindex="-1">Check your permit</h2>
      <p><strong>Officer Rowan</strong> · Fictional conservation guide</p></div>
  </div>
  <p data-permit-message role="status"></p>
  <div class="fishing-permit-actions">
    <button type="button" data-permit-shop>Get this permit</button>
    <button type="button" data-permit-starter hidden>Choose Starter Shore</button>
    <button type="button" data-permit-back>Back to areas</button>
  </div>
  <p class="fishing-permit-note">These permits unlock game areas with game coins. For real fishing, check
    <a href="https://www.dnr.state.mn.us/regulations/fishing/index.html" target="_blank" rel="noopener">Minnesota DNR requirements</a>
    and <a href="https://www.dnr.state.mn.us/fishing/millelacs.html" target="_blank" rel="noopener">Mille Lacs rules</a>.</p>`;

const pause = document.createElement('dialog');
pause.className = 'fishing-picker fishing-pause';
pause.setAttribute('aria-labelledby', 'fishing-pause-title');
pause.innerHTML = `
  <h2 id="fishing-pause-title" tabindex="-1">Paused</h2>
  <section data-pause-panel="menu">
    <p>Your fish and the outing clock will wait here.</p>
    <div class="fishing-menu-actions">
      <button type="button" data-action="resume">Resume fishing</button>
      <button type="button" data-action="gear">${icon('gear')} Gear</button>
      <button type="button" data-action="shop">${icon('shop')} Tackle shop</button>
      <button type="button" data-action="your-lake" data-open-your-lake>${icon('your-lake')} Your Lake</button>
      <button type="button" data-action="controls">${icon('controls')} Controls</button>
      <button type="button" data-action="leave">Leave outing</button>
    </div>
  </section>
  <section data-pause-panel="gear" hidden>
    <div data-gear-content></div>
    <button type="button" data-action="back">Back to Pause</button>
  </section>
  <section data-pause-panel="controls" hidden>
    <p>Scroll the lake to find the larger fish. Choose a lure, then jig. Reel in the gold window. Loosen a tight line; reel when it clears.</p>
    <dl class="fishing-controls-list">
      <dt><kbd>J</kbd></dt><dd>Jig while searching</dd>
      <dt><kbd>R</kbd></dt><dd>Reel at the bite or in a fight; pull up at the hole</dd>
      <dt><kbd>L</kbd></dt><dd>Loosen during a fight</dd>
      <dt><kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd></dt><dd>Jig, Spoon, Minnow while searching</dd>
      <dt><kbd>Esc</kbd></dt><dd>Menu / Back / Resume</dd>
      <dt>Arrows / Page keys</dt><dd>Scroll the lake; Left / Right browse a focused hook carousel</dd>
    </dl>
    <p>Touch uses the labeled fishing buttons. Details shows each item’s effect. Campaign tackle changes apply to the next outing. Practice uses starter tackle and its own Level 2 skill choice. Ranked uses server timing and an Exit button.</p>
    <button type="button" data-action="back">Back to Pause</button>
  </section>`;
const itemDetails = document.createElement('dialog');
itemDetails.className = 'fishing-picker fishing-item-details';
itemDetails.setAttribute('aria-labelledby', 'fishing-item-title');
itemDetails.innerHTML = '<h2 id="fishing-item-title"></h2><div data-item-description></div><form method="dialog"><button>Back to item</button></form>';
const tray = document.createElement('section');
tray.className = 'fishing-tray';
tray.hidden = true;
tray.setAttribute('aria-label', 'Fishing controls');
tray.innerHTML = `
  <div class="fishing-tray-inner">
    <div class="fishing-row fishing-heading">
      <img class="fishing-brand" src="./assets/fwbp-logo.jpg" alt="" width="27" height="27">
      <strong data-score><span data-water></span><span class="fishing-score-progress"><span class="fishing-score-divider" aria-hidden="true"> · </span><span data-run-progress></span></span></strong>
      <button type="button" data-exit>Exit fishing</button>
    </div>
    <div class="fishing-dialogue">
      <span class="fishing-portrait" hidden><img src="./assets/branding/bryan-front-facing.webp" data-portrait="front-facing" alt="" width="56" height="56" loading="lazy"></span>
      <div class="fishing-speech">
        <span class="fishing-speaker" aria-hidden="true" hidden>Bryan</span>
        <div class="fishing-status" role="status" aria-atomic="true"><p class="fishing-words"></p><p class="fishing-result" hidden></p></div>
      </div>
    </div>
    <div class="fishing-row fishing-encounter">
      <p class="fishing-wallet" data-wallet hidden></p>
      <p data-phase aria-live="polite" hidden></p>
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
</g><g class="fishing-line-callout" hidden>
  <path d="M-4 -3l-13 -12h-8"/><text x="-29" y="-12" text-anchor="end"></text>
</g>`;
lake.append(line);
const linePath = line.querySelector('path');
const lineRig = line.querySelector('g');
const lineLure = line.querySelector('use');
const lineCallout = line.querySelector('.fishing-line-callout');
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
document.body.append(picker, pause, shop, itemDetails, permitDialog, tray, celebration, announcement);

let celebrationTimer;

function dismissCelebration() {
  outingTime.cancel(celebrationTimer);
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
  celebrationTimer = outingTime.timeout(dismissCelebration, 3600);
}

const action = tray.querySelector('.fishing-action');
const loosen = tray.querySelector('[data-loosen]');
const pressure = tray.querySelector('.fishing-pressure');
const meter = pressure.querySelector('meter');
const pullsText = pressure.querySelector('[data-pulls]');
const timing = tray.querySelector('.fishing-timing');
const status = tray.querySelector('.fishing-status');
const words = status.querySelector('.fishing-words');
const result = status.querySelector('.fishing-result');
const speech = tray.querySelector('.fishing-speech');
const portrait = tray.querySelector('.fishing-portrait');
const speaker = tray.querySelector('.fishing-speaker');
const actionRack = tray.querySelector('.fishing-actions');
const tackleRack = tray.querySelector('.fishing-rack');
const exit = tray.querySelector('[data-exit]');
const form = tray.querySelector('form');
const log = tray.querySelector('details');
const board = tray.querySelector('[data-board]');
const skillRow = tray.querySelector('.fishing-skills');
const practiceChoice = tray.querySelector('.fishing-practice-choice');
const practiceProgress = tray.querySelector('.fishing-practice-progress');
const wallet = tray.querySelector('[data-wallet]');
const waterName = tray.querySelector('[data-water]');
const scoreProgress = tray.querySelector('.fishing-score-progress');
const runProgress = tray.querySelector('[data-run-progress]');
const phaseLabel = tray.querySelector('[data-phase]');
const countdown = tray.querySelector('.fishing-countdown');
const practiceButtons = [...practiceChoice.querySelectorAll('button')];
const slots = [...tray.querySelectorAll('[data-lure]')];
let launch, previousScroll, run, state, token, target, busy, failed, biteAt, frame;
let mode, rigFrame, fightFrame, jigAt = -Infinity;
let retractTimer, retractFrame, retractAt;
let lastTouchY;
let profile, outingId, catchReward, catchSaveFailed;
let biteDepth;
let encounterTip;
const studiedCue = document.createElement('p');
studiedCue.className = 'fishing-studied-cue';
studiedCue.hidden = true;
status.after(studiedCue);
// Learning affects the next encounter, never the fish already on screen.
document.addEventListener('fishing:profile-changed', event => {
  if (usesLinePhysics()) profile = event.detail.profile;
});
let campaignArea = starterArea;
let permitArea = starterArea;
let permitGeneration = 0;
let campaignMilestoneNotice = false;
let pickerGeneration = 0;
let clock, clockWrite, suspendedClock;
let shopBusy = false;
let shopGeneration = 0;
let shopReturn, shopRelease, pauseRelease, pauseOpener, detailsOpener;
let outingEquipment;
let pausePanel = 'menu';
let pauseGeneration = 0;
let hookSelection = 'starter-hook';
let detailsPress;
let pausedAnimations = [];

export function acquireSuspension() {
  if (tray.hidden || !usesLinePhysics()) return () => {};
  const first = !outingTime.suspended;
  const releaseTime = outingTime.acquire();
  if (first) {
    pausedAnimations = [...lake.getAnimations({ subtree: true }), ...celebration.getAnimations({ subtree: true })]
      .filter(animation => animation.playState === 'running');
    pausedAnimations.forEach(animation => animation.pause());
    document.body.setAttribute('data-fishing-paused', '');
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    releaseTime();
    if (!outingTime.suspended) {
      document.body.removeAttribute('data-fishing-paused');
      pausedAnimations.forEach(animation => { if (animation.playState === 'paused') animation.play(); });
      pausedAnimations = [];
    }
  };
}

const dialogOpen = () => Boolean(document.querySelector('dialog[open]'));
const gameBlocked = () => tray.hidden || busy || outingTime.suspended || dialogOpen();

let countdownTimer, rankedSeekUntil, rankedServerSeekUntil, escapeTimer;
let jigActivation = false;
let fightActivation = false;
let lure = 'jig';
let practiceError;
let generation = 0;
const shortLandscape = window.matchMedia('(min-width: 480px) and (max-height: 420px) and (orientation: landscape)');
const scrollKeys = { ArrowUp: -1, ArrowDown: 1, PageUp: -1, PageDown: 1, Home: -1, End: 1 };

const usesLinePhysics = () => mode === 'campaign' || mode === 'practice';

const phaseNames = { day: 'Day', dusk: 'Dusk', night: 'Night' };

function outingElapsed() {
  if (!clock) return mode === 'campaign' ? profile?.elapsedMs ?? 0 : 0;
  return Math.floor(Math.min(outingTime.now(), clock.until) - clock.origin);
}

function showPhase(phase) {
  if (phaseLabel.dataset.phase === phase) return;
  phaseLabel.dataset.phase = phase;
  phaseLabel.textContent = phaseNames[phase];
  lake.dataset.fishingLight = phase;
}

function saveCampaignClock(elapsedMs) {
  clockWrite = applyProfile({ type: 'clock', elapsedMs }).catch(() => undefined);
  return clockWrite;
}

function tickOutingClock() {
  const current = clock;
  if (outingTime.now() >= current.until) {
    // An expired clock must not discard a landed catch whose payout is still pending.
    if (state?.stage === 'landed' && (busy || catchSaveFailed)) {
      stopOutingClock();
      return;
    }
    state = { ...state, stage: 'done', fish: null, fight: null, snap: null, cue: 'This outing expired.' };
    clearBite();
    stopCountdown();
    removeTarget();
    render();
    return;
  }
  const elapsedMs = outingElapsed();
  const phase = campaignPhase(elapsedMs);
  if (phase === current.phase && elapsedMs - current.checkpoint < 5000) return;
  current.phase = phase;
  current.checkpoint = elapsedMs;
  if (!current.save) {
    showPhase(phase);
    return;
  }
  // Persist each phase before showing it so reloading resumes the light the angler saw.
  void saveCampaignClock(elapsedMs).then(() => {
    if (clock === current && current.phase === phase) showPhase(phase);
  });
}

function startOutingClock(elapsedMs) {
  const phase = campaignPhase(elapsedMs);
  const now = outingTime.now();
  clock = {
    origin: now - elapsedMs, until: now + Math.max(0, run.expires - outingTime.dateNow()), phase, checkpoint: elapsedMs,
    save: mode === 'campaign', timer: outingTime.interval(tickOutingClock, 250),
  };
  showPhase(phase);
}

function stopOutingClock() {
  if (!clock) return clockWrite;
  const elapsedMs = outingElapsed();
  const { save, timer } = clock;
  outingTime.clearInterval(timer);
  clock = undefined;
  return save ? saveCampaignClock(elapsedMs) : clockWrite;
}

const coins = amount => `${amount} ${amount === 1 ? 'coin' : 'coins'}`;
const shopLabels = { line: 'Fishing line', hook: 'Hooks', training: 'Training', license: 'Licenses' };
const shopBalance = shop.querySelector('[data-shop-balance]');
const shopMessage = shop.querySelector('[data-shop-message]');
const shopList = shop.querySelector('[data-shop-items]');
const reefDescription = picker.querySelector('#reef-description');

function areaPermit(area) {
  if (!Object.hasOwn(campaignAreas, area)) return undefined;
  return shopItems.find(item => item.category === 'license' && item.area === area);
}

function hasAreaAccess(savedProfile, area) {
  const permit = areaPermit(area);
  return Boolean(permit && savedProfile?.owned.includes(permit.id));
}

function showOutingPicker(focusArea) {
  const current = ++pickerGeneration;
  if (!picker.open) picker.showModal();
  if (focusArea) picker.querySelector(`[data-area="${focusArea}"]`)?.focus();
  void loadProfile().then(savedProfile => {
    if (current !== pickerGeneration || !picker.open) return;
    for (const entry of picker.querySelectorAll('[data-area]')) {
      const owned = hasAreaAccess(savedProfile, entry.dataset.area);
      // Locked areas remain actionable so keyboard and touch can reach the guide.
      entry.toggleAttribute('data-permit-required', !owned);
      entry.removeAttribute('aria-disabled');
    }
    const unlocked = hasAreaAccess(savedProfile, reefArea);
    reefDescription.textContent = unlocked ? 'Look for fish around a deeper reef on Mille Lacs.' : reefRequirement;
    picker.querySelector('#campaign-description').textContent = hasAreaAccess(savedProfile, starterArea)
      ? `Fish ${campaignAreas[starterArea].name} on Mille Lacs with your own tackle.`
      : 'Claim the free Starter Shore permit before your first Campaign outing.';
  }).catch(() => {
    if (current !== pickerGeneration || !picker.open) return;
    reefDescription.textContent = 'Couldn’t read your permits. Choose an area to try again.';
  });
}

const permitMessage = permitDialog.querySelector('[data-permit-message]');
const permitShop = permitDialog.querySelector('[data-permit-shop]');
const permitStarter = permitDialog.querySelector('[data-permit-starter]');

async function showPermit(area) {
  const permit = areaPermit(area);
  if (!permit) return showOutingPicker();
  permitArea = area;
  const current = ++permitGeneration;
  picker.close();
  if (!permitDialog.open) permitDialog.showModal();
  permitDialog.querySelector('h2').textContent = `${campaignAreas[area].name} permit`;
  permitMessage.textContent = 'Checking your saved permits…';
  permitShop.disabled = true;
  permitStarter.hidden = area === starterArea;
  permitDialog.querySelector('h2').focus();
  try {
    const saved = await loadProfile();
    if (current !== permitGeneration || !permitDialog.open) return;
    const shortfall = Math.max(0, permit.cost - saved.coins);
    permitMessage.textContent = hasAreaAccess(saved, area)
      ? `You own the ${permit.name}. Return to the areas and choose ${campaignAreas[area].name} when you’re ready.`
      : `${campaignAreas[area].name} needs the ${permit.name}. ${permit.cost === 0 ? 'It’s free' : `It costs ${coins(permit.cost)}`}. You have ${coins(saved.coins)}.${shortfall ? ` You need ${coins(shortfall)} more. Starter Shore has a free permit.` : ''}`;
    permitShop.textContent = hasAreaAccess(saved, area) ? 'View this permit' : 'Get this permit';
    permitShop.disabled = false;
  } catch {
    if (current !== permitGeneration || !permitDialog.open) return;
    permitMessage.textContent = 'Couldn’t read your saved permits. Open the shop to try again, or go back to the areas.';
    permitShop.disabled = false;
  }
}

function returnToAreas() {
  permitGeneration++;
  permitDialog.close();
  showOutingPicker(permitArea);
}

permitDialog.addEventListener('cancel', event => {
  event.preventDefault();
  returnToAreas();
});
permitDialog.querySelector('[data-permit-back]').addEventListener('click', returnToAreas);
permitShop.addEventListener('click', () => {
  const area = permitArea;
  const permit = areaPermit(area);
  permitGeneration++;
  permitDialog.close();
  void openShop({ itemId: permit.id, onClose: () => showOutingPicker(area) });
});
permitStarter.addEventListener('click', () => {
  permitGeneration++;
  permitDialog.close();
  showOutingPicker(starterArea);
});

function shopItem(item, inventory = false) {
  const owned = profile.owned.includes(item.id);
  const equipped = profile.equipped[item.category] === item.id;
  const canEquip = Object.hasOwn(profile.equipped, item.category);
  const shortfall = item.cost - profile.coins;
  const action = (type, label, disabled = false) =>
    `<button type="button" data-shop-action="${type}" aria-label="${label} ${item.name}" ${disabled ? 'disabled' : ''}>${label}</button>`;
  return `<li data-item="${item.id}" tabindex="-1">
    <div><strong>${icon(item.category)} ${item.name}</strong><p>${item.effect}</p>
      <button type="button" data-item-details="${item.id}">Details<span class="fishing-announcement"> for ${item.name}</span></button></div>
    <div class="fishing-shop-action">
      <span>${owned ? equipped ? 'Equipped' : 'Owned' : coins(item.cost)}</span>
      ${owned ? canEquip && !equipped ? action('equip', 'Equip') : '' : inventory ? `<button type="button" data-view-shop="${item.id}">View in shop</button>` : action('buy', 'Buy', shortfall > 0)}
    </div>
  </li>`;
}

function hookCarousel(inventory = false) {
  const hooks = shopItems.filter(item => item.category === 'hook');
  let selected = hooks.findIndex(item => item.id === hookSelection);
  if (selected < 0) selected = 0;
  hookSelection = hooks[selected].id;
  const cardPrefix = inventory ? 'gear-hook' : 'shop-hook';
  return `<div class="fishing-hook-carousel" tabindex="0" role="group" aria-label="Hook carousel" aria-describedby="${cardPrefix}-${hookSelection}" data-hook-carousel>
    <div class="fishing-carousel-nav">
      <button type="button" data-hook-step="-1" aria-label="Previous hook" ${selected === 0 ? 'disabled' : ''}>Previous</button>
      <span data-hook-position role="status">Hook ${selected + 1} of ${hooks.length}</span>
      <button type="button" data-hook-step="1" aria-label="Next hook" ${selected === hooks.length - 1 ? 'disabled' : ''}>Next</button>
    </div>
    <ul>${hooks.map((item, i) => shopItem(item, inventory).replace('<li ', `<li id="${cardPrefix}-${item.id}" ${i !== selected ? 'hidden' : ''} `)).join('')}</ul>
  </div>`;
}

function renderShop() {
  shopBalance.textContent = coins(profile.coins);
  shopList.innerHTML = `<nav class="fishing-shop-categories" aria-label="Shop categories">${Object.entries(shopLabels).map(([id, label]) =>
    `<button type="button" data-shop-category="${id}">${icon(id)} ${label}</button>`).join('')}</nav>` +
    Object.entries(shopLabels).map(([category, label]) => {
      const items = shopItems.filter(item => item.category === category);
      if (!items.length) return '';
      return `<section aria-labelledby="shop-${category}" data-category="${category}">
        <h3 id="shop-${category}" tabindex="-1">${label}</h3>
        ${category === 'hook' ? hookCarousel() : `<ul>${items.map(item => shopItem(item)).join('')}</ul>`}
      </section>`;
    }).join('');
}

function equipmentName(id) { return shopItems.find(item => item.id === id)?.name ?? 'Starter tackle'; }
function renderGear() {
  const content = pause.querySelector('[data-gear-content]');
  if (!profile) { content.textContent = 'Couldn’t read your gear. Return to Pause and try Gear again.'; return; }
  const active = outingEquipment ?? { line: 'starter-line', hook: 'starter-hook' };
  content.innerHTML = `<p>Campaign changes apply to your next Campaign outing. Practice always starts with starter tackle.</p>
    <dl class="fishing-loadout"><dt>This outing</dt><dd>${icon('line')} ${equipmentName(active.line)}<br>${icon('hook')} ${equipmentName(active.hook)}</dd>
      <dt>Next Campaign outing</dt><dd>${icon('line')} ${equipmentName(profile.equipped.line)}<br>${icon('hook')} ${equipmentName(profile.equipped.hook)}</dd></dl>
    <h3>Hooks</h3>${hookCarousel(true)}
    <h3>Line</h3><ul>${shopItems.filter(item => item.category === 'line').map(item => shopItem(item, true)).join('')}</ul>
    <h3>Training and licenses</h3><ul>${shopItems.filter(item => ['training', 'license'].includes(item.category)).map(item => shopItem(item, true)).join('')}</ul>
    <div data-gear-milestone></div>
    <p>Practice: two catches reach Level 2. Choose Line Control for a longer hook window or Lift for an extra first clear pull.</p>
    <p data-gear-message role="status"></p>`;
  pause.dispatchEvent(new CustomEvent('fishing:gear-rendered', { bubbles: true, detail: { profile } }));
}

function showPausePanel(panel) {
  pausePanel = panel;
  pause.querySelectorAll('[data-pause-panel]').forEach(section => { section.hidden = section.dataset.pausePanel !== panel; });
  const title = pause.querySelector('h2');
  title.textContent = { menu: 'Paused', gear: 'Gear', controls: 'Controls' }[panel];
  pause.scrollTop = 0;
  if (panel === 'gear') renderGear();
  title.focus({ preventScroll: true });
}

export function openPause() {
  if (tray.hidden || !usesLinePhysics() || busy || catchSaveFailed || !state) return;
  if (pause.open) return;
  pauseOpener = document.activeElement;
  pauseRelease = acquireSuspension();
  showPausePanel('menu');
  pause.showModal();
}

pause.addEventListener('close', () => {
  pauseGeneration++;
  pauseRelease?.();
  pauseRelease = undefined;
  if (!tray.hidden) {
    render();
    (pauseOpener?.isConnected ? pauseOpener : exit).focus({ preventScroll: true });
  }
});
pause.addEventListener('cancel', event => {
  if (shopBusy) { event.preventDefault(); return; }
  if (pausePanel !== 'menu') { event.preventDefault(); showPausePanel('menu'); }
});
pause.addEventListener('click', async event => {
  const control = event.target.closest('[data-action]');
  if (!control || shopBusy) return;
  const current = ++pauseGeneration;
  const destination = control.dataset.action;
  if (destination === 'resume') pause.close();
  if (destination === 'back') { const parent = pausePanel; showPausePanel('menu'); pause.querySelector(`[data-action="${parent}"]`)?.focus(); }
  if (destination === 'leave') { pause.close(); leave(); }
  if (destination === 'controls') showPausePanel('controls');
  if (destination === 'shop') void openShop();
  if (destination === 'gear') {
    let loaded;
    try { loaded = await loadProfile(); } catch { /* Gear offers a retry through Pause. */ }
    if (pause.open && current === pauseGeneration) {
      if (loaded) profile = loaded;
      showPausePanel('gear');
      if (!loaded) pause.querySelector('[data-gear-content]').textContent = 'Couldn’t read your gear. Return to Pause and try Gear again.';
    }
  }
});

export async function openShop({ itemId, onClose } = {}) {
  // A pending catch must settle before a purchase can use its balance.
  if (!tray.hidden && (busy || catchSaveFailed || !usesLinePhysics())) return;
  if (shopBusy || shop.open) return;
  const current = ++shopGeneration;
  const returnToPause = !tray.hidden && usesLinePhysics();
  const opener = document.activeElement;
  const parentHook = hookSelection;
  const parentScroll = pause.scrollTop;
  const parentItem = opener?.closest('[data-item]')?.dataset.item;
  shopReturn = onClose ?? (() => {
    if (returnToPause) {
      if (!pause.open) openPause();
      else if (pausePanel === 'gear') {
        hookSelection = parentHook;
        renderGear();
        pause.scrollTop = parentScroll;
        const row = [...pause.querySelectorAll('[data-item]')].find(row => row.dataset.item === parentItem);
        (row?.querySelector('[data-view-shop], [data-shop-action]') ?? row)?.focus({ preventScroll: true });
      }
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    } else {
      showOutingPicker();
      picker.querySelector('[data-open-shop]').focus();
    }
  });
  shopRelease = acquireSuspension();
  if (picker.open) picker.close();
  shop.querySelector('[data-shop-back]').textContent = onClose ? 'Back' : returnToPause ? 'Back to Pause' : 'Back to outings';
  shopBusy = true;
  shopBalance.textContent = '';
  shopList.replaceChildren();
  shopMessage.textContent = 'Opening the tackle shop…';
  shop.showModal();
  shop.scrollTop = 0;
  try {
    await clockWrite;
    const loaded = await loadProfile();
    if (current !== shopGeneration || !shop.open) return;
    profile = loaded;
    const targeted = shopItems.find(item => item.id === itemId);
    if (targeted?.category === 'hook') hookSelection = itemId;
    renderShop();
    shopMessage.textContent = returnToPause ? 'Equipment changes apply to your next Campaign outing.' : '';
    if (targeted) {
      const row = [...shopList.querySelectorAll('[data-item]')].find(row => row.dataset.item === itemId);
      row?.scrollIntoView({ block: 'nearest' });
      row?.focus({ preventScroll: true });
    }
  } catch {
    if (current === shopGeneration) shopMessage.textContent = 'Couldn’t open your saved tackle. Close the shop and try again.';
  } finally {
    if (current === shopGeneration) shopBusy = false;
  }
}

shop.addEventListener('close', () => {
  shopGeneration++;
  const returnTo = shopReturn;
  shopReturn = undefined;
  // Establish the parent hold before releasing this child.
  try { returnTo?.(); } finally {
    shopRelease?.();
    shopRelease = undefined;
  }
});
shop.addEventListener('cancel', event => { if (shopBusy) event.preventDefault(); });
shop.addEventListener('submit', event => { if (shopBusy) event.preventDefault(); });

async function changeShopItem(event) {
  const control = event.target.closest('[data-shop-action]');
  if (!control || shopBusy) return;
  const source = event.currentTarget;
  const current = shopGeneration;
  const id = control.closest('[data-item]').dataset.item;
  const type = control.dataset.shopAction;
  const message = source === shop ? shopMessage : pause.querySelector('[data-gear-message]');
  shopBusy = true;
  message.textContent = 'Saving tackle…';
  source.querySelectorAll('[data-shop-action], [data-hook-step], [data-item-details], [data-view-shop], [data-shop-category]')
    .forEach(button => { button.disabled = true; });
  try {
    const result = await applyProfile({ type, id, revision: profile.revision });
    if (source === shop && (current !== shopGeneration || !shop.open)) return;
    profile = result.profile;
    if (source === shop) renderShop(); else renderGear();
    const item = shopItems.find(item => item.id === id);
    const notices = {
      bought: `${item.name} purchased.`, equipped: `${item.name} equipped for the next Campaign outing.`,
      stale: 'Your tackle changed in another tab. Check your updated gear and balance.',
      unaffordable: 'You need more coins for that purchase.', 'already-owned': 'You already own that item.',
      'already-equipped': 'That item is already equipped.',
    };
    (source === shop ? message : pause.querySelector('[data-gear-message]')).textContent = notices[result.status] ?? 'That change is unavailable.';
    const updated = [...source.querySelectorAll('[data-item]')].find(row => row.dataset.item === id);
    (updated?.querySelector('[data-shop-action]:not(:disabled)') ?? updated)?.focus({ preventScroll: true });
  } catch {
    if (source === shop) renderShop(); else renderGear();
    (source === shop ? shopMessage : pause.querySelector('[data-gear-message]')).textContent = 'Couldn’t save that change. Try again.';
    const row = [...source.querySelectorAll('[data-item]')].find(row => row.dataset.item === id);
    row?.querySelector('[data-shop-action]')?.focus({ preventScroll: true });
  } finally {
    shopBusy = false;
  }
}
shop.addEventListener('click', changeShopItem);
pause.addEventListener('click', changeShopItem);

function browseHook(container, index) {
  if (shopBusy) return;
  const hooks = shopItems.filter(item => item.category === 'hook');
  hookSelection = hooks[Math.max(0, Math.min(hooks.length - 1, index))].id;
  container.outerHTML = hookCarousel(pause.contains(container));
  const replacement = (shop.open ? shop : pause).querySelector('[data-hook-carousel]');
  replacement.focus({ preventScroll: true });
}
function openDetails(id, opener) {
  if (shopBusy || itemDetails.open) return;
  const item = shopItems.find(item => item.id === id);
  if (!item) return;
  detailsOpener = opener;
  itemDetails.querySelector('h2').textContent = item.name;
  itemDetails.querySelector('[data-item-description]').innerHTML = `${icon(item.category)}<p>${item.effect}</p><p>${profile.owned.includes(id) ? profile.equipped[item.category] === id ? 'Equipped for the next Campaign outing.' : 'Owned.' : `Price: ${coins(item.cost)}.`}</p>`;
  itemDetails.showModal();
}
itemDetails.addEventListener('close', () => detailsOpener?.focus({ preventScroll: true }));
for (const surface of [shop, pause]) {
  surface.addEventListener('click', event => {
    const detail = event.target.closest('[data-item-details]');
    if (detail) openDetails(detail.dataset.itemDetails, detail);
    const view = event.target.closest('[data-view-shop]');
    if (view) void openShop({ itemId: view.dataset.viewShop });
    const category = event.target.closest('[data-shop-category]');
    if (category) {
      const heading = shopList.querySelector(`#shop-${category.dataset.shopCategory}`);
      heading.scrollIntoView({ block: 'start' }); heading.focus({ preventScroll: true });
    }
    const arrow = event.target.closest('[data-hook-step]');
    if (arrow) {
      const hooks = shopItems.filter(item => item.category === 'hook');
      browseHook(arrow.closest('[data-hook-carousel]'), hooks.findIndex(item => item.id === hookSelection) + Number(arrow.dataset.hookStep));
    }
  });
  surface.addEventListener('keydown', event => {
    const carousel = event.target.closest('[data-hook-carousel]');
    if (!carousel || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const hooks = shopItems.filter(item => item.category === 'hook');
    const current = hooks.findIndex(item => item.id === hookSelection);
    browseHook(carousel, event.key === 'Home' ? 0 : event.key === 'End' ? hooks.length - 1 : current + (event.key === 'ArrowRight' ? 1 : -1));
  });
  let gesture;
  let suppressClick = false;
  surface.addEventListener('click', event => {
    if (!suppressClick || event.detail === 0) return;
    suppressClick = false;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);
  const cancelPress = () => { clearTimeout(detailsPress); detailsPress = undefined; };
  surface.addEventListener('pointerdown', event => {
    cancelPress();
    suppressClick = false;
    const carousel = event.target.closest('[data-hook-carousel]');
    const row = event.target.closest('[data-item]');
    gesture = { x: event.clientX, y: event.clientY, carousel, row };
    if (row && event.pointerType !== 'mouse' && !event.target.closest('button')) {
      detailsPress = setTimeout(() => { openDetails(row.dataset.item, row); gesture = undefined; }, 500);
    }
  });
  surface.addEventListener('pointermove', event => {
    if (gesture && Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 10) { cancelPress(); suppressClick = true; }
  });
  surface.addEventListener('pointerup', event => {
    cancelPress();
    if (!gesture) return;
    const { carousel, x, y } = gesture;
    gesture = undefined;
    if (!carousel || Math.abs(event.clientX - x) < 45 || Math.abs(event.clientY - y) > 25) return;
    const hooks = shopItems.filter(item => item.category === 'hook');
    browseHook(carousel, hooks.findIndex(item => item.id === hookSelection) + (event.clientX < x ? 1 : -1));
  });
  surface.addEventListener('pointercancel', () => { cancelPress(); gesture = undefined; });
  surface.addEventListener('pointerleave', cancelPress);
}

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

function searchEye(hole) {
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

function fishMouth() {
  const fish = target.getBoundingClientRect();
  const [x, y] = fishMouths[state.fish.id];
  return { x: fish.left + fish.width * x, y: fish.top + fish.height * y };
}

function iceHole(hole = iceCeiling.getBoundingClientRect()) {
  return { x: hole.left + hole.width * .62, y: hole.top + hole.height * 20 / 110 };
}

function drawFishingLine(eye, slack = 0, fight) {
  const visible = !tray.hidden && usesLinePhysics() && state && !failed && !state.snap
    && !['landed', 'done'].includes(state.stage);
  line.toggleAttribute('hidden', !visible);
  if (!visible) return;

  // All points use the same unscaled SVG coordinate space inside the lake.
  const water = lake.getBoundingClientRect();
  const hole = iceCeiling.getBoundingClientRect();
  const start = iceHole(hole);
  const x0 = start.x - water.left;
  const y0 = start.y - water.top;
  const elapsed = (outingTime.now() - jigAt) / 340;
  const bounce = elapsed < 1 ? 12 * Math.sin(Math.PI * elapsed) : 0;
  const end = eye ?? searchEye(hole);
  if (!eye && retractAt !== undefined && window.scrollY <= 2) {
    const progress = Math.min(1, (outingTime.now() - retractAt) / 240);
    end.y = start.y + 11 + (end.y - start.y - 11) * (1 - progress) ** 2;
  }
  const x = end.x - water.left;
  const y = eye ? end.y - water.top : Math.max(y0 + 7, end.y - water.top - bounce);
  linePath.setAttribute('d', `M${x0} ${y0} Q${x0 + slack} ${y0 + (y - y0) * .72} ${x} ${y}`);
  lineRig.setAttribute('transform', `translate(${x} ${y})`);
  const [lureX, lureY] = lureEyes[lure];
  lineLure.setAttribute('href', `./assets/tackle-icons.svg#${lure}`);
  lineLure.setAttribute('x', -lureX);
  lineLure.setAttribute('y', -lureY);
  lineLure.toggleAttribute('hidden', Boolean(eye));
  const showHint = fight && !fight.pullUp && eye.y >= 25 && eye.y < tray.getBoundingClientRect().top;
  lineCallout.toggleAttribute('hidden', !showHint);
  if (showHint) {
    lineCallout.setAttribute('transform', `translate(${x} ${y})`);
    const hint = fight.tight ? 'Loosen' : 'Reel up';
    const label = lineCallout.querySelector('text');
    if (label.textContent !== hint) label.textContent = hint;
  }
}

function positionFishingLine() {
  const stage = state?.stage;
  const attached = usesLinePhysics() && target && ['bite', 'fight', 'landed'].includes(stage);
  const fight = attached && state.fight;
  let curve = 0;
  if (attached) {
    const hole = iceHole();
    const scene = target.parentElement.getBoundingClientRect();
    const fish = target.getBoundingClientRect();
    const [mouthX, mouthY] = fishMouths[state.fish.id];
    const biteY = scene.top + scene.height * biteDepth;
    const depth = fight ? fight.remaining / fight.startDepth : 1;
    const x = hole.x + (fight?.x ?? 0) * Math.min(82, innerWidth * .10);
    const y = stage === 'landed'
      ? Math.max(hole.y + 12, lake.getBoundingClientRect().top + fish.height * mouthY + 8)
      : hole.y + (biteY - hole.y) * depth + (fight?.y ?? 0) * 16;
    target.style.setProperty('--bite-x', `${x - scene.left + fish.width * (.5 - mouthX)}px`);
    target.style.setProperty('--bite-y', `${y - scene.top + fish.height * (.5 - mouthY)}px`);
    if (fight) target.classList.add('is-hooked');
    if (fight && !fight.pullUp) {
      const loadRatio = Math.min(1, fight.tension / fight.lineStrength);
      curve = Math.min(54, fight.slack * 7 + (1 - loadRatio) * 14);
    }
  }
  drawFishingLine(attached ? fishMouth() : undefined, curve, fight || undefined);
}

function reframeHookedFish() {
  const fish = target.getBoundingClientRect();
  const waterTop = window.visualViewport?.offsetTop ?? 0;
  const waterBottom = tray.getBoundingClientRect().top;
  if (waterBottom - waterTop <= fish.height || (fish.top >= waterTop && fish.bottom < waterBottom)) return;
  window.scrollBy({ top: fish.top + fish.height / 2 - (waterTop + waterBottom) / 2, behavior: 'instant' });
  updateSearch();
}

function fightCue(fight) {
  if (fight.tight) return 'Hey, the line’s tight, loosen it up a bit!';
  return fight.pullUp ? 'You’re at the hole. Pull it up!' : 'Reel it up toward the hole.';
}

function setAction(actionIcon, label) {
  if (action.lastElementChild?.textContent !== label) {
    action.innerHTML = `${icon(actionIcon)}<span>${label}</span>`;
  }
}

function renderLineLoad() {
  const load = state?.fight?.tension ?? state?.snap?.tension ?? 0;
  meter.max = state?.lineStrength ?? 8;
  meter.high = 4.8;
  meter.value = load;
  const reading = `${load} / ${meter.max} lb`;
  if (pullsText.textContent !== reading) pullsText.textContent = reading;
}

function animateLineFight() {
  if (tray.hidden || outingTime.suspended || !usesLinePhysics() || state?.stage !== 'fight') return;
  if (advanceLineFight(run, outingTime.dateNow())) {
    state = publicRun(run);
    if (!state.fight) {
      const focused = document.activeElement;
      swimAway();
      render();
      if (focused === loosen) action.focus({ preventScroll: true });
      return;
    }
    const { fight } = state;
    renderLineLoad();
    setStatus(fightCue(fight));
    setAction(fight.pullUp ? 'lift' : 'reel', fight.pullUp ? 'Pull up' : 'Reel');
    action.classList.toggle('fishing-action-quiet', fight.tight);
    loosen.classList.toggle('fishing-recommended', fight.tight);
    positionFishingLine();
  }
  fightFrame = outingTime.frame(animateLineFight);
}

function jigFishingLine() {
  outingTime.cancel(rigFrame);
  if (document.body.hasAttribute('data-reduced') || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  jigAt = outingTime.now();
  const animate = () => {
    positionFishingLine();
    if (outingTime.now() - jigAt < 340) rigFrame = outingTime.frame(animate);
  };
  rigFrame = outingTime.frame(animate);
}

function fishToLure() {
  const eye = searchEye(iceCeiling.getBoundingClientRect());
  const scene = target.parentElement.getBoundingClientRect();
  biteDepth = (eye.y - scene.top) / scene.height;
}

function setStatus(message, detail = '') {
  if (words.textContent !== message) words.textContent = message;
  if (result.textContent !== detail) result.textContent = detail;
  result.hidden = !detail;
}

function renderDialogue(linePhysics) {
  portrait.hidden = speaker.hidden = !linePhysics;
  if (linePhysics) status.setAttribute('aria-label', 'Bryan');
  else status.removeAttribute('aria-label');
  if (linePhysics) {
    const name = state?.stage === 'landed' ? 'walleye-portrait'
      : state?.reaction === 'timer' ? 'headshot'
        : ['slipped-hook', 'wrong-lure', 'spooked', 'snapped'].includes(state?.reaction) ? 'leaning-in'
          : 'front-facing';
    const img = portrait.firstElementChild;
    if (img.dataset.portrait !== name) {
      img.dataset.portrait = name;
      img.src = `./assets/branding/bryan-${name}.webp`;
    }
  }
  const outcome = linePhysics && ['landed', 'missed', 'done'].includes(state?.stage);
  const dialogueAction = outcome || (linePhysics && state?.reaction === 'slipped-hook');
  const host = dialogueAction ? speech : actionRack;
  const moving = action.parentElement !== host;
  const restoreFocus = moving && document.activeElement === action;
  if (moving) {
    if (dialogueAction) host.append(action);
    else host.prepend(action);
  }
  tackleRack.hidden = outcome;
  if (restoreFocus) action.focus({ preventScroll: true });
}

function resetRetraction() {
  outingTime.cancel(retractTimer);
  outingTime.cancel(retractFrame);
  retractTimer = retractAt = undefined;
}

function retractAtHole() {
  if (tray.hidden || outingTime.suspended || !usesLinePhysics() || state?.stage !== 'seek' || window.scrollY > 2
    || retractAt !== undefined) return;
  outingTime.cancel(retractTimer);
  retractTimer = outingTime.timeout(() => {
    retractTimer = undefined;
    if (tray.hidden || state?.stage !== 'seek' || window.scrollY > 2) return;
    retractAt = outingTime.now() - (reducedMotion() ? 240 : 0);
    const settle = () => {
      positionFishingLine();
      if (outingTime.now() - retractAt < 240) retractFrame = outingTime.frame(settle);
    };
    settle();
  }, 125);
}

function reducedMotion() {
  return document.body.hasAttribute('data-reduced') || matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function stopCountdown() {
  outingTime.cancel(countdownTimer);
  rankedSeekUntil = rankedServerSeekUntil = undefined;
  countdown.hidden = true;
}

function updateCountdown() {
  const deadline = token ? rankedSeekUntil : state?.seekUntil;
  if (tray.hidden || failed || state?.stage !== 'seek' || !Number.isFinite(deadline)) {
    countdown.hidden = true;
    return;
  }
  const remaining = deadline - (token ? outingTime.now() : outingTime.dateNow());
  countdown.hidden = false;
  countdown.textContent = `Fish leaves in ${Math.max(0, Math.ceil(remaining / 1000))}s`;
  if (remaining <= 0) {
    if (!busy) void perform('expire');
  } else {
    countdownTimer = outingTime.timeout(updateCountdown, remaining % 1000 || 1000);
  }
}

function syncCountdown(serverNow) {
  outingTime.cancel(countdownTimer);
  if (Number.isFinite(serverNow) && Number.isFinite(state?.seekUntil)) {
    const receivedDeadline = outingTime.now() + Math.max(0, state.seekUntil - serverNow);
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
  if (tray.hidden || outingTime.suspended) return;
  renderStudiedCue();
  const searching = !failed && state?.stage === 'seek';
  const inView = searching && fishInView();
  if (searching && !inView) action.setAttribute('aria-disabled', 'true');
  else action.removeAttribute('aria-disabled');
  bobber.hidden = usesLinePhysics() || !state?.fish || (searching && !inView);
  positionFishingLine();
  if (searching) {
    const searchCue = 'Scroll up or down to find the fish.';
    const message = usesLinePhysics() && state.reaction === 'slipped-hook'
      ? 'It slipped the hook. Jig again.'
      : usesLinePhysics() && state.reaction === 'wrong-lure'
        ? 'It backed off. Try a different lure.'
        : inView && usesLinePhysics() ? 'There’s one! Pick a lure and jig.' : state.cue;
    setStatus(inView || state.reaction ? practiceError ?? message : searchCue);
  }
}

function showPracticeBite(elapsed) {
  const wait = elapsed < state.window.from;
  const passed = elapsed > state.window.until;
  setStatus(wait ? 'That’s a bite! Wait for gold.' : passed ? 'Missed the window. Reel in and try again.' : 'Yeah, reel it!');
  action.classList.toggle('fishing-action-quiet', wait);
}

function clearBite() {
  outingTime.cancel(frame);
  timing.style.removeProperty('--position');
}

function animateBite() {
  if (tray.hidden || state?.stage !== 'bite') return;
  const elapsed = (token ? outingTime.now() : outingTime.dateNow()) - biteAt;
  timing.style.setProperty('--position', `${Math.min(100, elapsed / state.window.until * 100)}%`);
  if (!token && !practiceError) showPracticeBite(elapsed);
  if (usesLinePhysics()) positionFishingLine();
  if (elapsed < state.window.until || (!token && elapsed === state.window.until)) {
    frame = outingTime.frame(animateBite);
  }
}

function removeTarget() {
  outingTime.cancel(escapeTimer);
  target?.remove();
  target = null;
}

function swimAway() {
  if (!target || reducedMotion()) {
    removeTarget();
    return;
  }
  const fish = target.getBoundingClientRect();
  const scene = target.parentElement.getBoundingClientRect();
  const center = fish.left + fish.width / 2;
  const toRight = center >= iceHole().x;
  target.style.setProperty('--x', `${center - scene.left}px`);
  target.style.setProperty('--y', `${fish.top + fish.height / 2 - scene.top}px`);
  target.style.setProperty('--escape-x', `${toRight ? innerWidth - center + fish.width : -center - fish.width}px`);
  target.toggleAttribute('data-facing-right', toRight);
  target.classList.remove('is-curious', 'is-biting', 'is-hooked');
  target.classList.add('is-escaping');
  escapeTimer = outingTime.timeout(removeTarget, 720);
}

function moveFishAway() {
  if (!target || !state.fish) return;
  const { x, y } = state.fish;
  const edge = x >= 62 ? 94 : 6;
  target.classList.remove('is-curious', 'is-biting', 'is-hooked');
  target.toggleAttribute('data-facing-right', edge > 62);
  target.style.setProperty('--x', `${x + (edge - x) * Math.min(.75, state.wrongLures * .32)}%`);
  target.style.setProperty('--y', `${y + state.wrongLures * 3}%`);
}

function placeFish() {
  removeTarget();
  positionLine();
  if (!state.fish) return;
  const { art, x, y } = state.fish;
  target = document.createElement('div');
  target.className = 'fishing-target';
  target.classList.toggle('gilded', state.fish.gilded);
  target.setAttribute('aria-hidden', 'true');
  target.style.setProperty('--x', `${x}%`);
  target.style.setProperty('--y', `${y}%`);
  encounterTip = usesLinePhysics() && profile?.studiedSpecies?.includes(state.fish.id) ? lureTip(state.fish.id) : undefined;
  target.innerHTML = fishSvg(art);
  target.addEventListener('animationend', updateSearch);
  target.addEventListener('transitionend', updateSearch);
  scenes[state.fish.depth ?? state.index].append(target);
}

function renderStudiedCue() {
  const visible = usesLinePhysics() && encounterTip && state?.fish
    && ['seek', 'bite', 'fight'].includes(state.stage) && fishInView();
  studiedCue.hidden = !visible;
  if (visible && studiedCue.dataset.species !== state.fish.id) {
    studiedCue.dataset.species = state.fish.id;
    studiedCue.innerHTML = icon(encounterTip.lure);
    studiedCue.append(document.createTextNode(encounterTip.text));
  }
}

function render() {
  renderStudiedCue();
  const campaign = mode === 'campaign';
  const linePhysics = usesLinePhysics();
  const modeName = { campaign: 'Campaign', practice: 'Practice', ranked: 'Ranked' }[mode];
  const areaName = state?.area ? ` · ${state.area}` : '';
  tray.dataset.mode = mode;
  tray.toggleAttribute('data-line-physics', linePhysics);
  waterName.textContent = state ? `${state.lake}${areaName}` : 'Fishing beneath the ice';
  scoreProgress.hidden = !state;
  runProgress.textContent = state
    ? `${modeName} · ${state.score} pts · ${Math.min(state.index + 1, state.count)}/${state.count}` : '';
  const tight = linePhysics && state?.fight?.tight === true;
  const pullUp = linePhysics ? state?.fight?.pullUp : state?.fight?.pulls === 1;
  const practiceBite = !token && state?.stage === 'bite';
  let detail = '';
  let cue = state?.cue ?? 'Opening the lake…';
  if (failed) cue = 'Ranking disconnected. You can start a practice outing.';
  else if (linePhysics && state?.fight) cue = fightCue(state.fight);
  else if (practiceError) cue = practiceError;
  else if (linePhysics && state?.reaction === 'spooked') cue = 'We spooked it. There it goes.';
  else if (linePhysics && state?.reaction === 'timer') {
    cue = 'The fish swam away.';
    if (state.stage === 'done') detail = 'Outing complete.';
  } else if (linePhysics && state?.snap) {
    cue = 'Ah, the line snapped.';
    detail = `${state.snap.tension} lb on ${state.snap.lineStrength} lb line.`;
  } else if (state?.stage === 'landed' && cue.endsWith('points')) {
    if (campaign && Number.isFinite(catchReward)) cue += ` · +${coins(catchReward)}`;
    if (campaign && campaignMilestoneNotice) cue += '. Lake Regular! Two Campaign catches saved.';
    if (state.practice?.xp === practiceLevelXp) {
      if (state.skillPoints) cue += '. Level 2! Choose a skill.';
      else cue += `. ${state.skills.control ? skills.control : skills.lift} selected.`;
    }
    if (linePhysics) {
      detail = cue;
      cue = catchSaveFailed ? 'Couldn’t save this catch. Let’s try again.' : busy ? 'Saving your catch…' : 'Nice! You got one.';
    } else {
      cue = `All right! ${cue}`;
    }
  }
  if ((state?.stage !== 'seek' || failed) && (!practiceBite || practiceError)) setStatus(cue, detail);
  wallet.hidden = !campaign || !profile;
  phaseLabel.hidden = !linePhysics || !state;
  if (linePhysics && state?.stage === 'done') stopOutingClock();
  if (campaign && profile) wallet.textContent = coins(profile.coins);
  practiceProgress.hidden = !state?.practice || failed;
  if (state?.practice) {
    const { xp, level } = state.practice;
    const progress = level === 1 ? `${xp} / ${practiceLevelXp} XP to Level 2` : `Level 2 · ${xp} XP`;
    if (practiceProgress.textContent !== progress) practiceProgress.textContent = progress;
  }
  const [actionIcon, label] = failed ? ['next', 'Practice'] : ({
    seek: ['jig', state?.reaction === 'slipped-hook' ? 'Try again' : 'Jig'], bite: ['reel', 'Reel'], fight: pullUp ? ['lift', 'Pull up'] : ['reel', 'Reel'],
    landed: linePhysics && catchSaveFailed ? ['next', 'Save catch'] : ['next', 'Next fish'],
    missed: ['next', 'Next fish'], done: ['next', 'Fish again'],
  }[state?.stage] ?? ['next', 'Wait']);
  setAction(actionIcon, label);
  renderDialogue(linePhysics);
  action.disabled = busy || !state;
  exit.disabled = usesLinePhysics() && (busy || !state || catchSaveFailed);
  exit.innerHTML = usesLinePhysics() ? `${icon('pause')}<span>${busy ? state ? 'Saving…' : 'Opening…' : 'Menu'}</span>` : 'Exit fishing';
  action.classList.toggle('fishing-action-quiet', tight);
  loosen.classList.toggle('fishing-recommended', tight);
  if (practiceBite && !practiceError) showPracticeBite(outingTime.dateNow() - biteAt);
  if (bobber.dataset.lure !== lure) {
    bobber.dataset.lure = lure;
    bobber.innerHTML = icon(lure);
  }
  pressure.hidden = !(state?.fight || state?.snap) || failed;
  loosen.hidden = !linePhysics && pressure.hidden;
  loosen.disabled = busy || !state?.fight;
  if (linePhysics) {
    renderLineLoad();
  } else if (state?.fight) {
    const { tension, pulls } = state.fight;
    meter.max = 100;
    meter.high = 60;
    meter.value = tension;
    pullsText.textContent = `${tension >= 60 ? 'Tight line' : 'Line clear'} · ${pulls} to land`;
  }
  slots.forEach(slot => {
    slot.hidden = !linePhysics && !pressure.hidden;
    slot.disabled = busy || state?.stage !== 'seek';
    slot.setAttribute('aria-pressed', String(slot.dataset.lure === lure));
  });
  const showCatch = linePhysics && state?.stage === 'landed';
  if (state?.stage === 'bite') target?.removeAttribute('data-facing-right');
  target?.classList.toggle('is-biting', showCatch || ['bite', 'fight'].includes(state?.stage));
  if (target) target.hidden = !showCatch && state?.stage === 'landed';
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

async function begin(selectedMode = mode, selectedArea = campaignArea) {
  const clockSaved = stopOutingClock();
  const fromAction = document.activeElement === action;
  dismissCelebration();
  clearBite();
  stopCountdown();
  outingTime.cancel(rigFrame);
  resetRetraction();
  outingTime.cancel(fightFrame);
  jigAt = -Infinity;
  jigActivation = fightActivation = false;
  practiceError = undefined;
  profile = outingId = catchReward = encounterTip = undefined;
  campaignMilestoneNotice = false;
  catchSaveFailed = false;
  lure = 'jig';
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
      await clockSaved;
      const loaded = await loadProfile();
      if (current !== generation) return;
      profile = loaded;
      if (!hasAreaAccess(loaded, selectedArea)) {
        busy = false;
        leave();
        await showPermit(selectedArea);
        return;
      }
      campaignArea = selectedArea;
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
    if (mode === 'practice') {
      // A failed collection read does not prevent a temporary Practice outing.
      try { profile = await loadProfile(); } catch { profile = undefined; }
      if (current !== generation) return;
    }
    outingId ??= crypto.randomUUID();
    const equipment = mode === 'campaign' ? profile : undefined;
    outingEquipment = equipment ? { ...equipment.equipped } : { line: 'starter-line', hook: 'starter-hook' };
    const equippedLine = shopItems.find(item => item.id === equipment?.equipped.line);
    const lineStrength = equippedLine?.strength;
    const line = equippedLine?.windowMs ? { lure: equippedLine.lure, windowMs: equippedLine.windowMs } : undefined;
    const equippedHook = shopItems.find(item => item.id === equipment?.equipped.hook);
    const hook = equippedHook?.windowMs ? { lure: equippedHook.lure, windowMs: equippedHook.windowMs } : undefined;
    const lineControlRank = shopItems.find(item => item.id === 'line-control' && equipment?.owned.includes(item.id))?.rank;
    const elapsedMs = mode === 'campaign' ? profile?.elapsedMs ?? 0 : 0;
    run = start(outingTime.dateNow(), undefined, undefined, {
      practice: mode === 'practice',
      campaign: mode === 'campaign' ? { area: campaignArea, lineStrength, line, hook, lineControlRank, elapsedMs } : undefined,
    });
    state = publicRun(run);
    startOutingClock(elapsedMs);
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
  showOutingPicker();
}

async function startSelected(selectedMode, selectedArea) {
  if (selectedMode === 'campaign') {
    if (!areaPermit(selectedArea)) return;
    const current = ++pickerGeneration;
    try {
      const saved = await loadProfile();
      if (current !== pickerGeneration || !picker.open) return;
      if (!hasAreaAccess(saved, selectedArea)) return showPermit(selectedArea);
    } catch {
      if (current === pickerGeneration && picker.open) await showPermit(selectedArea);
      return;
    }
  }
  picker.close();
  tray.hidden = false;
  document.body.classList.add('fishing');
  exit.focus({ preventScroll: true });
  begin(selectedMode, selectedArea);
}

function leave() {
  stopOutingClock();
  delete lake.dataset.fishingLight;
  phaseLabel.dataset.phase = '';
  dismissCelebration();
  generation++;
  clearBite();
  stopCountdown();
  outingTime.cancel(rigFrame);
  resetRetraction();
  outingTime.cancel(fightFrame);
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
  if (choice) startSelected(choice.dataset.mode, choice.dataset.area);
});
exit.addEventListener('click', () => usesLinePhysics() ? openPause() : leave());
window.addEventListener('pagehide', () => {
  if (!clock) return;
  suspendedClock = outingElapsed();
  stopOutingClock();
});
window.addEventListener('pageshow', event => {
  if (event.persisted && suspendedClock !== undefined) startOutingClock(suspendedClock);
  suspendedClock = undefined;
});
document.addEventListener('keydown', event => {
  if (tray.hidden || event.defaultPrevented || dialogOpen() || outingTime.suspended) return;
  const editable = event.target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])');
  if (editable || event.isComposing || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    if (!event.repeat) { if (usesLinePhysics()) openPause(); else leave(); }
    return;
  }
  const key = event.key.toLowerCase();
  if (['j', 'r', 'l', '1', '2', '3'].includes(key)) {
    if (!usesLinePhysics()) return;
    event.preventDefault();
    if (event.repeat || busy) return;
    if (key === 'j' && state?.stage === 'seek' && !action.disabled) action.click();
    if (key === 'r' && ['bite', 'fight'].includes(state?.stage) && !action.disabled) action.click();
    if (key === 'l' && state?.stage === 'fight' && !loosen.disabled) loosen.click();
    const slot = slots[Number(key) - 1];
    if (slot && !slot.disabled) slot.click();
    return;
  }
  if (Object.hasOwn(scrollKeys, event.key)) {
    const step = event.key.startsWith('Arrow') ? 48
      : event.key.startsWith('Page') ? tray.getBoundingClientRect().top * .85
      : document.documentElement.scrollHeight;
    event.preventDefault();
    if (scrollKeys[event.key] < 0) retractAtHole();
    window.scrollBy({ top: step * scrollKeys[event.key], behavior: 'instant' });
    updateSearch();
  }
  if (!token && event.repeat && ['Enter', ' '].includes(event.key) && tray.contains(event.target)) event.preventDefault();
});
window.addEventListener('scroll', () => {
  if (outingTime.suspended) return;
  if (window.scrollY > 2 && (retractTimer !== undefined || retractAt !== undefined)) resetRetraction();
  updateSearch();
}, { passive: true });
window.addEventListener('wheel', event => {
  if (outingTime.suspended || dialogOpen()) return;
  if (event.deltaY < 0 && !event.target.closest('.fishing-tray')) retractAtHole();
}, { passive: true });
lake.addEventListener('touchstart', event => {
  if (outingTime.suspended || dialogOpen()) return;
  lastTouchY = event.touches.length === 1 ? event.touches[0].clientY : undefined;
}, { passive: true });
lake.addEventListener('touchmove', event => {
  if (outingTime.suspended || dialogOpen()) return;
  const y = event.touches.length === 1 ? event.touches[0].clientY : undefined;
  if (y !== undefined && lastTouchY !== undefined && y > lastTouchY + 2) retractAtHole();
  lastTouchY = y;
}, { passive: true });
window.addEventListener('resize', () => {
  if (outingTime.suspended) return;
  positionLine();
  updateSearch();
  if (!shortLandscape.matches || !usesLinePhysics() || state?.stage !== 'fight' || !target) return;

  reframeHookedFish();
});
window.visualViewport?.addEventListener('scroll', updateSearch, { passive: true });
window.visualViewport?.addEventListener('resize', updateSearch);
const lineResize = new ResizeObserver(() => {
  if (usesLinePhysics()) updateSearch();
});
lineResize.observe(lake);
lineResize.observe(tray);
log.addEventListener('toggle', updateSearch);
slots.forEach(slot => slot.addEventListener('click', () => {
  if (gameBlocked() || slot.disabled || state?.stage !== 'seek') return;
  lure = slot.dataset.lure;
  render();
}));

async function saveCatchCoins(current) {
  const key = `${outingId}:${state.index}`;
  const speciesId = state.fish?.id;
  catchReward = undefined;
  try {
    const result = await applyProfile({ type: 'award', key, outcome: state.stage, catch: state.catch, speciesId, mode });
    if (!['awarded', 'duplicate-award'].includes(result.status)) throw new Error('Catch save rejected.');
    if (current !== generation) return;
    profile = result.profile;
    if (result.milestoneReached) campaignMilestoneNotice = true;
    catchReward = mode === 'campaign' ? result.earned ?? profile.awards[key] : undefined;
    catchSaveFailed = false;
    document.dispatchEvent(new CustomEvent('fishing:catch-saved', { detail: { mode, key, speciesId, profile, milestoneReached: result.milestoneReached === true } }));
  } catch {
    if (current === generation) catchSaveFailed = true;
  }
}

async function retryCatchCoins() {
  const current = generation;
  busy = true;
  render();
  await saveCatchCoins(current);
  if (current !== generation) return;
  busy = false;
  render();
  action.focus({ preventScroll: true });
}

async function perform(move, input = {}) {
  if (busy || outingTime.suspended || !state) return;
  if (move === 'next') campaignMilestoneNotice = false;
  const prior = state;
  const focused = document.activeElement;
  const current = generation;
  if (move === 'jig') {
    if (usesLinePhysics()) jigFishingLine();
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
  const sentAt = outingTime.now();
  const appliedAt = outingTime.dateNow();
  let serverNow;
  try {
    const result = token
      ? await api(move, { ...input, version: state.version })
      : { state: apply(run, { action: move, ...input }, appliedAt, { campaignElapsedMs: outingElapsed() }) };
    if (current !== generation) return;
    ({ state, serverNow } = result);
    practiceError = undefined;
    if (move === 'jig' && state.reaction === 'wrong-lure') moveFishAway();
    if (usesLinePhysics() && state.stage === 'landed' && prior.stage !== 'landed') {
      await saveCatchCoins(current);
      if (current !== generation) return;
    }
    if (mode !== 'campaign' && state.stage === 'landed' && prior.stage !== 'landed') {
      if (!state.practice) celebrateCatch(state.index + 2);
      else if (state.practice.xp === practiceLevelXp) celebrateCatch(state.practice.level, true);
    }
    if (state.index !== prior.index) dismissCelebration();
    if (state.stage === 'missed' || (state.stage === 'done' && prior.stage !== 'landed')) swimAway();
    else if (state.index !== prior.index) placeFish();
    if (state.stage === 'bite') {
      if (usesLinePhysics()) fishToLure();
      biteAt = token ? sentAt : appliedAt;
      clearBite();
      animateBite();
    } else if (prior.stage === 'bite') {
      clearBite();
      if (usesLinePhysics() && state.stage === 'fight') {
        fightFrame = outingTime.frame(animateLineFight);
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
  const reeledIn = move === 'reel' && state.fight && state.fight.remaining < prior.fight?.remaining;
  if (usesLinePhysics() && target && prior.fight && (reeledIn || state.stage === 'landed')) {
    if (state.fight?.pullUp || state.stage === 'landed') {
      window.scrollTo({ top: 0, behavior: 'instant' });
      updateSearch();
    } else {
      reframeHookedFish();
    }
  }
  if (focused === action || (move === 'upgrade' && skillRow.hidden && practiceChoice.hidden)) {
    action.focus({ preventScroll: true });
  }
  if (focused === loosen) (loosen.disabled || loosen.hidden ? action : loosen).focus({ preventScroll: true });
}

loosen.addEventListener('click', () => { if (!gameBlocked() && !loosen.disabled && state?.stage === 'fight') void perform('loosen'); });

function rememberAction() {
  jigActivation = state?.stage === 'seek';
  fightActivation = usesLinePhysics() && state?.stage === 'fight';
}
action.addEventListener('pointerdown', event => {
  if (event.isPrimary && event.button === 0) rememberAction();
});
action.addEventListener('pointercancel', () => { jigActivation = fightActivation = false; });
action.addEventListener('keydown', event => {
  if (!event.repeat && ['Enter', ' '].includes(event.key)) rememberAction();
});
action.addEventListener('click', () => {
  if (gameBlocked() || action.disabled || !state) return;
  const startedBeforeMiss = jigActivation || fightActivation;
  jigActivation = fightActivation = false;
  if (startedBeforeMiss && ['missed', 'done'].includes(state.stage)) return;
  if (failed || state.stage === 'done') return begin(failed ? 'practice' : mode);
  if (usesLinePhysics() && state.stage === 'landed' && catchSaveFailed) return retryCatchCoins();
  if (state.stage === 'seek' && !fishInView()) return updateSearch();
  const fightMove = usesLinePhysics() && !state.fight?.pullUp ? 'reel' : 'lift';
  const move = { seek: 'jig', bite: 'reel', fight: fightMove, landed: 'next', missed: 'next' }[state.stage];
  return perform(move, move === 'jig' ? { lure } : {});
});
for (const button of [...skillRow.children, ...practiceButtons]) {
  button.addEventListener('click', () => { if (!gameBlocked() && !button.disabled && state?.stage === 'landed') void perform('upgrade', { skill: button.dataset.skill }); });
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
