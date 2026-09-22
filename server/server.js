/*
 * ============================================================
 * TYCOON EMPIRE - REFERENCE CATALOG
 * ============================================================
 *
 * Source:
 * Document 7.pdf supplied by the user.
 *
 * IMPORTANT:
 * Only values visibly confirmed in the reference material are
 * included as exact values.
 *
 * A missing value is represented by null rather than inventing
 * an original-game value.
 * ============================================================
 */

const CATALOG_VERSION = "REFERENCE-PDF-1.0";

/* ============================================================
   HELPERS
   ============================================================ */

function item(
  id,
  name,
  price = null,
  options = {}
) {
  return {
    id,
    name,
    price,
    image: options.image || `reference/${id}.jpg`,
    category: options.category || null,
    unlockLevel: options.unlockLevel ?? 1,
    concession: options.concession ?? null,
    research: options.research ?? null,
    productionTech: options.productionTech ?? null,
    requirement: options.requirement ?? null,
    income: options.income ?? null,
    cycle: options.cycle ?? null,
    sourcePage: options.sourcePage ?? null
  };
}

/* ============================================================
   BUSINESSES
   ============================================================
 *
 * Visible on pages 1-4.
 */

const BUSINESSES = [

  item(
    "pub",
    "Pub",
    200,
    {
      category: "business",
      sourcePage: 1
    }
  ),

  item(
    "dance_club",
    "Dance club",
    220,
    {
      category: "business",
      sourcePage: 1
    }
  ),

  item(
    "coffee_shop",
    "Coffee shop",
    150,
    {
      category: "business",
      sourcePage: 1
    }
  ),

  item(
    "restaurant",
    "Restaurant",
    220,
    {
      category: "business",
      sourcePage: 1
    }
  ),

  item(
    "movie_theater",
    "Movie theater",
    350,
    {
      category: "business",
      sourcePage: 1
    }
  ),

  item(
    "clothes_shop",
    "Clothes shop",
    150,
    {
      category: "business",
      sourcePage: 2
    }
  ),

  item(
    "supermarket",
    "Supermarket",
    250,
    {
      category: "business",
      sourcePage: 2
    }
  ),

  item(
    "fast_food",
    "Fast food",
    150,
    {
      category: "business",
      sourcePage: 2
    }
  ),

  item(
    "living_building",
    "Living building",
    null,
    {
      category: "business",
      concession: "Real Estate",
      sourcePage: 2
    }
  ),

  item(
    "office_building",
    "Office building",
    null,
    {
      category: "business",
      concession: "Real Estate",
      sourcePage: 2
    }
  ),

  /*
   * Advanced items visible in pages 3-4.
   * Their screenshot establishes the required concession,
   * but does not visibly establish a purchase price.
   */

  item(
    "fighter_plane",
    "Fighter plane",
    null,
    {
      category: "business",
      concession: "War Industry",
      sourcePage: 3
    }
  ),

  item(
    "espionage_satellite",
    "Espionage Satellite",
    null,
    {
      category: "business",
      concession: "Space",
      sourcePage: 3
    }
  ),

  item(
    "communication_satellite",
    "Communication Satellite",
    null,
    {
      category: "business",
      concession: "Space",
      sourcePage: 3
    }
  ),

  item(
    "defence_robot",
    "Defence Robot",
    null,
    {
      category: "business",
      concession: "Robotics",
      sourcePage: 3
    }
  ),

  item(
    "industrial_bots",
    "Industrial Bots",
    null,
    {
      category: "business",
      concession: "Robotics",
      sourcePage: 3
    }
  ),

  item(
    "ballistic_missiles",
    "Ballistic missiles",
    null,
    {
      category: "business",
      concession: "Nuclear",
      sourcePage: 4
    }
  ),

  item(
    "smart_bombs",
    "Smart bombs",
    null,
    {
      category: "business",
      concession: "Nuclear",
      sourcePage: 4
    }
  ),

  item(
    "ktz29000",
    "KTZ29000",
    null,
    {
      category: "business",
      concession: "Advanced War",
      sourcePage: 4
    }
  ),

  item(
    "ztz9600",
    "ZTZ9600",
    null,
    {
      category: "business",
      concession: "Advanced War",
      sourcePage: 4
    }
  )
];

/* ============================================================
   TRANSPORTATION
   ============================================================
 *
 * Pages 5-6.
 */

const TRANSPORTATION = [

  item(
    "taxi",
    "Taxi",
    100,
    {
      category: "transportation",
      sourcePage: 5
    }
  ),

  item(
    "bus",
    "Bus",
    150,
    {
      category: "transportation",
      sourcePage: 5
    }
  ),

  item(
    "train",
    "Train",
    250,
    {
      category: "transportation",
      sourcePage: 5
    }
  ),

  item(
    "vip_limousines",
    "VIP Limousines",
    500,
    {
      category: "transportation",
      sourcePage: 5
    }
  ),

  item(
    "passenger_plane",
    "Passengers plane",
    800,
    {
      category: "transportation",
      sourcePage: 5
    }
  ),

  item(
    "cargo_plane",
    "Cargo plane",
    850,
    {
      category: "transportation",
      sourcePage: 6
    }
  ),

  item(
    "passenger_ship",
    "Passengers ship",
    null,
    {
      category: "transportation",
      concession: "Sea Lines",
      sourcePage: 6
    }
  ),

  item(
    "cargo_ship",
    "Cargo ship",
    null,
    {
      category: "transportation",
      concession: "Sea Lines",
      sourcePage: 6
    }
  )
];

/* ============================================================
   CONCESSIONS
   ============================================================
 *
 * Pages 7-8.
 */

const CONCESSIONS = [

  item(
    "ground_transport",
    "Ground Transport",
    25000,
    {
      category: "concession",
      sourcePage: 7
    }
  ),

  item(
    "commerce",
    "Commerce",
    30000,
    {
      category: "concession",
      sourcePage: 7
    }
  ),

  item(
    "leisure",
    "Leisure",
    75000,
    {
      category: "concession",
      sourcePage: 7
    }
  ),

  item(
    "air_lines",
    "Air Lines",
    150000,
    {
      category: "concession",
      sourcePage: 7
    }
  ),

  item(
    "sea_lines",
    "Sea Lines",
    400000,
    {
      category: "concession",
      sourcePage: 7
    }
  ),

  item(
    "real_estate",
    "Real Estate",
    800000,
    {
      category: "concession",
      sourcePage: 7
    }
  ),

  item(
    "war_industry",
    "War Industry",
    1000000,
    {
      category: "concession",
      sourcePage: 8
    }
  ),

  item(
    "space",
    "Space",
    2000000,
    {
      category: "concession",
      sourcePage: 8
    }
  ),

  item(
    "robotics",
    "Robotics",
    5000000,
    {
      category: "concession",
      sourcePage: 8
    }
  ),

  item(
    "nuclear",
    "Nuclear",
    10000000,
    {
      category: "concession",
      sourcePage: 8
    }
  ),

  item(
    "advanced_war",
    "Advanced war",
    50000000,
    {
      category: "concession",
      sourcePage: 8
    }
  )
];

/* ============================================================
   RESOURCES
   ============================================================
 *
 * Pages 9-10.
 */

const RESOURCES = [

  item(
    "salt",
    "Salt",
    93,
    {
      category: "resource",
      sourcePage: 9
    }
  ),

  item(
    "iron",
    "Iron",
    157,
    {
      category: "resource",
      sourcePage: 9
    }
  ),

  item(
    "aluminum",
    "Aluminum",
    30,
    {
      category: "resource",
      sourcePage: 9
    }
  ),

  item(
    "copper",
    "Copper",
    202,
    {
      category: "resource",
      sourcePage: 9
    }
  ),

  item(
    "silver",
    "Silver",
    242,
    {
      category: "resource",
      sourcePage: 9
    }
  ),

  item(
    "oil",
    "Oil",
    588,
    {
      category: "resource",
      sourcePage: 9
    }
  ),

  item(
    "gold",
    "Gold",
    201,
    {
      category: "resource",
      sourcePage: 10
    }
  ),

  item(
    "diamonds",
    "Diamonds",
    286,
    {
      category: "resource",
      sourcePage: 10
    }
  ),

  item(
    "gems",
    "Gems",
    880,
    {
      category: "resource",
      sourcePage: 10
    }
  )
];

/* ============================================================
   SUBSIDIARIES
   ============================================================
 *
 * Pages 11-12.
 */

const SUBSIDIARIES = [

  item(
    "mining_company",
    "Mining company",
    15000,
    {
      category: "subsidiary",
      requirement: "Level 1",
      sourcePage: 11
    }
  ),

  item(
    "traveling_company",
    "Traveling company",
    45000,
    {
      category: "subsidiary",
      requirement: "Level 2",
      sourcePage: 11
    }
  ),

  item(
    "soccer_team",
    "Soccer team",
    30000,
    {
      category: "subsidiary",
      requirement: "Level 1",
      sourcePage: 11
    }
  ),

  item(
    "brokerage_company",
    "Brokerage company",
    300000,
    {
      category: "subsidiary",
      requirement: "Level 1",
      sourcePage: 11
    }
  ),

  item(
    "army_experiments",
    "Army experiments",
    150000,
    {
      category: "subsidiary",
      sourcePage: 11
    }
  ),

  item(
    "robotics_program",
    "Robotics program",
    350000,
    {
      category: "subsidiary",
      sourcePage: 12
    }
  ),

  item(
    "nuclear_program",
    "Nuclear program",
    500000,
    {
      category: "subsidiary",
      sourcePage: 12
    }
  ),

  item(
    "advanced_medical",
    "Advanced medical",
    null,
    {
      category: "subsidiary",
      requirement: "35 gold coins",
      sourcePage: 12
    }
  ),

  item(
    "space_center",
    "Space center",
    null,
    {
      category: "subsidiary",
      requirement: "35 gold coins",
      sourcePage: 12
    }
  )
];

/* ============================================================
   RESEARCH
   ============================================================
 *
 * Page 13.
 */

const RESEARCH = [

  item(
    "expert_accountants",
    "Expert Accountants",
    null,
    {
      category: "research",
      requirement: "10 coins; level 6",
      sourcePage: 13
    }
  ),

  item(
    "business_executives",
    "Business Executives",
    null,
    {
      category: "research",
      requirement: "10 coins; level 1",
      sourcePage: 13
    }
  ),

  item(
    "co_ceo",
    "Co CEO",
    null,
    {
      category: "research",
      requirement: "15 coins; level 1",
      sourcePage: 13
    }
  ),

  item(
    "executives_airplane",
    "Executives airplane",
    null,
    {
      category: "research",
      requirement: "35 coins",
      sourcePage: 13
    }
  ),

  item(
    "leisure_ferries",
    "Leisure ferries",
    null,
    {
      category: "research",
      requirement: "40 coins",
      sourcePage: 13
    }
  ),

  item(
    "space_traveling_shuttle",
    "Space traveling shuttle",
    null,
    {
      category: "research",
      requirement: "40 coins",
      sourcePage: 13
    }
  )
];

/* ============================================================
   PRODUCTION TECHNOLOGY
   ============================================================
 *
 * Pages 26-33.
 *
 * The PDF visibly gives the technology level.
 */

const PRODUCTION_TECH = [

  item(
    "spa_products",
    "Spa Products",
    3025,
    {
      category: "product",
      productionTech: 1,
      sourcePage: 26
    }
  ),

  item(
    "silverware",
    "Silverware",
    6490,
    {
      category: "product",
      productionTech: 3,
      sourcePage: 27
    }
  ),

  item(
    "remote_control_cars",
    "Remote Control Cars",
    7150,
    {
      category: "product",
      productionTech: 5,
      sourcePage: 27
    }
  ),

  item(
    "gold_plated_watch",
    "Gold Plated Watch",
    9185,
    {
      category: "product",
      productionTech: 7,
      sourcePage: 27
    }
  ),

  item(
    "iron_furnitures",
    "Iron Furniture's",
    8992,
    {
      category: "product",
      productionTech: 9,
      sourcePage: 28
    }
  ),

  item(
    "cameras",
    "Cameras",
    10835,
    {
      category: "product",
      productionTech: 11,
      sourcePage: 28
    }
  ),

  item(
    "diamonds_jewellery",
    "Diamonds Jewellery",
    44000,
    {
      category: "product",
      productionTech: 13,
      sourcePage: 29
    }
  ),

  item(
    "gemstones",
    "Gemstones",
    29150,
    {
      category: "product",
      productionTech: 15,
      sourcePage: 29
    }
  ),

  item(
    "luxury_jewelry",
    "Luxury-Jewelry",
    44000,
    {
      category: "product",
      productionTech: 16,
      sourcePage: 30
    }
  ),

  item(
    "computers",
    "Computers",
    28875,
    {
      category: "product",
      productionTech: 17,
      sourcePage: 30
    }
  ),

  item(
    "smartphones",
    "Smart-phones",
    24420,
    {
      category: "product",
      productionTech: 19,
      sourcePage: 31
    }
  ),

  item(
    "gaming_consoles",
    "Gaming Consoles",
    25575,
    {
      category: "product",
      productionTech: 21,
      sourcePage: 31
    }
  ),

  item(
    "family_cars",
    "Family Cars",
    40425,
    {
      category: "product",
      productionTech: 23,
      sourcePage: 32
    }
  ),

  item(
    "sports_cars",
    "Sports Cars",
    49280,
    {
      category: "product",
      productionTech: 25,
      sourcePage: 32
    }
  ),

  item(
    "advanced_tactical_weapons",
    "Advanced Tactical Weapons",
    67100,
    {
      category: "product",
      productionTech: 27,
      sourcePage: 33
    }
  ),

  item(
    "armored_vehicles",
    "Armored Vehicles",
    66550,
    {
      category: "product",
      productionTech: 29,
      sourcePage: 33
    }
  )
];

/* ============================================================
   PRODUCT MARKET
   ============================================================
 *
 * Pages 39-41.
 *
 * These are the visible market prices.
 */

const PRODUCTS = [

  item(
    "spa_products_market",
    "Spa Products",
    3025,
    {
      category: "product_market",
      productionTech: 1,
      sourcePage: 39
    }
  ),

  item(
    "silverware_market",
    "Silverware",
    6490,
    {
      category: "product_market",
      productionTech: 3,
      sourcePage: 39
    }
  ),

  item(
    "remote_control_cars_market",
    "Remote Control Cars",
    7150,
    {
      category: "product_market",
      productionTech: 5,
      sourcePage: 39
    }
  ),

  item(
    "gold_plated_watch_market",
    "Gold Plated Watch",
    9185,
    {
      category: "product_market",
      productionTech: 7,
      sourcePage: 39
    }
  ),

  item(
    "iron_furniture_market",
    "Iron Furniture's",
    8992,
    {
      category: "product_market",
      productionTech: 9,
      sourcePage: 39
    }
  ),

  item(
    "cameras_market",
    "Cameras",
    10835,
    {
      category: "product_market",
      productionTech: 11,
      sourcePage: 39
    }
  ),

  item(
    "diamonds_jewellery_market",
    "Diamonds Jewellery",
    44000,
    {
      category: "product_market",
      productionTech: 13,
      sourcePage: 39
    }
  ),

  item(
    "gemstones_market",
    "Gemstones",
    29150,
    {
      category: "product_market",
      productionTech: 15,
      sourcePage: 40
    }
  ),

  item(
    "luxury_jewelry_market",
    "luxury-jewelry",
    44000,
    {
      category: "product_market",
      productionTech: 16,
      sourcePage: 40
    }
  ),

  item(
    "computers_market",
    "Computers",
    28875,
    {
      category: "product_market",
      productionTech: 17,
      sourcePage: 40
    }
  ),

  item(
    "smartphones_market",
    "Smart-phones",
    24420,
    {
      category: "product_market",
      productionTech: 19,
      sourcePage: 40
    }
  ),

  item(
    "gaming_consoles_market",
    "Gaming Consoles",
    25575,
    {
      category: "product_market",
      productionTech: 21,
      sourcePage: 40
    }
  ),

  item(
    "family_cars_market",
    "Family Cars",
    40425,
    {
      category: "product_market",
      productionTech: 23,
      sourcePage: 40
    }
  ),

  item(
    "sports_cars_market",
    "Sports Cars",
    49280,
    {
      category: "product_market",
      productionTech: 25,
      sourcePage: 41
    }
  ),

  item(
    "advanced_tactical_weapons_market",
    "Advanced Tactical Weapons",
    67100,
    {
      category: "product_market",
      productionTech: 27,
      sourcePage: 41
    }
  ),

  item(
    "armored_vehicles_market",
    "Armored Vehicles",
    66550,
    {
      category: "product_market",
      productionTech: 29,
      sourcePage: 41
    }
  )
];

/* ============================================================
   PROPERTIES
   ============================================================
 *
 * Pages 42-55.
 *
 * Exact visible values are retained.
 */

const PROPERTIES = [

  item(
    "new_century_global_center",
    "New Century Global Center",
    300000,
    {
      category: "property",
      requirement: "Visible in reference",
      sourcePage: 42
    }
  ),

  item(
    "mid_valley_megall",
    "Mid Valley Megamall",
    null,
    {
      category: "property",
      sourcePage: 42
    }
  ),

  item(
    "neva_towers_2",
    "Neva Towers 2",
    500000,
    {
      category: "property",
      sourcePage: 43
    }
  ),

  item(
    "q1",
    "Q1",
    500000,
    {
      category: "property",
      sourcePage: 44
    }
  ),

  item(
    "rotterdam_harbour",
    "Rotterdam Harbour",
    350000,
    {
      category: "property",
      sourcePage: 45
    }
  ),

  item(
    "cedar_crossing_industrial_park",
    "Cedar Crossing Industrial Park",
    500000,
    {
      category: "property",
      sourcePage: 46
    }
  ),

  item(
    "autonomous_taxi_factory",
    "Autonomous Taxi Factory",
    null,
    {
      category: "property",
      requirement: "Premium property unlocks Driver-Less transport unit",
      sourcePage: 47
    }
  ),

  item(
    "princess_tower",
    "Princess Tower",
    15000000,
    {
      category: "property",
      unlockLevel: 8,
      sourcePage: 47
    }
  ),

  item(
    "abraj_al_bait",
    "Abraj Al-Bait",
    10000000,
    {
      category: "property",
      unlockLevel: 8,
      sourcePage: 48
    }
  ),

  item(
    "boeing_everett",
    "Boeing Everett Factory",
    25000000,
    {
      category: "property",
      unlockLevel: 8,
      sourcePage: 49
    }
  ),

  item(
    "unmanned_aerial_vehicle_factory",
    "Unmanned Aerial Vehicle Factory",
    null,
    {
      category: "property",
      unlockLevel: 8,
      requirement: "Premium property unlocks UAV Army Unit",
      sourcePage: 49
    }
  ),

  item(
    "aura",
    "Aura",
    125000000,
    {
      category: "property",
      unlockLevel: 9,
      sourcePage: 50
    }
  ),

  item(
    "scotia_plaza",
    "Scotia Plaza",
    700000000,
    {
      category: "property",
      unlockLevel: 9,
      sourcePage: 50
    }
  ),

  item(
    "roppongi_hills_mori_tower",
    "Roppongi Hills Mori Tower",
    1200000000,
    {
      category: "property",
      unlockLevel: 9,
      sourcePage: 51
    }
  ),

  item(
    "the_palazzo",
    "The Palazzo",
    15000000,
    {
      category: "property",
      unlockLevel: 10,
      sourcePage: 52
    }
  ),

  item(
    "albertas_industrial_heartland",
    "Alberta's Industrial Heartland",
    25000000,
    {
      category: "property",
      unlockLevel: 10,
      sourcePage: 52
    }
  ),

  item(
    "marina_101",
    "Marina 101",
    50000000,
    {
      category: "property",
      unlockLevel: 11,
      sourcePage: 53
    }
  ),

  item(
    "burj_khalifa",
    "Burj Khalifa",
    2000000000,
    {
      category: "property",
      unlockLevel: 11,
      sourcePage: 53
    }
  ),

  item(
    "dubai_industrial_city",
    "Dubai Industrial City",
    900000000000,
    {
      category: "property",
      unlockLevel: 13,
      sourcePage: 54
    }
  ),

  item(
    "bataan_nuclear_power_plant",
    "Bataan Nuclear Power Plant",
    5000000000000,
    {
      category: "property",
      unlockLevel: 13,
      sourcePage: 54
    }
  ),

  item(
    "industrial_level_14",
    "Industrial Property",
    5000000000000,
    {
      category: "property",
      unlockLevel: 14,
      sourcePage: 55
    }
  ),

  item(
    "dubailand",
    "Dubailand",
    10000000000000,
    {
      category: "property",
      unlockLevel: 15,
      sourcePage: 55
    }
  )
];

/* ============================================================
   STOCK MARKET
   ============================================================ */

const STOCK_MARKET = [

  item(
    "wheat",
    "Wheat",
    55000,
    {
      category: "stock",
      requirement: "MAX TRADE: $55,000; LOW RISK",
      sourcePage: 23
    }
  ),

  item(
    "corn",
    "Corn",
    null,
    {
      category: "stock",
      requirement: "Require Brokerage Level 2; MEDIUM RISK",
      sourcePage: 23
    }
  ),

  item(
    "cotton",
    "Cotton",
    null,
    {
      category: "stock",
      requirement: "Require Brokerage Level 3; HIGH RISK",
      sourcePage: 23
    }
  ),

  item(
    "natural_gas",
    "Natural Gas",
    null,
    {
      category: "stock",
      requirement: "Require Brokerage Level 4; VERY HIGH RISK",
      sourcePage: 23
    }
  ),

  item(
    "brent_crude_oil",
    "Brent Crude Oil",
    null,
    {
      category: "stock",
      requirement: "Require Brokerage Company Level 6; CRAZY RISK",
      sourcePage: 23
    }
  )
];

/* ============================================================
   MEGA PROJECTS
   ============================================================ */

const MEGA_PROJECTS = [

  item(
    "geothermal_power_plant",
    "Geothermal Power Plant",
    null,
    {
      category: "mega_project",
      requirement: "Require production tech level 30",
      sourcePage: 35
    }
  ),

  item(
    "satellite_spaceship",
    "Satellite Spaceship",
    null,
    {
      category: "mega_project",
      requirement: "Require production tech level 32",
      sourcePage: 35
    }
  ),

  item(
    "nuclear_submarine",
    "Nuclear Submarine",
    null,
    {
      category: "mega_project",
      requirement: "Require company level 8",
      sourcePage: 36
    }
  ),

  item(
    "nuclear_power_plant",
    "Nuclear power plant",
    null,
    {
      category: "mega_project",
      requirement: "Require production tech level 32",
      sourcePage: 37
    }
  ),

  item(
    "space_travelling_shuttle",
    "Space Travelling Shuttle",
    null,
    {
      category: "mega_project",
      requirement: "Require company level 9",
      sourcePage: 37
    }
  ),

  item(
    "space_elevator",
    "Space Elevator",
    null,
    {
      category: "mega_project",
      requirement: "Require company level 10",
      sourcePage: 38
    }
  )
];

/* ============================================================
   GENERAL SYSTEM REQUIREMENTS CONFIRMED BY APK ANALYSIS
   ============================================================ */

const SYSTEM_REQUIREMENTS = {
  businessCenter: 4,
  ceo: 8,
  nationalCongress: 10,

  /*
   * These systems are confirmed in the APK analysis but the
   * complete numerical progression is not visible in the PDF.
   */
  media: null,
  brand: null,

  ceoPrestige: {
    level9: null,
    level10: null,
    level11: null,
    level12: null,
    level13: null
  }
};

/* ============================================================
   LOOKUP
   ============================================================ */

const ALL = [
  ...BUSINESSES,
  ...TRANSPORTATION,
  ...CONCESSIONS,
  ...RESOURCES,
  ...SUBSIDIARIES,
  ...RESEARCH,
  ...PRODUCTION_TECH,
  ...PRODUCTS,
  ...PROPERTIES,
  ...STOCK_MARKET,
  ...MEGA_PROJECTS
];

function normalize(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function getAll() {
  return ALL.map(x => ({ ...x }));
}

function getById(id) {
  return ALL.find(x => x.id === String(id)) || null;
}

function getByCategory(category) {
  const c = normalize(category);

  return ALL
    .filter(x => normalize(x.category) === c)
    .map(x => ({ ...x }));
}

function search(name) {
  const n = normalize(name);

  return ALL.filter(x =>
    normalize(x.name).includes(n)
  ).map(x => ({ ...x }));
}

/* ============================================================
   UNLOCK CHECK
   ============================================================ */

function checkUnlock(itemData, player) {

  if (!itemData) {
    return {
      unlocked: false,
      reason: "Item not found"
    };
  }

  const level =
    Number(player?.level || 1);

  const gold =
    Number(player?.gold || 0);

  if (
    itemData.unlockLevel &&
    level < Number(itemData.unlockLevel)
  ) {
    return {
      unlocked: false,
      reason:
        `Require level ${itemData.unlockLevel}`
    };
  }

  if (
    itemData.productionTech &&
    Number(player?.productionTech || 0) <
      Number(itemData.productionTech)
  ) {
    return {
      unlocked: false,
      reason:
        `Require production tech level ${itemData.productionTech}`
    };
  }

  /*
   * Concession ownership can be supplied by the server
   * as an array of concession IDs/names.
   */

  if (itemData.concession) {

    const owned =
      Array.isArray(player?.concessions)
        ? player.concessions
        : [];

    const wanted =
      normalize(itemData.concession);

    const hasConcession =
      owned.some(x =>
        normalize(
          typeof x === "string"
            ? x
            : x.name || x.id
        ) === wanted
      );

    if (!hasConcession) {
      return {
        unlocked: false,
        reason:
          `Require ${itemData.concession} concession`
      };
    }
  }

  if (
    itemData.requirement &&
    /gold coins?/i.test(itemData.requirement)
  ) {

    const match =
      itemData.requirement.match(
        /(\d+)\s*gold coins?/i
      );

    if (match) {

      const required =
        Number(match[1]);

      if (gold < required) {
        return {
          unlocked: false,
          reason:
            `Require ${required} gold coins`
        };
      }
    }
  }

  return {
    unlocked: true,
    reason: null
  };
}

/* ============================================================
   PLAYER-FACING CATALOG
   ============================================================ */

function forPlayer(player) {

  return ALL.map(x => {

    const unlock =
      checkUnlock(x, player);

    return {
      ...x,
      unlocked: unlock.unlocked,
      lockedReason: unlock.reason
    };
  });
}

/* ============================================================
   EXPORT
   ============================================================ */

module.exports = {
  CATALOG_VERSION,

  BUSINESSES,
  TRANSPORTATION,
  CONCESSIONS,
  RESOURCES,
  SUBSIDIARIES,
  RESEARCH,
  PRODUCTION_TECH,
  PRODUCTS,
  PROPERTIES,
  STOCK_MARKET,
  MEGA_PROJECTS,

  SYSTEM_REQUIREMENTS,

  ALL,

  getAll,
  getById,
  getByCategory,
  search,
  checkUnlock,
  forPlayer
};
