import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

/* ── small sub-components ─────────────────────────────── */
function PasswordInput({ id, value, onChange, placeholder }) {
  const [show, setShow] = useState(false);
  return (
    <div className="field-input-wrap">
      <span className="field-input-icon msi msi-sm">lock</span>
      <input
        id={id}
        className="field-input"
        type={show ? 'text' : 'password'}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        style={{ paddingRight: 44 }}
      />
      <button type="button" className="field-input-right" onClick={() => setShow(s => !s)}>
        <span className="msi msi-sm">{show ? 'visibility' : 'visibility_off'}</span>
      </button>
    </div>
  );
}

/* ── Login ─────────────────────────────────────────────── */
function Login({ onSwitch }) {
  const { login }   = useAuth();
  const toast       = useToast();
  const [form, set] = useState({ username: '', password: '' });
  const [busy, setBusy] = useState(false);

  const f = k => e => set(p => ({ ...p, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    if (!form.username.trim() || !form.password) return toast('Isi semua kolom', 'error');
    setBusy(true);
    try {
      await login(form.username.trim(), form.password);
    } catch {
      toast('Username atau password salah', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-screen">
      {/* Branding */}
      <div className="auth-brand">
        <div className="auth-logo-wrap">
          <span className="msi auth-logo-icon">wifi_tethering</span>
        </div>
        <h1 className="auth-app-name">Obrolan</h1>
        <p className="auth-tagline">Masuk untuk melanjutkan ke jaringan komunikasi kamu.</p>
      </div>

      <form className="auth-form" onSubmit={submit}>
        {/* Username */}
        <div className="auth-field">
          <label className="field-label" htmlFor="login-user">Username</label>
          <div className="field-input-wrap">
            <span className="field-input-icon msi msi-sm">person</span>
            <input
              id="login-user"
              className="field-input"
              type="text"
              placeholder="Masukkan username"
              autoCapitalize="none"
              autoCorrect="off"
              value={form.username}
              onChange={f('username')}
            />
          </div>
        </div>

        {/* Password */}
        <div className="auth-field">
          <div className="auth-field-header">
            <label className="field-label" htmlFor="login-pw">Password</label>
          </div>
          <PasswordInput
            id="login-pw"
            placeholder="Masukkan password"
            value={form.password}
            onChange={f('password')}
          />
        </div>

        <button
          type="submit"
          className="btn btn-primary"
          disabled={busy}
          style={{ width: '100%', marginTop: 4 }}
        >
          {busy
            ? <><div className="spinner spinner-white" style={{ width: 18, height: 18, borderWidth: 2 }} /> Masuk...</>
            : 'Masuk'}
        </button>
      </form>

      <p className="auth-switch">
        Belum punya akun?{' '}
        <button className="auth-link" onClick={onSwitch}>Daftar</button>
      </p>
    </div>
  );
}

/* ── Register ──────────────────────────────────────────── */
function Register({ onSwitch }) {
  const { register } = useAuth();
  const toast        = useToast();
  const [form, set]  = useState({ username: '', password: '', confirm: '' });
  const [busy, setBusy] = useState(false);

  const f = k => e => set(p => ({ ...p, [k]: e.target.value }));

  const preview = form.username.slice(0, 2).toUpperCase() || '?';

  async function submit(e) {
    e.preventDefault();
    const { username, password, confirm } = form;
    if (!username.trim() || !password || !confirm) return toast('Isi semua kolom', 'error');
    if (username.trim().length < 3) return toast('Username minimal 3 karakter', 'error');
    if (password.length < 6)        return toast('Password minimal 6 karakter', 'error');
    if (password !== confirm)        return toast('Password tidak cocok', 'error');
    setBusy(true);
    try {
      await register(username.trim(), password);
      toast('Akun berhasil dibuat!', 'success');
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') toast('Username sudah dipakai', 'error');
      else toast(err.message || 'Gagal mendaftar', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-screen">
      {/* Branding */}
      <div className="auth-brand">
        <div className="auth-logo-wrap">
          <span className="msi auth-logo-icon">wifi_tethering</span>
        </div>
        <h1 className="auth-app-name">Obrolan</h1>
        <p className="auth-tagline">Buat akun baru — ID 6-digit otomatis dibuat.</p>
      </div>

      {/* Avatar Preview */}
      {form.username.trim() && (
        <div className="auth-avatar-preview">
          <div
            className="avatar avatar-56"
            style={{ background: '#dde1ff', color: '#003ec7' }}
          >
            {preview}
          </div>
          <span className="auth-avatar-label">Foto profil kamu</span>
        </div>
      )}

      <form className="auth-form" onSubmit={submit}>
        <div className="auth-field">
          <label className="field-label" htmlFor="reg-user">Username</label>
          <div className="field-input-wrap">
            <span className="field-input-icon msi msi-sm">person</span>
            <input
              id="reg-user"
              className="field-input"
              type="text"
              placeholder="Minimal 3 karakter"
              autoCapitalize="none"
              autoCorrect="off"
              value={form.username}
              onChange={f('username')}
            />
          </div>
        </div>

        <div className="auth-field">
          <label className="field-label" htmlFor="reg-pw">Password</label>
          <PasswordInput
            id="reg-pw"
            placeholder="Minimal 6 karakter"
            value={form.password}
            onChange={f('password')}
          />
        </div>

        <div className="auth-field">
          <label className="field-label" htmlFor="reg-cpw">Konfirmasi Password</label>
          <PasswordInput
            id="reg-cpw"
            placeholder="Ulangi password"
            value={form.confirm}
            onChange={f('confirm')}
          />
        </div>

        {/* Info notice */}
        <div className="auth-notice">
          <span className="msi msi-sm" style={{ color: 'var(--primary)', flexShrink: 0 }}>info</span>
          <span>ID unik 6-digit akan dibuat otomatis. Bagikan ID ke teman agar bisa ditambahkan sebagai kontak.</span>
        </div>

        <button
          type="submit"
          className="btn btn-primary"
          disabled={busy}
          style={{ width: '100%' }}
        >
          {busy
            ? <><div className="spinner spinner-white" style={{ width: 18, height: 18, borderWidth: 2 }} /> Mendaftar...</>
            : 'Daftar Sekarang'}
        </button>
      </form>

      <p className="auth-switch">
        Sudah punya akun?{' '}
        <button className="auth-link" onClick={onSwitch}>Masuk</button>
      </p>
    </div>
  );
}

/* ── AuthPage wrapper ──────────────────────────────────── */
export default function AuthPage() {
  const [mode, setMode] = useState('login');
  return (
    <div className="auth-wrapper">
      <div className="auth-bg-glow" />
      {mode === 'login'
        ? <Login    onSwitch={() => setMode('register')} />
        : <Register onSwitch={() => setMode('login')} />}

      <style>{`
        .auth-wrapper {
          flex: 1;
          display: flex;
          align-items: stretch;
          position: relative;
          overflow: hidden;
          background: var(--surface);
        }
        .auth-bg-glow {
          position: absolute;
          top: -60px; left: -60px; right: -60px;
          height: 340px;
          background: radial-gradient(ellipse 80% 60% at 50% 0%,
            rgba(0,62,199,0.08) 0%, transparent 70%);
          pointer-events: none;
        }
        .auth-screen {
          position: relative;
          z-index: 1;
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 20px;
          padding: 36px 20px;
          padding-top: calc(36px + var(--safe-top));
          padding-bottom: calc(24px + var(--safe-bottom));
          overflow-y: auto;
        }
        .auth-brand {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          padding-bottom: 4px;
        }
        .auth-logo-wrap {
          width: 72px; height: 72px;
          border-radius: 22px;
          background: linear-gradient(145deg, #003ec7, #0052ff);
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 8px 24px rgba(0,62,199,0.28);
          margin-bottom: 4px;
        }
        .auth-logo-icon {
          color: white;
          font-size: 34px !important;
        }
        .auth-app-name {
          font-size: 26px;
          font-weight: 800;
          color: var(--on-surface);
          letter-spacing: -0.03em;
        }
        .auth-tagline {
          font-size: 14px;
          color: var(--secondary);
          text-align: center;
          line-height: 1.5;
          max-width: 260px;
        }
        .auth-avatar-preview {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          animation: fadeUp 0.2s ease;
        }
        .auth-avatar-label {
          font-size: 12px;
          color: var(--secondary);
        }
        .auth-form {
          display: flex;
          flex-direction: column;
          gap: 14px;
          background: var(--surface-lowest);
          border: 1px solid var(--surface-high);
          border-radius: 16px;
          padding: 20px 16px;
          box-shadow: 0 2px 12px rgba(0,0,0,0.04);
        }
        .auth-field { display: flex; flex-direction: column; gap: 6px; }
        .auth-field-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .auth-notice {
          display: flex;
          gap: 8px;
          align-items: flex-start;
          padding: 10px 12px;
          background: var(--primary-fixed);
          border-radius: var(--r-lg);
          font-size: 12px;
          color: var(--on-surface-variant);
          line-height: 1.5;
        }
        .auth-switch {
          text-align: center;
          font-size: 14px;
          color: var(--secondary);
        }
        .auth-link {
          background: none;
          border: none;
          color: var(--primary);
          font-family: var(--font);
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          padding: 0;
          letter-spacing: 0.02em;
        }
        .auth-link:hover { text-decoration: underline; }
      `}</style>
    </div>
  );
}
