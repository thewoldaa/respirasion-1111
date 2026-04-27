import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import Avatar from '../UI/Avatar';

export default function Settings() {
  const { userData, logout, updateProfile } = useAuth();
  const toast = useToast();
  const [editName,  setEditName]  = useState(false);
  const [newName,   setNewName]   = useState('');
  const [saving,    setSaving]    = useState(false);

  async function saveName() {
    const n = newName.trim();
    if (!n) return toast('Nama tidak boleh kosong', 'error');
    setSaving(true);
    try {
      await updateProfile({
        displayName: n,
        initials:    n.slice(0, 2).toUpperCase(),
      });
      toast('Nama diperbarui!', 'success');
      setEditName(false);
    } finally {
      setSaving(false);
    }
  }

  const initials = userData?.initials || userData?.displayName?.slice(0,2).toUpperCase() || '?';

  return (
    <div className="screen">
      {/* TopBar */}
      <header className="topbar">
        <span className="topbar-title">Pengaturan</span>
        <div style={{ width: 40 }} />
      </header>

      <div className="scroll-area" style={{ padding: '0 var(--edge) var(--sp-xl)' }}>

        {/* ── Profile Card ── */}
        <section style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: var_('sp-sm'), padding: '28px 0 20px',
        }}>
          <Avatar initials={initials} seed={userData?.uid} size={96} />
          <div style={{ fontWeight: 700, fontSize: 20, color: 'var(--on-surface)', marginTop: 4 }}>
            {userData?.displayName || userData?.username}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="chip chip-id">#{userData?.userId}</span>
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'var(--surface-container)',
            padding: '4px 12px', borderRadius: 'var(--r-full)',
            border: '1px solid var(--surface-high)',
            marginTop: 4,
          }}>
            <div className="conn-dot" />
            <span style={{ fontSize: 12, color: 'var(--secondary)', fontWeight: 500 }}>
              Text chat + live call
            </span>
          </div>
        </section>

        {/* ── Profile section ── */}
        <div className="section-label">Profil</div>
        <div className="setting-section" style={{ marginBottom: var_('sp-md') }}>
          {/* Display Name – edit */}
          {editName ? (
            <div style={{ padding: 'var(--sp-md)' }}>
              <label className="field-label" htmlFor="disp-name">Nama Tampil</label>
              <div className="field-input-wrap" style={{ marginBottom: 10 }}>
                <span className="field-input-icon msi msi-sm">edit</span>
                <input
                  id="disp-name"
                  className="field-input"
                  placeholder="Masukkan nama baru"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  autoFocus
                  onKeyDown={(e) => { if (e.key === 'Enter') saveName(); }}
                />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={saveName} disabled={saving}>
                  {saving ? <div className="spinner spinner-white" style={{ width: 18, height: 18, borderWidth: 2 }} /> : 'Simpan'}
                </button>
                <button className="btn btn-outlined" style={{ flex: 1 }} onClick={() => setEditName(false)}>
                  Batal
                </button>
              </div>
            </div>
          ) : (
            <div
              className="setting-row"
              onClick={() => { setNewName(userData?.displayName || ''); setEditName(true); }}
            >
              <span className="setting-row-icon msi msi-sm">edit</span>
              <div className="setting-row-info">
                <div className="setting-row-label">Nama Tampil</div>
                <div className="setting-row-sub">{userData?.displayName || userData?.username}</div>
              </div>
              <span className="setting-chevron msi msi-sm">chevron_right</span>
            </div>
          )}
        </div>

        {/* ── Account section ── */}
        <div className="section-label">Akun</div>
        <div className="setting-section" style={{ marginBottom: 'var(--sp-md)' }}>
          <div className="setting-row" style={{ cursor: 'default' }}>
            <span className="setting-row-icon msi msi-sm">tag</span>
            <div className="setting-row-info">
              <div className="setting-row-label">ID Pengguna</div>
              <div className="setting-row-sub" style={{ fontFamily: 'monospace', color: 'var(--primary)', fontWeight: 700 }}>
                #{userData?.userId}
              </div>
            </div>
          </div>
          <div className="setting-row" style={{ cursor: 'default' }}>
            <span className="setting-row-icon msi msi-sm">alternate_email</span>
            <div className="setting-row-info">
              <div className="setting-row-label">Username</div>
              <div className="setting-row-sub">@{userData?.username}</div>
            </div>
          </div>
        </div>

        {/* ── Preferences section ── */}
        <div className="section-label">Preferensi</div>
        <div className="setting-section" style={{ marginBottom: 'var(--sp-md)' }}>
          <div className="setting-row">
            <span className="setting-row-icon msi msi-sm">call</span>
            <div className="setting-row-info">
              <div className="setting-row-label">Voice Call</div>
              <div className="setting-row-sub">Transmisi audio langsung tanpa rekaman</div>
            </div>
            <span className="setting-chevron msi msi-sm">chevron_right</span>
          </div>
          <div className="setting-row">
            <span className="setting-row-icon msi msi-sm">data_usage</span>
            <div className="setting-row-info">
              <div className="setting-row-label">Data &amp; Penyimpanan</div>
              <div className="setting-row-sub" style={{ color: 'var(--tertiary-container)' }}>
                Mode hemat data untuk teks dan signaling aktif
              </div>
            </div>
            <span className="setting-chevron msi msi-sm">chevron_right</span>
          </div>
          <div className="setting-row">
            <span className="setting-row-icon msi msi-sm">help</span>
            <div className="setting-row-info">
              <div className="setting-row-label">Bantuan</div>
              <div className="setting-row-sub">FAQ, hubungi kami, kebijakan privasi</div>
            </div>
            <span className="setting-chevron msi msi-sm">chevron_right</span>
          </div>
        </div>

        {/* Logout */}
        <button
          className="btn btn-error"
          style={{ width: '100%', marginBottom: 12, gap: 8 }}
          onClick={logout}
        >
          <span className="msi msi-sm">logout</span>
          Keluar
        </button>

        <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--outline)' }}>
          Respirasion v1.1.0 Android-ready
        </p>
      </div>
    </div>
  );
}

// tiny CSS var helper so we can use vars in style props
function var_(key) { return `var(--${key})`; }
