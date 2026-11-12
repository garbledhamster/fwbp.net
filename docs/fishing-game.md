# Ice Fishing with Bryan

Choose **Go ice fishing with Bryan** in the site navigation to open the title screen. Hover, focus with the keyboard, or press and hold on a phone to read about the game. It is free to play, and each outing gives you a chance to learn the terms and try a different spot on the Mille Lacs map. Play a round between bites on the ice or after you get home. **Start Game** opens the existing outing picker, where you can choose Tutorial with Bryan, Campaign, Practice or Ranked when available. **Exit Game** or Escape closes the title screen and returns focus to the site control that opened it. The ice hole on the homepage also opens the title screen. The view moves into the hole and carries the same artwork into the menu. With reduced motion enabled, the menu opens directly. The title screen opens before an outing begins.

Once you choose an outing, you fish in the lake beneath the site. The site content gives way to open water. A fixed line hangs from the ice hole, and the lure bounces up and down when you jig. Watch how the fish responds to learn which lure works. The catch log records the pairing after you land it. After a Campaign or Practice catch saves, choose **Next fish** or **My Lake**. Bryan’s matching videos open on YouTube. Closing My Lake returns to the same catch and outing. A failed save offers **Save catch** before these next steps become available.

## Strategy

The first outing should teach you how to find, hook and land a fish. Show how the fish responds to a jig, cue the player when it bites, and show its name, rarity and points when it lands. Ranked play offers a nickname prompt after an outing with a catch. The same lake, fish illustrations and warm lamp color make the game feel like part of Bryan’s site.

Start at the ice hole and look for a fish. Pick one of three lures, jig, and wait for the hook cue. The catch log shows which lure worked for each fish you landed.

The smaller fish fill the background. In Campaign, the larger fish patrol the hole at different depths. In Practice, look for the fish with the small diamond above it.

Each outing has six encounters. Common fish give you 30 seconds, Uncommon fish 25 seconds, and Rare fish 20 seconds. Practice and Ranked start the countdown when the fish arrives. Campaign starts it on the first bite. If time runs out, the fish swims away. It counts as one encounter and earns zero points and XP. You can leave at any time or start another outing when you finish.

## Architecture

GitHub Pages continues to serve the site. A dedicated Firebase project, `fwbp-fishing-game`, hosts the optional ranked API. The browser owns animation and input. A single HTTPS function owns ranked encounters, action order, server timing, catch values and submission. Firestore transactions serialize updates to a run and accept one public score per run. Direct database access is denied. The server accepts action and nickname fields and derives the points itself. Use random bearer tokens, fixed run limits, constrained names, start quotas, expiring records and bounded function instances. A script can still imitate valid play.

Practice uses its labeled controls, starter tackle and a fresh clock. Its XP and skill choice last for that outing. Saved catches and learned tips enter My Lake, while the Campaign wallet, equipment, clock and award ledger stay unchanged. Practice is labeled before play and its scores stay out of the public board. A ranked connection failure offers a fresh practice outing. It never converts a practice result into a ranked entry.

## Engineering

Reuse the existing SVG fish. Add an interactive layer above the decorative lake art while hiding and disabling normal site content. Use a compact bottom tackle tray with three named slots and one large action control. Keep the fish and bobber visually prominent. Make the same select, jig and reel sequence work with mouse, touch and keyboard. In Campaign and Practice, **Menu** or Escape opens Pause. **Leave outing** restores the original site scroll and focus. Ranked retains **Exit fishing**. Honor reduced motion and provide text for each bite and catch state.

Pause offers Resume fishing, Gear, Tackle shop, My Lake and Controls. Local dialogs hold the outing's encounter, fight, lighting and animation clocks. My Lake stays above Pause and returns focus to its entry control when closed. Video cards open the public YouTube link outside the game. Closing My Lake leaves Pause open until the player resumes. Ranked timing keeps running and its results do not write to the local collection.

Use one rule module for the practice adapter and the ranked API. Keep species values and timings together. Test the happy path, wrong lure, early and late reel, expired and stale requests, forged score fields, retry and one-entry submission. Exercise a real browser on desktop and phone and verify the numbered release includes the game files.

## Operations

Ship the site with its existing numbered release process. Deploy and probe the ranked API before configuring the frontend to use it. If billing or cloud permissions block Functions, the site can publish with practice available. Verify both live URLs, then verify an anonymous ranked catch, score submission and duplicate request against the production backend before announcing ranked play. Document the project, deployment commands, console access and checks below once verified.

The explicit `site_files` list in `gitpush` includes every browser module, collection CSS and the assets folder. Keep runtime profile and rules import URLs consistent, and update index script/CSS cache versions when releasing changes. Rehearse the archive locally before publishing; existing numbered folders stay read-only.

Rollback by reverting the site feature and publishing a fresh numbered version. Restore ranking by repairing the same backend endpoint. Review function traffic, Firestore TTL, quota pressure and public nicknames after launch.

## Implementation order

1. Add failing tests for a complete catch, discovery, timing and score integrity. Build the rule module and pass them.
2. Connect the existing lake to the practice adapter. Verify entry, catch, replay and exit on two viewports.
3. Implement the Firebase transaction adapter and release configuration. Verify a ranked run and repeat submission.
4. Publish via the site release script and smoke-test live pages.

## Lake, grades and skills

Mille Lacs is the first lake. Keep its roster and encounter weights in a lake profile so a future outing can choose another profile at the start. Practice and Ranked use this lake profile without a picker. Start with yellow perch, rock bass, walleye, northern pike, smallmouth bass and muskellunge. The odds, lure pairings and size bands are game rules. The two record catches used as reference are a 58¼-inch muskie and a 46¼-inch northern pike from Mille Lacs. [Minnesota DNR species report](https://files.dnr.state.mn.us/publications/fisheries/special_reports/151.pdf) · [Minnesota DNR catch-and-release records](https://www.dnr.state.mn.us/fishing/catch-and-release.html)

Each fish has a length and grade. Trophy and record lengths score more. A rare gilded color adds its own bonus and is a fictional game variant. In Ranked, players can invest the point from each catch in Quick Bite, Line Control, or Lift. Quick Bite opens the reel window sooner. Line Control keeps it open longer, and Lift reduces the extra pulls for fish that fight. Ranks reset for each outing.

### Ranked deployment

The dedicated [Firebase project](https://console.firebase.google.com/project/fwbp-fishing-game/overview) is active. Enable Blaze and provision a Firestore database in the project's US region. Configure Firestore TTL on `expireAt` for `fishingRuns` and `fishingStarts` before opening ranked play. Install the dependencies in `functions` and deploy with `npx -y firebase-tools@latest deploy --project fwbp-fishing-game --only firestore:rules,functions`. The predeploy hook copies the shared rules into the upload. Smoke-test the function and then add a `fishing-api` meta tag to the site pointing to the verified HTTPS endpoint. Site releases without the tag offer practice. Account access can be managed in the project's Users and permissions settings.

### Level-up celebration

In Practice, each landed fish earns 10 XP toward Level 2, separate from its score. The second catch reaches Level 2 and brings up Bryan’s portrait, ribbon, and fish silhouettes. With reduced motion, the portrait and ribbon stay still. The tray announces the milestone and keeps the choice visible after the celebration fades. Choose one rank of **Line Control** for 350 ms more to set the hook, or **Lift** to reel in extra line on the first clear pull of each fight. **Next fish** skips the choice for this outing. A new Practice outing starts at Level 1 with fresh XP and ranks. In Ranked, the celebration still appears on each catch.

### Working the line

The lure hangs from the ice hole on one continuous line. Jig bounces it vertically, and the fish comes to inspect it. The tackle tray and lure share one SVG icon sheet, with labels on the controls.

The first reel uses the gold timing band. In Practice, Bryan tells you to wait at the bite and calls “Yeah, reel it!” when the window opens. A bite before the fish’s deadline gives you the full reel window. If the window closes, press **Reel** to resolve the attempt. You can jig again if the fish still has time left. In Practice and the tutorial, **Loosen** when the line tightens, **Reel** when it clears, and **Pull up** when the fish reaches the ice hole. Reeling against a tight line raises tension and can break it. In Ranked, the server decides timing and points, and a standard common fish can land on the first reel.


Bryan speaks in the Field Comic bubble during Practice and the tutorial. A slipped hook, a catch, and a fish that runs out its timer each use a different portrait. Use **Try again** in the bubble to jig after a missed hook, or **Next fish** after a catch or departure. While a fish is hooked, the cue beside the line shows whether to reel up or loosen.

In Practice, a wrong lure makes the fish back away. Rare fish leave after two wrong jigs and other fish leave after three. The next encounter starts with a fresh count. Scroll upward again at the ice hole to bring the lure in. It stays visible at the rim when you stop scrolling.


### Campaign

Choose **Campaign** from the title screen. Pick a spot on Mille Lacs and claim the free game permit the first time you fish. Drag the jig up or down to the fish’s depth. On a phone, flick to move farther. The mouse wheel also moves the jig. The camera follows the hook.

Tap the water to make the jig hop. When Bryan says **Tap to hook!**, tap again. The hook accepts a tap up to 220 ms early. Keep tapping to reel in the fish. The blue meter holds steady, red gives line back, and green reels in. When you pause, the fish takes line. Larger and deeper fish can run farther. Stronger line reduces the amount of line a running fish takes. Specialist hooks and carried bait give the matching lure more time to set the hook.

A landing saves the specimen, size, age, quality, grade, and the hook and line you carried. The Campaign score and XP still use the species points and Bryan’s goal sequence. A saved landing adds one practice point. Spend points in **Angler Skills** after a catch or between outings. Line control caps at 5, while Reel rhythm and Hook timing cap at 3. A rank costs one point and applies on your next encounter. Old Line Control ranks carry into Line control and Lure Work ranks carry into Hook timing up to their new caps. Overflow and old Drilling ranks become available points. Any open day keeps its saved hole allowance. Inventory, coins, gear, collection, and historical catches carry forward.

Campaign cycles through 30 seconds of day, 30 seconds of dusk and 45 seconds of night. The light influences newly drawn fish. Opening a menu holds the fight and the clock. Equipment changes apply to the next outing.

### My Lake and fish videos

My Lake tracks all six game species after a Campaign or Practice catch. Campaign fish earn pending coins based on quality, with a bonus for the first catch of a species. Open the species and choose **Collect Reward** to add those coins to your wallet. The daily quest for two Campaign yellow perch has its own claim and resets at midnight Central time. **Learn this tip** saves the fish’s lure cue for a later encounter.

A verified Bryan match appears as a thumbnail card that opens the direct YouTube URL. Yellow perch and rock bass get species references. The site guide also keeps the full 23-species reference. The [video audit](bryan-videos.md) lists the exact footage used by the game.

### Run the game checks

Run `node --test game/*.test.mjs` for the rules. Start the local site as described in the README. Set `FISHING_QA_URL` to that URL, then run `for check in game/*.browser.mjs; do node "$check" || break; done`. If Playwright is installed outside the checkout, set `PLAYWRIGHT_MODULE` to its module path. Use `CHROME_PATH` to point Playwright to an installed Chrome.

The seeded shop check lands a fish, claims the reward, buys and equips stronger line, and compares the same fish’s initial run on desktop and at 320 px. Set `FISHING_EVIDENCE_DIR` to capture the catch, shop and both surge outcomes when running `node game/shop.browser.mjs`.

Run `node game/connected.browser.mjs` for the real free-permit launch, catch save failure and retry, collection study, supported and unsupported video actions, nested focus and pause holds, and existing-save reload. It covers desktop, 320 px touch and 720×320 touch landscape; `FISHING_EVIDENCE_DIR` captures those views. Run the separate rules and browser test wave after all implementation slices and art are integrated.

### Campaign map and shared outing

Campaign opens the packaged Mille Lacs map before the outing. Choose the depth or temperature layer to see a shaded legend with numeric ranges and a reading for the selected spot. Depth is rounded from DNR contours. Temperature is a game estimate near the bottom. **Ask Bryan** explains how to use those readings and what to look for in each habitat. Tab reaches every water cell, and arrow keys move among cells. A locked cell opens Officer Rowan and its permit. Returning from the shop preserves the selected cell. Choose **Drill hole** and turn the auger, or choose **Skip drilling**. Either choice opens the same hole and uses one slot. Backing out before opening keeps the slot available.

Open two new holes per day. A fishing day saved with an earlier allowance keeps it until the day ends. Once a hole opens, the map shows fish from its roster that you already recognize through My Lake. Landing a fish adds its species to My Lake and saves where it was caught. A past catch marker points to the spot while the species history lives in My Lake. A hole stays quiet for the day once its last fish is caught.

Open holes, their remaining fish, and the drilling allowance survive reload. Within a live outing, the six attempts, clock, catch log and active rod setup carry across holes. A bite commits an attempt. To move after a bite, confirm **End attempt** or **Release fish**. Ending or finishing the day resets the open holes and allowance for the next day. Past catch markers carry forward.

`campaign-map.mjs` owns the map, help, drilling and confirmation dialogs. Its callbacks use the existing suspension and permit and shop return contracts. `rules.mjs` accepts the hole and its saved roster from the browser and stays self-contained for Ranked deployment. `moveToHole`, `stepCampaignFish` and `abandonHoleFish` work on the same run. The IndexedDB profile stores the day’s allowance, opened cells, rosters and catch locations. The live run holds swim positions and the current attempt. `lake-map-data.mjs` and `assets/maps/mille-lacs.svg` share one coordinate transform. See the packaged map attribution and rebuild notes in `assets/maps/README.md`.

Run `node game/map.browser.mjs` for permit return, bite commitment, abandonment and revisits. Run `node game/map-drill.browser.mjs` for drill and skip parity, distinct effort, and equipment across outings. Run `node game/campaign-day.browser.mjs` for the saved allowance, revisits, reload and the overnight reset. The shared browser helper now enters Campaign through its map and drilling screen; Practice still uses the original path.

### Campaign browser replay

Run `node game/campaign-integration.browser.mjs` for the site entry, mouse and touch controls, buffered hook, attached rig, standard and trophy fights, celebration and My Lake claim. Set `FISHING_SCREENSHOTS` to an existing directory to save evidence. The title and pause menus display the local build label or the version of the numbered release.

Run `node game/campaign-tray.browser.mjs` for six Campaign landings, including a failed save and retry, My Lake focus and outing completion. `node game/gestures.browser.mjs` checks touch cancellation and modal input. `node game/lake-rewards.browser.mjs` checks reward and quest claims across reloads and tabs.
