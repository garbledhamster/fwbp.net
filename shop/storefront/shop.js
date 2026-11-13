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

const products = new Map(tackle.map(item => [item.id, item]));
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

function counter() {
  return `<div class="section counter-layout">
    <div class="counter-list">
      <section id="tackle"><h2>Tackle</h2>${counterList(tackle)}</section>
    </div>
    <section id="counter-detail" class="counter-detail" aria-label="Selected item" tabindex="-1">
      ${product(products.get(selected))}
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
  } else if (pickButton) {
    selected = pickButton.dataset.pick;
    shop.querySelector("[aria-pressed=true]").setAttribute("aria-pressed", "false");
    pickButton.setAttribute("aria-pressed", "true");
    const detail = document.querySelector("#counter-detail");
    detail.innerHTML = product(products.get(selected));
    if (matchMedia("(max-width: 630px)").matches) detail.focus();
  }
});

shop.innerHTML = counter();
updateCart();


const designPreview = document.querySelector("#design-preview");
const previewFigure = designPreview.querySelector("figure");
const blankProduct = previewFigure.querySelector(".blank-product");
const appliedDesign = previewFigure.querySelector(".applied-design");
const previewDescription = designPreview.querySelector("#preview-description");
const productChoices = [...designPreview.querySelectorAll("[data-product]")];
const garmentSides = designPreview.querySelector("#garment-sides");
const sideChoices = [...garmentSides.querySelectorAll("[data-side]")];
let designOpener;

function showGarmentSide(side) {
  const view = previewFigure.dataset.view;
  const front = side === "front";
  previewFigure.dataset.side = side;
  blankProduct.src = `assets/blanks/${view}${front ? "" : "-back"}.jpg`;
  appliedDesign.src = front ? "assets/fwbp-print.svg" : designOpener.dataset.design;
  appliedDesign.alt = front ? "Small FWBP badge on the upper right of the front" : `${designOpener.dataset.name} printed large on the back`;
  for (const button of sideChoices) {
    button.setAttribute("aria-pressed", String(button.dataset.side === side));
  }
}

function showProduct(choice) {
  const view = choice.dataset.product;
  previewFigure.dataset.view = view;
  const isGarment = view === "tee" || view === "sweatshirt";
  garmentSides.hidden = !isGarment;
  blankProduct.hidden = view === "sticker";
  if (isGarment) {
    showGarmentSide("back");
  } else {
    delete previewFigure.dataset.side;
    if (!blankProduct.hidden) blankProduct.src = `assets/blanks/${view}.jpg`;
    appliedDesign.src = designOpener.dataset.design;
    appliedDesign.alt = `${designOpener.dataset.name} on a ${choice.textContent.toLowerCase()}`;
  }
  for (const button of productChoices) {
    button.setAttribute("aria-pressed", String(button === choice));
  }

  if (designOpener.hasAttribute("data-classic") && view === "tee") {
    previewDescription.textContent = "White Classic Tee · S–3XL · $28 + $4.95 U.S. shipping. Ordering is closed.";
  } else if (designOpener.dataset.name.includes("Thumbs-Up") && view === "sticker") {
    previewDescription.textContent = "Thumbs-Up Vinyl Sticker · 3″, 4″ and 5.5″. Ordering is closed.";
  } else {
    previewDescription.textContent = "Placement preview. Ordering is closed.";
  }
}

for (const button of document.querySelectorAll("[data-design]")) {
  button.addEventListener("click", () => {
    designOpener = button;
    designPreview.querySelector("h2").textContent = button.dataset.name;
    showProduct(productChoices[0]);
    designPreview.showModal();
  });
}
for (const button of productChoices) {
  button.addEventListener("click", () => showProduct(button));
}
for (const button of sideChoices) {
  button.addEventListener("click", () => showGarmentSide(button.dataset.side));
}
designPreview.querySelector("#close-design").addEventListener("click", () => designPreview.close());
designPreview.addEventListener("close", () => designOpener?.focus());
