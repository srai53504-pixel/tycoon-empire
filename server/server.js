const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const path = require("path");

const app = express();

const PORT = process.env.PORT || 8080;
const HOST = "0.0.0.0";
const JWT_SECRET =
  process.env.JWT_SECRET || "tycoon-empire-change-this-secret";

const DATA_FILE = path.join(__dirname, "data.json");

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* =========================================================
   DATABASE
   ========================================================= */

function defaultDatabase() {
  return {
    users: [],
    companies: [],
    alliances: [],
    chats: [],
    countryChats: [],
    bids: [],
    donations: [],
    resolutions: [],
    wars: [],
    armyAttacks: []
  };
}

function loadDatabase() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      const db = defaultDatabase();
      saveDatabase(db);
      return db;
    }

    const raw = fs.readFileSync(DATA_FILE, "utf8");

    if (!raw.trim()) {
      const db = defaultDatabase();
      saveDatabase(db);
      return db;
    }

    return JSON.parse(raw);
  } catch (err) {
    console.error("Database load error:", err);
    return defaultDatabase();
  }
}

function saveDatabase(db) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
  } catch (err) {
    console.error("Database save error:", err);
  }
}

let db = loadDatabase();

/* =========================================================
   HELPERS
   ========================================================= */

function now() {
  return Date.now();
}

function id(prefix) {
  return (
    prefix +
    "_" +
    Math.random().toString(36).substring(2, 12) +
    Date.now().toString(36)
  );
}

function getParam(req, name, fallback = "") {
  if (req.query && req.query[name] !== undefined) {
    return req.query[name];
  }

  if (req.body && req.body[name] !== undefined) {
    return req.body[name];
  }

  return fallback;
}

function getOperation(req) {
  return (
    getParam(req, "Operation") ||
    getParam(req, "operation") ||
    getParam(req, "op") ||
    ""
  );
}

function cleanNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function sendSuccess(res, data = {}) {
  res.json({
    success: true,
    status: "success",
    ...data
  });
}

function sendError(res, message, statusCode = 400) {
  res.status(statusCode).json({
    success: false,
    error: message,
    status: "error"
  });
}

/* =========================================================
   USER / COMPANY HELPERS
   ========================================================= */

function findUserById(userId) {
  return db.users.find(
    (u) => u.id === userId || u.user_id === userId
  );
}

function findUserByUsername(username) {
  return db.users.find(
    (u) =>
      String(u.username).toLowerCase() ===
      String(username).toLowerCase()
  );
}

function findCompanyById(companyId) {
  return db.companies.find(
    (c) => c.id === companyId || c.company_id === companyId
  );
}

function findUserFromRequest(req) {
  let token = getParam(req, "token");

  const auth = req.headers.authorization;

  if (!token && auth && auth.startsWith("Bearer ")) {
    token = auth.substring(7);
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = findUserById(decoded.user_id);

      if (user) {
        return user;
      }
    } catch (_) {}
  }

  const userId =
    getParam(req, "user_id") ||
    getParam(req, "userid") ||
    getParam(req, "userId");

  if (userId) {
    const user = findUserById(userId);
    if (user) return user;
  }

  const username = getParam(req, "username");

  if (username) {
    const user = findUserByUsername(username);
    if (user) return user;
  }

  return null;
}

function publicUser(user) {
  if (!user) return null;

  return {
    id: user.id,
    user_id: user.id,
    username: user.username,
    user_name: user.username,
    email: user.email || "",
    country: user.country || "India",
    goldCoins: user.goldCoins || 0,
    gold_coins: user.goldCoins || 0,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
    dataUser: user
  };
}

function getCompanyForUser(user) {
  if (!user) return null;

  let company = findCompanyById(user.company_id);

  if (!company) {
    company = db.companies.find(
      (c) => c.ownerId === user.id
    );
  }

  return company || null;
}

/* =========================================================
   COMPANY DEFAULT
   ========================================================= */

function createCompany(user, params = {}) {
  const company = {
    id: id("company"),
    company_id: id("company"),

    ownerId: user.id,
    owner_id: user.id,

    name:
      params.company_name ||
      params.companyName ||
      user.username,

    country:
      params.country ||
      user.country ||
      "India",

    level: cleanNumber(params.level, 1),

    xp: cleanNumber(params.xp, 0),

    money: cleanNumber(params.money, 100000),

    net_worth: cleanNumber(
      params.net_worth,
      cleanNumber(params.money, 100000)
    ),

    economy_level: cleanNumber(params.economy_level, 1),

    businesses: {},

    transports: {},

    concessions: {},

    subsidiaries: {},

    contracts: [],

    contractsCompleted: 0,

    allianceId: null,

    patriotism: 0,

    location: {
      latitude: cleanNumber(params.latitude, 0),
      longitude: cleanNumber(params.longitude, 0)
    },

    lastIncomeAt: now(),

    createdAt: now()
  };

  db.companies.push(company);

  user.company_id = company.id;

  return company;
}

/* =========================================================
   AUTH
   ========================================================= */

function createToken(user) {
  return jwt.sign(
    {
      user_id: user.id,
      username: user.username
    },
    JWT_SECRET,
    {
      expiresIn: "365d"
    }
  );
}

function registerUser(req, res) {
  const username =
    getParam(req, "username") ||
    getParam(req, "user_name");

  const password = getParam(req, "password");

  const country =
    getParam(req, "country") || "India";

  const email =
    getParam(req, "email") || "";

  if (!username || !password) {
    return sendError(
      res,
      "username and password are required"
    );
  }

  if (findUserByUsername(username)) {
    return sendError(
      res,
      "Username already exists"
    );
  }

  const passwordHash = bcrypt.hashSync(password, 10);

  const user = {
    id: id("user"),
    user_id: null,

    username,
    user_name: username,

    email,

    country,

    passwordHash,

    goldCoins: 0,
    gold_coins: 0,

    createdAt: now(),
    lastLoginAt: now(),

    company_id: null,

    location: {
      latitude: 0,
      longitude: 0
    },

    army: {
      soldiers: 0,
      tanks: 0,
      aircraft: 0,
      ships: 0
    }
  };

  user.user_id = user.id;

  db.users.push(user);

  const company = createCompany(user, {
    company_name:
      getParam(req, "company_name") ||
      username,

    country,

    money: getParam(req, "money", 100000),

    net_worth: getParam(req, "net_worth", 100000),

    level: getParam(req, "level", 1),

    economy_level:
      getParam(req, "economy_level", 1)
  });

  const token = createToken(user);

  saveDatabase(db);

  return res.json({
    success: true,
    status: "success",
    token,

    user: publicUser(user),

    userData: {
      id: user.id,
      user_id: user.id,
      username: user.username,
      user_name: user.username,
      email: user.email,
      country: user.country,
      goldCoins: user.goldCoins,
      gold_coins: user.gold_coins,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt
    },

    company,

    message: "Registration successful"
  });
}

function loginUser(req, res) {
  const username =
    getParam(req, "username") ||
    getParam(req, "user_name");

  const password = getParam(req, "password");

  const user = findUserByUsername(username);

  if (!user) {
    return sendError(res, "User not found", 404);
  }

  if (!bcrypt.compareSync(password, user.passwordHash)) {
    return sendError(res, "Invalid password", 401);
  }

  user.lastLoginAt = now();

  const token = createToken(user);

  const company = getCompanyForUser(user);

  saveDatabase(db);

  return res.json({
    success: true,
    status: "success",
    token,
    user: publicUser(user),
    userData: publicUser(user),
    company
  });
}

/* =========================================================
   USER DATA
   ========================================================= */

function getUserData(req, res) {
  const user = findUserFromRequest(req);

  if (!user) {
    return sendError(res, "User not found", 404);
  }

  const company = getCompanyForUser(user);

  return res.json({
    success: true,
    status: "success",

    user: publicUser(user),

    userData: publicUser(user),

    company,

    money: company ? company.money : 0,

    level: company ? company.level : 1,

    xp: company ? company.xp : 0,

    net_worth: company ? company.net_worth : 0
  });
}

function updateUserData(req, res) {
  const user = findUserFromRequest(req);

  if (!user) {
    return sendError(res, "User not found", 404);
  }

  const company = getCompanyForUser(user);

  const fields = [
    "country",
    "email",
    "username",
    "user_name"
  ];

  for (const field of fields) {
    const value = getParam(req, field);

    if (value !== "") {
      if (
        field === "username" ||
        field === "user_name"
      ) {
        user.username = value;
        user.user_name = value;
      } else {
        user[field] = value;
      }
    }
  }

  if (company) {
    const money = getParam(req, "money");

    if (money !== "") {
      company.money = cleanNumber(
        money,
        company.money
      );
    }

    const level = getParam(req, "level");

    if (level !== "") {
      company.level = cleanNumber(
        level,
        company.level
      );
    }

    const xp = getParam(req, "xp");

    if (xp !== "") {
      company.xp = cleanNumber(
        xp,
        company.xp
      );
    }
  }

  saveDatabase(db);

  return getUserData(req, res);
}

function updateUserName(req, res) {
  const user = findUserFromRequest(req);

  if (!user) {
    return sendError(res, "User not found", 404);
  }

  const name =
    getParam(req, "username") ||
    getParam(req, "user_name") ||
    getParam(req, "name");

  if (!name) {
    return sendError(res, "Name is required");
  }

  user.username = name;
  user.user_name = name;

  const company = getCompanyForUser(user);

  if (company) {
    company.name = name;
  }

  saveDatabase(db);

  return sendSuccess(res, {
    user: publicUser(user),
    company
  });
}

function updateUserLocation(req, res) {
  const user = findUserFromRequest(req);

  if (!user) {
    return sendError(res, "User not found", 404);
  }

  const latitude = cleanNumber(
    getParam(req, "latitude"),
    0
  );

  const longitude = cleanNumber(
    getParam(req, "longitude"),
    0
  );

  user.location = {
    latitude,
    longitude
  };

  const company = getCompanyForUser(user);

  if (company) {
    company.location = {
      latitude,
      longitude
    };
  }

  saveDatabase(db);

  return sendSuccess(res, {
    location: user.location
  });
}

/* =========================================================
   COMPANIES
   ========================================================= */

function getRelevantCompanies(req, res) {
  return sendSuccess(res, {
    companies: db.companies.slice(0, 100)
  });
}

function getSameLevelCompanies(req, res) {
  const level = cleanNumber(
    getParam(req, "level"),
    1
  );

  return sendSuccess(res, {
    companies: db.companies.filter(
      (c) => c.level === level
    )
  });
}

function getCompanyByCountryAndLevel(req, res) {
  const country = getParam(req, "country");
  const level = cleanNumber(
    getParam(req, "level"),
    1
  );

  return sendSuccess(res, {
    companies: db.companies.filter(
      (c) =>
        (!country || c.country === country) &&
        c.level === level
    )
  });
}

/* =========================================================
   BUSINESSES
   ========================================================= */

function buyBusiness(req, res) {
  const user = findUserFromRequest(req);

  if (!user) {
    return sendError(res, "User not found", 404);
  }

  const company = getCompanyForUser(user);

  const type =
    getParam(req, "business") ||
    getParam(req, "business_type") ||
    getParam(req, "type") ||
    "business";

  const quantity = Math.max(
    1,
    cleanNumber(getParam(req, "quantity"), 1)
  );

  const price = Math.max(
    0,
    cleanNumber(getParam(req, "price"), 1000)
  );

  const total = price * quantity;

  if (company.money < total) {
    return sendError(res, "Not enough money");
  }

  company.money -= total;

  company.businesses[type] =
    (company.businesses[type] || 0) +
    quantity;

  company.net_worth += total;

  saveDatabase(db);

  return sendSuccess(res, {
    company,
    business: type,
    quantity
  });
}

function sellBusiness(req, res) {
  const user = findUserFromRequest(req);

  if (!user) {
    return sendError(res, "User not found", 404);
  }

  const company = getCompanyForUser(user);

  const type =
    getParam(req, "business") ||
    getParam(req, "business_type") ||
    getParam(req, "type") ||
    "business";

  const quantity = Math.max(
    1,
    cleanNumber(getParam(req, "quantity"), 1)
  );

  const owned = company.businesses[type] || 0;

  if (owned < quantity) {
    return sendError(
      res,
      "You do not own enough businesses"
    );
  }

  const price = Math.max(
    0,
    cleanNumber(getParam(req, "price"), 1000)
  );

  company.businesses[type] -= quantity;
  company.money += price * quantity;

  saveDatabase(db);

  return sendSuccess(res, {
    company
  });
}

function upgradeBusiness(req, res) {
  const user = findUserFromRequest(req);

  if (!user) {
    return sendError(res, "User not found", 404);
  }

  const company = getCompanyForUser(user);

  const type =
    getParam(req, "business") ||
    getParam(req, "business_type") ||
    "business";

  const cost = Math.max(
    0,
    cleanNumber(getParam(req, "price"), 5000)
  );

  if (company.money < cost) {
    return sendError(res, "Not enough money");
  }

  company.money -= cost;

  if (!company.businessLevels) {
    company.businessLevels = {};
  }

  company.businessLevels[type] =
    (company.businessLevels[type] || 0) + 1;

  saveDatabase(db);

  return sendSuccess(res, {
    company
  });
}

/* =========================================================
   TRANSPORT
   ========================================================= */

function buyTransport(req, res) {
  const user = findUserFromRequest(req);

  if (!user) {
    return sendError(res, "User not found", 404);
  }

  const company = getCompanyForUser(user);

  const type =
    getParam(req, "transport") ||
    getParam(req, "transport_type") ||
    getParam(req, "type") ||
    "transport";

  const quantity = Math.max(
    1,
    cleanNumber(getParam(req, "quantity"), 1)
  );

  const price = Math.max(
    0,
    cleanNumber(getParam(req, "price"), 5000)
  );

  const total = price * quantity;

  if (company.money < total) {
    return sendError(res, "Not enough money");
  }

  company.money -= total;

  company.transports[type] =
    (company.transports[type] || 0) +
    quantity;

  company.net_worth += total;

  saveDatabase(db);

  return sendSuccess(res, {
    company
  });
}

function sellTransport(req, res) {
  const user = findUserFromRequest(req);

  if (!user) {
    return sendError(res, "User not found", 404);
  }

  const company = getCompanyForUser(user);

  const type =
    getParam(req, "transport") ||
    getParam(req, "transport_type") ||
    getParam(req, "type") ||
    "transport";

  const quantity = Math.max(
    1,
    cleanNumber(getParam(req, "quantity"), 1)
  );

  const owned = company.transports[type] || 0;

  if (owned < quantity) {
    return sendError(
      res,
      "You do not own enough transports"
    );
  }

  const price = Math.max(
    0,
    cleanNumber(getParam(req, "price"), 5000)
  );

  company.transports[type] -= quantity;

  company.money += price * quantity;

  saveDatabase(db);

  return sendSuccess(res, {
    company
  });
}

/* =========================================================
   INCOME
   ========================================================= */

function collectIncome(req, res) {
  const user = findUserFromRequest(req);

  if (!user) {
    return sendError(res, "User not found", 404);
  }

  const company = getCompanyForUser(user);

  if (!company) {
    return sendError(res, "Company not found", 404);
  }

  const current = now();

  const elapsed =
    Math.max(
      0,
      current - (company.lastIncomeAt || current)
    );

  const cycles =
    Math.floor(elapsed / 60000);

  const incomePerCycle = 100;

  const income =
    Math.max(0, cycles) *
    incomePerCycle;

  if (income > 0) {
    company.money += income;
    company.lastIncomeAt =
      current;
  }

  saveDatabase(db);

  return sendSuccess(res, {
    income,
    money: company.money,
    company
  });
}

/* =========================================================
   CONCESSIONS / SUBSIDIARIES
   ========================================================= */

function buyConcession(req, res) {
  const user = findUserFromRequest(req);

  if (!user) {
    return sendError(res, "User not found", 404);
  }

  const company = getCompanyForUser(user);

  const country =
    getParam(req, "country") ||
    "India";

  const price = Math.max(
    0,
    cleanNumber(getParam(req, "price"), 10000)
  );

  if (company.money < price) {
    return sendError(res, "Not enough money");
  }

  company.money -= price;

  company.concessions[country] = {
    country,
    purchasedAt: now()
  };

  saveDatabase(db);

  return sendSuccess(res, {
    company
  });
}

function buySubsidiary(req, res) {
  const user = findUserFromRequest(req);

  if (!user) {
    return sendError(res, "User not found", 404);
  }

  const company = getCompanyForUser(user);

  const name =
    getParam(req, "name") ||
    getParam(req, "company_name") ||
    "Subsidiary";

  const price = Math.max(
    0,
    cleanNumber(getParam(req, "price"), 25000)
  );

  if (company.money < price) {
    return sendError(res, "Not enough money");
  }

  company.money -= price;

  company.subsidiaries[name] = {
    name,
    purchasedAt: now()
  };

  saveDatabase(db);

  return sendSuccess(res, {
    company
  });
}

function getConcessionsTrends(req, res) {
  return sendSuccess(res, {
    trends: []
  });
}

/* =========================================================
   CONTRACTS
   ========================================================= */

function getRunningContracts(req, res) {
  const user = findUserFromRequest(req);

  if (!user) {
    return sendError(res, "User not found", 404);
  }

  const company = getCompanyForUser(user);

  return sendSuccess(res, {
    contracts: company
      ? company.contracts
      : []
  });
}

function getContractsStatus(req, res) {
  const user = findUserFromRequest(req);

  if (!user) {
    return sendError(res, "User not found", 404);
  }

  const company = getCompanyForUser(user);

  return sendSuccess(res, {
    contracts: company
      ? company.contracts
      : [],

    completed: company
      ? company.contractsCompleted
      : 0
  });
}

/* =========================================================
   COUNTRY
   ========================================================= */

function getCountryData(req, res) {
  const country =
    getParam(req, "country") ||
    "India";

  const companies =
    db.companies.filter(
      (c) => c.country === country
    );

  return sendSuccess(res, {
    country,

    data: {
      country,
      companies: companies.length,
      players: db.users.filter(
        (u) => u.country === country
      ).length
    }
  });
}

/* =========================================================
   ALLIANCES
   ========================================================= */

function createAlliance(req, res) {
  const user = findUserFromRequest(req);

  if (!user) {
    return sendError(res, "User not found", 404);
  }

  const name =
    getParam(req, "name") ||
    getParam(req, "alliance_name") ||
    "Alliance";

  const alliance = {
    id: id("alliance"),
    alliance_id: id("alliance"),

    name,

    country:
      user.country || "India",

    ownerId: user.id,

    members: [user.id],

    messages: [],

    createdAt: now()
  };

  db.alliances.push(alliance);

  const company = getCompanyForUser(user);

  if (company) {
    company.allianceId = alliance.id;
  }

  saveDatabase(db);

  return sendSuccess(res, {
    alliance
  });
}

function joinAlliance(req, res) {
  const user = findUserFromRequest(req);

  if (!user) {
    return sendError(res, "User not found", 404);
  }

  const allianceId =
    getParam(req, "alliance_id") ||
    getParam(req, "allianceId");

  const alliance =
    db.alliances.find(
      (a) =>
        a.id === allianceId ||
        a.alliance_id === allianceId
    );

  if (!alliance) {
    return sendError(res, "Alliance not found", 404);
  }

  if (!alliance.members.includes(user.id)) {
    alliance.members.push(user.id);
  }

  const company = getCompanyForUser(user);

  if (company) {
    company.allianceId = alliance.id;
  }

  saveDatabase(db);

  return sendSuccess(res, {
    alliance
  });
}

function leaveAlliance(req, res) {
  const user = findUserFromRequest(req);

  if (!user) {
    return sendError(res, "User not found", 404);
  }

  const company = getCompanyForUser(user);

  if (company && company.allianceId) {
    const alliance =
      db.alliances.find(
        (a) => a.id === company.allianceId
      );

    if (alliance) {
      alliance.members =
        alliance.members.filter(
          (id) => id !== user.id
        );
    }

    company.allianceId = null;
  }

  saveDatabase(db);

  return sendSuccess(res);
}

function getAlliancesByCountry(req, res) {
  const country =
    getParam(req, "country");

  return sendSuccess(res, {
    alliances: db.alliances.filter(
      (a) =>
        !country ||
        a.country === country
    )
  });
}

function getAlliancesRankings(req, res) {
  const rankings =
    db.alliances
      .map((a) => ({
        ...a,
        memberCount: a.members.length
      }))
      .sort(
        (a, b) =>
          b.memberCount -
          a.memberCount
      );

  return sendSuccess(res, {
    alliances: rankings
  });
}

function getAllianceDetails(req, res) {
  const allianceId =
    getParam(req, "alliance_id") ||
    getParam(req, "allianceId");

  const alliance =
    db.alliances.find(
      (a) =>
        a.id === allianceId ||
        a.alliance_id === allianceId
    );

  if (!alliance) {
    return sendError(
      res,
      "Alliance not found",
      404
    );
  }

  return sendSuccess(res, {
    alliance
  });
}

/* =========================================================
   CHAT
   ========================================================= */

function sendAllianceMessage(req, res) {
  const user = findUserFromRequest(req);

  if (!user) {
    return sendError(res, "User not found", 404);
  }

  const allianceId =
    getParam(req, "alliance_id") ||
    getParam(req, "allianceId");

  const message =
    getParam(req, "message") ||
    getParam(req, "text");

  if (!message) {
    return sendError(res, "Message required");
  }

  const item = {
    id: id("message"),
    allianceId,
    userId: user.id,
    username: user.username,
    message,
    createdAt: now()
  };

  db.chats.push(item);

  saveDatabase(db);

  return sendSuccess(res, {
    message: item
  });
}

function getAllianceMessages(req, res) {
  const allianceId =
    getParam(req, "alliance_id") ||
    getParam(req, "allianceId");

  return sendSuccess(res, {
    messages: db.chats.filter(
      (m) =>
        !allianceId ||
        m.allianceId === allianceId
    )
  });
}

function sendCountryMessage(req, res) {
  const user = findUserFromRequest(req);

  if (!user) {
    return sendError(res, "User not found", 404);
  }

  const message =
    getParam(req, "message") ||
    getParam(req, "text");

  if (!message) {
    return sendError(res, "Message required");
  }

  const item = {
    id: id("country_message"),
    country: user.country,
    userId: user.id,
    username: user.username,
    message,
    createdAt: now()
  };

  db.countryChats.push(item);

  saveDatabase(db);

  return sendSuccess(res, {
    message: item
  });
}

function getCountryMessages(req, res) {
  const country =
    getParam(req, "country");

  return sendSuccess(res, {
    messages: db.countryChats.filter(
      (m) =>
        !country ||
        m.country === country
    )
  });
}

/* =========================================================
   ARMY
   ========================================================= */

function getUserArmy(req, res) {
  const user = findUserFromRequest(req);

  if (!user) {
    return sendError(res, "User not found", 404);
  }

  return sendSuccess(res, {
    army: user.army || {
      soldiers: 0,
      tanks: 0,
      aircraft: 0,
      ships: 0
    }
  });
}

function updateArmy(req, res) {
  const user = findUserFromRequest(req);

  if (!user) {
    return sendError(res, "User not found", 404);
  }

  if (!user.army) {
    user.army = {};
  }

  const types = [
    "soldiers",
    "tanks",
    "aircraft",
    "ships"
  ];

  for (const type of types) {
    const value = getParam(req, type);

    if (value !== "") {
      user.army[type] =
        Math.max(
          0,
          cleanNumber(value, 0)
        );
    }
  }

  saveDatabase(db);

  return sendSuccess(res, {
    army: user.army
  });
}

function armyAttack(req, res) {
  const user = findUserFromRequest(req);

  if (!user) {
    return sendError(res, "User not found", 404);
  }

  const targetId =
    getParam(req, "target_user_id") ||
    getParam(req, "targetUserId") ||
    getParam(req, "user_id");

  const target =
    findUserById(targetId);

  if (!target) {
    return sendError(
      res,
      "Target user not found",
      404
    );
  }

  const attack = {
    id: id("attack"),
    attackerId: user.id,
    defenderId: target.id,
    createdAt: now(),
    result: "pending"
  };

  db.armyAttacks.push(attack);

  saveDatabase(db);

  return sendSuccess(res, {
    attack
  });
}

/* =========================================================
   BIDS
   ========================================================= */

function postBid(req, res) {
  const user = findUserFromRequest(req);

  if (!user) {
    return sendError(res, "User not found", 404);
  }

  const bid = {
    id: id("bid"),
    userId: user.id,
    username: user.username,
    amount: cleanNumber(
      getParam(req, "amount"),
      0
    ),
    createdAt: now()
  };

  db.bids.push(bid);

  saveDatabase(db);

  return sendSuccess(res, {
    bid
  });
}

function getBidRanking(req, res) {
  const rankings =
    [...db.bids].sort(
      (a, b) =>
        b.amount - a.amount
    );

  return sendSuccess(res, {
    bids: rankings
  });
}

/* =========================================================
   DONATIONS / RESOLUTIONS
   ========================================================= */

function postDonation(req, res) {
  const user = findUserFromRequest(req);

  if (!user) {
    return sendError(res, "User not found", 404);
  }

  const donation = {
    id: id("donation"),
    userId: user.id,
    amount: cleanNumber(
      getParam(req, "amount"),
      0
    ),
    createdAt: now()
  };

  db.donations.push(donation);

  saveDatabase(db);

  return sendSuccess(res, {
    donation
  });
}

function postResolution(req, res) {
  const resolution = {
    id: id("resolution"),
    title:
      getParam(req, "title") ||
      "Resolution",

    description:
      getParam(req, "description") ||
      "",

    yes: 0,
    no: 0,

    active: true,

    createdAt: now()
  };

  db.resolutions.push(resolution);

  saveDatabase(db);

  return sendSuccess(res, {
    resolution
  });
}

function voteOnResolution(req, res) {
  const idValue =
    getParam(req, "resolution_id") ||
    getParam(req, "resolutionId");

  const resolution =
    db.resolutions.find(
      (r) => r.id === idValue
    );

  if (!resolution) {
    return sendError(
      res,
      "Resolution not found",
      404
    );
  }

  const vote =
    getParam(req, "vote") ||
    getParam(req, "choice");

  if (
    String(vote).toLowerCase() ===
    "yes"
  ) {
    resolution.yes++;
  } else {
    resolution.no++;
  }

  saveDatabase(db);

  return sendSuccess(res, {
    resolution
  });
}

function getActiveResolutions(req, res) {
  return sendSuccess(res, {
    resolutions:
      db.resolutions.filter(
        (r) => r.active
      )
  });
}

/* =========================================================
   WARS / PATRIOTISM
   ========================================================= */

function getWarsByCountry(req, res) {
  const country =
    getParam(req, "country");

  return sendSuccess(res, {
    wars: db.wars.filter(
      (w) =>
        !country ||
        w.country === country
    )
  });
}

function updateCompanyPatriotism(req, res) {
  const user = findUserFromRequest(req);

  if (!user) {
    return sendError(res, "User not found", 404);
  }

  const company = getCompanyForUser(user);

  if (!company) {
    return sendError(
      res,
      "Company not found",
      404
    );
  }

  company.patriotism =
    cleanNumber(
      getParam(req, "patriotism"),
      company.patriotism
    );

  saveDatabase(db);

  return sendSuccess(res, {
    patriotism:
      company.patriotism
  });
}

/* =========================================================
   RESOURCE / TIME
   ========================================================= */

function getServerTime(req, res) {
  return sendSuccess(res, {
    serverTime: now(),
    timestamp: now()
  });
}

/* =========================================================
   RANKINGS
   ========================================================= */

function getRankings(req, res) {
  const rankings =
    db.companies
      .map((c) => ({
        id: c.id,
        company_id: c.id,
        name: c.name,
        country: c.country,
        level: c.level,
        xp: c.xp,
        money: c.money,
        net_worth: c.net_worth,
        ownerId: c.ownerId
      }))
      .sort(
        (a, b) =>
          b.net_worth -
          a.net_worth
      );

  return sendSuccess(res, {
    rankings,
    companies: rankings
  });
}

/* =========================================================
   OPERATION ROUTER
   ========================================================= */

async function operationRouter(req, res) {
  const operation = getOperation(req);

  console.log(
    `[${new Date().toISOString()}]`,
    req.method,
    req.path,
    operation
  );

  switch (operation) {
    case "RegisterUser":
      return registerUser(req, res);

    case "Login":
    case "login":
      return loginUser(req, res);

    case "getUserData":
      return getUserData(req, res);

    case "updateUserData":
      return updateUserData(req, res);

    case "UpdateUserName":
      return updateUserName(req, res);

    case "UpdateUserLocation":
      return updateUserLocation(req, res);

    case "getRelevantCompanies":
      return getRelevantCompanies(req, res);

    case "getSameLevelCompanies":
      return getSameLevelCompanies(req, res);

    case "getCompanyByCountryAndLevel":
      return getCompanyByCountryAndLevel(
        req,
        res
      );

    case "getRunningContracts":
      return getRunningContracts(req, res);

    case "getContractsStatus":
      return getContractsStatus(req, res);

    case "getCountryData":
      return getCountryData(req, res);

    case "getConcessionsTrends":
      return getConcessionsTrends(req, res);

    case "getAlliancesByCountry":
      return getAlliancesByCountry(
        req,
        res
      );

    case "getAlliancesRankings":
      return getAlliancesRankings(
        req,
        res
      );

    case "getAllianceDetails":
      return getAllianceDetails(
        req,
        res
      );

    case "createAlliance":
      return createAlliance(req, res);

    case "joinAlliance":
      return joinAlliance(req, res);

    case "leaveAlliance":
      return leaveAlliance(req, res);

    case "sendMessageToAlliance":
      return sendAllianceMessage(
        req,
        res
      );

    case "getAllianceMessages":
      return getAllianceMessages(
        req,
        res
      );

    case "fetcChatMessages":
      return getAllianceMessages(
        req,
        res
      );

    case "fetcCountryChatMessages":
      return getCountryMessages(
        req,
        res
      );

    case "insertToChatMessages":
      return sendAllianceMessage(
        req,
        res
      );

    case "insertToCountryChatMessages":
      return sendCountryMessage(
        req,
        res
      );

    case "getUserArmy":
      return getUserArmy(req, res);

    case "updateArmy":
      return updateArmy(req, res);

    case "ArmyAttack":
      return armyAttack(req, res);

    case "postBid":
      return postBid(req, res);

    case "getBidRanking":
      return getBidRanking(req, res);

    case "postDonation":
      return postDonation(req, res);

    case "postResolution":
      return postResolution(req, res);

    case "voteOnResolution":
      return voteOnResolution(
        req,
        res
      );

    case "getActiveResolutions":
      return getActiveResolutions(
        req,
        res
      );

    case "getWarsByCountry":
      return getWarsByCountry(
        req,
        res
      );

    case "updateCompanyPatriotsm":
    case "updateCompanyPatriotism":
      return updateCompanyPatriotism(
        req,
        res
      );

    case "getServerTime":
    case "RequestServerTime":
      return getServerTime(req, res);

    case "getResourcePrices":
      return sendSuccess(res, {
        resources: {}
      });

    case "getConcessionPrices":
      return sendSuccess(res, {
        concessions: {}
      });

    default:
      return sendError(
        res,
        `Unknown operation: ${operation || "none"}`
      );
  }
}

/* =========================================================
   APK NATIVE API
   ========================================================= */

/*
   The original APK constructs:

   https://SERVER:443/RestSimulator

   and sends Operation=... as a GET RequestParam.

   These routes are therefore intentionally kept separate
   from /api.
*/

app.get("/RestSimulator", operationRouter);
app.post("/RestSimulator", operationRouter);

app.get("/RestSimulator/", operationRouter);
app.post("/RestSimulator/", operationRouter);

/*
   Some APK resources are constructed as:

   /RestSimulator/wars
   /RestSimulator/ceos
   /RestSimulator/company_update/
   /RestSimulator/allianceBattle/status
   etc.

   Route them through the same compatibility router.
*/

app.get(
  "/RestSimulator/*",
  operationRouter
);

app.post(
  "/RestSimulator/*",
  operationRouter
);

/* =========================================================
   NORMAL REST API
   ========================================================= */

app.post(
  "/api/auth/register",
  registerUser
);

app.get(
  "/api/auth/register",
  registerUser
);

app.post(
  "/api/auth/login",
  loginUser
);

app.get(
  "/api/auth/login",
  loginUser
);

app.get(
  "/api/player/me",
  getUserData
);

app.get(
  "/api/player",
  getUserData
);

app.get(
  "/api/company",
  getUserData
);

app.post(
  "/api/company",
  getUserData
);

app.post(
  "/api/business/buy",
  buyBusiness
);

app.get(
  "/api/business/buy",
  buyBusiness
);

app.post(
  "/api/business/sell",
  sellBusiness
);

app.get(
  "/api/business/sell",
  sellBusiness
);

app.post(
  "/api/business/upgrade",
  upgradeBusiness
);

app.get(
  "/api/business/upgrade",
  upgradeBusiness
);

app.post(
  "/api/transport/buy",
  buyTransport
);

app.get(
  "/api/transport/buy",
  buyTransport
);

app.post(
  "/api/transport/sell",
  sellTransport
);

app.get(
  "/api/transport/sell",
  sellTransport
);

app.get(
  "/api/income/collect",
  collectIncome
);

app.post(
  "/api/income/collect",
  collectIncome
);

app.post(
  "/api/concession/buy",
  buyConcession
);

app.get(
  "/api/concession/buy",
  buyConcession
);

app.post(
  "/api/subsidiary/buy",
  buySubsidiary
);

app.get(
  "/api/subsidiary/buy",
  buySubsidiary
);

app.get(
  "/api/rankings",
  getRankings
);

app.get(
  "/api/contracts",
  getRunningContracts
);

app.get(
  "/api/chat",
  getAllianceMessages
);

app.post(
  "/api/chat",
  sendAllianceMessage
);

/* =========================================================
   HEALTH / ROOT
   ========================================================= */

app.get("/health", (req, res) => {
  res.json({
    success: true,
    status: "online",
    service: "Entrepreneur Company Manager Server",
    version: "2.0.0",
    time: now()
  });
});

/*
   IMPORTANT:
   Operation requests to / are handled before the normal
   root response.
*/

app.get("/", (req, res, next) => {
  if (getOperation(req)) {
    return operationRouter(req, res);
  }

  return res.json({
    success: true,
    status: "online",
    service: "Entrepreneur Company Manager Server",
    version: "2.0.0",

    endpoints: {
      health: "/health",
      apk: "/RestSimulator",
      api: "/api"
    }
  });
});

app.post("/", (req, res, next) => {
  if (getOperation(req)) {
    return operationRouter(req, res);
  }

  return res.json({
    success: true,
    status: "online"
  });
});

/* =========================================================
   ERROR HANDLER
   ========================================================= */

app.use((err, req, res, next) => {
  console.error("SERVER ERROR:", err);

  if (res.headersSent) {
    return next(err);
  }

  return res.status(500).json({
    success: false,
    error: "Internal server error"
  });
});

/* =========================================================
   START SERVER
   ========================================================= */

app.listen(PORT, HOST, () => {
  console.log(
    `Entrepreneur server running on http://${HOST}:${PORT}`
  );

  console.log(
    `APK endpoint: /RestSimulator`
  );

  console.log(
    `Health endpoint: /health`
  );
});
