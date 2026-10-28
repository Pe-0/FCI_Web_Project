const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const http = require("node:http");
const { DatabaseSync } = require("node:sqlite");

const port = Number(process.env.PORT || 3000);
const rootDirectory = __dirname;
const databaseDirectory = path.join(rootDirectory, "data");
const databasePath = process.env.DB_PATH || path.join(databaseDirectory, "mediline.db");
const sessionDurationMs = 1000 * 60 * 60 * 24 * 7;

fs.mkdirSync(path.dirname(databasePath), { recursive: true });

const database = new DatabaseSync(databasePath);
database.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;");
database.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    price INTEGER NOT NULL,
    old_price INTEGER,
    rating REAL NOT NULL,
    reviews INTEGER NOT NULL,
    stock INTEGER NOT NULL,
    brand TEXT NOT NULL,
    short_description TEXT NOT NULL,
    description TEXT NOT NULL,
    specifications TEXT NOT NULL,
    visual TEXT NOT NULL,
    featured INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS cart_items (
    user_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    PRIMARY KEY (user_id, product_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    order_number TEXT NOT NULL UNIQUE,
    total INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    product_name TEXT NOT NULL,
    unit_price INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
  );
`);

const catalogProducts = [
  {
    name: "ProCare X1 Dental Treatment Center",
    category: "dental",
    price: 185000,
    oldPrice: 199000,
    rating: 4.9,
    reviews: 126,
    stock: 4,
    brand: "MediForm",
    shortDescription: "A complete treatment center designed for modern dental practices.",
    description: "A patient-focused dental treatment center with programmable positioning, an integrated delivery unit, quiet electric movement, and LED task lighting for efficient everyday care.",
    specifications: ["Quiet electric chair movement", "Three programmable treatment positions", "Integrated water and suction unit", "Multi-angle LED task light"],
    visual: "dental",
    featured: 1
  },
  {
    name: "ScanVue i3 Intraoral Scanner",
    category: "dental",
    price: 98000,
    oldPrice: 106000,
    rating: 4.8,
    reviews: 78,
    stock: 7,
    brand: "ScanVue",
    shortDescription: "Fast 3D digital impressions for a more streamlined dental workflow.",
    description: "A lightweight intraoral scanner for diagnostic capture and digital treatment planning, with live 3D visualization, open-file export, and a compact USB-C workflow.",
    specifications: ["20 micron scan accuracy", "245 g handheld weight", "USB-C connection", "Open STL file export"],
    visual: "scanner",
    featured: 0
  },
  {
    name: "SonoView P8 Ultrasound System",
    category: "imaging",
    price: 132000,
    oldPrice: 145000,
    rating: 4.9,
    reviews: 94,
    stock: 5,
    brand: "SonoView",
    shortDescription: "Portable ultrasound with versatile probes for point-of-care imaging.",
    description: "A compact ultrasound platform for outpatient clinics, emergency assessment, and bedside imaging. Its high-contrast display and configurable probes support fast, focused examinations.",
    specifications: ["15.6 inch high-contrast display", "Two interchangeable probe ports", "Up to 3 hours battery runtime", "DICOM image export"],
    visual: "ultrasound",
    featured: 1
  },
  {
    name: "VitalCheck 6 Patient Monitor",
    category: "monitoring",
    price: 46200,
    oldPrice: null,
    rating: 4.7,
    reviews: 61,
    stock: 12,
    brand: "VitalCheck",
    shortDescription: "Continuous monitoring for essential patient vital signs.",
    description: "A clear, configurable patient monitor for treatment rooms and observation areas. It brings ECG, oxygen saturation, non-invasive blood pressure, pulse, and alarms together in one clinical view.",
    specifications: ["ECG, SpO2, and NIBP monitoring", "12 inch touch display", "Configurable clinical alarms", "Internal backup battery"],
    visual: "monitor",
    featured: 1
  },
  {
    name: "CardioTrace 12 ECG System",
    category: "monitoring",
    price: 31500,
    oldPrice: 34500,
    rating: 4.8,
    reviews: 52,
    stock: 9,
    brand: "CardioTrace",
    shortDescription: "Twelve-lead ECG acquisition with fast printing and digital export.",
    description: "A professional resting ECG system with simultaneous 12-lead capture, automatic interpretation support, thermal printing, and PDF export for efficient cardiology workflows.",
    specifications: ["12 simultaneous ECG leads", "Integrated thermal printer", "500 examination memory", "USB PDF report export"],
    visual: "ecg",
    featured: 0
  },
  {
    name: "SterilSafe 23L Class B Autoclave",
    category: "sterilization",
    price: 38800,
    oldPrice: 42500,
    rating: 4.9,
    reviews: 110,
    stock: 8,
    brand: "SterilSafe",
    shortDescription: "Reliable steam sterilization for instruments and daily clinic turnover.",
    description: "A Class B bench-top autoclave for dental and minor procedure settings, with pre-programmed cycles, drying support, and cycle documentation for a disciplined sterilization workflow.",
    specifications: ["23 litre chamber", "Class B sterilization cycles", "Automatic drying support", "Cycle report printing"],
    visual: "sterilization",
    featured: 1
  },
  {
    name: "FlowGuard 400 Infusion Pump",
    category: "surgical",
    price: 27500,
    oldPrice: null,
    rating: 4.7,
    reviews: 44,
    stock: 15,
    brand: "FlowGuard",
    shortDescription: "Programmable infusion control with clear safety alarms.",
    description: "A dependable infusion pump for day care, recovery, and procedure rooms. Programmable rates and multi-level alerts help teams manage fluid and medication delivery with confidence.",
    specifications: ["Plus or minus 5 percent accuracy", "Air and occlusion alarms", "0.1 to 1200 ml per hour", "Backlit clinical display"],
    visual: "pump",
    featured: 0
  },
  {
    name: "LabScope C7 Clinical Microscope",
    category: "laboratory",
    price: 59000,
    oldPrice: 64000,
    rating: 4.8,
    reviews: 37,
    stock: 6,
    brand: "LabScope",
    shortDescription: "Sharp optical performance for routine laboratory examination.",
    description: "A binocular clinical microscope built for teaching laboratories and routine sample review, combining LED illumination, precise focusing, and multiple objective lenses.",
    specifications: ["Up to 1000x magnification", "LED illumination", "4x to 100x objectives", "Rotating binocular head"],
    visual: "microscope",
    featured: 0
  },
  {
    name: "SurgiLux 5 Surgical Light",
    category: "surgical",
    price: 86000,
    oldPrice: 92000,
    rating: 4.9,
    reviews: 68,
    stock: 3,
    brand: "SurgiLux",
    shortDescription: "Shadow-controlled surgical illumination for a clear working field.",
    description: "A ceiling-mounted surgical light that delivers cool, even illumination for procedure rooms. Adjustable intensity and color temperature help clinicians maintain visual comfort during long cases.",
    specifications: ["Up to 160,000 Lux output", "Adjustable color temperature", "Flexible positioning arm", "Low-glare illumination mode"],
    visual: "surgical-light",
    featured: 1
  },
  {
    name: "RayGo 100 Mobile X-Ray System",
    category: "imaging",
    price: 114000,
    oldPrice: null,
    rating: 4.6,
    reviews: 29,
    stock: 4,
    brand: "RayGo",
    shortDescription: "Mobile digital radiography for responsive bedside imaging.",
    description: "A maneuverable X-ray system for emergency, ward, and point-of-care imaging. The compact mobile design supports fast positioning and immediate digital image review.",
    specifications: ["Wireless digital detector", "Integrated touch display", "Battery-powered mobility", "Internal image storage"],
    visual: "xray",
    featured: 0
  },
  {
    name: "CentriPro 6000 Clinical Centrifuge",
    category: "laboratory",
    price: 20800,
    oldPrice: 23500,
    rating: 4.7,
    reviews: 34,
    stock: 10,
    brand: "CentriPro",
    shortDescription: "Consistent sample separation for routine laboratory workflows.",
    description: "A compact clinical centrifuge with a digital timer, balanced rotor design, and lid lock. It is suited to routine blood and urine sample preparation in small and mid-sized labs.",
    specifications: ["Up to 6000 RPM", "12 tube rotor", "99 minute timer", "Safety lid lock"],
    visual: "centrifuge",
    featured: 0
  },
  {
    name: "VitaStation Vital Signs Station",
    category: "monitoring",
    price: 18500,
    oldPrice: null,
    rating: 4.6,
    reviews: 46,
    stock: 11,
    brand: "VitaStation",
    shortDescription: "A fast intake station for core vital signs assessment.",
    description: "An efficient vital signs station for clinic reception and triage areas. It brings blood pressure, temperature, and oxygen saturation checks into a consistent pre-consultation process.",
    specifications: ["Blood pressure, temperature, and SpO2", "Clear clinician interface", "Optional report printer", "CSV record export"],
    visual: "vitals",
    featured: 0
  }
];

const productGuidance = {
  dental: {
    useCases: ["General dentistry clinics", "Restorative and preventive care", "Multi-room treatment setups"],
    support: ["Site-readiness checklist", "Two-year warranty cover", "Operator handover available"],
    fulfilment: "Installation scheduling is coordinated after order confirmation."
  },
  scanner: {
    useCases: ["Digital impressions", "Restorative dentistry", "Orthodontic treatment planning"],
    support: ["Remote setup guidance", "Workflow orientation", "One-year warranty cover"],
    fulfilment: "Ready for dispatch after device and accessory confirmation."
  },
  ultrasound: {
    useCases: ["Point-of-care assessment", "Outpatient diagnostics", "Bedside imaging"],
    support: ["Probe selection guidance", "Workflow orientation", "Two-year warranty cover"],
    fulfilment: "Delivery planning includes probe configuration confirmation."
  },
  monitor: {
    useCases: ["Treatment rooms", "Observation areas", "Post-procedure monitoring"],
    support: ["Alarm configuration guidance", "Quick-start orientation", "Two-year warranty cover"],
    fulfilment: "Usually ready for clinic delivery within the stated lead time."
  },
  ecg: {
    useCases: ["Primary care screening", "Cardiology clinics", "Pre-operative assessment"],
    support: ["Lead placement guide", "Report workflow orientation", "Two-year warranty cover"],
    fulfilment: "Delivered with core ECG accessories and setup guidance."
  },
  sterilization: {
    useCases: ["Dental instrument processing", "Minor procedure rooms", "Daily sterilization cycles"],
    support: ["Cycle selection orientation", "Care guide included", "Two-year warranty cover"],
    fulfilment: "Delivery is coordinated with a bench-top site-readiness check."
  },
  pump: {
    useCases: ["Day care treatment", "Recovery rooms", "Medication and fluid delivery"],
    support: ["Safety alarm orientation", "Quick-start guide", "One-year warranty cover"],
    fulfilment: "Ready for dispatch with standard infusion accessories."
  },
  microscope: {
    useCases: ["Routine sample review", "Teaching laboratories", "Basic microscopy workflows"],
    support: ["Objective lens guide", "Care instructions included", "Two-year warranty cover"],
    fulfilment: "Packed for protected laboratory delivery."
  },
  "surgical-light": {
    useCases: ["Procedure rooms", "Minor surgery", "Focused examination lighting"],
    support: ["Installation planning", "Positioning handover", "Two-year warranty cover"],
    fulfilment: "A specialist confirms ceiling mount compatibility before scheduling."
  },
  xray: {
    useCases: ["Bedside imaging", "Emergency departments", "Ward radiography"],
    support: ["Positioning workflow guidance", "Delivery coordination", "Two-year warranty cover"],
    fulfilment: "A specialist confirms room access and detector configuration first."
  },
  centrifuge: {
    useCases: ["Blood sample preparation", "Urine sample processing", "Routine laboratory testing"],
    support: ["Rotor balancing guide", "Care instructions included", "One-year warranty cover"],
    fulfilment: "Ready for dispatch with the standard rotor configuration."
  },
  vitals: {
    useCases: ["Patient intake", "Clinic triage", "Pre-consultation assessment"],
    support: ["Workflow setup guidance", "Quick-start orientation", "One-year warranty cover"],
    fulfilment: "Delivered ready for a straightforward front-desk setup."
  }
};

const defaultGuidance = {
  useCases: ["Clinical equipment workflow"],
  support: ["Product guidance available"],
  fulfilment: "A MediLine specialist confirms delivery details after order submission."
};

function productValues(product) {
  return [
    product.name,
    product.category,
    product.price,
    product.oldPrice,
    product.rating,
    product.reviews,
    product.brand,
    product.shortDescription,
    product.description,
    JSON.stringify(product.specifications),
    product.visual,
    product.featured
  ];
}

function seedDatabase() {
  const findByVisual = database.prepare("SELECT id FROM products WHERE visual = ? ORDER BY id LIMIT 1");
  const insertProduct = database.prepare(`
    INSERT INTO products (
      name, category, price, old_price, rating, reviews, stock, brand,
      short_description, description, specifications, visual, featured
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const updateProduct = database.prepare(`
    UPDATE products
    SET name = ?, category = ?, price = ?, old_price = ?, rating = ?, reviews = ?,
      brand = ?, short_description = ?, description = ?, specifications = ?,
      visual = ?, featured = ?
    WHERE id = ?
  `);

  for (const product of catalogProducts) {
    const existingProduct = findByVisual.get(product.visual);
    if (existingProduct) {
      updateProduct.run(...productValues(product), existingProduct.id);
      continue;
    }

    insertProduct.run(
      product.name,
      product.category,
      product.price,
      product.oldPrice,
      product.rating,
      product.reviews,
      product.stock,
      product.brand,
      product.shortDescription,
      product.description,
      JSON.stringify(product.specifications),
      product.visual,
      product.featured
    );
  }
}

seedDatabase();

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function readSpecifications(value) {
  try {
    const specifications = JSON.parse(value);
    return Array.isArray(specifications) ? specifications.map((item) => String(item)) : [];
  } catch {
    return [];
  }
}

function serializeProduct(row) {
  const guidance = productGuidance[row.visual] || defaultGuidance;
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    price: row.price,
    oldPrice: row.old_price,
    rating: row.rating,
    reviews: row.reviews,
    stock: row.stock,
    brand: row.brand,
    shortDescription: row.short_description,
    description: row.description,
    specifications: readSpecifications(row.specifications),
    visual: row.visual,
    featured: Boolean(row.featured),
    useCases: guidance.useCases,
    support: guidance.support,
    fulfilment: guidance.fulfilment
  };
}

function serializeUser(row) {
  return { id: row.id, name: row.name, email: row.email, createdAt: row.created_at };
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString("hex");
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function createSession(userId) {
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + sessionDurationMs).toISOString();
  database.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(new Date().toISOString());
  database.prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)").run(
    hashToken(token),
    userId,
    expiresAt
  );
  return token;
}

function getAuthenticatedUser(request) {
  const authorization = request.headers.authorization || "";
  if (!authorization.startsWith("Bearer ")) {
    return null;
  }

  const token = authorization.slice(7).trim();
  if (!token) {
    return null;
  }

  const session = database.prepare(`
    SELECT sessions.token_hash, sessions.expires_at, users.id, users.name, users.email, users.created_at
    FROM sessions
    JOIN users ON users.id = sessions.user_id
    WHERE sessions.token_hash = ?
  `).get(hashToken(token));

  if (!session) {
    return null;
  }

  if (Date.parse(session.expires_at) <= Date.now()) {
    database.prepare("DELETE FROM sessions WHERE token_hash = ?").run(session.token_hash);
    return null;
  }

  return serializeUser(session);
}

function requireUser(request) {
  const user = getAuthenticatedUser(request);
  if (!user) {
    throw new HttpError(401, "Please sign in first.");
  }
  return user;
}

function getProductById(productId) {
  const row = database.prepare("SELECT * FROM products WHERE id = ?").get(productId);
  if (!row) {
    throw new HttpError(404, "Product not found.");
  }
  return serializeProduct(row);
}

function getCart(userId) {
  const rows = database.prepare(`
    SELECT products.*, cart_items.quantity
    FROM cart_items
    JOIN products ON products.id = cart_items.product_id
    WHERE cart_items.user_id = ?
    ORDER BY cart_items.rowid DESC
  `).all(userId);

  const items = rows.map((row) => ({ ...serializeProduct(row), quantity: row.quantity }));
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const count = items.reduce((sum, item) => sum + item.quantity, 0);
  return { items, total, count };
}

function parsePositiveInteger(value, fieldName) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) {
    throw new HttpError(400, `${fieldName} is invalid.`);
  }
  return number;
}

function setCartQuantity(userId, productId, quantity) {
  const product = getProductById(productId);
  if (quantity > product.stock) {
    throw new HttpError(400, `Only ${product.stock} unit(s) of ${product.name} are currently available.`);
  }

  database.prepare(`
    INSERT INTO cart_items (user_id, product_id, quantity)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id, product_id) DO UPDATE SET quantity = excluded.quantity
  `).run(userId, productId, quantity);

  return getCart(userId);
}

function sendJson(response, status, payload) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });
  response.end(JSON.stringify(payload));
}

function sendError(response, error) {
  const status = error instanceof HttpError ? error.status : 500;
  const message = error instanceof HttpError ? error.message : "An unexpected error occurred. Please try again.";
  if (status >= 500) {
    console.error(error);
  }
  sendJson(response, status, { error: message });
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    let bodySize = 0;

    request.on("data", (chunk) => {
      bodySize += chunk.length;
      if (bodySize > 1_000_000) {
        reject(new HttpError(413, "Request body is too large."));
        request.destroy();
        return;
      }
      body += chunk;
    });

    request.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new HttpError(400, "Request data is invalid."));
      }
    });

    request.on("error", reject);
  });
}

function listProducts(searchParams) {
  const query = String(searchParams.get("q") || "").trim();
  const category = String(searchParams.get("category") || "").trim();
  const featured = searchParams.get("featured") === "true";
  const values = [];
  const clauses = [];

  if (query) {
    clauses.push("(name LIKE ? OR brand LIKE ? OR short_description LIKE ? OR description LIKE ?)");
    const wildcard = `%${query}%`;
    values.push(wildcard, wildcard, wildcard, wildcard);
  }
  if (category && category !== "all") {
    clauses.push("category = ?");
    values.push(category);
  }
  if (featured) {
    clauses.push("featured = 1");
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const rows = database.prepare(`SELECT * FROM products ${where} ORDER BY featured DESC, rating DESC, id DESC`).all(...values);
  return rows.map(serializeProduct);
}

function getCategories() {
  return database.prepare(`
    SELECT category, COUNT(*) AS count
    FROM products
    GROUP BY category
    ORDER BY CASE category
      WHEN 'dental' THEN 1
      WHEN 'imaging' THEN 2
      WHEN 'monitoring' THEN 3
      WHEN 'laboratory' THEN 4
      WHEN 'surgical' THEN 5
      WHEN 'sterilization' THEN 6
      ELSE 7
    END
  `).all();
}

function checkout(user) {
  const cart = getCart(user.id);
  if (!cart.items.length) {
    throw new HttpError(400, "Your cart is empty.");
  }

  const orderNumber = `ML-${new Date().getFullYear()}-${crypto.randomInt(100000, 999999)}`;
  database.exec("BEGIN IMMEDIATE");

  try {
    for (const item of cart.items) {
      const current = database.prepare("SELECT stock FROM products WHERE id = ?").get(item.id);
      if (!current || current.stock < item.quantity) {
        throw new HttpError(400, `There is no longer enough stock for: ${item.name}`);
      }
    }

    const orderResult = database.prepare(`
      INSERT INTO orders (user_id, order_number, total, status)
      VALUES (?, ?, ?, 'pending')
    `).run(user.id, orderNumber, cart.total);
    const orderId = Number(orderResult.lastInsertRowid);
    const insertOrderItem = database.prepare(`
      INSERT INTO order_items (order_id, product_name, unit_price, quantity)
      VALUES (?, ?, ?, ?)
    `);
    const decreaseStock = database.prepare("UPDATE products SET stock = stock - ? WHERE id = ?");

    for (const item of cart.items) {
      insertOrderItem.run(orderId, item.name, item.price, item.quantity);
      decreaseStock.run(item.quantity, item.id);
    }

    database.prepare("DELETE FROM cart_items WHERE user_id = ?").run(user.id);
    database.exec("COMMIT");
    return { orderNumber, total: cart.total };
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

function getOrders(userId) {
  const orders = database.prepare(`
    SELECT id, order_number, total, status, created_at
    FROM orders
    WHERE user_id = ?
    ORDER BY id DESC
  `).all(userId);

  const getItems = database.prepare(`
    SELECT product_name, unit_price, quantity
    FROM order_items
    WHERE order_id = ?
  `);

  return orders.map((order) => ({
    id: order.id,
    orderNumber: order.order_number,
    total: order.total,
    status: order.status,
    createdAt: order.created_at,
    items: getItems.all(order.id).map((item) => ({
      productName: item.product_name,
      unitPrice: item.unit_price,
      quantity: item.quantity
    }))
  }));
}

async function handleApi(request, response, url) {
  const { pathname, searchParams } = url;

  if (request.method === "GET" && pathname === "/api/health") {
    sendJson(response, 200, { status: "ok" });
    return;
  }

  if (request.method === "GET" && pathname === "/api/products") {
    sendJson(response, 200, { products: listProducts(searchParams) });
    return;
  }

  const productMatch = pathname.match(/^\/api\/products\/(\d+)$/);
  if (request.method === "GET" && productMatch) {
    sendJson(response, 200, { product: getProductById(Number(productMatch[1])) });
    return;
  }

  if (request.method === "GET" && pathname === "/api/categories") {
    sendJson(response, 200, { categories: getCategories() });
    return;
  }

  if (request.method === "POST" && pathname === "/api/auth/register") {
    const body = await readJson(request);
    const name = String(body.name || "").trim();
    const email = normalizeEmail(body.email);
    const password = String(body.password || "");

    if (name.length < 2 || name.length > 80) {
      throw new HttpError(400, "Enter a valid name between 2 and 80 characters.");
    }
    if (!validateEmail(email)) {
      throw new HttpError(400, "Enter a valid email address.");
    }
    if (password.length < 8) {
      throw new HttpError(400, "Password must be at least 8 characters long.");
    }
    if (database.prepare("SELECT id FROM users WHERE email = ?").get(email)) {
      throw new HttpError(409, "That email is already registered. Please sign in instead.");
    }

    const salt = crypto.randomBytes(16).toString("hex");
    const result = database.prepare(`
      INSERT INTO users (name, email, password_hash, password_salt)
      VALUES (?, ?, ?, ?)
    `).run(name, email, hashPassword(password, salt), salt);
    const user = database.prepare("SELECT * FROM users WHERE id = ?").get(Number(result.lastInsertRowid));
    const token = createSession(user.id);
    sendJson(response, 201, { token, user: serializeUser(user) });
    return;
  }

  if (request.method === "POST" && pathname === "/api/auth/login") {
    const body = await readJson(request);
    const email = normalizeEmail(body.email);
    const password = String(body.password || "");
    const user = database.prepare("SELECT * FROM users WHERE email = ?").get(email);

    if (!user || !crypto.timingSafeEqual(Buffer.from(hashPassword(password, user.password_salt)), Buffer.from(user.password_hash))) {
      throw new HttpError(401, "Email address or password is incorrect.");
    }

    const token = createSession(user.id);
    sendJson(response, 200, { token, user: serializeUser(user) });
    return;
  }

  if (request.method === "GET" && pathname === "/api/auth/me") {
    const user = requireUser(request);
    sendJson(response, 200, { user });
    return;
  }

  if (request.method === "POST" && pathname === "/api/auth/logout") {
    const authorization = request.headers.authorization || "";
    if (authorization.startsWith("Bearer ")) {
      database.prepare("DELETE FROM sessions WHERE token_hash = ?").run(hashToken(authorization.slice(7).trim()));
    }
    sendJson(response, 200, { success: true });
    return;
  }

  if (request.method === "GET" && pathname === "/api/cart") {
    const user = requireUser(request);
    sendJson(response, 200, getCart(user.id));
    return;
  }

  if (request.method === "POST" && pathname === "/api/cart") {
    const user = requireUser(request);
    const body = await readJson(request);
    const productId = parsePositiveInteger(body.productId, "Product ID");
    const quantity = parsePositiveInteger(body.quantity || 1, "Quantity");
    const current = database.prepare("SELECT quantity FROM cart_items WHERE user_id = ? AND product_id = ?").get(user.id, productId);
    const cart = setCartQuantity(user.id, productId, (current?.quantity || 0) + quantity);
    sendJson(response, 200, cart);
    return;
  }

  const cartItemMatch = pathname.match(/^\/api\/cart\/(\d+)$/);
  if (request.method === "PATCH" && cartItemMatch) {
    const user = requireUser(request);
    const body = await readJson(request);
    const productId = Number(cartItemMatch[1]);
    const quantity = Number(body.quantity);
    if (!Number.isInteger(quantity) || quantity < 0) {
      throw new HttpError(400, "Quantity is invalid.");
    }
    if (quantity === 0) {
      database.prepare("DELETE FROM cart_items WHERE user_id = ? AND product_id = ?").run(user.id, productId);
      sendJson(response, 200, getCart(user.id));
      return;
    }
    sendJson(response, 200, setCartQuantity(user.id, productId, quantity));
    return;
  }

  if (request.method === "DELETE" && cartItemMatch) {
    const user = requireUser(request);
    database.prepare("DELETE FROM cart_items WHERE user_id = ? AND product_id = ?").run(user.id, Number(cartItemMatch[1]));
    sendJson(response, 200, getCart(user.id));
    return;
  }

  if (request.method === "POST" && pathname === "/api/orders/checkout") {
    const user = requireUser(request);
    sendJson(response, 201, { order: checkout(user) });
    return;
  }

  if (request.method === "GET" && pathname === "/api/orders") {
    const user = requireUser(request);
    sendJson(response, 200, { orders: getOrders(user.id) });
    return;
  }

  throw new HttpError(404, "API route not found.");
}

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webp": "image/webp"
};

function serveStatic(response, pathname) {
  const requestedPath = pathname === "/" ? "Home.html" : decodeURIComponent(pathname).replace(/^[/\\]+/, "");
  const extension = path.extname(requestedPath).toLowerCase();
  const filePath = path.resolve(rootDirectory, requestedPath);

  if (!mimeTypes[extension] || !filePath.startsWith(`${rootDirectory}${path.sep}`)) {
    throw new HttpError(404, "Page not found.");
  }

  try {
    const content = fs.readFileSync(filePath);
    response.writeHead(200, {
      "Content-Type": mimeTypes[extension],
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "same-origin",
      "Content-Security-Policy": "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'self'; form-action 'self'"
    });
    response.end(content);
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new HttpError(404, "Page not found.");
    }
    throw error;
  }
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
    if (url.pathname.startsWith("/api/")) {
      await handleApi(request, response, url);
      return;
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      throw new HttpError(405, "Method not allowed.");
    }
    serveStatic(response, url.pathname);
  } catch (error) {
    sendError(response, error);
  }
});

server.listen(port, () => {
  console.log(`MediLine is running at http://localhost:${port}`);
});
