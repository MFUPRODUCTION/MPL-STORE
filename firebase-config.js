// Konfigurasi web bersifat publik, bukan kredensial admin. Jangan isi service account.
globalThis.SantriPulangConfig = Object.freeze({
  useFirebase: true, // Ubah secara eksplisit menjadi true setelah mengikuti README.
  firebase: {
    apiKey: 'AIzaSyBF0IBbZeC0poZ34daUtv5Wk0TbhykHmcg',
    authDomain: 'pulangdarfik.firebaseapp.com',
    projectId: 'pulangdarfik',
    appId: '1:320896219742:web:1d5b1cf5c6dd1851ef52cf'
  }
});
