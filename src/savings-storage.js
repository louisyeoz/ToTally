import { getDB } from './storage.js';

const STORE_ACC = 'accounts';
const CAT_ORDER = { cash: 0, investments: 1, fixed: 2 };

export async function getAllAccounts() {
  const db = await getDB();
  const all = await db.getAll(STORE_ACC);
  return all.sort((a, b) => {
    const cat = (CAT_ORDER[a.category] ?? 9) - (CAT_ORDER[b.category] ?? 9);
    return cat !== 0 ? cat : a.name.localeCompare(b.name);
  });
}

export async function addAccount(account) {
  const db = await getDB();
  await db.put(STORE_ACC, account);
}

export async function deleteAccount(id) {
  const db = await getDB();
  await db.delete(STORE_ACC, id);
}
