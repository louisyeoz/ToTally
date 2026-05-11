import { openDB } from 'idb';

const DB_NAME = 'totally-db';
const DB_VERSION = 1;
const STORE_NAME = 'transactions';

let dbPromise = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp');
        }
      },
    });
  }
  return dbPromise;
}

export async function getAllTransactions() {
  const db = await getDB();
  const all = await db.getAll(STORE_NAME);
  // newest first
  return all.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

export async function addTransaction(transaction) {
  const db = await getDB();
  await db.put(STORE_NAME, transaction);
}

export async function deleteTransaction(id) {
  const db = await getDB();
  await db.delete(STORE_NAME, id);
}

export async function clearAll() {
  const db = await getDB();
  await db.clear(STORE_NAME);
}