# Si MasDA — Pemulihan UI lengkap + bridge Vercel

Paket ini menggunakan `index.html` asli Si MasDA dari file sumber yang dikirimkan pengguna, sehingga halaman/komponen WhatsApp Gateway, Absensi QR, PPDB, laporan, pengaturan, dan menu asli tidak sengaja diganti dengan placeholder. `google.script.run` dijembatani ke `/api/masda`, lalu diteruskan ke Apps Script melalui `MASDA_GAS_URL`.

## Struktur
- `index.html`: HTML asli lengkap dengan shim `google.script.run`.
- `api/masda.js`: proxy Vercel ke Google Apps Script.
- `kode.gs`: salinan backend penuh dengan endpoint JSON RPC allowlist.
- `vercel.json`, `package.json`: konfigurasi deployment.

## Pemasangan dengan aman
1. Backup project Apps Script dan Google Sheets terlebih dahulu.
2. Review `kode.gs` ini terhadap kode produksi sebelum mengganti kode. Fungsi doGet lama tetap berada di file; doPost mendapat dukungan RPC allowlist.
3. Paste `kode.gs` ke project Apps Script yang sama, simpan, lalu Deploy > Manage deployments > Edit Web app > New version > Deploy. Pertahankan URL `/exec` yang digunakan Vercel.
4. Upload isi folder paket ke root repository GitHub. Pastikan `api/masda.js` berada di folder `api`. Jangan upload `kode.gs` ke repository publik; simpan hanya di Apps Script.
5. Pada Vercel, pastikan `MASDA_GAS_URL` berisi URL `/exec` deployment Apps Script. Redeploy frontend.
6. Uji login/logout, pemulihan sesi, semua modul, operasi tulis, QR kamera, dan WhatsApp gateway dengan data uji.

## Penting
- Paket ini memulihkan UI HTML asli, bukan mengubah semua komponen Bootstrap menjadi komponen Tabler murni. UI asli memiliki Bootstrap 5, Bootstrap Icons, chart, QR scanner, XLSX/PDF, dan Leaflet.
- Fungsi eksternal WhatsApp tetap membutuhkan token/provider valid yang diatur melalui aplikasi. QR scanner membutuhkan HTTPS dan izin kamera browser.
- Sintaks lokal tidak membuktikan integrasi produksi. Uji semua modul sebelum dipakai untuk data penting.
- Jangan memublikasikan `kode.gs`, token provider WhatsApp, atau kredensial.


## Fitur PWA dan navigasi smartphone (V5)

- Pada layar smartphone, navigasi bawah menampilkan ikon saja dan mengikuti menu yang diizinkan oleh RBAC akun yang sedang login.
- Sidebar/offcanvas lama tetap tersedia melalui tombol hamburger dan tetap digunakan pada tampilan desktop.
- PWA menggunakan `manifest.webmanifest`, `service-worker.js`, serta ikon di folder `icons/`.
- Deploy seluruh folder project ini ke Vercel pada domain HTTPS. Jangan memindahkan `manifest.webmanifest`, `service-worker.js`, atau folder `icons/` dari root project.
- Setelah deploy, buka URL aplikasi di Chrome Android. Tombol unduh pada header akan memanggil prompt instalasi jika browser sudah memenuhi kriteria; jika belum, ikuti menu Chrome (⋮) > Install app / Tambahkan ke layar utama.
- Data dan API siMADA tetap memerlukan koneksi internet. Service worker hanya menyimpan app shell dan aset PWA, bukan data pengguna, sesi, maupun respons API.
- Backend `kode.gs` dan database tidak diubah pada pembaruan ini.
