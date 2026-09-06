'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadService() {
  const source = fs.readFileSync(path.join(__dirname, 'supabase-service.js'), 'utf8');
  const sandbox = {
    atob: s => Buffer.from(s, 'base64').toString('binary'),
    TextEncoder, TextDecoder, setInterval, clearInterval, setTimeout, clearTimeout,
    globalThis: {}
  };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: 'supabase-service.js' });
  return sandbox.globalThis.SantriPulangSupabase;
}
const svc = loadService();

function fakeClient(fns) {
  const listeners = [];
  const calls = [];
  function adminResult() {
    if (fns.adminError) return { error: fns.adminError, data: null };
    if (fns.nonAdmin) return { data: null, error: null };
    return { data: { user_id: fns.adminUid || 'u-admin' }, error: null };
  }
  function sharedResult() {
    if (fns.fetchError) return { error: fns.fetchError, data: null };
    if (!fns.row) throw new Error('shared_state row tidak disediakan untuk tes ini');
    return { data: fns.row(), error: null };
  }
  const client = {
    auth: {
      async signInWithPassword({ email, password }) {
        calls.push(['signInWithPassword', email, password]);
        if (fns.signInError) return { error: fns.signInError };
        const session = { user: { id: fns.adminUid || 'u-admin' }, access_token: 'token-1' };
        setTimeout(() => listeners.forEach(cb => cb('SIGNED_IN', session)), 0);
        return { error: null };
      },
      async signOut({ scope }) {
        calls.push(['signOut', scope]);
        if (fns.signOutError) return { error: fns.signOutError };
        setTimeout(() => listeners.forEach(cb => cb('SIGNED_OUT', null)), 0);
        return { error: null };
      },
      onAuthStateChange(cb) {
        listeners.push(cb);
        cb('INITIAL_SESSION', null);
        return { data: { subscription: { unsubscribe() { const i = listeners.indexOf(cb); if (i >= 0) listeners.splice(i, 1); } } } };
      }
    },
    realtime: {
      async setAuth() { calls.push(['setAuth']); if (fns.setAuthError) throw fns.setAuthError; }
    },
    async removeChannel() { calls.push(['removeChannel']); return { error: null }; },
    from(name) {
      calls.push(['from', name]);
      const builder = {
        select() { calls.push(['select', name]); return builder; },
        eq() { calls.push(['eq']); return builder; },
        single() { return Promise.resolve(name === 'admins' ? adminResult() : sharedResult()); },
        maybeSingle() { return Promise.resolve(name === 'admins' ? adminResult() : sharedResult()); }
      };
      return builder;
    },
    rpc(fn, args) {
      calls.push(['rpc', fn, args]);
      if (fns.rpcError) return { data: null, error: fns.rpcError };
      return { data: fns.successRevision, error: null };
    },
    channel(name) {
      return {
        on() { return this; },
        subscribe(cb) {
          setTimeout(() => cb(fns.channelOk ? 'SUBSCRIBED' : 'CHANNEL_ERROR'), 0);
          return this;
        }
      };
    }
  };
  return { client, calls };
}

const config = { useSupabase: true, supabase: { url: 'https://x.supabase.co', anonKey: 'sb_publishable_abc' } };
const sdkFor = client => ({ createClient: () => client });
const wait = ms => new Promise(r => setTimeout(r, ms));

async function until(condition, message, timeout = 2500) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (condition()) return;
    await wait(15);
  }
  throw new Error('Waktu tunggu habis: ' + message);
}

(async () => {
  let failed = false;
  async function run(name, fn) {
    try { await fn(); console.log('LULUS: ' + name); }
    catch (e) { failed = true; console.error('GAGAL: ' + name + '\n' + (e.stack || e.message)); }
  }
  let data = null, lastLocked = '', unsub = null;

  // 1. Konfigurasi kosong / belum aktif ditolak sebelum SDK dimuat.
  await run('konfigurasi kosong/disabled ditolak', () => {
    assert.throws(() => svc.validateConfig(undefined), /belum diaktifkan/);
    assert.throws(() => svc.validateConfig({ useSupabase: false }), /belum diaktifkan/);
    assert.throws(() => svc.validateConfig({ useSupabase: true, supabase: { url: '', anonKey: '' } }), /Isi URL/);
    assert.throws(() => svc.validateConfig({ useSupabase: true, supabase: { url: 'https://x.supabase.co', anonKey: 'eyJhbGciOiJIUzI1NiJ9.e30.sig' } }), /bukan token admin/);
  });

  // 2. Helper tersedia tanpa SDK; anon key salah ditolak.
  await run('key non-anon ditolak tanpa memuat SDK', () => {
    assert.strictEqual(svc.VERSION, '2.49.8');
    assert.throws(() => svc.validateConfig({ useSupabase: true, supabase: { url: 'https://x.supabase.co', anonKey: 'abc' } }), /Key harus anon/);
  });

  // 3. Login gagal diteruskan ke pemanggil.
  await run('error login diteruskan', async () => {
    const { client } = fakeClient({ signInError: { message: 'Invalid login credentials' }, row: () => ({ schema_version: 1, revision: 0, payload: null }) });
    const api = await svc.create(config, sdkFor(client));
    api.watch(() => {}, () => {});
    let caught = null;
    try { await api.login('a@b.co', 'password'); }
    catch (e) { caught = e; }
    assert.ok(caught && caught.message === 'Invalid login credentials');
  });

  // 4. Login admin sukses, subscribe, fetch awal revision, lalu simpan.
  await run('fetch awal + save revision pertama', async () => {
    let row = { schema_version: 1, revision: 0, payload: null, updated_at: new Date().toISOString() };
    const { client, calls } = fakeClient({ adminUid: 'u-admin', channelOk: true, successRevision: 1, row: () => row });
    const api = await svc.create(config, sdkFor(client));
    let got = null;
    unsub = api.watch(d => { got = d; }, m => { lastLocked = m; });
    await api.login('a@b.co', 'password');
    await until(() => got && got.revision === 0, 'data awal tidak diterima');
    assert.strictEqual(got.revision, 0);
    assert.strictEqual(got.state, null);
    const rev = await api.save({ students: [], logs: [], settings: {} }, 0);
    assert.strictEqual(rev, 1);
    assert.ok(calls.some(c => c[0] === 'setAuth'));
    assert.ok(calls.some(c => c[0] === 'rpc' && c[1] === 'save_santripulang'));
  });

  // 5. Revision kadaluarsa ditolak tanpa menimpa (no last-write-wins).
  await run('conflict revision ditolak tanpa penimpaan', async () => {
    let row = { schema_version: 1, revision: 1, payload: {}, updated_at: new Date().toISOString() };
    const { client } = fakeClient({ adminUid: 'u-admin', channelOk: true, rpcError: { code: '40001', message: 'conflict' }, row: () => row });
    const api = await svc.create(config, sdkFor(client));
    let got = null;
    unsub = api.watch(d => { got = d; }, m => { lastLocked = m; });
    await api.login('a@b.co', 'password');
    await until(() => got && got.revision === 1, 'data awal tidak diterima');
    await assert.rejects(() => api.save({ students: [] }, 0), e => e.code === '40001');
  });

  // 6. Bukan admin: pesan kunci dan tidak ada data.
  await run('nonadmin terkunci tanpa data', async () => {
    const { client } = fakeClient({ adminUid: 'u-admin', nonAdmin: true, channelOk: true, row: () => ({ schema_version: 1, revision: 0, payload: null }) });
    const api = await svc.create(config, sdkFor(client));
    let got = null;
    unsub = api.watch(d => { got = d; }, m => { lastLocked = m; });
    await api.login('a@b.co', 'password');
    await until(() => lastLocked.includes('belum menjadi admin'), 'pesan nonadmin tidak muncul');
    assert.ok(!got);
  });

  // 7. Logout menutup akses simpan.
  await run('logout menutup akses simpan', async () => {
    let row = { schema_version: 1, revision: 0, payload: null, updated_at: new Date().toISOString() };
    const { client } = fakeClient({ adminUid: 'u-admin', channelOk: true, row: () => row });
    const api = await svc.create(config, sdkFor(client));
    let got = null;
    unsub = api.watch(d => { got = d; }, m => { lastLocked = m; });
    await api.login('a@b.co', 'password');
    await until(() => got && got.revision === 0, 'data awal tidak diterima');
    await api.logout();
    let rejected = false;
    await api.save({ students: [] }, 0).catch(() => { rejected = true; });
    assert.ok(rejected);
  });

  // 8. Koneksi realtime terputus / dicabut mengunci layanan.
  await run('saluran realtime gagal mengunci layanan', async () => {
    const { client } = fakeClient({ adminUid: 'u-admin', channelOk: false, row: () => ({ schema_version: 1, revision: 0, payload: null }) });
    const api = await svc.create(config, sdkFor(client));
    let got = null;
    unsub = api.watch(d => { got = d; }, m => { lastLocked = m; });
    await api.login('a@b.co', 'password');
    await until(() => lastLocked.includes('Koneksi realtime terputus'), 'pesan saluran tidak muncul');
    assert.ok(!got);
  });

  // 9. Batas ukuran menolak sebelum RPC.
  await run('batas ukuran menolak sebelum transaksi', async () => {
    let row = { schema_version: 1, revision: 0, payload: null, updated_at: new Date().toISOString() };
    const { client, calls } = fakeClient({ adminUid: 'u-admin', channelOk: true, row: () => row });
    const api = await svc.create(config, sdkFor(client));
    let got = null;
    unsub = api.watch(d => { got = d; }, m => { lastLocked = m; });
    await api.login('a@b.co', 'password');
    await until(() => got && got.revision === 0, 'data awal tidak diterima');
    const callsBefore = calls.filter(c => c[0] === 'rpc').length;
    const big = { students: Array.from({ length: 10000 }, (_, i) => ({ id: 'x'.repeat(80) + i })) };
    await assert.rejects(() => api.save(big, 0), /batas prototipe/);
    assert.strictEqual(calls.filter(c => c[0] === 'rpc').length, callsBefore);
  });

  console.log('Total 9 kelompok uji Supabase lulus.');
  if (unsub) unsub();
  if (failed) process.exit(1);
  else process.exit(0);
})();
