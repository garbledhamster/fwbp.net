# Fishing beneath the ice

Choose **Play fishing game** to fish in the lake beneath the site. The site content gives way to open water. A fixed line hangs from the ice hole, and the lure bounces up and down when you jig. Watch how the fish responds to learn which lure works. The catch log records the pairing after you land it. After a Campaign or Practice catch saves, choose **Next fish**, **View in Your Lake**, or a Bryan video when one is available for that species. Cards and videos return to the same catch, outing and selected lure. A failed save offers **Save catch** before these next steps become available.

## Strategy

The first outing should teach you how to find, hook and land a fish. Show how the fish responds to a jig, cue the player when it bites, and show its name, rarity and points when it lands. Ranked play offers a nickname prompt after an outing with a catch. The same lake, fish illustrations and warm lamp color make the game feel like part of Bryan’s site.

Start at the ice hole and scroll the lake to find a fish. Jig becomes available when the fish comes into view above the tackle tray. Pick one of three lures and reel when the line is ready. Next fish leaves you at the same depth, so look above and below you. The catch log shows which lure worked for each fish you landed.

In Campaign and Practice, smaller fish fill the background. Look for the larger fish with the small diamond above it. Each outing starts fish on the left, middle and right across six depths.

Each outing has six encounters. Common fish give you 30 seconds, Uncommon fish 25 seconds, and Rare fish 20 seconds. The clock starts when the fish arrives and keeps running while you search or try lures. If time runs out, the fish swims away. It counts as one encounter and earns zero points and XP. You can leave at any time or start another outing when you finish.

## Architecture

GitHub Pages continues to serve the site. A dedicated Firebase project, `fwbp-fishing-game`, hosts the optional ranked API. The browser owns animation and input. A single HTTPS function owns ranked encounters, action order, server timing, catch values and submission. Firestore transactions serialize updates to a run and accept one public score per run. Direct database access is denied. The server accepts action and nickname fields and derives the points itself. Use random bearer tokens, fixed run limits, constrained names, start quotas, expiring records and bounded function instances. A script can still imitate valid play.

Practice uses the Campaign fishing rules with Starter Shore tackle and a fresh clock. Its XP and skill choice last for that outing. Saved catches and learned tips enter Your Lake, while the Campaign wallet, equipment, clock and award ledger stay unchanged. Practice is labeled before play and its scores stay out of the public board. A ranked connection failure offers a fresh practice outing. It never converts a practice result into a ranked entry.

## Engineering

Reuse the existing SVG fish. Add an interactive layer above the decorative lake art while hiding and disabling normal site content. Use a compact bottom tackle tray with three named slots and one large action control. Keep the fish and bobber visually prominent. Make the same select, jig and reel sequence work with mouse, touch and keyboard. In Campaign and Practice, **Menu** or Escape opens Pause. **Leave outing** restores the original site scroll and focus. Ranked retains **Exit fishing**. Honor reduced motion and provide text for each bite and catch state.

Pause offers Resume fishing, Gear, Tackle shop, Your Lake and Controls. Local dialogs hold the outing's encounter, fight, lighting and animation clocks. Your Lake stays above Pause, and a video stays above its source card; closing each dialog returns focus to its own entry control. Closing Your Lake leaves Pause open until the player resumes. Ranked timing keeps running and its results do not write to the local collection.

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

The first reel uses the gold timing band. In Practice, Bryan tells you to wait at the bite and calls “Yeah, reel it!” when the window opens. A bite before the fish’s deadline gives you the full reel window. If the window closes, press **Reel** to resolve the attempt. You can jig again if the fish still has time left. In Campaign and Practice, **Loosen** when the line tightens, **Reel** when it clears, and **Pull up** when the fish reaches the ice hole. Reeling against a tight line raises tension and can break it. In Ranked, the server decides timing and points, and a standard common fish can land on the first reel.


Bryan speaks in the Field Comic bubble during Campaign and Practice. A slipped hook, a catch, and a fish that runs out its timer each use a different portrait. Use **Try again** in the bubble to jig after a missed hook, or **Next fish** after a catch or departure. While a fish is hooked, the cue beside the line shows whether to reel up or loosen.

A wrong lure makes the fish back away. Rare fish leave after two wrong jigs and other fish leave after three. The next encounter starts with a fresh count. Scroll upward again at the ice hole to bring the lure in. It stays visible at the rim when you stop scrolling.


### Campaign

Choose **Campaign** from **Play fishing game**. Use Bryan’s clue to pick a spot on Mille Lacs, then open a hole. Scroll or swipe inside the fixed game view to move to a fish’s depth. Click or tap the jig to work the bait. A fish that likes the bait swims toward the jig. Contact tugs the line and starts the wait for gold. Set the hook in gold, then work the line anywhere in the water. Deeper fish take more reeling, and heavy fish and tight line slow each pull. The gauge compares the load with your line rating.

Land fish to earn coins. A new Campaign player claims the free **Starter Shore permit** in the tackle shop before the first outing. Choose a locked area to meet Officer Rowan, a fictional conservation guide, who names its permit, price and any coin shortfall. **Get this permit** opens that exact shop item. Closing the shop returns to the chosen area so you can decide when to fish. Existing saves retain their permits. The **Deep Reef permit** costs 25 game coins and opens a second area of Mille Lacs with a different mix of fish. These permits unlock game areas; for real fishing, check [Minnesota DNR requirements](https://www.dnr.state.mn.us/regulations/fishing/index.html) and [Mille Lacs rules](https://www.dnr.state.mn.us/fishing/millelacs.html).

The free 8 lb Starter line gives Jig 100 ms more to set the hook. At level 2, buy the 12 lb Stronger line for 10 coins, a specialist hook for 15 coins, or Waxworm bait. The Fine-wire setup gives Jig another 200 ms, and the Octopus setup gives Minnow another 200 ms. At level 10 the shop opens pro gear and live bait. Equipment changes apply to the next outing. A snap costs an attempt and leaves your gear and coins in the save.

Each saved Campaign catch adds coins, XP and collection credit together. Bryan starts with yellow perch, then asks for northern pike and, with a Deep Reef permit, walleye. Catch the fish he asked for to earn the full reward and advance his goal in the same save. Other fish go into Your Lake and pay half while a goal is active. Your earlier Campaign payouts count toward your level. Each level gained grants a skill point. Spend one at Level 2 on Drilling to open two new holes per day, starting the next day. You can reset spent points for free between outings. Earlier paid Line Control counts toward that technique. Save two Campaign catches across outings to earn **Lake Regular**.

Campaign cycles through 30 seconds of day, 30 seconds of dusk and 45 seconds of night. The current light influences newly drawn candidates. Fish already presented at a hole keep their identity and a committed fish keeps its countdown. The clock pauses between outings and while you browse game menus.

The browser saves the wallet, tackle, training, licenses, clock and credited catches together. Practice keeps its labeled controls, starter hook and 8 lb line. It starts in daylight and keeps its XP and skill choice for that outing. Ranked uses server timing, points and gear rules, with a separate score and equipment contract.

Gear compares this outing’s loadout with the next Campaign outing. Browse the Tackle Shop by category and select a tile to see its effect, price and requirements. Buy and Equip are separate actions. After a catch saves, the reward panel shows the fish, its size tier and the rewards. Open Your Lake from the panel or choose the next fish.

### Your Lake and fish videos

Your Lake tracks the six Mille Lacs game species after a Campaign or Practice landing is saved. Open a caught species and choose **Learn this tip** to save its lure cue. The cue appears on later encounters with that species; learning during an encounter leaves that fish's guidance unchanged. Older saves keep their wallet and tackle, with species tracking starting from new saved landings.

The site's **Your Lake** toggle reveals caught game species and the collection count. Outside that mode, the original 23-species reference remains available. The same species cards serve the site and an outing, with a species reference link even when Bryan has no matching footage.

Contextual videos appear only for the verified walleye, northern pike, smallmouth bass and muskie footage in the [video audit](bryan-videos.md). Yellow perch and rock bass have no contextual video action. The player includes a public YouTube link if its embed cannot play. Closing it removes the iframe and returns to the same card or saved catch.

### Run the game checks

Run `node --test game/*.test.mjs` for the rules. Start the local site as described in the README. Set `FISHING_QA_URL` to that URL, then run `for check in game/*.browser.mjs; do node "$check" || break; done`. If Playwright is installed outside the checkout, set `PLAYWRIGHT_MODULE` to its module path. Use `CHROME_PATH` to point Playwright to an installed Chrome.

The seeded shop check finds and lands a fish, buys and equips stronger line, and compares the same hard pull after dusk on desktop and at 320 px. Set `FISHING_EVIDENCE_DIR` to capture the catch, shop and both surge outcomes when running `node game/shop.browser.mjs`.

Run `node game/connected.browser.mjs` for the real free-permit launch, catch save failure and retry, collection study, supported and unsupported video actions, nested focus and pause holds, and existing-save reload. It covers desktop, 320 px touch and 720×320 touch landscape; `FISHING_EVIDENCE_DIR` captures those views. Run the separate rules and browser test wave after all implementation slices and art are integrated.

### Campaign map and shared outing

Campaign opens the packaged Mille Lacs map before the outing. Select a water cell to inspect its sourced, rounded depth and modeled habitat, temperature and likely fish. Depth and temperature overlays have text legends. Tab reaches every water cell; arrow keys move among cells. A locked cell opens Officer Rowan and its exact permit item. Returning from the shop preserves the selected cell. Choose **Drill hole** and turn the auger until the hole opens, or choose **Skip drilling**. The number of turns varies by spot. Both choices open the same hole and use one slot. Backing out before you open it keeps the slot available.

Open one new hole per day at the starting rank. The map marks each opened hole and lets you revisit it for free. Marks and the remaining allowance survive reload. Within a live outing, the six attempts, clock, catch log and active rod setup carry across holes. A bite commits an attempt, so you can try bait and explore before contact. To move after a bite, confirm **End attempt** or **Release fish**. Ending or finishing the day closes its holes. The next day starts with a blank map and a fresh allowance.

`campaign-map.mjs` owns the map, drilling and confirmation dialogs. Its callbacks use the existing suspension and permit/shop return contracts. `rules.mjs` accepts a small `campaign.hole` object from the browser and remains self-contained for the Ranked function deployment. `moveToHole`, `stepCampaignFish` and `abandonHoleFish` work on the same run. The IndexedDB profile stores the current day’s allowance and opened cells. The live run holds fish positions and the current attempt. `lake-map-data.mjs` and `assets/maps/mille-lacs.svg` share one coordinate transform. See the packaged map attribution and rebuild notes in `assets/maps/README.md`.

Run `node game/map.browser.mjs` for permit return, bite commitment, abandonment and revisits. Run `node game/map-drill.browser.mjs` for drill and skip parity, distinct effort, and equipment across outings. Run `node game/campaign-day.browser.mjs` for the saved allowance, revisits, reload and the overnight reset. The shared browser helper now enters Campaign through its map and drilling screen; Practice still uses the original path.

### Campaign line gestures

Click or tap the jig to work the bait. When the fish bites, wait for gold and click or tap the jig again to set the hook. After hooking a fish, scroll or swipe anywhere in the water. Up reels or pulls up at the hole, and down loosens. The bottom tray keeps bait and the line tension meter. Controls in Pause lists the keyboard equivalents. Add `?campaign-live-buttons=1` to the page URL to restore the live action buttons for a comparison. The save, Next fish and Your Lake actions are available in either view.

Run `node game/campaign-tray.browser.mjs` for six catches by click and wheel or tap and swipe, including a failed save and retry, Your Lake return and the end of the outing. `node game/gestures.browser.mjs` covers input guards and landscape touch.
