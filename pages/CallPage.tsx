import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PhoneOff, Mic, MicOff, Loader2, MonitorUp, MonitorOff } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import { supabase } from '../lib/supabase';
import { Haptic } from '../utils/haptics';

type Role = 'admin' | 'user';
type CallStatus = 'open' | 'closed';
type SignalKind = 'offer' | 'answer' | 'ice' | 'hangup';

type SupportCallRow = {
  id: string;
  thread_id: string;
  status: CallStatus;
  admin_token: string;
  user_token: string;
  expires_at: string;
  closed_at: string | null;
};

type SignalRow = {
  id: number;
  call_id: string;
  sender: Role;
  kind: SignalKind;
  payload: any;
  created_at: string;
};

function getStunConfig(): RTCConfiguration {
  // Minimal STUN; for production-grade reliability add a TURN server.
  return {
    iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }],
  };
}

function parseCallParams(): { callId: string | null; role: Role | null; token: string | null } {
  const path = typeof window !== 'undefined' ? window.location.pathname : '';
  const sp = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const qsCallId = sp.get('call');
  const pathMatch = path.match(/^\/call\/([0-9a-fA-F-]{16,})/);
  let callId: string | null = pathMatch?.[1] ?? null;
  if (!callId && qsCallId && /^[0-9a-fA-F-]{16,}$/i.test(qsCallId.trim())) callId = qsCallId.trim();
  const role = (sp.get('role') as Role | null) ?? null;
  const token = sp.get('token');
  if (role !== 'admin' && role !== 'user') return { callId, role: null, token };
  return { callId, role, token };
}

async function postSignal(callId: string, sender: Role, kind: SignalKind, payload: unknown) {
  await supabase.from('support_call_signals').insert({
    call_id: callId,
    sender,
    kind,
    payload,
  });
}

export default function CallPage({ onBack }: { onBack: () => void }) {
  const { callId, role, token } = useMemo(() => parseCallParams(), []);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [call, setCall] = useState<SupportCallRow | null>(null);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'ended'>('idle');
  const [micEnabled, setMicEnabled] = useState(true);
  const [micGranted, setMicGranted] = useState(false);
  const [micRequesting, setMicRequesting] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareRequesting, setShareRequesting] = useState(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const screenSenderRef = useRef<RTCRtpSender | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const lastSignalIdRef = useRef<number>(0);

  const isExpired = (row: SupportCallRow) => Date.now() > new Date(row.expires_at).getTime();

  const cleanup = async (sendHangup: boolean) => {
    try {
      if (sendHangup && callId && role) {
        await postSignal(callId, role, 'hangup', { at: new Date().toISOString() });
      }
    } catch {
      // ignore
    }
    try {
      pcRef.current?.close();
    } catch {
      // ignore
    }
    pcRef.current = null;
    try {
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
    } catch {
      // ignore
    }
    localStreamRef.current = null;
  };

  useEffect(() => {
    return () => {
      cleanup(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const init = async () => {
      if (!callId || !role || !token) {
        setErrorText('Invalid call link.');
        setLoading(false);
        return;
      }
      setLoading(true);
      setErrorText(null);
      try {
        const { data, error } = await supabase
          .from('support_calls')
          .select('id,thread_id,status,admin_token,user_token,expires_at,closed_at')
          .eq('id', callId)
          .single();
        if (error || !data) {
          setErrorText('Call not found.');
          return;
        }
        const row = data as SupportCallRow;
        if (row.status !== 'open' || row.closed_at || isExpired(row)) {
          setErrorText('Call is closed or expired.');
          return;
        }
        const expected = role === 'admin' ? row.admin_token : row.user_token;
        if (expected !== token) {
          setErrorText('Invalid call token.');
          return;
        }
        setCall(row);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [callId, role, token]);

  useEffect(() => {
    if (!callId || !role || !call) return;
    if (!micGranted) return;
    let alive = true;

    const start = async () => {
      setStatus('connecting');

      const pc = new RTCPeerConnection(getStunConfig());
      pcRef.current = pc;

      pc.onconnectionstatechange = () => {
        const s = pc.connectionState;
        if (s === 'connected') setStatus('connected');
        if (s === 'failed' || s === 'disconnected' || s === 'closed') setStatus('ended');
      };

      pc.onicecandidate = (e) => {
        if (!e.candidate) return;
        postSignal(callId, role, 'ice', e.candidate.toJSON()).catch(() => {});
      };

      pc.ontrack = (e) => {
        const stream = e.streams?.[0];
        if (!stream) return;
        // Audio always goes to <audio>
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = stream;
          remoteAudioRef.current.play().catch(() => {});
        }
        // If there is a video track (screen share), show it in <video>
        const hasVideo = stream.getVideoTracks().length > 0;
        if (hasVideo && remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = stream;
          remoteVideoRef.current.play().catch(() => {});
        }
      };

      // Acquire mic
      let stream: MediaStream;
      stream = localStreamRef.current as MediaStream;
      if (!stream) {
        setErrorText('Microphone is not enabled.');
        setStatus('ended');
        return;
      }
      if (!alive) return;
      stream.getAudioTracks().forEach((t) => {
        t.enabled = micEnabled;
        pc.addTrack(t, stream);
      });

      // Role logic:
      // admin creates offer, user waits for offer then answers
      if (role === 'admin') {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await postSignal(callId, role, 'offer', offer);
      }

      // Poll signals (fallback; realtime may be flaky)
      const poll = async () => {
        if (!alive) return;
        const { data } = await supabase
          .from('support_call_signals')
          .select('id,call_id,sender,kind,payload,created_at')
          .eq('call_id', callId)
          .gt('id', lastSignalIdRef.current)
          .order('id', { ascending: true })
          .limit(50);

        const rows = (data as SignalRow[]) || [];
        for (const s of rows) {
          lastSignalIdRef.current = Math.max(lastSignalIdRef.current, s.id);
          if (s.sender === role) continue; // ignore own echoes

          if (s.kind === 'hangup') {
            setStatus('ended');
            await cleanup(false);
            return;
          }

          if (s.kind === 'offer') {
            // Allow renegotiation from either side (e.g. screen share)
            await pc.setRemoteDescription(s.payload as RTCSessionDescriptionInit);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await postSignal(callId, role, 'answer', answer);
          }

          if (s.kind === 'answer') {
            await pc.setRemoteDescription(s.payload as RTCSessionDescriptionInit);
          }

          if (s.kind === 'ice') {
            try {
              await pc.addIceCandidate(s.payload as RTCIceCandidateInit);
            } catch {
              // ignore
            }
          }
        }
      };

      const id = window.setInterval(() => {
        poll().catch(() => {});
      }, 900);
      // initial
      poll().catch(() => {});
      return () => window.clearInterval(id);
    };

    let stopPolling: (() => void) | undefined;
    start()
      .then((stop) => {
        stopPolling = typeof stop === 'function' ? stop : undefined;
      })
      .catch((e) => setErrorText(String(e)));

    return () => {
      alive = false;
      stopPolling?.();
      cleanup(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callId, role, call, micEnabled, micGranted]);

  const requestMic = async () => {
    if (micGranted || micRequesting) return;
    Haptic.tap();
    setMicRequesting(true);
    setErrorText(null);
    try {
      if (!window.isSecureContext) {
        setErrorText('Microphone requires HTTPS (secure context).');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;
      setMicGranted(true);
    } catch {
      setErrorText('Microphone access denied.');
      setStatus('ended');
    } finally {
      setMicRequesting(false);
    }
  };

  const renegotiate = async () => {
    if (!callId || !role) return;
    const pc = pcRef.current;
    if (!pc) return;
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await postSignal(callId, role, 'offer', offer);
    } catch {
      // ignore
    }
  };

  const startShare = async () => {
    if (!callId || !role || role !== 'user') return;
    if (!pcRef.current) return;
    if (sharing || shareRequesting) return;
    Haptic.tap();
    setShareRequesting(true);
    setErrorText(null);
    try {
      if (!window.isSecureContext) {
        setErrorText('Screen sharing requires HTTPS (secure context).');
        return;
      }
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      screenStreamRef.current = stream;
      const track = stream.getVideoTracks()[0];
      if (!track) return;
      // Auto stop if user ends sharing from browser UI
      track.onended = () => {
        stopShare().catch(() => {});
      };

      const pc = pcRef.current;
      const sender = pc.addTrack(track, stream);
      screenSenderRef.current = sender;
      setSharing(true);
      await renegotiate();
    } catch {
      setErrorText('Screen sharing denied.');
    } finally {
      setShareRequesting(false);
    }
  };

  const stopShare = async () => {
    if (!callId || !role || role !== 'user') return;
    const pc = pcRef.current;
    if (!pc) return;
    try {
      const sender = screenSenderRef.current;
      if (sender) {
        try {
          pc.removeTrack(sender);
        } catch {
          // ignore
        }
      }
      screenSenderRef.current = null;
      try {
        screenStreamRef.current?.getTracks().forEach((t) => t.stop());
      } catch {
        // ignore
      }
      screenStreamRef.current = null;
      setSharing(false);
      await renegotiate();
    } catch {
      // ignore
    }
  };

  const toggleMic = () => {
    const next = !micEnabled;
    setMicEnabled(next);
    try {
      localStreamRef.current?.getAudioTracks().forEach((t) => {
        t.enabled = next;
      });
    } catch {
      // ignore
    }
  };

  const hangup = async () => {
    Haptic.tap();
    setStatus('ended');
    await cleanup(true);
    if (callId) {
      try {
        await supabase
          .from('support_calls')
          .update({ status: 'closed', closed_at: new Date().toISOString() })
          .eq('id', callId);
      } catch {
        // ignore
      }
    }
    onBack();
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-background">
      <PageHeader title="Support call" onBack={onBack} />

      <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-4 py-6">
        <audio ref={remoteAudioRef} autoPlay playsInline />
        <video ref={remoteVideoRef} autoPlay playsInline className="hidden" />

        {loading ? (
          <div className="text-textMuted flex items-center gap-2">
            <Loader2 size={18} className="animate-spin" />
            <span className="text-sm">Connecting…</span>
          </div>
        ) : errorText ? (
          <div className="w-full max-w-md rounded-2xl bg-card/45 border border-border p-4 text-center">
            <div className="text-textPrimary font-semibold">Call unavailable</div>
            <div className="text-textMuted text-sm mt-1">{errorText}</div>
            <button
              type="button"
              onClick={onBack}
              className="mt-4 w-full min-h-[48px] rounded-2xl bg-neon text-black font-bold"
            >
              Back
            </button>
          </div>
        ) : (
          <div className="w-full max-w-md rounded-3xl bg-card/35 hairline-top hairline-bottom p-5">
            <div className="text-center">
              <div className="text-textPrimary font-bold text-lg">Audio call</div>
              <div className="text-textMuted text-sm mt-1">
                {status === 'connected' ? 'Connected' : status === 'connecting' ? 'Connecting…' : status === 'ended' ? 'Ended' : 'Ready'}
              </div>
              <div className="text-textCaption text-[11px] mt-2">
                {role === 'admin' ? 'Admin side' : 'Client side'}
              </div>
            </div>

            {/* Screen preview for admin */}
            {role === 'admin' && (
              <div className="mt-5 rounded-2xl bg-black/20 border border-border overflow-hidden">
                <div className="px-3 py-2 text-[11px] text-textMuted hairline-bottom bg-surface/50">
                  Screen share (if enabled by client)
                </div>
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="w-full max-h-72 object-contain bg-black/40"
                  controls={false}
                  muted
                />
              </div>
            )}

            {!micGranted && (
              <div className="mt-5 rounded-2xl bg-surface/60 border border-border px-4 py-3">
                <div className="text-sm font-semibold text-textPrimary">Enable microphone</div>
                <div className="text-[11px] text-textMuted mt-1 leading-relaxed">
                  Tap the button below to allow microphone access. Some browsers (especially in-app WebViews) block mic without a user tap.
                </div>
                <button
                  type="button"
                  onClick={requestMic}
                  disabled={micRequesting}
                  className="mt-3 w-full min-h-[48px] rounded-2xl bg-neon text-black font-bold disabled:opacity-60 disabled:pointer-events-none"
                >
                  {micRequesting ? 'Requesting…' : 'Start call'}
                </button>
                <div className="text-[10px] text-textCaption mt-2 leading-relaxed">
                  If it still fails: open this link in Safari/Chrome and make sure it’s HTTPS.
                </div>
              </div>
            )}

            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  Haptic.tap();
                  toggleMic();
                }}
                disabled={!micGranted}
                className="touch-target h-12 w-12 rounded-2xl bg-surface/60 border border-border flex items-center justify-center text-textPrimary active:scale-95 transition-transform"
                aria-label="Toggle mic"
              >
                {micEnabled ? <Mic size={20} /> : <MicOff size={20} className="text-textMuted" />}
              </button>

              {role === 'user' && (
                <button
                  type="button"
                  onClick={() => {
                    if (sharing) stopShare().catch(() => {});
                    else startShare().catch(() => {});
                  }}
                  disabled={!micGranted || shareRequesting}
                  className="touch-target h-12 w-12 rounded-2xl bg-surface/60 border border-border flex items-center justify-center text-textPrimary active:scale-95 transition-transform disabled:opacity-60 disabled:pointer-events-none"
                  aria-label="Share screen"
                  title="Share screen"
                >
                  {sharing ? <MonitorOff size={20} className="text-textMuted" /> : <MonitorUp size={20} />}
                </button>
              )}

              <button
                type="button"
                onClick={hangup}
                className="touch-target h-12 px-5 rounded-2xl bg-red-500 text-white font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform"
                aria-label="Hang up"
              >
                <PhoneOff size={18} />
                Hang up
              </button>
            </div>

            <div className="mt-5 text-[11px] text-textMuted leading-relaxed">
              If the call doesn’t connect for some users, add a TURN server (NAT restrictions).
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

