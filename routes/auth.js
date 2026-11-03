const router = require('express').Router();
const bcrypt = require('bcryptjs');
const db = require('../db');
const { sign, authRequired } = require('../middleware/auth');

router.post('/register', (req, res) => {
  const { email, password, name, phone } = req.body || {};
  if (!email || !password || !name) return res.status(400).json({ error: 'Заполните все поля' });
  if (password.length < 6) return res.status(400).json({ error: 'Пароль мин. 6 символов' });
  if (db.prepare('SELECT id FROM users WHERE email=?').get(email))
    return res.status(409).json({ error: 'Email уже занят' });

  const info = db.prepare(
    'INSERT INTO users (email,password_hash,name,phone) VALUES (?,?,?,?)'
  ).run(email, bcrypt.hashSync(password, 10), name, phone || null);

  const user = db.prepare('SELECT id,email,name,role FROM users WHERE id=?')
    .get(info.lastInsertRowid);

  res.cookie('token', sign(user), { httpOnly: true, sameSite: 'lax' });
  res.json({ user });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  const u = db.prepare('SELECT * FROM users WHERE email=?').get(email);
  if (!u || !bcrypt.compareSync(password, u.password_hash))
    return res.status(401).json({ error: 'Неверный email или пароль' });

  const user = { id: u.id, email: u.email, name: u.name, role: u.role };
  res.cookie('token', sign(user), { httpOnly: true, sameSite: 'lax' });
  res.json({ user });
});

router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

router.get('/me', authRequired, (req, res) => {
  const user = db.prepare(
    'SELECT id,email,name,phone,address,role FROM users WHERE id=?'
  ).get(req.user.id);
  res.json({ user });
});

module.exports = router;