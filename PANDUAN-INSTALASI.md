# Panduan Instalasi v2 — Supervisi Guru SMA Triguna 1956
**Backend: Google Apps Script (REST API) · Frontend: GitHub Pages**

```
GitHub Pages (situs ini)                Google Apps Script (Kode.gs)
index.html · css/ · js/      fetch()    doGet  ?action=public|ping
js/config.js → GAS_URL  ───────────▶    doPost {action, token, payload}
                                        Google Sheets · Drive · Cache
```

---

## BAGIAN 1 — Backend (Google Apps Script)

### Jika Anda SUDAH memakai versi 1 (proyek & data sudah ada)
Data di Spreadsheet tetap dipakai. Tidak perlu setup ulang.
1. Buka proyek Apps Script yang lama.
2. Ganti **seluruh** isi `Kode` dengan **Kode.gs** versi 2.
3. *(Opsional)* Ganti isi `appsscript.json` dengan versi 2 (Project Settings → centang *Show "appsscript.json"*).
4. *(Opsional, merapikan)* Hapus file `Index`, `Stylesheet`, `JS1`–`JS4` karena sudah tidak dipakai.
5. **Deploy → Manage deployments → ✏ Edit → Version: New version → Deploy.** URL `/exec` tetap sama.

### Jika ini instalasi BARU
1. https://script.google.com → **Proyek baru** → ganti nama `Code.gs` menjadi `Kode` → tempel **Kode.gs**.
2. Pilih fungsi **`setupAppEnvironment`** → ▶ **Run** → izinkan akses.
3. Catat dari **Execution log**: username `admin` + **password sementara**.
4. **Deploy → New deployment → Web app** · *Execute as*: **Me** · *Who has access*: **Anyone** → **Deploy**.
5. *(Opsional)* Jalankan `isiDataContoh` untuk akun percobaan (`kepsek`, `guru1`… password `Contoh2026`).

### Uji backend (wajib sebelum lanjut)
Buka di browser: `URL_EXEC_ANDA?action=ping`
Harus tampil JSON seperti: `{"ok":true,"data":{"app":"Supervisi Guru","version":"2.0.0",…}}`
- Bila yang muncul halaman login Google → deployment belum **Anyone**.
- Bila `version` masih bukan 2.0.0 → belum membuat **New version**.

---

## BAGIAN 2 — Frontend (GitHub Pages)

### 2.1 Isi alamat server
Buka **`js/config.js`** dengan Notepad/VS Code, ganti:
```js
GAS_URL: 'https://script.google.com/macros/s/XXXX/exec',
```
dengan URL `/exec` Anda (salin utuh, termasuk `https://` dan `/exec`). Simpan.

### 2.2 Folder yang di-upload
Folder hasil ekstrak ZIP **`supervisi-guru-web`** adalah folder yang di-`git init`. Isinya harus terlihat seperti ini (perintah `dir`):
```
index.html        ← WAJIB di baris teratas folder ini
.nojekyll
README.md
PANDUAN-INSTALASI.md
css\style.css
js\config.js  js\core.js  js\app.js  js\penilai.js  js\guru.js  js\admin.js  js\boot.js
```
**Jangan** memasukkan `Kode.gs` ke folder ini.

### 2.3 Push ke GitHub (ringkas — dipandu langkah demi langkah di percakapan)
```bash
git init
git add .
git commit -m "Upload pertama"
git branch -M main
git remote add origin https://github.com/USERNAME/NAMA-REPO.git
git push -u origin main
```
- Repository harus **Public**, dibuat **tanpa** README.
- Saat diminta password, tempel **Personal Access Token** (https://github.com/settings/tokens → *classic* → centang **repo**). Layar memang tidak menampilkan apa pun saat token ditempel.

### 2.4 Aktifkan Pages
Repo → **Settings → Pages** → *Source*: **Deploy from a branch** · *Branch*: **main / (root)** → **Save** → centang **Enforce HTTPS**.
Situs aktif di `https://USERNAME.github.io/NAMA-REPO/` (1–2 menit).

### 2.5 Update berikutnya
```bash
git add .
git commit -m "Keterangan perubahan"
git push
```
Lalu **Ctrl+Shift+R** di browser.

---

## Pemecahan masalah

| Gejala | Penyebab & solusi |
|---|---|
| "Alamat server belum diatur" | `GAS_URL` di `js/config.js` masih `XXXX`. Isi, lalu commit & push. |
| "Gagal terhubung ke server" | URL salah / deployment bukan **Anyone** / belum **New version**. Uji `URL?action=ping`. |
| "Server mengembalikan halaman HTML, bukan JSON" | Deployment masih versi 1 (HtmlService) atau akses bukan **Anyone**. |
| Situs 404 | `index.html` tidak di root repo — lihat isi repo di github.com. Push ulang dari folder `supervisi-guru-web`. |
| Tampilan polos tanpa warna | Folder `css/` atau `js/` tidak ikut ter-upload. Selalu push lewat terminal, bukan "Upload files". |
| Versi lama masih tampil | Ctrl+Shift+R atau jendela Incognito. |
| Login lambat pertama kali (±3–5 dtk) | Normal: server Apps Script "bangun". Permintaan berikutnya lebih cepat; aplikasi juga memanaskan server saat halaman login dibuka. |

## Keamanan
- File di GitHub **tidak** memuat rahasia: hanya alamat `/exec` yang memang publik. Kunci AI, rahasia token, dan data tetap di Apps Script & Google Sheets.
- Setiap aksi wajib token login; hak akses diperiksa di server.
