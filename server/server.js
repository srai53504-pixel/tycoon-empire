const express = require("express");
const cors = require("cors");

const app = express();
const PORT = Number(process.env.PORT || 10000);

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// Simple in-memory ranking store.
// This version intentionally uses no PostgreSQL/JWT/bcrypt so it will start
// even when Render has only the dependencies in the current package.json.
const companies = new Map();

function str(v, fallback = "") {
  return v === undefined || v === null ? fallback : String(v).trim();
}

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function integer(v, fallback = 0) {
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) ? n : fallback;
}

function normalizeCompany(body) {
  const companyId = str(
    body.companyId ??
    body.company_id ??
    body.companyID ??
    body.id ??
    body.userId ??
    body.user_id
  );

  if (!companyId) {
    throw new Error("companyId is required");
  }

  return {
    companyId,
    ownerId: str(body.ownerId ?? body.owner_id ?? body.userId ?? body.user_id),
    companyName: str(
      body.companyName ??
      body.company_name ??
      body.name,
      "My Company"
    ),
    country: str(body.country),
    countryCode: str(body.countryCode ?? body.country_code),
    avatar: str(body.avatar ?? body.avatarUrl ?? body.avatar_url),
    level: Math.max(0, integer(body.level ?? body.companyLevel)),
    xp: Math.max(0, num(body.xp ?? body.experience)),
    netWorth: Math.max(
      0,
      num(
        body.netWorth ??
        body.net_worth ??
        body.companyValue ??
        body.company_value ??
        body.value
      )
    ),
    cash: Math.max(0, num(body.cash ?? body.money ?? body.balance)),
    revenue: Math.max(0, num(body.revenue)),
    employees: Math.max(0, integer(body.employees)),
    allianceId: str(body.allianceId ?? body.alliance_id),
    updatedAt: new Date().toISOString()
  };
}

// Server calculates the ranking score.
// The client does NOT provide a rank position.
function score(company) {
  return (
    company.netWorth +
    company.level * 1000000 +
    company.xp * 0.01
  );
}

function sortedCompanies() {
  return [...companies.values()].sort((a, b) => {
    const scoreDiff = score(b) - score(a);
    if (scoreDiff !== 0) return scoreDiff;

    const worthDiff = b.netWorth - a.netWorth;
    if (worthDiff !== 0) return worthDiff;

    const levelDiff = b.level - a.level;
    if (levelDiff !== 0) return levelDiff;

    return a.companyId.localeCompare(b.companyId, undefined, {
      numeric: true
    });
  });
}

function publicCompany(company, rank) {
  return {
    rank,
    companyId: company.companyId,
    ownerId: company.ownerId,
    companyName: company.companyName,
    country: company.country,
    countryCode: company.countryCode,
    avatar: company.avatar,
    level: company.level,
    xp: company.xp,
    netWorth: company.netWorth,
    cash: company.cash,
    revenue: company.revenue,
    employees: company.employees,
    allianceId: company.allianceId,
    rankingScore: Math.round(score(company)),
    updatedAt: company.updatedAt
  };
}

function getLimit(value) {
  return Math.min(100, Math.max(1, integer(value, 50)));
}

function getOffset(value) {
  return Math.max(0, integer(value, 0));
}

function rankingResponse(req) {
  const limit = getLimit(req.query.limit);
  const offset = getOffset(req.query.offset);

  let rows = sortedCompanies();

  const country = str(req.query.country);
  const countryCode = str(req.query.countryCode ?? req.query.country_code);

  if (country) {
    rows = rows.filter(x => x.country === country);
  }

  if (countryCode) {
    rows = rows.filter(x => x.countryCode === countryCode);
  }

  const total = rows.length;
  const page = rows.slice(offset, offset + limit);

  return {
    result: "success",
    rankings: page.map((company, index) =>
      publicCompany(company, offset + index + 1)
    ),
    total,
    limit,
    offset,
    generatedAt: new Date().toISOString()
  };
}

// Health check
app.get("/health", (req, res) => {
  res.status(200).json({
    result: "success",
    status: "online",
    service: "tycoon-global-ranking-server",
    database: "in-memory",
    time: new Date().toISOString()
  });
});

// Root
app.get("/", (req, res) => {
  res.json({
    result: "success",
    service: "Tycoon Global Ranking Server",
    status: "online",
    endpoints: [
      "GET /health",
      "GET /api/rankings",
      "GET /api/global-ranking",
      "GET /api?Operation=getCEORanking",
      "POST /api/rankings/upsert",
      "POST /api?Operation=updateCompanyRanking"
    ]
  });
});

// Normal ranking endpoint
app.get("/api/rankings", (req, res) => {
  res.json(rankingResponse(req));
});

// Alias
app.get("/api/global-ranking", (req, res) => {
  res.json(rankingResponse(req));
});

// Compatibility with the game's operation-style API.
app.get("/api", (req, res) => {
  const operation = str(
    req.query.Operation ?? req.query.operation
  ).toLowerCase();

  if (
    operation === "getceoranking" ||
    operation === "getglobalranking" ||
    operation === "getranking"
  ) {
    return res.json(rankingResponse(req));
  }

  if (
    operation === "getalliancesrankings" ||
    operation === "getalliancerankings"
  ) {
    return res.json({
      result: "success",
      rankings: [],
      total: 0
    });
  }

  if (operation === "getbidranking") {
    return res.json({
      result: "success",
      rankings: [],
      total: 0
    });
  }

  return res.status(404).json({
    result: "error",
    error: "Unknown Operation"
  });
});

// Insert/update a company in the global ranking.
function updateRanking(req, res) {
  try {
    const company = normalizeCompany(req.body);

    // Basic sanity protection.
    if (
      company.level > 1000000 ||
      company.xp > 1000000000000000 ||
      company.netWorth > 1000000000000000000
    ) {
      return res.status(400).json({
        result: "error",
        error: "Invalid ranking values"
      });
    }

    companies.set(company.companyId, company);

    const rows = sortedCompanies();
    const index = rows.findIndex(
      x => x.companyId === company.companyId
    );

    return res.json({
      result: "success",
      message: "Global ranking updated",
      rank: index >= 0 ? index + 1 : null,
      company: publicCompany(
        company,
        index >= 0 ? index + 1 : null
      ),
      total: rows.length
    });
  } catch (error) {
    return res.status(400).json({
      result: "error",
      error: error.message
    });
  }
}

app.post("/api/rankings/upsert", updateRanking);
app.post("/api/rankings/update", updateRanking);

// Compatibility with operation-style POST requests.
app.post("/api", (req, res) => {
  const operation = str(
    req.query.Operation ??
    req.query.operation ??
    req.body.Operation ??
    req.body.operation
  ).toLowerCase();

  if (
    operation === "updatecompanyranking" ||
    operation === "updateceoranking" ||
    operation === "upsertranking" ||
    operation === "upsertcompany"
  ) {
    return updateRanking(req, res);
  }

  return res.status(404).json({
    result: "error",
    error: "Unknown Operation"
  });
});

// Individual company lookup.
app.get("/api/company/:companyId", (req, res) => {
  const company = companies.get(str(req.params.companyId));

  if (!company) {
    return res.status(404).json({
      result: "error",
      error: "Company not found"
    });
  }

  const rows = sortedCompanies();
  const index = rows.findIndex(
    x => x.companyId === company.companyId
  );

  res.json({
    result: "success",
    company: publicCompany(
      company,
      index >= 0 ? index + 1 : null
    )
  });
});

// Unknown route
app.use((req, res) => {
  res.status(404).json({
    result: "error",
    error: "Endpoint not found",
    path: req.path
  });
});

// Error handler
app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({
    result: "error",
    error: "Internal server error"
  });
});

// IMPORTANT for Render:
// listen on process.env.PORT and 0.0.0.0.
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Tycoon server running on port ${PORT}`);
});
