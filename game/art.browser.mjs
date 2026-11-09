import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { practicePage, withBrowser } from './browser-qa.mjs';

const evidence = process.env.FISHING_ART_EVIDENCE_DIR;

async function capture(page, name) {
  if (!evidence) return;
  await mkdir(evidence, { recursive: true });
  await page.screenshot({ path: join(evidence, `${name}.png`), animations: 'disabled' });
}

async function inDialogViewport(dialog, target) {
  const frame = await dialog.boundingBox();
  const bounds = await target.boundingBox();
  return Boolean(frame && bounds && bounds.width > 0 && bounds.height > 0 &&
    bounds.x >= frame.x && bounds.x + bounds.width <= frame.x + frame.width &&
    bounds.y >= frame.y && bounds.y + bounds.height <= frame.y + frame.height);
}

async function checkArt(dialog, file) {
  const art = dialog.locator(`img[src$="/${file}"]`);
  assert.equal(await art.count(), 1, `the open dialog must show ${file}`);
  const decoded = await art.evaluate(async img => {
    await img.decode();
    return img.naturalWidth > 0 && img.alt === '';
  });
  assert.ok(decoded, `${file} must decode as decorative art`);
  assert.ok(await inDialogViewport(dialog, art), `${file} must be fully visible when the dialog opens`);
}

await withBrowser(async browser => {
  for (const size of ['desktop', 'phone', 'landscape']) {
    const { page, launch, press, errors } = await practicePage(browser, { mobile: size !== 'desktop' });
    if (size === 'landscape') await page.setViewportSize({ width: 720, height: 320 });

    await press(launch, 'Enter');
    const picker = page.getByRole('dialog', { name: 'Choose an outing' });
    const campaign = picker.getByRole('button', { name: 'Campaign', exact: true });
    const openShop = picker.getByRole('button', { name: 'Tackle shop', exact: true });
    await picker.waitFor();
    await checkArt(picker, 'mille-lacs-dawn.webp');
    assert.ok(await inDialogViewport(picker, campaign), 'Campaign stays visible with the outing art');
    assert.ok(await inDialogViewport(picker, openShop), 'Tackle shop stays visible with the outing art');
    await capture(page, `${size}-outings`);

    await press(openShop);
    const shop = page.getByRole('dialog', { name: 'Tackle shop' });
    const buy = shop.getByRole('button', { name: 'Buy Stronger line' });
    await buy.waitFor();
    await checkArt(shop, 'tackle-shop.webp');
    await checkArt(shop, 'marnie.webp');
    assert.ok(await inDialogViewport(shop, buy), 'the first Buy control stays visible with the shop art');
    assert.ok(await shop.getByText(/Marnie/).isVisible(), 'the shop names its keeper');
    await capture(page, `${size}-tackle-shop`);

    if (size === 'landscape') {
      const licenses = shop.getByRole('heading', { name: 'Licenses' });
      await licenses.scrollIntoViewIfNeeded();
      assert.ok(await inDialogViewport(shop, licenses), 'scroll to the last section in short landscape');
      assert.ok(await shop.evaluate(el => el.scrollTop > 0), 'scrolling stays inside the shop');
    }

    await press(shop.getByRole('button', { name: 'Back to outings' }));
    await picker.waitFor();
    assert.ok(await openShop.evaluate(el => document.activeElement === el), 'return focus to the shop entry');
    assert.deepEqual(errors, []);
    await page.close();
  }

  console.log('PASS: outing and shop art, controls, and focus on desktop, 320 px touch, and 720×320 landscape');
});
