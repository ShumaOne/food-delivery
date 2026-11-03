import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../../public/css/style.css';

async function api(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Ошибка сети');
  return data;
}

function readCart() {
  try {
    const stored = JSON.parse(localStorage.getItem('cart') || '[]');
    return Array.isArray(stored)
      ? stored.filter(item => Number.isInteger(item.productId) && Number.isInteger(item.qty) && item.qty > 0)
      : [];
  } catch {
    return [];
  }
}

function formatPrice(cents) {
  return `${(cents / 100).toFixed(2)} ₽`;
}

function Header({ cartCount }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    api('/auth/me').then(({ user: currentUser }) => setUser(currentUser)).catch(() => setUser(null));
  }, []);

  async function logout(event) {
    event.preventDefault();
    try {
      await api('/auth/logout', { method: 'POST' });
      window.location.href = '/';
    } catch (error) {
      window.alert(error.message);
    }
  }

  return (
    <header>
      <div className="shell">
        <a href="/" className="brand"><span className="brand-mark">🥑</span> Продукты24</a>
        <nav>
          <a href="/cart.html">Корзина {cartCount > 0 && <span className="badge">{cartCount}</span>}</a>
          {user ? (
            <>
              <a href="/account.html">{user.name}</a>
              {user.role === 'admin' && <a href="/admin.html">Админка</a>}
              <a href="/" onClick={logout}>Выйти</a>
            </>
          ) : (
            <>
              <a href="/login.html">Войти</a>
              <a href="/register.html">Регистрация</a>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

function App() {
  const [cart, setCart] = useState(readCart);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [addedProductId, setAddedProductId] = useState(null);

  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    let active = true;
    api('/products')
      .then(({ items }) => {
        if (active) setProducts(items);
      })
      .catch(error => {
        if (active) setError(error.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  function addToCart(productId) {
    setCart(current => {
      const existing = current.find(item => item.productId === productId);
      return existing
        ? current.map(item => item.productId === productId ? { ...item, qty: item.qty + 1 } : item)
        : [...current, { productId, qty: 1 }];
    });
    setAddedProductId(productId);
    window.setTimeout(() => setAddedProductId(null), 1400);
  }

  const cartCount = cart.reduce((total, item) => total + item.qty, 0);

  return (
    <>
      <Header cartCount={cartCount} />
      <main>
        <section className="hero">
          <div>
            <div className="eyebrow">Свежие продукты каждый день</div>
            <h1>Продукты24</h1>
            <p>Выбирайте свежие продукты, заказывайте быстро и следите за статусом доставки в одном месте.</p>
            <div className="hero-actions">
              <a className="btn" href="/cart.html">Корзина</a>
              <a className="btn secondary" href="/login.html">Войти</a>
            </div>
          </div>
          <div className="hero-panel">
            <div className="hero-card">
              <div className="mini"><span>Скидка дня</span><span>−15%</span></div>
              <div className="big">450 ₽</div>
              <div className="meta"><span>Доставка 30 мин</span><span>Свежий выбор</span></div>
            </div>
          </div>
        </section>

        <h2>Каталог продуктов</h2>
        {loading && <p className="muted">Загружаем каталог...</p>}
        {error && <div className="error" role="alert">{error}</div>}
        {!loading && !error && products.length === 0 && <p className="muted">Пока нет доступных товаров.</p>}
        <div className="grid">
          {products.map(product => (
            <article className="card" key={product.id}>
              <a href={`/product.html?id=${product.id}`} className="img" aria-label={`Подробнее: ${product.title}`}>🛒</a>
              <a href={`/product.html?id=${product.id}`}>{product.title}</a>
              <div className="muted">{product.category || 'Продукты'}</div>
              <div className="price">{formatPrice(product.price)}</div>
              <button
                type="button"
                disabled={product.stock < 1}
                onClick={() => addToCart(product.id)}
              >
                {product.stock < 1
                  ? 'Нет в наличии'
                  : addedProductId === product.id ? 'Добавлено ✓' : 'В корзину'}
              </button>
            </article>
          ))}
        </div>
      </main>
    </>
  );
}

createRoot(document.getElementById('root')).render(<App />);
