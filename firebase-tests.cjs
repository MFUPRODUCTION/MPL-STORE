// Uji helper aktual dengan SDK tiruan; bukan pengujian layanan/rules emulator.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const context = vm.createContext({ TextEncoder });
vm.runInContext(fs.readFileSync('firebase-service.js', 'utf8'), context);
const api = context.SantriPulangFirebase;
const config = { useFirebase: true, firebase: { apiKey: 'test', authDomain: 'test.invalid', projectId: 'test', appId: 'test' } };
let count = 0;
async function test(name, fn) { await fn(); count++; console.log('LULUS: ' + name); }
function mock() {
  const auth = { currentUser: null }, listeners = [], locks = [], received = [];
  let authCallback, docValue = null, allowed = true, writes = 0, retry = false;
  const snap = (value, metadata = {}) => ({ exists: () => value !== null, data: () => value, metadata: { fromCache: false, hasPendingWrites: false, ...metadata } });
  const sdk = {
    initializeApp: () => ({}), initializeAuth: (_, options) => { assert.equal(options.persistence, 'memory'); return auth; },
    inMemoryPersistence: 'memory', memoryLocalCache: () => 'memory',
    initializeFirestore: (_, options) => { assert.equal(options.localCache, 'memory'); return {}; },
    doc: (_, ...path) => path.join('/'), serverTimestamp: () => 'server-time',
    signInWithEmailAndPassword: async (_, email) => { auth.currentUser = { uid: email }; await authCallback(auth.currentUser); },
    signOut: async () => { auth.currentUser = null; await authCallback(null); },
    onAuthStateChanged: (_, cb) => { authCallback = cb; return () => {}; },
    getDocFromServer: async () => snap(allowed ? {} : null),
    onSnapshot: (path, _, cb, error) => { const l = { path, cb, error, stopped: false }; listeners.push(l); return () => { l.stopped = true; }; },
    runTransaction: async (_, fn) => {
      let proposed;
      const tx = { get: async () => snap(docValue), set: (_, value) => { proposed = value; } };
      let value = await fn(tx);
      if (retry) { docValue = { ...proposed, revision: proposed.revision }; proposed = null; value = await fn(tx); }
      docValue = proposed; writes++; return value;
    }
  };
  return { sdk, locks, received, listeners, snap,
    setAllowed: value => { allowed = value; }, setRetry: () => { retry = true; },
    get writes() { return writes; }, get value() { return docValue; },
    async open() { const service = await api.create(config, sdk); service.watch(v => received.push(v), m => locks.push(m)); await service.login('admin-1', 'password'); return service; }
  };
}
(async () => {
  await test('Konfigurasi kosong/disabled ditolak sebelum SDK dimuat', async () => {
    for (const c of [undefined, { useFirebase: false }, { useFirebase: true, firebase: {} }]) await assert.rejects(api.create(c, {}));
  });
  await test('Sesi/cache hanya memori; snapshot server kosong tidak mengunggah data', async () => {
    const m = mock(); await m.open();
    const l = m.listeners.find(l => l.path === 'shared/santripulang');
    l.cb(m.snap(null, { fromCache: true })); assert.equal(m.received.length, 0);
    l.cb(m.snap(null)); assert.equal(m.received[0].revision, 0); assert.equal(m.received[0].state, null); assert.equal(m.writes, 0);
  });
  await test('Simpan pertama dan penolakan snapshot stale tanpa penimpaan', async () => {
    const m = mock(), s = await m.open();
    assert.equal(await s.save({ students: [], logs: [], settings: {} }, 0), 1);
    await assert.rejects(s.save({ overwritten: true }, 0), /petugas lain/);
    assert.equal(m.writes, 1); assert.equal(m.value.updatedBy, 'admin-1'); assert.equal(m.value.updatedAt, 'server-time');
  });
  await test('Retry transaksi akibat konflik tetap menolak revision lama', async () => {
    const m = mock(), s = await m.open(); m.setRetry();
    await assert.rejects(s.save({ test: true }, 0), /petugas lain/); assert.equal(m.writes, 0);
  });
  await test('Batas ukuran menolak sebelum transaksi', async () => {
    const m = mock(), s = await m.open(); await assert.rejects(s.save({ data: 'x'.repeat(200001) }, 0), /batas prototipe/); assert.equal(m.writes, 0);
  });
  await test('Nonadmin tidak berlangganan data atau menyimpan', async () => {
    const m = mock(); m.setAllowed(false); const s = await m.open();
    assert.equal(m.listeners.length, 0); assert.match(m.locks.at(-1), /belum menjadi admin/); await assert.rejects(s.save({}, 0), /Sesi/);
  });
  await test('Logout melepas listener dan mengabaikan callback akun sebelumnya', async () => {
    const m = mock(), s = await m.open(); const old = m.listeners.find(l => l.path === 'shared/santripulang');
    await s.logout(); await s.login('admin-2', 'password');
    old.cb(m.snap({ schema: 1, revision: 1, payload: '{"private":true}' }));
    assert.equal(old.stopped, true); assert.equal(m.received.length, 0);
    await s.logout(); await assert.rejects(s.save({}, 0), /Sesi/);
  });
  await test('Pencabutan admin mengunci dan berhenti berlangganan', async () => {
    const m = mock(), s = await m.open(); m.listeners[0].cb(m.snap(null));
    assert.ok(m.listeners.every(l => l.stopped)); assert.match(m.locks.at(-1), /dicabut/); await assert.rejects(s.save({}, 0), /Sesi/);
  });
  await test('Seluruh jalur mutasi aplikasi menunggu save; tidak ada signup cloud', () => {
    const app = fs.readFileSync('app.js', 'utf8');
    // Tambah/edit berbagi satu handler: enam call site untuk tujuh tindakan.
    assert.equal((app.match(/if \(await save\(/g) || []).length, 6);
    assert.doesNotMatch(app, /if \(save\(/);
    assert.match(app, /cloudMode \? null : localStorage.getItem\(KEY\)/);
    assert.doesNotMatch(fs.readFileSync('firebase-service.js', 'utf8'), /createUserWithEmailAndPassword|persistentLocalCache|localStorage/);
  });
  console.log(`Total ${count} kelompok uji Firebase tiruan lulus.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
