import { useEffect, useState } from 'react';
import { ref, get, set, onValue } from 'firebase/database';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import Avatar from '../UI/Avatar';

export default function Contacts({ onOpenChat }) {
  const { user, userData } = useAuth();
  const toast = useToast();
  const [contacts, setContacts] = useState([]);
  const [showAdd,  setShowAdd]  = useState(false);
  const [searchId, setSearchId] = useState('');
  const [found,    setFound]    = useState(null);
  const [searching, setSearching] = useState(false);
  const [adding,    setAdding]    = useState(false);

  useEffect(() => {
    if (!user) return;
    const unsub = onValue(ref(db, `contacts/${user.uid}`), async (snap) => {
      if (!snap.exists()) { setContacts([]); return; }
      const list = await Promise.all(
        Object.values(snap.val()).map(async (c) => {
          const s = await get(ref(db, `users/${c.uid}`));
          return s.exists() ? s.val() : null;
        })
      );
      setContacts(list.filter(Boolean));
    });
    return unsub;
  }, [user]);

  async function search() {
    const id = searchId.trim();
    if (id.length !== 6) return toast('Masukkan ID 6 digit', 'error');
    setSearching(true);
    setFound(null);
    try {
      const uidSnap = await get(ref(db, `userIds/${id}`));
      if (!uidSnap.exists()) { toast('ID tidak ditemukan', 'error'); return; }
      const uidValue = uidSnap.val();
      const uid = typeof uidValue === 'string' ? uidValue : uidValue?.value;
      if (!uid) { toast('ID tidak valid', 'error'); return; }
      if (uid === user.uid) { toast('Tidak bisa tambah diri sendiri', 'error'); return; }
      const uSnap = await get(ref(db, `users/${uid}`));
      setFound({ uid, ...uSnap.val() });
    } finally {
      setSearching(false);
    }
  }

  async function addContact() {
    if (!found) return;
    setAdding(true);
    try {
      await Promise.all([
        set(ref(db, `contacts/${user.uid}/${found.uid}`),  { uid: found.uid, addedAt: Date.now() }),
        set(ref(db, `contacts/${found.uid}/${user.uid}`),  { uid: user.uid,  addedAt: Date.now() }),
      ]);
      toast('Kontak ditambahkan!', 'success');
      setFound(null); setSearchId(''); setShowAdd(false);
    } finally {
      setAdding(false);
    }
  }

  function closeModal() { setShowAdd(false); setFound(null); setSearchId(''); }

  return (
    <div className="screen">
      {/* TopBar */}
      <header className="topbar">
        <div style={{ width: 40 }} />
        <span className="topbar-title">Kontak</span>
        <button className="topbar-icon" onClick={() => setShowAdd(true)} title="Tambah Kontak">
          <span className="msi msi-sm">person_add</span>
        </button>
      </header>

      <div className="scroll-area">
        {/* My ID card */}
        <div style={{
          margin: '12px 16px',
          padding: '14px',
          background: 'var(--primary-fixed)',
          borderRadius: 'var(--r-xl)',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <span className="msi" style={{ color: 'var(--primary)', fontSize: 22 }}>badge</span>
          <div>
            <div style={{ fontSize: 12, color: 'var(--secondary)', marginBottom: 2 }}>ID kamu — bagikan ke teman</div>
            <div style={{ fontFamily: 'monospace', fontSize: 20, fontWeight: 700, color: 'var(--primary)', letterSpacing: 3 }}>
              #{userData?.userId}
            </div>
          </div>
        </div>

        <div className="section-label">Semua Kontak ({contacts.length})</div>

        {contacts.length === 0 ? (
          <div className="empty" style={{ minHeight: 180 }}>
            <span className="empty-icon msi">group_add</span>
            <span style={{ fontWeight: 600, color: 'var(--on-surface)' }}>Belum ada kontak</span>
            <span style={{ fontSize: 13 }}>Tap ikon + untuk tambah via ID</span>
            <button className="btn btn-primary" style={{ marginTop: 8 }} onClick={() => setShowAdd(true)}>
              + Tambah Kontak
            </button>
          </div>
        ) : (
          contacts.map((c) => (
            <div key={c.uid} className="chat-row" onClick={() => onOpenChat(c)}>
              <div style={{ position: 'relative' }}>
                <Avatar
                  initials={c.initials || c.displayName?.slice(0,2).toUpperCase() || '?'}
                  seed={c.uid}
                  size={48}
                />
                {c.online && (
                  <div style={{
                    position: 'absolute', bottom: 1, right: 1,
                    width: 10, height: 10, borderRadius: '50%',
                    background: '#43a047', border: '2px solid white',
                  }} />
                )}
              </div>
              <div className="chat-row-body">
                <div className="chat-row-top">
                  <span className="chat-row-name">{c.displayName || c.username}</span>
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: c.online ? '#43a047' : 'var(--outline-variant)',
                  }} />
                </div>
                <div className="chat-row-bottom">
                  <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--secondary)' }}>
                    #{c.userId}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Contact Bottom Sheet */}
      {showAdd && (
        <div className="overlay" onClick={closeModal}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 6 }}>Tambah Kontak</div>
            <p style={{ fontSize: 14, color: 'var(--secondary)', marginBottom: 20 }}>
              Masukkan ID 6-digit teman kamu
            </p>

            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <div className="field-input-wrap" style={{ flex: 1 }}>
                <span className="field-input-icon msi msi-sm">tag</span>
                <input
                  className="field-input"
                  placeholder="000000"
                  maxLength={6}
                  inputMode="numeric"
                  value={searchId}
                  style={{ fontFamily: 'monospace', fontSize: 22, letterSpacing: 6, textAlign: 'center' }}
                  onChange={(e) => { setSearchId(e.target.value.replace(/\D/g, '')); setFound(null); }}
                  onKeyDown={(e) => e.key === 'Enter' && search()}
                />
              </div>
              <button
                className="btn btn-primary"
                onClick={search}
                disabled={searching || searchId.length !== 6}
                style={{ padding: '0 18px', height: 48 }}
              >
                {searching ? <div className="spinner spinner-white" style={{ width: 18, height: 18, borderWidth: 2 }} /> : 'Cari'}
              </button>
            </div>

            {/* Search result */}
            {found && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '14px', borderRadius: 'var(--r-xl)',
                background: 'var(--surface-low)',
                border: '1.5px solid var(--outline-variant)',
                marginBottom: 14,
                animation: 'fadeUp 0.2s ease',
              }}>
                <Avatar
                  initials={found.initials || found.displayName?.slice(0,2).toUpperCase() || '?'}
                  seed={found.uid}
                  size={48}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700 }}>{found.displayName || found.username}</div>
                  <div style={{ fontSize: 12, color: 'var(--secondary)', fontFamily: 'monospace' }}>#{found.userId}</div>
                </div>
                <button
                  className="btn btn-primary"
                  onClick={addContact}
                  disabled={adding}
                  style={{ padding: '8px 16px', fontSize: 13 }}
                >
                  {adding ? '...' : '+ Tambah'}
                </button>
              </div>
            )}

            <button className="btn btn-outlined" style={{ width: '100%' }} onClick={closeModal}>
              Batal
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
