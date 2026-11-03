// ---------- обёртка над API ----------
async function api(path, opts = {}) {
  const res = await fetch('/api' + path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Ошибка сети');
  return data;
}
const fmt = cents => (cents / 100).toFixed(2) + ' ₽';

// ---------- корзина ----------
const cart = {
  get: () => JSON.parse(localStorage.getItem('cart') || '[]'),
  set(v) { localStorage.setItem('cart', JSON.stringify(v)); renderHeader(); },
  add(productId, qty = 1) {
    const c = cart.get();
    const e = c.find(x => x.productId === productId);
    if (e) e.qty += qty; else c.push({ productId, qty });
    cart.set(c);
  },
  remove(productId) { cart.set(cart.get().filter(x => x.productId !== productId)); },
  clear() { cart.set([]); },
  count() { return cart.get().reduce((s, x) => s + x.qty, 0); },
};

// ---------- шапка ----------
async function renderHeader() {
  const el = document.getElementById('header');
  if (!el) return;
  let user = null;
  try { user = (await api('/auth/me')).user; } catch {}
  el.innerHTML = `
    <div class="shell">
      <a href="/" class="brand"><span class="brand-mark">🥑</span> Продукты24</a>
      <nav>
        <a href="/cart.html">Корзина ${cart.count() ? `<span class="badge">${cart.count()}</span>` : ''}</a>
        ${user
          ? `<a href="/account.html">${user.name}</a>
             ${user.role === 'admin' ? '<a href="/admin.html">Админка</a>' : ''}
             <a href="#" id="logout">Выйти</a>`
          : `<a href="/login.html">Войти</a><a href="/register.html">Регистрация</a>`}
      </nav>
    </div>`;
  const lo = document.getElementById('logout');
  if (lo) lo.onclick = async e => {
    e.preventDefault();
    await api('/auth/logout', { method: 'POST' });
    location.href = '/';
  };
}

// ---------- роутинг по data-page ----------
document.addEventListener('DOMContentLoaded', async () => {
  renderHeader();
  const page = document.body.dataset.page;
  try {
    if (page === 'catalog') await pageCatalog();
    if (page === 'product') await pageProduct();
    if (page === 'cart')    pageCart();
    if (page === 'checkout') await pageCheckout();
    if (page === 'login')   pageLogin();
    if (page === 'register') pageRegister();
    if (page === 'account') await pageAccount();
    if (page === 'admin')   await pageAdmin();
  } catch (e) {
    alert(e.message);
  }
});

// ---------- страницы ----------
async function pageCatalog() {
  const { items } = await api('/products');
  document.getElementById('products').innerHTML = items.map(p => `
    <div class="card">
      <a href="/product.html?id=${p.id}" class="img">🛒</a>
      <a href="/product.html?id=${p.id}" style="font-weight:600">${p.title}</a>
      <div class="muted">${p.category || ''}</div>
      <div class="price">${fmt(p.price)}</div>
      <button data-add="${p.id}">В корзину</button>
    </div>`).join('');
  document.querySelectorAll('[data-add]').forEach(b => b.onclick = () => {
    cart.add(+b.dataset.add); renderHeader();
  });
}

async function pageProduct() {
  const id = new URLSearchParams(location.search).get('id');
  const { product: p } = await api('/products/' + id);
  document.getElementById('content').innerHTML = `
    <div class="card" style="max-width:560px">
      <div class="img" style="height:200px;font-size:64px">🛒</div>
      <h2 style="margin:0">${p.title}</h2>
      <div class="muted">${p.description || ''}</div>
      <div class="price">${fmt(p.price)}</div>
      <div class="muted">На складе: ${p.stock}</div>
      <div class="row" style="margin-top:8px">
        <input id="qty" type="number" min="1" value="1" style="width:90px">
        <button id="add">Добавить в корзину</button>
      </div>
    </div>`;
  document.getElementById('add').onclick = () => {
    cart.add(p.id, +document.getElementById('qty').value || 1);
    renderHeader(); alert('Добавлено');
  };
}

async function pageCart() {
  const items = cart.get();
  const cont = document.getElementById('content');
  if (!items.length) { cont.innerHTML = '<p>Корзина пуста. <a href="/">В каталог</a></p>'; return; }
  const { items: prods } = await api('/products');
  const rows = items.map(it => {
    const p = prods.find(x => x.id === it.productId) || { title: '—', price: 0 };
    return { ...it, title: p.title, price: p.price };
  });
  const total = rows.reduce((s, r) => s + r.price * r.qty, 0);
  cont.innerHTML = `
    ${rows.map(r => `
      <div class="cart-line">
        <div>${r.title}</div>
        <div>${r.qty} × ${fmt(r.price)}</div>
        <div class="price">${fmt(r.price * r.qty)}</div>
        <button class="danger" data-del="${r.productId}">Удалить</button>
      </div>`).join('')}
    <div class="row" style="justify-content:space-between;margin-top:16px">
      <div class="price">Итого: ${fmt(total)}</div>
      <a class="btn" href="/checkout.html">Оформить заказ</a>
    </div>`;
  cont.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
    cart.remove(+b.dataset.del); pageCart();
  });
}

async function pageCheckout() {
  const payId = new URLSearchParams(location.search).get('pay');
  const cont = document.getElementById('content');

  // --- страница оплаты ---
  if (payId) {
    const { order } = await api('/orders/' + payId);
    if (order.status !== 'pending') {
      cont.innerHTML = `<div class="notice">Заказ №${order.id} уже оплачен ✓</div>
        <a class="btn" href="/account.html">Мои заказы</a>`;
      return;
    }
    cont.innerHTML = `
      <h2>Оплата заказа №${order.id}</h2>
      ${order.items.map(i => `<div class="cart-line">
        <div>${i.title}</div><div>${i.qty} × ${fmt(i.price)}</div>
        <div class="price">${fmt(i.qty * i.price)}</div><div></div></div>`).join('')}
      <div class="price" style="margin:12px 0">К оплате: ${fmt(order.total)}</div>
      <div class="card">
        <label>Номер карты (демо)</label>
        <input value="4242 4242 4242 4242" disabled>
        <div class="row" style="margin-top:12px">
          <button id="pay">Оплатить ${fmt(order.total)}</button>
        </div>
        <p class="muted">Это мок-оплата. В проде — редирект на ЮKassa/Stripe.</p>
      </div>`;
    document.getElementById('pay').onclick = async () => {
      try {
        await api(`/orders/${order.id}/pay`, { method: 'POST' });
        cart.clear();
        cont.innerHTML = `<div class="notice">✅ Оплачено! Заказ №${order.id} принят.</div>
          <a class="btn" href="/account.html">Мои заказы</a>`;
      } catch (e) { alert(e.message); }
    };
    return;
  }

  // --- форма оформления ---
  const items = cart.get();
  if (!items.length) { cont.innerHTML = '<p>Корзина пуста</p>'; return; }
  let me = {};
  try { me = (await api('/auth/me')).user; } catch {
    cont.innerHTML = '<p>Нужно <a href="/login.html">войти</a> для оформления.</p>';
    return;
  }
  cont.innerHTML = `
    <h2>Оформление заказа</h2>
    <div class="form">
      <label>Имя</label><input id="f-name" value="${me.name || ''}">
      <label>Телефон</label><input id="f-phone" value="${me.phone || ''}" placeholder="+7 ...">
      <label>Адрес доставки</label><textarea id="f-address" rows="2">${me.address || ''}</textarea>
      <label>Комментарий</label><input id="f-comment" placeholder="домофон, подъезд...">
      <div id="err" class="error"></div>
      <button id="go" style="margin-top:16px">Перейти к оплате</button>
    </div>`;
  document.getElementById('go').onclick = async () => {
    try {
      const body = {
        items,
        name:    document.getElementById('f-name').value.trim(),
        phone:   document.getElementById('f-phone').value.trim(),
        address: document.getElementById('f-address').value.trim(),
        comment: document.getElementById('f-comment').value.trim(),
      };
      const r = await api('/orders/checkout', { method: 'POST', body });
      location.href = r.paymentUrl;
    } catch (e) {
      document.getElementById('err').textContent = e.message;
    }
  };
}

function pageLogin() {
  document.getElementById('content').innerHTML = `
    <div class="form">
      <h2>Вход</h2>
      <label>Email</label><input id="email" type="email">
      <label>Пароль</label><input id="password" type="password">
      <div id="err" class="error"></div>
      <button id="go" style="margin-top:16px">Войти</button>
    </div>`;
  document.getElementById('go').onclick = async () => {
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    try {
      await api('/auth/login', { method: 'POST', body: {
        email: emailInput.value,
        password: passwordInput.value,
      }});
      location.href = '/';
    } catch (e) { document.getElementById('err').textContent = e.message; }
  };
}

function pageRegister() {
  document.getElementById('content').innerHTML = `
    <div class="form">
      <h2>Регистрация</h2>
      <label>Имя</label><input id="name">
      <label>Email</label><input id="email" type="email">
      <label>Пароль</label><input id="password" type="password" minlength="6">
      <div id="err" class="error"></div>
      <button id="go" style="margin-top:16px">Создать</button>
    </div>`;
  document.getElementById('go').onclick = async () => {
    const nameInput = document.getElementById('name');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    try {
      await api('/auth/register', { method: 'POST', body: {
        name: nameInput.value,
        email: emailInput.value,
        password: passwordInput.value,
      }});
      location.href = '/';
    } catch (e) { document.getElementById('err').textContent = e.message; }
  };
}

async function pageAccount() {
  const cont = document.getElementById('content');
  try {
    const { user } = await api('/auth/me');
    const { orders } = await api('/orders/my');
    cont.innerHTML = `
      <h2>Личный кабинет</h2>
      <div class="card" style="margin-bottom:16px; max-width:640px">
        <div class="row" style="justify-content:space-between; align-items:flex-start">
          <div>
            <div class="muted">Профиль</div>
            <h3 style="margin:6px 0">${user.name}</h3>
            <div>${user.email}</div>
          </div>
          <div class="badge">${user.role}</div>
        </div>
      </div>
      <h3>Мои заказы</h3>
      ${orders.length ? orders.map(o => `
        <div class="card" style="margin-bottom:12px">
          <div class="row" style="justify-content:space-between">
            <div><b>Заказ №${o.id}</b> <span class="muted">${o.created_at}</span></div>
            <div class="price">${fmt(o.total)}</div>
            <div><span class="badge">${o.status}</span></div>
          </div>
          <div class="muted">${o.items.map(i => `${i.title} × ${i.qty}`).join(', ') || 'Товары не указаны'}</div>
          <div class="muted">${o.address}</div>
        </div>`).join('') : '<p>Заказов пока нет</p>'}`;
  } catch (e) {
    cont.innerHTML = `
      <div class="form">
        <h2>Личный кабинет</h2>
        <p>Войдите в систему, чтобы посмотреть свои заказы.</p>
        <a class="btn" href="/login.html">Войти</a>
      </div>`;
  }
}

async function pageAdmin() {
  const { user } = await api('/auth/me').catch(() => ({}));
  if (!user || user.role !== 'admin') {
    document.getElementById('content').innerHTML = '<p>Доступ запрещён</p>';
    return;
  }
  document.getElementById('content').innerHTML = `
    <div class="tabs">
      <button data-tab="products" class="active">Товары</button>
      <button data-tab="orders">Заказы</button>
      <button data-tab="users">Пользователи</button>
    </div>
    <div id="panel"></div>`;
  document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => {
    document.querySelectorAll('.tabs button').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    adminTab(b.dataset.tab);
  });
  adminTab('products');
}

async function adminTab(tab) {
  const p = document.getElementById('panel');
  if (tab === 'products') {
    const { items } = await api('/admin/products');
    p.innerHTML = `
      <h3>Добавить товар</h3>
      <div class="card">
        <label>Название</label><input id="p-title">
        <label>Описание</label><input id="p-desc">
        <label>Категория</label><input id="p-cat">
        <label>Цена (в копейках)</label><input id="p-price" type="number">
        <label>Склад</label><input id="p-stock" type="number" value="0">
        <button id="p-add" style="margin-top:12px">Создать</button>
      </div>
      <h3 style="margin-top:24px">Все товары</h3>
      <table><tr><th>ID</th><th>Название</th><th>Цена</th><th>Склад</th><th>Активен</th><th></th></tr>
        ${items.map(i => `<tr>
          <td>${i.id}</td><td>${i.title}</td><td>${fmt(i.price)}</td>
          <td><input type="number" value="${i.stock}" data-stock="${i.id}" style="width:80px"></td>
          <td><input type="checkbox" ${i.is_active ? 'checked' : ''} data-act="${i.id}"></td>
          <td><button class="danger" data-del="${i.id}">Удалить</button></td>
        </tr>`).join('')}
      </table>`;
    document.getElementById('p-add').onclick = async () => {
      await api('/admin/products', { method: 'POST', body: {
        title: p_title.value, description: p_desc.value, category: p_cat.value,
        price: +p_price.value, stock: +p_stock.value,
      }});
      adminTab('products');
    };
    p.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
      if (!confirm('Удалить?')) return;
      await api('/admin/products/' + b.dataset.del, { method: 'DELETE' });
      adminTab('products');
    });
    p.querySelectorAll('[data-stock]').forEach(inp => inp.onchange = async () => {
      await api('/admin/products/' + inp.dataset.stock, { method: 'PATCH',
        body: { stock: +inp.value } });
    });
    p.querySelectorAll('[data-act]').forEach(cb => cb.onchange = async () => {
      await api('/admin/products/' + cb.dataset.act, { method: 'PATCH',
        body: { is_active: cb.checked ? 1 : 0 } });
    });
  }

  if (tab === 'orders') {
    const { orders } = await api('/admin/orders');
    p.innerHTML = `<table>
      <tr><th>№</th><th>Пользователь</th><th>Сумма</th><th>Статус</th><th>Адрес</th></tr>
      ${orders.map(o => `<tr>
        <td>${o.id}</td><td>${o.user_email || '—'}</td><td>${fmt(o.total)}</td>
        <td>
          <select data-status="${o.id}">
            ${['pending','paid','shipped','delivered','cancelled'].map(s =>
              `<option ${s===o.status?'selected':''}>${s}</option>`).join('')}
          </select>
        </td>
        <td>${o.address}</td>
      </tr>`).join('')}
    </table>`;
    p.querySelectorAll('[data-status]').forEach(sel => sel.onchange = async () => {
      await api('/admin/orders/' + sel.dataset.status, {
        method: 'PATCH', body: { status: sel.value },
      });
    });
  }

  if (tab === 'users') {
    const { users } = await api('/admin/users');
    p.innerHTML = `<table>
      <tr><th>ID</th><th>Email</th><th>Имя</th><th>Роль</th><th></th></tr>
      ${users.map(u => `<tr>
        <td>${u.id}</td><td>${u.email}</td><td>${u.name}</td>
        <td>
          <select data-role="${u.id}">
            <option ${u.role==='customer'?'selected':''}>customer</option>
            <option ${u.role==='admin'?'selected':''}>admin</option>
          </select>
        </td>
        <td><button class="secondary" data-reset="${u.id}">Сменить пароль</button></td>
      </tr>`).join('')}
    </table>`;
    p.querySelectorAll('[data-role]').forEach(sel => sel.onchange = async () => {
      await api('/admin/users/' + sel.dataset.role, {
        method: 'PATCH', body: { role: sel.value },
      });
    });
    p.querySelectorAll('[data-reset]').forEach(b => b.onclick = async () => {
      const password = prompt('Новый пароль (мин. 6 символов):');
      if (!password) return;
      await api(`/admin/users/${b.dataset.reset}/reset-password`, {
        method: 'POST', body: { password },
      });
      alert('Готово');
    });
  }
}