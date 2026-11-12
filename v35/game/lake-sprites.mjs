const loaded = new Set();

export function spriteHref(sheet, symbol) {
  return loaded.has(sheet) ? `#fwbp-${sheet}-${symbol}` : `./assets/${sheet}.svg#${symbol}`;
}

async function loadSprite(sheet) {
  const response = await fetch(new URL(`../assets/${sheet}.svg`, import.meta.url));
  if (!response.ok) return;

  const source = new DOMParser().parseFromString(await response.text(), 'image/svg+xml').documentElement;
  if (source.localName !== 'svg' || source.namespaceURI !== 'http://www.w3.org/2000/svg') return;
  const sprite = document.importNode(source, true);

  // Safari can resolve an external symbol's shapes while losing its gradients
  // and patterns. Keep the original art in this document and scope its IDs
  // so the sheets and the page's own anchors can coexist.
  const prefix = `fwbp-${sheet}-`;
  for (const node of sprite.querySelectorAll('*')) {
    for (const attribute of node.attributes) {
      const value = attribute.value;
      if (attribute.localName === 'id') attribute.value = prefix + value;
      else if (attribute.localName === 'href' && value.startsWith('#')) attribute.value = '#' + prefix + value.slice(1);
      else if (value.includes('url(#')) attribute.value = value.replaceAll('url(#', 'url(#' + prefix);
    }
  }
  sprite.setAttribute('width', '0');
  sprite.setAttribute('height', '0');
  sprite.setAttribute('aria-hidden', 'true');
  sprite.style.position = 'absolute';
  document.body.prepend(sprite);
  loaded.add(sheet);

  // Upgrade static markup and any instances built while the sheet loaded.
  const external = `./assets/${sheet}.svg#`;
  for (const use of document.querySelectorAll(`use[href^="${external}"]`)) {
    use.setAttribute('href', spriteHref(sheet, use.getAttribute('href').slice(external.length)));
  }
}

for (const sheet of ['lake-life', 'fish', 'scenes']) {
  // If a sheet request fails, leave its original external references in place.
  void loadSprite(sheet).catch(() => {});
}
