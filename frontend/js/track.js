const $ = (s) => document.querySelector(s);
const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const STEPS = ['Placed', 'Preparing', 'On the way', 'Delivered'];
let timer = null;
let current = null; // { id, phone } of the order being shown

function render(o) {
  const at = STEPS.indexOf(o.status);
  $('#result').innerHTML = `
    <div class="panel">
      <h2>Order #${o.id}</h2>
      <div class="steps">${STEPS.map((s, i) =>
        `<div class="step ${i <= at ? 'done' : ''}"><div class="dot">${i <= at ? '✓' : ''}</div>${s}</div>`).join('')}</div>
      <p><strong>Status:</strong> ${esc(o.status)}</p>
      ${o.rider_name ? `<p><strong>Your rider:</strong> ${esc(o.rider_name)}</p>` : ''}
      ${o.delivery_code ? `<div class="codebox">${esc(o.delivery_code)}</div><p class="empty">Your delivery code. Tell it to the rider only when you receive your food.</p>` : ''}
      <p><strong>Deliver to:</strong> ${esc(o.customer_name)}, ${esc(o.address)}</p>
      <table><tbody>${o.items.map((i) =>
        `<tr><td>${esc(i.name)} × ${i.quantity}</td><td>₹${(i.unit_price * i.quantity).toFixed(0)}</td></tr>`).join('')}
        <tr><td><strong>Total</strong></td><td><strong>₹${Number(o.total).toFixed(0)}</strong></td></tr></tbody></table>
      <p class="empty">This page refreshes every 5 seconds.</p>
    </div>`;
}

async function load(id, phone) {
  try {
    const res = await fetch(`/api/orders/${encodeURIComponent(id)}?phone=${encodeURIComponent(phone)}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not load the order.');
    render(data);
    current = { id, phone };
    $('#complaint-form').hidden = false;
    clearInterval(timer);
    if (data.status !== 'Delivered') timer = setInterval(() => load(id, phone), 5000);
  } catch (err) {
    clearInterval(timer);
    $('#result').innerHTML = `<p class="error">${esc(err.message)}</p>`;
  }
}

$('#track-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const f = Object.fromEntries(new FormData(e.target));
  load(f.id.trim(), f.phone.trim());
});

// prefill from the link or from the last order placed in this browser
const form = $('#track-form');
let last = {};
try { last = JSON.parse(localStorage.getItem('lastOrder') || '{}'); } catch {}
form.id.value = new URLSearchParams(location.search).get('id') || last.id || '';
form.phone.value = last.phone || '';
if (form.id.value && form.phone.value) load(form.id.value, form.phone.value);
form.phone.addEventListener('input', (e) => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10); });

$('#complaint-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = $('#complaint-msg');
  const f = Object.fromEntries(new FormData(e.target));
  try {
    const res = await fetch(`/api/orders/${encodeURIComponent(current.id)}/complaints`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: current.phone, reason: f.reason, details: f.details }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not send the complaint.');
    msg.className = 'msg ok'; msg.textContent = 'Complaint sent. The admin will look into it.';
    e.target.reset();
  } catch (err) { msg.className = 'msg error'; msg.textContent = err.message; }
});
