import { useEffect, useRef, useState } from 'react';
import { ref, push, onValue, query, limitToLast } from 'firebase/database';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { formatFullTime, formatTime } from '../../utils/helpers';

export default function PublicChannel({ onBack }) {
  const { user, userData } = useAuth();
  const [msgs,    setMsgs]    = useState([]);
  const [text,    setText]    = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);
  const textareaRef = useRef(null);
  const msgsRef = query(ref(db, 'public/messages'), limitToLast(100));

  useEffect(() => {
    const unsub = onValue(msgsRef, (snap) => {
      if (!snap.exists()) { setMsgs([]); return; }
      const list = Object.entries(snap.val()).map(([id, v]) => ({ id, ...v }));
      list.sort((a, b) => a.ts - b.ts);
      setMsgs(list);
    });
    return unsub;
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [msgs]);

  async function send() {
    const t = text.trim();
    if (!t || sending) return;
    setSending(true);
    setText('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    await push(ref(db, 'public/messages'), {
      senderId: user.uid,
      userId:   userData.userId,
      initials: userData.initials,
      text:     t,
      ts:       Date.now(),
    });
    setSending(false);
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  }

  const isOut = (m) => m.senderId === user.uid;

  // Group by sender for avatar display
  const grouped = msgs.map((m, i) => ({
    ...m,
    showMeta: !isOut(m) && (i === 0 || msgs[i - 1]?.senderId !== m.senderId),
  }));

  return (
    <div className="screen screen-slide">
      {/* TopBar */}
      <header className="topbar" style={{ justifyContent: 'flex-start', gap: 10 }}>
        <button className="btn-icon-round" onClick={onBack}>
          <span className="msi msi-sm">arrow_back</span>
        </button>
        <div className="avatar avatar-40" style={{ background: 'var(--primary-fixed)', color: 'var(--primary)' }}>
          <span className="msi" style={{ fontSize: 20 }}>hub</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--primary)' }}>Saluran Publik</div>
          <div style={{ fontSize: 11, color: 'var(--secondary)', fontWeight: 500 }}>
            Identitas ditampilkan sebagai User ID
          </div>
        </div>
      </header>

      {/* Notice */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '6px 16px',
        background: 'var(--primary-fixed)',
        borderBottom: '1px solid var(--outline-variant)',
        fontSize: 12, color: 'var(--primary)', fontWeight: 500,
      }}>
        <span className="msi" style={{ fontSize: 14 }}>shield</span>
        Pesan publik — nama tampil sebagai ID Pengguna
        <span className="chip chip-id" style={{ marginLeft: 'auto' }}>
          #{userData?.userId}
        </span>
      </div>

      {/* Messages */}
      <div
        className="scroll-area"
        ref={scrollRef}
        style={{ padding: '12px', background: 'var(--surface-low)' }}
      >
        {msgs.length === 0 && (
          <div className="empty" style={{ minHeight: 200 }}>
            <span className="empty-icon msi">forum</span>
            <span style={{ fontWeight: 600, color: 'var(--on-surface)' }}>Belum ada pesan</span>
            <span style={{ fontSize: 13 }}>Jadilah yang pertama berbicara!</span>
          </div>
        )}

        {grouped.map((m, i) => {
          const out = isOut(m);

          return (
            <div
              key={m.id}
              className={`bubble-row ${out ? 'out' : ''}`}
              style={{ alignItems: 'flex-end', marginBottom: 6 }}
            >
              {/* Avatar for incoming */}
              {!out && (
                <div style={{ width: 28, flexShrink: 0 }}>
                  {m.showMeta && (
                    <div
                      className="avatar"
                      style={{
                        width: 28, height: 28, fontSize: 11,
                        background: 'var(--secondary-container)',
                        color: 'var(--on-secondary-container)',
                      }}
                    >
                      {m.initials || '?'}
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', maxWidth: '78%' }}>
                {/* ID label for first in group */}
                {m.showMeta && (
                  <span style={{
                    fontSize: 11, fontWeight: 700, color: 'var(--primary)',
                    paddingLeft: 4, marginBottom: 2,
                    fontFamily: 'monospace',
                  }}>
                    #{m.userId}
                  </span>
                )}
                <div className={`bubble ${out ? 'out' : 'in'}`}>
                  {m.text}
                  <div className="bubble-meta">
                    <span className="bubble-time">{formatFullTime(m.ts)}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Compose */}
      <div className="compose-bar">
        <div className="compose-input-wrap">
          <textarea
            ref={textareaRef}
            className="compose-textarea"
            placeholder={`Tulis sebagai #${userData?.userId}...`}
            rows={1}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px';
            }}
            onKeyDown={handleKey}
          />
        </div>
        <button
          className="compose-send-btn"
          onClick={send}
          disabled={sending || !text.trim()}
        >
          {sending
            ? <div className="spinner spinner-white" style={{ width: 18, height: 18, borderWidth: 2 }} />
            : <span className="msi msi-sm msi-fill">send</span>}
        </button>
      </div>
    </div>
  );
}
