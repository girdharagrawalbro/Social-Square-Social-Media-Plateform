import React, { useState, useRef, useEffect, useCallback } from 'react';
import useAuthStore, { getToken } from '../../store/zustand/useAuthStore';
import usePostStore from '../../store/zustand/usePostStore';
import useWindowWidth from '../../hooks/useWindowWidth';

const BASE = process.env.REACT_APP_BACKEND_URL;

// ─── QUICK ACTION BUTTONS ─────────────────────────────────────────────────────
const QUICK_ACTIONS = [
    { label: '✍️ Caption ideas', message: 'Give me caption ideas for my next post' },
    { label: '📸 Stories help', message: 'How do I use stories and pause the timer?' },
    { label: '🤝 Collab posts', message: 'How do collaborative posts work?' },
    { label: '🎭 Confessions', message: 'How do anonymous confessions work?' },
    { label: '🎙️ Messaging & Voice', message: 'Tell me about messaging and voice notes' },
    { label: '🚩 Report an issue', message: 'I want to report a problem with the app' },
];

// ─── MESSAGE BUBBLE ───────────────────────────────────────────────────────────
const MessageBubble = ({ msg }) => {
    const isBot = msg.role === 'assistant';
    const isSystem = msg.role === 'system';

    if (isSystem) return (
        <div style={{ textAlign: 'center', padding: '4px 8px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-sub)', background: 'var(--surface-2)', borderRadius: '10px', padding: '2px 10px' }}>{msg.content}</span>
        </div>
    );

    return (
        <div style={{ display: 'flex', justifyContent: isBot ? 'flex-start' : 'flex-end', marginBottom: '8px', gap: '8px', alignItems: 'flex-end' }}>
            {isBot && (
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, #808bf5, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', flexShrink: 0 }}>
                    🤖
                </div>
            )}
            <div style={{
                maxWidth: '78%',
                padding: '10px 13px',
                borderRadius: isBot ? '18px 18px 18px 4px' : '18px 18px 4px 18px',
                background: isBot ? 'var(--surface-2)' : 'linear-gradient(135deg, var(--primary), #6366f1)',
                color: isBot ? 'var(--text-main)' : '#fff',
                fontSize: '13px',
                lineHeight: 1.5,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
            }}>
                {msg.content}
                {msg.loading && (
                    <span style={{ display: 'inline-flex', gap: '3px', marginLeft: '4px' }}>
                        {[0, 1, 2].map(i => (
                            <span key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--text-sub)', display: 'inline-block', animation: `typingDot 1s ${i * 0.2}s infinite` }} />
                        ))}
                    </span>
                )}
            </div>
        </div>
    );
};

// ─── MAIN CHATBOT ─────────────────────────────────────────────────────────────
const Chatbot = () => {
    const user = useAuthStore(s => s.user);
    const { chatbotOpen: open, setChatbotOpen: setOpen } = usePostStore();
    const windowWidth = useWindowWidth();
    const isMobile = windowWidth < 768;
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [unread, setUnread] = useState(0);
    const [userMemory, setUserMemory] = useState(null);
    const [messages, setMessages] = useState([
        {
            role: 'assistant',
            content: `Hey ${user?.fullname?.split(' ')[0] || 'there'}! 👋 I'm SocialBot, your AI assistant for Social Square.\n\nI can help you with posting tips, caption ideas, mood-based content, or any app questions. What can I help you with?`,
        }
    ]);
    const bottomRef = useRef(null);
    const inputRef = useRef(null);
    const hasOpened = useRef(false);

    // Scroll to bottom on new messages
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Focus input when opened
    useEffect(() => {
        if (open) {
            setUnread(0);
            setTimeout(() => inputRef.current?.focus(), 100);
            hasOpened.current = true;
        }
    }, [open]);

    useEffect(() => {
        if (user?._id) {
            const token = getToken();
            if (!token) return;

            fetch(`${BASE}/api/recommendation/memory`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
            .then(res => res.json())
            .then(data => setUserMemory(data))
            .catch(() => {});
        }
    }, [user?._id]);

    const sendMessage = useCallback(async (text) => {
        const content = (text || input).trim();
        if (!content || loading) return;

        setInput('');

        const userMsg = { role: 'user', content };
        const loadingMsg = { role: 'assistant', content: '', loading: true };

        setMessages(prev => [...prev, userMsg, loadingMsg]);
        setLoading(true);

        try {
            const token = getToken();
            const history = [...messages, userMsg].filter(m => !m.loading);
            const response = await fetch(`${BASE}/api/chatbot/chat`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : ''
                },
                body: JSON.stringify({ 
                    messages: history, 
                    userId: user?._id,
                    user_memory: userMemory 
                }),
            });

            if (!response.ok) throw new Error('Server error');

            // ✅ Handle SSE streaming response
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let accumulated = '';

            // Replace loading bubble with empty assistant bubble to stream into
            setMessages(prev => [
                ...prev.filter(m => !m.loading),
                { role: 'assistant', content: '' },
            ]);

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    const data = line.slice(6).trim();
                    if (data === '[DONE]') break;
                    try {
                        const parsed = JSON.parse(data);
                        if (parsed.content) {
                            accumulated += parsed.content;
                            // Update last message in real time
                            const currentAccumulated = accumulated;
                            setMessages(prev => [
                                ...prev.slice(0, -1),
                                { role: 'assistant', content: currentAccumulated },
                            ]);
                        }
                    } catch { }
                }
            }

            // Badge if closed
            if (!open) setUnread(n => n + 1);

        } catch {
            setMessages(prev => [
                ...prev.filter(m => !m.loading),
                { role: 'assistant', content: '⚠️ Connection error. Please try again.' },
            ]);
        }
        setLoading(false);
    }, [input, loading, messages, open, user?._id, userMemory]);

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    };

    const clearChat = () => {
        setMessages([{
            role: 'assistant',
            content: `Chat cleared! How can I help you? 😊`,
        }]);
    };

    return (
        <>
            <style>{`
                @keyframes typingDot { 0%,60%,100%{transform:translateY(0);opacity:.4} 30%{transform:translateY(-4px);opacity:1} }
                @keyframes chatPop { 0%{transform:scale(0.8) translateY(20px);opacity:0} 100%{transform:scale(1) translateY(0);opacity:1} }
                @keyframes bubblePulse { 0%,100%{box-shadow:0 0 0 0 rgba(128,139,245,0.4)} 50%{box-shadow:0 0 0 10px rgba(128,139,245,0)} }
                .chatbot-window { animation: chatPop 0.25s ease forwards; }
            `}</style>

            {/* ── Floating Bubble ── */}
            <div className="fixed bottom-[85px] md:bottom-6 right-6 z-[9999]">

                {/* Chat window */}
                {open && (
                    <div className="chatbot-window" style={{
                        position: 'absolute', bottom: '68px', right: 0,
                        width: 'calc(100vw - 48px)', maxWidth: '340px',
                        height: 'calc(100dvh - 180px)', maxHeight: '520px',
                        background: 'var(--surface-1)', borderRadius: '20px',
                        boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
                        border: '1px solid var(--border-color)',
                        display: 'flex', flexDirection: 'column',
                        overflow: 'hidden',
                    }}>
                        {/* Header */}
                        <div style={{ background: 'linear-gradient(135deg, #808bf5, #6366f1)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
                                🤖
                            </div>
                            <div style={{ flex: 1 }}>
                                <p style={{ margin: 0, fontWeight: 700, color: '#fff', fontSize: '14px' }}>SocialBot</p>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80' }} />
                                            <p style={{ margin: 0, color: 'rgba(255,255,255,0.8)', fontSize: '11px' }}>Online · Powered by Mistral AI</p>
                                </div>
                            </div>
                            <button type="button" onClick={clearChat} aria-label="Clear chat" title="Clear chat"
                                style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '8px', padding: '4px 8px', cursor: 'pointer', color: '#fff', fontSize: '11px' }}>
                                🗑️
                            </button>
                            <button type="button" aria-label="Close chat" onClick={() => setOpen(false)}
                                style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '8px', width: 28, height: 28, cursor: 'pointer', color: '#fff', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                ✕
                            </button>
                        </div>

                        {/* Messages */}
                        <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            {messages.map((msg, i) => <MessageBubble key={i} msg={msg} />)}
                            <div ref={bottomRef} />
                        </div>

                        {/* Quick actions — show only at start */}
                        {messages.length <= 2 && (
                            <div style={{ padding: '0 12px 8px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                {QUICK_ACTIONS.map((action, i) => (
                                    <button key={i} type="button" aria-label={`Quick action: ${action.label}`} onClick={() => sendMessage(action.message)}
                                        style={{ padding: '4px 10px', borderRadius: '14px', border: '1px solid var(--border-color)', background: 'var(--surface-2)', cursor: 'pointer', fontSize: '11px', fontWeight: 500, color: 'var(--text-main)', transition: 'all 0.15s' }}
                                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--primary)'; e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = '#fff'; }}
                                        onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface-2)'; e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.color = 'var(--text-main)'; }}>
                                        {action.label}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Input */}
                        <div style={{ borderTop: '1px solid var(--border-color)', padding: '10px 12px', display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                            <textarea
                                ref={inputRef}
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Ask me anything..."
                                rows={1}
                                disabled={loading}
                                style={{
                                    flex: 1, border: '1px solid var(--border-color)', borderRadius: '14px',
                                    padding: '8px 12px', fontSize: '13px', outline: 'none',
                                    resize: 'none', fontFamily: 'inherit', lineHeight: 1.4,
                                    maxHeight: '80px', overflowY: 'auto', background: 'var(--surface-2)', color: 'var(--text-main)',
                                    transition: 'border-color 0.2s',
                                }}
                                onFocus={e => e.target.style.borderColor = 'var(--primary)'}
                                onBlur={e => e.target.style.borderColor = 'var(--border-color)'}
                            />
                            <button
                                type="button"
                                aria-label="Send message"
                                onClick={() => sendMessage()}
                                disabled={!input.trim() || loading}
                                style={{
                                    width: 36, height: 36, borderRadius: '50%',
                                    background: input.trim() && !loading ? 'linear-gradient(135deg, var(--primary), #6366f1)' : 'var(--border-color)',
                                    border: 'none', cursor: input.trim() && !loading ? 'pointer' : 'default',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    flexShrink: 0, transition: 'all 0.2s',
                                }}>
                                {loading
                                    ? <div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: input.trim() ? '#fff' : 'var(--text-sub)', borderRadius: '50%', animation: 'typingDot 0.7s linear infinite' }} />
                                    : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={input.trim() ? '#fff' : 'var(--text-sub)'} strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
                                }
                            </button>
                        </div>
                    </div>
                )}

                {/* Bubble button and Unread badge - Hidden on mobile, moved to hamburger */}
                {!isMobile && (
                    <>
                        <button
                            type="button"
                            aria-pressed={open}
                            aria-label={open ? 'Close SocialBot' : 'Open SocialBot'}
                            onClick={() => setOpen(v => !v)}
                            style={{
                                width: 56, height: 56, borderRadius: '50%',
                                background: open ? '#6366f1' : 'linear-gradient(135deg, #808bf5, #6366f1)',
                                border: 'none', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                boxShadow: '0 8px 24px rgba(128,139,245,0.5)',
                                animation: !hasOpened.current ? 'bubblePulse 2s ease infinite' : 'none',
                                transition: 'transform 0.2s, background 0.2s',
                                fontSize: '24px',
                            }}
                            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.08)'}
                            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                            title="Chat with SocialBot"
                        >
                            {open ? '✕' : '🤖'}
                        </button>

                        {unread > 0 && !open && (
                            <div style={{ position: 'absolute', top: -4, right: -4, background: '#ef4444', color: '#fff', borderRadius: '50%', width: 20, height: 20, fontSize: '11px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #fff' }}>
                                {unread}
                            </div>
                        )}
                    </>
                )}
            </div>
        </>
    );
};

export default Chatbot;
