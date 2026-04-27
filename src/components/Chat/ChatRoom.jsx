import { useEffect, useRef, useState } from 'react';
import {
  get,
  onChildAdded,
  onValue,
  push,
  query,
  limitToLast,
  ref,
  remove,
  set,
  update,
} from 'firebase/database';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { formatFullTime, formatTime, getChatId } from '../../utils/helpers';
import Avatar from '../UI/Avatar';

const RTC_CONFIG = {
  iceServers: [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  ],
};

export default function ChatRoom({ contact, onBack }) {
  const { user, userData } = useAuth();
  const toast = useToast();
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [callData, setCallData] = useState(null);
  const [callState, setCallState] = useState('idle');
  const [callSeconds, setCallSeconds] = useState(0);
  const [remoteReady, setRemoteReady] = useState(false);
  const scrollRef = useRef(null);
  const textareaRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const peerRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteDescAppliedRef = useRef(false);
  const rtcUnsubsRef = useRef([]);

  const chatId = getChatId(user.uid, contact.uid);
  const msgsRef = query(ref(db, `chats/${chatId}/messages`), limitToLast(80));
  const callRef = ref(db, `calls/${chatId}`);

  useEffect(() => {
    const unsub = onValue(msgsRef, (snap) => {
      if (!snap.exists()) {
        setMsgs([]);
        return;
      }

      const list = Object.entries(snap.val()).map(([id, value]) => ({ id, ...value }));
      list.sort((a, b) => a.ts - b.ts);
      setMsgs(list);
    });

    return unsub;
  }, [chatId]);

  useEffect(() => {
    const unsub = onValue(callRef, (snap) => {
      setCallData(snap.exists() ? snap.val() : null);
    });

    return unsub;
  }, [chatId]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [msgs]);

  useEffect(() => {
    if (!callData) {
      if (callState !== 'idle') {
        clearRtcSession();
        setCallState('idle');
        setCallSeconds(0);
      }
      return;
    }

    if (callData.status === 'ringing') {
      if (callData.calleeId === user.uid && !peerRef.current) setCallState('incoming');
      if (callData.callerId === user.uid && !peerRef.current) setCallState('calling');
    } else if (callData.status === 'connecting' && peerRef.current) {
      setCallState('connecting');
    } else if (callData.status === 'connected') {
      setCallState('connected');
    } else if (callData.status === 'ended') {
      clearRtcSession();
      setCallState('idle');
      setCallSeconds(0);
      setRemoteReady(false);
    }
  }, [callData, callState, user.uid]);

  useEffect(() => {
    if (
      !callData?.answer ||
      callData.callerId !== user.uid ||
      !peerRef.current ||
      remoteDescAppliedRef.current
    ) {
      return;
    }

    applyRemoteAnswer(callData.answer);
  }, [callData?.answer, callData?.callerId, user.uid]);

  useEffect(() => {
    if (callState !== 'connected') {
      setCallSeconds(0);
      return;
    }

    const startedAt = Date.now();
    const tid = setInterval(() => {
      setCallSeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    }, 1000);

    return () => clearInterval(tid);
  }, [callState]);

  useEffect(() => {
    return () => {
      if (peerRef.current || callData?.status === 'connected' || callData?.status === 'ringing' || callData?.status === 'connecting') {
        endCall('left-chat', false);
      }
      clearRtcSession();
    };
  }, [callData]);

  async function sendText() {
    const nextText = text.trim();
    if (!nextText || sending) return;

    setSending(true);
    setText('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    try {
      const msg = {
        senderId: user.uid,
        text: nextText,
        type: 'text',
        ts: Date.now(),
      };

      await push(ref(db, `chats/${chatId}/messages`), msg);
      await set(ref(db, `chats/${chatId}/lastMsg`), msg);
    } finally {
      setSending(false);
    }
  }

  function handleKey(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendText();
    }
  }

  async function applyRemoteAnswer(answer) {
    try {
      await peerRef.current.setRemoteDescription(new RTCSessionDescription(answer));
      remoteDescAppliedRef.current = true;
      setCallState('connecting');
    } catch {
      toast('Jawaban panggilan gagal diproses', 'error');
      endCall('invalid-answer');
    }
  }

  function clearRtcSubscriptions() {
    rtcUnsubsRef.current.forEach((unsub) => unsub());
    rtcUnsubsRef.current = [];
  }

  function clearRtcSession() {
    clearRtcSubscriptions();
    remoteDescAppliedRef.current = false;
    setRemoteReady(false);

    if (peerRef.current) {
      peerRef.current.onicecandidate = null;
      peerRef.current.ontrack = null;
      peerRef.current.onconnectionstatechange = null;
      peerRef.current.close();
      peerRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    if (remoteAudioRef.current) {
      remoteAudioRef.current.pause();
      remoteAudioRef.current.srcObject = null;
    }
  }

  function scheduleCallCleanup() {
    window.setTimeout(async () => {
      try {
        const snap = await get(callRef);
        if (snap.exists() && snap.val()?.status === 'ended') {
          await remove(callRef);
        }
      } catch {
        // ignore cleanup failures
      }
    }, 8000);
  }

  async function ensureLocalAudio() {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    });

    localStreamRef.current = stream;
    return stream;
  }

  function listenForCandidates(path) {
    const unsub = onChildAdded(ref(db, path), async (snap) => {
      const candidate = snap.val();
      if (!candidate || !peerRef.current) return;

      try {
        await peerRef.current.addIceCandidate(new RTCIceCandidate(candidate));
      } catch {
        // ignore transient candidate failures
      }
    });

    rtcUnsubsRef.current.push(unsub);
  }

  function createPeer(role, localStream) {
    clearRtcSubscriptions();

    const peer = new RTCPeerConnection(RTC_CONFIG);
    localStream.getTracks().forEach((track) => peer.addTrack(track, localStream));

    peer.ontrack = (event) => {
      const [stream] = event.streams;
      if (!stream) return;

      setRemoteReady(true);
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = stream;
        remoteAudioRef.current.play().catch(() => {});
      }
    };

    peer.onicecandidate = (event) => {
      if (!event.candidate) return;

      const candidatePath = role === 'caller'
        ? `calls/${chatId}/offerCandidates`
        : `calls/${chatId}/answerCandidates`;

      push(ref(db, candidatePath), event.candidate.toJSON()).catch(() => {});
    };

    peer.onconnectionstatechange = () => {
      const state = peer.connectionState;

      if (state === 'connected') {
        setCallState('connected');
        update(callRef, {
          status: 'connected',
          connectedAt: Date.now(),
          updatedAt: Date.now(),
        }).catch(() => {});
        return;
      }

      if (state === 'connecting') {
        setCallState('connecting');
        return;
      }

      if (state === 'disconnected' || state === 'failed' || state === 'closed') {
        endCall('connection-lost', false);
      }
    };

    peerRef.current = peer;
    return peer;
  }

  async function startCall() {
    if (callData && callData.status !== 'ended') return;

    try {
      const localStream = await ensureLocalAudio();
      const peer = createPeer('caller', localStream);
      listenForCandidates(`calls/${chatId}/answerCandidates`);

      const offer = await peer.createOffer({
        offerToReceiveAudio: true,
      });
      await peer.setLocalDescription(offer);

      await set(callRef, {
        chatId,
        callerId: user.uid,
        callerName: userData?.displayName || userData?.username || 'Pengguna',
        callerInitials: userData?.initials || 'RS',
        calleeId: contact.uid,
        calleeName: contact.displayName || contact.username || 'Kontak',
        calleeInitials: contact.initials || (contact.displayName || contact.username || '?').slice(0, 2).toUpperCase(),
        offer: {
          type: offer.type,
          sdp: offer.sdp,
        },
        status: 'ringing',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      setCallState('calling');
    } catch {
      clearRtcSession();
      toast('Mikrofon tidak tersedia atau izin ditolak', 'error');
    }
  }

  async function answerCall() {
    if (!callData?.offer) return;

    try {
      const localStream = await ensureLocalAudio();
      const peer = createPeer('callee', localStream);
      await peer.setRemoteDescription(new RTCSessionDescription(callData.offer));
      listenForCandidates(`calls/${chatId}/offerCandidates`);

      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);

      await update(callRef, {
        answer: {
          type: answer.type,
          sdp: answer.sdp,
        },
        status: 'connecting',
        updatedAt: Date.now(),
      });

      setCallState('connecting');
    } catch {
      clearRtcSession();
      toast('Gagal menerima panggilan', 'error');
      endCall('answer-failed');
    }
  }

  async function endCall(reason = 'ended', removeLater = true) {
    try {
      const snap = await get(callRef);
      if (snap.exists()) {
        await update(callRef, {
          status: 'ended',
          endedAt: Date.now(),
          endedBy: user.uid,
          reason,
          updatedAt: Date.now(),
        });
      }
    } catch {
      // ignore database end-call failures
    } finally {
      clearRtcSession();
      setCallState('idle');
      setCallSeconds(0);
      if (removeLater) scheduleCallCleanup();
    }
  }

  const isOut = (msg) => msg.senderId === user.uid;
  const activeCall = callData && callData.status !== 'ended';
  const hasIncomingCall = callData?.status === 'ringing' && callData?.calleeId === user.uid;

  const grouped = msgs.map((msg, index) => ({
    ...msg,
    showAvatar: !isOut(msg) && (index === 0 || msgs[index - 1]?.senderId !== msg.senderId),
  }));

  return (
    <div className="screen screen-slide">
      <header className="topbar" style={{ justifyContent: 'flex-start', gap: 10 }}>
        <button className="btn-icon-round" onClick={onBack}>
          <span className="msi msi-sm">arrow_back</span>
        </button>
        <Avatar
          initials={contact.initials || contact.displayName?.slice(0, 2).toUpperCase() || '?'}
          seed={contact.uid}
          size={40}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--on-surface)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {contact.displayName || contact.username}
          </div>
          <div style={{ fontSize: 11, color: contact.online ? '#43a047' : 'var(--outline)', fontWeight: 500 }}>
            {contact.online ? 'Online' : `Terakhir dilihat ${formatTime(contact.lastSeen)}`}
          </div>
        </div>
        <button
          className={`btn-icon-round ${activeCall ? 'btn-icon-danger' : ''}`}
          onClick={() => (activeCall ? endCall('manual') : startCall())}
          title={activeCall ? 'Akhiri panggilan' : 'Panggil suara'}
        >
          <span className="msi msi-sm">{activeCall ? 'call_end' : 'call'}</span>
        </button>
      </header>

      <audio ref={remoteAudioRef} autoPlay playsInline />

      <div className="call-banner">
        <div className="call-banner-main">
          <div className={`call-status-dot ${callState === 'connected' ? 'live' : ''}`} />
          <div>
            <div className="call-banner-title">{getCallTitle(callState, contact.displayName || contact.username)}</div>
            <div className="call-banner-subtitle">
              {callState === 'connected'
                ? `Audio live tanpa rekaman · ${formatDuration(callSeconds)}`
                : 'Voice call 2 arah real-time tanpa penyimpanan'}
            </div>
          </div>
        </div>

        {hasIncomingCall ? (
          <div className="call-banner-actions">
            <button className="btn btn-outlined" onClick={() => endCall('declined')}>
              Tolak
            </button>
            <button className="btn btn-primary" onClick={answerCall}>
              Jawab
            </button>
          </div>
        ) : activeCall ? (
          <div className="call-banner-chip">
            {remoteReady ? 'Audio tersambung' : 'Menunggu koneksi'}
          </div>
        ) : null}
      </div>

      <div className="scroll-area" ref={scrollRef} style={{ padding: '12px 12px 8px', background: 'var(--surface-low)' }}>
        {msgs.length === 0 && (
          <div className="empty" style={{ minHeight: 180 }}>
            <span className="empty-icon msi">waving_hand</span>
            <span style={{ fontWeight: 600, color: 'var(--on-surface)' }}>Mulai percakapan</span>
            <span style={{ fontSize: 13 }}>Chat teks privat dan voice call real-time</span>
          </div>
        )}

        {grouped.map((msg) => (
          <Bubble key={msg.id} msg={msg} out={isOut(msg)} contact={contact} />
        ))}
      </div>

      <div className="compose-bar">
        <div className="compose-input-wrap">
          <textarea
            ref={textareaRef}
            className="compose-textarea"
            placeholder="Tulis pesan..."
            rows={1}
            value={text}
            onChange={(event) => {
              setText(event.target.value);
              event.target.style.height = 'auto';
              event.target.style.height = `${Math.min(event.target.scrollHeight, 100)}px`;
            }}
            onKeyDown={handleKey}
          />
        </div>
        <button
          className="compose-send-btn"
          onClick={sendText}
          disabled={sending || !text.trim()}
          title="Kirim"
        >
          {sending
            ? <div className="spinner spinner-white" style={{ width: 18, height: 18, borderWidth: 2 }} />
            : <span className="msi msi-sm msi-fill">send</span>}
        </button>
      </div>
    </div>
  );
}

function Bubble({ msg, out, contact }) {
  return (
    <div className={`bubble-row ${out ? 'out' : ''}`} style={{ alignItems: 'flex-end', marginBottom: 6 }}>
      {!out && (
        <div style={{ width: 28, flexShrink: 0 }}>
          {msg.showAvatar && (
            <Avatar
              initials={contact.initials || contact.displayName?.slice(0, 2).toUpperCase() || '?'}
              seed={contact.uid}
              size={28}
            />
          )}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', maxWidth: '78%' }}>
        <div className={`bubble ${out ? 'out' : 'in'}`}>
          {msg.text}
          <div className="bubble-meta">
            <span className="bubble-time">{formatFullTime(msg.ts)}</span>
            {out && <span className="msi" style={{ fontSize: 14, opacity: 0.8 }}>done_all</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

function getCallTitle(state, contactName) {
  if (state === 'incoming') return `Panggilan masuk dari ${contactName}`;
  if (state === 'calling') return `Memanggil ${contactName}`;
  if (state === 'connecting') return 'Menyambungkan panggilan';
  if (state === 'connected') return `Terhubung dengan ${contactName}`;
  return 'Siap untuk voice call';
}

function formatDuration(totalSeconds) {
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}
