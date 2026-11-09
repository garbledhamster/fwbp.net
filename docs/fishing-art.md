# Fishing artwork preview

Base: `ac9cc1f` on `fishing/line-physics-tackle-shop`. This is a local proof for Joe. Preserve the existing game, saves and numbered snapshots. Do not push or deploy, change Firebase, or merge `origin/main`. Use the published presenter art as a style reference.

Use the existing outing and tackle shop dialogs. Add a frozen Mille Lacs scene to the outing menu, a counter scene to the shop, and a small portrait beside the name of Marnie, the fictional shopkeeper. These are design choices for the preview. Keep art outside the active lake so the fish, line and controls remain easy to see. A full lake art replacement would need separate checks for line and fish contrast at every depth, phase and viewport.

- [x] Art (Codex): generate the two scenes and portrait from the approved action bar and Bryan presenter art. Inspect and compress them as `assets/fishing/mille-lacs-dawn.webp`, `tackle-shop.webp`, and `marnie.webp`.
- [x] Dialogs (coding agent): add a browser check using the real entry and shop. Verify that art loads on desktop and 320 px touch; check short landscape for visible controls and reach the last shop section. Run it against the old preview first and confirm it fails because the new art is missing. Add the three images to the dialogs in `game/fishing.mjs` and `game/fishing.css`. Reserve space and use short landscape crops. Keep existing controls, names, focus and shopping behavior.
- [x] Local proof (Codex): review the diff, run the new check plus the full fishing rules and browser suites. Rehearse the numbered archive with the existing site file list, and inspect desktop, 320 px touch and short landscape screenshots. Leave a separate preview path on the existing local origin so the browser can use its saved Campaign profile. Record the tested revision and checks here.

The three built-in ImageGen illustrations ship as 75,822 bytes of WebP. The scene files are 1104 × 460 and the portrait is 256 × 256. The art pack has the original PNGs and prompts.

The new `game/art.browser.mjs` check first failed on the old `/v16/` preview because the outing art was missing. With the new art it passes at 1200 × 720, 320 × 720 touch, and 720 × 320 landscape. It checks decoded art, visible Campaign and shop controls, scrolling to Licenses, and focus return. Reviewed the six captured menu states. On short landscape screens the illustrations sit beside the headings so the first Buy button stays visible.

`node --test game/*.test.mjs` passed 34 tests. All 15 `game/*.browser.mjs` scripts passed against the local archive in Chromium. A separate playthrough earned 10 coins from a perch in the old preview, opened the new preview in the same browser context, and found those 10 coins available to spend. Syntax checks, the design detector, and `git diff --check` passed.

Local preview: http://127.0.0.1:9899/art-preview/. It uses the same browser save as the old preview at `/v16/`. This commit is the art candidate. No numbered snapshot, publishing branch, or Firebase file changed.
