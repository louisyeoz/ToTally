import './savings.css';
import { getAllAccounts, addAccount, deleteAccount } from './savings-storage.js';

// --- DOM refs ---
const savingsMain = document.getElementById('savings-main');
const savingsEmptyState = document.getElementById('savings-empty-state');
const accountModal = document.getElementById('account-modal');
const accountModalTitle = document.getElementById('account-modal-title');
const accountForm = document.getElementById('account-form');
const accountSubmitBtn = document.getElementById('account-submit-btn');
const accountDeleteBtn = document.getElementById('account-delete-btn');
const categoryChips = document.getElementById('category-chips');
const categoryInput = document.getElementById('field-category');
const currencyChips = document.getElementById('currency-chips');
const currencyInput = document.getElementById('field-currency');
const fxRateField = document.getElementById('fx-rate-field');
const fxRateInput = document.getElementById('field-fx-rate');
const balancePrefix = document.getElementById('balance-prefix');
const spendingField = document.getElementById('spending-account-field');
const spendingCheckbox = document.getElementById('field-spending-account');

// --- State ---
let editingAccountId = null;

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

// --- Donut (same SMIL mask pattern as transactions) ---
function buildDonut(categoryTotals, total) {
  if (total === 0) return '';

  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const sorted = Object.entries(categoryTotals)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);
  const gap = sorted.length > 1 ? 4 : 0;
  let offset = 0;

  const circles = sorted.map(([cat, amount]) => {
    const len = Math.max((amount / total) * circumference - gap, 0);
    const c = `<circle
      class="tx-summary__donut-slice sav-donut-slice--${cat}"
      cx="100" cy="100" r="${radius}"
      stroke-dasharray="${len} ${circumference}"
      stroke-dashoffset="${-offset}"
      transform="rotate(-90 100 100)"
    />`;
    offset += len + gap;
    return c;
  }).join('');

  const maskId = `sav-mask-${Date.now()}`;
  return `
    <defs>
      <mask id="${maskId}">
        <circle cx="100" cy="100" r="${radius}"
          stroke="white" stroke-width="20" fill="none"
          stroke-dasharray="0 ${circumference}"
          transform="rotate(-90 100 100)">
          <animate attributeName="stroke-dasharray"
            from="0 ${circumference}" to="${circumference} ${circumference}"
            dur="1.4s" fill="freeze" calcMode="spline"
            keyTimes="0;1" keySplines="0 0 0.3 1" />
        </circle>
      </mask>
    </defs>
    <g mask="url(#${maskId})">${circles}</g>`;
}

// --- Balance display helper ---
function buildBalanceHtml(account) {
  const currency = account.currency || 'SGD';
  if (currency === 'USD') {
    if (account.fxRate) {
      const sgd = formatAmount(account.balance * account.fxRate);
      return `<div class="sav-card__balance-stack">
        <span class="sav-card__balance">USD ${formatAmount(account.balance)}</span>
        <span class="sav-card__balance-converted">≈ S$${sgd}</span>
      </div>`;
    }
    return `<div class="sav-card__balance-stack">
      <span class="sav-card__balance">USD ${formatAmount(account.balance)}</span>
      <span class="sav-card__balance-no-rate">· no rate set</span>
    </div>`;
  }
  return `<span class="sav-card__balance">S$${formatAmount(account.balance)}</span>`;
}

// --- Card ---
function createAccountCard(account) {
  const card = document.createElement('article');
  card.className = 'sav-card';
  card.dataset.id = account.id;
  card.dataset.category = account.category;

  const currency = account.currency || 'SGD';
  const rowClass = currency === 'USD'
    ? 'sav-card__row sav-card__row--stacked'
    : 'sav-card__row';

  const nameClass = account.isSpendingAccount
    ? 'sav-card__name sav-card__name--spending'
    : 'sav-card__name';

  const institutionHtml = account.institution
    ? `<span class="sav-card__institution">${escapeHtml(account.institution)}</span><span class="tx-card__separator">·</span>`
    : '';

  card.innerHTML = `
    <div class="${rowClass}">
      <h3 class="${nameClass}">${escapeHtml(account.name)}</h3>
      ${buildBalanceHtml(account)}
    </div>
    <div class="sav-card__meta">
      ${institutionHtml}
      <span class="sav-card__time">${formatTimeAgo(account.updatedAt)}</span>
    </div>
  `;
  return card;
}

// --- Render ---
export async function renderSavings() {
  savingsMain.querySelectorAll('.sav-summary, .sav-section').forEach((el) => el.remove());

  const accounts = await getAllAccounts();

  if (accounts.length === 0) {
    savingsEmptyState.style.display = 'flex';
    return;
  }
  savingsEmptyState.style.display = 'none';

  // Net worth: convert USD to SGD for totalling
  let missingRate = false;
  const total = accounts.reduce((sum, a) => {
    const currency = a.currency || 'SGD';
    if (currency === 'USD') {
      if (a.fxRate) return sum + a.balance * a.fxRate;
      missingRate = true;
      return sum + a.balance;
    }
    return sum + a.balance;
  }, 0);

  const categoryTotals = { cash: 0, investments: 0, fixed: 0 };
  for (const acc of accounts) {
    const currency = acc.currency || 'SGD';
    const sgdVal = currency === 'USD' && acc.fxRate
      ? acc.balance * acc.fxRate
      : acc.balance;
    categoryTotals[acc.category] = (categoryTotals[acc.category] || 0) + sgdVal;
  }

  const summary = document.createElement('div');
  summary.className = 'sav-summary';
  summary.innerHTML = `
    <div class="tx-summary__chart">
      <svg class="tx-summary__donut" viewBox="0 0 200 200" aria-hidden="true">
        <circle class="tx-summary__donut-bg" cx="100" cy="100" r="80" />
        ${buildDonut(categoryTotals, total)}
      </svg>
      <div class="tx-summary__chart-center">
        <span class="tx-summary__total">S$${formatAmount(total)}</span>
        <span class="tx-summary__chart-label">net worth</span>
      </div>
    </div>
    <div class="tx-summary__count">${accounts.length} ${accounts.length === 1 ? 'account' : 'accounts'}</div>
    ${missingRate ? '<p class="sav-net-worth-disclaimer">*some accounts missing FX rate</p>' : ''}
  `;
  savingsMain.appendChild(summary);

  const groups = {
    cash:        { label: '💰 Cash & Savings',    accounts: [] },
    investments: { label: '📈 Investments',        accounts: [] },
    fixed:       { label: '🔒 Fixed & Long-term', accounts: [] },
  };
  for (const acc of accounts) {
    if (groups[acc.category]) groups[acc.category].accounts.push(acc);
  }

  for (const { label, accounts: catAccounts } of Object.values(groups)) {
    if (catAccounts.length === 0) continue;
    const section = document.createElement('div');
    section.className = 'sav-section';
    section.innerHTML = `<h3 class="sav-section__header">${label}</h3>`;
    const cards = document.createElement('div');
    cards.className = 'sav-cards';
    catAccounts.forEach((acc) => cards.appendChild(createAccountCard(acc)));
    section.appendChild(cards);
    savingsMain.appendChild(section);
  }
}

// --- Card click → edit modal ---
savingsMain.addEventListener('click', async (e) => {
  const card = e.target.closest('.sav-card');
  if (!card) return;
  const accounts = await getAllAccounts();
  const acc = accounts.find((a) => a.id === card.dataset.id);
  if (acc) openForEdit(acc);
});

// --- Modal open/close ---
function openModal() {
  accountModal.setAttribute('aria-hidden', 'false');
  setTimeout(() => document.getElementById('field-acc-balance').focus(), 300);
}

function closeModal() {
  accountModal.setAttribute('aria-hidden', 'true');
  accountForm.reset();
  categoryInput.value = '';
  currencyInput.value = 'SGD';
  editingAccountId = null;
  categoryChips.querySelectorAll('.chip').forEach((c) => c.removeAttribute('data-selected'));
  currencyChips.querySelectorAll('.chip').forEach((c) => c.removeAttribute('data-selected'));
  currencyChips.querySelector('[data-currency="SGD"]').setAttribute('data-selected', 'true');
  balancePrefix.textContent = 'S$';
  fxRateField.hidden = true;
  spendingField.hidden = true;
  accountForm.querySelector('.more-details')?.removeAttribute('open');
}

export function openAccountModalForAdd() {
  editingAccountId = null;
  accountModalTitle.textContent = 'New account';
  accountSubmitBtn.textContent = 'Add account';
  accountDeleteBtn.hidden = true;
  // Reset to SGD defaults
  categoryChips.querySelectorAll('.chip').forEach((c) => c.removeAttribute('data-selected'));
  currencyChips.querySelectorAll('.chip').forEach((c) => c.removeAttribute('data-selected'));
  currencyChips.querySelector('[data-currency="SGD"]').setAttribute('data-selected', 'true');
  currencyInput.value = 'SGD';
  balancePrefix.textContent = 'S$';
  fxRateField.hidden = true;
  spendingField.hidden = true;
  openModal();
}

function openForEdit(account) {
  editingAccountId = account.id;
  document.getElementById('field-acc-name').value = account.name;
  document.getElementById('field-acc-institution').value = account.institution || '';
  document.getElementById('field-acc-balance').value = account.balance;
  document.getElementById('field-acc-notes').value = account.notes || '';

  // Category
  categoryChips.querySelectorAll('.chip').forEach((c) => c.removeAttribute('data-selected'));
  const catChip = categoryChips.querySelector(`[data-category="${account.category}"]`);
  if (catChip) catChip.setAttribute('data-selected', 'true');
  categoryInput.value = account.category;

  // Currency
  const currency = account.currency || 'SGD';
  currencyChips.querySelectorAll('.chip').forEach((c) => c.removeAttribute('data-selected'));
  const currChip = currencyChips.querySelector(`[data-currency="${currency}"]`);
  if (currChip) currChip.setAttribute('data-selected', 'true');
  currencyInput.value = currency;
  balancePrefix.textContent = currency === 'USD' ? 'USD' : 'S$';
  fxRateField.hidden = currency !== 'USD';
  fxRateInput.value = account.fxRate ?? '';

  // Spending account toggle (edit mode only)
  spendingField.hidden = false;
  spendingCheckbox.checked = !!account.isSpendingAccount;

  if (account.institution || account.notes) {
    accountForm.querySelector('.more-details').setAttribute('open', '');
  }

  accountModalTitle.textContent = 'Edit account';
  accountSubmitBtn.textContent = 'Save changes';
  accountDeleteBtn.hidden = false;
  openModal();
}

document.getElementById('account-modal-close').addEventListener('click', closeModal);
accountModal.querySelector('.modal__backdrop').addEventListener('click', closeModal);

// --- Category chips ---
categoryChips.addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  categoryChips.querySelectorAll('.chip').forEach((c) => c.removeAttribute('data-selected'));
  chip.setAttribute('data-selected', 'true');
  categoryInput.value = chip.dataset.category;
});

// --- Currency chips ---
currencyChips.addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  currencyChips.querySelectorAll('.chip').forEach((c) => c.removeAttribute('data-selected'));
  chip.setAttribute('data-selected', 'true');
  currencyInput.value = chip.dataset.currency;
  const isUsd = chip.dataset.currency === 'USD';
  balancePrefix.textContent = isUsd ? 'USD' : 'S$';
  fxRateField.hidden = !isUsd;
});

// --- Submit ---
accountForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!categoryInput.value) { alert('Pick a category.'); return; }

  const newBalance = parseFloat(document.getElementById('field-acc-balance').value);
  const currency = currencyInput.value || 'SGD';
  const fxRateVal = currency === 'USD' && fxRateInput.value
    ? parseFloat(fxRateInput.value)
    : null;
  const isSpending = !!spendingCheckbox.checked;
  const now = new Date().toISOString();

  let history = [];
  let createdAt = now;

  if (editingAccountId) {
    const existing = (await getAllAccounts()).find((a) => a.id === editingAccountId);
    if (existing) {
      history = existing.history || [];
      createdAt = existing.createdAt;
      if (newBalance !== existing.balance) {
        history = [{ balance: newBalance, recordedAt: now }, ...history];
      }
    }
  } else {
    history = [{ balance: newBalance, recordedAt: now }];
  }

  const account = {
    id: editingAccountId || crypto.randomUUID(),
    name: document.getElementById('field-acc-name').value.trim(),
    institution: document.getElementById('field-acc-institution').value.trim() || null,
    category: categoryInput.value,
    currency,
    fxRate: fxRateVal,
    balance: newBalance,
    notes: document.getElementById('field-acc-notes').value.trim() || null,
    isSpendingAccount: isSpending,
    createdAt,
    updatedAt: now,
    history,
  };

  // Ensure only one spending account at a time
  if (isSpending) {
    const allAccounts = await getAllAccounts();
    for (const a of allAccounts) {
      if (a.id !== account.id && a.isSpendingAccount) {
        await addAccount({ ...a, isSpendingAccount: false });
      }
    }
  }

  await addAccount(account);
  await renderSavings();
  closeModal();
});

// --- Delete ---
accountDeleteBtn.addEventListener('click', async () => {
  if (!editingAccountId) return;
  if (!confirm('Delete this account?')) return;
  await deleteAccount(editingAccountId);
  await renderSavings();
  closeModal();
});
