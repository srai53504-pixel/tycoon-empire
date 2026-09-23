const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();

/* =========================================================
   CONFIGURATION
   ========================================================= */

const PORT = Number(process.env.PORT || 8080);

const JWT_SECRET =
  process.env.JWT_SECRET ||
  "CHANGE_THIS_TO_A_LONG_RANDOM_SECRET";

const DATA_FILE =
  process.env.DATA_FILE ||
  path.join(__dirname, "data.json");

app.use(cors());
app.use(express.json({ limit: "1mb" }));

/* =========================================================
   DATABASE
   ========================================================= */

const emptyDatabase = {
  version: 1,
  users: {},
  companies: {},
  contracts: {},
  alliances: {},
  messages: []
};

function loadDatabase() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      return JSON.parse(JSON.stringify(emptyDatabase));
    }

    const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));

    return {
      ...emptyDatabase,
      ...data,
      users: data.users || {},
      companies: data.companies || {},
      contracts: data.contracts || {},
      alliances: data.alliances || {},
      messages: data.messages || []
    };
  } catch (error) {
    console.error("Database load error:", error.message);
    return JSON.parse(JSON.stringify(emptyDatabase));
  }
}

let db = loadDatabase();

function saveDatabase() {
  try {
    const tempFile = DATA_FILE + ".tmp";

    fs.writeFileSync(
      tempFile,
      JSON.stringify(db, null, 2),
      "utf8"
    );

    fs.renameSync(tempFile, DATA_FILE);
  } catch (error) {
    console.error("Database save error:", error.message);
  }
}

/* Save every 30 seconds */

setInterval(() => {
  saveDatabase();
}, 30000);

/* =========================================================
   HELPERS
   ========================================================= */

function createId(prefix) {
  return (
    prefix +
    "_" +
    crypto.randomBytes(8).toString("hex")
  );
}

function currentTime() {
  return Date.now();
}

function safeUser(user) {
  if (!user) return null;

  return {
    id: user.id,
    username: user.username,
    country: user.country,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt
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
    cycle: 3600,
    maxLevel: 20
  },

  grocery: {
    name: "Grocery Store",
    price: 25000,
    income: 1200,
    cycle: 3600,
    maxLevel: 20
  },

  factory: {
    name: "Factory",
    price: 100000,
    income: 6000,
    cycle: 7200,
    maxLevel: 20
  },

  mall: {
    name: "Mall",
    price: 500000,
    income: 30000,
    cycle: 10800,
    maxLevel: 20
  },

  bar: {
    name: "Bar",
    price: 75000,
    income: 3500,
    cycle: 5400,
    maxLevel: 20
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
   LEVEL SYSTEM
   ========================================================= */

function xpRequired(level) {
  return Math.floor(
    1000 * Math.pow(level, 1.65)
  );
}

function updateLevel(company) {
  while (
    company.level < 20 &&
    company.xp >= xpRequired(company.level + 1)
  ) {
    company.level++;
  }
}

/* =========================================================
   COMPANY ECONOMY
   ========================================================= */

function calculateIncome(company, seconds) {
  let income = 0;

  for (const type in company.businesses) {
    const owned = company.businesses[type];
    const item = BUSINESSES[type];

    if (!item || !owned) continue;

    const cycles = Math.floor(
      seconds / item.cycle
    );

    const levelMultiplier =
      1 + ((owned.level || 1) - 1) * 0.10;

    income +=
      cycles *
      item.income *
      owned.quantity *
      levelMultiplier;
  }

  for (const type in company.transports) {
    const owned = company.transports[type];
    const item = TRANSPORTS[type];

    if (!item || !owned) continue;

    const cycles = Math.floor(
      seconds / item.cycle
    );

    income +=
      cycles *
      item.income *
      owned.quantity;
  }

  if (company.concession) {
    const concession =
      CONCESSIONS[company.concession];

    if (concession) {
      income *= concession.multiplier;
    }
  }

  if (company.subsidiary) {
    const subsidiary =
      SUBSIDIARIES[company.subsidiary];

    if (subsidiary) {
      income *= subsidiary.multiplier;
    }
  }

  return Math.floor(income);
}

function collectIncome(company) {
  const now = currentTime();

  const last =
    company.lastIncomeAt || now;

  let elapsed =
    Math.floor((now - last) / 1000);

  /* Maximum seven days of offline income */

  const maximum =
    7 * 24 * 60 * 60;

  elapsed = Math.min(
    Math.max(elapsed, 0),
    maximum
  );

  const income =
    calculateIncome(company, elapsed);

  if (income > 0) {
    company.money += income;
    company.totalIncome += income;
    company.xp += Math.floor(income / 100);

    updateLevel(company);
  }

  company.lastIncomeAt = now;

  return income;
}

function calculateNetWorth(company) {
  let value = company.money;

  for (const type in company.businesses) {
    const owned = company.businesses[type];
    const item = BUSINESSES[type];

    if (item) {
      value +=
        item.price *
        owned.quantity;
    }
  }

  for (const type in company.transports) {
    const owned = company.transports[type];
    const item = TRANSPORTS[type];

    if (item) {
      value +=
        item.price *
        owned.quantity;
    }
  }

  return Math.floor(value);
}

function publicCompany(company) {
  if (!company) return null;

  collectIncome(company);

  return {
    id: company.id,
    ownerId: company.ownerId,
    name: company.name,
    country: company.country,

    level: company.level,
    xp: company.xp,

    money: company.money,
    totalIncome: company.totalIncome,

    netWorth:
      calculateNetWorth(company),

    businesses:
      company.businesses,

    transports:
      company.transports,

    concession:
      company.concession,

    subsidiary:
      company.subsidiary,

    contractsCompleted:
      company.contractsCompleted,

    allianceId:
      company.allianceId,

    createdAt:
      company.createdAt
  };
}

/* =========================================================
   AUTHENTICATION
   ========================================================= */

function createToken(userId) {
  return jwt.sign(
    { userId },
    JWT_SECRET,
    {
      expiresIn: "30d"
    }
  );
}

function authenticate(req, res, next) {
  try {
    const header =
      req.headers.authorization || "";

    if (!header.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Authentication required"
      });
    }

    const token =
      header.substring(7);

    const decoded =
      jwt.verify(token, JWT_SECRET);

    const user =
      db.users[decoded.userId];

    if (!user) {
      return res.status(401).json({
        error: "User not found"
      });
    }

    req.user = user;

    next();
  } catch (error) {
    return res.status(401).json({
      error: "Invalid or expired token"
    });
  }
}

function companyRequired(req, res, next) {
  const company =
    db.companies[req.user.id];

  if (!company) {
    return res.status(404).json({
      error: "Company not created"
    });
  }

  collectIncome(company);

  req.company = company;

  next();
}

/* =========================================================
   HEALTH
   ========================================================= */

app.get("/", (req, res) => {
  res.json({
    name: "Entrepreneur Private Multiplayer Server",
    status: "online",
    version: "1.0.0",
    timestamp: new Date().toISOString()
  });
});

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    status: "online",
    uptime: process.uptime(),
    players: Object.keys(db.users).length,
    companies: Object.keys(db.companies).length,
    timestamp: new Date().toISOString()
  });
});

/* =========================================================
   CATALOG
   ========================================================= */

app.get("/api/catalog", (req, res) => {
  res.json({
    businesses: BUSINESSES,
    transports: TRANSPORTS,
    concessions: CONCESSIONS,
    subsidiaries: SUBSIDIARIES
  });
});

/* =========================================================
   REGISTER
   ========================================================= */

app.post("/api/auth/register", async (req, res) => {
  try {
    const username =
      String(req.body.username || "")
        .trim();

    const password =
      String(req.body.password || "");

    const country =
      String(
        req.body.country || "India"
      ).trim();

    if (
      !/^[A-Za-z0-9_]{3,24}$/.test(
        username
      )
    ) {
      return res.status(400).json({
        error:
          "Username must contain 3-24 letters, numbers or underscore"
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error:
          "Password must contain at least 6 characters"
      });
    }

    const alreadyExists =
      Object.values(db.users)
        .some(
          user =>
            user.username.toLowerCase() ===
            username.toLowerCase()
        );

    if (alreadyExists) {
      return res.status(409).json({
        error: "Username already exists"
      });
    }

    const userId =
      createId("usr");

    const passwordHash =
      await bcrypt.hash(
        password,
        10
      );

    const user = {
      id: userId,
      username,
      country,
      passwordHash,
      createdAt: currentTime(),
      lastLoginAt: currentTime()
    };

    db.users[userId] = user;

    saveDatabase();

    res.status(201).json({
      token: createToken(userId),
      user: safeUser(user)
    });
  } catch (error) {
    console.error(
      "Registration error:",
      error
    );

    res.status(500).json({
      error: "Registration failed"
    });
  }
});

/* =========================================================
   LOGIN
   ========================================================= */

app.post("/api/auth/login", async (req, res) => {
  try {
    const username =
      String(req.body.username || "")
        .trim();

    const password =
      String(req.body.password || "");

    const user =
      Object.values(db.users)
        .find(
          u =>
            u.username.toLowerCase() ===
            username.toLowerCase()
        );

    if (!user) {
      return res.status(401).json({
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
        error:
          "Invalid username or password"
      });
    }

    user.lastLoginAt =
      currentTime();

    saveDatabase();

    res.json({
      token:
        createToken(user.id),

      user:
        safeUser(user),

      company:
        publicCompany(
          db.companies[user.id]
        )
    });
  } catch (error) {
    console.error(
      "Login error:",
      error
    );

    res.status(500).json({
      error: "Login failed"
    });
  }
});

/* =========================================================
   PLAYER
   ========================================================= */

app.get(
  "/api/player/me",
  authenticate,
  (req, res) => {
    res.json({
      user:
        safeUser(req.user),

      company:
        publicCompany(
          db.companies[req.user.id]
        )
    });
  }
);

/* =========================================================
   CREATE COMPANY
   ========================================================= */

app.post(
  "/api/company",
  authenticate,
  (req, res) => {
    if (
      db.companies[req.user.id]
    ) {
      return res.status(409).json({
        error:
          "You already have a company"
      });
    }

    const name =
      String(
        req.body.name ||
        `${req.user.username} Corp`
      ).trim();

    if (
      name.length < 2 ||
      name.length > 40
    ) {
      return res.status(400).json({
        error:
          "Company name must be 2-40 characters"
      });
    }

    const company = {
      id: createId("cmp"),

      ownerId:
        req.user.id,

      name,

      country:
        req.user.country,

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

      lastIncomeAt:
        currentTime(),

      createdAt:
        currentTime()
    };

    db.companies[
      req.user.id
    ] = company;

    saveDatabase();

    res.status(201).json({
      company:
        publicCompany(company)
    });
  }
);

/* =========================================================
   GET COMPANY
   ========================================================= */

app.get(
  "/api/company",
  authenticate,
  companyRequired,
  (req, res) => {
    res.json({
      company:
        publicCompany(
          req.company
        )
    });
  }
);

/* =========================================================
   GET OTHER PLAYER COMPANY
   ========================================================= */

app.get(
  "/api/company/:ownerId",
  authenticate,
  (req, res) => {
    const company =
      db.companies[
        req.params.ownerId
      ];

    if (!company) {
      return res.status(404).json({
        error: "Company not found"
      });
    }

    res.json({
      company:
        publicCompany(company)
    });
  }
);

/* =========================================================
   BUY BUSINESS
   ========================================================= */

app.post(
  "/api/business/buy",
  authenticate,
  companyRequired,
  (req, res) => {
    const type =
      String(req.body.type || "");

    const quantity =
      Math.floor(
        Number(
          req.body.quantity || 0
        )
      );

    const item =
      BUSINESSES[type];

    if (!item) {
      return res.status(400).json({
        error:
          "Invalid business type"
      });
    }

    if (
      quantity < 1 ||
      quantity > 100000
    ) {
      return res.status(400).json({
        error:
          "Invalid quantity"
      });
    }

    const cost =
      item.price * quantity;

    if (
      req.company.money < cost
    ) {
      return res.status(400).json({
        error:
          "Insufficient funds",
        required:
          cost
      });
    }

    req.company.money -=
      cost;

    if (
      !req.company.businesses[
        type
      ]
    ) {
      req.company.businesses[
        type
      ] = {
        quantity: 0,
        level: 1
      };
    }

    req.company.businesses[
      type
    ].quantity += quantity;

    req.company.xp +=
      Math.floor(cost / 100);

    updateLevel(
      req.company
    );

    saveDatabase();

    res.json({
      success: true,

      purchased: {
        type,
        quantity,
        cost
      },

      company:
        publicCompany(
          req.company
        )
    });
  }
);

/* =========================================================
   SELL BUSINESS
   ========================================================= */

app.post(
  "/api/business/sell",
  authenticate,
  companyRequired,
  (req, res) => {
    const type =
      String(req.body.type || "");

    const quantity =
      Math.floor(
        Number(
          req.body.quantity || 0
        )
      );

    const item =
      BUSINESSES[type];

    const owned =
      req.company.businesses[
        type
      ];

    if (!item || !owned) {
      return res.status(400).json({
        error:
          "Business not owned"
      });
    }

    if (
      quantity < 1 ||
      quantity > owned.quantity
    ) {
      return res.status(400).json({
        error:
          "Invalid quantity"
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

    req.company.money +=
      refund;

    if (
      owned.quantity === 0
    ) {
      delete req.company.businesses[
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

      company:
        publicCompany(
          req.company
        )
    });
  }
);

/* =========================================================
   UPGRADE BUSINESS
   ========================================================= */

app.post(
  "/api/business/upgrade",
  authenticate,
  companyRequired,
  (req, res) => {
    const type =
      String(req.body.type || "");

    const owned =
      req.company.businesses[
        type
      ];

    const item =
      BUSINESSES[type];

    if (!item || !owned) {
      return res.status(400).json({
        error:
          "Business not owned"
      });
    }

    if (
      owned.level >=
      item.maxLevel
    ) {
      return res.status(400).json({
        error:
          "Maximum level reached"
      });
    }

    const cost =
      Math.floor(
        item.price *
        Math.pow(
          1.55,
          owned.level - 1
        )
      );

    if (
      req.company.money < cost
    ) {
      return res.status(400).json({
        error:
          "Insufficient funds",
        required:
          cost
      });
    }

    req.company.money -=
      cost;

    owned.level++;

    req.company.xp +=
      Math.floor(cost / 100);

    updateLevel(
      req.company
    );

    saveDatabase();

    res.json({
      success: true,

      upgradeCost:
        cost,

      company:
        publicCompany(
          req.company
        )
    });
  }
);

/* =========================================================
   BUY TRANSPORT
   ========================================================= */

app.post(
  "/api/transport/buy",
  authenticate,
  companyRequired,
  (req, res) => {
    const type =
      String(req.body.type || "");

    const quantity =
      Math.floor(
        Number(
          req.body.quantity || 0
        )
      );

    const item =
      TRANSPORTS[type];

    if (!item) {
      return res.status(400).json({
        error:
          "Invalid transport type"
      });
    }

    if (
      quantity < 1 ||
      quantity > 10000
    ) {
      return res.status(400).json({
        error:
          "Invalid quantity"
      });
    }

    const cost =
      item.price * quantity;

    if (
      req.company.money < cost
    ) {
      return res.status(400).json({
        error:
          "Insufficient funds",
        required:
          cost
      });
    }

    req.company.money -=
      cost;

    if (
      !req.company.transports[
        type
      ]
    ) {
      req.company.transports[
        type
      ] = {
        quantity: 0
      };
    }

    req.company.transports[
      type
    ].quantity += quantity;

    req.company.xp +=
      Math.floor(cost / 100);

    updateLevel(
      req.company
    );

    saveDatabase();

    res.json({
      success: true,

      purchased: {
        type,
        quantity,
        cost
      },

      company:
        publicCompany(
          req.company
        )
    });
  }
);

/* =========================================================
   SELL TRANSPORT
   ========================================================= */

app.post(
  "/api/transport/sell",
  authenticate,
  companyRequired,
  (req, res) => {
    const type =
      String(req.body.type || "");

    const quantity =
      Math.floor(
        Number(
          req.body.quantity || 0
        )
      );

    const item =
      TRANSPORTS[type];

    const owned =
      req.company.transports[
        type
      ];

    if (!item || !owned) {
      return res.status(400).json({
        error:
          "Transport not owned"
      });
    }

    if (
      quantity < 1 ||
      quantity > owned.quantity
    ) {
      return res.status(400).json({
        error:
          "Invalid quantity"
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

    req.company.money +=
      refund;

    if (
      owned.quantity === 0
    ) {
      delete req.company.transports[
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

      company:
        publicCompany(
          req.company
        )
    });
  }
);

/* =========================================================
   COLLECT INCOME
   ========================================================= */

app.post(
  "/api/income/collect",
  authenticate,
  companyRequired,
  (req, res) => {
    const income =
      collectIncome(
        req.company
      );

    saveDatabase();

    res.json({
      success: true,
      collected: income,
      money:
        req.company.money,
      company:
        publicCompany(
          req.company
        )
    });
  }
);

/* =========================================================
   CONCESSION
   ========================================================= */

app.post(
  "/api/concession/buy",
  authenticate,
  companyRequired,
  (req, res) => {
    const type =
      String(req.body.type || "");

    const item =
      CONCESSIONS[type];

    if (!item) {
      return res.status(400).json({
        error:
          "Invalid concession"
      });
    }

    if (
      req.company.concession
    ) {
      return res.status(400).json({
        error:
          "Concession already owned"
      });
    }

    if (
      req.company.money < item.price
    ) {
      return res.status(400).json({
        error:
          "Insufficient funds"
      });
    }

    req.company.money -=
      item.price;

    req.company.concession =
      type;

    req.company.xp +=
      Math.floor(
        item.price / 100
      );

    updateLevel(
      req.company
    );

    saveDatabase();

    res.json({
      success: true,

      company:
        publicCompany(
          req.company
        )
    });
  }
);

/* =========================================================
   SUBSIDIARY
   ========================================================= */

app.post(
  "/api/subsidiary/buy",
  authenticate,
  companyRequired,
  (req, res) => {
    const type =
      String(req.body.type || "");

    const item =
      SUBSIDIARIES[type];

    if (!item) {
      return res.status(400).json({
        error:
          "Invalid subsidiary"
      });
    }

    if (
      req.company.subsidiary
    ) {
      return res.status(400).json({
        error:
          "Subsidiary already owned"
      });
    }

    if (
      req.company.money < item.price
    ) {
      return res.status(400).json({
        error:
          "Insufficient funds"
      });
    }

    req.company.money -=
      item.price;

    req.company.subsidiary =
      type;

    req.company.xp +=
      Math.floor(
        item.price / 100
      );

    updateLevel(
      req.company
    );

    saveDatabase();

    res.json({
      success: true,

      company:
        publicCompany(
          req.company
        )
    });
  }
);

/* =========================================================
   RANKINGS
   ========================================================= */

app.get(
  "/api/rankings",
  authenticate,
  (req, res) => {
    const rankings =
      Object.values(
        db.companies
      )
        .map(company => {
          collectIncome(company);

          const owner =
            db.users[
              company.ownerId
            ];

          return {
            rank: 0,

            companyId:
              company.id,

            ownerId:
              company.ownerId,

            companyName:
              company.name,

            ownerName:
              owner
                ? owner.username
                : "Unknown",

            country:
              company.country,

            level:
              company.level,

            money:
              company.money,

            netWorth:
              calculateNetWorth(
                company
              )
          };
        })
        .sort(
          (a, b) =>
            b.netWorth -
            a.netWorth
        );

    rankings.forEach(
      (item, index) => {
        item.rank =
          index + 1;
      }
    );

    saveDatabase();

    res.json({
      rankings:
        rankings.slice(0, 100)
    });
  }
);

/* =========================================================
   ALLIANCES
   ========================================================= */

app.post(
  "/api/alliance",
  authenticate,
  companyRequired,
  (req, res) => {
    if (
      req.company.allianceId
    ) {
      return res.status(400).json({
        error:
          "Already in an alliance"
      });
    }

    const name =
      String(
        req.body.name || ""
      ).trim();

    if (
      name.length < 2 ||
      name.length > 30
    ) {
      return res.status(400).json({
        error:
          "Alliance name must be 2-30 characters"
      });
    }

    const alliance = {
      id: createId("all"),

      name,

      ownerId:
        req.user.id,

      members: [
        req.user.id
      ],

      createdAt:
        currentTime()
    };

    db.alliances[
      alliance.id
    ] = alliance;

    req.company.allianceId =
      alliance.id;

    saveDatabase();

    res.status(201).json({
      alliance
    });
  }
);

app.get(
  "/api/alliances",
  authenticate,
  (req, res) => {
    const alliances =
      Object.values(
        db.alliances
      ).map(alliance => ({
        id: alliance.id,

        name:
          alliance.name,

        ownerId:
          alliance.ownerId,

        members:
          alliance.members,

        memberCount:
          alliance.members.length,

        createdAt:
          alliance.createdAt
      }));

    res.json({
      alliances
    });
  }
);

app.post(
  "/api/alliance/:id/join",
  authenticate,
  companyRequired,
  (req, res) => {
    const alliance =
      db.alliances[
        req.params.id
      ];

    if (!alliance) {
      return res.status(404).json({
        error:
          "Alliance not found"
      });
    }

    if (
      req.company.allianceId
    ) {
      return res.status(400).json({
        error:
          "Already in an alliance"
      });
    }

    if (
      alliance.members.length >=
      50
    ) {
      return res.status(400).json({
        error:
          "Alliance is full"
      });
    }

    alliance.members.push(
      req.user.id
    );

    req.company.allianceId =
      alliance.id;

    saveDatabase();

    res.json({
      success: true,
      alliance
    });
  }
);

app.post(
  "/api/alliance/leave",
  authenticate,
  companyRequired,
  (req, res) => {
    if (
      !req.company.allianceId
    ) {
      return res.status(400).json({
        error:
          "You are not in an alliance"
      });
    }

    const alliance =
      db.alliances[
        req.company.allianceId
      ];

    if (alliance) {
      alliance.members =
        alliance.members.filter(
          id =>
            id !==
            req.user.id
        );

      if (
        alliance.ownerId ===
        req.user.id &&
        alliance.members.length > 0
      ) {
        alliance.ownerId =
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

    req.company.allianceId =
      null;

    saveDatabase();

    res.json({
      success: true
    });
  }
);

/* =========================================================
   CONTRACTS
   ========================================================= */

function createContract(company) {
  const contract = {
    id: createId("ctr"),

    companyId:
      company.id,

    title:
      "Business Contract",

    reward:
      5000 +
      company.level * 2500,

    xp:
      100,

    status:
      "open",

    createdAt:
      currentTime(),

    expiresAt:
      currentTime() +
      24 * 60 * 60 * 1000
  };

  db.contracts[
    contract.id
  ] = contract;

  return contract;
}

app.get(
  "/api/contracts",
  authenticate,
  companyRequired,
  (req, res) => {
    let contracts =
      Object.values(
        db.contracts
      ).filter(
        contract =>
          contract.companyId ===
            req.company.id &&
          contract.status ===
            "open" &&
          contract.expiresAt >
            currentTime()
      );

    while (
      contracts.length < 5
    ) {
      contracts.push(
        createContract(
          req.company
        )
      );
    }

    saveDatabase();

    res.json({
      contracts
    });
  }
);

app.post(
  "/api/contracts/:id/complete",
  authenticate,
  companyRequired,
  (req, res) => {
    const contract =
      db.contracts[
        req.params.id
      ];

    if (
      !contract ||
      contract.companyId !==
        req.company.id
    ) {
      return res.status(404).json({
        error:
          "Contract not found"
      });
    }

    if (
      contract.status !==
      "open"
    ) {
      return res.status(400).json({
        error:
          "Contract already completed"
      });
    }

    if (
      contract.expiresAt <
      currentTime()
    ) {
      return res.status(400).json({
        error:
          "Contract expired"
      });
    }

    contract.status =
      "completed";

    req.company.money +=
      contract.reward;

    req.company.xp +=
      contract.xp;

    req.company.contractsCompleted++;

    updateLevel(
      req.company
    );

    saveDatabase();

    res.json({
      success: true,

      contract,

      company:
        publicCompany(
          req.company
        )
    });
  }
);

/* =========================================================
   CHAT
   ========================================================= */

/*
   This version uses REST chat instead of WebSocket.
   This means the APK can poll /api/chat/global
   every few seconds.

   This deliberately avoids the "Cannot find module 'ws'"
   problem from your Render deployment.
*/

app.get(
  "/api/chat/:channel",
  authenticate,
  (req, res) => {
    const channel =
      String(
        req.params.channel ||
          "global"
      );

    const messages =
      db.messages.filter(
        message =>
          message.channel ===
          channel
      );

    res.json({
      messages:
        messages.slice(-100)
    });
  }
);

app.post(
  "/api/chat/:channel",
  authenticate,
  (req, res) => {
    const channel =
      String(
        req.params.channel ||
          "global"
      ).replace(
        /[^A-Za-z0-9_-]/g,
        ""
      );

    const message =
      String(
        req.body.message || ""
      ).trim();

    if (!message) {
      return res.status(400).json({
        error:
          "Message cannot be empty"
      });
    }

    const newMessage = {
      id: createId("msg"),

      channel,

      userId:
        req.user.id,

      username:
        req.user.username,

      message:
        message.substring(
          0,
          500
        ),

      createdAt:
        currentTime()
    };

    db.messages.push(
      newMessage
    );

    if (
      db.messages.length >
      1000
    ) {
      db.messages =
        db.messages.slice(
          -1000
        );
    }

    saveDatabase();

    res.json({
      success: true,
      message:
        newMessage
    });
  }
);

/* =========================================================
   ADMIN RESET
   ========================================================= */

app.post(
  "/api/admin/reset",
  (req, res) => {
    const adminKey =
      req.headers[
        "x-admin-key"
      ];

    if (
      !process.env.ADMIN_KEY ||
      adminKey !==
        process.env.ADMIN_KEY
    ) {
      return res.status(403).json({
        error:
          "Unauthorized"
      });
    }

    db =
      JSON.parse(
        JSON.stringify(
          emptyDatabase
        )
      );

    saveDatabase();

    res.json({
      success: true,
      message:
        "Database reset"
    });
  }
);

/* =========================================================
   404 HANDLER
   ========================================================= */

app.use(
  (req, res) => {
    res.status(404).json({
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
  (error, req, res, next) => {
    console.error(
      "Server error:",
      error
    );

    res.status(500).json({
      error:
        "Internal server error"
    });
  }
);

/* =========================================================
   START SERVER
   ========================================================= */

app.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      "======================================"
    );

    console.log(
      "Entrepreneur Multiplayer Server"
    );

    console.log(
      "======================================"
    );

    console.log(
      `Server running on port ${PORT}`
    );

    console.log(
      `Health endpoint: /health`
    );

    console.log(
      `Database: ${DATA_FILE}`
    );

    console.log(
      "Server started successfully."
    );
  }
);
