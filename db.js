const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const db = new Database(path.join(__dirname, 'shop.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  role TEXT NOT NULL DEFAULT 'customer',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  price INTEGER NOT NULL,           -- в копейках
  image_url TEXT,
  category TEXT,
  stock INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'pending',   -- pending|paid|shipped|delivered|cancelled
  total INTEGER NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  comment TEXT,
  payment_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  title TEXT NOT NULL,
  price INTEGER NOT NULL,
  qty INTEGER NOT NULL
);
`);

// --- seed admin ---
const adminEmail = process.env.ADMIN_EMAIL;
const adminPass  = process.env.ADMIN_PASSWORD;
if (!adminEmail || !adminPass) {
  throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD must be set in the environment');
}
if (!db.prepare('SELECT id FROM users WHERE email=?').get(adminEmail)) {
  db.prepare('INSERT INTO users (email,password_hash,name,role) VALUES (?,?,?,?)')
    .run(adminEmail, bcrypt.hashSync(adminPass, 10), 'Администратор', 'admin');
}

// --- seed products ---
if (db.prepare('SELECT COUNT(*) c FROM products').get().c === 0) {
  const ins = db.prepare(
    'INSERT INTO products (title,description,price,image_url,category,stock) VALUES (?,?,?,?,?,?)'
  );
  ins.run('Молоко 1л',       '3.2%, пастеризованное', 8900, '',  'Молочное', 100);
  ins.run('Хлеб белый',      'Нарезной, 400г',         4500, '',  'Хлеб',     80);
  ins.run('Яйца С1, 10 шт',  'Куриные, свежие',       12900, '',  'Яйца',    150);
  ins.run('Сыр Гауда',       'Молодой, 250г',         24900, '',  'Молочное', 60);
  ins.run('Бананы',          'Спелые, 1 кг',           9900, '',  'Фрукты',   200);
  ins.run('Кофе зерновой',   'Арабика, 1 кг',        119000, '',  'Напитки',  30);
}

module.exports = db;