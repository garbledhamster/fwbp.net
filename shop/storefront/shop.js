// Tackle Counter catalog and preview cart.
const icons = {
  right: '<path d="m9 18 6-6-6-6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  cart: '<path d="M3 4h2l2.4 10.4a2 2 0 0 0 2 1.6h8a2 2 0 0 0 2-1.6L21 7H6m4 13h.01M17 20h.01"/>',
};

function icon(name) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
}

const merch = [
  {id: "classic-tee", name: "FWBP Classic T-Shirt", detail: "Burgundy with the white Minnesota mark."},
  {id: "classic-hoodie", name: "FWBP Classic Hoodie", detail: "Bright green with the white Minnesota mark."},
  {id: "keep-on-jigging-tee", name: "Keep On Jigging T-Shirt", detail: "Olive with Bryan’s white FWBP design."},
  {id: "keep-on-jigging-hoodie", name: "Keep On Jigging Hoodie", detail: "Light blue with the black Keep On Jigging design."},
  {id: "tall-tumbler", name: "FWBP Tall Tumbler", detail: "Stainless steel with the black Minnesota mark."},
];

const tackle = [
  {
    id: "dardevle",
    name: "Dardevle Spoon",
    detail: "Eppinger’s red-and-white spoon, shown in Bryan’s underwater pike footage.",
    video: "https://www.youtube.com/watch?v=20uLF46BQKk",
  },
  {
    id: "five-diamonds",
    name: "Five of Diamonds Spoon",
    detail: "Eppinger’s yellow spoon with five red diamonds, shown in Bryan’s ice-fishing footage.",
    video: "https://www.youtube.com/watch?v=YWY1-B3dJdQ",
  },
];

const products = new Map([...tackle, ...merch].map(item => [item.id, item]));
for (const item of merch) {
  for (const variant of merchCatalog[item.id]) {
    products.set(variant.id, {
      ...item,
      ...variant,
      name: item.name + " · " + variant.color,
      detail: "From Bryan’s original merch shelf.",
    });
  }
}
const cart = new Map();
let selected = tackle[0].id;

function photo(item) {
  return `<img src="assets/${item.image || item.id + ".jpg"}" alt="${item.name}" width="512" height="512">`;
}

function add(item) {
  return `<button type="button" class="add" data-add="${item.id}" aria-label="Add ${item.name} to preview cart">${icon("plus")}<span>Add to preview cart</span></button>`;
}

function product(item) {
  return `<article class="product">
    <div class="product-photo">${photo(item)}</div>
    <div class="product-copy">
      <h2>${item.name}</h2><p>${item.detail}</p>
      ${item.video ? `<a class="video-link" href="${item.video}">Watch Bryan fish it</a>` : ""}
      ${add(item)}
    </div>
  </article>`;
}

function counterList(items) {
  return `<ul>${items.map(item => `<li>
    <button class="counter-row" data-pick="${item.id}" aria-pressed="${item.id === selected}" type="button">
      <img src="assets/${item.id}.jpg" alt="" width="56" height="56">
      <strong>${item.name}</strong>${icon("right")}
    </button>
  </li>`).join("")}</ul>`;
}

function counterProduct(item) {
  const colors = merchCatalog[item.id];
  if (!colors) return product(item);
  const colorOptions = colors.map(variant =>
    '<option value="' + variant.id + '">' + variant.color + '</option>'
  ).join("");
  return '<div class="counter-merch"><label for="merch-color">Color</label>' +
    '<select id="merch-color" data-color>' + colorOptions + '</select></div>' +
    '<div id="counter-color-product">' + product(products.get(colors[0].id)) + '</div>';
}

function colorGrid() {
  const groups = merch.map(item => {
    const choices = merchCatalog[item.id].map(variant =>
      '<li><button type="button" data-color-pick="' + variant.id + '" data-parent="' + item.id + '">' +
      '<img loading="lazy" src="assets/' + variant.image + '" alt="" width="96" height="96">' +
      '<span>' + variant.color + '</span></button></li>'
    ).join("");
    return '<section><h3>' + item.name + '</h3><ul class="swatch-grid">' + choices + '</ul></section>';
  }).join("");
  return '<details class="all-colors"><summary>See all merch colors</summary>' + groups + '</details>';
}

function counter() {
  return `<div class="section counter-layout">
    <div class="counter-list">
      <section id="tackle"><h2>Tackle</h2>${counterList(tackle)}</section>
      <section id="merch"><h2>Merch</h2>${counterList(merch)}${colorGrid()}</section>
    </div>
    <section id="counter-detail" class="counter-detail" aria-label="Selected item" tabindex="-1">
      ${counterProduct(products.get(selected))}
    </section>
  </div>`;
}

const shop = document.querySelector("#shop");
const cartDialog = document.querySelector("#cart");
const cartToggle = document.querySelector("#cart-toggle");
const cartItems = document.querySelector("#cart-items");
const reviewCart = document.querySelector("#review-cart");
const orderPreview = document.querySelector("#order-preview");
const cartStatus = document.querySelector("#cart-status");
let cartOpener;

function updateCart() {
  const count = [...cart.values()].reduce((sum, quantity) => sum + quantity, 0);
  document.querySelector("#cart-count").textContent = count;
  reviewCart.disabled = count === 0;
  orderPreview.textContent = "";
  cartItems.innerHTML = cart.size ? `<ul>${[...cart].map(([id, quantity]) => {
    const item = products.get(id);
    return `<li class="cart-line"><img src="assets/${item.image || id + ".jpg"}" alt="" width="56" height="56">
      <div><strong>${item.name}</strong><span>Quantity ${quantity}</span></div>
      <button class="remove" type="button" data-remove="${id}" aria-label="Remove one ${item.name}">${icon("close")}</button>
    </li>`;
  }).join("")}</ul>` : "<p>Your cart is empty.</p>";

}

function openCart(event) {
  cartOpener = event.currentTarget;
  cartDialog.showModal();
  document.querySelector("#close-cart").focus();
}

document.querySelector(".cart-icon").innerHTML = icon("cart");
document.querySelector("#close-cart").innerHTML = icon("close");
cartToggle.addEventListener("click", openCart);
document.querySelector("#close-cart").addEventListener("click", () => cartDialog.close());
cartDialog.addEventListener("close", () => cartOpener?.focus());
cartDialog.addEventListener("click", event => {
  const button = event.target.closest("[data-remove]");
  if (!button) return;
  const id = button.dataset.remove;
  const quantity = cart.get(id);
  if (quantity > 1) cart.set(id, quantity - 1);
  else cart.delete(id);
  updateCart();
  (cartItems.querySelector(`[data-remove="${id}"]`) ||
    cartItems.querySelector("[data-remove]") ||
    document.querySelector("#close-cart")).focus();
  cartStatus.textContent = `Removed one ${products.get(id).name}.`;
});
reviewCart.addEventListener("click", () => {
  orderPreview.textContent = "Ordering is closed. Your preview cart hasn’t placed an order.";
});

shop.addEventListener("click", event => {
  const addButton = event.target.closest("[data-add]");
  const pickButton = event.target.closest("[data-pick]");
  const colorButton = event.target.closest("[data-color-pick]");

  if (addButton) {
    const id = addButton.dataset.add;
    const quantity = (cart.get(id) || 0) + 1;
    cart.set(id, quantity);
    updateCart();
    cartStatus.textContent = `${products.get(id).name}. Quantity ${quantity} in cart.`;
    addButton.classList.add("added");
    addButton.innerHTML = `${icon("check")}<span>Added</span>`;
    setTimeout(() => {
      addButton.classList.remove("added");
      addButton.innerHTML = `${icon("plus")}<span>Add to preview cart</span>`;
    }, 1000);
  } else if (pickButton || colorButton) {
    selected = pickButton ? pickButton.dataset.pick : colorButton.dataset.parent;
    shop.querySelector("[aria-pressed=true]").setAttribute("aria-pressed", "false");
    shop.querySelector('[data-pick="' + selected + '"]').setAttribute("aria-pressed", "true");
    const detail = document.querySelector("#counter-detail");
    detail.innerHTML = counterProduct(products.get(selected));
    if (colorButton) {
      const selector = detail.querySelector("[data-color]");
      selector.value = colorButton.dataset.colorPick;
      selector.dispatchEvent(new Event("change", {bubbles: true}));
      detail.focus();
    } else if (matchMedia("(max-width: 630px)").matches) detail.focus();
  }
});

shop.addEventListener("change", event => {
  if (event.target.matches("[data-color]")) {
    document.querySelector("#counter-color-product").innerHTML = product(products.get(event.target.value));
  }
});

shop.innerHTML = counter();
updateCart();
