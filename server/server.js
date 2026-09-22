'use strict';

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

const app = express();

const PORT = Number(process.env.PORT) || 10000;
const HOST = '0.0.0.0';
const JWT_SECRET = process.env.JWT_SECRET || 'CHANGE_THIS_SECRET_IN_RENDER';
const DATA_FILE = process.env.DATA_FILE || path.join('/tmp', 'entrepreneur-data.json');

app.use(cors());
app.use(express.json({ limit: '1mb' }));

function emptyDb() {
  return {
    users: [],
    assets: [],
    messages: [],
    alliances: [],
    contracts: [],
    wars: [],
    worldSites: []
  };
}

function loadDb() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      const db = emptyDb();
      fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
      return db;
    }
    const parsed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    return { ...emptyDb(), ...parsed };
  } catch (e) {
    console.error('Database read error:', e);
    return emptyDb();
  }
}

function saveDb(db) {
  try {
    const dir = path.dirname(DATA_FILE);
    fs.mkdirSync(dir, { recursive: true });
    const temp = DATA_FILE + '.tmp';
    fs.writeFileSync(temp, JSON.stringify(db, null, 2));
    fs.renameSync(temp, DATA_FILE);
  } catch (e) {
    console.error('Database write error:', e);
  }
}

const catalog = {
  business: [
    { name: 'Pub', price: 200, category: 'Leisure', income: 10 },
    { name: 'Dance club', price: 220, category: 'Leisure', income: 11 },
    { name: 'Coffee shop', price: 150, category: 'Leisure', income: 7 },
    { name: 'Restaurant', price: 220, category: 'Leisure', income: 11 },
    { name: 'Movie theater', price: 350, category: 'Leisure', income: 17 },
    { name: 'Mall', price: 500, category: 'Commerce', income: 25 },
    { name: 'Clothes shop', price: 150, category: 'Commerce', income: 7 },
    { name: 'Supermarket', price: 250, category: 'Commerce', income: 12 },
    { name: 'Fast food', price: 150, category: 'Commerce', income: 7 },
    { name: 'Living building', price: null, category: 'Real Estate', income: 0, requirement: 'Real Estate concession' },
    { name: 'Office building', price: null, category: 'Real Estate', income: 0, requirement: 'Real Estate concession' }
  ],

  transportation: [
    { name: 'Taxi', price: 100, category: 'Ground lines', income: 5 },
    { name: 'Bus', price: 150, category: 'Ground lines', income: 7 },
    { name: 'Train', price: 250, category: 'Ground lines', income: 12 },
    { name: 'VIP Limousines', price: 500, category: 'Ground lines', income: 25 },
    { name: 'Passengers plane', price: 800, category: 'Air lines', income: 40 },
    { name: 'Cargo plane', price: 850, category: 'Air lines', income: 42 },
    { name: 'Passengers ship', price: null, category: 'Sea lines', income: 0, requirement: 'Sea Lines concession' },
    { name: 'Cargo ship', price: null, category: 'Sea lines', income: 0, requirement: 'Sea Lines concession' }
  ],

  concessions: [
    { name: 'Ground Transport', price: 25000 },
    { name: 'Commerce', price: 30000 },
    { name: 'Leisure', price: 75000 },
    { name: 'Air Lines', price: 150000 },
    { name: 'Sea Lines', price: 400000 },
    { name: 'Real Estate', price: 800000 },
    { name: 'War Industry', price: 1000000 },
    { name: 'Space', price: 2000000 },
    { name: 'Robotics', price: 5000000 },
    { name: 'Nuclear', price: 10000000 },
    { name: 'Advanced war', price: 50000000 }
  ],

  resources: [
    { name: 'Salt', price: 93 },
    { name: 'Iron', price: 157 },
    { name: 'Aluminum', price: 30 },
    { name: 'Copper', price: 202 },
    { name: 'Silver', price: 242 },
    { name: 'Oil', price: 588 },
    { name: 'Gold', price: 201 },
    { name: 'Diamonds', price: 286 },
    { name: 'Gems', price: 880 }
  ],

  subsidiaries: [
    { name: 'Mining company', price: 15000 },
    { name: 'Traveling company', price: 45000 },
    { name: 'Soccer team', price: 30000 },
    { name: 'Brokerage company', price: 300000 },
    { name: 'Army experiments', price: 150000 },
    { name: 'Robotics program', price: 350000 },
    { name: 'Nuclear program', price: 500000 },
    { name: 'Advanced medical', price: 35, currency: 'gold' },
    { name: 'Space center', price: 35, currency: 'gold' }
  ],

  products: [
    { name: 'Spa Products', price: 3025 },
    { name: 'Silverware', price: 6490 },
    { name: 'Remote Control Cars', price: 7150 },
    { name: 'Gold Plated Watch', price: 9185 },
    { name: "Iron Furniture's", price: 8992 },
    { name: 'Cameras', price: 10835 },
    { name: 'Diamonds Jewelery', price: 44000 },
    { name: 'Gemstones', price: 29150 },
    { name: 'luxury-jewelry', price: 44000 },
    { name: 'Computers', price: 28875 },
    { name: 'Smart-phones', price: 24420 },
    { name: 'Gaming Consoles', price: 25575 },
    { name: 'Family Cars', price: 40425 },
    { name: 'Sports Cars', price: 49280 },
    { name: 'Advanced Tactical Weapons', price: 67100 },
    { name: 'Armored Vehicles', price: 66550 }
  ]
};

function makeId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    cash: user.cash,
    gold: user.gold,
    level: user.level,
    createdAt: user.createdAt
  };
}

function auth(req, res, next) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization token required' });
  }

  try {
    req.user = jwt.verify(header.slice(7), JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function findCatalogItem(name) {
  for (const [category, items] of Object.entries(catalog)) {
    const item = items.find(x => x.name.toLowerCase() === String(name).toLowerCase());
    if (item) return { ...item, category };
  }
  return null;
}

function getUser(db, id) {
  return db.users.find(u => u.id === id);
}

function calculateIncome(db, userId) {
  return db.assets
    .filter(a => a.userId === userId)
    .reduce((sum, a) => sum + Number(a.incomePerMinute || 0), 0);
}

function updateOfflineIncome(db, user) {
  const now = Date.now();
  const elapsedMinutes = Math.floor((now - Number(user.lastIncomeAt || now)) / 60000);

  if (elapsedMinutes <= 0) return 0;

  const perMinute = calculateIncome(db, user.id);
  const earned = perMinute * elapsedMinutes;

  user.cash += earned;
  user.lastIncomeAt = now;

  return earned;
}

/* ---------- Public routes ---------- */

app.get('/', (req, res) => {
  res.json({
    name: 'Entrepreneur Empire Multiplayer Server',
    status: 'online',
    version: '1.0.0'
  });
});

app.get('/health', (req, res) => {
  res.status(200).json({
    ok: true,
    service: 'entrepreneur-empire',
    uptime: process.uptime(),
    time: new Date().toISOString()
  });
});

app.get('/api/catalog', (req, res) => {
  res.json(catalog);
});

/* ---------- Authentication ---------- */

app.post('/api/auth/register', async (req, res) => {
  try {
    const username = String(req.body?.username || '').trim();
    const password = String(req.body?.password || '');

    if (!/^[A-Za-z0-9_.-]{3,24}$/.test(username)) {
      return res.status(400).json({
        error: 'Username must be 3-24 characters and use letters, numbers, _, ., or -'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must contain at least 6 characters' });
    }

    const db = loadDb();

    if (db.users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    const user = {
      id: makeId(),
      username,
      passwordHash: await bcrypt.hash(password, 10),
      cash: 10000,
      gold: 10,
      level: 1,
      createdAt: Date.now(),
      lastIncomeAt: Date.now()
    };

    db.users.push(user);
    saveDb(db);

    const token = jwt.sign(
      { id: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.status(201).json({
      token,
      user: publicUser(user)
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const username = String(req.body?.username || '').trim();
    const password = String(req.body?.password || '');

    const db = loadDb();
    const user = db.users.find(u => u.username.toLowerCase() === username.toLowerCase());

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    updateOfflineIncome(db, user);
    saveDb(db);

    const token = jwt.sign(
      { id: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      token,
      user: publicUser(user)
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Login failed' });
  }
});

/* ---------- Player ---------- */

app.get('/api/players/me', auth, (req, res) => {
  const db = loadDb();
  const user = getUser(db, req.user.id);

  if (!user) return res.status(404).json({ error: 'Player not found' });

  const earned = updateOfflineIncome(db, user);
  saveDb(db);

  res.json({
    ...publicUser(user),
    incomePerMinute: calculateIncome(db, user.id),
    earnedSinceLastUpdate: earned,
    assetCount: db.assets.filter(a => a.userId === user.id).length
  });
});

app.get('/api/players/online', auth, (req, res) => {
  const db = loadDb();

  res.json({
    players: db.users.map(publicUser),
    count: db.users.length
  });
});

/* ---------- Assets ---------- */

app.get('/api/assets', auth, (req, res) => {
  const db = loadDb();
  const user = getUser(db, req.user.id);

  if (!user) return res.status(404).json({ error: 'Player not found' });

  updateOfflineIncome(db, user);
  saveDb(db);

  res.json({
    catalog,
    owned: db.assets.filter(a => a.userId === user.id)
  });
});

app.post('/api/assets/buy', auth, (req, res) => {
  const db = loadDb();
  const user = getUser(db, req.user.id);

  if (!user) return res.status(404).json({ error: 'Player not found' });

  updateOfflineIncome(db, user);

  const name = String(req.body?.assetName || '').trim();
  const item = findCatalogItem(name);

  if (!item) return res.status(404).json({ error: 'Asset not found' });

  if (item.price === null) {
    return res.status(400).json({
      error: `Unlock required: ${item.requirement || 'required concession'}`
    });
  }

  if (item.currency === 'gold') {
    if (user.gold < item.price) {
      return res.status(400).json({ error: 'Not enough gold' });
    }

    user.gold -= item.price;
  } else {
    if (user.cash < item.price) {
      return res.status(400).json({ error: 'Not enough cash' });
    }

    user.cash -= item.price;
  }

  const asset = {
    id: makeId(),
    userId: user.id,
    name: item.name,
    category: item.category,
    price: item.price,
    currency: item.currency || 'cash',
    incomePerMinute: Number(item.income || 0),
    boughtAt: Date.now()
  };

  db.assets.push(asset);
  saveDb(db);

  res.status(201).json({
    ok: true,
    asset,
    user: publicUser(user)
  });
});

app.post('/api/assets/sell', auth, (req, res) => {
  const db = loadDb();
  const user = getUser(db, req.user.id);

  const asset = db.assets.find(
    a => a.id === req.body?.assetId && a.userId === user?.id
  );

  if (!asset) return res.status(404).json({ error: 'Asset not found' });

  updateOfflineIncome(db, user);

  const refund = Math.floor(Number(asset.price || 0) * 0.70);

  if (asset.currency === 'gold') {
    user.gold += refund;
  } else {
    user.cash += refund;
  }

  db.assets = db.assets.filter(a => a.id !== asset.id);
  saveDb(db);

  res.json({
    ok: true,
    refund,
    user: publicUser(user)
  });
});

app.post('/api/assets/collect', auth, (req, res) => {
  const db = loadDb();
  const user = getUser(db, req.user.id);

  if (!user) return res.status(404).json({ error: 'Player not found' });

  const earned = updateOfflineIncome(db, user);
  saveDb(db);

  res.json({
    ok: true,
    amount: earned,
    cash: user.cash,
    incomePerMinute: calculateIncome(db, user.id)
  });
});

/* ---------- Rankings ---------- */

app.get('/api/rankings', auth, (req, res) => {
  const db = loadDb();

  const rankings = db.users.map(user => {
    const owned = db.assets.filter(a => a.userId === user.id);

    return {
      rank: 0,
      username: user.username,
      level: user.level,
      cash: user.cash,
      assets: owned.length,
      companyValue: owned.reduce((s, a) => s + Number(a.price || 0), 0),
      netWorth: user.cash + owned.reduce((s, a) => s + Number(a.price || 0), 0)
    };
  }).sort((a, b) => b.netWorth - a.netWorth);

  rankings.forEach((x, i) => x.rank = i + 1);

  res.json(rankings);
});

/* ---------- Alliances ---------- */

app.get('/api/alliances', auth, (req, res) => {
  res.json(loadDb().alliances);
});

app.get('/api/alliances/rankings', auth, (req, res) => {
  const db = loadDb();

  const result = db.alliances.map(a => ({
    id: a.id,
    name: a.name,
    members: a.members.length
  })).sort((a, b) => b.members - a.members);

  res.json(result);
});

app.post('/api/alliances', auth, (req, res) => {
  const db = loadDb();
  const name = String(req.body?.name || '').trim();

  if (name.length < 3 || name.length > 32) {
    return res.status(400).json({ error: 'Alliance name must be 3-32 characters' });
  }

  const alliance = {
    id: makeId(),
    name,
    ownerId: req.user.id,
    members: [req.user.id],
    createdAt: Date.now()
  };

  db.alliances.push(alliance);
  saveDb(db);

  res.status(201).json(alliance);
});

/* ---------- Chat ---------- */

app.get('/api/chat', auth, (req, res) => {
  const db = loadDb();
  res.json(db.messages.slice(-100));
});

app.post('/api/chat', auth, (req, res) => {
  const text = String(req.body?.text || '').trim();

  if (!text || text.length > 500) {
    return res.status(400).json({ error: 'Message must contain 1-500 characters' });
  }

  const db = loadDb();

  const message = {
    id: makeId(),
    userId: req.user.id,
    username: req.user.username,
    text,
    createdAt: Date.now()
  };

  db.messages.push(message);
  db.messages = db.messages.slice(-1000);
  saveDb(db);

  res.status(201).json(message);
});

/* ---------- Contracts ---------- */

app.get('/api/contracts', auth, (req, res) => {
  res.json(loadDb().contracts);
});

app.get('/api/contracts/running', auth, (req, res) => {
  res.json(loadDb().contracts.filter(c => c.status === 'running'));
});

app.get('/api/contracts/bids/ranking', auth, (req, res) => {
  res.json([]);
});

/* ---------- Army / Wars ---------- */

app.get('/api/army', auth, (req, res) => {
  const db = loadDb();
  res.json(db.assets.filter(a => a.userId === req.user.id && a.category === 'army'));
});

app.post('/api/army/upgrade', auth, (req, res) => {
  res.json({
    ok: true,
    message: 'Army upgrade endpoint is active. Add your final army rules here.'
  });
});

app.get('/api/wars', auth, (req, res) => {
  res.json(loadDb().wars);
});

/* ---------- World ---------- */

app.get('/api/world/sites', auth, (req, res) => {
  res.json(loadDb().worldSites);
});

app.post('/api/world/sites/claim', auth, (req, res) => {
  const db = loadDb();
  const site = db.worldSites.find(s => s.id === req.body?.siteId);

  if (!site) return res.status(404).json({ error: 'World site not found' });

  if (site.ownerId && site.ownerId !== req.user.id) {
    return res.status(409).json({ error: 'World site already claimed' });
  }

  site.ownerId = req.user.id;
  saveDb(db);

  res.json(site);
});

/* ---------- Error handling ---------- */

app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found',
    method: req.method,
    path: req.path
  });
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, HOST, () => {
  console.log(`Entrepreneur Empire server listening on http://${HOST}:${PORT}`);
});
