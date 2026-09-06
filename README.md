# SantriPulang — ruang pengurus

Aplikasi absensi liburan berbahasa Indonesia tanpa build. Mendukung **mode lokal bawaan** dan **mode Firebase opsional** (Authentication email/password serta Firestore bersama). Mode lokal tidak memuat SDK jaringan; mode Firebase menggunakan SDK modular CDN versi tetap **11.10.0**. Mendukung direktori santri, RFID, CSV, riwayat, dan pengaturan periode.

## Firebase dan deployment Vercel (opsional)

**Belum diuji terhubung ke proyek nyata: tidak ada proyek/kredensial yang diberikan. Tidak ada deployment yang dilakukan.** Kode integrasi nyata tersedia, tetapi pengujian otomatis menggunakan SDK tiruan, bukan layanan Firebase atau emulator rules.

1. Buat proyek Firebase dan daftarkan aplikasi **Web**. Salin konfigurasi web dari Project settings → Your apps ke objek `firebase` di **`firebase-config.js`** (`apiKey`, `authDomain`, `projectId`, `appId`). Konfigurasi web akan publik di browser; bukan rahasia otorisasi. **Jangan pernah menaruh service-account JSON, private key, sandi pengguna, atau token admin di folder ini/Vercel frontend.**
2. Authentication → Sign-in method: aktifkan **Email/Password**, bukan hanya email-link. Authentication → Users → **Add user**: buat email dan kata sandi pengurus secara manual; salin UID-nya. Aplikasi tidak menawarkan signup cloud. Kebijakan sandi mengikuti proyek Firebase (minimum 10 karakter hanya berlaku pada mode lokal).
3. Buat database **Cloud Firestore default**, pilih lokasi sesuai kebijakan data, mulai dengan mode terkunci/production. Di Firestore → Rules, salin seluruh **`firestore.rules`** lalu **Publish** sebelum membuka akses aplikasi. Jangan gunakan rules test mode/public.
4. Lewat **Firestore Console tepercaya**, buat collection `admins`, document ID **UID persis** dari Authentication. Boleh isi `label` berupa nama peran nonrahasia; keberadaan dokumen adalah izin. Ulangi manual untuk setiap pengurus. Akun Auth saja tidak cukup. Klien dilarang membuat/mengubah/menghapus/mendaftar dokumen admin, termasuk UID sendiri; tidak ada self-grant. Konsol/Admin SDK melewati rules berdasarkan IAM: batasi akses pengelola proyek. Untuk mencabut izin, hapus dokumen admin; bila perlu nonaktifkan akun Auth juga.
5. Ubah **`useFirebase: false` menjadi `useFirebase: true`** secara eksplisit. Sajikan melalui localhost/HTTPS, bukan membuka `file://`. Konfigurasi hilang/salah atau SDK tidak termuat menampilkan layar setup/error, tanpa fallback lokal. Selesaikan konfigurasi lalu muat ulang.
6. Deploy folder sebagai situs statis di Vercel: preset **Other**, tanpa build command, output directory **`.`** / root folder aplikasi. Tidak diperlukan environment variable atau backend Vercel; environment variable tidak otomatis masuk ke JavaScript statis ini. `index.html`, `style.css`, `app.js`, `firebase-config.js`, `firebase-service.js` harus tersedia pada origin yang sama. README/rules/tests bukan rahasia, tetapi boleh dikecualikan dari hosting.
7. Firebase Authentication → Settings → **Authorized domains**: tambahkan hostname Vercel yang benar (`nama-proyek.vercel.app`, tanpa `https://`/path), domain kustom, dan `localhost` untuk pengujian bila belum ada. Domain preview berbeda harus ditambahkan secara sengaja; jangan menganggap wildcard otomatis didukung. Pastikan CDN `www.gstatic.com` dan endpoint Firebase tidak diblokir jaringan/CSP.
8. Masuk dengan email/password yang dibuat tadi. Dokumen **`shared/santripulang`** dibuat oleh penyimpanan pertama admin, bukan dengan mengimpor localStorage. Perangkat admin lain pada proyek sama menerima pembaruan lewat subscription. Jika kosong, antarmuka menampilkan data kosong; ini tidak menghapus data lokal.

### Isolasi, konflik, dan batas keamanan cloud

- Mode Firebase tidak membaca/menulis kedua kunci localStorage lama, tidak mengunggah PII lokal otomatis, dan tidak beralih ke mode lokal ketika akses gagal. Impor CSV tetap tersedia **hanya bila dipilih dan dikonfirmasi secara sengaja** oleh admin. Kembali ke mode lokal harus mengubah konfigurasi menjadi `false` dan memuat ulang; data lokal sebelumnya tetap ada pada origin semula.
- Auth dan cache Firestore hanya **memori**, tanpa persistensi offline/IndexedDB. Muat ulang meminta login. Logout/pergantian akun/error subscription mengosongkan state, tabel, formulir, pratinjau CSV, pesan dan dialog cloud; listener lama dihentikan dan callback sesi lama diabaikan. Snapshot cache tidak membuka data; koneksi server dibutuhkan. Deteksi putus jaringan/pencabutan izin mengikuti callback SDK, bukan janji penghapusan instan pada perangkat offline. Logout bukan penghapusan file CSV yang sudah diunduh atau jaminan forensik memori browser.
- Semua tujuh jalur mutasi menunggu hasil save. Satu simpan per tab pada satu waktu. Firestore transaction membandingkan revision snapshot dengan revision server; konflik ditolak, termasuk saat SDK mencoba ulang transaksi. Tidak ada last-write-wins diam-diam. Form edit/absensi/pengaturan menyimpan revision saat dibuka; jika stale, buka ulang dan periksa sebelum menyimpan. Impor divalidasi ulang terhadap state terkini. Tidak ada antrean penyimpanan offline. Transaksi yang telah dikirim tepat sebelum logout mungkin sudah commit: setelah login periksa hasil, jangan menganggap logout membatalkan commit server.
- Prototipe menyimpan seluruh state sebagai **JSON string `payload`** dalam satu dokumen, bersama `schema`, `revision`, `updatedBy`, `updatedAt`. Batas aplikasi **200.000 karakter dan 700.000 byte UTF-8**; rules membatasi payload 200.000 karakter. Firestore membatasi dokumen 1 MiB termasuk overhead. Batas impor 5.000 baris bukan kapasitas cloud yang dijamin; riwayat ikut memperbesar dokumen. Penulisan gagal tidak dianggap sukses. Untuk skala besar perlu pemisahan collection/dokumen, pagination, indeks, transaksi domain, retensi dan migrasi terencana—**bukan siap produksi skala besar**.
- Rules menolak anonim/nonadmin, self-grant admin, akses ke path lain, penghapusan dokumen shared, envelope salah dan revision yang tidak naik satu. **Rules tidak memvalidasi isi JSON/domain**: admin tepercaya dapat memodifikasi seluruh data termasuk log melalui klien lain. Validasi UI bukan batas keamanan terhadap admin jahat. Tidak ada audit tahan manipulasi, role granular, tenant terpisah, MFA aplikasi, backup otomatis, atau jaminan kepatuhan privasi. Semua admin di satu proyek berbagi seluruh PII. `updatedAt` dari server untuk penulisan; waktu absensi tetap waktu perangkat. Terapkan minimisasi data, kontrol IAM, perlindungan perangkat/ekspor, backup, retensi, pemantauan biaya/kuota dan kebijakan persetujuan sebelum penggunaan nyata.

### Verifikasi proyek setelah setup

Uji dengan dua browser/admin: tambah/edit/impor/absensi/reset, subscription, dialog stale, simpan serentak (satu ditolak), jaringan putus, logout saat save/impor, login akun berbeda, password salah dan akun nonadmin. Pastikan data lokal tidak muncul di cloud dan kembali utuh saat mode lokal diaktifkan lagi. Di Rules Playground/emulator, uji anonim ditolak, nonadmin ditolak, admin dapat get/create/update valid, create/update/delete `admins/{uid}` ditolak bahkan untuk admin, path lain/list/delete shared ditolak, revision/envelope invalid ditolak. Pengujian ini **belum dijalankan** terhadap proyek nyata; SDK mock tidak membuktikan rules ter-deploy.

## Menjalankan dan menyiapkan admin lokal

1. Sajikan folder ini melalui server statis, misalnya `python -m http.server 8000`, lalu buka `http://localhost:8000`. Gunakan browser modern yang mendukung Web Crypto, dialog, inert, dan structuredClone.
2. Pada penggunaan pertama, buat kata sandi minimal 10 karakter dan ulangi. Selanjutnya masuk dengan kata sandi tersebut.
3. Kata sandi tidak disimpan sebagai teks biasa: PBKDF2-HMAC-SHA-256, 310.000 iterasi, salt acak 16 byte, hash 256 bit melalui Web Crypto. Bila Web Crypto tidak tersedia, setup/login ditolak tanpa fallback hash lemah. Gunakan localhost atau HTTPS; `file://` dan HTTP alamat LAN tidak dijamin mendukungnya.
4. Sesi hanya berada di memori tab. Muat ulang atau tombol **Keluar** mengharuskan login lagi. Tidak ada opsi ingat login, masa kedaluwarsa otomatis, atau akun multiadmin.
5. Atur nama pondok, periode, tanggal mulai, dan batas kembali di **Pengaturan liburan**.

**Ini login demo lokal, bukan keamanan produksi.** Orang yang dapat mengakses browser, berkas aplikasi, atau alat pengembang dapat membaca/mengubah data maupun melewati login. Hash bukan enkripsi data, bukan otorisasi server, dan tidak melindungi dari brute-force offline. Tidak ada backend, pembatasan percobaan login yang kuat, audit tahan manipulasi, atau kontrol akses berbasis peran. Jangan gunakan kata sandi yang digunakan pada akun penting.

Jika lupa kata sandi, tidak ada pemulihan identitas. Pemilik perangkat dapat menghapus **hanya** kunci `santripulang-admin-v1` melalui alat pengembang penyimpanan lokal lalu memuat ulang untuk setup kembali. Jangan menghapus `santripulang-v1`. Kemudahan reset ini juga menunjukkan batas keamanan demo. Jika konfigurasi admin rusak, lakukan pemulihan yang sama setelah mengamankan data.

## Data santri dan CSV

- **Tambah santri** atau **Edit** untuk nama, NIS, kelas, asrama, wali, telepon, serta RFID opsional. NIS unik tanpa membedakan huruf besar/kecil. Mengedit identitas mempertahankan status dan riwayat. Menghapus santri tetap mempertahankan riwayat lama.
- **Data santri → Template CSV** mengunduh contoh. Hapus/ganti baris contoh sebelum impor.
- Format UTF-8 dengan pemisah koma, header berurutan: `NIS,Nama,Kelas,Asrama,Wali,Telepon,RFID`. Enam kolom pertama wajib; kolom RFID boleh kosong, tetapi tetap harus ada. Maksimal panjang berturut-turut 30, 100, 30, 60, 100, 25, 64 karakter.
- Parser mendukung BOM, LF/CRLF, koma/baris baru dalam kutipan, dan kutipan ganda yang ditulis `""`. CSV dengan kutipan tidak tertutup, karakter setelah penutup kutipan, atau jumlah kolom salah ditolak. Baris kosong diabaikan. Pemisah titik koma tidak didukung; simpan ulang sebagai CSV koma.
- Batas berkas 2 MB, maksimal 5.000 baris data per impor. Nomor baris pada hasil adalah urutan record data nonkosong, bukan nomor baris fisik ketika ada sel multiline.
- Impor memvalidasi seluruh berkas: kolom wajib, panjang, format kartu, duplikat NIS dan RFID terhadap data lama maupun sesama baris. Kesalahan menolak **seluruh impor**, tidak ada penyimpanan sebagian. Hasil menampilkan maksimal 100 kesalahan.
- Jika valid, pratinjau menampilkan jumlah dan maksimal 20 santri. Klik **Impor semua** untuk menyimpan; Batal/tutup tidak mengubah data. Validasi diulang saat konfirmasi, lalu satu penulisan localStorage dilakukan. Santri baru berstatus **Belum pulang**; data lama dan riwayat tidak ditimpa. Impor tidak meng-update NIS yang sudah ada.
- **Ekspor data** menghasilkan tujuh kolom yang dapat diimpor ke penyimpanan kosong. Ekspor dashboard dan riwayat tetap berupa **laporan**, bukan format impor. Ekspor data tidak memuat status, log atau pengaturan: bukan cadangan penuh.
- Sel ekspor yang berpotensi formula spreadsheet diberi apostrof pelindung. Apostrof di awal nilai asli juga digandakan sehingga ekspor baru dapat diimpor tanpa kehilangan apostrof. Impor melepas satu apostrof sebelum apostrof lain atau awalan `=`, `+`, `-`, `@`. CSV eksternal/ekspor versi lama dengan pola tersebut tetap ambigu; periksa pratinjau. Perlakukan kolom NIS, telepon dan RFID sebagai teks di spreadsheet agar nol awal tidak hilang. Tidak ada validasi nomor telepon operator atau pembuktian identitas wali.
- Baris kosong fisik diabaikan, tetapi record eksplisit seperti `,,,,,,` divalidasi dan ditolak karena kolom wajib kosong. Pembacaan impor yang sudah dibatalkan/logout tidak boleh membuka kembali pratinjau.

## RFID keyboard-wedge

1. Gunakan scanner yang mengetik ID kartu seperti keyboard dan mengirim **Enter** sebagai akhiran. Tidak memerlukan akses USB khusus. Scanner dengan protokol serial, API vendor, atau akhiran Tab saja tidak didukung otomatis.
2. Di **Data santri → Edit**, fokuskan kolom RFID, pindai kartu, periksa nomor, lalu klik **Simpan santri**. Enter pada kolom ini tidak menyimpan formulir otomatis. Kosongkan nomor untuk melepas pemetaan atau ganti untuk kartu baru.
3. Nomor kartu disimpan sebagai teks, spasi tepi dibuang, huruf menjadi kapital. Hanya huruf A–Z, angka, `-` dan `_`, maksimal 64 karakter. Nol awal dipertahankan. Satu kartu hanya untuk satu santri.
4. Di dashboard pilih **Kepulangan** atau **Kedatangan kembali**. Fokuskan kolom nomor kartu sebelum memindai. Tidak ada perekaman tombol global saat mengetik kolom lain. Nomor juga boleh diketik manual lalu klik **Periksa kartu**.
5. Kartu dikenal membuka dialog berisi identitas dan kegiatan. Periksa santri secara fisik, waktu, penjemput/pengantar serta catatan; klik **Konfirmasi absensi**. Scan sendiri tidak menyimpan absensi. Enter dari scanner pada kolom dialog tidak mengonfirmasi otomatis. Tutup/Escape/Batal tidak menyimpan.
6. Kepulangan hanya untuk status **Belum pulang**, kedatangan hanya untuk **Sedang liburan**. Kartu tidak dikenal, pemetaan ambigu, kedatangan sebelum pulang, atau scan ulang kegiatan yang telah dicatat ditolak dengan pesan. Setelah sukses kolom scan kembali fokus. Mode tidak beralih otomatis, sehingga scan pulang berulang tidak menjadi catatan kembali. Pilih arah kegiatan berikutnya secara sengaja.
7. Tombol manual **Pulang/Kembali** tetap tersedia. Status diperiksa lagi saat konfirmasi; klik konfirmasi berulang tidak menambah log kedua. Jam tidak boleh di masa depan (toleransi satu menit), dan kembali tidak boleh sebelum pulang.

RFID hanyalah pencocokan nomor input, bukan autentikasi kartu, bukti kehadiran, pembaca kriptografis, atau perlindungan kartu kloning. Scanner dapat mengetik ke kolom yang salah jika fokus tidak tepat; selalu periksa dialog.

## Periode, kompatibilitas, dan penyimpanan lokal

- Kunci lama **`santripulang-v1`** dan struktur `students`, `logs`, `settings` dipertahankan. Data lama tanpa `rfid` tetap bekerja sebagai belum dipetakan. ID, status, waktu dan riwayat tidak di-reset oleh setup admin. Kredensial disimpan terpisah pada `santripulang-admin-v1`.
- Data hanya ada pada browser, profil, perangkat, dan origin yang sama (skema/host/port). Beralih dari file lokal ke localhost atau mengganti port tidak memindahkan data otomatis. Sebelum pindah, simpan salinan JSON kunci lama secara aman melalui alat pengembang; tidak tersedia antarmuka impor cadangan JSON.
- Data lokal tidak terbaca/rusak atau penyimpanan gagal: penulisan diblokir atau gagal dengan pesan tanpa sengaja menimpa data lama. Jangan menghapus penyimpanan browser tanpa cadangan. Mode privat, kuota penuh, atau kebijakan browser dapat menghalangi penyimpanan.
- Gunakan **satu tab pengurus aktif**. Perubahan penyimpanan di tab lain mengunci sesi dan meminta muat ulang. Ini bukan transaksi database/lintas-tab; perubahan serentak yang sangat dekat tetap dapat berlomba. Tidak ada sinkronisasi antardevice, backup otomatis, atau deteksi konflik multiuser yang andal.
- Untuk periode baru, selesaikan santri yang masih liburan, simpan pengaturan periode baru, lalu **Reset status absensi**. Semua status menjadi Belum pulang; riwayat tetap ada. Reset ditolak saat ada santri Sedang liburan. Jangan mengubah periode di tengah transaksi bila ingin label riwayat konsisten.
- Waktu mengikuti jam/zona perangkat, bukan server. Lindungi perangkat serta berkas ekspor yang memuat data pribadi santri/wali. Produksi memerlukan backend, database, autentikasi/otorisasi server, HTTPS, audit, backup, pengelolaan sesi dan kebijakan privasi yang sesuai.

## Pemeriksaan dan berkas

Jalankan dari folder aplikasi:

```text
node --check app.js
node --check tests.cjs
node tests.cjs
node --check firebase-config.js
node --check firebase-service.js
node --check firebase-tests.cjs
node firebase-tests.cjs
```

`tests.cjs` mempertahankan uji fungsi aktual parser CSV, validasi, duplikat, normalisasi RFID, transisi status dan hash Web Crypto. Selain itu seluruh `app.js` dijalankan dalam VM dengan DOM/penyimpanan minimal untuk menguji inisialisasi tanpa WebCrypto, validasi data lama, escaping, ekspor–impor, pembatalan setup saat perubahan tab, kegagalan impor setelah logout, penolakan modal bertumpuk, serta waktu kembali dalam menit yang sama. DOM tiruan tidak menguji perilaku native dialog, validasi formulir browser, unduhan, layout, aksesibilitas, file-origin atau scanner fisik. Pemeriksaan browser manual yang disarankan: setup/login salah/benar/logout, muat data lama, scan-batal/scan-konfirmasi/scan ulang, edit kartu duplikat, CSV salah/valid/batal, penyimpanan penuh, tab lain, dan layar ponsel.

Data tersimpan diperiksa sebelum render: record null, ID ganda, tipe kolom salah, waktu rusak, dan status tidak dikenal memblokir penulisan tanpa mengganti salinan lokal. Pengaturan lama yang belum lengkap diberi nilai default di memori; RFID yang belum ada tetap kosong. Waktu default kedatangan mempertahankan detik/milidetik kepulangan jika masih dalam menit yang sama. Ketidaktersediaan WebCrypto tetap memblokir login, bukan diganti hash lemah; petunjuk localhost juga tersedia di layar login.

- `index.html`: struktur antarmuka dan dialog.
- `style.css`: desain responsif tanpa font daring.
- `app.js`: mode lokal/cloud, login, absensi, RFID, CSV dan penyimpanan asinkron.
- `firebase-config.js`: template konfigurasi publik, mode lokal bawaan.
- `firebase-service.js`: helper global `SantriPulangFirebase` dengan `create`, `validateConfig`, `message`, `VERSION`; Auth, listener dan transaction Firebase modular.
- `firestore.rules`: otorisasi allowlist manual dan validasi envelope/revision.
- `firebase-tests.cjs`: uji integrasi SDK tiruan tanpa kredensial/dependensi.
- `tests.cjs`: pengujian Node tanpa paket tambahan.
- `README.md`: petunjuk dan batasan.
- `SantriPulang.zip`: arsip sembilan berkas sumber/dokumentasi/uji di atas, tanpa arsip bersarang, data localStorage atau kata sandi pengguna.
