import React, { useEffect, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Send,
  Loader2,
  Headphones,
  Inbox,
  ChevronDown,
  ImagePlus,
  X,
  Wallet,
  ArrowDownToLine,
  LogIn,
  ShieldCheck,
  RefreshCw,
  MoreHorizontal,
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import { useUser } from '../context/UserContext';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';
import { Haptic } from '../utils/haptics';

interface SupportPageProps {
  onBack: () => void;
}

interface SupportMessage {
  id: string;
  thread_id: string;
  author: 'user' | 'agent';
  text: string;
  created_at: string;
  image_url?: string | null;
}

const SUPPORT_ATTACHMENTS_BUCKET = 'support-attachments';
const MAX_SUPPORT_FILE_BYTES = 25 * 1024 * 1024;
const ALLOWED_SUPPORT_FILE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'video/mp4',
  'video/webm',
  'video/quicktime', // mov
] as const;

function uuidLike(): string {
  // crypto.randomUUID is not available in some WebViews / older Safari
  const c = (typeof globalThis !== 'undefined' ? (globalThis as any).crypto : undefined) as Crypto | undefined;
  const rndUUID = (c as any)?.randomUUID as (() => string) | undefined;
  if (typeof rndUUID === 'function') return rndUUID.call(c);

  const getRandomValues = (c as any)?.getRandomValues as ((arr: Uint8Array) => Uint8Array) | undefined;
  const buf = new Uint8Array(16);
  if (typeof getRandomValues === 'function') getRandomValues.call(c, buf);
  else for (let i = 0; i < buf.length; i += 1) buf[i] = Math.floor(Math.random() * 256);

  // RFC4122-ish v4
  buf[6] = (buf[6] & 0x0f) | 0x40;
  buf[8] = (buf[8] & 0x3f) | 0x80;
  const hex = Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function mergeMessagesById(prev: SupportMessage[], incoming: SupportMessage[]): SupportMessage[] {
  if (!incoming.length) return prev;
  const map = new Map<string, SupportMessage>();
  for (const m of prev) map.set(m.id, m);
  for (const m of incoming) map.set(m.id, m);
  return Array.from(map.values()).sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
}

function isPdfUrl(url: string): boolean {
  const u = (url || '').toLowerCase();
  return u.endsWith('.pdf') || u.includes('.pdf?');
}
function isVideoUrl(url: string): boolean {
  const u = (url || '').toLowerCase();
  return (
    u.endsWith('.mp4') ||
    u.includes('.mp4?') ||
    u.endsWith('.mov') ||
    u.includes('.mov?') ||
    u.endsWith('.webm') ||
    u.includes('.webm?')
  );
}

function niceFileNameFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const last = u.pathname.split('/').filter(Boolean).pop() || '';
    return decodeURIComponent(last).slice(0, 48) || 'attachment';
  } catch {
    return 'attachment';
  }
}

function validateSupportAttachment(file: File): string | null {
  if (!file.type) return 'support_val_image_mime';
  if (!ALLOWED_SUPPORT_FILE_TYPES.includes(file.type as (typeof ALLOWED_SUPPORT_FILE_TYPES)[number])) {
    return 'support_val_image_type';
  }
  if (file.size > MAX_SUPPORT_FILE_BYTES) return 'support_val_image_size';
  return null;
}

async function uploadSupportAttachment(threadId: string, file: File): Promise<string | null> {
  const ext = (() => {
    if (file.type === 'image/png') return 'png';
    if (file.type === 'image/webp') return 'webp';
    if (file.type === 'image/gif') return 'gif';
    if (file.type === 'application/pdf') return 'pdf';
    if (file.type === 'video/webm') return 'webm';
    if (file.type === 'video/quicktime') return 'mov';
    if (file.type === 'video/mp4') return 'mp4';
    return 'jpg';
  })();
  const path = `${threadId}/${uuidLike()}.${ext}`;
  const { error } = await supabase.storage.from(SUPPORT_ATTACHMENTS_BUCKET).upload(path, file, {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  });
  if (error) {
    console.warn('[Support] Storage upload failed:', error);
    return null;
  }
  const { data } = supabase.storage.from(SUPPORT_ATTACHMENTS_BUCKET).getPublicUrl(path);
  return data?.publicUrl ?? null;
}

function extractCallLink(text: string): string | null {
  const t = text || '';
  const pathLink = t.match(/https?:\/\/[^\s]+\/call\/[0-9a-fA-F-]{16,}[^\s]*/);
  if (pathLink?.[0]) return pathLink[0];
  // Query-string invites (SPA-friendly): https://site/?call=uuid&role=...
  return t.match(/https?:\/\/[^\s]+\?[^\s]*call=[0-9a-fA-F-]{16,}[^\s]*/)?.[0] ?? null;
}

const CallInviteCard: React.FC<{ url: string }> = ({ url }) => {
  return (
    <a
      href={url}
      className="mt-2 block rounded-2xl bg-neon/10 border border-neon/25 hover:border-neon/45 transition-colors px-3.5 py-3"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-bold text-textPrimary">📞 Voice call</div>
          <div className="text-[11px] text-textMuted mt-0.5 truncate">Tap to join</div>
        </div>
        <div className="shrink-0 h-9 px-3 rounded-xl bg-neon text-black text-xs font-bold flex items-center justify-center">
          Join
        </div>
      </div>
    </a>
  );
};

const AttachmentCard: React.FC<{ url: string }> = ({ url }) => {
  const name = niceFileNameFromUrl(url);
  if (isVideoUrl(url)) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 block rounded-xl overflow-hidden border border-border bg-black/20"
      >
        <video src={url} controls playsInline className="w-full max-h-64 object-contain bg-black/40" />
        <div className="px-3 py-2 hairline-top text-[11px] font-mono text-textMuted truncate">{name}</div>
      </a>
    );
  }
  if (isPdfUrl(url)) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 flex items-center gap-3 rounded-xl border border-border bg-surface/60 px-3 py-2.5 hover:border-neon/35 transition-colors"
      >
        <div className="h-10 w-10 rounded-xl bg-card/60 border border-border flex items-center justify-center text-textMuted font-bold text-xs">
          PDF
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs text-textPrimary font-semibold truncate">{name}</div>
          <div className="text-[10px] text-textMuted mt-0.5">Открыть документ</div>
        </div>
      </a>
    );
  }
  // default: image
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2 block rounded-xl overflow-hidden border border-border bg-black/20"
    >
      <img src={url} alt="" className="max-h-64 w-full object-contain" loading="lazy" />
    </a>
  );
};

const QUICK_TOPICS: { id: string; labelKey: string; Icon: LucideIcon }[] = [
  { id: 'deposit', labelKey: 'support_topic_deposit', Icon: Wallet },
  { id: 'withdraw', labelKey: 'support_topic_withdraw', Icon: ArrowDownToLine },
  { id: 'login', labelKey: 'support_topic_login', Icon: LogIn },
  { id: 'kyc', labelKey: 'support_topic_kyc', Icon: ShieldCheck },
  { id: 'p2p', labelKey: 'support_topic_p2p', Icon: RefreshCw },
  { id: 'other', labelKey: 'support_topic_other', Icon: MoreHorizontal },
];

const SupportPage: React.FC<SupportPageProps> = ({ onBack }) => {
  const { user, tgid } = useUser();
  const { t } = useLanguage();
  const toast = useToast();
  const isMiniApp =
    typeof window !== 'undefined' && !!(window as any).Telegram?.WebApp && !!(window as any).Telegram?.WebApp?.initData;

  const [threadId, setThreadId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [realtimeOk, setRealtimeOk] = useState(true);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [guestEmail, setGuestEmail] = useState('');
  const [guestName, setGuestName] = useState('');
  const [guestStarted, setGuestStarted] = useState(false);
  const [showQuickHelp, setShowQuickHelp] = useState(true);
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const userDisplayName =
    user?.full_name || user?.username || user?.email || (tgid ? `TG ${tgid}` : guestName || t('guest'));

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }, [messages.length]);

  useEffect(() => {
    if (!pendingImage) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(pendingImage);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pendingImage]);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const init = async () => {
      setLoading(true);
      try {
        if (user) {
          await initLoggedInUser();
        } else if (guestEmail.trim() && guestName.trim()) {
          await initGuestThread();
        } else {
          setLoading(false);
          return;
        }
      } finally {
        setLoading(false);
      }
    };

    const initLoggedInUser = async () => {
      if (!user) return;
      const { data: threads, error } = await supabase
        .from('support_threads')
        .select('id')
        .eq('user_id', user.user_id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) return;

      let currentThreadId: string | null = threads?.[0]?.id ?? null;

      if (!currentThreadId) {
        const { data: inserted, error: insertErr } = await supabase
          .from('support_threads')
          .insert({
            user_id: user.user_id,
            tgid: tgid ?? null,
            email: user.email ?? null,
            display_name: userDisplayName,
            referrer_id: user.referrer_id ?? null,
            status: 'open',
            source: 'web',
            last_message_text: null,
          })
          .select('id')
          .single();

        if (insertErr || !inserted) return;
        currentThreadId = inserted.id as string;
      }

      setThreadId(currentThreadId);
      await loadMessages(currentThreadId);
      subscribeToMessages(currentThreadId);
    };

    const initGuestThread = async () => {
      const email = guestEmail.trim().toLowerCase();
      const name = guestName.trim() || t('guest');

      const { data: existing } = await supabase
        .from('support_threads')
        .select('id')
        .eq('email', email)
        .is('user_id', null)
        .order('created_at', { ascending: false })
        .limit(1);

      let currentThreadId: string | null = existing?.[0]?.id ?? null;

      if (!currentThreadId) {
        const { data: inserted, error: insertErr } = await supabase
          .from('support_threads')
          .insert({
            user_id: null,
            email,
            display_name: name,
            status: 'open',
            source: 'web',
            last_message_text: null,
          })
          .select('id')
          .single();

        if (insertErr || !inserted) return;
        currentThreadId = inserted.id as string;
      }

      setThreadId(currentThreadId);
      await loadMessages(currentThreadId);
      subscribeToMessages(currentThreadId);
    };

    const loadMessages = async (tid: string) => {
      const { data: msgs, error: msgsErr } = await supabase
        .from('support_messages')
        .select('id,thread_id,author,text,created_at,image_url')
        .eq('thread_id', tid)
        .order('created_at', { ascending: true });

      if (!msgsErr && msgs) {
        setMessages((prev) => mergeMessagesById(prev, msgs as SupportMessage[]));
      }
    };

    const subscribeToMessages = (tid: string) => {
      channel = supabase
        .channel(`support_thread:${tid}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'support_messages',
            filter: `thread_id=eq.${tid}`,
          },
          (payload) => {
            const row = payload.new as SupportMessage;
            setMessages((prev) => {
              if (prev.find((m) => m.id === row.id)) return prev;
              return [...prev, row].sort(
                (a, b) =>
                  new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
              );
            });
          },
        )
        .subscribe((status) => {
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            // Avoid console spam on flaky mobile networks; polling fallback will keep chat working.
            if (realtimeOk) console.warn('[Support] Realtime subscription issue:', status);
            setRealtimeOk(false);
            // Fallback: try resubscribe once after a short delay
            window.setTimeout(() => {
              try {
                if (channel) supabase.removeChannel(channel);
              } catch {}
              subscribeToMessages(tid);
            }, 1200);
          } else if (status === 'SUBSCRIBED') {
            setRealtimeOk(true);
          }
        });
    };

    init();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- инициализация треда только при смене идентификаторов
  }, [user?.user_id, tgid, user?.email, guestEmail, guestName]);

  useEffect(() => {
    if (!threadId) return;
    // Если realtime не работает — ускоряем поллинг, чтобы чат оставался живым.
    const load = () =>
      supabase
        .from('support_messages')
        .select('id,thread_id,author,text,created_at,image_url')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true })
        .then(({ data, error }) => {
          if (!error && data) setMessages((prev) => mergeMessagesById(prev, data as SupportMessage[]));
        });
    const interval = window.setInterval(load, realtimeOk ? 20000 : 3000);
    return () => window.clearInterval(interval);
  }, [threadId, realtimeOk]);

  useEffect(() => {
    // На мобильных при открытии клавиатуры браузер может "прыгать".
    // Делаем мягкий скролл к низу после фокуса, когда visualViewport уже пересчитался.
    const onFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.tagName.toLowerCase() !== 'textarea') return;
      window.setTimeout(() => {
        const el = listRef.current;
        if (!el) return;
        el.scrollTop = el.scrollHeight;
      }, 120);
    };
    document.addEventListener('focusin', onFocusIn);
    return () => document.removeEventListener('focusin', onFocusIn);
  }, []);

  const supportThreadMeta = () => ({
    threadId: threadId!,
    displayName: userDisplayName,
    email: (user?.email ?? guestEmail.trim()) || null,
    tgid: tgid ?? null,
    userId: user?.user_id ?? null,
    referrerId: user?.referrer_id ?? null,
  });

  const handleSend = async (text?: string) => {
    if (sending || !threadId) return;

    if (pendingImage) {
      const caption = (text ?? input).trim() || t('support_chat_screenshot_default');
      if (user) await sendAsUserImage(pendingImage, caption);
      else await sendAsGuestImage(pendingImage, caption);
      return;
    }

    const content = (text ?? input).trim();
    if (!content) return;

    if (user) {
      await sendAsUser(content);
    } else {
      if (!guestEmail.trim() || !guestName.trim()) {
        toast.show(t('support_toast_guest_fields'), 'error');
        return;
      }
      if (!threadId) {
        toast.show(t('support_toast_wait_thread'), 'error');
        return;
      }
      await sendAsGuest(content);
    }
  };

  const sendAsUser = async (content: string) => {
    if (!threadId || !user) return;
    setSending(true);
    Haptic.tap();
    try {
      const { data, error } = await supabase
        .from('support_messages')
        .insert({
          thread_id: threadId,
          user_id: user.user_id,
          author: 'user',
          text: content,
          source: isMiniApp ? 'mini_app' : 'web',
        })
        .select('id,thread_id,author,text,created_at,image_url')
        .single();

      if (error || !data) {
        toast.show(t('support_toast_send_failed'), 'error');
        return;
      }

      setMessages((prev) => mergeMessagesById(prev, [data as SupportMessage]));
      setInput('');

      await supabase
        .from('support_threads')
        .update({
          last_message_text: content,
          last_message_at: new Date().toISOString(),
        })
        .eq('id', threadId);
    } finally {
      setSending(false);
    }
  };

  const sendAsUserImage = async (file: File, caption: string) => {
    if (!threadId || !user) return;
    setSending(true);
    Haptic.tap();
    try {
      const imageUrl = await uploadSupportAttachment(threadId, file);
      const { data, error } = await supabase
        .from('support_messages')
        .insert({
          thread_id: threadId,
          user_id: user.user_id,
          author: 'user',
          text: caption,
          source: isMiniApp ? 'mini_app' : 'web',
          image_url: imageUrl,
        })
        .select('id,thread_id,author,text,created_at,image_url')
        .single();

      if (error || !data) {
        toast.show(
          imageUrl ? t('support_toast_save_failed') : t('support_toast_upload_failed'),
          'error',
        );
        return;
      }

      setMessages((prev) => mergeMessagesById(prev, [data as SupportMessage]));
      setInput('');
      setPendingImage(null);

      await supabase
        .from('support_threads')
        .update({
          last_message_text: caption,
          last_message_at: new Date().toISOString(),
        })
        .eq('id', threadId);
    } finally {
      setSending(false);
    }
  };

  const sendAsGuest = async (content: string) => {
    if (!threadId) return;
    setSending(true);
    Haptic.tap();
    try {
      const { data, error } = await supabase
        .from('support_messages')
        .insert({
          thread_id: threadId,
          author: 'user',
          text: content,
          source: 'web',
        })
        .select('id,thread_id,author,text,created_at,image_url')
        .single();

      if (error || !data) {
        toast.show(t('support_toast_send_failed'), 'error');
        return;
      }

      setMessages((prev) => mergeMessagesById(prev, [data as SupportMessage]));
      setInput('');

      await supabase
        .from('support_threads')
        .update({
          last_message_text: content,
          last_message_at: new Date().toISOString(),
        })
        .eq('id', threadId);
    } finally {
      setSending(false);
    }
  };

  const sendAsGuestImage = async (file: File, caption: string) => {
    if (!threadId) return;
    setSending(true);
    Haptic.tap();
    try {
      const imageUrl = await uploadSupportAttachment(threadId, file);
      const { data, error } = await supabase
        .from('support_messages')
        .insert({
          thread_id: threadId,
          author: 'user',
          text: caption,
          source: 'web',
          image_url: imageUrl,
        })
        .select('id,thread_id,author,text,created_at,image_url')
        .single();

      if (error || !data) {
        toast.show(
          imageUrl ? t('support_toast_save_failed') : t('support_toast_upload_failed'),
          'error',
        );
        return;
      }

      setMessages((prev) => mergeMessagesById(prev, [data as SupportMessage]));
      setInput('');
      setPendingImage(null);

      await supabase
        .from('support_threads')
        .update({
          last_message_text: caption,
          last_message_at: new Date().toISOString(),
        })
        .eq('id', threadId);
    } finally {
      setSending(false);
    }
  };

  const handleQuick = (labelKey: string) => {
    const text = t(labelKey);
    setInput(text);
    setShowQuickHelp(false);
    inputRef.current?.focus();
    handleSend(text);
  };

  const handleGuestStart = () => {
    const email = guestEmail.trim().toLowerCase();
    const name = guestName.trim();
    if (!email || !name) {
      toast.show(t('support_toast_guest_required'), 'error');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.show(t('support_toast_invalid_email'), 'error');
      return;
    }
    setGuestEmail(email);
    setGuestName(name);
    setGuestStarted(true);
    setThreadId(null);
    setMessages([]);
  };

  if (!user && !guestStarted) {
    return (
      <div className="flex flex-col h-full min-h-0 bg-background animate-fade-in max-w-2xl lg:max-w-4xl mx-auto">
        <PageHeader title={t('support_chat_title')} onBack={onBack} />
        <div className="flex-1 flex flex-col px-4 py-6 overflow-y-auto">
          <div className="rounded-2xl bg-card overflow-hidden shadow-[0_8px_40px_rgba(0,0,0,0.2)] ring-1 ring-inset ring-white/[0.06]">
            <div className="px-4 py-3 bg-surface/60 hairline-bottom">
              <p className="text-xs font-semibold text-textSecondary tracking-tight">
                {t('support_chat_guest_title')}
              </p>
            </div>
            <div className="p-5 space-y-5">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-card border border-border flex items-center justify-center text-neon shrink-0">
                  <Headphones size={20} strokeWidth={2} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-textPrimary">{t('support_chat_guest_title')}</h3>
                  <p className="text-xs text-textMuted mt-0.5 leading-snug">{t('support_chat_guest_desc')}</p>
                </div>
              </div>

              <div className="space-y-3">
                <input
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  placeholder={t('support_chat_email_ph')}
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                  className="w-full min-h-[52px] bg-card border border-border/80 rounded-2xl px-4 py-3.5 text-base text-textPrimary placeholder:text-textMuted outline-none focus-visible:ring-2 focus-visible:ring-neon/25 focus-visible:border-neon/40 transition-shadow"
                />
                <input
                  type="text"
                  autoComplete="name"
                  placeholder={t('support_chat_name_ph')}
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  className="w-full min-h-[52px] bg-card border border-border/80 rounded-2xl px-4 py-3.5 text-base text-textPrimary placeholder:text-textMuted outline-none focus-visible:ring-2 focus-visible:ring-neon/25 focus-visible:border-neon/40 transition-shadow"
                />
                <button
                  type="button"
                  onClick={handleGuestStart}
                  className="w-full touch-target min-h-[52px] py-3.5 rounded-2xl bg-neon text-black font-semibold text-base active:scale-[0.99] transition-transform hover:opacity-95"
                >
                  {t('support_chat_start')}
                </button>
              </div>

              <p className="text-xs text-textCaption text-center leading-relaxed hairline-top pt-4">
                {t('support_chat_guest_hint')}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0 bg-background animate-fade-in max-w-md mx-auto">
      <PageHeader title={t('support_chat_title')} onBack={onBack} />

      <div className="flex-1 flex flex-col min-h-0">
        <header className="shrink-0 px-4 py-2.5 hairline-bottom bg-background">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-surface flex items-center justify-center text-neon shrink-0">
              <Headphones size={16} strokeWidth={2} />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-xs font-semibold text-textPrimary tracking-tight leading-tight">
                {t('support_chat_team')}
              </h2>
              <p className="text-[11px] text-textMuted mt-0.5 leading-snug line-clamp-2">
                {t('support_chat_subtitle')}
              </p>
            </div>
          </div>
        </header>

        <div
          ref={listRef}
          className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-4 py-3 space-y-2 bg-background"
          style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
        >
          {loading && (
            <div className="flex justify-center items-center gap-2 py-10 text-textMuted">
              <Loader2 size={18} className="animate-spin shrink-0" />
              <span className="text-sm">{t('support_chat_connecting')}</span>
            </div>
          )}

          {!loading && messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center px-2">
              <div className="h-14 w-14 rounded-xl bg-card border border-border flex items-center justify-center mb-3">
                <Inbox size={26} className="text-textMuted" strokeWidth={1.75} />
              </div>
              <p className="text-sm font-medium text-textPrimary">{t('support_chat_empty')}</p>
              <p className="text-xs text-textMuted mt-1.5 max-w-xs leading-relaxed">{t('support_chat_empty_hint')}</p>
            </div>
          )}

          {messages.map((m) => {
            const isUser = m.author === 'user';
            const callLink = extractCallLink(m.text);
            return (
              <div key={m.id} className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[90%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    isUser
                      ? 'bg-neon/10 text-textPrimary border border-neon/25 shadow-sm'
                      : 'bg-card/45 text-textPrimary border border-border shadow-sm'
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{m.text}</p>
                  {callLink ? <CallInviteCard url={callLink} /> : null}
                  {m.image_url ? <AttachmentCard url={m.image_url} /> : null}
                  <p className="mt-2 text-[10px] font-mono tabular-nums text-textMuted">
                    {new Date(m.created_at).toLocaleTimeString(undefined, {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="shrink-0 px-4 pt-2 pb-2 pb-safe hairline-top bg-background space-y-2">
          {showQuickHelp && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-textSecondary tracking-tight">
                {t('support_chat_quick_topics')}
              </span>
              <button
                type="button"
                onClick={() => setShowQuickHelp(false)}
                className="text-[10px] text-textMuted hover:text-textSecondary flex items-center gap-0.5"
              >
                {t('support_chat_hide_topics')}
                <ChevronDown size={12} className="rotate-180" />
              </button>
            </div>
          )}
          {showQuickHelp && (
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-0.5 -mx-1 px-1">
              {QUICK_TOPICS.map(({ id, labelKey, Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => handleQuick(labelKey)}
                  className="touch-target flex items-center gap-2 px-3 py-2 rounded-xl bg-surface border border-border text-left hover:border-neon/35 active:scale-[0.99] transition-all flex-shrink-0 min-h-[44px]"
                >
                  <Icon size={16} className="text-neon shrink-0" strokeWidth={2} />
                  <span className="text-xs font-medium text-textSecondary whitespace-nowrap max-w-[200px] truncate">
                    {t(labelKey)}
                  </span>
                </button>
              ))}
            </div>
          )}
          {!showQuickHelp && (
            <button
              type="button"
              onClick={() => setShowQuickHelp(true)}
              className="text-[10px] text-textMuted hover:text-textSecondary flex items-center gap-1"
            >
              <ChevronDown size={12} />
              {t('support_chat_show_topics')}
            </button>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,video/mp4,video/webm,video/quicktime"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file) return;
              const errKey = validateSupportAttachment(file);
              if (errKey) {
                toast.show(t(errKey), 'error');
                return;
              }
              Haptic.tap();
              setPendingImage(file);
            }}
          />

          {pendingImage && (
            <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-2.5 py-2">
              {pendingImage.type.startsWith('image/') && previewUrl ? (
                <img
                  src={previewUrl}
                  alt=""
                  className="h-12 w-12 rounded-lg object-cover shrink-0 border border-border"
                />
              ) : pendingImage.type.startsWith('video/') && previewUrl ? (
                <video
                  src={previewUrl}
                  className="h-12 w-12 rounded-lg object-cover shrink-0 border border-border"
                  muted
                />
              ) : (
                <div className="h-12 w-12 rounded-lg bg-card/60 border border-border flex items-center justify-center shrink-0 text-textMuted text-xs font-bold">
                  {pendingImage.type === 'application/pdf' ? 'PDF' : 'FILE'}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-textSecondary truncate font-mono">{pendingImage.name}</p>
                <p className="text-[10px] text-textMuted mt-0.5 leading-snug">{t('support_chat_preview_note')}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  Haptic.tap();
                  setPendingImage(null);
                }}
                className="touch-target p-2 rounded-lg border border-border text-textMuted hover:text-textPrimary shrink-0"
                aria-label={t('support_chat_remove_file')}
              >
                <X size={18} />
              </button>
            </div>
          )}

          <div className="flex gap-2 items-end">
            <button
              type="button"
              onClick={() => {
                Haptic.tap();
                fileInputRef.current?.click();
              }}
              disabled={!threadId || sending}
              className="touch-target h-10 w-10 rounded-xl border border-border/80 bg-card flex items-center justify-center text-textMuted hover:text-neon hover:border-neon/35 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98] transition-all shrink-0"
              title={t('support_chat_attach')}
              aria-label={t('support_chat_attach')}
            >
              <ImagePlus size={18} strokeWidth={2} />
            </button>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onInput={(e) => {
                const el = e.currentTarget;
                el.style.height = 'auto';
                el.style.height = `${Math.min(el.scrollHeight, 96)}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              rows={1}
              enterKeyHint="send"
              autoComplete="off"
              placeholder={t('support_chat_placeholder')}
              aria-label={t('support_chat_input_aria')}
              className="flex-1 resize-none bg-card border border-border/80 rounded-xl px-3 py-2 text-sm text-textPrimary placeholder:text-textMuted outline-none focus-visible:ring-2 focus-visible:ring-neon/25 focus-visible:border-neon/40 min-h-[40px] max-h-[96px] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] leading-snug"
            />
            <button
              type="button"
              onClick={() => handleSend()}
              disabled={sending || !threadId || (!input.trim() && !pendingImage)}
              className="touch-target h-10 w-10 rounded-xl bg-neon flex items-center justify-center text-black disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98] transition-transform shrink-0"
              title={t('support_chat_send')}
              aria-label={t('support_chat_send')}
            >
              {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} strokeWidth={2} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SupportPage;
