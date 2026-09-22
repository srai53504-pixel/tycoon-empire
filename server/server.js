'use strict';

const http = require('http');
const crypto = require('crypto');
const { Pool } = require('pg');

const PORT = Number(process.env.PORT || 8080);
const VERSION = '2.2.1';

if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is missing.');
    process.exit(1);
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
});

/* =========================================================
   BASIC HELPERS
========================================================= */

function now() {
    return new Date();
}

function id() {
    return crypto.randomUUID();
}

function hashPassword(password) {
    return crypto
        .createHash('sha256')
        .update(String(password))
        .digest('hex');
}

function token() {
    return crypto.randomBytes(48).toString('hex');
}

function json(res, status, data) {
    const out = JSON.stringify(data);

    res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(out),
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
    });

    res.end(out);
}

function error(res, status, message, extra = {}) {
    return json(res, status, {
        success: false,
        error: message,
        ...extra
    });
}

async function body(req) {
    return new Promise((resolve, reject) => {
        let data = '';

        req.on('data', chunk => {
            data += chunk;

            if (data.length > 2 * 1024 * 1024) {
                reject(new Error('Request too large'));
                req.destroy();
            }
        });

        req.on('end', () => {
            if (!data) {
                resolve({});
                return;
            }

            try {
                resolve(JSON.parse(data));
            } catch {
                resolve({});
            }
        });

        req.on('error', reject);
    });
}

async function query(text, params = []) {
    return pool.query(text, params);
}

async function transaction(callback) {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
}

function authHeader(req) {
    const h = req.headers.authorization || '';

    if (!h.startsWith('Bearer ')) {
        return '';
    }

    return h.substring(7).trim();
}

async function authPlayer(req) {
    const t = authHeader(req);

    if (!t) {
        return null;
    }

    const result = await query(
        `
        SELECT p.*
        FROM sessions s
        JOIN players p ON p.id = s.player_id
        WHERE s.token = $1
          AND (s.expires_at IS NULL OR s.expires_at > NOW())
        LIMIT 1
        `,
        [t]
    );

    if (!result.rows.length) {
        return null;
    }

    return result.rows[0];
}

function requirePlayer(req, res) {
    return authPlayer(req).then(player => {
        if (!player) {
            error(res, 401, 'Authentication required');
            return null;
        }

        return player;
    });
}

function num(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function money(value) {
    return Math.round(num(value));
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function safeName(value, fallback = 'Player') {
    const s = String(value || '').trim();

    if (!s) return fallback;

    return s.substring(0, 50);
}

/* =========================================================
   CATALOG
========================================================= */

const COUNTRIES = [
    { id: 'india', name: 'India', bonus: 1.00 },
    { id: 'usa', name: 'United States', bonus: 1.02 },
    { id: 'uk', name: 'United Kingdom', bonus: 1.01 },
    { id: 'germany', name: 'Germany', bonus: 1.03 },
    { id: 'japan', name: 'Japan', bonus: 1.04 },
    { id: 'china', name: 'China', bonus: 1.02 },
    { id: 'canada', name: 'Canada', bonus: 1.01 },
    { id: 'australia', name: 'Australia', bonus: 1.02 },
    { id: 'france', name: 'France', bonus: 1.02 },
    { id: 'brazil', name: 'Brazil', bonus: 1.01 }
];

const TRANSPORTS = [
    { id: 'bicycle', name: 'Bicycle', price: 1000, income: 100, level: 1 },
    { id: 'motorcycle', name: 'Motorcycle', price: 10000, income: 800, level: 1 },
    { id: 'taxi', name: 'Taxi', price: 50000, income: 3500, level: 2 },
    { id: 'bus', name: 'Bus', price: 150000, income: 10000, level: 3 },
    { id: 'truck', name: 'Truck', price: 300000, income: 18000, level: 4 },
    { id: 'train', name: 'Train', price: 1200000, income: 70000, level: 6 },
    { id: 'ship', name: 'Ship', price: 5000000, income: 250000, level: 8 },
    { id: 'cargo_ship', name: 'Cargo Ship', price: 15000000, income: 700000, level: 10 },
    { id: 'airplane', name: 'Airplane', price: 30000000, income: 1500000, level: 12 },
    { id: 'cargo_plane', name: 'Cargo Plane', price: 70000000, income: 3500000, level: 14 }
];

const BUSINESSES = [
    { id: 'street_food', name: 'Street Food', price: 5000, income: 300, level: 1 },
    { id: 'grocery', name: 'Grocery Store', price: 25000, income: 1500, level: 1 },
    { id: 'restaurant', name: 'Restaurant', price: 75000, income: 4500, level: 2 },
    { id: 'hotel', name: 'Hotel', price: 300000, income: 18000, level: 4 },
    { id: 'factory', name: 'Factory', price: 750000, income: 50000, level: 6 },
    { id: 'mall', name: 'Shopping Mall', price: 2500000, income: 150000, level: 8 },
    { id: 'bank', name: 'Bank', price: 10000000, income: 650000, level: 10 },
    { id: 'tech_company', name: 'Technology Company', price: 30000000, income: 2200000, level: 12 },
    { id: 'energy_company', name: 'Energy Company', price: 75000000, income: 6000000, level: 14 },
    { id: 'global_corporation', name: 'Global Corporation', price: 200000000, income: 18000000, level: 15 }
];

const CONCESSIONS = [
    { id: 'food_concession', name: 'Food Concession', price: 25000, income: 1200, level: 2 },
    { id: 'transport_concession', name: 'Transport Concession', price: 100000, income: 6000, level: 4 },
    { id: 'retail_concession', name: 'Retail Concession', price: 300000, income: 20000, level: 6 },
    { id: 'airport_concession', name: 'Airport Concession', price: 2500000, income: 150000, level: 9 },
    { id: 'port_concession', name: 'Port Concession', price: 7500000, income: 500000, level: 11 }
];

const SUBSIDIARIES = [
    { id: 'local_subsidiary', name: 'Local Subsidiary', price: 500000, income: 25000, level: 5 },
    { id: 'regional_subsidiary', name: 'Regional Subsidiary', price: 3000000, income: 175000, level: 8 },
    { id: 'international_subsidiary', name: 'International Subsidiary', price: 15000000, income: 1000000, level: 11 },
    { id: 'global_subsidiary', name: 'Global Subsidiary', price: 75000000, income: 6000000, level: 14 }
];

const INVESTMENTS = [
    { id: 'bonds', name: 'Corporate Bonds', price: 100000, income: 2500, level: 2 },
    { id: 'mutual_fund', name: 'Mutual Fund', price: 500000, income: 15000, level: 4 },
    { id: 'venture_capital', name: 'Venture Capital', price: 2500000, income: 100000, level: 7 },
    { id: 'private_equity', name: 'Private Equity', price: 10000000, income: 500000, level: 10 }
];

const PROPERTIES = [
    { id: 'office', name: 'Office', price: 100000, income: 5000, level: 2 },
    { id: 'warehouse', name: 'Warehouse', price: 500000, income: 18000, level: 4 },
    { id: 'headquarters', name: 'Headquarters', price: 5000000, income: 150000, level: 7 },
    { id: 'corporate_tower', name: 'Corporate Tower', price: 25000000, income: 1000000, level: 11 },
    { id: 'business_district', name: 'Business District', price: 100000000, income: 5000000, level: 15 }
];

const RESOURCES = [
    { id: 'coal', name: 'Coal', price: 100000, income: 8000, level: 3 },
    { id: 'iron', name: 'Iron', price: 250000, income: 20000, level: 4 },
    { id: 'oil', name: 'Oil', price: 1000000, income: 90000, level: 6 },
    { id: 'gas', name: 'Natural Gas', price: 2000000, income: 175000, level: 7 },
    { id: 'gold', name: 'Gold', price: 5000000, income: 500000, level: 9 },
    { id: 'lithium', name: 'Lithium', price: 15000000, income: 1500000, level: 11 }
];

const ALL_CATALOGS = {
    transportation: TRANSPORTS,
    businesses: BUSINESSES,
    concessions: CONCESSIONS,
    subsidiaries: SUBSIDIARIES,
    investments: INVESTMENTS,
    properties: PROPERTIES,
    resources: RESOURCES
};

const CHALLENGES = [
    {
        id: 'first_million',
        name: 'First Million',
        description: 'Reach $1,000,000 net worth.',
        requirement: 1000000,
        reward: 100000
    },
    {
        id: 'ten_million',
        name: 'Ten Million',
        description: 'Reach $10,000,000 net worth.',
        requirement: 10000000,
        reward: 1000000
    },
    {
        id: 'hundred_million',
        name: 'Hundred Million',
        description: 'Reach $100,000,000 net worth.',
        requirement: 100000000,
        reward: 10000000
    },
    {
        id: 'asset_empire',
        name: 'Asset Empire',
        description: 'Own at least 100 assets.',
        requirement: 100,
        reward: 25000000
    }
];

const CEO_UPGRADES = [
    { id: 'leadership', name: 'Leadership', baseCost: 100000, max: 10 },
    { id: 'negotiation', name: 'Negotiation', baseCost: 150000, max: 10 },
    { id: 'management', name: 'Management', baseCost: 200000, max: 10 },
    { id: 'strategy', name: 'Strategy', baseCost: 300000, max: 10 },
    { id: 'innovation', name: 'Innovation', baseCost: 500000, max: 10 }
];

const SPECIAL_ITEMS = [
    {
        id: 'golden_ceo_badge',
        name: 'Golden CEO Badge',
        price: 5000000,
        effect: 'income',
        value: 0.05
    },
    {
        id: 'executive_license',
        name: 'Executive License',
        price: 10000000,
        effect: 'contract',
        value: 0.10
    },
    {
        id: 'military_medal',
        name: 'Military Medal',
        price: 7500000,
        effect: 'army',
        value: 0.10
    },
    {
        id: 'innovation_chip',
        name: 'Innovation Chip',
        price: 15000000,
        effect: 'production',
        value: 0.15
    }
];

const STOCKS = [
    { symbol: 'GTC', name: 'Global Tech Corporation', price: 100 },
    { symbol: 'WEN', name: 'World Energy', price: 250 },
    { symbol: 'MLG', name: 'Mega Logistics', price: 175 },
    { symbol: 'GFD', name: 'Global Food', price: 90 },
    { symbol: 'FMT', name: 'Future Motors', price: 320 }
];

const SPACE_LEVELS = [
    { level: 1, name: 'Space Research', cost: 10000000 },
    { level: 2, name: 'Satellite Program', cost: 50000000 },
    { level: 3, name: 'Launch Program', cost: 250000000 },
    { level: 4, name: 'Orbital Network', cost: 1000000000 },
    { level: 5, name: 'Deep Space Program', cost: 5000000000 }
];

/* =========================================================
   DATABASE INITIALIZATION
========================================================= */

async function columnExists(table, column) {
    const result = await query(
        `
        SELECT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = $1
              AND column_name = $2
        ) AS exists
        `,
        [table, column]
    );

    return result.rows[0].exists;
}

async function ensureColumn(table, column, definition) {
    if (!(await columnExists(table, column))) {
        await query(`ALTER TABLE "${table}" ADD COLUMN "${column}" ${definition}`);
    }
}

async function initDatabase() {
    console.log('Initializing PostgreSQL database...');

    await query(`
        CREATE TABLE IF NOT EXISTS players (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE,
            password_hash TEXT NOT NULL,
            company_name TEXT NOT NULL DEFAULT 'New Company',
            country_id TEXT NOT NULL DEFAULT 'india',
            cash BIGINT NOT NULL DEFAULT 100000,
            level INTEGER NOT NULL DEFAULT 1,
            xp BIGINT NOT NULL DEFAULT 0,
            total_income BIGINT NOT NULL DEFAULT 0,
            total_expenses BIGINT NOT NULL DEFAULT 0,
            last_income_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);

    await ensureColumn('players', 'email', 'TEXT');
    await ensureColumn('players', 'company_name', `TEXT NOT NULL DEFAULT 'New Company'`);
    await ensureColumn('players', 'country_id', `TEXT NOT NULL DEFAULT 'india'`);
    await ensureColumn('players', 'cash', `BIGINT NOT NULL DEFAULT 100000`);
    await ensureColumn('players', 'level', `INTEGER NOT NULL DEFAULT 1`);
    await ensureColumn('players', 'xp', `BIGINT NOT NULL DEFAULT 0`);
    await ensureColumn('players', 'total_income', `BIGINT NOT NULL DEFAULT 0`);
    await ensureColumn('players', 'total_expenses', `BIGINT NOT NULL DEFAULT 0`);
    await ensureColumn('players', 'last_income_at', `TIMESTAMPTZ NOT NULL DEFAULT NOW()`);
    await ensureColumn('players', 'created_at', `TIMESTAMPTZ NOT NULL DEFAULT NOW()`);

    await query(`
        CREATE TABLE IF NOT EXISTS sessions (
            token TEXT PRIMARY KEY,
            player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            expires_at TIMESTAMPTZ
        )
    `);

    await query(`
        CREATE TABLE IF NOT EXISTS player_assets (
            id TEXT PRIMARY KEY,
            player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
            category TEXT NOT NULL,
            asset_id TEXT NOT NULL,
            quantity INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE(player_id, category, asset_id)
        )
    `);

    await query(`
        CREATE TABLE IF NOT EXISTS world_sites (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            country_id TEXT NOT NULL,
            resource_type TEXT,
            value BIGINT NOT NULL DEFAULT 100000,
            income BIGINT NOT NULL DEFAULT 10000,
            owner_id TEXT REFERENCES players(id) ON DELETE SET NULL
        )
    `);

    await query(`
        CREATE TABLE IF NOT EXISTS contracts (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT,
            reward BIGINT NOT NULL DEFAULT 10000,
            min_level INTEGER NOT NULL DEFAULT 1,
            duration_hours INTEGER NOT NULL DEFAULT 24,
            starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            ends_at TIMESTAMPTZ,
            status TEXT NOT NULL DEFAULT 'open'
        )
    `);

    /*
     * IMPORTANT:
     * This is the fix for the Render error.
     * If the old contracts table exists without ends_at,
     * this migration creates the missing column BEFORE
     * seedContracts() is executed.
     */
    await ensureColumn('contracts', 'title', `TEXT NOT NULL DEFAULT 'Contract'`);
    await ensureColumn('contracts', 'description', `TEXT`);
    await ensureColumn('contracts', 'reward', `BIGINT NOT NULL DEFAULT 10000`);
    await ensureColumn('contracts', 'min_level', `INTEGER NOT NULL DEFAULT 1`);
    await ensureColumn('contracts', 'duration_hours', `INTEGER NOT NULL DEFAULT 24`);
    await ensureColumn('contracts', 'starts_at', `TIMESTAMPTZ NOT NULL DEFAULT NOW()`);
    await ensureColumn('contracts', 'ends_at', `TIMESTAMPTZ`);
    await ensureColumn('contracts', 'status', `TEXT NOT NULL DEFAULT 'open'`);

    await query(`
        CREATE TABLE IF NOT EXISTS contract_bids (
            id TEXT PRIMARY KEY,
            contract_id TEXT NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
            player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
            amount BIGINT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE(contract_id, player_id)
        )
    `);

    await query(`
        CREATE TABLE IF NOT EXISTS running_contracts (
            id TEXT PRIMARY KEY,
            contract_id TEXT NOT NULL,
            player_id TEXT NOT NULL,
            reward BIGINT NOT NULL,
            started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            ends_at TIMESTAMPTZ NOT NULL,
            status TEXT NOT NULL DEFAULT 'running'
        )
    `);

    await query(`
        CREATE TABLE IF NOT EXISTS alliances (
            id TEXT PRIMARY KEY,
            name TEXT UNIQUE NOT NULL,
            leader_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);

    await query(`
        CREATE TABLE IF NOT EXISTS alliance_members (
            alliance_id TEXT NOT NULL REFERENCES alliances(id) ON DELETE CASCADE,
            player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
            role TEXT NOT NULL DEFAULT 'member',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            PRIMARY KEY(alliance_id, player_id)
        )
    `);

    await query(`
        CREATE TABLE IF NOT EXISTS chat (
            id TEXT PRIMARY KEY,
            player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
            message TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);

    await query(`
        CREATE TABLE IF NOT EXISTS loans (
            id TEXT PRIMARY KEY,
            player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
            principal BIGINT NOT NULL,
            remaining BIGINT NOT NULL,
            interest_rate NUMERIC NOT NULL DEFAULT 0.10,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            due_at TIMESTAMPTZ
        )
    `);

    await query(`
        CREATE TABLE IF NOT EXISTS army (
            player_id TEXT PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
            ground_level INTEGER NOT NULL DEFAULT 1,
            air_level INTEGER NOT NULL DEFAULT 1,
            defense_level INTEGER NOT NULL DEFAULT 1,
            offensive_level INTEGER NOT NULL DEFAULT 1
        )
    `);

    await query(`
        CREATE TABLE IF NOT EXISTS wars (
            id TEXT PRIMARY KEY,
            attacker_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
            defender_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
            attacker_power BIGINT NOT NULL,
            defender_power BIGINT NOT NULL,
            result TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);

    await query(`
        CREATE TABLE IF NOT EXISTS research (
            player_id TEXT PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
            research_points BIGINT NOT NULL DEFAULT 0,
            technology_level INTEGER NOT NULL DEFAULT 1
        )
    `);

    await query(`
        CREATE TABLE IF NOT EXISTS missions (
            id TEXT PRIMARY KEY,
            player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            description TEXT,
            reward BIGINT NOT NULL DEFAULT 10000,
            progress INTEGER NOT NULL DEFAULT 0,
            target INTEGER NOT NULL DEFAULT 1,
            claimed BOOLEAN NOT NULL DEFAULT FALSE
        )
    `);

    await query(`
        CREATE TABLE IF NOT EXISTS mega_projects (
            id TEXT PRIMARY KEY,
            player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            level INTEGER NOT NULL DEFAULT 1,
            invested BIGINT NOT NULL DEFAULT 0,
            target BIGINT NOT NULL DEFAULT 10000000,
            completed BOOLEAN NOT NULL DEFAULT FALSE
        )
    `);

    await query(`
        CREATE TABLE IF NOT EXISTS country_relations (
            player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
            country_id TEXT NOT NULL,
            relation INTEGER NOT NULL DEFAULT 0,
            trade_bonus NUMERIC NOT NULL DEFAULT 0,
            PRIMARY KEY(player_id, country_id)
        )
    `);

    await query(`
        CREATE TABLE IF NOT EXISTS media_campaigns (
            id TEXT PRIMARY KEY,
            player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            cost BIGINT NOT NULL,
            bonus NUMERIC NOT NULL,
            ends_at TIMESTAMPTZ NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);

    await query(`
        CREATE TABLE IF NOT EXISTS business_challenges (
            player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
            challenge_id TEXT NOT NULL,
            progress BIGINT NOT NULL DEFAULT 0,
            completed BOOLEAN NOT NULL DEFAULT FALSE,
            claimed BOOLEAN NOT NULL DEFAULT FALSE,
            PRIMARY KEY(player_id, challenge_id)
        )
    `);

    await query(`
        CREATE TABLE IF NOT EXISTS ceo_upgrades (
            player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
            upgrade_id TEXT NOT NULL,
            level INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY(player_id, upgrade_id)
        )
    `);

    await query(`
        CREATE TABLE IF NOT EXISTS collections (
            player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
            collection_id TEXT NOT NULL,
            claimed BOOLEAN NOT NULL DEFAULT FALSE,
            PRIMARY KEY(player_id, collection_id)
        )
    `);

    await query(`
        CREATE TABLE IF NOT EXISTS special_items (
            player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
            item_id TEXT NOT NULL,
            quantity INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY(player_id, item_id)
        )
    `);

    await query(`
        CREATE TABLE IF NOT EXISTS stocks (
            symbol TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            price NUMERIC NOT NULL,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);

    await query(`
        CREATE TABLE IF NOT EXISTS player_stocks (
            player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
            symbol TEXT NOT NULL REFERENCES stocks(symbol) ON DELETE CASCADE,
            quantity INTEGER NOT NULL DEFAULT 0,
            average_price NUMERIC NOT NULL DEFAULT 0,
            PRIMARY KEY(player_id, symbol)
        )
    `);

    await query(`
        CREATE TABLE IF NOT EXISTS production_orders (
            id TEXT PRIMARY KEY,
            player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
            product TEXT NOT NULL,
            quantity INTEGER NOT NULL,
            cost BIGINT NOT NULL,
            reward BIGINT NOT NULL,
            started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            ends_at TIMESTAMPTZ NOT NULL,
            status TEXT NOT NULL DEFAULT 'running'
        )
    `);

    await query(`
        CREATE TABLE IF NOT EXISTS space_program (
            player_id TEXT PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
            level INTEGER NOT NULL DEFAULT 0,
            research BIGINT NOT NULL DEFAULT 0,
            satellites INTEGER NOT NULL DEFAULT 0,
            launches INTEGER NOT NULL DEFAULT 0
        )
    `);

    await query(`
        CREATE TABLE IF NOT EXISTS congress_resolutions (
            id TEXT PRIMARY KEY,
            creator_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
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
            resolution_id TEXT NOT NULL REFERENCES congress_resolutions(id) ON DELETE CASCADE,
            player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
            vote BOOLEAN NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            PRIMARY KEY(resolution_id, player_id)
        )
    `);

    await query(`
        CREATE TABLE IF NOT EXISTS marketing_stats (
            player_id TEXT PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
            brand_level INTEGER NOT NULL DEFAULT 1,
            reputation INTEGER NOT NULL DEFAULT 0,
            campaigns INTEGER NOT NULL DEFAULT 0
        )
    `);

    await seedWorldSites();
    await seedContracts();
    await seedStocks();

    console.log('Database initialized successfully.');
}

/* =========================================================
   SEED DATA
========================================================= */

async function seedWorldSites() {
    const count = await query(`SELECT COUNT(*)::int AS count FROM world_sites`);

    if (count.rows[0].count > 0) return;

    const sites = [
        ['site_india_oil', 'Indian Oil Field', 'india', 'oil', 1000000, 90000],
        ['site_india_iron', 'Indian Iron Mine', 'india', 'iron', 500000, 25000],
        ['site_usa_oil', 'Texas Oil Field', 'usa', 'oil', 5000000, 300000],
        ['site_canada_gold', 'Canadian Gold Mine', 'canada', 'gold', 7500000, 550000],
        ['site_australia_iron', 'Australian Iron Mine', 'australia', 'iron', 2500000, 120000],
        ['site_brazil_oil', 'Brazilian Oil Field', 'brazil', 'oil', 4000000, 250000],
        ['site_germany_coal', 'German Coal Mine', 'germany', 'coal', 1000000, 50000],
        ['site_china_lithium', 'Chinese Lithium Mine', 'china', 'lithium', 15000000, 1200000],
        ['site_japan_rare', 'Japanese Technology Site', 'japan', 'gold', 12000000, 900000],
        ['site_uk_gas', 'British Gas Field', 'uk', 'gas', 8000000, 650000]
    ];

    for (const s of sites) {
        await query(
            `
            INSERT INTO world_sites
            (id,name,country_id,resource_type,value,income)
            VALUES ($1,$2,$3,$4,$5,$6)
            ON CONFLICT (id) DO NOTHING
            `,
            s
        );
    }
}

async function seedContracts() {
    /*
     * The previous crash happened here because ends_at was
     * queried before the migration had created it.
     *
     * initDatabase() now guarantees that ends_at exists.
     */

    const count = await query(`SELECT COUNT(*)::int AS count FROM contracts`);

    if (count.rows[0].count > 0) return;

    const contracts = [
        ['contract_food', 'Food Supply Contract', 'Supply food products to a regional chain.', 25000, 1, 12],
        ['contract_transport', 'Transport Contract', 'Provide transportation services.', 100000, 2, 24],
        ['contract_factory', 'Factory Contract', 'Complete a large manufacturing order.', 500000, 5, 48],
        ['contract_global', 'Global Logistics Contract', 'Complete an international logistics contract.', 2500000, 8, 72],
        ['contract_corporate', 'Corporate Expansion Contract', 'Support a major corporate expansion.', 10000000, 12, 96]
    ];

    for (const c of contracts) {
        await query(
            `
            INSERT INTO contracts
            (id,title,description,reward,min_level,duration_hours,starts_at,ends_at,status)
            VALUES
            ($1,$2,$3,$4,$5,$6,NOW(),NOW() + ($6 * INTERVAL '1 hour'),'open')
            ON CONFLICT (id) DO NOTHING
            `,
            c
        );
    }
}

async function seedStocks() {
    for (const s of STOCKS) {
        await query(
            `
            INSERT INTO stocks(symbol,name,price)
            VALUES($1,$2,$3)
            ON CONFLICT(symbol)
            DO UPDATE SET name=EXCLUDED.name
            `,
            [s.symbol, s.name, s.price]
        );
    }
}

/* =========================================================
   PLAYER / ECONOMY
========================================================= */

function xpForLevel(level) {
    return Math.round(1000 * Math.pow(level, 1.65));
}

function calculateLevel(xp) {
    let level = 1;

    for (let i = 2; i <= 15; i++) {
        if (xp >= xpForLevel(i)) {
            level = i;
        }
    }

    return level;
}

async function processIncome(playerId) {
    const playerResult = await query(
        `SELECT * FROM players WHERE id=$1`,
        [playerId]
    );

    if (!playerResult.rows.length) return null;

    const player = playerResult.rows[0];

    const assetResult = await query(
        `
        SELECT category, asset_id, quantity
        FROM player_assets
        WHERE player_id=$1 AND quantity>0
        `,
        [playerId]
    );

    let incomePerCycle = 0;

    for (const asset of assetResult.rows) {
        const catalog = ALL_CATALOGS[asset.category] || [];
        const item = catalog.find(x => x.id === asset.asset_id);

        if (item) {
            incomePerCycle += num(item.income) * num(asset.quantity);
        }
    }

    const siteResult = await query(
        `
        SELECT COALESCE(SUM(income),0) AS income
        FROM world_sites
        WHERE owner_id=$1
        `,
        [playerId]
    );

    incomePerCycle += num(siteResult.rows[0].income);

    const specialResult = await query(
        `
        SELECT COALESCE(SUM(
            CASE
                WHEN si.effect='income' THEN si.value * psi.quantity
                ELSE 0
            END
        ),0) AS bonus
        FROM player_special_items psi
        JOIN special_items_catalog si ON si.id=psi.item_id
        WHERE psi.player_id=$1
        `,
        [playerId]
    ).catch(() => ({ rows: [{ bonus: 0 }] }));

    const bonus = num(specialResult.rows[0]?.bonus);

    incomePerCycle = Math.round(incomePerCycle * (1 + bonus));

    const last = new Date(player.last_income_at || Date.now());
    const elapsed = Math.floor((Date.now() - last.getTime()) / 60000);

    /*
     * One income cycle every 60 minutes.
     * Maximum 24 offline cycles.
     */
    const cycles = clamp(Math.floor(elapsed / 60), 0, 24);

    if (cycles <= 0) {
        return {
            incomePerCycle,
            cycles: 0,
            received: 0,
            player
        };
    }

    const received = incomePerCycle * cycles;

    const newLast = new Date(
        last.getTime() + cycles * 60 * 60 * 1000
    );

    await query(
        `
        UPDATE players
        SET cash=cash+$1,
            total_income=total_income+$1,
            xp=xp+$2,
            last_income_at=$3
        WHERE id=$4
        `,
        [received, Math.max(1, Math.floor(received / 1000)), newLast, playerId]
    );

    await updateLevel(playerId);

    return {
        incomePerCycle,
        cycles,
        received,
        player
    };
}

async function updateLevel(playerId) {
    const result = await query(
        `SELECT xp,level FROM players WHERE id=$1`,
        [playerId]
    );

    if (!result.rows.length) return;

    const xp = num(result.rows[0].xp);
    const level = calculateLevel(xp);

    if (level !== num(result.rows[0].level)) {
        await query(
            `UPDATE players SET level=$1 WHERE id=$2`,
            [level, playerId]
        );
    }
}

async function playerNetWorth(playerId) {
    const playerResult = await query(
        `SELECT cash FROM players WHERE id=$1`,
        [playerId]
    );

    if (!playerResult.rows.length) return 0;

    let value = num(playerResult.rows[0].cash);

    const assets = await query(
        `
        SELECT category,asset_id,quantity
        FROM player_assets
        WHERE player_id=$1
        `,
        [playerId]
    );

    for (const a of assets.rows) {
        const catalog = ALL_CATALOGS[a.category] || [];
        const item = catalog.find(x => x.id === a.asset_id);

        if (item) {
            value += num(item.price) * num(a.quantity);
        }
    }

    const sites = await query(
        `
        SELECT COALESCE(SUM(value),0) AS value
        FROM world_sites
        WHERE owner_id=$1
        `,
        [playerId]
    );

    value += num(sites.rows[0].value);

    return Math.round(value);
}

async function playerSummary(playerId) {
    await processIncome(playerId);

    const result = await query(
        `
        SELECT
            id,
            username,
            email,
            company_name,
            country_id,
            cash,
            level,
            xp,
            total_income,
            total_expenses,
            last_income_at,
            created_at
        FROM players
        WHERE id=$1
        `,
        [playerId]
    );

    if (!result.rows.length) return null;

    const p = result.rows[0];
    const netWorth = await playerNetWorth(playerId);

    const assets = await query(
        `
        SELECT COALESCE(SUM(quantity),0)::int AS count
        FROM player_assets
        WHERE player_id=$1
        `,
        [playerId]
    );

    const grossIncome = await currentIncome(playerId);

    return {
        ...p,
        cash: num(p.cash),
        xp: num(p.xp),
        level: num(p.level),
        netWorth,
        net_worth: netWorth,
        netIncome: grossIncome,
        net_income: grossIncome,
        grossIncome,
        gross_income: grossIncome,
        assetCount: num(assets.rows[0].count),
        country: COUNTRIES.find(c => c.id === p.country_id) || null
    };
}

async function currentIncome(playerId) {
    const assets = await query(
        `
        SELECT category,asset_id,quantity
        FROM player_assets
        WHERE player_id=$1
        `,
        [playerId]
    );

    let income = 0;

    for (const a of assets.rows) {
        const catalog = ALL_CATALOGS[a.category] || [];
        const item = catalog.find(x => x.id === a.asset_id);

        if (item) {
            income += num(item.income) * num(a.quantity);
        }
    }

    const sites = await query(
        `
        SELECT COALESCE(SUM(income),0) AS income
        FROM world_sites
        WHERE owner_id=$1
        `,
        [playerId]
    );

    income += num(sites.rows[0].income);

    return Math.round(income);
}

/* =========================================================
   ASSET OPERATIONS
========================================================= */

async function buyAsset(playerId, category, assetId, quantity) {
    const catalog = ALL_CATALOGS[category];

    if (!catalog) {
        throw new Error('Invalid asset category');
    }

    const item = catalog.find(x => x.id === assetId);

    if (!item) {
        throw new Error('Asset not found');
    }

    quantity = Math.floor(num(quantity, 1));

    if (quantity < 1 || quantity > 1000000) {
        throw new Error('Invalid quantity');
    }

    const player = await query(
        `SELECT cash,level FROM players WHERE id=$1`,
        [playerId]
    );

    if (!player.rows.length) {
        throw new Error('Player not found');
    }

    if (num(player.rows[0].level) < num(item.level)) {
        throw new Error(`Level ${item.level} required`);
    }

    const cost = num(item.price) * quantity;

    if (num(player.rows[0].cash) < cost) {
        throw new Error('Not enough cash');
    }

    await transaction(async client => {
        await client.query(
            `
            UPDATE players
            SET cash=cash-$1,
                total_expenses=total_expenses+$1
            WHERE id=$2
            `,
            [cost, playerId]
        );

        await client.query(
            `
            INSERT INTO player_assets
            (id,player_id,category,asset_id,quantity)
            VALUES($1,$2,$3,$4,$5)
            ON CONFLICT(player_id,category,asset_id)
            DO UPDATE SET quantity=player_assets.quantity+EXCLUDED.quantity
            `,
            [id(), playerId, category, assetId, quantity]
        );
    });

    return {
        asset: item,
        quantity,
        cost,
        player: await playerSummary(playerId)
    };
}

/* =========================================================
   AUTH
========================================================= */

async function register(req, res) {
    const b = await body(req);

    const username = safeName(b.username || b.name, '');
    const email = String(b.email || '').trim().toLowerCase();
    const password = String(b.password || '');
    const companyName = safeName(
        b.companyName || b.company || 'New Company',
        'New Company'
    );

    if (!username || username.length < 3) {
        return error(res, 400, 'Username must contain at least 3 characters');
    }

    if (password.length < 4) {
        return error(res, 400, 'Password must contain at least 4 characters');
    }

    const existing = await query(
        `
        SELECT id
        FROM players
        WHERE LOWER(username)=LOWER($1)
           OR ($2<>'' AND LOWER(email)=LOWER($2))
        LIMIT 1
        `,
        [username, email]
    );

    if (existing.rows.length) {
        return error(res, 409, 'Username or email already exists');
    }

    const playerId = id();

    await transaction(async client => {
        await client.query(
            `
            INSERT INTO players
            (id,username,email,password_hash,company_name,country_id)
            VALUES($1,$2,$3,$4,$5,'india')
            `,
            [
                playerId,
                username,
                email || null,
                hashPassword(password),
                companyName
            ]
        );

        await client.query(
            `
            INSERT INTO army(player_id)
            VALUES($1)
            ON CONFLICT(player_id) DO NOTHING
            `,
            [playerId]
        );

        await client.query(
            `
            INSERT INTO research(player_id)
            VALUES($1)
            ON CONFLICT(player_id) DO NOTHING
            `,
            [playerId]
        );

        await client.query(
            `
            INSERT INTO marketing_stats(player_id)
            VALUES($1)
            ON CONFLICT(player_id) DO NOTHING
            `,
            [playerId]
        );

        await client.query(
            `
            INSERT INTO space_program(player_id)
            VALUES($1)
            ON CONFLICT(player_id) DO NOTHING
            `,
            [playerId]
        );

        for (const c of CHALLENGES) {
            await client.query(
                `
                INSERT INTO business_challenges(player_id,challenge_id)
                VALUES($1,$2)
                ON CONFLICT DO NOTHING
                `,
                [playerId, c.id]
            );
        }

        for (const c of CEO_UPGRADES) {
            await client.query(
                `
                INSERT INTO ceo_upgrades(player_id,upgrade_id)
                VALUES($1,$2)
                ON CONFLICT DO NOTHING
                `,
                [playerId, c.id]
            );
        }

        for (const c of COUNTRIES) {
            await client.query(
                `
                INSERT INTO country_relations(player_id,country_id)
                VALUES($1,$2)
                ON CONFLICT DO NOTHING
                `,
                [playerId, c.id]
            );
        }
    });

    return json(res, 201, {
        success: true,
        message: 'Account created successfully',
        playerId
    });
}

async function login(req, res) {
    const b = await body(req);

    const username = String(
        b.username || b.email || b.login || ''
    ).trim();

    const password = String(b.password || '');

    const result = await query(
        `
        SELECT *
        FROM players
        WHERE LOWER(username)=LOWER($1)
           OR LOWER(email)=LOWER($1)
        LIMIT 1
        `,
        [username]
    );

    if (!result.rows.length) {
        return error(res, 401, 'Invalid username or password');
    }

    const player = result.rows[0];

    if (player.password_hash !== hashPassword(password)) {
        return error(res, 401, 'Invalid username or password');
    }

    const accessToken = token();

    await query(
        `
        INSERT INTO sessions(token,player_id,expires_at)
        VALUES($1,$2,NOW()+INTERVAL '30 days')
        `,
        [accessToken, player.id]
    );

    return json(res, 200, {
        success: true,
        token: accessToken,
        accessToken,
        player: await playerSummary(player.id)
    });
}

/* =========================================================
   ASSETS
========================================================= */

async function assets(req, res, player) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const category = url.searchParams.get('category');

    if (category) {
        const catalog = ALL_CATALOGS[category] || [];

        const owned = await query(
            `
            SELECT asset_id,quantity
            FROM player_assets
            WHERE player_id=$1 AND category=$2
            `,
            [player.id, category]
        );

        const map = {};

        for (const row of owned.rows) {
            map[row.asset_id] = num(row.quantity);
        }

        return json(res, 200, {
            success: true,
            category,
            assets: catalog.map(x => ({
                ...x,
                owned: map[x.id] || 0
            }))
        });
    }

    return json(res, 200, {
        success: true,
        categories: Object.keys(ALL_CATALOGS)
    });
}

async function buy(req, res, player) {
    const b = await body(req);

    const category = String(
        b.category || b.type || ''
    ).trim();

    const assetId = String(
        b.assetId || b.asset || b.itemId || b.id || ''
    ).trim();

    const quantity = num(
        b.quantity || b.amount || 1,
        1
    );

    try {
        const result = await buyAsset(
            player.id,
            category,
            assetId,
            quantity
        );

        return json(res, 200, {
            success: true,
            ...result
        });
    } catch (e) {
        return error(res, 400, e.message);
    }
}

/* =========================================================
   WORLD
========================================================= */

async function worldSites(req, res, player) {
    const result = await query(
        `
        SELECT
            ws.*,
            CASE WHEN ws.owner_id=$1 THEN TRUE ELSE FALSE END AS owned
        FROM world_sites ws
        ORDER BY ws.country_id,ws.name
        `,
        [player.id]
    );

    return json(res, 200, {
        success: true,
        sites: result.rows
    });
}

async function claimWorldSite(req, res, player) {
    const b = await body(req);
    const siteId = String(b.siteId || b.id || '');

    const result = await query(
        `SELECT * FROM world_sites WHERE id=$1`,
        [siteId]
    );

    if (!result.rows.length) {
        return error(res, 404, 'World site not found');
    }

    const site = result.rows[0];

    if (site.owner_id && site.owner_id !== player.id) {
        return error(res, 409, 'This site is already owned');
    }

    if (site.owner_id === player.id) {
        return error(res, 400, 'You already own this site');
    }

    const cost = num(site.value);

    if (num(player.cash) < cost) {
        return error(res, 400, 'Not enough cash');
    }

    await transaction(async client => {
        await client.query(
            `
            UPDATE players
            SET cash=cash-$1,total_expenses=total_expenses+$1
            WHERE id=$2
            `,
            [cost, player.id]
        );

        await client.query(
            `
            UPDATE world_sites
            SET owner_id=$1
            WHERE id=$2 AND owner_id IS NULL
            `,
            [player.id, siteId]
        );
    });

    return json(res, 200, {
        success: true,
        message: 'World site claimed',
        siteId,
        player: await playerSummary(player.id)
    });
}

/* =========================================================
   RANKINGS
========================================================= */

async function rankings(req, res) {
    const result = await query(
        `
        SELECT
            p.id,
            p.username,
            p.company_name,
            p.country_id,
            p.level,
            p.xp,
            p.cash,
            (
                p.cash +
                COALESCE((
                    SELECT SUM(pa.quantity * (
                        CASE pa.category
                            WHEN 'transportation' THEN 0
                            WHEN 'businesses' THEN 0
                            WHEN 'concessions' THEN 0
                            WHEN 'subsidiaries' THEN 0
                            WHEN 'investments' THEN 0
                            WHEN 'properties' THEN 0
                            WHEN 'resources' THEN 0
                            ELSE 0
                        END
                    ))
                    FROM player_assets pa
                    WHERE pa.player_id=p.id
                ),0)
            ) AS ranking_cash
        FROM players p
        ORDER BY p.cash DESC,p.xp DESC
        LIMIT 100
        `
    );

    const rows = [];

    for (const r of result.rows) {
        rows.push({
            id: r.id,
            username: r.username,
            companyName: r.company_name,
            company_name: r.company_name,
            countryId: r.country_id,
            level: num(r.level),
            xp: num(r.xp),
            cash: num(r.cash),
            netWorth: await playerNetWorth(r.id)
        });
    }

    rows.sort((a, b) => b.netWorth - a.netWorth);

    return json(res, 200, {
        success: true,
        rankings: rows.map((r, i) => ({
            rank: i + 1,
            ...r
        }))
    });
}

/* =========================================================
   LOANS
========================================================= */

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
        success: true,
        loans: result.rows
    });
}

async function takeLoan(req, res, player) {
    const b = await body(req);
    const amount = Math.floor(num(b.amount || b.principal));

    if (amount < 10000) {
        return error(res, 400, 'Minimum loan is 10,000');
    }

    if (amount > 1000000000) {
        return error(res, 400, 'Maximum loan is 1,000,000,000');
    }

    const outstanding = await query(
        `
        SELECT COALESCE(SUM(remaining),0) AS remaining
        FROM loans
        WHERE player_id=$1
        `,
        [player.id]
    );

    const limit = Math.max(
        100000,
        num(player.cash) * Math.max(2, num(player.level))
    );

    if (num(outstanding.rows[0].remaining) + amount > limit) {
        return error(res, 400, 'Loan limit exceeded');
    }

    await transaction(async client => {
        await client.query(
            `
            UPDATE players
            SET cash=cash+$1
            WHERE id=$2
            `,
            [amount, player.id]
        );

        await client.query(
            `
            INSERT INTO loans
            (id,player_id,principal,remaining,interest_rate,due_at)
            VALUES($1,$2,$3,$3,0.10,NOW()+INTERVAL '30 days')
            `,
            [id(), player.id, amount]
        );
    });

    return json(res, 200, {
        success: true,
        amount,
        player: await playerSummary(player.id)
    });
}

/* =========================================================
   CONTRACTS
========================================================= */

async function contracts(req, res) {
    await query(
        `
        UPDATE contracts
        SET status='expired'
        WHERE ends_at IS NOT NULL
          AND ends_at<NOW()
          AND status='open'
        `
    );

    const result = await query(
        `
        SELECT *
        FROM contracts
        WHERE status='open'
        ORDER BY reward ASC
        `
    );

    return json(res, 200, {
        success: true,
        contracts: result.rows
    });
}

async function runningContracts(req, res, player) {
    const result = await query(
        `
        SELECT
            rc.*,
            c.title,
            c.description
        FROM running_contracts rc
        JOIN contracts c ON c.id=rc.contract_id
        WHERE rc.player_id=$1
        ORDER BY rc.started_at DESC
        `,
        [player.id]
    );

    for (const rc of result.rows) {
        if (
            rc.status === 'running' &&
            new Date(rc.ends_at).getTime() <= Date.now()
        ) {
            await completeRunningContract(rc);
        }
    }

    const fresh = await query(
        `
        SELECT
            rc.*,
            c.title,
            c.description
        FROM running_contracts rc
        JOIN contracts c ON c.id=rc.contract_id
        WHERE rc.player_id=$1
        ORDER BY rc.started_at DESC
        `,
        [player.id]
    );

    return json(res, 200, {
        success: true,
        contracts: fresh.rows
    });
}

async function completeRunningContract(rc) {
    const result = await query(
        `
        UPDATE running_contracts
        SET status='completed'
        WHERE id=$1 AND status='running'
        RETURNING *
        `,
        [rc.id]
    );

    if (!result.rows.length) return;

    await query(
        `
        UPDATE players
        SET cash=cash+$1,total_income=total_income+$1,xp=xp+$2
        WHERE id=$2
        `,
        [
            num(rc.reward),
            rc.player_id,
            Math.max(10, Math.floor(num(rc.reward) / 1000))
        ]
    );

    await updateLevel(rc.player_id);
}

async function bidContract(req, res, player) {
    const b = await body(req);

    const contractId = String(
        b.contractId || b.id || ''
    );

    const amount = Math.floor(
        num(b.amount || b.bid || b.bidAmount)
    );

    const contractResult = await query(
        `
        SELECT *
        FROM contracts
        WHERE id=$1 AND status='open'
        `,
        [contractId]
    );

    if (!contractResult.rows.length) {
        return error(res, 404, 'Contract not available');
    }

    const c = contractResult.rows[0];

    if (num(player.level) < num(c.min_level)) {
        return error(res, 400, `Level ${c.min_level} required`);
    }

    if (amount <= 0) {
        return error(res, 400, 'Invalid bid');
    }

    await query(
        `
        INSERT INTO contract_bids
        (id,contract_id,player_id,amount)
        VALUES($1,$2,$3,$4)
        ON CONFLICT(contract_id,player_id)
        DO UPDATE SET amount=EXCLUDED.amount,created_at=NOW()
        `,
        [id(), contractId, player.id, amount]
    );

    return json(res, 200, {
        success: true,
        message: 'Bid submitted'
    });
}

async function contractBidRanking(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const contractId = url.searchParams.get('contractId');

    if (!contractId) {
        return json(res, 200, {
            success: true,
            bids: []
        });
    }

    const result = await query(
        `
        SELECT
            cb.amount,
            cb.created_at,
            p.username,
            p.company_name
        FROM contract_bids cb
        JOIN players p ON p.id=cb.player_id
        WHERE cb.contract_id=$1
        ORDER BY cb.amount ASC,cb.created_at ASC
        LIMIT 50
        `,
        [contractId]
    );

    return json(res, 200, {
        success: true,
        bids: result.rows
    });
}

/* =========================================================
   ALLIANCES
========================================================= */

async function alliances(req, res) {
    const result = await query(
        `
        SELECT
            a.id,
            a.name,
            a.leader_id,
            a.created_at,
            COUNT(am.player_id)::int AS members
        FROM alliances a
        LEFT JOIN alliance_members am ON am.alliance_id=a.id
        GROUP BY a.id
        ORDER BY members DESC,a.created_at ASC
        `
    );

    return json(res, 200, {
        success: true,
        alliances: result.rows
    });
}

async function createAlliance(req, res, player) {
    const b = await body(req);
    const name = safeName(b.name || b.allianceName, '');

    if (!name || name.length < 3) {
        return error(res, 400, 'Alliance name is required');
    }

    const existing = await query(
        `SELECT id FROM alliances WHERE LOWER(name)=LOWER($1)`,
        [name]
    );

    if (existing.rows.length) {
        return error(res, 409, 'Alliance already exists');
    }

    const allianceId = id();

    await transaction(async client => {
        await client.query(
            `
            INSERT INTO alliances(id,name,leader_id)
            VALUES($1,$2,$3)
            `,
            [allianceId, name, player.id]
        );

        await client.query(
            `
            INSERT INTO alliance_members(alliance_id,player_id,role)
            VALUES($1,$2,'leader')
            `,
            [allianceId, player.id]
        );
    });

    return json(res, 201, {
        success: true,
        allianceId,
        name
    });
}

/* =========================================================
   CHAT
========================================================= */

async function getChat(req, res) {
    const result = await query(
        `
        SELECT
            c.id,
            c.message,
            c.created_at,
            p.username,
            p.company_name
        FROM chat c
        JOIN players p ON p.id=c.player_id
        ORDER BY c.created_at DESC
        LIMIT 100
        `
    );

    return json(res, 200, {
        success: true,
        messages: result.rows.reverse()
    });
}

async function sendChat(req, res, player) {
    const b = await body(req);
    const message = String(b.message || '').trim();

    if (!message) {
        return error(res, 400, 'Message is empty');
    }

    if (message.length > 500) {
        return error(res, 400, 'Message is too long');
    }

    await query(
        `
        INSERT INTO chat(id,player_id,message)
        VALUES($1,$2,$3)
        `,
        [id(), player.id, message]
    );

    return json(res, 201, {
        success: true
    });
}

/* =========================================================
   ARMY / WARS
========================================================= */

async function army(req, res, player) {
    await query(
        `
        INSERT INTO army(player_id)
        VALUES($1)
        ON CONFLICT(player_id) DO NOTHING
        `,
        [player.id]
    );

    const result = await query(
        `SELECT * FROM army WHERE player_id=$1`,
        [player.id]
    );

    const a = result.rows[0];

    const militaryPower =
        num(a.ground_level) * 100 +
        num(a.air_level) * 150 +
        num(a.defense_level) * 120 +
        num(a.offensive_level) * 130;

    return json(res, 200, {
        success: true,
        army: {
            ...a,
            militaryPower,
            military_power: militaryPower
        }
    });
}

async function upgradeArmy(req, res, player) {
    const b = await body(req);

    const type = String(
        b.type || b.unit || b.category || 'ground'
    ).toLowerCase();

    const allowed = [
        'ground',
        'air',
        'defense',
        'offensive'
    ];

    if (!allowed.includes(type)) {
        return error(res, 400, 'Invalid army upgrade');
    }

    await query(
        `
        INSERT INTO army(player_id)
        VALUES($1)
        ON CONFLICT(player_id) DO NOTHING
        `,
        [player.id]
    );

    const armyResult = await query(
        `SELECT * FROM army WHERE player_id=$1`,
        [player.id]
    );

    const current = num(
        armyResult.rows[0][`${type}_level`]
    );

    const cost =
        Math.round(50000 * Math.pow(current, 1.7));

    if (num(player.cash) < cost) {
        return error(res, 400, 'Not enough cash');
    }

    await transaction(async client => {
        await client.query(
            `
            UPDATE players
            SET cash=cash-$1,total_expenses=total_expenses+$1
            WHERE id=$2
            `,
            [cost, player.id]
        );

        await client.query(
            `
            UPDATE army
            SET ${type}_level=${type}_level+1
            WHERE player_id=$1
            `,
            [player.id]
        );
    });

    return json(res, 200, {
        success: true,
        type,
        cost,
        player: await playerSummary(player.id)
    });
}

async function wars(req, res, player) {
    const b = await body(req);

    const targetId = String(
        b.targetPlayerId || b.targetId || b.defenderId || ''
    );

    if (!targetId || targetId === player.id) {
        return error(res, 400, 'Invalid target');
    }

    const target = await query(
        `SELECT id,username,company_name FROM players WHERE id=$1`,
        [targetId]
    );

    if (!target.rows.length) {
        return error(res, 404, 'Target player not found');
    }

    const attackerArmy = await query(
        `SELECT * FROM army WHERE player_id=$1`,
        [player.id]
    );

    const defenderArmy = await query(
        `SELECT * FROM army WHERE player_id=$1`,
        [targetId]
    );

    const a = attackerArmy.rows[0] || {};
    const d = defenderArmy.rows[0] || {};

    const attackerPower =
        num(a.ground_level, 1) * 100 +
        num(a.air_level, 1) * 150 +
        num(a.defense_level, 1) * 120 +
        num(a.offensive_level, 1) * 130;

    const defenderPower =
        num(d.ground_level, 1) * 100 +
        num(d.air_level, 1) * 150 +
        num(d.defense_level, 1) * 120 +
        num(d.offensive_level, 1) * 130;

    const attackerRoll =
        attackerPower * (0.85 + Math.random() * 0.30);

    const defenderRoll =
        defenderPower * (0.85 + Math.random() * 0.30);

    const resultText =
        attackerRoll >= defenderRoll ? 'attacker_win' : 'defender_win';

    await query(
        `
        INSERT INTO wars
        (id,attacker_id,defender_id,attacker_power,defender_power,result)
        VALUES($1,$2,$3,$4,$5,$6)
        `,
        [
            id(),
            player.id,
            targetId,
            Math.round(attackerPower),
            Math.round(defenderPower),
            resultText
        ]
    );

    return json(res, 200, {
        success: true,
        result: resultText,
        attackerPower: Math.round(attackerPower),
        defenderPower: Math.round(defenderPower),
        target: target.rows[0]
    });
}

/* =========================================================
   COUNTRY RELATIONS
========================================================= */

async function countryRelations(req, res, player) {
    const result = await query(
        `
        SELECT
            cr.country_id,
            cr.relation,
            cr.trade_bonus
        FROM country_relations cr
        WHERE cr.player_id=$1
        ORDER BY cr.relation DESC
        `,
        [player.id]
    );

    const rows = result.rows.map(r => ({
        ...r,
        country: COUNTRIES.find(c => c.id === r.country_id) || null
    }));

    return json(res, 200, {
        success: true,
        relations: rows
    });
}

async function improveCountryRelation(req, res, player) {
    const b = await body(req);
    const countryId = String(b.countryId || b.country || '');

    if (!COUNTRIES.some(c => c.id === countryId)) {
        return error(res, 404, 'Country not found');
    }

    const current = await query(
        `
        SELECT relation
        FROM country_relations
        WHERE player_id=$1 AND country_id=$2
        `,
        [player.id, countryId]
    );

    const relation = num(current.rows[0]?.relation);

    if (relation >= 100) {
        return error(res, 400, 'Relations are already maximum');
    }

    const cost = 100000 + relation * 10000;

    if (num(player.cash) < cost) {
        return error(res, 400, 'Not enough cash');
    }

    const newRelation = clamp(relation + 10, 0, 100);

    await transaction(async client => {
        await client.query(
            `
            UPDATE players
            SET cash=cash-$1,total_expenses=total_expenses+$1
            WHERE id=$2
            `,
            [cost, player.id]
        );

        await client.query(
            `
            INSERT INTO country_relations
            (player_id,country_id,relation,trade_bonus)
            VALUES($1,$2,$3,$4)
            ON CONFLICT(player_id,country_id)
            DO UPDATE SET
                relation=EXCLUDED.relation,
                trade_bonus=EXCLUDED.trade_bonus
            `,
            [
                player.id,
                countryId,
                newRelation,
                newRelation / 1000
            ]
        );
    });

    return json(res, 200, {
        success: true,
        countryId,
        relation: newRelation,
        cost
    });
}

/* =========================================================
   MARKETING
========================================================= */

async function marketing(req, res, player) {
    await query(
        `
        INSERT INTO marketing_stats(player_id)
        VALUES($1)
        ON CONFLICT(player_id) DO NOTHING
        `,
        [player.id]
    );

    const stats = await query(
        `SELECT * FROM marketing_stats WHERE player_id=$1`,
        [player.id]
    );

    const campaigns = await query(
        `
        SELECT *
        FROM media_campaigns
        WHERE player_id=$1
        ORDER BY created_at DESC
        LIMIT 20
        `,
        [player.id]
    );

    return json(res, 200, {
        success: true,
        stats: stats.rows[0],
        campaigns: campaigns.rows
    });
}

async function marketingCampaign(req, res, player) {
    const b = await body(req);

    const name = safeName(
        b.name || b.campaign || 'Media Campaign',
        'Media Campaign'
    );

    const cost = Math.max(
        10000,
        Math.floor(num(b.cost, 100000))
    );

    if (num(player.cash) < cost) {
        return error(res, 400, 'Not enough cash');
    }

    const bonus = Math.min(
        0.50,
        cost / 10000000
    );

    await transaction(async client => {
        await client.query(
            `
            UPDATE players
            SET cash=cash-$1,total_expenses=total_expenses+$1
            WHERE id=$2
            `,
            [cost, player.id]
        );

        await client.query(
            `
            INSERT INTO media_campaigns
            (id,player_id,name,cost,bonus,ends_at)
            VALUES($1,$2,$3,$4,$5,NOW()+INTERVAL '7 days')
            `,
            [id(), player.id, name, cost, bonus]
        );

        await client.query(
            `
            INSERT INTO marketing_stats(player_id)
            VALUES($1)
            ON CONFLICT DO NOTHING
            `,
            [player.id]
        );

        await client.query(
            `
            UPDATE marketing_stats
            SET campaigns=campaigns+1,
                reputation=LEAST(100,reputation+5),
                brand_level=LEAST(20,brand_level+1)
            WHERE player_id=$1
            `,
            [player.id]
        );
    });

    return json(res, 200, {
        success: true,
        message: 'Marketing campaign launched',
        bonus
    });
}

/* =========================================================
   BUSINESS CENTER
========================================================= */

async function businessCenter(req, res, player) {
    const assets = await query(
        `
        SELECT category,SUM(quantity)::int AS quantity
        FROM player_assets
        WHERE player_id=$1
        GROUP BY category
        ORDER BY category
        `,
        [player.id]
    );

    const income = await currentIncome(player.id);
    const netWorth = await playerNetWorth(player.id);

    return json(res, 200, {
        success: true,
        company: {
            name: player.company_name,
            country: player.country_id,
            level: player.level,
            cash: num(player.cash),
            netWorth,
            income
        },
        assets: assets.rows
    });
}

/* =========================================================
   CHALLENGES
========================================================= */

async function challenges(req, res, player) {
    const netWorth = await playerNetWorth(player.id);

    const assetCountResult = await query(
        `
        SELECT COALESCE(SUM(quantity),0)::int AS count
        FROM player_assets
        WHERE player_id=$1
        `,
        [player.id]
    );

    const assetCount = num(assetCountResult.rows[0].count);

    const progressMap = {};

    for (const c of CHALLENGES) {
        let progress = 0;

        if (
            c.id === 'first_million' ||
            c.id === 'ten_million' ||
            c.id === 'hundred_million'
        ) {
            progress = netWorth;
        } else if (c.id === 'asset_empire') {
            progress = assetCount;
        }

        const completed = progress >= c.requirement;

        await query(
            `
            INSERT INTO business_challenges
            (player_id,challenge_id,progress,completed)
            VALUES($1,$2,$3,$4)
            ON CONFLICT(player_id,challenge_id)
            DO UPDATE SET
                progress=EXCLUDED.progress,
                completed=EXCLUDED.completed
            `,
            [player.id, c.id, progress, completed]
        );

        progressMap[c.id] = {
            ...c,
            progress,
            completed
        };
    }

    const db = await query(
        `
        SELECT challenge_id,claimed
        FROM business_challenges
        WHERE player_id=$1
        `,
        [player.id]
    );

    for (const r of db.rows) {
        if (progressMap[r.challenge_id]) {
            progressMap[r.challenge_id].claimed = r.claimed;
        }
    }

    return json(res, 200, {
        success: true,
        challenges: Object.values(progressMap)
    });
}

async function claimChallenge(req, res, player) {
    const b = await body(req);
    const challengeId = String(b.challengeId || b.id || '');

    const c = CHALLENGES.find(x => x.id === challengeId);

    if (!c) {
        return error(res, 404, 'Challenge not found');
    }

    await challenges(req, {
        writeHead() {},
        end() {}
    }, player);

    const result = await query(
        `
        SELECT completed,claimed
        FROM business_challenges
        WHERE player_id=$1 AND challenge_id=$2
        `,
        [player.id, challengeId]
    );

    if (!result.rows.length || !result.rows[0].completed) {
        return error(res, 400, 'Challenge is not completed');
    }

    if (result.rows[0].claimed) {
        return error(res, 400, 'Reward already claimed');
    }

    await transaction(async client => {
        await client.query(
            `
            UPDATE business_challenges
            SET claimed=TRUE
            WHERE player_id=$1 AND challenge_id=$2
            `,
            [player.id, challengeId]
        );

        await client.query(
            `
            UPDATE players
            SET cash=cash+$1,total_income=total_income+$1
            WHERE id=$2
            `,
            [c.reward, player.id]
        );
    });

    return json(res, 200, {
        success: true,
        reward: c.reward,
        player: await playerSummary(player.id)
    });
}

/* =========================================================
   CEO UPGRADES
========================================================= */

async function ceo(req, res, player) {
    const result = await query(
        `
        SELECT upgrade_id,level
        FROM ceo_upgrades
        WHERE player_id=$1
        `,
        [player.id]
    );

    const map = {};

    for (const r of result.rows) {
        map[r.upgrade_id] = num(r.level);
    }

    const upgrades = CEO_UPGRADES.map(u => ({
        ...u,
        level: map[u.id] || 0,
        nextCost:
            u.baseCost *
            Math.pow(2, map[u.id] || 0)
    }));

    return json(res, 200, {
        success: true,
        upgrades
    });
}

async function upgradeCeo(req, res, player) {
    const b = await body(req);
    const upgradeId = String(b.upgradeId || b.id || '');

    const u = CEO_UPGRADES.find(x => x.id === upgradeId);

    if (!u) {
        return error(res, 404, 'CEO upgrade not found');
    }

    const result = await query(
        `
        SELECT level
        FROM ceo_upgrades
        WHERE player_id=$1 AND upgrade_id=$2
        `,
        [player.id, upgradeId]
    );

    const current = num(result.rows[0]?.level);

    if (current >= u.max) {
        return error(res, 400, 'Upgrade is already at maximum');
    }

    const cost = u.baseCost * Math.pow(2, current);

    if (num(player.cash) < cost) {
        return error(res, 400, 'Not enough cash');
    }

    await transaction(async client => {
        await client.query(
            `
            UPDATE players
            SET cash=cash-$1,total_expenses=total_expenses+$1
            WHERE id=$2
            `,
            [cost, player.id]
        );

        await client.query(
            `
            INSERT INTO ceo_upgrades(player_id,upgrade_id,level)
            VALUES($1,$2,$3)
            ON CONFLICT(player_id,upgrade_id)
            DO UPDATE SET level=EXCLUDED.level
            `,
            [player.id, upgradeId, current + 1]
        );
    });

    return json(res, 200, {
        success: true,
        upgradeId,
        level: current + 1,
        cost
    });
}

/* =========================================================
   COLLECTIONS
========================================================= */

const COLLECTIONS = [
    {
        id: 'transport_collection',
        name: 'Transport Collection',
        category: 'transportation',
        count: 5,
        reward: 500000
    },
    {
        id: 'business_collection',
        name: 'Business Collection',
        category: 'businesses',
        count: 5,
        reward: 1000000
    },
    {
        id: 'world_collection',
        name: 'World Collection',
        category: 'resources',
        count: 3,
        reward: 5000000
    }
];

async function collections(req, res, player) {
    const output = [];

    for (const c of COLLECTIONS) {
        let count = 0;

        if (c.id === 'world_collection') {
            const r = await query(
                `
                SELECT COUNT(*)::int AS count
                FROM world_sites
                WHERE owner_id=$1
                `,
                [player.id]
            );

            count = num(r.rows[0].count);
        } else {
            const r = await query(
                `
                SELECT COALESCE(SUM(quantity),0)::int AS count
                FROM player_assets
                WHERE player_id=$1 AND category=$2
                `,
                [player.id, c.category]
            );

            count = num(r.rows[0].count);
        }

        const claimed = await query(
            `
            SELECT claimed
            FROM collections
            WHERE player_id=$1 AND collection_id=$2
            `,
            [player.id, c.id]
        );

        output.push({
            ...c,
            progress: count,
            completed: count >= c.count,
            claimed: claimed.rows[0]?.claimed || false
        });
    }

    return json(res, 200, {
        success: true,
        collections: output
    });
}

async function claimCollection(req, res, player) {
    const b = await body(req);
    const collectionId = String(b.collectionId || b.id || '');

    const c = COLLECTIONS.find(x => x.id === collectionId);

    if (!c) {
        return error(res, 404, 'Collection not found');
    }

    const result = await query(
        `
        SELECT claimed
        FROM collections
        WHERE player_id=$1 AND collection_id=$2
        `,
        [player.id, collectionId]
    );

    if (result.rows[0]?.claimed) {
        return error(res, 400, 'Collection reward already claimed');
    }

    let count = 0;

    if (c.id === 'world_collection') {
        const r = await query(
            `
            SELECT COUNT(*)::int AS count
            FROM world_sites
            WHERE owner_id=$1
            `,
            [player.id]
        );

        count = num(r.rows[0].count);
    } else {
        const r = await query(
            `
            SELECT COALESCE(SUM(quantity),0)::int AS count
            FROM player_assets
            WHERE player_id=$1 AND category=$2
            `,
            [player.id, c.category]
        );

        count = num(r.rows[0].count);
    }

    if (count < c.count) {
        return error(res, 400, 'Collection is not completed');
    }

    await transaction(async client => {
        await client.query(
            `
            INSERT INTO collections(player_id,collection_id,claimed)
            VALUES($1,$2,TRUE)
            ON CONFLICT(player_id,collection_id)
            DO UPDATE SET claimed=TRUE
            `,
            [player.id, collectionId]
        );

        await client.query(
            `
            UPDATE players
            SET cash=cash+$1,total_income=total_income+$1
            WHERE id=$2
            `,
            [c.reward, player.id]
        );
    });

    return json(res, 200, {
        success: true,
        reward: c.reward
    });
}

/* =========================================================
   SPECIAL ITEMS
========================================================= */

async function specialItems(req, res, player) {
    const owned = await query(
        `
        SELECT item_id,quantity
        FROM special_items
        WHERE player_id=$1
        `,
        [player.id]
    );

    const map = {};

    for (const x of owned.rows) {
        map[x.item_id] = num(x.quantity);
    }

    return json(res, 200, {
        success: true,
        items: SPECIAL_ITEMS.map(x => ({
            ...x,
            owned: map[x.id] || 0
        }))
    });
}

async function buySpecialItem(req, res, player) {
    const b = await body(req);
    const itemId = String(b.itemId || b.id || '');

    const item = SPECIAL_ITEMS.find(x => x.id === itemId);

    if (!item) {
        return error(res, 404, 'Special item not found');
    }

    if (num(player.cash) < item.price) {
        return error(res, 400, 'Not enough cash');
    }

    await transaction(async client => {
        await client.query(
            `
            UPDATE players
            SET cash=cash-$1,total_expenses=total_expenses+$1
            WHERE id=$2
            `,
            [item.price, player.id]
        );

        await client.query(
            `
            INSERT INTO special_items(player_id,item_id,quantity)
            VALUES($1,$2,1)
            ON CONFLICT(player_id,item_id)
            DO UPDATE SET quantity=special_items.quantity+1
            `,
            [player.id, itemId]
        );
    });

    return json(res, 200, {
        success: true,
        item,
        player: await playerSummary(player.id)
    });
}

/* =========================================================
   STOCK MARKET
========================================================= */

async function updateStockPrices() {
    const stocks = await query(
        `SELECT symbol,price,updated_at FROM stocks`
    );

    for (const s of stocks.rows) {
        const updated = new Date(s.updated_at).getTime();

        if (Date.now() - updated < 10 * 60 * 1000) {
            continue;
        }

        const current = num(s.price);

        const change =
            0.97 + Math.random() * 0.06;

        const next = clamp(
            current * change,
            1,
            1000000
        );

        await query(
            `
            UPDATE stocks
            SET price=$1,updated_at=NOW()
            WHERE symbol=$2
            `,
            [next, s.symbol]
        );
    }
}

async function stockMarket(req, res, player) {
    await updateStockPrices();

    const stocks = await query(
        `
        SELECT *
        FROM stocks
        ORDER BY symbol
        `
    );

    const owned = await query(
        `
        SELECT symbol,quantity,average_price
        FROM player_stocks
        WHERE player_id=$1
        `,
        [player.id]
    );

    const map = {};

    for (const s of owned.rows) {
        map[s.symbol] = s;
    }

    return json(res, 200, {
        success: true,
        stocks: stocks.rows.map(s => ({
            ...s,
            owned: map[s.symbol]?.quantity || 0,
            averagePrice: map[s.symbol]?.average_price || 0
        }))
    });
}

async function buyStock(req, res, player) {
    const b = await body(req);

    const symbol = String(b.symbol || '').toUpperCase();
    const quantity = Math.floor(num(b.quantity, 0));

    if (quantity < 1) {
        return error(res, 400, 'Invalid quantity');
    }

    const result = await query(
        `SELECT * FROM stocks WHERE symbol=$1`,
        [symbol]
    );

    if (!result.rows.length) {
        return error(res, 404, 'Stock not found');
    }

    const stock = result.rows[0];
    const cost = Math.round(num(stock.price) * quantity);

    if (num(player.cash) < cost) {
        return error(res, 400, 'Not enough cash');
    }

    const existing = await query(
        `
        SELECT quantity,average_price
        FROM player_stocks
        WHERE player_id=$1 AND symbol=$2
        `,
        [player.id, symbol]
    );

    const oldQty = num(existing.rows[0]?.quantity);
    const oldAverage = num(existing.rows[0]?.average_price);

    const newQty = oldQty + quantity;

    const newAverage =
        newQty === 0
            ? 0
            : (
                (oldQty * oldAverage) +
                (quantity * num(stock.price))
            ) / newQty;

    await transaction(async client => {
        await client.query(
            `
            UPDATE players
            SET cash=cash-$1,total_expenses=total_expenses+$1
            WHERE id=$2
            `,
            [cost, player.id]
        );

        await client.query(
            `
            INSERT INTO player_stocks
            (player_id,symbol,quantity,average_price)
            VALUES($1,$2,$3,$4)
            ON CONFLICT(player_id,symbol)
            DO UPDATE SET
                quantity=EXCLUDED.quantity,
                average_price=EXCLUDED.average_price
            `,
            [
                player.id,
                symbol,
                newQty,
                newAverage
            ]
        );
    });

    return json(res, 200, {
        success: true,
        symbol,
        quantity,
        cost
    });
}

async function sellStock(req, res, player) {
    const b = await body(req);

    const symbol = String(b.symbol || '').toUpperCase();
    const quantity = Math.floor(num(b.quantity, 0));

    if (quantity < 1) {
        return error(res, 400, 'Invalid quantity');
    }

    const stock = await query(
        `SELECT * FROM stocks WHERE symbol=$1`,
        [symbol]
    );

    if (!stock.rows.length) {
        return error(res, 404, 'Stock not found');
    }

    const holding = await query(
        `
        SELECT quantity
        FROM player_stocks
        WHERE player_id=$1 AND symbol=$2
        `,
        [player.id, symbol]
    );

    const owned = num(holding.rows[0]?.quantity);

    if (owned < quantity) {
        return error(res, 400, 'Not enough shares');
    }

    const proceeds =
        Math.round(num(stock.rows[0].price) * quantity);

    await transaction(async client => {
        await client.query(
            `
            UPDATE players
            SET cash=cash+$1,total_income=total_income+$1
            WHERE id=$2
            `,
            [proceeds, player.id]
        );

        await client.query(
            `
            UPDATE player_stocks
            SET quantity=quantity-$1
            WHERE player_id=$2 AND symbol=$3
            `,
            [quantity, player.id, symbol]
        );
    });

    return json(res, 200, {
        success: true,
        symbol,
        quantity,
        proceeds
    });
}

/* =========================================================
   PRODUCTION
========================================================= */

async function production(req, res, player) {
    await completeProduction(player.id);

    const result = await query(
        `
        SELECT *
        FROM production_orders
        WHERE player_id=$1
        ORDER BY started_at DESC
        LIMIT 100
        `,
        [player.id]
    );

    return json(res, 200, {
        success: true,
        orders: result.rows
    });
}

async function completeProduction(playerId) {
    const result = await query(
        `
        SELECT *
        FROM production_orders
        WHERE player_id=$1
          AND status='running'
          AND ends_at<=NOW()
        `,
        [playerId]
    );

    for (const order of result.rows) {
        const updated = await query(
            `
            UPDATE production_orders
            SET status='completed'
            WHERE id=$1 AND status='running'
            RETURNING *
            `,
            [order.id]
        );

        if (!updated.rows.length) continue;

        await query(
            `
            UPDATE players
            SET cash=cash+$1,total_income=total_income+$1,xp=xp+$2
            WHERE id=$3
            `,
            [
                num(order.reward),
                Math.max(1, Math.floor(num(order.reward) / 1000)),
                playerId
            ]
        );
    }

    await updateLevel(playerId);
}

async function productionOrder(req, res, player) {
    const b = await body(req);

    const product = safeName(
        b.product || b.name || 'Manufactured Goods',
        'Manufactured Goods'
    );

    const quantity = clamp(
        Math.floor(num(b.quantity, 1)),
        1,
        100000
    );

    const costPerUnit = Math.max(
        100,
        Math.floor(num(b.costPerUnit, 1000))
    );

    const rewardPerUnit = Math.max(
        costPerUnit + 100,
        Math.floor(num(b.rewardPerUnit, costPerUnit * 1.25))
    );

    const cost = costPerUnit * quantity;
    const reward = rewardPerUnit * quantity;

    if (num(player.cash) < cost) {
        return error(res, 400, 'Not enough cash');
    }

    const durationMinutes =
        Math.max(5, Math.min(1440, quantity));

    await transaction(async client => {
        await client.query(
            `
            UPDATE players
            SET cash=cash-$1,total_expenses=total_expenses+$1
            WHERE id=$2
            `,
            [cost, player.id]
        );

        await client.query(
            `
            INSERT INTO production_orders
            (id,player_id,product,quantity,cost,reward,ends_at)
            VALUES
            ($1,$2,$3,$4,$5,$6,NOW()+($7 * INTERVAL '1 minute'))
            `,
            [
                id(),
                player.id,
                product,
                quantity,
                cost,
                reward,
                durationMinutes
            ]
        );
    });

    return json(res, 201, {
        success: true,
        product,
        quantity,
        cost,
        reward,
        durationMinutes
    });
}

/* =========================================================
   SPACE
========================================================= */

async function space(req, res, player) {
    await query(
        `
        INSERT INTO space_program(player_id)
        VALUES($1)
        ON CONFLICT(player_id) DO NOTHING
        `,
        [player.id]
    );

    const result = await query(
        `
        SELECT *
        FROM space_program
        WHERE player_id=$1
        `,
        [player.id]
    );

    const p = result.rows[0];

    return json(res, 200, {
        success: true,
        program: p,
        levels: SPACE_LEVELS
    });
}

async function spaceUpgrade(req, res, player) {
    await query(
        `
        INSERT INTO space_program(player_id)
        VALUES($1)
        ON CONFLICT(player_id) DO NOTHING
        `,
        [player.id]
    );

    const result = await query(
        `
        SELECT *
        FROM space_program
        WHERE player_id=$1
        `,
        [player.id]
    );

    const current = num(result.rows[0].level);

    if (current >= SPACE_LEVELS.length) {
        return error(res, 400, 'Space program is at maximum level');
    }

    const next = SPACE_LEVELS[current];
    const cost = next.cost;

    if (num(player.cash) < cost) {
        return error(res, 400, 'Not enough cash');
    }

    await transaction(async client => {
        await client.query(
            `
            UPDATE players
            SET cash=cash-$1,total_expenses=total_expenses+$1
            WHERE id=$2
            `,
            [cost, player.id]
        );

        await client.query(
            `
            UPDATE space_program
            SET level=level+1,
                research=research+$2
            WHERE player_id=$1
            `,
            [player.id, current * 100]
        );
    });

    return json(res, 200, {
        success: true,
        newLevel: current + 1,
        cost
    });
}

/* =========================================================
   CONGRESS
========================================================= */

async function congress(req, res) {
    const result = await query(
        `
        SELECT
            r.id,
            r.creator_id,
            r.title,
            r.description,
            r.yes_votes,
            r.no_votes,
            r.active,
            r.created_at,
            p.username AS creator
        FROM congress_resolutions r
        JOIN players p ON p.id=r.creator_id
        WHERE r.active=TRUE
        ORDER BY r.created_at DESC
        LIMIT 50
        `
    );

    return json(res, 200, {
        success: true,
        resolutions: result.rows
    });
}

async function createResolution(req, res, player) {
    const b = await body(req);

    const title = safeName(
        b.title || b.name,
        ''
    );

    const description = String(
        b.description || ''
    ).substring(0, 1000);

    if (!title) {
        return error(res, 400, 'Resolution title is required');
    }

    const resolutionId = id();

    await query(
        `
        INSERT INTO congress_resolutions
        (id,creator_id,title,description)
        VALUES($1,$2,$3,$4)
        `,
        [
            resolutionId,
            player.id,
            title,
            description
        ]
    );

    return json(res, 201, {
        success: true,
        resolutionId
    });
}

async function voteResolution(req, res, player) {
    const b = await body(req);

    const resolutionId = String(
        b.resolutionId || b.id || ''
    );

    const vote =
        b.vote === true ||
        b.vote === 'true' ||
        b.vote === 'yes';

    const resolution = await query(
        `
        SELECT *
        FROM congress_resolutions
        WHERE id=$1 AND active=TRUE
        `,
        [resolutionId]
    );

    if (!resolution.rows.length) {
        return error(res, 404, 'Resolution not found');
    }

    const existing = await query(
        `
        SELECT *
        FROM congress_votes
        WHERE resolution_id=$1 AND player_id=$2
        `,
        [resolutionId, player.id]
    );

    if (existing.rows.length) {
        return error(res, 400, 'You already voted');
    }

    await transaction(async client => {
        await client.query(
            `
            INSERT INTO congress_votes
            (resolution_id,player_id,vote)
            VALUES($1,$2,$3)
            `,
            [resolutionId, player.id, vote]
        );

        if (vote) {
            await client.query(
                `
                UPDATE congress_resolutions
                SET yes_votes=yes_votes+1
                WHERE id=$1
                `,
                [resolutionId]
            );
        } else {
            await client.query(
                `
                UPDATE congress_resolutions
                SET no_votes=no_votes+1
                WHERE id=$1
                `,
                [resolutionId]
            );
        }
    });

    return json(res, 200, {
        success: true,
        vote
    });
}

/* =========================================================
   RESEARCH
========================================================= */

async function research(req, res, player) {
    await query(
        `
        INSERT INTO research(player_id)
        VALUES($1)
        ON CONFLICT(player_id) DO NOTHING
        `,
        [player.id]
    );

    const result = await query(
        `
        SELECT *
        FROM research
        WHERE player_id=$1
        `,
        [player.id]
    );

    return json(res, 200, {
        success: true,
        research: result.rows[0]
    });
}

async function researchUpgrade(req, res, player) {
    await query(
        `
        INSERT INTO research(player_id)
        VALUES($1)
        ON CONFLICT(player_id) DO NOTHING
        `,
        [player.id]
    );

    const result = await query(
        `SELECT * FROM research WHERE player_id=$1`,
        [player.id]
    );

    const r = result.rows[0];
    const nextLevel = num(r.technology_level) + 1;
    const cost = nextLevel * 250000;

    if (num(player.cash) < cost) {
        return error(res, 400, 'Not enough cash');
    }

    await transaction(async client => {
        await client.query(
            `
            UPDATE players
            SET cash=cash-$1,total_expenses=total_expenses+$1
            WHERE id=$2
            `,
            [cost, player.id]
        );

        await client.query(
            `
            UPDATE research
            SET technology_level=technology_level+1,
                research_points=research_points+$2
            WHERE player_id=$1
            `,
            [player.id, nextLevel * 100]
        );
    });

    return json(res, 200, {
        success: true,
        technologyLevel: nextLevel,
        cost
    });
}

/* =========================================================
   MISSIONS
========================================================= */

async function missions(req, res, player) {
    const missionList = [
        {
            id: 'mission_buy_business',
            name: 'First Business',
            description: 'Own at least one business.',
            target: 1,
            reward: 25000
        },
        {
            id: 'mission_buy_transport',
            name: 'Start Transportation',
            description: 'Own at least one transportation asset.',
            target: 1,
            reward: 50000
        },
        {
            id: 'mission_world_site',
            name: 'Enter Resource Industry',
            description: 'Own a world resource site.',
            target: 1,
            reward: 250000
        }
    ];

    const output = [];

    for (const m of missionList) {
        let progress = 0;

        if (m.id === 'mission_buy_business') {
            const r = await query(
                `
                SELECT COALESCE(SUM(quantity),0)::int AS count
                FROM player_assets
                WHERE player_id=$1 AND category='businesses'
                `,
                [player.id]
            );

            progress = num(r.rows[0].count);
        }

        if (m.id === 'mission_buy_transport') {
            const r = await query(
                `
                SELECT COALESCE(SUM(quantity),0)::int AS count
                FROM player_assets
                WHERE player_id=$1 AND category='transportation'
                `,
                [player.id]
            );

            progress = num(r.rows[0].count);
        }

        if (m.id === 'mission_world_site') {
            const r = await query(
                `
                SELECT COUNT(*)::int AS count
                FROM world_sites
                WHERE owner_id=$1
                `,
                [player.id]
            );

            progress = num(r.rows[0].count);
        }

        output.push({
            ...m,
            progress,
            completed: progress >= m.target
        });
    }

    return json(res, 200, {
        success: true,
        missions: output
    });
}

/* =========================================================
   MEGA PROJECTS
========================================================= */

async function megaProjects(req, res, player) {
    const result = await query(
        `
        SELECT *
        FROM mega_projects
        WHERE player_id=$1
        ORDER BY id
        `,
        [player.id]
    );

    return json(res, 200, {
        success: true,
        projects: result.rows
    });
}

async function createMegaProject(req, res, player) {
    const b = await body(req);

    const name = safeName(
        b.name || 'Mega Project',
        'Mega Project'
    );

    const target = Math.max(
        1000000,
        Math.floor(num(b.target, 10000000))
    );

    const projectId = id();

    await query(
        `
        INSERT INTO mega_projects
        (id,player_id,name,target)
        VALUES($1,$2,$3,$4)
        `,
        [projectId, player.id, name, target]
    );

    return json(res, 201, {
        success: true,
        projectId
    });
}

async function investMegaProject(req, res, player) {
    const b = await body(req);

    const projectId = String(
        b.projectId || b.id || ''
    );

    const amount = Math.floor(num(b.amount));

    if (amount <= 0) {
        return error(res, 400, 'Invalid investment');
    }

    const project = await query(
        `
        SELECT *
        FROM mega_projects
        WHERE id=$1 AND player_id=$2
        `,
        [projectId, player.id]
    );

    if (!project.rows.length) {
        return error(res, 404, 'Project not found');
    }

    if (num(player.cash) < amount) {
        return error(res, 400, 'Not enough cash');
    }

    const p = project.rows[0];
    const newInvested =
        num(p.invested) + amount;

    await transaction(async client => {
        await client.query(
            `
            UPDATE players
            SET cash=cash-$1,total_expenses=total_expenses+$1
            WHERE id=$2
            `,
            [amount, player.id]
        );

        await client.query(
            `
            UPDATE mega_projects
            SET invested=$1,
                completed=CASE WHEN $1>=target THEN TRUE ELSE completed END
            WHERE id=$2
            `,
            [newInvested, projectId]
        );
    });

    return json(res, 200, {
        success: true,
        invested: newInvested
    });
}

/* =========================================================
   PLAYER PROFILE
========================================================= */

async function getMe(req, res, player) {
    return json(res, 200, {
        success: true,
        player: await playerSummary(player.id)
    });
}

async function updateProfile(req, res, player) {
    const b = await body(req);

    const companyName = safeName(
        b.companyName || b.company,
        player.company_name
    );

    const countryId = String(
        b.countryId || b.country || player.country_id
    );

    if (!COUNTRIES.some(c => c.id === countryId)) {
        return error(res, 400, 'Invalid country');
    }

    await query(
        `
        UPDATE players
        SET company_name=$1,country_id=$2
        WHERE id=$3
        `,
        [companyName, countryId, player.id]
    );

    return json(res, 200, {
        success: true,
        player: await playerSummary(player.id)
    });
}

/* =========================================================
   ROUTER
========================================================= */

async function route(req, res) {
    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
        });

        return res.end();
    }

    const url = new URL(
        req.url,
        `http://${req.headers.host || 'localhost'}`
    );

    const path = url.pathname;

    try {
        /* ---------- PUBLIC ---------- */

        if (req.method === 'GET' && path === '/') {
            return json(res, 200, {
                success: true,
                name: 'Tycoon Empire Server',
                version: VERSION,
                status: 'online'
            });
        }

        if (req.method === 'GET' && path === '/health') {
            try {
                await query('SELECT 1');

                return json(res, 200, {
                    success: true,
                    status: 'ok',
                    version: VERSION,
                    database: 'connected'
                });
            } catch (e) {
                return json(res, 503, {
                    success: false,
                    status: 'database_error',
                    version: VERSION,
                    error: e.message
                });
            }
        }

        if (
            req.method === 'POST' &&
            path === '/api/auth/register'
        ) {
            return register(req, res);
        }

        if (
            req.method === 'POST' &&
            path === '/api/auth/login'
        ) {
            return login(req, res);
        }

        /* ---------- AUTHENTICATED ---------- */

        const player = await authPlayer(req);

        if (!player) {
            return error(res, 401, 'Authentication required');
        }

        /* ---------- PLAYER ---------- */

        if (
            req.method === 'GET' &&
            path === '/api/players/me'
        ) {
            return getMe(req, res, player);
        }

        if (
            req.method === 'POST' &&
            path === '/api/players/profile'
        ) {
            return updateProfile(req, res, player);
        }

        if (
            req.method === 'GET' &&
            path === '/api/assets'
        ) {
            return assets(req, res, player);
        }

        if (
            req.method === 'POST' &&
            path === '/api/assets/buy'
        ) {
            return buy(req, res, player);
        }

        /* ---------- WORLD ---------- */

        if (
            req.method === 'GET' &&
            path === '/api/world/sites'
        ) {
            return worldSites(req, res, player);
        }

        if (
            req.method === 'POST' &&
            path === '/api/world/sites/claim'
        ) {
            return claimWorldSite(req, res, player);
        }

        /* ---------- RANKINGS ---------- */

        if (
            req.method === 'GET' &&
            (
                path === '/api/rankings' ||
                path === '/api/rankings/global'
            )
        ) {
            return rankings(req, res);
        }

        /* ---------- LOANS ---------- */

        if (
            req.method === 'GET' &&
            path === '/api/loans'
        ) {
            return loans(req, res, player);
        }

        if (
            req.method === 'POST' &&
            path === '/api/loans/take'
        ) {
            return takeLoan(req, res, player);
        }

        /* ---------- CONTRACTS ---------- */

        if (
            req.method === 'GET' &&
            path === '/api/contracts'
        ) {
            return contracts(req, res);
        }

        if (
            req.method === 'GET' &&
            path === '/api/contracts/running'
        ) {
            return runningContracts(req, res, player);
        }

        if (
            req.method === 'GET' &&
            path === '/api/contracts/bids/ranking'
        ) {
            return contractBidRanking(req, res);
        }

        if (
            req.method === 'POST' &&
            (
                path === '/api/contracts/bid' ||
                path === '/api/contracts/bids'
            )
        ) {
            return bidContract(req, res, player);
        }

        /* ---------- ALLIANCES ---------- */

        if (
            req.method === 'GET' &&
            path === '/api/alliances'
        ) {
            return alliances(req, res);
        }

        if (
            req.method === 'POST' &&
            (
                path === '/api/alliances' ||
                path === '/api/alliances/create'
            )
        ) {
            return createAlliance(req, res, player);
        }

        /* ---------- CHAT ---------- */

        if (
            req.method === 'GET' &&
            path === '/api/chat'
        ) {
            return getChat(req, res);
        }

        if (
            req.method === 'POST' &&
            path === '/api/chat'
        ) {
            return sendChat(req, res, player);
        }

        /* ---------- ARMY ---------- */

        if (
            req.method === 'GET' &&
            path === '/api/army'
        ) {
            return army(req, res, player);
        }

        if (
            req.method === 'POST' &&
            (
                path === '/api/army/upgrade' ||
                path === '/api/army/update'
            )
        ) {
            return upgradeArmy(req, res, player);
        }

        /* ---------- WARS ---------- */

        if (
            req.method === 'POST' &&
            path === '/api/wars'
        ) {
            return wars(req, res, player);
        }

        if (
            req.method === 'GET' &&
            path === '/api/wars'
        ) {
            const result = await query(
                `
                SELECT *
                FROM wars
                WHERE attacker_id=$1 OR defender_id=$1
                ORDER BY created_at DESC
                LIMIT 100
                `,
                [player.id]
            );

            return json(res, 200, {
                success: true,
                wars: result.rows
            });
        }

        /* ---------- COUNTRY RELATIONS ---------- */

        if (
            req.method === 'GET' &&
            path === '/api/country-relations'
        ) {
            return countryRelations(req, res, player);
        }

        if (
            req.method === 'POST' &&
            path === '/api/country-relations/improve'
        ) {
            return improveCountryRelation(req, res, player);
        }

        /* ---------- MARKETING ---------- */

        if (
            req.method === 'GET' &&
            path === '/api/marketing'
        ) {
            return marketing(req, res, player);
        }

        if (
            req.method === 'POST' &&
            path === '/api/marketing/campaign'
        ) {
            return marketingCampaign(req, res, player);
        }

        /* ---------- BUSINESS CENTER ---------- */

        if (
            req.method === 'GET' &&
            path === '/api/business-center'
        ) {
            return businessCenter(req, res, player);
        }

        /* ---------- CHALLENGES ---------- */

        if (
            req.method === 'GET' &&
            path === '/api/challenges'
        ) {
            return challenges(req, res, player);
        }

        if (
            req.method === 'POST' &&
            path === '/api/challenges/claim'
        ) {
            return claimChallenge(req, res, player);
        }

        /* ---------- CEO ---------- */

        if (
            req.method === 'GET' &&
            path === '/api/ceo'
        ) {
            return ceo(req, res, player);
        }

        if (
            req.method === 'POST' &&
            path === '/api/ceo/upgrade'
        ) {
            return upgradeCeo(req, res, player);
        }

        /* ---------- COLLECTIONS ---------- */

        if (
            req.method === 'GET' &&
            path === '/api/collections'
        ) {
            return collections(req, res, player);
        }

        if (
            req.method === 'POST' &&
            path === '/api/collections/claim'
        ) {
            return claimCollection(req, res, player);
        }

        /* ---------- SPECIAL ITEMS ---------- */

        if (
            req.method === 'GET' &&
            path === '/api/special-items'
        ) {
            return specialItems(req, res, player);
        }

        if (
            req.method === 'POST' &&
            path === '/api/special-items/buy'
        ) {
            return buySpecialItem(req, res, player);
        }

        /* ---------- STOCK MARKET ---------- */

        if (
            req.method === 'GET' &&
            path === '/api/stock-market'
        ) {
            return stockMarket(req, res, player);
        }

        if (
            req.method === 'POST' &&
            path === '/api/stock-market/buy'
        ) {
            return buyStock(req, res, player);
        }

        if (
            req.method === 'POST' &&
            path === '/api/stock-market/sell'
        ) {
            return sellStock(req, res, player);
        }

        /* ---------- PRODUCTION ---------- */

        if (
            req.method === 'GET' &&
            path === '/api/production'
        ) {
            return production(req, res, player);
        }

        if (
            req.method === 'POST' &&
            path === '/api/production/order'
        ) {
            return productionOrder(req, res, player);
        }

        /* ---------- SPACE ---------- */

        if (
            req.method === 'GET' &&
            path === '/api/space'
        ) {
            return space(req, res, player);
        }

        if (
            req.method === 'POST' &&
            path === '/api/space/upgrade'
        ) {
            return spaceUpgrade(req, res, player);
        }

        /* ---------- CONGRESS ---------- */

        if (
            req.method === 'GET' &&
            path === '/api/congress'
        ) {
            return congress(req, res);
        }

        if (
            req.method === 'POST' &&
            path === '/api/congress/create'
        ) {
            return createResolution(req, res, player);
        }

        if (
            req.method === 'POST' &&
            path === '/api/congress/vote'
        ) {
            return voteResolution(req, res, player);
        }

        /* ---------- RESEARCH ---------- */

        if (
            req.method === 'GET' &&
            path === '/api/research'
        ) {
            return research(req, res, player);
        }

        if (
            req.method === 'POST' &&
            (
                path === '/api/research/upgrade' ||
                path === '/api/research'
            )
        ) {
            return researchUpgrade(req, res, player);
        }

        /* ---------- MISSIONS ---------- */

        if (
            req.method === 'GET' &&
            path === '/api/missions'
        ) {
            return missions(req, res, player);
        }

        /* ---------- MEGA PROJECTS ---------- */

        if (
            req.method === 'GET' &&
            path === '/api/mega-projects'
        ) {
            return megaProjects(req, res, player);
        }

        if (
            req.method === 'POST' &&
            path === '/api/mega-projects/create'
        ) {
            return createMegaProject(req, res, player);
        }

        if (
            req.method === 'POST' &&
            path === '/api/mega-projects/invest'
        ) {
            return investMegaProject(req, res, player);
        }

        /* ---------- INCOME ---------- */

        if (
            req.method === 'GET' &&
            path === '/api/income'
        ) {
            const income = await processIncome(player.id);

            return json(res, 200, {
                success: true,
                ...income,
                player: await playerSummary(player.id)
            });
        }

        /* ---------- COUNTRIES ---------- */

        if (
            req.method === 'GET' &&
            path === '/api/countries'
        ) {
            return json(res, 200, {
                success: true,
                countries: COUNTRIES
            });
        }

        return error(
            res,
            404,
            `Endpoint not found: ${req.method} ${path}`
        );

    } catch (e) {
        console.error('REQUEST ERROR:', e);

        return error(
            res,
            500,
            'Server error',
            {
                details:
                    process.env.NODE_ENV === 'production'
                        ? undefined
                        : e.message
            }
        );
    }
}

/* =========================================================
   SERVER START
========================================================= */

async function start() {
    try {
        await query('SELECT 1');

        await initDatabase();

        const server = http.createServer(route);

        server.listen(PORT, '0.0.0.0', () => {
            console.log('======================================');
            console.log('TYCOON EMPIRE SERVER');
            console.log(`VERSION: ${VERSION}`);
            console.log(`PORT: ${PORT}`);
            console.log('DATABASE: PostgreSQL');
            console.log('STATUS: ONLINE');
            console.log('======================================');
        });

        process.on('SIGTERM', async () => {
            console.log('SIGTERM received.');

            server.close(async () => {
                await pool.end();
                process.exit(0);
            });
        });

        process.on('SIGINT', async () => {
            console.log('SIGINT received.');

            server.close(async () => {
                await pool.end();
                process.exit(0);
            });
        });

    } catch (e) {
        console.error('SERVER START FAILED:');
        console.error(e);
        process.exit(1);
    }
}

start();
