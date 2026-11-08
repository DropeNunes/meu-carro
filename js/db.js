// Armazenamento local no iPhone (IndexedDB).
const DB_NAME = 'meu-carro';
const DB_VERSION = 1;
const LISTS = ['services', 'fuels', 'expenses', 'odometer', 'custom'];
export const SCHEMA = 1;

let conn;

function open() {
  if (conn) return Promise.resolve(conn);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      db.createObjectStore('kv');
      for (const s of LISTS) db.createObjectStore(s, { keyPath: 'id' });
    };
    req.onsuccess = () => { conn = req.result; resolve(conn); };
    req.onerror = () => reject(req.error);
  });
}

function run(stores, mode, work) {
  return open().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(stores, mode);
    let value;
    tx.oncomplete = () => resolve(value);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
    work(tx, (v) => { value = v; });
  }));
}

export const newId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

export async function loadAll() {
  return run(['kv', ...LISTS], 'readonly', (tx, done) => {
    const D = { settings: null };
    const r = tx.objectStore('kv').get('settings');
    r.onsuccess = () => { D.settings = r.result ?? null; };
    for (const s of LISTS) {
      const q = tx.objectStore(s).getAll();
      q.onsuccess = () => { D[s] = q.result; };
    }
    done(D);
  });
}

export const saveSettings = (settings) => run(['kv'], 'readwrite', (tx) => tx.objectStore('kv').put(settings, 'settings'));

export function put(store, record) {
  const rec = record.id ? record : { ...record, id: newId() };
  return run([store], 'readwrite', (tx) => tx.objectStore(store).put(rec));
}

export const remove = (store, id) => run([store], 'readwrite', (tx) => tx.objectStore(store).delete(id));

export function makeBackup(D) {
  const data = { settings: D.settings };
  for (const s of LISTS) data[s] = D[s];
  return { app: 'meu-carro', schema: SCHEMA, exportedAt: new Date().toISOString(), data };
}

/** Confere o arquivo inteiro antes de qualquer alteração. */
export function validateBackup(b) {
  if (!b || b.app !== 'meu-carro' || !b.data) throw new Error('Este arquivo não é um backup do Meu Carro.');
  if (b.schema !== SCHEMA) throw new Error('Este backup é de uma versão incompatível do app.');
  const s = b.data.settings;
  if (!s?.lastRev?.date || !Number.isFinite(s.lastRev.km)) throw new Error('O backup está incompleto.');
  for (const name of LISTS) {
    const list = b.data[name];
    if (!Array.isArray(list) || list.some((r) => !r?.id)) throw new Error('O backup está incompleto.');
  }
}

/** Troca todos os dados numa única transação: ou tudo entra, ou nada muda. */
export function restoreBackup(b) {
  validateBackup(b);
  return run(['kv', ...LISTS], 'readwrite', (tx) => {
    tx.objectStore('kv').put(b.data.settings, 'settings');
    for (const s of LISTS) {
      const st = tx.objectStore(s);
      st.clear();
      for (const r of b.data[s]) st.put(r);
    }
  });
}
