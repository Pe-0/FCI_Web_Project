function one(selector, parent) {
  return (parent || document).querySelector(selector);
}

function all(selector, parent) {
  return Array.from((parent || document).querySelectorAll(selector));
}

var loginForm = one("#login-form");
if (loginForm != null) {
  loginForm.addEventListener("submit", function (event) {
    event.preventDefault();
    location.href = "index.html";
  });
}

function setupProductSearch() {
  var searchInput = one("[data-product-search]");
  if (searchInput == null) {
    return;
  }

  var products = all(".product");
  var noResults = one("[data-no-results]");

  function filterProducts() {
    var query = searchInput.value.trim().toLowerCase();
    var visibleCount = 0;

    products.forEach(function (product) {
      var productText = product.textContent.toLowerCase();
      var isVisible = productText.indexOf(query) !== -1;

      product.style.display = isVisible ? "" : "none";
      if (isVisible) {
        visibleCount++;
      }
    });

    if (noResults != null) {
      noResults.hidden = visibleCount > 0;
    }
  }

  searchInput.addEventListener("input", filterProducts);
  filterProducts();
}

setupProductSearch();
