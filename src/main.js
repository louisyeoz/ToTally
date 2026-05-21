import './style.css';
import {
  addTransaction,
  getAllTransactions,
  deleteTransaction,
  clearAll,
} from './storage.js';

// DOM refs
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
const filterBtn = document.getElementById('filter-btn');
const filterSheet = document.getElementById('filter-sheet');
const filterReset = document.getElementById('filter-reset');

// State
let editingId = null;
let editingTimestamp = null;
let activeMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

let activeFilters = { sort: 'newest', mood: 'all' };
const DEFAULT_FILTERS = { sort: 'newest', mood: 'all' };

const MOOD_LABELS = {
  planned: 'Planned', need: 'Need', treat: 'Treat',
  stress: 'Stress', social: 'Social', fomo: 'FOMO', bored: 'Bored',
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

function isCurrentMonth() {
  const now = new Date();
  return activeMonth.getMonth() === now.getMonth() &&
    activeMonth.getFullYear() === now.getFullYear();
}

function isDefaultFilters() {
  return activeFilters.sort === DEFAULT_FILTERS.sort &&
    activeFilters.mood === DEFAULT_FILTERS.mood;
}

// --- Filter logic ---
function applyFilters(transactions) {
  let result = transactions.filter((tx) => {
    const d = new Date(tx.timestamp);
    return d.getMonth() === activeMonth.getMonth() &&
      d.getFullYear() === activeMonth.getFullYear();
  });

  if (activeFilters.mood !== 'all') {
    result = result.filter((tx) => tx.mood === activeFilters.mood);
  }

  if (activeFilters.sort === 'newest') {
    result.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  } else if (activeFilters.sort === 'oldest') {
    result.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  } else if (activeFilters.sort === 'highest') {
    result.sort((a, b) => b.amount - a.amount);
  } else if (activeFilters.sort === 'lowest') {
    result.sort((a, b) => a.amount - b.amount);
  }

  return result;
}

function syncFilterUI() {
  document.querySelectorAll('[data-filter-group]').forEach((chip) => {
    const group = chip.dataset.filterGroup;
    const value = chip.dataset.filterValue;
    chip.toggleAttribute('data-selected', activeFilters[group] === value);
  });

  filterBtn.dataset.active = !isDefaultFilters() ? 'true' : 'false';
  filterReset.disabled = isDefaultFilters();
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
  const all = await getAllTransactions();
  const filtered = applyFilters(all);

  document.querySelector('.tx-list')?.remove();
  document.querySelector('.tx-summary')?.remove();
  document.querySelector('.empty-state--filtered')?.remove();

  syncFilterUI();

  if (all.length === 0) {
    emptyState.style.display = 'flex';
    return;
  }

  emptyState.style.display = 'none';

  // Month display
  const monthDisplay = activeMonth.toLocaleDateString('en-SG', {
    month: 'long', year: 'numeric',
  });

  // Count text
  const monthTotal = all.filter((tx) => {
    const d = new Date(tx.timestamp);
    return d.getMonth() === activeMonth.getMonth() &&
      d.getFullYear() === activeMonth.getFullYear();
  }).length;

  const total = filtered.reduce((sum, tx) => sum + tx.amount, 0);

  const countText = filtered.length === monthTotal
    ? `${filtered.length} ${filtered.length === 1 ? 'transaction' : 'transactions'}`
    : `${filtered.length} of ${monthTotal}`;

  // Build summary with embedded month nav
  const summary = document.createElement('div');
  summary.className = 'tx-summary';
  summary.innerHTML = `
  <span class="tx-summary__total">S$${formatAmount(total)}</span>
  <div class="tx-summary__sub">
    <div class="tx-summary__month-nav">
      <button class="month-nav__btn" id="month-prev-btn" aria-label="Previous month">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path d="M10 4l-4 4 4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
      <span class="tx-summary__month">${monthDisplay}</span>
      <button class="month-nav__btn" id="month-next-btn" aria-label="Next month" ${isCurrentMonth() ? 'disabled' : ''}>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path d="M6 4l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    </div>
    <span class="tx-summary__separator">·</span>
    <span class="tx-summary__count">${countText}</span>
  </div>
`;

  // Attach month nav listeners
  summary.querySelector('#month-prev-btn').addEventListener('click', () => {
    activeMonth = new Date(activeMonth.getFullYear(), activeMonth.getMonth() - 1, 1);
    renderTransactions();
  });

  summary.querySelector('#month-next-btn').addEventListener('click', () => {
    if (!isCurrentMonth()) {
      activeMonth = new Date(activeMonth.getFullYear(), activeMonth.getMonth() + 1, 1);
      renderTransactions();
    }
  });

  mainEl.appendChild(summary);

  // Empty month message (only when mood filter is causing it)
  if (filtered.length === 0) {
    const noResults = document.createElement('div');
    noResults.className = 'empty-state empty-state--filtered';
    noResults.innerHTML = `
      <p class="empty-state__primary">${monthTotal === 0 ? `Nothing in ${monthDisplay}.` : 'No results.'}</p>
      <p class="empty-state__secondary">${monthTotal === 0 ? 'Navigate months with the arrows above.' : 'Try adjusting your filters.'}</p>
    `;
    mainEl.appendChild(noResults);
    return;
  }

  const list = document.createElement('div');
  list.className = 'tx-list';
  filtered.forEach((tx) => list.appendChild(createTransactionCard(tx)));
  mainEl.appendChild(list);
}

// --- Export ---
async function exportData() {
  const all = await getAllTransactions();
  if (all.length === 0) { alert('Nothing to export yet.'); return; }

  const blob = new Blob([JSON.stringify(all, null, 2)], { type: 'application/json' });
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

// --- Filter sheet ---
filterBtn.addEventListener('click', () => {
  syncFilterUI();
  filterSheet.setAttribute('aria-hidden', 'false');
});

filterSheet.querySelector('.filter-sheet__backdrop').addEventListener('click', () => {
  filterSheet.setAttribute('aria-hidden', 'true');
});

filterSheet.addEventListener('click', (e) => {
  const chip = e.target.closest('[data-filter-group]');
  if (!chip) return;
  activeFilters[chip.dataset.filterGroup] = chip.dataset.filterValue;
  syncFilterUI();
  renderTransactions();
});

filterReset.addEventListener('click', () => {
  activeFilters = { ...DEFAULT_FILTERS };
  syncFilterUI();
  renderTransactions();
});

// --- Modal ---
function openModal() {
  modal.setAttribute('aria-hidden', 'false');
  setTimeout(() => document.getElementById('field-amount').focus(), 300);
}

function closeModal() {
  modal.setAttribute('aria-hidden', 'true');
  form.reset();
  moodInput.value = '';
  editingId = null;
  editingTimestamp = null;
  moodChips.querySelectorAll('.chip').forEach((c) => c.removeAttribute('data-selected'));
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

  document.getElementById('field-amount').value = transaction.amount;
  document.getElementById('field-name').value = transaction.name;
  document.getElementById('field-description').value = transaction.description || '';
  document.getElementById('field-location').value = transaction.location || '';
  document.getElementById('field-datetime').value = toDateTimeLocal(transaction.timestamp);

  moodChips.querySelectorAll('.chip').forEach((c) => c.removeAttribute('data-selected'));
  const chip = moodChips.querySelector(`[data-mood="${transaction.mood}"]`);
  if (chip) chip.setAttribute('data-selected', 'true');
  moodInput.value = transaction.mood;

  if (transaction.description || transaction.location) {
    document.querySelector('.more-details').setAttribute('open', '');
  }

  modalTitle.textContent = 'Edit transaction';
  submitBtn.textContent = 'Save changes';
  deleteBtn.hidden = false;

  openModal();
}

addBtn.addEventListener('click', openModalForAdd);
modalCloseBtn.addEventListener('click', closeModal);
modal.querySelector('.modal__backdrop').addEventListener('click', closeModal);

// --- Card interactions ---
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

// --- Mood chips ---
moodChips.addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  moodChips.querySelectorAll('.chip').forEach((c) => c.removeAttribute('data-selected'));
  chip.setAttribute('data-selected', 'true');
  moodInput.value = chip.dataset.mood;
});

// --- Submit ---
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!moodInput.value) { alert('Pick a mood before logging.'); return; }

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

  await addTransaction(transaction);
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

// --- Boot ---
renderTransactions();

// --- Dev helpers ---
window.totally = {
  clearAll: async () => { await clearAll(); await renderTransactions(); console.log('Cleared.'); },
  getAll: getAllTransactions,
};