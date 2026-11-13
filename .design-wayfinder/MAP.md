# Bryan’s merch customizer

## Destination

Shoppers pick a product, put Bryan’s artwork where they want it, and see what their item will look like before adding it to the cart.

## Product truth

- **User:** A shopper choosing Bryan’s merch.
- **Job:** Make one item with the artwork and placements they want.
- **Primary action:** Choose artwork for the selected product.
- **Success:** The mockup and cart summary show the same print locations.

## Design thesis

Provisional. Keep product and placement controls close to the mockup, with the artwork visible while choosing.

## Architecture rails

Static HTML, CSS, and JavaScript. The standalone prototype uses the existing storefront artwork and mockups with an in-memory cart.

## Notes

### Available capabilities

- Application and components: local storefront files and existing artwork.
- Documentation: repository and shop glossary.
- Browser: Playwright and a local Mac preview.

## Decisions so far

- [Product, artwork, and placement rules](decisions/customization-rules.md)

## Frontier

- [Pick artwork by image or by name](tickets/open/artwork-picker.md)

## Fog

- Cart editing, sizing, colors, prices, and fulfillment.

## Out of scope

- Production changes, checkout, and fulfillment.
