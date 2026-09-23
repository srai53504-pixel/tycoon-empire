/**
 * Entrepreneur-style private multiplayer server
 * ------------------------------------------------
 * This is an ORIGINAL backend implementation for a business/tycoon game.
 * It does not contain or copy proprietary client/server code from the reference APK.
 *
 * Run:
 *   npm install
 *   npm start
 *
 * Environment:
 *   PORT=8080
 *   JWT_SECRET=change-this-secret
 *   DATA_FILE=./data.json
 *
 * Main API:
 *   POST /api/auth/register
 *   POST /api/auth/login
 *   GET  /api/player/me
 *   POST /api/company
 *   GET  /api/company
 *   POST /api/business/buy
 *   POST /api/business/sell
 *   POST /api/transport/buy
 *   POST /api/transport/sell
 *   GET  /api/catalog
 *   GET  /api/rankings
 *   POST /api/contracts
 *   POST /api/contracts/:id/complete
 *   POST /api/alliance
 *   POST /api/alliance/:id/join
 *   GET  /api/chat/:channel
 *
 * WebSocket:
 *   ws://HOST/ws?token=JWT
 *
 * NOTE:
 * The supplied APK does not expose a documented public game API. Therefore
 * this server uses a clean REST/WebSocket contract. An unmodified APK will
 * only work with this server if its client already uses the same API contract.
 * Otherwise the APK/client must be adapted to call these endpoints.
 */

const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const http = require("http");
const { WebSocketServer } = require("ws");

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

const PORT = Number(process.env.PORT || 8080);
const JWT_SECRET = process.env.JWT_SECRET || "CHANGE_ME_PRIVATE_SERVER_SECRET";
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, "data.json");

app.use(cors());
app.use(express.json({ limit: "1mb" }));

/* ----------------------------- Game catalog ----------------------------- */

const CATALOG = {
  businesses: {
    restaurant: { name: "Restaurant", price: 10000, income: 500, cycle: 3600, maxLevel: 20 },
    grocery: { name: "Grocery Store", price: 25000, income: 1200, cycle: 3600, maxLevel: 20 },
    factory: { name: "Factory", price: 100000, income: 6000, cycle: 7200, maxLevel: 20 },
    mall: { name: "Mall", price: 500000, income: 30000, cycle: 10800, maxLevel: 20 },
    bar: { name: "Bar", price: 75000, income: 3500, cycle: 5400, maxLevel: 20 }
  },
  transports: {
    taxi: { name: "Taxi", price: 15000, income: 750, cycle: 3600 },
    bus: { name: "Bus", price: 75000, income: 4000, cycle: 5400 },
    truck: { name: "Truck", price: 200000, income: 12000, cycle: 7200 },
    cargo_ship: { name: "Cargo Ship", price: 1500000, income: 95000, cycle: 21600 },
    airplane: { name: "Cargo Airplane", price: 5000000, income: 350000, cycle: 43200 }
  },
  concession: {
    basic: { name: "Basic Concession", price: 250000, incomeMultiplier: 1.10 },
    premium: { name: "Premium Concession", price: 1000000, incomeMultiplier: 1.25 },
    elite: { name: "Elite Concession", price: 5000000, incomeMultiplier: 1.50 }
  },
  subsidiaries: {
    local: { name: "Local Subsidiary", price: 1000000, incomeMultiplier: 1.20 },
    regional: { name: "Regional Subsidiary", price: 5000000, incomeMultiplier: 1.50 },
    global: { name: "Global Subsidiary", price: 25000000, incomeMultiplier: 2.00 }
  }
};

const LEVELS = Array.from({ length: 20 }, (_, i) => {
  const level = i + 1;
  return {
    level,
    xpRequired: Math.floor(1000 * Math.pow(level, 1.65)),
    netWorthRequired: Math.floor(25000 * Math.pow(level, 1.85))
  };
});

/* ------------------------------ Persistence ----------------------------- */

const defaultDB = {
  version: 1,
  users: {},
  companies: {},
  contracts: {},
  alliances: {},
  chat: { global: [] }
};

function loadDB() {
  try {
    if (!fs.existsSync(DATA_FILE)) return structuredClone(defaultDB);
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    const db = JSON.parse(raw);
    return {
      ...structuredClone(defaultDB),
      ...db,
      users: db.users || {},
      companies: db.companies || {},
      contracts: db.contracts || {},
      alliances: db.alliances || {},
      chat: db.chat || { global: [] }
    };
  } catch (e) {
    console.error("Could not load database:", e.message);
    return structuredClone(defaultDB);
  }
}

let db = loadDB();
let saveTimer = null;

function saveDB() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      const tmp = `${DATA_FILE}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
      fs.renameSync(tmp, DATA_FILE);
    } catch (e) {
      console.error("Database save failed:", e.message);
    }
  }, 250);
}

function id(prefix) {
  return `${prefix}_${crypto.randomBytes(8).toString("hex")}`;
}

function now() {
  return Date.now();
}

function cleanUser(user) {
  if (!user) return null;
  const { passwordHash, ...safe } = user;
  return safe;
}

/* ------------------------------- Economics ------------------------------ */

function calculateBusinessIncome(company, secondsElapsed) {
  let total = 0;

  for (const [type, owned] of Object.entries(company.businesses || {})) {
    const item = CATALOG.businesses[type];
    if (!item || !owned || owned.quantity <= 0) continue;

    const cycles = Math.floor(secondsElapsed / item.cycle);
    if (cycles <= 0) continue;

    const levelMultiplier = 1 + ((owned.level || 1) - 1) * 0.10;
    total += cycles * item.income * owned.quantity * levelMultiplier;
  }

  for (const [type, owned] of Object.entries(company.transports || {})) {
    const item = CATALOG.transports[type];
    if (!item || !owned || owned.quantity <= 0) continue;

    const cycles = Math.floor(secondsElapsed / item.cycle);
    if (cycles <= 0) continue;

    total += cycles * item.income * owned.quantity;
  }

  const concession = CATALOG.concession[company.concession];
  if (concession) total *= concession.incomeMultiplier;

  const subsidiary = CATALOG.subsidiaries[company.subsidiary];
  if (subsidiary) total *= subsidiary.incomeMultiplier;

  return Math.floor(total);
}

function collectOfflineIncome(company) {
  const t = now();
  const elapsed = Math.max(0, Math.min(t - (company.lastIncomeAt || t), 7 * 24 * 3600 * 1000));
  const income = calculateBusinessIncome(company, Math.floor(elapsed / 1000));

  company.money += income;
  company.totalIncome += income;
  company.lastIncomeAt = t;

  if (income > 0) {
    company.xp += Math.floor(income / 100);
    updateLevel(company);
  }
  return income;
}

function updateLevel(company) {
  let level = company.level || 1;
  while (
    level < LEVELS.length &&
    company.xp >= LEVELS[level].xpRequired
  ) level++;

  company.level = Math.min(level, LEVELS.length);
}

function netWorth(company) {
  let value = company.money;

  for (const [type, owned] of Object.entries(company.businesses || {})) {
    const item = CATALOG.businesses[type];
    if (item) value += item.price * (owned.quantity || 0);
  }
  for (const [type, owned] of Object.entries(company.transports || {})) {
    const item = CATALOG.transports[type];
    if (item) value += item.price * (owned.quantity || 0);
  }

  return Math.floor(value);
}

function getCompany(userId) {
  return db.companies[userId] || null;
}

function publicCompany(company) {
  if (!company) return null;
  collectOfflineIncome(company);

  return {
    id: company.id,
    ownerId: company.ownerId,
    name: company.name,
    country: company.country,
    level: company.level,
    xp: company.xp,
    money: company.money,
    totalIncome: company.totalIncome,
    netWorth: netWorth(company),
    businesses: company.businesses,
    transports: company.transports,
    concession: company.concession,
    subsidiary: company.subsidiary,
    contractsCompleted: company.contractsCompleted,
    createdAt: company.createdAt
  };
}

/* -------------------------------- Auth --------------------------------- */

function signToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: "30d" });
}

function auth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Missing Bearer token" });

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = db.users[decoded.userId];
    if (!user) return res.status(401).json({ error: "Invalid account" });

    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

function requireCompany(req, res, next) {
  const company = getCompany(req.user.id);
  if (!company) return res.status(404).json({ error: "Create a company first" });
  collectOfflineIncome(company);
  req.company = company;
  next();
}

/* ------------------------------- Health -------------------------------- */

app.get("/", (req, res) => {
  res.json({
    name: "Entrepreneur Private Multiplayer Server",
    status: "online",
    version: "1.0.0",
    time: new Date().toISOString()
  });
});

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    uptime: process.uptime(),
    players: Object.keys(db.users).length,
    companies: Object.keys(db.companies).length,
    time: new Date().toISOString()
  });
});

app.get("/api/catalog", (req, res) => {
  res.json({ catalog: CATALOG, levels: LEVELS });
});

/* ------------------------------- Account -------------------------------- */

app.post("/api/auth/register", async (req, res) => {
  try {
    const username = String(req.body.username || "").trim();
    const password = String(req.body.password || "");
    const country = String(req.body.country || "India").trim();

    if (!/^[A-Za-z0-9_]{3,24}$/.test(username))
      return res.status(400).json({ error: "Username must be 3-24 letters/numbers/underscore" });

    if (password.length < 6)
      return res.status(400).json({ error: "Password must be at least 6 characters" });

    const exists = Object.values(db.users).some(
      u => u.username.toLowerCase() === username.toLowerCase()
    );
    if (exists) return res.status(409).json({ error: "Username already exists" });

    const userId = id("usr");
    const passwordHash = await bcrypt.hash(password, 10);

    const user = {
      id: userId,
      username,
      country,
      passwordHash,
      createdAt: now(),
      lastLoginAt: now()
    };

    db.users[userId] = user;
    saveDB();

    const token = signToken(userId);
    res.json({ token, user: cleanUser(user) });
  } catch (e) {
    res.status(500).json({ error: "Registration failed" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const username = String(req.body.username || "").trim();
  const password = String(req.body.password || "");

  const user = Object.values(db.users).find(
    u => u.username.toLowerCase() === username.toLowerCase()
  );

  if (!user || !(await bcrypt.compare(password, user.passwordHash)))
    return res.status(401).json({ error: "Invalid username or password" });

  user.lastLoginAt = now();
  saveDB();

  res.json({
    token: signToken(user.id),
    user: cleanUser(user),
    company: publicCompany(getCompany(user.id))
  });
});

app.get("/api/player/me", auth, (req, res) => {
  res.json({
    user: cleanUser(req.user),
    company: publicCompany(getCompany(req.user.id))
  });
});

/* ------------------------------- Company -------------------------------- */

app.post("/api/company", auth, (req, res) => {
  if (getCompany(req.user.id))
    return res.status(409).json({ error: "Company already exists" });

  const name = String(req.body.name || `${req.user.username} Corp`).trim();
  if (name.length < 2 || name.length > 40)
    return res.status(400).json({ error: "Company name must be 2-40 characters" });

  const company = {
    id: id("cmp"),
    ownerId: req.user.id,
    name,
    country: req.user.country,
    level: 1,
    xp: 0,
    money: 100000,
    totalIncome: 0,
    businesses: {},
    transports: {},
    concession: null,
    subsidiary: null,
    contractsCompleted: 0,
    allianceId: null,
    lastIncomeAt: now(),
    createdAt: now()
  };

  db.companies[req.user.id] = company;
  saveDB();

  res.status(201).json({ company: publicCompany(company) });
});

app.get("/api/company", auth, requireCompany, (req, res) => {
  res.json({ company: publicCompany(req.company) });
});

app.get("/api/company/:ownerId", auth, (req, res) => {
  const company = db.companies[req.params.ownerId];
  if (!company) return res.status(404).json({ error: "Company not found" });
  res.json({ company: publicCompany(company) });
});

/* ------------------------------ Businesses ------------------------------ */

app.post("/api/business/buy", auth, requireCompany, (req, res) => {
  const type = String(req.body.type || "");
  const quantity = Math.floor(Number(req.body.quantity || 0));

  const item = CATALOG.businesses[type];
  if (!item) return res.status(400).json({ error: "Unknown business type" });
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100000)
    return res.status(400).json({ error: "Invalid quantity" });

  const cost = item.price * quantity;
  if (req.company.money < cost)
    return res.status(400).json({ error: "Insufficient funds", required: cost });

  req.company.money -= cost;
  req.company.businesses[type] ||= { quantity: 0, level: 1 };
  req.company.businesses[type].quantity += quantity;
  req.company.xp += Math.floor(cost / 100);
  updateLevel(req.company);
  saveDB();

  res.json({ company: publicCompany(req.company), purchased: { type, quantity, cost } });
});

app.post("/api/business/sell", auth, requireCompany, (req, res) => {
  const type = String(req.body.type || "");
  const quantity = Math.floor(Number(req.body.quantity || 0));
  const item = CATALOG.businesses[type];
  const owned = req.company.businesses[type];

  if (!item || !owned) return res.status(400).json({ error: "Business not owned" });
  if (quantity < 1 || quantity > owned.quantity)
    return res.status(400).json({ error: "Invalid quantity" });

  const refund = Math.floor(item.price * quantity * 0.70);
  owned.quantity -= quantity;
  req.company.money += refund;
  if (owned.quantity === 0) delete req.company.businesses[type];

  saveDB();
  res.json({ company: publicCompany(req.company), sold: { type, quantity, refund } });
});

app.post("/api/business/upgrade", auth, requireCompany, (req, res) => {
  const type = String(req.body.type || "");
  const owned = req.company.businesses[type];
  const item = CATALOG.businesses[type];

  if (!item || !owned) return res.status(400).json({ error: "Business not owned" });
  if (owned.level >= item.maxLevel)
    return res.status(400).json({ error: "Maximum business level reached" });

  const upgradeCost = Math.floor(item.price * Math.pow(1.55, owned.level - 1));
  if (req.company.money < upgradeCost)
    return res.status(400).json({ error: "Insufficient funds", required: upgradeCost });

  req.company.money -= upgradeCost;
  owned.level++;
  req.company.xp += Math.floor(upgradeCost / 100);
  updateLevel(req.company);
  saveDB();

  res.json({ company: publicCompany(req.company), upgradeCost });
});

/* ------------------------------ Transport ------------------------------- */

app.post("/api/transport/buy", auth, requireCompany, (req, res) => {
  const type = String(req.body.type || "");
  const quantity = Math.floor(Number(req.body.quantity || 0));
  const item = CATALOG.transports[type];

  if (!item) return res.status(400).json({ error: "Unknown transport type" });
  if (quantity < 1 || quantity > 10000)
    return res.status(400).json({ error: "Invalid quantity" });

  const cost = item.price * quantity;
  if (req.company.money < cost)
    return res.status(400).json({ error: "Insufficient funds", required: cost });

  req.company.money -= cost;
  req.company.transports[type] ||= { quantity: 0 };
  req.company.transports[type].quantity += quantity;
  req.company.xp += Math.floor(cost / 100);
  updateLevel(req.company);
  saveDB();

  res.json({ company: publicCompany(req.company), purchased: { type, quantity, cost } });
});

app.post("/api/transport/sell", auth, requireCompany, (req, res) => {
  const type = String(req.body.type || "");
  const quantity = Math.floor(Number(req.body.quantity || 0));
  const item = CATALOG.transports[type];
  const owned = req.company.transports[type];

  if (!item || !owned) return res.status(400).json({ error: "Transport not owned" });
  if (quantity < 1 || quantity > owned.quantity)
    return res.status(400).json({ error: "Invalid quantity" });

  const refund = Math.floor(item.price * quantity * 0.70);
  owned.quantity -= quantity;
  req.company.money += refund;
  if (owned.quantity === 0) delete req.company.transports[type];

  saveDB();
  res.json({ company: publicCompany(req.company), sold: { type, quantity, refund } });
});

/* ------------------------------- Upgrades -------------------------------- */

app.post("/api/concession/buy", auth, requireCompany, (req, res) => {
  const type = String(req.body.type || "");
  const item = CATALOG.concession[type];
  if (!item) return res.status(400).json({ error: "Unknown concession" });
  if (req.company.concession)
    return res.status(400).json({ error: "Concession already owned" });
  if (req.company.money < item.price)
    return res.status(400).json({ error: "Insufficient funds" });

  req.company.money -= item.price;
  req.company.concession = type;
  req.company.xp += Math.floor(item.price / 100);
  updateLevel(req.company);
  saveDB();

  res.json({ company: publicCompany(req.company) });
});

app.post("/api/subsidiary/buy", auth, requireCompany, (req, res) => {
  const type = String(req.body.type || "");
  const item = CATALOG.subsidiaries[type];
  if (!item) return res.status(400).json({ error: "Unknown subsidiary" });
  if (req.company.subsidiary)
    return res.status(400).json({ error: "Subsidiary already owned" });
  if (req.company.money < item.price)
    return res.status(400).json({ error: "Insufficient funds" });

  req.company.money -= item.price;
  req.company.subsidiary = type;
  req.company.xp += Math.floor(item.price / 100);
  updateLevel(req.company);
  saveDB();

  res.json({ company: publicCompany(req.company) });
});

/* -------------------------------- Income -------------------------------- */

app.post("/api/income/collect", auth, requireCompany, (req, res) => {
  const before = req.company.money;
  const income = collectOfflineIncome(req.company);
  saveDB();

  res.json({
    collected: income,
    moneyBefore: before,
    moneyAfter: req.company.money,
    company: publicCompany(req.company)
  });
});

/* ------------------------------- Contracts ------------------------------- */

function createContractForCompany(company) {
  const idValue = id("ctr");
  const difficulty = 1 + Math.floor(Math.random() * Math.max(1, company.level));
  const reward = 5000 * difficulty * (1 + company.level * 0.10);

  const contract = {
    id: idValue,
    companyId: company.id,
    title: ["Supply Contract", "Transport Contract", "Retail Contract", "Industrial Contract"][
      Math.floor(Math.random() * 4)
    ],
    difficulty,
    reward: Math.floor(reward),
    xp: Math.floor(reward / 100),
    status: "open",
    createdAt: now(),
    expiresAt: now() + 24 * 3600 * 1000
  };

  db.contracts[idValue] = contract;
  return contract;
}

app.get("/api/contracts", auth, requireCompany, (req, res) => {
  const list = Object.values(db.contracts).filter(c =>
    c.companyId === req.company.id && c.expiresAt > now()
  );

  while (list.length < 5) {
    const c = createContractForCompany(req.company);
    list.push(c);
  }

  saveDB();
  res.json({ contracts: list });
});

app.post("/api/contracts/:id/complete", auth, requireCompany, (req, res) => {
  const contract = db.contracts[req.params.id];

  if (!contract || contract.companyId !== req.company.id)
    return res.status(404).json({ error: "Contract not found" });

  if (contract.status !== "open")
    return res.status(400).json({ error: "Contract is not open" });

  if (contract.expiresAt < now())
    return res.status(400).json({ error: "Contract expired" });

  contract.status = "completed";
  req.company.money += contract.reward;
  req.company.xp += contract.xp;
  req.company.contractsCompleted++;
  updateLevel(req.company);
  saveDB();

  res.json({ contract, company: publicCompany(req.company) });
});

/* ------------------------------- Rankings -------------------------------- */

app.get("/api/rankings", auth, (req, res) => {
  const rankings = Object.values(db.companies)
    .map(c => {
      collectOfflineIncome(c);
      return {
        companyId: c.id,
        ownerId: c.ownerId,
        companyName: c.name,
        ownerName: db.users[c.ownerId]?.username || "Unknown",
        country: c.country,
        level: c.level,
        netWorth: netWorth(c)
      };
    })
    .sort((a, b) => b.netWorth - a.netWorth)
    .slice(0, 100);

  saveDB();
  res.json({ rankings });
});

/* ------------------------------- Alliances ------------------------------- */

app.post("/api/alliance", auth, requireCompany, (req, res) => {
  if (req.company.allianceId)
    return res.status(400).json({ error: "Already in an alliance" });

  const name = String(req.body.name || "").trim();
  if (name.length < 2 || name.length > 30)
    return res.status(400).json({ error: "Alliance name must be 2-30 characters" });

  const alliance = {
    id: id("all"),
    name,
    ownerId: req.user.id,
    members: [req.user.id],
    createdAt: now()
  };

  db.alliances[alliance.id] = alliance;
  req.company.allianceId = alliance.id;
  saveDB();

  res.status(201).json({ alliance });
});

app.get("/api/alliances", auth, (req, res) => {
  res.json({
    alliances: Object.values(db.alliances).map(a => ({
      ...a,
      memberCount: a.members.length
    }))
  });
});

app.post("/api/alliance/:id/join", auth, requireCompany, (req, res) => {
  const alliance = db.alliances[req.params.id];
  if (!alliance) return res.status(404).json({ error: "Alliance not found" });
  if (req.company.allianceId) return res.status(400).json({ error: "Already in an alliance" });
  if (alliance.members.length >= 50) return res.status(400).json({ error: "Alliance is full" });

  alliance.members.push(req.user.id);
  req.company.allianceId = alliance.id;
  saveDB();

  res.json({ alliance });
});

app.post("/api/alliance/leave", auth, requireCompany, (req, res) => {
  if (!req.company.allianceId)
    return res.status(400).json({ error: "Not in an alliance" });

  const alliance = db.alliances[req.company.allianceId];
  if (alliance) {
    alliance.members = alliance.members.filter(x => x !== req.user.id);
    if (alliance.ownerId === req.user.id && alliance.members.length) {
      alliance.ownerId = alliance.members[0];
    }
    if (alliance.members.length === 0) delete db.alliances[alliance.id];
  }

  req.company.allianceId = null;
  saveDB();

  res.json({ ok: true });
});

/* -------------------------------- Chat ---------------------------------- */

function addChat(channel, user, message) {
  db.chat[channel] ||= [];
  const entry = {
    id: id("msg"),
    userId: user.id,
    username: user.username,
    message: String(message).slice(0, 500),
    createdAt: now()
  };

  db.chat[channel].push(entry);
  if (db.chat[channel].length > 200) db.chat[channel] = db.chat[channel].slice(-200);
  return entry;
}

app.get("/api/chat/:channel", auth, (req, res) => {
  const channel = String(req.params.channel || "global");
  res.json({ messages: db.chat[channel] || [] });
});

app.post("/api/chat/:channel", auth, (req, res) => {
  const channel = String(req.params.channel || "global").replace(/[^A-Za-z0-9_-]/g, "");
  const message = String(req.body.message || "").trim();

  if (!message) return res.status(400).json({ error: "Empty message" });

  const entry = addChat(channel, req.user, message);
  saveDB();

  broadcast({
    type: "chat",
    channel,
    message: entry
  });

  res.json({ message: entry });
});

/* ------------------------------ Admin reset ------------------------------ */
/* Keep this endpoint disabled unless an ADMIN_KEY is configured. */

app.post("/api/admin/reset", (req, res) => {
  const key = req.headers["x-admin-key"];
  if (!process.env.ADMIN_KEY || key !== process.env.ADMIN_KEY)
    return res.status(403).json({ error: "Admin reset disabled or unauthorized" });

  db = structuredClone(defaultDB);
  saveDB();
  res.json({ ok: true });
});

/* ------------------------------- WebSocket ------------------------------- */

const sockets = new Set();

function broadcast(payload) {
  const text = JSON.stringify(payload);
  for (const ws of sockets) {
    if (ws.readyState === 1) {
      try { ws.send(text); } catch {}
    }
  }
}

server.on("upgrade", (request, socket, head) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  if (url.pathname !== "/ws") {
    socket.destroy();
    return;
  }

  const token = url.searchParams.get("token");
  try {
    const decoded = jwt.verify(token || "", JWT_SECRET);
    const user = db.users[decoded.userId];
    if (!user) throw new Error("invalid user");

    wss.handleUpgrade(request, socket, head, ws => {
      ws.user = user;
      wss.emit("connection", ws, request);
    });
  } catch {
    socket.destroy();
  }
});

wss.on("connection", ws => {
  sockets.add(ws);

  ws.send(JSON.stringify({
    type: "connected",
    serverTime: now(),
    user: cleanUser(ws.user),
    company: publicCompany(getCompany(ws.user.id))
  }));

  ws.on("message", raw => {
    try {
      const packet = JSON.parse(raw.toString());

      if (packet.type === "ping") {
        ws.send(JSON.stringify({ type: "pong", serverTime: now() }));
        return;
      }

      if (packet.type === "chat") {
        const channel = String(packet.channel || "global").replace(/[^A-Za-z0-9_-]/g, "");
        const message = String(packet.message || "").trim();
        if (!message) return;

        const entry = addChat(channel, ws.user, message);
        saveDB();

        broadcast({
          type: "chat",
          channel,
          message: entry
        });
      }
    } catch {
      ws.send(JSON.stringify({ type: "error", error: "Invalid WebSocket packet" }));
    }
  });

  ws.on("close", () => sockets.delete(ws));
});

/* --------------------------- Automatic income ---------------------------- */
/*
 * We do not add money every second. Instead, the company stores lastIncomeAt
 * and income is calculated when the player reconnects/opens company data.
 * This prevents a server restart from stopping passive income.
 */

setInterval(() => {
  // Persist recent state periodically.
  saveDB();
}, 30000);

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Private game server running on 0.0.0.0:${PORT}`);
  console.log(`Health: http://localhost:${PORT}/health`);
});
