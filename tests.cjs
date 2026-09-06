// Uji fungsi murni dari app.js tanpa mengklaim pengujian browser.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync('app.js', 'utf8');
const context = vm.createContext({});
const pure = source.slice(source.indexOf('const CSV_HEADERS'), source.indexOf('let pendingImport = null;'));
vm.runInContext(source.slice(source.indexOf('const normalizeCard'), source.indexOf('let pendingAttendance = null;')) + pure + '\nthis.api = {parseCSV,validateImport,canAttend,normalizeCard};', context);
const { parseCSV, validateImport, canAttend, normalizeCard } = context.api;
let count = 0;
function test(name, fn) { fn(); count++; console.log('LULUS: ' + name); }
const header = 'NIS,Nama,Kelas,Asrama,Wali,Telepon,RFID\r\n';
const row = '0001,"Ahmad, Fauzi",VII A,Al-Fatih,Abdullah,081234,000123';
// Jalankan seluruh skrip dengan DOM minimal: handler asli, bukan salinan logika.
function appHarness(crypto, saved = {}, integration = { SantriPulangConfig: { useSupabase: false } }) {
  const nodes = new Map(), events = {};
  function node(key) {
    if (!nodes.has(key)) nodes.set(key, { value: '', hidden: false, disabled: false, open: false, style: {}, options: [], handlers: {},
      classList: { add() {}, remove() {}, toggle() {} },
      addEventListener(type, fn) { this.handlers[type] = fn; }, querySelectorAll() { return []; },
      append() {}, before() {}, focus() {}, reset() {}, close() { this.open = false; this.handlers.close?.(); }, showModal() { this.open = true; } });
    return nodes.get(key);
  }
  const storage = new Map(Object.entries(saved));
  const document = { querySelector: s => s === 'dialog[open]' ? [...nodes.values()].find(n => n.open) || null : node(s), querySelectorAll: () => [], createElement: () => node(Symbol()), addEventListener() {}, body: node('body') };
  const ctx = vm.createContext({ ...integration, document, window: { addEventListener: (k, fn) => events[k] = fn }, crypto, TextEncoder, Uint8Array, structuredClone, setTimeout: () => 0, clearTimeout() {}, localStorage: { getItem: k => { integration.onRead?.(k); return storage.get(k) ?? null; }, setItem: (k, v) => { integration.onWrite?.(k); storage.set(k, v); } } });
  vm.runInContext(source, ctx);
  return { node, events, storage, run: s => vm.runInContext(s, ctx), submit: () => node('#auth-form').handlers.submit({ preventDefault() {} }) };
}
test('Inisialisasi lengkap tanpa WebCrypto memblokir submit', () => {
  const h = appHarness(undefined); assert.equal(h.node('#auth-submit').disabled, true);
  assert.match(h.node('#auth-message').textContent, /localhost/);
  assert.equal(h.run('authBlocked'), true);
});
test('Data lama tanpa RFID dipertahankan; status injeksi dan null ditolak', () => {
  const h = appHarness(undefined);
  const old = { students: [{ id: '1', name: '<img>', nis: '001', className: 'A', dorm: 'B', guardian: 'C', phone: '08', status: 'away', lastTime: '2026-01-01T10:00:00Z' }], logs: [], settings: {} };
  h.run('this.old = ' + JSON.stringify(old));
  assert.equal(h.run('normalizeState(old).students[0].rfid'), '');
  assert.equal(h.run('normalizeState(old).students[0].status'), 'away');
  assert.match(h.run('person(old.students[0])'), /&lt;img&gt;/);
  h.run('old.students[0].status = \'waiting" onclick="alert(1)\'');
  assert.throws(() => h.run('normalizeState(old)'));
  assert.throws(() => h.run('normalizeState({students:[null],logs:[],settings:{}})'));
});
test('CSV ekspor aktual mempertahankan apostrof dan melindungi formula', () => {
  const h = appHarness(undefined);
  for (const phone of ['+6281', "'+6281", "''+6281", "'teks", '00123']) {
    const csv = h.run(`['1','A','B','C','D',${JSON.stringify(phone)},''].map(csvCell).join(',')`);
    assert.equal(validateImport(parseCSV(header + csv), []).students[0].phone, phone);
  }
});
test('Record CSV kosong eksplisit tidak boleh dilewati diam-diam', () => {
  assert.ok(validateImport(parseCSV(header + row + '\n,,,,,,'), []).errors.length);
});
test('RFID tidak menumpuk modal; waktu kembali menjaga detik kepulangan', () => {
  const h = appHarness(undefined);
  h.node('#attendance-form').elements = { id: {}, time: {}, companion: { focus() {} } };
  h.run('authenticated = true; this.student = { id:"1", name:"A", nis:"01", className:"B", guardian:"C", status:"away", lastTime:new Date().toISOString() }');
  h.node('#student-dialog').open = true;
  h.run('openAttendance(student, "arrival", true)');
  assert.equal(h.run('pendingAttendance'), null);
  h.node('#student-dialog').open = false;
  h.run('openAttendance(student, "arrival", true)');
  assert.equal(h.node('#attendance-dialog').open, true);
  assert.ok(new Date(h.node('#attendance-form').elements.time.value).getTime() >= h.run('Date.parse(student.lastTime)'));
  assert.equal(h.node('#attendance-form').elements.time.step, 'any');
  h.node('#attendance-dialog').close();
  assert.equal(h.run('pendingAttendance'), null);
  assert.match(h.node('#scan-message').textContent, /dibatalkan/);
});
test('BOM, koma berkutip dan nol awal', () => { const rows = parseCSV('\uFEFF' + header + row); assert.equal(rows[1][1], 'Ahmad, Fauzi'); assert.equal(rows[1][0], '0001'); assert.equal(validateImport(rows, []).errors.length, 0); });
test('Kutipan ganda dan baris baru dalam sel', () => { assert.equal(parseCSV('"Nama ""A""\nB",x')[0][0], 'Nama "A"\nB'); });
test('CSV rusak ditolak', () => { for (const s of ['"abc', 'a"b,c', '"a"x,b']) assert.throws(() => parseCSV(s)); });
test('Kolom kosong terakhir dan baris kosong', () => { assert.equal(parseCSV(header + '1,A,B,C,D,081,\n\n')[1].length, 7); });
test('Header dan jumlah kolom wajib tepat', () => { assert.ok(validateImport(parseCSV('Nama,NIS\nA,1'), []).errors.length); assert.ok(validateImport(parseCSV(header + '1,A'), []).errors.length); });
test('Duplikat berkas dan data lama menolak seluruh impor', () => { assert.ok(validateImport(parseCSV(header + row + '\n' + row), []).errors.length >= 2); assert.ok(validateImport(parseCSV(header + row), [{ nis: '0001', rfid: '000123' }]).errors.length >= 2); });
test('RFID tanpa membedakan huruf besar dan batas kolom', () => { assert.equal(normalizeCard(' ab-01 '), 'AB-01'); assert.ok(validateImport(parseCSV(header + '1,A,B,C,D,08,abc!'), []).errors.length); assert.ok(validateImport(parseCSV(header + '1,' + 'a'.repeat(101) + ',B,C,D,08,'), []).errors.length); });
test('Kolom wajib dan berkas tanpa data ditolak', () => { assert.ok(validateImport(parseCSV(header), []).errors.length); assert.ok(validateImport(parseCSV(header + '1,,B,C,D,08,'), []).errors.length); });
test('Pelindung formula ekspor dapat diimpor', () => { assert.equal(validateImport(parseCSV(header + "1,A,B,C,D,'+6281,"), []).students[0].phone, '+6281'); });
test('Transisi dan scan berulang', () => { assert.equal(canAttend('waiting', 'departure'), true); assert.equal(canAttend('away', 'departure'), false); assert.equal(canAttend('waiting', 'arrival'), false); assert.equal(canAttend('away', 'arrival'), true); assert.equal(canAttend('returned', 'arrival'), false); assert.equal(canAttend('returned', 'departure'), false); });
test('Validasi tidak memutasi data lama', () => { const old = [{nis:'10',rfid:'ZZ',status:'away'}]; const before = JSON.stringify(old); validateImport(parseCSV(header + row), old); assert.equal(JSON.stringify(old), before); });
(async () => {
  let receive, lock, finishSave, reads = 0, writes = 0;
  const c = appHarness(undefined, { 'santripulang-v1': '{private-local-data}' }, {
    SantriPulangConfig: { useSupabase: true }, onRead() { reads++; }, onWrite() { writes++; },
    SantriPulangSupabase: { message: e => e.message, create: async () => ({
      watch(data, locked) { receive = data; lock = locked; },
      save: () => new Promise(resolve => { finishSave = resolve; }), logout: async () => {}
    }) }
  });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(reads, 0); assert.equal(c.run('state.students.length'), 0);
  receive({ revision: 1, state: { students: [], logs: [], settings: { school: 'RAHASIA CLOUD' } } });
  const saving = c.run('save(structuredClone(state))');
  assert.equal(await c.run('save(structuredClone(state))'), false);
  lock('Sesi ditutup'); finishSave(2); assert.equal(await saving, false);
  assert.equal(c.run('authenticated'), false); assert.equal(c.run('state.settings.school'), 'Pondok Pesantren');
  assert.equal(c.node('#application').hidden, true); assert.equal(writes, 0);
  assert.equal(c.storage.get('santripulang-v1'), '{private-local-data}');
  count++; console.log('LULUS: aplikasi cloud tidak membaca/menulis lokal; save ganda dan hasil setelah logout ditolak');
  const crypto = require('node:crypto').webcrypto;
  const h = appHarness(crypto);
  h.node('#auth-password').value = h.node('#auth-confirm').value = 'kata-sandi-uji';
  let finish;
  h.run('passwordHash = () => new Promise(resolve => { globalThis.finishHash = resolve; })');
  const pending = h.submit();
  h.events.storage({ key: 'santripulang-v1' });
  h.run('finishHash("a".repeat(64))');
  await pending;
  assert.equal(h.run('authenticated'), false);
  assert.equal(h.node('#auth-submit').disabled, true);
  assert.equal(h.storage.has('santripulang-admin-v1'), false);
  count++; console.log('LULUS: perubahan tab membatalkan setup admin yang masih menunggu hash');
  const i = appHarness(crypto); i.run('authenticated = true');
  const read = new Promise((resolve, reject) => { finish = reject; });
  const importing = i.node('#csv-file').handlers.change({ target: { files: [{ size: 1, text: () => read }], value: 'x' } });
  i.run('logout()'); finish(new Error('gagal membaca')); await importing;
  assert.equal(i.node('#import-dialog').open, false);
  assert.equal(i.node('#import-result').textContent, undefined);
  count++; console.log('LULUS: kegagalan baca CSV setelah logout tidak membuka dialog lama');
  const hashContext = vm.createContext({ crypto, TextEncoder, Uint8Array });
  vm.runInContext(source.slice(source.indexOf('async function passwordHash'), source.indexOf('function initAuth')), hashContext);
  const salt = Array.from(crypto.getRandomValues(new Uint8Array(16)));
  const a = await hashContext.passwordHash('kata-sandi-uji', salt, 310000);
  assert.equal(a.length, 64); assert.equal(a, await hashContext.passwordHash('kata-sandi-uji', salt, 310000));
  assert.notEqual(a, await hashContext.passwordHash('kata-sandi-lain', salt, 310000));
  assert.notEqual(a, await hashContext.passwordHash('kata-sandi-uji', Array(16).fill(0), 310000));
  console.log(`LULUS: hash PBKDF2, verifikasi sandi dan salt\nTotal ${count + 1} kelompok uji lulus.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
