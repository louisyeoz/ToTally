import { openDB } from 'idb';

const DB_NAME = 'totally-db';
const DB_VERSION = 2;
const STORE_TX = 'transactions';
const STORE_ACC = 'accounts';

let dbPromise = null;

export function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          const store = db.createObjectStore(STORE_TX, { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp');
        }
        if (oldVersion < 2) {
          db.createObjectStore(STORE_ACC, { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

export async function getAllTransactions() {
  const db = await getDB();
  const all = await db.getAll(STORE_TX);
  return all.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

export async function addTransaction(transaction) {
  const db = await getDB();
  await db.put(STORE_TX, transaction);
}

export async function deleteTransaction(id) {
  const db = await getDB();
  await db.delete(STORE_TX, id);
}

export async function clearAll() {
  const db = await getDB();
  await db.clear(STORE_TX);
}
