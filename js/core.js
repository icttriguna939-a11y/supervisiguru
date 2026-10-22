/* ============================================================================
   SUPERVISI GURU — SMA TRIGUNA 1956 · JavaScript (SPA)
   Prinsip gas-instant-ux:
   1) SPA klien  → navigasi dirender dari state lokal (0 ms, tanpa server)
   2) Optimistic UI + localStorage → UI berubah instan, sinkron di latar
   3) Cache server (CacheService) → bootstrap 1 panggilan
   4) Batch → simpan semua indikator sekaligus, debounce autosave
   gas-pro-api: frontend statis (GitHub Pages) ↔ GAS REST API via fetch()
   (POST text/plain tanpa CORS preflight). Token sesi di localStorage, bukan URL.
   ========================================================================== */

// ═════════════════════════════════════════════════════════════════════════
// BAGIAN 1 — STATE & PENYIMPANAN LOKAL
// ═════════════════════════════════════════════════════════════════════════
const BOOT = {};   // identitas sekolah publik — dari cache perangkat lalu GET ?action=public
const ROLE = { ADMIN: 'ADMIN', KEPSEK: 'KEPSEK', PLH: 'PLH', GURU: 'GURU' };
const SUPR = ['KEPSEK', 'PLH'];
const FINAL = ['disahkan', 'tindak_lanjut', 'selesai'];

const S = {
  token: null,
  me: null,
  data: null,          // hasil bootstrap (semua tabel yang boleh dilihat)
  ix: {},              // indeks cepat
  route: 'dashboard',
  params: {},
  drafts: {},          // draf penilaian per sesi
  ui: {},              // filter & preferensi tampilan per halaman
  editing: false,
  pendingRefresh: null,
  lastSync: 0,
  online: true
};

const LS = {
  get(k, def) { try { const v = localStorage.getItem(k); return v === null ? def : JSON.parse(v); } catch (e) { return def; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { /* abaikan */ } }
};
Object.assign(BOOT, LS.get('sg_pub', {}));

// ═════════════════════════════════════════════════════════════════════════
// BAGIAN 2 — UTILITAS
// ═════════════════════════════════════════════════════════════════════════
const $ = (sel, root) => (root || document).querySelector(sel);
const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
const esc = (v) => String(v === null || v === undefined ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const uid = () => 'tmp-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const num = (v, d = 1) => (v === null || v === undefined || isNaN(v)) ? '–' : Number(v).toFixed(d).replace('.', ',');
const plural = (n, w) => n + ' ' + w;

const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

function parseYmd(s) { if (!s) return null; const p = String(s).slice(0, 10).split('-').map(Number); return p.length === 3 ? new Date(p[0], p[1] - 1, p[2]) : null; }
function ymd(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function today() { return (S.data && S.data.today) && Math.abs(Date.now() - S.lastSync) < 6 * 3600e3 ? S.data.today : ymd(new Date()); }
function fmtDate(s) { const d = parseYmd(s); return d ? d.getDate() + ' ' + BLN[d.getMonth()] + ' ' + d.getFullYear() : '–'; }
function fmtDateLong(s) { const d = parseYmd(s); return d ? HARI[d.getDay()] + ', ' + d.getDate() + ' ' + BULAN[d.getMonth()] + ' ' + d.getFullYear() : '–'; }
function fmtTs(ts) { if (!ts) return '–'; const d = String(ts); return fmtDate(d.slice(0, 10)) + (d.length > 10 ? ', ' + d.slice(11, 16) : ''); }
function fmtClock(ts) { return ts ? String(ts).slice(11, 16) : ''; }
function relDay(s) {
  const d = parseYmd(s), t = parseYmd(today());
  if (!d || !t) return '';
  const diff = Math.round((d - t) / 864e5);
  if (diff === 0) return 'Hari ini';
  if (diff === 1) return 'Besok';
  if (diff === -1) return 'Kemarin';
  return diff > 0 ? diff + ' hari lagi' : Math.abs(diff) + ' hari lalu';
}
function greeting() { const h = new Date().getHours(); return h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 18 ? 'Selamat sore' : 'Selamat malam'; }
function initials(name) {
  const clean = String(name || '?').replace(/,.*$/, '').replace(/\b(Dra?|Drs|Hj?|Ir|Prof|S|M)\.\s*/gi, '').trim();
  const w = clean.split(/\s+/).filter(Boolean);
  return ((w[0] || '?')[0] + (w[1] ? w[1][0] : '')).toUpperCase();
}
function avatarCls(id) { let h = 0; String(id || '').split('').forEach((c) => { h = (h * 31 + c.charCodeAt(0)) >>> 0; }); return ['', 'c1', 'c2', 'c3', 'c4'][h % 5]; }
function avatar(name, id, cls) { return `<span class="avatar ${avatarCls(id)} ${cls || ''}" aria-hidden="true">${esc(initials(name))}</span>`; }
function natCmp(a, b) { return String(a).localeCompare(String(b), 'id', { numeric: true }); }
function download(name, mime, content) {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; a.rel = 'noopener';
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}
function b64ToBlob(b64, mime) {
  const bin = atob(b64); const len = bin.length; const arr = new Uint8Array(len);
  for (let i = 0; i < len; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}
async function copyText(t) {
  try { await navigator.clipboard.writeText(t); return true; } catch (e) {
    const ta = document.createElement('textarea'); ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch (er) { ok = false; } ta.remove(); return ok;
  }
}
function csvCell(v) { const s = String(v === null || v === undefined ? '' : v); return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }

// ═════════════════════════════════════════════════════════════════════════
// BAGIAN 3 — IKON SVG (gaya garis 1.8px, tanpa font ikon → tanpa kedip)
// ═════════════════════════════════════════════════════════════════════════
const ICONS = {
  dashboard: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  clipboard: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/>',
  sparkles: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 3v4M17 5h4M5 17v3M3.5 18.5h3"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  cap: '<path d="M22 10 12 5 2 10l10 5 10-5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>',
  list: '<path d="m3 7 2 2 4-4M3 17l2 2 4-4M13 6h8M13 12h8M13 18h8"/>',
  history: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5M12 7v5l4 2"/>',
  settings: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  edit: '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/>',
  trash: '<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  checkCircle: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
  alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3z"/><path d="M12 9v4M12 17h.01"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  chevDown: '<path d="m6 9 6 6 6-6"/>',
  chevRight: '<path d="m9 18 6-6-6-6"/>',
  chevLeft: '<path d="m15 18-6-6 6-6"/>',
  arrowLeft: '<path d="M19 12H5M12 19l-7-7 7-7"/>',
  arrowRight: '<path d="M5 12h14M12 5l7 7-7 7"/>',
  printer: '<path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5M12 15V3"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5M12 3v12"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  key: '<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6M15.5 7.5l3 3L22 7l-3-3"/>',
  eye: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M9.88 9.88a3 3 0 1 0 4.24 4.24M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68M6.61 6.61A13.53 13.53 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61M2 2l20 20"/>',
  shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
  refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8M21 3v5h-5M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16M8 16H3v5"/>',
  save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/>',
  cloud: '<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9z"/><path d="m9.5 14 2 2 3.5-3.5"/>',
  cloudOff: '<path d="m2 2 20 20M5.78 5.78A7 7 0 0 0 9 19h8.5a4.5 4.5 0 0 0 1.31-.2M21.53 16.06A4.5 4.5 0 0 0 17.5 10h-1.79A7 7 0 0 0 10.6 5.26"/>',
  target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  trend: '<path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>',
  book: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
  copy: '<rect x="8" y="8" width="14" height="14" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  star: '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/>',
  flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7"/>',
  bulb: '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5M9 18h6M10 22h4"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  thumb: '<path d="M7 10v12M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88z"/>',
  message: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  filter: '<path d="M22 3H2l8 9.46V19l4 2v-8.54z"/>',
  school: '<path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6M10 9h4"/>',
  idcard: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M6.5 16c.5-1.2 1.4-1.8 2.5-1.8s2 .6 2.5 1.8M14 10h4M14 14h3"/>',
  layers: '<path d="M12 2 2 7l10 5 10-5z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/>',
  ban: '<circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/>',
  play: '<path d="M6 3l14 9-14 9z"/>',
  undo: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
  external: '<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  pie: '<path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/>',
  hourglass: '<path d="M5 22h14M5 2h14M17 22v-4.17a2 2 0 0 0-.59-1.42L12 12l-4.41 4.41A2 2 0 0 0 7 17.83V22M7 2v4.17a2 2 0 0 0 .59 1.42L12 12l4.41-4.41A2 2 0 0 0 17 6.17V2"/>',
  wifiOff: '<path d="M12 20h.01M8.5 16.43a5 5 0 0 1 7 0M2 8.82a15 15 0 0 1 4.17-2.65M10.66 5c4.01-.36 8.14.9 11.34 3.76M16.85 11.25a10 10 0 0 1 2.22 1.68M5 13a10 10 0 0 1 5.24-2.76M2 2l20 20"/>'
};
function icon(name, cls) { return `<svg class="i ${cls || ''}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`; }
function hydrateIcons(root) { $$('[data-icon]', root).forEach((el) => { el.outerHTML = icon(el.dataset.icon, el.dataset.cls); }); }
const SCHOOL_MARK = '<svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true"><rect width="40" height="40" rx="12" fill="currentColor" opacity="0"/><path d="M20 7 9 11v8c0 7 4.6 11.6 11 14 6.4-2.4 11-7 11-14v-8z" fill="none" stroke="#fff" stroke-width="2.2" stroke-linejoin="round"/><path d="M14.5 18.5 20 16l5.5 2.5L20 21z" fill="#fff"/><path d="M16.5 20v3.2c2 1.6 5 1.6 7 0V20" fill="none" stroke="#fff" stroke-width="1.8"/></svg>';
function brandLogo() {
  const url = (S.data && S.data.settings && S.data.settings.logo_url) || BOOT.logo_url;
  return `<span class="brand-logo">${url ? `<img src="${esc(url)}" alt="Logo sekolah" onerror="this.style.display='none'">` : SCHOOL_MARK}</span>`;
}

// ═════════════════════════════════════════════════════════════════════════
// BAGIAN 4 — GRAFIK SVG RINGAN (tanpa pustaka → render instan, ikut tema)
// ═════════════════════════════════════════════════════════════════════════
const SCORE_VAR = { 1: 'var(--s1)', 2: 'var(--s2)', 3: 'var(--s3)', 4: 'var(--s4)', 0: 'var(--s0)' };
function scoreTier(avg) { if (avg === null || avg === undefined) return 0; return avg >= 3.5 ? 4 : avg >= 2.5 ? 3 : avg >= 1.5 ? 2 : 1; }
function scoreColor(avg) { return SCORE_VAR[scoreTier(avg)]; }
function pctColor(p) { if (p === null || p === undefined) return 'var(--s0)'; return p >= 87.5 ? 'var(--s4)' : p >= 68.75 ? 'var(--s3)' : p >= 50 ? 'var(--s2)' : 'var(--s1)'; }

/** Gauge melingkar 0–100. */
function gauge(value, opts = {}) {
  const r = 52, c = 2 * Math.PI * r;
  const v = value === null || value === undefined ? 0 : clamp(value, 0, 100);
  const col = opts.color || pctColor(value);
  return `<div class="gauge ${opts.sm ? 'sm' : ''}" role="img" aria-label="Nilai ${value === null ? 'belum ada' : num(value, 1)} dari 100">
    <svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="${r}" fill="none" stroke="var(--surface-3)" stroke-width="10"/>
    <circle cx="60" cy="60" r="${r}" fill="none" stroke="${col}" stroke-width="10" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - v / 100)}" style="transition:stroke-dashoffset .4s"/></svg>
    <div class="val">${opts.label ? `<b style="color:${col}">${esc(opts.label)}</b><small>predikat</small>` : `<b>${value === null || value === undefined ? '–' : num(value, 1)}</b><small>/ 100</small>`}</div></div>`;
}
function ringPct(p, label) {
  const r = 26, c = 2 * Math.PI * r;
  return `<svg class="ring" viewBox="0 0 64 64" role="img" aria-label="${esc(label || p + '%')}"><circle cx="32" cy="32" r="${r}" fill="none" stroke="var(--surface-3)" stroke-width="6"/>
  <circle cx="32" cy="32" r="${r}" fill="none" stroke="var(--success)" stroke-width="6" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - p / 100)}" transform="rotate(-90 32 32)"/>
  <text x="32" y="37" text-anchor="middle" style="font-family:var(--font-head);font-weight:700;font-size:14px;fill:var(--text)">${Math.round(p)}%</text></svg>`;
}

/** Bar horizontal (label panjang aman di ponsel) dengan garis ambang. */
function hbarChart(items, opts = {}) {
  const max = opts.max || 4;
  if (!items.length || items.every((i) => i.value === null)) return `<div class="chart-empty">${opts.empty || 'Belum ada data yang disahkan untuk periode ini.'}</div>`;
  const thr = opts.threshold ? (opts.threshold / max) * 100 : null;
  return `<div class="stack" style="gap:12px" role="img" aria-label="${esc(opts.label || 'Grafik batang')}">${items.map((it) => {
    const w = it.value === null ? 0 : (it.value / max) * 100;
    return `<div><div class="row between small" style="margin-bottom:6px"><span class="ellipsis">${esc(it.label)}</span><b>${it.value === null ? '–' : num(it.value, opts.dec === undefined ? 1 : opts.dec)}${opts.suffix || ''}</b></div>
      <div style="position:relative;height:10px;border-radius:99px;background:var(--surface-3)"><i style="position:absolute;left:0;top:0;bottom:0;width:${w}%;border-radius:99px;background:${it.color || scoreColor(it.value)};transition:width .4s"></i>
      ${thr !== null ? `<i title="Batas perlu penguatan" style="position:absolute;top:-4px;bottom:-4px;left:${thr}%;border-left:2px dashed var(--danger);opacity:.7"></i>` : ''}</div></div>`;
  }).join('')}
  ${thr !== null ? `<div class="row xs muted" style="gap:6px"><i style="width:14px;border-top:2px dashed var(--danger)"></i> Batas perlu penguatan (${num(opts.threshold, 1)})</div>` : ''}</div>`;
}

/** Grafik garis halus dengan area gradien. */
function lineChart(points, opts = {}) {
  const pts = points.filter((p) => p.value !== null && p.value !== undefined);
  if (pts.length < 1) return `<div class="chart-empty">${opts.empty || 'Belum ada data tren — tren muncul setelah ada hasil disahkan.'}</div>`;
  const W = 640, H = opts.height || 240, pl = 36, pr = 20, pt = 26, pb = 30;
  const vals = pts.map((p) => p.value);
  let min = opts.min !== undefined ? opts.min : Math.floor(Math.min(...vals) / 10) * 10 - 5;
  let max = opts.max !== undefined ? opts.max : Math.min(100, Math.ceil(Math.max(...vals) / 10) * 10 + 5);
  if (max - min < 10) { min = Math.max(0, min - 5); max = Math.min(100, max + 5); }
  const n = pts.length;
  const x = (i) => n === 1 ? (pl + (W - pr)) / 2 : pl + i * ((W - pl - pr) / (n - 1));
  const y = (v) => pt + (1 - (v - min) / (max - min)) * (H - pt - pb);
  const ticks = [0, 1, 2, 3].map((k) => min + (k * (max - min)) / 3);
  let d = '';
  pts.forEach((p, i) => {
    const X = x(i), Y = y(p.value);
    if (i === 0) d = `M${X},${Y}`;
    else { const px = x(i - 1), py = y(pts[i - 1].value), cx = (px + X) / 2; d += ` C${cx},${py} ${cx},${Y} ${X},${Y}`; }
  });
  const gid = 'lg' + Math.random().toString(36).slice(2, 7);
  const area = n > 1 ? `${d} L${x(n - 1)},${H - pb} L${x(0)},${H - pb} Z` : '';
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opts.label || 'Grafik tren')}">
    <defs><linearGradient id="${gid}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="var(--primary)" stop-opacity=".22"/><stop offset="1" stop-color="var(--primary)" stop-opacity="0"/></linearGradient></defs>
    ${ticks.map((t) => `<line class="grid-l" x1="${pl}" x2="${W - pr}" y1="${y(t)}" y2="${y(t)}"/><text x="${pl - 8}" y="${y(t) + 4}" text-anchor="end">${Math.round(t)}</text>`).join('')}
    ${area ? `<path d="${area}" fill="url(#${gid})"/>` : ''}
    <path d="${d}" fill="none" stroke="var(--primary)" stroke-width="3" stroke-linecap="round"/>
    ${pts.map((p, i) => `<circle cx="${x(i)}" cy="${y(p.value)}" r="${i === n - 1 ? 6 : 4.5}" fill="${i === n - 1 ? 'var(--primary)' : 'var(--surface)'}" stroke="var(--primary)" stroke-width="2.5"><title>${esc(p.label)}: ${num(p.value, 1)}</title></circle>
      <text class="val-t" x="${x(i)}" y="${y(p.value) - 12}" text-anchor="middle">${num(p.value, 1)}</text>
      <text x="${x(i)}" y="${H - 8}" text-anchor="middle">${esc(p.label)}</text>`).join('')}
  </svg>`;
}

/** Radar 7 dimensi Pembelajaran Mendalam. */
function radarChart(axes, opts = {}) {
  if (!axes.length) return '<div class="chart-empty">Belum ada skor.</div>';
  const max = opts.max || 4, R = 110, cx = 160, cy = 140, n = axes.length;
  const pt = (i, v) => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / n; const r = (v / max) * R; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; };
  const rings = [1, 2, 3, 4].map((k) => axes.map((_, i) => pt(i, k).join(',')).join(' '));
  const poly = axes.map((a, i) => pt(i, a.value || 0).join(',')).join(' ');
  return `<svg class="chart" viewBox="0 0 320 290" role="img" aria-label="${esc(opts.label || 'Radar capaian dimensi')}">
    ${rings.map((r, k) => `<polygon points="${r}" fill="${k === 3 ? 'var(--surface-2)' : 'none'}" stroke="var(--border)" stroke-width="1"/>`).reverse().join('')}
    ${axes.map((_, i) => { const p = pt(i, max); return `<line x1="${cx}" y1="${cy}" x2="${p[0]}" y2="${p[1]}" stroke="var(--border)"/>`; }).join('')}
    <polygon points="${poly}" fill="var(--primary)" fill-opacity=".18" stroke="var(--primary)" stroke-width="2.5" stroke-linejoin="round"/>
    ${axes.map((a, i) => { const p = pt(i, a.value || 0); return `<circle cx="${p[0]}" cy="${p[1]}" r="4.5" fill="${scoreColor(a.value)}" stroke="var(--surface)" stroke-width="2"><title>${esc(a.full || a.label)}: ${num(a.value, 2)}</title></circle>`; }).join('')}
    ${axes.map((a, i) => { const p = pt(i, max + 0.55); const anchor = Math.abs(p[0] - cx) < 12 ? 'middle' : p[0] > cx ? 'start' : 'end'; return `<text x="${p[0]}" y="${p[1] + 4}" text-anchor="${anchor}" style="font-weight:600">${esc(a.label)}</text>`; }).join('')}
  </svg>`;
}

/** Ilustrasi kosong yang ramah (biru lembut). */
function emptyState(title, msg, cta) {
  return `<div class="empty"><svg class="art" viewBox="0 0 120 96" aria-hidden="true"><ellipse cx="60" cy="84" rx="46" ry="8" fill="var(--primary-light)"/>
    <rect x="28" y="14" width="64" height="62" rx="10" fill="var(--surface)" stroke="var(--border-strong)" stroke-width="2"/>
    <rect x="38" y="28" width="30" height="6" rx="3" fill="var(--accent)" opacity=".7"/><rect x="38" y="40" width="44" height="5" rx="2.5" fill="var(--border)"/>
    <rect x="38" y="50" width="38" height="5" rx="2.5" fill="var(--border)"/><circle cx="86" cy="22" r="12" fill="var(--primary)" opacity=".9"/><path d="m81 22 3.5 3.5L91 19" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
    <b>${esc(title)}</b><p class="small" style="max-width:420px">${esc(msg || '')}</p>${cta || ''}</div>`;
}
function skeletonRows(n, h) { return Array.from({ length: n }, () => `<div class="sk" style="height:${h || 52}px;margin-bottom:10px"></div>`).join(''); }

// ═════════════════════════════════════════════════════════════════════════
// BAGIAN 5 — PRIMITIF UI: toast, modal, konfirmasi, menu
// ═════════════════════════════════════════════════════════════════════════
function toast(type, title, msg, ms) {
  const host = $('#toasts');
  const ic = { success: 'checkCircle', error: 'alert', warning: 'alert', info: 'info', ai: 'sparkles' }[type] || 'info';
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.setAttribute('role', type === 'error' ? 'alert' : 'status');
  el.innerHTML = `<span class="ti">${icon(ic)}</span><div class="grow"><b>${esc(title)}</b>${msg ? `<p>${esc(msg)}</p>` : ''}</div><button class="icon-btn" style="width:32px;height:32px" aria-label="Tutup">${icon('x', 'sm')}</button>`;
  const close = () => { el.classList.add('out'); setTimeout(() => el.remove(), 220); };
  el.querySelector('button').onclick = close;
  host.appendChild(el);
  while (host.children.length > 4) host.firstChild.remove();
  setTimeout(close, ms || (type === 'error' ? 7000 : 3800));
}

let modalStack = [];
/**
 * Buka modal / drawer. body & footer berupa HTML. Kembalikan {el, close}.
 * Tanpa window.alert/confirm (aman di iframe).
 */
function openModal(o) {
  const root = document.createElement('div');
  root.className = 'modal-root' + (o.drawer ? ' drawer' : '');
  root.innerHTML = `<div class="modal ${o.size || ''}" role="dialog" aria-modal="true" aria-labelledby="mt-${modalStack.length}">
    <div class="modal-h">${o.icon ? `<span class="mi ${o.iconClass || ''}">${icon(o.icon)}</span>` : ''}<div class="grow"><h3 id="mt-${modalStack.length}">${esc(o.title)}</h3>${o.sub ? `<p class="small muted mt8">${esc(o.sub)}</p>` : ''}</div>
    <button class="icon-btn" data-close aria-label="Tutup">${icon('x')}</button></div>
    <div class="modal-b">${o.body || ''}</div>${o.footer !== undefined ? `<div class="modal-f">${o.footer}</div>` : ''}</div>`;
  $('#modalHost').appendChild(root);
  const prevFocus = document.activeElement;
  const api = {
    el: root,
    close: () => {
      root.classList.remove('on');
      modalStack = modalStack.filter((m) => m !== api);
      setTimeout(() => root.remove(), 200);
      if (o.onClose) o.onClose();
      if (prevFocus && prevFocus.focus) try { prevFocus.focus(); } catch (e) { /* abaikan */ }
    }
  };
  root.addEventListener('mousedown', (e) => { if (e.target === root && !o.sticky) api.close(); });
  root.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', api.close));
  modalStack.push(api);
  requestAnimationFrame(() => {
    root.classList.add('on');
    const f = root.querySelector('[autofocus], .modal-b input:not([type=hidden]), .modal-b select, .modal-b textarea, .modal-f .btn');
    if (f) try { f.focus({ preventScroll: true }); } catch (e) { /* abaikan */ }
  });
  if (o.onOpen) o.onOpen(root, api);
  return api;
}
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && modalStack.length) { modalStack[modalStack.length - 1].close(); e.preventDefault(); }
});

function confirmDialog(o) {
  return new Promise((resolve) => {
    let done = false;
    const m = openModal({
      title: o.title, icon: o.icon || (o.danger ? 'alert' : 'info'), iconClass: o.danger ? 'red' : (o.iconClass || ''),
      body: `<p>${o.html || esc(o.message || '')}</p>${o.input ? `<div class="field mt16"><label for="cfIn">${esc(o.input)}</label><textarea id="cfIn" class="textarea" style="min-height:80px"></textarea></div>` : ''}`,
      footer: `<button class="btn ghost" data-close>Batal</button><button class="btn ${o.danger ? 'danger solid' : ''}" id="cfOk">${esc(o.okText || 'Ya, lanjutkan')}</button>`,
      onClose: () => { if (!done) resolve(false); }
    });
    m.el.querySelector('#cfOk').onclick = () => {
      const val = o.input ? m.el.querySelector('#cfIn').value.trim() : true;
      if (o.input && val.length < (o.minLength || 0)) { m.el.querySelector('#cfIn').classList.add('err'); return; }
      done = true; m.close(); resolve(val);
    };
  });
}

function btnBusy(btn, on, text) {
  if (!btn) return;
  if (on) { btn.dataset.html = btn.innerHTML; btn.classList.add('is-loading'); btn.innerHTML = `<span class="spinner sm"></span> ${esc(text || 'Memproses…')}`; }
  else { btn.classList.remove('is-loading'); if (btn.dataset.html) btn.innerHTML = btn.dataset.html; }
}

function popMenu(anchor, items) {
  $$('.menu').forEach((m) => m.remove());
  const m = document.createElement('div');
  m.className = 'menu';
  m.innerHTML = items.map((it, i) => it.sep ? '<div style="height:1px;background:var(--border);margin:6px 4px"></div>' : `<button data-i="${i}" class="${it.danger ? 'danger' : ''}">${icon(it.icon, 'sm')} ${esc(it.label)}</button>`).join('');
  document.body.appendChild(m);
  const r = anchor.getBoundingClientRect();
  m.style.top = (r.bottom + window.scrollY + 6) + 'px';
  m.style.left = Math.max(8, Math.min(window.innerWidth - m.offsetWidth - 8, r.right - m.offsetWidth)) + 'px';
  m.addEventListener('click', (e) => { const b = e.target.closest('button[data-i]'); if (b) { m.remove(); items[Number(b.dataset.i)].fn(); } });
  setTimeout(() => document.addEventListener('click', function off(e) { if (!m.contains(e.target)) { m.remove(); document.removeEventListener('click', off); } }), 0);
}

// ═════════════════════════════════════════════════════════════════════════
// BAGIAN 6 — KLIEN API (fetch ke GAS REST API → Promise)
// ═════════════════════════════════════════════════════════════════════════
const CFG = window.SG_CONFIG || {};
function apiUrl() { return String(CFG.GAS_URL || '').trim(); }
function apiConfigured() { const u = apiUrl(); return /^https?:\/\/|^\//.test(u) && u.indexOf('XXXX') < 0; }

/**
 * Panggil api(action, token, payload) di Kode.gs lewat doPost.
 * WAJIB Content-Type text/plain → permintaan "sederhana", tanpa CORS preflight.
 */
function call(action, payload) {
  if (!apiConfigured()) { const e = new Error('Alamat server belum diatur. Isi GAS_URL di js/config.js dengan URL /exec Apps Script.'); e.code = 'CONFIG'; return Promise.reject(e); }
  const tokenAtCall = S.token;
  const isAuthCall = action === 'auth.login';
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), Number(CFG.REQUEST_TIMEOUT_MS) || 90000) : null;
  window.__rpc = (window.__rpc || 0) + 1;
  return fetch(apiUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, token: S.token, payload: payload || {} }),
    redirect: 'follow',
    cache: 'no-store',
    signal: ctrl ? ctrl.signal : undefined
  }).then((res) => {
    if (!res.ok) { const e = new Error('Server merespons HTTP ' + res.status + '.'); e.code = 'NETWORK'; throw e; }
    return res.text();
  }).then((txt) => {
    try { return JSON.parse(txt); } catch (er) {
      const e = new Error(/^\s*</.test(txt) ? 'Server mengembalikan halaman HTML, bukan JSON. Pastikan Web App di-deploy dengan "Who has access: Anyone" dan GAS_URL berakhiran /exec.' : 'Respons server tidak valid.');
      e.code = 'SERVER'; throw e;
    }
  }).catch((err) => {
    if (err && err.code) throw err;
    const e = new Error(err && err.name === 'AbortError' ? 'Server terlalu lama merespons. Coba lagi.' : 'Gagal terhubung ke server. Periksa koneksi internet atau GAS_URL.');
    e.code = 'NETWORK';
    setOnline(false);
    throw e;
  }).then((r) => {
    setOnline(true);
    // Abaikan respons milik sesi lama (mis. pengguna sudah keluar) agar data tidak "hidup lagi"
    if (!isAuthCall && S.token !== tokenAtCall) { const e = new Error('Sesi telah berganti.'); e.code = 'STALE'; throw e; }
    if (!r) { const e = new Error('Respons server kosong.'); e.code = 'SERVER'; throw e; }
    if (r.ok) return r.data;
    const e = new Error((r.error && r.error.message) || r.message || 'Gagal.');
    e.code = r.error && r.error.code;
    if (e.code === 'AUTH') sessionExpired();
    if (e.code === 'MUST_CHANGE') showChangePassword(true);
    throw e;
  }).finally(() => { if (timer) clearTimeout(timer); window.__rpc = Math.max(0, (window.__rpc || 1) - 1); });
}

/** GET publik: identitas sekolah (untuk login) — juga memanaskan server GAS. */
function fetchPublic() {
  if (!apiConfigured()) return Promise.resolve(null);
  return fetch(apiUrl() + (apiUrl().indexOf('?') > -1 ? '&' : '?') + 'action=public', { redirect: 'follow', cache: 'no-store' })
    .then((r) => r.json())
    .then((j) => {
      if (j && j.ok) { Object.keys(BOOT).forEach((k) => delete BOOT[k]); Object.assign(BOOT, j.data); LS.set('sg_pub', j.data); }
      else if (j && j.error && j.error.code === 'SETUP') BOOT.setup_required = true;
      return j;
    }).catch(() => null);
}

function setOnline(on) {
  if (S.online === on) return;
  S.online = on;
  const bar = $('#offlineBar');
  if (!bar) return;
  bar.classList.toggle('on', !on);
  bar.innerHTML = on ? '' : `${icon('wifiOff', 'sm')} Koneksi ke server terputus. Perubahan disimpan di perangkat dan akan disinkronkan otomatis.`;
}
window.addEventListener('online', () => { if (S.token) refreshData(true); });

/** Mutasi optimistik: terapkan lokal → render → sinkron latar → batalkan jika gagal. */
function optimistic({ apply, revert, action, payload, onDone, okMsg, render = true }) {
  apply();
  persist();
  if (render) rerender();
  if (okMsg) toast('success', okMsg);
  return call(action, payload).then((d) => { if (onDone) onDone(d); persist(); if (render) rerender(); return d; })
    .catch((e) => { if (e.code === 'STALE' || !S.data) throw e; if (revert) revert(); persist(); if (render) rerender(); toast('error', 'Perubahan dibatalkan', e.message); throw e; });
}
