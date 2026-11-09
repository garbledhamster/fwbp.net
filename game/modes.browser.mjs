import assert from 'node:assert/strict';
import { practicePage, withBrowser } from './browser-qa.mjs';
import { apply, publicRun, start } from './rules.mjs';

await withBrowser(async browser => {
  const url = process.env.FISHING_QA_URL ?? 'http://127.0.0.1:9867/';
  const token = 'a'.repeat(43);
  const requests = [];
  let run;
  const { enter, page, tray, action, press, tick, findFish, errors } = await practicePage(browser, {
    async configure(page) {
      await page.route(url, async route => {
        const response = await route.fetch();
        const body = (await response.text()).replace('<head>', '<head><meta name="fishing-api" content="/ranked-isolation">');
        await route.fulfill({ response, body });
      });
      await page.route('**/ranked-isolation', async route => {
        const request = route.request();
        const body = request.postDataJSON();
        requests.push({ method: request.method(), authorization: request.headers().authorization, body });
        const now = await page.evaluate(() => Date.now());
        if (body.action === 'start') {
          // The server draws rock bass here. The browser's first local draw is yellow perch.
          run = start(now, () => .35);
          return route.fulfill({ json: { token, state: publicRun(run), serverNow: now } });
        }
        const { action, lure } = body;
        const move = lure === undefined ? { action } : { action, lure };
        const state = apply(run, move, now);
        await route.fulfill({ json: { state, serverNow: now } });
      });
    },
  });

  const profileBefore = await page.evaluate(async () => {
    const { applyProfile } = await import(new URL('./game/profile.mjs', location.href));
    const award = await applyProfile({ type: 'award', key: 'campaign-fixture:0', outcome: 'landed', catch: { points: 35 } });
    const buy = await applyProfile({ type: 'buy', id: 'stronger-line', revision: award.profile.revision });
    const equip = await applyProfile({ type: 'equip', id: 'stronger-line', revision: buy.profile.revision });
    return equip.profile;
  });
  assert.equal(profileBefore.equipped.line, 'stronger-line');
  assert.equal(profileBefore.coins, 25);

  await enter('Ranked');
  await tray.getByText(/Mille Lacs · Ranked · 0 pts/).waitFor();
  await findFish();
  await press(action);
  await action.getByText('Reel', { exact: true }).waitFor();
  await tick(800);
  await press(action);
  await tray.getByText(/Rock bass.*\+15 points/).waitFor();
  assert.match(await tray.locator('[data-score]').textContent(), /Ranked.*15 pts/);
  assert.equal(run.score, 15);
  assert.doesNotMatch(await tray.innerText(), /\bcoins?\b|\b12 lb\b|Stronger line/i);
  assert.deepEqual(requests, [
    { method: 'POST', authorization: undefined, body: { action: 'start' } },
    { method: 'POST', authorization: `Bearer ${token}`, body: { action: 'jig', lure: 'jig', version: 0 } },
    { method: 'POST', authorization: `Bearer ${token}`, body: { action: 'reel', version: 1 } },
  ]);
  const profileAfter = await page.evaluate(async () => {
    const { loadProfile } = await import(new URL('./game/profile.mjs', location.href));
    return loadProfile();
  });
  assert.deepEqual(profileAfter, profileBefore, 'a ranked catch does not credit the campaign wallet');
  assert.deepEqual(errors, []);
  await page.close();
  console.log('PASS: a saved Campaign wallet and stronger line stay out of Ranked requests and scoring');
});
