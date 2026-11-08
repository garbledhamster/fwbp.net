# Fishing beneath the ice

Choose **Play fishing game** to fish in the lake beneath the site. The site content gives way to open water. A fixed line hangs from the ice hole, and the lure bounces up and down when you jig. Watch how the fish responds to learn which lure works. The catch log records the pairing after you land it.

## Strategy

The first outing should teach itself in about a minute. Show how the fish responds to a jig, cue the player when it bites, and show its name, rarity and points when it lands. Ranked play offers a nickname prompt at the end. The same lake, fish illustrations and warm lamp color make the game feel like part of Bryan’s site.

An outing has six encounters in the existing dive sections. Pick one of three lures, find the fish, jig, and reel when the line is ready. A weak lure gets a response and leaves room to switch. The catch record reveals successful pairings. A player can start a new outing or leave at any point.

## Architecture

GitHub Pages continues to serve the site. A dedicated Firebase project, `fwbp-fishing-game`, hosts the optional ranked API. The browser owns animation and input. A single HTTPS function owns ranked encounters, action order, server timing, catch values and submission. Firestore transactions serialize updates to a run and accept one public score per run. Direct database access is denied. The server accepts action and nickname fields and derives the points itself. Use random bearer tokens, fixed run limits, constrained names, start quotas, expiring records and bounded function instances. A script can still imitate valid play.

Practice uses the same rules in memory. It is labeled before play and its scores stay out of the public board. A ranked connection failure offers a fresh practice outing. It never converts a practice result into a ranked entry.

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

Mille Lacs is the first lake. Keep its roster and encounter weights in a lake profile so a future outing can choose another profile at the start. This release has no lake picker. Start with yellow perch, rock bass, walleye, northern pike, smallmouth bass and muskellunge. The odds, lure pairings and size bands are game rules. The two record catches used as reference are a 58¼-inch muskie and a 46¼-inch northern pike from Mille Lacs. [Minnesota DNR species report](https://files.dnr.state.mn.us/publications/fisheries/special_reports/151.pdf) · [Minnesota DNR catch-and-release records](https://www.dnr.state.mn.us/fishing/catch-and-release.html)

Each fish has a length and grade. Trophy and record lengths score more. A rare gilded color adds its own bonus and is a fictional game variant. In Ranked, players can invest the point from each catch in Quick Bite, Line Control, or Lift. Quick Bite opens the reel window sooner. Line Control keeps it open longer, and Lift reduces the extra pulls for fish that fight. Ranks reset for each outing.

### Ranked deployment

The dedicated [Firebase project](https://console.firebase.google.com/project/fwbp-fishing-game/overview) is active. Enable Blaze and provision a Firestore database in the project's US region. Configure Firestore TTL on `expireAt` for `fishingRuns` and `fishingStarts` before opening ranked play. Install the dependencies in `functions` and deploy with `npx -y firebase-tools@latest deploy --project fwbp-fishing-game --only firestore:rules,functions`. The predeploy hook copies the shared rules into the upload. Smoke-test the function and then add a `fishing-api` meta tag to the site pointing to the verified HTTPS endpoint. Site releases without the tag offer practice. Account access can be managed in the project's Users and permissions settings.

### Level-up celebration

In Practice, each landed fish earns 10 XP toward Level 2, separate from its score. The second catch reaches Level 2 and brings up Bryan’s portrait, ribbon, and fish silhouettes. With reduced motion, the portrait and ribbon stay still. The tray announces the milestone and keeps the choice visible after the celebration fades. Choose one rank of **Line Control** for 350 ms more to set the hook, or **Lift** for one fewer pull on a fish that fights, down to one. **Next fish** skips the choice for this outing. A new Practice outing starts at Level 1 with fresh XP and ranks. In Ranked, the celebration still appears on each catch.

### Working the line

The lure hangs from the ice hole on one continuous line. Jig bounces it vertically, and the fish comes to inspect it. The tackle tray and lure share one SVG icon sheet, with labels on the controls.

The first reel uses the gold timing band. In Practice, Bryan tells you to wait at the bite and calls “Yeah, reel it!” when the window opens. If it closes, press **Reel** to resolve the attempt, then jig for the same fish. Common fish usually land on the first reel. Stronger or trophy fish pull the line tight. **Loosen** to drop the tension, then **Reel** when the line clears. Use **Pull up** on the last turn. Reeling against a tight line raises tension and can break it. Tougher fish surge more often. The ranked server still decides accepted timing and points.


### Run the game checks

Run `node --test game/rules.test.mjs` for the shared rules. To replay the seeded browser checks, start the local site as described in the README. Set `FISHING_QA_URL` to that URL and run `node game/cues.browser.mjs` and `node game/milestone.browser.mjs`. If Playwright is installed outside the checkout, set `PLAYWRIGHT_MODULE` to its module path. Use `CHROME_PATH` if you need to point Playwright to an installed Chrome.
