// ═════════════════════════════════════════════════════════════════════════
// BAGIAN 12 — DASHBOARD (dispatcher per peran)
// ═════════════════════════════════════════════════════════════════════════
VIEWS.dashboard = {
  title: 'Dashboard', icon: 'dashboard', roles: null,
  render: () => {
    const r = role();
    if (r === ROLE.ADMIN) return renderAdminDashboard();
    if (r === ROLE.GURU) return renderGuruDashboard();
    if (r === 'PLH_NONAKTIF') return `<div class="page-head"><div><h1>Halo, ${esc(S.me.nama)}</h1></div></div><div class="card">${emptyState('Penunjukan PLH tidak aktif', 'Masa penunjukan Anda sebagai Pelaksana Supervisi (' + fmtDate(S.me.plh_from) + ' – ' + fmtDate(S.me.plh_to) + ') sedang tidak berlaku. Hubungi Admin bila perlu diperpanjang.')}</div>`;
    return renderSupDashboard();
  }
};

function trendSeries(filterTeacher) {
  return sortedPeriods().map((p) => {
    const ss = tbl('supervisions').filter((s) => s.period_id === p.period_id && isFinal(s) && s.final_score !== null && (!filterTeacher || s.teacher_id === filterTeacher));
    return { label: periodShort(p), value: ss.length ? ss.reduce((a, s) => a + s.final_score, 0) / ss.length : null };
  }).filter((x) => x.value !== null);
}
function categoryAverages(sessions) {
  const acc = {};
  sessions.forEach((s) => (s.category_scores || []).forEach((c) => {
    if (c.avg === null) return;
    const a = acc[c.no] = acc[c.no] || { no: c.no, name: c.name, sum: 0, n: 0 };
    a.sum += c.avg; a.n++;
  }));
  const ver = categoriesOf(activeRubricVersion());
  const base = ver.length ? ver.map((c) => ({ no: c.no, name: c.name })) : Object.values(acc);
  return base.map((c) => ({ label: c.no + '. ' + c.name, short: SHORT_CAT[c.no] || c.name, no: c.no, value: acc[c.no] ? Math.round((acc[c.no].sum / acc[c.no].n) * 100) / 100 : null }));
}

function renderSupDashboard() {
  const p = activePeriod();
  const teachersActive = tbl('teachers').filter((t) => t.status === 'aktif');
  const ss = sessionsActive();
  const byTeacher = {};
  ss.forEach((s) => { const cur = byTeacher[s.teacher_id]; const rank = { terjadwal: 1, draft: 2, observasi_selesai: 3, menunggu_tinjauan: 3, disahkan: 4, tindak_lanjut: 4, selesai: 4 }; if (!cur || rank[s.status] > rank[cur.status]) byTeacher[s.teacher_id] = s; });
  const cnt = { final: 0, wait: 0, draft: 0, sched: 0 };
  Object.values(byTeacher).forEach((s) => { if (isFinal(s)) cnt.final++; else if (s.status === 'observasi_selesai' || s.status === 'menunggu_tinjauan') cnt.wait++; else if (s.status === 'draft') cnt.draft++; else cnt.sched++; });
  const total = Math.max(teachersActive.length, Object.keys(byTeacher).length);
  const none = Math.max(0, total - cnt.final - cnt.wait - cnt.draft - cnt.sched);
  const pct = (n) => total ? (n / total) * 100 : 0;
  const aiPending = ss.filter((s) => s.status === 'menunggu_tinjauan' || s.status === 'observasi_selesai');
  const fuActive = tbl('followups').filter((f) => f.status !== 'diverifikasi' && sup(f.supervision_id) && sup(f.supervision_id).period_id === (p && p.period_id));
  const fuLate = tbl('followups').filter(fuOverdue);
  const todayList = ss.filter((s) => s.tanggal === today()).sort((a, b) => natCmp(a.jam, b.jam));
  const avgs = categoryAverages(ss.filter(isFinal));
  const trendSel = S.ui.dash_trend || '';
  const trend = trendSeries(trendSel);
  const tasks = [];
  ss.filter((s) => s.status === 'menunggu_tinjauan').forEach((s) => tasks.push({ c: 'var(--ai)', ic: 'sparkles', t: 'Rekomendasi AI siap ditinjau', d: teacher(s.teacher_id).nama + ' · ' + s.mapel + (s.final_score !== null ? ' · Nilai ' + num(s.final_score, 1) : ''), route: 'review', id: s.supervision_id }));
  ss.filter((s) => s.status === 'observasi_selesai').forEach((s) => tasks.push({ c: 'var(--primary)', ic: 'play', t: 'Minta rekomendasi AI', d: teacher(s.teacher_id).nama + ' · observasi selesai', route: 'review', id: s.supervision_id }));
  ss.filter((s) => s.status === 'draft' && s.tanggal < today()).forEach((s) => tasks.push({ c: 'var(--warning)', ic: 'clipboard', t: 'Penilaian belum diselesaikan', d: teacher(s.teacher_id).nama + ' · ' + fmtDate(s.tanggal), route: 'assess', id: s.supervision_id }));
  fuLate.forEach((f) => tasks.push({ c: 'var(--danger)', ic: 'hourglass', t: 'Tindak lanjut melewati target', d: teacher(f.teacher_id).nama + ' · target ' + fmtDate(f.target_date), route: 'hasil', id: f.supervision_id }));
  const tOptions = teachersActive.slice().sort((a, b) => natCmp(a.nama, b.nama)).map((t) => `<option value="${esc(t.teacher_id)}" ${trendSel === t.teacher_id ? 'selected' : ''}>${esc(t.nama)}</option>`).join('');

  return `<div class="page-head"><div><div class="eyebrow">${icon('calendar', 'xs')} ${esc(periodLabel(p))} · ${esc(fmtDateLong(today()))}</div>
      <h1>${greeting()}, ${esc(S.me.nama.split(',')[0])}</h1><p class="sub">Pantau mutu proses belajar-mengajar, tinjau draf rekomendasi AI, dan sahkan hasil supervisi.</p></div>
      <div class="head-actions"><button class="btn ghost" data-act="newSchedule">${icon('plus', 'sm')} Jadwalkan Supervisi</button>
      ${todayList.find((s) => s.status === 'terjadwal' || s.status === 'draft') ? `<button class="btn" data-act="nav" data-route="assess" data-id="${todayList.find((s) => s.status === 'terjadwal' || s.status === 'draft').supervision_id}">${icon('play', 'sm')} Mulai Observasi</button>` : ''}</div></div>
    <div class="grid g4">
      ${statCard('users', '', total, 'Target Semester', `${teachersActive.length} guru aktif`)}
      ${statCard('checkCircle', 'green', cnt.final, 'Observasi Disahkan', `${Math.round(pct(cnt.final))}% progres semester`)}
      ${statCard('target', 'amber', fuActive.length, 'Tindak Lanjut Aktif', fuLate.length ? `<span style="color:var(--danger)">${fuLate.length} melewati target</span>` : 'Semua sesuai jadwal')}
      ${statCard('sparkles', 'violet', aiPending.length, 'Rekomendasi AI', aiPending.length ? 'Menunggu tinjauan Anda' : 'Tidak ada antrean', aiPending.length ? 'rekomendasi' : '')}
    </div>
    <div class="card mt24"><div class="card-head"><div><h3>Progres Supervisi Semester Ini</h3><p class="sub">${cnt.final} dari ${total} guru sudah disahkan</p></div><span class="pill green">${Math.round(pct(cnt.final))}% selesai</span></div>
      <div class="stackbar" role="img" aria-label="Progres supervisi"><i style="width:${pct(cnt.final)}%;background:var(--success)"></i><i style="width:${pct(cnt.wait)}%;background:var(--warning)"></i><i style="width:${pct(cnt.draft)}%;background:var(--text-faint)"></i><i style="width:${pct(cnt.sched)}%;background:var(--primary)"></i></div>
      <div class="legend six">
        ${legend('var(--success)', 'Disahkan', cnt.final, total)}${legend('var(--warning)', 'Menunggu Pengesahan', cnt.wait, total)}${legend('var(--text-faint)', 'Draft Penilaian', cnt.draft, total)}
        ${legend('var(--primary)', 'Terjadwal', cnt.sched, total)}${legend('var(--border-strong)', 'Belum Dijadwalkan', none, total)}
      </div></div>
    <div class="grid g2 mt24">
      <div class="card"><div class="card-head"><div><h3>Rata-rata per Dimensi</h3><p class="sub">Pembelajaran Mendalam · skala 1–4 · hasil disahkan</p></div></div>${hbarChart(avgs, { max: 4, threshold: 2, dec: 2, label: 'Rata-rata nilai per dimensi' })}</div>
      <div class="card"><div class="card-head"><div><h3>Tren Nilai Antarsemester</h3><p class="sub">Rata-rata nilai akhir (0–100)</p></div>
        <select class="select" style="width:auto;max-width:200px;min-height:36px" data-change="dashTrend" aria-label="Pilih guru"><option value="">Rata-rata sekolah</option>${tOptions}</select></div>
        ${lineChart(trend, { label: 'Tren nilai' })}</div>
    </div>
    <div class="grid g2 mt24">
      <div class="card"><div class="card-head"><div><h3>Jadwal Observasi Hari Ini</h3><p class="sub">${fmtDateLong(today())} · ${todayList.length} sesi</p></div><button class="btn plain sm" data-act="nav" data-route="jadwal">Kalender ${icon('chevRight', 'xs')}</button></div>
        ${todayList.length ? `<div class="list">${todayList.map((s) => `<div class="li"><div class="time-badge">${esc(s.jam || '--:--')}<small>WIB</small></div>
          <div class="grow"><b class="ellipsis">${esc(teacher(s.teacher_id).nama)}</b><small class="ellipsis">${esc(s.mapel)} · ${esc(s.kelas)}${s.topik ? ' · ' + esc(s.topik) : ''}</small></div>
          ${s.status === 'terjadwal' || s.status === 'draft' ? `<button class="btn sm ${s.status === 'draft' ? 'ghost' : ''}" data-act="nav" data-route="assess" data-id="${s.supervision_id}">${s.status === 'draft' ? 'Lanjutkan' : 'Mulai'}</button>` : statusPill(s.status)}</div>`).join('')}</div>`
          : emptyState('Tidak ada jadwal hari ini', 'Gunakan tombol Jadwalkan Supervisi untuk menambah sesi observasi.')}</div>
      <div class="card"><div class="card-head"><div><h3>Perlu Tindakan</h3><p class="sub">${tasks.length} butuh perhatian</p></div></div>
        ${tasks.length ? `<div class="list">${tasks.slice(0, 6).map((t) => `<div class="li click accent-l" style="--c:${t.c}" data-act="nav" data-route="${t.route}" data-id="${t.id}" role="button" tabindex="0">
          <span style="color:${t.c}">${icon(t.ic)}</span><div class="grow"><b>${esc(t.t)}</b><small class="ellipsis">${esc(t.d)}</small></div>${icon('chevRight', 'sm')}</div>`).join('')}</div>`
          : `<div class="okbox">${icon('checkCircle', 'sm')}<span>Semua beres. Tidak ada tindakan yang tertunda.</span></div>`}</div>
    </div>`;
}
function statCard(ic, tone, n, label, foot, route) {
  return `<div class="card ${route ? 'hover' : ''}" ${route ? `data-act="nav" data-route="${route}" role="button" tabindex="0"` : ''}><div class="stat"><span class="ic ${tone}">${icon(ic)}</span><span class="num">${esc(n)}</span><span class="lbl">${esc(label)}</span><span class="foot">${foot}</span></div></div>`;
}
function legend(c, label, n, total) { return `<div class="lg" style="--c:${c}"><span>${esc(label)}</span><b>${n}</b>${total ? Math.round((n / total) * 100) : 0}% guru</div>`; }
ACT.dashTrend = (el) => { S.ui.dash_trend = el.value; softRender(); };

// ═════════════════════════════════════════════════════════════════════════
// BAGIAN 13 — JADWAL SUPERVISI (kalender + daftar)
// ═════════════════════════════════════════════════════════════════════════
VIEWS.jadwal = {
  title: 'Jadwal Supervisi', icon: 'calendar', roles: ['KEPSEK', 'PLH', 'GURU'],
  render: () => {
    const view = S.ui.jadwal_view || 'kalender';
    const ro = isGuru();
    return `<div class="page-head"><div><h1>Jadwal Supervisi</h1><p class="sub">${ro ? 'Jadwal observasi kelas Anda pada semester berjalan.' : 'Atur sesi observasi — anjuran maksimal 3 guru per hari.'}</p></div>
      <div class="head-actions"><div class="seg" role="tablist" style="grid-auto-columns:110px">
        <button class="${view === 'kalender' ? 'on' : ''}" data-act="setUi" data-key="jadwal_view" data-val="kalender">Kalender</button>
        <button class="${view === 'daftar' ? 'on' : ''}" data-act="setUi" data-key="jadwal_view" data-val="daftar">Daftar</button></div>
        ${ro ? '' : `<button class="btn" data-act="newSchedule">${icon('plus', 'sm')} Tambah Jadwal</button>`}</div></div>
      ${view === 'kalender' ? renderCalendar() : renderScheduleList()}`;
  }
};
function scheduleSessions() { return sessionsActive().slice().sort((a, b) => natCmp(a.tanggal + a.jam, b.tanggal + b.jam)); }
function renderCalendar() {
  const ym = S.ui.jadwal_month || today().slice(0, 7);
  const [Y, M] = ym.split('-').map(Number);
  const first = new Date(Y, M - 1, 1);
  const start = new Date(first); start.setDate(1 - ((first.getDay() + 6) % 7));
  const byDay = {};
  scheduleSessions().forEach((s) => { (byDay[s.tanggal] = byDay[s.tanggal] || []).push(s); });
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    const key = ymd(d);
    const evs = byDay[key] || [];
    cells.push(`<div class="day ${d.getMonth() !== M - 1 ? 'out' : ''} ${key === today() ? 'today' : ''}" data-act="calDay" data-date="${key}" role="button" tabindex="0" aria-label="${fmtDateLong(key)}, ${evs.length} jadwal">
      <span class="dnum">${d.getDate()}</span>${evs.slice(0, 3).map((s) => `<span class="ev ${isFinal(s) ? 'final' : ''}" data-act="openSession" data-id="${s.supervision_id}" title="${esc(s.jam + ' ' + teacher(s.teacher_id).nama)}">${esc((s.jam || '') + ' ' + teacher(s.teacher_id).nama.split(' ')[0])}</span>`).join('')}
      ${evs.length > 3 ? `<span class="more">${icon('alert', 'xs')} +${evs.length - 3}</span>` : ''}</div>`);
    if (i >= 34 && d.getMonth() !== M - 1 && d.getDay() === 0) break;
  }
  const prev = new Date(Y, M - 2, 1), next = new Date(Y, M, 1);
  return `<div class="card"><div class="card-head"><h3>${BULAN[M - 1]} ${Y}</h3><div class="row">
    <button class="icon-btn" data-act="setUi" data-key="jadwal_month" data-val="${ymd(prev).slice(0, 7)}" aria-label="Bulan sebelumnya">${icon('chevLeft')}</button>
    <button class="btn ghost sm" data-act="setUi" data-key="jadwal_month" data-val="${today().slice(0, 7)}">Hari ini</button>
    <button class="icon-btn" data-act="setUi" data-key="jadwal_month" data-val="${ymd(next).slice(0, 7)}" aria-label="Bulan berikutnya">${icon('chevRight')}</button></div></div>
    <div class="cal">${['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map((d) => `<div class="dow">${d}</div>`).join('')}${cells.join('')}</div>
    <div class="row wrap mt16 small muted" style="gap:16px"><span class="row" style="gap:6px"><i style="width:12px;height:12px;border-radius:4px;background:var(--primary-light)"></i> Terjadwal / proses</span>
    <span class="row" style="gap:6px"><i style="width:12px;height:12px;border-radius:4px;background:var(--success-bg)"></i> Disahkan</span><span class="row" style="gap:6px;color:var(--warning-ink)">${icon('alert', 'xs')} Lebih dari 3 jadwal</span></div></div>
    ${renderDayAgenda()}`;
}
function renderDayAgenda() {
  const d = S.ui.jadwal_day;
  if (!d) return '';
  const list = scheduleSessions().filter((s) => s.tanggal === d);
  return `<div class="card mt16"><div class="card-head"><div><h3>${fmtDateLong(d)}</h3><p class="sub">${list.length} jadwal${list.length > 3 ? ' · melebihi anjuran 3 sesi' : ''}</p></div>${isGuru() ? '' : `<button class="btn sm" data-act="newSchedule" data-date="${d}">${icon('plus', 'sm')} Tambah</button>`}</div>
    ${list.length ? `<div class="list">${list.map(sessionRow).join('')}</div>` : '<p class="muted small">Belum ada jadwal pada tanggal ini.</p>'}</div>`;
}
function sessionRow(s) {
  const t = teacher(s.teacher_id);
  const ro = isGuru();
  return `<div class="li"><div class="time-badge">${esc(s.jam || '--')}<small>${esc(fmtDate(s.tanggal).split(' ').slice(0, 2).join(' '))}</small></div>
    <div class="grow"><b class="ellipsis">${esc(t.nama)}</b><small class="ellipsis">${esc(s.mapel)} · ${esc(s.kelas)}${s.topik ? ' · ' + esc(s.topik) : ''}</small></div>
    ${statusPill(s.status)}
    ${ro ? (isFinal(s) ? `<button class="btn sm ghost" data-act="nav" data-route="hasil-saya" data-id="${s.supervision_id}">Lihat</button>` : '') : `<button class="icon-btn" data-act="sessionMenu" data-id="${s.supervision_id}" aria-label="Aksi">${icon('chevDown', 'sm')}</button>`}</div>`;
}
function renderScheduleList() {
  const q = (S.ui.jadwal_q || '').toLowerCase();
  const st = S.ui.jadwal_st || '';
  const list = scheduleSessions().filter((s) => (!q || (teacher(s.teacher_id).nama + ' ' + s.mapel + ' ' + s.kelas + ' ' + s.topik).toLowerCase().indexOf(q) > -1) && (!st || s.status === st));
  const pg = paginate(list, 'jadwal', 12);
  return `<div class="card pad-0"><div style="padding:16px" class="toolbar">
      <div class="input-icon">${icon('search', 'sm')}<input class="input" id="jdQ" placeholder="Cari guru, mapel, kelas…" value="${esc(S.ui.jadwal_q || '')}" data-input="uiFilter" data-key="jadwal_q"></div>
      <select class="select" data-change="uiSelect" data-key="jadwal_st" aria-label="Filter status"><option value="">Semua status</option>${Object.keys(STATUS_LABEL).filter((k) => k !== 'terlambat' && k !== 'dalam_proses').map((k) => `<option value="${k}" ${st === k ? 'selected' : ''}>${STATUS_LABEL[k]}</option>`).join('')}</select></div>
    ${list.length ? `<div class="table-wrap"><table class="t cards"><thead><tr><th>Tanggal</th><th>Jam</th><th>Guru</th><th>Mapel · Kelas</th><th>Topik</th><th>Status</th><th></th></tr></thead><tbody>
      ${pg.slice.map((s) => `<tr><td data-l="Tanggal">${fmtDate(s.tanggal)}</td><td data-l="Jam">${esc(s.jam || '–')}</td><td class="lead"><div class="who">${avatar(teacher(s.teacher_id).nama, s.teacher_id)}<div><b>${esc(teacher(s.teacher_id).nama)}</b></div></div></td>
        <td data-l="Mapel">${esc(s.mapel)} · ${esc(s.kelas)}</td><td data-l="Topik">${esc(s.topik || '–')}</td><td data-l="Status">${statusPill(s.status)}</td>
        <td><div class="acts">${isGuru() ? '' : `<button class="icon-btn" data-act="sessionMenu" data-id="${s.supervision_id}" aria-label="Aksi">${icon('chevDown', 'sm')}</button>`}</div></td></tr>`).join('')}</tbody></table></div>${pg.html}`
      : emptyState('Belum ada jadwal', 'Jadwal supervisi semester ini akan tampil di sini.')}</div>`;
}
ACT.uiSelect = (el) => { S.ui[el.dataset.key] = el.value; S.ui[el.dataset.key.replace(/_[a-z]+$/, '') + '_page'] = 1; softRender(); };
ACT.calDay = (el, e) => { if (e.target.closest('.ev')) return; S.ui.jadwal_day = el.dataset.date; softRender(); };
ACT.openSession = (el) => {
  const s = sup(el.dataset.id); if (!s) return;
  if (isGuru()) { if (isFinal(s)) navigate('hasil-saya', { id: s.supervision_id }); else { S.ui.jadwal_day = s.tanggal; softRender(); } return; }
  openSessionDefault(s);
};
function openSessionDefault(s) {
  if (s.status === 'terjadwal' || s.status === 'draft') navigate('assess', { id: s.supervision_id });
  else if (s.status === 'observasi_selesai' || s.status === 'menunggu_tinjauan') navigate('review', { id: s.supervision_id });
  else navigate('hasil', { id: s.supervision_id });
}
ACT.sessionMenu = (el) => {
  const s = sup(el.dataset.id); if (!s) return;
  const items = [];
  if (s.status === 'terjadwal' || s.status === 'draft') items.push({ icon: 'play', label: s.status === 'draft' ? 'Lanjutkan penilaian' : 'Mulai penilaian', fn: () => navigate('assess', { id: s.supervision_id }) });
  if (s.status === 'observasi_selesai' || s.status === 'menunggu_tinjauan') items.push({ icon: 'sparkles', label: 'Tinjau rekomendasi AI', fn: () => navigate('review', { id: s.supervision_id }) });
  if (isFinal(s)) items.push({ icon: 'file', label: 'Lihat hasil', fn: () => navigate('hasil', { id: s.supervision_id }) }, { icon: 'printer', label: 'Cetak laporan PDF', fn: () => openReport(s.supervision_id) });
  if (s.status === 'terjadwal' || s.status === 'draft') items.push({ icon: 'edit', label: 'Ubah jadwal', fn: () => scheduleModal(s) });
  if (s.status === 'terjadwal') items.push({ sep: true }, { icon: 'trash', label: 'Hapus jadwal', danger: true, fn: () => deleteSchedule(s) });
  popMenu(el, items);
};

ACT.newSchedule = (el) => scheduleModal(null, el.dataset.date);
function scheduleModal(s, date) {
  const ts = tbl('teachers').filter((t) => t.status === 'aktif' || (s && t.teacher_id === s.teacher_id)).sort((a, b) => natCmp(a.nama, b.nama));
  if (!ts.length) { toast('warning', 'Belum ada data guru', 'Minta Admin menambahkan data guru terlebih dahulu.'); return; }
  if (!activePeriod()) { toast('warning', 'Belum ada periode aktif', 'Minta Admin menetapkan periode semester aktif.'); return; }
  const v = s || { tanggal: date || today(), jam: '08:00' };
  const m = openModal({
    title: s ? 'Ubah Jadwal Supervisi' : 'Jadwalkan Supervisi', icon: 'calendar', sub: periodLabel(activePeriod()),
    body: `<div class="form-grid two">
      <div class="field span2"><label for="scT">Guru <span class="req">*</span></label><select id="scT" class="select">${ts.map((t) => `<option value="${esc(t.teacher_id)}" data-mapel="${esc(t.mapel)}" data-kelas="${esc(t.kelas_diampu)}" ${v.teacher_id === t.teacher_id ? 'selected' : ''}>${esc(t.nama)} — ${esc(t.mapel)}</option>`).join('')}</select></div>
      <div class="field"><label for="scD">Tanggal <span class="req">*</span></label><input id="scD" type="date" class="input" value="${esc(v.tanggal)}"></div>
      <div class="field"><label for="scJ">Jam</label><input id="scJ" type="time" class="input" value="${esc(v.jam || '')}"></div>
      <div class="field"><label for="scK">Kelas <span class="req">*</span></label><input id="scK" class="input" value="${esc(v.kelas || '')}" placeholder="mis. XI-1" list="scKl"><datalist id="scKl"></datalist></div>
      <div class="field"><label for="scM">Mata pelajaran</label><input id="scM" class="input" value="${esc(v.mapel || '')}"></div>
      <div class="field span2"><label for="scP">Topik / materi</label><input id="scP" class="input" value="${esc(v.topik || '')}" placeholder="mis. Hukum Bernoulli"></div>
      <div id="scW" class="warnbox span2" style="display:none">${icon('alert', 'sm')}<span></span></div></div>`,
    footer: `<button class="btn ghost" data-close>Batal</button><button class="btn" id="scSave">${icon('save', 'sm')} Simpan Jadwal</button>`
  });
  const el = m.el;
  const sync = () => {
    const opt = $('#scT', el).selectedOptions[0];
    if (!s || !$('#scM', el).value) $('#scM', el).value = opt.dataset.mapel;
    $('#scKl', el).innerHTML = String(opt.dataset.kelas || '').split(',').map((k) => `<option value="${esc(k.trim())}">`).join('');
    const n = sessionsActive().filter((x) => x.tanggal === $('#scD', el).value && (!s || x.supervision_id !== s.supervision_id)).length;
    const w = $('#scW', el);
    w.style.display = n >= 3 ? 'flex' : 'none';
    w.querySelector('span').textContent = `Sudah ada ${n} jadwal pada tanggal ini (anjuran maksimal 3 sesi per hari).`;
  };
  $('#scT', el).addEventListener('change', () => { $('#scM', el).value = ''; sync(); });
  $('#scD', el).addEventListener('change', sync);
  sync();
  $('#scSave', el).onclick = () => {
    const payload = { supervision_id: s ? s.supervision_id : undefined, teacher_id: $('#scT', el).value, tanggal: $('#scD', el).value, jam: $('#scJ', el).value,
      kelas: $('#scK', el).value.trim(), mapel: $('#scM', el).value.trim(), topik: $('#scP', el).value.trim() };
    if (!payload.tanggal) return $('#scD', el).classList.add('err');
    if (!payload.kelas) return $('#scK', el).classList.add('err');
    const snap = snapshot('supervisions');
    const tmpId = s ? s.supervision_id : uid();
    m.close();
    optimistic({
      apply: () => upsertLocal('supervisions', Object.assign({}, s || { status: 'terjadwal', period_id: activePeriod().period_id, rubric_version: activeRubricVersion(), supervisor_id: S.me.user_id }, payload, { supervision_id: tmpId })),
      revert: () => restore('supervisions', snap),
      action: 'supervisions.save', payload,
      okMsg: s ? 'Jadwal diperbarui' : 'Jadwal ditambahkan',
      onDone: (d) => { if (!s) removeLocal('supervisions', tmpId); upsertLocal('supervisions', d.supervision); if (d.warning) toast('warning', 'Perhatian', d.warning); }
    }).catch(() => { /* sudah ditangani */ });
  };
}
async function deleteSchedule(s) {
  const ok = await confirmDialog({ title: 'Hapus jadwal?', message: `Jadwal ${teacher(s.teacher_id).nama} pada ${fmtDateLong(s.tanggal)} akan dihapus.`, okText: 'Hapus', danger: true });
  if (!ok) return;
  const snap = snapshot('supervisions');
  optimistic({ apply: () => removeLocal('supervisions', s.supervision_id), revert: () => restore('supervisions', snap), action: 'supervisions.delete', payload: { supervision_id: s.supervision_id }, okMsg: 'Jadwal dihapus' }).catch(() => {});
}

// ═════════════════════════════════════════════════════════════════════════
// BAGIAN 14 — DAFTAR PENILAIAN
// ═════════════════════════════════════════════════════════════════════════
VIEWS.penilaian = {
  title: 'Formulir Penilaian', icon: 'clipboard', roles: SUPR,
  render: () => {
    const ss = scheduleSessions().filter((s) => s.status === 'terjadwal' || s.status === 'draft');
    const t = today();
    const groups = [
      { k: 'Lewat tanggal — belum dinilai', items: ss.filter((s) => s.tanggal < t), tone: 'amber' },
      { k: 'Hari ini', items: ss.filter((s) => s.tanggal === t), tone: 'blue' },
      { k: 'Akan datang', items: ss.filter((s) => s.tanggal > t), tone: '' }
    ];
    const done = sessionsActive().filter((s) => s.status === 'observasi_selesai');
    return `<div class="page-head"><div><h1>Formulir Penilaian</h1><p class="sub">Pilih sesi observasi untuk diisi. Penilaian tersimpan otomatis di perangkat & server.</p></div>
      <div class="head-actions"><button class="btn ghost" data-act="newSchedule">${icon('plus', 'sm')} Jadwal Baru</button></div></div>
      ${ss.length ? groups.filter((g) => g.items.length).map((g) => `<div class="card mb16"><div class="card-head"><h3>${esc(g.k)} <span class="pill ${g.tone}">${g.items.length}</span></h3></div>
        <div class="list">${g.items.map((s) => {
          const sc = computeScore(rubricOf(s.rubric_version || activeRubricVersion()), mergedItems(s.supervision_id));
          return `<div class="li"><div class="time-badge">${esc(s.jam || '--')}<small>${esc(fmtDate(s.tanggal).split(' ').slice(0, 2).join(' '))}</small></div>
            <div class="grow"><b class="ellipsis">${esc(teacher(s.teacher_id).nama)}</b><small class="ellipsis">${esc(s.mapel)} · ${esc(s.kelas)} · ${s.status === 'draft' ? `${sc.filled}/${sc.total} indikator terisi` : 'belum dimulai'}</small></div>
            ${statusPill(s.status)}<button class="btn sm ${s.status === 'draft' ? 'ghost' : ''}" data-act="nav" data-route="assess" data-id="${s.supervision_id}">${s.status === 'draft' ? 'Lanjutkan' : 'Mulai'}</button></div>`;
        }).join('')}</div></div>`).join('') : `<div class="card">${emptyState('Tidak ada sesi untuk dinilai', 'Semua jadwal semester ini sudah dinilai. Tambahkan jadwal baru bila perlu.', `<button class="btn" data-act="newSchedule">${icon('plus', 'sm')} Jadwalkan Supervisi</button>`)}</div>`}
      ${done.length ? `<div class="card"><div class="card-head"><h3>Observasi selesai — lanjut ke rekomendasi <span class="pill violet">${done.length}</span></h3></div><div class="list">${done.map((s) => `<div class="li click" data-act="nav" data-route="review" data-id="${s.supervision_id}" role="button" tabindex="0">${avatar(teacher(s.teacher_id).nama, s.teacher_id)}<div class="grow"><b>${esc(teacher(s.teacher_id).nama)}</b><small>${esc(s.mapel)} · Nilai ${num(s.final_score, 1)}</small></div>${icon('sparkles')}</div>`).join('')}</div></div>` : ''}`;
  }
};

// ═════════════════════════════════════════════════════════════════════════
// BAGIAN 15 — FORMULIR PENILAIAN OBSERVASI (autosave optimistik)
// ═════════════════════════════════════════════════════════════════════════
function mergedItems(id) {
  const d = S.drafts[id] || LS.get('sg_draft_' + id, null);
  const base = {};
  asmOf(id).forEach((a) => { base[a.indicator_id] = { indicator_id: a.indicator_id, score: a.score, not_observed: a.not_observed, evidence: a.evidence, notes: a.notes }; });
  if (d && d.items) Object.keys(d.items).forEach((k) => { base[k] = Object.assign({ indicator_id: k }, d.items[k]); });
  return Object.values(base);
}
function getDraft(id) {
  if (S.drafts[id]) return S.drafts[id];
  const items = {};
  mergedItems(id).forEach((it) => { items[it.indicator_id] = { score: it.score, not_observed: !!it.not_observed, evidence: it.evidence || '', notes: it.notes || '' }; });
  const ls = LS.get('sg_draft_' + id, null);
  S.drafts[id] = { items, dirty: !!(ls && ls.dirty), savedAt: ls ? ls.at : null, saving: false, error: null };
  return S.drafts[id];
}
function setItem(id, ind, patch) {
  const d = getDraft(id);
  d.items[ind] = Object.assign({ score: null, not_observed: false, evidence: '', notes: '' }, d.items[ind], patch);
  d.dirty = true;
  LS.set('sg_draft_' + id, { items: d.items, dirty: true, at: new Date().toISOString() });
  const s = sup(id);
  if (s && s.status === 'terjadwal') { upsertLocal('supervisions', { supervision_id: id, status: 'draft' }); }
  updateAssessSummary(id);
  scheduleSync(id);
}
const syncTimers = {};
function scheduleSync(id, ms) { clearTimeout(syncTimers[id]); syncTimers[id] = setTimeout(() => syncDraft(id), ms || 1500); }
function draftItems(id) { const d = getDraft(id); return Object.keys(d.items).map((k) => Object.assign({ indicator_id: k }, d.items[k])); }
function syncDraft(id) {
  const d = S.drafts[id];
  if (!d || !d.dirty) return Promise.resolve();
  if (d.saving) { scheduleSync(id, 800); return Promise.resolve(); }
  d.saving = true;
  setSaveStatus(id, 'saving');
  const items = draftItems(id);
  const sent = JSON.stringify(items);
  return call('assessments.save', { supervision_id: id, items }).then((r) => {
    d.saving = false; d.error = null;
    upsertLocal('supervisions', r.supervision);
    upsertManyLocal('assessments', r.assessments);
    if (JSON.stringify(draftItems(id)) === sent) { d.dirty = false; LS.del('sg_draft_' + id); } else scheduleSync(id, 600);
    d.savedAt = new Date().toISOString();
    persist();
    setSaveStatus(id, 'saved');
  }).catch((e) => {
    d.saving = false; d.error = e.message;
    if (e.code === 'LOCKED_RECORD' || e.code === 'VALIDATION') { toast('error', 'Penilaian tidak tersimpan', e.message); setSaveStatus(id, 'error'); return; }
    setSaveStatus(id, 'offline');
    scheduleSync(id, 15000);
  });
}
function flushDraft(id) { if (!id) return Promise.resolve(); clearTimeout(syncTimers[id]); return syncDraft(id); }
function setSaveStatus(id, st) {
  const el = $('#asSave'); if (!el || S.params.id !== id) return;
  const d = S.drafts[id] || {};
  const t = d.savedAt ? new Date(d.savedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '';
  el.innerHTML = st === 'saving' ? `<span class="spinner sm"></span> Menyimpan…`
    : st === 'offline' ? `${icon('cloudOff', 'sm')} Tersimpan di perangkat · menunggu koneksi`
    : st === 'error' ? `${icon('alert', 'sm')} Gagal menyimpan`
    : `${icon('cloud', 'sm')} ${t ? 'Tersimpan otomatis ' + t : 'Tersimpan'}`;
  el.style.color = st === 'offline' ? 'var(--warning-ink)' : st === 'error' ? 'var(--danger)' : 'var(--text-muted)';
}
window.addEventListener('beforeunload', (e) => { if (Object.values(S.drafts).some((d) => d.dirty)) { Object.keys(S.drafts).forEach((k) => flushDraft(k)); } });

VIEWS.assess = {
  title: 'Penilaian Supervisi', icon: 'clipboard', roles: SUPR, parent: 'penilaian', hidden: true,
  crumb: () => { const s = sup(S.params.id); return s ? teacher(s.teacher_id).nama : 'Penilaian'; },
  render: (p) => {
    const s = sup(p.id);
    if (!s) return emptyState('Sesi tidak ditemukan', 'Sesi mungkin sudah dihapus.', `<button class="btn" data-act="nav" data-route="penilaian">Kembali</button>`);
    if (!(s.status === 'terjadwal' || s.status === 'draft')) {
      return `<div class="card">${emptyState('Penilaian sudah ditandai selesai', 'Nilai terkunci. Buka halaman hasil untuk melihat atau membuka kembali penilaian.', `<button class="btn" data-act="openSessionBtn" data-id="${s.supervision_id}">Buka Halaman Berikutnya</button>`)}</div>`;
    }
    S.editing = true;
    const ver = s.rubric_version && rubricOf(s.rubric_version).length ? s.rubric_version : activeRubricVersion();
    const cats = categoriesOf(ver);
    const t = teacher(s.teacher_id);
    const d = getDraft(s.supervision_id);
    const openCat = S.ui['acc_' + s.supervision_id] || (cats[0] && cats[0].no);
    return `<div class="card" style="margin:8px 0 20px"><div class="row wrap" style="gap:16px;align-items:flex-start">
        ${avatar(t.nama, s.teacher_id, 'lg')}<div class="grow hero-id"><div class="row wrap" style="gap:8px"><h2>${esc(t.nama)}</h2>${statusPill(s.status)}<span class="pill violet">Rubrik v${esc(ver)}</span></div>
        <div class="row wrap small muted mt8" style="gap:14px"><span class="row" style="gap:6px">${icon('idcard', 'sm')} NIP ${esc(t.nip || '–')}</span><span class="row" style="gap:6px">${icon('cap', 'sm')} ${esc(s.mapel)} — ${esc(s.kelas)}</span>
        <span class="row" style="gap:6px">${icon('calendar', 'sm')} ${fmtDateLong(s.tanggal)} ${esc(s.jam || '')}</span>${s.topik ? `<span class="row" style="gap:6px">${icon('book', 'sm')} ${esc(s.topik)}</span>` : ''}</div></div>
        <div id="asSave" class="row small muted" style="gap:6px" aria-live="polite"></div></div></div>
      <div id="asMini" class="card hide-lg" style="position:sticky;top:72px;z-index:30;padding:12px 16px;margin-bottom:16px"></div>
      <div class="infobox mb16">${icon('bulb', 'sm')}<span><b>Panduan:</b> catat bukti konkret (fakta/perilaku teramati) sebelum memberi skor. Pilih <b>Belum diamati</b> bila tidak ada bukti — tidak dihitung 0.</span></div>
      <div class="grid g-main" style="align-items:start">
        <div>${cats.map((c) => assessCategory(s, c, d, openCat === c.no)).join('')}</div>
        <div class="hide-sm-lg"><div class="card sticky" id="asSummary"></div></div>
      </div>
      <div class="actionbar"><button class="btn ghost" data-act="nav" data-route="penilaian">${icon('arrowLeft', 'sm')} <span class="hide-sm">Kembali</span></button>
        <div class="info hide-sm" id="asBarInfo"></div>
        <button class="btn ghost" data-act="saveDraftNow" data-id="${s.supervision_id}">${icon('save', 'sm')} <span class="hide-sm">Simpan Draf</span></button>
        <button class="btn" data-act="completeAssess" data-id="${s.supervision_id}"><span class="hide-sm">Tandai&nbsp;</span>Selesai & Hitung Nilai ${icon('arrowRight', 'sm')}</button></div>`;
  },
  after: (p) => { updateAssessSummary(p.id); const d = S.drafts[p.id]; setSaveStatus(p.id, d && d.dirty ? (S.online ? 'saving' : 'offline') : 'saved'); if (d && d.dirty) scheduleSync(p.id, 300); }
};
ACT.openSessionBtn = (el) => openSessionDefault(sup(el.dataset.id));

function assessCategory(s, c, d, open) {
  const filled = c.items.filter((r) => { const it = d.items[r.indicator_id]; return it && (it.not_observed || it.score); }).length;
  return `<div class="acc ${open ? 'open' : ''}" data-cat="${c.no}"><button class="acc-head" data-act="accAssess" data-sid="${s.supervision_id}" data-cat="${c.no}" aria-expanded="${open}">
    <span class="acc-num ${filled === c.items.length ? 'done' : ''}" id="accN-${c.no}">${filled === c.items.length ? icon('check', 'sm') : c.no}</span>
    <span class="acc-title"><b>${c.no}. ${esc(c.name)}</b><small>Bobot ${c.weight}% · <span id="accC-${c.no}">${filled}/${c.items.length} terisi</span></small></span>
    <span class="chev">${icon('chevDown')}</span></button>
    <div class="acc-body">${c.items.map((r) => indicatorBlock(s, r, d.items[r.indicator_id] || {})).join('')}</div></div>`;
}
function domId(v) { return String(v).replace(/[^a-zA-Z0-9_-]/g, '_'); }
function indicatorBlock(s, r, it) {
  const sid = s.supervision_id, ind = r.indicator_id, did = domId(ind);
  return `<div class="ind" data-ind="${esc(ind)}">
    <div class="row between"><span class="ind-code">IND ${esc(ind)}</span></div>
    <p class="ind-desc">${esc(r.description)}</p>
    ${r.evidence_guide ? `<div class="guide">${icon('book', 'sm')}<span><b>Panduan bukti:</b> ${esc(r.evidence_guide)}</span></div>` : ''}
    <div class="tiles" role="radiogroup" aria-label="Skor indikator ${esc(ind)}">
      ${SCALE.map((x) => `<button type="button" class="tile s${x.v} ${!it.not_observed && it.score === x.v ? 'on' : ''}" role="radio" aria-checked="${!it.not_observed && it.score === x.v}" data-act="score" data-sid="${sid}" data-ind="${esc(ind)}" data-v="${x.v}">
        <span class="n">[${x.v}]</span><b>${x.t}</b><small>${x.d}</small></button>`).join('')}
      <button type="button" class="tile s0 ${it.not_observed ? 'on' : ''}" role="radio" aria-checked="${!!it.not_observed}" data-act="notObs" data-sid="${sid}" data-ind="${esc(ind)}"><b class="row" style="gap:6px">${icon('eyeOff', 'sm')} Belum diamati</b><small>Tunda penilaian</small></button>
    </div>
    <div class="ind-fields">
      <div class="field"><label class="lbl-row" for="ev-${did}"><span>Bukti observasi (fakta teramati)</span><span class="count" id="evc-${did}">${(it.evidence || '').length} karakter</span></label>
        <textarea id="ev-${did}" class="textarea" data-input="asmText" data-sid="${sid}" data-ind="${esc(ind)}" data-f="evidence" placeholder="mis. Guru meminta murid menuliskan target belajar sebelum eksperimen…">${esc(it.evidence || '')}</textarea></div>
      <div class="field"><label class="lbl-row" for="nt-${did}"><span>Catatan / saran mentoring</span><span class="count" id="ntc-${did}">${(it.notes || '').length} karakter</span></label>
        <textarea id="nt-${did}" class="textarea" data-input="asmText" data-sid="${sid}" data-ind="${esc(ind)}" data-f="notes" placeholder="Catatan untuk umpan balik…">${esc(it.notes || '')}</textarea></div>
    </div></div>`;
}
ACT.accAssess = (el) => { const acc = el.closest('.acc'); acc.classList.toggle('open'); if (acc.classList.contains('open')) S.ui['acc_' + el.dataset.sid] = Number(el.dataset.cat); el.setAttribute('aria-expanded', acc.classList.contains('open')); };
ACT.score = (el) => {
  const v = Number(el.dataset.v);
  const group = el.closest('.tiles');
  $$('.tile', group).forEach((t) => { const on = t === el; t.classList.toggle('on', on); t.setAttribute('aria-checked', String(on)); });
  setItem(el.dataset.sid, el.dataset.ind, { score: v, not_observed: false });
};
ACT.notObs = (el) => {
  const group = el.closest('.tiles');
  const on = !el.classList.contains('on');
  $$('.tile', group).forEach((t) => { t.classList.remove('on'); t.setAttribute('aria-checked', 'false'); });
  el.classList.toggle('on', on); el.setAttribute('aria-checked', String(on));
  setItem(el.dataset.sid, el.dataset.ind, { not_observed: on, score: null });
};
INPUT.asmText = (el) => {
  const patch = {}; patch[el.dataset.f] = el.value;
  const c = $('#' + (el.dataset.f === 'evidence' ? 'evc-' : 'ntc-') + domId(el.dataset.ind));
  if (c) c.textContent = el.value.length + ' karakter';
  setItem(el.dataset.sid, el.dataset.ind, patch);
};
ACT.saveDraftNow = (el) => { const id = el.dataset.id; const d = getDraft(id); if (!d.dirty) { toast('info', 'Semua perubahan sudah tersimpan'); return; } flushDraft(id).then(() => { if (!S.drafts[id].dirty) toast('success', 'Draf tersimpan'); }); };

function updateAssessSummary(id) {
  const s = sup(id); if (!s) return;
  const ver = s.rubric_version && rubricOf(s.rubric_version).length ? s.rubric_version : activeRubricVersion();
  const rows = rubricOf(ver);
  const sc = computeScore(rows, draftItems(id));
  const pred = predicate(sc.final);
  const box = $('#asSummary');
  if (box) {
    box.innerHTML = `<h3>Ringkasan Nilai</h3><p class="small muted">Dihitung otomatis · pratinjau instan</p>
      <div class="row mt16" style="gap:16px">${gauge(sc.final)}<div><b style="display:block">${esc(pred.code)} · ${esc(pred.label)}</b><span class="small muted">${sc.filled} dari ${sc.total} indikator dinilai</span>
        <div class="progress mt8"><i style="width:${sc.total ? (sc.filled / sc.total) * 100 : 0}%"></i></div></div></div>
      <div class="mt16">${sc.categories.map((c) => `<div class="minibar"><span class="ellipsis">${c.no}. ${esc(SHORT_CAT[c.no] || c.name)}</span><span class="bar"><i style="width:${c.avg ? (c.avg / 4) * 100 : 0}%;background:${scoreColor(c.avg)}"></i></span><b>${c.avg === null ? '–' : num(c.avg, 2)}</b></div>`).join('')}</div>
      ${sc.notObserved ? `<div class="warnbox mt16">${icon('alert', 'sm')}<span>${sc.notObserved} indikator <b>Belum diamati</b> — hasil ditandai belum lengkap dan belum dapat disahkan.</span></div>` : ''}
      ${sc.final !== null && !sc.complete && !sc.notObserved ? `<p class="xs muted mt12">Nilai sementara dihitung dari indikator yang sudah dinilai.</p>` : ''}`;
  }
  const mini = $('#asMini');
  if (mini) mini.innerHTML = `<div class="row" style="gap:12px"><b style="font-family:var(--font-head);font-size:26px">${sc.final === null ? '–' : num(sc.final, 1)}</b><span class="muted small">/100</span>
    <span class="pill ${sc.complete ? 'green' : 'blue'} ellipsis" style="min-width:0;flex:0 1 auto">${esc(pred.label)}</span><span class="grow"></span><span class="small muted">${sc.filled}/${sc.total}</span></div>
    <div class="progress mt8"><i style="width:${sc.total ? (sc.filled / sc.total) * 100 : 0}%"></i></div>`;
  const bar = $('#asBarInfo');
  if (bar) bar.textContent = `${sc.filled}/${sc.total} indikator · nilai sementara ${sc.final === null ? '–' : num(sc.final, 1)}`;
  const d = getDraft(id);
  categoriesOf(ver).forEach((c) => {
    const filled = c.items.filter((r) => { const it = d.items[r.indicator_id]; return it && (it.not_observed || it.score); }).length;
    const cc = $('#accC-' + c.no); if (cc) cc.textContent = filled + '/' + c.items.length + ' terisi';
    const n = $('#accN-' + c.no); if (n) { const done = filled === c.items.length; n.classList.toggle('done', done); n.innerHTML = done ? icon('check', 'sm') : c.no; }
  });
}

ACT.completeAssess = async (el) => {
  const id = el.dataset.id;
  const s = sup(id);
  const ver = s.rubric_version && rubricOf(s.rubric_version).length ? s.rubric_version : activeRubricVersion();
  const sc = computeScore(rubricOf(ver), draftItems(id));
  if (!sc.filled) { toast('warning', 'Belum ada indikator yang dinilai'); return; }
  if (!sc.complete) {
    const ok = await confirmDialog({ title: 'Penilaian belum lengkap', icon: 'alert', iconClass: '', html: `Masih ada <b>${sc.total - sc.filled}</b> indikator yang belum dinilai atau berstatus <b>Belum diamati</b>. Hasil akan ditandai <b>belum lengkap</b> dan tidak dapat disahkan sampai dibuka kembali dan dilengkapi.<br><br>Tetap tandai selesai?`, okText: 'Tetap tandai selesai' });
    if (!ok) return;
  }
  clearTimeout(syncTimers[id]);
  btnBusy(el, true, 'Menghitung nilai…');
  call('assessments.complete', { supervision_id: id, items: draftItems(id) }).then((r) => {
    upsertLocal('supervisions', r.supervision);
    upsertManyLocal('assessments', r.assessments);
    delete S.drafts[id]; LS.del('sg_draft_' + id);
    persist();
    S.editing = false;
    toast('success', 'Observasi selesai', `Nilai akhir ${num(r.score.final, 2)} — lanjutkan dengan rekomendasi AI.`);
    navigate('review', { id });
  }).catch((e) => { btnBusy(el, false); toast('error', 'Gagal menandai selesai', e.message); });
};

// ═════════════════════════════════════════════════════════════════════════
// BAGIAN 16 — REKOMENDASI AI: daftar & peninjauan
// ═════════════════════════════════════════════════════════════════════════
VIEWS.rekomendasi = {
  title: 'Tinjau Rekomendasi AI', nav: 'Rekomendasi AI', icon: 'sparkles', roles: SUPR,
  render: () => {
    const list = sessionsActive().filter((s) => s.status === 'observasi_selesai' || s.status === 'menunggu_tinjauan').sort((a, b) => natCmp(a.tanggal, b.tanggal));
    return `<div class="page-head"><div><div class="eyebrow ai">${icon('sparkles', 'xs')} Draf AI — wajib ditinjau</div><h1>Tinjau Rekomendasi AI</h1>
      <p class="sub">AI menyusun kekuatan, kebutuhan pengembangan, dan saran tindak lanjut dari bukti observasi. AI tidak pernah mengubah nilai.</p></div></div>
      ${list.length ? `<div class="grid g3">${list.map((s) => {
        const recs = recsOf(s.supervision_id);
        const draft = recs.filter((r) => r.status === 'draf').length;
        return `<div class="card hover" data-act="nav" data-route="review" data-id="${s.supervision_id}" role="button" tabindex="0"><div class="row" style="gap:12px">${avatar(teacher(s.teacher_id).nama, s.teacher_id)}<div class="grow"><b class="ellipsis" style="display:block">${esc(teacher(s.teacher_id).nama)}</b><small class="muted">${esc(s.mapel)} · ${esc(s.kelas)}</small></div></div>
          <div class="row between mt16"><div><span class="xs muted">Nilai akhir</span><div style="font-family:var(--font-head);font-weight:700;font-size:24px">${num(s.final_score, 1)}</div></div>
          ${recs.length ? `<span class="pill violet">${draft} draf · ${recs.length - draft} ditinjau</span>` : `<span class="pill blue">Belum diminta</span>`}</div>
          ${!s.is_complete ? `<div class="warnbox mt12 small">${icon('alert', 'xs')}<span>Penilaian belum lengkap</span></div>` : ''}</div>`;
      }).join('')}</div>` : `<div class="card">${emptyState('Tidak ada antrean rekomendasi', 'Rekomendasi muncul setelah penilaian observasi ditandai selesai.')}</div>`}`;
  }
};

VIEWS.review = {
  title: 'Tinjau Rekomendasi', icon: 'sparkles', roles: SUPR, parent: 'rekomendasi', hidden: true,
  crumb: () => { const s = sup(S.params.id); return s ? teacher(s.teacher_id).nama : 'Tinjau'; },
  render: (p) => {
    const s = sup(p.id);
    if (!s) return emptyState('Sesi tidak ditemukan', '');
    if (!S.loaded.has(s.supervision_id) && !ensureDetail(s.supervision_id)) return skeletonRows(6, 80);
    const t = teacher(s.teacher_id);
    const ver = s.rubric_version || activeRubricVersion();
    const rows = rubricOf(ver);
    const items = asmOf(s.supervision_id);
    const amap = {}; items.forEach((a) => { amap[a.indicator_id] = a; });
    const sc = computeScore(rows, items);
    const recs = recsOf(s.supervision_id);
    const loading = S.ui['ai_loading_' + s.supervision_id];
    const locked = isFinal(s);
    const reviewed = recs.filter((r) => r.status !== 'draf').length;
    const approved = recs.filter((r) => r.status === 'disetujui' || r.status === 'direvisi').length;
    const head = `<div class="page-head"><div><div class="eyebrow ai">${icon('sparkles', 'xs')} Draf AI — wajib ditinjau & disetujui penilai</div><h1>Tinjau Rekomendasi</h1>
      <p class="sub">${esc(s.mapel)} ${esc(s.kelas)} · Guru: <b>${esc(t.nama)}</b> · ${fmtDateLong(s.tanggal)}</p></div>
      <div class="head-actions">${recs.length && !locked ? `<button class="btn ai" data-act="aiGenerate" data-id="${s.supervision_id}">${icon('refresh', 'sm')} Minta Ulang</button>` : ''}
      ${!locked ? `<button class="btn ghost" data-act="reopenSession" data-id="${s.supervision_id}">${icon('undo', 'sm')} Buka Kembali Penilaian</button>` : ''}</div></div>`;
    const left = `<div class="card"><div class="card-head"><div><h3>Hasil Observasi</h3><p class="sub">Skor terpadu · rubrik v${esc(ver)}</p></div><span class="pill ${sc.complete ? 'green' : 'amber'}">${sc.filled}/${sc.total} indikator</span></div>
      <div class="row" style="gap:16px">${gauge(sc.final)}<div><span class="xs muted">Predikat kinerja</span><b style="display:block;font-size:16px">${esc(predicate(sc.final).code)} · ${esc(predicate(sc.final).label)}</b></div></div>
      <div class="mt16">${sc.categories.map((c) => `<div class="minibar"><span class="ellipsis">${c.no}. ${esc(c.name)}</span><span class="bar"><i style="width:${c.avg ? (c.avg / 4) * 100 : 0}%;background:${scoreColor(c.avg)}"></i></span><b>${c.avg === null ? '–' : num(c.avg, 2)}</b></div>`).join('')}</div>
      ${!sc.complete ? `<div class="warnbox mt16">${icon('alert', 'sm')}<span>Penilaian belum lengkap. Hasil tidak dapat disahkan sebelum dibuka kembali dan dilengkapi.</span></div>` : ''}
      <details class="mt16"><summary class="strong" style="cursor:pointer">Lihat bukti per indikator</summary><div class="table-wrap mt12"><table class="t" style="min-width:0"><tbody>
        ${rows.map((r) => { const a = amap[r.indicator_id] || {}; return `<tr><td style="width:56px"><span class="ind-code">${esc(r.indicator_id)}</span></td><td><div class="small strong">${esc(r.description)}</div><div class="xs muted mt8">${esc(a.evidence || '— tanpa catatan bukti —')}</div></td><td style="width:48px">${scorePill(a.not_observed ? null : a.score)}</td></tr>`; }).join('')}
      </tbody></table></div></details></div>`;
    let right;
    if (loading) {
      right = `<div class="card ai"><div class="aibox mb16"><span class="spinner sm" style="border-color:var(--ai-border);border-top-color:var(--ai)"></span><span>AI sedang menyusun rekomendasi dari bukti observasi & rujukan…</span></div>${[1, 2, 3].map(() => '<div class="sk ai" style="height:96px;border-radius:14px;margin-bottom:12px"></div>').join('')}</div>`;
    } else if (!recs.length) {
      right = `<div class="card ai"><div class="empty"><span style="width:64px;height:64px;border-radius:20px;background:var(--ai-bg);color:var(--ai);display:grid;place-items:center">${icon('sparkles', 'lg')}</span>
        <b>Minta rekomendasi berbantuan AI</b><p class="small" style="max-width:420px">AI menganalisis skor, bukti observasi, dan rujukan Pembelajaran Mendalam. Data nama & NIP guru <b>tidak</b> dikirim ke penyedia AI.</p>
        <div class="row wrap" style="justify-content:center"><button class="btn ai solid" data-act="aiGenerate" data-id="${s.supervision_id}">${icon('sparkles', 'sm')} Minta Rekomendasi AI</button>
        <button class="btn ghost" data-act="addManualRec" data-id="${s.supervision_id}">${icon('edit', 'sm')} Tulis Manual</button></div></div></div>`;
    } else {
      const grp = (type, title, ic, bg, fg) => {
        const xs = recs.filter((r) => r.type === type);
        return `<div class="grp-title"><span class="gi" style="background:var(${bg});color:var(${fg})">${icon(ic, 'sm')}</span><h3 class="grow">${title}</h3><span class="pill">${xs.length} butir</span></div>
          ${xs.length ? xs.map((r) => recCard(r, locked)).join('') : '<p class="small muted">Tidak ada butir.</p>'}`;
      };
      right = `<div class="card ai"><div class="row between wrap mb16"><span class="pill violet">${icon('sparkles', 'xs')} ${esc(engineLabel(recs[0].model_version))}</span><span class="small muted">Dibuat ${fmtTs(recs[0].created_at)}</span></div>
        ${grp('kekuatan', 'Kekuatan Pembelajaran', 'thumb', '--success-bg', '--success')}${grp('kebutuhan', 'Kebutuhan Pengembangan', 'trend', '--warning-bg', '--warning-ink')}${grp('saran', 'Saran Tindak Lanjut', 'flag', '--primary-light', '--primary')}
        ${!locked ? `<button class="btn plain mt16" data-act="addManualRec" data-id="${s.supervision_id}">${icon('plus', 'sm')} Tambah Rekomendasi Manual</button>` : ''}</div>`;
    }
    return head + `<div class="grid g-split" style="align-items:start">${left}${right}</div>
      <div class="actionbar"><button class="btn ghost" data-act="nav" data-route="rekomendasi">${icon('arrowLeft', 'sm')} <span class="hide-sm">Kembali</span></button>
      <div class="info"><b style="color:var(--text)">${reviewed} dari ${recs.length}</b> butir ditinjau · ${approved} disetujui</div>
      <button class="btn" data-act="nav" data-route="hasil" data-id="${s.supervision_id}">Lanjut ke Pengesahan ${icon('arrowRight', 'sm')}</button></div>`;
  }
};
function engineLabel(v) { if (!v) return 'Rekomendasi'; if (v === 'manual') return 'Ditulis penilai'; if (v.indexOf('rule-based') === 0) return 'Mesin aturan sekolah'; return 'AI · ' + v.split(':').pop(); }
function recText(r) { return r.status === 'direvisi' && r.edited_text ? r.edited_text : r.action; }
function recCard(r, locked) {
  const editing = S.ui.editRec === r.recommendation_id;
  const refs = (r.source_refs || []).map((id) => S.ix.refs[id] ? `<span class="ref-chip">${icon('book', 'xs')} ${esc(S.ix.refs[id].judul)}</span>` : '').join('');
  const stPill = { draf: '<span class="pill violet">Draf AI</span>', disetujui: '<span class="pill green">Disetujui</span>', direvisi: '<span class="pill blue">Direvisi</span>', ditolak: '<span class="pill">Ditolak</span>' }[r.status] || '';
  return `<div class="rec ${r.status}" id="rec-${r.recommendation_id}"><div class="row between wrap" style="gap:8px">${r.indicator_id ? `<span class="ind-code">Indikator ${esc(r.indicator_id)}</span>` : '<span></span>'}${stPill}</div>
    <p class="finding">${esc(r.finding)}</p>
    ${editing ? `<textarea class="textarea" id="recEdit">${esc(recText(r) || r.finding)}</textarea><div class="acts"><button class="btn sm ghost" data-act="recEditCancel">Batal</button><button class="btn sm" data-act="recEditSave" data-id="${r.recommendation_id}">${icon('check', 'sm')} Simpan Revisi</button></div>`
      : `${recText(r) ? `<p class="action">${esc(recText(r))}</p>` : ''}${r.status === 'direvisi' && r.edited_text ? `<p class="xs muted mt8">Teks asli AI: ${esc(r.action || r.finding)}</p>` : ''}
      ${r.rationale || refs ? `<details><summary>${icon('chevDown', 'xs')} Alasan & rujukan</summary><p class="mt8">${esc(r.rationale || '')}</p><div>${refs}</div></details>` : ''}
      ${locked ? '' : `<div class="acts">${r.status === 'ditolak' ? `<button class="btn sm ghost" data-act="recSet" data-id="${r.recommendation_id}" data-st="draf">${icon('undo', 'sm')} Pulihkan</button>` : `
        <button class="btn sm ${r.status === 'disetujui' ? 'success' : 'ghost'}" data-act="recSet" data-id="${r.recommendation_id}" data-st="disetujui">${icon('check', 'sm')} ${r.status === 'disetujui' ? 'Disetujui' : 'Setujui'}</button>
        <button class="btn sm ghost" data-act="recEdit" data-id="${r.recommendation_id}">${icon('edit', 'sm')} Sunting</button>
        <button class="btn sm danger" data-act="recSet" data-id="${r.recommendation_id}" data-st="ditolak">${icon('x', 'sm')} Tolak</button>`}</div>`}`}
  </div>`;
}
ACT.aiGenerate = (el) => {
  const id = el.dataset.id;
  S.ui['ai_loading_' + id] = true; softRender();
  call('ai.generate', { supervision_id: id }).then((d) => {
    S.data.recommendations = tbl('recommendations').filter((r) => r.supervision_id !== id || r.status !== 'draf').filter((r) => r.supervision_id !== id || d.recommendations.every((x) => x.recommendation_id !== r.recommendation_id));
    upsertManyLocal('recommendations', d.recommendations);
    upsertLocal('supervisions', d.supervision);
    persist();
    if (d.warning) toast('ai', 'Rekomendasi tersusun', d.warning, 9000); else toast('ai', 'Rekomendasi AI siap ditinjau', 'Setujui, sunting, atau tolak setiap butir.');
  }).catch((e) => toast('error', 'Gagal menyusun rekomendasi', e.message + ' — Anda dapat menulis rekomendasi manual.'))
    .finally(() => { delete S.ui['ai_loading_' + id]; softRender(); });
};
ACT.recSet = (el) => {
  const r = tbl('recommendations').find((x) => x.recommendation_id === el.dataset.id); if (!r) return;
  const prev = { status: r.status };
  const st = el.dataset.st === 'disetujui' && r.status === 'disetujui' ? 'draf' : el.dataset.st;
  optimistic({
    apply: () => upsertLocal('recommendations', { recommendation_id: r.recommendation_id, status: st, reviewed_by: S.me.user_id }),
    revert: () => upsertLocal('recommendations', Object.assign({ recommendation_id: r.recommendation_id }, prev)),
    action: 'ai.review', payload: { supervision_id: r.supervision_id, items: [{ recommendation_id: r.recommendation_id, status: st }] },
    onDone: (d) => upsertManyLocal('recommendations', d.recommendations)
  }).catch(() => {});
  S._keepY = true;
};
ACT.recEdit = (el) => { S.ui.editRec = el.dataset.id; softRender(); const t = $('#recEdit'); if (t) t.focus(); };
ACT.recEditCancel = () => { S.ui.editRec = null; softRender(); };
ACT.recEditSave = (el) => {
  const r = tbl('recommendations').find((x) => x.recommendation_id === el.dataset.id); if (!r) return;
  const text = $('#recEdit').value.trim();
  if (text.length < 5) { $('#recEdit').classList.add('err'); return; }
  const prev = { status: r.status, edited_text: r.edited_text };
  S.ui.editRec = null;
  optimistic({
    apply: () => upsertLocal('recommendations', { recommendation_id: r.recommendation_id, status: 'direvisi', edited_text: text }),
    revert: () => upsertLocal('recommendations', Object.assign({ recommendation_id: r.recommendation_id }, prev)),
    action: 'ai.review', payload: { supervision_id: r.supervision_id, items: [{ recommendation_id: r.recommendation_id, status: 'direvisi', edited_text: text }] },
    okMsg: 'Revisi disimpan'
  }).catch(() => {});
};
ACT.addManualRec = (el) => {
  const s = sup(el.dataset.id);
  const rows = rubricOf(s.rubric_version || activeRubricVersion());
  const m = openModal({
    title: 'Tambah Rekomendasi Manual', icon: 'edit', sub: 'Ditulis langsung oleh penilai — otomatis berstatus disetujui.',
    body: `<div class="form-grid"><div class="field"><label for="mrT">Jenis</label><select id="mrT" class="select"><option value="kekuatan">Kekuatan</option><option value="kebutuhan">Kebutuhan pengembangan</option><option value="saran" selected>Saran tindak lanjut</option></select></div>
      <div class="field"><label for="mrI">Indikator terkait</label><select id="mrI" class="select"><option value="">— Umum —</option>${rows.map((r) => `<option value="${esc(r.indicator_id)}">${esc(r.indicator_id)} · ${esc(r.description.slice(0, 70))}</option>`).join('')}</select></div>
      <div class="field"><label for="mrF">Temuan / judul <span class="req">*</span></label><textarea id="mrF" class="textarea" style="min-height:72px"></textarea></div>
      <div class="field"><label for="mrA">Tindakan yang disarankan</label><textarea id="mrA" class="textarea" style="min-height:72px"></textarea></div></div>`,
    footer: `<button class="btn ghost" data-close>Batal</button><button class="btn" id="mrSave">Simpan</button>`
  });
  $('#mrSave', m.el).onclick = (e) => {
    const f = $('#mrF', m.el).value.trim();
    if (f.length < 5) return $('#mrF', m.el).classList.add('err');
    btnBusy(e.currentTarget, true);
    call('ai.addManual', { supervision_id: s.supervision_id, type: $('#mrT', m.el).value, indicator_id: $('#mrI', m.el).value, finding: f, action: $('#mrA', m.el).value.trim() })
      .then((d) => { upsertLocal('recommendations', d.recommendation); upsertLocal('supervisions', d.supervision); persist(); m.close(); toast('success', 'Rekomendasi ditambahkan'); softRender(); })
      .catch((er) => { btnBusy(e.currentTarget, false); toast('error', 'Gagal', er.message); });
  };
};
ACT.reopenSession = async (el) => {
  const s = sup(el.dataset.id);
  const reason = await confirmDialog({ title: 'Buka kembali penilaian?', icon: 'undo', message: 'Status kembali menjadi Draft sehingga skor dapat diubah. Tindakan ini tercatat di log audit.', input: 'Alasan membuka kembali', minLength: 5, okText: 'Buka Kembali' });
  if (!reason) return;
  call('supervisions.reopen', { supervision_id: s.supervision_id, reason }).then((d) => { upsertLocal('supervisions', d.supervision); persist(); toast('success', 'Penilaian dibuka kembali'); navigate('assess', { id: s.supervision_id }); })
    .catch((e) => toast('error', 'Gagal membuka kembali', e.message));
};

// ═════════════════════════════════════════════════════════════════════════
// BAGIAN 17 — DETAIL HASIL & PENGESAHAN (semua peran sesuai hak)
// ═════════════════════════════════════════════════════════════════════════
VIEWS.hasil = {
  title: 'Detail Hasil Supervisi', icon: 'file', roles: ['ADMIN', 'KEPSEK', 'PLH'], hidden: true,
  parent: () => isAdmin() ? 'laporan' : (sup(S.params.id) && isFinal(sup(S.params.id)) ? 'laporan' : 'rekomendasi'),
  crumb: () => { const s = sup(S.params.id); return s ? teacher(s.teacher_id).nama : 'Detail'; },
  render: (p) => {
    const s = sup(p.id);
    if (!s) return `<div class="card">${emptyState('Hasil tidak ditemukan', 'Data mungkin belum dimuat.')}</div>`;
    if (!S.loaded.has(s.supervision_id) && !ensureDetail(s.supervision_id)) return skeletonRows(6, 90);
    return resultDetail(s, { sup: isSup(), admin: isAdmin() });
  }
};

function resultDetail(s, mode) {
  const t = teacher(s.teacher_id);
  const ver = s.rubric_version || activeRubricVersion();
  const rows = rubricOf(ver);
  const items = asmOf(s.supervision_id);
  const amap = {}; items.forEach((a) => { amap[a.indicator_id] = a; });
  const sc = computeScore(rows, items);
  const pred = predicate(sc.final);
  const recs = recsOf(s.supervision_id);
  const approvedRecs = recs.filter((r) => r.status === 'disetujui' || r.status === 'direvisi');
  const fus = fusOf(s.supervision_id);
  const canApprove = mode.sup && (s.status === 'observasi_selesai' || s.status === 'menunggu_tinjauan');
  const approveBlock = !s.is_complete ? 'Masih ada indikator belum dinilai/belum diamati.' : !approvedRecs.length ? 'Setujui minimal satu rekomendasi terlebih dahulu.' : '';
  const tabKey = 'tab_hasil_' + (mode.guru ? 'g' : 's');
  const tab = S.ui[tabKey] || 'ringkasan';
  const tabs = [['ringkasan', 'Ringkasan', 'dashboard'], ['skor', 'Skor per Indikator', 'list'], ['rekomendasi', 'Rekomendasi', 'sparkles'], ['refleksi', 'Refleksi Guru', 'message'], ['tl', 'Tindak Lanjut', 'target'], ['riwayat', 'Riwayat', 'history']];
  const strengths = approvedRecs.filter((r) => r.type === 'kekuatan');
  const growth = approvedRecs.filter((r) => r.type !== 'kekuatan');
  let body = '';
  if (tab === 'ringkasan') {
    body = `<div class="grid g2"><div class="card"><div class="card-head"><div><h3>${icon('target', 'sm')} Capaian 7 Dimensi Pembelajaran Mendalam</h3><p class="sub">Rata-rata skor per dimensi (1–4)</p></div></div>
        ${radarChart(sc.categories.map((c) => ({ label: SHORT_CAT[c.no] || String(c.no), full: c.name, value: c.avg })))}</div>
      <div class="card"><div class="card-head"><h3>Skor per Dimensi</h3></div>${sc.categories.map((c) => `<div class="minibar"><span class="ellipsis">${c.no}. ${esc(c.name)}</span><span class="bar"><i style="width:${c.avg ? (c.avg / 4) * 100 : 0}%;background:${scoreColor(c.avg)}"></i></span><b>${c.avg === null ? '–' : Math.round((c.avg / 4) * 100) + '%'}</b></div>`).join('')}</div></div>
      <div class="grid g2 mt24"><div class="card"><div class="card-head"><h3>${icon('thumb', 'sm')} Kekuatan Praktik</h3>${strengths.length ? '<span class="pill green">Disetujui</span>' : ''}</div>
        ${strengths.length ? strengths.map((r) => `<div class="li accent-l mb8" style="--c:var(--success);display:block"><b>${esc(r.finding)}</b>${recText(r) ? `<p class="small muted mt8">${esc(recText(r))}</p>` : ''}</div>`).join('') : '<p class="small muted">Belum ada kekuatan yang disetujui.</p>'}</div>
      <div class="card"><div class="card-head"><h3>${icon('flag', 'sm')} Rekomendasi Pengembangan</h3><span class="pill">${growth.length} butir</span></div>
        ${growth.length ? growth.map((r) => `<div class="li accent-l mb8" style="--c:${r.type === 'kebutuhan' ? 'var(--warning)' : 'var(--primary)'};display:block"><span class="xs muted">${r.type === 'kebutuhan' ? 'Kebutuhan pengembangan' : 'Saran tindak lanjut'}</span><b style="display:block">${esc(r.finding)}</b>${recText(r) ? `<p class="small muted mt8">${esc(recText(r))}</p>` : ''}</div>`).join('') : '<p class="small muted">Belum ada rekomendasi yang disetujui.</p>'}</div></div>`;
  } else if (tab === 'skor') {
    body = `<div class="card pad-0"><div class="table-wrap"><table class="t"><thead><tr><th>Kode</th><th>Indikator</th><th>Skor</th><th>Bukti observasi</th><th>Catatan</th></tr></thead><tbody>
      ${categoriesOf(ver).map((c) => `<tr style="background:var(--surface-2)"><td colspan="5"><b>${c.no}. ${esc(c.name)}</b> <span class="pill">${c.weight}%</span> <span class="small muted">rata-rata ${num((sc.categories.find((x) => x.no === c.no) || {}).avg, 2)}</span></td></tr>
        ${c.items.map((r) => { const a = amap[r.indicator_id] || {}; return `<tr><td><span class="ind-code">${esc(r.indicator_id)}</span></td><td style="min-width:240px">${esc(r.description)}</td><td>${scorePill(a.not_observed ? null : a.score)}</td><td class="small" style="min-width:220px">${esc(a.evidence || '–')}</td><td class="small muted" style="min-width:180px">${esc(a.notes || '–')}</td></tr>`; }).join('')}`).join('')}
      </tbody></table></div></div>`;
  } else if (tab === 'rekomendasi') {
    body = `<div class="card">${(mode.guru ? approvedRecs : recs).length ? (mode.guru ? approvedRecs : recs).map((r) => recCard(r, true)).join('') : emptyState('Belum ada rekomendasi', '')}</div>`;
  } else if (tab === 'refleksi') {
    body = `<div class="card"><div class="card-head"><div><h3>${icon('message', 'sm')} Refleksi Mandiri Guru</h3><p class="sub">${s.reflection_at ? 'Ditulis ' + fmtTs(s.reflection_at) : 'Belum diisi'}</p></div></div>
      ${mode.guru && s.status !== 'selesai' ? `<textarea class="textarea" id="rfText" style="min-height:160px" placeholder="Apa yang sudah berjalan baik? Apa yang akan Anda perbaiki pada pertemuan berikutnya?">${esc(s.teacher_reflection || '')}</textarea><div class="row between mt12"><span class="xs muted" id="rfCount">${(s.teacher_reflection || '').length}/4000</span><button class="btn" data-act="saveReflection" data-id="${s.supervision_id}">${icon('save', 'sm')} Simpan Refleksi</button></div>`
        : s.teacher_reflection ? `<div class="quote">“${esc(s.teacher_reflection)}”</div>` : '<p class="muted small">Guru belum menuliskan refleksi.</p>'}</div>`;
  } else if (tab === 'tl') {
    body = followupTable(s, fus, mode);
  } else if (tab === 'riwayat') {
    const ev = [];
    if (s.created_at) ev.push({ t: 'Jadwal dibuat', d: s.created_at, c: 'var(--primary)', by: personName(s.created_by) });
    items.length && ev.push({ t: 'Penilaian diisi', d: items.map((a) => a.updated_at).sort().slice(-1)[0], c: 'var(--text-faint)', by: personName(s.supervisor_id) });
    recs.length && ev.push({ t: 'Rekomendasi disusun', d: recs[0].created_at, c: 'var(--ai)', by: engineLabel(recs[0].model_version) });
    if (s.approved_at) ev.push({ t: 'Hasil disahkan', d: s.approved_at, c: 'var(--success)', by: personName(s.approved_by) });
    if (s.reflection_at) ev.push({ t: 'Refleksi guru ditulis', d: s.reflection_at, c: 'var(--accent)', by: t.nama });
    fus.forEach((f) => ev.push({ t: 'Tindak lanjut: ' + f.action.slice(0, 60), d: f.updated_at || f.created_at, c: f.status === 'diverifikasi' ? 'var(--success)' : 'var(--warning)', by: FU_LABEL[f.status] || f.status }));
    ev.sort((a, b) => natCmp(a.d, b.d));
    body = `<div class="card"><div class="timeline">${ev.map((e) => `<div class="tl" style="--c:${e.c}"><b>${esc(e.t)}</b><small>${fmtTs(e.d)} · ${esc(e.by)}</small></div>`).join('') || '<p class="muted">Belum ada riwayat.</p>'}</div>
      ${mode.sup || mode.admin ? `<p class="xs muted mt12">Riwayat lengkap tiap perubahan tercatat di Log Audit.</p>` : ''}</div>`;
  }
  return `<div class="card" style="margin:8px 0 20px"><div class="grid" style="grid-template-columns:1fr;gap:20px">
    <div class="row wrap" style="gap:20px;align-items:center">
      ${avatar(t.nama, s.teacher_id, 'lg')}
      <div class="grow" style="min-width:220px"><div class="row wrap" style="gap:8px"><h2>${esc(t.nama)}</h2>${statusPill(s.status)}${!s.is_complete ? '<span class="pill amber">Belum lengkap</span>' : ''}</div>
        <div class="row wrap small muted mt8" style="gap:14px"><span class="row" style="gap:6px">${icon('idcard', 'sm')} NIP ${esc(t.nip || '–')}</span><span class="row" style="gap:6px">${icon('cap', 'sm')} ${esc(s.mapel)} — ${esc(s.kelas)}</span><span class="row" style="gap:6px">${icon('calendar', 'sm')} ${fmtDate(s.tanggal)}</span><span class="row" style="gap:6px">${icon('user', 'sm')} ${esc(personName(s.supervisor_id))}</span></div></div>
      <div class="card tint row" style="gap:14px;padding:14px 18px">${gauge(sc.final, { sm: true, label: pred.code })}<div><b style="font-family:var(--font-head);font-size:22px">${num(sc.final, 2)}</b><span class="muted small"> / 100</span><div class="small strong" style="color:${pctColor(sc.final)}">${esc(pred.code)} · ${esc(pred.label)}</div><div class="xs muted">${sc.filled} dari ${sc.total} indikator</div></div></div>
      <div class="stack" style="gap:8px;min-width:200px">
        ${canApprove ? `<button class="btn success" data-act="approveSession" data-id="${s.supervision_id}" ${approveBlock ? `disabled title="${esc(approveBlock)}"` : ''}>${icon('shield', 'sm')} Sahkan Hasil Supervisi</button>${approveBlock ? `<span class="xs muted">${esc(approveBlock)}</span>` : ''}` : ''}
        ${canApprove ? `<button class="btn ai" data-act="nav" data-route="review" data-id="${s.supervision_id}">${icon('sparkles', 'sm')} Tinjau Rekomendasi</button>` : ''}
        ${isFinal(s) ? `<button class="btn ghost" data-act="openReport" data-id="${s.supervision_id}">${icon('printer', 'sm')} Cetak PDF</button>` : ''}
        ${mode.sup && (s.status === 'disahkan' || canApprove) && !fus.length ? `<button class="btn plain" data-act="reopenSession" data-id="${s.supervision_id}">${icon('undo', 'sm')} Buka Kembali</button>` : ''}
      </div></div></div></div>
    <div class="tabs mb16" role="tablist">${tabs.map(([k, l, ic]) => `<button class="tab ${tab === k ? 'on' : ''}" role="tab" aria-selected="${tab === k}" data-act="tab" data-key="${tabKey}" data-tab="${k}">${icon(ic, 'sm')} ${l}${k === 'rekomendasi' ? ` <span class="badge ai">${(mode.guru ? approvedRecs : recs).length}</span>` : ''}${k === 'tl' && fus.length ? ` <span class="badge">${fus.length}</span>` : ''}</button>`).join('')}</div>
    ${body}`;
}

function followupTable(s, fus, mode) {
  const canEdit = mode.guru && s.status !== 'selesai';
  return `<div class="card pad-0"><div style="padding:16px 20px" class="row between wrap"><div><h3>Rencana Tindak Lanjut</h3><p class="small muted">${fus.length} rencana · ${fus.filter((f) => f.status === 'diverifikasi').length} diverifikasi</p></div>
    ${canEdit ? `<button class="btn" data-act="fuModal" data-sid="${s.supervision_id}">${icon('plus', 'sm')} Tambah Rencana</button>` : ''}</div>
    ${fus.length ? `<div class="table-wrap"><table class="t cards"><thead><tr><th>Rencana aksi</th><th>Target</th><th>Progres</th><th>Status</th><th>Catatan kepala sekolah</th><th></th></tr></thead><tbody>
      ${fus.map((f) => `<tr class="${fuOverdue(f) ? 'row-warn' : ''}"><td class="lead" style="min-width:220px"><b style="display:block;font-weight:600">${esc(f.action)}</b>${f.progress_note ? `<small class="muted">${esc(f.progress_note)}</small>` : ''}</td>
        <td data-l="Target">${fmtDate(f.target_date)}${fuOverdue(f) ? '<br><span class="pill st-terlambat">Terlambat</span>' : ''}</td>
        <td data-l="Progres" style="min-width:120px"><div class="progress"><i style="width:${f.progress || 0}%;background:${f.progress >= 100 ? 'var(--success)' : 'var(--primary)'}"></i></div><span class="xs muted">${f.progress || 0}%</span></td>
        <td data-l="Status"><span class="pill ${f.status === 'diverifikasi' ? 'green' : f.status === 'selesai' ? 'blue' : f.status === 'berjalan' ? 'amber' : ''}">${esc(FU_LABEL[f.status] || f.status)}</span></td>
        <td data-l="Catatan" class="small" style="min-width:200px">${mode.sup && f.status !== 'diverifikasi' ? `<textarea class="textarea" style="min-height:60px" id="rv-${f.followup_id}" placeholder="Catatan tinjauan…">${esc(f.review_notes || '')}</textarea>` : (f.review_notes ? `<span class="muted">“${esc(f.review_notes)}”</span>` : '<span class="faint">–</span>')}</td>
        <td><div class="acts">${mode.sup && f.status !== 'diverifikasi' ? `<button class="btn sm ghost" data-act="fuReview" data-id="${f.followup_id}">Simpan</button><button class="btn sm success" data-act="fuVerify" data-id="${f.followup_id}">${icon('check', 'sm')} Verifikasi</button>` : ''}
          ${canEdit && f.status !== 'diverifikasi' ? `<button class="icon-btn" data-act="fuModal" data-sid="${s.supervision_id}" data-id="${f.followup_id}" aria-label="Ubah">${icon('edit', 'sm')}</button><button class="icon-btn del" data-act="fuDelete" data-id="${f.followup_id}" aria-label="Hapus">${icon('trash', 'sm')}</button>` : ''}</div></td></tr>`).join('')}
    </tbody></table></div>` : `<div style="padding:0 20px 20px">${emptyState('Belum ada rencana tindak lanjut', mode.guru ? 'Susun minimal satu rencana perbaikan dengan target waktu yang jelas.' : 'Guru belum menyusun rencana tindak lanjut.', canEdit ? `<button class="btn" data-act="fuModal" data-sid="${s.supervision_id}">${icon('plus', 'sm')} Tambah Rencana</button>` : '')}</div>`}</div>`;
}

ACT.approveSession = async (el) => {
  const s = sup(el.dataset.id);
  const drafts = recsOf(s.supervision_id).filter((r) => r.status === 'draf').length;
  const ok = await confirmDialog({ title: 'Sahkan hasil supervisi?', icon: 'shield', iconClass: 'green', html: `Nilai akan <b>dikunci</b> dan hasil dapat dilihat oleh ${esc(teacher(s.teacher_id).nama)}.${drafts ? `<br><br>${drafts} butir rekomendasi yang masih <b>draf</b> akan otomatis ditolak.` : ''}`, okText: 'Ya, Sahkan' });
  if (!ok) return;
  btnBusy(el, true, 'Mengesahkan…');
  call('supervisions.approve', { supervision_id: s.supervision_id }).then((d) => {
    upsertLocal('supervisions', d.supervision); upsertManyLocal('recommendations', d.recommendations); persist();
    toast('success', 'Hasil disahkan', 'Laporan PDF kini dapat dicetak.');
    softRender();
  }).catch((e) => { btnBusy(el, false); toast('error', 'Belum dapat disahkan', e.message); });
};
ACT.fuReview = (el) => fuReview(el.dataset.id, false, el);
ACT.fuVerify = (el) => fuReview(el.dataset.id, true, el);
function fuReview(id, verify, el) {
  const f = tbl('followups').find((x) => x.followup_id === id);
  const note = ($('#rv-' + id) || {}).value || '';
  const prev = Object.assign({}, f);
  optimistic({
    apply: () => upsertLocal('followups', { followup_id: id, review_notes: note, status: verify ? 'diverifikasi' : f.status }),
    revert: () => upsertLocal('followups', prev),
    action: 'followups.review', payload: { followup_id: id, review_notes: note, verify },
    okMsg: verify ? 'Tindak lanjut diverifikasi' : 'Catatan disimpan',
    onDone: (d) => { upsertLocal('followups', d.followup); upsertLocal('supervisions', d.supervision); }
  }).catch(() => {});
  S._keepY = true;
}

// ── Laporan PDF (pratinjau modal + cetak + unduh) ───────────────────────
const reportCache = {};
ACT.openReport = (el) => openReport(el.dataset.id);
function openReport(id) {
  const s = sup(id);
  const key = id + '|' + (s.updated_at || '') + '|' + (s.reflection_at || '') + '|' + fusOf(id).map((f) => f.updated_at).join(',');
  const m = openModal({
    title: 'Pratinjau Laporan A4', icon: 'file', size: 'xl', sub: teacher(s.teacher_id).nama + ' · ' + fmtDate(s.tanggal),
    body: `<div id="rpBody"><div class="sk" style="height:60vh;border-radius:12px"></div></div>`,
    footer: `<button class="btn ghost" data-close>Tutup</button><button class="btn ghost" id="rpPrint" disabled>${icon('printer', 'sm')} Cetak</button><button class="btn" id="rpPdf">${icon('download', 'sm')} Unduh PDF</button>`
  });
  const show = (html) => {
    const b = $('#rpBody', m.el); if (!b) return;
    b.innerHTML = '<iframe class="report-frame" id="rpFrame" title="Pratinjau laporan"></iframe>';
    $('#rpFrame', m.el).srcdoc = html;
    $('#rpPrint', m.el).disabled = false;
  };
  if (reportCache[key]) show(reportCache[key]);
  else call('reports.html', { supervision_id: id }).then((d) => { reportCache[key] = d.html; show(d.html); }).catch((e) => { const b = $('#rpBody', m.el); if (b) b.innerHTML = `<div class="dangerbox">${icon('alert', 'sm')}<span>${esc(e.message)}</span></div>`; });
  $('#rpPrint', m.el).onclick = () => { const f = $('#rpFrame', m.el); try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) { toast('warning', 'Cetak langsung tidak tersedia', 'Gunakan Unduh PDF lalu cetak dari berkas.'); } };
  $('#rpPdf', m.el).onclick = (e) => {
    const btn = e.currentTarget;
    btnBusy(btn, true, 'Membuat PDF…');
    call('reports.pdf', { supervision_id: id }).then((d) => {
      btnBusy(btn, false);
      download(d.file_name, 'application/pdf', b64ToBlob(d.base64, 'application/pdf'));
      toast('success', 'PDF diunduh', d.url ? 'Salinan juga disimpan di folder Drive "Laporan Supervisi".' : '');
      if (d.url) { const f = $('.modal-f', m.el); if (f && !$('#rpDrive', m.el)) f.insertAdjacentHTML('afterbegin', `<a class="btn plain" id="rpDrive" href="${esc(d.url)}" target="_blank" rel="noopener">${icon('external', 'sm')} Buka di Drive</a>`); }
    }).catch((er) => { btnBusy(btn, false); toast('error', 'Gagal membuat PDF', er.message); });
  };
}

// ═════════════════════════════════════════════════════════════════════════
// BAGIAN 18 — LAPORAN & HASIL (tabel cari + filter + ekspor CSV)
// ═════════════════════════════════════════════════════════════════════════
VIEWS.laporan = {
  title: 'Laporan & Hasil', nav: 'Laporan & Dokumen', icon: 'file', roles: ['ADMIN', 'KEPSEK', 'PLH'],
  render: () => {
    const list = reportRows();
    const pg = paginate(list, 'lap', 12);
    const mapels = Array.from(new Set(tbl('supervisions').map((s) => s.mapel).filter(Boolean))).sort(natCmp);
    const f = S.ui;
    return `<div class="page-head"><div><h1>Laporan Hasil Supervisi</h1><p class="sub">Cari dan saring hasil per guru, mata pelajaran, semester, atau status. Laporan PDF tersedia untuk hasil yang sudah disahkan.</p></div>
      <div class="head-actions"><button class="btn ghost" data-act="exportCsv">${icon('download', 'sm')} Unduh Rekap (CSV)</button></div></div>
      <div class="card pad-0"><div style="padding:16px" class="toolbar">
        <div class="input-icon">${icon('search', 'sm')}<input id="lapQ" class="input" placeholder="Cari nama guru, NIP, topik…" value="${esc(f.lap_q || '')}" data-input="uiFilter" data-key="lap_q"></div>
        <select class="select" data-change="uiSelect" data-key="lap_per" aria-label="Semester"><option value="">Semua semester</option>${sortedPeriods().reverse().map((p) => `<option value="${p.period_id}" ${f.lap_per === p.period_id ? 'selected' : ''}>${esc(periodLabel(p))}</option>`).join('')}</select>
        <select class="select" data-change="uiSelect" data-key="lap_map" aria-label="Mapel"><option value="">Semua mapel</option>${mapels.map((m) => `<option ${f.lap_map === m ? 'selected' : ''}>${esc(m)}</option>`).join('')}</select>
        <select class="select" data-change="uiSelect" data-key="lap_st" aria-label="Status"><option value="">Semua status</option><option value="final" ${f.lap_st === 'final' ? 'selected' : ''}>Sudah disahkan</option>${Object.keys(STATUS_LABEL).filter((k) => ['terlambat', 'dalam_proses'].indexOf(k) < 0).map((k) => `<option value="${k}" ${f.lap_st === k ? 'selected' : ''}>${STATUS_LABEL[k]}</option>`).join('')}</select>
        ${f.lap_q || f.lap_per || f.lap_map || f.lap_st ? `<button class="btn plain sm" data-act="resetLap">${icon('x', 'sm')} Reset</button>` : ''}</div>
      ${list.length ? `<div class="table-wrap"><table class="t cards"><thead><tr><th>Guru</th><th>Mapel · Kelas</th><th>Tanggal</th><th>Semester</th><th>Nilai</th><th>Predikat</th><th>Status</th><th></th></tr></thead><tbody>
        ${pg.slice.map((s) => { const t = teacher(s.teacher_id); const pr = predicate(s.final_score); return `<tr class="click" data-act="openSessionRow" data-id="${s.supervision_id}" tabindex="0">
          <td class="lead"><div class="who">${avatar(t.nama, s.teacher_id)}<div><b>${esc(t.nama)}</b><small>NIP ${esc(t.nip || '–')}</small></div></div></td>
          <td data-l="Mapel">${esc(s.mapel)} · ${esc(s.kelas)}</td><td data-l="Tanggal">${fmtDate(s.tanggal)}</td><td data-l="Semester">${esc(periodShort(S.ix.periods[s.period_id]))}</td>
          <td data-l="Nilai">${s.final_score === null || s.final_score === undefined ? '–' : `<span class="sc s${scoreTier((s.final_score / 100) * 4)}">${num(s.final_score, 1)}</span>`}</td>
          <td data-l="Predikat">${s.final_score === null || s.final_score === undefined ? '–' : esc(pr.code + ' · ' + pr.label)}</td><td data-l="Status">${statusPill(s.status)}</td>
          <td><div class="acts"><button class="icon-btn" data-act="openSessionRow" data-id="${s.supervision_id}" aria-label="Lihat">${icon('eye', 'sm')}</button>${isFinal(s) ? `<button class="icon-btn" data-act="openReport" data-id="${s.supervision_id}" aria-label="Cetak PDF">${icon('printer', 'sm')}</button>` : ''}</div></td></tr>`; }).join('')}
      </tbody></table></div>${pg.html}` : emptyState('Tidak ada hasil yang cocok', 'Ubah kata kunci atau filter.')}</div>`;
  }
};
function reportRows() {
  const f = S.ui, q = (f.lap_q || '').toLowerCase();
  return tbl('supervisions').filter((s) => {
    const t = teacher(s.teacher_id);
    if (q && (t.nama + ' ' + t.nip + ' ' + s.topik + ' ' + s.mapel).toLowerCase().indexOf(q) < 0) return false;
    if (f.lap_per && s.period_id !== f.lap_per) return false;
    if (f.lap_map && s.mapel !== f.lap_map) return false;
    if (f.lap_st === 'final' && !isFinal(s)) return false;
    if (f.lap_st && f.lap_st !== 'final' && s.status !== f.lap_st) return false;
    return true;
  }).sort((a, b) => natCmp(b.tanggal, a.tanggal));
}
ACT.resetLap = () => { ['lap_q', 'lap_per', 'lap_map', 'lap_st'].forEach((k) => delete S.ui[k]); softRender(); };
ACT.openSessionRow = (el, e) => { if (e.target.closest('button') && e.target.closest('button') !== el) return; const s = sup(el.dataset.id); if (isAdmin()) navigate('hasil', { id: s.supervision_id }); else openSessionDefault(s); };
ACT.exportCsv = () => {
  const rows = reportRows();
  const head = ['Nama Guru', 'NIP', 'Mapel', 'Kelas', 'Tanggal', 'Semester', 'Topik', 'Nilai Akhir', 'Predikat', 'Status', 'Lengkap'].concat(categoriesOf(activeRubricVersion()).map((c) => 'D' + c.no + ' ' + c.name));
  const lines = [head.map(csvCell).join(';')].concat(rows.map((s) => {
    const t = teacher(s.teacher_id); const pr = predicate(s.final_score);
    const cats = categoriesOf(activeRubricVersion()).map((c) => { const x = (s.category_scores || []).find((y) => y.no === c.no); return x && x.avg !== null ? String(x.avg).replace('.', ',') : ''; });
    return [t.nama, t.nip, s.mapel, s.kelas, s.tanggal, periodLabel(S.ix.periods[s.period_id]), s.topik, s.final_score === null || s.final_score === undefined ? '' : String(s.final_score).replace('.', ','), s.final_score === null ? '' : pr.code + ' ' + pr.label, STATUS_LABEL[s.status] || s.status, s.is_complete ? 'Ya' : 'Tidak'].concat(cats).map(csvCell).join(';');
  }));
  download('Rekap Supervisi ' + today() + '.csv', 'text/csv;charset=utf-8', '﻿' + lines.join('\r\n'));
  toast('success', 'Rekap diunduh', rows.length + ' baris');
};

// ═════════════════════════════════════════════════════════════════════════
// BAGIAN 19 — PROFIL & GANTI PASSWORD
// ═════════════════════════════════════════════════════════════════════════
VIEWS.profil = {
  title: 'Profil Saya', icon: 'user', roles: null, hidden: true,
  render: () => `<div class="page-head"><div><h1>Profil Saya</h1><p class="sub">Informasi akun dan keamanan.</p></div></div>
    <div class="grid g2" style="align-items:start"><div class="card"><div class="row" style="gap:16px">${avatar(S.me.nama, S.me.user_id, 'lg')}<div><h2>${esc(S.me.nama)}</h2><p class="muted">@${esc(S.me.username)} · ${esc(ROLE_LABEL[S.me.role])}</p></div></div>
      <div class="list mt24"><div class="li"><span class="muted">${icon('clock', 'sm')}</span><div class="grow"><b>Login terakhir</b><small>${fmtTs(S.me.last_login)}</small></div></div>
      ${S.me.role === 'PLH' ? `<div class="li"><span class="muted">${icon('calendar', 'sm')}</span><div class="grow"><b>Masa penunjukan PLH</b><small>${fmtDate(S.me.plh_from)} – ${fmtDate(S.me.plh_to)}</small></div></div>` : ''}
      <div class="li"><span class="muted">${icon('shield', 'sm')}</span><div class="grow"><b>Sesi aman</b><small>Token sesi berlaku 8 jam, ditandatangani HMAC-SHA256.</small></div></div></div></div>
    <div class="card"><h3 class="mb16">Ganti Password</h3>${pwFormHtml('pp')}<button class="btn mt16" id="ppBtn" data-act="ppSave">${icon('save', 'sm')} Simpan Password</button></div></div>`
};
ACT.ppSave = (el) => submitPw('pp', el, () => { btnBusy(el, false); navigate('dashboard'); });
