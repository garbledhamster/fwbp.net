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
  // Chromium rounds a scroll container's maximum scroll offset to whole pixels.
  const edgeTolerance = .5;
  return Boolean(frame && bounds && bounds.width > 0 && bounds.height > 0 &&
    bounds.x >= frame.x - edgeTolerance && bounds.x + bounds.width <= frame.x + frame.width + edgeTolerance &&
    bounds.y >= frame.y - edgeTolerance && bounds.y + bounds.height <= frame.y + frame.height + edgeTolerance);
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
    const { page, openGame, press, selectTackle, closeDialog, errors } = await practicePage(browser, {
      mobile: size !== 'desktop',
      viewport: size === 'landscape' ? { width: 720, height: 320 } : undefined,
    });

    await openGame();
    const picker = page.getByRole('dialog', { name: 'Choose an outing' });
    const campaign = picker.getByRole('button', { name: 'Campaign', exact: true });
    const tutorial = picker.getByRole('button', { name: 'Tutorial with Bryan', exact: true });
    const openShop = picker.getByRole('button', { name: 'Tackle shop', exact: true });
    await picker.waitFor();
    await checkArt(picker, 'mille-lacs-dawn.webp');
    assert.ok(await inDialogViewport(picker, campaign), 'Campaign stays visible with the outing art');
    assert.ok(await inDialogViewport(picker, tutorial), 'Tutorial stays visible with the outing art');
    await capture(page, `${size}-outings`);
    assert.ok(await inDialogViewport(picker, openShop), `${size}: Tackle shop stays visible with the outing art`);

    await press(openShop);
    const shop = page.getByRole('dialog', { name: 'Tackle shop' });
    const lineTile = shop.locator('[data-shop-select="stronger-line"]');
    await lineTile.waitFor();
    if (size === 'landscape') {
      assert.ok(await shop.locator('img[src$="/tackle-shop.webp"]').isHidden(), 'short landscape gives the shop controls more room');
      assert.ok(await shop.locator('img[src$="/marnie.webp"]').isHidden(), 'short landscape uses a compact shop header');
    } else {
      await checkArt(shop, 'tackle-shop.webp');
      await checkArt(shop, 'marnie.webp');
      assert.ok(await shop.getByText('Marnie', { exact: true }).isVisible(), 'the shop names its keeper');
      assert.ok(await inDialogViewport(shop, lineTile), 'the first upgrade stays visible when the shop opens');
    }
    await capture(page, `${size}-tackle-shop`);

    const categories = shop.getByRole('navigation', { name: 'Shop categories' });
    for (const name of ['Bait', 'Hooks', 'Training', 'Licenses', 'Fishing line']) {
      const category = categories.getByRole('button', { name, exact: true });
      await category.scrollIntoViewIfNeeded();
      assert.ok(await inDialogViewport(categories, category), `${name} category can be brought fully into view`);
      const bounds = await category.boundingBox();
      assert.ok(bounds.width >= 44 && bounds.height >= 44, `${name} has a usable touch target`);

      await press(category);
      const heading = shop.getByRole('heading', { name, exact: true });
      assert.ok(await inDialogViewport(shop, heading), `${name} category reaches its heading`);
      assert.equal(await heading.evaluate(el => el === document.activeElement), true, `${name} category receives focus`);
    }
    const line = await selectTackle('stronger-line');
    const buy = line.getByRole('button', { name: 'Buy Stronger line', exact: true });
    assert.ok(await inDialogViewport(shop, buy), 'the first Buy control is reachable inside the shop');
    assert.equal(await buy.isDisabled(), true, 'Stronger line is visible before Level 2 and cannot be bought yet');
    assert.ok(await shop.evaluate(el => el.scrollWidth <= el.clientWidth), 'shop has no horizontal overflow');
    await capture(page, `${size}-shop-purchase`);

    await closeDialog(shop, shop.getByRole('button', { name: 'Back to outings' }));
    await picker.waitFor();
    assert.ok(await openShop.evaluate(el => document.activeElement === el), 'return focus to the shop entry');
    assert.deepEqual(errors, []);
    await page.close();
  }

  console.log('PASS: outing and shop art, controls, and focus on desktop, 320 px touch, and 720×320 landscape');
});
