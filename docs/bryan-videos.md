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

## Contextual cards

`renderSpeciesVideo(speciesId, container)` from `game/species-video.mjs` renders a thumbnail and **Watch now** for a verified match. The link opens the direct YouTube watch page in a new tab. The catch or collection stays open, with its existing pause in effect. Yellow perch and rock bass use the species sources already in the fish guide. Pass `{ reference: false }` when the parent card already links to that reference.

The site library shares the thumbnail layout with the game cards. It retains the site player, filters and featured hero playback. YouTube oEmbed reconfirmed all four contextual titles and Bryan’s channel on November 12, 2026.

## Verification

- `node --test game/bryan-videos.test.mjs` checks species associations, provenance and watch links.
- `node game/videos.browser.mjs` checks thumbnail cards, exact links, new tabs, reference fallback and modified library clicks at desktop, 320 px and short landscape sizes.
- `node library.browser.mjs` checks library filters, featured cards, Short warnings and keyboard playback.
