
'use strict';

const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const app = express();
app.set('trust proxy', 1);

const PORT = Number(process.env.PORT || 10000);
const JWT_SECRET = process.env.JWT_SECRET || 'CHANGE_THIS_JWT_SECRET';
const RANKING_UPDATE_KEY = process.env.RANKING_UPDATE_KEY || '';
const DATABASE_URL = process.env.DATABASE_URL || '';

app.use(cors({ origin: true, credentials: false }));
app.use(express.json({ limit: '256kb' }));
app.use(express.urlencoded({ extended: true }));

let pool = null;
let dbEnabled = false;

if (DATABASE_URL) {
  pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: process.env.PGSSL_DISABLE === 'true'
      ? false
      : { rejectUnauthorized: false }
  });
  dbEnabled = true;
}

const memory = {
  companies: new Map(),
  users: new Map(),
  alliances: new Map()
};

function cleanString(value, fallback = '') {
  if (value === undefined || value === null) return fallback;
  return String(value).trim().slice(0, 120);
}

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function int(value, fallback = 0) {
  const n = Math.trunc(Number(value));
  return Number.isFinite(n) ? n : fallback;
}

function rankingScore(c) {
  // Default private-server ranking formula.
  // The client can send level/netWorth/xp, but the server derives the
  // displayed ranking score from those values instead of accepting a
  // precomputed rank position.
  const level = Math.max(0, int(c.level));
  const xp = Math.max(0, num(c.xp));
  const netWorth = Math.max(0, num(c.netWorth));
  return (netWorth * 1) + (level * 1000000) + (xp * 0.01);
}

function normalizeCompany(body) {
  const companyId = cleanString(
    body.companyId ?? body.company_id ?? body.id ?? body.companyID
  );
  if (!companyId) throw new Error('companyId is required');

  return {
    companyId,
    ownerId: cleanString(body.ownerId ?? body.owner_id ?? body.userId ?? body.user_id, null),
    companyName: cleanString(body.companyName ?? body.company_name ?? body.name, 'My Company'),
    country: cleanString(body.country ?? body.countryCode, ''),
    countryCode: cleanString(body.countryCode ?? body.country_code, ''),
    avatar: cleanString(body.avatar ?? body.avatarUrl ?? body.avatar_url, ''),
    level: Math.max(0, int(body.level ?? body.companyLevel)),
    xp: Math.max(0, num(body.xp ?? body.experience)),
    netWorth: Math.max(0, num(body.netWorth ?? body.net_worth ?? body.companyValue ?? body.value)),
    cash: Math.max(0, num(body.cash ?? body.money ?? body.balance)),
    revenue: Math.max(0, num(body.revenue)),
    employees: Math.max(0, int(body.employees)),
    allianceId: cleanString(body.allianceId ?? body.alliance_id, null),
    updatedAt: new Date()
  };
}

function sortCompanies(rows) {
  return rows.sort((a, b) => {
    const s = rankingScore(b) - rankingScore(a);
    if (s !== 0) return s;
    const n = b.netWorth - a.netWorth;
    if (n !== 0) return n;
    const l = b.level - a.level;
    if (l !== 0) return l;
    return String(a.companyId).localeCompare(String(b.companyId), undefined, { numeric: true });
  });
}

function publicCompany(c, position) {
  return {
    rank: position,
    companyId: String(c.companyId),
    ownerId: c.ownerId ?? null,
    companyName: c.companyName || 'My Company',
    country: c.country || '',
    countryCode: c.countryCode || '',
    avatar: c.avatar || '',
    level: int(c.level),
    xp: num(c.xp),
    netWorth: num(c.netWorth),
    cash: num(c.cash),
    revenue: num(c.revenue),
    employees: int(c.employees),
    rankingScore: Math.round(rankingScore(c)),
    allianceId: c.allianceId ?? null,
    updatedAt: c.updatedAt instanceof Date ? c.updatedAt.toISOString() : c.updatedAt
  };
}

async function initDb() {
  if (!dbEnabled) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ranking_companies (
      company_id TEXT PRIMARY KEY,
      owner_id TEXT,
      company_name TEXT NOT NULL DEFAULT 'My Company',
      country TEXT DEFAULT '',
      country_code TEXT DEFAULT '',
      avatar TEXT DEFAULT '',
      level INTEGER NOT NULL DEFAULT 0,
      xp DOUBLE PRECISION NOT NULL DEFAULT 0,
      net_worth DOUBLE PRECISION NOT NULL DEFAULT 0,
      cash DOUBLE PRECISION NOT NULL DEFAULT 0,
      revenue DOUBLE PRECISION NOT NULL DEFAULT 0,
      employees INTEGER NOT NULL DEFAULT 0,
      alliance_id TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS ranking_companies_score_idx
      ON ranking_companies (net_worth DESC, level DESC, xp DESC);

    CREATE TABLE IF NOT EXISTS ranking_users (
      user_id TEXT PRIMARY KEY,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS ranking_alliances (
      alliance_id TEXT PRIMARY KEY,
      alliance_name TEXT NOT NULL DEFAULT 'Alliance',
      country TEXT DEFAULT '',
      score DOUBLE PRECISION NOT NULL DEFAULT 0,
      members INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

async function getCompany(companyId) {
  if (dbEnabled) {
    const r = await pool.query(
      `SELECT company_id AS "companyId", owner_id AS "ownerId",
              company_name AS "companyName", country, country_code AS "countryCode",
              avatar, level, xp, net_worth AS "netWorth", cash, revenue,
              employees, alliance_id AS "allianceId", updated_at AS "updatedAt"
       FROM ranking_companies WHERE company_id = $1`,
      [companyId]
    );
    return r.rows[0] || null;
  }
  return memory.companies.get(companyId) || null;
}

async function upsertCompany(c) {
  if (dbEnabled) {
    const r = await pool.query(`
      INSERT INTO ranking_companies
        (company_id, owner_id, company_name, country, country_code, avatar,
         level, xp, net_worth, cash, revenue, employees, alliance_id, updated_at)
      VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW())
      ON CONFLICT (company_id) DO UPDATE SET
        owner_id = EXCLUDED.owner_id,
        company_name = EXCLUDED.company_name,
        country = EXCLUDED.country,
        country_code = EXCLUDED.country_code,
        avatar = EXCLUDED.avatar,
        level = EXCLUDED.level,
        xp = EXCLUDED.xp,
        net_worth = EXCLUDED.net_worth,
        cash = EXCLUDED.cash,
        revenue = EXCLUDED.revenue,
        employees = EXCLUDED.employees,
        alliance_id = EXCLUDED.alliance_id,
        updated_at = NOW()
      RETURNING company_id AS "companyId", owner_id AS "ownerId",
        company_name AS "companyName", country, country_code AS "countryCode",
        avatar, level, xp, net_worth AS "netWorth", cash, revenue,
        employees, alliance_id AS "allianceId", updated_at AS "updatedAt"
    `, [
      c.companyId, c.ownerId, c.companyName, c.country, c.countryCode,
      c.avatar, c.level, c.xp, c.netWorth, c.cash, c.revenue,
      c.employees, c.allianceId
    ]);
    return r.rows[0];
  }

  const old = memory.companies.get(c.companyId);
  const merged = { ...(old || {}), ...c, updatedAt: new Date() };
  memory.companies.set(c.companyId, merged);
  return merged;
}

async function getRanking({ limit, offset, country, countryCode }) {
  if (dbEnabled) {
    const where = [];
    const params = [];
    if (country) {
      params.push(country);
      where.push(`country = $${params.length}`);
    }
    if (countryCode) {
      params.push(countryCode);
      where.push(`country_code = $${params.length}`);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    // Ranking score is derived in SQL from server-stored state.
    const q = `
      SELECT company_id AS "companyId", owner_id AS "ownerId",
             company_name AS "companyName", country,
             country_code AS "countryCode", avatar, level, xp,
             net_worth AS "netWorth", cash, revenue, employees,
             alliance_id AS "allianceId", updated_at AS "updatedAt"
      FROM ranking_companies
      ${whereSql}
      ORDER BY
        (net_worth + (level * 1000000) + (xp * 0.01)) DESC,
        net_worth DESC, level DESC, xp DESC, company_id ASC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    params.push(limit, offset);
    const r = await pool.query(q, params);

    const countQ = await pool.query(
      `SELECT COUNT(*)::int AS count FROM ranking_companies ${whereSql}`,
      params.slice(0, params.length - 2)
    );
    return { rows: r.rows, total: countQ.rows[0].count };
  }

  let rows = [...memory.companies.values()];
  if (country) rows = rows.filter(x => x.country === country);
  if (countryCode) rows = rows.filter(x => x.countryCode === countryCode);
  sortCompanies(rows);
  return { rows: rows.slice(offset, offset + limit), total: rows.length };
}

function authTokenFrom(req) {
  const h = req.headers.authorization || '';
  if (h.startsWith('Bearer ')) return h.slice(7);
  return cleanString(req.body?.token || req.query?.token, '');
}

function optionalAuth(req, res, next) {
  const token = authTokenFrom(req);
  if (!token) return next();
  try {
    req.user = jwt.verify(token, JWT_SECRET);
  } catch {
    return res.status(401).json({ result: 'error', error: 'Invalid token' });
  }
  next();
}

function requireAuth(req, res, next) {
  const token = authTokenFrom(req);
  if (!token) return res.status(401).json({ result: 'error', error: 'Authentication required' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ result: 'error', error: 'Invalid token' });
  }
}

function requireRankingKey(req, res, next) {
  if (!RANKING_UPDATE_KEY) return next();
  const supplied = req.headers['x-ranking-key'] || req.body?.rankingKey;
  if (supplied !== RANKING_UPDATE_KEY) {
    return res.status(403).json({ result: 'error', error: 'Invalid ranking update key' });
  }
  next();
}

async function registerUser(userId, password) {
  const hash = await bcrypt.hash(password, 12);
  if (dbEnabled) {
    await pool.query(
      `INSERT INTO ranking_users(user_id,password_hash)
       VALUES($1,$2)
       ON CONFLICT(user_id) DO NOTHING`,
      [userId, hash]
    );
    const r = await pool.query(`SELECT user_id AS "userId", password_hash AS "passwordHash" FROM ranking_users WHERE user_id=$1`, [userId]);
    return r.rows[0];
  }
  if (!memory.users.has(userId)) memory.users.set(userId, { userId, passwordHash: hash });
  return memory.users.get(userId);
}

async function findUser(userId) {
  if (dbEnabled) {
    const r = await pool.query(`SELECT user_id AS "userId", password_hash AS "passwordHash" FROM ranking_users WHERE user_id=$1`, [userId]);
    return r.rows[0] || null;
  }
  return memory.users.get(userId) || null;
}

function buildRankingResponse(rows, total, limit, offset) {
  const rankings = rows.map((c, i) => publicCompany(c, offset + i + 1));
  return {
    result: 'success',
    rankings,
    total,
    limit,
    offset,
    generatedAt: new Date().toISOString()
  };
}

app.get('/health', async (req, res) => {
  let database = 'memory';
  if (dbEnabled) {
    try {
      await pool.query('SELECT 1');
      database = 'postgresql';
    } catch {
      database = 'postgresql-error';
    }
  }
  res.json({
    result: 'success',
    status: 'online',
    service: 'tycoon-global-ranking',
    database,
    time: new Date().toISOString()
  });
});

app.get('/', (req, res) => {
  res.json({
    result: 'success',
    service: 'Tycoon Global Ranking Server',
    endpoints: [
      'GET /api/rankings',
      'GET /api/global-ranking',
      'GET /api?Operation=getCEORanking',
      'POST /api/rankings/upsert',
      'POST /api?Operation=updateCompanyRanking',
      'POST /api/auth/register',
      'POST /api/auth/login'
    ]
  });
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const userId = cleanString(req.body.userId ?? req.body.user_id);
    const password = String(req.body.password || '');
    if (!userId || password.length < 6) {
      return res.status(400).json({ result: 'error', error: 'userId and a password of at least 6 characters are required' });
    }
    const existing = await findUser(userId);
    if (existing) return res.status(409).json({ result: 'error', error: 'User already exists' });
    const user = await registerUser(userId, password);
    const token = jwt.sign({ userId: user.userId }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ result: 'success', userId, token });
  } catch (e) {
    res.status(500).json({ result: 'error', error: e.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const userId = cleanString(req.body.userId ?? req.body.user_id);
    const password = String(req.body.password || '');
    const user = await findUser(userId);
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ result: 'error', error: 'Invalid credentials' });
    }
    const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ result: 'success', userId, token });
  } catch (e) {
    res.status(500).json({ result: 'error', error: e.message });
  }
});

app.get('/api/rankings', async (req, res) => {
  try {
    const limit = Math.min(100, Math.max(1, int(req.query.limit, 50)));
    const offset = Math.max(0, int(req.query.offset, 0));
    const { rows, total } = await getRanking({
      limit,
      offset,
      country: cleanString(req.query.country),
      countryCode: cleanString(req.query.countryCode ?? req.query.country_code)
    });
    res.json(buildRankingResponse(rows, total, limit, offset));
  } catch (e) {
    res.status(500).json({ result: 'error', error: e.message });
  }
});

app.get('/api/global-ranking', async (req, res) => {
  req.query.limit = req.query.limit || 50;
  return app._router.handle(req, res, () => {});
});

async function rankingHandler(req, res) {
  try {
    const limit = Math.min(100, Math.max(1, int(req.query.limit ?? req.body?.limit, 50)));
    const offset = Math.max(0, int(req.query.offset ?? req.body?.offset, 0));
    const country = cleanString(req.query.country ?? req.body?.country);
    const countryCode = cleanString(req.query.countryCode ?? req.query.country_code ?? req.body?.countryCode ?? req.body?.country_code);
    const { rows, total } = await getRanking({ limit, offset, country, countryCode });
    res.json(buildRankingResponse(rows, total, limit, offset));
  } catch (e) {
    res.status(500).json({ result: 'error', error: e.message });
  }
}

// Compatibility endpoints for the Android game's operation-style API.
app.get('/api', async (req, res, next) => {
  const op = String(req.query.Operation || req.query.operation || '').toLowerCase();
  if (op === 'getceoranking' || op === 'getglobalranking' || op === 'getranking') return rankingHandler(req, res);
  if (op === 'getalliancesrankings' || op === 'getalliancerankings') return allianceRankingHandler(req, res);
  if (op === 'getbidranking') return bidRankingHandler(req, res);
  return res.status(404).json({ result: 'error', error: 'Unknown Operation' });
});

app.post('/api', optionalAuth, requireRankingKey, async (req, res) => {
  const op = String(req.query.Operation || req.query.operation || req.body.Operation || req.body.operation || '').toLowerCase();
  if (op === 'updatecompanyranking' || op === 'updateceoranking' || op === 'upsertranking' || op === 'upsertcompany') {
    return upsertRankingHandler(req, res);
  }
  return res.status(404).json({ result: 'error', error: 'Unknown Operation' });
});

app.post('/api/rankings/upsert', optionalAuth, requireRankingKey, upsertRankingHandler);
app.post('/api/rankings/update', optionalAuth, requireRankingKey, upsertRankingHandler);

async function upsertRankingHandler(req, res) {
  try {
    const c = normalizeCompany(req.body);

    // If a JWT is present, prevent the caller from claiming a different owner.
    if (req.user?.userId && c.ownerId && c.ownerId !== req.user.userId) {
      return res.status(403).json({ result: 'error', error: 'ownerId does not match authenticated user' });
    }
    if (req.user?.userId && !c.ownerId) c.ownerId = req.user.userId;

    // Basic sanity limits protect the ranking table from accidental garbage.
    if (c.level > 1000000 || c.netWorth > 1e18 || c.xp > 1e18) {
      return res.status(400).json({ result: 'error', error: 'Ranking values exceed allowed limits' });
    }

    const saved = await upsertCompany(c);
    const { rows } = await getRanking({ limit: 100, offset: 0 });

    const idx = rows.findIndex(x => String(x.companyId) === String(saved.companyId));
    const rank = idx >= 0 ? idx + 1 : null;

    res.json({
      result: 'success',
      company: publicCompany(saved, rank),
      rank,
      message: 'Global ranking updated'
    });
  } catch (e) {
    res.status(400).json({ result: 'error', error: e.message });
  }
});

app.get('/api/company/:companyId', async (req, res) => {
  try {
    const c = await getCompany(cleanString(req.params.companyId));
    if (!c) return res.status(404).json({ result: 'error', error: 'Company not found' });

    const { rows } = await getRanking({ limit: 10000, offset: 0 });
    const idx = rows.findIndex(x => String(x.companyId) === String(c.companyId));
    res.json({ result: 'success', company: publicCompany(c, idx >= 0 ? idx + 1 : null) });
  } catch (e) {
    res.status(500).json({ result: 'error', error: e.message });
  }
});

async function allianceRankingHandler(req, res) {
  if (dbEnabled) {
    const r = await pool.query(`
      SELECT alliance_id AS "allianceId", alliance_name AS "allianceName",
             country, score, members, updated_at AS "updatedAt"
      FROM ranking_alliances
      ORDER BY score DESC, members DESC, alliance_id ASC
      LIMIT $1 OFFSET $2
    `, [Math.min(100, Math.max(1, int(req.query.limit, 50))), Math.max(0, int(req.query.offset, 0))]);
    return res.json({ result: 'success', rankings: r.rows });
  }

  const rows = [...memory.alliances.values()].sort((a,b) => b.score - a.score || b.members - a.members);
  res.json({
    result: 'success',
    rankings: rows.slice(Math.max(0, int(req.query.offset,0)), Math.max(0,int(req.query.offset,0))+Math.min(100,Math.max(1,int(req.query.limit,50))))
  });
}

async function bidRankingHandler(req, res) {
  // Kept as a compatibility endpoint. This private ranking server does not
  // invent bids; it returns an empty ranking until a bid subsystem is added.
  res.json({ result: 'success', rankings: [], total: 0 });
}

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ result: 'error', error: 'Internal server error' });
});

async function start() {
  try {
    await initDb();
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Tycoon Global Ranking Server listening on 0.0.0.0:${PORT}`);
      console.log(`Database: ${dbEnabled ? 'PostgreSQL' : 'in-memory fallback'}`);
    });
  } catch (e) {
    console.error('Database initialization failed:', e);
    process.exit(1);
  }
}

process.on('SIGTERM', async () => {
  if (pool) await pool.end().catch(() => {});
  process.exit(0);
});

start();
