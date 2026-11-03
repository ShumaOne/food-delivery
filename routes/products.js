const router = require('express').Router();
const db = require('../db');

router.get('/', (req, res) => {
  const { category, q } = req.query;
  let sql = 'SELECT * FROM products WHERE is_active=1';
  const args = [];
  if (category) { sql += ' AND category=?'; args.push(category); }
  if (q)        { sql += ' AND title LIKE ?'; args.push(`%${q}%`); }
  sql += ' ORDER BY id DESC';
  res.json({ items: db.prepare(sql).all(...args) });
});

router.get('/:id', (req, res) => {
  const p = db.prepare('SELECT * FROM products WHERE id=? AND is_active=1').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Не найден' });
  res.json({ product: p });
});

module.exports = router;