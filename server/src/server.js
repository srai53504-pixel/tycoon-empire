const http = require("http");
const crypto = require("crypto");

const PORT = process.env.PORT || 10000;
const VERSION = "1.1.0";

/* =========================================================
   DATABASE
   ========================================================= */

const db = {
  players: [],
  sessions: {},
  assets: [],
  contracts: [],
  contractBids: [],
  alliances: [],
  chat: [],
  wars: [],
  loans: [],
  research: [],
  megaProjects: [],
  worldSites: [],
  missions: [],
  countries: [],

  nextPlayerId: 1,
  nextAssetId: 1,
  nextContractId: 1,
  nextBidId: 1,
  nextAllianceId: 1,
  nextMessageId: 1,
  nextWarId: 1,
  nextLoanId: 1
};

/* =========================================================
   COUNTRIES
   ========================================================= */

const COUNTRY_NAMES = [
  "United States",
  "Canada",
  "United Kingdom",
  "Germany",
  "France",
  "Italy",
  "Spain",
  "Russia",
  "China",
  "Japan",
  "India",
  "Australia",
  "Brazil",
  "Mexico",
  "South Africa",
  "Indonesia",
  "Saudi Arabia",
  "Chile",
  "Argentina",
  "Turkey"
];

for (let i = 0; i < COUNTRY_NAMES.length; i++) {
  db.countries.push({
    id: i + 1,
    name: COUNTRY_NAMES[i],
    code: COUNTRY_NAMES[i]
      .replace(/[^A-Za-z]/g, "")
      .substring(0, 3)
      .toUpperCase(),

    population: 50000000 + i * 12500000,
    gdp: 500000000000 + i * 75000000000,
    taxRate: 10 + (i % 6),
    stability: 70 + (i % 25)
  });
}

/* =========================================================
   ASSET CATALOG
   Prices are provisional game configuration values.
   ========================================================= */

const catalog = [
  /* BUSINESSES */
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
  ["business", "Dance club", 1000000, 7500],
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

  /* ADVANCED BUSINESSES */
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

  /* TRANSPORTATION */
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
  ["transportation", "Cargo airplane", 12000000, 110000],
  ["transportation", "Crude-oil carrier", 15000000, 130000],
  ["transportation", "Submarine", 25000000, 200000],
  ["transportation", "Driverless taxi", 500000, 5000],
  ["transportation", "Super fast train", 50000000, 500000],
  ["transportation", "Super Tank", 100000000, 900000],
  ["transportation", "Melee Robot", 150000000, 1200000],
  ["transportation", "Passenger Plane", 2500000, 22000],
  ["transportation", "Cargo Plane", 3500000, 30000],
  ["transportation", "VIP Limousine", 250000, 2200],

  /* CONCESSIONS */
  ["concession", "Ground Transport", 150000, 1200],
  ["concession", "Commerce", 300000, 2500],
  ["concession", "Leisure", 500000, 4000],
  ["concession", "Airlines", 5000000, 40000],
  ["concession", "Sea Lines", 7500000, 60000],
  ["concession", "Real Estate", 10000000, 90000],

  /* SUBSIDIARIES */
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

  /* INVESTMENTS */
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

  /* PROPERTIES */
  ["property", "Office building", 250000, 1500],
  ["property", "Living building", 500000, 3000],
  ["property", "Mall", 1000000, 7500],
  ["property", "Skyscraper", 10000000, 80000],
  ["property", "Small Office", 250000, 1500],
  ["property", "Corporate Office", 750000, 5000],
  ["property", "Headquarters", 2500000, 18000],
  ["property", "Luxury Hotel", 5000000, 40000],

  /* PRODUCTION */
  ["production", "Food Factory", 5000000, 35000],
  ["production", "Vehicle Factory", 25000000, 200000],
  ["production", "Electronics Factory", 10000000, 80000],
  ["production", "Manufacturing plant", 5000000, 35000],
  ["production", "Advanced factory", 25000000, 200000],
  ["production", "Technology center", 10000000, 80000],

  /* RESOURCES */
  ["resource", "Oil", 1000000, 8000],
  ["resource", "Gold", 1500000, 12000],
  ["resource", "Silver", 1200000, 9500],
  ["resource", "Iron", 500000, 4000],
  ["resource", "Copper", 650000, 5000],
  ["resource", "Aluminum", 700000, 5500],
  ["resource", "Diamonds", 5000000, 40000],
  ["resource", "Gems", 2500000, 20000],
  ["resource", "Salt", 300000, 2500]
];

for (const item of catalog) {
  db.assets.push({
    id: db.nextAssetId++,
    category: item[0],
    type: item[1],
    price: item[2],
    income: item[3],
    maintenance: Math.floor(item[3] * 0.05),
    tax: Math.floor(item[3] * 0.10),
    description: "Operate " + item[1],
    unlockLevel: 1
  });
}

/* =========================================================
   LEVEL PROGRESSION
   ========================================================= */

const LEVELS = [
  {
    level: 1,
    title: "Startup Founder",
    netWorth: 0,
    xp: 0,
    goldReward: 0,
    prestige: 0,
    properties: 0,
    offensive: 0,
    patriotism: 0,
    investments: 0,
    allies: 0,
    megaProjects: 0,
    brand: 0
  },
  {
    level: 2,
    title: "Business Owner",
    netWorth: 100000,
    xp: 100,
    goldReward: 5,
    prestige: 1,
    properties: 0,
    offensive: 0,
    patriotism: 0,
    investments: 0,
    allies: 0,
    megaProjects: 0,
    brand: 0
  },
  {
    level: 3,
    title: "Entrepreneur",
    netWorth: 500000,
    xp: 300,
    goldReward: 10,
    prestige: 2,
    properties: 1,
    offensive: 0,
    patriotism: 0,
    investments: 1,
    allies: 0,
    megaProjects: 0,
    brand: 0
  },
  {
    level: 4,
    title: "Business Executive",
    netWorth: 2000000,
    xp: 700,
    goldReward: 15,
    prestige: 4,
    properties: 2,
    offensive: 1,
    patriotism: 1,
    investments: 2,
    allies: 0,
    megaProjects: 0,
    brand: 1
  },
  {
    level: 5,
    title: "CEO",
    netWorth: 10000000,
    xp: 1500,
    goldReward: 25,
    prestige: 7,
    properties: 3,
    offensive: 2,
    patriotism: 2,
    investments: 3,
    allies: 1,
    megaProjects: 0,
    brand: 2
  },
  {
    level: 6,
    title: "Corporate Leader",
    netWorth: 50000000,
    xp: 3000,
    goldReward: 40,
    prestige: 10,
    properties: 5,
    offensive: 3,
    patriotism: 3,
    investments: 5,
    allies: 2,
    megaProjects: 1,
    brand: 5
  },
  {
    level: 7,
    title: "Industry Leader",
    netWorth: 150000000,
    xp: 6000,
    goldReward: 60,
    prestige: 15,
    properties: 7,
    offensive: 4,
    patriotism: 4,
    investments: 7,
    allies: 3,
    megaProjects: 1,
    brand: 10
  },
  {
    level: 8,
    title: "Business Magnate",
    netWorth: 500000000,
    xp: 12000,
    goldReward: 100,
    prestige: 20,
    properties: 10,
    offensive: 5,
    patriotism: 5,
    investments: 10,
    allies: 4,
    megaProjects: 2,
    brand: 15
  },
  {
    level: 9,
    title: "Corporate Tycoon",
    netWorth: 1000000000,
    xp: 25000,
    goldReward: 150,
    prestige: 30,
    properties: 15,
    offensive: 7,
    patriotism: 7,
    investments: 15,
    allies: 5,
    megaProjects: 2,
    brand: 25
  },
  {
    level: 10,
    title: "National Tycoon",
    netWorth: 5000000000,
    xp: 50000,
    goldReward: 250,
    prestige: 40,
    properties: 20,
    offensive: 10,
    patriotism: 10,
    investments: 20,
    allies: 7,
    megaProjects: 3,
    brand: 40
  },
  {
    level: 11,
    title: "International Tycoon",
    netWorth: 10000000000,
    xp: 90000,
    goldReward: 350,
    prestige: 50,
    properties: 25,
    offensive: 12,
    patriotism: 12,
    investments: 25,
    allies: 10,
    megaProjects: 3,
    brand: 50
  },
  {
    level: 12,
    title: "Global Entrepreneur",
    netWorth: 25000000000,
    xp: 150000,
    goldReward: 500,
    prestige: 65,
    properties: 30,
    offensive: 15,
    patriotism: 15,
    investments: 30,
    allies: 12,
    megaProjects: 4,
    brand: 65
  },
  {
    level: 13,
    title: "Global Magnate",
    netWorth: 50000000000,
    xp: 250000,
    goldReward: 700,
    prestige: 80,
    properties: 40,
    offensive: 18,
    patriotism: 18,
    investments: 40,
    allies: 15,
    megaProjects: 4,
    brand: 80
  },
  {
    level: 14,
    title: "Empire Builder",
    netWorth: 100000000000,
    xp: 400000,
    goldReward: 1000,
    prestige: 100,
    properties: 50,
    offensive: 22,
    patriotism: 22,
    investments: 50,
    allies: 18,
    megaProjects: 5,
    brand: 100
  },
  {
    level: 15,
    title: "Tycoon Empire",
    netWorth: 250000000000,
    xp: 650000,
    goldReward: 1500,
    prestige: 125,
    properties: 60,
    offensive: 25,
    patriotism: 25,
    investments: 60,
    allies: 20,
    megaProjects: 5,
    brand: 125
  }
];

/* =========================================================
   RESEARCH
   ========================================================= */

db.research = [
  {
    id: "business_ai",
    name: "Business AI",
    description: "Improves business efficiency.",
    maxLevel: 10,
    baseCost: 500000
  },
  {
    id: "advanced_logistics",
    name: "Advanced Logistics",
    description: "Improves transportation efficiency.",
    maxLevel: 10,
    baseCost: 750000
  },
  {
    id: "robotics",
    name: "Robotics",
    description: "Unlocks advanced automation.",
    maxLevel: 10,
    baseCost: 1500000
  },
  {
    id: "quantum_computing",
    name: "Quantum Computing",
    description: "Advanced technology research.",
    maxLevel: 10,
    baseCost: 5000000
  },
  {
    id: "space_engineering",
    name: "Space Engineering",
    description: "Enables advanced space projects.",
    maxLevel: 10,
    baseCost: 10000000
  }
];

/* =========================================================
   MEGA PROJECTS
   ========================================================= */

db.megaProjects = [
  {
    id: "global_headquarters",
    name: "Global Headquarters",
    description: "Build a global corporate headquarters.",
    required: 100000000,
    invested: 0
  },
  {
    id: "international_airport",
    name: "International Airport",
    description: "Construct an international transportation hub.",
    required: 500000000,
    invested: 0
  },
  {
    id: "national_space_program",
    name: "National Space Program",
    description: "Develop a national space program.",
    required: 1000000000,
    invested: 0
  },
  {
    id: "orbital_city",
    name: "Orbital City",
    description: "A massive futuristic space project.",
    required: 10000000000,
    invested: 0
  },
  {
    id: "global_trade_network",
    name: "Global Trade Network",
    description: "Connect global commerce infrastructure.",
    required: 5000000000,
    invested: 0
  }
];

/* =========================================================
   MISSIONS
   ========================================================= */

db.missions = [
  {
    id: "first_investment",
    name: "First Investment",
    description: "Purchase your first investment.",
    rewardCash: 100000,
    rewardGold: 5
  },
  {
    id: "build_your_fleet",
    name: "Build Your Fleet",
    description: "Own 5 transportation assets.",
    rewardCash: 250000,
    rewardGold: 10
  },
  {
    id: "business_expansion",
    name: "Business Expansion",
    description: "Own 10 businesses.",
    rewardCash: 500000,
    rewardGold: 15
  },
  {
    id: "world_investor",
    name: "World Investor",
    description: "Own 5 investment assets.",
    rewardCash: 1000000,
    rewardGold: 25
  },
  {
    id: "military_power",
    name: "Military Power",
    description: "Reach offensive level 5.",
    rewardCash: 2500000,
    rewardGold: 40
  },
  {
    id: "global_empire",
    name: "Global Empire",
    description: "Reach level 10.",
    rewardCash: 10000000,
    rewardGold: 100
  }
];

/* =========================================================
   WORLD SITES
   ========================================================= */

db.worldSites = [
  {
    id: "peru_copper",
    name: "Peru Copper Mine",
    resource: "Copper",
    country: "Peru",
    claimedBy: null
  },
  {
    id: "brazil_iron",
    name: "Brazil Iron Mine",
    resource: "Iron",
    country: "Brazil",
    claimedBy: null
  },
  {
    id: "indonesia_nickel",
    name: "Indonesia Nickel Site",
    resource: "Nickel",
    country: "Indonesia",
    claimedBy: null
  },
  {
    id: "australia_gold",
    name: "Australia Gold Mine",
    resource: "Gold",
    country: "Australia",
    claimedBy: null
  },
  {
    id: "canada_timber",
    name: "Canada Timber Site",
    resource: "Timber",
    country: "Canada",
    claimedBy: null
  },
  {
    id: "south_africa_platinum",
    name: "South Africa Platinum Mine",
    resource: "Platinum",
    country: "South Africa",
    claimedBy: null
  },
  {
    id: "chile_lithium",
    name: "Chile Lithium Mine",
    resource: "Lithium",
    country: "Chile",
    claimedBy: null
  },
  {
    id: "india_bauxite",
    name: "India Bauxite Mine",
    resource: "Bauxite",
    country: "India",
    claimedBy: null
  },
  {
    id: "saudi_oil",
    name: "Saudi Oil Field",
    resource: "Oil",
    country: "Saudi Arabia",
    claimedBy: null
  },
  {
    id: "usa_oil",
    name: "United States Oil Field",
    resource: "Oil",
    country: "United States",
    claimedBy: null
  },
  {
    id: "china_rare_earth",
    name: "China Rare Earth Site",
    resource: "Rare Earth",
    country: "China",
    claimedBy: null
  },
  {
    id: "south_africa_gold",
    name: "South Africa Gold Field",
    resource: "Gold",
    country: "South Africa",
    claimedBy: null
  }
];

/* =========================================================
   MILITARY UNITS
   ========================================================= */

const MILITARY_UNITS = [
  ["soldiers", "Soldiers", 1000, 5, 2, 1],
  ["small_tanks", "Small Tanks", 25000, 30, 5, 3],
  ["medium_tanks", "Medium Tanks", 75000, 75, 10, 8],
  ["heavy_tanks", "Heavy Tanks", 150000, 140, 20, 15],
  ["light_artillery", "Light Artillery", 50000, 50, 8, 10],
  ["heavy_artillery", "Heavy Artillery", 125000, 120, 15, 25],
  ["mlrs", "MLRS", 250000, 250, 30, 35],
  ["fighter_aircraft", "Fighter Aircraft", 1000000, 500, 100, 50],
  ["intelligence_aircraft", "Intelligence Aircraft", 1500000, 350, 80, 100],
  ["gunships", "Gunships", 2000000, 700, 120, 80],
  ["navy_seals", "Navy SEALs", 750000, 300, 50, 100],
  ["special_forces", "Special Forces", 1000000, 500, 80, 120],
  ["cyber_soldiers", "Cyber Soldiers", 1500000, 250, 100, 150],
  ["cyber_warriors", "Cyber Warriors", 5000000, 750, 200, 250],
  ["battle_cruisers", "Battle Cruisers", 25000000, 2000, 500, 400],
  ["aircraft_carriers", "Aircraft Carriers", 50000000, 5000, 1000, 800],
  ["anti_aircraft", "Anti-Aircraft", 500000, 100, 20, 250],
  ["anti_ship", "Anti-Ship Shore Turrets", 750000, 150, 30, 300],
  ["avenger", "Avenger", 1000000, 200, 40, 400],
  ["ballistic_missiles", "Ballistic Missiles", 10000000, 3000, 500, 1000],
  ["smart_bombs", "Smart Bombs", 5000000, 1200, 250, 400],
  ["espionage_satellites", "Espionage Satellites", 15000000, 1000, 500, 1000],
  ["communication_satellites", "Communication Satellites", 10000000, 500, 300, 1200],
  ["defence_robots", "Defence Robots", 7500000, 1500, 250, 1000]
];

function militaryForPlayer(player) {
  if (!player.military) {
    player.military = {};
  }

  return MILITARY_UNITS.map(unit => {
    const id = unit[0];

    return {
      id,
      name: unit[1],
      price: unit[2],
      attack: unit[3],
      air: unit[4],
      defense: unit[5],
      owned: Number(player.military[id] || 0)
    };
  });
}

function militaryPower(player) {
  let ground = 0;
  let air = 0;
  let defense = 0;

  for (const unit of militaryForPlayer(player)) {
    ground += unit.attack * unit.owned;
    air += unit.air * unit.owned;
    defense += unit.defense * unit.owned;
  }

  return {
    ground,
    air,
    defense,
    total: ground + air + defense
  };
}

/* =========================================================
   CONTRACTS
   ========================================================= */

const contractNames = [
  "Food Supply Contract",
  "Transportation Contract",
  "Construction Contract",
  "Electronics Contract",
  "Mining Contract",
  "Energy Contract",
  "International Logistics",
  "Government Supply Contract",
  "Luxury Goods Contract",
  "Technology Contract",
  "Vehicle Supply Contract",
  "Medical Supply Contract",
  "Industrial Contract",
  "Airport Logistics",
  "Global Trade Contract",
  "Resource Export Contract",
  "Commercial Development",
  "Infrastructure Contract",
  "Financial Services Contract",
  "Tourism Contract",
  "Space Technology Contract",
  "Defence Technology Contract",
  "Shipping Contract",
  "Mega Construction Contract"
];

for (let i = 0; i < contractNames.length; i++) {
  db.contracts.push({
    id: db.nextContractId++,
    name: contractNames[i],
    description: "Competitive business contract.",
    value: 250000 + i * 175000,
    duration: 3600,
    status: "OPEN",
    winnerId: null,
    createdAt: new Date().toISOString()
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
  const output = JSON.stringify(data);

  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
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

  const playerId =
    db.sessions[token];

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

function normalize(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function categoryAlias(category) {
  const aliases = {
    business: "business",
    businesses: "business",

    transport: "transportation",
    transportation: "transportation",

    concession: "concession",
    concessions: "concession",

    subsidiary: "subsidiary",
    subsidiaries: "subsidiary",

    investment: "investment",
    investments: "investment",

    property: "property",
    properties: "property",

    resource: "resource",
    resources: "resource",

    production: "production"
  };

  return aliases[
    normalize(category)
  ] || normalize(category);
}

function findAsset(value) {
  const requested =
    normalize(value);

  if (!requested) {
    return null;
  }

  return db.assets.find(asset => {

    const values = [
      asset.id,
      asset.type
    ];

    return values.some(value2 => {

      const actual =
        normalize(value2);

      return (
        actual === requested ||
        actual.replace(/\s/g, "") ===
          requested.replace(/\s/g, "")
      );
    });
  }) || null;
}

function playerAssetsValue(player) {
  let value = 0;

  for (const owned of player.assets || []) {
    const asset =
      findAsset(owned.type);

    if (asset) {
      value +=
        asset.price *
        Number(owned.quantity || 0);
    }
  }

  return value;
}

function playerIncome(player) {
  let gross = 0;
  let maintenance = 0;
  let tax = 0;

  for (const owned of player.assets || []) {

    const asset =
      findAsset(owned.type);

    if (!asset) continue;

    const quantity =
      Number(owned.quantity || 0);

    gross +=
      asset.income * quantity;

    maintenance +=
      (asset.maintenance || 0) *
      quantity;

    tax +=
      (asset.tax || 0) *
      quantity;
  }

  const net =
    gross -
    maintenance -
    tax;

  return {
    gross,
    maintenance,
    tax,
    net
  };
}

function calculateNetWorth(player) {
  return (
    Number(player.cash || 0) +
    playerAssetsValue(player)
  );
}

function playerView(player) {

  const income =
    playerIncome(player);

  const military =
    militaryPower(player);

  return {
    id: player.id,
    playerId: player.id,
    username: player.username,
    email: player.email,
    companyName: player.companyName,
    country: player.country,
    level: player.level,
    xp: player.xp,
    gold: player.gold,
    cash: player.cash,

    netWorth:
      calculateNetWorth(player),

    grossIncome:
      income.gross,

    maintenance:
      income.maintenance,

    tax:
      income.tax,

    netIncome:
      income.net,

    offensiveLevel:
      player.offensiveLevel,

    defense:
      player.defense,

    militaryPower:
      military.total,

    online: true,

    assets:
      player.assets || []
  };
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
    levels: LEVELS
  };
}

function assetCount(player, category) {

  const normalized =
    categoryAlias(category);

  return (player.assets || [])
    .reduce((total, owned) => {

      const asset =
        findAsset(owned.type);

      if (!asset) {
        return total;
      }

      if (
        asset.category !== normalized
      ) {
        return total;
      }

      return total +
        Number(owned.quantity || 0);

    }, 0);
}

function investmentCount(player) {
  return assetCount(
    player,
    "investment"
  );
}

function propertyCount(player) {
  return assetCount(
    player,
    "property"
  );
}

function tryLevelUp(player) {

  let changed = false;

  while (player.level < 15) {

    const next =
      LEVELS[player.level];

    if (!next) break;

    const requirementsMet =
      calculateNetWorth(player) >= next.netWorth &&
      Number(player.xp || 0) >= next.xp &&
      Number(player.prestige || 0) >= next.prestige &&
      propertyCount(player) >= next.properties &&
      Number(player.offensiveLevel || 0) >= next.offensive &&
      Number(player.patriotism || 0) >= next.patriotism &&
      investmentCount(player) >= next.investments &&
      Number(player.allies || 0) >= next.allies &&
      Number(player.megaProjects || 0) >= next.megaProjects &&
      Number(player.brand || 0) >= next.brand;

    if (!requirementsMet) {
      break;
    }

    player.level++;

    player.gold +=
      next.goldReward;

    changed = true;
  }

  return changed;
}

function missionStatus(player, mission) {

  let completed = false;

  if (mission.id === "first_investment") {
    completed =
      investmentCount(player) >= 1;
  }

  if (mission.id === "build_your_fleet") {
    completed =
      assetCount(player, "transportation") >= 5;
  }

  if (mission.id === "business_expansion") {
    completed =
      assetCount(player, "business") >= 10;
  }

  if (mission.id === "world_investor") {
    completed =
      investmentCount(player) >= 5;
  }

  if (mission.id === "military_power") {
    completed =
      Number(player.offensiveLevel || 0) >= 5;
  }

  if (mission.id === "global_empire") {
    completed =
      Number(player.level || 1) >= 10;
  }

  return completed;
}

/* =========================================================
   SERVER
   ========================================================= */

const server =
  http.createServer(
    async (req, res) => {

      if (req.method === "OPTIONS") {
        return send(res, 204, {});
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

        return send(res, 200, {
          ok: true,
          version: VERSION,
          service: "tycoon-empire",

          players:
            db.players.length,

          assets:
            db.assets.length,

          contracts:
            db.contracts.length,

          features: [
            "authentication",
            "players",
            "assets",
            "businesses",
            "transportation",
            "concessions",
            "subsidiaries",
            "investments",
            "properties",
            "production",
            "resources",
            "income",
            "progression",
            "research",
            "loans",
            "missions",
            "mega-projects",
            "world-sites",
            "countries",
            "rankings",
            "army",
            "wars",
            "contracts",
            "alliances",
            "chat"
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

          return send(res, 400, {
            error:
              "username, email and password are required"
          });
        }

        if (password.length < 4) {

          return send(res, 400, {
            error:
              "password must contain at least 4 characters"
          });
        }

        if (
          db.players.some(
            p =>
              p.email === email
          )
        ) {

          return send(res, 409, {
            error:
              "email already registered"
          });
        }

        if (
          db.players.some(
            p =>
              p.username.toLowerCase() ===
              username.toLowerCase()
          )
        ) {

          return send(res, 409, {
            error:
              "username already registered"
          });
        }

        const player = {

          id:
            db.nextPlayerId++,

          username,

          email,

          password:
            hashPassword(password),

          companyName:
            username + " Corporation",

          country:
            "India",

          level: 1,

          xp: 0,

          cash: 1000000,

          gold: 100,

          assets: [],

          offensiveLevel: 1,

          defense: 10,

          patriotism: 0,

          prestige: 0,

          brand: 0,

          allies: 0,

          megaProjects: 0,

          military: {},

          researchLevels: {},

          claimedMissions: [],

          createdAt:
            new Date().toISOString()
        };

        db.players.push(player);

        return send(res, 201, {
          ok: true,
          player:
            playerView(player)
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

          return send(res, 401, {
            error:
              "invalid email or password"
          });
        }

        const token =
          createToken();

        db.sessions[token] =
          player.id;

        return send(res, 200, {
          ok: true,
          token,
          accessToken: token,
          player:
            playerView(player)
        });
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
          player:
            playerView(player)
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
          players:
            db.players.map(
              playerView
            )
        });
      }

      /* =====================================================
         ASSETS
         ===================================================== */

      if (
        req.method === "GET" &&
        path === "/api/assets"
      ) {

        const player =
          requirePlayer(req, res);

        if (!player) return;

        const requestedCategory =
          url.searchParams.get(
            "category"
          ) || "";

        const category =
          categoryAlias(
            requestedCategory
          );

        const assets =
          requestedCategory
            ? db.assets.filter(
                a =>
                  a.category ===
                  category
              )
            : db.assets;

        return send(res, 200, {
          version: VERSION,
          assets,
          owned:
            player.assets || []
        });
      }

      /* =====================================================
         CATALOG
         ===================================================== */

      if (
        req.method === "GET" &&
        path === "/api/catalog"
      ) {

        const requestedCategory =
          url.searchParams.get(
            "category"
          ) || "";

        const category =
          categoryAlias(
            requestedCategory
          );

        const assets =
          requestedCategory
            ? db.assets.filter(
                a =>
                  a.category ===
                  category
              )
            : db.assets;

        return send(res, 200, {
          version: VERSION,
          assets
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

        const requested =
          body.assetId ||
          body.type ||
          body.assetType ||
          body.name ||
          "";

        const asset =
          findAsset(requested);

        if (!asset) {

          return send(res, 404, {
            error:
              "asset not found",

            requestedAsset:
              requested,

            availableAssets:
              db.assets.map(
                a => ({
                  id: a.id,
                  category: a.category,
                  type: a.type,
                  price: a.price
                })
              )
          });
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
          Math.floor(quantity);

        if (quantity < 1) {
          quantity = 1;
        }

        if (quantity > 100000) {

          return send(res, 400, {
            error:
              "quantity too large"
          });
        }

        const cost =
          asset.price *
          quantity;

        if (
          player.cash <
          cost
        ) {

          return send(res, 400, {
            error:
              "insufficient cash",

            cash:
              player.cash,

            price:
              asset.price,

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
              normalize(
                owned.type
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

        tryLevelUp(player);

        return send(res, 200, {
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

          cash:
            player.cash,

          player:
            playerView(player)
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

        const requested =
          body.assetId ||
          body.type ||
          body.assetType ||
          body.name ||
          "";

        const asset =
          findAsset(requested);

        if (!asset) {

          return send(res, 404, {
            error:
              "asset not found"
          });
        }

        let quantity =
          Number(
            body.quantity ||
            body.amount ||
            1
          );

        quantity =
          Math.max(
            1,
            Math.floor(quantity)
          );

        const owned =
          (player.assets || [])
            .find(
              a =>
                normalize(
                  a.type
                ) ===
                normalize(
                  asset.type
                )
            );

        if (
          !owned ||
          owned.quantity <
            quantity
        ) {

          return send(res, 400, {
            error:
              "not enough assets owned"
          });
        }

        const revenue =
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
              a =>
                normalize(
                  a.type
                ) !==
                normalize(
                  asset.type
                )
            );
        }

        player.cash +=
          revenue;

        return send(res, 200, {
          ok: true,
          revenue,
          cash:
            player.cash,
          player:
            playerView(player)
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

        const income =
          playerIncome(player);

        const amount =
          Math.max(
            0,
            income.net
          );

        player.cash +=
          amount;

        player.xp +=
          Math.max(
            1,
            Math.floor(
              amount / 10000
            )
          );

        tryLevelUp(player);

        return send(res, 200, {
          ok: true,
          income:
            amount,
          grossIncome:
            income.gross,
          maintenance:
            income.maintenance,
          tax:
            income.tax,
          netIncome:
            income.net,
          cash:
            player.cash,
          player:
            playerView(player)
        });
      }

      /* =====================================================
         INCOME
         ===================================================== */

      if (
        req.method === "GET" &&
        (
          path === "/api/income" ||
          path === "/api/assets/income"
        )
      ) {

        const player =
          requirePlayer(req, res);

        if (!player) return;

        const income =
          playerIncome(player);

        return send(res, 200, {
          grossIncome:
            income.gross,

          maintenance:
            income.maintenance,

          tax:
            income.tax,

          netIncome:
            income.net,

          cycleIncome:
            income.net,

          offlineCycles: 0,

          nextCycleInSeconds:
            3600 -

            (
              Math.floor(
                Date.now() / 1000
              ) % 3600
            ),

          cash:
            player.cash
        });
      }

      /* =====================================================
         PROGRESSION
         ===================================================== */

      if (
        req.method === "GET" &&
        path === "/api/progression"
      ) {

        const player =
          requirePlayer(req, res);

        if (!player) return;

        tryLevelUp(player);

        const info =
          levelInfo(player);

        return send(res, 200, {
          current:
            info.current,

          next:
            info.next,

          levels:
            info.levels,

          player:
            playerView(player)
        });
      }

      /* =====================================================
         RESEARCH
         ===================================================== */

      if (
        req.method === "GET" &&
        path === "/api/research"
      ) {

        const player =
          requirePlayer(req, res);

        if (!player) return;

        const research =
          db.research.map(r => {

            const level =
              Number(
                player.researchLevels[
                  r.id
                ] || 0
              );

            return {
              ...r,
              level,
              cost:
                Math.floor(
                  r.baseCost *
                  Math.pow(
                    1.5,
                    level
                  )
                )
            };
          });

        return send(res, 200, {
          research
        });
      }

      if (
        req.method === "POST" &&
        path === "/api/research/upgrade"
      ) {

        const player =
          requirePlayer(req, res);

        if (!player) return;

        const id =
          String(
            body.researchId ||
            body.id ||
            ""
          );

        const research =
          db.research.find(
            r => r.id === id
          );

        if (!research) {

          return send(res, 404, {
            error:
              "research not found"
          });
        }

        const currentLevel =
          Number(
            player.researchLevels[
              id
            ] || 0
          );

        if (
          currentLevel >=
          research.maxLevel
        ) {

          return send(res, 400, {
            error:
              "research already at maximum level"
          });
        }

        const cost =
          Math.floor(
            research.baseCost *
            Math.pow(
              1.5,
              currentLevel
            )
          );

        if (
          player.cash <
          cost
        ) {

          return send(res, 400, {
            error:
              "insufficient cash",
            cost,
            cash:
              player.cash
          });
        }

        player.cash -=
          cost;

        player.researchLevels[id] =
          currentLevel + 1;

        player.xp +=
          Math.floor(
            cost / 10000
          );

        return send(res, 200, {
          ok: true,
          researchId: id,
          level:
            currentLevel + 1,
          cost,
          cash:
            player.cash
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

        const loans =
          db.loans.filter(
            l =>
              l.playerId ===
              player.id
          );

        const debt =
          loans.reduce(
            (sum, loan) =>
              sum +
              loan.remaining,
            0
          );

        return send(res, 200, {
          loans,

          debt,

          totalDebt:
            debt,

          cash:
            player.cash,

          interestRate:
            10
        });
      }

      if (
        req.method === "POST" &&
        (
          path === "/api/loans" ||
          path === "/api/loans/take"
        )
      ) {

        const player =
          requirePlayer(req, res);

        if (!player) return;

        const amount =
          Number(
            body.amount || 0
          );

        if (
          !Number.isFinite(amount) ||
          amount <= 0
        ) {

          return send(res, 400, {
            error:
              "invalid loan amount"
          });
        }

        if (amount > 1000000000) {

          return send(res, 400, {
            error:
              "loan amount exceeds limit"
          });
        }

        const loan = {
          id:
            db.nextLoanId++,

          playerId:
            player.id,

          principal:
            amount,

          amount,

          remaining:
            Math.floor(
              amount * 1.10
            ),

          interest:
            Math.floor(
              amount * 0.10
            ),

          createdAt:
            new Date().toISOString()
        };

        db.loans.push(loan);

        player.cash +=
          amount;

        return send(res, 200, {
          ok: true,
          loan,
          cash:
            player.cash
        });
      }

      if (
        req.method === "POST" &&
        path === "/api/loans/repay"
      ) {

        const player =
          requirePlayer(req, res);

        if (!player) return;

        const amount =
          Number(
            body.amount || 0
          );

        if (
          !Number.isFinite(amount) ||
          amount <= 0
        ) {

          return send(res, 400, {
            error:
              "invalid repayment amount"
          });
        }

        const loans =
          db.loans.filter(
            l =>
              l.playerId ===
              player.id &&
              l.remaining > 0
          );

        let remainingPayment =
          Math.min(
            amount,
            player.cash
          );

        if (
          remainingPayment <= 0
        ) {

          return send(res, 400, {
            error:
              "insufficient cash"
          });
        }

        for (const loan of loans) {

          if (
            remainingPayment <=
            0
          ) {
            break;
          }

          const payment =
            Math.min(
              remainingPayment,
              loan.remaining
            );

          loan.remaining -=
            payment;

          remainingPayment -=
            payment;
        }

        const paid =
          Math.min(
            amount,
            player.cash
          ) -
          remainingPayment;

        player.cash -=
          paid;

        return send(res, 200, {
          ok: true,
          paid,
          cash:
            player.cash
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

        const missions =
          db.missions.map(
            mission => {

              const completed =
                missionStatus(
                  player,
                  mission
                );

              const claimed =
                player.claimedMissions
                  .includes(
                    mission.id
                  );

              return {
                ...mission,
                completed,
                claimed
              };
            }
          );

        return send(res, 200, {
          missions
        });
      }

      /* =====================================================
         MEGA PROJECTS
         ===================================================== */

      if (
        req.method === "GET" &&
        path === "/api/mega-projects"
      ) {

        return send(res, 200, {
          projects:
            db.megaProjects
        });
      }

      if (
        req.method === "POST" &&
        path === "/api/mega-projects/invest"
      ) {

        const player =
          requirePlayer(req, res);

        if (!player) return;

        const projectId =
          String(
            body.projectId ||
            body.id ||
            ""
          );

        const project =
          db.megaProjects.find(
            p =>
              p.id === projectId
          );

        if (!project) {

          return send(res, 404, {
            error:
              "mega project not found"
          });
        }

        const amount =
          Number(
            body.amount || 0
          );

        if (
          !Number.isFinite(amount) ||
          amount <= 0
        ) {

          return send(res, 400, {
            error:
              "invalid investment amount"
          });
        }

        if (
          player.cash <
          amount
        ) {

          return send(res, 400, {
            error:
              "insufficient cash"
          });
        }

        player.cash -=
          amount;

        project.invested +=
          amount;

        if (
          project.invested >=
          project.required
        ) {
          player.megaProjects++;
        }

        return send(res, 200, {
          ok: true,
          project,
          cash:
            player.cash
        });
      }

      /* =====================================================
         WORLD SITES
         ===================================================== */

      if (
        req.method === "GET" &&
        path === "/api/world/sites"
      ) {

        const player =
          requirePlayer(req, res);

        if (!player) return;

        return send(res, 200, {
          sites:
            db.worldSites.map(
              site => ({
                ...site,

                claimed:
                  site.claimedBy !== null &&
                  site.claimedBy ===
                    player.id
              })
            )
        });
      }

      if (
        req.method === "POST" &&
        path === "/api/world/sites/claim"
      ) {

        const player =
          requirePlayer(req, res);

        if (!player) return;

        const siteId =
          String(
            body.siteId ||
            body.id ||
            ""
          );

        const site =
          db.worldSites.find(
            s =>
              s.id === siteId
          );

        if (!site) {

          return send(res, 404, {
            error:
              "world site not found"
          });
        }

        if (
          site.claimedBy !== null
        ) {

          return send(res, 400, {
            error:
              "site already claimed"
          });
        }

        site.claimedBy =
          player.id;

        return send(res, 200, {
          ok: true,
          site
        });
      }

      /* =====================================================
         COUNTRIES
         ===================================================== */

      if (
        req.method === "GET" &&
        path === "/api/countries"
      ) {

        return send(res, 200, {
          countries:
            db.countries
        });
      }

      if (
        req.method === "POST" &&
        path === "/api/countries/select"
      ) {

        const player =
          requirePlayer(req, res);

        if (!player) return;

        const requested =
          String(
            body.country ||
            body.name ||
            body.countryId ||
            ""
          );

        const country =
          db.countries.find(
            c =>
              String(c.id) ===
                requested ||
              c.name.toLowerCase() ===
                requested.toLowerCase() ||
              c.code.toLowerCase() ===
                requested.toLowerCase()
          );

        if (!country) {

          return send(res, 404, {
            error:
              "country not found"
          });
        }

        player.country =
          country.name;

        return send(res, 200, {
          ok: true,
          country,
          player:
            playerView(player)
        });
      }

      /* =====================================================
         RANKINGS
         ===================================================== */

      if (
        req.method === "GET" &&
        (
          path === "/api/rankings" ||
          path === "/api/rankings/global"
        )
      ) {

        const rankings =
          db.players
            .map(
              player =>
                playerView(player)
            )
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

        const power =
          militaryPower(player);

        return send(res, 200, {
          ground:
            power.ground,

          air:
            power.air,

          defense:
            power.defense,

          militaryPower:
            power.total,

          offensiveLevel:
            player.offensiveLevel,

          units:
            militaryForPlayer(player),

          army: {
            ground:
              power.ground,

            air:
              power.air,

            defense:
              power.defense,

            militaryPower:
              power.total,

            offensiveLevel:
              player.offensiveLevel
          }
        });
      }

      if (
        req.method === "POST" &&
        (
          path === "/api/army/upgrade" ||
          path === "/api/army/update"
        )
      ) {

        const player =
          requirePlayer(req, res);

        if (!player) return;

        /* New unit purchase */
        if (
          body.unit ||
          body.unitId
        ) {

          const unitId =
            String(
              body.unit ||
              body.unitId
            );

          const definition =
            MILITARY_UNITS.find(
              u =>
                u[0] === unitId
            );

          if (!definition) {

            return send(res, 404, {
              error:
                "military unit not found"
            });
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
            definition[2] *
            quantity;

          if (
            player.cash <
            cost
          ) {

            return send(res, 400, {
              error:
                "insufficient cash",
              cost,
              cash:
                player.cash
            });
          }

          player.cash -=
            cost;

          if (!player.military) {
            player.military = {};
          }

          player.military[unitId] =
            Number(
              player.military[unitId] || 0
            ) +
            quantity;

          player.offensiveLevel =
            Math.max(
              player.offensiveLevel,
              Math.floor(
                militaryPower(player)
                  .total / 1000
              ) + 1
            );

          return send(res, 200, {
            ok: true,
            unit:
              unitId,
            quantity,
            cost,
            cash:
              player.cash,
            army: militaryPower(player)
          });
        }

        /* Compatibility with old army/update */
        if (
          body.offensiveLevel !==
          undefined
        ) {

          player.offensiveLevel =
            Math.max(
              1,
              Number(
                body.offensiveLevel
              )
            );
        }

        if (
          body.defense !==
          undefined
        ) {

          player.defense =
            Math.max(
              0,
              Number(
                body.defense
              )
            );
        }

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
          wars:
            db.wars
        });
      }

      if (
        req.method === "POST" &&
        (
          path === "/api/wars" ||
          path === "/api/wars/attack"
        )
      ) {

        const attacker =
          requirePlayer(req, res);

        if (!attacker) return;

        const targetId =
          body.targetPlayerId ||
          body.targetId;

        const target =
          db.players.find(
            p =>
              String(p.id) ===
              String(targetId)
          );

        if (!target) {

          return send(res, 404, {
            error:
              "target not found"
          });
        }

        if (
          target.id ===
          attacker.id
        ) {

          return send(res, 400, {
            error:
              "cannot attack yourself"
          });
        }

        const attackerPower =
          militaryPower(
            attacker
          ).total +
          attacker.offensiveLevel *
            100;

        const defenderPower =
          militaryPower(
            target
          ).total +
          target.defense *
            100;

        const attackerWon =
          attackerPower +
            Math.random() *
              Math.max(
                100,
                attackerPower * 0.25
              ) >=
          defenderPower;

        const war = {
          id:
            db.nextWarId++,

          attackerId:
            attacker.id,

          defenderId:
            target.id,

          attackerWon,

          attackerPower,

          defenderPower,

          createdAt:
            new Date().toISOString()
        };

        db.wars.push(war);

        return send(res, 200, {
          ok: true,
          result:
            war
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
          contracts:
            db.contracts
        });
      }

      if (
        req.method === "GET" &&
        (
          path === "/api/contracts/bids/ranking" ||
          path === "/api/contracts/bid-ranking"
        )
      ) {

        const rankings =
          db.contractBids
            .map(
              bid => ({
                ...bid
              })
            )
            .sort(
              (a, b) =>
                a.amount -
                b.amount
            );

        return send(res, 200, {
          bids:
            rankings,
          rankings
        });
      }

      if (
        req.method === "GET" &&
        path === "/api/contracts/running"
      ) {

        const running =
          db.contracts.filter(
            c =>
              c.status ===
              "RUNNING"
          );

        return send(res, 200, {
          contracts:
            running,

          running
        });
      }

      if (
        req.method === "POST" &&
        (
          path === "/api/contracts/bid" ||
          path === "/api/contracts/bids"
        )
      ) {

        const player =
          requirePlayer(req, res);

        if (!player) return;

        const contractId =
          Number(
            body.contractId
          );

        const amount =
          Number(
            body.amount ||
            body.bid ||
            0
          );

        const contract =
          db.contracts.find(
            c =>
              c.id ===
              contractId
          );

        if (!contract) {

          return send(res, 404, {
            error:
              "contract not found"
          });
        }

        if (
          contract.status !==
          "OPEN"
        ) {

          return send(res, 400, {
            error:
              "contract is not open"
          });
        }

        if (
          !Number.isFinite(amount) ||
          amount <= 0
        ) {

          return send(res, 400, {
            error:
              "invalid bid amount"
          });
        }

        const existing =
          db.contractBids.find(
            b =>
              b.contractId ===
                contractId &&
              b.playerId ===
                player.id
          );

        if (existing) {

          existing.amount =
            amount;

          existing.updatedAt =
            new Date().toISOString();

          return send(res, 200, {
            ok: true,
            bid:
              existing
          });
        }

        const bid = {
          id:
            db.nextBidId++,

          contractId,

          playerId:
            player.id,

          username:
            player.username,

          companyName:
            player.companyName,

          amount,

          createdAt:
            new Date().toISOString()
        };

        db.contractBids.push(
          bid
        );

        return send(res, 201, {
          ok: true,
          bid
        });
      }

      /* =====================================================
         ALLIANCES
         ===================================================== */

      if (
        req.method === "GET" &&
        path === "/api/alliances"
      ) {

        const alliances =
          db.alliances.map(
            alliance => ({
              ...alliance,

              members:
                alliance.members.length,

              power:
                alliance.memberPower || 0,

              rank:
                0
            })
          );

        return send(res, 200, {
          alliances
        });
      }

      if (
        req.method === "POST" &&
        (
          path === "/api/alliances" ||
          path === "/api/alliances/create"
        )
      ) {

        const player =
          requirePlayer(req, res);

        if (!player) return;

        const name =
          String(
            body.name ||
            "New Alliance"
          ).trim();

        if (!name) {

          return send(res, 400, {
            error:
              "alliance name required"
          });
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

          memberPower:
            militaryPower(player)
              .total,

          createdAt:
            new Date().toISOString()
        };

        db.alliances.push(
          alliance
        );

        player.allies++;

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
              String(a.id) ===
              String(
                body.allianceId
              )
          );

        if (!alliance) {

          return send(res, 404, {
            error:
              "alliance not found"
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

          player.allies++;
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
          messages:
            db.chat.slice(-100)
        });
      }

      if (
        req.method === "POST" &&
        path === "/api/chat"
      ) {

        const player =
          requirePlayer(req, res);

        if (!player) return;

        const message =
          String(
            body.message || ""
          )
            .trim()
            .slice(0, 1000);

        if (!message) {

          return send(res, 400, {
            error:
              "message required"
          });
        }

        const entry = {
          id:
            db.nextMessageId++,

          playerId:
            player.id,

          username:
            player.username,

          companyName:
            player.companyName,

          message,

          createdAt:
            new Date().toISOString()
        };

        db.chat.push(entry);

        return send(res, 201, {
          ok: true,
          message:
            entry
        });
      }

      /* =====================================================
         404
         ===================================================== */

      return send(res, 404, {
        error:
          "endpoint not found",

        path,

        method:
          req.method,

        version:
          VERSION
      });
    }
  );

/* =========================================================
   SERVER ERROR HANDLING
   ========================================================= */

server.on(
  "error",
  error => {
    console.error(
      "SERVER ERROR:",
      error
    );
  }
);

/* =========================================================
   START
   ========================================================= */

server.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log(
      "Tycoon Empire server started"
    );

    console.log(
      "Version:",
      VERSION
    );

    console.log(
      "Listening on:",
      `http://0.0.0.0:${PORT}`
    );

    console.log(
      "Players:",
      db.players.length
    );

    console.log(
      "Assets:",
      db.assets.length
    );

    console.log(
      "Contracts:",
      db.contracts.length
    );
  }
);
