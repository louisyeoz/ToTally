import './style.css';
import {
  addTransaction,
  getAllTransactions,
  deleteTransaction,
  clearAll,
} from './storage.js';

const modal = document.getElementById('modal');
const modalCloseBtn = document.getElementById('modal-close');
const modalTitle = document.getElementById('modal-title');
const addBtn = document.querySelector('.bottom-nav__add');
const form = document.getElementById('transaction-form');
const moodChips = document.getElementById('mood-chips');
const moodInput = document.getElementById('field-mood');
const submitBtn = document.getElementById('submit-btn');
const deleteBtn = document.getElementById('delete-btn');
const mainEl = document.querySelector('.app-main');
const emptyState = document.querySelector('.empty-state');
const exportBtn = document.getElementById('export-btn');

let editingId = null;
let editingTimestamp = null;

const MOOD_LABELS = {
  planned: 'Planned',
  need: 'Need',
  treat: 'Treat',
  stress: 'Stress',
  social: 'Social',
  fomo: 'FOMO',       // legacy support for any existing data
  bored: 'Bored',
};

// --- Helpers ---
function formatAmount(amount) {
  return amount.toLocaleString('en-SG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatTimeAgo(isoString) {
  const date = new Date(isoString);
  const now = new Date();
  const diffSec = Math.floor((now - date) / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 30) return 'just now';
  if (diffMin < 1) return `${diffSec}s ago`;
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay === 1) return 'yesterday';
  if (diffDay < 7) return `${diffDay}d ago`;

  return date.toLocaleDateString('en-SG', { month: 'short', day: 'numeric' });
}

function toDateTimeLocal(isoString) {
  // Format ISO timestamp as YYYY-MM-DDTHH:MM in local time for datetime-local input
  const date = new Date(isoString);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// --- Card creation ---
function createTransactionCard(transaction) {
  const card = document.createElement('article');
  card.className = 'tx-card';
  card.dataset.id = transaction.id;
  card.dataset.mood = transaction.mood;

  const hasDescription = !!transaction.description;

  const expandBtnHtml = hasDescription
    ? `<button class="tx-card__expand" aria-label="Show description">
         <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
           <path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
         </svg>
       </button>`
    : '';

  const descriptionHtml = hasDescription
    ? `<p class="tx-card__description" hidden>${escapeHtml(transaction.description)}</p>`
    : '';

  const locationHtml = transaction.location
    ? `<span class="tx-card__separator">·</span><span class="tx-card__location">${escapeHtml(transaction.location)}</span>`
    : '';

  card.innerHTML = `
    <div class="tx-card__row">
      <h3 class="tx-card__name">${escapeHtml(transaction.name)}</h3>
      <span class="tx-card__amount">S$${formatAmount(transaction.amount)}</span>
    </div>
    <div class="tx-card__meta">
      <span class="tx-card__mood">${MOOD_LABELS[transaction.mood] || transaction.mood}</span>
      <span class="tx-card__separator">·</span>
      <span class="tx-card__time">${formatTimeAgo(transaction.timestamp)}</span>
      ${locationHtml}
      ${expandBtnHtml}
    </div>
    ${descriptionHtml}
  `;

  return card;
}

// --- Render ---
async function renderTransactions() {
  const transactions = await getAllTransactions();

  document.querySelector('.tx-list')?.remove();
  document.querySelector('.tx-summary')?.remove();

  if (transactions.length === 0) {
    emptyState.style.display = 'flex';
    return;
  }

  emptyState.style.display = 'none';

  // Summary row
  const total = transactions.reduce((sum, tx) => sum + tx.amount, 0);
  const count = transactions.length;

  const summary = document.createElement('div');
  summary.className = 'tx-summary';
  summary.innerHTML = `
    <span class="tx-summary__total">S$${formatAmount(total)}</span>
    <span class="tx-summary__count">${count} ${count === 1 ? 'transaction' : 'transactions'}</span>
  `;

  // Transaction list
  const list = document.createElement('div');
  list.className = 'tx-list';
  transactions.forEach((tx) => list.appendChild(createTransactionCard(tx)));

  mainEl.appendChild(summary);
  mainEl.appendChild(list);
}

// --- Export ---
async function exportData() {
  const all = await getAllTransactions();

  if (all.length === 0) {
    alert('Nothing to export yet.');
    return;
  }

  const blob = new Blob([JSON.stringify(all, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `totally-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

exportBtn.addEventListener('click', exportData);

// --- Modal control ---
function openModal() {
  modal.setAttribute('aria-hidden', 'false');
  setTimeout(() => {
    document.getElementById('field-amount').focus();
  }, 300);
}

function closeModal() {
  modal.setAttribute('aria-hidden', 'true');
  form.reset();
  moodInput.value = '';
  editingId = null;
  editingTimestamp = null;
  moodChips.querySelectorAll('.chip').forEach((c) => {
    c.removeAttribute('data-selected');
  });
  document.querySelector('.more-details')?.removeAttribute('open');
}

function openModalForAdd() {
  editingId = null;
  editingTimestamp = null;
  modalTitle.textContent = 'New transaction';
  submitBtn.textContent = 'Log it';
  deleteBtn.hidden = true;
  openModal();
}

function openModalForEdit(transaction) {
  editingId = transaction.id;
  editingTimestamp = transaction.timestamp;

  // Pre-fill fields
  document.getElementById('field-amount').value = transaction.amount;
  document.getElementById('field-name').value = transaction.name;
  document.getElementById('field-description').value = transaction.description || '';
  document.getElementById('field-location').value = transaction.location || '';
  document.getElementById('field-datetime').value = toDateTimeLocal(transaction.timestamp);

  // Mood chip
  moodChips.querySelectorAll('.chip').forEach((c) => c.removeAttribute('data-selected'));
  const chip = moodChips.querySelector(`[data-mood="${transaction.mood}"]`);
  if (chip) chip.setAttribute('data-selected', 'true');
  moodInput.value = transaction.mood;

  // Auto-expand More Details if relevant fields have values
  if (transaction.description || transaction.location) {
    document.querySelector('.more-details').setAttribute('open', '');
  }

  // UI for edit mode
  modalTitle.textContent = 'Edit transaction';
  submitBtn.textContent = 'Save changes';
  deleteBtn.hidden = false;

  openModal();
}

addBtn.addEventListener('click', openModalForAdd);
modalCloseBtn.addEventListener('click', closeModal);
modal.querySelector('.modal__backdrop').addEventListener('click', closeModal);

// --- Card tap → edit or expand ---
mainEl.addEventListener('click', async (e) => {
  const expandBtn = e.target.closest('.tx-card__expand');
  if (expandBtn) {
    e.stopPropagation();
    const card = expandBtn.closest('.tx-card');
    const desc = card.querySelector('.tx-card__description');
    const expanded = !desc.hidden;
    desc.hidden = expanded;
    card.classList.toggle('tx-card--expanded', !expanded);
    expandBtn.setAttribute('aria-label', expanded ? 'Show description' : 'Hide description');
    return;
  }

  const card = e.target.closest('.tx-card');
  if (!card) return;

  const all = await getAllTransactions();
  const tx = all.find((t) => t.id === card.dataset.id);
  if (tx) openModalForEdit(tx);
});

// --- Mood chip selection ---
moodChips.addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (!chip) return;

  moodChips.querySelectorAll('.chip').forEach((c) => {
    c.removeAttribute('data-selected');
  });
  chip.setAttribute('data-selected', 'true');
  moodInput.value = chip.dataset.mood;
});

// --- Submit (handles both add and edit) ---
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  if (!moodInput.value) {
    alert('Pick a mood before logging.');
    return;
  }

  const datetimeValue = document.getElementById('field-datetime').value;
  const timestamp = datetimeValue
    ? new Date(datetimeValue).toISOString()
    : editingTimestamp || new Date().toISOString();

  const transaction = {
    id: editingId || crypto.randomUUID(),
    name: document.getElementById('field-name').value.trim(),
    amount: parseFloat(document.getElementById('field-amount').value),
    mood: moodInput.value,
    description: document.getElementById('field-description').value.trim() || null,
    location: document.getElementById('field-location').value.trim() || null,
    timestamp,
  };

  await addTransaction(transaction); // put = upsert; works for both add and edit
  await renderTransactions();
  closeModal();
});

// --- Delete ---
deleteBtn.addEventListener('click', async () => {
  if (!editingId) return;
  if (!confirm('Delete this transaction?')) return;

  await deleteTransaction(editingId);
  await renderTransactions();
  closeModal();
});

// --- Initial render ---
renderTransactions();

// --- Dev helpers ---
window.totally = {
  clearAll: async () => {
    await clearAll();
    await renderTransactions();
    console.log('Cleared.');
  },
  getAll: getAllTransactions,
};