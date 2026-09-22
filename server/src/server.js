const http = require("http");
const crypto = require("crypto");

const PORT = process.env.PORT || 10000;
const VERSION = "0.6.0";

/*
=========================================================
TYCOON EMPIRE - PRIVATE MULTIPLAYER SERVER
=========================================================

IMPORTANT:
- This is your own private backend.
- Player data is currently stored in memory.
- Render restarts/redeploys will therefore reset the database.
- Prices below are NOT claimed to be verified original-game
  prices unless they were actually extracted/verified.
=========================================================
*/

const db = {
  players: [],
  assets: [],
  contracts: [],
  bids: [],
  alliances: [],
  wars: [],
  chat: [],
  events: [],
  loans: [],
  missions: [],
  sessions: {},

  nextPlayerId: 1,
  nextAssetId: 1,
  nextContractId: 1,
  nextBidId: 1,
  nextAllianceId: 1,
  nextWarId: 1,
  nextMessageId: 1,
  nextLoanId: 1
};


/* =========================================================
   GAME SETTINGS
   ========================================================= */

const GAME = {
  startingCash: 100000,
  startingGold: 100,

  incomeCycleMs: 60 * 60 * 1000,

  xpPerLevelBase: 100,

  sellMultiplier: 0.80,

  maxBuyQuantity: 100000,

  maxChatLength: 1000
};


/* =========================================================
   ASSET CATALOG
   ========================================================= */

const catalog = [

  // -------------------------------------------------------
  // BUSINESSES
  // -------------------------------------------------------

  ["business", "Coffee house", 75000, 550],
  ["business", "Clothes shop", 100000, 700],
  ["business", "Fast food", 125000, 900],
  ["business", "Restaurant", 150000, 1100],
  ["business", "Supermarket", 250000, 1700],
  ["business", "Electronics shop", 350000, 2400],
  ["business", "Sports shop", 400000, 2800],
  ["business", "Lottery shops", 500000, 3500],
  ["business", "Gym", 600000, 4200],
  ["business", "CrossFit studio", 700000, 4900],
  ["business", "Dance club", 100000, 750],
  ["business", "Bowling", 800000, 5600],
  ["business", "Pool hall", 900000, 6300],
  ["business", "Pub", 50000, 350],
  ["business", "Spa club", 1000000, 7000],
  ["business", "Movie theatre", 300000, 2100],
  ["business", "Casino hotel", 5000000, 35000],
  ["business", "Wineries", 2500000, 17500],
  ["business", "Chocolatier shop", 1500000, 10500],
  ["business", "Chef restaurants", 3000000, 21000],
  ["business", "Escape room", 1200000, 8400],

  // -------------------------------------------------------
  // PROPERTIES
  // -------------------------------------------------------

  ["property", "Office building", 250000, 1500],
  ["property", "Living building", 500000, 3000],
  ["property", "Mall", 1000000, 7500],
  ["property", "Skyscraper", 10000000, 80000],

  ["property", "Small Office", 250000, 1500],
  ["property", "Corporate Office", 750000, 5000],
  ["property", "Headquarters", 2500000, 18000],
  ["property", "Luxury Hotel", 5000000, 40000],

  // -------------------------------------------------------
  // ADVANCED BUSINESSES
  // -------------------------------------------------------

  ["business", "Industrial robots", 10000000, 90000],
  ["business", "Robots factory", 25000000, 225000],
  ["business", "KTZ9000", 50000000, 450000],
  ["business", "ZTZ9600", 75000000, 675000],
  ["business", "Fighter jet", 100000000, 900000],
  ["business", "Tank", 50000000, 450000],
  ["business", "Smart bombs", 25000000, 225000],
  ["business", "Robot war", 150000000, 1350000],
  ["business", "Ballistic missiles", 200000000, 1800000],
  ["business", "Defence robot", 75000000, 675000],
  ["business", "Espionage satellite", 250000000, 2250000],

  // -------------------------------------------------------
  // TRANSPORTATION
  // -------------------------------------------------------

  ["transportation", "Taxi", 25000, 200],
  ["transportation", "Bus", 100000, 850],
  ["transportation", "Train", 500000, 4500],
  ["transportation", "Tram", 750000, 6500],
  ["transportation", "Limousine", 250000, 2200],
  ["transportation", "Yacht", 10000000, 85000],
  ["transportation", "Helicopter", 5000000, 42000],
  ["transportation", "Hovercraft", 7500000, 60000],
  ["transportation", "Passenger ship", 7500000, 60000],
  ["transportation", "Cargo ship", 5000000, 42000],
  ["transportation", "Cargo airplane", 3500000, 30000],
  ["transportation", "Crude-oil carrier", 15000000, 125000],
  ["transportation", "Submarine", 50000000, 450000],
  ["transportation", "Driverless taxi", 500000, 4500],
  ["transportation", "Super-fast train", 25000000, 225000],
  ["transportation", "Super tank", 100000000, 900000],
  ["transportation", "Melee robot", 75000000, 675000],

  ["transportation", "Passenger Plane", 2500000, 22000],
  ["transportation", "Cargo Plane", 3500000, 30000],
  ["transportation", "VIP Limousine", 250000, 2200],

  // -------------------------------------------------------
  // CONCESSIONS
  // -------------------------------------------------------

  ["concession", "Ground Transport", 150000, 1200],
  ["concession", "Commerce", 300000, 2500],
  ["concession", "Leisure", 500000, 4000],
  ["concession", "Airlines", 5000000, 40000],
  ["concession", "Sea Lines", 7500000, 60000],
  ["concession", "Real Estate", 10000000, 90000],

  // -------------------------------------------------------
  // SUBSIDIARIES
  // -------------------------------------------------------

  ["subsidiary", "Bank", 5000000, 35000],
  ["subsidiary", "Betting", 7500000, 55000],
  ["subsidiary", "Business Center", 10000000, 75000],
  ["subsidiary", "Medical Center", 15000000, 110000],
  ["subsidiary", "Mining company", 25000000, 185000],
  ["subsidiary", "Products market", 20000000, 150000],
  ["subsidiary", "Robots center", 50000000, 400000],
  ["subsidiary", "Soccer team", 75000000, 550000],
  ["subsidiary", "Space center", 250000000, 2000000],
  ["subsidiary", "Stock market", 100000000, 800000],
  ["subsidiary", "Travel company", 30000000, 225000],

  // -------------------------------------------------------
  // INVESTMENTS
  // -------------------------------------------------------

  ["investment", "Blockchain", 1000000, 7000],
  ["investment", "Energy", 2000000, 15000],
  ["investment", "Health", 2000000, 15000],
  ["investment", "High-tech", 5000000, 40000],
  ["investment", "Internet/communications", 5000000, 40000],
  ["investment", "Natural resources", 3000000, 22000],
  ["investment", "Nuclear", 25000000, 200000],
  ["investment", "Real estate", 5000000, 40000],
  ["investment", "Security/weapons", 15000000, 120000],
  ["investment", "Transportation", 5000000, 40000],

  // -------------------------------------------------------
  // RESOURCES
  // -------------------------------------------------------

  ["resource", "Oil", 1000000, 8000],
  ["resource", "Gold", 1500000, 12000],
  ["resource", "Silver", 1200000, 9500],
  ["resource", "Iron", 500000, 4000],
  ["resource", "Copper", 650000, 5000],
  ["resource", "Aluminum", 700000, 5500],
  ["resource", "Diamonds", 5000000, 40000],
  ["resource", "Gems", 2500000, 20000],
  ["resource", "Salt", 300000, 2500],

  // -------------------------------------------------------
  // PRODUCTION
  // -------------------------------------------------------

  ["production", "Manufacturing plant", 5000000, 35000],
  ["production", "Advanced factory", 25000000, 200000],
  ["production", "Technology center", 10000000, 80000]
];


/* =========================================================
   BUILD ASSET DATABASE
   ========================================================= */

for (const item of catalog) {

  const category = item[0];
  const type = item[1];
  const price = item[2];
  const income = item[3];

  db.assets.push({
    id: db.nextAssetId++,

    category,
    type,

    price,
    income,

    tax: Math.floor(income * 0.10),

    maintenance:
      Math.floor(income * 0.05),

    unlockLevel: 1,

    description:
      "Purchase and operate " + type
  });
}


/* =========================================================
   UTILITIES
   ========================================================= */

function hashPassword(password) {

  return crypto
    .createHash("sha256")
    .update(String(password))
    .digest("hex");
}


function createToken() {

  return crypto
    .randomBytes(32)
    .toString("hex");
}


function parseBody(req) {

  return new Promise((resolve) => {

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

        resolve(
          JSON.parse(body)
        );

      } catch {

        resolve({});
      }
    });
  });
}


function send(res, status, data) {

  const output =
    JSON.stringify(data);

  res.writeHead(status, {

    "Content-Type":
      "application/json",

    "Access-Control-Allow-Origin":
      "*",

    "Access-Control-Allow-Headers":
      "Content-Type, Authorization",

    "Access-Control-Allow-Methods":
      "GET,POST,PUT,DELETE,OPTIONS"
  });

  res.end(output);
}


function getToken(req) {

  const header =
    req.headers.authorization || "";

  if (
    !header.startsWith(
      "Bearer "
    )
  ) {

    return "";
  }

  return header
    .substring(7)
    .trim();
}


function getPlayer(req) {

  const token =
    getToken(req);

  if (!token) {

    return null;
  }

  const playerId =
    db.sessions[token];

  if (!playerId) {

    return null;
  }

  return (
    db.players.find(
      p =>
        p.id === playerId
    ) || null
  );
}


function requirePlayer(
  req,
  res
) {

  const player =
    getPlayer(req);

  if (!player) {

    send(
      res,
      401,
      {
        error:
          "unauthorized"
      }
    );

    return null;
  }

  return player;
}


function normalizeType(value) {

  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(
      /[_-]+/g,
      " "
    )
    .replace(
      /\s+/g,
      " "
    );
}


function findAsset(type) {

  const requested =
    normalizeType(type);

  if (!requested) {

    return null;
  }

  return (
    db.assets.find(
      asset => {

        const actual =
          normalizeType(
            asset.type
          );

        return (
          actual === requested ||
          actual.replace(
            /\s/g,
            ""
          ) ===
          requested.replace(
            /\s/g,
            ""
          )
        );
      }
    ) || null
  );
}


function categoryName(value) {

  const valueLower =
    String(value || "")
      .trim()
      .toLowerCase();

  const aliases = {

    businesses:
      "business",

    business:
      "business",

    transportation:
      "transportation",

    transport:
      "transportation",

    concessions:
      "concession",

    concession:
      "concession",

    subsidiaries:
      "subsidiary",

    subsidiary:
      "subsidiary",

    properties:
      "property",

    property:
      "property",

    resources:
      "resource",

    resource:
      "resource",

    investments:
      "investment",

    investment:
      "investment",

    production:
      "production"
  };

  return (
    aliases[valueLower] ||
    valueLower
  );
}


/* =========================================================
   PLAYER ECONOMY
   ========================================================= */

function calculateNetWorth(
  player
) {

  let value =
    Number(player.cash || 0);

  for (
    const owned
    of player.assets || []
  ) {

    const asset =
      findAsset(
        owned.type
      );

    if (!asset) continue;

    value +=
      asset.price *
      owned.quantity;
  }

  return value;
}


function calculateGrossIncome(
  player
) {

  let income = 0;

  for (
    const owned
    of player.assets || []
  ) {

    const asset =
      findAsset(
        owned.type
      );

    if (!asset) continue;

    income +=
      asset.income *
      owned.quantity;
  }

  return income;
}


function calculateMaintenance(
  player
) {

  let maintenance = 0;

  for (
    const owned
    of player.assets || []
  ) {

    const asset =
      findAsset(
        owned.type
      );

    if (!asset) continue;

    maintenance +=
      (asset.maintenance || 0) *
      owned.quantity;
  }

  return maintenance;
}


function calculateTax(
  player
) {

  let tax = 0;

  for (
    const owned
    of player.assets || []
  ) {

    const asset =
      findAsset(
        owned.type
      );

    if (!asset) continue;

    tax +=
      (asset.tax || 0) *
      owned.quantity;
  }

  return tax;
}


function calculateNetIncome(
  player
) {

  return Math.max(
    0,
    calculateGrossIncome(player) -
    calculateMaintenance(player) -
    calculateTax(player)
  );
}


function xpRequiredForLevel(
  level
) {

  return (
    Math.max(
      1,
      Number(level)
    ) *
    GAME.xpPerLevelBase
  );
}


function addXP(
  player,
  amount
) {

  let xp =
    Math.max(
      0,
      Number(amount || 0)
    );

  let levelUps = 0;

  player.xp =
    Number(player.xp || 0);

  player.level =
    Math.max(
      1,
      Number(player.level || 1)
    );

  while (
    xp > 0
  ) {

    const required =
      xpRequiredForLevel(
        player.level
      );

    const remaining =
      required -
      player.xp;

    if (xp >= remaining) {

      xp -= remaining;

      player.xp = 0;

      player.level++;

      levelUps++;

    } else {

      player.xp += xp;

      xp = 0;
    }
  }

  return levelUps;
}


function playerView(
  player
) {

  if (!player) {

    return null;
  }

  const assets =
    player.assets || [];

  const grossIncome =
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

  const netIncome =
    Math.max(
      0,
      grossIncome -
      maintenance -
      tax
    );

  return {

    id:
      player.id,

    playerId:
      player.id,

    username:
      player.username,

    email:
      player.email,

    companyName:
      player.companyName,

    country:
      player.country,

    level:
      player.level,

    xp:
      player.xp,

    xpRequired:
      xpRequiredForLevel(
        player.level
      ),

    cash:
      player.cash,

    gold:
      player.gold,

    netWorth:
      calculateNetWorth(
        player
      ),

    grossIncome,

    maintenance,

    tax,

    netIncome,

    offensiveLevel:
      player.offensiveLevel,

    defense:
      player.defense,

    patriotism:
      player.patriotism,

    prestige:
      player.prestige,

    online:
      true,

    lastIncomeAt:
      player.lastIncomeAt,

    assets
  };
}


/* =========================================================
   INCOME CYCLE
   ========================================================= */

function processIncome(
  player
) {

  if (!player) {

    return 0;
  }

  const now =
    Date.now();

  const last =
    Number(
      player.lastIncomeAt ||
      player.createdAtMs ||
      now
    );

  let cycles =
    Math.floor(
      (now - last) /
      GAME.incomeCycleMs
    );

  if (cycles <= 0) {

    return 0;
  }

  // Protect against extremely large
  // offline rewards.
  cycles =
    Math.min(
      cycles,
      24
    );

  const incomePerCycle =
    calculateNetIncome(
      player
    );

  const total =
    incomePerCycle *
    cycles;

  player.cash += total;

  player.lastIncomeAt =
    last +
    cycles *
    GAME.incomeCycleMs;

  addXP(
    player,
    Math.max(
      1,
      Math.floor(
        total / 10000
      )
    )
  );

  return total;
}


/* =========================================================
   SERVER
   ========================================================= */

const server =
  http.createServer(
    async (
      req,
      res
    ) => {

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
          `http://${
            req.headers.host ||
            "localhost"
          }`
        );

      const path =
        url.pathname;


      const body =
        req.method === "POST" ||
        req.method === "PUT" ||
        req.method === "PATCH"
          ? await parseBody(req)
          : {};


      /* =====================================================
         HEALTH
         ===================================================== */

      if (
        req.method === "GET" &&
        path === "/health"
      ) {

        return send(
          res,
          200,
          {

            ok: true,

            version:
              VERSION,

            service:
              "tycoon-empire",

            players:
              db.players.length,

            assets:
              db.assets.length,

            features: [

              "authentication",

              "players",

              "businesses",

              "transportation",

              "concessions",

              "subsidiaries",

              "properties",

              "investments",

              "resources",

              "production",

              "income-cycles",

              "contracts",

              "bids",

              "alliances",

              "chat",

              "rankings",

              "army",

              "wars",

              "loans",

              "missions"
            ]
          }
        );
      }


      /* =====================================================
         REGISTER
         ===================================================== */

      if (
        req.method === "POST" &&
        path ===
          "/api/auth/register"
      ) {

        const username =
          String(
            body.username || ""
          ).trim();

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


        if (
          !username ||
          !email ||
          !password
        ) {

          return send(
            res,
            400,
            {
              error:
                "username, email and password are required"
            }
          );
        }


        if (
          password.length < 4
        ) {

          return send(
            res,
            400,
            {
              error:
                "password must contain at least 4 characters"
            }
          );
        }


        const emailExists =
          db.players.some(
            p =>
              p.email ===
              email
          );

        if (
          emailExists
        ) {

          return send(
            res,
            409,
            {
              error:
                "email already registered"
            }
          );
        }


        const usernameExists =
          db.players.some(
            p =>
              p.username
                .toLowerCase() ===
              username
                .toLowerCase()
          );

        if (
          usernameExists
        ) {

          return send(
            res,
            409,
            {
              error:
                "username already exists"
            }
          );
        }


        const now =
          Date.now();


        const player = {

          id:
            db.nextPlayerId++,

          username,

          email,

          password:
            hashPassword(
              password
            ),

          companyName:
            username +
            " Corporation",

          country:
            String(
              body.country ||
              "India"
            ),

          level: 1,

          xp: 0,

          cash:
            GAME.startingCash,

          gold:
            GAME.startingGold,

          offensiveLevel: 1,

          defense: 100,

          patriotism: 0,

          prestige: 0,

          assets: [],

          createdAt:
            new Date(
              now
            ).toISOString(),

          createdAtMs:
            now,

          lastIncomeAt:
            now
        };


        db.players.push(
          player
        );


        return send(
          res,
          201,
          {

            ok: true,

            message:
              "account created",

            player:
              playerView(
                player
              )
          }
        );
      }


      /* =====================================================
         LOGIN
         ===================================================== */

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
              p.email ===
                email &&
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


        processIncome(
          player
        );


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

            accessToken:
              token,

            player:
              playerView(
                player
              )
          }
        );
      }


      /* =====================================================
         LOGOUT
         ===================================================== */

      if (
        req.method === "POST" &&
        path ===
          "/api/auth/logout"
      ) {

        const token =
          getToken(req);


        if (token) {

          delete db.sessions[
            token
          ];
        }


        return send(
          res,
          200,
          {
            ok: true
          }
        );
      }


      /* =====================================================
         CURRENT PLAYER
         ===================================================== */

      if (
        req.method === "GET" &&
        path ===
          "/api/players/me"
      ) {

        const player =
          requirePlayer(
            req,
            res
          );

        if (!player)
          return;


        processIncome(
          player
        );


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


      /* =====================================================
         ONLINE PLAYERS
         ===================================================== */

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
                player => {

                  processIncome(
                    player
                  );

                  return playerView(
                    player
                  );
                }
              )
          }
        );
      }


      /* =====================================================
         ASSET CATALOG
         ===================================================== */

      if (
        req.method === "GET" &&
        path ===
          "/api/assets"
      ) {

        const player =
          requirePlayer(
            req,
            res
          );

        if (!player)
          return;


        processIncome(
          player
        );


        const category =
          String(
            url.searchParams.get(
              "category"
            ) || ""
          ).trim();


        const normalizedCategory =
          categoryName(
            category
          );


        const assets =
          category
            ? db.assets.filter(
                a =>
                  a.category ===
                  normalizedCategory
              )
            : db.assets;


        return send(
          res,
          200,
          {

            assets,

            owned:
              player.assets || []
          }
        );
      }


      /* =====================================================
         CATALOG
         ===================================================== */

      if (
        req.method === "GET" &&
        path ===
          "/api/catalog"
      ) {

        const category =
          String(
            url.searchParams.get(
              "category"
            ) || ""
          ).trim();


        const normalized =
          categoryName(
            category
          );


        const assets =
          category
            ? db.assets.filter(
                a =>
                  a.category ===
                  normalized
              )
            : db.assets;


        return send(
          res,
          200,
          {

            version:
              VERSION,

            assets
          }
        );
      }


      /* =====================================================
         BUY ASSET
         ===================================================== */

      if (
        req.method === "POST" &&
        path ===
          "/api/assets/buy"
      ) {

        const player =
          requirePlayer(
            req,
            res
          );

        if (!player)
          return;


        processIncome(
          player
        );


        const requestedType =
          String(
            body.type ||
            body.assetType ||
            body.name ||
            ""
          ).trim();


        if (
          !requestedType
        ) {

          return send(
            res,
            400,
            {
              error:
                "asset type required"
            }
          );
        }


        const asset =
          findAsset(
            requestedType
          );


        if (!asset) {

          return send(
            res,
            404,
            {

              error:
                "asset not found",

              requestedType,

              availableAssets:
                db.assets.map(
                  a => ({

                    id:
                      a.id,

                    category:
                      a.category,

                    type:
                      a.type,

                    price:
                      a.price
                  })
                )
            }
          );
        }


        let quantity =
          Number(
            body.quantity ||
            body.amount ||
            1
          );


        if (
          !Number.isFinite(
            quantity
          )
        ) {

          quantity = 1;
        }


        quantity =
          Math.floor(
            quantity
          );


        if (
          quantity < 1
        ) {

          quantity = 1;
        }


        if (
          quantity >
          GAME.maxBuyQuantity
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


        if (
          player.level <
          asset.unlockLevel
        ) {

          return send(
            res,
            400,
            {

              error:
                "asset locked",

              requiredLevel:
                asset.unlockLevel,

              level:
                player.level
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

              price:
                asset.price,

              quantity,

              cost
            }
          );
        }


        player.cash -=
          cost;


        if (!player.assets) {

          player.assets = [];
        }


        const existing =
          player.assets.find(
            owned =>
              normalizeType(
                owned.type
              ) ===
              normalizeType(
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

            category:
              asset.category,

            quantity
          });
        }


        const xpGain =
          Math.max(
            1,
            Math.floor(
              cost / 10000
            )
          );


        const levelUps =
          addXP(
            player,
            xpGain
          );


        return send(
          res,
          200,
          {

            ok: true,

            message:
              "purchase successful",

            asset: {

              id:
                asset.id,

              category:
                asset.category,

              type:
                asset.type,

              price:
                asset.price,

              income:
                asset.income
            },

            quantity,

            cost,

            xpGained:
              xpGain,

            levelUps,

            cash:
              player.cash,

            player:
              playerView(
                player
              )
          }
        );
      }


      /* =====================================================
         COLLECT INCOME
         ===================================================== */

      if (
        req.method === "POST" &&
        path ===
          "/api/assets/collect"
      ) {

        const player =
          requirePlayer(
            req,
            res
          );

        if (!player)
          return;


        const now =
          Date.now();


        const last =
          Number(
            player.lastIncomeAt ||
            player.createdAtMs ||
            now
          );


        let cycles =
          Math.floor(
            (
              now - last
            ) /
            GAME.incomeCycleMs
          );


        if (
          cycles <= 0
        ) {

          return send(
            res,
            200,
            {

              ok: true,

              income: 0,

              cycles: 0,

              cash:
                player.cash,

              player:
                playerView(
                  player
                )
            }
          );
        }


        cycles =
          Math.min(
            cycles,
            24
          );


        const incomePerCycle =
          calculateNetIncome(
            player
          );


        const income =
          incomePerCycle *
          cycles;


        player.cash +=
          income;


        player.lastIncomeAt =
          last +
          cycles *
          GAME.incomeCycleMs;


        const xp =
          Math.max(
            1,
            Math.floor(
              income / 10000
            )
          );


        addXP(
          player,
          xp
        );


        return send(
          res,
          200,
          {

            ok: true,

            income,

            cycles,

            incomePerCycle,

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

            cash:
              player.cash,

            player:
              playerView(
                player
              )
          }
        );
      }


      /* =====================================================
         INCOME SNAPSHOT
         ===================================================== */

      if (
        req.method === "GET" &&
        path ===
          "/api/assets/income"
      ) {

        const player =
          requirePlayer(
            req,
            res
          );

        if (!player)
          return;


        processIncome(
          player
        );


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
              calculateNetIncome(
                player
              ),

            cash:
              player.cash,

            player:
              playerView(
                player
              )
          }
        );
      }


      /* =====================================================
         SELL ASSET
         ===================================================== */

      if (
        req.method === "POST" &&
        path ===
          "/api/assets/sell"
      ) {

        const player =
          requirePlayer(
            req,
            res
          );

        if (!player)
          return;


        processIncome(
          player
        );


        const requestedType =
          String(
            body.type ||
            body.assetType ||
            body.name ||
            ""
          ).trim();


        const asset =
          findAsset(
            requestedType
          );


        if (!asset) {

          return send(
            res,
            404,
            {
              error:
                "asset not found"
            }
          );
        }


        let quantity =
          Math.floor(
            Number(
              body.quantity ||
              1
            )
          );


        if (
          quantity < 1
        ) {

          quantity = 1;
        }


        const owned =
          (
            player.assets ||
            []
          ).find(
            x =>
              normalizeType(
                x.type
              ) ===
              normalizeType(
                asset.type
              )
          );


        if (
          !owned ||
          owned.quantity <
            quantity
        ) {

          return send(
            res,
            400,
            {

              error:
                "asset not owned",

              owned:
                owned
                  ? owned.quantity
                  : 0
            }
          );
        }


        const value =
          Math.floor(
            asset.price *
            quantity *
            GAME.sellMultiplier
          );


        owned.quantity -=
          quantity;


        if (
          owned.quantity <= 0
        ) {

          player.assets =
            player.assets.filter(
              x =>
                normalizeType(
                  x.type
                ) !==
                normalizeType(
                  asset.type
                )
            );
        }


        player.cash +=
          value;


        return send(
          res,
          200,
          {

            ok: true,

            type:
              asset.type,

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


      /* =====================================================
         CONTRACTS
         ===================================================== */

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
              db.contracts
          }
        );
      }


      if (
        req.method === "GET" &&
        path ===
          "/api/contracts/running"
      ) {

        const player =
          requirePlayer(
            req,
            res
          );

        if (!player)
          return;


        return send(
          res,
          200,
          {

            contracts:
              db.contracts.filter(
                c =>
                  c.creatorId ===
                  player.id ||
                  c.status ===
                  "running"
              )
          }
        );
      }


      if (
        req.method === "GET" &&
        path ===
          "/api/contracts/bids/ranking"
      ) {

        const contractId =
          Number(
            url.searchParams.get(
              "contractId"
            )
          );


        const bids =
          contractId
            ? db.bids.filter(
                b =>
                  b.contractId ===
                  contractId
              )
            : db.bids;


        return send(
          res,
          200,
          {
            bids:
              bids.sort(
                (
                  a,
                  b
                ) =>
                  a.amount -
                  b.amount
              )
          }
        );
      }


      if (
        req.method === "POST" &&
        path ===
          "/api/contracts"
      ) {

        const player =
          requirePlayer(
            req,
            res
          );

        if (!player)
          return;


        const contract = {

          id:
            db.nextContractId++,

          creatorId:
            player.id,

          creator:
            player.username,

          title:
            String(
              body.title ||
              "Business Contract"
            ),

          description:
            String(
              body.description ||
              ""
            ),

          quantity:
            Math.max(
              1,
              Number(
                body.quantity ||
                1
              )
            ),

          value:
            Math.max(
              0,
              Number(
                body.value ||
                0
              )
            ),

          status:
            "open",

          createdAt:
            new Date()
              .toISOString()
        };


        db.contracts.push(
          contract
        );


        return send(
          res,
          201,
          {

            ok: true,

            contract
          }
        );
      }


      if (
        req.method === "POST" &&
        path ===
          "/api/contracts/bid"
      ) {

        const player =
          requirePlayer(
            req,
            res
          );

        if (!player)
          return;


        const contract =
          db.contracts.find(
            c =>
              c.id ===
              Number(
                body.contractId
              )
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

          amount,

          createdAt:
            new Date()
              .toISOString()
        };


        db.bids.push(
          bid
        );


        return send(
          res,
          201,
          {

            ok: true,

            bid
          }
        );
      }


      /* =====================================================
         ALLIANCES
         ===================================================== */

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
        req.method === "GET" &&
        path ===
          "/api/alliances/rankings"
      ) {

        const rankings =
          db.alliances
            .map(
              alliance => ({

                ...alliance,

                memberCount:
                  alliance.members
                    .length,

                power:
                  alliance.members
                    .reduce(
                      (
                        total,
                        playerId
                      ) => {

                        const player =
                          db.players.find(
                            p =>
                              p.id ===
                              playerId
                          );

                        return (
                          total +
                          (
                            player
                              ? calculateNetWorth(
                                  player
                                )
                              : 0
                          )
                        );
                      },
                      0
                    )
              })
            )
            .sort(
              (
                a,
                b
              ) =>
                b.power -
                a.power
            );


        return send(
          res,
          200,
          {
            rankings
          }
        );
      }


      if (
        req.method === "POST" &&
        path ===
          "/api/alliances/create"
      ) {

        const player =
          requirePlayer(
            req,
            res
          );

        if (!player)
          return;


        const name =
          String(
            body.name ||
            "New Alliance"
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

          ownerId:
            player.id,

          members: [
            player.id
          ],

          createdAt:
            new Date()
              .toISOString()
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


      if (
        req.method === "POST" &&
        path ===
          "/api/alliances/join"
      ) {

        const player =
          requirePlayer(
            req,
            res
          );

        if (!player)
          return;


        const alliance =
          db.alliances.find(
            a =>
              a.id ===
              Number(
                body.allianceId
              )
          );


        if (!alliance) {

          return send(
            res,
            404,
            {
              error:
                "alliance not found"
            }
          );
        }


        if (
          !alliance.members.includes(
            player.id
          )
        ) {

          alliance.members.push(
            player.id
          );
        }


        return send(
          res,
          200,
          {

            ok: true,

            alliance
          }
        );
      }


      if (
        req.method === "POST" &&
        path ===
          "/api/alliances/leave"
      ) {

        const player =
          requirePlayer(
            req,
            res
          );

        if (!player)
          return;


        const alliance =
          db.alliances.find(
            a =>
              a.id ===
              Number(
                body.allianceId
              )
          );


        if (!alliance) {

          return send(
            res,
            404,
            {
              error:
                "alliance not found"
            }
          );
        }


        alliance.members =
          alliance.members.filter(
            id =>
              id !==
              player.id
          );


        return send(
          res,
          200,
          {

            ok: true,

            alliance
          }
        );
      }


      /* =====================================================
         CHAT
         ===================================================== */

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

        const player =
          requirePlayer(
            req,
            res
          );

        if (!player)
          return;


        const messageText =
          String(
            body.message ||
            ""
          ).trim();


        if (!messageText) {

          return send(
            res,
            400,
            {
              error:
                "message required"
            }
          );
        }


        const message = {

          id:
            db.nextMessageId++,

          playerId:
            player.id,

          username:
            player.username,

          message:
            messageText.slice(
              0,
              GAME.maxChatLength
            ),

          createdAt:
            new Date()
              .toISOString()
        };


        db.chat.push(
          message
        );


        return send(
          res,
          201,
          {

            ok: true,

            message
          }
        );
      }


      /* =====================================================
         RANKINGS
         ===================================================== */

      if (
        req.method === "GET" &&
        path ===
          "/api/rankings"
      ) {

        const rankings =
          db.players
            .map(
              player => {

                processIncome(
                  player
                );

                return playerView(
                  player
                );
              }
            )
            .sort(
              (
                a,
                b
              ) =>
                b.netWorth -
                a.netWorth
            )
            .map(
              (
                player,
                index
              ) => ({

                rank:
                  index + 1,

                ...player
              })
            );


        return send(
          res,
          200,
          {
            rankings
          }
        );
      }


      /* =====================================================
         ARMY
         ===================================================== */

      if (
        req.method === "GET" &&
        path ===
          "/api/army"
      ) {

        const player =
          requirePlayer(
            req,
            res
          );

        if (!player)
          return;


        return send(
          res,
          200,
          {

            army: {

              offensiveLevel:
                player.offensiveLevel,

              defense:
                player.defense,

              patriotism:
                player.patriotism
            }
          }
        );
      }


      if (
        req.method === "POST" &&
        path ===
          "/api/army/update"
      ) {

        const player =
          requirePlayer(
            req,
            res
          );

        if (!player)
          return;


        player.offensiveLevel =
          Math.max(
            1,
            Number(
              body.offensiveLevel ||
              player.offensiveLevel
            )
          );


        player.defense =
          Math.max(
            0,
            Number(
              body.defense ||
              player.defense
            )
          );


        player.patriotism =
          Math.max(
            0,
            Number(
              body.patriotism ||
              player.patriotism
            )
          );


        return send(
          res,
          200,
          {

            ok: true,

            army: {

              offensiveLevel:
                player.offensiveLevel,

              defense:
                player.defense,

              patriotism:
                player.patriotism
            }
          }
        );
      }


      /* =====================================================
         WARS
         ===================================================== */

      if (
        req.method === "GET" &&
        path ===
          "/api/wars"
      ) {

        return send(
          res,
          200,
          {
            wars:
              db.wars
          }
        );
      }


      if (
        req.method === "POST" &&
        path ===
          "/api/wars/attack"
      ) {

        const attacker =
          requirePlayer(
            req,
            res
          );

        if (!attacker)
          return;


        const target =
          db.players.find(
            p =>
              p.id ===
              Number(
                body.targetId
              )
          );


        if (!target) {

          return send(
            res,
            404,
            {
              error:
                "target not found"
            }
          );
        }


        if (
          target.id ===
          attacker.id
        ) {

          return send(
            res,
            400,
            {
              error:
                "cannot attack yourself"
            }
          );
        }


        const attackerPower =
          attacker.offensiveLevel *
            100 +
          Math.random() *
            100;


        const defenderPower =
          target.defense +
          Math.random() *
            100;


        const attackerWon =
          attackerPower >=
          defenderPower;


        const war = {

          id:
            db.nextWarId++,

          attackerId:
            attacker.id,

          defenderId:
            target.id,

          attackerPower,

          defenderPower,

          attackerWon,

          createdAt:
            new Date()
              .toISOString()
        };


        db.wars.push(
          war
        );


        return send(
          res,
          200,
          {

            ok: true,

            result:
              war
          }
        );
      }


      /* =====================================================
         LOANS
         ===================================================== */

      if (
        req.method === "GET" &&
        path ===
          "/api/loans"
      ) {

        const player =
          requirePlayer(
            req,
            res
          );

        if (!player)
          return;


        return send(
          res,
          200,
          {

            loans:
              db.loans.filter(
                loan =>
                  loan.playerId ===
                  player.id
              )
          }
        );
      }


      if (
        req.method === "POST" &&
        path ===
          "/api/loans/take"
      ) {

        const player =
          requirePlayer(
            req,
            res
          );

        if (!player)
          return;


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
                "invalid loan amount"
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
            amount * 1.10,

          createdAt:
            new Date()
              .toISOString()
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


      /* =====================================================
         MISSIONS
         ===================================================== */

      if (
        req.method === "GET" &&
        path ===
          "/api/missions"
      ) {

        const player =
          requirePlayer(
            req,
            res
          );

        if (!player)
          return;


        const ownedCount =
          (
            player.assets ||
            []
          ).reduce(
            (
              total,
              asset
            ) =>
              total +
              asset.quantity,
            0
          );


        return send(
          res,
          200,
          {

            missions: [

              {

                id: 1,

                title:
                  "Buy your first business",

                reward:
                  1000,

                completed:
                  ownedCount >= 1
              },

              {

                id: 2,

                title:
                  "Reach level 2",

                reward:
                  5000,

                completed:
                  player.level >= 2
              },

              {

                id: 3,

                title:
                  "Collect income",

                reward:
                  2500,

                completed:
                  false
              },

              {

                id: 4,

                title:
                  "Own 10 assets",

                reward:
                  10000,

                completed:
                  ownedCount >= 10
              },

              {

                id: 5,

                title:
                  "Reach $1,000,000 net worth",

                reward:
                  25000,

                completed:
                  calculateNetWorth(
                    player
                  ) >=
                  1000000
              }
            ]
          }
        );
      }


      /* =====================================================
         COUNTRIES
         ===================================================== */

      if (
        req.method === "GET" &&
        path ===
          "/api/countries"
      ) {

        return send(
          res,
          200,
          {

            countries: [

              {
                id: 1,
                name: "India"
              },

              {
                id: 2,
                name: "United States"
              },

              {
                id: 3,
                name: "United Kingdom"
              },

              {
                id: 4,
                name: "Germany"
              },

              {
                id: 5,
                name: "France"
              },

              {
                id: 6,
                name: "Japan"
              },

              {
                id: 7,
                name: "China"
              },

              {
                id: 8,
                name: "Australia"
              },

              {
                id: 9,
                name: "Canada"
              },

              {
                id: 10,
                name: "Brazil"
              }
            ]
          }
        );
      }


      /* =====================================================
         UNKNOWN ENDPOINT
         ===================================================== */

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


/* =========================================================
   START SERVER
   ========================================================= */

server.listen(
  PORT,
  () => {

    console.log(
      `Tycoon Empire server v${VERSION} running on port ${PORT}`
    );

    console.log(
      `Assets loaded: ${db.assets.length}`
    );
  }
);
