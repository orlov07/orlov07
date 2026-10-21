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

async function remove(key: string): Promise<void> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, "readwrite");
    transaction.objectStore(STORE).delete(key);
    transaction.oncomplete = () => { db.close(); resolve(); };
    transaction.onerror = () => reject(transaction.error);
  });
}

function isLegacyDemoMatch(match: MatchState): boolean {
  const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const teams = [normalize(match.teams.A), normalize(match.teams.B)].sort();
  return teams[0] === "julia & ana" && teams[1] === "lara & bia";
}

async function loadCloudMatches(): Promise<MatchState[] | null> {
  try {
    const response = await fetch("/api/matches", { cache: "no-store" });
    if (!response.ok) return null;
    const body = await response.json() as { matches?: MatchState[] };
    return body.matches ?? [];
  } catch { return null; }
}

export const loadActiveMatch = async () => {
  const cloud = await loadCloudMatches();
  return cloud?.find(match => match.status === "live" || match.status === "paused") ?? await read<MatchState>(ACTIVE_KEY);
};
export const saveActiveMatch = async (match: MatchState) => {
  await write(ACTIVE_KEY, match);
  try { await fetch("/api/matches", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(match) }); } catch { /* cache offline preservado */ }
};
export const loadMatchHistory = async () => {
  const cloud = await loadCloudMatches();
  if (cloud) return cloud.filter(match => match.status === "finished");
  return (await read<MatchState[]>(HISTORY_KEY)) ?? [];
};
export const clearActiveMatch = async () => { const db = await database(); await new Promise<void>((resolve,reject)=>{const tx=db.transaction(STORE,"readwrite");tx.objectStore(STORE).delete(ACTIVE_KEY);tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>reject(tx.error)}); };
export async function archiveMatch(match: MatchState): Promise<void> {
  const history = await loadMatchHistory();
  if (!history.some(item => item.id === match.id)) await write(HISTORY_KEY, [match, ...history].slice(0, 50));
  try { await fetch("/api/matches", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(match) }); } catch { /* cache offline preservado */ }
}

export async function removeLegacyDemoMatches(): Promise<void> {
  const active = await loadActiveMatch();
  if (active && isLegacyDemoMatch(active)) await remove(ACTIVE_KEY);

  const history = await loadMatchHistory();
  const realMatches = history.filter(match => !isLegacyDemoMatch(match));
  if (realMatches.length !== history.length) await write(HISTORY_KEY, realMatches);
}
