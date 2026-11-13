---
title: Pick artwork by image or by name
type: compare
status: closed
created: 2026-11-13
---

# Question

Is it easier to choose the artwork by seeing its image or by using the existing name menus?

## Why now

Shoppers need to recognize a design while they are deciding which spot to print it on, especially on a phone.

## MVC tracer

- **Route:** Standalone merch customizer with a picker comparison.
- **Controller:** Choose a print location and select a design.
- **Model:** Both pickers update the same in-memory choices and placements.
- **View:** Artwork thumbnails for the selected location or two name menus, next to the same product preview.
- **Return:** The mockup and item summary update after each selection.

## Prototype boundary

Reuse all 16 designs and the current product rules. Use the local preview and the existing in-memory cart.

## Evidence required

Try the same artwork and swap in both pickers at phone and desktop widths, including keyboard selection.

## Completion criterion

Joe tries both pickers and says which should be the default or how to combine them.

## Review evidence

Joe chose to combine the two pickers and asked for a small decal before the title. The [combined prototype](http://10.200.0.59:18763/) keeps both placement dropdowns visible and shows a thumbnail in the current choice and in each option. Verified selection, swapping, and keyboard operation at 375px and 1440px.

[Decision](../../decisions/artwork-picker.md)
