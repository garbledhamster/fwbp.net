# Campaign map discovery

The grid helps the player decide where to drill. Drilling reveals which familiar fish are at that hole today. Catching a new species adds it to Your Lake and makes it recognizable at later holes.

## What the player sees

1. Before drilling, select a spot to see its depth, habitat, and permit. A marker can show that the player caught something there before. The species and locations from those catches are in Your Lake.
2. Open a hole to see the names of fish already recognized through Your Lake that are present today. If none match, show “No familiar fish spotted here yet.” That leaves the player a reason to try the hole.
3. Land a fish in Campaign to record its species and spot. A first catch in Campaign or Practice makes that species recognizable. Study in Your Lake unlocks the species' lure hint.
4. Revisit a hole or reload during the same fishing day to find its remaining fish. A new fishing day starts a new roster. Saved catches and past catch markers carry forward.

Once the last fish is caught, the hole stays quiet for that day. The catch screen lets the player move to another spot. A fish that gets away can still be at the hole.

The starting allowance is two new holes per day. The Drilling skill raises it to three. Revisiting an open hole uses no drilling slot.

## How Bryan teaches the map

Use one layer at a time so a shade has one meaning. Give each layer visible shade swatches and numeric labels, and show the selected spot's value in text.

| Layer | Legend | What Bryan explains |
| --- | --- | --- |
| Depth | 10–15 ft, 16–25 ft, 26–35 ft | Where the bottom drops away and how to choose a spot near that change. Cell depths are rounded from [Minnesota DNR contours](https://www.dnr.state.mn.us/lakemapping/description.html). |
| Water temperature | 35°F, 36°F, 37°F, 38°F | Water near the ice can be colder than deeper water. The map shows a near-bottom game estimate derived from depth. [USGS lake sampling guidance](https://pubs.usgs.gov/tm/09/a10/tm9a10.pdf) |

Select Bryan's portrait to open help for the current layer or the selected spot. Give the player a reason and something to look for. For example, a shallow weed edge is worth trying for perch early in winter because perch often feed around healthy vegetation. Bryan's quest clues describe habitat, depth, and bait. They leave the player to pick the spot. [Minnesota DNR ice fishing for perch](https://www.dnr.state.mn.us/gofishing/ice-fishing-perch.html)

When a player opens a new hole in suitable habitat, the active quest species is among the fish for that day. Fish at holes the player already opened stay where they are as the quest changes.

Temperature helps explain winter habitat. The game continues to use habitat and time of day to shape encounters. A walleye tip can connect a drop-off to structure and dawn or dusk to low light. [Minnesota DNR ice fishing for walleye](https://www.dnr.state.mn.us/gofishing/ice-fishing-walleye.html)

## Checks for implementation

- Before a spot is drilled, the map, its accessible labels, and Bryan's clues leave its fish unknown.
- When opening a spot, the player sees only recognized species actually present there.
- A new Campaign catch updates Your Lake, its spot's history, and the current roster together. Retrying the same catch save records it once.
- Moving away and reloading preserve the current day's roster and its drilling allowance. The next fishing day resets the open holes and keeps the catch history.
- Existing Your Lake species still count. Catch locations are recorded starting with the new save format.
- Each shade has a text equivalent. Bryan's help opens by mouse, touch, or keyboard and returns focus to his portrait. [W3C guidance on use of color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color)
