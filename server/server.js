const http = require("http");
const crypto = require("crypto");
const { Pool } = require("pg");

const PORT = process.env.PORT || 8080;
const VERSION = "2.0.0";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is missing.");
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

const HOUR = 60 * 60 * 1000;
const MAX_OFFLINE_HOURS = 24;

const ASSETS = [
  { id: "taxi", name: "Taxi", category: "transportation", price: 5000, income: 180, maintenance: 40, tax: 15, xp: 5 },
  { id: "bus", name: "Bus", category: "transportation", price: 25000, income: 850, maintenance: 180, tax: 70, xp: 12 },
  { id: "truck", name: "Truck", category: "transportation", price: 50000, income: 1700, maintenance: 350, tax: 140, xp: 18 },
  { id: "cargo_ship", name: "Cargo Ship", category: "transportation", price: 500000, income: 15000, maintenance: 3200, tax: 1200, xp: 55 },
  { id: "container_ship", name: "Container Ship", category: "transportation", price: 1500000, income: 42000, maintenance: 8500, tax: 3500, xp: 100 },
  { id: "airliner", name: "Airliner", category: "transportation", price: 5000000, income: 130000, maintenance: 28000, tax: 10000, xp: 180 },

  { id: "grocery", name: "Grocery Store", category: "businesses", price: 10000, income: 420, maintenance: 80, tax: 35, xp: 8 },
  { id: "restaurant", name: "Restaurant", category: "businesses", price: 30000, income: 1250, maintenance: 240, tax: 100, xp: 15 },
  { id: "factory", name: "Factory", category: "businesses", price: 150000, income: 6200, maintenance: 1300, tax: 550, xp: 35 },
  { id: "mall", name: "Shopping Mall", category: "businesses", price: 750000, income: 30000, maintenance: 6500, tax: 2700, xp: 90 },
  { id: "pub", name: "Pub", category: "businesses", price: 50000, income: 2100, maintenance: 420, tax: 170, xp: 22 },
  { id: "hotel", name: "Hotel", category: "businesses", price: 1000000, income: 42000, maintenance: 9000, tax: 3800, xp: 120 },

  { id: "office", name: "Office Building", category: "properties", price: 250000, income: 7000, maintenance: 900, tax: 500, xp: 40 },
  { id: "warehouse", name: "Warehouse", category: "properties", price: 400000, income: 11000, maintenance: 1600, tax: 800, xp: 50 },
  { id: "commercial_complex", name: "Commercial Complex", category: "properties", price: 2500000, income: 90000, maintenance: 18000, tax: 7500, xp: 220 },

  { id: "iron_mine", name: "Iron Mine", category: "resources", price: 300000, income: 9000, maintenance: 1800, tax: 700, xp: 55 },
  { id: "coal_mine", name: "Coal Mine", category: "resources", price: 350000, income: 10500, maintenance: 2100, tax: 850, xp: 60 },
  { id: "gold_mine", name: "Gold Mine", category: "resources", price: 2000000, income: 75000, maintenance: 12000, tax: 6000, xp: 180 },
  { id: "oil_field", name: "Oil Field", category: "resources", price: 5000000, income: 180000, maintenance: 35000, tax: 15000, xp: 300 },

  { id: "farm", name: "Farm", category: "production", price: 80000, income: 2800, maintenance: 450, tax: 220, xp: 25 },
  { id: "food_plant", name: "Food Processing Plant", category: "production", price: 300000, income: 11500, maintenance: 2200, tax: 950, xp: 65 },
  { id: "steel_plant", name: "Steel Plant", category: "production", price: 1500000, income: 55000, maintenance: 11000, tax: 4500, xp: 160 },
  { id: "electronics_plant", name: "Electronics Plant", category: "production", price: 3000000, income: 115000, maintenance: 23000, tax: 9000, xp: 250 },

  { id: "concession_small", name: "Small Concession", category: "concessions", price: 75000, income: 2400, maintenance: 350, tax: 180, xp: 25 },
  { id: "concession_large", name: "Large Concession", category: "concessions", price: 500000, income: 18000, maintenance: 3200, tax: 1400, xp: 90 },

  { id: "subsidiary_logistics", name: "Logistics Subsidiary", category: "subsidiaries", price: 1000000, income: 38000, maintenance: 7000, tax: 3000, xp: 130 },
  { id: "subsidiary_finance", name: "Finance Subsidiary", category: "subsidiaries", price: 2500000, income: 100000, maintenance: 15000, tax: 8500, xp: 240 }
];

const COUNTRIES = [
  { id: "india", name: "India", taxRate: 0.10, bonus: 1.00 },
  { id: "usa", name: "United States", taxRate: 0.12, bonus: 1.10 },
  { id: "uk", name: "United Kingdom", taxRate: 0.11, bonus: 1.07 },
  { id: "germany", name: "Germany", taxRate: 0.09, bonus: 1.08 },
  { id: "japan", name: "Japan", taxRate: 0.08, bonus: 1.06 },
  { id: "china", name: "China", taxRate: 0.10, bonus: 1.05 },
  { id: "uae", name: "UAE", taxRate: 0.05, bonus: 1.12 },
  { id: "singapore", name: "Singapore", taxRate: 0.06, bonus: 1.11 }
];

const WORLD_SITES = [
  { id: "site_mumbai", name: "Mumbai Industrial Zone", resource: "iron", country: "india", value: 250000 },
  { id: "site_delhi", name: "Delhi Commercial Zone", resource: "commerce", country: "india", value: 300000 },
  { id: "site_kolkata", name: "Kolkata Port", resource: "logistics", country: "india", value: 275000 },
  { id: "site_dubai", name: "Dubai Trade Hub", resource: "commerce", country: "uae", value: 700000 },
  { id: "site_singapore", name: "Singapore Port", resource: "logistics", country: "singapore", value: 900000 },
  { id: "site_tokyo", name: "Tokyo Technology District", resource: "technology", country: "japan", value: 1000000 },
  { id: "site_london", name: "London Finance District", resource: "finance", country: "uk", value: 1200000 },
  { id: "site_newyork", name: "New York Business District", resource: "finance", country: "usa", value: 1500000 }
];

const MISSIONS = [
  { id: "first_business", name: "First Business", description: "Own your first business.", reward: 5000, xp: 50 },
  { id: "transport_owner", name: "Transport Owner", description: "Own 5 transportation assets.", reward: 15000, xp: 100 },
  { id: "millionaire", name: "Millionaire", description: "Reach 1,000,000 cash.", reward: 50000, xp: 250 },
  { id: "empire", name: "Business Empire", description: "Own 20 assets.", reward: 100000, xp: 500 },
  { id: "world_player", name: "World Player", description: "Claim a world site.", reward: 250000, xp: 750 }
];

const RESEARCH = [
  { id: "marketing", name: "Marketing", max: 5, base: 50000 },
  { id: "logistics", name: "Logistics", max: 5, base: 75000 },
  { id: "automation", name: "Automation", max: 5, base: 100000 },
  { id: "finance", name: "Finance", max: 5, base: 125000 },
  { id: "technology", name: "Technology", max: 5, base: 175000 }
];

const MEGA_PROJECTS = [
  { id: "global_port", name: "Global Mega Port", required: 50000000 },
  { id: "national_airport", name: "National Airport", required: 100000000 },
  { id: "smart_city", name: "Smart Business City", required: 250000000 },
  { id: "space_center", name: "Space Center", required: 1000000000 }
];

const CONTRACTS = [
  { id: 1, name: "Local Delivery Contract", description: "Deliver goods to a regional market.", value: 25000, duration: 1 },
  { id: 2, name: "National Supply Contract", description: "Supply products to a national chain.", value: 150000, duration: 3 },
  { id: 3, name: "International Logistics Contract", description: "Handle international freight.", value: 750000, duration: 6 },
  { id: 4, name: "Government Infrastructure Contract", description: "Build and supply infrastructure.", value: 5000000, duration: 12 }
];

const ALLIANCE_BONUS = 0.05;

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored) return false;

  if (stored.startsWith("scrypt:")) {
    const parts = stored.split(":");
    if (parts.length !== 3) return false;

    const salt = parts[1];
    const expected = parts[2];

    const actual = crypto.scryptSync(password, salt, 64).toString("hex");

    return crypto.timingSafeEqual(
      Buffer.from(actual, "hex"),
      Buffer.from(expected, "hex")
    );
  }

  const legacy = crypto
    .createHash("sha256")
    .update(password)
    .digest("hex");

  return legacy === stored;
}

function makeToken() {
  return crypto.randomBytes(48).toString("hex");
}

function json(res, status, data) {
  const body = JSON.stringify(data);

  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS"
  });

  res.end(body);
}

function error(res, status, message) {
  return json(res, status, {
    ok: false,
    error: message
  });
}

async function body(req) {
  return new Promise((resolve, reject) => {
    let data = "";

    req.on("data", chunk => {
      data += chunk;

      if (data.length > 2 * 1024 * 1024) {
        reject(new Error("Request too large"));
        req.destroy();
      }
    });

    req.on("end", () => {
      if (!data) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(data));
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });

    req.on("error", reject);
  });
}

async function query(text, params = []) {
  return pool.query(text, params);
}

async function transaction(callback) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

async function initDatabase() {
  await query(`
    CREATE TABLE IF NOT EXISTS players (
      id BIGSERIAL PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      company_name TEXT NOT NULL DEFAULT 'New Company',
      country TEXT NOT NULL DEFAULT 'india',
      level INTEGER NOT NULL DEFAULT 1,
      xp BIGINT NOT NULL DEFAULT 0,
      cash NUMERIC(30,2) NOT NULL DEFAULT 100000,
      gold NUMERIC(30,2) NOT NULL DEFAULT 0,
      prestige INTEGER NOT NULL DEFAULT 0,
      patriotism INTEGER NOT NULL DEFAULT 0,
      brand INTEGER NOT NULL DEFAULT 0,
      offensive_level INTEGER NOT NULL DEFAULT 1,
      defense_level INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_income_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS player_assets (
      player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      asset_id TEXT NOT NULL,
      quantity BIGINT NOT NULL DEFAULT 0,
      level INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY(player_id, asset_id)
    );

    CREATE TABLE IF NOT EXISTS world_sites (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      resource TEXT NOT NULL,
      country TEXT NOT NULL,
      value NUMERIC(30,2) NOT NULL,
      claimed_by BIGINT REFERENCES players(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS contracts (
      id BIGINT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      value NUMERIC(30,2) NOT NULL,
      duration INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      winner_id BIGINT REFERENCES players(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS contract_bids (
      id BIGSERIAL PRIMARY KEY,
      contract_id BIGINT NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
      player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      amount NUMERIC(30,2) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(contract_id, player_id)
    );

    CREATE TABLE IF NOT EXISTS alliances (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      owner_id BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS alliance_members (
      alliance_id BIGINT NOT NULL REFERENCES alliances(id) ON DELETE CASCADE,
      player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY(alliance_id, player_id)
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id BIGSERIAL PRIMARY KEY,
      player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      message TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS loans (
      id BIGSERIAL PRIMARY KEY,
      player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      principal NUMERIC(30,2) NOT NULL,
      remaining NUMERIC(30,2) NOT NULL,
      interest NUMERIC(10,4) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      paid BOOLEAN NOT NULL DEFAULT FALSE
    );

    CREATE TABLE IF NOT EXISTS wars (
      id BIGSERIAL PRIMARY KEY,
      attacker_id BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      defender_id BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      attacker_power BIGINT NOT NULL,
      defender_power BIGINT NOT NULL,
      attacker_won BOOLEAN NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS mega_projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      required NUMERIC(30,2) NOT NULL,
      invested NUMERIC(30,2) NOT NULL DEFAULT 0,
      completed BOOLEAN NOT NULL DEFAULT FALSE
    );

    CREATE TABLE IF NOT EXISTS missions_claimed (
      player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      mission_id TEXT NOT NULL,
      claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY(player_id, mission_id)
    );

    CREATE TABLE IF NOT EXISTS research_levels (
      player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      research_id TEXT NOT NULL,
      level INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY(player_id, research_id)
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_player ON sessions(player_id);
    CREATE INDEX IF NOT EXISTS idx_assets_player ON player_assets(player_id);
    CREATE INDEX IF NOT EXISTS idx_chat_created ON chat_messages(created_at);
    CREATE INDEX IF NOT EXISTS idx_bids_contract ON contract_bids(contract_id);
  `);

  for (const site of WORLD_SITES) {
    await query(
      `
      INSERT INTO world_sites(id,name,resource,country,value)
      VALUES($1,$2,$3,$4,$5)
      ON CONFLICT(id) DO UPDATE SET
        name=EXCLUDED.name,
        resource=EXCLUDED.resource,
        country=EXCLUDED.country,
        value=EXCLUDED.value
      `,
      [site.id, site.name, site.resource, site.country, site.value]
    );
  }

  for (const contract of CONTRACTS) {
    await query(
      `
      INSERT INTO contracts(id,name,description,value,duration)
      VALUES($1,$2,$3,$4,$5)
      ON CONFLICT(id) DO UPDATE SET
        name=EXCLUDED.name,
        description=EXCLUDED.description,
        value=EXCLUDED.value,
        duration=EXCLUDED.duration
      `,
      [
        contract.id,
        contract.name,
        contract.description,
        contract.value,
        contract.duration
      ]
    );
  }

  for (const project of MEGA_PROJECTS) {
    await query(
      `
      INSERT INTO mega_projects(id,name,required)
      VALUES($1,$2,$3)
      ON CONFLICT(id) DO UPDATE SET
        name=EXCLUDED.name,
        required=EXCLUDED.required
      `,
      [project.id, project.name, project.required]
    );
  }

  console.log("PostgreSQL database initialized.");
}

function assetById(id) {
  return ASSETS.find(a => a.id === id);
}

function normalizeCategory(category) {
  const c = String(category || "").toLowerCase();

  const aliases = {
    business: "businesses",
    businesses: "businesses",
    transport: "transportation",
    transportation: "transportation",
    property: "properties",
    properties: "properties",
    concession: "concessions",
    concessions: "concessions",
    subsidiary: "subsidiaries",
    subsidiaries: "subsidiaries",
    investment: "investments",
    investments: "investments",
    resource: "resources",
    resources: "resources",
    production: "production",
    productions: "production"
  };

  return aliases[c] || c;
}

function getLevelRequirements(level) {
  const requirements = {
    1: 0,
    2: 100,
    3: 300,
    4: 700,
    5: 1500,
    6: 3000,
    7: 6000,
    8: 12000,
    9: 25000,
    10: 50000,
    11: 100000,
    12: 200000,
    13: 400000,
    14: 800000,
    15: 1500000
  };

  return requirements[level] || requirements[15];
}

function levelUnlocks(level) {
  const unlocks = {
    1: ["Taxi", "Grocery Store"],
    2: ["Bus", "Restaurant"],
    3: ["Truck", "Pub"],
    4: ["Office Building", "Farm"],
    5: ["Factory"],
    6: ["Warehouse", "Small Concession"],
    7: ["Cargo Ship", "Food Processing Plant"],
    8: ["Mall", "Iron Mine"],
    9: ["Hotel", "Coal Mine"],
    10: ["Container Ship", "Large Concession"],
    11: ["Gold Mine", "Logistics Subsidiary"],
    12: ["Airliner", "Steel Plant"],
    13: ["Oil Field", "Finance Subsidiary"],
    14: ["Commercial Complex", "Electronics Plant"],
    15: ["Mega Projects", "Advanced World Operations"]
  };

  return unlocks[level] || [];
}

async function calculateEconomy(playerId) {
  const result = await query(
    `
    SELECT
      COALESCE(SUM(pa.quantity * a.income),0) AS gross,
      COALESCE(SUM(pa.quantity * a.maintenance),0) AS maintenance,
      COALESCE(SUM(pa.quantity * a.tax),0) AS tax
    FROM player_assets pa
    JOIN (
      SELECT *
      FROM jsonb_to_recordset($1::jsonb)
      AS x(
        id TEXT,
        name TEXT,
        category TEXT,
        price NUMERIC,
        income NUMERIC,
        maintenance NUMERIC,
        tax NUMERIC,
        xp INTEGER
      )
    ) a ON a.id = pa.asset_id
    WHERE pa.player_id = $2
    `,
    [JSON.stringify(ASSETS), playerId]
  );

  const row = result.rows[0];

  const gross = Number(row.gross || 0);
  const maintenance = Number(row.maintenance || 0);
  const tax = Number(row.tax || 0);

  const net = gross - maintenance - tax;

  return {
    gross,
    maintenance,
    tax,
    net
  };
}

async function processIncome(playerId) {
  const result = await query(
    `
    SELECT id,cash,last_income_at
    FROM players
    WHERE id=$1
    FOR UPDATE
    `,
    [playerId]
  );

  if (!result.rows.length) return null;

  const player = result.rows[0];
  const economy = await calculateEconomy(playerId);

  const last = new Date(player.last_income_at).getTime();
  const now = Date.now();

  let cycles = Math.floor((now - last) / HOUR);

  if (cycles < 0) cycles = 0;
  if (cycles > MAX_OFFLINE_HOURS) cycles = MAX_OFFLINE_HOURS;

  if (cycles > 0 && economy.net !== 0) {
    const amount = economy.net * cycles;

    await query(
      `
      UPDATE players
      SET cash=cash+$1,
          xp=xp+$2,
          last_income_at=last_income_at + ($3 * INTERVAL '1 hour'),
          last_seen_at=NOW()
      WHERE id=$4
      `,
      [
        amount,
        Math.max(1, Math.floor(Math.max(economy.net, 0) / 1000)) * cycles,
        cycles,
        playerId
      ]
    );
  } else {
    await query(
      `UPDATE players SET last_seen_at=NOW() WHERE id=$1`,
      [playerId]
    );
  }

  await updateLevel(playerId);

  return {
    cycles,
    amount: economy.net * cycles,
    ...economy
  };
}

async function updateLevel(playerId) {
  const result = await query(
    `SELECT level,xp FROM players WHERE id=$1`,
    [playerId]
  );

  if (!result.rows.length) return;

  let level = Number(result.rows[0].level);
  const xp = Number(result.rows[0].xp);

  while (level < 15 && xp >= getLevelRequirements(level + 1)) {
    level++;
  }

  if (level !== Number(result.rows[0].level)) {
    await query(
      `UPDATE players SET level=$1 WHERE id=$2`,
      [level, playerId]
    );
  }
}

async function authenticate(req) {
  const header = req.headers.authorization || "";

  if (!header.startsWith("Bearer ")) return null;

  const token = header.substring(7).trim();

  if (!token) return null;

  const result = await query(
    `
    SELECT p.*
    FROM sessions s
    JOIN players p ON p.id=s.player_id
    WHERE s.token=$1
    `,
    [token]
  );

  if (!result.rows.length) return null;

  await query(
    `UPDATE players SET last_seen_at=NOW() WHERE id=$1`,
    [result.rows[0].id]
  );

  return result.rows[0];
}

async function playerSummary(playerId) {
  await processIncome(playerId);

  const result = await query(
    `
    SELECT
      p.*,
      COALESCE(
        (SELECT SUM(pa.quantity * a.price)
         FROM player_assets pa
         JOIN (
           SELECT *
           FROM jsonb_to_recordset($1::jsonb)
           AS x(
             id TEXT,
             name TEXT,
             category TEXT,
             price NUMERIC,
             income NUMERIC,
             maintenance NUMERIC,
             tax NUMERIC,
             xp INTEGER
           )
         ) a ON a.id=pa.asset_id
         WHERE pa.player_id=p.id),0
      ) AS asset_value
    FROM players p
    WHERE p.id=$2
    `,
    [JSON.stringify(ASSETS), playerId]
  );

  if (!result.rows.length) return null;

  const p = result.rows[0];
  const economy = await calculateEconomy(playerId);

  const netWorth =
    Number(p.cash) +
    Number(p.asset_value || 0);

  return {
    id: Number(p.id),
    username: p.username,
    email: p.email,
    companyName: p.company_name,
    country: p.country,
    level: Number(p.level),
    xp: Number(p.xp),
    cash: Number(p.cash),
    gold: Number(p.gold),
    netWorth,
    assetValue: Number(p.asset_value || 0),
    grossIncome: economy.gross,
    maintenance: economy.maintenance,
    tax: economy.tax,
    netIncome: economy.net,
    prestige: Number(p.prestige),
    patriotism: Number(p.patriotism),
    brand: Number(p.brand),
    offensiveLevel: Number(p.offensive_level),
    defenseLevel: Number(p.defense_level),
    createdAt: p.created_at,
    lastIncomeAt: p.last_income_at,
    levelRequirement:
      p.level >= 15 ? getLevelRequirements(15) : getLevelRequirements(Number(p.level) + 1),
    unlocks: levelUnlocks(Number(p.level))
  };
}

async function register(req, res) {
  const data = await body(req);

  const username = String(data.username || "").trim();
  const email = String(data.email || "").trim().toLowerCase();
  const password = String(data.password || "");
  const companyName =
    String(data.companyName || data.company || "New Company").trim();

  if (!username || !email || !password) {
    return error(res, 400, "username, email and password are required");
  }

  if (password.length < 4) {
    return error(res, 400, "Password must contain at least 4 characters");
  }

  try {
    const result = await query(
      `
      INSERT INTO players(
        username,email,password_hash,company_name
      )
      VALUES($1,$2,$3,$4)
      RETURNING id,username,email,company_name
      `,
      [
        username,
        email,
        hashPassword(password),
        companyName || "New Company"
      ]
    );

    return json(res, 201, {
      ok: true,
      message: "Account created",
      player: {
        id: Number(result.rows[0].id),
        username: result.rows[0].username,
        email: result.rows[0].email,
        companyName: result.rows[0].company_name
      }
    });
  } catch (e) {
    if (e.code === "23505") {
      return error(res, 409, "Username or email already exists");
    }

    console.error(e);
    return error(res, 500, "Registration failed");
  }
}

async function login(req, res) {
  const data = await body(req);

  const loginValue =
    String(data.username || data.email || "").trim();

  const password = String(data.password || "");

  if (!loginValue || !password) {
    return error(res, 400, "Login and password are required");
  }

  const result = await query(
    `
    SELECT *
    FROM players
    WHERE LOWER(username)=LOWER($1)
       OR LOWER(email)=LOWER($1)
    LIMIT 1
    `,
    [loginValue]
  );

  if (!result.rows.length) {
    return error(res, 401, "Invalid credentials");
  }

  const player = result.rows[0];

  if (!verifyPassword(password, player.password_hash)) {
    return error(res, 401, "Invalid credentials");
  }

  await processIncome(player.id);

  const token = makeToken();

  await query(
    `
    INSERT INTO sessions(token,player_id)
    VALUES($1,$2)
    `,
    [token, player.id]
  );

  return json(res, 200, {
    ok: true,
    token,
    accessToken: token,
    player: await playerSummary(player.id)
  });
}

async function logout(req, res, player) {
  const header = req.headers.authorization || "";

  if (header.startsWith("Bearer ")) {
    await query(
      `DELETE FROM sessions WHERE token=$1`,
      [header.substring(7).trim()]
    );
  }

  return json(res, 200, {
    ok: true,
    message: "Logged out"
  });
}

async function getAssets(req, res, player, url) {
  const category = normalizeCategory(url.searchParams.get("category"));

  const rows = await query(
    `
    SELECT
      pa.asset_id,
      pa.quantity,
      pa.level
    FROM player_assets pa
    WHERE pa.player_id=$1
    `,
    [player.id]
  );

  const owned = new Map(
    rows.rows.map(row => [
      row.asset_id,
      {
        quantity: Number(row.quantity),
        level: Number(row.level)
      }
    ])
  );

  let assets = ASSETS;

  if (category && category !== "all") {
    assets = assets.filter(a => a.category === category);
  }

  return json(res, 200, {
    ok: true,
    assets: assets.map(a => {
      const o = owned.get(a.id) || { quantity: 0, level: 1 };

      const multiplier = 1 + ((o.level - 1) * 0.15);

      return {
        ...a,
        owned: o.quantity,
        level: o.level,
        incomePerUnit: Math.round(a.income * multiplier),
        maintenancePerUnit: Math.round(a.maintenance * multiplier),
        taxPerUnit: Math.round(a.tax * multiplier)
      };
    })
  });
}

async function buyAsset(req, res, player) {
  const data = await body(req);

  const assetId =
    String(data.assetId || data.asset || data.id || "").trim();

  const quantity = Math.max(
    1,
    Number(data.quantity || data.amount || 1)
  );

  const asset = assetById(assetId);

  if (!asset) {
    return error(res, 404, "Asset not found");
  }

  if (!Number.isFinite(quantity) || quantity > 1000000) {
    return error(res, 400, "Invalid quantity");
  }

  await processIncome(player.id);

  try {
    const result = await transaction(async client => {
      const p = await client.query(
        `
        SELECT cash,level
        FROM players
        WHERE id=$1
        FOR UPDATE
        `,
        [player.id]
      );

      const cash = Number(p.rows[0].cash);
      const level = Number(p.rows[0].level);

      if (asset.xp > getLevelRequirements(level + 1) && level < 15) {
        // only a soft progression check
      }

      const cost = asset.price * quantity;

      if (cash < cost) {
        throw new Error("Insufficient cash");
      }

      await client.query(
        `
        UPDATE players
        SET cash=cash-$1,
            xp=xp+$2
        WHERE id=$3
        `,
        [cost, asset.xp * quantity, player.id]
      );

      await client.query(
        `
        INSERT INTO player_assets(player_id,asset_id,quantity)
        VALUES($1,$2,$3)
        ON CONFLICT(player_id,asset_id)
        DO UPDATE SET quantity=player_assets.quantity+EXCLUDED.quantity
        `,
        [player.id, asset.id, quantity]
      );

      return {
        cost,
        quantity,
        asset
      };
    });

    await updateLevel(player.id);

    return json(res, 200, {
      ok: true,
      message: `${asset.name} purchased`,
      ...result,
      player: await playerSummary(player.id)
    });
  } catch (e) {
    return error(res, 400, e.message);
  }
}

async function sellAsset(req, res, player) {
  const data = await body(req);

  const assetId =
    String(data.assetId || data.asset || data.id || "").trim();

  const quantity = Math.max(
    1,
    Number(data.quantity || data.amount || 1)
  );

  const asset = assetById(assetId);

  if (!asset) {
    return error(res, 404, "Asset not found");
  }

  try {
    const result = await transaction(async client => {
      const owned = await client.query(
        `
        SELECT quantity
        FROM player_assets
        WHERE player_id=$1 AND asset_id=$2
        FOR UPDATE
        `,
        [player.id, asset.id]
      );

      if (!owned.rows.length || Number(owned.rows[0].quantity) < quantity) {
        throw new Error("You do not own enough units");
      }

      const revenue = asset.price * quantity * 0.75;

      await client.query(
        `
        UPDATE player_assets
        SET quantity=quantity-$1
        WHERE player_id=$2 AND asset_id=$3
        `,
        [quantity, player.id, asset.id]
      );

      await client.query(
        `
        UPDATE players
        SET cash=cash+$1
        WHERE id=$2
        `,
        [revenue, player.id]
      );

      return { revenue, quantity, asset };
    });

    return json(res, 200, {
      ok: true,
      message: `${asset.name} sold`,
      ...result,
      player: await playerSummary(player.id)
    });
  } catch (e) {
    return error(res, 400, e.message);
  }
}

async function upgradeAsset(req, res, player) {
  const data = await body(req);

  const assetId =
    String(data.assetId || data.asset || data.id || "").trim();

  const asset = assetById(assetId);

  if (!asset) {
    return error(res, 404, "Asset not found");
  }

  try {
    const result = await transaction(async client => {
      const owned = await client.query(
        `
        SELECT quantity,level
        FROM player_assets
        WHERE player_id=$1 AND asset_id=$2
        FOR UPDATE
        `,
        [player.id, asset.id]
      );

      if (!owned.rows.length || Number(owned.rows[0].quantity) <= 0) {
        throw new Error("You do not own this asset");
      }

      const oldLevel = Number(owned.rows[0].level);
      const newLevel = oldLevel + 1;

      if (newLevel > 20) {
        throw new Error("Maximum asset level reached");
      }

      const cost =
        asset.price *
        0.25 *
        newLevel *
        Math.max(1, Number(owned.rows[0].quantity));

      const p = await client.query(
        `SELECT cash FROM players WHERE id=$1 FOR UPDATE`,
        [player.id]
      );

      if (Number(p.rows[0].cash) < cost) {
        throw new Error("Insufficient cash");
      }

      await client.query(
        `
        UPDATE players
        SET cash=cash-$1,
            xp=xp+$2
        WHERE id=$3
        `,
        [cost, 10 * newLevel, player.id]
      );

      await client.query(
        `
        UPDATE player_assets
        SET level=$1
        WHERE player_id=$2 AND asset_id=$3
        `,
        [newLevel, player.id, asset.id]
      );

      return {
        cost,
        oldLevel,
        newLevel
      };
    });

    return json(res, 200, {
      ok: true,
      message: "Asset upgraded",
      ...result
    });
  } catch (e) {
    return error(res, 400, e.message);
  }
}

async function income(req, res, player) {
  const processed = await processIncome(player.id);
  const summary = await playerSummary(player.id);

  const seconds =
    (Date.now() - new Date(summary.lastIncomeAt).getTime()) / 1000;

  const pendingCycles = Math.min(
    MAX_OFFLINE_HOURS,
    Math.max(0, Math.floor(seconds / 3600))
  );

  return json(res, 200, {
    ok: true,
    current: {
      gross: processed.gross,
      maintenance: processed.maintenance,
      tax: processed.tax,
      net: processed.net
    },
    processedCycles: processed.cycles,
    processedAmount: processed.amount,
    pendingCycles,
    maximumOfflineCycles: MAX_OFFLINE_HOURS,
    cycleDurationSeconds: 3600,
    player: summary
  });
}

async function profile(req, res, player) {
  return json(res, 200, {
    ok: true,
    player: await playerSummary(player.id)
  });
}

async function countries(req, res) {
  return json(res, 200, {
    ok: true,
    countries: COUNTRIES
  });
}

async function worldSites(req, res, player) {
  const result = await query(
    `
    SELECT
      ws.*,
      p.username AS claimed_by_username
    FROM world_sites ws
    LEFT JOIN players p ON p.id=ws.claimed_by
    ORDER BY ws.id
    `
  );

  return json(res, 200, {
    ok: true,
    sites: result.rows.map(s => ({
      id: s.id,
      name: s.name,
      resource: s.resource,
      country: s.country,
      value: Number(s.value),
      claimedBy: s.claimed_by ? Number(s.claimed_by) : null,
      claimedByUsername: s.claimed_by_username || null,
      mine: Number(s.claimed_by) === Number(player.id)
    }))
  });
}

async function claimWorldSite(req, res, player) {
  const data = await body(req);
  const siteId = String(data.siteId || data.id || "");

  try {
    const result = await transaction(async client => {
      const site = await client.query(
        `
        SELECT *
        FROM world_sites
        WHERE id=$1
        FOR UPDATE
        `,
        [siteId]
      );

      if (!site.rows.length) {
        throw new Error("World site not found");
      }

      if (site.rows[0].claimed_by) {
        throw new Error("This site is already claimed");
      }

      const cost = Number(site.rows[0].value);

      const p = await client.query(
        `
        SELECT cash
        FROM players
        WHERE id=$1
        FOR UPDATE
        `,
        [player.id]
      );

      if (Number(p.rows[0].cash) < cost) {
        throw new Error("Insufficient cash");
      }

      await client.query(
        `UPDATE players SET cash=cash-$1,xp=xp+250 WHERE id=$2`,
        [cost, player.id]
      );

      await client.query(
        `UPDATE world_sites SET claimed_by=$1 WHERE id=$2`,
        [player.id, siteId]
      );

      return {
        site: site.rows[0],
        cost
      };
    });

    return json(res, 200, {
      ok: true,
      message: "World site claimed",
      site: result.site,
      cost: result.cost,
      player: await playerSummary(player.id)
    });
  } catch (e) {
    return error(res, 400, e.message);
  }
}

async function rankings(req, res) {
  const result = await query(
    `
    SELECT
      p.id,
      p.username,
      p.company_name,
      p.level,
      p.xp,
      p.cash,
      COALESCE(SUM(pa.quantity * a.price),0) AS asset_value
    FROM players p
    LEFT JOIN player_assets pa ON pa.player_id=p.id
    LEFT JOIN (
      SELECT *
      FROM jsonb_to_recordset($1::jsonb)
      AS x(
        id TEXT,
        name TEXT,
        category TEXT,
        price NUMERIC,
        income NUMERIC,
        maintenance NUMERIC,
        tax NUMERIC,
        xp INTEGER
      )
    ) a ON a.id=pa.asset_id
    GROUP BY p.id
    ORDER BY
      (p.cash + COALESCE(SUM(pa.quantity * a.price),0)) DESC
    LIMIT 100
    `,
    [JSON.stringify(ASSETS)]
  );

  return json(res, 200, {
    ok: true,
    rankings: result.rows.map((r, i) => ({
      rank: i + 1,
      id: Number(r.id),
      username: r.username,
      companyName: r.company_name,
      level: Number(r.level),
      xp: Number(r.xp),
      cash: Number(r.cash),
      assetValue: Number(r.asset_value),
      netWorth:
        Number(r.cash) + Number(r.asset_value)
    }))
  });
}

async function createAlliance(req, res, player) {
  const data = await body(req);

  const name = String(data.name || "").trim();

  if (!name) {
    return error(res, 400, "Alliance name required");
  }

  try {
    const result = await transaction(async client => {
      const alliance = await client.query(
        `
        INSERT INTO alliances(name,owner_id)
        VALUES($1,$2)
        RETURNING id,name
        `,
        [name, player.id]
      );

      await client.query(
        `
        INSERT INTO alliance_members(alliance_id,player_id)
        VALUES($1,$2)
        `,
        [alliance.rows[0].id, player.id]
      );

      return alliance.rows[0];
    });

    return json(res, 201, {
      ok: true,
      alliance: {
        id: Number(result.id),
        name: result.name
      }
    });
  } catch (e) {
    if (e.code === "23505") {
      return error(res, 409, "Alliance name already exists");
    }

    return error(res, 400, e.message);
  }
}

async function alliances(req, res) {
  const result = await query(`
    SELECT
      a.id,
      a.name,
      a.owner_id,
      p.username AS owner,
      COUNT(am.player_id) AS members
    FROM alliances a
    JOIN players p ON p.id=a.owner_id
    LEFT JOIN alliance_members am ON am.alliance_id=a.id
    GROUP BY a.id,p.username
    ORDER BY members DESC,a.created_at
  `);

  return json(res, 200, {
    ok: true,
    alliances: result.rows.map(a => ({
      id: Number(a.id),
      name: a.name,
      ownerId: Number(a.owner_id),
      owner: a.owner,
      members: Number(a.members)
    }))
  });
}

async function chatGet(req, res) {
  const result = await query(`
    SELECT
      c.id,
      c.message,
      c.created_at,
      p.id AS player_id,
      p.username,
      p.company_name
    FROM chat_messages c
    JOIN players p ON p.id=c.player_id
    ORDER BY c.created_at DESC
    LIMIT 100
  `);

  return json(res, 200, {
    ok: true,
    messages: result.rows.reverse().map(m => ({
      id: Number(m.id),
      playerId: Number(m.player_id),
      username: m.username,
      companyName: m.company_name,
      message: m.message,
      createdAt: m.created_at
    }))
  });
}

async function chatSend(req, res, player) {
  const data = await body(req);
  const message = String(data.message || "").trim();

  if (!message) {
    return error(res, 400, "Message required");
  }

  if (message.length > 500) {
    return error(res, 400, "Message too long");
  }

  const result = await query(
    `
    INSERT INTO chat_messages(player_id,message)
    VALUES($1,$2)
    RETURNING id,created_at
    `,
    [player.id, message]
  );

  return json(res, 201, {
    ok: true,
    message: {
      id: Number(result.rows[0].id),
      playerId: Number(player.id),
      username: player.username,
      message,
      createdAt: result.rows[0].created_at
    }
  });
}

async function loans(req, res, player) {
  const result = await query(
    `
    SELECT *
    FROM loans
    WHERE player_id=$1
    ORDER BY created_at DESC
    `,
    [player.id]
  );

  return json(res, 200, {
    ok: true,
    loans: result.rows.map(l => ({
      id: Number(l.id),
      principal: Number(l.principal),
      remaining: Number(l.remaining),
      interest: Number(l.interest),
      paid: l.paid,
      createdAt: l.created_at
    }))
  });
}

async function takeLoan(req, res, player) {
  const data = await body(req);

  const amount = Number(
    data.amount || data.principal || 0
  );

  if (!Number.isFinite(amount) || amount <= 0) {
    return error(res, 400, "Invalid loan amount");
  }

  if (amount > 10000000) {
    return error(res, 400, "Maximum loan is 10,000,000");
  }

  const interest = 0.10;
  const total = amount * (1 + interest);

  const result = await transaction(async client => {
    const active = await client.query(
      `
      SELECT COUNT(*)::int AS count
      FROM loans
      WHERE player_id=$1 AND paid=false
      `,
      [player.id]
    );

    if (Number(active.rows[0].count) >= 3) {
      throw new Error("Maximum active loans reached");
    }

    await client.query(
      `
      INSERT INTO loans(player_id,principal,remaining,interest)
      VALUES($1,$2,$3,$4)
      `,
      [player.id, amount, total, interest]
    );

    await client.query(
      `UPDATE players SET cash=cash+$1 WHERE id=$2`,
      [amount, player.id]
    );

    return total;
  });

  return json(res, 200, {
    ok: true,
    amount,
    totalRepayment: result,
    player: await playerSummary(player.id)
  });
}

async function missions(req, res, player) {
  const claimed = await query(
    `
    SELECT mission_id
    FROM missions_claimed
    WHERE player_id=$1
    `,
    [player.id]
  );

  const claimedSet = new Set(
    claimed.rows.map(x => x.mission_id)
  );

  const summary = await playerSummary(player.id);

  const assetCountResult = await query(
    `
    SELECT COALESCE(SUM(quantity),0) AS count
    FROM player_assets
    WHERE player_id=$1
    `,
    [player.id]
  );

  const assetCount = Number(assetCountResult.rows[0].count);

  const transportCountResult = await query(
    `
    SELECT COALESCE(SUM(quantity),0) AS count
    FROM player_assets
    WHERE player_id=$1
      AND asset_id IN (
        'taxi','bus','truck','cargo_ship','container_ship','airliner'
      )
    `,
    [player.id]
  );

  const transportCount =
    Number(transportCountResult.rows[0].count);

  return json(res, 200, {
    ok: true,
    missions: MISSIONS.map(m => {
      let progress = 0;
      let target = 1;

      if (m.id === "first_business") {
        progress = assetCount > 0 ? 1 : 0;
      }

      if (m.id === "transport_owner") {
        progress = transportCount;
        target = 5;
      }

      if (m.id === "millionaire") {
        progress = Math.min(summary.cash, 1000000);
        target = 1000000;
      }

      if (m.id === "empire") {
        progress = assetCount;
        target = 20;
      }

      if (m.id === "world_player") {
        progress = summary.assetValue > 0 ? 0 : 0;
        target = 1;
      }

      return {
        ...m,
        progress,
        target,
        claimed: claimedSet.has(m.id),
        completed: progress >= target
      };
    })
  });
}

async function claimMission(req, res, player) {
  const data = await body(req);
  const mission = MISSIONS.find(
    m => m.id === String(data.missionId || data.id)
  );

  if (!mission) {
    return error(res, 404, "Mission not found");
  }

  const existing = await query(
    `
    SELECT 1
    FROM missions_claimed
    WHERE player_id=$1 AND mission_id=$2
    `,
    [player.id, mission.id]
  );

  if (existing.rows.length) {
    return error(res, 400, "Mission already claimed");
  }

  const summary = await playerSummary(player.id);

  let completed = false;

  if (mission.id === "first_business") {
    const r = await query(
      `SELECT COALESCE(SUM(quantity),0) AS count FROM player_assets WHERE player_id=$1`,
      [player.id]
    );
    completed = Number(r.rows[0].count) >= 1;
  }

  if (mission.id === "millionaire") {
    completed = summary.cash >= 1000000;
  }

  if (mission.id === "empire") {
    const r = await query(
      `SELECT COALESCE(SUM(quantity),0) AS count FROM player_assets WHERE player_id=$1`,
      [player.id]
    );
    completed = Number(r.rows[0].count) >= 20;
  }

  if (mission.id === "transport_owner") {
    const r = await query(
      `
      SELECT COALESCE(SUM(quantity),0) AS count
      FROM player_assets
      WHERE player_id=$1
      AND asset_id IN ('taxi','bus','truck','cargo_ship','container_ship','airliner')
      `,
      [player.id]
    );
    completed = Number(r.rows[0].count) >= 5;
  }

  if (mission.id === "world_player") {
    const r = await query(
      `SELECT 1 FROM world_sites WHERE claimed_by=$1 LIMIT 1`,
      [player.id]
    );
    completed = r.rows.length > 0;
  }

  if (!completed) {
    return error(res, 400, "Mission is not completed");
  }

  await transaction(async client => {
    await client.query(
      `
      INSERT INTO missions_claimed(player_id,mission_id)
      VALUES($1,$2)
      `,
      [player.id, mission.id]
    );

    await client.query(
      `
      UPDATE players
      SET cash=cash+$1,xp=xp+$2
      WHERE id=$3
      `,
      [mission.reward, mission.xp, player.id]
    );
  });

  await updateLevel(player.id);

  return json(res, 200, {
    ok: true,
    reward: mission.reward,
    xp: mission.xp,
    player: await playerSummary(player.id)
  });
}

async function research(req, res, player) {
  const result = await query(
    `
    SELECT research_id,level
    FROM research_levels
    WHERE player_id=$1
    `,
    [player.id]
  );

  const map = new Map(
    result.rows.map(r => [
      r.research_id,
      Number(r.level)
    ])
  );

  return json(res, 200, {
    ok: true,
    research: RESEARCH.map(r => ({
      ...r,
      level: map.get(r.id) || 0,
      nextCost: r.base * ((map.get(r.id) || 0) + 1)
    }))
  });
}

async function upgradeResearch(req, res, player) {
  const data = await body(req);

  const researchId =
    String(data.researchId || data.id || "");

  const item = RESEARCH.find(r => r.id === researchId);

  if (!item) {
    return error(res, 404, "Research not found");
  }

  try {
    const result = await transaction(async client => {
      const current = await client.query(
        `
        SELECT level
        FROM research_levels
        WHERE player_id=$1 AND research_id=$2
        FOR UPDATE
        `,
        [player.id, researchId]
      );

      const level =
        current.rows.length
          ? Number(current.rows[0].level)
          : 0;

      if (level >= item.max) {
        throw new Error("Research already at maximum level");
      }

      const cost = item.base * (level + 1);

      const p = await client.query(
        `SELECT cash FROM players WHERE id=$1 FOR UPDATE`,
        [player.id]
      );

      if (Number(p.rows[0].cash) < cost) {
        throw new Error("Insufficient cash");
      }

      await client.query(
        `
        UPDATE players
        SET cash=cash-$1,xp=xp+$2
        WHERE id=$3
        `,
        [cost, 50 * (level + 1), player.id]
      );

      await client.query(
        `
        INSERT INTO research_levels(player_id,research_id,level)
        VALUES($1,$2,$3)
        ON CONFLICT(player_id,research_id)
        DO UPDATE SET level=EXCLUDED.level
        `,
        [player.id, researchId, level + 1]
      );

      return {
        oldLevel: level,
        newLevel: level + 1,
        cost
      };
    });

    return json(res, 200, {
      ok: true,
      ...result
    });
  } catch (e) {
    return error(res, 400, e.message);
  }
}

async function megaProjects(req, res) {
  const result = await query(`
    SELECT *
    FROM mega_projects
    ORDER BY required
  `);

  return json(res, 200, {
    ok: true,
    projects: result.rows.map(p => ({
      id: p.id,
      name: p.name,
      required: Number(p.required),
      invested: Number(p.invested),
      completed: p.completed
    }))
  });
}

async function investMegaProject(req, res, player) {
  const data = await body(req);

  const projectId =
    String(data.projectId || data.id || "");

  const amount = Number(data.amount || 0);

  if (!Number.isFinite(amount) || amount <= 0) {
    return error(res, 400, "Invalid amount");
  }

  try {
    const result = await transaction(async client => {
      const project = await client.query(
        `
        SELECT *
        FROM mega_projects
        WHERE id=$1
        FOR UPDATE
        `,
        [projectId]
      );

      if (!project.rows.length) {
        throw new Error("Mega project not found");
      }

      if (project.rows[0].completed) {
        throw new Error("Project already completed");
      }

      const p = await client.query(
        `
        SELECT cash
        FROM players
        WHERE id=$1
        FOR UPDATE
        `,
        [player.id]
      );

      if (Number(p.rows[0].cash) < amount) {
        throw new Error("Insufficient cash");
      }

      const current = Number(project.rows[0].invested);
      const required = Number(project.rows[0].required);
      const actual = Math.min(amount, required - current);

      await client.query(
        `UPDATE players SET cash=cash-$1,xp=xp+100 WHERE id=$2`,
        [actual, player.id]
      );

      await client.query(
        `
        UPDATE mega_projects
        SET invested=invested+$1,
            completed=(invested+$1)>=required
        WHERE id=$2
        `,
        [actual, projectId]
      );

      return actual;
    });

    return json(res, 200, {
      ok: true,
      invested: result,
      player: await playerSummary(player.id)
    });
  } catch (e) {
    return error(res, 400, e.message);
  }
}

async function contracts(req, res) {
  const result = await query(`
    SELECT
      c.*,
      COALESCE(MIN(cb.amount),0) AS lowest_bid,
      COUNT(cb.id) AS bid_count
    FROM contracts c
    LEFT JOIN contract_bids cb ON cb.contract_id=c.id
    GROUP BY c.id
    ORDER BY c.id
  `);

  return json(res, 200, {
    ok: true,
    contracts: result.rows.map(c => ({
      id: Number(c.id),
      name: c.name,
      description: c.description,
      value: Number(c.value),
      duration: Number(c.duration),
      status: c.status,
      lowestBid: Number(c.lowest_bid),
      bidCount: Number(c.bid_count)
    }))
  });
}

async function bidContract(req, res, player) {
  const data = await body(req);

  const contractId =
    Number(data.contractId || data.id);

  const amount = Number(data.amount || data.bid);

  if (!contractId || !Number.isFinite(amount) || amount <= 0) {
    return error(res, 400, "Invalid contract bid");
  }

  const contract = await query(
    `SELECT * FROM contracts WHERE id=$1`,
    [contractId]
  );

  if (!contract.rows.length) {
    return error(res, 404, "Contract not found");
  }

  if (contract.rows[0].status !== "open") {
    return error(res, 400, "Contract is not open");
  }

  await query(
    `
    INSERT INTO contract_bids(contract_id,player_id,amount)
    VALUES($1,$2,$3)
    ON CONFLICT(contract_id,player_id)
    DO UPDATE SET
      amount=EXCLUDED.amount,
      updated_at=NOW()
    `,
    [contractId, player.id, amount]
  );

  return json(res, 200, {
    ok: true,
    message: "Bid submitted",
    contractId,
    amount
  });
}

async function runningContracts(req, res, player) {
  const result = await query(
    `
    SELECT
      c.*,
      cb.amount AS bid
    FROM contract_bids cb
    JOIN contracts c ON c.id=cb.contract_id
    WHERE cb.player_id=$1
      AND c.status<>'open'
    ORDER BY cb.updated_at DESC
    `,
    [player.id]
  );

  return json(res, 200, {
    ok: true,
    contracts: result.rows
  });
}

async function contractRanking(req, res) {
  const result = await query(`
    SELECT
      p.id,
      p.username,
      COUNT(cb.id) AS bids,
      COALESCE(SUM(cb.amount),0) AS total_bid
    FROM players p
    LEFT JOIN contract_bids cb ON cb.player_id=p.id
    GROUP BY p.id
    ORDER BY bids DESC,total_bid ASC
    LIMIT 100
  `);

  return json(res, 200, {
    ok: true,
    rankings: result.rows.map((r, i) => ({
      rank: i + 1,
      playerId: Number(r.id),
      username: r.username,
      bids: Number(r.bids),
      totalBid: Number(r.total_bid)
    }))
  });
}

async function army(req, res, player) {
  const p = await query(
    `
    SELECT offensive_level,defense_level
    FROM players
    WHERE id=$1
    `,
    [player.id]
  );

  const offensive = Number(p.rows[0].offensive_level);
  const defense = Number(p.rows[0].defense_level);

  const power =
    offensive * 1000 +
    defense * 1200;

  return json(res, 200, {
    ok: true,
    army: {
      ground: offensive * 100,
      air: offensive * 50,
      defense: defense * 120,
      offensiveLevel: offensive,
      defenseLevel: defense,
      militaryPower: power
    }
  });
}

async function upgradeArmy(req, res, player) {
  const data = await body(req);

  const type =
    String(data.type || data.armyType || "offensive")
      .toLowerCase();

  try {
    const result = await transaction(async client => {
      const p = await client.query(
        `
        SELECT cash,offensive_level,defense_level
        FROM players
        WHERE id=$1
        FOR UPDATE
        `,
        [player.id]
      );

      const row = p.rows[0];

      const field =
        type === "defense" || type === "defence"
          ? "defense_level"
          : "offensive_level";

      const current =
        Number(
          field === "defense_level"
            ? row.defense_level
            : row.offensive_level
        );

      const cost =
        100000 * Math.pow(2, current - 1);

      if (Number(row.cash) < cost) {
        throw new Error("Insufficient cash");
      }

      await client.query(
        `
        UPDATE players
        SET cash=cash-$1,
            ${field}=${field}+1,
            xp=xp+100
        WHERE id=$2
        `,
        [cost, player.id]
      );

      return {
        type: field,
        oldLevel: current,
        newLevel: current + 1,
        cost
      };
    });

    return json(res, 200, {
      ok: true,
      ...result
    });
  } catch (e) {
    return error(res, 400, e.message);
  }
}

async function war(req, res, player) {
  const data = await body(req);

  const targetPlayerId =
    Number(
      data.targetPlayerId ||
      data.targetId ||
      data.defenderId
    );

  if (!targetPlayerId || targetPlayerId === Number(player.id)) {
    return error(res, 400, "Invalid war target");
  }

  const target = await query(
    `
    SELECT id,username,offensive_level,defense_level
    FROM players
    WHERE id=$1
    `,
    [targetPlayerId]
  );

  if (!target.rows.length) {
    return error(res, 404, "Target player not found");
  }

  const attackerPower =
    Number(player.offensive_level) * 1000 +
    Number(player.defense_level) * 500 +
    Math.floor(Math.random() * 500);

  const defenderPower =
    Number(target.rows[0].defense_level) * 1200 +
    Number(target.rows[0].offensive_level) * 400 +
    Math.floor(Math.random() * 500);

  const attackerWon = attackerPower >= defenderPower;

  await query(
    `
    INSERT INTO wars(
      attacker_id,
      defender_id,
      attacker_power,
      defender_power,
      attacker_won
    )
    VALUES($1,$2,$3,$4,$5)
    `,
    [
      player.id,
      targetPlayerId,
      attackerPower,
      defenderPower,
      attackerWon
    ]
  );

  if (attackerWon) {
    const reward = Math.max(
      1000,
      Math.floor(defenderPower * 2)
    );

    await query(
      `
      UPDATE players
      SET cash=cash+$1,xp=xp+250
      WHERE id=$2
      `,
      [reward, player.id]
    );

    return json(res, 200, {
      ok: true,
      attackerWon: true,
      attackerPower,
      defenderPower,
      reward
    });
  }

  await query(
    `
    UPDATE players
    SET xp=xp+50
    WHERE id=$1
    `,
    [player.id]
  );

  return json(res, 200, {
    ok: true,
    attackerWon: false,
    attackerPower,
    defenderPower,
    reward: 0
  });
}

async function health(req, res) {
  try {
    await query("SELECT 1");

    return json(res, 200, {
      ok: true,
      version: VERSION,
      database: "connected",
      service: "tycoon-empire"
    });
  } catch (e) {
    return json(res, 503, {
      ok: false,
      version: VERSION,
      database: "error",
      error: e.message
    });
  }
}

async function handle(req, res) {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS"
    });
    return res.end();
  }

  const url = new URL(
    req.url,
    `http://${req.headers.host || "localhost"}`
  );

  const path = url.pathname;

  try {
    if (path === "/health" && req.method === "GET") {
      return health(req, res);
    }

    if (
      path === "/api/auth/register" &&
      req.method === "POST"
    ) {
      return register(req, res);
    }

    if (
      path === "/api/auth/login" &&
      req.method === "POST"
    ) {
      return login(req, res);
    }

    const player = await authenticate(req);

    const publicPaths = [
      "/",
      "/health"
    ];

    if (!player && !publicPaths.includes(path)) {
      return error(res, 401, "Unauthorized");
    }

    if (path === "/" && req.method === "GET") {
      return json(res, 200, {
        ok: true,
        service: "Tycoon Empire",
        version: VERSION
      });
    }

    if (
      path === "/api/auth/logout" &&
      req.method === "POST"
    ) {
      return logout(req, res, player);
    }

    if (
      path === "/api/players/me" &&
      req.method === "GET"
    ) {
      return json(res, 200, {
        ok: true,
        player: await playerSummary(player.id)
      });
    }

    if (
      path === "/api/assets" &&
      req.method === "GET"
    ) {
      return getAssets(req, res, player, url);
    }

    if (
      (
        path === "/api/assets/buy" ||
        path === "/api/businesses/buy" ||
        path === "/api/transportation/buy"
      ) &&
      req.method === "POST"
    ) {
      return buyAsset(req, res, player);
    }

    if (
      path === "/api/assets/sell" &&
      req.method === "POST"
    ) {
      return sellAsset(req, res, player);
    }

    if (
      path === "/api/assets/upgrade" &&
      req.method === "POST"
    ) {
      return upgradeAsset(req, res, player);
    }

    if (
      path === "/api/income" &&
      req.method === "GET"
    ) {
      return income(req, res, player);
    }

    if (
      path === "/api/profile" &&
      req.method === "GET"
    ) {
      return profile(req, res, player);
    }

    if (
      path === "/api/countries" &&
      req.method === "GET"
    ) {
      return countries(req, res);
    }

    if (
      path === "/api/world/sites" &&
      req.method === "GET"
    ) {
      return worldSites(req, res, player);
    }

    if (
      path === "/api/world/sites/claim" &&
      req.method === "POST"
    ) {
      return claimWorldSite(req, res, player);
    }

    if (
      (
        path === "/api/rankings" ||
        path === "/api/rankings/global"
      ) &&
      req.method === "GET"
    ) {
      return rankings(req, res);
    }

    if (
      path === "/api/alliances" &&
      req.method === "GET"
    ) {
      return alliances(req, res);
    }

    if (
      path === "/api/alliances/create" &&
      req.method === "POST"
    ) {
      return createAlliance(req, res, player);
    }

    if (
      path === "/api/chat" &&
      req.method === "GET"
    ) {
      return chatGet(req, res);
    }

    if (
      path === "/api/chat" &&
      req.method === "POST"
    ) {
      return chatSend(req, res, player);
    }

    if (
      (
        path === "/api/loans" ||
        path === "/api/loans/"
      ) &&
      req.method === "GET"
    ) {
      return loans(req, res, player);
    }

    if (
      path === "/api/loans/take" &&
      req.method === "POST"
    ) {
      return takeLoan(req, res, player);
    }

    if (
      path === "/api/missions" &&
      req.method === "GET"
    ) {
      return missions(req, res, player);
    }

    if (
      path === "/api/missions/claim" &&
      req.method === "POST"
    ) {
      return claimMission(req, res, player);
    }

    if (
      path === "/api/research" &&
      req.method === "GET"
    ) {
      return research(req, res, player);
    }

    if (
      path === "/api/research/upgrade" &&
      req.method === "POST"
    ) {
      return upgradeResearch(req, res, player);
    }

    if (
      path === "/api/mega-projects" &&
      req.method === "GET"
    ) {
      return megaProjects(req, res);
    }

    if (
      path === "/api/mega-projects/invest" &&
      req.method === "POST"
    ) {
      return investMegaProject(req, res, player);
    }

    if (
      path === "/api/contracts" &&
      req.method === "GET"
    ) {
      return contracts(req, res);
    }

    if (
      (
        path === "/api/contracts/bid" ||
        path === "/api/contracts/bids"
      ) &&
      req.method === "POST"
    ) {
      return bidContract(req, res, player);
    }

    if (
      path === "/api/contracts/running" &&
      req.method === "GET"
    ) {
      return runningContracts(req, res, player);
    }

    if (
      path === "/api/contracts/bids/ranking" &&
      req.method === "GET"
    ) {
      return contractRanking(req, res);
    }

    if (
      path === "/api/army" &&
      req.method === "GET"
    ) {
      return army(req, res, player);
    }

    if (
      (
        path === "/api/army/upgrade" ||
        path === "/api/army/update"
      ) &&
      req.method === "POST"
    ) {
      return upgradeArmy(req, res, player);
    }

    if (
      path === "/api/wars" &&
      req.method === "POST"
    ) {
      return war(req, res, player);
    }

    return error(res, 404, "Endpoint not found");
  } catch (e) {
    console.error("API ERROR:", e);

    return error(
      res,
      500,
      "Internal server error"
    );
  }
}

async function start() {
  try {
    await initDatabase();

    const server = http.createServer(handle);

    server.listen(PORT, "0.0.0.0", () => {
      console.log(
        `Tycoon Empire v${VERSION} listening on 0.0.0.0:${PORT}`
      );
    });

    process.on("SIGTERM", async () => {
      console.log("SIGTERM received.");
      server.close(async () => {
        await pool.end();
        process.exit(0);
      });
    });
  } catch (e) {
    console.error("SERVER STARTUP FAILED");
    console.error(e);
    process.exit(1);
  }
}

start();
