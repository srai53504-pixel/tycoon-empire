/* =========================================================
   GLOBAL POSTGRESQL COMPANY RANKING
   ========================================================= */

async function getGlobalCompanyRanking(playerId) {
    const result = await query(`
        WITH ranked AS (
            SELECT
                id,
                username,
                company_name,
                country_id,
                cash,
                level,
                xp,
                RANK() OVER (
                    ORDER BY cash DESC, xp DESC, id ASC
                ) AS world_rank,
                COUNT(*) OVER () AS total_companies
            FROM players
        )
        SELECT *
        FROM ranked
        WHERE id::text = $1
        LIMIT 1
    `, [String(playerId)]);

    if (!result.rows.length) {
        return {
            world_rank: 0,
            total_companies: 0
        };
    }

    const r = result.rows[0];

    return {
        world_rank: Number(r.world_rank),
        total_companies: Number(r.total_companies)
    };
}


/* =========================================================
   COMPLETE GLOBAL LEADERBOARD
   ========================================================= */

async function globalRanking(req, res) {
    try {
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
                    ORDER BY cash DESC, xp DESC, id ASC
                ) AS world_rank,
                COUNT(*) OVER () AS total_companies
            FROM players
            ORDER BY cash DESC, xp DESC, id ASC
            LIMIT 100
        `);

        return json(res, 200, {
            success: true,
            total_companies: result.rows.length > 0
                ? Number(result.rows[0].total_companies)
                : 0,

            rankings: result.rows.map(r => ({
                rank: Number(r.world_rank),
                company_id: r.id,
                company_name: r.company_name,
                username: r.username,
                country: r.country_id,
                money: Number(r.cash),
                level: Number(r.level),
                xp: Number(r.xp)
            }))
        });

    } catch (e) {
        console.error("Global ranking error:", e);
        return error(res, 500, "Could not load global rankings");
    }
}


/* =========================================================
   CURRENT PLAYER GLOBAL RANK
   ========================================================= */

async function myGlobalRanking(req, res, player) {
    try {
        const result = await query(`
            WITH ranked AS (
                SELECT
                    id,
                    username,
                    company_name,
                    country_id,
                    cash,
                    level,
                    xp,
                    RANK() OVER (
                        ORDER BY cash DESC, xp DESC, id ASC
                    ) AS world_rank,
                    COUNT(*) OVER () AS total_companies
                FROM players
            )
            SELECT *
            FROM ranked
            WHERE id::text = $1
            LIMIT 1
        `, [String(player.id)]);

        if (!result.rows.length) {
            return error(res, 404, "Company not found");
        }

        const r = result.rows[0];

        return json(res, 200, {
            success: true,
            company_id: r.id,
            compnay_id: r.id,
            company_name: r.company_name,
            username: r.username,
            country: r.country_id,
            ranking: Number(r.world_rank),
            world_rank: Number(r.world_rank),
            total_companies: Number(r.total_companies),
            money: Number(r.cash),
            level: Number(r.level),
            xp: Number(r.xp)
        });

    } catch (e) {
        console.error("My ranking error:", e);
        return error(res, 500, "Could not calculate ranking");
    }
}


/* =========================================================
   REGISTER RESPONSE RANKING
   =========================================================
   IMPORTANT:
   After your RegisterUser code inserts the player into
   PostgreSQL, call:

       const ranking = await getGlobalCompanyRanking(player.id);

   Then return the following values in the response:

       ranking: ranking.world_rank
       total_companies: ranking.total_companies
       compnay_id: player.id
       company_id: player.id
       referral_code: String(player.id)

   Example:

       const ranking = await getGlobalCompanyRanking(player.id);

       return json(res, 200, {
           success: true,
           ranking: ranking.world_rank,
           total_companies: ranking.total_companies,
           compnay_id: player.id,
           company_id: player.id,
           company_name: player.company_name,
           country: player.country_id,
           referral_code: String(player.id)
       });
*/


/* =========================================================
   OPTIONAL API ROUTES
   ========================================================= */

// Global top-100 ranking:
// GET /api/rankings

app.get("/api/rankings", async (req, res) => {
    await globalRanking(req, res);
});


/*
   If your existing authentication system provides req.user,
   you can expose the current player's ranking with:

   GET /api/my-ranking
*/

app.get("/api/my-ranking", async (req, res) => {
    try {
        const player = await authPlayer(req);

        if (!player) {
            return error(res, 401, "Authentication required");
        }

        await myGlobalRanking(req, res, player);

    } catch (e) {
        console.error("My ranking route error:", e);
        return error(res, 500, "Could not load ranking");
    }
});
