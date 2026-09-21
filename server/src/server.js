const http = require("http");
const crypto = require("crypto");

const PORT = process.env.PORT || 10000;
const VERSION = "0.5.1";

const db = {
  players: [],
  assets: [],
  contracts: [],
  alliances: [],
  allianceMembers: [],
  wars: [],
  chat: [],
  events: [],
  loans: [],
  sessions: {},
  nextPlayerId: 1,
  nextAssetId: 1,
  nextContractId: 1,
  nextAllianceId: 1,
  nextWarId: 1,
  nextMessageId: 1
};

/* =========================================================
   ASSET CATALOG
   ========================================================= */

const catalog = [
  // Businesses
  ["business", "Pub", 50000, 350],
  ["business", "Dance Club", 100000, 750],
  ["business", "Coffee Shop", 75000, 550],
  ["business", "Restaurant", 150000, 1100],
  ["business", "Movie Theater", 300000, 2100],
  ["business", "Mall", 1000000, 7500],

  // Transportation
  ["transportation", "Taxi", 25000, 200],
  ["transportation", "Bus", 100000, 850],
  ["transportation", "Train", 500000, 4500],
  ["transportation", "VIP Limousine", 250000, 2200],
  ["transportation", "Passenger Plane", 2500000, 22000],
  ["transportation", "Cargo Plane", 3500000, 30000],
  ["transportation", "Cargo Ship", 5000000, 42000],
  ["transportation", "Passenger Ship", 7500000, 60000],

  // Concessions
  ["concession", "Ground Transport", 150000, 1200],
  ["concession", "Commerce", 300000, 2500],
  ["concession", "Leisure", 500000, 4000],
  ["concession", "Airlines", 5000000, 40000],
  ["concession", "Sea Lines", 7500000, 60000],
  ["concession", "Real Estate", 10000000, 90000],

  // Properties
  ["property", "Small Office", 250000, 1500],
  ["property", "Corporate Office", 750000, 5000],
  ["property", "Headquarters", 2500000, 18000],
  ["property", "Luxury Hotel", 5000000, 40000],

  // Resources
  ["resource", "Oil", 1000000, 8000],
  ["resource", "Gold", 1500000, 12000],
  ["resource", "Gems", 2500000, 20000],
  ["resource", "Minerals", 750000, 6000]
];

for (const item of catalog) {
  db.assets.push({
    id: db.nextAssetId++,
    category: item[0],
    type: item[1],
    price: item[2],
    income: item[3],
    description: "Purchase and operate " + item[1]
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
  return crypto.randomBytes(32).toString("hex");
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
        resolve(JSON.parse(body));
      } catch {
        resolve({});
      }
    });
  });
}

function send(res, status, data) {
  const output = JSON.stringify(data);

  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization",
    "Access-Control-Allow-Methods":
      "GET,POST,PUT,DELETE,OPTIONS"
  });

  res.end(output);
}

function getToken(req) {
  const header = req.headers.authorization || "";

  if (!header.startsWith("Bearer ")) {
    return "";
  }

  return header.substring(7).trim();
}

function getPlayer(req) {
  const token = getToken(req);

  if (!token) {
    return null;
  }

  const playerId = db.sessions[token];

  if (!playerId) {
    return null;
  }

  return db.players.find(
    p => p.id === playerId
  ) || null;
}

function requirePlayer(req, res) {
  const player = getPlayer(req);

  if (!player) {
    send(res, 401, {
      error: "unauthorized"
    });

    return null;
  }

  return player;
}

function playerView(player) {
  if (!player) {
    return null;
  }

  const assets = player.assets || [];

  let netWorth = player.cash;

  for (const owned of assets) {
    const asset = db.assets.find(
      a =>
        a.type.toLowerCase() ===
        String(owned.type).toLowerCase()
    );

    if (asset) {
      netWorth += asset.price * owned.quantity;
    }
  }

  return {
    id: player.id,
    playerId: player.id,
    username: player.username,
    email: player.email,
    companyName: player.companyName,
    country: player.country,
    level: player.level,
    xp: player.xp,
    cash: player.cash,
    gold: player.gold,
    netWorth,
    offensiveLevel: player.offensiveLevel,
    defense: player.defense,
    online: true,
    assets: assets
  };
}

function normalizeType(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function findAsset(type) {
  const requested = normalizeType(type);

  if (!requested) {
    return null;
  }

  return db.assets.find(asset => {
    const actual = normalizeType(asset.type);

    return (
      actual === requested ||
      actual.replace(/\s/g, "") ===
        requested.replace(/\s/g, "")
    );
  }) || null;
}

/* =========================================================
   SERVER
   ========================================================= */

const server = http.createServer(
  async (req, res) => {

    if (req.method === "OPTIONS") {
      return send(res, 204, {});
    }

    const url = new URL(
      req.url,
      `http://${req.headers.host || "localhost"}`
    );

    const path = url.pathname;

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
      return send(res, 200, {
        ok: true,
        version: VERSION,
        service: "tycoon-empire",
        players: db.players.length,
        assets: db.assets.length,
        features: [
          "authentication",
          "players",
          "businesses",
          "transportation",
          "concessions",
          "properties",
          "resources",
          "contracts",
          "alliances",
          "chat",
          "rankings",
          "army",
          "wars",
          "loans",
          "missions"
        ]
      });
    }

    /* =====================================================
       REGISTER
       ===================================================== */

    if (
      req.method === "POST" &&
      path === "/api/auth/register"
    ) {

      const username =
        String(body.username || "").trim();

      const email =
        String(body.email || "")
          .trim()
          .toLowerCase();

      const password =
        String(body.password || "");

      if (!username || !email || !password) {
        return send(res, 400, {
          error: "username, email and password are required"
        });
      }

      if (password.length < 4) {
        return send(res, 400, {
          error: "password must contain at least 4 characters"
        });
      }

      const emailExists = db.players.some(
        p => p.email === email
      );

      if (emailExists) {
        return send(res, 409, {
          error: "email already registered"
        });
      }

      const usernameExists = db.players.some(
        p =>
          p.username.toLowerCase() ===
          username.toLowerCase()
      );

      if (usernameExists) {
        return send(res, 409, {
          error: "username already exists"
        });
      }

      const player = {
        id: db.nextPlayerId++,
        username,
        email,
        password: hashPassword(password),

        companyName:
          username + " Corporation",

        country: "India",

        level: 1,
        xp: 0,

        cash: 100000,
        gold: 100,

        offensiveLevel: 1,
        defense: 100,

        assets: [],

        createdAt:
          new Date().toISOString()
      };

      db.players.push(player);

      return send(res, 201, {
        ok: true,
        message: "account created",
        player: playerView(player)
      });
    }

    /* =====================================================
       LOGIN
       ===================================================== */

    if (
      req.method === "POST" &&
      path === "/api/auth/login"
    ) {

      const email =
        String(body.email || "")
          .trim()
          .toLowerCase();

      const password =
        String(body.password || "");

      const player = db.players.find(
        p =>
          p.email === email &&
          p.password === hashPassword(password)
      );

      if (!player) {
        return send(res, 401, {
          error: "invalid email or password"
        });
      }

      const token = createToken();

      db.sessions[token] = player.id;

      return send(res, 200, {
        ok: true,
        token,
        accessToken: token,
        player: playerView(player)
      });
    }

    /* =====================================================
       LOGOUT
       ===================================================== */

    if (
      req.method === "POST" &&
      path === "/api/auth/logout"
    ) {

      const token = getToken(req);

      if (token) {
        delete db.sessions[token];
      }

      return send(res, 200, {
        ok: true
      });
    }

    /* =====================================================
       CURRENT PLAYER
       ===================================================== */

    if (
      req.method === "GET" &&
      path === "/api/players/me"
    ) {

      const player =
        requirePlayer(req, res);

      if (!player) return;

      return send(res, 200, {
        player: playerView(player)
      });
    }

    /* =====================================================
       ONLINE PLAYERS
       ===================================================== */

    if (
      req.method === "GET" &&
      path === "/api/players/online"
    ) {

      return send(res, 200, {
        players: db.players.map(playerView)
      });
    }

    /* =====================================================
       ASSET CATALOG
       ===================================================== */

    if (
      req.method === "GET" &&
      path === "/api/assets"
    ) {

      const player =
        requirePlayer(req, res);

      if (!player) return;

      const category =
        String(
          url.searchParams.get("category") || ""
        ).trim();

      const assets =
        category
          ? db.assets.filter(
              a =>
                a.category.toLowerCase() ===
                category.toLowerCase()
            )
          : db.assets;

      return send(res, 200, {
        assets,
        owned: player.assets || []
      });
    }

    /* =====================================================
       BUY ASSET
       ===================================================== */

    if (
      req.method === "POST" &&
      path === "/api/assets/buy"
    ) {

      const player =
        requirePlayer(req, res);

      if (!player) return;

      const requestedType =
        String(
          body.type ||
          body.assetType ||
          body.name ||
          ""
        ).trim();

      if (!requestedType) {
        return send(res, 400, {
          error: "asset type required"
        });
      }

      const asset =
        findAsset(requestedType);

      if (!asset) {
        return send(res, 404, {
          error: "asset not found",
          requestedType,
          availableAssets:
            db.assets.map(a => ({
              id: a.id,
              category: a.category,
              type: a.type,
              price: a.price
            }))
        });
      }

      let quantity =
        Number(
          body.quantity ||
          body.amount ||
          1
        );

      if (!Number.isFinite(quantity)) {
        quantity = 1;
      }

      quantity =
        Math.floor(quantity);

      if (quantity < 1) {
        quantity = 1;
      }

      if (quantity > 100000) {
        return send(res, 400, {
          error: "quantity too large"
        });
      }

      const cost =
        asset.price * quantity;

      if (player.cash < cost) {
        return send(res, 400, {
          error: "insufficient cash",
          cash: player.cash,
          price: asset.price,
          quantity,
          cost
        });
      }

      player.cash -= cost;

      if (!player.assets) {
        player.assets = [];
      }

      const existing =
        player.assets.find(
          owned =>
            normalizeType(owned.type) ===
            normalizeType(asset.type)
        );

      if (existing) {
        existing.quantity += quantity;
      } else {
        player.assets.push({
          type: asset.type,
          quantity
        });
      }

      player.xp +=
        Math.max(1, Math.floor(cost / 10000));

      while (
        player.xp >= player.level * 100
      ) {
        player.xp -=
          player.level * 100;

        player.level++;
      }

      return send(res, 200, {
        ok: true,
        message: "purchase successful",

        asset: {
          id: asset.id,
          category: asset.category,
          type: asset.type,
          price: asset.price,
          income: asset.income
        },

        quantity,
        cost,
        cash: player.cash,

        player: playerView(player)
      });
    }

    /* =====================================================
       COLLECT INCOME
       ===================================================== */

    if (
      req.method === "POST" &&
      path === "/api/assets/collect"
    ) {

      const player =
        requirePlayer(req, res);

      if (!player) return;

      let income = 0;

      for (const owned of player.assets || []) {

        const asset =
          findAsset(owned.type);

        if (!asset) continue;

        income +=
          asset.income *
          owned.quantity;
      }

      player.cash += income;

      return send(res, 200, {
        ok: true,
        income,
        cash: player.cash,
        player: playerView(player)
      });
    }

    /* =====================================================
       SELL ASSET
       ===================================================== */

    if (
      req.method === "POST" &&
      path === "/api/assets/sell"
    ) {

      const player =
        requirePlayer(req, res);

      if (!player) return;

      const requestedType =
        String(
          body.type ||
          body.assetType ||
          ""
        ).trim();

      const asset =
        findAsset(requestedType);

      if (!asset) {
        return send(res, 404, {
          error: "asset not found"
        });
      }

      let quantity =
        Math.floor(
          Number(body.quantity || 1)
        );

      if (quantity < 1) {
        quantity = 1;
      }

      const owned =
        (player.assets || []).find(
          x =>
            normalizeType(x.type) ===
            normalizeType(asset.type)
        );

      if (
        !owned ||
        owned.quantity < quantity
      ) {
        return send(res, 400, {
          error: "asset not owned",
          owned: owned
            ? owned.quantity
            : 0
        });
      }

      const value =
        Math.floor(
          asset.price *
          quantity *
          0.8
        );

      owned.quantity -= quantity;

      if (owned.quantity <= 0) {
        player.assets =
          player.assets.filter(
            x =>
              normalizeType(x.type) !==
              normalizeType(asset.type)
          );
      }

      player.cash += value;

      return send(res, 200, {
        ok: true,
        type: asset.type,
        quantity,
        value,
        cash: player.cash,
        player: playerView(player)
      });
    }

    /* =====================================================
       CONTRACTS
       ===================================================== */

    if (
      req.method === "GET" &&
      path === "/api/contracts"
    ) {

      return send(res, 200, {
        contracts: db.contracts
      });
    }

    if (
      req.method === "POST" &&
      path === "/api/contracts"
    ) {

      const player =
        requirePlayer(req, res);

      if (!player) return;

      const contract = {
        id: db.nextContractId++,
        creatorId: player.id,
        title:
          String(body.title || "Business Contract"),
        quantity:
          Number(body.quantity || 1),
        value:
          Number(body.value || 0),
        status: "open",
        createdAt:
          new Date().toISOString()
      };

      db.contracts.push(contract);

      return send(res, 201, {
        ok: true,
        contract
      });
    }

    /* =====================================================
       CONTRACT BIDS
       ===================================================== */

    if (
      req.method === "POST" &&
      path === "/api/contracts/bid"
    ) {

      const player =
        requirePlayer(req, res);

      if (!player) return;

      const contract =
        db.contracts.find(
          c =>
            c.id ===
            Number(body.contractId)
        );

      if (!contract) {
        return send(res, 404, {
          error: "contract not found"
        });
      }

      return send(res, 200, {
        ok: true,
        message: "bid submitted",
        contractId: contract.id,
        playerId: player.id,
        amount:
          Number(body.amount || 0)
      });
    }

    /* =====================================================
       ALLIANCES
       ===================================================== */

    if (
      req.method === "GET" &&
      path === "/api/alliances"
    ) {

      return send(res, 200, {
        alliances: db.alliances
      });
    }

    if (
      req.method === "POST" &&
      path === "/api/alliances/create"
    ) {

      const player =
        requirePlayer(req, res);

      if (!player) return;

      const alliance = {
        id: db.nextAllianceId++,
        name:
          String(body.name || "New Alliance"),
        ownerId: player.id,
        members: [player.id],
        createdAt:
          new Date().toISOString()
      };

      db.alliances.push(alliance);

      return send(res, 201, {
        ok: true,
        alliance
      });
    }

    if (
      req.method === "POST" &&
      path === "/api/alliances/join"
    ) {

      const player =
        requirePlayer(req, res);

      if (!player) return;

      const alliance =
        db.alliances.find(
          a =>
            a.id ===
            Number(body.allianceId)
        );

      if (!alliance) {
        return send(res, 404, {
          error: "alliance not found"
        });
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

      return send(res, 200, {
        ok: true,
        alliance
      });
    }

    /* =====================================================
       CHAT
       ===================================================== */

    if (
      req.method === "GET" &&
      path === "/api/chat"
    ) {

      return send(res, 200, {
        messages: db.chat.slice(-100)
      });
    }

    if (
      req.method === "POST" &&
      path === "/api/chat"
    ) {

      const player =
        requirePlayer(req, res);

      if (!player) return;

      const message = {
        id: db.nextMessageId++,
        playerId: player.id,
        username: player.username,
        message:
          String(body.message || "").slice(0, 1000),
        createdAt:
          new Date().toISOString()
      };

      db.chat.push(message);

      return send(res, 201, {
        ok: true,
        message
      });
    }

    /* =====================================================
       RANKINGS
       ===================================================== */

    if (
      req.method === "GET" &&
      path === "/api/rankings"
    ) {

      const rankings =
        db.players
          .map(playerView)
          .sort(
            (a, b) =>
              b.netWorth - a.netWorth
          )
          .map((player, index) => ({
            rank: index + 1,
            ...player
          }));

      return send(res, 200, {
        rankings
      });
    }

    /* =====================================================
       ARMY
       ===================================================== */

    if (
      req.method === "GET" &&
      path === "/api/army"
    ) {

      const player =
        requirePlayer(req, res);

      if (!player) return;

      return send(res, 200, {
        army: {
          offensiveLevel:
            player.offensiveLevel,
          defense:
            player.defense
        }
      });
    }

    if (
      req.method === "POST" &&
      path === "/api/army/update"
    ) {

      const player =
        requirePlayer(req, res);

      if (!player) return;

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

      return send(res, 200, {
        ok: true,
        army: {
          offensiveLevel:
            player.offensiveLevel,
          defense:
            player.defense
        }
      });
    }

    /* =====================================================
       WARS
       ===================================================== */

    if (
      req.method === "GET" &&
      path === "/api/wars"
    ) {

      return send(res, 200, {
        wars: db.wars
      });
    }

    if (
      req.method === "POST" &&
      path === "/api/wars/attack"
    ) {

      const attacker =
        requirePlayer(req, res);

      if (!attacker) return;

      const target =
        db.players.find(
          p =>
            p.id ===
            Number(body.targetId)
        );

      if (!target) {
        return send(res, 404, {
          error: "target not found"
        });
      }

      const attackerPower =
        attacker.offensiveLevel * 100 +
        Math.random() * 100;

      const defenderPower =
        target.defense +
        Math.random() * 100;

      const attackerWon =
        attackerPower >= defenderPower;

      const war = {
        id: db.nextWarId++,
        attackerId: attacker.id,
        defenderId: target.id,
        attackerWon,
        createdAt:
          new Date().toISOString()
      };

      db.wars.push(war);

      return send(res, 200, {
        ok: true,
        result: war
      });
    }

    /* =====================================================
       LOANS
       ===================================================== */

    if (
      req.method === "GET" &&
      path === "/api/loans"
    ) {

      const player =
        requirePlayer(req, res);

      if (!player) return;

      return send(res, 200, {
        loans:
          db.loans.filter(
            l =>
              l.playerId === player.id
          )
      });
    }

    if (
      req.method === "POST" &&
      path === "/api/loans/take"
    ) {

      const player =
        requirePlayer(req, res);

      if (!player) return;

      const amount =
        Number(body.amount || 0);

      if (
        !Number.isFinite(amount) ||
        amount <= 0
      ) {
        return send(res, 400, {
          error: "invalid loan amount"
        });
      }

      const loan = {
        id:
          db.loans.length + 1,
        playerId: player.id,
        amount,
        remaining:
          amount * 1.1,
        createdAt:
          new Date().toISOString()
      };

      db.loans.push(loan);

      player.cash += amount;

      return send(res, 200, {
        ok: true,
        loan,
        cash: player.cash
      });
    }

    /* =====================================================
       MISSIONS
       ===================================================== */

    if (
      req.method === "GET" &&
      path === "/api/missions"
    ) {

      const player =
        requirePlayer(req, res);

      if (!player) return;

      return send(res, 200, {
        missions: [
          {
            id: 1,
            title: "Buy your first business",
            reward: 1000,
            completed:
              (player.assets || []).length > 0
          },
          {
            id: 2,
            title: "Reach level 2",
            reward: 5000,
            completed:
              player.level >= 2
          },
          {
            id: 3,
            title: "Collect income",
            reward: 2500,
            completed: false
          }
        ]
      });
    }

    /* =====================================================
       UNKNOWN ENDPOINT
       ===================================================== */

    return send(res, 404, {
      error: "endpoint not found",
      path
    });
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
  }
);
