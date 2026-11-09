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

GitHub Pages uses the root of `main`. The branch started at v13; `origin/main` moved to v14 (`83277d0`) with two new Bryan cutouts and their image URLs. The branch includes v14 through merge `e7e7e0e`; no snapshot files changed relative to v14.

- #7: `63b6ec8`. Tray, search, escape, cues and milestone browser checks passed; 17 rules tests passed.
- #8: `36846c8`. 23 rules tests and six browser scripts passed. Seeded Muskie (species draw `.98`, Spoon), Jig, wait 700 ms, Reel to set the hook, wait 800 ms, Reel: 6.7 lb becomes 9.7 lb. Starter line snaps and stronger line holds.
- #9: profile and shop work in progress. No candidate or deployment yet.
