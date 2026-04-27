import { useEffect, useRef, useState } from 'react';
import { ref, push, onValue, set, query, limitToLast } from 'firebase/database';
import { ref as sRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { getChatId, formatFullTime, formatTime } from '../../utils/helpers';
import Avatar from '../UI/Avatar';

export default function ChatRoom({ contact, onBack }) {
  const { user } = useAuth();
  const [msgs,      setMsgs]      = useState([]);
  const [text,      setText]      = useState('');
  const [recording, setRecording] = useState(false);
  const [sending,   setSending]   = useState(false);
  const scrollRef  = useRef(null);
  const mediaRef   = useRef(null);
  const chunksRef  = useRef([]);
  const textareaRef = useRef(null);

  const chatId  = getChatId(user.uid, contact.uid);
  const msgsRef = query(ref(db, `chats/${chatId}/messages`), limitToLast(80));

  useEffect(() => {
    const unsub = onValue(msgsRef, (snap) => {
      if (!snap.exists()) { setMsgs([]); return; }
      const list = Object.entries(snap.val()).map(([id, v]) => ({ id, ...v }));
      list.sort((a, b) => a.ts - b.ts);
      setMsgs(list);
    });
    return unsub;
  }, [chatId]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [msgs]);

  // ── send text ──────────────────────────────────────────
  async function sendText() {
    const t = text.trim();
    if (!t || sending) return;
    setSending(true);
    setText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    const msg = { senderId: user.uid, text: t, type: 'text', ts: Date.now() };
    await push(ref(db, `chats/${chatId}/messages`), msg);
    await set(ref(db, `chats/${chatId}/lastMsg`), msg);
    setSending(false);
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendText(); }
  }

  // ── voice recording ────────────────────────────────────
  async function startRecord() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunksRef.current = [];
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      mr.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        await uploadVoice(new Blob(chunksRef.current, { type: 'audio/webm' }));
      };
      mr.start(250);
      mediaRef.current = mr;
      setRecording(true);
    } catch {
      alert('Izin mikrofon diperlukan');
    }
  }

  function stopRecord() {
    mediaRef.current?.stop();
    setRecording(false);
  }

  async function uploadVoice(blob) {
    setSending(true);
    try {
      const path = `voice/${chatId}/${Date.now()}.webm`;
      const snap = await uploadBytes(sRef(storage, path), blob);
      const url  = await getDownloadURL(snap.ref);
      const msg  = { senderId: user.uid, type: 'voice', voiceUrl: url, ts: Date.now() };
      await push(ref(db, `chats/${chatId}/messages`), msg);
      await set(ref(db, `chats/${chatId}/lastMsg`), msg);
    } finally {
      setSending(false);
    }
  }

  const isOut = (m) => m.senderId === user.uid;

  // Group messages to show avatar only for first in group
  const grouped = msgs.map((m, i) => ({
    ...m,
    showAvatar: !isOut(m) && (i === 0 || msgs[i - 1]?.senderId !== m.senderId),
  }));

  return (
    <div className="screen screen-slide">
      {/* TopBar */}
      <header className="topbar" style={{ justifyContent: 'flex-start', gap: 10 }}>
        <button className="btn-icon-round" onClick={onBack}>
          <span className="msi msi-sm">arrow_back</span>
        </button>
        <Avatar
          initials={contact.initials || contact.displayName?.slice(0,2).toUpperCase() || '?'}
          seed={contact.uid}
          size={40}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--on-surface)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {contact.displayName || contact.username}
          </div>
          <div style={{ fontSize: 11, color: contact.online ? '#43a047' : 'var(--outline)', fontWeight: 500 }}>
            {contact.online ? '● Online' : 'Terakhir dilihat ' + formatTime(contact.lastSeen)}
          </div>
        </div>
        <button className="btn-icon-round">
          <span className="msi msi-sm">call</span>
        </button>
      </header>

      {/* Messages */}
      <div className="scroll-area" ref={scrollRef} style={{ padding: '12px 12px 8px', background: 'var(--surface-low)' }}>
        {msgs.length === 0 && (
          <div className="empty" style={{ minHeight: 180 }}>
            <span className="empty-icon msi">waving_hand</span>
            <span style={{ fontWeight: 600, color: 'var(--on-surface)' }}>Mulai percakapan!</span>
            <span style={{ fontSize: 13 }}>Pesan bersifat privat</span>
          </div>
        )}
        {grouped.map((m) => (
          <Bubble key={m.id} msg={m} out={isOut(m)} contact={contact} />
        ))}
      </div>

      {/* Compose */}
      <div className="compose-bar">
        <div className="compose-input-wrap">
          <textarea
            ref={textareaRef}
            className="compose-textarea"
            placeholder="Pesan..."
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

        {/* Voice / Send */}
        {text.trim() ? (
          <button
            className="compose-send-btn"
            onClick={sendText}
            disabled={sending}
            title="Kirim"
          >
            {sending
              ? <div className="spinner spinner-white" style={{ width: 18, height: 18, borderWidth: 2 }} />
              : <span className="msi msi-sm msi-fill">send</span>}
          </button>
        ) : (
          <button
            className={`compose-mic-btn ${recording ? 'recording' : ''}`}
            onPointerDown={startRecord}
            onPointerUp={stopRecord}
            onPointerLeave={stopRecord}
            title={recording ? 'Lepas untuk kirim' : 'Tahan untuk rekam'}
          >
            <span className="msi msi-sm">{recording ? 'stop_circle' : 'mic'}</span>
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Bubble ──────────────────────────────────────────────── */
function Bubble({ msg, out, contact }) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef(null);

  function togglePlay() {
    if (!audioRef.current) {
      audioRef.current = new Audio(msg.voiceUrl);
      audioRef.current.onended = () => setPlaying(false);
    }
    if (playing) { audioRef.current.pause(); audioRef.current.currentTime = 0; setPlaying(false); }
    else { audioRef.current.play(); setPlaying(true); }
  }

  const BARS = [4, 9, 6, 13, 8, 5, 11, 7, 4, 10, 6, 3, 8, 12, 5];

  return (
    <div className={`bubble-row ${out ? 'out' : ''}`} style={{ alignItems: 'flex-end', marginBottom: 6 }}>
      {/* Incoming avatar placeholder */}
      {!out && (
        <div style={{ width: 28, flexShrink: 0 }}>
          {msg.showAvatar && (
            <Avatar
              initials={contact.initials || contact.displayName?.slice(0,2).toUpperCase() || '?'}
              seed={contact.uid}
              size={28}
            />
          )}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', maxWidth: '78%' }}>
        {msg.type === 'voice' ? (
          <div className={`bubble ${out ? 'out' : 'in'} voice-bubble`}>
            <button className="voice-play-btn" onClick={togglePlay}>
              <span className="msi msi-sm msi-fill">{playing ? 'stop' : 'play_arrow'}</span>
            </button>
            <div className="waveform">
              {BARS.map((h, i) => (
                <div
                  key={i}
                  className="waveform-bar"
                  style={{ height: h + 'px', opacity: playing ? 1 : 0.5 }}
                />
              ))}
            </div>
            <div className="bubble-time" style={{ fontSize: 10, opacity: 0.7, flexShrink: 0 }}>
              {formatFullTime(msg.ts)}
            </div>
          </div>
        ) : (
          <div className={`bubble ${out ? 'out' : 'in'}`}>
            {msg.text}
            <div className="bubble-meta">
              <span className="bubble-time">{formatFullTime(msg.ts)}</span>
              {out && <span className="msi" style={{ fontSize: 14, opacity: 0.8 }}>done_all</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
