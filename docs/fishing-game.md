# Fishing beneath the ice

Visitors click Bryan’s name or logo to fish in the lake they were already scrolling through. The site content gives way to open water. A little red-and-cream bobber follows the mouse, and on touch the lure moves to the selected fish. Players discover which lure works by watching how a fish responds and seeing the pairing when they land it.

## Strategy

The first outing should teach itself in about a minute. Give players an immediate response when they jig, a visible tug when a fish bites, and the fish’s name, rarity and points when it lands. Keep the nickname prompt at the end. The same lake, fish illustrations and warm lamp color make the game feel like part of Bryan’s site.

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

Each fish has a length and grade. Trophy and record lengths score more. A rare gilded color adds its own bonus and is a fictional game variant. Let players invest points earned from catches into Quick Bite, Line Control or Lift. Quick Bite brings the reel band forward, Line Control keeps the band open longer, and Lift reduces the extra pulls needed for large fish. Skills are earned within the six-encounter outing so every ranked outing starts on equal footing.

### Ranked deployment

The dedicated [Firebase project](https://console.firebase.google.com/project/fwbp-fishing-game/overview) is active. Enable Blaze and provision a Firestore database in the project's US region. Configure Firestore TTL on `expireAt` for `fishingRuns` and `fishingStarts` before opening ranked play. Install the dependencies in `functions` and deploy with `npx -y firebase-tools@latest deploy --project fwbp-fishing-game --only firestore:rules,functions`. The predeploy hook copies the shared rules into the upload. Smoke-test the function and then add a `fishing-api` meta tag to the site pointing to the verified HTTPS endpoint. Site releases without the tag offer practice. Account access can be managed in the project's Users and permissions settings.
