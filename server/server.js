/*
============================================================
 TYCOON EMPIRE - PRIVATE MULTIPLAYER SERVER
============================================================

 Node.js + Express-style HTTP server + PostgreSQL

 Existing Android client:
     https://tycoon-empire-i40v.onrender.com

 Main systems:
 - Authentication
 - Persistent PostgreSQL accounts
 - Businesses
 - Transportation
 - Concessions
 - Resources
 - Subsidiaries
 - Research
 - Production technology
 - Products market
 - Properties
 - Stock market
 - World sites
 - Contracts
 - Contract bidding
 - Alliances
 - Chat
 - Rankings
 - Loans
 - Army
 - Wars
 - Country relations
 - Marketing
 - Business Center
 - Challenges
 - CEO upgrades
 - Collections
 - Special items
 - Space program
 - Congress
 - Missions
 - Offline income
 - Level progression

 Reference catalog:
 Document 7.pdf supplied by the user.
============================================================
*/

"use strict";

const http = require("http");
const crypto = require("crypto");
const { Pool } = require("pg");
const { URL } = require("url");

/* =========================================================
   CONFIG
========================================================= */

const PORT = Number(process.env.PORT || 8080);

const VERSION = "2.2.0";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
    console.error("DATABASE_URL is missing.");
    process.exit(1);
}

const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
});

/* =========================================================
   BASIC HELPERS
========================================================= */

function json(res, status, data) {
    const body = JSON.stringify(data);

    res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers":
            "Content-Type, Authorization",
        "Access-Control-Allow-Methods":
            "GET, POST, PUT, DELETE, OPTIONS"
    });

    res.end(body);
}

function error(res, status, message, extra = {}) {
    return json(res, status, {
        ok: false,
        error: message,
        ...extra
    });
}

function send(res, status, data) {
    return json(res, status, data);
}

function now() {
    return new Date();
}

function money(value) {
    return Math.max(0, Math.round(Number(value || 0)));
}

function normalize(value) {
    return String(value || "")
        .trim()
        .toLowerCase()
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ");
}

function randomId(bytes = 16) {
    return crypto.randomBytes(bytes).toString("hex");
}

function sha256(value) {
    return crypto
        .createHash("sha256")
        .update(String(value))
        .digest("hex");
}

function hashPassword(password) {
    return new Promise((resolve, reject) => {
        const salt = crypto.randomBytes(16).toString("hex");

        crypto.scrypt(
            String(password),
            salt,
            64,
            (err, derivedKey) => {
                if (err) {
                    reject(err);
                    return;
                }

                resolve(
                    `${salt}:${derivedKey.toString("hex")}`
                );
            }
        );
    });
}

function verifyPassword(password, stored) {
    return new Promise((resolve, reject) => {
        if (!stored || !stored.includes(":")) {
            resolve(false);
            return;
        }

        const [salt, hash] = stored.split(":");

        crypto.scrypt(
            String(password),
            salt,
            64,
            (err, derivedKey) => {
                if (err) {
                    reject(err);
                    return;
                }

                const a = Buffer.from(hash, "hex");
                const b = derivedKey;

                if (a.length !== b.length) {
                    resolve(false);
                    return;
                }

                resolve(
                    crypto.timingSafeEqual(a, b)
                );
            }
        );
    });
}

function bearerToken(req) {
    const header =
        req.headers.authorization || "";

    if (!header.startsWith("Bearer ")) {
        return "";
    }

    return header.substring(7).trim();
}

function readBody(req) {
    return new Promise((resolve, reject) => {
        let data = "";

        req.on("data", chunk => {
            data += chunk;

            if (data.length > 2 * 1024 * 1024) {
                reject(
                    new Error("Request body too large")
                );

                req.destroy();
            }
        });

        req.on("end", () => {
            if (!data.trim()) {
                resolve({});
                return;
            }

            try {
                resolve(JSON.parse(data));
            } catch (e) {
                reject(
                    new Error("Invalid JSON")
                );
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

        const result =
            await callback(client);

        await client.query("COMMIT");

        return result;
    } catch (err) {
        await client.query("ROLLBACK");
        throw err;
    } finally {
        client.release();
    }
}

/* =========================================================
   REFERENCE CATALOG
========================================================= */

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
        image:
            options.image ||
            `reference/${id}.jpg`,
        category:
            options.category || null,
        unlockLevel:
            options.unlockLevel ?? 1,
        concession:
            options.concession ?? null,
        research:
            options.research ?? null,
        productionTech:
            options.productionTech ?? null,
        requirement:
            options.requirement ?? null,
        sourcePage:
            options.sourcePage ?? null
    };
}

/* =========================================================
   BUSINESSES
========================================================= */

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

/* =========================================================
   TRANSPORTATION
========================================================= */

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

/* =========================================================
   CONCESSIONS
========================================================= */

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

/* =========================================================
   RESOURCES
========================================================= */

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

/* =========================================================
   SUBSIDIARIES
========================================================= */

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

/* =========================================================
   RESEARCH
========================================================= */

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

/* =========================================================
   PRODUCTION TECHNOLOGY
========================================================= */

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

/* =========================================================
   PRODUCT MARKET
========================================================= */

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

/* =========================================================
   PROPERTIES
========================================================= */

const PROPERTIES = [
    item(
        "new_century_global_center",
        "New Century Global Center",
        300000,
        {
            category: "property",
            sourcePage: 42
        }
    ),

    item(
        "mid_valley_megamall",
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
            requirement:
                "Premium property unlocks Driver-Less transport unit",
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
            requirement:
                "Premium property unlocks UAV Army Unit",
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

/* =========================================================
   STOCK MARKET
========================================================= */

const STOCK_MARKET = [
    item(
        "wheat",
        "Wheat",
        55000,
        {
            category: "stock",
            requirement:
                "MAX TRADE: $55,000; LOW RISK",
            sourcePage: 23
        }
    ),

    item(
        "corn",
        "Corn",
        null,
        {
            category: "stock",
            requirement:
                "REQUIRE BROKERAGE LEVEL 2; MEDIUM RISK",
            sourcePage: 23
        }
    ),

    item(
        "cotton",
        "Cotton",
        null,
        {
            category: "stock",
            requirement:
                "REQUIRE BROKERAGE LEVEL 3; HIGH RISK",
            sourcePage: 23
        }
    ),

    item(
        "natural_gas",
        "Natural Gas",
        null,
        {
            category: "stock",
            requirement:
                "REQUIRE BROKERAGE LEVEL 4; VERY HIGH RISK",
            sourcePage: 23
        }
    ),

    item(
        "brent_crude_oil",
        "Brent Crude Oil",
        null,
        {
            category: "stock",
            requirement:
                "REQUIRE BROKERAGE COMPANY LEVEL 6; CRAZY RISK",
            sourcePage: 23
        }
    )
];

/* =========================================================
   MEGA PROJECTS
========================================================= */

const MEGA_PROJECTS = [
    item(
        "geothermal_power_plant",
        "Geothermal Power Plant",
        null,
        {
            category: "mega_project",
            requirement:
                "Require production tech level 30",
            sourcePage: 35
        }
    ),

    item(
        "satellite_spaceship",
        "Satellite Spaceship",
        null,
        {
            category: "mega_project",
            requirement:
                "Require production tech level 32",
            sourcePage: 35
        }
    ),

    item(
        "nuclear_submarine",
        "Nuclear Submarine",
        null,
        {
            category: "mega_project",
            requirement:
                "Require company level 8",
            sourcePage: 36
        }
    ),

    item(
        "nuclear_power_plant",
        "Nuclear power plant",
        null,
        {
            category: "mega_project",
            requirement:
                "Require production tech level 32",
            sourcePage: 37
        }
    ),

    item(
        "space_travelling_shuttle_project",
        "Space Travelling Shuttle",
        null,
        {
            category: "mega_project",
            requirement:
                "Require company level 9",
            sourcePage: 37
        }
    ),

    item(
        "space_elevator",
        "Space Elevator",
        null,
        {
            category: "mega_project",
            requirement:
                "Require company level 10",
            sourcePage: 38
        }
    )
];

/* =========================================================
   COMPLETE CATALOG
========================================================= */

const CATALOG = [
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

function catalogById(id) {
    return CATALOG.find(
        x => x.id === String(id)
    ) || null;
}

function catalogCategory(category) {
    const c = normalize(category);

    return CATALOG.filter(
        x => normalize(x.category) === c
    );
}

/* =========================================================
   DATABASE INITIALIZATION
========================================================= */

async function initDatabase() {

    await query(`
        CREATE TABLE IF NOT EXISTS players (
            id BIGSERIAL PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            company_name TEXT NOT NULL,
            country TEXT NOT NULL DEFAULT 'India',

            cash NUMERIC(30,2) NOT NULL DEFAULT 10000,
            gold_coins INTEGER NOT NULL DEFAULT 0,

            level INTEGER NOT NULL DEFAULT 1,
            xp BIGINT NOT NULL DEFAULT 0,

            production_tech INTEGER NOT NULL DEFAULT 0,

            net_worth NUMERIC(30,2) NOT NULL DEFAULT 10000,

            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            last_income_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);

    await query(`
        CREATE TABLE IF NOT EXISTS sessions (
            token TEXT PRIMARY KEY,
            player_id BIGINT NOT NULL REFERENCES players(id)
                ON DELETE CASCADE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);

    await query(`
        CREATE TABLE IF NOT EXISTS player_assets (
            id BIGSERIAL PRIMARY KEY,
            player_id BIGINT NOT NULL REFERENCES players(id)
                ON DELETE CASCADE,

            item_id TEXT NOT NULL,
            category TEXT NOT NULL,

            quantity BIGINT NOT NULL DEFAULT 0,

            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

            UNIQUE(player_id, item_id, category)
        )
    `);

    await query(`
        CREATE TABLE IF NOT EXISTS player_concessions (
            player_id BIGINT NOT NULL REFERENCES players(id)
                ON DELETE CASCADE,

            concession_id TEXT NOT NULL,

            purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

            PRIMARY KEY(player_id, concession_id)
        )
    `);

    await query(`
        CREATE TABLE IF NOT EXISTS research (
            player_id BIGINT NOT NULL REFERENCES players(id)
                ON DELETE CASCADE,

            research_id TEXT NOT NULL,

            level INTEGER NOT NULL DEFAULT 1,

            purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

            PRIMARY KEY(player_id, research_id)
        )
    `);

    await query(`
        CREATE TABLE IF NOT EXISTS loans (
            id BIGSERIAL PRIMARY KEY,
            player_id BIGINT NOT NULL REFERENCES players(id)
                ON DELETE CASCADE,

            amount NUMERIC(30,2) NOT NULL,
            remaining NUMERIC(30,2) NOT NULL,

            interest NUMERIC(12,4) NOT NULL DEFAULT 0.05,

            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);

    await query(`
        CREATE TABLE IF NOT EXISTS contracts (
            id BIGSERIAL PRIMARY KEY,

            title TEXT NOT NULL,
            description TEXT,

            category TEXT NOT NULL DEFAULT 'business',

            quantity INTEGER NOT NULL DEFAULT 1,
            market_value NUMERIC(30,2) NOT NULL DEFAULT 0,

            min_bid NUMERIC(30,2) NOT NULL DEFAULT 0,

            winners INTEGER NOT NULL DEFAULT 1,

            ends_at TIMESTAMPTZ NOT NULL,

            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);

    await query(`
        CREATE TABLE IF NOT EXISTS contract_bids (
            id BIGSERIAL PRIMARY KEY,

            contract_id BIGINT NOT NULL REFERENCES contracts(id)
                ON DELETE CASCADE,

            player_id BIGINT NOT NULL REFERENCES players(id)
                ON DELETE CASCADE,

            bid NUMERIC(30,2) NOT NULL,

            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

            UNIQUE(contract_id, player_id)
        )
    `);

    await query(`
        CREATE TABLE IF NOT EXISTS alliances (
            id BIGSERIAL PRIMARY KEY,

            name TEXT NOT NULL,
            country TEXT NOT NULL,

            leader_id BIGINT REFERENCES players(id)
                ON DELETE SET NULL,

            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);

    await query(`
        CREATE TABLE IF NOT EXISTS alliance_members (
            alliance_id BIGINT NOT NULL REFERENCES alliances(id)
                ON DELETE CASCADE,

            player_id BIGINT NOT NULL REFERENCES players(id)
                ON DELETE CASCADE,

            joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

            PRIMARY KEY(alliance_id, player_id)
        )
    `);

    await query(`
        CREATE TABLE IF NOT EXISTS chat (
            id BIGSERIAL PRIMARY KEY,

            player_id BIGINT NOT NULL REFERENCES players(id)
                ON DELETE CASCADE,

            channel TEXT NOT NULL DEFAULT 'global',

            message TEXT NOT NULL,

            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);

    await query(`
        CREATE TABLE IF NOT EXISTS world_sites (
            id BIGSERIAL PRIMARY KEY,

            name TEXT NOT NULL,
            country TEXT NOT NULL,

            latitude DOUBLE PRECISION,
            longitude DOUBLE PRECISION,

            resource TEXT,

            owner_id BIGINT REFERENCES players(id)
                ON DELETE SET NULL
        )
    `);

    await query(`
        CREATE TABLE IF NOT EXISTS armies (
            player_id BIGINT PRIMARY KEY REFERENCES players(id)
                ON DELETE CASCADE,

            ground INTEGER NOT NULL DEFAULT 1,
            air INTEGER NOT NULL DEFAULT 0,
            defense INTEGER NOT NULL DEFAULT 1,
            offensive INTEGER NOT NULL DEFAULT 1,

            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);

    await query(`
        CREATE TABLE IF NOT EXISTS wars (
            id BIGSERIAL PRIMARY KEY,

            attacker_id BIGINT NOT NULL REFERENCES players(id)
                ON DELETE CASCADE,

            defender_id BIGINT NOT NULL REFERENCES players(id)
                ON DELETE CASCADE,

            attacker_power BIGINT NOT NULL DEFAULT 0,
            defender_power BIGINT NOT NULL DEFAULT 0,

            status TEXT NOT NULL DEFAULT 'active',

            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            resolved_at TIMESTAMPTZ
        )
    `);

    await query(`
        CREATE TABLE IF NOT EXISTS country_relations (
            player_id BIGINT NOT NULL REFERENCES players(id)
                ON DELETE CASCADE,

            country TEXT NOT NULL,

            relation INTEGER NOT NULL DEFAULT 50,

            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

            PRIMARY KEY(player_id, country)
        )
    `);

    await query(`
        CREATE TABLE IF NOT EXISTS marketing_campaigns (
            id BIGSERIAL PRIMARY KEY,

            player_id BIGINT NOT NULL REFERENCES players(id)
                ON DELETE CASCADE,

            campaign_type TEXT NOT NULL,

            cost NUMERIC(30,2) NOT NULL,
            duration_hours INTEGER NOT NULL DEFAULT 1,

            multiplier NUMERIC(12,4) NOT NULL DEFAULT 1,

            starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            ends_at TIMESTAMPTZ NOT NULL,

            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);

    await query(`
        CREATE TABLE IF NOT EXISTS challenge_claims (
            player_id BIGINT NOT NULL REFERENCES players(id)
                ON DELETE CASCADE,

            challenge_id TEXT NOT NULL,

            claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

            PRIMARY KEY(player_id, challenge_id)
        )
    `);

    await query(`
        CREATE TABLE IF NOT EXISTS ceo_upgrades (
            player_id BIGINT NOT NULL REFERENCES players(id)
                ON DELETE CASCADE,

            upgrade_id TEXT NOT NULL,

            level INTEGER NOT NULL DEFAULT 0,

            PRIMARY KEY(player_id, upgrade_id)
        )
    `);

    await query(`
        CREATE TABLE IF NOT EXISTS collection_claims (
            player_id BIGINT NOT NULL REFERENCES players(id)
                ON DELETE CASCADE,

            collection_id TEXT NOT NULL,

            claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

            PRIMARY KEY(player_id, collection_id)
        )
    `);

    await query(`
        CREATE TABLE IF NOT EXISTS special_items (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            price INTEGER NOT NULL DEFAULT 0
        )
    `);

    await query(`
        CREATE TABLE IF NOT EXISTS player_special_items (
            player_id BIGINT NOT NULL REFERENCES players(id)
                ON DELETE CASCADE,

            item_id TEXT NOT NULL REFERENCES special_items(id)
                ON DELETE CASCADE,

            quantity INTEGER NOT NULL DEFAULT 0,

            PRIMARY KEY(player_id, item_id)
        )
    `);

    await query(`
        CREATE TABLE IF NOT EXISTS stock_positions (
            player_id BIGINT NOT NULL REFERENCES players(id)
                ON DELETE CASCADE,

            stock_id TEXT NOT NULL,

            quantity BIGINT NOT NULL DEFAULT 0,

            average_price NUMERIC(30,2) NOT NULL DEFAULT 0,

            PRIMARY KEY(player_id, stock_id)
        )
    `);

    await query(`
        CREATE TABLE IF NOT EXISTS stock_prices (
            stock_id TEXT PRIMARY KEY,

            price NUMERIC(30,2) NOT NULL,

            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);

    await query(`
        CREATE TABLE IF NOT EXISTS production_orders (
            id BIGSERIAL PRIMARY KEY,

            player_id BIGINT NOT NULL REFERENCES players(id)
                ON DELETE CASCADE,

            product_id TEXT NOT NULL,

            quantity BIGINT NOT NULL,

            cost NUMERIC(30,2) NOT NULL,

            started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

            completes_at TIMESTAMPTZ NOT NULL,

            completed BOOLEAN NOT NULL DEFAULT FALSE
        )
    `);

    await query(`
        CREATE TABLE IF NOT EXISTS space_program (
            player_id BIGINT PRIMARY KEY REFERENCES players(id)
                ON DELETE CASCADE,

            level INTEGER NOT NULL DEFAULT 0,

            missions_completed INTEGER NOT NULL DEFAULT 0,

            satellites INTEGER NOT NULL DEFAULT 0,

            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);

    await query(`
        CREATE TABLE IF NOT EXISTS congress_resolutions (
            id BIGSERIAL PRIMARY KEY,

            creator_id BIGINT NOT NULL REFERENCES players(id)
                ON DELETE CASCADE,

            title TEXT NOT NULL,

            description TEXT,

            yes_votes INTEGER NOT NULL DEFAULT 0,
            no_votes INTEGER NOT NULL DEFAULT 0,

            active BOOLEAN NOT NULL DEFAULT TRUE,

            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);

    await query(`
        CREATE TABLE IF NOT EXISTS congress_votes (
            resolution_id BIGINT NOT NULL
                REFERENCES congress_resolutions(id)
                ON DELETE CASCADE,

            player_id BIGINT NOT NULL
                REFERENCES players(id)
                ON DELETE CASCADE,

            vote BOOLEAN NOT NULL,

            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

            PRIMARY KEY(resolution_id, player_id)
        )
    `);

    await query(`
        CREATE TABLE IF NOT EXISTS missions (
            player_id BIGINT NOT NULL REFERENCES players(id)
                ON DELETE CASCADE,

            mission_id TEXT NOT NULL,

            progress INTEGER NOT NULL DEFAULT 0,

            target INTEGER NOT NULL DEFAULT 1,

            claimed BOOLEAN NOT NULL DEFAULT FALSE,

            PRIMARY KEY(player_id, mission_id)
        )
    `);

    await seedWorldSites();
    await seedSpecialItems();
    await seedStockPrices();
    await seedContracts();
}

/* =========================================================
   SEED WORLD SITES
========================================================= */

async function seedWorldSites() {

    const result =
        await query(
            `SELECT COUNT(*)::int AS count
             FROM world_sites`
        );

    if (result.rows[0].count > 0) {
        return;
    }

    const sites = [
        ["North America Resource Site", "United States", 39.0, -98.0, "Oil"],
        ["Canada Mining Site", "Canada", 56.0, -106.0, "Iron"],
        ["Brazil Resource Site", "Brazil", -10.0, -55.0, "Gold"],
        ["Chile Mining Site", "Chile", -30.0, -71.0, "Copper"],
        ["India Resource Site", "India", 22.0, 79.0, "Aluminum"],
        ["Australia Mining Site", "Australia", -25.0, 133.0, "Iron"],
        ["Middle East Oil Site", "Saudi Arabia", 24.0, 45.0, "Oil"],
        ["South Africa Resource Site", "South Africa", -30.0, 25.0, "Gold"]
    ];

    for (const site of sites) {
        await query(
            `INSERT INTO world_sites
             (name, country, latitude, longitude, resource)
             VALUES ($1,$2,$3,$4,$5)`,
            site
        );
    }
}

/* =========================================================
   SPECIAL ITEMS
========================================================= */

async function seedSpecialItems() {

    const items = [
        ["golden_ceo_badge", "Golden CEO Badge", 10],
        ["executive_license", "Executive License", 15],
        ["military_medal", "Military Medal", 20],
        ["innovation_chip", "Innovation Chip", 25]
    ];

    for (const itemData of items) {
        await query(
            `INSERT INTO special_items
             (id, name, price)
             VALUES ($1,$2,$3)
             ON CONFLICT(id) DO NOTHING`,
            itemData
        );
    }
}

/* =========================================================
   STOCK PRICES
========================================================= */

async function seedStockPrices() {

    for (const stock of STOCK_MARKET) {

        if (stock.price == null) {
            continue;
        }

        await query(
            `INSERT INTO stock_prices
             (stock_id, price)
             VALUES ($1,$2)
             ON CONFLICT(stock_id) DO NOTHING`,
            [
                stock.id,
                stock.price
            ]
        );
    }
}

/* =========================================================
   CONTRACT SEED
========================================================= */

async function seedContracts() {

    const result =
        await query(
            `SELECT COUNT(*)::int AS count
             FROM contracts
             WHERE ends_at > NOW()`
        );

    if (result.rows[0].count > 0) {
        return;
    }

    const contracts = [
        [
            "Natural Resources Contract",
            "Supply raw resources.",
            "resources",
            100,
            30000,
            15000,
            2,
            60
        ],
        [
            "Transportation Contract",
            "Provide transportation capacity.",
            "transportation",
            50,
            48000,
            20000,
            1,
            90
        ],
        [
            "Commerce Contract",
            "Commercial supply agreement.",
            "business",
            100,
            60000,
            25000,
            2,
            120
        ]
    ];

    for (const c of contracts) {

        await query(
            `INSERT INTO contracts
             (
                title,
                description,
                category,
                quantity,
                market_value,
                min_bid,
                winners,
                ends_at
             )
             VALUES
             ($1,$2,$3,$4,$5,$6,$7,NOW()+($8 || ' minutes')::interval)`,
            c
        );
    }
}

/* =========================================================
   AUTHENTICATION
========================================================= */

async function authenticate(req) {

    const token = bearerToken(req);

    if (!token) {
        return null;
    }

    const result =
        await query(
            `SELECT
                p.*,
                s.token
             FROM sessions s
             JOIN players p
               ON p.id = s.player_id
             WHERE s.token = $1`,
            [token]
        );

    if (!result.rows.length) {
        return null;
    }

    await query(
        `UPDATE sessions
         SET last_used_at = NOW()
         WHERE token = $1`,
        [token]
    );

    return result.rows[0];
}

async function requirePlayer(req, res) {

    const player =
        await authenticate(req);

    if (!player) {
        error(
            res,
            401,
            "Authentication required"
        );

        return null;
    }

    return player;
}

/* =========================================================
   LEVEL SYSTEM
========================================================= */

const LEVELS = [
    {
        level: 1,
        xp: 0,
        title: "Beginner Businessman"
    },
    {
        level: 2,
        xp: 100,
        title: "Small Businessman"
    },
    {
        level: 3,
        xp: 300,
        title: "Businessman"
    },
    {
        level: 4,
        xp: 700,
        title: "Experienced Businessman"
    },
    {
        level: 5,
        xp: 1500,
        title: "Established Businessman"
    },
    {
        level: 6,
        xp: 3000,
        title: "Professional Businessman"
    },
    {
        level: 7,
        xp: 6000,
        title: "Executive"
    },
    {
        level: 8,
        xp: 12000,
        title: "Senior Executive"
    },
    {
        level: 9,
        xp: 25000,
        title: "CEO"
    },
    {
        level: 10,
        xp: 50000,
        title: "Corporate CEO"
    },
    {
        level: 11,
        xp: 100000,
        title: "Business Tycoon"
    },
    {
        level: 12,
        xp: 200000,
        title: "Major Tycoon"
    },
    {
        level: 13,
        xp: 400000,
        title: "Industrial Tycoon"
    },
    {
        level: 14,
        xp: 800000,
        title: "Global Tycoon"
    },
    {
        level: 15,
        xp: 1500000,
        title: "Business Empire"
    }
];

function levelForXP(xp) {

    let selected =
        LEVELS[0];

    for (const level of LEVELS) {

        if (Number(xp) >= level.xp) {
            selected = level;
        }
    }

    return selected;
}

async function updateLevel(playerId) {

    const result =
        await query(
            `SELECT id, xp, level
             FROM players
             WHERE id = $1`,
            [playerId]
        );

    if (!result.rows.length) {
        return;
    }

    const player =
        result.rows[0];

    const calculated =
        levelForXP(player.xp);

    if (
        Number(player.level) !==
        Number(calculated.level)
    ) {

        await query(
            `UPDATE players
             SET level = $1,
                 updated_at = NOW()
             WHERE id = $2`,
            [
                calculated.level,
                playerId
            ]
        );
    }
}

/* =========================================================
   PLAYER ASSETS
========================================================= */

async function getAssetQuantity(
    playerId,
    itemId,
    category
) {

    const result =
        await query(
            `SELECT quantity
             FROM player_assets
             WHERE player_id=$1
               AND item_id=$2
               AND category=$3`,
            [
                playerId,
                itemId,
                category
            ]
        );

    return result.rows.length
        ? Number(result.rows[0].quantity)
        : 0;
}

async function addAsset(
    playerId,
    itemId,
    category,
    quantity
) {

    await query(
        `INSERT INTO player_assets
         (
            player_id,
            item_id,
            category,
            quantity
         )
         VALUES ($1,$2,$3,$4)
         ON CONFLICT(player_id,item_id,category)
         DO UPDATE SET
            quantity =
                player_assets.quantity +
                EXCLUDED.quantity,
            updated_at = NOW()`,
        [
            playerId,
            itemId,
            category,
            quantity
        ]
    );
}

/* =========================================================
   CONCESSION CHECK
========================================================= */

async function hasConcession(
    playerId,
    concessionName
) {

    const result =
        await query(
            `SELECT pc.concession_id
             FROM player_concessions pc
             WHERE pc.player_id=$1`,
            [playerId]
        );

    const wanted =
        normalize(concessionName);

    return result.rows.some(row => {

        const found =
            catalogById(row.concession_id);

        return (
            normalize(row.concession_id) ===
                wanted ||
            (
                found &&
                normalize(found.name) ===
                    wanted
            )
        );
    });
}

/* =========================================================
   UNLOCK CHECK
========================================================= */

async function checkUnlock(
    player,
    catalogItem
) {

    if (!catalogItem) {
        return {
            unlocked: false,
            reason: "Item not found"
        };
    }

    if (
        catalogItem.price == null &&
        (
            catalogItem.category === "business" ||
            catalogItem.category === "transportation" ||
            catalogItem.category === "property" ||
            catalogItem.category === "concession"
        )
    ) {

        /*
         * Do not invent an original-game price.
         * Items with no visible source price cannot be
         * purchased through the reference purchase API yet.
         *
         * Their visible unlock requirement is still shown.
         */
    }

    const level =
        Number(player.level || 1);

    if (
        catalogItem.unlockLevel &&
        level <
            Number(catalogItem.unlockLevel)
    ) {

        return {
            unlocked: false,
            reason:
                `Require level ${catalogItem.unlockLevel}`
        };
    }

    if (
        catalogItem.productionTech &&
        Number(player.production_tech || 0) <
            Number(catalogItem.productionTech)
    ) {

        return {
            unlocked: false,
            reason:
                `Require production tech level ${catalogItem.productionTech}`
        };
    }

    if (catalogItem.concession) {

        const owns =
            await hasConcession(
                player.id,
                catalogItem.concession
            );

        if (!owns) {

            return {
                unlocked: false,
                reason:
                    `Require ${catalogItem.concession} concession`
            };
        }
    }

    return {
        unlocked: true,
        reason: null
    };
}

/* =========================================================
   INCOME
========================================================= */

async function processIncome(playerId) {

    const playerResult =
        await query(
            `SELECT *
             FROM players
             WHERE id=$1`,
            [playerId]
        );

    if (!playerResult.rows.length) {
        return null;
    }

    const player =
        playerResult.rows[0];

    const last =
        new Date(player.last_income_at);

    const current =
        new Date();

    let cycles =
        Math.floor(
            (current - last) /
            60000
        );

    /*
     * Maximum 24 hours of offline income.
     */
    cycles =
        Math.min(
            Math.max(cycles, 0),
            1440
        );

    if (cycles <= 0) {
        return player;
    }

    const assets =
        await query(
            `SELECT *
             FROM player_assets
             WHERE player_id=$1
               AND quantity > 0`,
            [playerId]
        );

    let incomePerMinute = 0;

    for (const asset of assets.rows) {

        const catalog =
            catalogById(asset.item_id);

        if (!catalog) {
            continue;
        }

        if (catalog.price == null) {
            continue;
        }

        /*
         * This is the server's economy formula.
         * It is deliberately separate from the visible
         * reference purchase price.
         */
        let rate = 0;

        if (
            asset.category ===
            "business"
        ) {
            rate =
                Number(catalog.price) *
                0.01;
        }

        if (
            asset.category ===
            "transportation"
        ) {
            rate =
                Number(catalog.price) *
                0.015;
        }

        if (
            asset.category ===
            "property"
        ) {
            rate =
                Number(catalog.price) *
                0.0005;
        }

        if (
            asset.category ===
            "subsidiary"
        ) {
            rate =
                Number(catalog.price) *
                0.005;
        }

        incomePerMinute +=
            rate *
            Number(asset.quantity);
    }

    /*
     * Marketing multiplier.
     */
    const marketing =
        await query(
            `SELECT COALESCE(MAX(multiplier),1)
             AS multiplier
             FROM marketing_campaigns
             WHERE player_id=$1
               AND starts_at <= NOW()
               AND ends_at > NOW()`,
            [playerId]
        );

    const multiplier =
        Number(
            marketing.rows[0]?.multiplier || 1
        );

    const totalIncome =
        Math.round(
            incomePerMinute *
            cycles *
            multiplier
        );

    if (totalIncome > 0) {

        await query(
            `UPDATE players
             SET cash = cash + $1,
                 last_income_at = NOW(),
                 updated_at = NOW()
             WHERE id=$2`,
            [
                totalIncome,
                playerId
            ]
        );

    } else {

        await query(
            `UPDATE players
             SET last_income_at = NOW(),
                 updated_at = NOW()
             WHERE id=$1`,
            [playerId]
        );
    }

    await updateLevel(playerId);

    return (
        await query(
            `SELECT *
             FROM players
             WHERE id=$1`,
            [playerId]
        )
    ).rows[0];
}

/* =========================================================
   PLAYER SUMMARY
========================================================= */

async function playerSummary(playerId) {

    await processIncome(playerId);

    await updateLevel(playerId);

    const playerResult =
        await query(
            `SELECT *
             FROM players
             WHERE id=$1`,
            [playerId]
        );

    if (!playerResult.rows.length) {
        return null;
    }

    const player =
        playerResult.rows[0];

    const assets =
        await query(
            `SELECT *
             FROM player_assets
             WHERE player_id=$1
               AND quantity > 0
             ORDER BY category,item_id`,
            [playerId]
        );

    let assetValue = 0;

    for (const asset of assets.rows) {

        const catalog =
            catalogById(asset.item_id);

        if (
            catalog &&
            catalog.price != null
        ) {
            assetValue +=
                Number(catalog.price) *
                Number(asset.quantity);
        }
    }

    const loans =
        await query(
            `SELECT
                COALESCE(
                    SUM(remaining),
                    0
                ) AS total
             FROM loans
             WHERE player_id=$1`,
            [playerId]
        );

    const loanValue =
        Number(
            loans.rows[0]?.total || 0
        );

    const netWorth =
        Number(player.cash || 0) +
        assetValue -
        loanValue;

    await query(
        `UPDATE players
         SET net_worth=$1,
             updated_at=NOW()
         WHERE id=$2`,
        [
            netWorth,
            playerId
        ]
    );

    const title =
        LEVELS.find(
            x =>
                x.level ===
                Number(player.level)
        )?.title ||
        "Businessman";

    return {
        id: Number(player.id),

        username:
            player.username,

        company:
            player.company_name,

        companyName:
            player.company_name,

        ceo:
            player.username,

        country:
            player.country,

        cash:
            Number(player.cash),

        goldCoins:
            Number(player.gold_coins),

        level:
            Number(player.level),

        xp:
            Number(player.xp),

        title,

        productionTech:
            Number(player.production_tech),

        netWorth:
            Number(netWorth),

        assetsValue:
            Number(assetValue),

        loans:
            Number(loanValue),

        lastIncomeAt:
            player.last_income_at,

        assets:
            assets.rows
    };
}

/* =========================================================
   REGISTRATION
========================================================= */

async function register(
    req,
    res,
    body
) {

    const username =
        String(
            body.username ||
            body.email ||
            ""
        ).trim();

    const password =
        String(
            body.password ||
            ""
        );

    const companyName =
        String(
            body.companyName ||
            body.company ||
            `${username} Corporation`
        ).trim();

    const country =
        String(
            body.country ||
            "India"
        ).trim();

    if (
        username.length < 3 ||
        username.length > 40
    ) {
        return error(
            res,
            400,
            "Username must be 3-40 characters"
        );
    }

    if (password.length < 4) {
        return error(
            res,
            400,
            "Password must contain at least 4 characters"
        );
    }

    const existing =
        await query(
            `SELECT id
             FROM players
             WHERE LOWER(username)=LOWER($1)`,
            [username]
        );

    if (existing.rows.length) {
        return error(
            res,
            409,
            "Username already exists"
        );
    }

    const passwordHash =
        await hashPassword(password);

    const player =
        await transaction(
            async client => {

                const result =
                    await client.query(
                        `INSERT INTO players
                         (
                            username,
                            password_hash,
                            company_name,
                            country,
                            cash
                         )
                         VALUES
                         ($1,$2,$3,$4,10000)
                         RETURNING *`,
                        [
                            username,
                            passwordHash,
                            companyName,
                            country
                        ]
                    );

                const created =
                    result.rows[0];

                await client.query(
                    `INSERT INTO armies
                     (player_id)
                     VALUES ($1)
                     ON CONFLICT DO NOTHING`,
                    [created.id]
                );

                await client.query(
                    `INSERT INTO space_program
                     (player_id)
                     VALUES ($1)
                     ON CONFLICT DO NOTHING`,
                    [created.id]
                );

                return created;
            }
        );

    return send(
        res,
        201,
        {
            ok: true,
            message:
                "Account created successfully",
            playerId:
                Number(player.id)
        }
    );
}

/* =========================================================
   LOGIN
========================================================= */

async function login(
    req,
    res,
    body
) {

    const username =
        String(
            body.username ||
            body.email ||
            ""
        ).trim();

    const password =
        String(
            body.password ||
            ""
        );

    const result =
        await query(
            `SELECT *
             FROM players
             WHERE LOWER(username)=LOWER($1)`,
            [username]
        );

    if (!result.rows.length) {
        return error(
            res,
            401,
            "Invalid username or password"
        );
    }

    const player =
        result.rows[0];

    const valid =
        await verifyPassword(
            password,
            player.password_hash
        );

    if (!valid) {
        return error(
            res,
            401,
            "Invalid username or password"
        );
    }

    const token =
        randomId(32);

    await query(
        `INSERT INTO sessions
         (token,player_id)
         VALUES ($1,$2)`,
        [
            token,
            player.id
        ]
    );

    const summary =
        await playerSummary(
            player.id
        );

    return send(
        res,
        200,
        {
            ok: true,
            token,
            accessToken: token,
            player: summary
        }
    );
}

/* =========================================================
   CATALOG RESPONSE
========================================================= */

function catalogForPlayer(
    player,
    ownedConcessions = []
) {

    const concessionNames =
        ownedConcessions.map(
            x =>
                normalize(
                    x.name || x.concession_id || x
                )
        );

    return CATALOG.map(
        data => {

            let unlocked = true;
            let reason = null;

            if (
                data.unlockLevel &&
                Number(player.level) <
                    Number(data.unlockLevel)
            ) {
                unlocked = false;
                reason =
                    `Require level ${data.unlockLevel}`;
            }

            if (
                unlocked &&
                data.productionTech &&
                Number(player.production_tech) <
                    Number(data.productionTech)
            ) {
                unlocked = false;
                reason =
                    `Require production tech level ${data.productionTech}`;
            }

            if (
                unlocked &&
                data.concession
            ) {

                const wanted =
                    normalize(
                        data.concession
                    );

                if (
                    !concessionNames.includes(
                        wanted
                    )
                ) {
                    unlocked = false;
                    reason =
                        `Require ${data.concession} concession`;
                }
            }

            return {
                ...data,
                unlocked,
                lockedReason: reason
            };
        }
    );
}

/* =========================================================
   ASSET LIST
========================================================= */

async function assets(
    req,
    res,
    player
) {

    const category =
        req.query.get("category");

    const ownedResult =
        await query(
            `SELECT *
             FROM player_assets
             WHERE player_id=$1`,
            [player.id]
        );

    const owned = new Map();

    for (const row of ownedResult.rows) {
        owned.set(
            `${row.category}:${row.item_id}`,
            Number(row.quantity)
        );
    }

    let list;

    if (category) {
        list =
            catalogCategory(
                category
            );
    } else {
        list = CATALOG;
    }

    const concessions =
        await query(
            `SELECT concession_id
             FROM player_concessions
             WHERE player_id=$1`,
            [player.id]
        );

    const output =
        catalogForPlayer(
            player,
            concessions.rows
        ).filter(
            x =>
                !category ||
                normalize(x.category) ===
                    normalize(category)
        )
        .map(
            x => ({
                ...x,

                owned:
                    owned.get(
                        `${x.category}:${x.id}`
                    ) || 0
            })
        );

    return send(
        res,
        200,
        {
            ok: true,
            category,
            items: output
        }
    );
}

/* =========================================================
   BUY ASSET
========================================================= */

async function buyAsset(
    req,
    res,
    player,
    body
) {

    const itemId =
        String(
            body.itemId ||
            body.assetId ||
            body.id ||
            ""
        );

    const quantity =
        Math.max(
            1,
            Math.floor(
                Number(
                    body.quantity || 1
                )
            )
        );

    const catalogItem =
        catalogById(itemId);

    if (!catalogItem) {
        return error(
            res,
            404,
            "Item not found"
        );
    }

    if (
        catalogItem.price == null
    ) {
        return error(
            res,
            400,
            "Reference price for this item is not available"
        );
    }

    const unlocked =
        await checkUnlock(
            player,
            catalogItem
        );

    if (!unlocked.unlocked) {
        return error(
            res,
            403,
            unlocked.reason,
            {
                itemLocked: true
            }
        );
    }

    const total =
        Number(catalogItem.price) *
        quantity;

    if (
        Number(player.cash) <
        total
    ) {
        return error(
            res,
            400,
            "Not enough cash",
            {
                required: total,
                cash: Number(player.cash)
            }
        );
    }

    await transaction(
        async client => {

            await client.query(
                `UPDATE players
                 SET cash=cash-$1,
                     xp=xp+$2,
                     updated_at=NOW()
                 WHERE id=$3`,
                [
                    total,
                    Math.max(1, Math.floor(total / 100)),
                    player.id
                ]
            );

            await client.query(
                `INSERT INTO player_assets
                 (
                    player_id,
                    item_id,
                    category,
                    quantity
                 )
                 VALUES ($1,$2,$3,$4)
                 ON CONFLICT
                    (player_id,item_id,category)
                 DO UPDATE SET
                    quantity =
                        player_assets.quantity +
                        EXCLUDED.quantity,
                    updated_at=NOW()`,
                [
                    player.id,
                    catalogItem.id,
                    catalogItem.category,
                    quantity
                ]
            );
        }
    );

    await updateLevel(player.id);

    return send(
        res,
        200,
        {
            ok: true,
            purchased: {
                id: catalogItem.id,
                name: catalogItem.name,
                quantity,
                unitPrice:
                    catalogItem.price,
                total
            },
            player:
                await playerSummary(player.id)
        }
    );
}

/* =========================================================
   SELL ASSET
========================================================= */

async function sellAsset(
    req,
    res,
    player,
    body
) {

    const itemId =
        String(
            body.itemId ||
            body.assetId ||
            body.id ||
            ""
        );

    const quantity =
        Math.max(
            1,
            Math.floor(
                Number(
                    body.quantity || 1
                )
            )
        );

    const catalogItem =
        catalogById(itemId);

    if (!catalogItem) {
        return error(
            res,
            404,
            "Item not found"
        );
    }

    if (catalogItem.price == null) {
        return error(
            res,
            400,
            "Item has no reference sale price"
        );
    }

    const existing =
        await query(
            `SELECT quantity
             FROM player_assets
             WHERE player_id=$1
               AND item_id=$2
               AND category=$3`,
            [
                player.id,
                catalogItem.id,
                catalogItem.category
            ]
        );

    const owned =
        existing.rows.length
            ? Number(existing.rows[0].quantity)
            : 0;

    if (owned < quantity) {
        return error(
            res,
            400,
            "Not enough items owned"
        );
    }

    const saleValue =
        Math.floor(
            Number(catalogItem.price) *
            quantity *
            0.8
        );

    await transaction(
        async client => {

            await client.query(
                `UPDATE player_assets
                 SET quantity=quantity-$1,
                     updated_at=NOW()
                 WHERE player_id=$2
                   AND item_id=$3
                   AND category=$4`,
                [
                    quantity,
                    player.id,
                    catalogItem.id,
                    catalogItem.category
                ]
            );

            await client.query(
                `UPDATE players
                 SET cash=cash+$1,
                     updated_at=NOW()
                 WHERE id=$2`,
                [
                    saleValue,
                    player.id
                ]
            );
        }
    );

    return send(
        res,
        200,
        {
            ok: true,
            sold: quantity,
            received: saleValue
        }
    );
}

/* =========================================================
   CONCESSIONS
========================================================= */

async function concessions(
    req,
    res,
    player
) {

    const owned =
        await query(
            `SELECT concession_id
             FROM player_concessions
             WHERE player_id=$1`,
            [player.id]
        );

    const ownedSet =
        new Set(
            owned.rows.map(
                x => x.concession_id
            )
        );

    return send(
        res,
        200,
        {
            ok: true,

            concessions:
                CONCESSIONS.map(
                    x => ({
                        ...x,
                        owned:
                            ownedSet.has(x.id)
                    })
                )
        }
    );
}

async function buyConcession(
    req,
    res,
    player,
    body
) {

    const id =
        String(
            body.id ||
            body.itemId ||
            body.concessionId ||
            ""
        );

    const concession =
        CONCESSIONS.find(
            x => x.id === id
        );

    if (!concession) {
        return error(
            res,
            404,
            "Concession not found"
        );
    }

    const existing =
        await query(
            `SELECT 1
             FROM player_concessions
             WHERE player_id=$1
               AND concession_id=$2`,
            [
                player.id,
                id
            ]
        );

    if (existing.rows.length) {
        return error(
            res,
            400,
            "Already owned"
        );
    }

    if (
        Number(player.cash) <
        Number(concession.price)
    ) {
        return error(
            res,
            400,
            "Not enough cash"
        );
    }

    await transaction(
        async client => {

            await client.query(
                `UPDATE players
                 SET cash=cash-$1,
                     xp=xp+$2,
                     updated_at=NOW()
                 WHERE id=$3`,
                [
                    concession.price,
                    Math.floor(
                        concession.price / 100
                    ),
                    player.id
                ]
            );

            await client.query(
                `INSERT INTO player_concessions
                 (player_id,concession_id)
                 VALUES ($1,$2)`,
                [
                    player.id,
                    id
                ]
            );
        }
    );

    await updateLevel(player.id);

    return send(
        res,
        200,
        {
            ok: true,
            concession
        }
    );
}

/* =========================================================
   RESEARCH
========================================================= */

async function research(
    req,
    res,
    player
) {

    const owned =
        await query(
            `SELECT *
             FROM research
             WHERE player_id=$1`,
            [player.id]
        );

    const map =
        new Map(
            owned.rows.map(
                x => [
                    x.research_id,
                    Number(x.level)
                ]
            )
        );

    return send(
        res,
        200,
        {
            ok: true,
            research:
                RESEARCH.map(
                    x => ({
                        ...x,
                        level:
                            map.get(x.id) || 0,
                        owned:
                            map.has(x.id)
                    })
                )
        }
    );
}

/* =========================================================
   RESEARCH BUY
========================================================= */

async function buyResearch(
    req,
    res,
    player,
    body
) {

    const id =
        String(
            body.id ||
            body.researchId ||
            ""
        );

    const researchItem =
        RESEARCH.find(
            x => x.id === id
        );

    if (!researchItem) {
        return error(
            res,
            404,
            "Research not found"
        );
    }

    const existing =
        await query(
            `SELECT level
             FROM research
             WHERE player_id=$1
               AND research_id=$2`,
            [
                player.id,
                id
            ]
        );

    if (existing.rows.length) {
        return error(
            res,
            400,
            "Research already unlocked"
        );
    }

    const requirement =
        String(
            researchItem.requirement || ""
        );

    const coinMatch =
        requirement.match(
            /(\d+)\s*coins?/i
        );

    const requiredCoins =
        coinMatch
            ? Number(coinMatch[1])
            : 0;

    if (
        Number(player.gold_coins) <
        requiredCoins
    ) {
        return error(
            res,
            400,
            "Not enough gold coins"
        );
    }

    const levelMatch =
        requirement.match(
            /level\s*(\d+)/i
        );

    if (
        levelMatch &&
        Number(player.level) <
            Number(levelMatch[1])
    ) {
        return error(
            res,
            403,
            `Require level ${levelMatch[1]}`
        );
    }

    await transaction(
        async client => {

            await client.query(
                `UPDATE players
                 SET gold_coins =
                     gold_coins-$1,
                     updated_at=NOW()
                 WHERE id=$2`,
                [
                    requiredCoins,
                    player.id
                ]
            );

            await client.query(
                `INSERT INTO research
                 (player_id,research_id,level)
                 VALUES ($1,$2,1)`,
                [
                    player.id,
                    id
                ]
            );
        }
    );

    return send(
        res,
        200,
        {
            ok: true,
            research: researchItem
        }
    );
}

/* =========================================================
   WORLD SITES
========================================================= */

async function worldSites(
    req,
    res,
    player
) {

    const result =
        await query(
            `SELECT
                ws.*,
                CASE
                    WHEN ws.owner_id=$1
                    THEN TRUE
                    ELSE FALSE
                END AS owned
             FROM world_sites ws
             ORDER BY ws.id`,
            [player.id]
        );

    return send(
        res,
        200,
        {
            ok: true,
            sites: result.rows
        }
    );
}

async function claimWorldSite(
    req,
    res,
    player,
    body
) {

    const siteId =
        Number(
            body.siteId ||
            body.id
        );

    const result =
        await query(
            `SELECT *
             FROM world_sites
             WHERE id=$1`,
            [siteId]
        );

    if (!result.rows.length) {
        return error(
            res,
            404,
            "World site not found"
        );
    }

    const site =
        result.rows[0];

    if (site.owner_id) {
        return error(
            res,
            400,
            "World site already owned"
        );
    }

    await query(
        `UPDATE world_sites
         SET owner_id=$1
         WHERE id=$2`,
        [
            player.id,
            siteId
        ]
    );

    return send(
        res,
        200,
        {
            ok: true,
            site
        }
    );
}

/* =========================================================
   RANKINGS
========================================================= */

async function rankings(
    req,
    res
) {

    const result =
        await query(
            `SELECT
                id,
                username,
                company_name,
                country,
                level,
                net_worth
             FROM players
             ORDER BY net_worth DESC
             LIMIT 100`
        );

    return send(
        res,
        200,
        {
            ok: true,
            rankings:
                result.rows.map(
                    (x, index) => ({
                        rank: index + 1,
                        id: Number(x.id),
                        username: x.username,
                        company:
                            x.company_name,
                        country: x.country,
                        level:
                            Number(x.level),
                        worth:
                            Number(x.net_worth)
                    })
                )
        }
    );
}

/* =========================================================
   ARMY
========================================================= */

async function army(
    req,
    res,
    player
) {

    const result =
        await query(
            `SELECT *
             FROM armies
             WHERE player_id=$1`,
            [player.id]
        );

    if (!result.rows.length) {

        await query(
            `INSERT INTO armies
             (player_id)
             VALUES ($1)
             ON CONFLICT DO NOTHING`,
            [player.id]
        );
    }

    const armyResult =
        await query(
            `SELECT *
             FROM armies
             WHERE player_id=$1`,
            [player.id]
        );

    const a =
        armyResult.rows[0];

    const power =
        Number(a.ground) * 10 +
        Number(a.air) * 20 +
        Number(a.defense) * 15 +
        Number(a.offensive) * 15;

    return send(
        res,
        200,
        {
            ok: true,
            army: {
                ground:
                    Number(a.ground),
                air:
                    Number(a.air),
                defense:
                    Number(a.defense),
                offensive:
                    Number(a.offensive),
                militaryPower:
                    power
            }
        }
    );
}

/* =========================================================
   ARMY UPGRADE
========================================================= */

async function armyUpgrade(
    req,
    res,
    player,
    body
) {

    const type =
        normalize(
            body.type ||
            body.unit ||
            ""
        );

    const allowed = [
        "ground",
        "air",
        "defense",
        "offensive"
    ];

    if (!allowed.includes(type)) {
        return error(
            res,
            400,
            "Invalid army upgrade"
        );
    }

    const result =
        await query(
            `SELECT *
             FROM armies
             WHERE player_id=$1`,
            [player.id]
        );

    if (!result.rows.length) {
        return error(
            res,
            400,
            "Army not initialized"
        );
    }

    const a =
        result.rows[0];

    const current =
        Number(a[type]);

    const cost =
        5000 *
        Math.pow(
            2,
            Math.min(current - 1, 15)
        );

    if (
        Number(player.cash) <
        cost
    ) {
        return error(
            res,
            400,
            "Not enough cash",
            { cost }
        );
    }

    await transaction(
        async client => {

            await client.query(
                `UPDATE players
                 SET cash=cash-$1,
                     xp=xp+100
                 WHERE id=$2`,
                [
                    cost,
                    player.id
                ]
            );

            await client.query(
                `UPDATE armies
                 SET ${type}=${type}+1,
                     updated_at=NOW()
                 WHERE player_id=$1`,
                [player.id]
            );
        }
    );

    return send(
        res,
        200,
        {
            ok: true,
            upgraded: type,
            cost
        }
    );
}

/* =========================================================
   WARS
========================================================= */

async function createWar(
    req,
    res,
    player,
    body
) {

    const target =
        Number(
            body.targetPlayerId ||
            body.targetId
        );

    if (
        !Number.isInteger(target) ||
        target === Number(player.id)
    ) {
        return error(
            res,
            400,
            "Invalid target"
        );
    }

    const targetResult =
        await query(
            `SELECT id
             FROM players
             WHERE id=$1`,
            [target]
        );

    if (!targetResult.rows.length) {
        return error(
            res,
            404,
            "Target player not found"
        );
    }

    const attacker =
        await query(
            `SELECT *
             FROM armies
             WHERE player_id=$1`,
            [player.id]
        );

    const defender =
        await query(
            `SELECT *
             FROM armies
             WHERE player_id=$1`,
            [target]
        );

    const attackerArmy =
        attacker.rows[0] || {
            ground: 1,
            air: 0,
            defense: 1,
            offensive: 1
        };

    const defenderArmy =
        defender.rows[0] || {
            ground: 1,
            air: 0,
            defense: 1,
            offensive: 1
        };

    const attackerPower =
        Number(attackerArmy.ground) * 10 +
        Number(attackerArmy.air) * 20 +
        Number(attackerArmy.defense) * 15 +
        Number(attackerArmy.offensive) * 15;

    const defenderPower =
        Number(defenderArmy.ground) * 10 +
        Number(defenderArmy.air) * 20 +
        Number(defenderArmy.defense) * 15 +
        Number(defenderArmy.offensive) * 15;

    const result =
        await query(
            `INSERT INTO wars
             (
                attacker_id,
                defender_id,
                attacker_power,
                defender_power,
                status
             )
             VALUES ($1,$2,$3,$4,'resolved')
             RETURNING *`,
            [
                player.id,
                target,
                attackerPower,
                defenderPower
            ]
        );

    const war =
        result.rows[0];

    let winner = "draw";

    if (attackerPower > defenderPower) {
        winner = "attacker";
    } else if (
        defenderPower > attackerPower
    ) {
        winner = "defender";
    }

    await query(
        `UPDATE wars
         SET status=$1,
             resolved_at=NOW()
         WHERE id=$2`,
        [
            winner,
            war.id
        ]
    );

    return send(
        res,
        200,
        {
            ok: true,
            war: {
                id: Number(war.id),
                attackerPower,
                defenderPower,
                result: winner
            }
        }
    );
}

/* =========================================================
   CONTRACTS
========================================================= */

async function contracts(
    req,
    res
) {

    const result =
        await query(
            `SELECT *
             FROM contracts
             WHERE ends_at > NOW()
             ORDER BY ends_at ASC`
        );

    return send(
        res,
        200,
        {
            ok: true,
            contracts:
                result.rows.map(
                    x => ({
                        id: Number(x.id),
                        title: x.title,
                        description:
                            x.description,
                        category: x.category,
                        quantity:
                            Number(x.quantity),
                        marketValue:
                            Number(x.market_value),
                        minBid:
                            Number(x.min_bid),
                        winners:
                            Number(x.winners),
                        endsAt:
                            x.ends_at
                    })
                )
        }
    );
}

/* =========================================================
   CONTRACT BIDS
========================================================= */

async function placeBid(
    req,
    res,
    player,
    body
) {

    const contractId =
        Number(
            body.contractId ||
            body.id
        );

    const bid =
        money(
            body.bid ||
            body.amount
        );

    const contractResult =
        await query(
            `SELECT *
             FROM contracts
             WHERE id=$1
               AND ends_at > NOW()`,
            [contractId]
        );

    if (!contractResult.rows.length) {
        return error(
            res,
            404,
            "Contract not found or expired"
        );
    }

    const contract =
        contractResult.rows[0];

    if (
        bid <
        Number(contract.min_bid)
    ) {
        return error(
            res,
            400,
            "Bid is below minimum bid",
            {
                minBid:
                    Number(contract.min_bid)
            }
        );
    }

    const previous =
        await query(
            `SELECT bid
             FROM contract_bids
             WHERE contract_id=$1
               AND player_id=$2`,
            [
                contractId,
                player.id
            ]
        );

    await query(
        `INSERT INTO contract_bids
         (contract_id,player_id,bid)
         VALUES ($1,$2,$3)
         ON CONFLICT(contract_id,player_id)
         DO UPDATE SET
            bid=EXCLUDED.bid,
            created_at=NOW()`,
        [
            contractId,
            player.id,
            bid
        ]
    );

    return send(
        res,
        200,
        {
            ok: true,
            bid,
            previousBid:
                previous.rows.length
                    ? Number(previous.rows[0].bid)
                    : 0
        }
    );
}

async function contractRanking(
    req,
    res
) {

    const contractId =
        Number(
            req.query.get("contractId") ||
            req.query.get("id")
        );

    if (!contractId) {
        return error(
            res,
            400,
            "contractId required"
        );
    }

    const result =
        await query(
            `SELECT
                cb.player_id,
                p.username,
                p.company_name,
                cb.bid,
                cb.created_at
             FROM contract_bids cb
             JOIN players p
               ON p.id=cb.player_id
             WHERE cb.contract_id=$1
             ORDER BY cb.bid DESC`,
            [contractId]
        );

    return send(
        res,
        200,
        {
            ok: true,
            bids:
                result.rows.map(
                    (x, index) => ({
                        rank: index + 1,
                        playerId:
                            Number(x.player_id),
                        username:
                            x.username,
                        company:
                            x.company_name,
                        bid:
                            Number(x.bid),
                        createdAt:
                            x.created_at
                    })
                )
        }
    );
}

/* =========================================================
   RUNNING CONTRACTS
========================================================= */

async function runningContracts(
    req,
    res,
    player
) {

    const result =
        await query(
            `SELECT
                c.*,
                cb.bid
             FROM contract_bids cb
             JOIN contracts c
               ON c.id=cb.contract_id
             WHERE cb.player_id=$1
               AND c.ends_at > NOW()
             ORDER BY c.ends_at`,
            [player.id]
        );

    return send(
        res,
        200,
        {
            ok: true,
            contracts:
                result.rows
        }
    );
}

/* =========================================================
   ALLIANCES
========================================================= */

async function alliances(
    req,
    res,
    player
) {

    const result =
        await query(
            `SELECT
                a.id,
                a.name,
                a.country,
                a.leader_id,
                COUNT(am.player_id)::int
                    AS members
             FROM alliances a
             LEFT JOIN alliance_members am
               ON am.alliance_id=a.id
             GROUP BY a.id
             ORDER BY members DESC`
        );

    return send(
        res,
        200,
        {
            ok: true,
            alliances:
                result.rows.map(
                    x => ({
                        id: Number(x.id),
                        name: x.name,
                        country: x.country,
                        leaderId:
                            x.leader_id
                                ? Number(x.leader_id)
                                : null,
                        members:
                            Number(x.members)
                    })
                )
        }
    );
}

async function createAlliance(
    req,
    res,
    player,
    body
) {

    const name =
        String(
            body.name ||
            ""
        ).trim();

    if (
        name.length < 3 ||
        name.length > 50
    ) {
        return error(
            res,
            400,
            "Alliance name must be 3-50 characters"
        );
    }

    const result =
        await transaction(
            async client => {

                const alliance =
                    await client.query(
                        `INSERT INTO alliances
                         (name,country,leader_id)
                         VALUES ($1,$2,$3)
                         RETURNING *`,
                        [
                            name,
                            player.country,
                            player.id
                        ]
                    );

                const created =
                    alliance.rows[0];

                await client.query(
                    `INSERT INTO alliance_members
                     (alliance_id,player_id)
                     VALUES ($1,$2)`,
                    [
                        created.id,
                        player.id
                    ]
                );

                return created;
            }
        );

    return send(
        res,
        201,
        {
            ok: true,
            alliance: result
        }
    );
}

async function joinAlliance(
    req,
    res,
    player,
    body
) {

    const allianceId =
        Number(
            body.allianceId ||
            body.id
        );

    const result =
        await query(
            `SELECT id
             FROM alliances
             WHERE id=$1`,
            [allianceId]
        );

    if (!result.rows.length) {
        return error(
            res,
            404,
            "Alliance not found"
        );
    }

    await query(
        `INSERT INTO alliance_members
         (alliance_id,player_id)
         VALUES ($1,$2)
         ON CONFLICT DO NOTHING`,
        [
            allianceId,
            player.id
        ]
    );

    return send(
        res,
        200,
        {
            ok: true
        }
    );
}

/* =========================================================
   CHAT
========================================================= */

async function getChat(
    req,
    res
) {

    const channel =
        req.query.get("channel") ||
        "global";

    const result =
        await query(
            `SELECT
                c.id,
                c.channel,
                c.message,
                c.created_at,
                p.username,
                p.company_name
             FROM chat c
             JOIN players p
               ON p.id=c.player_id
             WHERE c.channel=$1
             ORDER BY c.created_at DESC
             LIMIT 100`,
            [channel]
        );

    return send(
        res,
        200,
        {
            ok: true,
            messages:
                result.rows.reverse()
        }
    );
}

async function sendChat(
    req,
    res,
    player,
    body
) {

    const channel =
        String(
            body.channel ||
            "global"
        ).slice(0, 50);

    const message =
        String(
            body.message ||
            ""
        ).trim();

    if (!message) {
        return error(
            res,
            400,
            "Message is empty"
        );
    }

    if (message.length > 1000) {
        return error(
            res,
            400,
            "Message too long"
        );
    }

    const result =
        await query(
            `INSERT INTO chat
             (player_id,channel,message)
             VALUES ($1,$2,$3)
             RETURNING *`,
            [
                player.id,
                channel,
                message
            ]
        );

    return send(
        res,
        201,
        {
            ok: true,
            message:
                result.rows[0]
        }
    );
}

/* =========================================================
   LOANS
========================================================= */

async function loans(
    req,
    res,
    player
) {

    const result =
        await query(
            `SELECT *
             FROM loans
             WHERE player_id=$1
             ORDER BY created_at DESC`,
            [player.id]
        );

    return send(
        res,
        200,
        {
            ok: true,
            loans:
                result.rows.map(
                    x => ({
                        id: Number(x.id),
                        amount:
                            Number(x.amount),
                        remaining:
                            Number(x.remaining),
                        interest:
                            Number(x.interest),
                        createdAt:
                            x.created_at
                    })
                )
        }
    );
}

async function takeLoan(
    req,
    res,
    player,
    body
) {

    const amount =
        money(body.amount);

    if (
        amount <= 0 ||
        amount > 1000000000
    ) {
        return error(
            res,
            400,
            "Invalid loan amount"
        );
    }

    const interest =
        0.05;

    await transaction(
        async client => {

            await client.query(
                `INSERT INTO loans
                 (
                    player_id,
                    amount,
                    remaining,
                    interest
                 )
                 VALUES ($1,$2,$2,$3)`,
                [
                    player.id,
                    amount,
                    interest
                ]
            );

            await client.query(
                `UPDATE players
                 SET cash=cash+$1
                 WHERE id=$2`,
                [
                    amount,
                    player.id
                ]
            );
        }
    );

    return send(
        res,
        200,
        {
            ok: true,
            amount,
            interest
        }
    );
}

/* =========================================================
   COUNTRY RELATIONS
========================================================= */

const COUNTRIES = [
    "India",
    "United States",
    "Canada",
    "Brazil",
    "Mexico",
    "United Kingdom",
    "Germany",
    "France",
    "China",
    "Japan",
    "Australia",
    "Indonesia",
    "Saudi Arabia",
    "South Africa",
    "Chile"
];

async function countryRelations(
    req,
    res,
    player
) {

    const result =
        await query(
            `SELECT *
             FROM country_relations
             WHERE player_id=$1`,
            [player.id]
        );

    const map =
        new Map(
            result.rows.map(
                x => [
                    x.country,
                    Number(x.relation)
                ]
            )
        );

    return send(
        res,
        200,
        {
            ok: true,
            relations:
                COUNTRIES.map(
                    country => ({
                        country,
                        relation:
                            map.has(country)
                                ? map.get(country)
                                : 50
                    })
                )
        }
    );
}

async function improveCountryRelation(
    req,
    res,
    player,
    body
) {

    const country =
        String(
            body.country ||
            ""
        ).trim();

    if (
        !COUNTRIES.includes(country)
    ) {
        return error(
            res,
            400,
            "Invalid country"
        );
    }

    const cost =
        10000;

    if (
        Number(player.cash) <
        cost
    ) {
        return error(
            res,
            400,
            "Not enough cash"
        );
    }

    await transaction(
        async client => {

            await client.query(
                `UPDATE players
                 SET cash=cash-$1
                 WHERE id=$2`,
                [
                    cost,
                    player.id
                ]
            );

            await client.query(
                `INSERT INTO country_relations
                 (
                    player_id,
                    country,
                    relation
                 )
                 VALUES ($1,$2,55)
                 ON CONFLICT(player_id,country)
                 DO UPDATE SET
                    relation =
                    LEAST(
                        100,
                        country_relations.relation+5
                    ),
                    updated_at=NOW()`,
                [
                    player.id,
                    country
                ]
            );
        }
    );

    return send(
        res,
        200,
        {
            ok: true,
            country
        }
    );
}

/* =========================================================
   MARKETING
========================================================= */

async function marketing(
    req,
    res,
    player
) {

    const result =
        await query(
            `SELECT *
             FROM marketing_campaigns
             WHERE player_id=$1
               AND ends_at>NOW()
             ORDER BY ends_at`,
            [player.id]
        );

    return send(
        res,
        200,
        {
            ok: true,
            campaigns:
                result.rows
        }
    );
}

async function createMarketingCampaign(
    req,
    res,
    player,
    body
) {

    const type =
        String(
            body.type ||
            body.campaignType ||
            "standard"
        );

    const configs = {
        standard: {
            cost: 5000,
            hours: 1,
            multiplier: 1.10
        },

        premium: {
            cost: 25000,
            hours: 3,
            multiplier: 1.25
        },

        global: {
            cost: 100000,
            hours: 6,
            multiplier: 1.50
        }
    };

    const config =
        configs[type];

    if (!config) {
        return error(
            res,
            400,
            "Invalid campaign"
        );
    }

    if (
        Number(player.cash) <
        config.cost
    ) {
        return error(
            res,
            400,
            "Not enough cash"
        );
    }

    await transaction(
        async client => {

            await client.query(
                `UPDATE players
                 SET cash=cash-$1
                 WHERE id=$2`,
                [
                    config.cost,
                    player.id
                ]
            );

            await client.query(
                `INSERT INTO marketing_campaigns
                 (
                    player_id,
                    campaign_type,
                    cost,
                    duration_hours,
                    multiplier,
                    starts_at,
                    ends_at
                 )
                 VALUES
                 (
                    $1,$2,$3,$4,$5,
                    NOW(),
                    NOW()+($4 || ' hours')::interval
                 )`,
                [
                    player.id,
                    type,
                    config.cost,
                    config.hours,
                    config.multiplier
                ]
            );
        }
    );

    return send(
        res,
        200,
        {
            ok: true,
            campaign: config
        }
    );
}

/* =========================================================
   BUSINESS CENTER
========================================================= */

async function businessCenter(
    req,
    res,
    player
) {

    const assets =
        await query(
            `SELECT category,
                    SUM(quantity)::bigint AS quantity
             FROM player_assets
             WHERE player_id=$1
             GROUP BY category`,
            [player.id]
        );

    return send(
        res,
        200,
        {
            ok: true,
            company: {
                name:
                    player.company_name,
                level:
                    Number(player.level),
                cash:
                    Number(player.cash),
                netWorth:
                    Number(player.net_worth)
            },
            assets:
                assets.rows
        }
    );
}

/* =========================================================
   CHALLENGES
========================================================= */

const CHALLENGES = [
    {
        id: "first_million",
        name: "First Million",
        target: 1000000,
        reward: 50000
    },

    {
        id: "ten_million",
        name: "Ten Million",
        target: 10000000,
        reward: 250000
    },

    {
        id: "hundred_million",
        name: "Hundred Million",
        target: 100000000,
        reward: 2000000
    },

    {
        id: "asset_empire",
        name: "Asset Empire",
        target: 100,
        reward: 500000
    }
];

async function challenges(
    req,
    res,
    player
) {

    const output =
        [];

    for (
        const challenge of CHALLENGES
    ) {

        let progress = 0;

        if (
            challenge.id ===
            "first_million"
        ) {
            progress =
                Number(player.net_worth);
        }

        if (
            challenge.id ===
            "ten_million"
        ) {
            progress =
                Number(player.net_worth);
        }

        if (
            challenge.id ===
            "hundred_million"
        ) {
            progress =
                Number(player.net_worth);
        }

        if (
            challenge.id ===
            "asset_empire"
        ) {

            const result =
                await query(
                    `SELECT COALESCE(
                        SUM(quantity),0
                     ) AS total
                     FROM player_assets
                     WHERE player_id=$1`,
                    [player.id]
                );

            progress =
                Number(
                    result.rows[0].total
                );
        }

        const claimed =
            await query(
                `SELECT 1
                 FROM challenge_claims
                 WHERE player_id=$1
                   AND challenge_id=$2`,
                [
                    player.id,
                    challenge.id
                ]
            );

        output.push({
            ...challenge,
            progress,
            completed:
                progress >= challenge.target,
            claimed:
                claimed.rows.length > 0
        });
    }

    return send(
        res,
        200,
        {
            ok: true,
            challenges: output
        }
    );
}

async function claimChallenge(
    req,
    res,
    player,
    body
) {

    const id =
        String(
            body.challengeId ||
            body.id ||
            ""
        );

    const challenge =
        CHALLENGES.find(
            x => x.id === id
        );

    if (!challenge) {
        return error(
            res,
            404,
            "Challenge not found"
        );
    }

    const already =
        await query(
            `SELECT 1
             FROM challenge_claims
             WHERE player_id=$1
               AND challenge_id=$2`,
            [
                player.id,
                id
            ]
        );

    if (already.rows.length) {
        return error(
            res,
            400,
            "Challenge already claimed"
        );
    }

    let progress = 0;

    if (
        id === "first_million" ||
        id === "ten_million" ||
        id === "hundred_million"
    ) {
        progress =
            Number(player.net_worth);
    }

    if (id === "asset_empire") {

        const result =
            await query(
                `SELECT COALESCE(
                    SUM(quantity),0
                 ) AS total
                 FROM player_assets
                 WHERE player_id=$1`,
                [player.id]
            );

        progress =
            Number(result.rows[0].total);
    }

    if (
        progress <
        challenge.target
    ) {
        return error(
            res,
            400,
            "Challenge not completed"
        );
    }

    await transaction(
        async client => {

            await client.query(
                `INSERT INTO challenge_claims
                 (player_id,challenge_id)
                 VALUES ($1,$2)`,
                [
                    player.id,
                    id
                ]
            );

            await client.query(
                `UPDATE players
                 SET cash=cash+$1,
                     xp=xp+500
                 WHERE id=$2`,
                [
                    challenge.reward,
                    player.id
                ]
            );
        }
    );

    return send(
        res,
        200,
        {
            ok: true,
            reward:
                challenge.reward
        }
    );
}

/* =========================================================
   CEO
========================================================= */

const CEO_UPGRADES = [
    {
        id: "leadership",
        name: "Leadership",
        baseCost: 10000
    },

    {
        id: "negotiation",
        name: "Negotiation",
        baseCost: 12000
    },

    {
        id: "management",
        name: "Management",
        baseCost: 15000
    },

    {
        id: "strategy",
        name: "Strategy",
        baseCost: 20000
    },

    {
        id: "innovation",
        name: "Innovation",
        baseCost: 25000
    }
];

async function ceo(
    req,
    res,
    player
) {

    const result =
        await query(
            `SELECT *
             FROM ceo_upgrades
             WHERE player_id=$1`,
            [player.id]
        );

    const levels =
        new Map(
            result.rows.map(
                x => [
                    x.upgrade_id,
                    Number(x.level)
                ]
            )
        );

    return send(
        res,
        200,
        {
            ok: true,
            level:
                Number(player.level),
            upgrades:
                CEO_UPGRADES.map(
                    x => {

                        const level =
                            levels.get(x.id) ||
                            0;

                        return {
                            ...x,
                            level,
                            nextCost:
                                x.baseCost *
                                Math.pow(
                                    2,
                                    level
                                )
                        };
                    }
                )
        }
    );
}

async function upgradeCEO(
    req,
    res,
    player,
    body
) {

    const id =
        String(
            body.upgradeId ||
            body.id ||
            ""
        );

    const upgrade =
        CEO_UPGRADES.find(
            x => x.id === id
        );

    if (!upgrade) {
        return error(
            res,
            404,
            "CEO upgrade not found"
        );
    }

    const existing =
        await query(
            `SELECT level
             FROM ceo_upgrades
             WHERE player_id=$1
               AND upgrade_id=$2`,
            [
                player.id,
                id
            ]
        );

    const level =
        existing.rows.length
            ? Number(existing.rows[0].level)
            : 0;

    const cost =
        upgrade.baseCost *
        Math.pow(
            2,
            level
        );

    if (
        Number(player.cash) <
        cost
    ) {
        return error(
            res,
            400,
            "Not enough cash"
        );
    }

    await transaction(
        async client => {

            await client.query(
                `UPDATE players
                 SET cash=cash-$1
                 WHERE id=$2`,
                [
                    cost,
                    player.id
                ]
            );

            await client.query(
                `INSERT INTO ceo_upgrades
                 (
                    player_id,
                    upgrade_id,
                    level
                 )
                 VALUES ($1,$2,1)
                 ON CONFLICT(player_id,upgrade_id)
                 DO UPDATE SET
                    level =
                    ceo_upgrades.level+1`,
                [
                    player.id,
                    id
                ]
            );
        }
    );

    return send(
        res,
        200,
        {
            ok: true,
            upgrade: id,
            newLevel: level + 1,
            cost
        }
    );
}

/* =========================================================
   COLLECTIONS
========================================================= */

const COLLECTIONS = [
    {
        id: "transport_collection",
        name: "Transport Collection",
        items: [
            "taxi",
            "bus",
            "train",
            "vip_limousines",
            "passenger_plane",
            "cargo_plane"
        ],
        reward: 100000
    },

    {
        id: "business_collection",
        name: "Business Collection",
        items: [
            "pub",
            "dance_club",
            "coffee_shop",
            "restaurant",
            "movie_theater",
            "clothes_shop",
            "supermarket",
            "fast_food"
        ],
        reward: 150000
    },

    {
        id: "world_collection",
        name: "World Collection",
        items: [],
        reward: 250000
    }
];

async function collections(
    req,
    res,
    player
) {

    const output = [];

    for (
        const collection of COLLECTIONS
    ) {

        let completed = true;

        for (
            const itemId
            of collection.items
        ) {

            const result =
                await query(
                    `SELECT quantity
                     FROM player_assets
                     WHERE player_id=$1
                       AND item_id=$2
                       AND quantity>0`,
                    [
                        player.id,
                        itemId
                    ]
                );

            if (!result.rows.length) {
                completed = false;
                break;
            }
        }

        const claimed =
            await query(
                `SELECT 1
                 FROM collection_claims
                 WHERE player_id=$1
                   AND collection_id=$2`,
                [
                    player.id,
                    collection.id
                ]
            );

        output.push({
            ...collection,
            completed,
            claimed:
                claimed.rows.length > 0
        });
    }

    return send(
        res,
        200,
        {
            ok: true,
            collections: output
        }
    );
}

async function claimCollection(
    req,
    res,
    player,
    body
) {

    const id =
        String(
            body.collectionId ||
            body.id ||
            ""
        );

    const collection =
        COLLECTIONS.find(
            x => x.id === id
        );

    if (!collection) {
        return error(
            res,
            404,
            "Collection not found"
        );
    }

    const already =
        await query(
            `SELECT 1
             FROM collection_claims
             WHERE player_id=$1
               AND collection_id=$2`,
            [
                player.id,
                id
            ]
        );

    if (already.rows.length) {
        return error(
            res,
            400,
            "Collection already claimed"
        );
    }

    for (
        const itemId
        of collection.items
    ) {

        const result =
            await query(
                `SELECT quantity
                 FROM player_assets
                 WHERE player_id=$1
                   AND item_id=$2
                   AND quantity>0`,
                [
                    player.id,
                    itemId
                ]
            );

        if (!result.rows.length) {
            return error(
                res,
                400,
                "Collection incomplete"
            );
        }
    }

    await transaction(
        async client => {

            await client.query(
                `INSERT INTO collection_claims
                 (player_id,collection_id)
                 VALUES ($1,$2)`,
                [
                    player.id,
                    id
                ]
            );

            await client.query(
                `UPDATE players
                 SET cash=cash+$1,
                     xp=xp+1000
                 WHERE id=$2`,
                [
                    collection.reward,
                    player.id
                ]
            );
        }
    );

    return send(
        res,
        200,
        {
            ok: true,
            reward:
                collection.reward
        }
    );
}

/* =========================================================
   SPECIAL ITEMS
========================================================= */

async function specialItems(
    req,
    res,
    player
) {

    const result =
        await query(
            `SELECT
                si.id,
                si.name,
                si.price,
                COALESCE(
                    psi.quantity,
                    0
                ) AS quantity
             FROM special_items si
             LEFT JOIN player_special_items psi
               ON psi.item_id=si.id
              AND psi.player_id=$1`,
            [player.id]
        );

    return send(
        res,
        200,
        {
            ok: true,
            items:
                result.rows.map(
                    x => ({
                        id: x.id,
                        name: x.name,
                        price:
                            Number(x.price),
                        quantity:
                            Number(x.quantity)
                    })
                )
        }
    );
}

async function buySpecialItem(
    req,
    res,
    player,
    body
) {

    const id =
        String(
            body.itemId ||
            body.id ||
            ""
        );

    const result =
        await query(
            `SELECT *
             FROM special_items
             WHERE id=$1`,
            [id]
        );

    if (!result.rows.length) {
        return error(
            res,
            404,
            "Special item not found"
        );
    }

    const itemData =
        result.rows[0];

    if (
        Number(player.gold_coins) <
        Number(itemData.price)
    ) {
        return error(
            res,
            400,
            "Not enough gold coins"
        );
    }

    await transaction(
        async client => {

            await client.query(
                `UPDATE players
                 SET gold_coins=
                     gold_coins-$1
                 WHERE id=$2`,
                [
                    itemData.price,
                    player.id
                ]
            );

            await client.query(
                `INSERT INTO player_special_items
                 (player_id,item_id,quantity)
                 VALUES ($1,$2,1)
                 ON CONFLICT(player_id,item_id)
                 DO UPDATE SET
                    quantity =
                    player_special_items.quantity+1`,
                [
                    player.id,
                    id
                ]
            );
        }
    );

    return send(
        res,
        200,
        {
            ok: true,
            item: itemData
        }
    );
}

/* =========================================================
   STOCK MARKET
========================================================= */

async function currentStockPrice(
    stockId
) {

    const result =
        await query(
            `SELECT price
             FROM stock_prices
             WHERE stock_id=$1`,
            [stockId]
        );

    if (result.rows.length) {
        return Number(
            result.rows[0].price
        );
    }

    const stock =
        STOCK_MARKET.find(
            x => x.id === stockId
        );

    if (
        stock &&
        stock.price != null
    ) {
        await query(
            `INSERT INTO stock_prices
             (stock_id,price)
             VALUES ($1,$2)
             ON CONFLICT DO NOTHING`,
            [
                stockId,
                stock.price
            ]
        );

        return Number(
            stock.price
        );
    }

    return null;
}

async function stockMarket(
    req,
    res,
    player
) {

    const output = [];

    for (
        const stock
        of STOCK_MARKET
    ) {

        const price =
            await currentStockPrice(
                stock.id
            );

        const position =
            await query(
                `SELECT *
                 FROM stock_positions
                 WHERE player_id=$1
                   AND stock_id=$2`,
                [
                    player.id,
                    stock.id
                ]
            );

        output.push({
            ...stock,
            price,
            quantity:
                position.rows.length
                    ? Number(
                        position.rows[0].quantity
                    )
                    : 0
        });
    }

    return send(
        res,
        200,
        {
            ok: true,
            stocks: output
        }
    );
}

async function buyStock(
    req,
    res,
    player,
    body
) {

    const stockId =
        String(
            body.stockId ||
            body.id ||
            ""
        );

    const quantity =
        Math.max(
            1,
            Math.floor(
                Number(
                    body.quantity || 1
                )
            )
        );

    const stock =
        STOCK_MARKET.find(
            x => x.id === stockId
        );

    if (!stock) {
        return error(
            res,
            404,
            "Stock not found"
        );
    }

    const price =
        await currentStockPrice(
            stockId
        );

    if (price == null) {
        return error(
            res,
            400,
            "Stock price unavailable"
        );
    }

    const total =
        price * quantity;

    if (
        Number(player.cash) <
        total
    ) {
        return error(
            res,
            400,
            "Not enough cash"
        );
    }

    await transaction(
        async client => {

            await client.query(
                `UPDATE players
                 SET cash=cash-$1
                 WHERE id=$2`,
                [
                    total,
                    player.id
                ]
            );

            await client.query(
                `INSERT INTO stock_positions
                 (
                    player_id,
                    stock_id,
                    quantity,
                    average_price
                 )
                 VALUES ($1,$2,$3,$4)
                 ON CONFLICT(player_id,stock_id)
                 DO UPDATE SET
                    average_price =
                    (
                        (
                            stock_positions.average_price *
                            stock_positions.quantity
                        ) +
                        (
                            EXCLUDED.average_price *
                            EXCLUDED.quantity
                        )
                    ) /
                    (
                        stock_positions.quantity +
                        EXCLUDED.quantity
                    ),
                    quantity =
                    stock_positions.quantity +
                    EXCLUDED.quantity`,
                [
                    player.id,
                    stockId,
                    quantity,
                    price
                ]
            );
        }
    );

    return send(
        res,
        200,
        {
            ok: true,
            stockId,
            quantity,
            price,
            total
        }
    );
}

async function sellStock(
    req,
    res,
    player,
    body
) {

    const stockId =
        String(
            body.stockId ||
            body.id ||
            ""
        );

    const quantity =
        Math.max(
            1,
            Math.floor(
                Number(
                    body.quantity || 1
                )
            )
        );

    const position =
        await query(
            `SELECT *
             FROM stock_positions
             WHERE player_id=$1
               AND stock_id=$2`,
            [
                player.id,
                stockId
            ]
        );

    if (!position.rows.length) {
        return error(
            res,
            400,
            "No stock owned"
        );
    }

    if (
        Number(position.rows[0].quantity) <
        quantity
    ) {
        return error(
            res,
            400,
            "Not enough stock"
        );
    }

    const price =
        await currentStockPrice(
            stockId
        );

    const total =
        Number(price) *
        quantity;

    await transaction(
        async client => {

            await client.query(
                `UPDATE stock_positions
                 SET quantity=quantity-$1
                 WHERE player_id=$2
                   AND stock_id=$3`,
                [
                    quantity,
                    player.id,
                    stockId
                ]
            );

            await client.query(
                `UPDATE players
                 SET cash=cash+$1
                 WHERE id=$2`,
                [
                    total,
                    player.id
                ]
            );
        }
    );

    return send(
        res,
        200,
        {
            ok: true,
            stockId,
            quantity,
            price,
            received: total
        }
    );
}

/* =========================================================
   PRODUCTION
========================================================= */

async function production(
    req,
    res,
    player
) {

    const orders =
        await query(
            `SELECT *
             FROM production_orders
             WHERE player_id=$1
             ORDER BY completes_at`,
            [player.id]
        );

    return send(
        res,
        200,
        {
            ok: true,

            productionTech:
                Number(player.production_tech),

            technology:
                PRODUCTION_TECH,

            orders:
                orders.rows
        }
    );
}

async function productionOrder(
    req,
    res,
    player,
    body
) {

    const productId =
        String(
            body.productId ||
            body.itemId ||
            ""
        );

    const quantity =
        Math.max(
            1,
            Math.floor(
                Number(
                    body.quantity || 1
                )
            )
        );

    const product =
        PRODUCTION_TECH.find(
            x => x.id === productId
        );

    if (!product) {
        return error(
            res,
            404,
            "Production product not found"
        );
    }

    if (
        Number(player.production_tech) <
        Number(product.productionTech)
    ) {
        return error(
            res,
            403,
            `Require production tech level ${product.productionTech}`
        );
    }

    if (product.price == null) {
        return error(
            res,
            400,
            "Product price unavailable"
        );
    }

    const cost =
        Number(product.price) *
        quantity;

    if (
        Number(player.cash) <
        cost
    ) {
        return error(
            res,
            400,
            "Not enough cash"
        );
    }

    const minutes =
        Math.max(
            1,
            Math.ceil(
                quantity * 2
            )
        );

    await transaction(
        async client => {

            await client.query(
                `UPDATE players
                 SET cash=cash-$1
                 WHERE id=$2`,
                [
                    cost,
                    player.id
                ]
            );

            await client.query(
                `INSERT INTO production_orders
                 (
                    player_id,
                    product_id,
                    quantity,
                    cost,
                    completes_at
                 )
                 VALUES
                 (
                    $1,$2,$3,$4,
                    NOW()+($5 || ' minutes')::interval
                 )`,
                [
                    player.id,
                    productId,
                    quantity,
                    cost,
                    minutes
                ]
            );
        }
    );

    return send(
        res,
        200,
        {
            ok: true,
            product,
            quantity,
            cost,
            minutes
        }
    );
}

/* =========================================================
   COMPLETE PRODUCTION
========================================================= */

async function completeProduction(
    req,
    res,
    player,
    body
) {

    const orderId =
        Number(
            body.orderId ||
            body.id
        );

    const result =
        await query(
            `SELECT *
             FROM production_orders
             WHERE id=$1
               AND player_id=$2
               AND completed=FALSE
               AND completes_at<=NOW()`,
            [
                orderId,
                player.id
            ]
        );

    if (!result.rows.length) {
        return error(
            res,
            400,
            "Production order is not ready"
        );
    }

    const order =
        result.rows[0];

    await transaction(
        async client => {

            await client.query(
                `UPDATE production_orders
                 SET completed=TRUE
                 WHERE id=$1`,
                [orderId]
            );

            await client.query(
                `INSERT INTO player_assets
                 (
                    player_id,
                    item_id,
                    category,
                    quantity
                 )
                 VALUES ($1,$2,'product',$3)
                 ON CONFLICT
                    (player_id,item_id,category)
                 DO UPDATE SET
                    quantity =
                    player_assets.quantity+
                    EXCLUDED.quantity,
                    updated_at=NOW()`,
                [
                    player.id,
                    order.product_id,
                    order.quantity
                ]
            );
        }
    );

    return send(
        res,
        200,
        {
            ok: true,
            orderId
        }
    );
}

/* =========================================================
   SPACE
========================================================= */

async function space(
    req,
    res,
    player
) {

    const result =
        await query(
            `SELECT *
             FROM space_program
             WHERE player_id=$1`,
            [player.id]
        );

    if (!result.rows.length) {

        await query(
            `INSERT INTO space_program
             (player_id)
             VALUES ($1)
             ON CONFLICT DO NOTHING`,
            [player.id]
        );
    }

    const current =
        await query(
            `SELECT *
             FROM space_program
             WHERE player_id=$1`,
            [player.id]
        );

    return send(
        res,
        200,
        {
            ok: true,
            space:
                current.rows[0]
        }
    );
}

async function upgradeSpace(
    req,
    res,
    player
) {

    const result =
        await query(
            `SELECT *
             FROM space_program
             WHERE player_id=$1`,
            [player.id]
        );

    const current =
        result.rows[0] || {
            level: 0
        };

    const level =
        Number(current.level);

    const cost =
        100000 *
        Math.pow(
            5,
            level
        );

    if (
        Number(player.cash) <
        cost
    ) {
        return error(
            res,
            400,
            "Not enough cash",
            { cost }
        );
    }

    await transaction(
        async client => {

            await client.query(
                `UPDATE players
                 SET cash=cash-$1
                 WHERE id=$2`,
                [
                    cost,
                    player.id
                ]
            );

            await client.query(
                `INSERT INTO space_program
                 (
                    player_id,
                    level
                 )
                 VALUES ($1,1)
                 ON CONFLICT(player_id)
                 DO UPDATE SET
                    level =
                    space_program.level+1,
                    updated_at=NOW()`,
                [
                    player.id
                ]
            );
        }
    );

    return send(
        res,
        200,
        {
            ok: true,
            level: level + 1,
            cost
        }
    );
}

/* =========================================================
   CONGRESS
========================================================= */

async function congress(
    req,
    res,
    player
) {

    const result =
        await query(
            `SELECT
                r.*,
                COUNT(v.player_id)::int
                    AS votes
             FROM congress_resolutions r
             LEFT JOIN congress_votes v
               ON v.resolution_id=r.id
             WHERE r.active=TRUE
             GROUP BY r.id
             ORDER BY r.created_at DESC`
        );

    return send(
        res,
        200,
        {
            ok: true,
            resolutions:
                result.rows.map(
                    x => ({
                        id: Number(x.id),
                        title: x.title,
                        description:
                            x.description,
                        yesVotes:
                            Number(x.yes_votes),
                        noVotes:
                            Number(x.no_votes),
                        votes:
                            Number(x.votes),
                        active:
                            x.active
                    })
                )
        }
    );
}

async function createResolution(
    req,
    res,
    player,
    body
) {

    if (
        Number(player.level) <
        10
    ) {
        return error(
            res,
            403,
            "Require level 10"
        );
    }

    const title =
        String(
            body.title ||
            ""
        ).trim();

    const description =
        String(
            body.description ||
            ""
        ).trim();

    if (!title) {
        return error(
            res,
            400,
            "Title required"
        );
    }

    const result =
        await query(
            `INSERT INTO congress_resolutions
             (
                creator_id,
                title,
                description
             )
             VALUES ($1,$2,$3)
             RETURNING *`,
            [
                player.id,
                title,
                description
            ]
        );

    return send(
        res,
        201,
        {
            ok: true,
            resolution:
                result.rows[0]
        }
    );
}

async function voteCongress(
    req,
    res,
    player,
    body
) {

    const resolutionId =
        Number(
            body.resolutionId ||
            body.id
        );

    const vote =
        Boolean(body.vote);

    const result =
        await query(
            `SELECT *
             FROM congress_resolutions
             WHERE id=$1
               AND active=TRUE`,
            [resolutionId]
        );

    if (!result.rows.length) {
        return error(
            res,
            404,
            "Resolution not found"
        );
    }

    const existing =
        await query(
            `SELECT 1
             FROM congress_votes
             WHERE resolution_id=$1
               AND player_id=$2`,
            [
                resolutionId,
                player.id
            ]
        );

    if (existing.rows.length) {
        return error(
            res,
            400,
            "Already voted"
        );
    }

    await transaction(
        async client => {

            await client.query(
                `INSERT INTO congress_votes
                 (
                    resolution_id,
                    player_id,
                    vote
                 )
                 VALUES ($1,$2,$3)`,
                [
                    resolutionId,
                    player.id,
                    vote
                ]
            );

            if (vote) {

                await client.query(
                    `UPDATE congress_resolutions
                     SET yes_votes=yes_votes+1
                     WHERE id=$1`,
                    [resolutionId]
                );

            } else {

                await client.query(
                    `UPDATE congress_resolutions
                     SET no_votes=no_votes+1
                     WHERE id=$1`,
                    [resolutionId]
                );
            }
        }
    );

    return send(
        res,
        200,
        {
            ok: true,
            vote
        }
    );
}

/* =========================================================
   MISSIONS
========================================================= */

const MISSIONS = [
    {
        id: "business_challenge",
        name: "5 answers Business Challenge",
        target: 5,
        reward: 2
    },

    {
        id: "trade_challenges",
        name: 'Complete 2 "trade challenges"',
        target: 2,
        reward: 2
    },

    {
        id: "daily_trades",
        name: "Complete 5 daily trades",
        target: 5,
        reward: 2
    },

    {
        id: "join_alliance",
        name: "Join an alliance",
        target: 1,
        reward: 2
    },

    {
        id: "upgrade",
        name: "Perform an upgrade",
        target: 1,
        reward: 2
    },

    {
        id: "private_messages",
        name: "Send 5 private messages",
        target: 5,
        reward: 2
    },

    {
        id: "mine_diamonds",
        name: "Mine 400 Diamonds",
        target: 400,
        reward: 2
    }
];

async function missions(
    req,
    res,
    player
) {

    const result = [];

    for (
        const mission
        of MISSIONS
    ) {

        const row =
            await query(
                `SELECT *
                 FROM missions
                 WHERE player_id=$1
                   AND mission_id=$2`,
                [
                    player.id,
                    mission.id
                ]
            );

        if (!row.rows.length) {

            await query(
                `INSERT INTO missions
                 (
                    player_id,
                    mission_id,
                    progress,
                    target
                 )
                 VALUES ($1,$2,0,$3)
                 ON CONFLICT DO NOTHING`,
                [
                    player.id,
                    mission.id,
                    mission.target
                ]
            );
        }

        const current =
            await query(
                `SELECT *
                 FROM missions
                 WHERE player_id=$1
                   AND mission_id=$2`,
                [
                    player.id,
                    mission.id
                ]
            );

        const data =
            current.rows[0];

        result.push({
            ...mission,
            progress:
                Number(data.progress),
            completed:
                Number(data.progress) >=
                Number(data.target),
            claimed:
                Boolean(data.claimed)
        });
    }

    return send(
        res,
        200,
        {
            ok: true,
            missions: result
        }
    );
}

/* =========================================================
   HEALTH
========================================================= */

async function health(
    req,
    res
) {

    try {

        await query(
            "SELECT 1"
        );

        return send(
            res,
            200,
            {
                ok: true,
                version: VERSION,
                database: "connected",
                service:
                    "Tycoon Empire Multiplayer Server",
                catalog:
                    "REFERENCE-PDF-1.0"
            }
        );

    } catch (err) {

        return send(
            res,
            503,
            {
                ok: false,
                version: VERSION,
                database: "error",
                message:
                    err.message
            }
        );
    }
}

/* =========================================================
   REQUEST ROUTER
========================================================= */

async function router(
    req,
    res
) {

    if (
        req.method ===
        "OPTIONS"
    ) {

        res.writeHead(
            204,
            {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers":
                    "Content-Type, Authorization",
                "Access-Control-Allow-Methods":
                    "GET, POST, PUT, DELETE, OPTIONS"
            }
        );

        res.end();

        return;
    }

    const parsed =
        new URL(
            req.url,
            `http://${req.headers.host || "localhost"}`
        );

    const path =
        parsed.pathname;

    req.query =
        parsed.searchParams;

    let body = {};

    if (
        req.method === "POST" ||
        req.method === "PUT"
    ) {

        try {
            body =
                await readBody(req);
        } catch (err) {
            return error(
                res,
                400,
                err.message
            );
        }
    }

    try {

        /* -------------------------------------------------
           HEALTH
        ------------------------------------------------- */

        if (
            req.method === "GET" &&
            path === "/health"
        ) {
            return health(
                req,
                res
            );
        }

        /* -------------------------------------------------
           ROOT
        ------------------------------------------------- */

        if (
            req.method === "GET" &&
            path === "/"
        ) {
            return send(
                res,
                200,
                {
                    ok: true,
                    service:
                        "Tycoon Empire Multiplayer",
                    version: VERSION,
                    database:
                        "PostgreSQL",
                    catalog:
                        "REFERENCE-PDF-1.0"
                }
            );
        }

        /* -------------------------------------------------
           REGISTER
        ------------------------------------------------- */

        if (
            req.method === "POST" &&
            path === "/api/auth/register"
        ) {
            return register(
                req,
                res,
                body
            );
        }

        /* -------------------------------------------------
           LOGIN
        ------------------------------------------------- */

        if (
            req.method === "POST" &&
            path === "/api/auth/login"
        ) {
            return login(
                req,
                res,
                body
            );
        }

        /* -------------------------------------------------
           AUTHENTICATED ROUTES
        ------------------------------------------------- */

        const player =
            await authenticate(req);

        /*
         * Public ranking endpoint.
         */
        if (
            req.method === "GET" &&
            (
                path === "/api/rankings" ||
                path === "/api/rankings/global"
            )
        ) {
            return rankings(
                req,
                res
            );
        }

        /*
         * Everything below this point requires login.
         */
        if (!player) {
            return error(
                res,
                401,
                "Authentication required"
            );
        }

        await processIncome(
            player.id
        );

        await updateLevel(
            player.id
        );

        /* -------------------------------------------------
           PLAYER
        ------------------------------------------------- */

        if (
            req.method === "GET" &&
            path === "/api/players/me"
        ) {

            return send(
                res,
                200,
                {
                    ok: true,
                    player:
                        await playerSummary(
                            player.id
                        )
                }
            );
        }

        /* -------------------------------------------------
           REFERENCE CATALOG
        ------------------------------------------------- */

        if (
            req.method === "GET" &&
            path === "/api/reference/catalog"
        ) {

            return send(
                res,
                200,
                {
                    ok: true,
                    version:
                        "REFERENCE-PDF-1.0",

                    categories: {
                        businesses:
                            BUSINESSES,
                        transportation:
                            TRANSPORTATION,
                        concessions:
                            CONCESSIONS,
                        resources:
                            RESOURCES,
                        subsidiaries:
                            SUBSIDIARIES,
                        research:
                            RESEARCH,
                        productionTech:
                            PRODUCTION_TECH,
                        products:
                            PRODUCTS,
                        properties:
                            PROPERTIES,
                        stockMarket:
                            STOCK_MARKET,
                        megaProjects:
                            MEGA_PROJECTS
                    },

                    levels:
                        LEVELS
                }
            );
        }

        if (
            req.method === "GET" &&
            path === "/api/reference/catalog/player"
        ) {

            const owned =
                await query(
                    `SELECT concession_id
                     FROM player_concessions
                     WHERE player_id=$1`,
                    [player.id]
                );

            return send(
                res,
                200,
                {
                    ok: true,
                    version:
                        "REFERENCE-PDF-1.0",
                    items:
                        catalogForPlayer(
                            player,
                            owned.rows
                        )
                }
            );
        }

        if (
            req.method === "GET" &&
            path.startsWith(
                "/api/reference/catalog/item/"
            )
        ) {

            const id =
                decodeURIComponent(
                    path.substring(
                        "/api/reference/catalog/item/"
                            .length
                    )
                );

            const found =
                catalogById(id);

            if (!found) {
                return error(
                    res,
                    404,
                    "Item not found"
                );
            }

            return send(
                res,
                200,
                {
                    ok: true,
                    item: found
                }
            );
        }

        /* -------------------------------------------------
           ASSETS
        ------------------------------------------------- */

        if (
            req.method === "GET" &&
            path === "/api/assets"
        ) {
            return assets(
                req,
                res,
                player
            );
        }

        if (
            req.method === "POST" &&
            path === "/api/assets/buy"
        ) {
            return buyAsset(
                req,
                res,
                player,
                body
            );
        }

        if (
            req.method === "POST" &&
            path === "/api/assets/sell"
        ) {
            return sellAsset(
                req,
                res,
                player,
                body
            );
        }

        /* -------------------------------------------------
           BUSINESSES
        ------------------------------------------------- */

        if (
            req.method === "GET" &&
            path === "/api/businesses"
        ) {

            return assets(
                {
                    ...req,
                    query:
                        new URLSearchParams(
                            "category=business"
                        )
                },
                res,
                player
            );
        }

        /* -------------------------------------------------
           TRANSPORTATION
        ------------------------------------------------- */

        if (
            req.method === "GET" &&
            path === "/api/transportation"
        ) {

            return assets(
                {
                    ...req,
                    query:
                        new URLSearchParams(
                            "category=transportation"
                        )
                },
                res,
                player
            );
        }

        /* -------------------------------------------------
           CONCESSIONS
        ------------------------------------------------- */

        if (
            req.method === "GET" &&
            path === "/api/concessions"
        ) {
            return concessions(
                req,
                res,
                player
            );
        }

        if (
            req.method === "POST" &&
            (
                path ===
                "/api/concessions/buy" ||
                path ===
                "/api/concessions/purchase"
            )
        ) {

            return buyConcession(
                req,
                res,
                player,
                body
            );
        }

        /* -------------------------------------------------
           RESOURCES
        ------------------------------------------------- */

        if (
            req.method === "GET" &&
            path === "/api/resources"
        ) {

            return assets(
                {
                    ...req,
                    query:
                        new URLSearchParams(
                            "category=resource"
                        )
                },
                res,
                player
            );
        }

        /* -------------------------------------------------
           SUBSIDIARIES
        ------------------------------------------------- */

        if (
            req.method === "GET" &&
            path === "/api/subsidiaries"
        ) {

            return assets(
                {
                    ...req,
                    query:
                        new URLSearchParams(
                            "category=subsidiary"
                        )
                },
                res,
                player
            );
        }

        /* -------------------------------------------------
           RESEARCH
        ------------------------------------------------- */

        if (
            req.method === "GET" &&
            path === "/api/research"
        ) {
            return research(
                req,
                res,
                player
            );
        }

        if (
            req.method === "POST" &&
            path === "/api/research/buy"
        ) {
            return buyResearch(
                req,
                res,
                player,
                body
            );
        }

        /* -------------------------------------------------
           WORLD
        ------------------------------------------------- */

        if (
            req.method === "GET" &&
            path === "/api/world/sites"
        ) {
            return worldSites(
                req,
                res,
                player
            );
        }

        if (
            req.method === "POST" &&
            path === "/api/world/sites/claim"
        ) {
            return claimWorldSite(
                req,
                res,
                player,
                body
            );
        }

        /* -------------------------------------------------
           ARMY
        ------------------------------------------------- */

        if (
            req.method === "GET" &&
            path === "/api/army"
        ) {
            return army(
                req,
                res,
                player
            );
        }

        if (
            req.method === "POST" &&
            (
                path ===
                "/api/army/upgrade" ||
                path ===
                "/api/army/update"
            )
        ) {
            return armyUpgrade(
                req,
                res,
                player,
                body
            );
        }

        /* -------------------------------------------------
           WARS
        ------------------------------------------------- */

        if (
            req.method === "POST" &&
            path === "/api/wars"
        ) {
            return createWar(
                req,
                res,
                player,
                body
            );
        }

        /* -------------------------------------------------
           CONTRACTS
        ------------------------------------------------- */

        if (
            req.method === "GET" &&
            path === "/api/contracts"
        ) {
            return contracts(
                req,
                res
            );
        }

        if (
            req.method === "GET" &&
            path === "/api/contracts/running"
        ) {
            return runningContracts(
                req,
                res,
                player
            );
        }

        if (
            req.method === "POST" &&
            (
                path ===
                "/api/contracts/bid" ||
                path ===
                "/api/contracts/bids"
            )
        ) {
            return placeBid(
                req,
                res,
                player,
                body
            );
        }

        if (
            req.method === "GET" &&
            path ===
                "/api/contracts/bids/ranking"
        ) {
            return contractRanking(
                req,
                res
            );
        }

        /* -------------------------------------------------
           ALLIANCES
        ------------------------------------------------- */

        if (
            req.method === "GET" &&
            path === "/api/alliances"
        ) {
            return alliances(
                req,
                res,
                player
            );
        }

        if (
            req.method === "POST" &&
            (
                path ===
                "/api/alliances" ||
                path ===
                "/api/alliances/create"
            )
        ) {
            return createAlliance(
                req,
                res,
                player,
                body
            );
        }

        if (
            req.method === "POST" &&
            path ===
                "/api/alliances/join"
        ) {
            return joinAlliance(
                req,
                res,
                player,
                body
            );
        }

        /* -------------------------------------------------
           CHAT
        ------------------------------------------------- */

        if (
            req.method === "GET" &&
            path === "/api/chat"
        ) {
            return getChat(
                req,
                res
            );
        }

        if (
            req.method === "POST" &&
            path === "/api/chat"
        ) {
            return sendChat(
                req,
                res,
                player,
                body
            );
        }

        /* -------------------------------------------------
           LOANS
        ------------------------------------------------- */

        if (
            req.method === "GET" &&
            path === "/api/loans"
        ) {
            return loans(
                req,
                res,
                player
            );
        }

        if (
            req.method === "POST" &&
            (
                path ===
                "/api/loans/take" ||
                path ===
                "/api/loans"
            )
        ) {
            return takeLoan(
                req,
                res,
                player,
                body
            );
        }

        /* -------------------------------------------------
           COUNTRY RELATIONS
        ------------------------------------------------- */

        if (
            req.method === "GET" &&
            path ===
                "/api/country-relations"
        ) {
            return countryRelations(
                req,
                res,
                player
            );
        }

        if (
            req.method === "POST" &&
            path ===
                "/api/country-relations/improve"
        ) {
            return improveCountryRelation(
                req,
                res,
                player,
                body
            );
        }

        /* -------------------------------------------------
           MARKETING
        ------------------------------------------------- */

        if (
            req.method === "GET" &&
            path === "/api/marketing"
        ) {
            return marketing(
                req,
                res,
                player
            );
        }

        if (
            req.method === "POST" &&
            path ===
                "/api/marketing/campaign"
        ) {
            return createMarketingCampaign(
                req,
                res,
                player,
                body
            );
        }

        /* -------------------------------------------------
           BUSINESS CENTER
        ------------------------------------------------- */

        if (
            req.method === "GET" &&
            path ===
                "/api/business-center"
        ) {
            return businessCenter(
                req,
                res,
                player
            );
        }

        /* -------------------------------------------------
           CHALLENGES
        ------------------------------------------------- */

        if (
            req.method === "GET" &&
            path === "/api/challenges"
        ) {
            return challenges(
                req,
                res,
                player
            );
        }

        if (
            req.method === "POST" &&
            path ===
                "/api/challenges/claim"
        ) {
            return claimChallenge(
                req,
                res,
                player,
                body
            );
        }

        /* -------------------------------------------------
           CEO
        ------------------------------------------------- */

        if (
            req.method === "GET" &&
            path === "/api/ceo"
        ) {
            return ceo(
                req,
                res,
                player
            );
        }

        if (
            req.method === "POST" &&
            path ===
                "/api/ceo/upgrade"
        ) {
            return upgradeCEO(
                req,
                res,
                player,
                body
            );
        }

        /* -------------------------------------------------
           COLLECTIONS
        ------------------------------------------------- */

        if (
            req.method === "GET" &&
            path === "/api/collections"
        ) {
            return collections(
                req,
                res,
                player
            );
        }

        if (
            req.method === "POST" &&
            path ===
                "/api/collections/claim"
        ) {
            return claimCollection(
                req,
                res,
                player,
                body
            );
        }

        /* -------------------------------------------------
           SPECIAL ITEMS
        ------------------------------------------------- */

        if (
            req.method === "GET" &&
            path ===
                "/api/special-items"
        ) {
            return specialItems(
                req,
                res,
                player
            );
        }

        if (
            req.method === "POST" &&
            path ===
                "/api/special-items/buy"
        ) {
            return buySpecialItem(
                req,
                res,
                player,
                body
            );
        }

        /* -------------------------------------------------
           STOCK MARKET
        ------------------------------------------------- */

        if (
            req.method === "GET" &&
            path ===
                "/api/stock-market"
        ) {
            return stockMarket(
                req,
                res,
                player
            );
        }

        if (
            req.method === "POST" &&
            path ===
                "/api/stock-market/buy"
        ) {
            return buyStock(
                req,
                res,
                player,
                body
            );
        }

        if (
            req.method === "POST" &&
            path ===
                "/api/stock-market/sell"
        ) {
            return sellStock(
                req,
                res,
                player,
                body
            );
        }

        /* -------------------------------------------------
           PRODUCTION
        ------------------------------------------------- */

        if (
            req.method === "GET" &&
            path === "/api/production"
        ) {
            return production(
                req,
                res,
                player
            );
        }

        if (
            req.method === "POST" &&
            path ===
                "/api/production/order"
        ) {
            return productionOrder(
                req,
                res,
                player,
                body
            );
        }

        if (
            req.method === "POST" &&
            path ===
                "/api/production/complete"
        ) {
            return completeProduction(
                req,
                res,
                player,
                body
            );
        }

        /* -------------------------------------------------
           SPACE
        ------------------------------------------------- */

        if (
            req.method === "GET" &&
            path === "/api/space"
        ) {
            return space(
                req,
                res,
                player
            );
        }

        if (
            req.method === "POST" &&
            path ===
                "/api/space/upgrade"
        ) {
            return upgradeSpace(
                req,
                res,
                player
            );
        }

        /* -------------------------------------------------
           CONGRESS
        ------------------------------------------------- */

        if (
            req.method === "GET" &&
            path === "/api/congress"
        ) {
            return congress(
                req,
                res,
                player
            );
        }

        if (
            req.method === "POST" &&
            path ===
                "/api/congress/create"
        ) {
            return createResolution(
                req,
                res,
                player,
                body
            );
        }

        if (
            req.method === "POST" &&
            path ===
                "/api/congress/vote"
        ) {
            return voteCongress(
                req,
                res,
                player,
                body
            );
        }

        /* -------------------------------------------------
           MISSIONS
        ------------------------------------------------- */

        if (
            req.method === "GET" &&
            path === "/api/missions"
        ) {
            return missions(
                req,
                res,
                player
            );
        }

        /* -------------------------------------------------
           404
        ------------------------------------------------- */

        return error(
            res,
            404,
            "Endpoint not found"
        );

    } catch (err) {

        console.error(
            "REQUEST ERROR:",
            err
        );

        return error(
            res,
            500,
            "Internal server error",
            {
                detail:
                    process.env.NODE_ENV ===
                    "development"
                        ? err.message
                        : undefined
            }
        );
    }
}

/* =========================================================
   SERVER
========================================================= */

const server =
    http.createServer(
        router
    );

async function start() {

    try {

        await initDatabase();

        server.listen(
            PORT,
            "0.0.0.0",
            () => {

                console.log(
                    "========================================"
                );

                console.log(
                    " TYCOON EMPIRE SERVER"
                );

                console.log(
                    ` Version: ${VERSION}`
                );

                console.log(
                    ` Port: ${PORT}`
                );

                console.log(
                    " Database: PostgreSQL"
                );

                console.log(
                    " Catalog: REFERENCE-PDF-1.0"
                );

                console.log(
                    "========================================"
                );
            }
        );

    } catch (err) {

        console.error(
            "SERVER START FAILED:"
        );

        console.error(err);

        process.exit(1);
    }
}

process.on(
    "SIGTERM",
    async () => {

        console.log(
            "SIGTERM received."
        );

        await pool.end();

        server.close(
            () => process.exit(0)
        );
    }
);

process.on(
    "SIGINT",
    async () => {

        console.log(
            "SIGINT received."
        );

        await pool.end();

        server.close(
            () => process.exit(0)
        );
    }
);

start();
