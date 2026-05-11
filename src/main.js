import './style.css';

const modal = document.getElementById('modal');
const modalCloseBtn = document.getElementById('modal-close');
const addBtn = document.querySelector('.bottom-nav__add');
const form = document.getElementById('transaction-form');
const moodChips = document.getElementById('mood-chips');
const moodInput = document.getElementById('field-mood');

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
  // collapse the details panel
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
form.addEventListener('submit', (e) => {
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

  console.log('Transaction logged:', transaction);
  // TODO: persist to IndexedDB (next step)

  closeModal();
});