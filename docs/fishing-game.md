# Fishing beneath the ice

Choose **Play fishing game** to fish in the lake beneath the site. The site content gives way to open water. A fixed line hangs from the ice hole, and the lure bounces up and down when you jig. Watch how the fish responds to learn which lure works. The catch log records the pairing after you land it.

## Strategy

The first outing should teach you how to find, hook and land a fish. Show how the fish responds to a jig, cue the player when it bites, and show its name, rarity and points when it lands. Ranked play offers a nickname prompt after an outing with a catch. The same lake, fish illustrations and warm lamp color make the game feel like part of Bryan’s site.

Start at the ice hole and scroll the lake to find a fish. Jig becomes available when the fish comes into view above the tackle tray. Pick one of three lures and reel when the line is ready. Next fish leaves you at the same depth, so look above and below you. The catch log shows which lure worked for each fish you landed.

In Campaign and Practice, smaller fish fill the background. Look for the larger fish with the small diamond above it. Each outing starts fish on the left, middle and right across six depths.

Each outing has six encounters. Common fish give you 30 seconds, Uncommon fish 25 seconds, and Rare fish 20 seconds. The clock starts when the fish arrives and keeps running while you search or try lures. If time runs out, the fish swims away. It counts as one encounter and earns zero points and XP. You can leave at any time or start another outing when you finish.

## Architecture

GitHub Pages continues to serve the site. A dedicated Firebase project, `fwbp-fishing-game`, hosts the optional ranked API. The browser owns animation and input. A single HTTPS function owns ranked encounters, action order, server timing, catch values and submission. Firestore transactions serialize updates to a run and accept one public score per run. Direct database access is denied. The server accepts action and nickname fields and derives the points itself. Use random bearer tokens, fixed run limits, constrained names, start quotas, expiring records and bounded function instances. A script can still imitate valid play.

Practice uses the Campaign fishing rules in memory with Starter Shore tackle and a fresh clock. It is labeled before play and its scores stay out of the public board. A ranked connection failure offers a fresh practice outing. It never converts a practice result into a ranked entry.

## Engineering

Reuse the existing SVG fish. Add an interactive layer above the decorative lake art while hiding and disabling normal site content. Use a compact bottom tackle tray with three named slots and one large action control. Keep the fish and bobber visually prominent. Make the same select, jig and reel sequence work with mouse, touch and keyboard. Escape and the Exit button restore the original scroll and focus. Honor reduced motion and provide text for each bite and catch state.

Use one rule module for the practice adapter and the ranked API. Keep species values and timings together. Test the happy path, wrong lure, early and late reel, expired and stale requests, forged score fields, retry and one-entry submission. Exercise a real browser on desktop and phone and verify the numbered release includes the game files.

## Operations

Ship the site with its existing numbered release process. Deploy and probe the ranked API before configuring the frontend to use it. If billing or cloud permissions block Functions, the site can publish with practice available. Verify both live URLs, then verify an anonymous ranked catch, score submission and duplicate request against the production backend before announcing ranked play. Document the project, deployment commands, console access and checks below once verified.

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

Choose **Campaign** from **Play fishing game**. Scroll to find a fish and follow the line down from the ice hole. Jig with a lure the fish responds to, then set the hook in the gold window. Every hooked fish has to come back to the ice hole. A deeper fish takes more reeling, and the fish’s species and size affect how hard it pulls. Use **Loosen** when the line tightens, reel when it clears, and choose **Pull up** when the fish reaches the hole. The gauge compares the current load with the rating of your equipped line.

Land fish to earn coins. To spend them, exit the outing and choose **Tackle shop** from the outing menu. The 8 lb starter line, starter hook and Starter Shore license are free. A standard Yellow perch earns enough for the 12 lb line. The Fine-wire hook gives Jig 200 ms more to set the hook, and Line Control training gives all lures 350 ms more. The Deep Reef license opens a second area of Mille Lacs with a different mix of fish.

Campaign cycles through 30 seconds of day, 30 seconds of dusk and 45 seconds of night during an outing. The light and phase label change together. The new odds apply when you move to the next fish; the current fish keeps its countdown. The clock pauses between outings.

The browser saves the wallet, tackle, training, licenses, clock and credited catches together. An outing uses the equipment you chose when you started it. Practice uses the same tackle tray, fight and lighting cycle with the starter hook and 8 lb line. It starts in daylight and keeps its XP and skill choice for that outing. Ranked uses server timing, points and gear rules; campaign purchases never enter its requests.

### Run the game checks

Run `node --test game/*.test.mjs` for the rules. Start the local site as described in the README. Set `FISHING_QA_URL` to that URL, then run `for check in game/*.browser.mjs; do node "$check" || break; done`. If Playwright is installed outside the checkout, set `PLAYWRIGHT_MODULE` to its module path. Use `CHROME_PATH` to point Playwright to an installed Chrome.

The seeded shop check finds and lands a fish, buys and equips stronger line, and compares the same hard pull after dusk on desktop and at 320 px. Set `FISHING_EVIDENCE_DIR` to capture the catch, shop and both surge outcomes when running `node game/shop.browser.mjs`.
