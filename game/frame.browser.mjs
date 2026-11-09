import assert from 'node:assert/strict';
import { practicePage, withBrowser } from './browser-qa.mjs';
import { mkdir } from 'node:fs/promises';
const evidence = process.env.FISHING_EVIDENCE;
if (evidence) await mkdir(evidence, { recursive: true });
await withBrowser(async browser => {
  for (const viewport of [{width:1200,height:720},{width:320,height:720},{width:720,height:320}]) {
    const {page,press,enter,tray,closeDialog,errors} = await practicePage(browser, {viewport,mobile:viewport.width<800});
    await enter('Campaign');
    await press(tray.locator('[data-exit]'));
    const pause=page.locator('.fishing-pause');
    assert.equal(await pause.locator('[data-website="reference"]').getAttribute('target'),'_blank');
    assert.equal(await pause.locator('[data-website="merch"]').getAttribute('target'),'_blank');
    const popupPromise = page.waitForEvent('popup');
    await press(pause.locator('[data-website="reference"]'), 'Enter');
    const popup = await popupPromise;
    await popup.waitForLoadState('domcontentloaded');
    assert.match(popup.url(), /#quick-reference$/);
    await popup.locator('#quick-reference-heading').waitFor();
    await popup.close();
    assert.equal(await pause.isVisible(),true,'website keeps Pause open');
    if(evidence) await page.screenshot({path:`${evidence}/pause-${viewport.width}x${viewport.height}.png`});
    for (const surface of ['gear','controls']) {
      await press(pause.locator(`[data-action="${surface}"]`));
      if(evidence) await page.screenshot({path:`${evidence}/${surface}-${viewport.width}x${viewport.height}.png`});
      await press(pause.locator(`[data-pause-panel="${surface}"] [data-action="back"]`));
    }
    await press(pause.locator('[data-action="your-lake"]'));
    const collection=page.locator('#your-lake');
    await collection.locator('.collection-grid').waitFor();
    assert.equal(await collection.locator('.collection-grid button').count(),6);
    if(evidence) await page.screenshot({path:`${evidence}/lake-${viewport.width}x${viewport.height}.png`});
    await closeDialog(collection, collection.locator('[data-close]'));
    await press(pause.locator('[data-action="shop"]'));
    const shop=page.locator('.fishing-shop');
    const tile=shop.locator('[data-shop-select="stronger-line"]');
    await tile.waitFor();
    if(evidence) await page.screenshot({path:`${evidence}/grid-${viewport.width}x${viewport.height}.png`});
    const grid=shop.locator('[data-shop-grid]');
    await press(shop.locator('[data-shop-category="license"]'));
    const bottomTile=shop.locator('[data-shop-select="deep-reef-license"]');
    const scrollBefore=await grid.evaluate(el=>el.scrollTop);
    await press(bottomTile);
    if(viewport.width<600){
      await press(shop.locator('[data-shop-grid-back]'));
      assert.equal(await grid.evaluate(el=>el.scrollTop),scrollBefore,'detail Back restores grid scroll');
      assert.equal(await bottomTile.evaluate(el=>el===document.activeElement),true);
    }
    await press(shop.locator('[data-shop-category="line"]'));
    await press(tile);
    const inspector=shop.locator('[data-shop-inspector]');
    assert.match(await inspector.textContent(),/Stronger line/);
    assert.equal(await inspector.locator('[data-shop-action="buy"]').isDisabled(),true);
    const bounds=await shop.boundingBox();
    assert.ok(bounds.y>=0 && bounds.y+bounds.height<=viewport.height+1,'frame fits viewport');
    assert.equal(await shop.evaluate(el=>el.scrollHeight<=el.clientHeight+1),true,'outer frame never scrolls');
    const back=shop.locator('[data-shop-back]');
    const backBox=await back.boundingBox();
    assert.ok(backBox.y>=0 && backBox.y+backBox.height<=viewport.height,'return remains visible');
    if(viewport.width<600){
      await press(shop.locator('[data-shop-grid-back]'));
      assert.equal(await tile.evaluate(el=>el===document.activeElement),true,'Back restores selected tile focus');
      await press(tile);
    }
    if(evidence) await page.screenshot({path:`${evidence}/shop-${viewport.width}x${viewport.height}.png`});
    await press(back);
    await page.waitForFunction(()=>!document.querySelector('.fishing-shop').open);
    assert.equal(await pause.isVisible(),true);
    assert.deepEqual(errors,[]);
    await page.close();
  }
});
console.log('Shared frame: desktop, portrait, landscape, contained scroll, item state and return passed.');
