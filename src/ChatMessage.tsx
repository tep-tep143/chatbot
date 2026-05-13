import { Message } from './types';
import './ChatMessage.css';

interface ChatMessageProps {
  message: Message;
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`message-row ${isUser ? 'user' : 'assistant'}`}>
      {!isUser && (
        <div className="msg-avatar bot-avatar">
          <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="16" cy="16" r="14" fill="url(#mgrad)" />
            <path d="M10 16 C10 12, 13 10, 16 10 C19 10, 22 12, 22 16 C22 20, 19 22, 16 22 C13 22, 10 20, 10 16Z" fill="white" opacity="0.9"/>
            <circle cx="13.5" cy="15" r="2" fill="#0ea5e9"/>
            <circle cx="18.5" cy="15" r="2" fill="#0ea5e9"/>
            <path d="M13 19.5 Q16 21 19 19.5" stroke="#0ea5e9" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
            <defs>
              <linearGradient id="mgrad" x1="0" y1="0" x2="32" y2="32">
                <stop offset="0%" stopColor="#38bdf8"/>
                <stop offset="100%" stopColor="#0369a1"/>
              </linearGradient>
            </defs>
          </svg>
        </div>
      )}
      <div className={`message-bubble ${isUser ? 'user-bubble' : 'bot-bubble'}`}>
        <div className="message-content">{message.content}</div>
        <div className="message-time">
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
      {isUser && (
        <div className="msg-avatar user-avatar">U</div>
      )}
    </div>
  );
}
