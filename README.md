# SantriPulang — ruang pengurus

Aplikasi statis berbahasa Indonesia, tanpa build. Direktori santri, absensi pulang/kembali, dashboard, filter, riwayat, periode liburan, RFID keyboard-wedge dan impor/ekspor CSV tetap tersedia. Mode lokal bawaan; Supabase Auth email/password dan Postgres bersama bersifat opsional.

**Belum terhubung atau diuji pada proyek nyata:** tidak ada URL/key/akun proyek yang diberikan. Pengujian Node memakai SDK/DOM tiruan dan pemeriksaan SQL statis, bukan database nyata. Tidak ada deployment atau migrasi otomatis dari penyimpanan lokal maupun integrasi cloud sebelumnya.

## Setup Supabase melalui dashboard

1. Buat **New project** di dashboard Supabase. Pilih organisasi, nama, region sesuai kebijakan data dan password database kuat. Tunggu proyek siap. Password database bukan password login aplikasi dan tidak boleh masuk frontend.
2. Buka **SQL Editor → New query**, tempel seluruh `supabase-schema.sql`, lalu **Run** sebagai `postgres`. Skrip transaksional dapat dijalankan ulang tanpa menghapus shared state atau admin. Skrip mengelola ulang semua policy pada dua tabel khusus aplikasi ini; jangan gunakan tabel tersebut untuk aplikasi lain. Jangan membuka RLS/public write untuk mengatasi error.
3. Buka **Authentication → Sign In / Providers** (pada beberapa versi dashboard: **Providers**). Aktifkan **Email**. Di pengaturan **User Signups**, matikan **Allow new users to sign up** / pendaftaran pengguna baru. Simpan. Tidak ada signup UI aplikasi; mematikan signup juga mencegah registrasi langsung melalui Auth API. Pengaturan konfirmasi email bukan pengganti larangan signup.
4. Buka **Authentication → Users → Add user → Create new user**, masukkan email dan password pengurus. Aktifkan **Auto Confirm User / Email confirmed**, lalu buat akun langsung (bukan Invite user). Periksa detail pengguna bahwa email sudah confirmed. Bila dashboard tidak menawarkan konfirmasi otomatis, konfirmasikan email melalui alur konfirmasi yang tersedia sebelum login; jangan menaruh Admin API secret di browser. Akun baru dibuat pengelola, bukan melalui aplikasi.
5. Salin **User UID** dari detail akun Auth, bukan email. Di SQL Editor jalankan contoh berikut setelah mengganti placeholder dengan UUID akun tadi. Placeholder sengaja bukan UUID valid agar tidak memberi izin ke akun contoh:

   ```sql
   insert into public.admins(user_id)
   values ('GANTI_DENGAN_UID_DARI_AUTH_USERS'::uuid)
   on conflict (user_id) do nothing;
   ```

   Ulangi manual untuk setiap pengurus. Akun Auth tanpa baris allowlist tidak dapat membaca/menulis data. Untuk mencabut izin:

   ```sql
   delete from public.admins
   where user_id = 'GANTI_DENGAN_UID_YANG_DICABUT'::uuid;
   ```

   Bila perlu ban/hapus akun di Authentication juga. Batasi akses dashboard/SQL Editor karena operator proyek dapat melewati RLS.
6. Ambil **Project URL** dari dialog **Connect** atau **Project Settings → Data API**, serta **Publishable key** (`sb_publishable_…`) dari **Project Settings → API Keys**. Legacy **anon** JWT juga didukung. Isi `supabase.url` dan `supabase.anonKey` di `supabase-config.js`, kemudian ubah `useSupabase: false` ke `true`. Key tersebut publik; keamanan berada di Auth, privileges, RLS dan RPC. **Jangan pernah gunakan `service_role`, `sb_secret_…`, password database, password pengguna atau private key di berkas/frontend.** Validator menolak secret dan JWT selain role anon.
7. **Authentication → URL Configuration**: isi **Site URL** dengan URL produksi lengkap, misalnya `https://nama-proyek.vercel.app`. Tambahkan URL yang benar-benar digunakan pada **Redirect URLs**, misalnya `https://nama-proyek.vercel.app/**` dan untuk pengujian `http://localhost:8000/**`. Tambahkan domain kustom/preview secara sengaja; hindari wildcard lintas proyek. Login password aplikasi tidak memerlukan redirect, tetapi URL ini penting untuk alur email yang dikelola proyek. Aplikasi tidak memproses token dari URL atau menyediakan UI reset password.
8. Sajikan lewat HTTPS atau `http://localhost:8000` (`python -m http.server 8000`), bukan `file://`. SDK diimpor dinamis hanya dalam mode Supabase dari `https://esm.sh/@supabase/supabase-js@2.49.8`. Izinkan CDN, HTTPS API proyek, dan WSS realtime dalam jaringan/CSP.
9. Masuk dengan email/password pengurus. Shared state awal kosong (revision 0), dibuat SQL, bukan dengan menyalin localStorage. Jika konfigurasi, SDK, izin atau koneksi gagal, aplikasi tetap terkunci tanpa fallback lokal.

## Deploy statis ke Vercel

Gunakan preset **Other**, tanpa build command, output directory **`.`**, root directory folder sumber aplikasi. Sajikan `index.html`, `style.css`, `app.js`, `supabase-config.js`, `supabase-service.js`. SQL/docs/tests bukan rahasia tetapi tidak wajib dihosting. Environment variables Vercel **tidak otomatis menggantikan nilai JavaScript statis**. Edit konfigurasi publik pada sumber produksi lalu **redeploy**; perubahan file lokal tidak mengubah deployment yang sudah aktif. Sesuaikan Site URL/Redirect URLs setelah domain final tersedia. Tidak ada backend Vercel yang diperlukan. Jangan unggah arsip sebagai pengganti berkas yang telah diekstrak.

## Otorisasi, konflik dan batas cloud

- `public.admins`: authenticated hanya boleh SELECT baris UID sendiri. Anon tidak mendapat privilege. Klien, bahkan admin, tidak mendapat INSERT/UPDATE/DELETE/TRUNCATE atau policy untuk memberi admin. Provisioning hanya melalui konsol tepercaya.
- `public.shared_state`: authenticated admin boleh SELECT; nonadmin tidak mendapat baris. Tidak ada privilege/policy mutasi langsung. Semua save melalui `save_santripulang(jsonb,bigint)`. EXECUTE dicabut dari PUBLIC/anon, diberikan hanya authenticated; fungsi SECURITY DEFINER milik postgres memakai `search_path = ''`, referensi schema eksplisit, dan memeriksa `auth.uid()` terhadap allowlist di dalam fungsi. UPDATE membandingkan revision secara atomik, menaikkan tepat satu, serta mengisi UID/waktu server. Dua save revision sama: satu sukses, lainnya error `40001`; tidak ada penimpaan last-write-wins atau retry diam-diam.
- Skrip menambahkan tabel shared ke publication `supabase_realtime` secara idempoten. Adapter memasang token Auth sebelum subscribe, memperbaruinya saat refresh token, dan melakukan fetch melalui RLS **setelah SUBSCRIBED**. Event hanya memicu fetch server. Respons fetch tidak berurutan/revision lama diabaikan oleh adapter dan UI. Pemeriksaan ulang 15 detik mendeteksi pencabutan admin meski tidak ada perubahan data; DELETE admin tidak diandalkan sebagai event realtime. Error channel/fetch mengunci UI. Ini bukan janji pencabutan instan ketika perangkat offline atau timer browser dibatasi.
- Auth menggunakan `persistSession: false`, tanpa deteksi sesi URL; cloud data hanya di memori, tidak ditulis ke localStorage/IndexedDB atau cache offline aplikasi. Reload meminta login lagi. Logout/pergantian akun/unsubscribe menghentikan channel/timer; callback sesi lama diabaikan. UI membersihkan data, dialog, formulir dan pratinjau. Refresh token memakai callback Auth sinkron dengan pekerjaan SDK ditunda agar tidak deadlock. Logout bukan penghapusan CSV yang telah diunduh atau jaminan penghapusan forensik memori browser.
- Seluruh jalur mutasi menunggu save; satu save per tab. Form edit/absensi/pengaturan menangkap revision ketika dibuka. Konflik meminta buka ulang dan periksa data terbaru; impor divalidasi ulang saat konfirmasi. Transaksi yang sudah terkirim sebelum logout mungkin telah commit: periksa hasil setelah masuk lagi. Tidak ada antrean offline.
- Prototipe menyimpan **seluruh JSON dalam satu baris**, batas **200.000 karakter / 700.000 byte UTF-8** pada UI dan representasi `jsonb::text` server (spasi format database ikut dihitung sehingga server dapat menolak lebih awal). Batas impor 5.000 baris bukan jaminan kapasitas cloud; log juga memperbesar state. Semua admin dipercaya mengelola seluruh data dan dapat mengubah JSON/log melalui RPC di luar UI. SQL memvalidasi envelope/ukuran, **bukan semua aturan domain**. JSON domain rusak mengunci pembacaan UI tanpa menimpa data; perbaikan harus melalui operator tepercaya.
- **Bukan siap produksi berskala besar**: tidak ada role granular, isolasi tenant, audit tahan manipulasi, backup otomatis aplikasi, MFA aplikasi atau jaminan kepatuhan privasi. Perlu normalisasi tabel, pagination, transaksi domain, retensi, backup teruji, pengawasan biaya/kuota dan kontrol perangkat sebelum penggunaan nyata. Seluruh admin proyek berbagi PII santri/wali. Waktu absensi mengikuti perangkat; `updated_at` mengikuti server.
- Mode cloud tidak membaca/menulis kunci lokal. Tidak ada migrasi otomatis. Impor CSV hanya atas pilihan dan konfirmasi admin. Untuk kembali lokal, set `useSupabase: false` dan reload; data lokal origin lama tetap ada.

## Mode lokal opsional

Default `useSupabase: false`, tidak memuat SDK jaringan. Gunakan browser modern dengan Web Crypto, dialog, inert dan structuredClone pada localhost/HTTPS. Buat password minimal 10 karakter, ulangi, lalu masuk. PBKDF2-HMAC-SHA-256 memakai 310.000 iterasi dan salt acak 16 byte; sesi hanya memori. Tanpa Web Crypto login ditolak, bukan diganti hash lemah.

Login lokal hanya penghalang UI demo, bukan enkripsi atau otorisasi server. Data tersimpan pada browser/profil/origin yang sama di `santripulang-v1`, hash terpisah di `santripulang-admin-v1`. Orang dengan akses perangkat/devtools dapat melewatinya. Lupa/rusak password: pemilik perangkat dapat menghapus **hanya** `santripulang-admin-v1` lewat alat pengembang lalu reload; jangan hapus data santri. Backup data lebih dulu. Gunakan satu tab aktif; perubahan storage di tab lain mengunci dan meminta reload, bukan transaksi lintas-tab yang andal. Data rusak atau quota penuh memblokir/gagalkan penulisan tanpa menimpa data lama.

## Santri, periode, CSV dan RFID

- Tambah/edit nama, NIS, kelas, asrama, wali, telepon dan RFID opsional. NIS unik tanpa membedakan kapital; edit menjaga status/log, hapus santri menjaga log lama. Data lama tanpa RFID tetap didukung.
- Atur identitas pondok dan periode liburan. Reset status ditolak jika masih ada santri liburan; reset menjaga riwayat. Hindari mengganti periode di tengah transaksi.
- Header CSV UTF-8 koma harus `NIS,Nama,Kelas,Asrama,Wali,Telepon,RFID`. Enam kolom pertama wajib, RFID boleh kosong. Batas panjang 30/100/30/60/100/25/64; berkas maksimal 2 MB dan 5.000 baris. BOM, CRLF/LF, kutipan ganda, koma dan newline dalam sel berkutip didukung; titik koma tidak. NIS/RFID duplikat, CSV rusak atau kolom salah menolak seluruh impor.
- Template, ekspor data tujuh kolom, pratinjau maksimal 20 santri dan konfirmasi **Impor semua** tersedia. Tidak ada perubahan sebelum konfirmasi. Impor menambah santri berstatus Belum pulang, bukan update NIS lama. Nomor error berdasarkan record data nonkosong; maksimal 100 error ditampilkan. Batal/logout membatalkan pratinjau yang sedang dibaca.
- Ekspor dashboard/riwayat adalah laporan, bukan format impor. Ekspor data tidak memuat status/log/pengaturan: **bukan backup lengkap**. Apostrof melindungi formula spreadsheet, termasuk nilai yang sudah diawali apostrof; impor melepas satu lapisan pelindung. CSV eksternal/ekspor lama dapat ambigu, periksa pratinjau. Perlakukan NIS, telepon dan RFID sebagai teks agar nol awal terjaga. Lindungi semua unduhan berisi PII.
- Scanner RFID harus keyboard-wedge berakhiran Enter. Petakan lewat Data santri → Edit → RFID, periksa nomor, klik Simpan; Enter pada pemetaan tidak menyimpan otomatis. Nomor menjadi kapital, hanya A–Z/0–9/`-`/`_`, maksimal 64, unik, nol awal terjaga. Tidak ada akses USB/serial/vendor API khusus.
- Pilih mode Kepulangan/Kedatangan, fokuskan kolom scan. Kartu dikenal membuka konfirmasi identitas, waktu, penjemput/pengantar dan catatan; Enter scanner tidak langsung menyetujui. Batal tidak menyimpan. Mode tidak beralih otomatis; scan berulang kegiatan sama ditolak. Pulang hanya dari Belum pulang, kembali hanya dari Sedang liburan. Tombol manual tetap tersedia. Waktu tidak boleh mendahului pulang atau di masa depan (toleransi satu menit).
- RFID adalah pencocokan nomor, bukan autentikasi kartu atau bukti kehadiran; periksa fisik santri dan fokus input. Jam/zona waktu dari perangkat.

## Verifikasi

```text
node --check app.js
node --check supabase-config.js
node --check supabase-service.js
node --check tests.cjs
node --check supabase-tests.cjs
node tests.cjs
node supabase-tests.cjs
```

Uji lama tetap menjalankan parser/validasi CSV, RFID, transisi, hash dan VM UI termasuk isolasi lokal/cloud serta logout saat save/impor. Uji Supabase menggunakan SDK tiruan untuk konfigurasi, token, fetch awal, stale revision, konflik, batas ukuran, nonadmin, pencabutan, logout dan cleanup. Pemeriksaan SQL statis **tidak membuktikan SQL dapat dieksekusi atau RLS ter-deploy**.

Setelah setup nyata, wajib uji dua akun admin/browser, akun nonadmin, password salah, anonim, save serentak/dialog stale, reconnect, token refresh, logout saat save/impor dan pencabutan allowlist. Uji API langsung: anonim/nonadmin ditolak; admin tidak dapat mutasi admins/shared secara langsung; RPC nonadmin/oversize/revision stale ditolak; admin valid dapat save. Jalankan SQL dua kali dan pastikan data/admin tetap utuh. Uji layout mobile, native dialog/download, scanner fisik, CSV salah/batal, quota lokal dan pergantian tab. Semua pengujian live/browser tersebut belum dilakukan.

## Berkas dan arsip

Sumber: `index.html`, `style.css`, `app.js`, `supabase-config.js`, `supabase-service.js`, `supabase-schema.sql`, `tests.cjs`, `supabase-tests.cjs`, `README.md`. `package.ps1` memperbarui folder distribusi `SantriPulang/` dan `SantriPulang.zip` dari daftar eksplisit ini, tanpa arsip bersarang, password/data pengguna atau berkas integrasi lama. Jalankan `powershell -ExecutionPolicy Bypass -File ./package.ps1` setelah perubahan sumber. Tidak ada dependensi npm atau lockfile yang diperlukan.
