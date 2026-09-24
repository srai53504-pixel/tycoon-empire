'use strict';

const express = require('express');
const { Pool } = require('pg');

const app = express();

const PORT = Number(process.env.PORT || 10000);

if (!process.env.DATABASE_URL) {
    console.error('ERROR: DATABASE_URL is missing');
    process.exit(1);
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
});

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization'
    );
    res.setHeader(
        'Access-Control-Allow-Methods',
        'GET,POST,PUT,OPTIONS'
    );

    if (req.method === 'OPTIONS') {
        return res.sendStatus(204);
    }

    next();
});


/* =========================================================
   HELPERS
========================================================= */

async function query(sql, params = []) {
    return pool.query(sql, params);
}

function param(req, name, fallback = '') {
    if (req.query && req.query[name] !== undefined) {
        return req.query[name];
    }

    if (req.body && req.body[name] !== undefined) {
        return req.body[name];
    }

    return fallback;
}

function number(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function success(res, data = {}) {
    return res.json({
        result: 'success',
        ...data
    });
}

function failure(res, message, status = 400) {
    return res.status(status).json({
        result: 'error',
        error: message
    });
}


/* =========================================================
   DATABASE
========================================================= */

let playerIdIsNumeric = false;
let playerIdType = 'TEXT';


async function detectPlayerIdType() {

    const result = await query(`
        SELECT data_type, udt_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'players'
        AND column_name = 'id'
        LIMIT 1
    `);

    if (!result.rows.length) {
        playerIdType = 'TEXT';
        playerIdIsNumeric = false;
        return;
    }

    const type = String(result.rows[0].data_type).toLowerCase();
    const udt = String(result.rows[0].udt_name).toLowerCase();

    playerIdIsNumeric =
        type === 'bigint' ||
        type === 'integer' ||
        type === 'smallint' ||
        udt === 'int8' ||
        udt === 'int4' ||
        udt === 'int2';

    playerIdType = playerIdIsNumeric ? 'BIGINT' : 'TEXT';

    console.log('Player ID type:', playerIdType);
}


async function columnExists(column) {

    const result = await query(`
        SELECT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = 'players'
            AND column_name = $1
        ) AS exists
    `, [column]);

    return result.rows[0].exists;
}


async function ensureColumn(column, definition) {

    if (!(await columnExists(column))) {

        await query(
            `ALTER TABLE players ADD COLUMN "${column}" ${definition}`
        );
    }
}


async function initializeDatabase() {

    console.log('Initializing PostgreSQL...');

    /*
     * If your players table already exists,
     * PostgreSQL will keep the existing table.
     */

    await query(`
        CREATE TABLE IF NOT EXISTS players (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            email TEXT,
            password_hash TEXT DEFAULT '',
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

    await detectPlayerIdType();

    await ensureColumn(
        'email',
        'TEXT'
    );

    await ensureColumn(
        'password_hash',
        `TEXT DEFAULT ''`
    );

    await ensureColumn(
        'company_name',
        `TEXT NOT NULL DEFAULT 'New Company'`
    );

    await ensureColumn(
        'country_id',
        `TEXT NOT NULL DEFAULT 'india'`
    );

    await ensureColumn(
        'cash',
        `BIGINT NOT NULL DEFAULT 100000`
    );

    await ensureColumn(
        'level',
        `INTEGER NOT NULL DEFAULT 1`
    );

    await ensureColumn(
        'xp',
        `BIGINT NOT NULL DEFAULT 0`
    );

    await ensureColumn(
        'total_income',
        `BIGINT NOT NULL DEFAULT 0`
    );

    await ensureColumn(
        'total_expenses',
        `BIGINT NOT NULL DEFAULT 0`
    );

    await ensureColumn(
        'last_income_at',
        `TIMESTAMPTZ NOT NULL DEFAULT NOW()`
    );

    await ensureColumn(
        'created_at',
        `TIMESTAMPTZ NOT NULL DEFAULT NOW()`
    );

    await query(`
        CREATE TABLE IF NOT EXISTS player_assets (
            id TEXT PRIMARY KEY,
            player_id ${playerIdType} NOT NULL,
            category TEXT NOT NULL,
            asset_id TEXT NOT NULL,
            quantity INTEGER NOT NULL DEFAULT 0,
            UNIQUE(player_id, category, asset_id)
        )
    `);

    console.log('PostgreSQL initialization complete.');
}


/* =========================================================
   PLAYER ID
========================================================= */

async function nextPlayerId() {

    if (playerIdIsNumeric) {

        const result = await query(`
            SELECT COALESCE(MAX(id), 0) + 1 AS next_id
            FROM players
        `);

        return String(result.rows[0].next_id);
    }

    const result = await query(`
        SELECT COALESCE(
            MAX(
                CASE
                    WHEN id ~ '^[0-9]+$'
                    THEN id::bigint
                    ELSE 0
                END
            ), 0
        ) + 1 AS next_id
        FROM players
    `);

    return String(result.rows[0].next_id);
}


/* =========================================================
   GET PLAYER
========================================================= */

async function getPlayer(id) {

    const result = await query(`
        SELECT *
        FROM players
        WHERE id::text = $1
        LIMIT 1
    `, [String(id)]);

    if (!result.rows.length) {
        return null;
    }

    return result.rows[0];
}


/* =========================================================
   GLOBAL RANKING
========================================================= */

async function getPlayerRanking(playerId) {

    const result = await query(`
        WITH ranked AS (
            SELECT
                id,
                company_name,
                cash,
                level,
                xp,

                RANK() OVER (
                    ORDER BY
                        cash DESC,
                        xp DESC,
                        id ASC
                ) AS world_rank,

                COUNT(*) OVER () AS total_companies

            FROM players
        )

        SELECT
            world_rank,
            total_companies
        FROM ranked

        WHERE id::text = $1

        LIMIT 1
    `, [String(playerId)]);

    if (!result.rows.length) {

        return {
            ranking: 0,
            total_companies: 0
        };
    }

    return {
        ranking: Number(result.rows[0].world_rank),
        total_companies: Number(result.rows[0].total_companies)
    };
}


/* =========================================================
   GLOBAL TOP 100
========================================================= */

async function getGlobalRanking(limit = 100) {

    limit = Math.max(
        1,
        Math.min(500, Math.floor(number(limit, 100)))
    );

    const result = await query(`
        SELECT
            id,
            username,
            company_name,
            country_id,
            cash,
            level,
            xp,

            RANK() OVER (
                ORDER BY
                    cash DESC,
                    xp DESC,
                    id ASC
            ) AS world_rank,

            COUNT(*) OVER () AS total_companies

        FROM players

        ORDER BY
            cash DESC,
            xp DESC,
            id ASC

        LIMIT $1
    `, [limit]);

    return result.rows.map(row => ({
        rank: Number(row.world_rank),

        company_id: row.id,
        compnay_id: row.id,

        company_name: row.company_name,
        username: row.username,

        country: row.country_id,

        money: Number(row.cash),
        cash: Number(row.cash),

        level: Number(row.level),
        xp: Number(row.xp),

        total_companies:
            Number(row.total_companies)
    }));
}


/* =========================================================
   RESTSIMULATOR
   USED BY YOUR MODIFIED APK
========================================================= */

async function restSimulator(req, res) {

    const operation = String(
        param(req, 'Operation', '')
    ).trim();

    try {

        /* ---------------------------------------------
           SERVER CONFIGURATION
        --------------------------------------------- */

        if (operation === 'checkForConfigurationUpdate') {

            return success(res, {
                is_changed: false,

                server_ip:
                    'tycoon-empire-i40v.onrender.com',

                server_port: 443
            });
        }


        /* ---------------------------------------------
           REGISTER USER
        --------------------------------------------- */

        if (operation === 'RegisterUser') {

            const companyName = String(
                param(req, 'company_name', 'New Company')
            ).substring(0, 100);

            const country = String(
                param(req, 'country', 'India')
            ).substring(0, 80);

            const email = String(
                param(req, 'email', '')
            ).substring(0, 200);

            const money = Math.max(
                0,
                Math.floor(
                    number(
                        param(req, 'money', 100000),
                        100000
                    )
                )
            );

            const level = Math.max(
                1,
                Math.floor(
                    number(
                        param(req, 'level', 1),
                        1
                    )
                )
            );

            const xp = Math.max(
                0,
                Math.floor(
                    number(
                        param(req, 'xp', 0),
                        0
                    )
                )
            );

            const id = await nextPlayerId();

            await query(`
                INSERT INTO players (
                    id,
                    username,
                    email,
                    password_hash,
                    company_name,
                    country_id,
                    cash,
                    level,
                    xp,
                    total_income,
                    total_expenses
                )

                VALUES (
                    $1,
                    $2,
                    $3,
                    '',
                    $4,
                    $5,
                    $6,
                    $7,
                    $8,
                    0,
                    0
                )
            `, [
                id,
                `company_${id}`,
                email || null,
                companyName,
                country,
                money,
                level,
                xp
            ]);

            const ranking =
                await getPlayerRanking(id);

            /*
             * IMPORTANT:
             * "compnay_id" is intentionally misspelled.
             * Your original APK expects this field.
             */

            return success(res, {

                ranking:
                    ranking.ranking,

                total_companies:
                    ranking.total_companies,

                compnay_id:
                    playerIdIsNumeric
                        ? Number(id)
                        : id,

                company_id:
                    playerIdIsNumeric
                        ? Number(id)
                        : id,

                company_id_string:
                    String(id),

                referral_code:
                    String(id),

                company_name:
                    companyName,

                country:
                    country
            });
        }


        /* ---------------------------------------------
           GET USER DATA
        --------------------------------------------- */

        if (operation === 'getUserData') {

            const id = param(
                req,
                'company_id',
                param(req, 'compnay_id', '')
            );

            const player =
                await getPlayer(id);

            if (!player) {
                return failure(
                    res,
                    'user not found',
                    404
                );
            }

            const ranking =
                await getPlayerRanking(player.id);

            return success(res, {

                company_id:
                    playerIdIsNumeric
                        ? Number(player.id)
                        : player.id,

                compnay_id:
                    playerIdIsNumeric
                        ? Number(player.id)
                        : player.id,

                company_name:
                    player.company_name,

                country:
                    player.country_id,

                money:
                    Number(player.cash),

                cash:
                    Number(player.cash),

                net_worth:
                    Number(player.cash),

                level:
                    Number(player.level),

                xp:
                    Number(player.xp),

                ranking:
                    ranking.ranking,

                world_rank:
                    ranking.ranking,

                total_companies:
                    ranking.total_companies
            });
        }


        /* ---------------------------------------------
           UPDATE USER DATA
        --------------------------------------------- */

        if (operation === 'updateUserData') {

            const id = param(
                req,
                'company_id',
                param(req, 'compnay_id', '')
            );

            const player =
                await getPlayer(id);

            if (!player) {
                return failure(
                    res,
                    'user not found',
                    404
                );
            }

            const moneyParam =
                param(req, 'money', null);

            const levelParam =
                param(req, 'level', null);

            const xpParam =
                param(req, 'xp', null);

            const nameParam =
                param(req, 'company_name', null);

            const countryParam =
                param(req, 'country', null);

            await query(`
                UPDATE players

                SET
                    cash =
                        COALESCE($1, cash),

                    level =
                        COALESCE($2, level),

                    xp =
                        COALESCE($3, xp),

                    company_name =
                        COALESCE($4, company_name),

                    country_id =
                        COALESCE($5, country_id)

                WHERE id::text = $6
            `, [

                moneyParam === null
                    ? null
                    : Math.max(
                        0,
                        Math.floor(
                            number(moneyParam)
                        )
                    ),

                levelParam === null
                    ? null
                    : Math.max(
                        1,
                        Math.floor(
                            number(levelParam)
                        )
                    ),

                xpParam === null
                    ? null
                    : Math.max(
                        0,
                        Math.floor(
                            number(xpParam)
                        )
                    ),

                nameParam === null
                    ? null
                    : String(nameParam)
                        .substring(0, 100),

                countryParam === null
                    ? null
                    : String(countryParam)
                        .substring(0, 80),

                String(id)
            ]);

            const updated =
                await getPlayer(id);

            const ranking =
                await getPlayerRanking(id);

            return success(res, {

                company_id:
                    playerIdIsNumeric
                        ? Number(updated.id)
                        : updated.id,

                compnay_id:
                    playerIdIsNumeric
                        ? Number(updated.id)
                        : updated.id,

                company_name:
                    updated.company_name,

                country:
                    updated.country_id,

                money:
                    Number(updated.cash),

                cash:
                    Number(updated.cash),

                net_worth:
                    Number(updated.cash),

                level:
                    Number(updated.level),

                xp:
                    Number(updated.xp),

                ranking:
                    ranking.ranking,

                world_rank:
                    ranking.ranking,

                total_companies:
                    ranking.total_companies
            });
        }


        /* ---------------------------------------------
           COMPANY SEARCH
        --------------------------------------------- */

        if (
            operation ===
                'getCompanyByCountryAndLevel' ||

            operation ===
                'getSameLevelCompanies' ||

            operation ===
                'getRelevantCompanies'
        ) {

            const country =
                String(
                    param(req, 'country', '')
                );

            const level =
                Math.floor(
                    number(
                        param(req, 'level', 0),
                        0
                    )
                );

            const result =
                await query(`
                    SELECT
                        id,
                        username,
                        company_name,
                        country_id,
                        cash,
                        level,
                        xp

                    FROM players

                    WHERE
                        ($1 = '' OR country_id = $1)

                    AND
                        ($2 = 0 OR level = $2)

                    ORDER BY
                        cash DESC,
                        xp DESC

                    LIMIT 100
                `, [
                    country,
                    level
                ]);

            return success(res, {

                companies:
                    result.rows.map(row => ({

                        company_id:
                            playerIdIsNumeric
                                ? Number(row.id)
                                : row.id,

                        compnay_id:
                            playerIdIsNumeric
                                ? Number(row.id)
                                : row.id,

                        company_name:
                            row.company_name,

                        country:
                            row.country_id,

                        money:
                            Number(row.cash),

                        level:
                            Number(row.level),

                        xp:
                            Number(row.xp)
                    }))
            });
        }


        /* ---------------------------------------------
           PRICE / METADATA PLACEHOLDERS
        --------------------------------------------- */

        if (
            operation ===
                'GetResourcesPrices' ||

            operation ===
                'fetchProductsPrices' ||

            operation ===
                'getPropertiesMeta' ||

            operation ===
                'getConcessionsTrends'
        ) {

            return success(res, {
                items: [],
                prices: {}
            });
        }


        /*
         * Keep unsupported legacy operations from
         * crashing the server.
         */

        return success(res, {});

    } catch (err) {

        console.error(
            'RestSimulator error:',
            operation,
            err
        );

        return failure(
            res,
            err.message || 'Server error',
            500
        );
    }
}


/* =========================================================
   APK ROUTES
========================================================= */

app.get(
    '/RestSimulator',
    restSimulator
);

app.post(
    '/RestSimulator',
    restSimulator
);

app.get(
    '/api',
    restSimulator
);

app.post(
    '/api',
    restSimulator
);


/* =========================================================
   GLOBAL LEADERBOARD
========================================================= */

app.get('/api/rankings', async (req, res) => {

    try {

        const rankings =
            await getGlobalRanking(
                req.query.limit || 100
            );

        return res.json({

            success: true,

            total_companies:
                rankings.length,

            rankings:
                rankings
        });

    } catch (err) {

        console.error(
            'Ranking error:',
            err
        );

        return res.status(500).json({
            success: false,
            error: 'Ranking failed'
        });
    }
});


/* =========================================================
   INDIVIDUAL COMPANY RANK
========================================================= */

app.get(
    '/api/ranking/:companyId',
    async (req, res) => {

        try {

            const player =
                await getPlayer(
                    req.params.companyId
                );

            if (!player) {

                return res.status(404).json({
                    success: false,
                    error: 'Company not found'
                });
            }

            const ranking =
                await getPlayerRanking(
                    player.id
                );

            return res.json({

                success: true,

                company_id:
                    player.id,

                company_name:
                    player.company_name,

                ranking:
                    ranking.ranking,

                total_companies:
                    ranking.total_companies
            });

        } catch (err) {

            console.error(err);

            return res.status(500).json({
                success: false,
                error: 'Ranking failed'
            });
        }
    }
);


/* =========================================================
   HEALTH
========================================================= */

app.get('/health', async (req, res) => {

    try {

        const result =
            await query(
                'SELECT NOW() AS time'
            );

        res.json({

            ok: true,

            database:
                'PostgreSQL connected',

            time:
                result.rows[0].time
        });

    } catch (err) {

        res.status(503).json({

            ok: false,

            database:
                'PostgreSQL disconnected',

            error:
                err.message
        });
    }
});


app.get('/', (req, res) => {

    res.json({

        ok: true,

        server:
            'Tycoon PostgreSQL Multiplayer Server',

        version:
            '3.0.0'
    });
});


/* =========================================================
   START
========================================================= */

async function startServer() {

    try {

        await query('SELECT 1');

        console.log(
            'PostgreSQL connection successful'
        );

        await initializeDatabase();

        app.listen(
            PORT,
            '0.0.0.0',
            () => {

                console.log(
                    `Server running on port ${PORT}`
                );
            }
        );

    } catch (err) {

        console.error(
            'SERVER STARTUP FAILED:'
        );

        console.error(err);

        process.exit(1);
    }
}


process.on(
    'SIGTERM',
    async () => {

        await pool.end();

        process.exit(0);
    }
);


startServer();
