const router = require('express').Router();
const db = require('../db');
const { authRequired } = require('../middleware/auth');

const createOrderTx = db.transaction((userId, items, customer) => {
  let total = 0;
  const rows = [];
  for (const it of items) {
    const p = db.prepare('SELECT * FROM products WHERE id=? AND is_active=1').get(it.productId);
    if (!p) throw new Error(`Товар #${it.productId} не найден`);
    const qty = Math.max(1, parseInt(it.qty, 10) || 1);
    if (p.stock < qty) throw new Error(`Недостаточно на складе: ${p.title}`);
    total += p.price * qty;
    rows.push({ ...p, qty });
  }
  if (!rows.length) throw new Error('Корзина пуста');

  const info = db.prepare(`
    INSERT INTO orders (user_id,status,total,name,phone,address,comment)
    VALUES (?, 'pending', ?, ?, ?, ?, ?)
  `).run(userId, total, customer.name, customer.phone, customer.address, customer.comment || null);

  const orderId = info.lastInsertRowid;
  const ins = db.prepare(
    'INSERT INTO order_items (order_id,product_id,title,price,qty) VALUES (?,?,?,?,?)'
  );
  for (const r of rows) ins.run(orderId, r.id, r.title, r.price, r.qty);
  return { orderId, total };
});

// --- создать заказ ---
router.post('/checkout', authRequired, (req, res) => {
  const { items, name, phone, address, comment } = req.body || {};
  if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'Пустая корзина' });
  if (!name || !phone || !address) return res.status(400).json({ error: 'Заполните ФИО, телефон и адрес' });

  try {
    const { orderId, total } = createOrderTx(req.user.id, items, { name, phone, address, comment });

    // используем mock-страницу оплаты:
    const paymentUrl = `/checkout.html?pay=${orderId}`;

    res.json({ orderId, total, paymentUrl });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// --- "оплата"  ---
router.post('/:id/pay', authRequired, (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id=? AND user_id=?')
    .get(req.params.id, req.user.id);
  if (!order) return res.status(404).json({ error: 'Заказ не найден' });
  if (order.status !== 'pending') return res.status(400).json({ error: 'Заказ уже оплачен' });

  const payTx = db.transaction(() => {
    const items = db.prepare('SELECT * FROM order_items WHERE order_id=?').all(order.id);
    for (const it of items) {
      const r = db.prepare('UPDATE products SET stock = stock - ? WHERE id=? AND stock >= ?')
        .run(it.qty, it.product_id, it.qty);
      if (r.changes === 0) throw new Error(`Нет на складе: ${it.title}`);
    }
    db.prepare("UPDATE orders SET status='paid', payment_id=? WHERE id=?")
      .run('mock-' + Date.now(), order.id);
  });

  try { payTx(); res.json({ ok: true, status: 'paid' }); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

// --- мои заказы ---
router.get('/my', authRequired, (req, res) => {
  const orders = db.prepare('SELECT * FROM orders WHERE user_id=? ORDER BY id DESC').all(req.user.id);
  for (const o of orders) {
    o.items = db.prepare('SELECT * FROM order_items WHERE order_id=?').all(o.id);
  }
  res.json({ orders });
});

// --- один заказ (страницы оплаты) ---
router.get('/:id', authRequired, (req, res) => {
  const o = db.prepare('SELECT * FROM orders WHERE id=? AND user_id=?')
    .get(req.params.id, req.user.id);
  if (!o) return res.status(404).json({ error: 'Заказ не найден' });
  o.items = db.prepare('SELECT * FROM order_items WHERE order_id=?').all(o.id);
  res.json({ order: o });
});

module.exports = router;