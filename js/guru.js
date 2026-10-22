// ═════════════════════════════════════════════════════════════════════════
// BAGIAN 20 — GURU: dashboard pribadi, hasil, refleksi, tindak lanjut
// ═════════════════════════════════════════════════════════════════════════
function myFinalSessions() { return tbl('supervisions').filter(isFinal).sort((a, b) => natCmp(b.tanggal, a.tanggal)); }

function renderGuruDashboard() {
  const mine = myFinalSessions();
  const last = mine[0];
  const fus = tbl('followups').filter((f) => f.status !== 'diverifikasi');
  const next = tbl('supervisions').filter((s) => !isFinal(s) && s.tanggal >= today()).sort((a, b) => natCmp(a.tanggal + a.jam, b.tanggal + b.jam))[0];
  const trend = trendSeries(S.me.teacher_id);
  const needFu = mine.filter((s) => s.status === 'disahkan' && !fusOf(s.supervision_id).length);
  const soon = fus.slice().sort((a, b) => natCmp(a.target_date, b.target_date)).slice(0, 5);
  return `<div class="card tint" style="margin:8px 0 24px;padding:24px"><div class="row wrap" style="gap:20px">
      <div class="grow" style="min-width:240px"><div class="eyebrow" style="font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--primary)">${esc(periodLabel(activePeriod()))}</div>
      <h1 class="mt8">${greeting()}, ${esc(S.me.nama.split(',')[0])}</h1><p class="muted mt8">Supervisi adalah sarana bertumbuh bersama. Lihat hasil, tuliskan refleksi, dan susun rencana tindak lanjut Anda.</p></div>
      <svg width="150" height="110" viewBox="0 0 150 110" aria-hidden="true"><ellipse cx="75" cy="100" rx="60" ry="8" fill="var(--primary)" opacity=".12"/><path d="M30 92c-6-30 12-58 44-62 30-4 50 18 48 44-1 14-10 22-24 24-24 3-62 12-68-6z" fill="var(--accent)" opacity=".45"/><rect x="46" y="34" width="56" height="46" rx="8" fill="var(--surface)" stroke="var(--primary)" stroke-width="2.5"/><path d="M56 68l10-10 8 6 14-16" stroke="var(--primary)" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/><circle cx="110" cy="30" r="10" fill="var(--success)"/><path d="m105 30 3.5 3.5L115 27" stroke="#fff" stroke-width="2.2" fill="none" stroke-linecap="round"/></svg></div></div>
    ${needFu.length ? `<div class="infobox mb16">${icon('target', 'sm')}<span class="grow">Hasil supervisi <b>${fmtDate(needFu[0].tanggal)}</b> sudah disahkan. Susun rencana tindak lanjut Anda.</span><button class="btn sm" data-act="nav" data-route="hasil-saya" data-id="${needFu[0].supervision_id}">Buka</button></div>` : ''}
    <div class="grid g3">
      <div class="card"><div class="stat"><span class="ic">${icon('trend')}</span><span class="num" style="color:${last ? pctColor(last.final_score) : 'inherit'}">${last ? num(last.final_score, 1) : '–'}</span><span class="lbl">Nilai Supervisi Terakhir</span><span class="foot">${last ? esc(predicate(last.final_score).label) + ' · ' + fmtDate(last.tanggal) : 'Belum ada hasil disahkan'}</span></div></div>
      <div class="card hover" data-act="nav" data-route="hasil-saya" role="button" tabindex="0"><div class="stat"><span class="ic amber">${icon('target')}</span><span class="num">${fus.length}</span><span class="lbl">Tindak Lanjut Aktif</span><span class="foot">${fus.filter(fuOverdue).length ? `<span style="color:var(--danger)">${fus.filter(fuOverdue).length} melewati target</span>` : 'Sesuai jadwal'}</span></div></div>
      <div class="card hover" data-act="nav" data-route="jadwal" role="button" tabindex="0"><div class="stat"><span class="ic violet">${icon('calendar')}</span><span class="num" style="font-size:22px">${next ? fmtDate(next.tanggal) : '–'}</span><span class="lbl">Jadwal Supervisi Berikutnya</span><span class="foot">${next ? esc((next.jam || '') + ' · ' + next.kelas + ' · ' + relDay(next.tanggal)) : 'Belum dijadwalkan'}</span></div></div>
    </div>
    <div class="grid g2 mt24">
      <div class="card"><div class="card-head"><div><h3>Perkembangan Nilai Saya</h3><p class="sub">Nilai akhir per semester</p></div></div>${lineChart(trend, { empty: 'Grafik muncul setelah ada hasil supervisi yang disahkan.' })}</div>
      <div class="card"><div class="card-head"><div><h3>Nilai per Dimensi — Supervisi Terakhir</h3><p class="sub">${last ? fmtDateLong(last.tanggal) : '–'}</p></div></div>
        ${last ? hbarChart((last.category_scores || []).map((c) => ({ label: c.no + '. ' + c.name, value: c.avg })), { max: 4, threshold: 2, dec: 2 }) : '<div class="chart-empty">Belum ada hasil disahkan.</div>'}</div>
    </div>
    <div class="card mt24"><div class="card-head"><div><h3>Tindak Lanjut Mendekati Target</h3><p class="sub">Perbarui progres agar kepala sekolah dapat memverifikasi</p></div></div>
      ${soon.length ? `<div class="list">${soon.map((f) => `<div class="li click accent-l" style="--c:${fuOverdue(f) ? 'var(--danger)' : 'var(--primary)'}" data-act="nav" data-route="hasil-saya" data-id="${f.supervision_id}" role="button" tabindex="0">
        <div class="grow"><b class="ellipsis">${esc(f.action)}</b><small>Target ${fmtDate(f.target_date)} · ${relDay(f.target_date)} · ${f.progress || 0}%</small></div>${fuOverdue(f) ? '<span class="pill st-terlambat">Terlambat</span>' : `<span class="pill">${esc(FU_LABEL[f.status])}</span>`}</div>`).join('')}</div>`
        : `<p class="small muted">Tidak ada tindak lanjut aktif.</p>`}</div>`;
}

VIEWS['hasil-saya'] = {
  title: 'Hasil & Tindak Lanjut', icon: 'target', roles: ['GURU'],
  render: (p) => {
    const mine = myFinalSessions();
    if (!mine.length) return `<div class="page-head"><div><h1>Hasil & Tindak Lanjut</h1></div></div><div class="card">${emptyState('Belum ada hasil supervisi yang disahkan', 'Hasil akan tampil di sini setelah kepala sekolah mengesahkan penilaian observasi Anda.')}</div>`;
    const sel = sup(p.id) && isFinal(sup(p.id)) ? sup(p.id) : mine[0];
    if (!S.loaded.has(sel.supervision_id) && !ensureDetail(sel.supervision_id)) return skeletonRows(5, 90);
    return `<div class="page-head"><div><h1>Hasil & Tindak Lanjut</h1><p class="sub">Pilih sesi supervisi untuk melihat hasil, menulis refleksi, dan memperbarui rencana tindak lanjut.</p></div></div>
      <div class="row" style="gap:12px;overflow-x:auto;padding-bottom:6px;margin-bottom:16px">${mine.map((s) => `<button class="card hover" style="min-width:210px;text-align:left;padding:14px 16px;${s.supervision_id === sel.supervision_id ? 'border:2px solid var(--primary);background:var(--primary-light)' : ''}" data-act="nav" data-route="hasil-saya" data-id="${s.supervision_id}">
        <span class="xs muted">${esc(periodLabel(S.ix.periods[s.period_id]))}</span><b style="display:block;font-family:var(--font-head);font-size:20px">${num(s.final_score, 1)}</b><span class="small">${fmtDate(s.tanggal)} · ${esc(s.kelas)}</span><div class="mt8">${statusPill(s.status)}</div></button>`).join('')}</div>
      ${resultDetail(sel, { guru: true })}`;
  }
};

ACT.saveReflection = (el) => {
  const id = el.dataset.id;
  const text = $('#rfText').value.trim();
  const s = sup(id); const prev = { teacher_reflection: s.teacher_reflection, reflection_at: s.reflection_at };
  optimistic({
    apply: () => upsertLocal('supervisions', { supervision_id: id, teacher_reflection: text, reflection_at: new Date().toISOString().slice(0, 19) }),
    revert: () => upsertLocal('supervisions', Object.assign({ supervision_id: id }, prev)),
    action: 'reflections.save', payload: { supervision_id: id, text }, okMsg: 'Refleksi disimpan',
    onDone: (d) => upsertLocal('supervisions', d.supervision)
  }).catch(() => {});
};
INPUT.rfCount = () => {};
document.addEventListener('input', (e) => { if (e.target.id === 'rfText') { const c = $('#rfCount'); if (c) c.textContent = e.target.value.length + '/4000'; } });

ACT.fuModal = (el) => {
  const s = sup(el.dataset.sid);
  const f = el.dataset.id ? tbl('followups').find((x) => x.followup_id === el.dataset.id) : null;
  const suggestions = recsOf(s.supervision_id).filter((r) => r.type === 'saran' && (r.status === 'disetujui' || r.status === 'direvisi'));
  const m = openModal({
    title: f ? 'Perbarui Tindak Lanjut' : 'Tambah Rencana Tindak Lanjut', icon: 'target',
    body: `${!f && suggestions.length ? `<div class="field mb16"><label>Ambil dari saran yang disetujui</label><div class="list">${suggestions.map((r, i) => `<button type="button" class="li click" style="text-align:left;border:0;width:100%" data-sug="${i}"><span class="muted">${icon('plus', 'sm')}</span><span class="grow small">${esc(recText(r) || r.finding)}</span></button>`).join('')}</div></div>` : ''}
      <div class="form-grid"><div class="field"><label for="fuA">Rencana aksi <span class="req">*</span></label><textarea id="fuA" class="textarea" placeholder="mis. Menerapkan exit ticket di setiap akhir pertemuan">${esc(f ? f.action : '')}</textarea></div>
      <div class="form-grid two"><div class="field"><label for="fuT">Target tanggal <span class="req">*</span></label><input id="fuT" type="date" class="input" value="${esc(f ? f.target_date : '')}" min="${today()}"></div>
      <div class="field"><label for="fuP">Progres: <b id="fuPv">${f ? f.progress || 0 : 0}%</b></label><input id="fuP" type="range" min="0" max="100" step="10" value="${f ? f.progress || 0 : 0}" style="accent-color:var(--primary);min-height:42px"></div></div>
      <div class="field"><label for="fuN">Catatan progres / bukti pelaksanaan</label><textarea id="fuN" class="textarea" style="min-height:72px">${esc(f ? f.progress_note : '')}</textarea></div></div>`,
    footer: `<button class="btn ghost" data-close>Batal</button><button class="btn" id="fuSave">${icon('save', 'sm')} Simpan</button>`
  });
  $$('[data-sug]', m.el).forEach((b) => b.onclick = () => { const r = suggestions[Number(b.dataset.sug)]; $('#fuA', m.el).value = recText(r) || r.finding; });
  $('#fuP', m.el).oninput = (e) => { $('#fuPv', m.el).textContent = e.target.value + '%'; };
  $('#fuSave', m.el).onclick = () => {
    const payload = { followup_id: f ? f.followup_id : undefined, supervision_id: s.supervision_id, action: $('#fuA', m.el).value.trim(), target_date: $('#fuT', m.el).value, progress: Number($('#fuP', m.el).value), progress_note: $('#fuN', m.el).value.trim() };
    if (payload.action.length < 5) return $('#fuA', m.el).classList.add('err');
    if (!payload.target_date) return $('#fuT', m.el).classList.add('err');
    const tmp = f ? f.followup_id : uid();
    const snapF = snapshot('followups'), snapS = snapshot('supervisions');
    m.close();
    optimistic({
      apply: () => { upsertLocal('followups', Object.assign({ teacher_id: S.me.teacher_id, status: payload.progress >= 100 ? 'selesai' : payload.progress > 0 ? 'berjalan' : 'direncanakan' }, f || {}, payload, { followup_id: tmp, updated_at: new Date().toISOString().slice(0, 19) })); if (s.status === 'disahkan') upsertLocal('supervisions', { supervision_id: s.supervision_id, status: 'tindak_lanjut' }); },
      revert: () => { restore('followups', snapF); restore('supervisions', snapS); },
      action: 'followups.save', payload, okMsg: f ? 'Tindak lanjut diperbarui' : 'Rencana tindak lanjut ditambahkan',
      onDone: (d) => { if (!f) removeLocal('followups', tmp); upsertLocal('followups', d.followup); upsertLocal('supervisions', d.supervision); }
    }).catch(() => {});
  };
};
ACT.fuDelete = async (el) => {
  const ok = await confirmDialog({ title: 'Hapus rencana ini?', message: 'Rencana tindak lanjut akan dihapus.', okText: 'Hapus', danger: true });
  if (!ok) return;
  const snap = snapshot('followups');
  optimistic({ apply: () => removeLocal('followups', el.dataset.id), revert: () => restore('followups', snap), action: 'followups.delete', payload: { followup_id: el.dataset.id }, okMsg: 'Rencana dihapus' }).catch(() => {});
};
