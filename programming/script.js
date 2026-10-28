(() => {
  const state = {
    allProducts: [],
    user: getStoredUser(),
    cart: { items: [], total: 0, count: 0 },
    activeCategory: "all",
    activeQuery: "",
    sort: "featured"
  };

  const categoryNames = {
    all: "All equipment",
    dental: "Dental",
    imaging: "Imaging",
    monitoring: "Patient monitoring",
    laboratory: "Laboratory",
    surgical: "Surgical",
    sterilization: "Sterilization"
  };

  const currencyFormatter = new Intl.NumberFormat("en-EG", {
    style: "currency",
    currency: "EGP",
    maximumFractionDigits: 0
  });

  function getStoredUser() {
    try {
      const storedUser = localStorage.getItem("mediline_user");
      return storedUser ? JSON.parse(storedUser) : null;
    } catch {
      return null;
    }
  }

  function getToken() {
    return localStorage.getItem("mediline_token") || "";
  }

  function saveAuth(token, user) {
    localStorage.setItem("mediline_token", token);
    localStorage.setItem("mediline_user", JSON.stringify(user));
    state.user = user;
  }

  function clearAuth() {
    localStorage.removeItem("mediline_token");
    localStorage.removeItem("mediline_user");
    state.user = null;
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;"
    })[character]);
  }

  function formatPrice(value) {
    return currencyFormatter.format(Number(value) || 0);
  }

  function formatDate(value) {
    const normalizedValue = String(value).includes("T") ? value : `${String(value).replace(" ", "T")}Z`;
    const date = new Date(normalizedValue);
    return Number.isNaN(date.getTime())
      ? "Recently"
      : new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" }).format(date);
  }

  function categoryName(category) {
    return categoryNames[category] || "Medical equipment";
  }

  function productUseCases(product) {
    return Array.isArray(product.useCases) && product.useCases.length
      ? product.useCases
      : [`${categoryName(product.category)} workflows`];
  }

  function productSupport(product) {
    return Array.isArray(product.support) && product.support.length
      ? product.support
      : ["Product guidance available"];
  }

  function availabilityCopy(product) {
    if (product.stock < 1) {
      return "Currently unavailable";
    }
    if (product.stock <= 4) {
      return `Only ${product.stock} left`;
    }
    return "Ready to request";
  }

  async function api(path, options = {}) {
    const headers = new Headers(options.headers || {});
    if (options.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    if (getToken()) {
      headers.set("Authorization", `Bearer ${getToken()}`);
    }

    let response;
    try {
      response = await fetch(path, { ...options, headers });
    } catch {
      const error = new Error("Could not reach the local server. Start the project with npm start.");
      error.status = 0;
      throw error;
    }

    const isJsonResponse = (response.headers.get("content-type") || "").includes("application/json");
    const payload = isJsonResponse ? await response.json().catch(() => ({})) : {};
    if (!response.ok) {
      const fallbackMessage = response.status === 404 && !isJsonResponse
        ? "The MediLine API is not running. Stop Live Server, run npm start, then open http://localhost:3000."
        : "Something went wrong. Please try again.";
      const error = new Error(payload.error || fallbackMessage);
      error.status = response.status;
      throw error;
    }
    return payload;
  }

  function getGuestCart() {
    try {
      const storedCart = JSON.parse(localStorage.getItem("mediline_guest_cart") || "[]");
      if (!Array.isArray(storedCart)) {
        return [];
      }
      return storedCart
        .map((item) => ({ id: Number(item.id), quantity: Number(item.quantity) }))
        .filter((item) => Number.isInteger(item.id) && item.id > 0 && Number.isInteger(item.quantity) && item.quantity > 0);
    } catch {
      return [];
    }
  }

  function saveGuestCart(items) {
    localStorage.setItem("mediline_guest_cart", JSON.stringify(items));
  }

  async function loadAllProducts() {
    if (state.allProducts.length) {
      return state.allProducts;
    }
    const response = await api("/api/products");
    state.allProducts = response.products;
    return state.allProducts;
  }

  async function getProduct(productId) {
    const products = await loadAllProducts();
    const existingProduct = products.find((product) => product.id === productId);
    if (existingProduct) {
      return existingProduct;
    }
    const response = await api(`/api/products/${productId}`);
    return response.product;
  }

  function medicalArt(visual) {
    const svg = (shapes) => `<svg viewBox="0 0 180 180" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="6" aria-hidden="true">${shapes}</svg>`;
    const art = {
      dental: svg("<path d=\"M38 132h88\"/><path d=\"M56 132V87c0-16 13-29 29-29h16c14 0 25 11 25 25v49\"/><path d=\"M49 73h49c11 0 20 9 20 20v10H49z\"/><path d=\"M53 102h64\"/><path d=\"M44 132v14M120 132v14\"/><circle cx=\"139\" cy=\"54\" r=\"14\"/><path d=\"M139 68v48\"/><path d=\"M139 116l-18 20\"/>"),
      scanner: svg("<path d=\"M53 59c11-15 33-19 48-8l16 12-30 42-28-21z\"/><path d=\"M87 105l16 12c8 6 10 17 4 25l-6 8\"/><path d=\"M108 59l15-20\"/><path d=\"M116 115l22-2\"/><path d=\"M43 75l-11 12\"/><path d=\"M69 73l16 12\"/>"),
      ultrasound: svg("<rect x=\"39\" y=\"38\" width=\"101\" height=\"73\" rx=\"8\"/><path d=\"M51 92c13-27 26 14 40-15 10-20 22 10 37-16\"/><path d=\"M82 112v28\"/><path d=\"M58 141h49\"/><path d=\"M133 119c20 4 20 29 5 37\"/><path d=\"M138 156l-8 9\"/><circle cx=\"61\" cy=\"55\" r=\"4\"/>"),
      monitor: svg("<rect x=\"37\" y=\"42\" width=\"106\" height=\"78\" rx=\"10\"/><path d=\"M50 85h16l9-18 13 37 11-21h30\"/><path d=\"M90 121v23\"/><path d=\"M65 145h51\"/><circle cx=\"128\" cy=\"57\" r=\"5\" fill=\"currentColor\" stroke=\"none\"/>"),
      ecg: svg("<rect x=\"37\" y=\"49\" width=\"106\" height=\"81\" rx=\"11\"/><path d=\"M51 95h16l8-17 11 32 11-21h31\"/><path d=\"M52 63h27\"/><path d=\"M52 116h71\"/><path d=\"M60 130v17M122 130v17\"/>"),
      sterilization: svg("<rect x=\"37\" y=\"45\" width=\"106\" height=\"94\" rx=\"12\"/><circle cx=\"90\" cy=\"94\" r=\"28\"/><circle cx=\"90\" cy=\"94\" r=\"11\"/><path d=\"M54 61h18\"/><path d=\"M112 61h14\"/><path d=\"M61 139v10M119 139v10\"/>"),
      pump: svg("<rect x=\"56\" y=\"38\" width=\"68\" height=\"80\" rx=\"10\"/><rect x=\"68\" y=\"53\" width=\"44\" height=\"20\" rx=\"3\"/><path d=\"M75 95h30\"/><path d=\"M90 118v38\"/><path d=\"M65 156h50\"/><path d=\"M124 84c20 0 22 24 8 33\"/><path d=\"M56 84c-20 0-22 24-8 33\"/>"),
      microscope: svg("<path d=\"M76 49l35 35-22 22-35-35z\"/><path d=\"M67 59l-12-12 18-18 12 12\"/><path d=\"M98 105c-18 13-23 28-20 42\"/><path d=\"M57 149h74\"/><path d=\"M66 130h45\"/><path d=\"M118 55l15-15\"/><circle cx=\"121\" cy=\"100\" r=\"10\"/>"),
      "surgical-light": svg("<path d=\"M90 139V81\"/><path d=\"M90 81c-40 0-57-27-57-48h114c0 21-17 48-57 48z\"/><circle cx=\"57\" cy=\"55\" r=\"8\"/><circle cx=\"90\" cy=\"55\" r=\"8\"/><circle cx=\"123\" cy=\"55\" r=\"8\"/><path d=\"M64 139h52\"/><path d=\"M57 151h66\"/>"),
      xray: svg("<path d=\"M50 135h78\"/><path d=\"M75 135V53h44v82\"/><path d=\"M64 53h66\"/><path d=\"M97 53V35\"/><circle cx=\"97\" cy=\"30\" r=\"8\"/><rect x=\"84\" y=\"71\" width=\"25\" height=\"31\" rx=\"3\"/><path d=\"M42 144h94\"/><circle cx=\"56\" cy=\"150\" r=\"6\"/><circle cx=\"121\" cy=\"150\" r=\"6\"/>"),
      centrifuge: svg("<path d=\"M54 68h72l10 69H44z\"/><ellipse cx=\"90\" cy=\"68\" rx=\"36\" ry=\"13\"/><circle cx=\"90\" cy=\"68\" r=\"14\"/><path d=\"M90 54v28M76 68h28\"/><path d=\"M61 137v11M119 137v11\"/>"),
      vitals: svg("<rect x=\"44\" y=\"43\" width=\"92\" height=\"77\" rx=\"10\"/><path d=\"M57 84h14l8-16 12 34 10-20h20\"/><path d=\"M90 121v26\"/><path d=\"M63 147h55\"/><circle cx=\"120\" cy=\"57\" r=\"4\" fill=\"currentColor\" stroke=\"none\"/>")
    };
    return art[visual] || art.monitor;
  }

  function productVisual(product, badge = "") {
    const categoryClass = escapeHtml(product.category);
    const visualClass = escapeHtml(product.visual);
    return `<div class="product-visual visual-${categoryClass} visual-${visualClass}">${badge}${medicalArt(product.visual)}</div>`;
  }

  function productCard(product) {
    const badge = product.featured ? '<span class="product-badge">Featured</span>' : "";
    const oldPrice = product.oldPrice ? `<span class="old-price">${formatPrice(product.oldPrice)}</span>` : '<span class="old-price"></span>';
    const productName = escapeHtml(product.name);
    const firstUseCase = escapeHtml(productUseCases(product)[0]);
    const stockClass = product.stock <= 4 ? "is-low-stock" : "";

    return `
      <article class="product-card">
        <button type="button" class="product-preview" data-product-id="${product.id}" aria-label="View details for ${productName}">
          ${productVisual(product, badge)}
        </button>
        <div class="product-content">
          <div class="product-meta"><span class="product-brand">${escapeHtml(product.brand)}</span><span class="rating">${product.rating} / 5</span></div>
          <button type="button" class="product-title product-title-button" data-product-id="${product.id}">${productName}</button>
          <p class="product-description">${escapeHtml(product.shortDescription)}</p>
          <p class="product-use"><span>Clinical use</span>${firstUseCase}</p>
          <div class="product-readiness"><span class="stock-chip ${stockClass}">${availabilityCopy(product)}</span><span>Support included</span></div>
          <div class="product-bottom">
            <div class="price-block"><strong class="price">${formatPrice(product.price)}</strong>${oldPrice}</div>
            <button type="button" class="card-add-button" data-add-product="${product.id}" aria-label="Add ${productName} to request">+</button>
          </div>
        </div>
      </article>`;
  }

  function emptyState(title, description, actionHref, actionText) {
    return `<div class="empty-state"><div><div class="empty-icon">ML</div><h2>${escapeHtml(title)}</h2><p>${escapeHtml(description)}</p>${actionHref ? `<a class="button button-primary" href="${actionHref}">${escapeHtml(actionText)}</a>` : ""}</div></div>`;
  }

  function renderShell() {
    const page = document.body.dataset.page || "";
    const headerTarget = document.querySelector("#site-header");
    const footerTarget = document.querySelector("#site-footer");
    const accountLabel = state.user ? `Hi, ${escapeHtml(state.user.name.split(" ")[0])}` : "Sign in";
    const accountHref = state.user ? "Setting.html" : "Login.html";

    if (headerTarget) {
      headerTarget.innerHTML = `
        <header class="site-header">
          <div class="header-inner">
            <a class="brand" href="Home.html" aria-label="MediLine home"><span class="brand-mark">+</span><span>Medi<span>Line</span></span></a>
            <button class="nav-toggle" type="button" data-nav-toggle aria-expanded="false" aria-controls="main-navigation"><span aria-hidden="true">Menu</span><span class="sr-only">Open menu</span></button>
            <nav id="main-navigation" class="main-nav" aria-label="Primary navigation">
              <a href="Home.html" class="${page === "home" ? "is-active" : ""}">Home</a>
              <a href="Categories.html" class="${page === "categories" ? "is-active" : ""}">Equipment</a>
              <a href="Setting.html" class="${page === "account" ? "is-active" : ""}">Dashboard</a>
            </nav>
            <form class="header-search" id="global-search" role="search">
              <label class="sr-only" for="global-search-input">Search equipment</label>
              <input id="global-search-input" name="q" type="search" value="${page === "categories" ? escapeHtml(state.activeQuery) : ""}" placeholder="Search equipment or brand" />
              <button class="search-submit" type="submit" aria-label="Search">Go</button>
            </form>
            <div class="header-actions">
              <a class="header-cart" href="Cart.html">Request <span id="cart-count" class="cart-count">${state.cart.count || 0}</span></a>
              <a class="header-account" href="${accountHref}">${accountLabel}</a>
            </div>
          </div>
        </header>`;
    }

    if (footerTarget) {
      footerTarget.innerHTML = `
        <footer class="site-footer">
          <div class="footer-inner">
            <div><a class="brand" href="Home.html"><span class="brand-mark">+</span><span>Medi<span>Line</span></span></a><p class="footer-intro">A focused clinical equipment marketplace for practices that need clear choices, practical guidance, and organized requests.</p></div>
            <div class="footer-column"><h3>Equipment</h3><a href="Categories.html">All equipment</a><a href="Categories.html?category=dental">Dental</a><a href="Categories.html?category=imaging">Imaging</a><a href="Categories.html?category=monitoring">Monitoring</a></div>
            <div class="footer-column"><h3>Support</h3><a href="Cart.html">Equipment request</a><a href="Setting.html">Procurement dashboard</a><a href="mailto:sales@mediline.local">Talk to a specialist</a><a href="Login.html">Sign in</a></div>
          </div>
          <p class="footer-bottom">Copyright ${new Date().getFullYear()} MediLine. Built for better clinical decisions.</p>
        </footer>`;
    }

    if (!document.querySelector("#product-modal-layer")) {
      document.body.insertAdjacentHTML("beforeend", `
        <div id="product-modal-layer" class="modal-layer" aria-hidden="true">
          <section class="product-modal" role="dialog" aria-modal="true" aria-labelledby="modal-product-title">
            <button type="button" class="modal-close" data-modal-close aria-label="Close details">Close</button>
            <div id="product-modal-content"></div>
          </section>
        </div>
        <div id="toast-container" class="toast-container" aria-live="polite"></div>`);
    }
  }

  function updateCartBadge() {
    const badge = document.querySelector("#cart-count");
    if (badge) {
      badge.textContent = state.cart.count || 0;
    }
  }

  async function hydrateUser() {
    if (!getToken()) {
      return;
    }
    try {
      const response = await api("/api/auth/me");
      state.user = response.user;
      localStorage.setItem("mediline_user", JSON.stringify(response.user));
    } catch (error) {
      if (error.status === 401) {
        clearAuth();
      }
    }
  }

  async function guestCartWithProductDetails() {
    const guestItems = getGuestCart();
    if (!guestItems.length) {
      return { items: [], total: 0, count: 0 };
    }
    const products = await loadAllProducts();
    const items = guestItems
      .map((item) => {
        const product = products.find((candidate) => candidate.id === item.id);
        return product ? { ...product, quantity: Math.min(item.quantity, product.stock) } : null;
      })
      .filter((item) => item && item.quantity > 0);
    return {
      items,
      total: items.reduce((sum, item) => sum + item.price * item.quantity, 0),
      count: items.reduce((sum, item) => sum + item.quantity, 0)
    };
  }

  async function refreshCartState() {
    state.cart = state.user ? await api("/api/cart") : await guestCartWithProductDetails();
    updateCartBadge();
    return state.cart;
  }

  async function syncGuestCart() {
    const guestItems = getGuestCart();
    if (!state.user || !guestItems.length) {
      return;
    }
    const remainingItems = [];
    let failedItems = 0;
    for (const item of guestItems) {
      try {
        await api("/api/cart", {
          method: "POST",
          body: JSON.stringify({ productId: item.id, quantity: item.quantity })
        });
      } catch {
        remainingItems.push(item);
        failedItems += 1;
      }
    }
    saveGuestCart(remainingItems);
    await refreshCartState();
    if (failedItems) {
      showToast("Some items could not be moved because stock changed.", "error");
    }
  }

  function showToast(message, type = "success") {
    const container = document.querySelector("#toast-container");
    if (!container) {
      return;
    }
    const toast = document.createElement("div");
    toast.className = `toast is-${type}`;
    toast.textContent = message;
    container.append(toast);
    window.setTimeout(() => toast.remove(), 3800);
  }

  async function addProductToCart(productId) {
    const product = await getProduct(productId);
    if (product.stock < 1) {
      throw new Error("This product is currently unavailable.");
    }

    if (state.user) {
      state.cart = await api("/api/cart", {
        method: "POST",
        body: JSON.stringify({ productId, quantity: 1 })
      });
    } else {
      const guestItems = getGuestCart();
      const existingItem = guestItems.find((item) => item.id === productId);
      const nextQuantity = (existingItem?.quantity || 0) + 1;
      if (nextQuantity > product.stock) {
        throw new Error(`Only ${product.stock} unit(s) are currently available.`);
      }
      if (existingItem) {
        existingItem.quantity = nextQuantity;
      } else {
        guestItems.push({ id: productId, quantity: 1 });
      }
      saveGuestCart(guestItems);
      state.cart = await guestCartWithProductDetails();
    }

    updateCartBadge();
    showToast(`${product.name} was added to your request.`);
  }

  async function changeCartItem(productId, action) {
    const cart = await refreshCartState();
    const item = cart.items.find((candidate) => candidate.id === productId);
    if (!item) {
      return;
    }

    let nextQuantity = item.quantity;
    if (action === "increase") {
      nextQuantity += 1;
    }
    if (action === "decrease") {
      nextQuantity -= 1;
    }
    if (action === "remove") {
      nextQuantity = 0;
    }
    if (nextQuantity > item.stock) {
      throw new Error(`Only ${item.stock} unit(s) are currently available.`);
    }

    if (state.user) {
      state.cart = await api(`/api/cart/${productId}`, {
        method: "PATCH",
        body: JSON.stringify({ quantity: nextQuantity })
      });
    } else {
      const nextItems = getGuestCart()
        .map((guestItem) => guestItem.id === productId ? { ...guestItem, quantity: nextQuantity } : guestItem)
        .filter((guestItem) => guestItem.quantity > 0);
      saveGuestCart(nextItems);
      state.cart = await guestCartWithProductDetails();
    }

    updateCartBadge();
    renderCart();
  }

  function renderList(items, className) {
    return items.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  }

  async function openProductModal(productId) {
    const product = await getProduct(productId);
    const modalLayer = document.querySelector("#product-modal-layer");
    const content = document.querySelector("#product-modal-content");
    if (!modalLayer || !content) {
      return;
    }

    const specifications = renderList(product.specifications, "spec-list");
    const useCases = renderList(productUseCases(product), "spec-list");
    const support = renderList(productSupport(product), "spec-list");
    const oldPrice = product.oldPrice ? `<span class="old-price">${formatPrice(product.oldPrice)}</span>` : "";
    const stockClass = product.stock <= 4 ? "is-low-stock" : "";

    content.innerHTML = `
      <div class="modal-visual">${productVisual(product)}</div>
      <div class="modal-content">
        <p class="modal-category">${escapeHtml(categoryName(product.category))} / ${escapeHtml(product.brand)}</p>
        <h2 id="modal-product-title">${escapeHtml(product.name)}</h2>
        <p class="modal-rating"><span class="rating">${product.rating} / 5</span> based on ${product.reviews} verified reviews</p>
        <p class="modal-description">${escapeHtml(product.description)}</p>
        <div class="modal-detail-grid">
          <section class="modal-detail-block"><p class="modal-label">Key specifications</p><ul class="spec-list">${specifications}</ul></section>
          <section class="modal-detail-block"><p class="modal-label">Best suited for</p><ul class="spec-list use-case-list">${useCases}</ul></section>
          <section class="modal-detail-block modal-detail-block-wide"><p class="modal-label">Included support</p><ul class="spec-list support-list">${support}</ul></section>
        </div>
        <p class="modal-fulfilment">${escapeHtml(product.fulfilment || "A specialist confirms delivery details after request submission.")}</p>
        <div class="modal-buy-row">
          <div><strong class="price">${formatPrice(product.price)}</strong>${oldPrice}<p class="stock-label ${stockClass}">${availabilityCopy(product)}</p></div>
          <button type="button" class="button button-primary" data-add-product="${product.id}">Add to request</button>
        </div>
      </div>`;
    modalLayer.classList.add("is-open");
    modalLayer.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
  }

  function closeProductModal() {
    const modalLayer = document.querySelector("#product-modal-layer");
    if (modalLayer) {
      modalLayer.classList.remove("is-open");
      modalLayer.setAttribute("aria-hidden", "true");
    }
    document.body.classList.remove("modal-open");
  }

  function renderHomeProducts(products) {
    const target = document.querySelector("#featured-product-grid");
    if (!target) {
      return;
    }
    const featuredProducts = products.filter((product) => product.featured).slice(0, 4);
    target.innerHTML = featuredProducts.map(productCard).join("") || emptyState("No featured equipment yet", "Check back soon for new clinic equipment.", "Categories.html", "Browse equipment");
  }

  function updateCatalogUrl() {
    const url = new URL(window.location.href);
    if (state.activeCategory === "all") {
      url.searchParams.delete("category");
    } else {
      url.searchParams.set("category", state.activeCategory);
    }
    if (state.activeQuery) {
      url.searchParams.set("q", state.activeQuery);
    } else {
      url.searchParams.delete("q");
    }
    window.history.replaceState({}, "", `${url.pathname}${url.search}`);
  }

  function renderCategoryFilters(categories) {
    const target = document.querySelector("#category-filters");
    if (!target) {
      return;
    }
    const allCategories = [{ category: "all", count: categories.reduce((sum, item) => sum + item.count, 0) }, ...categories];
    target.innerHTML = allCategories.map((item) => `
      <button type="button" class="filter-button ${state.activeCategory === item.category ? "is-selected" : ""}" data-category-filter="${escapeHtml(item.category)}">
        ${escapeHtml(categoryName(item.category))} <span>(${item.count})</span>
      </button>`).join("");
  }

  function sortProducts(products) {
    return [...products].sort((first, second) => {
      if (state.sort === "rating") {
        return second.rating - first.rating || second.reviews - first.reviews;
      }
      if (state.sort === "price-low") {
        return first.price - second.price;
      }
      if (state.sort === "price-high") {
        return second.price - first.price;
      }
      return Number(second.featured) - Number(first.featured) || second.rating - first.rating || second.reviews - first.reviews;
    });
  }

  async function renderCatalog() {
    const target = document.querySelector("#catalog-products");
    const countTarget = document.querySelector("#catalog-count");
    const queryTarget = document.querySelector("#catalog-query");
    if (!target || !countTarget || !queryTarget) {
      return;
    }

    target.innerHTML = emptyState("Loading equipment", "Getting current catalog details and availability.", "", "");
    const searchParams = new URLSearchParams();
    if (state.activeCategory !== "all") {
      searchParams.set("category", state.activeCategory);
    }
    if (state.activeQuery) {
      searchParams.set("q", state.activeQuery);
    }
    const queryString = searchParams.toString();
    const response = await api(`/api/products${queryString ? `?${queryString}` : ""}`);
    const products = sortProducts(response.products);
    countTarget.textContent = `${products.length} product${products.length === 1 ? "" : "s"} found`;
    queryTarget.textContent = state.activeQuery ? `Results for "${state.activeQuery}"` : categoryName(state.activeCategory);
    target.innerHTML = products.map(productCard).join("") || emptyState("No matching equipment", "Try a different search word or choose another specialty.", "Categories.html", "Clear filters");
  }

  function renderCart() {
    const target = document.querySelector("#cart-root");
    if (!target) {
      return;
    }
    const cart = state.cart;
    if (!cart.items.length) {
      target.classList.remove("cart-layout");
      target.innerHTML = emptyState("Your request is empty", "Add equipment to your request and it will be ready when you are.", "Categories.html", "Browse equipment");
      return;
    }
    target.classList.add("cart-layout");
    const cartItems = cart.items.map((item) => `
      <article class="cart-item">
        ${productVisual(item)}
        <div><h2 class="cart-item-title">${escapeHtml(item.name)}</h2><p class="cart-item-brand">${escapeHtml(item.brand)} / ${escapeHtml(categoryName(item.category))}</p><p class="cart-item-price">${formatPrice(item.price)}</p></div>
        <div class="cart-item-actions">
          <div class="quantity-control" aria-label="Quantity for ${escapeHtml(item.name)}">
            <button type="button" class="quantity-button" data-cart-action="decrease" data-product-id="${item.id}" aria-label="Decrease quantity">-</button>
            <span class="quantity-value">${item.quantity}</span>
            <button type="button" class="quantity-button" data-cart-action="increase" data-product-id="${item.id}" aria-label="Increase quantity">+</button>
          </div>
          <button type="button" class="remove-item" data-cart-action="remove" data-product-id="${item.id}">Remove</button>
        </div>
      </article>`).join("");
    const authNote = state.user ? "" : '<p class="summary-login-note">Sign in before submitting a request so your clinic details and selected equipment stay together.</p>';
    const checkoutControl = state.user
      ? '<button type="button" class="button button-primary button-full" data-checkout>Submit purchase request</button>'
      : '<a class="button button-primary button-full" href="Login.html">Sign in to continue</a>';
    target.innerHTML = `
      <div class="cart-list"><div class="cart-list-header"><h2>Selected equipment</h2><span>${cart.count} item${cart.count === 1 ? "" : "s"}</span></div>${cartItems}</div>
      <aside class="order-summary"><h2>Request summary</h2>${authNote}<div class="summary-row"><span>Equipment subtotal</span><strong>${formatPrice(cart.total)}</strong></div><div class="summary-row"><span>Delivery and setup</span><span>Confirmed by specialist</span></div><div class="summary-row summary-total"><span>Estimated equipment total</span><strong>${formatPrice(cart.total)}</strong></div>${checkoutControl}<p class="summary-note">Submitting a request does not process a payment. A specialist confirms availability, delivery access, installation, and the final quotation with you.</p></aside>`;
  }

  async function renderAccount() {
    const target = document.querySelector("#account-root");
    if (!target) {
      return;
    }
    if (!state.user) {
      target.innerHTML = emptyState("Sign in to view your dashboard", "Your profile and submitted equipment requests will appear here.", "Login.html", "Sign in");
      return;
    }
    target.innerHTML = '<div class="account-card"><div class="account-avatar">ML</div><div><h2>Loading your dashboard</h2><p>Getting your submitted requests.</p></div></div>';
    const response = await api("/api/orders");
    const initials = state.user.name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "ML";
    const orders = response.orders.length ? response.orders.map((order) => `
      <article class="order-item"><div><strong>${escapeHtml(order.orderNumber)}</strong><p>${formatDate(order.createdAt)} / ${order.items.reduce((sum, item) => sum + item.quantity, 0)} item(s)</p><p>${order.items.map((item) => `${escapeHtml(item.productName)} x ${item.quantity}`).join(" / ")}</p></div><div class="order-total">${formatPrice(order.total)}<span class="order-status">Request received</span></div></article>`).join("") : '<p class="summary-note">You have not submitted an equipment request yet.</p>';
    target.innerHTML = `
      <section class="account-card"><div class="account-avatar">${escapeHtml(initials)}</div><div><h2>${escapeHtml(state.user.name)}</h2><p>${escapeHtml(state.user.email)}</p></div><button type="button" class="logout-button" data-logout>Sign out</button></section>
      <section class="orders-card"><h2>Submitted equipment requests</h2>${orders}</section>`;
  }

  function setAuthMode(mode) {
    const isRegisterMode = mode === "register";
    const loginForm = document.querySelector("#login-form");
    const registerForm = document.querySelector("#register-form");
    const eyebrow = document.querySelector("#auth-eyebrow");
    const title = document.querySelector("#auth-title");
    const description = document.querySelector("#auth-description");
    const switchCopy = document.querySelector("#auth-switch-copy");
    const message = document.querySelector("#auth-message");
    if (!loginForm || !registerForm || !eyebrow || !title || !description || !switchCopy || !message) {
      return;
    }
    loginForm.classList.toggle("is-hidden", isRegisterMode);
    registerForm.classList.toggle("is-hidden", !isRegisterMode);
    eyebrow.textContent = isRegisterMode ? "Create your account" : "Welcome back";
    title.textContent = isRegisterMode ? "Start your clinic account" : "Sign in to your account";
    description.textContent = isRegisterMode ? "Save your shortlist and submit a purchase request when you are ready." : "Enter your details to continue to MediLine.";
    switchCopy.innerHTML = isRegisterMode
      ? 'Already have an account? <button type="button" data-auth-switch="login">Sign in</button>'
      : 'New to MediLine? <button type="button" data-auth-switch="register">Create an account</button>';
    message.textContent = "";
    message.classList.remove("is-success");
  }

  async function submitAuthForm(form) {
    const mode = form.id === "register-form" ? "register" : "login";
    const message = document.querySelector("#auth-message");
    const submitButton = form.querySelector("button[type='submit']");
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());
    submitButton.disabled = true;
    if (message) {
      message.textContent = "";
      message.classList.remove("is-success");
    }
    try {
      const response = await api(`/api/auth/${mode}`, { method: "POST", body: JSON.stringify(payload) });
      saveAuth(response.token, response.user);
      renderShell();
      await syncGuestCart();
      if (message) {
        message.textContent = mode === "register" ? "Account created. Opening your dashboard..." : "Signed in. Opening your dashboard...";
        message.classList.add("is-success");
      }
      window.setTimeout(() => window.location.assign("Setting.html"), 500);
    } catch (error) {
      if (message) {
        message.textContent = error.message;
      }
    } finally {
      submitButton.disabled = false;
    }
  }

  async function checkout() {
    const checkoutButton = document.querySelector("[data-checkout]");
    if (checkoutButton) {
      checkoutButton.disabled = true;
      checkoutButton.textContent = "Submitting request...";
    }
    try {
      const response = await api("/api/orders/checkout", { method: "POST", body: "{}" });
      state.cart = { items: [], total: 0, count: 0 };
      updateCartBadge();
      renderCart();
      showToast(`Request ${response.order.orderNumber} was submitted successfully.`, "success");
    } catch (error) {
      showToast(error.message, "error");
      if (checkoutButton) {
        checkoutButton.disabled = false;
        checkoutButton.textContent = "Submit purchase request";
      }
    }
  }

  async function initHome() {
    const products = await loadAllProducts();
    renderHomeProducts(products);
  }

  async function initCatalog() {
    const searchParams = new URLSearchParams(window.location.search);
    state.activeCategory = searchParams.get("category") || "all";
    state.activeQuery = searchParams.get("q") || "";
    const sort = document.querySelector("#product-sort");
    if (sort) {
      sort.value = state.sort;
    }
    renderShell();
    const categories = await api("/api/categories");
    renderCategoryFilters(categories.categories);
    await renderCatalog();
  }

  async function initCart() {
    await refreshCartState();
    renderCart();
  }

  async function initAccount() {
    await renderAccount();
  }

  function initLogin() {
    if (state.user) {
      window.location.replace("Setting.html");
      return;
    }
    setAuthMode("login");
  }

  function addGlobalListeners() {
    document.addEventListener("submit", async (event) => {
      if (event.target.matches("#global-search")) {
        event.preventDefault();
        const input = event.target.querySelector("input[name='q']");
        const query = input.value.trim();
        window.location.assign(`Categories.html${query ? `?q=${encodeURIComponent(query)}` : ""}`);
        return;
      }
      if (event.target.matches("#login-form, #register-form")) {
        event.preventDefault();
        await submitAuthForm(event.target);
      }
    });

    document.addEventListener("change", async (event) => {
      if (event.target.matches("#product-sort")) {
        state.sort = event.target.value;
        try {
          await renderCatalog();
        } catch (error) {
          showToast(error.message, "error");
        }
      }
    });

    document.addEventListener("click", async (event) => {
      const navToggle = event.target.closest("[data-nav-toggle]");
      if (navToggle) {
        const navigation = document.querySelector("#main-navigation");
        const isOpen = navigation?.classList.toggle("is-open");
        navToggle.setAttribute("aria-expanded", String(Boolean(isOpen)));
        return;
      }

      if (event.target.closest("[data-modal-close]") || event.target.id === "product-modal-layer") {
        closeProductModal();
        return;
      }

      const authSwitch = event.target.closest("[data-auth-switch]");
      if (authSwitch) {
        setAuthMode(authSwitch.dataset.authSwitch);
        return;
      }

      const categoryFilter = event.target.closest("[data-category-filter]");
      if (categoryFilter) {
        state.activeCategory = categoryFilter.dataset.categoryFilter;
        updateCatalogUrl();
        try {
          const categories = await api("/api/categories");
          renderCategoryFilters(categories.categories);
          await renderCatalog();
        } catch (error) {
          showToast(error.message, "error");
        }
        return;
      }

      const addButton = event.target.closest("[data-add-product]");
      if (addButton) {
        try {
          addButton.disabled = true;
          await addProductToCart(Number(addButton.dataset.addProduct));
        } catch (error) {
          showToast(error.message, "error");
        } finally {
          addButton.disabled = false;
        }
        return;
      }

      const cartAction = event.target.closest("[data-cart-action]");
      if (cartAction) {
        try {
          await changeCartItem(Number(cartAction.dataset.productId), cartAction.dataset.cartAction);
        } catch (error) {
          showToast(error.message, "error");
        }
        return;
      }

      const productDetailButton = event.target.closest("[data-product-id]");
      if (productDetailButton) {
        try {
          await openProductModal(Number(productDetailButton.dataset.productId));
        } catch (error) {
          showToast(error.message, "error");
        }
        return;
      }

      if (event.target.closest("[data-checkout]")) {
        await checkout();
        return;
      }

      if (event.target.closest("[data-logout]")) {
        try {
          await api("/api/auth/logout", { method: "POST", body: "{}" });
        } catch {}
        clearAuth();
        state.cart = await guestCartWithProductDetails();
        window.location.assign("Home.html");
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeProductModal();
      }
    });
  }

  async function boot() {
    renderShell();
    addGlobalListeners();
    await hydrateUser();
    renderShell();

    try {
      await refreshCartState();
    } catch (error) {
      showToast(error.message, "error");
    }

    const page = document.body.dataset.page;
    try {
      if (page === "home") {
        await initHome();
      }
      if (page === "categories") {
        await initCatalog();
      }
      if (page === "cart") {
        await initCart();
      }
      if (page === "account") {
        await initAccount();
      }
      if (page === "login") {
        initLogin();
      }
    } catch (error) {
      showToast(error.message, "error");
      const target = document.querySelector("#featured-product-grid, #catalog-products, #cart-root, #account-root");
      if (target) {
        target.innerHTML = emptyState("Unable to load this page", error.message, "Home.html", "Return home");
      }
    }
  }

  boot();
})();
