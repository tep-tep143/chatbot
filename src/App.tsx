import { useState, useRef, useEffect, useCallback } from 'react';

// ── TYPES ──────────────────────────────────────────────────────────────────
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  displayContent: string;
  timestamp: Date;
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
}

// ── GEMINI CONFIG ──────────────────────────────────────────────────────────
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const MODEL   = import.meta.env.VITE_GEMINI_MODEL || 'gemini-2.5-flash';
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
function generateId() {
  return Math.random().toString(36).slice(2, 9);
}

const SUGGESTIONS = [
  { icon: '✨', text: 'Tell me something amazing', label: 'Fun fact' },
  { icon: '💡', text: 'Give me a creative business idea', label: 'Brainstorm' },
  { icon: '📝', text: 'Help me write a short story', label: 'Creative' },
  { icon: '🔧', text: 'Explain how APIs work', label: 'Technical' },
];

// ── BOT LOGO ───────────────────────────────────────────────────────────────
function BotLogo({ size = 32, id = 'logo' }: { size?: number; id?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="14" fill={`url(#grad-${id})`} />
      <path d="M10 16 C10 12, 13 10, 16 10 C19 10, 22 12, 22 16 C22 20, 19 22, 16 22 C13 22, 10 20, 10 16Z" fill="white" opacity="0.9"/>
      <circle cx="13.5" cy="15" r="2" fill="#0ea5e9"/>
      <circle cx="18.5" cy="15" r="2" fill="#0ea5e9"/>
      <circle cx="14" cy="14.5" r="0.8" fill="white"/>
      <circle cx="19" cy="14.5" r="0.8" fill="white"/>
      <path d="M13 19.5 Q16 21 19 19.5" stroke="#0ea5e9" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
      <defs>
        <linearGradient id={`grad-${id}`} x1="0" y1="0" x2="32" y2="32">
          <stop offset="0%" stopColor="#38bdf8"/>
          <stop offset="100%" stopColor="#0369a1"/>
        </linearGradient>
      </defs>
    </svg>
  );
}

// ── APP ────────────────────────────────────────────────────────────────────
export default function App() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId]           = useState<string | null>(null);
  const [isTyping, setIsTyping]           = useState(false);
  const [streaming, setStreaming]         = useState(false);
  const [sidebarOpen, setSidebarOpen]     = useState(false);
  const [isMobile, setIsMobile]           = useState(false);
  const [apiError, setApiError]           = useState('');
  const [input, setInput]                 = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef    = useRef<HTMLTextAreaElement>(null);
  const streamRef      = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeConv = conversations.find(c => c.id === activeId) ?? null;

  // Responsive sidebar — open by default on desktop
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

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConv?.messages, isTyping]);

  // Streaming text effect (like classmate's)
  const streamText = useCallback((fullText: string, msgId: string, convId: string) => {
    setStreaming(true);
    let i = 0;
    const tick = () => {
      i += Math.floor(Math.random() * 4) + 2;
      const chunk = fullText.slice(0, Math.min(i, fullText.length));
      setConversations(prev =>
        prev.map(c => c.id === convId
          ? { ...c, messages: c.messages.map(m => m.id === msgId ? { ...m, displayContent: chunk } : m) }
          : c
        )
      );
      if (i < fullText.length) {
        streamRef.current = setTimeout(tick, 12 + Math.random() * 10);
      } else {
        setStreaming(false);
      }
    };
    tick();
  }, []);

  // Send message
  const handleSend = async (content: string) => {
    const trimmed = content.trim();
    if (!trimmed || isTyping || streaming) return;

    const userMsg: Message = {
      id: generateId(),
      role: 'user',
      content: trimmed,
      displayContent: trimmed,
      timestamp: new Date(),
    };

    let convId = activeId;
    let updatedMessages: Message[] = [];

    if (!convId) {
      const newConv: Conversation = {
        id: generateId(),
        title: trimmed.slice(0, 38) + (trimmed.length > 38 ? '…' : ''),
        messages: [userMsg],
        createdAt: new Date(),
      };
      setConversations(prev => [newConv, ...prev]);
      setActiveId(newConv.id);
      convId = newConv.id;
      updatedMessages = [userMsg];
    } else {
      setConversations(prev =>
        prev.map(c => c.id === convId
          ? { ...c, messages: [...c.messages, userMsg] }
          : c
        )
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
        id: botId,
        role: 'assistant',
        content: reply,
        displayContent: '',
        timestamp: new Date(),
      };
      setIsTyping(false);
      setConversations(prev =>
        prev.map(c => c.id === convId
          ? { ...c, messages: [...c.messages, botMsg] }
          : c
        )
      );
      streamText(reply, botId, convId!);
    } catch (err: unknown) {
      setIsTyping(false);
      setApiError(err instanceof Error ? err.message : 'Something went wrong.');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(input); }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const ta = textareaRef.current;
    if (ta) { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 180) + 'px'; }
  };

  const createNew = () => {
    setActiveId(null);
    setApiError('');
    setInput('');
    if (isMobile) setSidebarOpen(false);
  };

  const canSend = input.trim().length > 0 && !isTyping && !streaming;

  // ── RENDER ───────────────────────────────────────────────────────────────
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
          --bg-base:       #0a0a0f;
          --bg-surface:    #111118;
          --bg-elevated:   #18181f;
          --bg-hover:      #1e1e28;
          --border:        rgba(56,189,248,0.12);
          --border-hover:  rgba(56,189,248,0.3);
          --text-primary:  #f0f4f8;
          --text-secondary:#94a3b8;
          --text-muted:    #475569;
          --font-sans:     'Outfit', sans-serif;
          --font-mono:     'JetBrains Mono', monospace;
          --r-sm: 8px; --r-md: 12px; --r-lg: 16px; --r-xl: 24px;
        }

        html, body, #root { height: 100%; width: 100%; overflow: hidden; }
        body {
          font-family: var(--font-sans);
          background: var(--bg-base);
          color: var(--text-primary);
          line-height: 1.6;
          -webkit-font-smoothing: antialiased;
        }
        body::before {
          content: ''; position: fixed; inset: 0; z-index: 0; pointer-events: none;
          background-image:
            linear-gradient(rgba(56,189,248,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(56,189,248,0.03) 1px, transparent 1px);
          background-size: 40px 40px;
        }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(56,189,248,0.2); border-radius: 99px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(56,189,248,0.4); }

        /* ── LAYOUT ── */
        .app { position: relative; z-index: 1; display: flex; height: 100dvh; width: 100%; overflow: hidden; }

        /* ── MOBILE OVERLAY ── */
        .sb-overlay { display: none; position: fixed; inset: 0; z-index: 99; background: rgba(0,0,0,0.55); backdrop-filter: blur(4px); }
        .sb-overlay.visible { display: block; }

        /* ── SIDEBAR ── */
        .sidebar {
          width: 260px; height: 100%; flex-shrink: 0;
          background: var(--bg-surface); border-right: 1px solid var(--border);
          display: flex; flex-direction: column;
          transition: transform 0.25s cubic-bezier(0.4,0,0.2,1);
          position: relative; z-index: 100;
        }
        @media (max-width: 768px) {
          .sidebar { position: fixed; left: 0; top: 0; bottom: 0; transform: translateX(-100%); box-shadow: 4px 0 40px rgba(0,0,0,0.5); }
          .sidebar.open { transform: translateX(0); }
        }

        .sb-head { display: flex; align-items: center; justify-content: space-between; padding: 16px 12px; border-bottom: 1px solid var(--border); flex-shrink: 0; }
        .brand { display: flex; align-items: center; gap: 10px; }
        .brand-logo svg { filter: drop-shadow(0 0 8px rgba(56,189,248,0.4)); }
        .brand-name {
          font-size: 17px; font-weight: 700; letter-spacing: -0.3px;
          background: linear-gradient(135deg, var(--sky-light), var(--sky));
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
        }
        .new-chat-btn {
          width: 32px; height: 32px; border-radius: var(--r-sm);
          border: 1px solid var(--border); background: var(--bg-elevated);
          color: var(--text-secondary); display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: all 0.2s;
        }
        .new-chat-btn:hover { background: var(--sky-subtle); border-color: var(--border-hover); color: var(--sky); }

        .sb-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px; color: var(--text-muted); padding: 16px 16px 6px; }
        .sb-convs { flex: 1; overflow-y: auto; padding: 4px 8px; display: flex; flex-direction: column; gap: 2px; }
        .sb-empty { color: var(--text-muted); font-size: 13px; text-align: center; padding: 24px 16px; }

        .conv-btn {
          width: 100%; display: flex; align-items: center; gap: 10px;
          padding: 9px 10px; border-radius: var(--r-sm); border: 1px solid transparent;
          background: transparent; color: var(--text-secondary);
          font-family: var(--font-sans); font-size: 13.5px; cursor: pointer; text-align: left; transition: all 0.15s;
        }
        .conv-btn svg { flex-shrink: 0; opacity: 0.5; }
        .conv-btn:hover { background: var(--bg-hover); color: var(--text-primary); }
        .conv-btn.active { background: var(--sky-subtle); color: var(--sky-light); border-color: var(--border); }
        .conv-btn.active svg { opacity: 1; color: var(--sky); }
        .conv-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }

        .sb-footer { padding: 12px 8px; border-top: 1px solid var(--border); flex-shrink: 0; }
        .user-btn { width: 100%; display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: var(--r-sm); border: none; background: transparent; cursor: pointer; transition: background 0.15s; }
        .user-btn:hover { background: var(--bg-hover); }
        .user-av { width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, var(--sky-dark), var(--sky)); display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 700; color: white; flex-shrink: 0; }
        .user-info { display: flex; flex-direction: column; gap: 1px; text-align: left; }
        .user-name { font-size: 13px; font-weight: 500; color: var(--text-primary); }
        .user-plan { font-size: 11px; color: var(--text-muted); }

        /* ── MAIN ── */
        .main { flex: 1; min-width: 0; display: flex; flex-direction: column; overflow: hidden; }

        /* ── TOPBAR ── */
        .topbar { display: flex; align-items: center; gap: 12px; padding: 0 20px; height: 56px; flex-shrink: 0; border-bottom: 1px solid var(--border); background: var(--bg-surface); position: relative; z-index: 1; }
        .menu-btn { width: 36px; height: 36px; display: none; align-items: center; justify-content: center; background: transparent; border: 1px solid var(--border); border-radius: var(--r-sm); color: var(--text-secondary); cursor: pointer; transition: all 0.2s; flex-shrink: 0; }
        .menu-btn:hover { background: var(--bg-hover); color: var(--sky); }
        @media (max-width: 768px) { .menu-btn { display: flex; } }
        .topbar-title { flex: 1; font-size: 14.5px; font-weight: 500; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .online-badge { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--sky); font-weight: 500; padding: 4px 10px; background: var(--sky-subtle); border: 1px solid var(--border); border-radius: 99px; flex-shrink: 0; }
        .online-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--sky); animation: pulse 2s infinite; }
        @keyframes pulse { 0%,100% { opacity:1; box-shadow: 0 0 0 0 rgba(56,189,248,0.4); } 50% { opacity:0.8; box-shadow: 0 0 0 4px rgba(56,189,248,0); } }

        /* ── CHAT AREA ── */
        .chat-area { flex: 1; overflow-y: auto; display: flex; flex-direction: column; }
        .messages-wrap { display: flex; flex-direction: column; gap: 20px; padding: 28px 20px; max-width: 800px; width: 100%; margin: 0 auto; }
        @media (max-width: 600px) { .messages-wrap { padding: 20px 14px; } }

        /* ── WELCOME ── */
        .welcome { display: flex; flex-direction: column; align-items: center; justify-content: center; flex: 1; padding: 40px 24px; text-align: center; animation: fadeUp 0.5s ease both; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
        .welcome-logo { width: 72px; height: 72px; margin-bottom: 20px; filter: drop-shadow(0 0 20px rgba(56,189,248,0.5)); animation: float 3s ease-in-out infinite; }
        @keyframes float { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-6px); } }
        .welcome-title { font-size: 32px; font-weight: 700; letter-spacing: -0.8px; margin-bottom: 10px; background: linear-gradient(135deg, #fff 30%, var(--sky-light)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
        .welcome-sub { font-size: 16px; color: var(--text-secondary); margin-bottom: 40px; max-width: 380px; }
        .suggestions { display: grid; grid-template-columns: repeat(2,1fr); gap: 12px; width: 100%; max-width: 620px; }
        @media (max-width: 500px) { .suggestions { grid-template-columns: 1fr; } }
        .sug-card { display: flex; align-items: center; gap: 12px; padding: 14px 16px; background: var(--bg-elevated); border: 1px solid var(--border); border-radius: var(--r-md); cursor: pointer; text-align: left; transition: all 0.2s; font-family: var(--font-sans); }
        .sug-card:hover { background: var(--bg-hover); border-color: var(--border-hover); transform: translateY(-2px); box-shadow: 0 0 20px rgba(56,189,248,0.2); }
        .sug-icon { font-size: 22px; flex-shrink: 0; }
        .sug-content { display: flex; flex-direction: column; gap: 2px; }
        .sug-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.6px; color: var(--sky); }
        .sug-text { font-size: 13px; color: var(--text-secondary); line-height: 1.4; }

        /* ── MESSAGES ── */
        .msg-row { display: flex; align-items: flex-end; gap: 10px; animation: msgIn 0.3s ease both; }
        @keyframes msgIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        .msg-row.user { flex-direction: row-reverse; }
        .msg-av { width: 32px; height: 32px; border-radius: 50%; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; }
        .msg-av.bot svg { filter: drop-shadow(0 0 6px rgba(56,189,248,0.3)); }
        .msg-av.you { background: linear-gradient(135deg, var(--sky-dark), var(--sky)); color: white; }
        .bubble { max-width: 70%; padding: 12px 16px; border-radius: var(--r-lg); position: relative; }
        .bubble.user { background: linear-gradient(135deg, var(--sky-dark), var(--sky)); color: white; border-bottom-right-radius: 4px; box-shadow: 0 4px 16px rgba(14,165,233,0.3); }
        .bubble.bot  { background: var(--bg-elevated); border: 1px solid var(--border); color: var(--text-primary); border-bottom-left-radius: 4px; }
        @media (max-width: 600px) { .bubble { max-width: 85%; } }
        .bubble-text { font-size: 14.5px; line-height: 1.6; white-space: pre-wrap; word-break: break-word; }
        .bubble-time { font-size: 10px; margin-top: 5px; opacity: 0.55; font-family: var(--font-mono); }
        .bubble.user .bubble-time { text-align: right; }
        .stream-cursor::after { content: '▋'; color: var(--sky); animation: blink 0.7s steps(1) infinite; font-size: 0.85em; margin-left: 2px; }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }

        /* ── TYPING ── */
        .typing-row { display: flex; align-items: flex-end; gap: 10px; }
        .typing-bubble { background: var(--bg-elevated); border: 1px solid var(--border); border-radius: var(--r-lg); border-bottom-left-radius: 4px; padding: 14px 18px; display: flex; gap: 5px; align-items: center; }
        .typing-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--sky); animation: tdot 1.2s infinite; }
        .typing-dot:nth-child(2) { animation-delay: 0.2s; }
        .typing-dot:nth-child(3) { animation-delay: 0.4s; }
        @keyframes tdot { 0%,60%,100%{transform:translateY(0);opacity:0.4} 30%{transform:translateY(-6px);opacity:1} }

        /* ── ERROR BAR ── */
        .err-bar { display: flex; align-items: flex-start; gap: 10px; padding: 11px 14px; margin-bottom: 8px; background: rgba(239,68,68,0.07); border: 1px solid rgba(239,68,68,0.2); border-radius: var(--r-sm); font-size: 13px; color: #fca5a5; font-family: var(--font-mono); line-height: 1.5; }
        .err-prefix { color: #ef4444; font-weight: 700; flex-shrink: 0; }
        .err-x { background: none; border: none; color: #fca5a5; cursor: pointer; font-size: 1rem; padding: 0; opacity: 0.6; margin-left: auto; flex-shrink: 0; }
        .err-x:hover { opacity: 1; }

        /* ── INPUT ── */
        .input-area { padding: 16px 20px 12px; border-top: 1px solid var(--border); background: var(--bg-surface); flex-shrink: 0; }
        .input-shell { display: flex; align-items: flex-end; gap: 10px; background: var(--bg-elevated); border: 1px solid var(--border); border-radius: var(--r-xl); padding: 10px 10px 10px 16px; transition: border-color 0.2s, box-shadow 0.2s; }
        .input-shell:focus-within { border-color: var(--border-hover); box-shadow: 0 0 0 3px rgba(56,189,248,0.08); }
        .chat-ta { flex: 1; background: transparent; border: none; outline: none; resize: none; font-family: var(--font-sans); font-size: 14.5px; color: var(--text-primary); line-height: 1.6; min-height: 24px; max-height: 180px; overflow-y: auto; }
        .chat-ta::placeholder { color: var(--text-muted); }
        .chat-ta:disabled { opacity: 0.5; }
        .send-btn { width: 36px; height: 36px; border-radius: 50%; border: none; flex-shrink: 0; background: var(--bg-hover); color: var(--text-muted); display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s; }
        .send-btn.ready { background: linear-gradient(135deg, var(--sky-dark), var(--sky)); color: white; box-shadow: 0 4px 12px rgba(14,165,233,0.4); }
        .send-btn.ready:hover { transform: scale(1.05); box-shadow: 0 6px 16px rgba(14,165,233,0.5); }
        .send-btn:disabled { cursor: not-allowed; }
        .input-hint { font-size: 11px; color: var(--text-muted); text-align: center; margin-top: 8px; }
        .input-hint kbd { font-family: var(--font-mono); font-size: 10px; padding: 1px 5px; background: var(--bg-elevated); border: 1px solid var(--border); border-radius: 4px; color: var(--text-secondary); }
      `}</style>

      {/* Mobile sidebar overlay */}
      {isMobile && sidebarOpen && (
        <div className="sb-overlay visible" onClick={() => setSidebarOpen(false)} />
      )}

      <div className="app">

        {/* ── SIDEBAR ── */}
        <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
          <div className="sb-head">
            <div className="brand">
              <div className="brand-logo"><BotLogo size={32} id="sb" /></div>
              <span className="brand-name">BonggaBot</span>
            </div>
            <button className="new-chat-btn" onClick={createNew} title="New chat">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12h14"/>
              </svg>
            </button>
          </div>

          <div className="sb-label">Recent</div>

          <nav className="sb-convs">
            {conversations.length === 0 && <div className="sb-empty">No conversations yet</div>}
            {conversations.map(conv => (
              <button
                key={conv.id}
                className={`conv-btn ${activeId === conv.id ? 'active' : ''}`}
                onClick={() => { setActiveId(conv.id); if (isMobile) setSidebarOpen(false); }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
                <span className="conv-title">{conv.title}</span>
              </button>
            ))}
          </nav>

          <div className="sb-footer">
            <button className="user-btn">
              <div className="user-av">B</div>
              <div className="user-info">
                <span className="user-name">User</span>
                <span className="user-plan">Free Plan</span>
              </div>
            </button>
          </div>
        </aside>

        {/* ── MAIN ── */}
        <div className="main">

          {/* Topbar */}
          <header className="topbar">
            <button className="menu-btn" onClick={() => setSidebarOpen(o => !o)} title="Menu">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="6" x2="21" y2="6"/>
                <line x1="3" y1="12" x2="21" y2="12"/>
                <line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>
            <div className="topbar-title">{activeConv ? activeConv.title : 'BonggaBot'}</div>
            <div className="online-badge">
              <span className="online-dot" />
              Online
            </div>
          </header>

          {/* Chat area */}
          <div className="chat-area">
            {!activeConv ? (
              /* ── Welcome Screen ── */
              <div className="welcome">
                <div className="welcome-logo">
                  <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
                    <circle cx="32" cy="32" r="28" fill="url(#wgrad)" />
                    <path d="M20 32 C20 24, 26 20, 32 20 C38 20, 44 24, 44 32 C44 40, 38 44, 32 44 C26 44, 20 40, 20 32Z" fill="white" opacity="0.95"/>
                    <circle cx="26" cy="30" r="4" fill="#0ea5e9"/>
                    <circle cx="38" cy="30" r="4" fill="#0ea5e9"/>
                    <circle cx="27" cy="29" r="1.5" fill="white"/>
                    <circle cx="39" cy="29" r="1.5" fill="white"/>
                    <path d="M26 37 Q32 41 38 37" stroke="#0ea5e9" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
                    <defs>
                      <linearGradient id="wgrad" x1="0" y1="0" x2="64" y2="64">
                        <stop offset="0%" stopColor="#38bdf8"/>
                        <stop offset="100%" stopColor="#0369a1"/>
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
                <h1 className="welcome-title">Hi, I'm BonggaBot!</h1>
                <p className="welcome-sub">Your brilliant AI companion. How can I help you today?</p>
                <div className="suggestions">
                  {SUGGESTIONS.map((s, i) => (
                    <button key={i} className="sug-card" onClick={() => handleSend(s.text)}>
                      <span className="sug-icon">{s.icon}</span>
                      <div className="sug-content">
                        <span className="sug-label">{s.label}</span>
                        <span className="sug-text">{s.text}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              /* ── Messages ── */
              <div className="messages-wrap">
                {activeConv.messages.map(msg => {
                  const isUser = msg.role === 'user';
                  const isStreaming = !isUser && msg.displayContent !== msg.content;
                  return (
                    <div key={msg.id} className={`msg-row ${isUser ? 'user' : 'assistant'}`}>
                      {!isUser && (
                        <div className="msg-av bot">
                          <BotLogo size={32} id={msg.id} />
                        </div>
                      )}
                      <div className={`bubble ${isUser ? 'user' : 'bot'}`}>
                        <div className={`bubble-text ${isStreaming ? 'stream-cursor' : ''}`}>
                          {msg.displayContent}
                        </div>
                        <div className="bubble-time">
                          {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      {isUser && <div className="msg-av you">U</div>}
                    </div>
                  );
                })}

                {/* Typing indicator */}
                {isTyping && (
                  <div className="typing-row">
                    <div className="msg-av bot"><BotLogo size={32} id="typing" /></div>
                    <div className="typing-bubble">
                      <div className="typing-dot" />
                      <div className="typing-dot" />
                      <div className="typing-dot" />
                    </div>
                  </div>
                )}

                {/* Error message */}
                {apiError && (
                  <div className="err-bar">
                    <span className="err-prefix">Error</span>
                    <span>{apiError}</span>
                    <button className="err-x" onClick={() => setApiError('')}>✕</button>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Input area */}
          <div className="input-area">
            <div className="input-shell">
              <textarea
                ref={textareaRef}
                className="chat-ta"
                placeholder="Message BonggaBot..."
                value={input}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                rows={1}
                disabled={isTyping || streaming}
              />
              <button
                className={`send-btn ${canSend ? 'ready' : ''}`}
                onClick={() => handleSend(input)}
                disabled={!canSend}
                title="Send message"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 2L11 13"/>
                  <path d="M22 2L15 22 11 13 2 9l20-7z"/>
                </svg>
              </button>
            </div>
            <p className="input-hint">Press <kbd>Enter</kbd> to send · <kbd>Shift+Enter</kbd> for newline</p>
          </div>

        </div>
      </div>
    </>
  );
}