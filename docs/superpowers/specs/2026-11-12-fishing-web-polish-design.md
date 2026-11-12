# Fishing with Bryan web polish

Design for review · November 12, 2026 · Baseline v31 (`4399357`)

## What a player should be able to do

Open the game from Bryan’s site or a Home Screen icon and see the same title screen. A new player can press **Play** and start fishing for Bryan’s guided perch. A returning player can choose **Continue** to reopen their saved Campaign day or go to the map if there is no active day.

Tap anywhere on the water to jig. Swipe down and the lure drops with the push. A quick flick carries farther after the thumb lifts. Swipe up to bring the lure up. When a fish bites, the player can tap the water during a clear, forgiving **Hook now** cue. Once hooked, the fish turns away and pulls the line when it runs. When the player reels the line tight, the fish turns toward the hole. The line stays attached to its mouth through both motions.

The Android app is outside this update. Campaign progress, the catch collection, tackle, skills and the existing Ranked contract carry forward.

## Where v31 gets in the way

The homepage opens an outing picker with Campaign emphasized and tutorial presented as a secondary choice. A new Campaign player then selects a fishing spot, claims a permit and drills. The existing tutorial already teaches the full catch, so the title screen can put it one action away.

Campaign checks aim against the moving jig and can discard a touch that drifts more than five pixels. Its base hook window runs from 550 to 2100 milliseconds after the bite before equipment and skill bonuses. A starting player has to make the timing and aim checks together. Swipe movement already changes depth, but the line’s visible bend comes from a short-lived SVG curve adjustment.

The live v31 baseline passed the tutorial, Campaign catch and reload, gesture, Pause and Shop browser checks. The rules passed 66 unit tests. Those scripted passes verify the existing flow. They do not measure how easy it is for a first-time player. See the [source review and mechanics research](../../fishing-web-polish-research.md).

## Approaches

1. **Extend the current DOM and SVG game.** This is the shortest way to tune the gestures and test a simulated line. The web game would still use its existing renderer.
2. **Recommended. Put the local fishing playfield in Phaser.** Give Phaser the camera, line, lure and active fish in one thin water scene. Use a single state and input bridge to the existing game. Reuse the HTML interface and illustrated assets. This gives Phaser a real gameplay role and keeps the change focused on the part players touch.
3. **Move the full game to Phaser.** Campaign maps, menus, guides and Ranked would move with it. That adds integration and release work before players can try the improved controls.

## Game entry and Pause

- Give the website Play link and the installed web app one same-origin entry, proposed as `/play/`. Keep the title screen available during load so the player can see where they are. Use a standalone manifest and the existing visual identity.
- Use **Play** for a fresh profile and **Continue** for a saved Campaign. Offer Campaign, Practice and Tutorial replay under **Modes**. Keep Shop, Your Lake and Skills reachable using the game’s existing views. After the guided perch, offer the Starter Shore Campaign map. Continue opens the Campaign map with the saved day and holes. An in-progress bite or fight resumes through the in-session **Resume** button.
- Put **Outing**, **Gear**, and **Controls** tabs in Pause, styled like the tackle shop. Outing links to Shop, Your Lake and Skills and lets the player leave for the title screen. Gear shows the current loadout. Controls shows the gestures and keyboard alternatives. Keep **Resume** visible. Retain focus return and the current pause hold when a child dialog opens.
- Show the build version in a quiet footer on the title and Pause screens. Feed both from one release value and verify it against the numbered snapshot. Use the same static hosting and release process for the web game.
- Keep the existing browser IndexedDB profile on the same origin. Verify that the installed app can reopen its own save. WebKit documents that Home Screen installation gives the app its own website data. Importing an existing Safari save is a separate feature, proposed for later if players need it. [WebKit Home Screen storage](https://webkit.org/blog/14787/webkit-features-in-safari-17-2/#login-cookies)

## Fishing controls and motion

Use one gesture handler on the active water. Track the primary pointer, capture it, and resolve tap, swipe or cancellation once. Menu and tackle controls keep their own actions. A swipe that starts before a bite cannot turn into a hook. Keep visible controls and keyboard input available.

Give a down swipe a small useful minimum push and give a faster swipe a larger, capped impulse. Let drag slow the lure after release. Keep the camera with the moving lure. In a fight, down pays out line and up reels or lifts at the hole. A tap jigs while seeking and sets the hook during the bite. Use an obvious text and color cue, widen the local gold window, and try a short early-tap buffer if phone trials show early misses. Keep tackle and skill timing bonuses meaningful and test the Ranked boundary against its existing server rules.

Use a short chain of constrained points for the line. Pin it at the hole. Give the lure or fish-mouth end velocity and let line length and distance constraints pull back when the line comes taut. Slack can bow and settle on its own. Let fish thrust drive the endpoint outward during a run. When reeling takes up the slack, the shorter line pulls the mouth toward the hole. Rotate the fish around that same mouth point so its turn cannot detach the hook. Use the current fight rules for line strength, outcomes and the tension display. Test that visible slack and the rule cue tell the same story.

Step the motion at a fixed interval with a bounded catch-up after a slow frame. Phaser draws through one world-to-screen transform. Feed the motion system the rules' fish movement, line payout, slack and tension. The motion solver handles what players see. The outing clock and rules own pause, progress and catch outcomes.

Share the Phaser scene and controls across Tutorial, Campaign and Practice. Ranked keeps its existing input and server timing. Compile the new Phaser and TypeScript playfield with Vite. Keep DOM dialogs, buttons and accessible status cues outside the canvas. Add the entry, manifest, icons, compiled scene and its assets to the existing release script’s file list. Use relative paths and check the local numbered archive before publication.

## Checks before calling the web update ready

1. Build the first playable slice around Bryan’s guided perch. Check that one menu action reaches water and the same controls work in Tutorial and Campaign. Try ordinary taps away from the lure, slow strokes, quick flicks, cancellation and a bite that starts mid-swipe.
2. Verify a full hook, run, loosen, reel and lift. Check the mouth attachment, visible tension, pause and restart after resizing, rotating, changing holes and returning from a hidden tab. Compare the same input at different frame rates.
3. Exercise the title and Pause tabs on desktop and short portrait and landscape screens. Capture the title, fight and Pause screens in both phone orientations. Verify keyboard navigation, touch, safe areas, Shop and Your Lake focus return, saved Campaign reload and Ranked behavior. Check the current and numbered release URLs for the expected version, assets and direct entry.
4. Open the installed web app from a real phone’s Home Screen. Verify that the app reopens its save. Ask both kids to start and land the guided perch without coaching. Record entry taps, depth-control trouble and missed hook attempts. Have Joe try an actual run and reel to judge whether the fish and line feel connected.

The proposed route, menu labels, first-Play tutorial, and the scoped Phaser move are design choices for review. Tune the hook window and flick strength on a phone. v31 remains the live baseline.
