import './style.css';
import {
  addTransaction,
  getAllTransactions,
  deleteTransaction,
  clearAll,
} from './storage.js';

const modal = document.getElementById('modal');
const modalCloseBtn = document.getElementById('modal-close');
const addBtn = document.querySelector('.bottom-nav__add');
const form = document.getElementById('transaction-form');
const moodChips = document.getElementById('mood-chips');
const moodInput = document.getElementById('field-mood');
const mainEl = document.querySelector('.app-main');
const emptyState = document.querySelector('.empty-state');

const MOOD_LABELS = {
  planned: 'Planned',
  treat: 'Treat',
  stress: 'Stress',
  fomo: 'FOMO',
  need: 'Need',
  social: 'Social',
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

  const descriptionHtml = transaction.description
    ? `<p class="tx-card__description">${escapeHtml(transaction.description)}</p>`
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
    </div>
    ${descriptionHtml}
  `;

  return card;
}

// --- Render ---
async function renderTransactions() {
  const transactions = await getAllTransactions();

  // remove old list if present
  const oldList = document.querySelector('.tx-list');
  if (oldList) oldList.remove();

  if (transactions.length === 0) {
    emptyState.style.display = 'flex';
    return;
  }

  emptyState.style.display = 'none';

  const list = document.createElement('div');
  list.className = 'tx-list';
  transactions.forEach((tx) => list.appendChild(createTransactionCard(tx)));
  mainEl.appendChild(list);
}

// --- Modal open/close ---
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
  moodChips.querySelectorAll('.chip').forEach((c) => {
    c.removeAttribute('data-selected');
  });
  document.querySelector('.more-details')?.removeAttribute('open');
}

addBtn.addEventListener('click', openModal);
modalCloseBtn.addEventListener('click', closeModal);
modal.querySelector('.modal__backdrop').addEventListener('click', closeModal);

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

// --- Form submission ---
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  if (!moodInput.value) {
    alert('Pick a mood before logging.');
    return;
  }

  const transaction = {
    id: crypto.randomUUID(),
    name: document.getElementById('field-name').value.trim(),
    amount: parseFloat(document.getElementById('field-amount').value),
    mood: moodInput.value,
    description: document.getElementById('field-description').value.trim() || null,
    location: document.getElementById('field-location').value.trim() || null,
    timestamp: new Date().toISOString(),
  };

  await addTransaction(transaction);
  await renderTransactions();
  closeModal();
});

// --- Initial render ---
renderTransactions();

// --- Dev helpers (for testing during build) ---
window.totally = {
  clearAll: async () => {
    await clearAll();
    await renderTransactions();
    console.log('Cleared.');
  },
  getAll: getAllTransactions,
};