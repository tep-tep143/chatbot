import { useState } from 'react';
import { Conversation } from './types';
import './Sidebar.css';

interface SidebarProps {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ conversations, activeId, onSelect, onNew, isOpen, onClose }: SidebarProps) {
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <>
      <div className={`sidebar-overlay ${isOpen ? 'visible' : ''}`} onClick={onClose} />
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="brand">
            <div className="brand-logo">
              <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="16" cy="16" r="14" fill="url(#grad)" />
                <path d="M10 16 C10 12, 14 10, 16 10 C18 10, 22 12, 22 16 C22 20, 18 22, 16 22 C14 22, 10 20, 10 16Z" fill="white" opacity="0.9"/>
                <circle cx="13" cy="15" r="2" fill="#0ea5e9"/>
                <circle cx="19" cy="15" r="2" fill="#0ea5e9"/>
                <path d="M13 19 Q16 21 19 19" stroke="#0ea5e9" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
                <defs>
                  <linearGradient id="grad" x1="0" y1="0" x2="32" y2="32">
                    <stop offset="0%" stopColor="#38bdf8"/>
                    <stop offset="100%" stopColor="#0369a1"/>
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <span className="brand-name">BonggaBot</span>
          </div>
          <button className="new-chat-btn" onClick={onNew} title="New chat">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14"/>
            </svg>
          </button>
        </div>

        <div className="sidebar-section-label">Recent</div>

        <nav className="conversations">
          {conversations.length === 0 && (
            <div className="empty-state">No conversations yet</div>
          )}
          {conversations.map(conv => (
            <button
              key={conv.id}
              className={`conv-item ${activeId === conv.id ? 'active' : ''} ${hovered === conv.id ? 'hovered' : ''}`}
              onClick={() => onSelect(conv.id)}
              onMouseEnter={() => setHovered(conv.id)}
              onMouseLeave={() => setHovered(null)}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              <span className="conv-title">{conv.title}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button className="user-btn">
            <div className="avatar">B</div>
            <div className="user-info">
              <span className="user-name">User</span>
              <span className="user-plan">Free Plan</span>
            </div>
          </button>
        </div>
      </aside>
    </>
  );
}
