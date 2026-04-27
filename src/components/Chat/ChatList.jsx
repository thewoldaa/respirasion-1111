import { useEffect, useState } from 'react';
import { ref, onValue, get } from 'firebase/database';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { formatTime, getChatId } from '../../utils/helpers';
import Avatar from '../UI/Avatar';

export default function ChatList({ onOpenChat, onOpenPublic }) {
  const { user, userData } = useAuth();
  const [chats,   setChats]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const contactsRef = ref(db, `contacts/${user.uid}`);
    const unsub = onValue(contactsRef, async (snap) => {
      if (!snap.exists()) { setChats([]); setLoading(false); return; }

      const entries = Object.values(snap.val());
      const enriched = await Promise.all(
        entries.map(async (c) => {
          const [uSnap, lastSnap] = await Promise.all([
            get(ref(db, `users/${c.uid}`)),
            get(ref(db, `chats/${getChatId(user.uid, c.uid)}/lastMsg`)),
          ]);
          const u    = uSnap.exists()    ? uSnap.val()    : {};
          const last = lastSnap.exists() ? lastSnap.val() : null;
          return { ...u, lastMsg: last };
        })
      );
      enriched.sort((a, b) => (b.lastMsg?.ts || b.createdAt || 0) - (a.lastMsg?.ts || a.createdAt || 0));
      setChats(enriched);
      setLoading(false);
    });
    return unsub;
  }, [user]);

  return (
    <div className="screen">
      {/* TopBar */}
      <header className="topbar">
        <div className="avatar avatar-40" style={{ background: 'var(--secondary-container)', color: 'var(--on-secondary-container)', cursor: 'pointer' }}>
          {userData?.initials || '?'}
        </div>
        <span className="topbar-title">Respirasion</span>
        <button className="topbar-icon">
          <span className="msi msi-sm">search</span>
        </button>
      </header>

      {/* Optimized Connection Bar */}
      <div className="conn-bar">
        <div className="conn-dot" />
        <span>Optimized Connection</span>
      </div>

      {/* Chat List */}
      <div className="scroll-area">
        {/* Public Channel – always first */}
        <div className="chat-row" onClick={onOpenPublic} style={{ background: 'var(--surface-low)' }}>
          <div className="avatar avatar-48" style={{ background: 'var(--primary-fixed)', color: 'var(--primary)' }}>
            <span className="msi" style={{ fontSize: 22 }}>hub</span>
          </div>
          <div className="chat-row-body">
            <div className="chat-row-top">
              <span className="chat-row-name" style={{ color: 'var(--primary)' }}>Saluran Publik</span>
              <span className="chip chip-channel" style={{ fontSize: 10 }}>Publik</span>
            </div>
            <div className="chat-row-bottom">
              <span className="chat-row-preview">Semua orang dapat berkomunikasi di sini</span>
            </div>
          </div>
        </div>

        {/* Section label */}
        <div className="section-label">Pesan</div>

        {loading ? (
          <div className="loading-center" style={{ minHeight: 140 }}>
            <div className="spinner" />
          </div>
        ) : chats.length === 0 ? (
          <div className="empty" style={{ minHeight: 200 }}>
            <span className="empty-icon msi">chat_bubble_outline</span>
            <span style={{ fontWeight: 600, color: 'var(--on-surface)' }}>Belum ada percakapan</span>
            <span style={{ fontSize: 13 }}>Tambah kontak lewat tab Kontak</span>
          </div>
        ) : (
          chats.map((c) => <ChatRow key={c.uid} c={c} onOpen={() => onOpenChat(c)} />)
        )}
      </div>
    </div>
  );
}

function ChatRow({ c, onOpen }) {
  const preview = c.lastMsg
    ? c.lastMsg.type === 'voice' ? '🎙 Pesan Suara' : c.lastMsg.text
    : 'Mulai percakapan';
  const time = formatTime(c.lastMsg?.ts);
  const unread = false; // placeholder – unread logic can be added later

  return (
    <div className="chat-row" onClick={onOpen}>
      <div style={{ position: 'relative' }}>
        <Avatar initials={c.initials || c.displayName?.slice(0,2).toUpperCase() || '?'} seed={c.uid} size={48} />
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
          <span className={`chat-row-name ${unread ? 'unread' : ''}`}>
            {c.displayName || c.username}
          </span>
          {time && <span className={`chat-row-time ${unread ? 'unread' : ''}`}>{time}</span>}
        </div>
        <div className="chat-row-bottom">
          <span className={`chat-row-preview ${unread ? 'unread' : ''}`}>{preview}</span>
          {unread && <div className="unread-dot" />}
        </div>
      </div>
    </div>
  );
}
