const KEY = 'santripulang-v1';
// Konfigurasi hilang tidak boleh secara diam-diam membuka mode lokal.
const config = globalThis.SantriPulangConfig;
const cloudMode = config?.useFirebase !== false;
let cloud = null, revision = 0, saving = false, draftRevision = 0;
const emptyState = () => ({ students: [], logs: [], settings: { school: 'Pondok Pesantren', holiday: 'Liburan Akhir Semester', start: '', end: '' } });
let state = emptyState();
let loadFailed = false;
function normalizeState(parsed) {
  const object = v => v && typeof v === 'object' && !Array.isArray(v);
  if (!object(parsed) || !Array.isArray(parsed.students) || !Array.isArray(parsed.logs) || !object(parsed.settings)) throw new Error('Data lokal rusak');
  const ids = new Set();
  const students = parsed.students.map(s => {
    if (!object(s) || typeof s.id !== 'string' || !s.id || ids.has(s.id) ||
        ['name', 'nis', 'className', 'dorm', 'guardian', 'phone'].some(k => typeof s[k] !== 'string') ||
        !['waiting', 'away', 'returned'].includes(s.status) ||
        (s.rfid != null && typeof s.rfid !== 'string') ||
        (s.lastTime && (typeof s.lastTime !== 'string' || !Number.isFinite(Date.parse(s.lastTime))))) throw new Error('Data santri rusak');
    ids.add(s.id);
    return { ...s, rfid: s.rfid ?? '', lastTime: s.lastTime || '' };
  });
  if (parsed.logs.some(l => !object(l) || !['departure', 'arrival'].includes(l.type) || typeof l.time !== 'string' || !Number.isFinite(Date.parse(l.time)) || ['name', 'nis', 'companion'].some(k => typeof l[k] !== 'string'))) throw new Error('Riwayat rusak');
  if (Object.keys(emptyState().settings).some(k => parsed.settings[k] != null && typeof parsed.settings[k] !== 'string')) throw new Error('Pengaturan rusak');
  return { ...parsed, students, settings: { ...emptyState().settings, ...parsed.settings } };
}
try {
  const raw = cloudMode ? null : localStorage.getItem(KEY);
  if (raw) {
    const parsed = JSON.parse(raw);
    state = normalizeState(parsed);
  }
} catch { loadFailed = true; }
const $ = s => document.querySelector(s);
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const labels = { waiting: 'Belum pulang', away: 'Sedang liburan', returned: 'Sudah kembali' };
const uid = () => globalThis.crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const formatDate = value => value ? new Date(value).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const formatTime = value => value ? new Date(value).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '';
const localTime = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
let toastTimer;
function toast(message) { $('#toast').textContent = message; $('#toast').classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').classList.remove('show'), 4000); }
async function save(next, expectedRevision = revision) {
  if (saving) { toast('Penyimpanan masih berlangsung. Tunggu hasilnya.'); return false; }
  if (cloudMode) {
    if (!authenticated || !cloud) { toast('Koneksi admin belum siap. Masuk kembali.'); return false; }
    if (expectedRevision !== revision) { toast('Data berubah. Buka ulang formulir dari data terbaru.'); return false; }
    const version = authVersion;
    saving = true;
    try {
      const nextRevision = await cloud.save(normalizeState(next), expectedRevision);
      if (version !== authVersion || !authenticated) return false;
      if (nextRevision >= revision) { state = next; revision = nextRevision; render(); }
      return true;
    } catch (error) { if (version === authVersion) toast(globalThis.SantriPulangFirebase.message(error)); return false; }
    finally { saving = false; }
  }
  if (!authenticated) { toast('Silakan masuk sebagai admin lokal.'); return false; }
  if (loadFailed) { toast('Penyimpanan tidak dapat dibaca. Periksa izin browser sebelum melanjutkan.'); return false; }
  try { localStorage.setItem(KEY, JSON.stringify(next)); state = next; render(); return true; }
  catch { toast('Data gagal disimpan. Penyimpanan browser penuh atau tidak tersedia.'); return false; }
}
function person(student) { const initials = student.name.split(/\s+/).slice(0, 2).map(x => x[0]).join('').toUpperCase(); return `<div class="person"><span class="person-avatar">${escapeHTML(initials)}</span><div><strong>${escapeHTML(student.name)}</strong><small>NIS ${escapeHTML(student.nis)}</small></div></div>`; }
function emptyRow(columns, title, description) { return `<tr><td colspan="${columns}" class="empty"><strong>${title}</strong><p>${description}</p></td></tr>`; }
function render() {
  const { students, logs, settings } = state;
  $('#school-side').textContent = settings.school;
  $('#holiday-title').textContent = settings.holiday;
  $('#holiday-description').textContent = settings.start && settings.end ? `${formatDate(settings.start + 'T00:00:00')} — ${formatDate(settings.end + 'T00:00:00')} · Batas kembali ${formatDate(settings.end + 'T00:00:00')}` : 'Atur periode liburan untuk mulai memantau kepulangan santri.';
  const counts = { waiting: 0, away: 0, returned: 0 };
  students.forEach(s => counts[s.status]++);
  $('#total-count').textContent = students.length;
  Object.keys(counts).forEach(key => $(`#${key}-count`).textContent = counts[key]);
  const percent = students.length ? Math.round(counts.returned / students.length * 100) : 0;
  $('#progress-percent').textContent = `${percent}%`;
  $('#progress-ring').style.background = `conic-gradient(#598769 ${percent}%, #edf2eb ${percent}%)`;
  $('#progress-returned').textContent = counts.returned;
  $('#progress-other').textContent = students.length - counts.returned;
  $('#table-count').textContent = `${students.length} santri`;
  const classValue = $('#class-filter').value;
  $('#class-filter').innerHTML = '<option value="all">Semua kelas</option>' + [...new Set(students.map(s => s.className))].sort().map(c => `<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`).join('');
  if ([...$('#class-filter').options].some(o => o.value === classValue)) $('#class-filter').value = classValue;
  renderRows();
  $('#directory-rows').innerHTML = students.map(s => `<tr><td>${person(s)}</td><td>${escapeHTML(s.className)}</td><td>${escapeHTML(s.dorm)}</td><td>${escapeHTML(s.guardian)}<small>${escapeHTML(s.phone)}</small></td><td><button class="row-action" data-edit="${escapeHTML(s.id)}">Edit</button><button class="row-action danger" data-delete="${escapeHTML(s.id)}">Hapus</button></td></tr>`).join('') || emptyRow(5, 'Belum ada data santri', 'Klik “Tambah santri” untuk mendaftarkan santri pertama.');
  $('#directory-rows').querySelectorAll('[data-edit]').forEach(button => { const student = students.find(s => s.id === button.dataset.edit); const info = document.createElement('small'); info.textContent = `RFID: ${student.rfid || 'Belum dipetakan'}`; button.parentElement.append(info); });
  $('#history-rows').innerHTML = [...logs].sort((a, b) => new Date(b.time) - new Date(a.time)).map(l => `<tr><td><strong>${escapeHTML(l.name)}</strong><small>NIS ${escapeHTML(l.nis)}</small></td><td><span class="status ${l.type === 'departure' ? 'away' : 'returned'}">${l.type === 'departure' ? 'Pulang' : 'Kembali'}</span><small>${escapeHTML(l.period)}</small></td><td>${formatDate(l.time)}<small>${formatTime(l.time)} · waktu perangkat</small></td><td>${escapeHTML(l.companion)}</td><td style="white-space:normal;min-width:150px">${escapeHTML(l.note || '—')}</td></tr>`).join('') || emptyRow(5, 'Belum ada aktivitas', 'Riwayat akan muncul setelah kepulangan atau kedatangan dicatat.');
}
function renderRows() {
  const query = $('#search').value.trim().toLocaleLowerCase('id');
  const status = $('#status-filter').value;
  const className = $('#class-filter').value;
  const filtered = state.students.filter(s => `${s.name} ${s.nis}`.toLocaleLowerCase('id').includes(query) && (status === 'all' || s.status === status) && (className === 'all' || s.className === className));
  $('#student-rows').innerHTML = filtered.map(s => `<tr><td>${person(s)}</td><td>${escapeHTML(s.className)}<small>${escapeHTML(s.dorm)}</small></td><td><span class="status ${s.status}">● ${labels[s.status]}</span></td><td>${formatDate(s.lastTime)}<small>${formatTime(s.lastTime)}</small></td><td>${s.status === 'returned' ? '<span style="color:#6b9476">✓ Selesai</span>' : `<button class="row-action" data-attend="${escapeHTML(s.id)}">${s.status === 'waiting' ? '↗ Pulang' : '↙ Kembali'}</button>`}</td></tr>`).join('') || emptyRow(5, state.students.length ? 'Santri tidak ditemukan' : 'Siap menyambut liburan?', state.students.length ? 'Coba kata kunci atau filter yang berbeda.' : 'Tambahkan data santri untuk mulai mencatat kepulangan dan kedatangan.');
  $('#result-count').textContent = `Menampilkan ${filtered.length} dari ${state.students.length} santri`;
}
const views = { dashboard: ['Dashboard absensi', 'Pantau kepulangan dan kedatangan santri dengan lebih mudah.'], students: ['Data santri', 'Identitas santri dan kontak wali, tersusun dalam satu tempat.'], history: ['Riwayat absensi', 'Telusuri catatan kepulangan dan kedatangan setiap santri.'], settings: ['Pengaturan liburan', 'Sesuaikan identitas pondok dan periode liburan aktif.'] };
function showView(view) { document.querySelectorAll('.view').forEach(el => el.hidden = el.id !== `${view}-view`); document.querySelectorAll('[data-view]').forEach(el => el.classList.toggle('active', el.dataset.view === view)); $('#page-title').textContent = views[view][0]; $('#page-description').textContent = views[view][1]; $('#page-crumb').textContent = view === 'dashboard' ? 'Dashboard' : views[view][0]; if (view === 'settings') Object.entries(state.settings).forEach(([k, v]) => { if ($('#settings-form').elements[k]) $('#settings-form').elements[k].value = v; }); }
document.querySelectorAll('[data-view]').forEach(el => el.addEventListener('click', () => showView(el.dataset.view)));
$('#edit-period').addEventListener('click', () => showView('settings'));
$('#search').addEventListener('input', renderRows);
$('#status-filter').addEventListener('change', renderRows);
$('#class-filter').addEventListener('change', renderRows);
document.querySelectorAll('.close-dialog').forEach(el => el.addEventListener('click', () => el.closest('dialog').close()));
function openStudent(id) { if (saving) return; draftRevision = revision; const form = $('#student-form'); form.reset(); form.elements.id.value = ''; const student = state.students.find(s => s.id === id); $('#student-dialog-title').textContent = student ? 'Edit data santri' : 'Tambah santri'; if (student) ['id', 'name', 'nis', 'className', 'dorm', 'guardian', 'phone', 'rfid'].forEach(k => form.elements[k].value = student[k] || ''); $('#student-dialog').showModal(); }
$('#add-student').addEventListener('click', () => openStudent());
$('#student-form').addEventListener('submit', async event => {
  event.preventDefault(); const data = Object.fromEntries(new FormData(event.target)); Object.keys(data).forEach(k => data[k] = data[k].trim());
  if (['name', 'nis', 'className', 'dorm', 'guardian', 'phone'].some(k => !data[k])) return toast('Mohon isi semua kolom wajib.');
  if (state.students.some(s => s.nis.toLowerCase() === data.nis.toLowerCase() && s.id !== data.id)) return toast('NIS sudah terdaftar. Gunakan NIS yang berbeda.');
  data.rfid = normalizeCard(data.rfid);
  if (data.rfid && !/^[A-Z0-9_-]{1,64}$/.test(data.rfid)) return toast('RFID hanya boleh berisi huruf, angka, tanda - atau _, maksimal 64 karakter.');
  if (data.rfid && state.students.some(s => normalizeCard(s.rfid) === data.rfid && s.id !== data.id)) return toast('Kartu RFID sudah dipakai santri lain.');
  const next = structuredClone(state);
  if (data.id) { const i = next.students.findIndex(s => s.id === data.id); if (i < 0) return toast('Santri tidak ditemukan.'); next.students[i] = { ...next.students[i], ...data }; }
  else next.students.push({ ...data, id: uid(), status: 'waiting', lastTime: '' });
  if (await save(next, draftRevision)) { $('#student-dialog').close(); toast('Data santri berhasil disimpan.'); }
});
document.addEventListener('click', async event => {
  const edit = event.target.closest('[data-edit]'); if (edit) openStudent(edit.dataset.edit);
  const del = event.target.closest('[data-delete]');
  if (del) { const s = state.students.find(s => s.id === del.dataset.delete); if (s && confirm(`Hapus ${s.name} dari data santri? Riwayat absensi tetap tersimpan.`)) { const next = structuredClone(state); next.students = next.students.filter(x => x.id !== s.id); if (await save(next)) toast('Data santri dihapus.'); } }
  const attend = event.target.closest('[data-attend]');
  if (attend) { const s = state.students.find(s => s.id === attend.dataset.attend); if (s) openAttendance(s, s.status === 'waiting' ? 'departure' : 'arrival', false); }
});
$('#attendance-form').addEventListener('submit', async event => {
  event.preventDefault(); const data = Object.fromEntries(new FormData(event.target)); const next = structuredClone(state); const s = next.students.find(s => s.id === data.id);
  if (!pendingAttendance || !s || s.id !== pendingAttendance.id || s.status !== pendingAttendance.status || !canAttend(s.status, pendingAttendance.type)) return toast('Status berubah atau transaksi sudah tercatat. Tutup dialog dan periksa kembali.');
  if (!data.companion.trim()) return toast('Nama penjemput / pengantar wajib diisi.');
  const time = new Date(data.time);
  if (isNaN(time.getTime()) || time.getTime() > Date.now() + 60000) return toast('Waktu absensi harus valid dan tidak boleh di masa depan.');
  if (s.lastTime && time < new Date(s.lastTime)) return toast('Waktu kembali tidak boleh sebelum waktu pulang.');
  const type = pendingAttendance.type;
  next.logs.push({ id: uid(), studentId: s.id, name: s.name, nis: s.nis, type, time: time.toISOString(), companion: data.companion.trim(), note: data.note.trim(), period: next.settings.holiday });
  s.status = type === 'departure' ? 'away' : 'returned'; s.lastTime = time.toISOString();
   const scanned = pendingAttendance.scanned;
   if (await save(next, pendingAttendance.revision)) { const message = `${s.name}: ${type === 'departure' ? 'kepulangan' : 'kedatangan'} berhasil dicatat. Scan ulang untuk kegiatan yang sama ditolak.`; if (scanned) $('#scan-message').textContent = message; pendingAttendance = null; $('#attendance-dialog').close(); toast(message); }
});
$('#settings-form').addEventListener('submit', async event => { event.preventDefault(); const data = Object.fromEntries(new FormData(event.target)); data.school = data.school.trim(); data.holiday = data.holiday.trim(); if (!data.school || !data.holiday) return toast('Nama pondok dan periode wajib diisi.'); if (data.end < data.start) return toast('Batas kembali tidak boleh sebelum awal liburan.'); const next = structuredClone(state); next.settings = data; if (await save(next, settingsRevision)) toast('Pengaturan liburan berhasil disimpan.'); });
$('#reset-period').addEventListener('click', async () => { if (!state.students.length) return toast('Belum ada santri yang perlu direset.'); if (state.students.some(s => s.status === 'away')) return toast('Masih ada santri yang belum kembali. Selesaikan absensi sebelum reset.'); if (!confirm('Mulai ulang status absensi seluruh santri? Semua status menjadi Belum pulang. Riwayat tetap tersimpan.')) return; const next = structuredClone(state); next.students.forEach(s => { s.status = 'waiting'; s.lastTime = ''; }); if (await save(next)) toast('Status absensi siap untuk periode baru.'); });
function csvCell(value) { let text = String(value ?? ''); if (/^'|^[\s]*[=+@-]/.test(text)) text = "'" + text; return `"${text.replace(/"/g, '""')}"`; }
function exportCSV(rows, name) { const blob = new Blob(['\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8;' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `${name}-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); toast('Laporan CSV berhasil diekspor.'); }
$('#export-students').addEventListener('click', () => { if (!state.students.length) return toast('Belum ada data untuk diekspor.'); exportCSV([['NIS', 'Nama', 'Kelas', 'Asrama', 'Wali', 'Telepon', 'Status', 'Waktu terakhir', 'Periode'], ...state.students.map(s => [s.nis, s.name, s.className, s.dorm, s.guardian, s.phone, labels[s.status], s.lastTime ? new Date(s.lastTime).toLocaleString('id-ID') : '', state.settings.holiday])], 'absensi-santri'); });
$('#export-history').addEventListener('click', () => { if (!state.logs.length) return toast('Belum ada riwayat untuk diekspor.'); exportCSV([['NIS', 'Nama', 'Kegiatan', 'Waktu', 'Penjemput / pengantar', 'Catatan', 'Periode'], ...state.logs.map(l => [l.nis, l.name, l.type === 'departure' ? 'Pulang' : 'Kembali', new Date(l.time).toLocaleString('id-ID'), l.companion, l.note, l.period])], 'riwayat-absensi'); });
$('#today').textContent = new Date().toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
// Inisialisasi dilanjutkan setelah kontrol admin dan RFID disiapkan.
if (loadFailed) toast('Data lokal gagal dibaca. Penyimpanan dinonaktifkan agar data lama tidak tertimpa.');

// Login ini hanya penghalang antarmuka lokal, bukan otorisasi server.
const AUTH_KEY = 'santripulang-admin-v1';
let authenticated = false;
let adminRecord = null;
let authBusy = false;
let authBlocked = false;
let authVersion = 0;
async function passwordHash(password, salt, iterations) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: new Uint8Array(salt), iterations, hash: 'SHA-256' }, key, 256);
  return Array.from(new Uint8Array(bits), b => b.toString(16).padStart(2, '0')).join('');
}
function initAuth() {
  if (cloudMode) {
    $('#auth-title').textContent = 'Masuk admin Firebase';
    $('#auth-description').textContent = 'Akun dibuat pengelola. Tidak tersedia pendaftaran mandiri.';
    $('#auth-email-label').hidden = false; $('#auth-email').required = true;
    $('#auth-confirm-label').hidden = true; $('#auth-confirm').required = false;
    $('#auth-password').minLength = 1; $('#auth-submit').textContent = 'Masuk';
    $('#auth-submit').disabled = !cloud || authBusy;
    return;
  }
  authBlocked = false; adminRecord = null; $('#auth-submit').disabled = false;
  try {
    if (!globalThis.crypto?.subtle || !globalThis.crypto?.getRandomValues) throw new Error('Web Crypto tidak tersedia. Buka melalui http://localhost atau HTTPS pada browser modern. Login tidak memakai hash lemah sebagai pengganti.');
    const raw = localStorage.getItem(AUTH_KEY);
    if (raw) {
      adminRecord = JSON.parse(raw);
      if (adminRecord.version !== 1 || adminRecord.iterations !== 310000 || !Array.isArray(adminRecord.salt) || adminRecord.salt.length !== 16 || !adminRecord.salt.every(n => Number.isInteger(n) && n >= 0 && n <= 255) || !/^[a-f0-9]{64}$/.test(adminRecord.hash)) throw new Error('Konfigurasi admin lokal rusak. Lihat panduan pemulihan di README; data santri tidak dihapus.');
    }
    $('#auth-title').textContent = adminRecord ? 'Selamat datang kembali.' : 'Siapkan admin pertama.';
    $('#auth-description').textContent = adminRecord ? 'Masuk untuk mengelola absensi pada perangkat ini.' : 'Buat kata sandi minimal 10 karakter. Simpan dengan aman; tidak ada layanan pemulihan akun.';
    $('#auth-confirm-label').hidden = !!adminRecord;
    $('#auth-confirm').required = !adminRecord;
    $('#auth-password').autocomplete = adminRecord ? 'current-password' : 'new-password';
    $('#auth-submit').textContent = adminRecord ? 'Masuk admin' : 'Buat admin lokal';
  } catch (error) { authBlocked = true; $('#auth-message').textContent = error.message; $('#auth-submit').disabled = true; }
}
$('#auth-form').addEventListener('submit', async event => {
  event.preventDefault(); if (authBusy || authBlocked) return;
  if (cloudMode) {
    if (!cloud) return;
    authBusy = true; $('#auth-submit').disabled = true;
    try { await cloud.login($('#auth-email').value, $('#auth-password').value); $('#auth-form').reset(); }
    catch (error) { $('#auth-message').textContent = globalThis.SantriPulangFirebase.message(error); }
    finally { authBusy = false; $('#auth-submit').disabled = !cloud; }
    return;
  }
  const version = authVersion;
  const password = $('#auth-password').value;
  if (password.length < 10 || password.length > 200) return;
  if (!adminRecord && password !== $('#auth-confirm').value) { $('#auth-message').textContent = 'Ulangan kata sandi tidak sama.'; return; }
  authBusy = true; $('#auth-submit').disabled = true; $('#auth-message').textContent = 'Memproses kata sandi…';
  try {
    if (!adminRecord) {
      if (localStorage.getItem(AUTH_KEY)) throw new Error('Admin telah dibuat di tab lain. Muat ulang halaman.');
      const salt = Array.from(crypto.getRandomValues(new Uint8Array(16)));
      const record = { version: 1, iterations: 310000, salt, hash: await passwordHash(password, salt, 310000) };
      if (version !== authVersion || authBlocked) return;
      if (localStorage.getItem(AUTH_KEY)) throw new Error('Admin telah dibuat di tab lain. Muat ulang halaman.');
      localStorage.setItem(AUTH_KEY, JSON.stringify(record)); adminRecord = record;
    } else if (await passwordHash(password, adminRecord.salt, adminRecord.iterations) !== adminRecord.hash) throw new Error('Kata sandi tidak sesuai.');
    if (version !== authVersion || authBlocked) return;
    authenticated = true; $('#auth-form').reset(); $('#auth-message').textContent = '';
    $('#auth-screen').hidden = true; $('#application').hidden = false; $('#application').inert = false; document.body.classList.remove('locked');
    render(); showView('dashboard'); $('#scan-input').focus();
  } catch (error) { if (version === authVersion) $('#auth-message').textContent = error.message || 'Gagal mengakses penyimpanan lokal.'; }
  finally { authBusy = false; $('#auth-submit').disabled = authBlocked; }
});
function logout() {
  if (cloudMode) {
    lockCloud('Anda telah keluar. Masuk kembali untuk membuka data server.');
    void cloud?.logout().catch(() => { $('#auth-message').textContent = 'Gagal menutup sesi layanan. Muat ulang halaman sebelum masuk kembali.'; $('#auth-submit').disabled = true; });
    return;
  }
  authVersion++;
  authenticated = false; pendingAttendance = null; pendingImport = null; importVersion++;
  document.querySelectorAll('dialog[open]').forEach(d => d.close());
  $('#application').inert = true; $('#application').hidden = true; $('#auth-screen').hidden = false; document.body.classList.add('locked');
  $('#scan-input').value = ''; $('#csv-file').value = ''; $('#auth-form').reset(); initAuth(); $('#auth-password').focus();
}
$('#logout').addEventListener('click', logout);
// Hindari penimpaan snapshot lama oleh tab lain. Satu tab aktif direkomendasikan.
window.addEventListener('storage', event => {
  if (cloudMode) return;
  if (event.key === KEY || event.key === AUTH_KEY || event.key === null) {
    logout(); loadFailed = true; authBlocked = true; $('#auth-message').textContent = 'Data berubah di tab lain. Muat ulang halaman sebelum melanjutkan.'; $('#auth-submit').disabled = true;
  }
});

const normalizeCard = value => String(value || '').trim().toUpperCase();
function canAttend(status, type) { return (type === 'departure' && status === 'waiting') || (type === 'arrival' && status === 'away'); }
let pendingAttendance = null;
const cardLabel = document.createElement('label');
cardLabel.textContent = 'Kartu RFID (opsional, unik; pindai tanpa menekan Enter)';
const cardInput = document.createElement('input'); cardInput.name = 'rfid'; cardInput.maxLength = 64; cardInput.autocomplete = 'off'; cardInput.placeholder = 'Contoh: 0001234567';
cardLabel.append(cardInput); $('#student-form .dialog-actions').before(cardLabel);
cardInput.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); cardInput.value = normalizeCard(cardInput.value); toast('Nomor kartu diterima. Periksa lalu klik Simpan santri.'); } });
function openAttendance(student, type, scanned) {
  if (!authenticated || saving || document.querySelector('dialog[open]')) return;
  if (!canAttend(student.status, type)) { toast('Kegiatan tidak sesuai status atau sudah dicatat.'); return; }
  pendingAttendance = { id: student.id, status: student.status, type, scanned, revision };
  const form = $('#attendance-form'); form.reset(); form.elements.id.value = student.id; form.elements.time.value = localTime(); form.elements.companion.value = student.guardian;
  form.elements.time.step = 'any';
  if (student.lastTime && new Date(form.elements.time.value) < new Date(student.lastTime)) {
    const d = new Date(student.lastTime);
    form.elements.time.value = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 23);
  }
  $('#attendance-title').textContent = type === 'departure' ? 'Konfirmasi kepulangan' : 'Konfirmasi kedatangan';
  $('#attendance-student').textContent = `${student.name} · NIS ${student.nis} · ${student.className}${scanned ? ' · RFID ' + student.rfid : ''}`;
  $('#attendance-dialog').showModal();
  // Enter dari scanner tidak boleh langsung menyetujui dialog.
  form.elements.companion.focus();
}
$('#attendance-form').addEventListener('keydown', event => { if (event.key === 'Enter' && event.target.tagName !== 'BUTTON' && event.target.tagName !== 'TEXTAREA') event.preventDefault(); });
$('#attendance-dialog').addEventListener('close', () => {
  if (pendingAttendance?.scanned) $('#scan-message').textContent = 'Konfirmasi dibatalkan. Tidak ada absensi yang disimpan.';
  pendingAttendance = null;
  if (authenticated && !$('#dashboard-view').hidden) $('#scan-input').focus();
});
$('#scan-form').addEventListener('submit', event => {
  event.preventDefault(); if (!authenticated || pendingAttendance) return;
  const card = normalizeCard($('#scan-input').value); $('#scan-input').value = '';
  const matches = state.students.filter(s => card && normalizeCard(s.rfid) === card);
  if (matches.length !== 1) { $('#scan-message').textContent = matches.length ? 'Kartu terpetakan lebih dari sekali. Perbaiki melalui Edit data santri.' : 'Kartu tidak dikenal. Petakan nomor kartu melalui Data santri → Edit.'; return; }
  const student = matches[0], type = $('#scan-mode').value;
  if (!canAttend(student.status, type)) { $('#scan-message').textContent = `${student.name}: ${labels[student.status]}. ${type === 'arrival' && student.status === 'waiting' ? 'Belum ada catatan pulang.' : 'Transaksi ini sudah dicatat atau tidak sesuai status.'} Tidak ada perubahan data.`; return; }
  $('#scan-message').textContent = `${student.name} ditemukan. Periksa identitas dan konfirmasi ${type === 'departure' ? 'kepulangan' : 'kedatangan'} pada dialog.`;
  openAttendance(student, type, true);
});
$('#scan-mode').addEventListener('change', () => { $('#scan-message').textContent = 'Mode diubah. Siap memindai kartu berikutnya.'; $('#scan-input').focus(); });

const CSV_HEADERS = ['NIS', 'Nama', 'Kelas', 'Asrama', 'Wali', 'Telepon', 'RFID'];
const CSV_FIELDS = ['nis', 'name', 'className', 'dorm', 'guardian', 'phone', 'rfid'];
// Parser ketat: koma, CRLF/LF, BOM, kutipan ganda, koma/baris baru di dalam kutipan.
function parseCSV(text) {
  text = text.replace(/^\uFEFF/, '');
  const rows = []; let row = [], cell = '', quoted = false, closed = false;
  const endCell = () => { row.push(cell); cell = ''; closed = false; };
   const endRow = () => { endCell(); if (row.length > 1 || row.some(v => v.trim())) rows.push(row); row = []; };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else { quoted = false; closed = true; } } else cell += c; continue; }
    if (c === ',') { endCell(); continue; }
    if (c === '\r' || c === '\n') { if (c === '\r' && text[i + 1] === '\n') i++; endRow(); continue; }
    if (closed) throw new Error('Ada karakter setelah penutup kutipan. Gunakan koma atau baris baru.');
    if (c === '"') { if (cell) throw new Error('Kutipan harus dimulai pada awal kolom.'); quoted = true; }
    else cell += c;
  }
  if (quoted) throw new Error('Kutipan CSV belum ditutup.');
  if (cell || row.length || closed) endRow();
  return rows;
}
function validateImport(rows, existing) {
  const errors = [], students = [];
  if (!rows.length || rows[0].length !== 7 || rows[0].some((v, i) => v.trim().toLowerCase() !== CSV_HEADERS[i].toLowerCase())) return { errors: ['Header harus: ' + CSV_HEADERS.join(',')], students };
  if (rows.length < 2) errors.push('Tidak ada baris data santri.');
  if (rows.length > 5001) errors.push('Maksimal 5.000 santri per impor.');
  const nisSet = new Set(existing.map(s => String(s.nis).toLowerCase())), cards = new Set(existing.map(s => normalizeCard(s.rfid)).filter(Boolean));
  rows.slice(1).forEach((row, index) => {
    const prefix = `Baris data ${index + 1}: `;
    if (row.length !== 7) { errors.push(prefix + 'jumlah kolom harus 7.'); return; }
    // Lepas satu apostrof pelindung formula yang ditambahkan ekspor aplikasi.
    const values = row.map(v => v.replace(/^'(?='|[\s]*[=+@-])/, '').trim());
    const s = Object.fromEntries(CSV_FIELDS.map((key, i) => [key, values[i]])); s.rfid = normalizeCard(s.rfid);
    if (values.slice(0, 6).some(v => !v)) errors.push(prefix + 'NIS, nama, kelas, asrama, wali dan telepon wajib diisi.');
    if (values.some((v, i) => v.length > [30, 100, 30, 60, 100, 25, 64][i])) errors.push(prefix + 'panjang kolom melebihi batas formulir.');
    if (s.rfid && !/^[A-Z0-9_-]{1,64}$/.test(s.rfid)) errors.push(prefix + 'format RFID tidak valid.');
    const nis = s.nis.toLowerCase();
    if (nisSet.has(nis)) errors.push(prefix + `NIS duplikat (${s.nis}) pada data lama atau berkas ini.`); nisSet.add(nis);
    if (s.rfid && cards.has(s.rfid)) errors.push(prefix + `RFID duplikat (${s.rfid}).`); if (s.rfid) cards.add(s.rfid);
    students.push(s);
  });
  return { errors, students };
}
let pendingImport = null;
let importVersion = 0;
$('#csv-template').addEventListener('click', () => exportCSV([CSV_HEADERS, ['2026001', 'Ahmad Fauzi', 'VII A', 'Al-Fatih', 'Abdullah', '081234567890', '0001234567']], 'template-santri'));
$('#csv-export').addEventListener('click', () => exportCSV([CSV_HEADERS, ...state.students.map(s => CSV_FIELDS.map(k => s[k] || ''))], 'data-santri'));
$('#csv-file').addEventListener('change', async event => {
  const file = event.target.files[0]; event.target.value = ''; if (!file || !authenticated) return;
  const version = ++importVersion; pendingImport = null; $('#import-confirm').disabled = true;
  try {
    if (file.size > 2 * 1024 * 1024) throw new Error('Berkas terlalu besar. Batas impor 2 MB.');
    const rows = parseCSV(await file.text()); if (!authenticated || version !== importVersion) return;
    const result = validateImport(rows, state.students);
    if (result.errors.length) $('#import-result').textContent = `Impor ditolak: ${result.errors.length} masalah. Tidak ada data yang disimpan.\n\n` + result.errors.slice(0, 100).join('\n') + (result.errors.length > 100 ? '\nHanya 100 masalah pertama ditampilkan.' : '');
    else { pendingImport = rows; $('#import-confirm').disabled = false; $('#import-result').textContent = `${result.students.length} santri valid akan ditambahkan dengan status Belum pulang.\nPratinjau maksimal 20 santri:\n\n` + result.students.slice(0, 20).map(s => `${s.nis} · ${s.name} · ${s.className} · RFID ${s.rfid || 'belum dipetakan'}`).join('\n'); }
  } catch (error) { if (!authenticated || version !== importVersion) return; $('#import-result').textContent = 'Impor ditolak. Tidak ada perubahan data.\n' + error.message; }
  if (authenticated && !$('#import-dialog').open) $('#import-dialog').showModal();
});
$('#import-dialog').addEventListener('close', () => { importVersion++; pendingImport = null; $('#import-confirm').disabled = true; });
$('#import-confirm').addEventListener('click', async () => {
  if (!authenticated || !pendingImport) return;
  const result = validateImport(pendingImport, state.students);
  if (result.errors.length) { pendingImport = null; $('#import-confirm').disabled = true; $('#import-result').textContent = 'Data berubah. Impor ditolak:\n' + result.errors.join('\n'); return; }
  const next = structuredClone(state); next.students.push(...result.students.map(s => ({ ...s, id: uid(), status: 'waiting', lastTime: '' })));
  if (await save(next)) { pendingImport = null; $('#import-dialog').close(); toast(`${result.students.length} santri berhasil diimpor. Data lama dan riwayat tetap utuh.`); }
});
initAuth();
let settingsRevision = 0;
// Tangkap versi saat formulir pengaturan dibuka, bukan saat disubmit.
const originalShowView = showView;
showView = function(view) { if (view === 'settings') settingsRevision = revision; originalShowView(view); };
function lockCloud(message) {
  authVersion++; authenticated = false; state = emptyState(); revision = 0;
  pendingAttendance = null; pendingImport = null; importVersion++;
  document.querySelectorAll('dialog[open]').forEach(d => d.close());
  document.querySelectorAll('#application form').forEach(form => form.reset());
  for (const selector of ['#attendance-student', '#import-result', '#scan-message', '#toast']) $(selector).textContent = '';
  $('#search').value = ''; $('#csv-file').value = ''; $('#auth-form').reset();
  clearTimeout(toastTimer); $('#toast').classList.remove('show');
  render(); showView('dashboard');
  $('#application').hidden = true; $('#application').inert = true;
  $('#auth-screen').hidden = false; document.body.classList.add('locked');
  $('#auth-message').textContent = message;
}
async function startCloud() {
  try {
    if (!globalThis.SantriPulangFirebase) throw new Error('Helper Firebase tidak termuat. Pastikan firebase-service.js tersedia, lalu muat ulang.');
    cloud = await globalThis.SantriPulangFirebase.create(config);
    initAuth();
    cloud.watch(snapshot => {
      const next = snapshot.state ? normalizeState(snapshot.state) : emptyState();
      const wasLocked = !authenticated;
      state = next; revision = snapshot.revision; authenticated = true;
      $('#auth-screen').hidden = true; $('#application').hidden = false; $('#application').inert = false;
      document.body.classList.remove('locked'); render();
      if (wasLocked) showView('dashboard');
    }, lockCloud);
    $('.local-badge').textContent = 'Mode Firebase';
    $('.profile strong').textContent = 'Admin Firebase';
    $('.table-footer span:last-child').textContent = 'Data bersama di Firestore';
    $('#history-view .card-heading p').textContent = 'Pencatatan bersama seluruh pengurus yang diizinkan.';
    $('#settings-form .settings-note').textContent = 'Prototipe Firestore satu dokumen; perlu koneksi server. Batas aplikasi 200.000 karakter / 700 KB. Ekspor berisi data pribadi: simpan secara aman.';
  } catch (error) {
    authBlocked = true; $('#auth-submit').disabled = true;
    $('#auth-title').textContent = 'Konfigurasi Firebase belum siap';
    $('#auth-message').textContent = (globalThis.SantriPulangFirebase?.message(error) || error.message) + ' Lihat README.md, lalu muat ulang. Data lokal tidak dibaca atau dikirim.';
  }
}
if (cloudMode) void startCloud();
