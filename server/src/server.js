const http = require("http");
const crypto = require("crypto");

const PORT = process.env.PORT || 10000;

const db = {
    players: [],
    assets: [],
    contracts: [],
    alliances: [],
    wars: [],
    chat: [],
    loans: [],
    missions: [],
    sessions: {},
    nextId: 1
};

/* =========================================================
   CATALOG
   ========================================================= */

const catalog = [

    // Businesses
    {
        category: "business",
        type: "Pub",
        price: 50000,
        income: 350
    },
    {
        category: "business",
        type: "Coffee Shop",
        price: 75000,
        income: 550
    },
    {
        category: "business",
        type: "Restaurant",
        price: 150000,
        income: 1100
    },
    {
        category: "business",
        type: "Movie Theater",
        price: 300000,
        income: 2100
    },
    {
        category: "business",
        type: "Mall",
        price: 1000000,
        income: 7500
    },

    // Transportation
    {
        category: "transport",
        type: "Taxi",
        price: 20000,
        income: 180
    },
    {
        category: "transport",
        type: "Bus",
        price: 80000,
        income: 600
    },
    {
        category: "transport",
        type: "Train",
        price: 500000,
        income: 4200
    },
    {
        category: "transport",
        type: "VIP Limousine",
        price: 250000,
        income: 1900
    },
    {
        category: "transport",
        type: "Passenger Plane",
        price: 5000000,
        income: 42000
    },
    {
        category: "transport",
        type: "Cargo Plane",
        price: 7000000,
        income: 55000
    },

    // Concessions
    {
        category: "concessions",
        type: "Ground Transport",
        price: 1000000,
        income: 7000
    },
    {
        category: "concessions",
        type: "Commerce",
        price: 2000000,
        income: 14000
    },
    {
        category: "concessions",
        type: "Leisure",
        price: 2500000,
        income: 18000
    },
    {
        category: "concessions",
        type: "Air Lines",
        price: 10000000,
        income: 70000
    },
    {
        category: "concessions",
        type: "Sea Lines",
        price: 12000000,
        income: 85000
    },

    // Properties
    {
        category: "properties",
        type: "Office Tower",
        price: 5000000,
        income: 35000
    },
    {
        category: "properties",
        type: "Hotel",
        price: 8000000,
        income: 60000
    },
    {
        category: "properties",
        type: "Industrial Park",
        price: 15000000,
        income: 120000
    },

    // Subsidiaries
    {
        category: "subsidiaries",
        type: "Mining Company",
        price: 20000000,
        income: 150000
    },
    {
        category: "subsidiaries",
        type: "Traveling Company",
        price: 12000000,
        income: 90000
    },
    {
        category: "subsidiaries",
        type: "Soccer Team",
        price: 18000000,
        income: 110000
    },
    {
        category: "subsidiaries",
        type: "Brokerage Company",
        price: 25000000,
        income: 170000
    },
    {
        category: "subsidiaries",
        type: "Robotics Program",
        price: 30000000,
        income: 200000
    },

    // Resources
    {
        category: "resources",
        type: "Oil Reserve",
        price: 4000000,
        income: 28000
    },
    {
        category: "resources",
        type: "Gold Mine",
        price: 6000000,
        income: 42000
    },
    {
        category: "resources",
        type: "Gem Mine",
        price: 9000000,
        income: 65000
    },

    // Research
    {
        category: "research",
        type: "Business AI",
        price: 3000000,
        income: 0
    },
    {
        category: "research",
        type: "Advanced Logistics",
        price: 5000000,
        income: 0
    },
    {
        category: "research",
        type: "Robotics",
        price: 12000000,
        income: 0
    },

    // Production
    {
        category: "production",
        type: "Food Factory",
        price: 5000000,
        income: 38000
    },
    {
        category: "production",
        type: "Vehicle Factory",
        price: 15000000,
        income: 110000
    },
    {
        category: "production",
        type: "Electronics Factory",
        price: 30000000,
        income: 230000
    },

    // Stocks
    {
        category: "stocks",
        type: "Blue Chip Portfolio",
        price: 1000000,
        income: 12000
    },
    {
        category: "stocks",
        type: "Tech Portfolio",
        price: 3000000,
        income: 38000
    },

    // Investments
    {
        category: "investments",
        type: "Startup Fund",
        price: 5000000,
        income: 50000
    },
    {
        category: "investments",
        type: "Football Investment",
        price: 7000000,
        income: 60000
    },

    // Projects
    {
        category: "projects",
        type: "Nuclear Plant",
        price: 50000000,
        income: 400000
    },
    {
        category: "projects",
        type: "Underground Hotel",
        price: 35000000,
        income: 260000
    }
];

/* =========================================================
   HELPERS
   ========================================================= */

function hash(value) {
    return crypto
        .createHash("sha256")
        .update(String(value))
        .digest("hex");
}

function createToken() {
    return crypto.randomBytes(32).toString("hex");
}

function readBody(req) {

    return new Promise(resolve => {

        let data = "";

        req.on("data", chunk => {
            data += chunk;
        });

        req.on("end", () => {

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
    });
}

function send(res, status, data) {

    res.writeHead(status, {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers":
            "Content-Type, Authorization",
        "Access-Control-Allow-Methods":
            "GET,POST,OPTIONS"
    });

    res.end(JSON.stringify(data));
}

function authenticate(req) {

    const header =
        req.headers.authorization || "";

    if (!header.startsWith("Bearer ")) {
        return null;
    }

    const token =
        header.substring(7);

    const playerId =
        db.sessions[token];

    if (!playerId) {
        return null;
    }

    return db.players.find(
        player => player.id === playerId
    ) || null;
}

function requirePlayer(req, res) {

    const player = authenticate(req);

    if (!player) {

        send(res, 401, {
            error: "authentication required"
        });

        return null;
    }

    return player;
}

function playerView(player) {

    const ownedValue =
        db.assets
            .filter(asset =>
                asset.ownerId === player.id
            )
            .reduce(
                (total, asset) =>
                    total +
                    asset.price *
                    asset.quantity,
                0
            );

    return {
        id: player.id,
        username: player.username,
        email: player.email,
        companyName: player.companyName,
        country: player.country,
        cash: player.cash,
        gold: player.gold,
        level: player.level,
        companyWorth:
            player.cash + ownedValue,
        offensiveLevel:
            player.offensiveLevel,
        defense:
            player.defense
    };
}

/* =========================================================
   ROUTER
   ========================================================= */

async function route(req, res) {

    const method = req.method;
    const fullPath = req.url || "/";
    const path = fullPath.split("?")[0];

    if (method === "OPTIONS") {
        return send(res, 204, {});
    }

    const body = await readBody(req);

    /* =====================================================
       HEALTH
       ===================================================== */

    if (
        method === "GET" &&
        path === "/health"
    ) {

        return send(res, 200, {
            ok: true,
            version: "0.5.0",
            features: [
                "auth",
                "players",
                "assets",
                "businesses",
                "transport",
                "contracts",
                "alliances",
                "chat",
                "army",
                "wars",
                "missions",
                "loans",
                "rankings"
            ]
        });
    }

    /* =====================================================
       REGISTER
       ===================================================== */

    if (
        method === "POST" &&
        path === "/api/auth/register"
    ) {

        const email =
            String(body.email || "")
                .trim()
                .toLowerCase();

        const username =
            String(body.username || "player")
                .trim();

        const password =
            String(body.password || "");

        if (!email || !password) {

            return send(res, 400, {
                error: "email and password required"
            });
        }

        if (
            db.players.some(
                player =>
                    player.email === email
            )
        ) {

            return send(res, 409, {
                error: "account exists"
            });
        }

        const player = {

            id: db.nextId++,

            email,

            password:
                hash(password),

            username,

            companyName:
                String(
                    body.companyName ||
                    "My Company"
                ),

            country:
                String(
                    body.country ||
                    "IN"
                ),

            cash: 100000,

            gold: 100,

            level: 1,

            offensiveLevel: 1,

            defense: 100,

            ground: 0,

            air: 0
        };

        db.players.push(player);

        const token =
            createToken();

        db.sessions[token] =
            player.id;

        return send(res, 200, {
            token,
            player: playerView(player)
        });
    }

    /* =====================================================
       LOGIN
       ===================================================== */

    if (
        method === "POST" &&
        path === "/api/auth/login"
    ) {

        const email =
            String(body.email || "")
                .trim()
                .toLowerCase();

        const password =
            String(body.password || "");

        const player =
            db.players.find(
                p =>
                    p.email === email &&
                    p.password === hash(password)
            );

        if (!player) {

            return send(res, 401, {
                error: "invalid credentials"
            });
        }

        const token =
            createToken();

        db.sessions[token] =
            player.id;

        return send(res, 200, {
            token,
            player: playerView(player)
        });
    }

    /* =====================================================
       LOGOUT
       ===================================================== */

    if (
        method === "POST" &&
        path === "/api/auth/logout"
    ) {

        const player =
            authenticate(req);

        if (player) {

            for (
                const token of Object.keys(
                    db.sessions
                )
            ) {

                if (
                    db.sessions[token] ===
                    player.id
                ) {

                    delete db.sessions[token];
                }
            }
        }

        return send(res, 200, {
            ok: true
        });
    }

    /* =====================================================
       AUTHENTICATED ROUTES
       ===================================================== */

    const player =
        requirePlayer(req, res);

    if (!player) {
        return;
    }

    /* =====================================================
       CURRENT PLAYER
       ===================================================== */

    if (
        method === "GET" &&
        path === "/api/players/me"
    ) {

        return send(res, 200, {
            player:
                playerView(player)
        });
    }

    /* =====================================================
       ASSET CATALOG
       ===================================================== */

    if (
        method === "GET" &&
        path === "/api/assets"
    ) {

        const url =
            new URL(
                "http://localhost" +
                fullPath
            );

        const category =
            url.searchParams.get(
                "category"
            );

        const catalogItems =
            db.assets
                .filter(asset =>
                    !asset.ownerId &&
                    (
                        !category ||
                        asset.category ===
                        category
                    )
                )
                .map(asset => ({
                    ...asset
                }));

        const owned =
            db.assets
                .filter(asset =>
                    asset.ownerId ===
                    player.id
                )
                .map(asset => ({
                    ...asset,
                    owned: true
                }));

        return send(res, 200, {
            assets: [
                ...catalogItems,
                ...owned
            ]
        });
    }

    /* =====================================================
       BUY ASSET
       ===================================================== */

    if (
        method === "POST" &&
        path === "/api/assets/buy"
    ) {

        const type =
            String(body.type || "")
                .trim();

        const quantity =
            Math.max(
                1,
                Math.min(
                    100000,
                    Number(body.quantity) || 1
                )
            );

        if (!type) {

            return send(res, 400, {
                error:
                    "asset type required"
            });
        }

        const item =
            db.assets.find(
                asset =>
                    asset.type === type &&
                    !asset.ownerId
            );

        if (!item) {

            return send(res, 404, {
                error:
                    "asset not found",
                requestedType: type
            });
        }

        const cost =
            item.price *
            quantity;

        if (
            player.cash <
            cost
        ) {

            return send(res, 400, {
                error:
                    "insufficient cash",
                price: item.price,
                quantity,
                cost,
                cash: player.cash
            });
        }

        player.cash -= cost;

        let owned =
            db.assets.find(
                asset =>
                    asset.ownerId ===
                    player.id &&
                    asset.type ===
                    type
            );

        if (owned) {

            owned.quantity +=
                quantity;

        } else {

            owned = {
                ...item,

                id:
                    db.nextId++,

                ownerId:
                    player.id,

                quantity
            };

            db.assets.push(owned);
        }

        return send(res, 200, {
            ok: true,

            asset: {
                id: owned.id,
                type: owned.type,
                category: owned.category,
                quantity:
                    owned.quantity,
                price:
                    owned.price,
                income:
                    owned.income
            },

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
        method === "POST" &&
        path === "/api/assets/collect"
    ) {

        const income =
            db.assets
                .filter(asset =>
                    asset.ownerId ===
                    player.id
                )
                .reduce(
                    (total, asset) =>
                        total +
                        asset.income *
                        asset.quantity,
                    0
                );

        player.cash +=
            income;

        return send(res, 200, {

            ok: true,

            income,

            cash:
                player.cash,

            player:
                playerView(player)
        });
    }

    /* =====================================================
       CONTRACTS
       ===================================================== */

    if (
        method === "GET" &&
        path === "/api/contracts"
    ) {

        return send(res, 200, {
            contracts: [
                {
                    id: 1,
                    name:
                        "Natural Resources Contract",
                    country:
                        "India",
                    quantity:
                        1000,
                    marketValue:
                        500000,
                    status:
                        "open"
                },
                {
                    id: 2,
                    name:
                        "Transportation Contract",
                    country:
                        "Brazil",
                    quantity:
                        1500,
                    marketValue:
                        750000,
                    status:
                        "open"
                }
            ]
        });
    }

    /* =====================================================
       ALLIANCES
       ===================================================== */

    if (
        method === "GET" &&
        path === "/api/alliances"
    ) {

        return send(res, 200, {
            alliances:
                db.alliances
        });
    }

    if (
        method === "POST" &&
        path === "/api/alliances"
    ) {

        const alliance = {

            id:
                db.nextId++,

            name:
                String(
                    body.name ||
                    "Alliance"
                ),

            ownerId:
                player.id,

            members: [
                player.id
            ]
        };

        db.alliances.push(
            alliance
        );

        return send(res, 200, {
            alliance
        });
    }

    /* =====================================================
       CHAT
       ===================================================== */

    if (
        method === "GET" &&
        path === "/api/chat"
    ) {

        return send(res, 200, {
            messages:
                db.chat.slice(-100)
        });
    }

    if (
        method === "POST" &&
        path === "/api/chat"
    ) {

        const message = {

            id:
                db.nextId++,

            playerId:
                player.id,

            username:
                player.username,

            message:
                String(
                    body.message || ""
                ).slice(0, 500),

            at:
                Date.now()
        };

        db.chat.push(
            message
        );

        return send(res, 200, {
            ok: true,
            message
        });
    }

    /* =====================================================
       RANKINGS
       ===================================================== */

    if (
        method === "GET" &&
        path === "/api/rankings/global"
    ) {

        const rankings =
            db.players
                .map(playerView)
                .sort(
                    (a, b) =>
                        b.companyWorth -
                        a.companyWorth
                );

        return send(res, 200, {
            rankings
        });
    }

    /* =====================================================
       ARMY
       ===================================================== */

    if (
        method === "GET" &&
        path === "/api/army"
    ) {

        return send(res, 200, {

            army: {

                ground:
                    player.ground || 0,

                air:
                    player.air || 0,

                defense:
                    player.defense || 100,

                offensiveLevel:
                    player.offensiveLevel || 1
            }
        });
    }

    if (
        method === "POST" &&
        path === "/api/army/upgrade"
    ) {

        const quantity =
            Math.max(
                1,
                Number(body.quantity) || 1
            );

        const cost =
            quantity * 500;

        if (
            player.cash <
            cost
        ) {

            return send(res, 400, {
                error:
                    "insufficient cash"
            });
        }

        player.cash -= cost;

        player.ground =
            (player.ground || 0) +
            quantity;

        player.defense =
            (player.defense || 100) +
            quantity;

        return send(res, 200, {

            ok: true,

            cash:
                player.cash,

            army: {

                ground:
                    player.ground,

                air:
                    player.air || 0,

                defense:
                    player.defense,

                offensiveLevel:
                    player.offensiveLevel || 1
            }
        });
    }

    /* =====================================================
       LOANS
       ===================================================== */

    if (
        method === "GET" &&
        path === "/api/loans"
    ) {

        return send(res, 200, {
            loans:
                db.loans.filter(
                    loan =>
                        loan.playerId ===
                        player.id
                )
        });
    }

    if (
        method === "POST" &&
        path === "/api/loans"
    ) {

        const amount =
            Math.max(
                10000,
                Math.min(
                    10000000,
                    Number(body.amount) ||
                    10000
                )
            );

        const loan = {

            id:
                db.nextId++,

            playerId:
                player.id,

            amount,

            due:
                amount * 1.1,

            paid:
                false,

            createdAt:
                Date.now()
        };

        db.loans.push(
            loan
        );

        player.cash +=
            amount;

        return send(res, 200, {
            loan,
            cash:
                player.cash
        });
    }

    /* =====================================================
       MISSIONS
       ===================================================== */

    if (
        method === "GET" &&
        path === "/api/missions"
    ) {

        const hasBusiness =
            db.assets.some(
                asset =>
                    asset.ownerId ===
                    player.id &&
                    asset.category ===
                    "business"
            );

        return send(res, 200, {

            missions: [

                {
                    id: 1,
                    name:
                        "First Business",
                    reward:
                        25000,
                    done:
                        hasBusiness
                },

                {
                    id: 2,
                    name:
                        "Build Your Empire",
                    reward:
                        100000,
                    done:
                        db.assets.filter(
                            asset =>
                                asset.ownerId ===
                                player.id
                        ).length >= 5
                }
            ]
        });
    }

    /* =====================================================
       UNKNOWN ENDPOINT
       ===================================================== */

    return send(res, 404, {
        error:
            "endpoint not found"
    });
}

/* =========================================================
   CREATE SERVER
   ========================================================= */

const server =
    http.createServer(
        async (req, res) => {

            try {

                await route(
                    req,
                    res
                );

            } catch (error) {

                console.error(error);

                send(res, 500, {
                    error:
                        error.message ||
                        "internal server error"
                });
            }
        }
    );

server.listen(
    PORT,
    () => {
        console.log(
            "Entrepreneur Empire server running on port " +
            PORT
        );
    }
);
