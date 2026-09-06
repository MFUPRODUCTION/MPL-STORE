/* Helper publik, SDK modular CDN hanya dimuat saat mode Firebase diaktifkan. */
(() => {
  const VERSION = '11.10.0';
  const fail = message => new Error(message);
  function validateConfig(config) {
    if (!config || config.useFirebase !== true) throw fail('Mode Firebase belum diaktifkan.');
    for (const key of ['apiKey', 'authDomain', 'projectId', 'appId']) {
      if (typeof config.firebase?.[key] !== 'string' || !config.firebase[key].trim() || /YOUR_|ISI_|PLACEHOLDER/i.test(config.firebase[key])) {
        throw fail(`Konfigurasi ${key} belum lengkap. Isi firebase-config.js sesuai README, lalu muat ulang. Tidak ada peralihan ke mode lokal.`);
      }
    }
    return config.firebase;
  }
  function message(error) {
    if (!error?.code) return error?.message || 'Koneksi gagal. Periksa jaringan dan README.';
    if (/permission-denied/.test(error.code)) return 'Akses ditolak. Periksa firestore.rules dan dokumen admins/{uid} melalui konsol tepercaya.';
    if (/invalid-credential|wrong-password|user-not-found|invalid-email/.test(error.code)) return 'Email atau kata sandi tidak sesuai.';
    if (/too-many-requests/.test(error.code)) return 'Terlalu banyak percobaan. Tunggu sebelum mencoba lagi.';
    if (/unauthorized-domain/.test(error.code)) return 'Domain belum diizinkan. Tambahkan domain Vercel di Authentication → Authorized domains.';
    if (/operation-not-allowed/.test(error.code)) return 'Aktifkan penyedia Email/Password di Firebase Authentication.';
    return 'Layanan Firebase gagal. Periksa jaringan, konfigurasi proyek, status Firestore, dan rules; lalu coba masuk kembali.';
  }
  async function loadSDK() {
    const base = `https://www.gstatic.com/firebasejs/${VERSION}`;
    const [app, auth, store] = await Promise.all([
      import(`${base}/firebase-app.js`), import(`${base}/firebase-auth.js`), import(`${base}/firebase-firestore.js`)
    ]);
    return { ...app, ...auth, ...store };
  }
  // Parameter SDK dapat diinjeksi untuk pengujian tanpa jaringan/kredensial.
  async function create(config, suppliedSDK) {
    const options = validateConfig(config);
    const sdk = suppliedSDK || await loadSDK();
    const app = sdk.initializeApp(options);
    const auth = sdk.initializeAuth(app, { persistence: sdk.inMemoryPersistence });
    const db = sdk.initializeFirestore(app, { localCache: sdk.memoryLocalCache() });
    const ref = sdk.doc(db, 'shared', 'santripulang');
    let generation = 0, stopData = null, stopAdmin = null, activeUID = null, lastError = '';
    const stop = () => { generation++; activeUID = null; stopData?.(); stopAdmin?.(); stopData = stopAdmin = null; };
    function envelope(snapshot) {
      if (!snapshot.exists()) return { revision: 0, state: null };
      const value = snapshot.data();
      if (value.schema !== 1 || !Number.isSafeInteger(value.revision) || value.revision < 1 || typeof value.payload !== 'string') throw fail('Format data cloud tidak valid. Hubungi pengelola; data tidak ditimpa.');
      return { revision: value.revision, state: JSON.parse(value.payload) };
    }
    return {
      async login(email, password) { lastError = ''; await sdk.signInWithEmailAndPassword(auth, email.trim(), password); },
      async logout() { lastError = ''; stop(); await sdk.signOut(auth); },
      watch(onData, onLocked) {
        const unsubscribe = sdk.onAuthStateChanged(auth, async user => {
          stop(); onLocked(user ? 'Memeriksa izin admin dan data server…' : lastError || 'Masuk dengan akun admin yang dibuat pengelola.');
          const token = generation;
          if (!user) return;
          const broken = error => {
            if (token !== generation) return;
            lastError = message(error); stop(); onLocked(lastError);
            void sdk.signOut(auth).catch(() => {});
          };
          try {
            const adminRef = sdk.doc(db, 'admins', user.uid);
            const admin = await sdk.getDocFromServer(adminRef);
            if (token !== generation) return;
            if (!admin.exists()) throw fail('Akun belum menjadi admin. Pengelola harus membuat admins/' + user.uid + ' secara manual di konsol tepercaya. Tidak ada pendaftaran admin di aplikasi.');
            activeUID = user.uid;
            stopAdmin = sdk.onSnapshot(adminRef, { includeMetadataChanges: true }, snap => {
              if (token === generation && !snap.metadata.fromCache && !snap.exists()) broken(fail('Izin admin dicabut. Hubungi pengelola.'));
            }, broken);
            stopData = sdk.onSnapshot(ref, { includeMetadataChanges: true }, snap => {
              if (token !== generation || snap.metadata.hasPendingWrites) return;
              // Cache memori/offline bukan bukti akses server yang masih berlaku.
              if (snap.metadata.fromCache) { onLocked('Koneksi server belum tersedia. Data disembunyikan; tunggu koneksi atau masuk kembali.'); return; }
              try { onData(envelope(snap)); } catch (error) { broken(error); }
            }, broken);
          } catch (error) { broken(error); }
        });
        return () => { unsubscribe(); stop(); };
      },
      async save(state, expectedRevision) {
        const token = generation, user = activeUID;
        if (!user || auth.currentUser?.uid !== user) throw fail('Sesi admin tidak aktif. Masuk kembali.');
        const payload = JSON.stringify(state);
        if (payload.length > 200000 || new TextEncoder().encode(payload).length > 700000) throw fail('Data melebihi batas prototipe (200.000 karakter / 700 KB). Arsipkan secara aman atau migrasikan model data; tidak ada data yang disimpan.');
        const revision = await sdk.runTransaction(db, async tx => {
          if (token !== generation || auth.currentUser?.uid !== user) throw fail('Sesi berubah. Penyimpanan dibatalkan.');
          const current = envelope(await tx.get(ref));
          if (current.revision !== expectedRevision) throw fail('Data telah berubah oleh petugas lain. Periksa data terbaru lalu ulangi tindakan; perubahan lama tidak ditimpa.');
          if (token !== generation || auth.currentUser?.uid !== user) throw fail('Sesi berubah. Penyimpanan dibatalkan.');
          const nextRevision = current.revision + 1;
          tx.set(ref, { schema: 1, revision: nextRevision, payload, updatedBy: user, updatedAt: sdk.serverTimestamp() });
          return nextRevision;
        });
        if (token !== generation) throw fail('Sesi berubah. Periksa hasil di server setelah masuk kembali.');
        return revision;
      }
    };
  }
  globalThis.SantriPulangFirebase = Object.freeze({ create, validateConfig, message, VERSION });
})();
