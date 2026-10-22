// ═════════════════════════════════════════════════════════════════════════
// BAGIAN 7 — DATA: indeks, selektor, mesin skor (cermin dari Kode.gs)
// ═════════════════════════════════════════════════════════════════════════
const STATUS_LABEL = {
  terjadwal: 'Terjadwal', draft: 'Draft', observasi_selesai: 'Observasi Selesai', menunggu_tinjauan: 'Menunggu Tinjauan',
  disahkan: 'Disahkan', tindak_lanjut: 'Tindak Lanjut', selesai: 'Selesai', dalam_proses: 'Dalam Proses', terlambat: 'Terlambat'
};
const ROLE_LABEL = { ADMIN: 'Admin', KEPSEK: 'Kepala Sekolah', PLH: 'PLH', GURU: 'Guru', PLH_NONAKTIF: 'PLH (nonaktif)' };
const SCALE = [
  { v: 1, t: 'Perlu Penguatan', d: 'Bukti praktik belum memadai' },
  { v: 2, t: 'Mulai Berkembang', d: 'Mulai tampak, perlu pendampingan' },
  { v: 3, t: 'Berkembang Sesuai Harapan', d: 'Konsisten berdasarkan bukti' },
  { v: 4, t: 'Praktik Kuat', d: 'Efektif & layak dijadikan teladan' }
];
const FU_LABEL = { direncanakan: 'Direncanakan', berjalan: 'Berjalan', selesai: 'Selesai (guru)', diverifikasi: 'Diverifikasi' };
const SHORT_CAT = { 1: 'Perencanaan', 2: 'Berkesadaran', 3: 'Bermakna', 4: 'Menggembirakan', 5: 'Pengalaman', 6: 'Asesmen', 7: 'Lingkungan' };

function statusPill(st) { return `<span class="pill st-${esc(st)}">${esc(STATUS_LABEL[st] || st)}</span>`; }
function scorePill(v) { return v === null || v === undefined ? '<span class="sc s0">–</span>' : `<span class="sc s${v}">${v}</span>`; }
function role() { return S.me ? (S.me.effective_role || S.me.role) : null; }
function isSup() { return SUPR.indexOf(role()) > -1; }
function isAdmin() { return role() === ROLE.ADMIN; }
function isGuru() { return role() === ROLE.GURU; }
function setting(k) { return (S.data && S.data.settings && S.data.settings[k]) || BOOT[k] || ''; }

function tbl(name) { return (S.data && S.data[name]) || []; }

/** Bangun indeks agar selektor O(1). Dipanggil setiap data berubah. */
function reindex() {
  const ix = { teachers: {}, periods: {}, sup: {}, asm: {}, recs: {}, fus: {}, users: {}, refs: {}, rubric: {} };
  tbl('teachers').forEach((t) => { ix.teachers[t.teacher_id] = t; });
  tbl('periods').forEach((p) => { ix.periods[p.period_id] = p; });
  tbl('supervisions').forEach((s) => { ix.sup[s.supervision_id] = s; });
  tbl('assessments').forEach((a) => { (ix.asm[a.supervision_id] = ix.asm[a.supervision_id] || []).push(a); });
  tbl('recommendations').forEach((r) => { (ix.recs[r.supervision_id] = ix.recs[r.supervision_id] || []).push(r); });
  tbl('followups').forEach((f) => { (ix.fus[f.supervision_id] = ix.fus[f.supervision_id] || []).push(f); });
  tbl('users').forEach((u) => { ix.users[u.user_id] = u; });
  tbl('references').forEach((r) => { ix.refs[r.ref_id] = r; });
  tbl('rubrics').forEach((r) => { (ix.rubric[r.version] = ix.rubric[r.version] || []).push(r); });
  Object.keys(ix.rubric).forEach((v) => ix.rubric[v].sort((a, b) => a.category_no - b.category_no || natCmp(a.indicator_id, b.indicator_id)));
  S.ix = ix;
  S.loaded = new Set(S.data ? (S.data.loaded_detail || []) : []);
}

function teacher(id) { return S.ix.teachers[id] || { nama: 'Guru tidak dikenal', mapel: '' }; }
function person(id) { return (S.data && S.data.people && S.data.people[id]) || null; }
function personName(id) { const p = person(id); return p ? p.nama : '–'; }
function sup(id) { return S.ix.sup[id] || null; }
function activePeriod() { return S.ix.periods[S.data && S.data.active_period_id] || null; }
function periodLabel(p) { return p ? p.tahun_ajaran + ' · ' + p.semester : 'Belum ada periode aktif'; }
function periodShort(p) { return p ? p.tahun_ajaran.slice(2, 4) + '/' + p.tahun_ajaran.slice(7, 9) + ' ' + (p.semester === 'Ganjil' ? '1' : '2') : '–'; }
function sortedPeriods() { return tbl('periods').slice().sort((a, b) => natCmp(a.tahun_ajaran + (a.semester === 'Ganjil' ? 1 : 2), b.tahun_ajaran + (b.semester === 'Ganjil' ? 1 : 2))); }
function rubricOf(version) { return (S.ix.rubric[version] || []).filter((r) => r.active); }
function activeRubricVersion() { return setting('active_rubric_version') || '1.0'; }
function asmOf(id) { return S.ix.asm[id] || []; }
function recsOf(id) { return (S.ix.recs[id] || []).filter((r) => r.status !== 'diganti'); }
function fusOf(id) { return (S.ix.fus[id] || []).slice().sort((a, b) => natCmp(a.target_date, b.target_date)); }
function sessionsActive() { const p = activePeriod(); return tbl('supervisions').filter((s) => !p || s.period_id === p.period_id); }
function isFinal(s) { return s && FINAL.indexOf(s.status) > -1; }
function fuOverdue(f) { return f.status !== 'diverifikasi' && f.status !== 'selesai' && f.target_date && f.target_date < today(); }
function categoriesOf(version) {
  const map = {};
  rubricOf(version).forEach((r) => { if (!map[r.category_no]) map[r.category_no] = { no: r.category_no, name: r.category, weight: Number(r.category_weight) || 0, items: [] }; map[r.category_no].items.push(r); });
  return Object.values(map).sort((a, b) => a.no - b.no);
}

/** Mesin skor klien — identik dengan computeScore_ di server (pratinjau instan). */
function computeScore(rows, items) {
  const amap = {};
  (items || []).forEach((a) => { amap[a.indicator_id] = a; });
  const cats = {};
  let total = 0, filled = 0, notObs = 0;
  rows.filter((r) => r.active !== false).forEach((r) => {
    const c = cats[r.category_no] = cats[r.category_no] || { no: r.category_no, name: r.category, weight: Number(r.category_weight) || 0, sum: 0, n: 0, count: 0 };
    c.count++; total++;
    const a = amap[r.indicator_id];
    if (a && a.not_observed) notObs++;
    if (a && !a.not_observed && a.score >= 1 && a.score <= 4) { c.sum += Number(a.score); c.n++; filled++; }
  });
  let score = 0, used = 0;
  const list = Object.values(cats).sort((a, b) => a.no - b.no).map((c) => {
    const avg = c.n ? c.sum / c.n : null;
    if (avg !== null) { score += (avg / 4) * c.weight; used += c.weight; }
    return { no: c.no, name: c.name, weight: c.weight, avg: avg === null ? null : Math.round(avg * 100) / 100, observed: c.n, count: c.count };
  });
  return { final: used ? Math.round((score / used) * 10000) / 100 : null, complete: total > 0 && filled === total, filled, total, notObserved: notObs, categories: list };
}
function predicate(score) {
  if (score === null || score === undefined) return { code: '–', label: 'Belum dinilai' };
  const ps = setting('predicates') || [{ min: 87.5, code: 'A', label: 'Praktik Kuat' }, { min: 68.75, code: 'B', label: 'Berkembang Sesuai Harapan' }, { min: 50, code: 'C', label: 'Mulai Berkembang' }, { min: 0, code: 'D', label: 'Perlu Penguatan' }];
  return ps.find((p) => score >= p.min) || ps[ps.length - 1];
}

// ── Mutasi state lokal ─────────────────────────────────────────────────
const ID = { supervisions: 'supervision_id', assessments: 'assessment_id', recommendations: 'recommendation_id', followups: 'followup_id',
  teachers: 'teacher_id', users: 'user_id', periods: 'period_id', rubrics: 'rubric_id', references: 'ref_id' };
function upsertLocal(table, obj) {
  if (!S.data[table]) S.data[table] = [];
  const f = ID[table];
  const i = S.data[table].findIndex((x) => x[f] === obj[f]);
  if (i > -1) S.data[table][i] = Object.assign({}, S.data[table][i], obj); else S.data[table].push(obj);
  reindex();
}
function upsertManyLocal(table, arr) { (arr || []).forEach((o) => { const f = ID[table]; const i = (S.data[table] = S.data[table] || []).findIndex((x) => x[f] === o[f]); if (i > -1) S.data[table][i] = Object.assign({}, S.data[table][i], o); else S.data[table].push(o); }); reindex(); }
function removeLocal(table, id) { const f = ID[table]; S.data[table] = (S.data[table] || []).filter((x) => x[f] !== id); reindex(); }
function snapshot(table) { return JSON.parse(JSON.stringify(S.data[table] || [])); }
function restore(table, snap) { S.data[table] = snap; reindex(); }

const persist = debounce(() => {
  if (!S.me || !S.data || !S.token) return;
  LS.set('sg_cache_' + S.me.user_id, { at: Date.now(), data: S.data });
}, 400);

// ═════════════════════════════════════════════════════════════════════════
// BAGIAN 8 — AUTENTIKASI: login, ganti password, sesi
// ═════════════════════════════════════════════════════════════════════════
function loginArt() {
  return `<svg viewBox="0 0 520 440" role="img" aria-label="Ilustrasi kepala sekolah dan guru meninjau dasbor supervisi">
  <defs><filter id="grain"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0.24 0 0 0 0 0.44 0 0 0 0 0.88 0 0 0 .18 0"/><feComposite in2="SourceGraphic" operator="in"/></filter></defs>
  <path d="M70 300c-40-70 10-170 110-190 70-14 120 20 190 4 80-18 140 40 120 120-16 66-80 96-160 104-110 10-220 30-260-38z" fill="var(--accent)" opacity=".35"/>
  <path d="M70 300c-40-70 10-170 110-190 70-14 120 20 190 4 80-18 140 40 120 120-16 66-80 96-160 104-110 10-220 30-260-38z" fill="var(--accent)" filter="url(#grain)" opacity=".8"/>
  <ellipse cx="270" cy="392" rx="210" ry="18" fill="var(--primary)" opacity=".12"/>
  <rect x="150" y="110" width="250" height="170" rx="16" fill="var(--surface)" stroke="var(--primary)" stroke-width="3"/>
  <rect x="150" y="110" width="40" height="170" rx="16" fill="var(--primary-light)"/>
  <circle cx="170" cy="140" r="7" fill="var(--accent)"/><circle cx="170" cy="168" r="7" fill="var(--accent)"/><circle cx="170" cy="196" r="7" fill="var(--accent)"/><circle cx="170" cy="224" r="7" fill="var(--accent)"/>
  <rect x="206" y="128" width="90" height="9" rx="4.5" fill="var(--primary)" opacity=".85"/><rect x="206" y="146" width="60" height="7" rx="3.5" fill="var(--border-strong)"/>
  <circle cx="345" cy="175" r="34" fill="var(--primary-light)"/><path d="M345 141a34 34 0 0 1 34 34h-34z" fill="var(--primary)"/><path d="M345 175h34a34 34 0 0 1-17 29.4z" fill="var(--accent)"/>
  <rect x="206" y="176" width="70" height="10" rx="5" fill="var(--primary)" opacity=".55"/><rect x="206" y="194" width="90" height="10" rx="5" fill="var(--primary)" opacity=".35"/><rect x="206" y="212" width="54" height="10" rx="5" fill="var(--primary)" opacity=".75"/>
  <rect x="206" y="240" width="176" height="22" rx="8" fill="var(--surface-2)"/><circle cx="222" cy="251" r="5" fill="var(--success)"/><rect x="234" y="247" width="80" height="8" rx="4" fill="var(--border-strong)"/>
  <g><rect x="300" y="318" width="22" height="60" rx="4" fill="var(--primary)" opacity=".85"/><rect x="326" y="300" width="22" height="78" rx="4" fill="var(--primary)"/><rect x="352" y="336" width="22" height="42" rx="4" fill="var(--accent)"/></g>
  <g><circle cx="102" cy="190" r="22" fill="var(--navy)"/><path d="M80 186c0-16 10-26 22-26s22 9 22 24c-8-6-20-8-44 2z" fill="var(--navy)"/>
    <circle cx="102" cy="196" r="18" fill="#F2C9A8"/><path d="M84 192c2-14 10-20 18-20 10 0 18 6 19 18-10-6-22-6-37 2z" fill="var(--navy)"/>
    <path d="M78 228c6-10 14-14 24-14s18 4 24 14l8 74H70z" fill="var(--primary)"/><path d="M76 302h56l-2 76H82z" fill="var(--primary-hover)"/>
    <rect x="76" y="376" width="20" height="10" rx="5" fill="var(--navy)"/><rect x="108" y="376" width="20" height="10" rx="5" fill="var(--navy)"/>
    <rect x="44" y="236" width="62" height="76" rx="6" fill="var(--surface)" stroke="var(--primary)" stroke-width="2.5"/><rect x="54" y="286" width="8" height="18" fill="var(--accent)"/><rect x="66" y="274" width="8" height="30" fill="var(--primary)"/><rect x="78" y="280" width="8" height="24" fill="var(--accent)"/><rect x="90" y="266" width="8" height="38" fill="var(--primary)"/></g>
  <g><circle cx="452" cy="196" r="17" fill="#E6B48F"/><path d="M434 192c1-13 9-19 18-19 10 0 17 7 17 17-6-4-14-6-35 2z" fill="var(--navy)"/>
    <path d="M430 226c6-10 13-13 22-13s17 4 22 14l6 76h-56z" fill="var(--primary)"/><path d="M426 302h52l-4 74h-14l-6-54-6 54h-14z" fill="var(--navy)" opacity=".85"/>
    <path d="M432 240c-14 6-26 16-34 28l8 6c10-10 20-16 32-20z" fill="var(--primary)"/><rect x="380" y="262" width="34" height="24" rx="5" fill="var(--surface)" stroke="var(--primary)" stroke-width="2.5"/><rect x="386" y="270" width="22" height="4" rx="2" fill="var(--accent)"/></g>
  <circle cx="420" cy="70" r="12" fill="var(--accent)" opacity=".8"/><circle cx="118" cy="96" r="22" fill="var(--primary)" opacity=".2"/><path d="M104 96a14 14 0 0 1 28 0z" fill="var(--primary)" opacity=".55"/>
  </svg>`;
}

function showLogin(msg) {
  S.editing = false;
  $('#app').classList.remove('on');
  const a = $('#auth');
  a.classList.add('on');
  const school = setting('school_name') || 'SMA Triguna 1956 Jakarta';
  a.innerHTML = `<div class="blob b1"></div><div class="blob b2"></div><div class="auth-wrap"><div class="auth-card">
    <div class="auth-form">
      <div class="auth-brand">${brandLogo()}<div><b>${esc(school)}</b><small>Supervisi Guru · Pembelajaran Mendalam</small></div></div>
      <h1>Masuk</h1>
      <p class="sub">Silakan masuk dengan akun yang diberikan Admin sekolah.</p>
      ${!apiConfigured() ? `<div class="warnbox mb16">${icon('alert', 'sm')}<span>Alamat server belum diatur. Isi <b>GAS_URL</b> di <b>js/config.js</b> dengan URL <b>/exec</b> dari Apps Script, lalu push ulang ke GitHub.</span></div>`
        : BOOT.setup_required ? `<div class="warnbox mb16">${icon('alert', 'sm')}<span>Aplikasi belum disiapkan. Admin perlu menjalankan <b>setupAppEnvironment()</b> di editor Apps Script.</span></div>` : ''}
      <form id="loginForm" class="stack" style="gap:20px" novalidate>
        <div class="field"><label for="lgUser">Username</label><input id="lgUser" class="input uline" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="mis. budi.santoso" required></div>
        <div class="field"><label for="lgPass">Password</label><div class="input-icon"><input id="lgPass" type="password" class="input uline" autocomplete="current-password" placeholder="Masukkan password" style="padding-left:2px;padding-right:48px" required>
          <button type="button" class="icon-btn eye" data-act="togglePw" data-target="lgPass" aria-label="Tampilkan password">${icon('eye', 'sm')}</button></div></div>
        <div id="lgErr" class="dangerbox" style="display:${msg ? 'flex' : 'none'}" role="alert">${icon('alert', 'sm')}<span>${esc(msg || '')}</span></div>
        <button class="btn block glow" id="lgBtn" type="submit">MASUK ${icon('arrowRight', 'sm')}</button>
        <p class="small muted">Lupa password? Hubungi Admin sekolah untuk reset.</p>
      </form>
    </div>
    <div class="auth-art">${loginArt()}</div>
  </div></div>`;
  $('#splash').classList.add('hide');
  const f = $('#loginForm');
  f.addEventListener('submit', doLogin);
  setTimeout(() => { try { $('#lgUser').focus(); } catch (e) { /* abaikan */ } }, 50);
}

function doLogin(e) {
  e.preventDefault();
  const u = $('#lgUser').value.trim(), p = $('#lgPass').value;
  const err = $('#lgErr');
  const showErr = (m) => { err.style.display = 'flex'; err.querySelector('span').textContent = m; };
  if (!u || !p) { showErr('Isi username dan password.'); return; }
  const btn = $('#lgBtn');
  btnBusy(btn, true, 'Memeriksa…');
  call('auth.login', { username: u, password: p }).then((d) => {
    S.token = d.token; LS.set('sg_token', d.token);
    S.me = d.user;
    if (d.must_change_password) { btnBusy(btn, false); showChangePassword(true); return; }
    applyBootstrap(d.bootstrap, true);
    enterApp();
    toast('success', 'Selamat datang', d.user.nama);
  }).catch((er) => { btnBusy(btn, false); showErr(er.message); $('#lgPass').select(); });
}

function pwStrength(p) { let s = 0; if (p.length >= 8) s++; if (/[A-Za-z]/.test(p) && /\d/.test(p)) s++; if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++; if (p.length >= 12 || /[^A-Za-z0-9]/.test(p)) s++; return p ? Math.max(1, s) : 0; }
function pwFormHtml(prefix) {
  return `<div class="stack" style="gap:16px">
    <div class="field"><label for="${prefix}Old">Password lama / sementara</label><input id="${prefix}Old" type="password" class="input" autocomplete="current-password"></div>
    <div class="field"><label for="${prefix}New">Password baru</label><input id="${prefix}New" type="password" class="input" autocomplete="new-password" data-input="pwMeter" data-prefix="${prefix}">
      <div class="pw-meter" id="${prefix}Meter" data-s="0"><i></i><i></i><i></i><i></i></div>
      <ul class="rules" id="${prefix}Rules"><li data-r="len">${icon('check', 'xs')} Minimal 8 karakter</li><li data-r="mix">${icon('check', 'xs')} Mengandung huruf dan angka</li></ul></div>
    <div class="field"><label for="${prefix}Rep">Ulangi password baru</label><input id="${prefix}Rep" type="password" class="input" autocomplete="new-password"></div>
    <div id="${prefix}Err" class="dangerbox" style="display:none" role="alert">${icon('alert', 'sm')}<span></span></div></div>`;
}
function updatePwMeter(el) {
  const p = el.value, pre = el.dataset.prefix;
  $('#' + pre + 'Meter').dataset.s = String(pwStrength(p));
  $('#' + pre + 'Rules [data-r=len]').classList.toggle('ok', p.length >= 8);
  $('#' + pre + 'Rules [data-r=mix]').classList.toggle('ok', /[A-Za-z]/.test(p) && /\d/.test(p));
}
function submitPw(prefix, btn, after) {
  const o = $('#' + prefix + 'Old').value, n = $('#' + prefix + 'New').value, r = $('#' + prefix + 'Rep').value;
  const err = $('#' + prefix + 'Err');
  const show = (m) => { err.style.display = 'flex'; err.querySelector('span').textContent = m; };
  if (!o) return show('Isi password lama.');
  if (n.length < 8 || !/[A-Za-z]/.test(n) || !/\d/.test(n)) return show('Password baru minimal 8 karakter dan mengandung huruf serta angka.');
  if (n !== r) return show('Ulangan password tidak sama.');
  btnBusy(btn, true, 'Menyimpan…');
  call('auth.changePassword', { old_password: o, new_password: n }).then((d) => {
    S.token = d.token; LS.set('sg_token', d.token); S.me = d.user;
    applyBootstrap(d.bootstrap, true);
    toast('success', 'Password diperbarui', 'Gunakan password baru saat masuk berikutnya.');
    after && after();
  }).catch((e) => { btnBusy(btn, false); show(e.message); });
}

function showChangePassword(forced) {
  $('#app').classList.remove('on');
  const a = $('#auth');
  a.classList.add('on');
  a.innerHTML = `<div class="blob b1"></div><div class="blob b2"></div><div class="auth-wrap"><div class="card" style="width:100%;max-width:460px;border-radius:24px;padding:32px">
    <div style="width:64px;height:64px;border-radius:50%;background:var(--primary-light);color:var(--primary);display:grid;place-items:center;margin-bottom:16px">${icon('lock', 'lg')}</div>
    <h2>Ganti Password</h2><p class="muted mt8 mb16">${forced ? 'Demi keamanan, ganti password sementara Anda sebelum melanjutkan.' : 'Perbarui password akun Anda.'}</p>
    ${pwFormHtml('fp')}
    <button class="btn block mt24" id="fpBtn">Simpan Password</button>
    <button class="btn plain block mt8" data-act="logout">Keluar</button></div></div>`;
  $('#splash').classList.add('hide');
  $('#fpBtn').onclick = (e) => submitPw('fp', e.currentTarget, enterApp);
}

function sessionExpired() {
  if (!S.token) return;
  clearSession();
  showLogin('Sesi Anda telah berakhir. Silakan masuk kembali.');
}
function clearSession() {
  if (S.me) LS.del('sg_cache_' + S.me.user_id);
  S.token = null; S.me = null; S.data = null; S.drafts = {};
  LS.del('sg_token');
}
async function logout() {
  const pending = Object.keys(S.drafts).filter((k) => S.drafts[k].dirty);
  if (pending.length) {
    const ok = await confirmDialog({ title: 'Ada penilaian belum tersinkron', message: 'Draf penilaian di perangkat ini belum terkirim ke server. Keluar sekarang akan menghapusnya.', okText: 'Tetap keluar', danger: true });
    if (!ok) return;
  }
  const t = S.token;
  if (t) call('auth.logout', {}).catch(() => { /* abaikan */ });
  pending.forEach((k) => LS.del('sg_draft_' + k));
  clearSession();
  showLogin();
}

// ═════════════════════════════════════════════════════════════════════════
// BAGIAN 9 — BOOTSTRAP & SINKRON LATAR
// ═════════════════════════════════════════════════════════════════════════
function applyBootstrap(b, fresh) {
  if (!b) return;
  S.data = b;
  if (b.me) S.me = b.me;
  if (fresh) S.lastSync = Date.now();
  reindex();
  persist();
}

/** Muat ulang data di latar tanpa mengganggu pengguna yang sedang mengetik. */
function refreshData(silent) {
  if (!S.token) return Promise.resolve();
  return call('auth.bootstrap', {}).then((d) => {
    if (!d.bootstrap) { S.me = d.user; showChangePassword(true); return; }
    if (S.editing || modalStack.length) { S.pendingRefresh = d.bootstrap; return; }
    applyBootstrap(d.bootstrap, true);
    renderShell();
    rerender();
    if (!silent) toast('success', 'Data diperbarui');
  }).catch((e) => { if (!silent && e.code !== 'AUTH' && e.code !== 'STALE') toast('error', 'Gagal memperbarui data', e.message); });
}
function applyPendingRefresh() {
  if (!S.pendingRefresh) return;
  const b = S.pendingRefresh; S.pendingRefresh = null;
  // Pertahankan draf lokal yang lebih baru
  applyBootstrap(b, true);
  renderShell();
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && S.token && Date.now() - S.lastSync > 60000) refreshData(true);
});

// ═════════════════════════════════════════════════════════════════════════
// BAGIAN 10 — SHELL: sidebar per peran, topbar, router SPA
// ═════════════════════════════════════════════════════════════════════════
const VIEWS = {};   // diisi file tampilan: VIEWS[id] = { title, icon, roles, render(), parent?, hidden? }

function navFor(r) {
  if (r === ROLE.ADMIN) return [
    { sec: 'Utama' }, 'dashboard',
    { sec: 'Data Master' }, 'akun', 'guru', 'periode', 'rubrik', 'rujukan',
    { sec: 'Laporan' }, 'laporan', 'audit',
    { sec: 'Sistem' }, 'pengaturan'
  ];
  if (r === ROLE.KEPSEK || r === ROLE.PLH) return [
    'dashboard', 'jadwal', 'penilaian', 'rekomendasi', 'laporan'].concat(r === ROLE.KEPSEK ? ['audit'] : []);
  if (r === ROLE.GURU) return ['dashboard', 'jadwal', 'hasil-saya'];
  return ['dashboard'];
}
function navBadge(id) {
  if (!S.data) return '';
  if (id === 'penilaian') { const n = sessionsActive().filter((s) => s.status === 'draft').length; return n ? `<span class="badge">${n}</span>` : ''; }
  if (id === 'rekomendasi') { const n = sessionsActive().filter((s) => s.status === 'observasi_selesai' || s.status === 'menunggu_tinjauan').length; return n ? `<span class="badge ai">${n}</span>` : ''; }
  if (id === 'hasil-saya') { const n = sessionsActive().filter((s) => s.status === 'disahkan' && !fusOf(s.supervision_id).length).length; return n ? `<span class="badge">${n}</span>` : ''; }
  return '';
}

function renderShell() {
  if (!S.me) return;
  const r = role();
  $('#sbBrand').innerHTML = `${brandLogo()}<div class="grow"><b>${esc(setting('school_name') || 'SMA Triguna 1956')}</b><small>${r === ROLE.ADMIN ? 'Panel Administrasi' : 'Supervisi Guru'}</small></div>`;
  $('#sbNav').innerHTML = navFor(r).map((it) => {
    if (typeof it === 'object') return `<div class="sb-sec">${esc(it.sec)}</div>`;
    const v = VIEWS[it];
    if (!v) return '';
    const active = S.route === it || (VIEWS[S.route] && VIEWS[S.route].parent && parentOf(S.route) === it);
    return `<button class="nav-item ${active ? 'active' : ''}" data-act="nav" data-route="${it}" ${active ? 'aria-current="page"' : ''}>${icon(v.icon)}<span>${esc(v.nav || v.title)}</span>${navBadge(it)}</button>`;
  }).join('');
  const p = activePeriod();
  $('#chipSem').innerHTML = `${icon('calendar', 'xs')} ${esc(periodLabel(p))}`;
  $('#chipRole').textContent = ROLE_LABEL[r] || r;
  $('#meText').innerHTML = `<b>${esc(S.me.nama)}</b><small>${esc(ROLE_LABEL[S.me.role] || S.me.role)} · @${esc(S.me.username)}</small>`;
  $('#meAvatar').className = 'avatar ' + avatarCls(S.me.user_id);
  $('#meAvatar').textContent = initials(S.me.nama);
  syncThemeSwitch();
}
function parentOf(route) { const v = VIEWS[route]; if (!v) return route; return typeof v.parent === 'function' ? v.parent() : (v.parent || route); }

function crumbs(list) {
  $('#crumbs').innerHTML = list.map((c, i) => i === list.length - 1 ? `<b>${esc(c)}</b>` : `<span>${esc(c)}</span>${icon('chevRight', 'xs')}`).join('');
}

/** Router SPA — satu-satunya cara pindah halaman. Tanpa server, tanpa ubah URL. */
function navigate(route, params, opts) {
  opts = opts || {};
  const v = VIEWS[route];
  if (!v || (v.roles && v.roles.indexOf(role()) < 0)) route = 'dashboard';
  if (S.route === 'assess' && route !== 'assess') flushDraft(S.params.id);
  S.editing = false;
  applyPendingRefresh();
  S.route = route;
  S.params = params || {};
  if (!opts.noSave) LS.set('sg_route', { route: S.route, params: S.params });
  closeSidebar();
  rerender();
  if (!opts.keepScroll) window.scrollTo(0, 0);
}

function rerender() {
  if (!S.me || !S.data) return;
  const v = VIEWS[S.route] || VIEWS.dashboard;
  const parent = VIEWS[parentOf(S.route)];
  crumbs([setting('school_name') ? 'Supervisi Guru' : 'Beranda'].concat(parent && parent !== v ? [parent.title] : []).concat([v.crumb ? v.crumb() : v.title]));
  renderShell();
  const c = $('#content');
  const y = window.scrollY;
  let html;
  try { html = v.render(S.params); } catch (e) { console.error(e); html = emptyState('Halaman gagal ditampilkan', e.message); }
  c.innerHTML = `<div class="view">${html}</div>`;
  if (v.after) try { v.after(S.params); } catch (e) { console.error(e); }
  if (S._keepY) { window.scrollTo(0, y); S._keepY = false; }
}
/** Render ulang tanpa lompat ke atas (setelah aksi kecil). */
function softRender() { S._keepY = true; rerender(); }

function enterApp() {
  $('#auth').classList.remove('on');
  $('#auth').innerHTML = '';
  $('#app').classList.add('on');
  $('#splash').classList.add('hide');
  const last = LS.get('sg_route', null);
  const r = last && VIEWS[last.route] && (!VIEWS[last.route].roles || VIEWS[last.route].roles.indexOf(role()) > -1) ? last : { route: 'dashboard', params: {} };
  S.route = r.route; S.params = r.params || {};
  renderShell();
  rerender();
}

function openSidebar() { $('#sidebar').classList.add('open'); $('#scrim').classList.add('on'); }
function closeSidebar() { $('#sidebar').classList.remove('open'); $('#scrim').classList.remove('on'); }
window.addEventListener('scroll', () => { const t = $('#topbar'); if (t) t.classList.toggle('scrolled', window.scrollY > 4); }, { passive: true });

// ── Tema ─────────────────────────────────────────────────────────────
function syncThemeSwitch() {
  const dark = document.documentElement.getAttribute('data-theme') === 'dark';
  const sw = $('#themeSwitch');
  if (sw) sw.setAttribute('aria-checked', String(dark));
  const ti = $('#themeIcon');
  if (ti) ti.innerHTML = icon(dark ? 'moon' : 'sun', 'sm');
}
function toggleTheme() {
  const html = document.documentElement;
  const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  document.body.classList.add('theme-anim');
  html.setAttribute('data-theme', next);
  LS.set('sg_theme', next);
  try { localStorage.setItem('sg_theme', next); } catch (e) { /* abaikan */ }
  syncThemeSwitch();
  setTimeout(() => document.body.classList.remove('theme-anim'), 320);
}

function openMeMenu(btn) {
  popMenu(btn, [
    { icon: 'user', label: 'Profil & ganti password', fn: () => navigate('profil') },
    { icon: 'refresh', label: 'Muat ulang data', fn: () => refreshData(false) },
    { icon: document.documentElement.getAttribute('data-theme') === 'dark' ? 'sun' : 'moon', label: 'Ganti tema', fn: toggleTheme },
    { sep: true },
    { icon: 'logout', label: 'Keluar', danger: true, fn: logout }
  ]);
}

// ═════════════════════════════════════════════════════════════════════════
// BAGIAN 11 — DELEGASI EVENT (data-act / data-input) — tanpa onclick inline
// ═════════════════════════════════════════════════════════════════════════
const ACT = {
  nav: (el) => navigate(el.dataset.route, el.dataset.id ? { id: el.dataset.id } : {}),
  go: (el) => navigate(el.dataset.route, JSON.parse(el.dataset.params || '{}')),
  openSidebar, closeSidebar, toggleTheme, logout,
  openMe: (el) => openMeMenu(el),
  refresh: () => refreshData(false),
  togglePw: (el) => { const i = $('#' + el.dataset.target); const show = i.type === 'password'; i.type = show ? 'text' : 'password'; el.innerHTML = icon(show ? 'eyeOff' : 'eye', 'sm'); el.setAttribute('aria-label', show ? 'Sembunyikan password' : 'Tampilkan password'); },
  acc: (el) => { el.closest('.acc').classList.toggle('open'); el.setAttribute('aria-expanded', el.closest('.acc').classList.contains('open')); },
  tab: (el) => { S.ui[el.dataset.key] = el.dataset.tab; softRender(); },
  setUi: (el) => { S.ui[el.dataset.key] = el.dataset.val; softRender(); }
};
const INPUT = {
  pwMeter: (el) => updatePwMeter(el),
  uiFilter: debounce((el) => { S.ui[el.dataset.key] = el.value; S.ui[el.dataset.key + '_page'] = 1; softRenderKeepFocus(el); }, 250)
};
function softRenderKeepFocus(el) {
  const id = el.id, pos = el.selectionStart;
  softRender();
  const n = id && document.getElementById(id);
  if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) { /* abaikan */ } }
}
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const fn = ACT[el.dataset.act];
  if (fn) { e.preventDefault(); fn(el, e); }
});
document.addEventListener('input', (e) => { const el = e.target.closest('[data-input]'); if (el && INPUT[el.dataset.input]) INPUT[el.dataset.input](el, e); });
document.addEventListener('change', (e) => { const el = e.target.closest('[data-change]'); if (el && ACT[el.dataset.change]) ACT[el.dataset.change](el, e); });
document.addEventListener('keydown', (e) => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-act][role="button"], tr[data-act]')) { e.preventDefault(); e.target.click(); }
});

/** Paginasi sederhana dari state lokal. */
function paginate(list, key, size) {
  size = size || 10;
  const pages = Math.max(1, Math.ceil(list.length / size));
  const page = clamp(Number(S.ui[key + '_page'] || 1), 1, pages);
  const slice = list.slice((page - 1) * size, page * size);
  const btns = [];
  for (let i = 1; i <= pages; i++) if (i === 1 || i === pages || Math.abs(i - page) <= 1) btns.push(i); else if (btns[btns.length - 1] !== '…') btns.push('…');
  const html = `<div class="pager"><span>Menampilkan ${list.length ? (page - 1) * size + 1 : 0}–${Math.min(page * size, list.length)} dari ${list.length}</span>
    <div class="pages"><button data-act="page" data-key="${key}" data-p="${page - 1}" ${page <= 1 ? 'disabled' : ''} aria-label="Sebelumnya">${icon('chevLeft', 'sm')}</button>
    ${btns.map((b) => b === '…' ? '<button disabled>…</button>' : `<button data-act="page" data-key="${key}" data-p="${b}" class="${b === page ? 'on' : ''}">${b}</button>`).join('')}
    <button data-act="page" data-key="${key}" data-p="${page + 1}" ${page >= pages ? 'disabled' : ''} aria-label="Berikutnya">${icon('chevRight', 'sm')}</button></div></div>`;
  return { slice, html };
}
ACT.page = (el) => { S.ui[el.dataset.key + '_page'] = Number(el.dataset.p); softRender(); };

/** Muat detail sesi lama sesuai kebutuhan (lazy). */
function ensureDetail(id) {
  if (!id || S.loaded.has(id) || (S._loading && S._loading[id])) return !!(S.loaded && S.loaded.has(id));
  S._loading = S._loading || {};
  S._loading[id] = true;
  call('supervisions.detail', { supervision_id: id }).then((d) => {
    upsertLocal('supervisions', d.supervision);
    S.data.assessments = tbl('assessments').filter((a) => a.supervision_id !== id).concat(d.assessments);
    S.data.recommendations = tbl('recommendations').filter((a) => a.supervision_id !== id).concat(d.recommendations);
    S.data.followups = tbl('followups').filter((a) => a.supervision_id !== id).concat(d.followups);
    S.data.loaded_detail = (S.data.loaded_detail || []).concat([id]);
    reindex(); persist();
    delete S._loading[id];
    softRender();
  }).catch((e) => { delete S._loading[id]; toast('error', 'Gagal memuat detail', e.message); });
  return false;
}
