// Storage adapter: Firebase Firestore when configured, otherwise localStorage (demo mode).
// Every bill is ONE document so a claim can be done atomically in a transaction.
import { FIREBASE_CONFIG } from './config.js?v=6';

const FB_VERSION = '10.12.2';
let backendPromise;

export function getBackend() {
  if (!backendPromise) {
    backendPromise = FIREBASE_CONFIG && FIREBASE_CONFIG.apiKey
      ? firebaseBackend(FIREBASE_CONFIG)
      : Promise.resolve(localBackend());
  }
  return backendPromise;
}

export function newId(len = 10) {
  const abc = 'abcdefghijkmnpqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(bytes, (b) => abc[b % abc.length]).join('');
}

async function firebaseBackend(cfg) {
  const base = `https://www.gstatic.com/firebasejs/${FB_VERSION}`;
  const { initializeApp } = await import(`${base}/firebase-app.js`);
  const fs = await import(`${base}/firebase-firestore.js`);
  const app = initializeApp(cfg);
  const db = fs.getFirestore(app);
  const ref = (id) => fs.doc(db, 'bills', id);
  return {
    kind: 'firebase',
    async createBill(data) {
      const id = newId();
      await fs.setDoc(ref(id), data);
      return id;
    },
    subscribe(id, cb) {
      return fs.onSnapshot(
        ref(id),
        (snap) => cb(snap.exists() ? snap.data() : null),
        (err) => cb(null, err),
      );
    },
    async mutate(id, fn) {
      await fs.runTransaction(db, async (tx) => {
        const snap = await tx.get(ref(id));
        if (!snap.exists()) throw new Error('Notan finns inte');
        tx.set(ref(id), fn(structuredClone(snap.data())));
      });
    },
  };
}

function localBackend() {
  const key = (id) => 'jn:bill:' + id;
  const listeners = new Map();
  const read = (id) => {
    try { return JSON.parse(localStorage.getItem(key(id))); } catch { return null; }
  };
  const emit = (id) => (listeners.get(id) || []).forEach((cb) => cb(read(id)));
  window.addEventListener('storage', (e) => {
    if (e.key && e.key.startsWith('jn:bill:')) emit(e.key.slice(8));
  });
  return {
    kind: 'local',
    async createBill(data) {
      const id = newId();
      localStorage.setItem(key(id), JSON.stringify(data));
      return id;
    },
    subscribe(id, cb) {
      if (!listeners.has(id)) listeners.set(id, []);
      listeners.get(id).push(cb);
      setTimeout(() => cb(read(id)), 0);
      return () => listeners.set(id, listeners.get(id).filter((f) => f !== cb));
    },
    async mutate(id, fn) {
      const cur = read(id);
      if (!cur) throw new Error('Notan finns inte');
      localStorage.setItem(key(id), JSON.stringify(fn(cur)));
      emit(id);
    },
  };
}
