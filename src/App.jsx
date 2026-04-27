import { useEffect, useState } from 'react';
import { ref, set } from 'firebase/database';
import { db } from './firebase';
import { useAuth } from './context/AuthContext';
import { hideBottomBanner, showBottomBanner } from './services/admob';

import AuthPage       from './components/Auth/AuthPage';
import ChatList       from './components/Chat/ChatList';
import ChatRoom       from './components/Chat/ChatRoom';
import PublicChannel  from './components/Chat/PublicChannel';
import Contacts       from './components/Contacts/Contacts';
import Settings       from './components/Settings/Settings';

/* ── Tab definition ──────────────────────────────────────── */
const TABS = [
  { id: 'chats',    label: 'Pesan',   icon: 'chat_bubble' },
  { id: 'contacts', label: 'Kontak',  icon: 'group' },
  { id: 'settings', label: 'Setelan', icon: 'settings' },
];

export default function App() {
  const { user, userData, loading } = useAuth();
  const [tab,         setTab]         = useState('chats');
  const [activeChat,  setActiveChat]  = useState(null);
  const [publicOpen,  setPublicOpen]  = useState(false);

  /* Online presence tracking */
  useEffect(() => {
    if (!user) return;
    const r = ref(db, `users/${user.uid}/online`);
    set(r, true);
    const offBlur  = () => set(r, false);
    const offFocus = () => set(r, true);
    window.addEventListener('blur',  offBlur);
    window.addEventListener('focus', offFocus);
    return () => {
      set(r, false);
      window.removeEventListener('blur',  offBlur);
      window.removeEventListener('focus', offFocus);
    };
  }, [user]);

  useEffect(() => {
    const shouldShowBanner = Boolean(user && userData && !activeChat && !publicOpen);

    if (!shouldShowBanner) {
      hideBottomBanner();
      return undefined;
    }

    showBottomBanner().catch(() => {});
    return undefined;
  }, [user, userData, activeChat, publicOpen, tab]);

  /* ── Splash / Loading ─────────────────────────────────── */
  if (loading) {
    return (
      <div className="app-shell" style={{ alignItems: 'center', justifyContent: 'center', gap: 20 }}>
        <div style={{
          width: 64, height: 64, borderRadius: 18,
          background: 'linear-gradient(145deg, #003ec7, #0052ff)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 8px 28px rgba(0,62,199,0.28)',
        }}>
          <span className="msi" style={{ color: 'white', fontSize: 32 }}>wifi_tethering</span>
        </div>
        <div className="spinner" />
      </div>
    );
  }

  /* ── Auth ─────────────────────────────────────────────── */
  if (!user || !userData) {
    return (
      <div className="app-shell">
        <AuthPage />
      </div>
    );
  }

  /* ── Sub-screens (full-screen, cover bottom nav) ─────── */
  if (activeChat) {
    return (
      <div className="app-shell">
        <ChatRoom contact={activeChat} onBack={() => setActiveChat(null)} />
      </div>
    );
  }

  if (publicOpen) {
    return (
      <div className="app-shell">
        <PublicChannel onBack={() => setPublicOpen(false)} />
      </div>
    );
  }

  /* ── Main Shell ───────────────────────────────────────── */
  function openChat(contact) { setActiveChat(contact); setTab('chats'); }

  return (
    <div className="app-shell">
      <div className="app-main">
        <div className="app-content">
          {tab === 'chats' && (
            <ChatList
              onOpenChat={openChat}
              onOpenPublic={() => setPublicOpen(true)}
            />
          )}
          {tab === 'contacts' && <Contacts onOpenChat={openChat} />}
          {tab === 'settings' && <Settings />}
        </div>

        <nav className="bottom-nav" aria-label="Navigasi utama">
          {TABS.map(({ id, label, icon }) => (
            <button
              key={id}
              className={`nav-item ${tab === id ? 'active' : ''}`}
              onClick={() => setTab(id)}
            >
              <span className="msi">{icon}</span>
              <span className="nav-label">{label}</span>
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
