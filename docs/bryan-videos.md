# Contextual Bryan videos

The game offers one optional Bryan video for a species when his official upload identifies that exact species. The ordinary video library keeps its existing entries and filters.

## Source audit, November 8, 2026

The four public watch links below returned HTTP 200. YouTube’s official oEmbed responses confirmed the upload titles and author, Fishing With Bryan Prokuski, at [@BryanProkuski](https://www.youtube.com/@BryanProkuski). The watch-page player responses independently confirmed channel ID `UCThHy8VljJg3tGmuWxSYdbg`, `playabilityStatus.status: OK`, `playableInEmbed: true`, and available stream formats for each upload.

All four public watch pages also played in Chrome. Each reported player state `1` (playing), a non-paused video with advancing playback beyond two seconds, ready state `4`, and no displayed player error. Screenshots confirmed Bryan’s footage and the official title and channel. These checks establish usable public watch fallbacks at the time of the audit. A particular viewer’s embed can still fail because of network, region or YouTube restrictions; its public link remains visible.

| Species ID | Official upload | Evidence and label scope |
| --- | --- | --- |
| `walleye` | [Ice Fishing For WALLEYE with UNDERWATER CAMERA \| Mille Lacs Lake \| EARLY ICE 2019](https://www.youtube.com/watch?v=Elu9m3JcOEM) | The official title names walleye. Offer walleye fishing footage. |
| `pike` | [SUPER CLEAR Underwater Ice Fishing! BASS & NORTHERN PIKE!](https://www.youtube.com/watch?v=gIUtx-C9pKs) | The title names northern pike; Bryan describes pike passing the camera. Label an appearance. Its bass reference does not identify smallmouth or rock bass. |
| `smallmouth` | [Spring Smallmouth Bass Fishing in Minnesota](https://www.youtube.com/watch?v=KL0F_23RvBo) | The title identifies smallmouth bass and spring fishing. The description places the trip between rainstorms in Minnesota. |
| `muskie` | [MUSKIE! Ice Fishing Perch on Mille Lacs Lake](https://www.youtube.com/watch?v=W41Btej9DnI) | The title identifies muskie; Bryan describes a muskie visiting during the perch trip. Label an appearance, with no muskie-catch claim. |

No timestamp has been reviewed. Embeds and public links start at the beginning.

Yellow perch (`perch`) remains unmapped. The muskie upload identifies only “perch.” The existing library’s [Ice Castle perch upload](https://www.youtube.com/watch?v=sXRoaFLDS10) also returned usable official watch metadata, but its title and description do not name Yellow perch. The library’s existing editorial description alone does not establish an exact-species association. Rock bass (`rock-bass`) also has no verified exact-species match. Both retain the species reference without a contextual Watch Bryan action.

## Integration interface

Import `getBryanVideo` and `openBryanVideo` from `game/bryan-videos.mjs`. `getBryanVideo(speciesId)` returns immutable video metadata or `null`. Metadata includes `label`, `url`, `id`, `title`, `description`, `relationship`, channel identity, verification date and a short evidence note.

Render a public anchor when metadata exists so modified clicks keep normal navigation. On ordinary activation, acquire the caller’s local suspension, then call:

```js
const opened = openBryanVideo(speciesId, {
  trigger: watchLink,
  onClose: releaseVideoSuspension,
});
if (opened) event.preventDefault();
else releaseVideoSuspension();
```

`openBryanVideo` returns `true` only when the modal opens. An unsupported species or an already-open player returns `false` without a close callback. Callers release a hold they acquired if opening fails. A live-catch caller holds the outing suspension while watching. A collection caller preserves its parent collection suspension when the player closes. Offer game playback only after a local catch has settled; live Ranked timing stays authoritative.

The shared `game/video-player.mjs` module owns the existing `#player` dialog. Native modal stacking keeps a species card open underneath it. The player removes its iframe on close, calls `onClose` once, then focuses the connected trigger without scrolling. Escape belongs to the top modal. Integration also guards game shortcuts while a dialog owns input. The player does not award progress, mutate a profile, or own any game clocks.

A viewer can close the player or use its public YouTube link even if an embed fails. Cross-origin iframe load events do not reliably report playback success, so the fallback stays visible without guessing whether the video played.

## Regression checks for the fresh test wave

Builders wrote these cases without running automated verification, following Joe’s Code for Me phase order:

- `node --test game/bryan-videos.test.mjs` covers supported and unsupported associations, provenance and the absence of guessed timestamps.
- `node game/videos.browser.mjs` covers all four exact embeds, stacked card return, keyboard and touch close, iframe cleanup, public fallback during blocked embeds, and modified library clicks at desktop, 320 px and short landscape sizes.
- `node library.browser.mjs` retains the existing library filter, presenter, Short warning and keyboard player checks.
- The integrated game checks must cover live catch suspension, day/night and expiry boundaries, unchanged wallet/collection state, and the same catch and card after return.

Run the full relevant rule and browser suites only after the five slices and art are integrated. Public playback remains a separate source check from controlled browser regression fixtures.
