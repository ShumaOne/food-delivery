const router = require('express').Router();
const db = require('../db');
const bcrypt = require('bcryptjs');
const { authRequired, adminRequired } = require('../middleware/auth');

router.use(authRequired, adminRequired);

// --- товары ---
router.get('/products', (req, res) =>
  res.json({ items: db.prepare('SELECT * FROM products ORDER BY id DESC').all() })
);

router.post('/products', (req, res) => {
  const { title, description, price, image_url, category, stock } = req.body;
  if (!title || !Number.isInteger(price)) return res.status(400).json({ error: 'Нужны title и price(в копейках)' });
  const info = db.prepare(`
    INSERT INTO products (title,description,price,image_url,category,stock)
    VALUES (?,?,?,?,?,?)`
  ).run(title, description || null, price, image_url || null, category || null, stock || 0);
  res.json({ product: db.prepare('SELECT * FROM products WHERE id=?').get(info.lastInsertRowid) });
});

router.patch('/products/:id', (req, res) => {
  const p = db.prepare('SELECT * FROM products WHERE id=?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Не найден' });
  const { title, description, price, image_url, category, stock, is_active } = req.body;
  db.prepare(`UPDATE products SET
    title=?, description=?, price=?, image_url=?, category=?, stock=?, is_active=?
    WHERE id=?`
  ).run(
    title ?? p.title, description ?? p.description, price ?? p.price,
    image_url ?? p.image_url, category ?? p.category,
    stock ?? p.stock, is_active ?? p.is_active, p.id
  );
  res.json({ ok: true });
});

router.delete('/products/:id', (req, res) => {
  db.prepare('DELETE FROM products WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// --- заказы ---
router.get('/orders', (req, res) => {
  const { status } = req.query;
  let sql = `SELECT o.*, u.email AS user_email FROM orders o
             LEFT JOIN users u ON u.id=o.user_id`;
  const args = [];
  if (status) { sql += ' WHERE o.status=?'; args.push(status); }
  sql += ' ORDER BY o.id DESC';
  const orders = db.prepare(sql).all(...args);
  for (const o of orders) {
    o.items = db.prepare('SELECT * FROM order_items WHERE order_id=?').all(o.id);
  }
  res.json({ orders });
});

router.patch('/orders/:id', (req, res) => {
  const { status } = req.body;
  const allowed = ['pending','paid','shipped','delivered','cancelled'];
  if (!allowed.includes(status)) return res.status(400).json({ error: 'Неверный статус' });
  const r = db.prepare('UPDATE orders SET status=? WHERE id=?').run(status, req.params.id);
  if (!r.changes) return res.status(404).json({ error: 'Не найден' });
  res.json({ ok: true });
});

// --- пользователи ---
router.get('/users', (req, res) => {
  res.json({ users: db.prepare(
    'SELECT id,email,name,phone,address,role,created_at FROM users ORDER BY id DESC'
  ).all() });
});

router.patch('/users/:id', (req, res) => {
  const { role, name, phone, address } = req.body;
  const u = db.prepare('SELECT * FROM users WHERE id=?').get(req.params.id);
  if (!u) return res.status(404).json({ error: 'Не найден' });
  db.prepare('UPDATE users SET role=?, name=?, phone=?, address=? WHERE id=?')
    .run(role ?? u.role, name ?? u.name, phone ?? u.phone, address ?? u.address, u.id);
  res.json({ ok: true });
});

router.post('/users/:id/reset-password', (req, res) => {
  const { password } = req.body;
  if (!password || password.length < 6) return res.status(400).json({ error: 'Пароль мин 6' });
  db.prepare('UPDATE users SET password_hash=? WHERE id=?')
    .run(bcrypt.hashSync(password, 10), req.params.id);
  res.json({ ok: true });
});

module.exports = router;