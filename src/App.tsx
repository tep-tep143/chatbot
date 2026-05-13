import { useState, useRef, useEffect } from 'react';
import Sidebar from './Sidebar';
import WelcomeScreen from './WelcomeScreen';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import TypingIndicator from './TypingIndicator';
import { Conversation, Message } from './types';
import './WelcomeScreen.css';
import './App.css';
const GEMINI_API_KEY = 'AIzaSyDOaO_on4yoPDPk-HDMS85pBE7ADt8SAP8';

function generateId() {
  return Math.random().toString(36).slice(2, 9);
}

async function getGeminiResponse(userMessage: string): Promise<string> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: userMessage }] }]
      })
    }
  );
  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? 'Hmm, I had trouble responding!';
}

export default function App() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeConv = conversations.find(c => c.id === activeId) ?? null;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConv?.messages, isTyping]);

  const createNewConversation = () => {
    setActiveId(null);
    setSidebarOpen(false);
  };

  const handleSend = (content: string) => {
    const userMsg: Message = {
      id: generateId(),
      role: 'user',
      content,
      timestamp: new Date(),
    };

    let convId = activeId;

    if (!convId) {
      const newConv: Conversation = {
        id: generateId(),
        title: content.slice(0, 38) + (content.length > 38 ? '…' : ''),
        messages: [userMsg],
        createdAt: new Date(),
      };
      setConversations(prev => [newConv, ...prev]);
      setActiveId(newConv.id);
      convId = newConv.id;
    } else {
      setConversations(prev =>
        prev.map(c => c.id === convId
          ? { ...c, messages: [...c.messages, userMsg] }
          : c
        )
      );
    }

    setIsTyping(true);
    getGeminiResponse(content).then(botReply => {
      const botMsg: Message = {
        id: generateId(),
        role: 'assistant',
        content: botReply,
        timestamp: new Date(),
      };
      setConversations(prev =>
        prev.map(c => c.id === convId
          ? { ...c, messages: [...c.messages, botMsg] }
          : c
        )
      );
      setIsTyping(false);
    }); // ← this closing was missing before!
  };  // ← handleSend closes here

  return (
    <div className="app">
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        onSelect={id => { setActiveId(id); setSidebarOpen(false); }}
        onNew={createNewConversation}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="main">
        <header className="topbar">
          <button className="menu-btn" onClick={() => setSidebarOpen(true)} title="Menu">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6"/>
              <line x1="3" y1="12" x2="21" y2="12"/>
              <line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
          <div className="topbar-title">
            {activeConv ? activeConv.title : 'BonggaBot'}
          </div>
          <div className="topbar-badge">
            <span className="status-dot"></span>
            Online
          </div>
        </header>

        <div className="chat-area">
          {!activeConv ? (
            <WelcomeScreen onPrompt={handleSend} />
          ) : (
            <div className="messages">
              {activeConv.messages.map(msg => (
                <ChatMessage key={msg.id} message={msg} />
              ))}
              {isTyping && <TypingIndicator />}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        <ChatInput onSend={handleSend} disabled={isTyping} />
      </div>
    </div>
  );
}