import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { practicePage, withBrowser } from './browser-qa.mjs';
const evidence=process.env.FISHING_EVIDENCE;
if(evidence) await mkdir(evidence,{recursive:true});
await withBrowser(async browser=>{
  for(const viewport of [{width:1200,height:720},{width:320,height:720},{width:720,height:320}]){
    const {page,press,enter,tray,errors}=await practicePage(browser,{viewport,mobile:viewport.width<800});
    await page.evaluate(async()=>{
      const {loadProfile}=await import('./game/profile.mjs?v=connected-rpg');
      const p=await loadProfile();
      p.owned.push('stronger-line','waxworm-bait');
      await new Promise((resolve,reject)=>{const r=indexedDB.open('fwbp-campaign',1);r.onsuccess=()=>{const db=r.result,t=db.transaction('profile','readwrite');t.objectStore('profile').put(p,'campaign');t.oncomplete=()=>{db.close();resolve();};t.onerror=()=>reject(t.error);};});
    });
    await enter('Campaign');
    // A purchase during an outing belongs to the next carried loadout only.
    await page.evaluate(async()=>{
      const {loadProfile}=await import('./game/profile.mjs?v=connected-rpg'); const p=await loadProfile();p.owned.push('live-minnow');
      await new Promise(resolve=>{const r=indexedDB.open('fwbp-campaign',1);r.onsuccess=()=>{const db=r.result,t=db.transaction('profile','readwrite');t.objectStore('profile').put(p,'campaign');t.oncomplete=()=>{db.close();resolve();};};});
    });
    await press(tray.locator('[data-exit]'));
    const gear=page.locator('.fishing-pause');
    await press(gear.locator('[data-action="gear"]'));
    const grid=gear.locator('[data-gear-grid]');
    await grid.waitFor();
    assert.match(await gear.locator('[data-gear-active-bait]').textContent(),/Waxworm bait/);
    assert.doesNotMatch(await gear.locator('[data-gear-active-bait]').textContent(),/Live minnow/);
    assert.match(await gear.locator('[data-gear-next-bait]').textContent(),/Waxworm bait.*Live minnow/);
    const tile=id=>gear.locator(`[data-gear-select="${id}"]`);
    if(evidence)await page.screenshot({path:`${evidence}/inventory-${viewport.width}x${viewport.height}.png`});
    await tile('waxworm-bait').focus();
    await page.keyboard.press('End');
    assert.equal(await tile('deep-reef-license').evaluate(el=>el===document.activeElement),true,'End reaches the final inventory tile');
    await page.keyboard.press('Home');
    assert.equal(await tile('waxworm-bait').evaluate(el=>el===document.activeElement),true,'Home returns to the first inventory tile');
    await press(tile('live-minnow'));
    assert.match(await gear.locator('[data-gear-inspector]').textContent(),/Carried next outing/);
    if(viewport.width<600) await press(gear.locator('[data-gear-grid-back]'));
    await tile('deep-reef-license').scrollIntoViewIfNeeded();
    const offset=await grid.evaluate(el=>el.scrollTop);
    await press(tile('deep-reef-license'));
    if(viewport.width<600){
      await press(gear.locator('[data-gear-grid-back]'));
      assert.equal(await grid.evaluate(el=>el.scrollTop),offset);
      assert.equal(await tile('deep-reef-license').evaluate(el=>el===document.activeElement),true);
    }
    await press(tile('stronger-line'));
    const selected=gear.locator('[data-gear-inspector]');
    await press(selected.locator('[data-item-details]'));
    const details=page.locator('.fishing-item-details');
    await details.waitFor();
    const closed = details.evaluate(el=>new Promise(resolve=>el.addEventListener('close',()=>resolve(),{once:true})));
    await page.keyboard.press('Escape');
    await closed;
    assert.equal(await selected.locator('[data-item-details]').evaluate(el=>el===document.activeElement),true);
    await press(selected.locator('[data-shop-action="equip"]'));
    await gear.locator('[data-gear-message]').filter({hasText:/equipped for the next Campaign outing/}).waitFor().catch(async error=>{ console.error(viewport, await gear.locator('[data-gear-message]').textContent()); if(evidence)await page.screenshot({path:`${evidence}/failure-${viewport.width}.png`}); throw error; });
    assert.match(await gear.locator('.fishing-loadout').textContent(),/This outing.*Starter line.*Next Campaign outing.*Stronger line/s);
    assert.equal(await gear.evaluate(el=>el.scrollWidth<=el.clientWidth && el.scrollHeight<=el.clientHeight+1),true);
    for(const control of [gear.locator('[data-action="resume"]'),gear.locator('[data-pause-panel="gear"] [data-action="back"]'),selected.locator('[data-item-details]')]){
      const b=await control.boundingBox();assert.ok(b.y>=0&&b.y+b.height<=viewport.height,'return and detail actions stay reachable');
    }
    if(evidence)await page.screenshot({path:`${evidence}/gear-${viewport.width}x${viewport.height}.png`});
    assert.deepEqual(errors,[]);
    await page.close();
  }
});
console.log('Gear grid: active/next gear and bait, phone scroll/focus, Details and Equip passed at three sizes.');
