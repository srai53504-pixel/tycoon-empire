const http = require("http");
const crypto = require("crypto");

const PORT = process.env.PORT || 10000;
const VERSION = "0.7.0";

/*
=========================================================
TYCOON EMPIRE - PRIVATE MULTIPLAYER SERVER
=========================================================

CommonJS server.
Keep server/package.json:
{
  "type": "commonjs"
}

The server is intentionally self-contained and uses
in-memory storage for this development version.

IMPORTANT:
The prices below are YOUR GAME'S CURRENT CONFIGURATION.
They are not claimed to be the exact original game's
server-side prices.
=========================================================
*/

const db = {
  players: [],
  sessions: {},
  assets: [],
  sites: [],
  contracts: [],
  bids: [],
  wars: [],
  alliances: [],
  allianceMembers: [],
  chat: [],
  loans: [],
  missions: [],
  nextPlayerId: 1,
  nextAssetId: 1,
  nextSiteId: 1,
  nextContractId: 1,
  nextBidId: 1,
  nextWarId: 1,
  nextAllianceId: 1,
  nextMessageId: 1,
  nextLoanId: 1,
  nextMissionId: 1
};

/*
=========================================================
LEVEL SYSTEM
=========================================================
*/

const LEVELS = [
  {
    level: 1,
    title: "Entrepreneur",
    netWorth: 0,
    xp: 0,
    rewardCash: 0
  },
  {
    level: 2,
    title: "Business Owner",
    netWorth: 250000,
    xp: 500,
    rewardCash: 25000
  },
  {
    level: 3,
    title: "Business Executive",
    netWorth: 750000,
    xp: 1200,
    rewardCash: 50000
  },
  {
    level: 4,
    title: "Business Leader",
    netWorth: 2000000,
    xp: 2500,
    rewardCash: 100000
  },
  {
    level: 5,
    title: "Industrialist",
    netWorth: 5000000,
    xp: 5000,
    rewardCash: 200000
  },
  {
    level: 6,
    title: "Corporate Leader",
    netWorth: 12000000,
    xp: 9000,
    rewardCash: 350000
  },
  {
    level: 7,
    title: "Tycoon",
    netWorth: 30000000,
    xp: 15000,
    rewardCash: 500000
  },
  {
    level: 8,
    title: "CEO",
    netWorth: 75000000,
    xp: 25000,
    rewardCash: 750000
  },
  {
    level: 9,
    title: "Corporate Mogul",
    netWorth: 150000000,
    xp: 40000,
    rewardCash: 1000000
  },
  {
    level: 10,
    title: "National Industrialist",
    netWorth: 300000000,
    xp: 60000,
    rewardCash: 1500000
  },
  {
    level: 11,
    title: "Global Tycoon",
    netWorth: 750000000,
    xp: 90000,
    rewardCash: 2500000
  },
  {
    level: 12,
    title: "Corporate Empire",
    netWorth: 1500000000,
    xp: 130000,
    rewardCash: 5000000
  },
  {
    level: 13,
    title: "Global Empire",
    netWorth: 3000000000,
    xp: 180000,
    rewardCash: 10000000
  },
  {
    level: 14,
    title: "Economic Power",
    netWorth: 7500000000,
    xp: 250000,
    rewardCash: 20000000
  },
  {
    level: 15,
    title: "World Tycoon",
    netWorth: 15000000000,
    xp: 350000,
    rewardCash: 50000000
  }
];

/*
=========================================================
COUNTRIES
=========================================================
*/

const COUNTRIES = [
  "India",
  "United States",
  "United Kingdom",
  "Germany",
  "France",
  "Italy",
  "Spain",
  "Canada",
  "Brazil",
  "Mexico",
  "Australia",
  "Japan",
  "South Korea",
  "China",
  "Indonesia",
  "Singapore",
  "United Arab Emirates",
  "Saudi Arabia",
  "South Africa",
  "Turkey",
  "Netherlands",
  "Switzerland",
  "Norway",
  "Sweden",
  "Denmark"
];

/*
=========================================================
ASSET CATALOG
=========================================================
*/

const catalog = [
  // BUSINESSES
  ["business", "Coffee House", 50000, 350],
  ["business", "Clothes Shop", 75000, 500],
  ["business", "Fast Food", 100000, 700],
  ["business", "Restaurant", 150000, 1100],
  ["business", "Supermarket", 300000, 2200],
  ["business", "Electronics Shop", 450000, 3200],
  ["business", "Sports Shop", 550000, 4000],
  ["business", "Lottery Shop", 650000, 4700],
  ["business", "Gym", 800000, 6000],
  ["business", "CrossFit Studio", 900000, 6800],
  ["business", "Dance Club", 1000000, 7500],
  ["business", "Bowling", 1300000, 9500],
  ["business", "Pool Hall", 1500000, 11000],
  ["business", "Pub", 1800000, 13500],
  ["business", "Spa Club", 2200000, 16500],
  ["business", "Movie Theatre", 3000000, 22000],
  ["business", "Casino Hotel", 7000000, 52000],
  ["business", "Winery", 9000000, 68000],
  ["business", "Chocolatier Shop", 11000000, 85000],
  ["business", "Chef Restaurant", 15000000, 115000],
  ["business", "Escape Room", 18000000, 135000],

  // TRANSPORTATION
  ["transportation", "Taxi", 25000, 200],
  ["transportation", "Bus", 100000, 850],
  ["transportation", "Train", 500000, 4500],
  ["transportation", "Tram", 750000, 6500],
  ["transportation", "Limousine", 250000, 2200],
  ["transportation", "Yacht", 1500000, 12000],
  ["transportation", "Helicopter", 2500000, 20000],
  ["transportation", "Hovercraft", 3500000, 28000],
  ["transportation", "Passenger Ship", 7500000, 60000],
  ["transportation", "Cargo Ship", 5000000, 42000],
  ["transportation", "Cargo Airplane", 12000000, 95000],
  ["transportation", "Crude Oil Carrier", 20000000, 160000],
  ["transportation", "Submarine", 30000000, 240000],
  ["transportation", "Driverless Taxi", 500000, 4500],
  ["transportation", "Super Fast Train", 25000000, 200000],
  ["transportation", "Super Tank", 50000000, 400000],
  ["transportation", "Melee Robot", 75000000, 600000],

  // CONCESSIONS
  ["concession", "Ground Transport", 150000, 1200],
  ["concession", "Commerce", 300000, 2500],
  ["concession", "Leisure", 500000, 4000],
  ["concession", "Airlines", 5000000, 40000],
  ["concession", "Sea Lines", 7500000, 60000],
  ["concession", "Real Estate", 10000000, 90000],

  // SUBSIDIARIES
  ["subsidiary", "Bank", 15000000, 110000],
  ["subsidiary", "Betting", 20000000, 150000],
  ["subsidiary", "Business Center", 25000000, 190000],
  ["subsidiary", "Medical Center", 30000000, 220000],
  ["subsidiary", "Mining Company", 40000000, 300000],
  ["subsidiary", "Products Market", 35000000, 260000],
  ["subsidiary", "Robots Center", 50000000, 400000],
  ["subsidiary", "Soccer Team", 60000000, 450000],
  ["subsidiary", "Space Center", 100000000, 750000],
  ["subsidiary", "Stock Market", 125000000, 900000],
  ["subsidiary", "Travel Company", 45000000, 340000],

  // INVESTMENTS
  ["investment", "Blockchain", 5000000, 0],
  ["investment", "Energy", 7500000, 0],
  ["investment", "Health", 8000000, 0],
  ["investment", "High-Tech", 10000000, 0],
  ["investment", "Internet Communications", 12000000, 0],
  ["investment", "Natural Resources", 15000000, 0],
  ["investment", "Nuclear", 25000000, 0],
  ["investment", "Real Estate", 18000000, 0],
  ["investment", "Security Weapons", 30000000, 0],
  ["investment", "Transportation", 20000000, 0],

  // PROPERTIES
  ["property", "Office Building", 250000, 1500],
  ["property", "Living Building", 750000, 5000],
  ["property", "Mall", 5000000, 40000],
  ["property", "Skyscraper", 25000000, 200000],

  // RESEARCH
  ["research", "Business AI", 3000000, 0],
  ["research", "Advanced Logistics", 5000000, 0],
  ["research", "Robotics", 12000000, 0],

  // PRODUCTION
  ["production", "Food Factory", 5000000, 38000],
  ["production", "Vehicle Factory", 15000000, 110000],
  ["production", "Electronics Factory", 30000000, 230000],

  // RESOURCES
  ["resource", "Oil", 1000000, 8000],
  ["resource", "Gold", 1500000, 12000],
  ["resource", "Silver", 1200000, 9500],
  ["resource", "Iron", 750000, 6000],
  ["resource", "Copper", 900000, 7200],
  ["resource", "Aluminum", 1000000, 8000],
  ["resource", "Diamonds", 2500000, 20000],
  ["resource", "Gems", 2200000, 18000],
  ["resource", "Salt", 500000, 3500]
];

for (const item of catalog) {
  db.assets.push({
    id: db.nextAssetId++,
    category: item[0],
    type: item[1],
    price: item[2],
    income: item[3],
    maintenance: Math.floor(item[2] * 0.001),
    tax: Math.floor(item[3] * 0.05),
    description: "Purchase and operate " + item[1]
  });
}

/*
=========================================================
WORLD RESOURCE SITES
=========================================================
*/

const siteData = [
  ["Peru Copper", "Peru", "Copper", 1200],
  ["Brazil Iron", "Brazil", "Iron", 1600],
  ["Indonesia Nickel", "Indonesia", "Nickel", 1100],
  ["Australia Gold", "Australia", "Gold", 700],
  ["Canada Timber", "Canada", "Timber", 900],
  ["South Africa Platinum", "South Africa", "Platinum", 500],
  ["Chile Lithium", "Chile", "Lithium", 1300],
  ["India Bauxite", "India", "Bauxite", 1000],
  ["Saudi Oil Field", "Saudi Arabia", "Oil", 2200],
  ["United States Oil Field", "United States", "Oil", 1900],
  ["China Rare Earth", "China", "Rare Earth", 1500],
  ["South Africa Gold Field", "South Africa", "Gold", 1000]
];

for (const s of siteData) {
  db.sites.push({
    id: db.nextSiteId++,
    name: s[0],
    country: s[1],
    resource: s[2],
    rate: s[3],
    claimFee: 100000,
    ownerId: null
  });
}

/*
=========================================================
CONTRACTS
=========================================================
*/

const contractNames = [
  "Natural Resources",
  "Transportation",
  "Real Estate",
  "Manufacturing",
  "Technology",
  "Food Supply",
  "Construction",
  "Energy",
  "International Trade",
  "Defence Supply",
  "Logistics",
  "Tourism"
];

for (let i = 0; i < 24; i++) {
  db.contracts.push({
    id: db.nextContractId++,
    name:
      contractNames[i % contractNames.length] +
      " Contract #" +
      (i + 1),
    country:
      COUNTRIES[(i + 2) % COUNTRIES.length],
    quantity: 1000 + i * 500,
    marketValue: 500000 + i * 250000,
    durationHours: 6 + (i % 5),
    status: "open",
    winnerId: null,
    winningBid: null
  });
}

/*
=========================================================
UTILITIES
=========================================================
*/

function hashPassword(password) {
  return crypto
    .createHash("sha256")
    .update(String(password))
    .digest("hex");
}

function createToken() {
  return crypto.randomBytes(32).toString("hex");
}

function normalize(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function parseBody(req) {
  return new Promise(resolve => {
    let body = "";

    req.on("data", chunk => {
      body += chunk.toString();

      if (body.length > 1024 * 1024) {
        req.destroy();
      }
    });

    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch {
        resolve({});
      }
    });
  });
}

function send(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization",
    "Access-Control-Allow-Methods":
      "GET,POST,PUT,DELETE,OPTIONS"
  });

  res.end(JSON.stringify(data));
}

function getPlayer(req) {
  const header =
    req.headers.authorization || "";

  if (!header.startsWith("Bearer ")) {
    return null;
  }

  const token =
    header.substring(7).trim();

  const id = db.sessions[token];

  if (!id) {
    return null;
  }

  return (
    db.players.find(
      p => p.id === id
    ) || null
  );
}

function requirePlayer(req, res) {
  const player = getPlayer(req);

  if (!player) {
    send(res, 401, {
      error: "authentication required"
    });

    return null;
  }

  return player;
}

function findAsset(type) {
  const wanted = normalize(type);

  return (
    db.assets.find(
      a => normalize(a.type) === wanted
    ) || null
  );
}

function ownedAssetValue(player) {
  let total = 0;

  for (const owned of player.assets || []) {
    const asset = findAsset(owned.type);

    if (asset) {
      total +=
        asset.price *
        Number(owned.quantity || 0);
    }
  }

  return total;
}

function siteValue(player) {
  return db.sites
    .filter(
      s => s.ownerId === player.id
    )
    .reduce(
      (sum, s) => sum + s.claimFee,
      0
    );
}

function calculateNetWorth(player) {
  return (
    Number(player.cash || 0) +
    ownedAssetValue(player) +
    siteValue(player)
  );
}

function calculateGrossIncome(player) {
  let total = 0;

  for (const owned of player.assets || []) {
    const asset = findAsset(owned.type);

    if (!asset) continue;

    total +=
      asset.income *
      Number(owned.quantity || 0);
  }

  return total;
}

function calculateMaintenance(player) {
  let total = 0;

  for (const owned of player.assets || []) {
    const asset = findAsset(owned.type);

    if (!asset) continue;

    total +=
      asset.maintenance *
      Number(owned.quantity || 0);
  }

  return total;
}

function calculateTax(player) {
  let total = 0;

  for (const owned of player.assets || []) {
    const asset = findAsset(owned.type);

    if (!asset) continue;

    total +=
      asset.tax *
      Number(owned.quantity || 0);
  }

  return total;
}

function levelInfo(player) {
  const netWorth =
    calculateNetWorth(player);

  let current =
    LEVELS[player.level - 1] ||
    LEVELS[LEVELS.length - 1];

  let next =
    LEVELS[player.level] || null;

  return {
    currentLevel: player.level,
    title: current.title,
    xp: player.xp,
    netWorth,
    nextLevel: next
      ? next.level
      : null,
    nextTitle: next
      ? next.title
      : null,
    requiredNetWorth: next
      ? next.netWorth
      : null,
    requiredXP: next
      ? next.xp
      : null,
    progressNetWorth: next
      ? Math.min(
          1,
          netWorth /
            Math.max(1, next.netWorth)
        )
      : 1,
    progressXP: next
      ? Math.min(
          1,
          player.xp /
            Math.max(1, next.xp)
        )
      : 1
  };
}

function tryLevelUp(player) {
  const messages = [];

  while (
    player.level < LEVELS.length
  ) {
    const next =
      LEVELS[player.level];

    const netWorth =
      calculateNetWorth(player);

    if (
      netWorth < next.netWorth ||
      player.xp < next.xp
    ) {
      break;
    }

    player.level++;

    player.cash +=
      next.rewardCash;

    player.gold +=
      player.level * 10;

    messages.push({
      level: player.level,
      title: next.title,
      rewardCash: next.rewardCash,
      rewardGold:
        player.level * 10
    });
  }

  return messages;
}

function playerView(player) {
  const gross =
    calculateGrossIncome(player);

  const maintenance =
    calculateMaintenance(player);

  const tax =
    calculateTax(player);

  const netIncome =
    Math.max(
      0,
      gross -
        maintenance -
        tax
    );

  return {
    id: player.id,
    playerId: player.id,
    username: player.username,
    email: player.email,
    companyName: player.companyName,
    country: player.country,
    level: player.level,
    title:
      LEVELS[player.level - 1]?.title ||
      "World Tycoon",
    xp: player.xp,
    cash: player.cash,
    gold: player.gold,
    netWorth:
      calculateNetWorth(player),
    grossIncome: gross,
    maintenance,
    tax,
    netIncome,
    offensiveLevel:
      player.offensiveLevel,
    defense: player.defense,
    patriotism:
      player.patriotism || 0,
    brandPoints:
      player.brandPoints || 0,
    ceoPrestige:
      player.ceoPrestige || 0,
    online: true,
    assets: player.assets || [],
    levelInfo:
      levelInfo(player)
  };
}

/*
=========================================================
AUTH
=========================================================
*/

function register(body) {
  const username =
    String(body.username || "")
      .trim();

  const email =
    String(body.email || "")
      .trim()
      .toLowerCase();

  const password =
    String(body.password || "");

  if (!username || !email || !password) {
    return {
      status: 400,
      data: {
        error:
          "username, email and password are required"
      }
    };
  }

  if (
    db.players.some(
      p => p.email === email
    )
  ) {
    return {
      status: 409,
      data: {
        error:
          "email already registered"
      }
    };
  }

  const player = {
    id: db.nextPlayerId++,
    username,
    email,
    password:
      hashPassword(password),

    companyName:
      body.companyName ||
      username + " Corporation",

    country:
      body.country ||
      "India",

    level: 1,
    xp: 0,

    cash: 100000,
    gold: 100,

    offensiveLevel: 1,
    defense: 100,

    patriotism: 0,
    brandPoints: 0,
    ceoPrestige: 0,

    assets: [],

    lastIncome:
      Date.now()
  };

  db.players.push(player);

  const token =
    createToken();

  db.sessions[token] =
    player.id;

  return {
    status: 201,
    data: {
      ok: true,
      token,
      accessToken: token,
      player:
        playerView(player)
    }
  };
}

/*
=========================================================
INCOME CYCLE
=========================================================
*/

function processIncome(player) {
  const now =
    Date.now();

  const hour =
    60 * 60 * 1000;

  if (!player.lastIncome) {
    player.lastIncome = now;
    return 0;
  }

  let cycles =
    Math.floor(
      (now - player.lastIncome) /
        hour
    );

  cycles =
    Math.max(
      0,
      Math.min(24, cycles)
    );

  if (cycles <= 0) {
    return 0;
  }

  const gross =
    calculateGrossIncome(player);

  const maintenance =
    calculateMaintenance(player);

  const tax =
    calculateTax(player);

  const net =
    Math.max(
      0,
      gross -
        maintenance -
        tax
    );

  const amount =
    net * cycles;

  player.cash += amount;

  player.lastIncome +=
    cycles * hour;

  player.xp +=
    Math.floor(
      amount / 10000
    );

  tryLevelUp(player);

  return amount;
}

/*
=========================================================
SERVER
=========================================================
*/

const server =
  http.createServer(
    async (req, res) => {

      if (
        req.method ===
        "OPTIONS"
      ) {
        return send(
          res,
          204,
          {}
        );
      }

      const url =
        new URL(
          req.url,
          `http://${req.headers.host || "localhost"}`
        );

      const path =
        url.pathname;

      const body =
        req.method === "POST" ||
        req.method === "PUT" ||
        req.method === "PATCH"
          ? await parseBody(req)
          : {};

      /*
      ================================================
      HEALTH
      ================================================
      */

      if (
        req.method === "GET" &&
        path === "/health"
      ) {
        return send(
          res,
          200,
          {
            ok: true,
            version: VERSION,
            service:
              "tycoon-empire",
            players:
              db.players.length,
            assets:
              db.assets.length,
            sites:
              db.sites.length,
            contracts:
              db.contracts.length,
            features: [
              "authentication",
              "players",
              "progression",
              "businesses",
              "transportation",
              "concessions",
              "subsidiaries",
              "investments",
              "properties",
              "resources",
              "world-map",
              "contracts",
              "bidding",
              "alliances",
              "chat",
              "rankings",
              "army",
              "wars",
              "income-cycles",
              "loans",
              "missions",
              "countries"
            ]
          }
        );
      }

      /*
      ================================================
      REGISTER
      ================================================
      */

      if (
        req.method === "POST" &&
        path ===
          "/api/auth/register"
      ) {

        const result =
          register(body);

        return send(
          res,
          result.status,
          result.data
        );
      }

      /*
      ================================================
      LOGIN
      ================================================
      */

      if (
        req.method === "POST" &&
        path ===
          "/api/auth/login"
      ) {

        const email =
          String(
            body.email || ""
          )
            .trim()
            .toLowerCase();

        const password =
          String(
            body.password || ""
          );

        const player =
          db.players.find(
            p =>
              p.email === email &&
              p.password ===
                hashPassword(
                  password
                )
          );

        if (!player) {
          return send(
            res,
            401,
            {
              error:
                "invalid email or password"
            }
          );
        }

        processIncome(player);

        const token =
          createToken();

        db.sessions[token] =
          player.id;

        return send(
          res,
          200,
          {
            ok: true,
            token,
            accessToken: token,
            player:
              playerView(player)
          }
        );
      }

      /*
      ================================================
      LOGOUT
      ================================================
      */

      if (
        req.method === "POST" &&
        path ===
          "/api/auth/logout"
      ) {

        const header =
          req.headers.authorization ||
          "";

        if (
          header.startsWith(
            "Bearer "
          )
        ) {
          delete db.sessions[
            header.substring(7)
          ];
        }

        return send(
          res,
          200,
          { ok: true }
        );
      }

      /*
      ================================================
      PUBLIC COUNTRY LIST
      ================================================
      */

      if (
        req.method === "GET" &&
        path ===
          "/api/countries"
      ) {

        const result =
          COUNTRIES.map(
            country => {

              const companies =
                db.players.filter(
                  p =>
                    p.country ===
                    country
                );

              const totalWorth =
                companies.reduce(
                  (sum, p) =>
                    sum +
                    calculateNetWorth(
                      p
                    ),
                  0
                );

              return {
                name: country,
                companies:
                  companies.length,
                totalNetWorth:
                  totalWorth
              };
            }
          );

        return send(
          res,
          200,
          {
            countries:
              result
          }
        );
      }

      /*
      ================================================
      AUTHENTICATED ROUTES
      ================================================
      */

      const player =
        requirePlayer(
          req,
          res
        );

      if (!player) {
        return;
      }

      processIncome(player);

      /*
      ================================================
      PLAYER
      ================================================
      */

      if (
        req.method === "GET" &&
        path ===
          "/api/players/me"
      ) {
        return send(
          res,
          200,
          {
            player:
              playerView(
                player
              )
          }
        );
      }

      if (
        req.method === "GET" &&
        path ===
          "/api/players/online"
      ) {

        return send(
          res,
          200,
          {
            players:
              db.players.map(
                playerView
              )
          }
        );
      }

      /*
      ================================================
      PROGRESSION
      ================================================
      */

      if (
        req.method === "GET" &&
        path ===
          "/api/progression"
      ) {

        return send(
          res,
          200,
          {
            player:
              playerView(
                player
              ),
            levels: LEVELS,
            current:
              levelInfo(
                player
              )
          }
        );
      }

      /*
      ================================================
      ASSET CATALOG
      ================================================
      */

      if (
        req.method === "GET" &&
        path ===
          "/api/assets"
      ) {

        const category =
          String(
            url.searchParams.get(
              "category"
            ) || ""
          );

        let normalizedCategory =
          normalize(
            category
          );

        const aliases = {
          concessions:
            "concession",
          concession:
            "concession",
          subsidiaries:
            "subsidiary",
          subsidiary:
            "subsidiary",
          investments:
            "investment",
          investment:
            "investment",
          businesses:
            "business",
          business:
            "business",
          transportation:
            "transportation",
          properties:
            "property",
          property:
            "property",
          resources:
            "resource",
          resource:
            "resource",
          production:
            "production",
          research:
            "research"
        };

        normalizedCategory =
          aliases[
            normalizedCategory
          ] ||
          normalizedCategory;

        let assets =
          db.assets;

        if (
          normalizedCategory
        ) {
          assets =
            assets.filter(
              a =>
                a.category ===
                normalizedCategory
            );
        }

        return send(
          res,
          200,
          {
            assets:
              assets,
            owned:
              player.assets || []
          }
        );
      }

      /*
      ================================================
      BUY
      ================================================
      */

      if (
        req.method === "POST" &&
        path ===
          "/api/assets/buy"
      ) {

        const requested =
          body.type ||
          body.assetType ||
          body.name;

        const asset =
          findAsset(
            requested
          );

        if (!asset) {
          return send(
            res,
            404,
            {
              error:
                "asset not found",
              requestedType:
                requested
            }
          );
        }

        let quantity =
          Number(
            body.quantity || 1
          );

        quantity =
          Math.floor(
            quantity
          );

        if (
          !Number.isFinite(
            quantity
          ) ||
          quantity < 1
        ) {
          quantity = 1;
        }

        if (
          quantity > 100000
        ) {
          return send(
            res,
            400,
            {
              error:
                "quantity too large"
            }
          );
        }

        const cost =
          asset.price *
          quantity;

        if (
          player.cash <
          cost
        ) {
          return send(
            res,
            400,
            {
              error:
                "insufficient cash",
              cash:
                player.cash,
              cost
            }
          );
        }

        player.cash -= cost;

        if (!player.assets) {
          player.assets = [];
        }

        const existing =
          player.assets.find(
            x =>
              normalize(
                x.type
              ) ===
              normalize(
                asset.type
              )
          );

        if (existing) {
          existing.quantity +=
            quantity;
        } else {
          player.assets.push({
            type:
              asset.type,
            quantity
          });
        }

        player.xp +=
          Math.max(
            1,
            Math.floor(
              cost / 10000
            )
          );

        const levels =
          tryLevelUp(
            player
          );

        return send(
          res,
          200,
          {
            ok: true,
            asset,
            quantity,
            cost,
            cash:
              player.cash,
            levelUps:
              levels,
            player:
              playerView(
                player
              )
          }
        );
      }

      /*
      ================================================
      SELL
      ================================================
      */

      if (
        req.method === "POST" &&
        path ===
          "/api/assets/sell"
      ) {

        const requested =
          body.type ||
          body.assetType ||
          body.name;

        const owned =
          (player.assets || [])
            .find(
              x =>
                normalize(
                  x.type
                ) ===
                normalize(
                  requested
                )
            );

        if (!owned) {
          return send(
            res,
            404,
            {
              error:
                "asset not owned"
            }
          );
        }

        let quantity =
          Math.floor(
            Number(
              body.quantity || 1
            )
          );

        if (
          !Number.isFinite(
            quantity
          ) ||
          quantity < 1
        ) {
          quantity = 1;
        }

        if (
          quantity >
          owned.quantity
        ) {
          return send(
            res,
            400,
            {
              error:
                "not enough units"
            }
          );
        }

        const asset =
          findAsset(
            owned.type
          );

        const value =
          Math.floor(
            asset.price *
              quantity *
              0.8
          );

        owned.quantity -=
          quantity;

        if (
          owned.quantity <= 0
        ) {
          player.assets =
            player.assets.filter(
              x =>
                x !== owned
            );
        }

        player.cash +=
          value;

        return send(
          res,
          200,
          {
            ok: true,
            sold:
              quantity,
            value,
            cash:
              player.cash,
            player:
              playerView(
                player
              )
          }
        );
      }

      /*
      ================================================
      COLLECT INCOME
      ================================================
      */

      if (
        req.method === "POST" &&
        path ===
          "/api/assets/collect"
      ) {

        const gross =
          calculateGrossIncome(
            player
          );

        const maintenance =
          calculateMaintenance(
            player
          );

        const tax =
          calculateTax(
            player
          );

        const income =
          Math.max(
            0,
            gross -
              maintenance -
              tax
          );

        player.cash +=
          income;

        player.xp +=
          Math.floor(
            income / 1000
          );

        const levelUps =
          tryLevelUp(
            player
          );

        return send(
          res,
          200,
          {
            ok: true,
            gross,
            maintenance,
            tax,
            income,
            cash:
              player.cash,
            levelUps
          }
        );
      }

      /*
      ================================================
      INCOME SNAPSHOT
      ================================================
      */

      if (
        req.method === "GET" &&
        path ===
          "/api/income"
      ) {

        return send(
          res,
          200,
          {
            grossIncome:
              calculateGrossIncome(
                player
              ),
            maintenance:
              calculateMaintenance(
                player
              ),
            tax:
              calculateTax(
                player
              ),
            netIncome:
              Math.max(
                0,
                calculateGrossIncome(
                  player
                ) -
                  calculateMaintenance(
                    player
                  ) -
                  calculateTax(
                    player
                  )
              ),
            cycle:
              "1 hour",
            maxOfflineCycles:
              24
          }
        );
      }

      /*
      ================================================
      WORLD MAP
      ================================================
      */

      if (
        req.method === "GET" &&
        path ===
          "/api/world/sites"
      ) {

        return send(
          res,
          200,
          {
            sites:
              db.sites
          }
        );
      }

      /*
      ================================================
      CLAIM WORLD SITE
      ================================================
      */

      if (
        req.method === "POST" &&
        path ===
          "/api/world/sites/claim"
      ) {

        const site =
          db.sites.find(
            s =>
              s.id ===
              Number(
                body.siteId
              )
          );

        if (!site) {
          return send(
            res,
            404,
            {
              error:
                "site not found"
            }
          );
        }

        if (
          site.ownerId &&
          site.ownerId !==
            player.id
        ) {
          return send(
            res,
            409,
            {
              error:
                "site already owned"
            }
          );
        }

        if (
          player.cash <
          site.claimFee
        ) {
          return send(
            res,
            400,
            {
              error:
                "insufficient cash",
              required:
                site.claimFee
            }
          );
        }

        player.cash -=
          site.claimFee;

        site.ownerId =
          player.id;

        player.xp += 500;

        const levelUps =
          tryLevelUp(
            player
          );

        return send(
          res,
          200,
          {
            ok: true,
            site,
            cash:
              player.cash,
            levelUps
          }
        );
      }

      /*
      ================================================
      COUNTRIES
      ================================================
      */

      if (
        req.method === "GET" &&
        path ===
          "/api/countries"
      ) {

        const countries =
          COUNTRIES.map(
            name => {

              const companies =
                db.players.filter(
                  p =>
                    p.country ===
                    name
                );

              return {
                name,
                companies:
                  companies.length,
                totalNetWorth:
                  companies.reduce(
                    (sum, p) =>
                      sum +
                      calculateNetWorth(
                        p
                      ),
                    0
                  ),
                totalMilitaryPower:
                  companies.reduce(
                    (sum, p) =>
                      sum +
                      (p.ground || 0) +
                      (p.air || 0) +
                      (p.offensiveLevel || 1) *
                        100,
                    0
                  )
              };
            }
          );

        return send(
          res,
          200,
          {
            countries
          }
        );
      }

      /*
      ================================================
      CHANGE COUNTRY
      ================================================
      */

      if (
        req.method === "POST" &&
        path ===
          "/api/countries/select"
      ) {

        const country =
          String(
            body.country || ""
          );

        if (
          !COUNTRIES.includes(
            country
          )
        ) {
          return send(
            res,
            400,
            {
              error:
                "invalid country"
            }
          );
        }

        player.country =
          country;

        return send(
          res,
          200,
          {
            ok: true,
            country:
              player.country
          }
        );
      }

      /*
      ================================================
      RANKINGS
      ================================================
      */

      if (
        req.method === "GET" &&
        path ===
          "/api/rankings"
      ) {

        const sorted =
          [...db.players]
            .sort(
              (a, b) =>
                calculateNetWorth(b) -
                calculateNetWorth(a)
            )
            .map(
              (p, index) => ({
                rank:
                  index + 1,
                playerId:
                  p.id,
                username:
                  p.username,
                companyName:
                  p.companyName,
                country:
                  p.country,
                level:
                  p.level,
                netWorth:
                  calculateNetWorth(
                    p
                  ),
                income:
                  calculateGrossIncome(
                    p
                  ),
                offensiveLevel:
                  p.offensiveLevel
              })
            );

        return send(
          res,
          200,
          {
            rankings:
              sorted
          }
        );
      }

      /*
      ================================================
      ARMY
      ================================================
      */

      if (
        req.method === "GET" &&
        path ===
          "/api/army"
      ) {

        return send(
          res,
          200,
          {
            army: {
              ground:
                player.ground || 0,
              air:
                player.air || 0,
              defense:
                player.defense || 100,
              offensiveLevel:
                player.offensiveLevel || 1,
              power:
                (player.ground || 0) +
                (player.air || 0) +
                (player.offensiveLevel || 1) *
                  100
            }
          }
        );
      }

      /*
      ================================================
      ARMY UPGRADE
      ================================================
      */

      if (
        req.method === "POST" &&
        path ===
          "/api/army/upgrade"
      ) {

        const quantity =
          Math.max(
            1,
            Math.min(
              100000,
              Math.floor(
                Number(
                  body.quantity || 1
                )
              )
            )
          );

        const unit =
          String(
            body.unit ||
              "ground"
          ).toLowerCase();

        const costs = {
          ground: 500,
          air: 2500,
          defense: 750
        };

        const costPerUnit =
          costs[unit] ||
          costs.ground;

        const cost =
          quantity *
          costPerUnit;

        if (
          player.cash <
          cost
        ) {
          return send(
            res,
            400,
            {
              error:
                "insufficient cash",
              cost,
              cash:
                player.cash
            }
          );
        }

        player.cash -=
          cost;

        if (unit === "air") {
          player.air =
            (player.air || 0) +
            quantity;
        } else if (
          unit === "defense"
        ) {
          player.defense =
            (player.defense || 100) +
            quantity;
        } else {
          player.ground =
            (player.ground || 0) +
            quantity;
        }

        player.xp +=
          Math.floor(
            quantity / 10
          );

        return send(
          res,
          200,
          {
            ok: true,
            cost,
            cash:
              player.cash,
            army: {
              ground:
                player.ground || 0,
              air:
                player.air || 0,
              defense:
                player.defense || 100,
              offensiveLevel:
                player.offensiveLevel || 1
            }
          }
        );
      }

      /*
      ================================================
      WARS
      ================================================
      */

      if (
        req.method === "POST" &&
        path ===
          "/api/wars"
      ) {

        const target =
          db.players.find(
            p =>
              p.id ===
              Number(
                body.targetPlayerId
              )
          );

        if (
          !target ||
          target.id ===
            player.id
        ) {
          return send(
            res,
            400,
            {
              error:
                "invalid target"
            }
          );
        }

        const attack =
          (player.ground || 0) +
          (player.air || 0) +
          (player.offensiveLevel || 1) *
            100;

        const defense =
          (target.defense || 100) +
          (target.ground || 0) +
          (target.air || 0);

        const roll =
          0.85 +
          Math.random() *
            0.3;

        const win =
          attack * roll >=
          defense;

        const war = {
          id:
            db.nextWarId++,
          attackerId:
            player.id,
          targetId:
            target.id,
          attackPower:
            attack,
          defensePower:
            defense,
          win,
          createdAt:
            Date.now()
        };

        db.wars.push(war);

        if (win) {
          player.offensiveLevel =
            (player.offensiveLevel || 1) +
            1;

          const damage =
            Math.floor(
              target.cash *
                0.03
            );

          target.cash =
            Math.max(
              0,
              target.cash -
                damage
            );

          player.xp +=
            1000;
        }

        return send(
          res,
          200,
          {
            result: {
              win,
              message:
                win
                  ? "Victory! Offensive level increased."
                  : "Defeat. Rebuild your army."
            },
            war,
            army: {
              ground:
                player.ground || 0,
              air:
                player.air || 0,
              defense:
                player.defense || 100,
              offensiveLevel:
                player.offensiveLevel || 1
            }
          }
        );
      }

      /*
      ================================================
      CONTRACTS
      ================================================
      */

      if (
        req.method === "GET" &&
        path ===
          "/api/contracts"
      ) {

        return send(
          res,
          200,
          {
            contracts:
              db.contracts.filter(
                c =>
                  c.status ===
                  "open"
              )
          }
        );
      }

      /*
      ================================================
      PLACE BID
      ================================================
      */

      if (
        req.method === "POST" &&
        (
          path ===
            "/api/contracts/bid" ||
          path ===
            "/api/contracts/bids"
        )
      ) {

        const contract =
          db.contracts.find(
            c =>
              c.id ===
              Number(
                body.contractId
              ) &&
              c.status ===
                "open"
          );

        if (!contract) {
          return send(
            res,
            404,
            {
              error:
                "contract not found"
            }
          );
        }

        let bidAmount =
          Number(
            body.bidAmount ||
              body.amount ||
              body.bid
          );

        if (
          !Number.isFinite(
            bidAmount
          ) ||
          bidAmount <= 0
        ) {
          return send(
            res,
            400,
            {
              error:
                "invalid bid amount"
            }
          );
        }

        const bid = {
          id:
            db.nextBidId++,
          contractId:
            contract.id,
          playerId:
            player.id,
          username:
            player.username,
          amount:
            bidAmount,
          createdAt:
            Date.now()
        };

        db.bids.push(bid);

        const contractBids =
          db.bids.filter(
            b =>
              b.contractId ===
              contract.id
          );

        return send(
          res,
          200,
          {
            ok: true,
            bid,
            bids:
              contractBids
          }
        );
      }

      /*
      ================================================
      BID RANKING
      ================================================
      */

      if (
        req.method === "GET" &&
        (
          path ===
            "/api/contracts/bids/ranking" ||
          path ===
            "/api/contracts/bid-ranking"
        )
      ) {

        const rankings =
          db.bids
            .map(
              b => ({
                ...b,
                rank: 0
              })
            )
            .sort(
              (a, b) =>
                a.amount -
                b.amount
            );

        rankings.forEach(
          (x, i) =>
            x.rank =
              i + 1
        );

        return send(
          res,
          200,
          {
            bids:
              rankings,
            rankings
          }
        );
      }

      /*
      ================================================
      RUNNING CONTRACTS
      ================================================
      */

      if (
        req.method === "GET" &&
        path ===
          "/api/contracts/running"
      ) {

        const running =
          db.contracts.filter(
            c =>
              c.status ===
                "running" &&
              c.winnerId ===
                player.id
          );

        return send(
          res,
          200,
          {
            contracts:
              running
          }
        );
      }

      /*
      ================================================
      ALLIANCES
      ================================================
      */

      if (
        req.method === "GET" &&
        path ===
          "/api/alliances"
      ) {

        return send(
          res,
          200,
          {
            alliances:
              db.alliances
          }
        );
      }

      if (
        req.method === "POST" &&
        path ===
          "/api/alliances/create"
      ) {

        const name =
          String(
            body.name ||
              ""
          ).trim();

        if (!name) {
          return send(
            res,
            400,
            {
              error:
                "alliance name required"
            }
          );
        }

        const alliance = {
          id:
            db.nextAllianceId++,
          name,
          leaderId:
            player.id,
          members: [
            player.id
          ],
          createdAt:
            Date.now()
        };

        db.alliances.push(
          alliance
        );

        return send(
          res,
          201,
          {
            ok: true,
            alliance
          }
        );
      }

      /*
      ================================================
      CHAT
      ================================================
      */

      if (
        req.method === "GET" &&
        path ===
          "/api/chat"
      ) {

        return send(
          res,
          200,
          {
            messages:
              db.chat.slice(
                -100
              )
          }
        );
      }

      if (
        req.method === "POST" &&
        path ===
          "/api/chat"
      ) {

        const message =
          String(
            body.message ||
              ""
          ).trim();

        if (!message) {
          return send(
            res,
            400,
            {
              error:
                "message required"
            }
          );
        }

        const item = {
          id:
            db.nextMessageId++,
          playerId:
            player.id,
          username:
            player.username,
          message,
          createdAt:
            Date.now()
        };

        db.chat.push(
          item
        );

        return send(
          res,
          200,
          {
            ok: true,
            message:
              item
          }
        );
      }

      /*
      ================================================
      LOANS
      ================================================
      */

      if (
        req.method === "GET" &&
        path ===
          "/api/loans"
      ) {

        return send(
          res,
          200,
          {
            loans:
              db.loans.filter(
                l =>
                  l.playerId ===
                  player.id
              )
          }
        );
      }

      if (
        req.method === "POST" &&
        path ===
          "/api/loans"
      ) {

        const amount =
          Number(
            body.amount || 0
          );

        if (
          !Number.isFinite(
            amount
          ) ||
          amount <= 0
        ) {
          return send(
            res,
            400,
            {
              error:
                "invalid amount"
            }
          );
        }

        const loan = {
          id:
            db.nextLoanId++,
          playerId:
            player.id,
          amount,
          remaining:
            Math.floor(
              amount * 1.1
            ),
          status:
            "active",
          createdAt:
            Date.now()
        };

        db.loans.push(
          loan
        );

        player.cash +=
          amount;

        return send(
          res,
          200,
          {
            ok: true,
            loan,
            cash:
              player.cash
          }
        );
      }

      /*
      ================================================
      MISSIONS
      ================================================
      */

      if (
        req.method === "GET" &&
        path ===
          "/api/missions"
      ) {

        const missions = [
          {
            id: 1,
            title:
              "Build your first business",
            requirement:
              "Own 1 asset",
            rewardCash:
              10000,
            rewardXP:
              100
          },
          {
            id: 2,
            title:
              "Become a property owner",
            requirement:
              "Own a property",
            rewardCash:
              25000,
            rewardXP:
              250
          },
          {
            id: 3,
            title:
              "Build your empire",
            requirement:
              "Reach $1,000,000 net worth",
            rewardCash:
              100000,
            rewardXP:
              1000
          },
          {
            id: 4,
            title:
              "Military Power",
            requirement:
              "Reach 1,000 army power",
            rewardCash:
              150000,
            rewardXP:
              1500
          }
        ];

        return send(
          res,
          200,
          {
            missions
          }
        );
      }

      /*
      ================================================
      FALLBACK
      ================================================
      */

      return send(
        res,
        404,
        {
          error:
            "endpoint not found",
          path
        }
      );
    }
  );

server.listen(
  PORT,
  () => {
    console.log(
      "Tycoon Empire server running on port " +
        PORT
    );

    console.log(
      "Version: " +
        VERSION
    );
  }
);
