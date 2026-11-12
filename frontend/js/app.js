const $ = (s) => document.querySelector(s);
const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rupee = (n) => '₹' + Number(n).toFixed(0);

let menu = [];
let category = 'All';
let cart = {}; // { itemId: quantity }
try { cart = JSON.parse(localStorage.getItem('cart') || '{}'); } catch { cart = {}; }

const saveCart = () => { try { localStorage.setItem('cart', JSON.stringify(cart)); } catch {} };

async function loadMenu() {
  try {
    const res = await fetch('/api/menu');
    if (!res.ok) throw new Error('bad response');
    menu = await res.json();
    // drop cart items that no longer exist on the menu
    Object.keys(cart).forEach((id) => { if (!menu.some((m) => m.id === Number(id))) delete cart[id]; });
    renderFilters(); renderMenu(); renderCart();
  } catch {
    $('#menu').innerHTML = '<p class="error">Could not load the menu. Is the server running?</p>';
  }
}

function renderFilters() {
  const cats = ['All', ...new Set(menu.map((m) => m.category))];
  $('#filters').innerHTML = cats
    .map((c) => `<button type="button" class="chip ${c === category ? 'active' : ''}" data-cat="${esc(c)}">${esc(c)}</button>`)
    .join('');
}

function renderMenu() {
  const items = menu.filter((m) => category === 'All' || m.category === category);
  $('#menu').innerHTML = items
    .map((m) => `
      <article class="item">
        <div class="emoji">${esc(m.emoji)}</div>
        <h3>${esc(m.name)}</h3>
        <p>${esc(m.description || '')}</p>
        <div class="row"><strong>${rupee(m.price)}</strong>
        <button class="btn btn--small" type="button" data-add="${m.id}">Add</button></div>
      </article>`)
    .join('');
}

function renderCart() {
  const entries = Object.entries(cart).map(([id, qty]) => ({ item: menu.find((m) => m.id === Number(id)), qty })).filter((e) => e.item);
  const count = entries.reduce((s, e) => s + e.qty, 0);
  const total = entries.reduce((s, e) => s + e.qty * Number(e.item.price), 0);
  $('#cart-count').textContent = count;
  $('#cart-total').textContent = rupee(total);
  $('#cart-items').innerHTML = entries.length
    ? entries.map((e) => `
        <div class="cart-line">
          <span>${esc(e.item.name)}<br><small>${rupee(e.item.price)}</small></span>
          <span class="qty">
            <button type="button" data-dec="${e.item.id}" aria-label="Decrease">−</button>
            ${e.qty}
            <button type="button" data-inc="${e.item.id}" aria-label="Increase">+</button>
          </span>
        </div>`).join('')
    : '<p class="empty">Your cart is empty.</p>';
  $('#place').disabled = entries.length === 0;
}

function changeQty(id, delta) {
  const next = (cart[id] || 0) + delta;
  if (next <= 0) delete cart[id]; else cart[id] = Math.min(next, 20);
  saveCart(); renderCart();
}

document.addEventListener('click', (e) => {
  const t = e.target;
  if (t.dataset.cat) { category = t.dataset.cat; renderFilters(); renderMenu(); }
  else if (t.dataset.add) changeQty(t.dataset.add, 1);
  else if (t.dataset.inc) changeQty(t.dataset.inc, 1);
  else if (t.dataset.dec) changeQty(t.dataset.dec, -1);
  else if (t.id === 'cart-toggle') $('#cart').classList.toggle('open');
});

$('#checkout').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = $('#message');
  const btn = $('#place');
  const form = Object.fromEntries(new FormData(e.target));
  const items = Object.entries(cart).map(([id, quantity]) => ({ id: Number(id), quantity }));
  btn.disabled = true; msg.className = 'msg'; msg.textContent = 'Placing your order...';
  try {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, items }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not place the order.');
    try { localStorage.setItem('lastOrder', JSON.stringify({ id: data.order_id, phone: form.phone })); } catch {}
    cart = {}; saveCart(); renderCart(); e.target.reset();
    msg.className = 'msg ok';
    msg.innerHTML = `Order #${data.order_id} placed! Total ${rupee(data.total)}.<br>Your delivery code: <strong>${data.delivery_code}</strong> (tell it only to the rider at your door). <a href="/track.html?id=${data.order_id}"><u>Track it</u></a>`;
  } catch (err) {
    msg.className = 'msg error'; msg.textContent = err.message;
  } finally {
    btn.disabled = Object.keys(cart).length === 0;
  }
});

$('#checkout').phone.addEventListener('input', (e) => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10); });

loadMenu();
