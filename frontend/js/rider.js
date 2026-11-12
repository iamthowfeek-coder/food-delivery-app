const $ = (s) => document.querySelector(s);
const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let token = sessionStorage.getItem('riderToken') || '';
let riderName = sessionStorage.getItem('riderName') || '';
let timer = null;

function showMessage(text, type) { $('#rider-msg').className = 'msg ' + type; $('#rider-msg').textContent = text; }

function setView() {
  const loggedIn = Boolean(token);
  $('#login').hidden = loggedIn;
  $('#jobs-wrap').hidden = !loggedIn;
  $('#logout').hidden = !loggedIn;
  $('#rider-name').textContent = loggedIn ? riderName : '';
}

function logout() {
  token = ''; riderName = '';
  sessionStorage.clear();
  clearInterval(timer);
  $('#jobs').innerHTML = '';
  setView();
}

async function api(path, options = {}) {
  const res = await fetch(path, { ...options, headers: { 'Content-Type': 'application/json', 'x-rider-token': token } });
  const data = await res.json();
  if (res.status === 401 && token) { logout(); throw new Error('Please log in again.'); }
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function card(o) {
  const action = o.status === 'On the way'
    ? `<div class="actions"><input id="code-${o.id}" placeholder="Customer's 4-digit code" inputmode="numeric" maxlength="4" />
       <button class="btn" type="button" data-deliver="${o.id}">Confirm delivery</button></div>`
    : `<div class="actions"><button class="btn" type="button" data-pickup="${o.id}">Picked up, on the way</button></div>`;
  return `
    <div class="job">
      <strong>Order #${o.id}</strong> · ${esc(o.status)}
      <p>${esc(o.customer_name)} · <a href="tel:${esc(o.phone)}"><u>${esc(o.phone)}</u></a></p>
      <p>${esc(o.address)} · <a target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(o.address)}"><u>Open map</u></a></p>
      <p class="empty">${o.items.map(esc).join(', ')}</p>
      <p><strong>Amount to collect: ₹${Number(o.total).toFixed(0)}</strong></p>
      ${action}
    </div>`;
}

async function loadJobs() {
  if (!token) return;
  if (document.activeElement && document.activeElement.matches('#jobs input')) return; // don't wipe a typed code
  try {
    const data = await api('/api/rider/orders');
    $('#today').textContent = `Delivered today: ${data.delivered_today}`;
    $('#jobs').innerHTML = data.orders.length ? data.orders.map(card).join('') : '<p class="empty">No orders assigned to you right now.</p>';
  } catch (err) { showMessage(err.message, 'error'); }
}

function start() { setView(); loadJobs(); clearInterval(timer); timer = setInterval(loadJobs, 15000); }

$('#login').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = Object.fromEntries(new FormData(e.target));
  try {
    const data = await api('/api/rider/login', { method: 'POST', body: JSON.stringify(f) });
    token = data.token; riderName = data.name;
    sessionStorage.setItem('riderToken', token); sessionStorage.setItem('riderName', riderName);
    e.target.reset(); showMessage('', '');
    start();
  } catch (err) { showMessage(err.message, 'error'); }
});

$('#logout').addEventListener('click', logout);

document.addEventListener('input', (e) => {
  if (e.target.matches('input[inputmode="numeric"]')) e.target.value = e.target.value.replace(/\D/g, '');
});

document.addEventListener('click', async (e) => {
  const pickup = e.target.dataset.pickup;
  const deliver = e.target.dataset.deliver;
  if (!pickup && !deliver) return;
  try {
    if (pickup) {
      await api(`/api/rider/orders/${pickup}/pickup`, { method: 'POST' });
      showMessage(`Order #${pickup} is on the way.`, 'ok');
    } else {
      const code = document.querySelector(`#code-${deliver}`).value;
      await api(`/api/rider/orders/${deliver}/deliver`, { method: 'POST', body: JSON.stringify({ code }) });
      showMessage(`Order #${deliver} delivered. Well done!`, 'ok');
    }
  } catch (err) { showMessage(err.message, 'error'); }
  document.activeElement.blur();
  loadJobs();
});

if (token) start(); else setView();
