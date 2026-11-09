# Fishing campaign release candidate

Scope: [spec #6](https://github.com/garbledhamster/fwbp.net/issues/6) and tickets #7–#12. The approved action bar and the existing illustrated lake govern the interface. The browser proof starts from the real site entry on desktop and at 320 px, lands a fish, buys and equips line, then compares the same hard surge after dusk.

Base: v13, `e4051cd3ce1e9ec99590c6583ad93325e7112a8c`. Work on `fishing/line-physics-tackle-shop`. The baseline rules suite passed 17 tests. Keep earlier snapshots intact. Use the existing numbered release process after review; rehearse the archive locally. A production release or Firebase change needs separate authorization. If a later live release needs rollback, revert the campaign on main and publish a fresh numbered version.

| Ticket and order | Implementation and owner | Acceptance evidence |
| --- | --- | --- |
| #7 | Tray implementer. Choose Campaign or Practice at the site entry; show Ranked when configured. Use the existing lake and icons, split lures, tension and actions, and keep one SVG line from hole to the lure eye. Scroll moves the lure before the bite. Keep the existing search, bait, clock and landing rules for this slice. | Seeded keyboard and 320 px touch: choose both modes; scroll each way, resize and jig; verify attachment, wrong lure, valid hook and catch, visible focus and exit. Run existing search, escape, cue and milestone checks. |
| #8 ← #7 | Fight implementer. Add a deterministic campaign fight to the client rules path. Fish position, payout and load advance with elapsed time. Reel and Loosen change payout; a rating caps load. Use the same state for fish, hook, line, gauge and action; keep Practice and Ranked rules. | Clock and rules checks for no-input surge, safe reel, loosen, snap and landing. Seeded browser fight checks for attachment and stable actions, normal and reduced motion. |
| #9 ← #8 | Progression implementer. Keep one versioned profile in IndexedDB. Read and update it in the same transaction so a stale tab cannot overwrite a purchase. Pay once per campaign catch; shop between outings; buy and equip starter/stronger line. Freeze equipped effects per outing. | Test valid and invalid purchases, repeat/stale actions, snap without payout, persistence, mode isolation and matching starter/upgrade surge inputs on both viewports. |
| #10 ← #9 | Clock implementer. Track elapsed active time, persist and resume the cycle; show a phase label and light change. Draw the next fish from phase weights without replacing the current fish or its deadline. | Rules check boundaries and same-seed distribution; browser checks paused clock, reload, deadline and the full dusk comparison. |
| #11 ← #9 | Shop implementer after #10. Add a compatible hook and one rank of paid Line Control. Apply only the stated effects to campaign hook timing. | Same seeded bite compares starter, compatible and incompatible gear, and trained timing; test persistence and failed purchases. Practice milestone and mocked Ranked continue working. |
| #12 ← #9 | Access implementer after #11. Extend the same shop and rules wiring for a license and selectable second area. Reuse lake art; weight the roster by area. | Seeded locked/unlocked area, distinct roster, same wallet, reload, duplicate and unaffordable purchase. |

Run tests red then green for each behavior before integrating. Work in ticket order because #10–#12 share the shop, profile and campaign setup. Review the combined browser flow, capture desktop and phone proof, and record the exact tested revision and archive rehearsal here.

GitHub Pages uses the root of `main`. The branch started at v13; `origin/main` moved to v14 (`83277d0`) with two new Bryan cutouts and their image URLs. The branch includes v14 through merge `e7e7e0e` and v15 (`3e6205a`) through `9387b0c`. v15 updates Bryan’s camera illustration. The campaign leaves every numbered snapshot through v15 intact.

- #7: `63b6ec8`. Tray, search, escape, cues and milestone browser checks passed; 17 rules tests passed.
- #8: `36846c8`. 23 rules tests and six browser scripts passed. Seeded Muskie (species draw `.98`, Spoon), Jig, wait 700 ms, Reel to set the hook, wait 800 ms, Reel: 6.7 lb becomes 9.7 lb. Starter line snaps and stronger line holds.
- #9: profile `383d3e6` and `2d7324a`, shop `7ccaa54`, and Ranked isolation `41f0ecc`. Passed the browser shop replay on both widths and the two-tab save and mocked Ranked checks.
- #10: `162c5d0` and combined browser proof `c16da06`. All 26 then-current rules tests passed. The clock browser check passed for phase, odds, save, and pauses; the full shop replay passed at dusk on desktop and 320 px touch.
- #11: `0cd6b4c`. Timing checks and desktop/320 px browser checks passed for buying, equipping, reloading and using the Fine-wire hook and Line Control.
- #12: `dd8dee6`. Rules and desktop/320 px browser checks passed for buying the license, using the same wallet at Deep Reef, and returning to Starter Shore.
- Integration: `5a0c77e` and `4342183`. Kept the catch visible, fixed the recommended action, reset the lure when starting Ranked, stopped the clock when an outing expired, and kept a retry for a failed catch payout. Code review found no outstanding issue in the six ticket slices.

The first v16 snapshot, `4342183b0a9bb742ce99cbe8b96f233c91bd0223`, passed all 31 rules tests and all 13 browser scripts from the locally archived site. The visual review approved the desktop and 320 px portrait views. The browser replay found and landed a perch for 10 coins. At dusk the same Muskie and Reel input raised the load from 6.7 to 9.7 lb. The 8 lb starter line snapped. The 12 lb line held after purchase, equip and reload.

Game Studio playtest: an unseeded 320×568 touch session with the normal clock found a fish in two swipes, followed the bite and fight cues, landed a Walleye, and showed its 25 coins in the shop. A separate 320×720 to 720×320 rotation during a Muskie fight kept the line attached but put the fish behind the tray. Commit `e3a7299` keeps the hooked fish above a shorter landscape tray when the phone turns. The tray starts at 162 px instead of 126 px in the 320 px high viewport, the line stays within one pixel of the hook, and the load does not change on rotation. Fight rules, equipment and saves are unchanged.

The rotation candidate was `e3a7299f78529d021e714997cd0f8e501e0eb787`. The local v16 archive uses the production script’s file list and includes `fishing.css`, `fishing.mjs`, `rules.mjs` and `profile.mjs`. Verified:

- `node --test game/*.test.mjs`: 31 passed, zero failures.
- All 14 `game/*.browser.mjs` scripts with `FISHING_QA_URL=http://127.0.0.1:9899/v16/` and installed Chromium passed. This includes the dusk replay, landscape rotation, legacy Practice, mocked Ranked and saves across tabs.
- JavaScript syntax, publish script syntax, and `git diff --check` passed. The preview ZIP matches the tested archive. All ten images render in the browser proof.

Joe asked for every Campaign fish to come back to the ice hole before landing. Candidate `3d15039341fb2695044091451fda20c477056215` makes spawn depth set the distance to reel and species and individual size set the pull strength. In the matched test, the same perch takes three reels from Starter Shore and five from Deep Reef. The camera follows the ascent and offers Pull up at the hole. Points and coins follow the lift.

This candidate passed 34 rules tests and all 14 browser scripts against the rebuilt local v16 archive. The desktop and 320 px touch checks verified the hook reached the visible ice hole before lifting. The dusk comparison still measured 9.7 lb on both lines. The preview ZIP matches the archive, and all twelve screenshots render in the browser proof.

Production is v15 (`3e6205a`). There has been no campaign deployment, push to main, or Firebase change. The candidate is ready for Joe’s review.
