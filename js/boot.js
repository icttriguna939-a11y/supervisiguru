// ═════════════════════════════════════════════════════════════════════════
// BAGIAN 29 — BOOT: tampil instan dari cache perangkat, segarkan di latar
// ═════════════════════════════════════════════════════════════════════════
function boot() {
  hydrateIcons(document);
  syncThemeSwitch();
  const token = LS.get('sg_token', null);
  // Ambil identitas sekolah + panaskan server GAS (paralel, tidak menghalangi tampilan)
  const pub = fetchPublic();
  if (!token) {
    showLogin();
    pub.then((j) => { if (j && $('#auth').classList.contains('on') && !S.token && !($('#lgUser') && $('#lgUser').value)) showLogin(); });
    return;
  }
  S.token = token;
  // Cari cache milik token ini (uid ada di payload token)
  let uidFromToken = null;
  try { uidFromToken = JSON.parse(atob(token.split('.')[0].replace(/-/g, '+').replace(/_/g, '/'))).u; } catch (e) { uidFromToken = null; }
  const cache = uidFromToken ? LS.get('sg_cache_' + uidFromToken, null) : null;
  if (cache && cache.data && cache.data.me) {
    // ⚡ Prinsip 1+2: render langsung dari localStorage (0 RTT), lalu sinkron latar
    S.data = cache.data; S.me = cache.data.me;
    reindex();
    try { Object.keys(localStorage).filter((k) => k.indexOf('sg_draft_') === 0).forEach((k) => { const id = k.slice(9); if (S.ix.sup[id]) getDraft(id); }); } catch (e) { /* abaikan */ }
    enterApp();
    refreshData(true);
    return;
  }
  // Tanpa cache: satu panggilan bootstrap (Prinsip 3+4)
  call('auth.bootstrap', {}).then((d) => {
    S.me = d.user;
    if (!d.bootstrap) { showChangePassword(true); return; }
    applyBootstrap(d.bootstrap, true);
    enterApp();
  }).catch((e) => { if (e.code !== 'AUTH') { clearSession(); showLogin(e.code === 'NETWORK' ? 'Tidak dapat terhubung ke server. Periksa koneksi lalu coba lagi.' : e.message); } });
}

// Sinkronkan draf yang tertunda setiap 20 detik bila ada (mis. setelah offline)
setInterval(() => { Object.keys(S.drafts).forEach((k) => { if (S.drafts[k].dirty && !S.drafts[k].saving) syncDraft(k); }); }, 20000);

// Akses terbatas untuk diagnosis (tanpa mencemari ruang nama global)
window.SG = { S, navigate, tbl, logout, clearSession, refreshData, version: '2.0.0' };
window.__SG_LOADED__ = true;
function safeBoot() { try { boot(); } catch (e) { if (window.__sgFail) window.__sgFail('Gagal memulai aplikasi: ' + e.message); else throw e; } }
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', safeBoot); else safeBoot();
