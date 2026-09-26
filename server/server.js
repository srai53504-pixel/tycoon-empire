const express = require("express");
const cors = require("cors");

const app = express();
const PORT = Number(process.env.PORT || 10000);

app.use(cors());
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));

/*
 * ============================================================
 * TYCOON EMPIRE - APK COMPATIBILITY SERVER
 * ============================================================
 *
 * APK base URL:
 * https://tycoon-empire-i40v.onrender.com/api
 *
 * Confirmed from RestHttpClient:
 *
 * GET /api/<company_id>
 * GET /api?Operation=getCEORanking
 * GET /api/company_update/?company_id=<id>
 * GET /api/country_relations/top
 * GET /api/wars/<war_id>/contributors
 *
 * PUT /api
 * PUT /api/country_relations/bulk
 *
 * The APK sends the complete CEO object as JSON to PUT /api.
 *
 * This version keeps data in memory so it works immediately
 * without requiring a PostgreSQL database.
 * ============================================================
 */

const companies = new Map();
const countryRelations = new Map();
const companyUpdates = new Map();
const warContributors = new Map();

/* ------------------------------------------------------------
 * Helpers
 * ---------------------------------------------------------- */

function str(value, fallback = "") {
    if (value === undefined || value === null) {
        return fallback;
    }

    return String(value).trim();
}

function num(value, fallback = 0) {
    const n = Number(value);

    return Number.isFinite(n) ? n : fallback;
}

function int(value, fallback = 0) {
    const n = Math.trunc(Number(value));

    return Number.isFinite(n) ? n : fallback;
}

function first(obj, keys, fallback = undefined) {
    for (const key of keys) {
        if (
            obj &&
            Object.prototype.hasOwnProperty.call(obj, key) &&
            obj[key] !== undefined &&
            obj[key] !== null
        ) {
            return obj[key];
        }
    }

    return fallback;
}

/* ------------------------------------------------------------
 * CEO normalization
 * ---------------------------------------------------------- */

function normalizeCEO(body) {
    if (!body || typeof body !== "object") {
        throw new Error("Invalid CEO JSON");
    }

    /*
     * The actual APK serializes the CEO object using Gson.
     * Therefore we preserve the original JSON while also
     * extracting ranking fields.
     */

    const companyId = str(
        first(body, [
            "company_id",
            "companyId",
            "companyID",
            "id"
        ])
    );

    if (!companyId) {
        throw new Error("CEO company_id is missing");
    }

    const companyName = str(
        first(body, [
            "company_name",
            "companyName",
            "name"
        ]),
        "Company " + companyId
    );

    const country = str(
        first(body, [
            "country",
            "company_country",
            "player_country"
        ])
    );

    const level = Math.max(
        0,
        int(
            first(body, [
                "level",
                "company_level",
                "companyLevel"
            ]),
            0
        )
    );

    const xp = Math.max(
        0,
        num(
            first(body, [
                "xp",
                "experience",
                "experience_points"
            ]),
            0
        )
    );

    const netWorth = Math.max(
        0,
        num(
            first(body, [
                "net_worth",
                "netWorth",
                "company_value",
                "companyValue",
                "prestige"
            ]),
            0
        )
    );

    const cash = Math.max(
        0,
        num(
            first(body, [
                "cash",
                "money",
                "balance"
            ]),
            0
        )
    );

    const prestige = Math.max(
        0,
        num(
            first(body, [
                "prestige",
                "net_worth",
                "netWorth"
            ]),
            netWorth
        )
    );

    return {
        ...body,

        company_id: companyId,
        companyId: companyId,

        company_name: companyName,
        companyName: companyName,

        country,

        level,
        xp,

        net_worth: netWorth,
        netWorth,

        cash,

        prestige,

        updated_at: new Date().toISOString()
    };
}

/* ------------------------------------------------------------
 * Ranking
 * ---------------------------------------------------------- */

function rankingScore(ceo) {
    const prestige = num(ceo.prestige, 0);
    const netWorth = num(ceo.net_worth ?? ceo.netWorth, 0);
    const level = int(ceo.level, 0);
    const xp = num(ceo.xp, 0);

    /*
     * We do NOT accept a client supplied "rank".
     * Rank is calculated by the server.
     */

    return (
        prestige +
        netWorth +
        level * 1000000 +
        xp * 0.01
    );
}

function getSortedCompanies() {
    return [...companies.values()].sort((a, b) => {
        const scoreDifference =
            rankingScore(b) - rankingScore(a);

        if (scoreDifference !== 0) {
            return scoreDifference;
        }

        const worthDifference =
            num(b.net_worth ?? b.netWorth) -
            num(a.net_worth ?? a.netWorth);

        if (worthDifference !== 0) {
            return worthDifference;
        }

        return String(a.company_id).localeCompare(
            String(b.company_id),
            undefined,
            { numeric: true }
        );
    });
}

/*
 * Return the original CEO fields plus ranking information.
 * Keeping the original fields is useful because Gson-based
 * APK code may expect fields that are not directly used by
 * the ranking screen.
 */

function rankedCEO(ceo, rank) {
    return {
        ...ceo,

        rank,
        ranking: rank,

        company_id: ceo.company_id,
        companyId: ceo.company_id,

        company_name: ceo.company_name,
        companyName: ceo.company_name,

        prestige: num(ceo.prestige, 0),
        net_worth: num(
            ceo.net_worth ?? ceo.netWorth,
            0
        ),

        ranking_score: Math.round(rankingScore(ceo)),
        rankingScore: Math.round(rankingScore(ceo))
    };
}

/* ------------------------------------------------------------
 * GET /api/<company_id>
 *
 * APK:
 * GetCEOData()
 * ---------------------------------------------------------- */

app.get("/api/:companyId", (req, res) => {
    const companyId = str(req.params.companyId);

    const company = companies.get(companyId);

    if (!company) {
        return res.status(404).json({
            result: "error",
            error: "Company not found",
            company_id: companyId
        });
    }

    const rows = getSortedCompanies();

    const index = rows.findIndex(
        x => x.company_id === companyId
    );

    return res.status(200).json(
        rankedCEO(
            company,
            index >= 0 ? index + 1 : 0
        )
    );
});

/* ------------------------------------------------------------
 * GET /api?Operation=getCEORanking
 *
 * APK:
 * GetCEORanks()
 * ---------------------------------------------------------- */

app.get("/api", (req, res) => {
    const operation = str(
        req.query.Operation ??
        req.query.operation
    ).toLowerCase();

    if (
        operation === "getceoranking" ||
        operation === "getceoranks" ||
        operation === "getglobalranking" ||
        operation === "getranking"
    ) {
        const rows = getSortedCompanies();

        const limit = Math.min(
            100,
            Math.max(
                1,
                int(req.query.limit, 100)
            )
        );

        const offset = Math.max(
            0,
            int(req.query.offset, 0)
        );

        const page = rows.slice(
            offset,
            offset + limit
        );

        /*
         * Important:
         *
         * The original game method directly passes
         * RequestParams to this GET request. We therefore
         * return a JSON ARRAY here rather than wrapping it
         * in { rankings: [...] }.
         */

        return res.status(200).json(
            page.map(
                (company, index) =>
                    rankedCEO(
                        company,
                        offset + index + 1
                    )
            )
        );
    }

    /*
     * The APK's SendCEOData uses PUT /api, not GET.
     */

    return res.status(404).json({
        result: "error",
        error: "Unknown Operation"
    });
});

/* ------------------------------------------------------------
 * PUT /api
 *
 * APK:
 * SendCEOData()
 *
 * Gson -> JSON -> HTTP PUT
 * ---------------------------------------------------------- */

app.put("/api", (req, res) => {
    try {
        const ceo = normalizeCEO(req.body);

        companies.set(
            ceo.company_id,
            ceo
        );

        const rows = getSortedCompanies();

        const index = rows.findIndex(
            x => x.company_id === ceo.company_id
        );

        const result = rankedCEO(
            ceo,
            index >= 0 ? index + 1 : 0
        );

        console.log(
            `[CEO UPDATE] ${ceo.company_id} - ${ceo.company_name}`
        );

        return res.status(200).json(result);

    } catch (error) {
        console.error(
            "[PUT /api]",
            error
        );

        return res.status(400).json({
            result: "error",
            error: error.message
        });
    }
});

/* ------------------------------------------------------------
 * POST compatibility
 * ---------------------------------------------------------- */

app.post("/api", (req, res) => {
    const operation = str(
        req.query.Operation ??
        req.query.operation ??
        req.body?.Operation ??
        req.body?.operation
    ).toLowerCase();

    if (
        operation === "updatecompanyranking" ||
        operation === "updateceoranking" ||
        operation === "upsertranking" ||
        operation === "upsertcompany"
    ) {
        try {
            const ceo = normalizeCEO(req.body);

            companies.set(
                ceo.company_id,
                ceo
            );

            return res.status(200).json(ceo);

        } catch (error) {
            return res.status(400).json({
                result: "error",
                error: error.message
            });
        }
    }

    return res.status(404).json({
        result: "error",
        error: "Unknown Operation"
    });
});

/* ------------------------------------------------------------
 * COMPANY UPDATES
 *
 * APK:
 * GET /api/company_update/?company_id=<id>
 * ---------------------------------------------------------- */

app.get(
    "/api/company_update/",
    (req, res) => {
        const companyId = str(
            req.query.company_id ??
            req.query.companyId
        );

        const update =
            companyUpdates.get(companyId);

        if (!update) {
            return res.status(200).json([]);
        }

        return res.status(200).json(update);
    }
);

/* ------------------------------------------------------------
 * COUNTRY RELATION TOP
 *
 * APK:
 * GET /api/country_relations/top?
 * ---------------------------------------------------------- */

app.get(
    "/api/country_relations/top",
    (req, res) => {
        const rows = [
            ...countryRelations.values()
        ];

        rows.sort(
            (a, b) =>
                num(b.score) -
                num(a.score)
        );

        return res.status(200).json(
            rows
        );
    }
);

/* ------------------------------------------------------------
 * COUNTRY RELATION UPDATE
 *
 * APK:
 * PUT /api/country_relations/bulk
 * ---------------------------------------------------------- */

app.put(
    "/api/country_relations/bulk",
    (req, res) => {
        const companyId = str(
            req.query.company_id
        );

        const companyName = str(
            req.query.company_name
        );

        const companyCountry = str(
            req.query.company_country
        );

        const body =
            req.body &&
            typeof req.body === "object"
                ? req.body
                : {};

        const record = {
            ...body,

            company_id: companyId,
            company_name: companyName,
            company_country: companyCountry,

            updated_at:
                new Date().toISOString()
        };

        countryRelations.set(
            companyId,
            record
        );

        return res.status(200).json({
            result: "success",
            ...record
        });
    }
);

/* ------------------------------------------------------------
 * WAR CONTRIBUTORS
 *
 * APK:
 * GET /api/wars/<war_id>/contributors?
 * ---------------------------------------------------------- */

app.get(
    "/api/wars/:warId/contributors",
    (req, res) => {
        const warId = str(
            req.params.warId
        );

        const contributors =
            warContributors.get(warId);

        if (!contributors) {
            return res.status(200).json([]);
        }

        return res.status(200).json(
            contributors
        );
    }
);

/* ------------------------------------------------------------
 * Useful development endpoints
 * ---------------------------------------------------------- */

app.get("/health", (req, res) => {
    res.status(200).json({
        result: "success",
        status: "online",
        service: "tycoon-empire",
        companies: companies.size,
        countryRelations: countryRelations.size,
        wars: warContributors.size,
        time: new Date().toISOString()
    });
});

app.get("/", (req, res) => {
    res.status(200).json({
        result: "success",
        service: "Tycoon Empire API",
        status: "online",
        api: "/api"
    });
});

/* ------------------------------------------------------------
 * 404
 * ---------------------------------------------------------- */

app.use((req, res) => {
    res.status(404).json({
        result: "error",
        error: "Endpoint not found",
        method: req.method,
        path: req.path
    });
});

/* ------------------------------------------------------------
 * Error handler
 * ---------------------------------------------------------- */

app.use((error, req, res, next) => {
    console.error(error);

    res.status(500).json({
        result: "error",
        error: "Internal server error"
    });
});

/* ------------------------------------------------------------
 * Render
 * ---------------------------------------------------------- */

app.listen(
    PORT,
    "0.0.0.0",
    () => {
        console.log(
            `Tycoon Empire API running on ${PORT}`
        );
    }
);
