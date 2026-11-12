const endpoint = 'https://counts.fwbp.net';
const counters = {
  anglers: document.querySelector('[data-counter="anglers"]'),
  hotdog: document.querySelector('[data-counter="hotdog"]'),
};
const totals = { anglers: -1, hotdog: -1 };
const format = new Intl.NumberFormat();
let recordedVisit = false;
let pendingClick = false;

async function update(action = '') {
  try {
    const response = await fetch(endpoint + '/' + action, {
      method: action ? 'POST' : 'GET',
      credentials: 'omit',
      keepalive: Boolean(action),
    });
    if (!response.ok) return;
    const values = await response.json();
    for (const name of Object.keys(counters)) {
      const value = values[name];
      if (!Number.isSafeInteger(value) || value <= totals[name]) continue;
      totals[name] = value;
      counters[name].textContent = format.format(value);
    }
    if (action) recordedVisit = true;
    if (action === 'hotdog') pendingClick = false;
  } catch {
    // Keep the last available totals and retry on the next refresh.
  }
}

function refresh() {
  if (document.hidden) return;
  update(pendingClick ? 'hotdog' : recordedVisit ? '' : 'visit');
}

function recordHotdog(event) {
  if (!event.isTrusted || event.button > 1) return;
  pendingClick = true;
  update('hotdog');
}

const hotdog = document.querySelector('[data-random-hot-dog]');
hotdog.addEventListener('click', recordHotdog);
hotdog.addEventListener('auxclick', recordHotdog);
document.addEventListener('visibilitychange', refresh);
setInterval(refresh, 30_000);
refresh();
