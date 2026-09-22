const http = require("http");
const crypto = require("crypto");

const PORT = process.env.PORT || 10000;
const VERSION = "0.8.0";

const db = {
  players: [],
  assets: [],
  contracts: [],
  alliances: [],
  wars: [],
  chat: [],
  loans: [],
  missions: [],
  research: [],
  megaProjects: [],
  sites: [],
  sessions: {},

  nextPlayerId: 1,
  nextAssetId: 1,
  nextContractId: 1,
  nextAllianceId: 1,
  nextWarId: 1,
  nextMessageId: 1,
  nextLoanId: 1,
  nextMissionId: 1,
  nextResearchId: 1,
  nextMegaId: 1
};

/* =========================================================
   LEVEL SYSTEM
   ========================================================= */

const LEVELS = [
  {
    level: 1,
    title: "Entrepreneur",
    netWorth: 0,
    xp: 0,
    goldReward: 0,
    prestige: 0,
    properties: 0,
    offensive: 1,
    patriotism: 0,
    investments: 0,
    allies: 0,
    megaProjects: 0,
    brand: 0
  },
  {
    level: 2,
    title: "Businessman",
    netWorth: 250000,
    xp: 250,
    goldReward: 25,
    prestige: 0,
    properties: 1,
    offensive: 1,
    patriotism: 0,
    investments: 0,
    allies: 0,
    megaProjects: 0,
    brand: 0
  },
  {
    level: 3,
    title: "Executive",
    netWorth: 1000000,
    xp: 750,
    goldReward: 50,
    prestige: 5,
    properties: 2,
    offensive: 2,
    patriotism: 0,
    investments: 1,
    allies: 0,
    megaProjects: 0,
    brand: 0
  },
  {
    level: 4,
    title: "Director",
    netWorth: 5000000,
    xp: 1500,
    goldReward: 75,
    prestige: 10,
    properties: 3,
    offensive: 2,
    patriotism: 5,
    investments: 2,
    allies: 0,
    megaProjects: 0,
    brand: 5
  },
  {
    level: 5,
    title: "CEO",
    netWorth: 15000000,
    xp: 3000,
    goldReward: 100,
    prestige: 20,
    properties: 5,
    offensive: 3,
    patriotism: 10,
    investments: 3,
    allies: 1,
    megaProjects: 0,
    brand: 10
  },
  {
    level: 6,
    title: "Industrialist",
    netWorth: 50000000,
    xp: 6000,
    goldReward: 150,
    prestige: 30,
    properties: 7,
    offensive: 4,
    patriotism: 15,
    investments: 5,
    allies: 1,
    megaProjects: 1,
    brand: 20
  },
  {
    level: 7,
    title: "Magnate",
    netWorth: 150000000,
    xp: 12000,
    goldReward: 200,
    prestige: 45,
    properties: 10,
    offensive: 5,
    patriotism: 20,
    investments: 7,
    allies: 2,
    megaProjects: 1,
    brand: 30
  },
  {
    level: 8,
    title: "Tycoon",
    netWorth: 500000000,
    xp: 25000,
    goldReward: 300,
    prestige: 60,
    properties: 14,
    offensive: 6,
    patriotism: 25,
    investments: 10,
    allies: 2,
    megaProjects: 2,
    brand: 40
  },
  {
    level: 9,
    title: "Mogul",
    netWorth: 1500000000,
    xp: 50000,
    goldReward: 400,
    prestige: 80,
    properties: 18,
    offensive: 8,
    patriotism: 30,
    investments: 14,
    allies: 3,
    megaProjects: 2,
    brand: 50
  },
  {
    level: 10,
    title: "World Leader",
    netWorth: 5000000000,
    xp: 100000,
    goldReward: 500,
    prestige: 100,
    properties: 22,
    offensive: 10,
    patriotism: 40,
    investments: 18,
    allies: 4,
    megaProjects: 3,
    brand: 60
  },
  {
    level: 11,
    title: "Global Magnate",
    netWorth: 15000000000,
    xp: 200000,
    goldReward: 700,
    prestige: 125,
    properties: 27,
    offensive: 12,
    patriotism: 50,
    investments: 23,
    allies: 5,
    megaProjects: 4,
    brand: 70
  },
  {
    level: 12,
    title: "Empire Builder",
    netWorth: 50000000000,
    xp: 400000,
    goldReward: 900,
    prestige: 150,
    properties: 32,
    offensive: 14,
    patriotism: 60,
    investments: 30,
    allies: 6,
    megaProjects: 5,
    brand: 80
  },
  {
    level: 13,
    title: "Economic Power",
    netWorth: 150000000000,
    xp: 800000,
    goldReward: 1200,
    prestige: 180,
    properties: 38,
    offensive: 16,
    patriotism: 70,
    investments: 40,
    allies: 7,
    megaProjects: 6,
    brand: 90
  },
  {
    level: 14,
    title: "Global Empire",
    netWorth: 500000000000,
    xp: 1600000,
    goldReward: 1500,
    prestige: 220,
    properties: 45,
    offensive: 18,
    patriotism: 80,
    investments: 50,
    allies: 8,
    megaProjects: 8,
    brand: 100
  },
  {
    level: 15,
    title: "Economic Emperor",
    netWorth: 1000000000000,
    xp: 3000000,
    goldReward: 2500,
    prestige: 300,
    properties: 55,
    offensive: 20,
    patriotism: 100,
    investments: 65,
    allies: 10,
    megaProjects: 10,
    brand: 120
  }
];

/* =========================================================
   ASSETS
   ========================================================= */

const catalog = [
  /* Businesses */
  ["business", "Coffee House", 50000, 350],
  ["business", "Clothes Shop", 75000, 500],
  ["business", "Fast Food", 100000, 750],
  ["business", "Restaurant", 150000, 1100],
  ["business", "Supermarket", 300000, 2200],
  ["business", "Electronics Shop", 500000, 3800],
  ["business", "Sports Shop", 700000, 5200],
  ["business", "Lottery Shop", 900000, 6500],
  ["business", "Gym", 1200000, 8500],
  ["business", "CrossFit Studio", 1500000, 10500],
  ["business", "Dance Club", 2000000, 14000],
  ["business", "Bowling", 2500000, 18000],
  ["business", "Pool Hall", 3000000, 22000],
  ["business", "Pub", 4000000, 30000],
  ["business", "Spa Club", 5000000, 38000],
  ["business", "Movie Theatre", 7500000, 55000],
  ["business", "Casino Hotel", 15000000, 110000],
  ["business", "Winery", 20000000, 150000],
  ["business", "Chocolatier Shop", 30000000, 225000],
  ["business", "Chef Restaurant", 50000000, 380000],
  ["business", "Escape Room", 75000000, 550000],

  /* Transportation */
  ["transportation", "Taxi", 25000, 200],
  ["transportation", "Bus", 100000, 850],
  ["transportation", "Train", 500000, 4500],
  ["transportation", "Tram", 750000, 6000],
  ["transportation", "Limousine", 250000, 2200],
  ["transportation", "Yacht", 2500000, 20000],
  ["transportation", "Helicopter", 3500000, 28000],
  ["transportation", "Hovercraft", 5000000, 40000],
  ["transportation", "Passenger Ship", 7500000, 60000],
  ["transportation", "Cargo Ship", 10000000, 80000],
  ["transportation", "Cargo Airplane", 15000000, 120000],
  ["transportation", "Crude Oil Carrier", 25000000, 200000],
  ["transportation", "Submarine", 40000000, 320000],
  ["transportation", "Driverless Taxi", 50000000, 400000],
  ["transportation", "Super Fast Train", 100000000, 800000],
  ["transportation", "Super Tank", 150000000, 1200000],
  ["transportation", "Melee Robot", 250000000, 2000000],

  /* Concessions */
  ["concession", "Ground Transport", 150000, 1200],
  ["concession", "Commerce", 300000, 2500],
  ["concession", "Leisure", 500000, 4000],
  ["concession", "Airlines", 5000000, 40000],
  ["concession", "Sea Lines", 7500000, 60000],
  ["concession", "Real Estate", 10000000, 90000],

  /* Subsidiaries */
  ["subsidiary", "Bank", 10000000, 85000],
  ["subsidiary", "Betting", 15000000, 125000],
  ["subsidiary", "Business Center", 25000000, 200000],
  ["subsidiary", "Medical Center", 30000000, 240000],
  ["subsidiary", "Mining Company", 40000000, 320000],
  ["subsidiary", "Products Market", 50000000, 400000],
  ["subsidiary", "Robots Center", 75000000, 600000],
  ["subsidiary", "Soccer Team", 100000000, 800000],
  ["subsidiary", "Space Center", 250000000, 2000000],
  ["subsidiary", "Stock Market", 300000000, 2500000],
  ["subsidiary", "Travel Company", 500000000, 4000000],

  /* Investments */
  ["investment", "Blockchain", 1000000, 0],
  ["investment", "Energy", 2500000, 0],
  ["investment", "Health", 5000000, 0],
  ["investment", "High-Tech", 10000000, 0],
  ["investment", "Internet Communications", 15000000, 0],
  ["investment", "Natural Resources", 25000000, 0],
  ["investment", "Nuclear", 50000000, 0],
  ["investment", "Real Estate", 75000000, 0],
  ["investment", "Security Weapons", 100000000, 0],
  ["investment", "Transportation", 150000000, 0],

  /* Properties */
  ["property", "Office Building", 250000, 1500],
  ["property", "Living Building", 750000, 5000],
  ["property", "Mall", 2500000, 18000],
  ["property", "Skyscraper", 10000000, 80000],

  /* Production */
  ["production", "Food Factory", 5000000, 45000],
  ["production", "Vehicle Factory", 25000000, 220000],
  ["production", "Electronics Factory", 50000000, 450000],

  /* Resources */
  ["resource", "Oil", 1000000, 8000],
  ["resource", "Gold", 1500000, 12000],
  ["resource", "Silver", 900000, 7000],
  ["resource", "Iron", 600000, 5000],
  ["resource", "Copper", 700000, 5500],
  ["resource", "Aluminum", 800000, 6200],
  ["resource", "Diamonds", 5000000, 40000],
  ["resource", "Gems", 2500000, 20000],
  ["resource", "Salt", 350000, 2800]
];

for (const item of catalog) {
  db.assets.push({
    id: db.nextAssetId++,
    category: item[0],
    type: item[1],
    price: item[2],
    income: item[3],
    maintenance: Math.floor(item[3] * 0.15),
    tax: Math.floor(item[3] * 0.05),
    description: "Purchase and operate " + item[1]
  });
}

/* =========================================================
   COUNTRIES
   ========================================================= */

const COUNTRY_NAMES = [
  "India",
  "United States",
  "China",
  "United Kingdom",
  "Germany",
  "France",
  "Japan",
  "Canada",
  "Australia",
  "Brazil",
  "Russia",
  "Italy",
  "Spain",
  "South Korea",
  "Singapore",
  "United Arab Emirates",
  "Saudi Arabia",
  "South Africa",
  "Mexico",
  "Indonesia"
];

/* =========================================================
   WORLD RESOURCE SITES
   ========================================================= */

const SITE_DATA = [
  ["Peru Copper", "Peru", "Copper", 8000],
  ["Brazil Iron", "Brazil", "Iron", 9000],
  ["Indonesia Nickel", "Indonesia", "Nickel", 10000],
  ["Australia Gold", "Australia", "Gold", 15000],
  ["Canada Timber", "Canada", "Timber", 7000],
  ["South Africa Platinum", "South Africa", "Platinum", 18000],
  ["Chile Lithium", "Chile", "Lithium", 20000],
  ["India Bauxite", "India", "Aluminum", 11000],
  ["Saudi Oil Field", "Saudi Arabia", "Oil", 25000],
  ["United States Oil Field", "United States", "Oil", 23000],
  ["China Rare Earth", "China", "Rare Earth", 30000],
  ["South Africa Gold Field", "South Africa", "Gold", 17000]
];

for (const item of SITE_DATA) {
  db.sites.push({
    id: db.sites.length + 1,
    name: item[0],
    country: item[1],
    resource: item[2],
    rate: item[3],
    ownerId: null
  });
}

/* =========================================================
   RESEARCH
   ========================================================= */

const RESEARCH_CATALOG = [
  {
    id: "business_ai",
    name: "Business AI",
    cost: 5000000,
    xp: 500,
    description: "Improves company income by 5% per level."
  },
  {
    id: "advanced_logistics",
    name: "Advanced Logistics",
    cost: 10000000,
    xp: 800,
    description: "Reduces transportation maintenance."
  },
  {
    id: "robotics",
    name: "Robotics",
    cost: 25000000,
    xp: 1200,
    description: "Unlocks advanced robotic operations."
  },
  {
    id: "quantum_computing",
    name: "Quantum Computing",
    cost: 75000000,
    xp: 2500,
    description: "Improves high-tech investments."
  },
  {
    id: "space_engineering",
    name: "Space Engineering",
    cost: 150000000,
    xp: 5000,
    description: "Improves space projects."
  }
];

/* =========================================================
   MEGA PROJECTS
   ========================================================= */

const MEGA_PROJECT_CATALOG = [
  {
    id: "global_hq",
    name: "Global Headquarters",
    cost: 50000000,
    rewardCash: 10000000,
    rewardGold: 100,
    requiredLevel: 6
  },
  {
    id: "international_airport",
    name: "International Airport",
    cost: 150000000,
    rewardCash: 35000000,
    rewardGold: 250,
    requiredLevel: 8
  },
  {
    id: "space_program",
    name: "National Space Program",
    cost: 500000000,
    rewardCash: 100000000,
    rewardGold: 500,
    requiredLevel: 10
  },
  {
    id: "orbital_city",
    name: "Orbital City",
    cost: 2000000000,
    rewardCash: 500000000,
    rewardGold: 1500,
    requiredLevel: 13
  },
  {
    id: "global_trade_network",
    name: "Global Trade Network",
    cost: 5000000000,
    rewardCash: 1500000000,
    rewardGold: 3000,
    requiredLevel: 15
  }
];

/* =========================================================
   MISSIONS
   ========================================================= */

const MISSION_TEMPLATES = [
  {
    title: "First Investment",
    type: "investment",
    target: 1,
    rewardCash: 50000,
    rewardGold: 10,
    rewardXP: 100
  },
  {
    title: "Build Your Fleet",
    type: "transportation",
    target: 5,
    rewardCash: 150000,
    rewardGold: 20,
    rewardXP: 250
  },
  {
    title: "Business Expansion",
    type: "business",
    target: 10,
    rewardCash: 500000,
    rewardGold: 40,
    rewardXP: 500
  },
  {
    title: "World Investor",
    type: "investment_value",
    target: 10000000,
    rewardCash: 1000000,
    rewardGold: 75,
    rewardXP: 1000
  },
  {
    title: "Military Power",
    type: "military",
    target: 1000,
    rewardCash: 2000000,
    rewardGold: 100,
    rewardXP: 1500
  },
  {
    title: "Global Empire",
    type: "net_worth",
    target: 100000000,
    rewardCash: 10000000,
    rewardGold: 250,
    rewardXP: 5000
  }
];

/* =========================================================
   MILITARY
   ========================================================= */

const MILITARY_UNITS = [
  ["soldiers", "Soldiers", 1000, 1, 1],
  ["small_tanks", "Small Tanks", 5000, 5, 3],
  ["medium_tanks", "Medium Tanks", 15000, 12, 8],
  ["heavy_tanks", "Heavy Tanks", 40000, 30, 20],
  ["light_artillery", "Light Artillery", 10000, 10, 12],
  ["heavy_artillery", "Heavy Artillery", 30000, 30, 35],
  ["mlrs", "MLRS", 75000, 70, 55],
  ["fighter_aircraft", "Fighter Aircraft", 150000, 120, 90],
  ["intelligence_aircraft", "Intelligence Aircraft", 175000, 100, 130],
  ["gunships", "Gunships", 250000, 220, 160],
  ["navy_seals", "Navy SEALs", 200000, 180, 170],
  ["special_forces", "Special Forces", 350000, 350, 300],
  ["cyber_soldiers", "Cyber Soldiers", 400000, 250, 400],
  ["cyber_warriors", "Cyber Warriors", 750000, 500, 750],
  ["battle_cruisers", "Battle Cruisers", 2000000, 1800, 1500],
  ["aircraft_carriers", "Aircraft Carriers", 5000000, 5000, 4500],
  ["anti_aircraft", "Anti-Aircraft", 500000, 300, 700],
  ["anti_ship_turrets", "Anti-Ship Shore Turrets", 750000, 600, 1000],
  ["avenger", "Avenger", 1000000, 800, 1300],
  ["ballistic_missiles", "Ballistic Missiles", 5000000, 6000, 3000],
  ["smart_bombs", "Smart Bombs", 2500000, 2500, 1500],
  ["espionage_satellites", "Espionage Satellites", 10000000, 3500, 7000],
  ["communication_satellites", "Communication Satellites", 7500000, 2500, 6000],
  ["defence_robots", "Defence Robots", 15000000, 5000, 12000]
];

/* =========================================================
   HELPERS
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

function getToken(req) {
  const header =
    req.headers.authorization || "";

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

  const id = db.sessions[token];

  if (!id) {
    return null;
  }

  return db.players.find(
    p => p.id === id
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

function normalizeType(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function findAsset(type) {
  const requested =
    normalizeType(type);

  return db.assets.find(a => {
    const actual =
      normalizeType(a.type);

    return (
      actual === requested ||
      actual.replace(/\s/g, "") ===
        requested.replace(/\s/g, "")
    );
  }) || null;
}

function ownedQuantity(player, type) {
  const owned =
    (player.assets || []).find(
      x =>
        normalizeType(x.type) ===
        normalizeType(type)
    );

  return owned
    ? owned.quantity
    : 0;
}

function countCategory(player, category) {
  let total = 0;

  for (const owned of player.assets || []) {
    const asset =
      findAsset(owned.type);

    if (
      asset &&
      asset.category === category
    ) {
      total += owned.quantity;
    }
  }

  return total;
}

function calculateNetWorth(player) {
  let value =
    Number(player.cash || 0);

  for (const owned of player.assets || []) {
    const asset =
      findAsset(owned.type);

    if (asset) {
      value +=
        asset.price *
        owned.quantity;
    }
  }

  for (const loan of db.loans) {
    if (
      loan.playerId === player.id &&
      !loan.paid
    ) {
      value -= loan.remaining;
    }
  }

  return Math.max(0, value);
}

function calculateGrossIncome(player) {
  let total = 0;

  for (const owned of player.assets || []) {
    const asset =
      findAsset(owned.type);

    if (!asset) continue;

    total +=
      asset.income *
      owned.quantity;
  }

  return total;
}

function calculateMaintenance(player) {
  let total = 0;

  for (const owned of player.assets || []) {
    const asset =
      findAsset(owned.type);

    if (!asset) continue;

    total +=
      asset.maintenance *
      owned.quantity;
  }

  return total;
}

function calculateTax(player) {
  let total = 0;

  for (const owned of player.assets || []) {
    const asset =
      findAsset(owned.type);

    if (!asset) continue;

    total +=
      asset.tax *
      owned.quantity;
  }

  return total;
}

function calculateNetIncome(player) {
  return Math.max(
    0,
    calculateGrossIncome(player) -
      calculateMaintenance(player) -
      calculateTax(player)
  );
}

function militaryPower(player) {
  let power = 0;

  for (
    const unit of MILITARY_UNITS
  ) {
    const count =
      Number(
        player.military?.[unit[0]] || 0
      );

    power +=
      count *
      Number(unit[3]);
  }

  return Math.floor(power);
}

function armyDefense(player) {
  return Math.floor(
    Number(player.defense || 100) +
    militaryPower(player) * 0.25
  );
}

function levelInfo(player) {
  const currentLevel =
    Math.max(
      1,
      Math.min(
        15,
        Number(player.level || 1)
      )
    );

  const current =
    LEVELS[currentLevel - 1];

  const next =
    LEVELS[currentLevel] || null;

  return {
    current,
    next,
    maxLevel:
      currentLevel >= 15
  };
}

function checkLevelRequirements(
  player,
  next
) {
  if (!next) {
    return {
      eligible: false,
      reasons: ["Maximum level reached."]
    };
  }

  const reasons = [];

  if (
    calculateNetWorth(player) <
    next.netWorth
  ) {
    reasons.push(
      `Net worth: $${next.netWorth.toLocaleString()}`
    );
  }

  if (
    Number(player.xp || 0) <
    next.xp
  ) {
    reasons.push(
      `XP: ${next.xp.toLocaleString()}`
    );
  }

  if (
    Number(player.ceoPrestige || 0) <
    next.prestige
  ) {
    reasons.push(
      `CEO prestige: ${next.prestige}`
    );
  }

  if (
    countCategory(
      player,
      "property"
    ) < next.properties
  ) {
    reasons.push(
      `Properties: ${next.properties}`
    );
  }

  if (
    Number(player.offensiveLevel || 1) <
    next.offensive
  ) {
    reasons.push(
      `Offensive level: ${next.offensive}`
    );
  }

  if (
    Number(player.patriotism || 0) <
    next.patriotism
  ) {
    reasons.push(
      `Patriotism: ${next.patriotism}`
    );
  }

  if (
    countCategory(
      player,
      "investment"
    ) < next.investments
  ) {
    reasons.push(
      `Investments: ${next.investments}`
    );
  }

  if (
    Number(player.alliedCountries || 0) <
    next.allies
  ) {
    reasons.push(
      `Allied countries: ${next.allies}`
    );
  }

  if (
    Number(player.megaProjectsCompleted || 0) <
    next.megaProjects
  ) {
    reasons.push(
      `Mega projects: ${next.megaProjects}`
    );
  }

  if (
    Number(player.brandPoints || 0) <
    next.brand
  ) {
    reasons.push(
      `Brand points: ${next.brand}`
    );
  }

  return {
    eligible:
      reasons.length === 0,
    reasons
  };
}

function tryLevelUp(player) {
  let changed = false;
  const rewards = [];

  while (player.level < 15) {
    const next =
      LEVELS[player.level];

    const result =
      checkLevelRequirements(
        player,
        next
      );

    if (!result.eligible) {
      break;
    }

    player.level++;

    const reward =
      next.goldReward || 0;

    player.gold =
      Number(player.gold || 0) +
      reward;

    rewards.push({
      level: player.level,
      title: next.title,
      gold: reward
    });

    changed = true;
  }

  return {
    changed,
    rewards
  };
}

function playerView(player) {
  const info =
    levelInfo(player);

  return {
    id: player.id,
    playerId: player.id,
    username: player.username,
    email: player.email,
    companyName: player.companyName,
    country: player.country,

    level: player.level,
    title: info.current.title,
    xp: player.xp,

    cash: player.cash,
    gold: player.gold,

    netWorth:
      calculateNetWorth(player),

    grossIncome:
      calculateGrossIncome(player),

    maintenance:
      calculateMaintenance(player),

    tax:
      calculateTax(player),

    netIncome:
      calculateNetIncome(player),

    ceoPrestige:
      player.ceoPrestige,

    patriotism:
      player.patriotism,

    brandPoints:
      player.brandPoints,

    offensiveLevel:
      player.offensiveLevel,

    defense:
      armyDefense(player),

    militaryPower:
      militaryPower(player),

    alliedCountries:
      player.alliedCountries,

    megaProjectsCompleted:
      player.megaProjectsCompleted,

    online: true,

    assets:
      player.assets || [],

    research:
      player.research || {},

    military:
      player.military || {}
  };
}

function missionProgress(
  player,
  mission
) {
  switch (mission.type) {
    case "investment":
      return countCategory(
        player,
        "investment"
      );

    case "transportation":
      return countCategory(
        player,
        "transportation"
      );

    case "business":
      return countCategory(
        player,
        "business"
      );

    case "investment_value":
      return player.investmentValue || 0;

    case "military":
      return militaryPower(player);

    case "net_worth":
      return calculateNetWorth(player);

    default:
      return 0;
  }
}

function createMissions(player) {
  for (const template of MISSION_TEMPLATES) {
    const exists =
      db.missions.some(
        m =>
          m.playerId === player.id &&
          m.template === template.title
      );

    if (!exists) {
      db.missions.push({
        id: db.nextMissionId++,
        playerId: player.id,
        template: template.title,
        title: template.title,
        type: template.type,
        target: template.target,
        rewardCash: template.rewardCash,
        rewardGold: template.rewardGold,
        rewardXP: template.rewardXP,
        completed: false
      });
    }
  }
}

function processMissionRewards(
  player
) {
  createMissions(player);

  const completed = [];

  for (
    const mission of db.missions
  ) {
    if (
      mission.playerId !== player.id ||
      mission.completed
    ) {
      continue;
    }

    const progress =
      missionProgress(
        player,
        mission
      );

    if (
      progress >=
      mission.target
    ) {
      mission.completed = true;

      player.cash +=
        mission.rewardCash;

      player.gold +=
        mission.rewardGold;

      player.xp +=
        mission.rewardXP;

      completed.push(mission);
    }
  }

  return completed;
}

/* =========================================================
   HTTP SERVER
   ========================================================= */

const server =
  http.createServer(
    async (req, res) => {

      if (req.method === "OPTIONS") {
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
            version: VERSION,
            service: "tycoon-empire",
            players: db.players.length,
            assets: db.assets.length,
            features: [
              "authentication",
              "players",
              "15-level-progression",
              "businesses",
              "transportation",
              "concessions",
              "subsidiaries",
              "investments",
              "properties",
              "production",
              "resources",
              "resource-sites",
              "research",
              "technology",
              "mega-projects",
              "missions",
              "loans",
              "contracts",
              "alliances",
              "chat",
              "rankings",
              "army",
              "military-units",
              "wars",
              "country-economy"
            ]
          }
        );
      }

      /* =====================================================
         REGISTER
         ===================================================== */

      if (
        req.method === "POST" &&
        path === "/api/auth/register"
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

        if (password.length < 4) {
          return send(
            res,
            400,
            {
              error:
                "password must contain at least 4 characters"
            }
          );
        }

        if (
          db.players.some(
            p =>
              p.email === email
          )
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

        if (
          db.players.some(
            p =>
              p.username.toLowerCase() ===
              username.toLowerCase()
          )
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

        const player = {
          id:
            db.nextPlayerId++,

          username,
          email,
          password:
            hashPassword(password),

          companyName:
            username +
            " Corporation",

          country: "India",

          level: 1,
          xp: 0,

          cash: 100000,
          gold: 100,

          ceoPrestige: 0,
          patriotism: 0,
          brandPoints: 0,

          offensiveLevel: 1,
          defense: 100,

          alliedCountries: 0,
          megaProjectsCompleted: 0,

          investmentValue: 0,

          assets: [],

          research: {},

          military: {},

          createdAt:
            new Date().toISOString()
        };

        for (
          const unit of MILITARY_UNITS
        ) {
          player.military[
            unit[0]
          ] = 0;
        }

        db.players.push(player);

        createMissions(player);

        return send(
          res,
          201,
          {
            ok: true,
            message:
              "account created",
            player:
              playerView(player)
          }
        );
      }

      /* =====================================================
         LOGIN
         ===================================================== */

      if (
        req.method === "POST" &&
        path === "/api/auth/login"
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
                hashPassword(password)
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

      /* =====================================================
         LOGOUT
         ===================================================== */

      if (
        req.method === "POST" &&
        path === "/api/auth/logout"
      ) {

        const token =
          getToken(req);

        if (token) {
          delete db.sessions[token];
        }

        return send(
          res,
          200,
          { ok: true }
        );
      }

      /* =====================================================
         CURRENT PLAYER
         ===================================================== */

      if (
        req.method === "GET" &&
        path === "/api/players/me"
      ) {

        const player =
          requirePlayer(
            req,
            res
          );

        if (!player) return;

        return send(
          res,
          200,
          {
            player:
              playerView(player)
          }
        );
      }

      /* =====================================================
         ONLINE PLAYERS
         ===================================================== */

      if (
        req.method === "GET" &&
        path === "/api/players/online"
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

      /* =====================================================
         PROGRESSION
         ===================================================== */

      if (
        req.method === "GET" &&
        path === "/api/progression"
      ) {

        const player =
          requirePlayer(
            req,
            res
          );

        if (!player) return;

        const info =
          levelInfo(player);

        const requirements =
          info.next
            ? checkLevelRequirements(
                player,
                info.next
              )
            : {
                eligible: false,
                reasons: [
                  "Maximum level reached."
                ]
              };

        return send(
          res,
          200,
          {
            player:
              playerView(player),

            current:
              info.current,

            next:
              info.next,

            requirements,

            levels:
              LEVELS
          }
        );
      }

      /* =====================================================
         ASSETS
         ===================================================== */

      if (
        req.method === "GET" &&
        path === "/api/assets"
      ) {

        const player =
          requirePlayer(
            req,
            res
          );

        if (!player) return;

        let category =
          String(
            url.searchParams.get(
              "category"
            ) || ""
          ).trim();

        const aliases = {
          businesses: "business",
          concessions: "concession",
          subsidiaries: "subsidiary",
          properties: "property",
          resources: "resource",
          investments: "investment",
          production: "production",
          transportation: "transportation"
        };

        category =
          aliases[
            category.toLowerCase()
          ] || category;

        const assets =
          category
            ? db.assets.filter(
                a =>
                  a.category.toLowerCase() ===
                  category.toLowerCase()
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
         BUY
         ===================================================== */

      if (
        req.method === "POST" &&
        path === "/api/assets/buy"
      ) {

        const player =
          requirePlayer(
            req,
            res
          );

        if (!player) return;

        const type =
          String(
            body.type ||
            body.assetType ||
            body.name ||
            ""
          ).trim();

        const asset =
          findAsset(type);

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

        if (quantity > 100000) {
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
          player.cash < cost
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

        const owned =
          player.assets.find(
            x =>
              normalizeType(
                x.type
              ) ===
              normalizeType(
                asset.type
              )
          );

        if (owned) {
          owned.quantity +=
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

        if (
          asset.category ===
          "investment"
        ) {
          player.investmentValue =
            Number(
              player.investmentValue ||
                0
            ) + cost;
        }

        player.brandPoints +=
          asset.category ===
          "business"
            ? Math.max(
                1,
                Math.floor(
                  quantity / 2
                )
              )
            : 0;

        const levelUp =
          tryLevelUp(player);

        const missions =
          processMissionRewards(
            player
          );

        return send(
          res,
          200,
          {
            ok: true,
            message:
              "purchase successful",
            asset,
            quantity,
            cost,
            cash:
              player.cash,
            levelUp,
            missions,
            player:
              playerView(player)
          }
        );
      }

      /* =====================================================
         SELL
         ===================================================== */

      if (
        req.method === "POST" &&
        path === "/api/assets/sell"
      ) {

        const player =
          requirePlayer(
            req,
            res
          );

        if (!player) return;

        const asset =
          findAsset(
            body.type ||
            body.assetType ||
            body.name
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

        const quantity =
          Math.max(
            1,
            Math.floor(
              Number(
                body.quantity || 1
              )
            )
          );

        const owned =
          player.assets.find(
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
                normalizeType(
                  x.type
                ) !==
                normalizeType(
                  asset.type
                )
            );
        }

        player.cash += value;

        return send(
          res,
          200,
          {
            ok: true,
            value,
            cash:
              player.cash,
            player:
              playerView(player)
          }
        );
      }

      /* =====================================================
         INCOME
         ===================================================== */

      if (
        req.method === "GET" &&
        path === "/api/income"
      ) {

        const player =
          requirePlayer(
            req,
            res
          );

        if (!player) return;

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

            cycle:
              "1 hour",

            maxOfflineCycles: 24
          }
        );
      }

      if (
        req.method === "POST" &&
        path === "/api/assets/collect"
      ) {

        const player =
          requirePlayer(
            req,
            res
          );

        if (!player) return;

        const income =
          calculateNetIncome(
            player
          );

        player.cash += income;

        player.xp +=
          Math.max(
            1,
            Math.floor(
              income / 10000
            )
          );

        const missions =
          processMissionRewards(
            player
          );

        tryLevelUp(player);

        return send(
          res,
          200,
          {
            ok: true,
            income,
            cash:
              player.cash,
            missions,
            player:
              playerView(player)
          }
        );
      }

      /* =====================================================
         COUNTRIES
         ===================================================== */

      if (
        req.method === "GET" &&
        path === "/api/countries"
      ) {

        const countries =
          COUNTRY_NAMES.map(
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
                    (
                      sum,
                      p
                    ) =>
                      sum +
                      calculateNetWorth(
                        p
                      ),
                    0
                  ),

                totalMilitaryPower:
                  companies.reduce(
                    (
                      sum,
                      p
                    ) =>
                      sum +
                      militaryPower(
                        p
                      ),
                    0
                  ),

                investment:
                  companies.reduce(
                    (
                      sum,
                      p
                    ) =>
                      sum +
                      Number(
                        p.investmentValue ||
                          0
                      ),
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

      if (
        req.method === "POST" &&
        path === "/api/countries/select"
      ) {

        const player =
          requirePlayer(
            req,
            res
          );

        if (!player) return;

        const country =
          String(
            body.country || ""
          ).trim();

        if (
          !COUNTRY_NAMES.includes(
            country
          )
        ) {
          return send(
            res,
            400,
            {
              error:
                "country not available"
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
            country,
            player:
              playerView(player)
          }
        );
      }

      /* =====================================================
         WORLD SITES
         ===================================================== */

      if (
        req.method === "GET" &&
        path === "/api/world/sites"
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

      if (
        req.method === "POST" &&
        path === "/api/world/sites/claim"
      ) {

        const player =
          requirePlayer(
            req,
            res
          );

        if (!player) return;

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

        const fee =
          100000;

        if (
          player.cash < fee
        ) {
          return send(
            res,
            400,
            {
              error:
                "need $100,000 claim fee"
            }
          );
        }

        player.cash -= fee;

        site.ownerId =
          player.id;

        player.xp += 250;
        player.patriotism += 2;

        return send(
          res,
          200,
          {
            ok: true,
            site,
            cash:
              player.cash,
            player:
              playerView(player)
          }
        );
      }

      /* =====================================================
         RESEARCH
         ===================================================== */

      if (
        req.method === "GET" &&
        path === "/api/research"
      ) {

        const player =
          requirePlayer(
            req,
            res
          );

        if (!player) return;

        return send(
          res,
          200,
          {
            research:
              RESEARCH_CATALOG.map(
                item => ({
                  ...item,
                  level:
                    Number(
                      player.research[
                        item.id
                      ] || 0
                    )
                })
              )
          }
        );
      }

      if (
        req.method === "POST" &&
        path === "/api/research/upgrade"
      ) {

        const player =
          requirePlayer(
            req,
            res
          );

        if (!player) return;

        const id =
          String(
            body.id ||
            body.research ||
            ""
          );

        const item =
          RESEARCH_CATALOG.find(
            x =>
              x.id === id
          );

        if (!item) {
          return send(
            res,
            404,
            {
              error:
                "research not found"
            }
          );
        }

        const current =
          Number(
            player.research[id] ||
              0
          );

        const cost =
          item.cost *
          (current + 1);

        if (
          player.cash < cost
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

        player.cash -= cost;

        player.research[id] =
          current + 1;

        player.xp +=
          item.xp;

        if (
          id === "business_ai"
        ) {
          player.brandPoints += 5;
        }

        return send(
          res,
          200,
          {
            ok: true,
            research: item,
            level:
              player.research[id],
            cost,
            cash:
              player.cash,
            player:
              playerView(player)
          }
        );
      }

      /* =====================================================
         MEGA PROJECTS
         ===================================================== */

      if (
        req.method === "GET" &&
        path === "/api/mega-projects"
      ) {

        const player =
          requirePlayer(
            req,
            res
          );

        if (!player) return;

        return send(
          res,
          200,
          {
            projects:
              MEGA_PROJECT_CATALOG.map(
                project => {

                  const existing =
                    db.megaProjects.find(
                      p =>
                        p.playerId ===
                          player.id &&
                        p.projectId ===
                          project.id
                    );

                  return {
                    ...project,
                    progress:
                      existing
                        ? existing.progress
                        : 0,
                    completed:
                      existing
                        ? existing.completed
                        : false
                  };
                }
              )
          }
        );
      }

      if (
        req.method === "POST" &&
        path === "/api/mega-projects/invest"
      ) {

        const player =
          requirePlayer(
            req,
            res
          );

        if (!player) return;

        const project =
          MEGA_PROJECT_CATALOG.find(
            x =>
              x.id ===
              String(
                body.projectId ||
                body.id
              )
          );

        if (!project) {
          return send(
            res,
            404,
            {
              error:
                "project not found"
            }
          );
        }

        if (
          player.level <
          project.requiredLevel
        ) {
          return send(
            res,
            400,
            {
              error:
                `requires level ${project.requiredLevel}`
            }
          );
        }

        let amount =
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
                "invalid investment"
            }
          );
        }

        amount =
          Math.floor(amount);

        if (
          player.cash < amount
        ) {
          return send(
            res,
            400,
            {
              error:
                "insufficient cash"
            }
          );
        }

        let record =
          db.megaProjects.find(
            p =>
              p.playerId ===
                player.id &&
              p.projectId ===
                project.id
          );

        if (!record) {
          record = {
            id:
              db.nextMegaId++,
            playerId:
              player.id,
            projectId:
              project.id,
            progress: 0,
            completed: false
          };

          db.megaProjects.push(
            record
          );
        }

        if (record.completed) {
          return send(
            res,
            400,
            {
              error:
                "project already completed"
            }
          );
        }

        player.cash -= amount;

        record.progress +=
          amount;

        if (
          record.progress >=
          project.cost
        ) {
          record.progress =
            project.cost;

          record.completed =
            true;

          player.cash +=
            project.rewardCash;

          player.gold +=
            project.rewardGold;

          player.megaProjectsCompleted++;

          player.xp += 5000;
        }

        return send(
          res,
          200,
          {
            ok: true,
            project,
            progress:
              record.progress,
            completed:
              record.completed,
            cash:
              player.cash,
            player:
              playerView(player)
          }
        );
      }

      /* =====================================================
         MISSIONS
         ===================================================== */

      if (
        req.method === "GET" &&
        path === "/api/missions"
      ) {

        const player =
          requirePlayer(
            req,
            res
          );

        if (!player) return;

        createMissions(player);

        return send(
          res,
          200,
          {
            missions:
              db.missions
                .filter(
                  m =>
                    m.playerId ===
                    player.id
                )
                .map(
                  m => ({
                    ...m,
                    progress:
                      missionProgress(
                        player,
                        m
                      )
                  })
                )
          }
        );
      }

      /* =====================================================
         LOANS
         ===================================================== */

      if (
        req.method === "GET" &&
        path === "/api/loans"
      ) {

        const player =
          requirePlayer(
            req,
            res
          );

        if (!player) return;

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
        (
          path === "/api/loans" ||
          path === "/api/loans/take"
        )
      ) {

        const player =
          requirePlayer(
            req,
            res
          );

        if (!player) return;

        const amount =
          Math.floor(
            Number(
              body.amount || 0
            )
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

        const maximum =
          Math.max(
            100000,
            calculateNetWorth(
              player
            ) * 0.5
          );

        if (
          amount > maximum
        ) {
          return send(
            res,
            400,
            {
              error:
                "loan exceeds your limit",
              maximum
            }
          );
        }

        const loan = {
          id:
            db.nextLoanId++,
          playerId:
            player.id,
          amount,
          interestRate: 10,
          remaining:
            Math.floor(
              amount * 1.10
            ),
          createdAt:
            new Date().toISOString(),
          paid: false
        };

        db.loans.push(loan);

        player.cash += amount;

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

      if (
        req.method === "POST" &&
        path === "/api/loans/repay"
      ) {

        const player =
          requirePlayer(
            req,
            res
          );

        if (!player) return;

        const loan =
          db.loans.find(
            l =>
              l.id ===
                Number(
                  body.loanId
                ) &&
              l.playerId ===
                player.id &&
              !l.paid
          );

        if (!loan) {
          return send(
            res,
            404,
            {
              error:
                "loan not found"
            }
          );
        }

        let amount =
          Math.floor(
            Number(
              body.amount ||
              loan.remaining
            )
          );

        amount =
          Math.min(
            amount,
            loan.remaining
          );

        if (
          player.cash < amount
        ) {
          return send(
            res,
            400,
            {
              error:
                "insufficient cash"
            }
          );
        }

        player.cash -= amount;

        loan.remaining -=
          amount;

        if (
          loan.remaining <= 0
        ) {
          loan.remaining = 0;
          loan.paid = true;
        }

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
         MILITARY
         ===================================================== */

      if (
        req.method === "GET" &&
        path === "/api/army"
      ) {

        const player =
          requirePlayer(
            req,
            res
          );

        if (!player) return;

        return send(
          res,
          200,
          {
            army: {
              units:
                MILITARY_UNITS.map(
                  unit => ({
                    id: unit[0],
                    name: unit[1],
                    price: unit[2],
                    attack: unit[3],
                    defense: unit[4],
                    quantity:
                      Number(
                        player.military[
                          unit[0]
                        ] || 0
                      )
                  })
                ),

              ground:
                Number(
                  player.military.soldiers ||
                  0
                ),

              air:
                Number(
                  player.military.fighter_aircraft ||
                  0
                ),

              defense:
                armyDefense(player),

              offensiveLevel:
                player.offensiveLevel,

              power:
                militaryPower(player)
            }
          }
        );
      }

      if (
        req.method === "POST" &&
        path === "/api/army/upgrade"
      ) {

        const player =
          requirePlayer(
            req,
            res
          );

        if (!player) return;

        const unitId =
          String(
            body.unit ||
            body.type ||
            "soldiers"
          );

        const unit =
          MILITARY_UNITS.find(
            x =>
              x[0] === unitId
          );

        if (!unit) {
          return send(
            res,
            404,
            {
              error:
                "military unit not found"
            }
          );
        }

        const quantity =
          Math.max(
            1,
            Math.floor(
              Number(
                body.quantity || 1
              )
            )
          );

        const cost =
          unit[2] *
          quantity;

        if (
          player.cash < cost
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

        player.cash -= cost;

        player.military[
          unit[0]
        ] =
          Number(
            player.military[
              unit[0]
            ] || 0
          ) + quantity;

        player.xp +=
          Math.max(
            1,
            Math.floor(
              cost / 100000
            )
          );

        if (
          militaryPower(
            player
          ) >=
          player.offensiveLevel *
            1000
        ) {
          player.offensiveLevel++;
        }

        player.defense =
          Math.max(
            player.defense,
            armyDefense(player)
          );

        return send(
          res,
          200,
          {
            ok: true,
            unit:
              unit[1],
            quantity,
            cost,
            army: {
              offensiveLevel:
                player.offensiveLevel,
              defense:
                armyDefense(player),
              power:
                militaryPower(player),
              units:
                player.military
            },
            cash:
              player.cash
          }
        );
      }

      /* =====================================================
         WARS
         ===================================================== */

      if (
        req.method === "GET" &&
        path === "/api/wars"
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
        (
          path === "/api/wars" ||
          path === "/api/wars/attack"
        )
      ) {

        const attacker =
          requirePlayer(
            req,
            res
          );

        if (!attacker) return;

        const targetId =
          Number(
            body.targetPlayerId ||
            body.targetId
          );

        const target =
          db.players.find(
            p =>
              p.id ===
              targetId
          );

        if (
          !target ||
          target.id ===
            attacker.id
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

        const attackPower =
          militaryPower(
            attacker
          ) +
          attacker.offensiveLevel *
            500;

        const defensePower =
          armyDefense(
            target
          );

        const roll =
          0.8 +
          Math.random() *
            0.4;

        const won =
          attackPower *
            roll >=
          defensePower;

        const war = {
          id:
            db.nextWarId++,
          attackerId:
            attacker.id,
          targetId:
            target.id,
          attackPower,
          defensePower,
          win: won,
          createdAt:
            new Date().toISOString()
        };

        db.wars.push(war);

        if (won) {
          attacker.offensiveLevel++;
          attacker.patriotism += 2;

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
        } else {
          attacker.patriotism =
            Math.max(
              0,
              attacker.patriotism -
                1
            );
        }

        return send(
          res,
          200,
          {
            ok: true,

            result: {
              win: won,
              message:
                won
                  ? "Victory! Offensive level increased."
                  : "Defeat. Rebuild your army."
            },

            war,

            army: {
              offensiveLevel:
                attacker.offensiveLevel,
              defense:
                armyDefense(attacker),
              power:
                militaryPower(attacker)
            }
          }
        );
      }

      /* =====================================================
         CONTRACTS
         ===================================================== */

      if (
        req.method === "GET" &&
        path === "/api/contracts"
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

      if (
        req.method === "GET" &&
        path === "/api/contracts/running"
      ) {

        return send(
          res,
          200,
          {
            contracts:
              db.contracts.filter(
                c =>
                  c.status ===
                  "running"
              )
          }
        );
      }

      if (
        req.method === "POST" &&
        (
          path === "/api/contracts/bid" ||
          path === "/api/contracts/bids"
        )
      ) {

        const player =
          requirePlayer(
            req,
            res
          );

        if (!player) return;

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

        const amount =
          Number(
            body.amount ||
            body.bidAmount ||
            body.bid ||
            0
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
                "invalid bid"
            }
          );
        }

        if (!contract.bids) {
          contract.bids = [];
        }

        contract.bids.push({
          playerId:
            player.id,
          username:
            player.username,
          amount,
          createdAt:
            new Date().toISOString()
        });

        contract.bids.sort(
          (a, b) =>
            a.amount -
            b.amount
        );

        return send(
          res,
          200,
          {
            ok: true,
            message:
              "bid submitted",
            contract
          }
        );
      }

      if (
        req.method === "GET" &&
        (
          path ===
            "/api/contracts/bids/ranking" ||
          path ===
            "/api/contracts/bid-ranking"
        )
      ) {

        const rankings = [];

        for (
          const contract of
          db.contracts
        ) {
          for (
            const bid of
            contract.bids || []
          ) {
            rankings.push({
              contractId:
                contract.id,
              contract:
                contract.title,
              ...bid
            });
          }
        }

        rankings.sort(
          (a, b) =>
            a.amount -
            b.amount
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
         ALLIANCES
         ===================================================== */

      if (
        req.method === "GET" &&
        path === "/api/alliances"
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
        path === "/api/alliances/create"
      ) {

        const player =
          requirePlayer(
            req,
            res
          );

        if (!player) return;

        if (
          player.level < 4
        ) {
          return send(
            res,
            400,
            {
              error:
                "alliances require level 4"
            }
          );
        }

        const alliance = {
          id:
            db.nextAllianceId++,
          name:
            String(
              body.name ||
              "New Alliance"
            ),
          ownerId:
            player.id,
          members: [
            player.id
          ],
          createdAt:
            new Date().toISOString()
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

      /* =====================================================
         CHAT
         ===================================================== */

      if (
        req.method === "GET" &&
        path === "/api/chat"
      ) {

        return send(
          res,
          200,
          {
            messages:
              db.chat.slice(-100)
          }
        );
      }

      if (
        req.method === "POST" &&
        path === "/api/chat"
      ) {

        const player =
          requirePlayer(
            req,
            res
          );

        if (!player) return;

        const message =
          String(
            body.message || ""
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
          message:
            message.slice(
              0,
              1000
            ),
          createdAt:
            new Date().toISOString()
        };

        db.chat.push(item);

        return send(
          res,
          201,
          {
            ok: true,
            message: item
          }
        );
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
                b.netWorth -
                a.netWorth
            )
            .map(
              (player, index) => ({
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
         UNKNOWN ROUTE
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

server.listen(
  PORT,
  () => {
    console.log(
      `Tycoon Empire ${VERSION} running on port ${PORT}`
    );
  }
);
