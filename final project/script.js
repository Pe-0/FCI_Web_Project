var cartKey = "spec-zone-cart";

function one(selector, parent) {
  return (parent || document).querySelector(selector);
}

function all(selector, parent) {
  return Array.from((parent || document).querySelectorAll(selector));
}

function getCart() {
  try {
    return JSON.parse(localStorage.getItem(cartKey)) || [];
  } catch (error) {
    return [];
  }
}

function saveCart(cart) {
  localStorage.setItem(cartKey, JSON.stringify(cart));
  updateCartCount();
}

function updateCartCount() {
  var total = getCart().reduce(function (sum, item) {
    return sum + (item.quantity || 1);
  }, 0);

  all(".cart-count").forEach(function (counter) {
    counter.textContent = total;
  });
}

function renderCart() {
  var cartBox = one("#cart-items");
  if (cartBox == null) {
    return;
  }

  var cart = getCart();
  var countBox = one("#summary-count");
  var totalBox = one("#summary-total");

  if (cart.length === 0) {
    cartBox.innerHTML = '<div class="empty-cart"><h2>Your Cart is Empty</h2><p>Start shopping and your products will appear here.</p><a class="button" href="laptops.html">Shop Products</a></div>';
    countBox.textContent = "0";
    totalBox.textContent = "EGP 0";
    return;
  }

  var total = 0;
  var count = 0;

  cartBox.innerHTML = cart.map(function (item) {
    item.quantity = item.quantity || 1;
    total += item.price * item.quantity;
    count += item.quantity;

    return '<div class="cart-item">' +
      '<img src="' + item.image + '" alt="' + item.name + '">' +
      '<div class="cart-details"><h3>' + item.name + '</h3><p>' + item.details + '</p><strong>EGP ' + item.price.toLocaleString() + '</strong></div>' +
      '<div class="cart-controls">' +
      '<button class="qty-btn" data-action="minus" data-name="' + item.name + '">-</button>' +
      '<span>' + item.quantity + '</span>' +
      '<button class="qty-btn" data-action="plus" data-name="' + item.name + '">+</button>' +
      '<button class="remove-btn" data-action="remove" data-name="' + item.name + '">Remove</button>' +
      '</div></div>';
  }).join("");

  countBox.textContent = count;
  totalBox.textContent = "EGP " + total.toLocaleString();
}

var loginForm = one("#login-form");
if (loginForm != null) {
  loginForm.addEventListener("submit", function (event) {
    event.preventDefault();
    location.href = "index.html";
  });
}

all(".add-to-cart").forEach(function (button) {
  button.addEventListener("click", function (event) {
    event.preventDefault();

    var product = button.closest(".product");
    var name = one("h3", product).textContent;
    var cart = getCart();
    var item = cart.find(function (cartItem) {
      return cartItem.name === name;
    });

    if (item != null) {
      item.quantity = (item.quantity || 0) + 1;
    } else {
      cart.push({
        name: name,
        details: one("p", product).textContent,
        price: Number(one("strong", product).textContent.replace(/[^0-9]/g, "")),
        image: one("img", product).src,
        quantity: 1
      });
    }

    saveCart(cart);
    button.textContent = "Added";

    setTimeout(function () {
      button.textContent = "Add to Cart";
    }, 800);
  });
});

document.addEventListener("click", function (event) {
  var button = event.target.closest("[data-action]");
  if (button == null) {
    return;
  }

  var action = button.dataset.action;
  var name = button.dataset.name;
  var cart = getCart();
  var item = cart.find(function (cartItem) {
    return cartItem.name === name;
  });

  if (item != null) {
    if (action === "plus") {
      item.quantity++;
    }

    if (action === "minus") {
      item.quantity--;
    }
  }

  if (action === "remove") {
    cart = cart.filter(function (cartItem) {
      return cartItem.name !== name;
    });
  } else {
    cart = cart.filter(function (cartItem) {
      return cartItem.quantity > 0;
    });
  }

  saveCart(cart);
  renderCart();
});

var clearCart = one("#clear-cart");
if (clearCart != null) {
  clearCart.addEventListener("click", function () {
    localStorage.removeItem(cartKey);
    updateCartCount();
    renderCart();
  });
}

var checkout = one("#checkout-btn");
if (checkout != null) {
  checkout.addEventListener("click", function () {
    alert(getCart().length === 0 ? "Your cart is empty." : "Order sent successfully. Spec Zone will contact you soon.");
  });
}

updateCartCount();
renderCart();
