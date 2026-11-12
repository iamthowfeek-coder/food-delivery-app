const $ = (s) => document.querySelector(s);
const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const STATUSES = ['Placed', 'Preparing', 'On the way', 'Delivered'];
const when = (d) => new Date(d).toLocaleString();
let key = '';
let timer = null;

async function api(path, options = {}) {
  const res = await fetch(path, { ...options, headers: { 'Content-Type': 'application/json', 'x-admin-key': key } });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function showMessage(text, type) { $('#admin-msg').className = 'msg ' + type; $('#admin-msg').textContent = text; }

const options = (list, selected) => list.map((s) => `<option ${s === selected ? 'selected' : ''}>${s}</option>`).join('');

async function loadAll() {
  // don't redraw while the admin is using a dropdown, typing, or reading a history
  const a = document.activeElement;
  if ((a && a.matches('select, input')) || document.querySelector('#complaints details[open]')) return;
  try {
    const [orders, summary, riders, complaints] = await Promise.all([
      api('/api/orders'), api('/api/orders/summary'), api('/api/riders'), api('/api/complaints'),
    ]);
    $('#stat-orders').textContent = summary.order_count;
    $('#stat-revenue').textContent = '₹' + Number(summary.total_revenue).toLocaleString('en-IN');

    $('#orders').innerHTML = orders.map((o) => `
      <tr>
        <td>${o.id}</td><td>${esc(o.customer_name)}</td><td>₹${Number(o.total).toFixed(0)}</td>
        <td><select data-kind="rider" data-id="${o.id}">
          <option value="">Unassigned</option>
          ${riders.map((r) => `<option value="${r.id}" ${r.id === o.rider_id ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}
        </select></td>
        <td><select data-kind="status" data-id="${o.id}">${options(STATUSES, o.status)}</select></td>
      </tr>`).join('');

    $('#riders').innerHTML = riders.length ? riders.map((r) => `${esc(r.name)} (${esc(r.phone)})`).join(' · ') : 'No riders yet. Add one above.';

    $('#complaints').innerHTML = complaints.length ? complaints.map((c) => `
      <div class="job">
        <strong>Order #${c.order_id}</strong> · ${esc(c.customer_name)} · ${esc(c.reason)}
        <p>${esc(c.details || '')}</p>
        <p class="empty">Rider: ${esc(c.rider_name || 'none')} · ${when(c.created_at)}</p>
        <details><summary>Order history</summary>
          ${c.history.map((h) => `<div class="empty">${esc(h.status)} · ${esc(h.changed_by)} · ${when(h.changed_at)}</div>`).join('')}
        </details>
        <select data-kind="complaint" data-id="${c.id}">${options(['Open', 'Resolved'], c.status)}</select>
      </div>`).join('') : '<p class="empty">No complaints.</p>';
  } catch (err) {
    clearInterval(timer);
    showMessage(err.message, 'error');
  }
}

$('#key-form').addEventListener('submit', (e) => {
  e.preventDefault();
  key = $('#key').value;
  $('#admin-msg').textContent = '';
  document.activeElement.blur();
  clearInterval(timer);
  loadAll();
  timer = setInterval(loadAll, 10000);
});

// every dropdown saves as soon as you choose a value
document.addEventListener('change', async (e) => {
  const sel = e.target;
  if (!sel.matches('select[data-kind]')) return;
  const { kind, id } = sel.dataset;
  const calls = {
    status: [`/api/orders/${id}/status`, { status: sel.value }],
    rider: [`/api/orders/${id}/rider`, { rider_id: sel.value ? Number(sel.value) : null }],
    complaint: [`/api/complaints/${id}`, { status: sel.value }],
  };
  sel.disabled = true;
  try {
    await api(calls[kind][0], { method: 'PATCH', body: JSON.stringify(calls[kind][1]) });
    showMessage(`Saved: ${kind} for #${id}.`, 'ok');
  } catch (err) {
    showMessage(err.message, 'error');
  } finally {
    sel.disabled = false;
    sel.blur();
    loadAll();
  }
});

$('#rider-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  try {
    await api('/api/riders', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(form))) });
    form.reset();
    showMessage('Rider added.', 'ok');
  } catch (err) { showMessage(err.message, 'error'); }
  document.activeElement.blur();
  loadAll();
});

document.addEventListener('input', (e) => {
  if (e.target.matches('input[inputmode="numeric"]')) e.target.value = e.target.value.replace(/\D/g, '');
});
