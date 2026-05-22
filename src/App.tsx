import { useState, useRef, useEffect, useCallback } from 'react';

// ── TYPES ──────────────────────────────────────────────────────────────────
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  displayContent: string;
  timestamp: Date;
  liked: boolean;
  disliked: boolean;
  copied: boolean;
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
}

// ── GEMINI CONFIG ──────────────────────────────────────────────────────────
const API_KEY    = import.meta.env.VITE_GEMINI_API_KEY;
const MODEL      = import.meta.env.VITE_GEMINI_MODEL || 'gemini-2.0-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;

async function getGeminiResponse(messages: Message[]): Promise<string> {
  const history = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));
  const res = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: history }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err?.error?.message || `Request failed (${res.status})`);
  }
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? 'No response received.';
}

// ── HELPERS ────────────────────────────────────────────────────────────────
function generateId() { return Math.random().toString(36).slice(2, 9); }

const MODEL_DISPLAY = (import.meta.env.VITE_GEMINI_MODEL || 'gemini-2.0-flash');

const SUGGESTIONS = [
  { icon: '✨', text: 'Tell me something amazing about the universe', label: 'Fun fact' },
  { icon: '💡', text: 'Give me a creative business idea for 2025', label: 'Brainstorm' },
  { icon: '📝', text: 'Help me write a short story about adventure', label: 'Creative' },
  { icon: '🔧', text: 'Explain how REST APIs work simply', label: 'Technical' },
];

// ── APP ────────────────────────────────────────────────────────────────────
export default function App() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId]           = useState<string | null>(null);
  const [isTyping, setIsTyping]           = useState(false);
  const [streaming, setStreaming]         = useState(false);
  const [sidebarOpen, setSidebarOpen]     = useState(true);
  const [isMobile, setIsMobile]           = useState(false);
  const [apiError, setApiError]           = useState('');
  const [input, setInput]                 = useState('');
  const [clearConfirm, setClearConfirm]   = useState(false);
  const [searchQuery, setSearchQuery]     = useState('');
  const [showSearch, setShowSearch]       = useState(false);
  const [shareToast, setShareToast]       = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef    = useRef<HTMLTextAreaElement>(null);
  const streamRef      = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRef      = useRef<HTMLInputElement>(null);

  const activeConv = conversations.find(c => c.id === activeId) ?? null;

  // Filter conversations by search
  const filteredConvs = searchQuery.trim()
    ? conversations.filter(c => c.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : conversations;

  useEffect(() => {
    const check = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      setSidebarOpen(!mobile);
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConv?.messages, isTyping]);

  // Focus search input when shown
  useEffect(() => {
    if (showSearch) searchRef.current?.focus();
  }, [showSearch]);

  const streamText = useCallback((fullText: string, msgId: string, convId: string) => {
    setStreaming(true);
    let i = 0;
    const tick = () => {
      i += Math.floor(Math.random() * 4) + 2;
      const chunk = fullText.slice(0, Math.min(i, fullText.length));
      setConversations(prev =>
        prev.map(c => c.id === convId
          ? { ...c, messages: c.messages.map(m => m.id === msgId ? { ...m, displayContent: chunk } : m) }
          : c)
      );
      if (i < fullText.length) {
        streamRef.current = setTimeout(tick, 12 + Math.random() * 10);
      } else {
        setStreaming(false);
      }
    };
    tick();
  }, []);

  const handleSend = async (content: string) => {
    const trimmed = content.trim();
    if (!trimmed || isTyping || streaming) return;

    const userMsg: Message = {
      id: generateId(), role: 'user',
      content: trimmed, displayContent: trimmed,
      timestamp: new Date(), liked: false, disliked: false, copied: false,
    };

    let convId = activeId;
    let updatedMessages: Message[] = [];

    if (!convId) {
      const newConv: Conversation = {
        id: generateId(),
        title: trimmed.slice(0, 38) + (trimmed.length > 38 ? '…' : ''),
        messages: [userMsg], createdAt: new Date(),
      };
      setConversations(prev => [newConv, ...prev]);
      setActiveId(newConv.id);
      convId = newConv.id;
      updatedMessages = [userMsg];
    } else {
      setConversations(prev =>
        prev.map(c => c.id === convId ? { ...c, messages: [...c.messages, userMsg] } : c)
      );
      updatedMessages = [...(activeConv?.messages ?? []), userMsg];
    }

    setInput('');
    setApiError('');
    setIsTyping(true);
    if (isMobile) setSidebarOpen(false);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    try {
      const reply = await getGeminiResponse(updatedMessages);
      const botId = generateId();
      const botMsg: Message = {
        id: botId, role: 'assistant',
        content: reply, displayContent: '',
        timestamp: new Date(), liked: false, disliked: false, copied: false,
      };
      setIsTyping(false);
      setConversations(prev =>
        prev.map(c => c.id === convId ? { ...c, messages: [...c.messages, botMsg] } : c)
      );
      streamText(reply, botId, convId!);
    } catch (err: unknown) {
      setIsTyping(false);
      setApiError(err instanceof Error ? err.message : 'Something went wrong.');
    }
  };

  // ── Regenerate last bot message ──
  const handleRegenerate = async (msgId: string) => {
    if (!activeConv || isTyping || streaming) return;
    const msgIndex = activeConv.messages.findIndex(m => m.id === msgId);
    if (msgIndex === -1) return;

    // Get all messages up to (but not including) this bot message
    const contextMessages = activeConv.messages.slice(0, msgIndex);
    if (contextMessages.length === 0) return;

    // Remove the old bot message and regenerate
    setConversations(prev =>
      prev.map(c => c.id === activeId
        ? { ...c, messages: c.messages.slice(0, msgIndex) }
        : c)
    );

    setApiError('');
    setIsTyping(true);

    try {
      const reply = await getGeminiResponse(contextMessages);
      const botId = generateId();
      const botMsg: Message = {
        id: botId, role: 'assistant',
        content: reply, displayContent: '',
        timestamp: new Date(), liked: false, disliked: false, copied: false,
      };
      setIsTyping(false);
      setConversations(prev =>
        prev.map(c => c.id === activeId ? { ...c, messages: [...c.messages, botMsg] } : c)
      );
      streamText(reply, botId, activeId!);
    } catch (err: unknown) {
      setIsTyping(false);
      setApiError(err instanceof Error ? err.message : 'Something went wrong.');
    }
  };

  const toggleLike = (msgId: string) => {
    setConversations(prev =>
      prev.map(c => c.id === activeId
        ? { ...c, messages: c.messages.map(m =>
            m.id === msgId ? { ...m, liked: !m.liked, disliked: false } : m
          )}
        : c)
    );
  };

  const toggleDislike = (msgId: string) => {
    setConversations(prev =>
      prev.map(c => c.id === activeId
        ? { ...c, messages: c.messages.map(m =>
            m.id === msgId ? { ...m, disliked: !m.disliked, liked: false } : m
          )}
        : c)
    );
  };

  const copyMsg = (msgId: string, text: string) => {
    navigator.clipboard.writeText(text);
    setConversations(prev =>
      prev.map(c => c.id === activeId
        ? { ...c, messages: c.messages.map(m => m.id === msgId ? { ...m, copied: true } : m) }
        : c)
    );
    setTimeout(() => {
      setConversations(prev =>
        prev.map(c => c.id === activeId
          ? { ...c, messages: c.messages.map(m => m.id === msgId ? { ...m, copied: false } : m) }
          : c)
      );
    }, 2000);
  };

  // ── Share: copy conversation as text ──
  const handleShare = () => {
    if (!activeConv) return;
    const text = activeConv.messages
      .map(m => `${m.role === 'user' ? 'You' : 'Bot'}: ${m.content}`)
      .join('\n\n');
    navigator.clipboard.writeText(text);
    setShareToast(true);
    setTimeout(() => setShareToast(false), 2500);
  };

  const clearConversation = () => {
    if (!clearConfirm) { setClearConfirm(true); setTimeout(() => setClearConfirm(false), 3000); return; }
    setConversations(prev => prev.map(c => c.id === activeId ? { ...c, messages: [] } : c));
    setClearConfirm(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(input); }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const ta = textareaRef.current;
    if (ta) { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 200) + 'px'; }
  };

  const createNew = () => {
    setActiveId(null); setApiError(''); setInput('');
    if (isMobile) setSidebarOpen(false);
  };

  const toggleSearch = () => {
    setShowSearch(s => !s);
    if (showSearch) setSearchQuery('');
  };

  const canSend = input.trim().length > 0 && !isTyping && !streaming;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --sky:           #38bdf8;
          --sky-light:     #7dd3fc;
          --sky-dark:      #0ea5e9;
          --sky-subtle:    rgba(56,189,248,0.08);
          --bg-base:       #0d0d0d;
          --bg-sidebar:    #171717;
          --bg-hover:      #212121;
          --bg-active:     #2a2a2a;
          --bg-input:      #1c1c1c;
          --bg-user-msg:   #2f2f2f;
          --border:        rgba(255,255,255,0.08);
          --border-hover:  rgba(255,255,255,0.14);
          --text-primary:  #ececec;
          --text-secondary:#8e8ea0;
          --text-muted:    #555568;
          --font-sans:     'Outfit', sans-serif;
          --font-mono:     'JetBrains Mono', monospace;
          --r-sm: 6px; --r-md: 10px; --r-lg: 18px; --r-xl: 26px;
        }

        html, body, #root { height: 100%; width: 100%; overflow: hidden; }
        body { font-family: var(--font-sans); background: var(--bg-base); color: var(--text-primary); line-height: 1.6; -webkit-font-smoothing: antialiased; }

        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 99px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.18); }

        /* ── LAYOUT ── */
        .app { display: flex; height: 100dvh; width: 100%; overflow: hidden; position: relative; }

        /* ── MOBILE OVERLAY ── */
        .sb-overlay { display: none; position: fixed; inset: 0; z-index: 99; background: rgba(0,0,0,0.5); }
        .sb-overlay.on { display: block; }

        /* ── SIDEBAR ── */
        .sidebar {
          width: 260px; height: 100%; flex-shrink: 0;
          background: var(--bg-sidebar);
          display: flex; flex-direction: column;
          transition: width 0.25s ease, transform 0.25s ease;
          overflow: hidden;
          position: relative; z-index: 100;
        }
        /* Collapsed on desktop */
        .sidebar.collapsed { width: 0; }

        @media (max-width: 768px) {
          .sidebar { position: fixed; left: 0; top: 0; bottom: 0; width: 260px; transform: translateX(-100%); }
          .sidebar.open { transform: translateX(0); box-shadow: 4px 0 20px rgba(0,0,0,0.4); }
          .sidebar.collapsed { width: 260px; transform: translateX(-100%); }
        }

        /* Sidebar top */
        .sb-top {
          display: flex; align-items: center; justify-content: space-between;
          padding: 12px 12px 8px; min-width: 260px;
        }
        .sb-icon-btn {
          width: 36px; height: 36px; border-radius: var(--r-md); border: none;
          background: transparent; color: var(--text-secondary); cursor: pointer;
          display: flex; align-items: center; justify-content: center; transition: background 0.15s;
          flex-shrink: 0;
        }
        .sb-icon-btn:hover { background: var(--bg-hover); color: var(--text-primary); }
        .sb-icon-btn.active-search { background: var(--bg-active); color: var(--sky); }

        /* Search bar in sidebar */
        .sb-search {
          padding: 0 8px 8px; min-width: 260px;
        }
        .sb-search input {
          width: 100%; padding: 8px 12px; background: var(--bg-input);
          border: 1px solid var(--border); border-radius: var(--r-md);
          color: var(--text-primary); font-family: var(--font-sans); font-size: 13px;
          outline: none; transition: border-color 0.15s;
        }
        .sb-search input:focus { border-color: var(--sky); }
        .sb-search input::placeholder { color: var(--text-muted); }

        /* New chat button */
        .new-chat-row { padding: 2px 8px 8px; min-width: 260px; }
        .new-chat-btn {
          width: 100%; display: flex; align-items: center; gap: 10px;
          padding: 9px 12px; border-radius: var(--r-md); border: none;
          background: transparent; color: var(--text-secondary);
          font-family: var(--font-sans); font-size: 13.5px; cursor: pointer;
          transition: background 0.14s; text-align: left;
        }
        .new-chat-btn:hover { background: var(--bg-hover); color: var(--text-primary); }

        /* Recents label */
        .sb-section {
          font-size: 11px; font-weight: 600; text-transform: uppercase;
          letter-spacing: 0.7px; color: var(--text-muted); padding: 10px 14px 5px;
          min-width: 260px;
        }

        /* Conversation list */
        .sb-convs { flex: 1; overflow-y: auto; padding: 2px 8px; display: flex; flex-direction: column; gap: 1px; min-width: 260px; }
        .sb-empty { color: var(--text-muted); font-size: 13px; text-align: center; padding: 24px 16px; }

        .conv-btn {
          width: 100%; display: flex; align-items: center;
          padding: 8px 12px; border-radius: var(--r-md); border: none;
          background: transparent; color: var(--text-secondary);
          font-family: var(--font-sans); font-size: 13.5px; cursor: pointer; text-align: left;
          transition: background 0.13s; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .conv-btn:hover { background: var(--bg-hover); color: var(--text-primary); }
        .conv-btn.active { background: var(--bg-active); color: var(--text-primary); }

        /* Sidebar footer */
        .sb-footer { padding: 8px; border-top: 1px solid var(--border); min-width: 260px; }
        .user-row {
          display: flex; align-items: center; gap: 10px;
          padding: 9px 12px; border-radius: var(--r-md); cursor: pointer;
          transition: background 0.13s; border: none; background: transparent; width: 100%;
        }
        .user-row:hover { background: var(--bg-hover); }
        .user-avatar {
          width: 32px; height: 32px; border-radius: 50%;
          background: linear-gradient(135deg, #7c3aed, #a855f7);
          display: flex; align-items: center; justify-content: center;
          font-size: 12px; font-weight: 700; color: white; flex-shrink: 0;
        }
        .user-detail { display: flex; flex-direction: column; text-align: left; gap: 1px; }
        .user-detail-name { font-size: 13.5px; font-weight: 500; color: var(--text-primary); }
        .upgrade-badge {
          margin-left: auto; font-size: 11px; padding: 3px 9px; border-radius: 99px;
          border: 1px solid var(--border); color: var(--text-secondary); background: transparent;
          cursor: pointer; font-family: var(--font-sans); transition: all 0.14s; flex-shrink: 0;
        }
        .upgrade-badge:hover { border-color: var(--sky); color: var(--sky); }

        /* ── MAIN ── */
        .main { flex: 1; min-width: 0; display: flex; flex-direction: column; overflow: hidden; background: var(--bg-base); }

        /* ── TOPBAR ── */
        .topbar {
          display: flex; align-items: center; gap: 10px;
          padding: 0 16px; height: 52px; flex-shrink: 0;
          border-bottom: 1px solid var(--border);
          background: var(--bg-base);
        }
        .menu-btn {
          width: 34px; height: 34px; display: flex; align-items: center; justify-content: center;
          background: transparent; border: none; border-radius: var(--r-md);
          color: var(--text-secondary); cursor: pointer; transition: background 0.14s; flex-shrink: 0;
        }
        .menu-btn:hover { background: var(--bg-hover); color: var(--text-primary); }

        .topbar-center { flex: 1; display: flex; align-items: center; justify-content: center; gap: 5px; }
        .topbar-model-name { font-size: 15px; font-weight: 600; color: var(--text-primary); }
        .topbar-chevron { color: var(--text-muted); margin-top: 1px; }

        .topbar-right { display: flex; align-items: center; gap: 6px; }
        .clear-btn {
          height: 30px; padding: 0 10px; border-radius: var(--r-md);
          border: 1px solid var(--border); background: transparent;
          color: var(--text-muted); font-family: var(--font-sans); font-size: 12px;
          cursor: pointer; display: flex; align-items: center; gap: 5px; transition: all 0.14s;
        }
        .clear-btn:hover { background: rgba(239,68,68,0.07); border-color: rgba(239,68,68,0.2); color: #f87171; }
        .clear-btn.confirm { background: rgba(239,68,68,0.08); border-color: rgba(239,68,68,0.25); color: #f87171; }

        .share-btn {
          height: 30px; padding: 0 14px; border-radius: 99px;
          border: 1px solid var(--border); background: transparent;
          color: var(--text-secondary); font-family: var(--font-sans); font-size: 12.5px;
          cursor: pointer; display: flex; align-items: center; gap: 5px; transition: all 0.14s;
        }
        .share-btn:hover { background: var(--bg-hover); color: var(--text-primary); }
        .share-btn:disabled { opacity: 0.35; cursor: not-allowed; }

        /* ── SHARE TOAST ── */
        .share-toast {
          position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);
          background: var(--bg-active); border: 1px solid var(--border);
          color: var(--text-primary); font-size: 13px; padding: 10px 18px;
          border-radius: 99px; z-index: 999; pointer-events: none;
          animation: toastIn 0.2s ease both;
          font-family: var(--font-sans);
        }
        @keyframes toastIn { from{opacity:0;transform:translateX(-50%) translateY(8px)} to{opacity:1;transform:translateX(-50%) translateY(0)} }

        /* ── CHAT AREA ── */
        .chat-area { flex: 1; overflow-y: auto; display: flex; flex-direction: column; }

        /* ── WELCOME ── */
        .welcome {
          flex: 1; display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          padding: 40px 24px; text-align: center;
          animation: fadeUp 0.4s ease both;
          max-width: 700px; margin: 0 auto; width: 100%;
        }
        @keyframes fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }

        .welcome-logo {
          width: 68px; height: 68px; margin-bottom: 18px;
          filter: drop-shadow(0 0 16px rgba(56,189,248,0.45));
          animation: float 3.5s ease-in-out infinite;
        }
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }

        .welcome-title {
          font-size: clamp(22px,4vw,30px); font-weight: 700; letter-spacing: -0.5px;
          margin-bottom: 8px;
          background: linear-gradient(135deg, #fff 20%, var(--sky-light));
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
        }
        .welcome-sub { font-size: 15px; color: var(--text-secondary); margin-bottom: 36px; max-width: 340px; line-height: 1.6; }

        .suggestions { display: grid; grid-template-columns: repeat(2,1fr); gap: 10px; width: 100%; }
        @media (max-width: 500px) { .suggestions { grid-template-columns: 1fr; } }

        .sug-card {
          display: flex; flex-direction: column; gap: 4px;
          padding: 14px 16px; background: var(--bg-sidebar); border: 1px solid var(--border);
          border-radius: var(--r-lg); cursor: pointer; text-align: left;
          transition: all 0.18s; font-family: var(--font-sans);
        }
        .sug-card:hover { background: var(--bg-hover); border-color: var(--border-hover); }
        .sug-card-top { display: flex; align-items: center; gap: 8px; }
        .sug-icon { font-size: 16px; }
        .sug-label { font-size: 12px; font-weight: 600; color: var(--text-primary); }
        .sug-text { font-size: 12px; color: var(--text-muted); line-height: 1.4; padding-left: 24px; }

        /* ── MESSAGES ── */
        .messages-wrap {
          display: flex; flex-direction: column;
          padding: 20px 0 12px;
          max-width: 740px; width: 100%; margin: 0 auto;
          padding-left: 24px; padding-right: 24px;
        }
        @media (max-width: 600px) { .messages-wrap { padding-left: 14px; padding-right: 14px; } }

        .user-msg-wrap {
          display: flex; justify-content: flex-end;
          margin-bottom: 24px;
          animation: msgIn 0.25s ease both;
        }
        .user-bubble {
          max-width: 70%; padding: 11px 16px;
          background: var(--bg-user-msg);
          color: var(--text-primary);
          border-radius: var(--r-xl);
          font-size: 15px; line-height: 1.65;
          white-space: pre-wrap; word-break: break-word;
        }
        @media (max-width: 600px) { .user-bubble { max-width: 88%; } }

        .bot-msg-wrap {
          display: flex; flex-direction: column;
          margin-bottom: 4px;
          animation: msgIn 0.25s ease both;
        }
        @keyframes msgIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }

        .bot-text {
          font-size: 15px; line-height: 1.75;
          color: var(--text-primary);
          white-space: pre-wrap; word-break: break-word;
          padding: 0;
        }
        .stream-cursor::after { content: '▋'; color: var(--sky); animation: blink 0.65s steps(1) infinite; font-size: 0.8em; margin-left: 1px; }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }

        .bot-actions {
          display: flex; align-items: center; gap: 2px;
          margin-top: 8px; opacity: 0; transition: opacity 0.15s;
        }
        .bot-msg-wrap:hover .bot-actions { opacity: 1; }
        @media (max-width: 768px) { .bot-actions { opacity: 1; } }

        .act-icon-btn {
          width: 30px; height: 30px; border-radius: var(--r-md); border: none;
          background: transparent; color: var(--text-muted); cursor: pointer;
          display: flex; align-items: center; justify-content: center; transition: all 0.13s;
        }
        .act-icon-btn:hover { background: var(--bg-hover); color: var(--text-primary); }
        .act-icon-btn.liked { color: #f472b6; }
        .act-icon-btn.disliked { color: #f87171; }
        .act-icon-btn.copied { color: var(--sky); }

        .msg-separator { height: 20px; }

        /* ── TYPING ── */
        .typing-wrap { display: flex; align-items: center; gap: 6px; padding: 4px 0; margin-bottom: 16px; }
        .typing-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--text-muted); animation: tdot 1.3s infinite; }
        .typing-dot:nth-child(2) { animation-delay: 0.18s; }
        .typing-dot:nth-child(3) { animation-delay: 0.36s; }
        @keyframes tdot { 0%,60%,100%{transform:translateY(0);opacity:0.3} 30%{transform:translateY(-5px);opacity:1} }

        /* ── ERROR ── */
        .err-bar {
          display: flex; align-items: flex-start; gap: 10px; padding: 10px 14px; margin: 8px 0 12px;
          background: rgba(239,68,68,0.06); border: 1px solid rgba(239,68,68,0.16);
          border-radius: var(--r-md); font-size: 13px; color: #fca5a5;
          font-family: var(--font-mono); line-height: 1.5;
        }
        .err-pre { color: #ef4444; font-weight: 700; flex-shrink: 0; }
        .err-x { background: none; border: none; color: #fca5a5; cursor: pointer; font-size: 1rem; padding: 0; opacity: 0.5; margin-left: auto; }
        .err-x:hover { opacity: 1; }

        /* ── INPUT ── */
        .input-area { padding: 10px 20px 18px; flex-shrink: 0; background: var(--bg-base); }
        .input-inner { max-width: 740px; margin: 0 auto; }

        .input-shell {
          display: flex; flex-direction: column;
          background: var(--bg-input); border: 1px solid var(--border);
          border-radius: var(--r-xl); overflow: hidden;
          transition: border-color 0.18s, box-shadow 0.18s;
        }
        .input-shell:focus-within { border-color: rgba(255,255,255,0.18); box-shadow: 0 0 0 1px rgba(255,255,255,0.05); }

        .input-top { display: flex; align-items: flex-end; padding: 12px 14px 8px; gap: 8px; }
        .chat-ta {
          flex: 1; background: transparent; border: none; outline: none; resize: none;
          font-family: var(--font-sans); font-size: 15px; color: var(--text-primary);
          line-height: 1.6; min-height: 26px; max-height: 200px; overflow-y: auto;
        }
        .chat-ta::placeholder { color: var(--text-muted); }
        .chat-ta:disabled { opacity: 0.4; }

        .input-bottom {
          display: flex; align-items: center; justify-content: space-between;
          padding: 6px 10px 10px;
        }
        .input-left-btns { display: flex; align-items: center; gap: 2px; }
        .input-icon-btn {
          width: 32px; height: 32px; border-radius: 50%; border: none;
          background: transparent; color: var(--text-muted); cursor: pointer;
          display: flex; align-items: center; justify-content: center; transition: all 0.14s;
        }
        .input-icon-btn:hover { background: var(--bg-hover); color: var(--text-primary); }

        .send-btn {
          width: 34px; height: 34px; border-radius: 50%; border: none; flex-shrink: 0;
          background: rgba(255,255,255,0.1); color: rgba(255,255,255,0.3);
          display: flex; align-items: center; justify-content: center; cursor: not-allowed; transition: all 0.18s;
        }
        .send-btn.ready {
          background: white; color: #0d0d0d; cursor: pointer;
          box-shadow: 0 2px 8px rgba(255,255,255,0.15);
        }
        .send-btn.ready:hover { background: #e8e8e8; transform: scale(1.05); }

        .disclaimer { font-size: 11.5px; color: var(--text-muted); text-align: center; margin-top: 6px; }
      `}</style>

      {/* Share toast */}
      {shareToast && <div className="share-toast">✓ Conversation copied to clipboard</div>}

      {/* Mobile overlay */}
      {isMobile && sidebarOpen && (
        <div className="sb-overlay on" onClick={() => setSidebarOpen(false)} />
      )}

      <div className="app">

        {/* ── SIDEBAR ── */}
        <aside className={`sidebar ${isMobile ? (sidebarOpen ? 'open' : '') : (sidebarOpen ? '' : 'collapsed')}`}>

          {/* Top icons */}
          <div className="sb-top">
            <button className="sb-icon-btn" onClick={() => setSidebarOpen(false)} title="Close sidebar">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <line x1="9" y1="3" x2="9" y2="21"/>
              </svg>
            </button>
            <div style={{ display: 'flex', gap: 4 }}>
              {/* Search toggle */}
              <button
                className={`sb-icon-btn ${showSearch ? 'active-search' : ''}`}
                onClick={toggleSearch}
                title="Search conversations"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
              </button>
              <button className="sb-icon-btn" onClick={createNew} title="New chat">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M12 5v14M5 12h14"/>
                </svg>
              </button>
            </div>
          </div>

          {/* Search bar */}
          {showSearch && (
            <div className="sb-search">
              <input
                ref={searchRef}
                type="text"
                placeholder="Search conversations…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          )}

          {/* New chat row */}
          <div className="new-chat-row">
            <button className="new-chat-btn" onClick={createNew}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              New chat
            </button>
          </div>

          {/* Recents */}
          <div className="sb-section">Recents</div>
          <nav className="sb-convs">
            {filteredConvs.length === 0 && (
              <div className="sb-empty">
                {searchQuery ? 'No results found' : 'No conversations yet'}
              </div>
            )}
            {filteredConvs.map(conv => (
              <button
                key={conv.id}
                className={`conv-btn ${activeId === conv.id ? 'active' : ''}`}
                onClick={() => { setActiveId(conv.id); if (isMobile) setSidebarOpen(false); }}
              >
                {conv.title}
              </button>
            ))}
          </nav>

          {/* Footer */}
          <div className="sb-footer">
            <button className="user-row">
              <div className="user-avatar">SS</div>
              <div className="user-detail">
                <span className="user-detail-name">shietep's Assistant</span>
              </div>
              <span className="upgrade-badge">Upgrade</span>
            </button>
          </div>
        </aside>

        {/* ── MAIN ── */}
        <div className="main">

          {/* Topbar */}
          <header className="topbar">
            {/* Toggle sidebar — works on both mobile and desktop */}
            <button className="menu-btn" onClick={() => setSidebarOpen(o => !o)} title="Toggle sidebar">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="3" y1="6" x2="21" y2="6"/>
                <line x1="3" y1="12" x2="21" y2="12"/>
                <line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>

            <div className="topbar-center">
              <span className="topbar-model-name">Chaboti</span>
              <span className="topbar-chevron">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M6 9l6 6 6-6"/>
                </svg>
              </span>
            </div>

            <div className="topbar-right">
              {activeConv && activeConv.messages.length > 0 && (
                <button className={`clear-btn ${clearConfirm ? 'confirm' : ''}`} onClick={clearConversation}>
                  {clearConfirm ? 'Sure?' : 'Clear'}
                </button>
              )}
              {/* Share button — copies conversation to clipboard */}
              <button
                className="share-btn"
                onClick={handleShare}
                disabled={!activeConv || activeConv.messages.length === 0}
                title="Copy conversation to clipboard"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
                  <polyline points="16 6 12 2 8 6"/>
                  <line x1="12" y1="2" x2="12" y2="15"/>
                </svg>
                Share
              </button>
            </div>
          </header>

          {/* Chat area */}
          <div className="chat-area">
            {!activeConv ? (
              <div className="welcome">
                <div className="welcome-logo">
                  <svg viewBox="0 0 64 64" fill="none" style={{ width:'100%', height:'100%' }}>
                    <circle cx="32" cy="32" r="28" fill="url(#wg)" />
                    <path d="M20 32C20 24 26 20 32 20C38 20 44 24 44 32C44 40 38 44 32 44C26 44 20 40 20 32Z" fill="white" opacity="0.95"/>
                    <circle cx="26" cy="30" r="4" fill="#0ea5e9"/>
                    <circle cx="38" cy="30" r="4" fill="#0ea5e9"/>
                    <circle cx="27" cy="29" r="1.6" fill="white"/>
                    <circle cx="39" cy="29" r="1.6" fill="white"/>
                    <path d="M26 37Q32 41.5 38 37" stroke="#0ea5e9" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
                    <defs>
                      <linearGradient id="wg" x1="0" y1="0" x2="64" y2="64">
                        <stop offset="0%" stopColor="#38bdf8"/>
                        <stop offset="100%" stopColor="#0369a1"/>
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
                <h1 className="welcome-title">What can I help with?</h1>
                <p className="welcome-sub">Powered by Gemini · Ask me anything</p>
                <div className="suggestions">
                  {SUGGESTIONS.map((s, i) => (
                    <button key={i} className="sug-card" onClick={() => handleSend(s.text)}>
                      <div className="sug-card-top">
                        <span className="sug-icon">{s.icon}</span>
                        <span className="sug-label">{s.label}</span>
                      </div>
                      <span className="sug-text">{s.text}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="messages-wrap">
                {activeConv.messages.map(msg => {
                  const isUser = msg.role === 'user';
                  const isStreaming = !isUser && msg.displayContent !== msg.content;

                  if (isUser) {
                    return (
                      <div key={msg.id} className="user-msg-wrap">
                        <div className="user-bubble">{msg.displayContent}</div>
                      </div>
                    );
                  }

                  return (
                    <div key={msg.id} className="bot-msg-wrap">
                      <div className={`bot-text ${isStreaming ? 'stream-cursor' : ''}`}>
                        {msg.displayContent}
                      </div>
                      <div className="bot-actions">
                        {/* Copy */}
                        <button
                          className={`act-icon-btn ${msg.copied ? 'copied' : ''}`}
                          onClick={() => copyMsg(msg.id, msg.content)}
                          title={msg.copied ? 'Copied!' : 'Copy'}
                        >
                          {msg.copied ? (
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                              <polyline points="20 6 9 17 4 12"/>
                            </svg>
                          ) : (
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                              <rect x="9" y="9" width="13" height="13" rx="2"/>
                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                            </svg>
                          )}
                        </button>
                        {/* Like */}
                        <button
                          className={`act-icon-btn ${msg.liked ? 'liked' : ''}`}
                          onClick={() => toggleLike(msg.id)}
                          title={msg.liked ? 'Unlike' : 'Like'}
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill={msg.liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/>
                            <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
                          </svg>
                        </button>
                        {/* Dislike */}
                        <button
                          className={`act-icon-btn ${msg.disliked ? 'disliked' : ''}`}
                          onClick={() => toggleDislike(msg.id)}
                          title={msg.disliked ? 'Remove dislike' : 'Dislike'}
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill={msg.disliked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z"/>
                            <path d="M17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/>
                          </svg>
                        </button>
                        {/* Regenerate */}
                        <button
                          className="act-icon-btn"
                          onClick={() => handleRegenerate(msg.id)}
                          title="Regenerate response"
                          disabled={isTyping || streaming}
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <path d="M23 4v6h-6"/>
                            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                          </svg>
                        </button>
                      </div>
                      <div className="msg-separator" />
                    </div>
                  );
                })}

                {isTyping && (
                  <div className="typing-wrap">
                    <div className="typing-dot" />
                    <div className="typing-dot" />
                    <div className="typing-dot" />
                  </div>
                )}

                {apiError && (
                  <div className="err-bar">
                    <span className="err-pre">Error</span>
                    <span>{apiError}</span>
                    <button className="err-x" onClick={() => setApiError('')}>✕</button>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* ── INPUT ── */}
          <div className="input-area">
            <div className="input-inner">
              <div className="input-shell">
                <div className="input-top">
                  <textarea
                    ref={textareaRef}
                    className="chat-ta"
                    placeholder="Ask anything"
                    value={input}
                    onChange={handleChange}
                    onKeyDown={handleKeyDown}
                    rows={1}
                    disabled={isTyping || streaming}
                  />
                </div>
                <div className="input-bottom">
                  <div className="input-left-btns">
                    <button className="input-icon-btn" title="Attach">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <line x1="12" y1="5" x2="12" y2="19"/>
                        <line x1="5" y1="12" x2="19" y2="12"/>
                      </svg>
                    </button>
                    <button className="input-icon-btn" title="More tools">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>
                      </svg>
                    </button>
                  </div>
                  <button
                    className={`send-btn ${canSend ? 'ready' : ''}`}
                    onClick={() => handleSend(input)}
                    disabled={!canSend}
                    title="Send"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 19V5M5 12l7-7 7 7"/>
                    </svg>
                  </button>
                </div>
              </div>
              <p className="disclaimer">Our Chaboti is not perfect so bear with it. Powered by Gemini {MODEL_DISPLAY}.</p>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}