interface WelcomeScreenProps {
  onPrompt: (prompt: string) => void;
}

const suggestions = [
  { icon: '✨', text: 'Tell me something amazing', label: 'Fun fact' },
  { icon: '💡', text: 'Give me a creative business idea', label: 'Brainstorm' },
  { icon: '📝', text: 'Help me write a short story', label: 'Creative' },
  { icon: '🔧', text: 'Explain how APIs work', label: 'Technical' },
];

export default function WelcomeScreen({ onPrompt }: WelcomeScreenProps) {
  return (
    <div className="welcome">
      <div className="welcome-logo">
        <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
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
        {suggestions.map((s, i) => (
          <button key={i} className="suggestion-card" onClick={() => onPrompt(s.text)}>
            <span className="suggestion-icon">{s.icon}</span>
            <div className="suggestion-content">
              <span className="suggestion-label">{s.label}</span>
              <span className="suggestion-text">{s.text}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
