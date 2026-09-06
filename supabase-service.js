/* SDK hanya diimpor ketika mode cloud diaktifkan. Tidak menyimpan sesi/data ke disk. */
(() => {
  const VERSION = '2.49.8';
  function validateConfig(config) {
    if (config?.useSupabase !== true) throw new Error('Mode Supabase belum diaktifkan.');
    const { url, anonKey } = config.supabase || {};
    if (typeof url !== 'string' || !/^https:\/\/[a-z0-9.-]+\/?$/i.test(url) || /YOUR_|PLACEHOLDER/i.test(url) ||
        typeof anonKey !== 'string' || !anonKey.trim() || /YOUR_|PLACEHOLDER|service_role|sb_secret_/i.test(anonKey))
      throw new Error('Isi URL dan anon/publishable key di supabase-config.js. Jangan gunakan secret/service_role.');
    if (!anonKey.startsWith('sb_publishable_')) {
      try {
        const part = anonKey.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
        if (JSON.parse(atob(part)).role !== 'anon') throw new Error();
      } catch { throw new Error('Key harus anon JWT atau publishable key, bukan token admin.'); }
    }
    return { url, anonKey };
  }
  function message(error) {
    if (error?.code === '40001') return 'Data telah berubah oleh petugas lain. Buka ulang dari data terbaru lalu ulangi tindakan.';
    if (error?.code === '42501') return 'Akses admin ditolak atau dicabut. Hubungi pengelola.';
    if (error?.code === '22023' || error?.code === '23514') return 'Data tidak valid atau melebihi batas prototipe.';
    return error?.message || 'Layanan Supabase gagal. Periksa koneksi dan konfigurasi.';
  }
  async function create(config, suppliedSDK) {
    const { url, anonKey } = validateConfig(config);
    const sdk = suppliedSDK || await import(`https://esm.sh/@supabase/supabase-js@${VERSION}`);
    const client = sdk.createClient(url, anonKey, { auth: {
      persistSession: false, autoRefreshToken: true, detectSessionInUrl: false
    } });
    let generation = 0, activeUID = null, channel = null, timer = null, highest = -1;
    let authSub = null, locked = () => {}, receive = () => {}, refresh = null;
    const stop = () => {
      generation++; activeUID = null; highest = -1; refresh = null;
      clearInterval(timer); timer = null;
      if (channel) void client.removeChannel(channel).catch(() => {});
      channel = null;
    };
    function broken(error, token) {
      if (token !== generation) return;
      stop(); locked(message(error));
      // Tetap terkunci sampai login ulang; jangan menjalankan Auth di callback Auth.
    }
    async function start(session, token) {
      if (token !== generation || !session) return;
      try {
        await client.realtime.setAuth(session.access_token);
        if (token !== generation) return;
        const admin = await client.from('admins').select('user_id').eq('user_id', session.user.id).maybeSingle();
        if (token !== generation) return;
        if (admin.error) throw admin.error;
        if (!admin.data) throw new Error('Akun belum menjadi admin atau izin dicabut. Hubungi pengelola.');
        activeUID = session.user.id;
        const fetchState = async () => {
          try {
            const result = await client.from('shared_state').select('*').eq('id', 'santripulang').single();
            if (token !== generation) return;
            if (result.error) throw result.error;
            const row = result.data;
            if (!row || row.schema_version !== 1 || !Number.isSafeInteger(row.revision) || row.revision < 0 ||
                (row.payload === null ? row.revision !== 0 : typeof row.payload !== 'object' || Array.isArray(row.payload)))
              throw new Error('Format data cloud tidak valid; data tidak ditimpa.');
            if (row.revision <= highest) return;
            receive({ revision: row.revision, state: row.payload }); highest = row.revision;
          } catch (error) { broken(error, token); }
        };
        refresh = fetchState;
        // Subscribe dahulu, kemudian fetch server: tidak ada celah initial fetch/subscription.
        // Event hanya invalidasi, bukan sumber data; setiap fetch tetap melalui RLS.
        channel = client.channel(`santripulang-${token}`).on('postgres_changes', {
          event: 'UPDATE', schema: 'public', table: 'shared_state', filter: 'id=eq.santripulang'
        }, () => { if (token === generation) void fetchState(); });
        channel.subscribe(status => {
          if (token !== generation) return;
          if (status === 'SUBSCRIBED') {
            void fetchState();
            if (!timer) timer = setInterval(() => void fetchState(), 15000);
          } else if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status)) {
            broken(new Error('Koneksi realtime terputus. Masuk kembali.'), token);
          }
        });
      } catch (error) { broken(error, token); }
    }
    return {
      async login(email, password) {
        const { error } = await client.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      },
      async logout() {
        stop(); locked('Anda telah keluar.');
        const { error } = await client.auth.signOut({ scope: 'local' });
        if (error) throw error;
      },
      watch(onData, onLocked) {
        authSub?.unsubscribe(); stop(); receive = onData; locked = onLocked;
        authSub = client.auth.onAuthStateChange((event, session) => {
          // Callback Auth sinkron: jangan await operasi SDK di dalam lock Auth.
          if (event === 'TOKEN_REFRESHED' && session?.user.id === activeUID) {
            const token = generation;
            setTimeout(() => {
              if (token === generation) void client.realtime.setAuth(session.access_token)
                .catch(error => broken(error, token));
            }, 0);
            return;
          }
          if (event === 'SIGNED_IN' && session?.user.id === activeUID) return;
          stop(); locked(session ? 'Memeriksa akses server…' : '');
          const token = generation;
          setTimeout(() => void start(session, token), 0);
        }).data.subscription;
        return () => { authSub?.unsubscribe(); authSub = null; stop(); receive = locked = () => {}; };
      },
      async save(state, expectedRevision) {
        const token = generation;
        if (!activeUID || highest < 0) throw new Error('Sesi admin belum siap. Masuk kembali.');
        if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) throw new Error('Revision tidak valid.');
        const payload = JSON.stringify(state);
        if (payload.length > 200000 || new TextEncoder().encode(payload).length > 700000)
          throw new Error('Data melebihi batas prototipe (200.000 karakter / 700 KB).');
        const { data, error } = await client.rpc('save_santripulang', { p_payload: state, p_expected_revision: expectedRevision });
        if (token !== generation) throw new Error('Sesi berubah. Periksa hasil server setelah masuk kembali.');
        if (error) {
          if (error.code === '42501') broken(error, token);
          else if (error.code === '40001') await refresh?.();
          throw error;
        }
        if (!Number.isSafeInteger(data) || data !== expectedRevision + 1) throw new Error('Revision server tidak valid.');
        // Fetch berikutnya boleh membawa revision yang sama agar UI menerima hasil server.
        return data;
      }
    };
  }
  globalThis.SantriPulangSupabase = Object.freeze({ create, validateConfig, message, VERSION });
})();
