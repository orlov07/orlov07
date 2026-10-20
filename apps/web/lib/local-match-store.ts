import type { MatchState } from "@setra/scoring-engine";

const DB_NAME = "setra-local";
const STORE = "matches";
const ACTIVE_KEY = "active";
const HISTORY_KEY = "history";

function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function read<T>(key: string): Promise<T | null> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, "readonly");
    const request = transaction.objectStore(STORE).get(key);
    request.onsuccess = () => resolve((request.result as T | undefined) ?? null);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => db.close();
  });
}

async function write(key: string, value: unknown): Promise<void> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, "readwrite");
    transaction.objectStore(STORE).put(value, key);
    transaction.oncomplete = () => { db.close(); resolve(); };
    transaction.onerror = () => reject(transaction.error);
  });
}

export const loadActiveMatch = () => read<MatchState>(ACTIVE_KEY);
export const saveActiveMatch = (match: MatchState) => write(ACTIVE_KEY, match);
export const loadMatchHistory = async () => (await read<MatchState[]>(HISTORY_KEY)) ?? [];
export const clearActiveMatch = async () => { const db = await database(); await new Promise<void>((resolve,reject)=>{const tx=db.transaction(STORE,"readwrite");tx.objectStore(STORE).delete(ACTIVE_KEY);tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>reject(tx.error)}); };
export async function archiveMatch(match: MatchState): Promise<void> {
  const history = await loadMatchHistory();
  if (!history.some(item => item.id === match.id)) await write(HISTORY_KEY, [match, ...history].slice(0, 50));
}
