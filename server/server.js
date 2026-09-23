const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();

const PORT = Number(process.env.PORT || 8080);
const JWT_SECRET =
  process.env.JWT_SECRET || "CHANGE_THIS_SECRET";
const DATA_FILE =
  process.env.DATA_FILE || path.join(__dirname, "data.json");

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

/* =========================================================
   DATABASE
   ========================================================= */

const EMPTY_DB = {
  version: 1,
  users: {},
  companies: {},
  contracts: {},
  alliances: {},
  messages: [],
  countryMessages: {},
  bids: [],
  donations: [],
  resolutions: [],
  wars: [],
  armies: {},
  properties: {},
  serverTime: Date.now()
};

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function loadDatabase() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      return clone(EMPTY_DB);
    }

    const data = JSON.parse(
      fs.readFileSync(DATA_FILE, "utf8")
    );

    return {
      ...clone(EMPTY_DB),
      ...data,
      users: data.users || {},
      companies: data.companies || {},
      contracts: data.contracts || {},
      alliances: data.alliances || {},
      messages: data.messages || [],
      countryMessages: data.countryMessages || {},
      bids: data.bids || [],
      donations: data.donations || [],
      resolutions: data.resolutions || [],
      wars: data.wars || [],
      armies: data.armies || {},
      properties: data.properties || {}
    };
  } catch (err) {
    console.error(
      "Database loading error:",
      err.message
    );

    return clone(EMPTY_DB);
  }
}

let db = loadDatabase();

let saveTimeout = null;

function saveDatabase() {
  clearTimeout(saveTimeout);

  saveTimeout = setTimeout(() => {
    try {
      const temporaryFile =
        DATA_FILE + ".tmp";

      fs.writeFileSync(
        temporaryFile,
        JSON.stringify(db, null, 2),
        "utf8"
      );

      fs.renameSync(
        temporaryFile,
        DATA_FILE
      );
    } catch (err) {
      console.error(
        "Database save error:",
        err.message
      );
    }
  }, 200);
}

setInterval(() => {
  saveDatabase();
}, 30000);

/* =========================================================
   HELPERS
   ========================================================= */

function id(prefix) {
  return (
    prefix +
    "_" +
    crypto.randomBytes(8).toString("hex")
  );
}

function now() {
  return Date.now();
}

function number(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n)
    ? n
    : fallback;
}

function string(value, fallback = "") {
  if (
    value === undefined ||
    value === null
  ) {
    return fallback;
  }

  return String(value);
}

function getOperation(req) {
  return string(
    req.query.Operation ||
      req.query.operation ||
      req.body.Operation ||
      req.body.operation ||
      ""
  ).trim();
}

function allParams(req) {
  return {
    ...req.query,
    ...req.body
  };
}

/* =========================================================
   GAME CATALOG
   ========================================================= */

const BUSINESSES = {
  restaurant: {
    name: "Restaurant",
    price: 10000,
    income: 500,
    cycle: 3600
  },

  grocery: {
    name: "Grocery Store",
    price: 25000,
    income: 1200,
    cycle: 3600
  },

  factory: {
    name: "Factory",
    price: 100000,
    income: 6000,
    cycle: 7200
  },

  mall: {
    name: "Mall",
    price: 500000,
    income: 30000,
    cycle: 10800
  },

  bar: {
    name: "Bar",
    price: 75000,
    income: 3500,
    cycle: 5400
  }
};

const TRANSPORTS = {
  taxi: {
    name: "Taxi",
    price: 15000,
    income: 750,
    cycle: 3600
  },

  bus: {
    name: "Bus",
    price: 75000,
    income: 4000,
    cycle: 5400
  },

  truck: {
    name: "Truck",
    price: 200000,
    income: 12000,
    cycle: 7200
  },

  cargo_ship: {
    name: "Cargo Ship",
    price: 1500000,
    income: 95000,
    cycle: 21600
  },

  airplane: {
    name: "Cargo Airplane",
    price: 5000000,
    income: 350000,
    cycle: 43200
  }
};

const CONCESSIONS = {
  basic: {
    name: "Basic Concession",
    price: 250000,
    multiplier: 1.10
  },

  premium: {
    name: "Premium Concession",
    price: 1000000,
    multiplier: 1.25
  },

  elite: {
    name: "Elite Concession",
    price: 5000000,
    multiplier: 1.50
  }
};

const SUBSIDIARIES = {
  local: {
    name: "Local Subsidiary",
    price: 1000000,
    multiplier: 1.20
  },

  regional: {
    name: "Regional Subsidiary",
    price: 5000000,
    multiplier: 1.50
  },

  global: {
    name: "Global Subsidiary",
    price: 25000000,
    multiplier: 2.00
  }
};

/* =========================================================
   USER / COMPANY
   ========================================================= */

function getUser(userId) {
  if (!userId) return null;

  return (
    db.users[userId] ||
    Object.values(db.users).find(
      u =>
        String(u.id) ===
        String(userId)
    ) ||
    null
  );
}

function getCompany(userId) {
  if (!userId) return null;

  return (
    db.companies[userId] ||
    Object.values(db.companies).find(
      c =>
        String(c.ownerId) ===
        String(userId)
    ) ||
    null
  );
}

function publicUser(user) {
  if (!user) return null;

  const result = {
    ...user
  };

  delete result.passwordHash;

  return result;
}

function createCompany(user) {
  const company = {
    id: id("company"),
    ownerId: user.id,

    company_id: id("companyid"),

    name:
      user.username +
      " Company",

    country:
      user.country || "India",

    level: 1,
    xp: 0,

    money: 100000,

    totalIncome: 0,

    businesses: {},
    transports: {},

    concessions: {},
    subsidiaries: {},

    concession: null,
    subsidiary: null,

    contractsCompleted: 0,

    allianceId: null,

    patriotism: 0,

    location: {
      latitude: 0,
      longitude: 0
    },

    lastIncomeAt: now(),
    createdAt: now()
  };

  db.companies[user.id] =
    company;

  return company;
}

/* =========================================================
   INCOME SYSTEM
   ========================================================= */

function calculateIncome(
  company,
  elapsedSeconds
) {
  let income = 0;

  for (
    const type in company.businesses
  ) {
    const owned =
      company.businesses[type];

    const item =
      BUSINESSES[type];

    if (!item || !owned)
      continue;

    const cycles =
      Math.floor(
        elapsedSeconds /
          item.cycle
      );

    const level =
      owned.level || 1;

    const multiplier =
      1 +
      (level - 1) *
        0.10;

    income +=
      cycles *
      item.income *
      owned.quantity *
      multiplier;
  }

  for (
    const type in company.transports
  ) {
    const owned =
      company.transports[type];

    const item =
      TRANSPORTS[type];

    if (!item || !owned)
      continue;

    const cycles =
      Math.floor(
        elapsedSeconds /
          item.cycle
      );

    income +=
      cycles *
      item.income *
      owned.quantity;
  }

  if (
    company.concession &&
    CONCESSIONS[
      company.concession
    ]
  ) {
    income *=
      CONCESSIONS[
        company.concession
      ].multiplier;
  }

  if (
    company.subsidiary &&
    SUBSIDIARIES[
      company.subsidiary
    ]
  ) {
    income *=
      SUBSIDIARIES[
        company.subsidiary
      ].multiplier;
  }

  return Math.floor(income);
}

function collectIncome(company) {
  const current =
    now();

  const last =
    company.lastIncomeAt ||
    current;

  let seconds =
    Math.floor(
      (current - last) /
        1000
    );

  const maximum =
    7 *
    24 *
    60 *
    60;

  seconds =
    Math.max(
      0,
      Math.min(
        seconds,
        maximum
      )
    );

  const income =
    calculateIncome(
      company,
      seconds
    );

  if (income > 0) {
    company.money +=
      income;

    company.totalIncome +=
      income;

    company.xp +=
      Math.floor(
        income / 100
      );
  }

  company.lastIncomeAt =
    current;

  return income;
}

function netWorth(company) {
  let value =
    number(
      company.money
    );

  for (
    const type in company.businesses
  ) {
    const owned =
      company.businesses[type];

    const item =
      BUSINESSES[type];

    if (item) {
      value +=
        item.price *
        owned.quantity;
    }
  }

  for (
    const type in company.transports
  ) {
    const owned =
      company.transports[type];

    const item =
      TRANSPORTS[type];

    if (item) {
      value +=
        item.price *
        owned.quantity;
    }
  }

  return Math.floor(value);
}

/* =========================================================
   JWT
   ========================================================= */

function makeToken(userId) {
  return jwt.sign(
    {
      userId
    },
    JWT_SECRET,
    {
      expiresIn: "30d"
    }
  );
}

function authenticatedUser(req) {
  const auth =
    req.headers.authorization ||
    "";

  if (
    auth.startsWith("Bearer ")
  ) {
    try {
      const token =
        auth.substring(7);

      const decoded =
        jwt.verify(
          token,
          JWT_SECRET
        );

      return getUser(
        decoded.userId
      );
    } catch {}
  }

  const params =
    allParams(req);

  return getUser(
    params.user_id ||
      params.userId ||
      params.userid
  );
}

/* =========================================================
   HEALTH
   ========================================================= */

app.get(
  "/",
  (req, res) => {
    res.json({
      status: "online",
      server:
        "Entrepreneur Private Multiplayer Server",
      version: "2.0.0",
      players:
        Object.keys(
          db.users
        ).length,
      companies:
        Object.keys(
          db.companies
        ).length,
      timestamp:
        new Date().toISOString()
    });
  }
);

app.get(
  "/health",
  (req, res) => {
    res.json({
      ok: true,
      status: "online",
      players:
        Object.keys(
          db.users
        ).length,
      companies:
        Object.keys(
          db.companies
        ).length,
      uptime:
        process.uptime(),
      timestamp:
        new Date().toISOString()
    });
  }
);

/* =========================================================
   CATALOG
   ========================================================= */

app.get(
  "/api/catalog",
  (req, res) => {
    res.json({
      businesses:
        BUSINESSES,

      transports:
        TRANSPORTS,

      concessions:
        CONCESSIONS,

      subsidiaries:
        SUBSIDIARIES
    });
  }
);

/* =========================================================
   REGISTER USER
   ========================================================= */

async function registerUser(
  req,
  res
) {
  const p =
    allParams(req);

  const username =
    string(
      p.username ||
        p.user_name ||
        p.name
    ).trim();

  const password =
    string(
      p.password ||
        p.pass
    );

  const email =
    string(
      p.email
    ).trim();

  const country =
    string(
      p.country ||
        p.country_name,
      "India"
    ).trim();

  if (
    username.length < 3
  ) {
    return res.status(400).json({
      success: false,
      error:
        "Invalid username"
    });
  }

  if (
    password.length < 4
  ) {
    return res.status(400).json({
      success: false,
      error:
        "Invalid password"
    });
  }

  const existing =
    Object.values(
      db.users
    ).find(
      user =>
        user.username.toLowerCase() ===
        username.toLowerCase()
    );

  if (existing) {
    return res.json({
      success: false,
      error:
        "Username already exists"
    });
  }

  const userId =
    id("user");

  const passwordHash =
    await bcrypt.hash(
      password,
      10
    );

  const user = {
    id: userId,

    user_id: userId,

    username,

    user_name:
      username,

    email,

    country,

    passwordHash,

    goldCoins: 0,

    gold_coins: 0,

    createdAt:
      now(),

    lastLoginAt:
      now()
  };

  db.users[userId] =
    user;

  const company =
    createCompany(user);

  saveDatabase();

  return res.json({
    success: true,

    status: "success",

    token:
      makeToken(userId),

    user:
      publicUser(user),

    userData:
      publicUser(user),

    company
  });
}

/* =========================================================
   LOGIN
   ========================================================= */

async function loginUser(
  req,
  res
) {
  const p =
    allParams(req);

  const username =
    string(
      p.username ||
        p.user_name ||
        p.email
    ).trim();

  const password =
    string(
      p.password ||
        p.pass
    );

  const user =
    Object.values(
      db.users
    ).find(
      u =>
        u.username.toLowerCase() ===
        username.toLowerCase() ||
        (
          u.email &&
          u.email.toLowerCase() ===
          username.toLowerCase()
        )
    );

  if (!user) {
    return res.status(401).json({
      success: false,
      error:
        "Invalid username or password"
    });
  }

  const valid =
    await bcrypt.compare(
      password,
      user.passwordHash
    );

  if (!valid) {
    return res.status(401).json({
      success: false,
      error:
        "Invalid username or password"
    });
  }

  user.lastLoginAt =
    now();

  let company =
    getCompany(user.id);

  if (!company) {
    company =
      createCompany(user);
  }

  collectIncome(company);

  saveDatabase();

  return res.json({
    success: true,

    status: "success",

    token:
      makeToken(user.id),

    user:
      publicUser(user),

    userData:
      publicUser(user),

    company
  });
}

/* =========================================================
   USER DATA
   ========================================================= */

function sendUserData(
  req,
  res
) {
  const user =
    authenticatedUser(req);

  if (!user) {
    return res.json({
      success: false,
      error:
        "User not found"
    });
  }

  let company =
    getCompany(user.id);

  if (!company) {
    company =
      createCompany(user);
  }

  collectIncome(company);

  saveDatabase();

  return res.json({
    success: true,

    user:
      publicUser(user),

    userData:
      publicUser(user),

    company,

    money:
      company.money,

    level:
      company.level,

    xp:
      company.xp
  });
}

/* =========================================================
   UPDATE USER DATA
   ========================================================= */

function updateUserData(
  req,
  res
) {
  const user =
    authenticatedUser(req);

  if (!user) {
    return res.json({
      success: false,
      error:
        "User not found"
    });
  }

  const p =
    allParams(req);

  if (
    p.username ||
    p.user_name
  ) {
    user.username =
      string(
        p.username ||
          p.user_name
      );
  }

  if (
    p.country
  ) {
    user.country =
      string(
        p.country
      );
  }

  if (
    p.email
  ) {
    user.email =
      string(
        p.email
      );
  }

  saveDatabase();

  return res.json({
    success: true,

    user:
      publicUser(user),

    userData:
      publicUser(user)
  });
}

/* =========================================================
   COMPANY DATA
   ========================================================= */

function companyData(
  req,
  res
) {
  const user =
    authenticatedUser(req);

  if (!user) {
    return res.json({
      success: false,
      error:
        "User not found"
    });
  }

  let company =
    getCompany(user.id);

  if (!company) {
    company =
      createCompany(user);
  }

  collectIncome(company);

  saveDatabase();

  res.json({
    success: true,
    company
  });
}

/* =========================================================
   COMPANY LIST
   ========================================================= */

function relevantCompanies(
  req,
  res
) {
  const companies =
    Object.values(
      db.companies
    ).map(company => {
      collectIncome(
        company
      );

      const owner =
        getUser(
          company.ownerId
        );

      return {
        ...company,

        ownerName:
          owner
            ? owner.username
            : "Unknown",

        netWorth:
          netWorth(company)
      };
    });

  companies.sort(
    (a, b) =>
      b.netWorth -
      a.netWorth
  );

  saveDatabase();

  res.json({
    success: true,

    companies:
      companies.slice(
        0,
        100
      ),

    data:
      companies.slice(
        0,
        100
      )
  });
}

/* =========================================================
   BUY BUSINESS
   ========================================================= */

function buyBusiness(
  req,
  res
) {
  const user =
    authenticatedUser(req);

  if (!user) {
    return res.json({
      success: false,
      error:
        "Authentication required"
    });
  }

  const company =
    getCompany(user.id);

  if (!company) {
    return res.json({
      success: false,
      error:
        "Company not found"
    });
  }

  const p =
    allParams(req);

  const type =
    string(
      p.type ||
        p.business ||
        p.business_type
    ).toLowerCase();

  const quantity =
    Math.max(
      1,
      Math.floor(
        number(
          p.quantity ||
            p.amount ||
            1
        )
      )
    );

  const item =
    BUSINESSES[type];

  if (!item) {
    return res.json({
      success: false,
      error:
        "Unknown business"
    });
  }

  const cost =
    item.price *
    quantity;

  collectIncome(company);

  if (
    company.money <
    cost
  ) {
    return res.json({
      success: false,
      error:
        "Insufficient funds",
      required:
        cost,
      money:
        company.money
    });
  }

  company.money -=
    cost;

  if (
    !company.businesses[
      type
    ]
  ) {
    company.businesses[
      type
    ] = {
      quantity: 0,
      level: 1
    };
  }

  company.businesses[
    type
  ].quantity +=
    quantity;

  company.xp +=
    Math.floor(
      cost / 100
    );

  saveDatabase();

  res.json({
    success: true,

    operation:
      "buyBusiness",

    purchased: {
      type,
      quantity,
      cost
    },

    company
  });
}

/* =========================================================
   SELL BUSINESS
   ========================================================= */

function sellBusiness(
  req,
  res
) {
  const user =
    authenticatedUser(req);

  if (!user) {
    return res.json({
      success: false,
      error:
        "Authentication required"
    });
  }

  const company =
    getCompany(user.id);

  if (!company) {
    return res.json({
      success: false,
      error:
        "Company not found"
    });
  }

  const p =
    allParams(req);

  const type =
    string(
      p.type ||
        p.business ||
        p.business_type
    ).toLowerCase();

  const quantity =
    Math.max(
      1,
      Math.floor(
        number(
          p.quantity ||
            1
        )
      )
    );

  const owned =
    company.businesses[
      type
    ];

  const item =
    BUSINESSES[type];

  if (!item || !owned) {
    return res.json({
      success: false,
      error:
        "Business not owned"
    });
  }

  if (
    quantity >
    owned.quantity
  ) {
    return res.json({
      success: false,
      error:
        "Not enough businesses"
    });
  }

  const refund =
    Math.floor(
      item.price *
      quantity *
      0.70
    );

  owned.quantity -=
    quantity;

  company.money +=
    refund;

  if (
    owned.quantity <= 0
  ) {
    delete company.businesses[
      type
    ];
  }

  saveDatabase();

  res.json({
    success: true,

    sold: {
      type,
      quantity,
      refund
    },

    company
  });
}

/* =========================================================
   TRANSPORT
   ========================================================= */

function buyTransport(
  req,
  res
) {
  const user =
    authenticatedUser(req);

  if (!user) {
    return res.json({
      success: false,
      error:
        "Authentication required"
    });
  }

  const company =
    getCompany(user.id);

  if (!company) {
    return res.json({
      success: false,
      error:
        "Company not found"
    });
  }

  const p =
    allParams(req);

  const type =
    string(
      p.type ||
        p.transport ||
        p.transport_type
    ).toLowerCase();

  const quantity =
    Math.max(
      1,
      Math.floor(
        number(
          p.quantity ||
            1
        )
      )
    );

  const item =
    TRANSPORTS[type];

  if (!item) {
    return res.json({
      success: false,
      error:
        "Unknown transport"
    });
  }

  const cost =
    item.price *
    quantity;

  collectIncome(company);

  if (
    company.money <
    cost
  ) {
    return res.json({
      success: false,
      error:
        "Insufficient funds",
      money:
        company.money,
      required:
        cost
    });
  }

  company.money -=
    cost;

  if (
    !company.transports[
      type
    ]
  ) {
    company.transports[
      type
    ] = {
      quantity: 0
    };
  }

  company.transports[
    type
  ].quantity +=
    quantity;

  saveDatabase();

  res.json({
    success: true,

    purchased: {
      type,
      quantity,
      cost
    },

    company
  });
}

/* =========================================================
   RANKINGS
   ========================================================= */

function rankings(
  req,
  res
) {
  const result =
    Object.values(
      db.companies
    ).map(company => {
      collectIncome(
        company
      );

      const owner =
        getUser(
          company.ownerId
        );

      return {
        company_id:
          company.id,

        companyId:
          company.id,

        owner_id:
          company.ownerId,

        ownerId:
          company.ownerId,

        username:
          owner
            ? owner.username
            : "Unknown",

        company_name:
          company.name,

        companyName:
          company.name,

        country:
          company.country,

        level:
          company.level,

        money:
          company.money,

        net_worth:
          netWorth(company),

        netWorth:
          netWorth(company)
      };
    });

  result.sort(
    (a, b) =>
      b.netWorth -
      a.netWorth
  );

  result.forEach(
    (item, index) => {
      item.rank =
        index + 1;
    }
  );

  saveDatabase();

  res.json({
    success: true,

    rankings:
      result.slice(
        0,
        100
      ),

    data:
      result.slice(
        0,
        100
      )
  });
}

/* =========================================================
   CHAT
   ========================================================= */

function getChat(
  req,
  res
) {
  const p =
    allParams(req);

  const channel =
    string(
      p.channel ||
        "global"
    );

  let messages =
    db.messages.filter(
      message =>
        message.channel ===
        channel
    );

  messages =
    messages.slice(
      -100
    );

  res.json({
    success: true,
    messages,
    data: messages
  });
}

function sendChat(
  req,
  res
) {
  const user =
    authenticatedUser(req);

  if (!user) {
    return res.json({
      success: false,
      error:
        "Authentication required"
    });
  }

  const p =
    allParams(req);

  const channel =
    string(
      p.channel ||
        "global"
    );

  const message =
    string(
      p.message ||
        p.text
    ).trim();

  if (!message) {
    return res.json({
      success: false,
      error:
        "Empty message"
    });
  }

  const entry = {
    id: id("message"),

    channel,

    user_id:
      user.id,

    username:
      user.username,

    message:
      message.substring(
        0,
        500
      ),

    created_at:
      now()
  };

  db.messages.push(
    entry
  );

  if (
    db.messages.length >
    2000
  ) {
    db.messages =
      db.messages.slice(
        -2000
      );
  }

  saveDatabase();

  res.json({
    success: true,
    message: entry
  });
}

/* =========================================================
   ALLIANCES
   ========================================================= */

function createAlliance(
  req,
  res
) {
  const user =
    authenticatedUser(req);

  if (!user) {
    return res.json({
      success: false,
      error:
        "Authentication required"
    });
  }

  const company =
    getCompany(user.id);

  if (!company) {
    return res.json({
      success: false,
      error:
        "Company not found"
    });
  }

  const p =
    allParams(req);

  const name =
    string(
      p.name ||
        p.alliance_name
    ).trim();

  if (
    name.length < 2
  ) {
    return res.json({
      success: false,
      error:
        "Invalid alliance name"
    });
  }

  if (
    company.allianceId
  ) {
    return res.json({
      success: false,
      error:
        "Already in alliance"
    });
  }

  const alliance = {
    id: id("alliance"),

    alliance_id: null,

    name,

    owner_id:
      user.id,

    ownerId:
      user.id,

    country:
      user.country,

    members: [
      user.id
    ],

    member_count: 1,

    created_at:
      now()
  };

  alliance.alliance_id =
    alliance.id;

  db.alliances[
    alliance.id
  ] = alliance;

  company.allianceId =
    alliance.id;

  saveDatabase();

  res.json({
    success: true,
    alliance
  });
}

function getAlliances(
  req,
  res
) {
  const list =
    Object.values(
      db.alliances
    );

  res.json({
    success: true,

    alliances:
      list,

    data:
      list
  });
}

function joinAlliance(
  req,
  res
) {
  const user =
    authenticatedUser(req);

  if (!user) {
    return res.json({
      success: false,
      error:
        "Authentication required"
    });
  }

  const company =
    getCompany(user.id);

  const p =
    allParams(req);

  const allianceId =
    p.alliance_id ||
    p.allianceId ||
    p.id;

  const alliance =
    db.alliances[
      allianceId
    ];

  if (!alliance) {
    return res.json({
      success: false,
      error:
        "Alliance not found"
    });
  }

  if (
    company &&
    company.allianceId
  ) {
    return res.json({
      success: false,
      error:
        "Already in alliance"
    });
  }

  if (
    alliance.members
      .length >= 50
  ) {
    return res.json({
      success: false,
      error:
        "Alliance is full"
    });
  }

  alliance.members.push(
    user.id
  );

  alliance.member_count =
    alliance.members.length;

  if (company) {
    company.allianceId =
      alliance.id;
  }

  saveDatabase();

  res.json({
    success: true,
    alliance
  });
}

function leaveAlliance(
  req,
  res
) {
  const user =
    authenticatedUser(req);

  if (!user) {
    return res.json({
      success: false,
      error:
        "Authentication required"
    });
  }

  const company =
    getCompany(user.id);

  if (!company) {
    return res.json({
      success: false,
      error:
        "Company not found"
    });
  }

  const alliance =
    db.alliances[
      company.allianceId
    ];

  if (alliance) {
    alliance.members =
      alliance.members.filter(
        member =>
          member !==
          user.id
      );

    alliance.member_count =
      alliance.members.length;

    if (
      alliance.ownerId ===
      user.id &&
      alliance.members.length
    ) {
      alliance.ownerId =
        alliance.members[0];

      alliance.owner_id =
        alliance.members[0];
    }

    if (
      alliance.members.length ===
      0
    ) {
      delete db.alliances[
        alliance.id
      ];
    }
  }

  company.allianceId =
    null;

  saveDatabase();

  res.json({
    success: true
  });
}

/* =========================================================
   CONTRACTS
   ========================================================= */

function createContract(
  company
) {
  const contract = {
    id: id("contract"),

    contract_id: null,

    company_id:
      company.id,

    title:
      "Business Contract",

    reward:
      5000 +
      company.level *
        2500,

    xp:
      100,

    status:
      "running",

    created_at:
      now(),

    expires_at:
      now() +
      86400000
  };

  contract.contract_id =
    contract.id;

  db.contracts[
    contract.id
  ] = contract;

  return contract;
}

function runningContracts(
  req,
  res
) {
  const user =
    authenticatedUser(req);

  if (!user) {
    return res.json({
      success: false,
      error:
        "Authentication required"
    });
  }

  const company =
    getCompany(user.id);

  if (!company) {
    return res.json({
      success: false,
      contracts: []
    });
  }

  let contracts =
    Object.values(
      db.contracts
    ).filter(
      c =>
        c.company_id ===
          company.id &&
        c.status ===
          "running" &&
        c.expires_at >
          now()
    );

  while (
    contracts.length < 5
  ) {
    contracts.push(
      createContract(
        company
      )
    );
  }

  saveDatabase();

  res.json({
    success: true,
    contracts,
    data: contracts
  });
}

function contractStatus(
  req,
  res
) {
  const user =
    authenticatedUser(req);

  if (!user) {
    return res.json({
      success: false,
      error:
        "Authentication required"
    });
  }

  const company =
    getCompany(user.id);

  const contracts =
    Object.values(
      db.contracts
    ).filter(
      c =>
        c.company_id ===
        company?.id
    );

  res.json({
    success: true,
    contracts
  });
}

/* =========================================================
   ARMY
   ========================================================= */

function getArmy(
  req,
  res
) {
  const user =
    authenticatedUser(req);

  if (!user) {
    return res.json({
      success: false,
      error:
        "Authentication required"
    });
  }

  if (
    !db.armies[user.id]
  ) {
    db.armies[user.id] = {
      user_id:
        user.id,

      soldiers: 100,

      attack: 10,

      defense: 10,

      level: 1,

      updated_at:
        now()
    };
  }

  saveDatabase();

  res.json({
    success: true,

    army:
      db.armies[user.id],

    data:
      db.armies[user.id]
  });
}

function updateArmy(
  req,
  res
) {
  const user =
    authenticatedUser(req);

  if (!user) {
    return res.json({
      success: false,
      error:
        "Authentication required"
    });
  }

  const p =
    allParams(req);

  const army =
    db.armies[user.id] ||
    {
      user_id:
        user.id,

      soldiers: 100,

      attack: 10,

      defense: 10,

      level: 1
    };

  if (
    p.soldiers !==
    undefined
  ) {
    army.soldiers =
      Math.max(
        0,
        Math.floor(
          number(
            p.soldiers
          )
        )
      );
  }

  if (
    p.attack !==
    undefined
  ) {
    army.attack =
      Math.max(
        0,
        number(
          p.attack
        )
      );
  }

  if (
    p.defense !==
    undefined
  ) {
    army.defense =
      Math.max(
        0,
        number(
          p.defense
        )
      );
  }

  army.updated_at =
    now();

  db.armies[user.id] =
    army;

  saveDatabase();

  res.json({
    success: true,
    army
  });
}

function armyAttack(
  req,
  res
) {
  const user =
    authenticatedUser(req);

  if (!user) {
    return res.json({
      success: false,
      error:
        "Authentication required"
    });
  }

  const p =
    allParams(req);

  const targetId =
    p.target_user_id ||
    p.targetUserId ||
    p.company_id ||
    p.target_id;

  const targetCompany =
    Object.values(
      db.companies
    ).find(
      c =>
        c.id ===
        targetId ||
        c.ownerId ===
        targetId
    );

  if (!targetCompany) {
    return res.json({
      success: false,
      error:
        "Target not found"
    });
  }

  if (
    targetCompany.ownerId ===
    user.id
  ) {
    return res.json({
      success: false,
      error:
        "Cannot attack yourself"
    });
  }

  const attacker =
    db.armies[user.id] ||
    {
      soldiers: 100,
      attack: 10,
      defense: 10
    };

  const defender =
    db.armies[
      targetCompany.ownerId
    ] ||
    {
      soldiers: 100,
      attack: 10,
      defense: 10
    };

  const attackPower =
    attacker.attack *
    Math.max(
      1,
      attacker.soldiers
    );

  const defensePower =
    defender.defense *
    Math.max(
      1,
      defender.soldiers
    );

  const attackerWins =
    attackPower >
    defensePower;

  const battle = {
    id: id("battle"),

    attacker:
      user.id,

    defender:
      targetCompany.ownerId,

    attackerPower:
      attackPower,

    defenderPower:
      defensePower,

    winner:
      attackerWins
        ? user.id
        : targetCompany.ownerId,

    created_at:
      now()
  };

  if (
    attackerWins
  ) {
    targetCompany.money =
      Math.floor(
        targetCompany.money *
          0.95
      );
  }

  saveDatabase();

  res.json({
    success: true,
    battle
  });
}

/* =========================================================
   COUNTRY DATA
   ========================================================= */

function countryData(
  req,
  res
) {
  const p =
    allParams(req);

  const country =
    string(
      p.country ||
        p.country_name,
      "India"
    );

  const companies =
    Object.values(
      db.companies
    ).filter(
      c =>
        c.country ===
        country
    );

  const totalNetWorth =
    companies.reduce(
      (sum, company) =>
        sum +
        netWorth(company),
      0
    );

  res.json({
    success: true,

    country,

    companies:
      companies.length,

    totalNetWorth,

    data: {
      country,
      companies:
        companies.length,
      totalNetWorth
    }
  });
}

/* =========================================================
   GENERIC / UNKNOWN OPERATION
   ========================================================= */

function unknownOperation(
  req,
  res
) {
  const operation =
    getOperation(req);

  console.log(
    "Unknown operation:",
    operation
  );

  res.json({
    success: true,

    status:
      "operation_not_implemented",

    operation,

    data: [],

    result: [],

    message:
      "Operation received by private server"
  });
}

/* =========================================================
   OPERATION ROUTER
   ========================================================= */

/*
   The APK contains operation names such as:

   RegisterUser
   getUserData
   updateUserData
   getRelevantCompanies
   getSameLevelCompanies
   getCompanyByCountryAndLevel
   getRunningContracts
   getContractsStatus
   getConcessionsTrends
   getCountryData
   getAlliancesByCountry
   getAlliancesRankings
   getAllianceDetails
   getAllianceMessages
   createAlliance
   joinAlliance
   leaveAlliance
   sendMessageToAlliance
   fetcChatMessages
   fetcCountryChatMessages
   insertToChatMessages
   insertToCountryChatMessages
   getUserArmy
   updateArmy
   ArmyAttack
   postBid
   getBidRanking
   postDonation
   postResolution
   voteOnResolution
   getActiveResolutions
   getWarsByCountry
   updateCompanyPatriotsm
   UpdateUserLocation
   UpdateUserName
*/

async function operationRouter(
  req,
  res
) {
  const operation =
    getOperation(req);

  switch (
    operation
  ) {
    case "RegisterUser":
      return registerUser(
        req,
        res
      );

    case "Login":
    case "login":
      return loginUser(
        req,
        res
      );

    case "getUserData":
      return sendUserData(
        req,
        res
      );

    case "updateUserData":
      return updateUserData(
        req,
        res
      );

    case "UpdateUserName":
      return updateUserData(
        req,
        res
      );

    case "UpdateUserLocation":
      return updateUserData(
        req,
        res
      );

    case "getRelevantCompanies":
    case "getSameLevelCompanies":
    case "getCompanyByCountryAndLevel":
      return relevantCompanies(
        req,
        res
      );

    case "getRunningContracts":
      return runningContracts(
        req,
        res
      );

    case "getContractsStatus":
      return contractStatus(
        req,
        res
      );

    case "getCountryData":
      return countryData(
        req,
        res
      );

    case "getAlliancesByCountry":
    case "getAlliancesRankings":
      return getAlliances(
        req,
        res
      );

    case "createAlliance":
      return createAlliance(
        req,
        res
      );

    case "joinAlliance":
      return joinAlliance(
        req,
        res
      );

    case "leaveAlliance":
    case "removeFromAlliance":
      return leaveAlliance(
        req,
        res
      );

    case "getAllianceDetails":
      return getAlliances(
        req,
        res
      );

    case "getAllianceMessages":
    case "fetcChatMessages":
    case "fetcCountryChatMessages":
      return getChat(
        req,
        res
      );

    case "sendMessageToAlliance":
    case "insertToChatMessages":
    case "insertToCountryChatMessages":
      return sendChat(
        req,
        res
      );

    case "getUserArmy":
      return getArmy(
        req,
        res
      );

    case "updateArmy":
      return updateArmy(
        req,
        res
      );

    case "ArmyAttack":
      return armyAttack(
        req,
        res
      );

    case "getBidRanking":
      return res.json({
        success: true,
        bids:
          db.bids
      });

    case "postBid":
      db.bids.push({
        id: id("bid"),
        ...allParams(req),
        created_at:
          now()
      });

      saveDatabase();

      return res.json({
        success: true,
        bids:
          db.bids
      });

    case "postDonation":
      db.donations.push({
        id: id("donation"),
        ...allParams(req),
        created_at:
          now()
      });

      saveDatabase();

      return res.json({
        success: true
      });

    case "getActiveResolutions":
      return res.json({
        success: true,
        resolutions:
          db.resolutions
      });

    case "postResolution":
      db.resolutions.push({
        id: id("resolution"),
        ...allParams(req),
        votes: {},
        created_at:
          now()
      });

      saveDatabase();

      return res.json({
        success: true,
        resolutions:
          db.resolutions
      });

    case "voteOnResolution": {
      const p =
        allParams(req);

      const resolution =
        db.resolutions.find(
          r =>
            r.id ===
            (
              p.resolution_id ||
              p.resolutionId
            )
        );

      const user =
        authenticatedUser(req);

      if (
        resolution &&
        user
      ) {
        resolution.votes[
          user.id
        ] =
          p.vote ||
          "yes";

        saveDatabase();
      }

      return res.json({
        success: true,
        resolution
      });
    }

    case "getWarsByCountry":
      return res.json({
        success: true,
        wars:
          db.wars
      });

    case "updateCompanyPatriotsm": {
      const user =
        authenticatedUser(req);

      const company =
        user
          ? getCompany(
              user.id
            )
          : null;

      if (company) {
        company.patriotism =
          number(
            allParams(req)
              .patriotism,
            company.patriotism
          );

        saveDatabase();
      }

      return res.json({
        success: true,
        company
      });
    }

    case "getConcessionsTrends":
      return res.json({
        success: true,
        concessions:
          CONCESSIONS
      });

    case "GetResourcesPrices":
    case "fetchProductsPrices":
      return res.json({
        success: true,

        businesses:
          BUSINESSES,

        transports:
          TRANSPORTS,

        concessions:
          CONCESSIONS,

        subsidiaries:
          SUBSIDIARIES
      });

    case "getPropertiesMeta":
      return res.json({
        success: true,
        properties:
          db.properties
      });

    case "getUpdates":
    case "checkForBackup":
    case "checkForConfigurationUpdate":
      return res.json({
        success: true,
        update: false,
        data: []
      });

    case "recordTimeMani":
      return res.json({
        success: true,
        serverTime:
          now()
      });

    default:
      return unknownOperation(
        req,
        res
      );
  }
}

/* =========================================================
   OPERATION ENDPOINTS
   ========================================================= */

/*
   The APK may call the backend using either GET
   or POST, so both are supported.
*/

app.get(
  "/",
  async (req, res, next) => {
    if (
      getOperation(req)
    ) {
      return operationRouter(
        req,
        res
      );
    }

    next();
  }
);

app.get(
  "/api",
  async (req, res) => {
    if (
      getOperation(req)
    ) {
      return operationRouter(
        req,
        res
      );
    }

    res.json({
      status: "online"
    });
  }
);

app.post(
  "/",
  async (req, res) => {
    return operationRouter(
      req,
      res
    );
  }
);

app.post(
  "/api",
  async (req, res) => {
    return operationRouter(
      req,
      res
    );
  }
);

/* =========================================================
   OUR REST API
   ========================================================= */

app.post(
  "/api/auth/register",
  registerUser
);

app.post(
  "/api/auth/login",
  loginUser
);

app.get(
  "/api/player/me",
  sendUserData
);

app.get(
  "/api/company",
  companyData
);

app.post(
  "/api/business/buy",
  buyBusiness
);

app.post(
  "/api/business/sell",
  sellBusiness
);

app.post(
  "/api/transport/buy",
  buyTransport
);

app.get(
  "/api/rankings",
  rankings
);

app.get(
  "/api/chat/:channel",
  getChat
);

app.post(
  "/api/chat/:channel",
  (req, res) => {
    req.body.channel =
      req.params.channel;

    return sendChat(
      req,
      res
    );
  }
);

/* =========================================================
   ADMIN RESET
   ========================================================= */

app.post(
  "/api/admin/reset",
  (req, res) => {
    const key =
      req.headers[
        "x-admin-key"
      ];

    if (
      !process.env.ADMIN_KEY ||
      key !==
        process.env.ADMIN_KEY
    ) {
      return res.status(403).json({
        success: false,
        error:
          "Unauthorized"
      });
    }

    db =
      clone(
        EMPTY_DB
      );

    saveDatabase();

    res.json({
      success: true
    });
  }
);

/* =========================================================
   404
   ========================================================= */

app.use(
  (req, res) => {
    res.status(404).json({
      success: false,
      error:
        "Endpoint not found",
      path:
        req.originalUrl
    });
  }
);

/* =========================================================
   ERROR HANDLER
   ========================================================= */

app.use(
  (
    error,
    req,
    res,
    next
  ) => {
    console.error(
      "Unhandled server error:",
      error
    );

    res.status(500).json({
      success: false,
      error:
        "Internal server error"
    });
  }
);

/* =========================================================
   START
   ========================================================= */

app.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      "======================================"
    );

    console.log(
      "ENTREPRENEUR PRIVATE SERVER"
    );

    console.log(
      "======================================"
    );

    console.log(
      `Port: ${PORT}`
    );

    console.log(
      `Database: ${DATA_FILE}`
    );

    console.log(
      "Server is ONLINE"
    );

    console.log(
      "======================================"
    );
  }
);
