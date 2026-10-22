// ═════════════════════════════════════════════════════════════════════════
// BAGIAN 21 — ADMIN: dashboard kesiapan semester
// ═════════════════════════════════════════════════════════════════════════
function progressCounts() {
  const teachersActive = tbl('teachers').filter((t) => t.status === 'aktif');
  const rank = { terjadwal: 1, draft: 2, observasi_selesai: 3, menunggu_tinjauan: 3, disahkan: 4, tindak_lanjut: 4, selesai: 4 };
  const by = {};
  sessionsActive().forEach((s) => { if (!by[s.teacher_id] || rank[s.status] > rank[by[s.teacher_id].status]) by[s.teacher_id] = s; });
  const c = { final: 0, wait: 0, draft: 0, sched: 0 };
  Object.values(by).forEach((s) => { if (isFinal(s)) c.final++; else if (rank[s.status] === 3) c.wait++; else if (s.status === 'draft') c.draft++; else c.sched++; });
  c.total = Math.max(teachersActive.length, Object.keys(by).length);
  c.none = Math.max(0, c.total - c.final - c.wait - c.draft - c.sched);
  return c;
}
function rubricCheck(version) {
  const cats = {};
  (S.ix.rubric[version] || []).filter((r) => r.active).forEach((r) => { cats[r.category_no] = Number(r.category_weight) || 0; });
  const total = Math.round(Object.values(cats).reduce((a, b) => a + b, 0) * 100) / 100;
  return { total, cats: Object.keys(cats).length, ok: Math.abs(total - 100) < 0.001, indicators: (S.ix.rubric[version] || []).filter((r) => r.active).length };
}
const ACTION_LABEL = {
  LOGIN: 'Masuk', LOGIN_FAILED: 'Gagal masuk', ACCOUNT_LOCKED: 'Akun terkunci', LOGOUT: 'Keluar', PASSWORD_CHANGE: 'Ganti password', RESET_PASSWORD: 'Reset password',
  USER_CREATE: 'Akun dibuat', USER_UPDATE: 'Akun diubah', ROLE_CHANGE: 'Peran diubah', USER_ACTIVATE: 'Akun diaktifkan', USER_DEACTIVATE: 'Akun dinonaktifkan',
  TEACHER_CREATE: 'Guru ditambah', TEACHER_UPDATE: 'Guru diubah', TEACHER_STATUS: 'Status guru', TEACHER_IMPORT: 'Impor guru',
  PERIOD_CREATE: 'Periode dibuat', PERIOD_UPDATE: 'Periode diubah', PERIOD_ACTIVATE: 'Periode diaktifkan',
  RUBRIC_DRAFT: 'Draf rubrik', RUBRIC_UPDATE: 'Rubrik diubah', RUBRIC_ACTIVATE: 'Rubrik diaktifkan', RUBRIC_DRAFT_DELETE: 'Draf rubrik dihapus',
  REFERENCE_CREATE: 'Rujukan ditambah', REFERENCE_UPDATE: 'Rujukan diubah', SETTINGS_UPDATE: 'Pengaturan diubah',
  SCHEDULE_CREATE: 'Jadwal dibuat', SCHEDULE_UPDATE: 'Jadwal diubah', SCHEDULE_DELETE: 'Jadwal dihapus', OBSERVATION_START: 'Observasi dimulai', SCORE_CHANGE: 'Skor diubah',
  OBSERVATION_COMPLETE: 'Observasi selesai', AI_GENERATE: 'Rekomendasi disusun', AI_REVIEW: 'Rekomendasi ditinjau', AI_MANUAL: 'Rekomendasi manual',
  FINAL_APPROVAL: 'Hasil disahkan', REOPEN: 'Dibuka kembali', REFLECTION_SAVE: 'Refleksi disimpan', FOLLOWUP_CREATE: 'Tindak lanjut dibuat', FOLLOWUP_UPDATE: 'Tindak lanjut diubah',
  FOLLOWUP_DELETE: 'Tindak lanjut dihapus', FOLLOWUP_REVIEW: 'Tindak lanjut ditinjau', FOLLOWUP_VERIFY: 'Tindak lanjut diverifikasi', REPORT_PDF: 'PDF dibuat', SETUP: 'Setup sistem', EMERGENCY_RESET: 'Reset darurat'
};
function actionTone(a) {
  if (/FAILED|LOCKED|RESET|DELETE|DEACTIVATE|EMERGENCY/.test(a)) return 'red';
  if (/RUBRIC|AI_/.test(a)) return 'violet';
  if (/APPROVAL|VERIFY|ACTIVATE|COMPLETE/.test(a)) return 'green';
  if (/SCORE|REOPEN|ROLE/.test(a)) return 'amber';
  return 'blue';
}

function renderAdminDashboard() {
  const users = tbl('users');
  const active = users.filter((u) => u.status === 'aktif');
  const teachers = tbl('teachers').filter((t) => t.status === 'aktif');
  const linked = teachers.filter((t) => users.some((u) => u.role === 'GURU' && u.teacher_id === t.teacher_id && u.status === 'aktif'));
  const p = activePeriod();
  const ver = activeRubricVersion();
  const rc = rubricCheck(ver);
  const hasKepsek = users.some((u) => u.role === 'KEPSEK' && u.status === 'aktif');
  const plh = users.filter((u) => u.role === 'PLH' && u.status === 'aktif');
  const checks = [
    { ok: !!p, t: p ? `Periode aktif ditetapkan (${periodLabel(p)})` : 'Tetapkan periode semester aktif', d: p ? `${fmtDate(p.tanggal_mulai)} – ${fmtDate(p.tanggal_selesai)}` : 'Supervisi baru tidak dapat dijadwalkan tanpa periode aktif', route: 'periode', cta: p ? 'Ubah' : 'Atur' },
    { ok: rc.ok, t: rc.ok ? `Rubrik v${ver} aktif (total bobot 100%)` : `Total bobot rubrik v${ver} = ${rc.total}%`, d: `${rc.cats} dimensi · ${rc.indicators} indikator`, route: 'rubrik', cta: 'Kelola' },
    { ok: teachers.length > 0 && linked.length === teachers.length, t: `${linked.length} dari ${teachers.length} guru terhubung ke akun`, d: 'Setiap guru memerlukan akun untuk melihat hasil & menulis tindak lanjut', route: 'akun', cta: 'Cek' },
    { ok: hasKepsek, t: hasKepsek ? 'Akun Kepala Sekolah aktif' : 'Buat akun Kepala Sekolah', d: 'Penilai utama supervisi', route: 'akun', cta: hasKepsek ? 'Lihat' : 'Buat' },
    { ok: plh.length > 0, optional: true, t: plh.length ? `PLH ditunjuk: ${plh.map((u) => u.nama).join(', ')}` : 'Penunjukan Pelaksana Supervisi (PLH)', d: plh.length ? `s.d. ${fmtDate(plh[0].plh_to)}` : 'Opsional — bila kepala sekolah berhalangan', route: 'akun', cta: plh.length ? 'Kelola' : 'Tunjuk PLH' }
  ];
  const required = checks.filter((c) => !c.optional);
  const pct = Math.round((required.filter((c) => c.ok).length / required.length) * 100);
  const pc = progressCounts();
  const P = (n) => pc.total ? (n / pc.total) * 100 : 0;
  const audit = (S.data.recent_audit || []).slice(0, 6);
  return `<div class="page-head"><div><div class="eyebrow">${icon('calendar', 'xs')} ${esc(periodLabel(p))}</div><h1>Pusat Kesiapan & Administrasi Supervisi</h1>
      <p class="sub">Pantau kesiapan data akademik, akun pengguna, periode aktif, dan rubrik sebelum pelaksanaan supervisi.</p></div>
      <div class="head-actions"><button class="btn ghost" data-act="refresh">${icon('refresh', 'sm')} Sinkronkan Data</button><button class="btn" data-act="userModal">${icon('plus', 'sm')} Tambah Akun</button></div></div>
    <div class="grid g4">
      <div class="card"><div class="stat"><span class="tag pill blue">Aktif</span><span class="ic">${icon('shield')}</span><span class="num">${active.length}</span><span class="lbl">Akun Pengguna Aktif</span><span class="foot">${icon('users', 'xs')} ${users.filter((u) => u.role === 'GURU').length} Guru · ${users.filter((u) => u.role === 'KEPSEK').length} Kepsek · ${users.filter((u) => u.role === 'PLH').length} PLH</span></div></div>
      <div class="card"><div class="stat"><span class="tag pill ${linked.length === teachers.length && teachers.length ? 'green' : 'amber'}">${teachers.length ? Math.round((linked.length / teachers.length) * 100) : 0}% terhubung</span><span class="ic green">${icon('cap')}</span><span class="num">${teachers.length}</span><span class="lbl">Total Guru Aktif</span><span class="foot">${linked.length} memiliki akun</span></div></div>
      <div class="card"><div class="stat"><span class="tag pill blue">${esc(p ? p.semester : '–')}</span><span class="ic">${icon('calendar')}</span><span class="num" style="font-size:24px">${esc(p ? p.tahun_ajaran : '–')}</span><span class="lbl">Periode Semester Aktif</span><span class="foot">${icon('clock', 'xs')} ${p ? 'Berakhir ' + fmtDate(p.tanggal_selesai) : 'Belum ditetapkan'}</span></div></div>
      <div class="card"><div class="stat"><span class="tag pill violet">Terkunci</span><span class="ic violet">${icon('layers')}</span><span class="num">v${esc(ver)}</span><span class="lbl">Versi Rubrik Aktif</span><span class="foot" style="color:${rc.ok ? 'var(--success)' : 'var(--danger)'}">${icon(rc.ok ? 'check' : 'alert', 'xs')} Total bobot ${rc.total}%</span></div></div>
    </div>
    <div class="card mt24"><div class="row wrap" style="gap:16px;margin-bottom:20px">${ringPct(pct, 'Kesiapan ' + pct + '%')}<div class="grow"><div class="row wrap" style="gap:8px"><h3>Kesiapan Semester — ${esc(periodLabel(p))}</h3><span class="pill green">${required.filter((c) => c.ok).length} / ${required.length} langkah</span></div>
      <p class="small muted">Seluruh prasyarat utama harus siap sebelum observasi kelas dimulai.</p></div></div>
      <div class="stack" style="gap:10px">${checks.map((c) => `<div class="check-row"><span class="check-ic ${c.ok ? '' : 'pending'}">${icon(c.ok ? 'check' : c.optional ? 'hourglass' : 'alert', 'sm')}</span><div class="grow"><b style="display:block;font-weight:600">${esc(c.t)}</b><small class="muted">${esc(c.d)}</small></div>
        <button class="btn ${c.ok || c.optional ? 'plain' : ''} sm" data-act="nav" data-route="${c.route}">${esc(c.cta)} ${icon('arrowRight', 'xs')}</button></div>`).join('')}</div>
      ${pct === 100 ? `<div class="okbox mt16">${icon('checkCircle', 'sm')}<span>Sistem siap melaksanakan jadwal supervisi oleh Kepala Sekolah.</span></div>` : ''}</div>
    <div class="grid g2 mt24">
      <div class="card"><div class="card-head"><div><h3>Progres Supervisi Semester Berjalan</h3><p class="sub">Target ${pc.total} guru</p></div><span class="pill green">${Math.round(P(pc.final))}% selesai</span></div>
        <div class="stackbar"><i style="width:${P(pc.final)}%;background:var(--success)"></i><i style="width:${P(pc.wait)}%;background:var(--warning)"></i><i style="width:${P(pc.draft)}%;background:var(--text-faint)"></i><i style="width:${P(pc.sched)}%;background:var(--primary)"></i></div>
        <div class="row between small muted mt8"><span>0 guru</span><b style="color:var(--text)">${pc.final} dari ${pc.total} guru disahkan</b><span>${pc.total}</span></div>
        <div class="legend" style="grid-template-columns:repeat(2,1fr)">${legend('var(--success)', 'Disahkan', pc.final, pc.total)}${legend('var(--warning)', 'Menunggu', pc.wait, pc.total)}${legend('var(--text-faint)', 'Draft', pc.draft, pc.total)}${legend('var(--primary)', 'Terjadwal', pc.sched, pc.total)}</div></div>
      <div class="card"><div class="card-head"><div><h3>Aktivitas Terbaru Sistem</h3><p class="sub">Jejak audit otomatis</p></div><span class="pill green dot">Tercatat</span></div>
        ${audit.length ? `<div class="list">${audit.map((a) => `<div class="li">${avatar(a.actor_name, a.actor_id)}<div class="grow"><b class="ellipsis">${esc(a.actor_name)} <span class="muted" style="font-weight:400">(${esc(ROLE_LABEL[a.role] || a.role)})</span></b><small class="ellipsis">${esc(ACTION_LABEL[a.action] || a.action)} · ${esc(a.record_id)}</small></div><div style="text-align:right"><span class="xs muted">${fmtTs(a.timestamp)}</span><br><span class="pill ${actionTone(a.action)}">${esc(a.action)}</span></div></div>`).join('')}</div>` : '<p class="small muted">Belum ada aktivitas.</p>'}
        <button class="btn plain mt16" data-act="nav" data-route="audit">Lihat seluruh log audit ${icon('arrowRight', 'xs')}</button></div>
    </div>`;
}

// ═════════════════════════════════════════════════════════════════════════
// BAGIAN 22 — AKUN PENGGUNA (RBAC, reset password, PLH)
// ═════════════════════════════════════════════════════════════════════════
VIEWS.akun = {
  title: 'Akun Pengguna', icon: 'users', roles: ['ADMIN'],
  render: () => {
    const users = tbl('users');
    const f = S.ui, q = (f.ak_q || '').toLowerCase();
    const list = users.filter((u) => (!q || (u.nama + ' ' + u.username + ' ' + (S.ix.teachers[u.teacher_id] || {}).nip).toLowerCase().indexOf(q) > -1) && (!f.ak_role || u.role === f.ak_role)
      && (!f.ak_st || (f.ak_st === 'terkunci' ? u.locked : u.status === f.ak_st))).sort((a, b) => { const rk = { ADMIN: 0, KEPSEK: 1, PLH: 2, GURU: 3 }; return (rk[a.role] - rk[b.role]) || natCmp(a.nama, b.nama); });
    const pg = paginate(list, 'ak', 12);
    const teachers = tbl('teachers').filter((t) => t.status === 'aktif');
    const linked = teachers.filter((t) => users.some((u) => u.role === 'GURU' && u.teacher_id === t.teacher_id));
    const plh = users.filter((u) => u.role === 'PLH' && u.status === 'aktif');
    const locked = users.filter((u) => u.locked);
    return `<div class="page-head"><div><div class="eyebrow">${icon('shield', 'xs')} Role-based access control</div><h1>Manajemen Akun Pengguna</h1>
      <p class="sub">Kelola akun login, peran (Admin, Kepala Sekolah, PLH, Guru), dan reset password. Tidak ada pendaftaran mandiri.</p></div>
      <div class="head-actions"><button class="btn ghost" data-act="exportUsers">${icon('download', 'sm')} Ekspor</button><button class="btn" data-act="userModal">${icon('plus', 'sm')} Tambah Akun Baru</button></div></div>
      <div class="grid g4 mb16">
        ${miniStat('Total Akun Terdaftar', users.length, 'users', '', `${users.filter((u) => u.status === 'aktif').length} aktif`)}
        ${miniStat('Guru Terhubung', linked.length + '/' + teachers.length, 'idcard', '', teachers.length - linked.length ? `${teachers.length - linked.length} guru belum punya akun` : 'Semua terhubung')}
        ${miniStat('Mandat PLH Aktif', plh.length, 'star', 'violet', plh.length ? 's.d. ' + fmtDate(plh[0].plh_to) : 'Belum ditunjuk')}
        ${miniStat('Akun Terkunci', locked.length, 'lock', locked.length ? 'red' : '', locked.length ? '5× salah password' : 'Tidak ada')}
      </div>
      <div class="card pad-0"><div style="padding:16px" class="toolbar">
        <div class="input-icon">${icon('search', 'sm')}<input id="akQ" class="input" placeholder="Cari nama, NIP, atau username…" value="${esc(f.ak_q || '')}" data-input="uiFilter" data-key="ak_q"></div>
        <select class="select" data-change="uiSelect" data-key="ak_role" aria-label="Peran"><option value="">Semua peran</option>${['ADMIN', 'KEPSEK', 'PLH', 'GURU'].map((r) => `<option value="${r}" ${f.ak_role === r ? 'selected' : ''}>${ROLE_LABEL[r]}</option>`).join('')}</select>
        <select class="select" data-change="uiSelect" data-key="ak_st" aria-label="Status"><option value="">Semua status</option><option value="aktif" ${f.ak_st === 'aktif' ? 'selected' : ''}>Aktif</option><option value="nonaktif" ${f.ak_st === 'nonaktif' ? 'selected' : ''}>Nonaktif</option><option value="terkunci" ${f.ak_st === 'terkunci' ? 'selected' : ''}>Terkunci</option></select></div>
      <div class="table-wrap"><table class="t cards"><thead><tr><th>Nama & username</th><th>Peran</th><th>Terhubung ke data guru</th><th>Status</th><th>Login terakhir</th><th></th></tr></thead><tbody>
      ${pg.slice.map((u) => { const t = S.ix.teachers[u.teacher_id]; return `<tr class="${u.locked ? 'row-warn' : ''}" style="${u.status !== 'aktif' ? 'opacity:.6' : ''}">
        <td class="lead"><div class="who">${avatar(u.nama, u.user_id)}<div><b>${esc(u.nama)}${u.user_id === S.me.user_id ? ' <span class="pill blue">Anda</span>' : ''}</b><small>@${esc(u.username)}${t && t.nip ? ' · NIP ' + esc(t.nip) : ''}</small></div></div></td>
        <td data-l="Peran">${rolePill(u)}</td>
        <td data-l="Data guru">${u.role === 'GURU' ? (t ? `<span class="small">${icon('cap', 'xs')} ${esc(t.mapel)}</span>` : '<span class="pill amber">Belum terhubung</span>') : '<span class="small muted">Non-guru</span>'}</td>
        <td data-l="Status">${u.locked ? `<span class="pill red">${icon('lock', 'xs')} Terkunci</span>` : u.status === 'aktif' ? '<span class="pill green dot">Aktif</span>' : '<span class="pill">Nonaktif</span>'}${u.must_change_password ? '<br><span class="xs muted">Wajib ganti password</span>' : ''}</td>
        <td data-l="Login terakhir" class="small">${u.last_login ? fmtTs(u.last_login) : '<span class="faint">Belum pernah</span>'}</td>
        <td><div class="acts"><button class="icon-btn" data-act="userModal" data-id="${u.user_id}" aria-label="Ubah">${icon('edit', 'sm')}</button>
          ${u.user_id !== S.me.user_id ? `<button class="icon-btn" data-act="resetPw" data-id="${u.user_id}" aria-label="Reset password" title="Reset password">${icon('key', 'sm')}</button>
          <button class="icon-btn ${u.status === 'aktif' ? 'del' : ''}" data-act="userStatus" data-id="${u.user_id}" aria-label="${u.status === 'aktif' ? 'Nonaktifkan' : 'Aktifkan'}" title="${u.status === 'aktif' ? 'Nonaktifkan' : 'Aktifkan'}">${icon(u.status === 'aktif' ? 'ban' : 'checkCircle', 'sm')}</button>` : `<button class="icon-btn" data-act="nav" data-route="profil" aria-label="Ganti password saya" title="Ganti password saya">${icon('key', 'sm')}</button>`}</div></td></tr>`; }).join('')}
      </tbody></table></div>${pg.html}</div>`;
  }
};
function miniStat(label, n, ic, tone, foot) {
  return `<div class="card" style="padding:18px"><div class="row between" style="align-items:flex-start"><div><span class="small muted">${esc(label)}</span><div style="font-family:var(--font-head);font-weight:700;font-size:26px;line-height:34px">${esc(n)}</div><span class="xs" style="color:${tone === 'red' ? 'var(--danger)' : 'var(--text-muted)'}">${esc(foot)}</span></div><span class="stat"><span class="ic ${tone}" style="margin:0">${icon(ic)}</span></span></div></div>`;
}
function rolePill(u) {
  if (u.role === 'PLH') { const on = u.effective_role === 'PLH'; return `<span class="pill ${on ? 'violet' : ''}">${icon('star', 'xs')} PLH ${on ? '(aktif s.d. ' + fmtDate(u.plh_to) + ')' : '(di luar masa tugas)'}</span>`; }
  return `<span class="pill ${{ ADMIN: 'navy', KEPSEK: 'blue', GURU: 'green' }[u.role] || ''}">${esc(ROLE_LABEL[u.role])}</span>`;
}

ACT.userModal = (el) => userModal(el.dataset.id ? S.ix.users[el.dataset.id] : null, el.dataset.teacher);
function userModal(u, presetTeacher) {
  const v = u || { role: presetTeacher ? 'GURU' : 'GURU', teacher_id: presetTeacher || '' };
  const users = tbl('users');
  const free = tbl('teachers').filter((t) => t.status === 'aktif' && (t.teacher_id === v.teacher_id || !users.some((x) => x.role === 'GURU' && x.teacher_id === t.teacher_id))).sort((a, b) => natCmp(a.nama, b.nama));
  const roles = [['ADMIN', 'Admin', 'Sistem penuh'], ['KEPSEK', 'Kepsek', 'Penilai utama'], ['PLH', 'PLH', 'Wakil penilai'], ['GURU', 'Guru', 'Disupervisi']];
  const m = openModal({
    title: u ? 'Ubah Akun Pengguna' : 'Tambah Akun Pengguna', icon: 'user', sub: u ? 'ID ' + u.user_id : 'Password sementara dibuat otomatis dan ditampilkan sekali.',
    body: `<div class="form-grid">
      <div class="field"><label for="uN">Nama lengkap (dengan gelar) <span class="req">*</span></label><input id="uN" class="input" value="${esc(v.nama || (presetTeacher ? (S.ix.teachers[presetTeacher] || {}).nama : '') || '')}"></div>
      <div class="field"><label for="uU">Username (ID login) <span class="req">*</span></label><div class="input-icon"><span style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--text-faint)">@</span><input id="uU" class="input" style="padding-left:30px" value="${esc(v.username || '')}" autocapitalize="none" spellcheck="false" placeholder="nama.belakang"></div><span class="hint">3–30 karakter: huruf kecil, angka, titik, garis bawah.</span></div>
      <div class="field"><label>Peran sistem <span class="req">*</span></label><div class="seg" id="uR">${roles.map(([k, l, d]) => `<button type="button" data-r="${k}" class="${v.role === k ? 'on' : ''}">${l}<small>${d}</small></button>`).join('')}</div></div>
      <div class="field" id="uTWrap"><label for="uT">Hubungkan ke data guru <span class="req">*</span></label><select id="uT" class="select"><option value="">— Pilih guru —</option>${free.map((t) => `<option value="${t.teacher_id}" ${v.teacher_id === t.teacher_id ? 'selected' : ''}>${esc(t.nama)} — ${esc(t.mapel)}${t.nip ? ' (NIP ' + esc(t.nip) + ')' : ''}</option>`).join('')}</select>${!free.length ? '<span class="hint">Semua guru sudah terhubung. Tambahkan data guru terlebih dahulu.</span>' : ''}</div>
      <div class="card ai-soft" id="uPWrap" style="padding:16px"><b class="row" style="gap:8px">${icon('star', 'sm')} Penunjukan Pelaksana Supervisi (PLH)</b><p class="xs muted mt8">Memberikan hak penilaian sama dengan Kepala Sekolah selama masa tugas. Setiap tindakan tercatat atas nama PLH.</p>
        <div class="form-grid two mt12"><div class="field"><label for="uF">Mulai berlaku</label><input id="uF" type="date" class="input" value="${esc(v.plh_from || today())}"></div><div class="field"><label for="uTo">Berakhir pada</label><input id="uTo" type="date" class="input" value="${esc(v.plh_to || '')}"></div></div></div>
      <div id="uErr" class="dangerbox" style="display:none">${icon('alert', 'sm')}<span></span></div></div>`,
    footer: `<button class="btn ghost" data-close>Batal</button><button class="btn" id="uSave">${icon('save', 'sm')} Simpan Akun</button>`
  });
  const el = m.el;
  let r = v.role;
  const sync = () => { $('#uTWrap', el).style.display = r === 'GURU' ? '' : 'none'; $('#uPWrap', el).style.display = r === 'PLH' ? '' : 'none'; $$('#uR button', el).forEach((b) => b.classList.toggle('on', b.dataset.r === r)); };
  $$('#uR button', el).forEach((b) => b.onclick = () => { r = b.dataset.r; sync(); });
  $('#uT', el).addEventListener('change', (e) => {
    const t = S.ix.teachers[e.target.value];
    if (t && !$('#uN', el).value) $('#uN', el).value = t.nama;
    if (t && !$('#uU', el).value) $('#uU', el).value = t.nama.replace(/,.*$/, '').replace(/\b(Dra?|Drs|Hj?|Ir)\.\s*/gi, '').trim().toLowerCase().split(/\s+/).slice(0, 2).join('.').replace(/[^a-z0-9.]/g, '');
  });
  sync();
  $('#uSave', el).onclick = (e) => {
    const payload = { user_id: u ? u.user_id : undefined, nama: $('#uN', el).value.trim(), username: $('#uU', el).value.trim().toLowerCase(), role: r,
      teacher_id: r === 'GURU' ? $('#uT', el).value : '', plh_from: r === 'PLH' ? $('#uF', el).value : '', plh_to: r === 'PLH' ? $('#uTo', el).value : '' };
    const err = (msg) => { const b = $('#uErr', el); b.style.display = 'flex'; b.querySelector('span').textContent = msg; };
    if (!payload.nama) return err('Nama lengkap wajib diisi.');
    if (!/^[a-z0-9._]{3,30}$/.test(payload.username)) return err('Username 3–30 karakter: huruf kecil, angka, titik, atau garis bawah.');
    if (users.some((x) => x.username === payload.username && x.user_id !== payload.user_id)) return err('Username sudah dipakai.');
    if (r === 'GURU' && !payload.teacher_id) return err('Pilih data guru yang dihubungkan.');
    if (r === 'PLH' && (!payload.plh_from || !payload.plh_to || payload.plh_from > payload.plh_to)) return err('Isi rentang tanggal penunjukan PLH dengan benar.');
    btnBusy(e.currentTarget, true, 'Menyimpan…');
    call('users.save', payload).then((d) => {
      upsertLocal('users', d.user);
      S.data.people[d.user.user_id] = { nama: d.user.nama, role: d.user.role };
      persist(); m.close(); softRender();
      if (d.temp_password) showTempPassword(d.user, d.temp_password, true);
      else toast('success', 'Akun diperbarui', d.user.nama);
    }).catch((er) => { btnBusy(e.currentTarget, false); err(er.message); });
  };
}
function showTempPassword(u, pw, isNew) {
  const m = openModal({
    title: isNew ? 'Akun Berhasil Dibuat' : 'Hasil Reset Password', icon: 'key', iconClass: 'green', sticky: true,
    body: `<div class="li mb16">${avatar(u.nama, u.user_id)}<div class="grow"><b>${esc(u.nama)}</b><small class="mono">@${esc(u.username)}</small></div></div>
      <span class="xs muted strong" style="letter-spacing:.06em;text-transform:uppercase">Password sementara</span>
      <div class="secret mt8"><code id="tpCode">${esc(pw)}</code><button class="btn" id="tpCopy">${icon('copy', 'sm')} Salin</button></div>
      <div class="warnbox mt16">${icon('alert', 'sm')}<span><b>Hanya ditampilkan sekali.</b> Sampaikan langsung kepada pengguna. Sistem memaksa pengguna mengganti password saat pertama kali masuk.</span></div>`,
    footer: `<span class="xs muted grow">Tercatat di Log Audit</span><button class="btn navy" data-close>${icon('check', 'sm')} Selesai & Tutup</button>`
  });
  $('#tpCopy', m.el).onclick = async () => { const ok = await copyText(pw); toast(ok ? 'success' : 'warning', ok ? 'Password disalin' : 'Salin manual', ok ? '' : 'Pilih teks lalu salin.'); };
}
ACT.resetPw = async (el) => {
  const u = S.ix.users[el.dataset.id];
  const ok = await confirmDialog({ title: 'Reset password?', icon: 'key', html: `Password <b>${esc(u.nama)}</b> akan diganti dengan password sementara. Sesi yang sedang aktif akan berakhir.`, okText: 'Reset Password' });
  if (!ok) return;
  call('users.resetPassword', { user_id: u.user_id }).then((d) => { upsertLocal('users', d.user); persist(); softRender(); showTempPassword(d.user, d.temp_password, false); })
    .catch((e) => toast('error', 'Gagal reset', e.message));
};
ACT.userStatus = async (el) => {
  const u = S.ix.users[el.dataset.id];
  const to = u.status === 'aktif' ? 'nonaktif' : 'aktif';
  if (to === 'nonaktif') { const ok = await confirmDialog({ title: 'Nonaktifkan akun?', message: `${u.nama} tidak akan bisa masuk sampai diaktifkan kembali.`, okText: 'Nonaktifkan', danger: true }); if (!ok) return; }
  const prev = { status: u.status, locked: u.locked };
  optimistic({ apply: () => upsertLocal('users', { user_id: u.user_id, status: to, locked: false }), revert: () => upsertLocal('users', Object.assign({ user_id: u.user_id }, prev)),
    action: 'users.setStatus', payload: { user_id: u.user_id, status: to }, okMsg: to === 'aktif' ? 'Akun diaktifkan' : 'Akun dinonaktifkan', onDone: (d) => upsertLocal('users', d.user) }).catch(() => {});
};
ACT.exportUsers = () => {
  const rows = tbl('users').map((u) => [u.nama, u.username, ROLE_LABEL[u.role], (S.ix.teachers[u.teacher_id] || {}).nip || '', u.status, u.last_login || ''].map(csvCell).join(';'));
  download('Akun Pengguna ' + today() + '.csv', 'text/csv;charset=utf-8', '﻿' + ['Nama;Username;Peran;NIP;Status;Login Terakhir'].concat(rows).join('\r\n'));
};

// ═════════════════════════════════════════════════════════════════════════
// BAGIAN 23 — DATA GURU (CRUD + impor massal)
// ═════════════════════════════════════════════════════════════════════════
VIEWS.guru = {
  title: 'Data Guru', icon: 'cap', roles: ['ADMIN'],
  render: () => {
    const f = S.ui, q = (f.gr_q || '').toLowerCase();
    const users = tbl('users');
    const all = tbl('teachers');
    const mapels = Array.from(new Set(all.map((t) => t.mapel).filter(Boolean))).sort(natCmp);
    const list = all.filter((t) => (!q || (t.nama + ' ' + t.nip + ' ' + t.mapel + ' ' + t.kelas_diampu).toLowerCase().indexOf(q) > -1) && (!f.gr_map || t.mapel === f.gr_map) && (!f.gr_st || t.status === f.gr_st)).sort((a, b) => natCmp(a.nama, b.nama));
    const pg = paginate(list, 'gr', 12);
    return `<div class="page-head"><div><h1>Data Guru</h1><p class="sub">Master data tenaga pendidik yang akan disupervisi. Hubungkan setiap guru ke akun agar dapat melihat hasilnya.</p></div>
      <div class="head-actions"><button class="btn ghost" data-act="importTeachers">${icon('upload', 'sm')} Impor dari Spreadsheet</button><button class="btn" data-act="teacherModal">${icon('plus', 'sm')} Tambah Guru</button></div></div>
      <div class="card pad-0"><div style="padding:16px" class="toolbar">
        <div class="input-icon">${icon('search', 'sm')}<input id="grQ" class="input" placeholder="Cari nama, NIP, mapel…" value="${esc(f.gr_q || '')}" data-input="uiFilter" data-key="gr_q"></div>
        <select class="select" data-change="uiSelect" data-key="gr_map" aria-label="Mapel"><option value="">Semua mapel</option>${mapels.map((m) => `<option ${f.gr_map === m ? 'selected' : ''}>${esc(m)}</option>`).join('')}</select>
        <select class="select" data-change="uiSelect" data-key="gr_st" aria-label="Status"><option value="">Semua status</option><option value="aktif" ${f.gr_st === 'aktif' ? 'selected' : ''}>Aktif</option><option value="nonaktif" ${f.gr_st === 'nonaktif' ? 'selected' : ''}>Nonaktif</option></select></div>
      ${list.length ? `<div class="table-wrap"><table class="t cards"><thead><tr><th>Nama guru</th><th>Mata pelajaran</th><th>Kelas diampu</th><th>Akun</th><th>Status</th><th></th></tr></thead><tbody>
        ${pg.slice.map((t) => { const acc = users.find((u) => u.role === 'GURU' && u.teacher_id === t.teacher_id); return `<tr style="${t.status !== 'aktif' ? 'opacity:.6' : ''}">
          <td class="lead"><div class="who">${avatar(t.nama, t.teacher_id)}<div><b>${esc(t.nama)}</b><small>NIP ${esc(t.nip || '–')}</small></div></div></td>
          <td data-l="Mapel"><span class="tagchip">${esc(t.mapel)}</span></td><td data-l="Kelas">${String(t.kelas_diampu || '').split(',').filter((k) => k.trim()).map((k) => `<span class="tagchip">${esc(k.trim())}</span>`).join('') || '–'}</td>
          <td data-l="Akun">${acc ? `<span class="pill green">@${esc(acc.username)}</span>` : `<button class="btn plain sm" data-act="userModal" data-teacher="${t.teacher_id}">${icon('plus', 'xs')} Buat Akun</button>`}</td>
          <td data-l="Status">${t.status === 'aktif' ? '<span class="pill green dot">Aktif</span>' : '<span class="pill">Nonaktif</span>'}</td>
          <td><div class="acts"><button class="icon-btn" data-act="teacherModal" data-id="${t.teacher_id}" aria-label="Ubah">${icon('edit', 'sm')}</button>
            <button class="icon-btn ${t.status === 'aktif' ? 'del' : ''}" data-act="teacherStatus" data-id="${t.teacher_id}" aria-label="${t.status === 'aktif' ? 'Nonaktifkan' : 'Aktifkan'}">${icon(t.status === 'aktif' ? 'ban' : 'checkCircle', 'sm')}</button></div></td></tr>`; }).join('')}
      </tbody></table></div>${pg.html}` : emptyState('Belum ada data guru', 'Tambahkan guru satu per satu atau impor dari spreadsheet.', `<button class="btn" data-act="teacherModal">${icon('plus', 'sm')} Tambah Guru</button>`)}</div>`;
  }
};
ACT.teacherModal = (el) => {
  const t = el.dataset.id ? S.ix.teachers[el.dataset.id] : null;
  const m = openModal({
    title: t ? 'Ubah Data Guru' : 'Tambah Data Guru', icon: 'cap', drawer: true,
    body: `<div class="form-grid"><div class="field"><label for="tN">Nama lengkap dengan gelar <span class="req">*</span></label><input id="tN" class="input" value="${esc(t ? t.nama : '')}" placeholder="mis. Budi Santoso, S.Pd."></div>
      <div class="field"><label for="tP">NIP (opsional)</label><input id="tP" class="input" inputmode="numeric" value="${esc(t ? t.nip : '')}" placeholder="18 digit angka"></div>
      <div class="field"><label for="tM">Mata pelajaran <span class="req">*</span></label><input id="tM" class="input" value="${esc(t ? t.mapel : '')}" list="tMl"><datalist id="tMl">${Array.from(new Set(tbl('teachers').map((x) => x.mapel))).map((x) => `<option value="${esc(x)}">`).join('')}</datalist></div>
      <div class="field"><label for="tK">Kelas diampu</label><input id="tK" class="input" value="${esc(t ? t.kelas_diampu : '')}" placeholder="Pisahkan dengan koma, mis. X-1, XI-2"></div>
      <div id="tErr" class="dangerbox" style="display:none">${icon('alert', 'sm')}<span></span></div></div>`,
    footer: `<button class="btn ghost" data-close>Batal</button><button class="btn" id="tSave">${icon('save', 'sm')} Simpan</button>`
  });
  $('#tSave', m.el).onclick = () => {
    const payload = { teacher_id: t ? t.teacher_id : undefined, nama: $('#tN', m.el).value.trim(), nip: $('#tP', m.el).value.replace(/\s+/g, ''), mapel: $('#tM', m.el).value.trim(), kelas_diampu: $('#tK', m.el).value.trim() };
    const err = (x) => { const b = $('#tErr', m.el); b.style.display = 'flex'; b.querySelector('span').textContent = x; };
    if (!payload.nama) return err('Nama wajib diisi.');
    if (!payload.mapel) return err('Mata pelajaran wajib diisi.');
    if (payload.nip && !/^\d{8,20}$/.test(payload.nip)) return err('NIP hanya angka (8–20 digit).');
    const tmp = t ? t.teacher_id : uid();
    const snap = snapshot('teachers');
    m.close();
    optimistic({ apply: () => upsertLocal('teachers', Object.assign({ status: 'aktif' }, t || {}, payload, { teacher_id: tmp })), revert: () => restore('teachers', snap),
      action: 'teachers.save', payload, okMsg: t ? 'Data guru diperbarui' : 'Guru ditambahkan',
      onDone: (d) => { if (!t) removeLocal('teachers', tmp); upsertLocal('teachers', d.teacher); } }).catch(() => {});
  };
};
ACT.teacherStatus = (el) => {
  const t = S.ix.teachers[el.dataset.id]; const to = t.status === 'aktif' ? 'nonaktif' : 'aktif';
  optimistic({ apply: () => upsertLocal('teachers', { teacher_id: t.teacher_id, status: to }), revert: () => upsertLocal('teachers', { teacher_id: t.teacher_id, status: t.status }),
    action: 'teachers.setStatus', payload: { teacher_id: t.teacher_id, status: to }, okMsg: to === 'aktif' ? 'Guru diaktifkan' : 'Guru dinonaktifkan' }).catch(() => {});
};
ACT.importTeachers = () => {
  const m = openModal({
    title: 'Impor Data Guru', icon: 'upload', size: 'wide', sub: 'Salin baris dari Google Sheets/Excel lalu tempel di bawah.',
    body: `<div class="infobox mb16">${icon('info', 'sm')}<span>Urutan kolom: <b>Nama · NIP · Mata Pelajaran · Kelas diampu</b>. Pemisah tab (hasil salin spreadsheet), titik koma, atau koma. Baris judul akan dilewati.</span></div>
      <textarea id="imT" class="textarea mono" style="min-height:200px" placeholder="Budi Santoso, S.Pd.\t198204152009021003\tFisika\tXI-1, XI-2"></textarea><p class="small muted mt8" id="imInfo">0 baris siap diimpor</p>`,
    footer: `<button class="btn ghost" data-close>Batal</button><button class="btn" id="imGo" disabled>${icon('upload', 'sm')} Impor</button>`
  });
  let rows = [];
  $('#imT', m.el).oninput = (e) => {
    rows = e.target.value.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => { const c = l.indexOf('\t') > -1 ? l.split('\t') : l.indexOf(';') > -1 ? l.split(';') : l.split(/,(?=\s*\d|\s*[A-Z][a-z])/); return { nama: (c[0] || '').trim(), nip: (c[1] || '').replace(/\D/g, ''), mapel: (c[2] || '').trim(), kelas_diampu: c.slice(3).join(',').trim() }; })
      .filter((r) => r.nama && !/^nama/i.test(r.nama));
    $('#imInfo', m.el).textContent = rows.length + ' baris siap diimpor' + (rows.some((r) => !r.mapel) ? ' · beberapa baris tanpa mapel akan ditolak' : '');
    $('#imGo', m.el).disabled = !rows.length;
  };
  $('#imGo', m.el).onclick = (e) => {
    btnBusy(e.currentTarget, true, 'Mengimpor…');
    call('teachers.import', { rows }).then((d) => { upsertManyLocal('teachers', d.teachers); persist(); m.close(); softRender(); toast(d.errors.length ? 'warning' : 'success', d.teachers.length + ' guru diimpor', d.errors.slice(0, 3).join(' · ')); })
      .catch((er) => { btnBusy(e.currentTarget, false); toast('error', 'Impor gagal', er.message); });
  };
};

// ═════════════════════════════════════════════════════════════════════════
// BAGIAN 24 — PERIODE SEMESTER
// ═════════════════════════════════════════════════════════════════════════
VIEWS.periode = {
  title: 'Periode Semester', icon: 'calendar', roles: ['ADMIN'],
  render: () => {
    const list = sortedPeriods().reverse();
    return `<div class="page-head"><div><h1>Tahun Ajaran & Semester</h1><p class="sub">Hanya satu periode yang aktif. Jadwal supervisi baru otomatis masuk ke periode aktif.</p></div>
      <div class="head-actions"><button class="btn" data-act="periodModal">${icon('plus', 'sm')} Tambah Periode</button></div></div>
      <div class="card pad-0">${list.length ? `<div class="table-wrap"><table class="t cards"><thead><tr><th>Aktif</th><th>Tahun ajaran</th><th>Semester</th><th>Mulai</th><th>Selesai</th><th>Sesi supervisi</th><th></th></tr></thead><tbody>
        ${list.map((p) => `<tr style="${p.aktif ? 'background:var(--primary-light)' : ''}"><td data-l="Aktif"><input type="radio" name="perAct" ${p.aktif ? 'checked' : ''} data-change="activatePeriod" data-id="${p.period_id}" aria-label="Aktifkan ${esc(periodLabel(p))}" style="width:20px;height:20px;accent-color:var(--primary)"></td>
          <td class="lead"><b>${esc(p.tahun_ajaran)}</b> ${p.aktif ? '<span class="pill green dot">Aktif</span>' : ''}</td><td data-l="Semester">${esc(p.semester)}</td><td data-l="Mulai">${fmtDate(p.tanggal_mulai)}</td><td data-l="Selesai">${fmtDate(p.tanggal_selesai)}</td>
          <td data-l="Sesi">${tbl('supervisions').filter((s) => s.period_id === p.period_id).length}</td><td><div class="acts"><button class="icon-btn" data-act="periodModal" data-id="${p.period_id}" aria-label="Ubah">${icon('edit', 'sm')}</button></div></td></tr>`).join('')}
      </tbody></table></div>` : emptyState('Belum ada periode', 'Tambahkan tahun ajaran & semester.')}</div>`;
  }
};
ACT.periodModal = (el) => {
  const p = el.dataset.id ? S.ix.periods[el.dataset.id] : null;
  const y = new Date().getFullYear();
  const m = openModal({
    title: p ? 'Ubah Periode' : 'Tambah Periode', icon: 'calendar',
    body: `<div class="form-grid two"><div class="field"><label for="pY">Tahun ajaran</label><input id="pY" class="input" value="${esc(p ? p.tahun_ajaran : y + '/' + (y + 1))}" placeholder="2026/2027"></div>
      <div class="field"><label for="pS">Semester</label><select id="pS" class="select"><option ${p && p.semester === 'Ganjil' ? 'selected' : ''}>Ganjil</option><option ${p && p.semester === 'Genap' ? 'selected' : ''}>Genap</option></select></div>
      <div class="field"><label for="pA">Tanggal mulai</label><input id="pA" type="date" class="input" value="${esc(p ? p.tanggal_mulai : '')}"></div><div class="field"><label for="pB">Tanggal selesai</label><input id="pB" type="date" class="input" value="${esc(p ? p.tanggal_selesai : '')}"></div></div>
      <div id="pErr" class="dangerbox mt16" style="display:none">${icon('alert', 'sm')}<span></span></div>`,
    footer: `<button class="btn ghost" data-close>Batal</button><button class="btn" id="pSave">Simpan</button>`
  });
  $('#pSave', m.el).onclick = (e) => {
    const payload = { period_id: p ? p.period_id : undefined, tahun_ajaran: $('#pY', m.el).value.trim(), semester: $('#pS', m.el).value, tanggal_mulai: $('#pA', m.el).value, tanggal_selesai: $('#pB', m.el).value };
    const err = (x) => { const b = $('#pErr', m.el); b.style.display = 'flex'; b.querySelector('span').textContent = x; };
    if (!/^\d{4}\/\d{4}$/.test(payload.tahun_ajaran)) return err('Format tahun ajaran: 2026/2027');
    if (!payload.tanggal_mulai || !payload.tanggal_selesai || payload.tanggal_mulai > payload.tanggal_selesai) return err('Rentang tanggal tidak valid.');
    btnBusy(e.currentTarget, true);
    call('periods.save', payload).then((d) => { S.data.periods = d.periods; if (!S.data.active_period_id) { const a = d.periods.find((x) => x.aktif); if (a) S.data.active_period_id = a.period_id; } reindex(); persist(); m.close(); softRender(); toast('success', 'Periode disimpan'); })
      .catch((er) => { btnBusy(e.currentTarget, false); err(er.message); });
  };
};
ACT.activatePeriod = async (el) => {
  const p = S.ix.periods[el.dataset.id];
  const ok = await confirmDialog({ title: 'Aktifkan periode ' + periodLabel(p) + '?', message: 'Jadwal supervisi baru akan masuk ke periode ini dan dasbor menampilkan data periode ini.', okText: 'Aktifkan' });
  if (!ok) { softRender(); return; }
  const snap = snapshot('periods'), prevId = S.data.active_period_id;
  optimistic({ apply: () => { S.data.periods.forEach((x) => { x.aktif = x.period_id === p.period_id; }); S.data.active_period_id = p.period_id; reindex(); },
    revert: () => { restore('periods', snap); S.data.active_period_id = prevId; }, action: 'periods.activate', payload: { period_id: p.period_id }, okMsg: 'Periode diaktifkan',
    onDone: () => refreshData(true) }).catch(() => {});
};

// ═════════════════════════════════════════════════════════════════════════
// BAGIAN 25 — RUBRIK BERVERSI (draf → aktif, bobot wajib 100%)
// ═════════════════════════════════════════════════════════════════════════
const CAT_COLORS = ['#3D6FE0', '#5B87EA', '#7EA3F2', '#22A06B', '#1E2A4A', '#E8A317', '#7C5CE0', '#E5534B', '#0EA5E9'];
function rubricVersions() {
  const m = {};
  tbl('rubrics').forEach((r) => { m[r.version] = r.version_status; });
  return Object.keys(m).sort(natCmp).reverse().map((v) => ({ v, st: m[v] }));
}
function rbEditState(ver) {
  if (!S.rbEdit || S.rbEdit.version !== ver) {
    S.rbEdit = { version: ver, dirty: false, items: (S.ix.rubric[ver] || []).map((r) => ({ category_no: r.category_no, category: r.category, category_weight: r.category_weight, indicator_id: r.indicator_id, description: r.description, evidence_guide: r.evidence_guide, active: r.active })) };
  }
  return S.rbEdit;
}
function rbCats(items) {
  const m = {};
  items.forEach((r, i) => { const c = m[r.category_no] = m[r.category_no] || { no: r.category_no, name: r.category, weight: Number(r.category_weight) || 0, items: [] }; c.items.push(Object.assign({ _i: i }, r)); });
  return Object.values(m).sort((a, b) => a.no - b.no);
}
function rbTotal(items) { const c = {}; items.filter((r) => r.active).forEach((r) => { c[r.category_no] = Number(r.category_weight) || 0; }); return Math.round(Object.values(c).reduce((a, b) => a + b, 0) * 100) / 100; }

VIEWS.rubrik = {
  title: 'Rubrik Penilaian', icon: 'clipboard', roles: ['ADMIN'],
  render: () => {
    const versions = rubricVersions();
    const active = activeRubricVersion();
    const ver = S.ui.rb_ver && versions.some((x) => x.v === S.ui.rb_ver) ? S.ui.rb_ver : (versions.find((x) => x.st === 'draft') || {}).v || active;
    const meta = versions.find((x) => x.v === ver) || { st: 'aktif' };
    const draft = meta.st === 'draft';
    const st = draft ? rbEditState(ver) : null;
    if (draft) S.editing = true;
    const items = draft ? st.items : (S.ix.rubric[ver] || []);
    const cats = rbCats(items);
    const total = rbTotal(items);
    const open = S.ui.rb_open || (cats[0] && cats[0].no);
    const dist = cats.filter((c) => c.items.some((r) => r.active));
    return `<div class="page-head"><div><h1>Rubrik Penilaian Supervisi</h1><div class="row wrap mt8" style="gap:8px">${meta.st === 'aktif' ? '<span class="pill green dot">Versi resmi aktif</span>' : meta.st === 'draft' ? '<span class="pill amber dot">Draf — belum berlaku</span>' : '<span class="pill">Arsip</span>'}<span class="pill violet">Pembelajaran Mendalam</span></div>
      <p class="sub">Instrumen observasi berbasis Kurikulum Merdeka & Pembelajaran Mendalam (berkesadaran, bermakna, menggembirakan).</p></div>
      <div class="head-actions"><select class="select" style="width:auto" data-change="rbVer" aria-label="Versi rubrik">${versions.map((x) => `<option value="${esc(x.v)}" ${x.v === ver ? 'selected' : ''}>Versi ${esc(x.v)} — ${x.st === 'aktif' ? 'Aktif' : x.st === 'draft' ? 'Draf' : 'Arsip'}</option>`).join('')}</select>
      ${versions.some((x) => x.st === 'draft') ? '' : `<button class="btn" data-act="rbNewDraft" data-from="${esc(ver)}">${icon('plus', 'sm')} Buat Draf Versi Baru</button>`}</div></div>
      ${!draft ? `<div class="card tint mb16"><div class="row" style="gap:14px;align-items:flex-start">${icon('lock')}<div><b>Versi terkunci (read-only)</b><p class="small mt8" style="color:var(--text-muted)">Rubrik v${esc(ver)} ${meta.st === 'aktif' ? 'sedang digunakan pada supervisi aktif' : 'adalah arsip'}. Setiap penyesuaian bobot atau indikator dibuat sebagai versi draf baru agar nilai yang sudah disahkan tidak berubah.</p></div></div></div>` : ''}
      <div class="card mb16"><div class="card-head"><div><h3>${icon('pie', 'sm')} Distribusi Bobot Dimensi</h3><p class="sub">Nilai akhir = Σ (rata-rata skor dimensi ÷ 4 × bobot dimensi)</p></div>
        <span class="pill ${Math.abs(total - 100) < 0.001 ? 'green' : 'red'}" id="rbTotal">${icon(Math.abs(total - 100) < 0.001 ? 'checkCircle' : 'alert', 'xs')} Total bobot ${total}%${Math.abs(total - 100) < 0.001 ? ' · valid' : ' · harus 100%'}</span></div>
        <div class="wbar" id="rbBar">${dist.map((c, i) => `<i style="width:${c.weight}%;background:${CAT_COLORS[i % CAT_COLORS.length]}" title="${esc(c.name)} ${c.weight}%"></i>`).join('')}</div>
        <div class="grid mt16" style="grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px">${dist.map((c, i) => `<span class="dim-chip" style="--c:${CAT_COLORS[i % CAT_COLORS.length]}"><span class="ellipsis grow">${c.no}. ${esc(SHORT_CAT[c.no] || c.name)}</span><b id="rbW-${c.no}">${c.weight}%</b></span>`).join('')}</div></div>
      <div class="card mb16" style="padding:16px 20px"><div class="row wrap" style="gap:10px"><b class="row" style="gap:8px">${icon('hourglass', 'sm')} Skala penilaian:</b>${SCALE.map((x) => `<span class="pill" style="background:var(--s${x.v}-bg);color:var(--s${x.v === 2 ? '2-ink' : x.v})">${x.v} · ${x.t}</span>`).join('')}<span class="sc s0" style="height:24px;padding:0 10px;font-weight:500">– Belum diamati (tidak dihitung)</span></div></div>
      <div class="rubric-edit">${cats.map((c, ci) => rubricCategory(c, ci, draft, open === c.no)).join('')}</div>
      ${draft ? `<button class="btn ghost mt16" data-act="rbAddCat">${icon('plus', 'sm')} Tambah Dimensi</button>
      <div class="actionbar"><button class="btn danger" data-act="rbDelete" data-v="${esc(ver)}">${icon('trash', 'sm')} <span class="hide-sm">Hapus Draf</span></button><div class="info hide-sm" id="rbInfo">${st.dirty ? 'Ada perubahan belum disimpan' : 'Draf tersimpan'}</div>
        <button class="btn ghost" data-act="rbSave" data-v="${esc(ver)}">${icon('save', 'sm')} Simpan Draf</button><button class="btn success" data-act="rbActivate" data-v="${esc(ver)}" ${Math.abs(total - 100) > 0.001 ? 'disabled' : ''} id="rbActBtn">${icon('checkCircle', 'sm')} Aktifkan Versi</button></div>` : ''}`;
  }
};
function rubricCategory(c, ci, draft, open) {
  const col = CAT_COLORS[ci % CAT_COLORS.length];
  return `<div class="acc ${open ? 'open' : ''}"><div class="acc-head" style="cursor:default"><button class="row grow" style="border:0;background:none;cursor:pointer;text-align:left;gap:12px;min-height:44px;padding:0" data-act="rbOpen" data-no="${c.no}">
      <span class="acc-num" style="background:${col};color:#fff">${c.no}</span><span class="acc-title">${draft ? `<input class="input" style="font-weight:600" value="${esc(c.name)}" data-input="rbCat" data-no="${c.no}" aria-label="Nama dimensi" onclick="event.stopPropagation()">` : `<b>${c.no}. ${esc(c.name)}</b>`}<small>${c.items.length} indikator · ${c.items.filter((r) => r.active).length} aktif</small></span></button>
      <span class="row" style="gap:6px"><span class="small muted">Bobot</span>${draft ? `<input class="input num-in" type="number" min="0" max="100" step="1" value="${c.weight}" data-input="rbWeight" data-no="${c.no}" aria-label="Bobot dimensi ${c.no}">` : `<b style="color:var(--primary)">${c.weight}%</b>`}%</span>
      <button class="icon-btn" data-act="rbOpen" data-no="${c.no}" aria-label="Buka">${icon('chevDown', 'sm')}</button></div>
    <div class="acc-body">${c.items.map((r) => `<div class="ind" style="${r.active ? '' : 'opacity:.55'}"><div class="row wrap" style="gap:10px;align-items:flex-start">
        ${draft ? `<input class="input" style="width:84px" value="${esc(r.indicator_id)}" data-input="rbField" data-i="${r._i}" data-f="indicator_id" aria-label="Kode indikator">` : `<span class="ind-code">IND-${esc(r.indicator_id)}</span>`}
        <div class="grow" style="min-width:240px">${draft ? `<textarea class="textarea" style="min-height:60px" data-input="rbField" data-i="${r._i}" data-f="description" aria-label="Deskripsi indikator">${esc(r.description)}</textarea>
          <textarea class="textarea mt8" style="min-height:56px;font-size:12.5px" data-input="rbField" data-i="${r._i}" data-f="evidence_guide" placeholder="Panduan bukti observasi…" aria-label="Panduan bukti">${esc(r.evidence_guide)}</textarea>`
          : `<b style="display:block;font-weight:600">${esc(r.description)}</b>${r.evidence_guide ? `<div class="guide mt8">${icon('book', 'sm')}<span><b>Panduan bukti:</b> ${esc(r.evidence_guide)}</span></div>` : ''}`}</div>
        <div class="row" style="gap:6px">${draft ? `<button class="switch ok" role="switch" aria-checked="${r.active}" aria-label="Indikator aktif" data-act="rbToggle" data-i="${r._i}"></button><button class="icon-btn del" data-act="rbDelInd" data-i="${r._i}" aria-label="Hapus indikator">${icon('trash', 'sm')}</button>`
          : `<span class="pill ${r.active ? 'green dot' : ''}">${r.active ? 'Aktif diamati' : 'Nonaktif'}</span>`}</div></div></div>`).join('')}
      ${draft ? `<button class="btn plain block mt16" data-act="rbAddInd" data-no="${c.no}">${icon('plus', 'sm')} Tambah indikator pada dimensi ini</button>` : ''}</div></div>`;
}
function rbMarkDirty() {
  S.rbEdit.dirty = true;
  const i = $('#rbInfo'); if (i) i.textContent = 'Ada perubahan belum disimpan';
  const total = rbTotal(S.rbEdit.items);
  const ok = Math.abs(total - 100) < 0.001;
  const t = $('#rbTotal'); if (t) { t.className = 'pill ' + (ok ? 'green' : 'red'); t.innerHTML = `${icon(ok ? 'checkCircle' : 'alert', 'xs')} Total bobot ${total}%${ok ? ' · valid' : ' · harus 100%'}`; }
  const b = $('#rbActBtn'); if (b) b.disabled = !ok;
}
ACT.rbVer = (el) => { S.ui.rb_ver = el.value; softRender(); };
ACT.rbOpen = (el) => { S.ui.rb_open = S.ui.rb_open === Number(el.dataset.no) ? -1 : Number(el.dataset.no); softRender(); };
INPUT.rbField = (el) => { const r = S.rbEdit.items[Number(el.dataset.i)]; r[el.dataset.f] = el.value; rbMarkDirty(); };
INPUT.rbCat = (el) => { S.rbEdit.items.forEach((r) => { if (r.category_no === Number(el.dataset.no)) r.category = el.value; }); rbMarkDirty(); };
INPUT.rbWeight = (el) => {
  const w = clamp(Number(el.value) || 0, 0, 100);
  S.rbEdit.items.forEach((r) => { if (r.category_no === Number(el.dataset.no)) r.category_weight = w; });
  const lab = $('#rbW-' + el.dataset.no); if (lab) lab.textContent = w + '%';
  rbMarkDirty();
};
ACT.rbToggle = (el) => { const r = S.rbEdit.items[Number(el.dataset.i)]; r.active = !r.active; rbMarkDirty(); softRender(); };
ACT.rbDelInd = (el) => { S.rbEdit.items.splice(Number(el.dataset.i), 1); rbMarkDirty(); softRender(); };
ACT.rbAddInd = (el) => {
  const no = Number(el.dataset.no);
  const same = S.rbEdit.items.filter((r) => r.category_no === no);
  const base = same[0] || { category: 'Dimensi baru', category_weight: 0 };
  let k = same.length + 1; while (S.rbEdit.items.some((r) => r.indicator_id === no + '.' + k)) k++;
  S.rbEdit.items.push({ category_no: no, category: base.category, category_weight: base.category_weight, indicator_id: no + '.' + k, description: '', evidence_guide: '', active: true });
  S.ui.rb_open = no; rbMarkDirty(); softRender();
};
ACT.rbAddCat = () => {
  const no = Math.max(0, ...S.rbEdit.items.map((r) => r.category_no)) + 1;
  S.rbEdit.items.push({ category_no: no, category: 'Dimensi baru', category_weight: 0, indicator_id: no + '.1', description: '', evidence_guide: '', active: true });
  S.ui.rb_open = no; rbMarkDirty(); softRender();
};
ACT.rbNewDraft = (el) => {
  btnBusy(el, true, 'Membuat draf…');
  call('rubrics.newDraft', { from_version: el.dataset.from }).then((d) => { S.data.rubrics = d.rubrics; reindex(); persist(); S.ui.rb_ver = d.version; S.rbEdit = null; toast('success', 'Draf versi ' + d.version + ' dibuat', 'Ubah bobot/indikator lalu aktifkan.'); softRender(); })
    .catch((e) => { btnBusy(el, false); toast('error', 'Gagal membuat draf', e.message); });
};
function rbSave(ver, el) {
  const bad = S.rbEdit.items.find((r) => !String(r.description).trim() || !String(r.indicator_id).trim());
  if (bad) { toast('warning', 'Lengkapi indikator', 'Kode dan deskripsi indikator ' + (bad.indicator_id || '(tanpa kode)') + ' wajib diisi.'); return Promise.reject(new Error('invalid')); }
  btnBusy(el, true, 'Menyimpan…');
  return call('rubrics.saveDraft', { version: ver, items: S.rbEdit.items }).then((d) => { S.data.rubrics = d.rubrics; reindex(); persist(); S.rbEdit.dirty = false; btnBusy(el, false); const i = $('#rbInfo'); if (i) i.textContent = 'Draf tersimpan'; return d; })
    .catch((e) => { btnBusy(el, false); toast('error', 'Gagal menyimpan', e.message); throw e; });
}
ACT.rbSave = (el) => rbSave(el.dataset.v, el).then(() => toast('success', 'Draf rubrik disimpan')).catch(() => {});
ACT.rbActivate = async (el) => {
  const ver = el.dataset.v;
  const ok = await confirmDialog({ title: 'Aktifkan rubrik versi ' + ver + '?', icon: 'checkCircle', iconClass: 'green', html: `Versi ${esc(activeRubricVersion())} akan diarsipkan. Jadwal baru memakai versi ${esc(ver)}; hasil yang sudah dinilai tetap memakai versi lamanya.`, okText: 'Aktifkan' });
  if (!ok) return;
  const go = () => call('rubrics.activate', { version: ver }).then((d) => { S.data.rubrics = d.rubrics; S.data.settings = d.settings; reindex(); persist(); S.rbEdit = null; S.editing = false; S.ui.rb_ver = ver; toast('success', 'Rubrik v' + ver + ' aktif'); softRender(); });
  (S.rbEdit && S.rbEdit.dirty ? rbSave(ver, el).then(go) : go()).catch((e) => { if (e.message !== 'invalid') toast('error', 'Gagal mengaktifkan', e.message); });
};
ACT.rbDelete = async (el) => {
  const ok = await confirmDialog({ title: 'Hapus draf rubrik?', message: 'Semua perubahan pada draf ini akan hilang.', okText: 'Hapus Draf', danger: true });
  if (!ok) return;
  call('rubrics.deleteDraft', { version: el.dataset.v }).then((d) => { S.data.rubrics = d.rubrics; reindex(); persist(); S.rbEdit = null; S.editing = false; S.ui.rb_ver = null; toast('success', 'Draf dihapus'); softRender(); })
    .catch((e) => toast('error', 'Gagal', e.message));
};

// ═════════════════════════════════════════════════════════════════════════
// BAGIAN 26 — RUJUKAN AI (basis pengetahuan RAG)
// ═════════════════════════════════════════════════════════════════════════
VIEWS.rujukan = {
  title: 'Rujukan AI', icon: 'sparkles', roles: ['ADMIN'],
  render: () => {
    const refs = tbl('references');
    return `<div class="page-head"><div><div class="eyebrow ai">${icon('sparkles', 'xs')} Tata kelola AI</div><h1>Basis Pengetahuan Rujukan AI</h1>
      <p class="sub">Ringkasan dokumen resmi & panduan sekolah yang dipakai AI sebagai dasar rekomendasi (RAG sederhana).</p></div>
      <div class="head-actions"><button class="btn ai solid" data-act="refModal">${icon('plus', 'sm')} Tambah Rujukan</button></div></div>
      <div class="card ai-soft mb16"><div class="row" style="gap:14px;align-items:flex-start"><span style="color:var(--ai)">${icon('shield', 'lg')}</span><div class="grow"><b>Prinsip Retrieval-Augmented Generation</b>
        <p class="small mt8" style="color:var(--text)">Rujukan aktif dipilih otomatis berdasarkan dimensi yang lemah dan kata kunci pada bukti observasi. Nama dan NIP guru <b>tidak pernah</b> dikirim ke penyedia AI — hanya skor, bukti observasi, mapel, dan cuplikan rujukan.</p>
        <p class="xs mt8" style="color:var(--ai)">Penyedia AI saat ini: <b>${esc(aiProviderLabel(setting('ai_provider')))}</b>${setting('ai_provider') !== 'none' && !setting('ai_key_set') ? ' · kunci API belum diatur' : ''}</p></div></div></div>
      ${refs.length ? `<div class="grid g2">${refs.map((r) => `<div class="card ref-card" style="${r.aktif ? '' : 'opacity:.6'}"><div class="row between" style="align-items:flex-start;gap:12px"><span class="pill violet">${icon('book', 'xs')} Dimensi ${esc(r.kategori_indikator || 'umum')}</span>
          <button class="switch ai" role="switch" aria-checked="${r.aktif}" aria-label="Rujukan aktif" data-act="refToggle" data-id="${r.ref_id}"></button></div>
        <h3 class="mt12">${esc(r.judul)}</h3><p class="small muted mt8 row" style="gap:6px">${icon('file', 'xs')} ${esc(r.sumber || '–')}</p>
        <div class="quote mt12">“${esc(String(r.ringkasan_isi).slice(0, 320))}${String(r.ringkasan_isi).length > 320 ? '…' : ''}”</div>
        <div class="mt12">${String(r.kata_kunci || '').split(/[,;]/).filter((k) => k.trim()).map((k) => `<span class="tagchip ai">#${esc(k.trim())}</span>`).join('')}</div>
        <div class="row between mt12"><span class="xs muted">Diperbarui ${fmtTs(r.updated_at)} · ${String(r.ringkasan_isi).length} karakter</span><button class="btn ai sm" data-act="refModal" data-id="${r.ref_id}">${icon('edit', 'sm')} Ubah</button></div></div>`).join('')}</div>`
        : `<div class="card">${emptyState('Belum ada rujukan', 'Tambahkan panduan Pembelajaran Mendalam agar rekomendasi AI lebih tepat.')}</div>`}`;
  }
};
function aiProviderLabel(p) { return { none: 'Mesin aturan sekolah (tanpa AI eksternal)', gemini: 'Google Gemini', openai: 'OpenAI', anthropic: 'Anthropic Claude' }[p] || p || 'Mesin aturan'; }
ACT.refModal = (el) => {
  const r = el.dataset.id ? S.ix.refs[el.dataset.id] : null;
  const m = openModal({
    title: r ? 'Ubah Rujukan' : 'Tambah Rujukan AI', icon: 'book', iconClass: 'ai', drawer: true,
    body: `<div class="form-grid"><div class="field"><label for="rJ">Judul <span class="req">*</span></label><input id="rJ" class="input" value="${esc(r ? r.judul : '')}"></div>
      <div class="field"><label for="rS">Sumber / dasar hukum</label><input id="rS" class="input" value="${esc(r ? r.sumber : '')}" placeholder="mis. Panduan Pembelajaran Mendalam, Kemendikdasmen"></div>
      <div class="field"><label for="rK">Dimensi terkait (nomor)</label><input id="rK" class="input" value="${esc(r ? r.kategori_indikator : '')}" placeholder="mis. 2,3,5"><span class="hint">Nomor dimensi rubrik, dipisahkan koma.</span></div>
      <div class="field"><label for="rW">Kata kunci</label><input id="rW" class="input" value="${esc(r ? r.kata_kunci : '')}" placeholder="refleksi, asesmen formatif, diferensiasi"></div>
      <div class="field"><label class="lbl-row" for="rI"><span>Ringkasan isi <span class="req">*</span></span><span class="count" id="rIc">${r ? String(r.ringkasan_isi).length : 0}/4000</span></label><textarea id="rI" class="textarea" style="min-height:220px" maxlength="4000">${esc(r ? r.ringkasan_isi : '')}</textarea><span class="hint">Tulis inti pedoman dengan bahasa jelas. Minimal 30 karakter.</span></div>
      <label class="check"><input type="checkbox" id="rA" ${!r || r.aktif ? 'checked' : ''}> <span>Aktif dipakai AI</span></label>
      <div id="rErr" class="dangerbox" style="display:none">${icon('alert', 'sm')}<span></span></div></div>`,
    footer: `<button class="btn ghost" data-close>Batal</button><button class="btn ai solid" id="rSave">${icon('save', 'sm')} Simpan</button>`
  });
  $('#rI', m.el).oninput = (e) => { $('#rIc', m.el).textContent = e.target.value.length + '/4000'; };
  $('#rSave', m.el).onclick = () => {
    const payload = { ref_id: r ? r.ref_id : undefined, judul: $('#rJ', m.el).value.trim(), sumber: $('#rS', m.el).value.trim(), kategori_indikator: $('#rK', m.el).value.trim(), kata_kunci: $('#rW', m.el).value.trim(), ringkasan_isi: $('#rI', m.el).value.trim(), aktif: $('#rA', m.el).checked };
    const err = (x) => { const b = $('#rErr', m.el); b.style.display = 'flex'; b.querySelector('span').textContent = x; };
    if (!payload.judul) return err('Judul wajib diisi.');
    if (payload.ringkasan_isi.length < 30) return err('Ringkasan minimal 30 karakter.');
    const tmp = r ? r.ref_id : uid(); const snap = snapshot('references');
    m.close();
    optimistic({ apply: () => upsertLocal('references', Object.assign({}, r || {}, payload, { ref_id: tmp, updated_at: new Date().toISOString().slice(0, 19) })), revert: () => restore('references', snap),
      action: 'references.save', payload, okMsg: 'Rujukan disimpan', onDone: (d) => { if (!r) removeLocal('references', tmp); upsertLocal('references', d.reference); } }).catch(() => {});
  };
};
ACT.refToggle = (el) => {
  const r = S.ix.refs[el.dataset.id];
  optimistic({ apply: () => upsertLocal('references', { ref_id: r.ref_id, aktif: !r.aktif }), revert: () => upsertLocal('references', { ref_id: r.ref_id, aktif: r.aktif }),
    action: 'references.save', payload: Object.assign({}, r, { aktif: !r.aktif }), okMsg: r.aktif ? 'Rujukan dinonaktifkan' : 'Rujukan diaktifkan' }).catch(() => {});
};

// ═════════════════════════════════════════════════════════════════════════
// BAGIAN 27 — PENGATURAN (identitas sekolah, laporan, AI)
// ═════════════════════════════════════════════════════════════════════════
VIEWS.pengaturan = {
  title: 'Pengaturan', icon: 'settings', roles: ['ADMIN'],
  render: () => {
    const s = S.data.settings || {};
    const f = (id, label, val, ph, hint) => `<div class="field"><label for="${id}">${label}</label><input id="${id}" class="input" value="${esc(val || '')}" placeholder="${esc(ph || '')}">${hint ? `<span class="hint">${hint}</span>` : ''}</div>`;
    return `<div class="page-head"><div><h1>Pengaturan Aplikasi</h1><p class="sub">Identitas sekolah untuk kop laporan, data kepala sekolah, dan konfigurasi AI.</p></div>
      <div class="head-actions"><button class="btn" data-act="saveSettings">${icon('save', 'sm')} Simpan Pengaturan</button></div></div>
      <div class="grid g2" style="align-items:start"><div class="stack">
        <div class="card"><h3 class="mb16">${icon('school', 'sm')} Identitas Sekolah</h3><div class="form-grid">
          ${f('stName', 'Nama sekolah', s.school_name)}${f('stFound', 'Yayasan', s.school_foundation)}${f('stAddr', 'Alamat', s.school_address)}
          <div class="form-grid two">${f('stCity', 'Kota (tanda tangan)', s.school_city)}${f('stContact', 'Kontak (telp/email/web)', s.school_contact)}</div>
          <div class="field"><label for="stLogo">URL logo sekolah</label><div class="row" style="gap:12px"><span class="brand-logo" id="stLogoPrev" style="width:48px;height:48px">${s.logo_url ? `<img src="${esc(s.logo_url)}" alt="">` : SCHOOL_MARK}</span><input id="stLogo" class="input grow" value="${esc(s.logo_url || '')}" placeholder="https://…/logo.png"></div><span class="hint">Gunakan tautan gambar publik (https). Tampil di sidebar, login, dan kop PDF.</span></div></div></div>
        <div class="card"><h3 class="mb16">${icon('user', 'sm')} Kepala Sekolah & Laporan</h3><div class="form-grid">${f('stKs', 'Nama kepala sekolah', s.kepsek_name)}${f('stNip', 'NIP kepala sekolah', s.kepsek_nip)}${f('stPref', 'Awalan nomor laporan', s.report_prefix, '421.3/SUP-TRG', 'Contoh hasil: 421.3/SUP-TRG/1A2B3C4D')}</div></div></div>
      <div class="stack"><div class="card ai"><h3 class="mb16" style="color:var(--ai)">${icon('sparkles', 'sm')} Rekomendasi AI</h3><div class="form-grid">
          <div class="field"><label for="stProv">Penyedia</label><select id="stProv" class="select">${['none', 'gemini', 'openai', 'anthropic'].map((p) => `<option value="${p}" ${s.ai_provider === p ? 'selected' : ''}>${aiProviderLabel(p)}</option>`).join('')}</select></div>
          ${f('stModel', 'Model (opsional)', s.ai_model, 'kosongkan untuk default', 'Default: gemini-2.5-flash · gpt-4o-mini · claude-sonnet-5-5. Isi sesuai model yang tersedia di akun Anda.')}
          <div class="field"><label for="stKey">Kunci API</label><div class="input-icon"><input id="stKey" type="password" class="input" style="padding-left:12px;padding-right:48px" autocomplete="off" placeholder="${s.ai_key_set ? '•••••••• terpasang — isi untuk mengganti' : 'Tempel kunci API'}"><button type="button" class="icon-btn eye" data-act="togglePw" data-target="stKey" aria-label="Tampilkan">${icon('eye', 'sm')}</button></div>
            <span class="hint">Disimpan di Script Properties server — tidak pernah dikirim balik ke browser.</span>${s.ai_key_set ? `<label class="check mt8"><input type="checkbox" id="stKeyClr"> <span class="small">Hapus kunci API tersimpan</span></label>` : ''}</div>
          <div class="aibox">${icon('info', 'sm')}<span>Tanpa kunci API, aplikasi tetap menyusun rekomendasi memakai <b>mesin aturan sekolah</b> yang dapat ditinjau dan disunting.</span></div></div></div>
        <div class="card"><h3 class="mb16">${icon('info', 'sm')} Tentang Aplikasi</h3><div class="list">
          <div class="li"><div class="grow"><b>Versi</b><small>Supervisi Guru v${esc(s.app_version || '1.0.0')}</small></div></div>
          <div class="li"><div class="grow"><b>Rubrik aktif</b><small>v${esc(s.active_rubric_version)}</small></div><button class="btn plain sm" data-act="nav" data-route="rubrik">Kelola</button></div>
          <div class="li"><div class="grow"><b>Penyimpanan</b><small>Google Sheets (database) · Drive "Laporan Supervisi" (PDF) · backup mingguan otomatis</small></div></div></div></div></div></div>`;
  },
  after: () => { const i = $('#stLogo'); if (i) i.addEventListener('change', () => { const p = $('#stLogoPrev'); p.innerHTML = i.value ? `<img src="${esc(i.value)}" alt="">` : SCHOOL_MARK; }); }
};
ACT.saveSettings = (el) => {
  const payload = { school_name: $('#stName').value, school_foundation: $('#stFound').value, school_address: $('#stAddr').value, school_city: $('#stCity').value, school_contact: $('#stContact').value,
    logo_url: $('#stLogo').value.trim(), kepsek_name: $('#stKs').value, kepsek_nip: $('#stNip').value, report_prefix: $('#stPref').value, ai_provider: $('#stProv').value, ai_model: $('#stModel').value.trim() };
  const key = $('#stKey').value.trim();
  if (key) payload.ai_key = key;
  if ($('#stKeyClr') && $('#stKeyClr').checked) payload.ai_key = '__CLEAR__';
  if (payload.logo_url && !/^https:\/\//i.test(payload.logo_url)) { toast('warning', 'URL logo harus diawali https://'); return; }
  btnBusy(el, true, 'Menyimpan…');
  call('settings.save', payload).then((d) => { S.data.settings = d; persist(); btnBusy(el, false); toast('success', 'Pengaturan disimpan'); renderShell(); softRender(); })
    .catch((e) => { btnBusy(el, false); toast('error', 'Gagal menyimpan', e.message); });
};

// ═════════════════════════════════════════════════════════════════════════
// BAGIAN 28 — LOG AUDIT (append-only, dibaca dari server)
// ═════════════════════════════════════════════════════════════════════════
VIEWS.audit = {
  title: 'Log Audit', icon: 'history', roles: ['ADMIN', 'KEPSEK'],
  render: () => {
    const f = S.ui;
    if (!f.au_from) { const d = new Date(); d.setDate(d.getDate() - 30); f.au_from = ymd(d); f.au_to = today(); }
    const rows = S.ui.au_rows;
    if (!rows && !S.ui.au_loading) setTimeout(loadAudit, 0);
    const people = S.data.people || {};
    return `<div class="page-head"><div><div class="eyebrow">${icon('lock', 'xs')} Append-only · read-only</div><h1>Riwayat Audit Sistem</h1><p class="sub">Jejak setiap login, perubahan skor, pengesahan, perubahan rubrik, reset password, dan perubahan peran.</p></div>
      <div class="head-actions"><button class="btn ghost" data-act="auditCsv" ${rows && rows.length ? '' : 'disabled'}>${icon('download', 'sm')} Unduh CSV</button></div></div>
      <div class="card pad-0"><div style="padding:16px" class="toolbar">
        <input type="date" class="input" style="width:auto" id="auF" value="${esc(f.au_from)}" aria-label="Dari tanggal"><span class="muted">s.d.</span><input type="date" class="input" style="width:auto" id="auT" value="${esc(f.au_to)}" aria-label="Sampai tanggal">
        <select class="select" id="auU" aria-label="Pengguna"><option value="">Semua pengguna</option>${Object.keys(people).sort((a, b) => natCmp(people[a].nama, people[b].nama)).map((k) => `<option value="${k}" ${f.au_u === k ? 'selected' : ''}>${esc(people[k].nama)}</option>`).join('')}</select>
        <select class="select" id="auA" aria-label="Jenis aksi"><option value="">Semua aksi</option>${Object.keys(ACTION_LABEL).map((k) => `<option value="${k}" ${f.au_a === k ? 'selected' : ''}>${esc(ACTION_LABEL[k])}</option>`).join('')}</select>
        <div class="input-icon">${icon('search', 'sm')}<input class="input" id="auQ" placeholder="Cari ID, nama, atau rincian…" value="${esc(f.au_q || '')}"></div>
        <button class="btn" data-act="auditApply">${icon('filter', 'sm')} Terapkan</button></div>
      ${S.ui.au_loading ? `<div style="padding:0 16px 16px">${skeletonRows(6, 56)}</div>` : !rows ? '' : rows.length ? `<div class="table-wrap"><table class="t cards"><thead><tr><th>Waktu</th><th>Pengguna</th><th>Peran</th><th>Aksi</th><th>Entitas</th><th>Rincian</th></tr></thead><tbody>
        ${paginate(rows, 'au', 25).slice.map((r) => `<tr><td data-l="Waktu" class="small"><b style="display:block">${fmtTs(r.timestamp)}</b><span class="mono xs muted">${esc(r.log_id)}</span></td>
          <td class="lead"><div class="who">${avatar(r.actor_name, r.actor_id)}<div><b>${esc(r.actor_name)}</b></div></div></td><td data-l="Peran"><span class="pill">${esc(ROLE_LABEL[r.role] || r.role)}</span></td>
          <td data-l="Aksi"><span class="pill ${actionTone(r.action)}">${esc(ACTION_LABEL[r.action] || r.action)}</span></td><td data-l="Entitas" class="small">${esc(r.entity)}<br><span class="mono xs muted">${esc(r.record_id)}</span></td>
          <td data-l="Rincian" style="min-width:220px">${r.details && Object.keys(r.details).length ? `<div class="diff">${Object.keys(r.details).map((k) => `<span><b>${esc(k)}:</b> ${esc(Array.isArray(r.details[k]) ? r.details[k].join(', ') : typeof r.details[k] === 'object' ? JSON.stringify(r.details[k]) : r.details[k])}</span>`).join('')}</div>` : '<span class="faint">–</span>'}</td></tr>`).join('')}
      </tbody></table></div>${paginate(rows, 'au', 25).html}` : emptyState('Tidak ada catatan', 'Tidak ada aktivitas yang cocok dengan filter.')}
      <div class="row small muted" style="padding:14px 16px;border-top:1px solid var(--border);gap:8px">${icon('shield', 'sm')} Log bersifat permanen dan tidak dapat diubah atau dihapus dari aplikasi.</div></div>`;
  }
};
function loadAudit() {
  const f = S.ui;
  S.ui.au_loading = true; softRender();
  call('audit.list', { from: f.au_from, to: f.au_to, actor: f.au_u, action: f.au_a, q: f.au_q, limit: 500 })
    .then((d) => { S.ui.au_rows = d.rows; S.ui.au_page = 1; }).catch((e) => { S.ui.au_rows = []; toast('error', 'Gagal memuat log', e.message); })
    .finally(() => { S.ui.au_loading = false; if (S.route === 'audit') softRender(); });
}
ACT.auditApply = () => { Object.assign(S.ui, { au_from: $('#auF').value, au_to: $('#auT').value, au_u: $('#auU').value, au_a: $('#auA').value, au_q: $('#auQ').value.trim() }); loadAudit(); };
ACT.auditCsv = () => {
  const rows = S.ui.au_rows || [];
  download('Log Audit ' + today() + '.csv', 'text/csv;charset=utf-8', '﻿' + ['Waktu;ID Log;Pengguna;Peran;Aksi;Entitas;ID Rekaman;Rincian'].concat(rows.map((r) => [r.timestamp, r.log_id, r.actor_name, r.role, r.action, r.entity, r.record_id, JSON.stringify(r.details || {})].map(csvCell).join(';'))).join('\r\n'));
};
