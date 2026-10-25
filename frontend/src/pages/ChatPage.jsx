import React, { useState, useRef, useEffect } from 'react';
import { Send, Scale, User, BookOpen, Sparkles, Plus, ArrowDown, Bot, Cpu, Zap, MessageSquare, Trash2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/* Recursively pull plain text out of React children (for styling flags only). */
const extractText = (node) => {
    if (node == null) return '';
    if (typeof node === 'string' || typeof node === 'number') return String(node);
    if (Array.isArray(node)) return node.map(extractText).join('');
    if (node.props && node.props.children) return extractText(node.props.children);
    return '';
};

/* ── Custom markdown renderers ──────────────── */
const mdComponents = {
    // ... keep same styling
    table: ({ children }) => (
        <div className="overflow-x-auto my-4 rounded-xl border border-white/10 shadow-lg shadow-black/20">
            <table className="w-full text-sm border-collapse">{children}</table>
        </div>
    ),
    thead: ({ children }) => <thead className="bg-white/5 border-b border-white/10">{children}</thead>,
    th: ({ children }) => <th className="text-left px-4 py-2.5 text-xs font-bold text-slate-400 uppercase tracking-wider">{children}</th>,
    td: ({ children }) => <td className="px-4 py-2.5 border-t border-white/5 text-slate-300 text-[13px] leading-relaxed">{children}</td>,
    tr: ({ children }) => <tr className="hover:bg-white/[0.03] transition-colors">{children}</tr>,
    blockquote: ({ children }) => (
        <blockquote className="my-3 border-l-[3px] border-gold-400/70 bg-gold-500/5 rounded-r-xl px-4 py-3 text-[13px] text-slate-300 leading-relaxed not-italic">{children}</blockquote>
    ),
    h3: ({ children }) => <h3 className="flex items-center gap-2 text-[15px] font-extrabold text-white mt-5 mb-2 pb-1.5 border-b border-white/10">{children}</h3>,
    h4: ({ children }) => {
        const text = extractText(children).trim();
        const isCaseCard = /^[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(text);
        return <h4 className={`text-[13.5px] font-bold mt-4 mb-1.5 ${isCaseCard ? 'text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 rounded-lg px-3 py-2' : 'text-slate-200'}`}>{children}</h4>;
    },
    strong: ({ children }) => <strong className="font-bold text-white">{children}</strong>,
    p: ({ children }) => <p className="my-1.5 leading-relaxed">{children}</p>,
    ul: ({ children }) => <ul className="my-2 space-y-1 list-disc list-outside pl-5 text-[13px]">{children}</ul>,
    ol: ({ children }) => <ol className="my-2 space-y-1 list-decimal list-outside pl-5 text-[13px]">{children}</ol>,
    li: ({ children }) => <li className="leading-relaxed text-slate-300">{children}</li>,
    hr: () => <hr className="my-4 border-white/10" />,
    a: ({ href, children }) => <a href={href} target="_blank" rel="noreferrer" className="text-gold-400 hover:text-gold-300 underline decoration-gold-500/30 underline-offset-2 font-medium transition-colors">{children}</a>,
    code: ({ inline, children }) => inline ? <code className="bg-white/10 text-gold-300 px-1.5 py-0.5 rounded text-[12px] font-mono">{children}</code> : <code className="block bg-black/40 text-slate-200 rounded-xl p-4 my-3 text-[12px] overflow-x-auto font-mono border border-white/5">{children}</code>,
};

export default function ChatPage() {
    const [query, setQuery] = useState('');
    const [chat, setChat] = useState([]);
    const [isTyping, setIsTyping] = useState(false);
    const [showScrollBtn, setShowScrollBtn] = useState(false);
    
    // History State
    const [sessions, setSessions] = useState([]);
    const [activeSessionId, setActiveSessionId] = useState(null);
    const token = localStorage.getItem('justiceai_token');
    
    const chatEndRef = useRef(null);
    const chatContainerRef = useRef(null);
    const inputRef = useRef(null);

    const fetchSessions = async () => {
        if (!token) return;
        try {
            const res = await fetch('http://localhost:8000/api/v1/chat/sessions', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setSessions(data);
            }
        } catch(e) { console.error('Error fetching sessions:', e); }
    };

    useEffect(() => { fetchSessions(); }, [token]);
    useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chat, isTyping]);
    useEffect(() => { inputRef.current?.focus(); }, []);

    const handleScroll = () => {
        if (!chatContainerRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
        setShowScrollBtn(scrollHeight - scrollTop - clientHeight > 120);
    };

    const scrollToBottom = () => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    
    const handleNewChat = () => { setActiveSessionId(null); setChat([]); setQuery(''); inputRef.current?.focus(); };

    const loadSession = async (id) => {
        setActiveSessionId(id);
        setChat([]);
        setIsTyping(true); // show loading state briefly
        try {
            const res = await fetch(`http://localhost:8000/api/v1/chat/sessions/${id}/messages`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setChat(data.map(m => ({
                    type: m.role,
                    text: m.content,
                    sources: m.sources || [],
                    time: m.created_at ? new Date(m.created_at) : new Date()
                })));
            }
        } catch(e) { console.error('Error loading session:', e); }
        finally { setIsTyping(false); inputRef.current?.focus(); }
    };
    
    const deleteSession = async (e, id) => {
        e.stopPropagation();
        try {
            await fetch(`http://localhost:8000/api/v1/chat/sessions/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setSessions(prev => prev.filter(s => s.id !== id));
            if (activeSessionId === id) handleNewChat();
        } catch(err) { console.error('Failed to delete session', err); }
    };

    // Patch the most recent AI message in the chat list.
    const updateLastAi = (patch) => setChat(prev => {
        const copy = [...prev];
        for (let i = copy.length - 1; i >= 0; i--) {
            if (copy[i].type === 'ai') { copy[i] = { ...copy[i], ...patch }; break; }
        }
        return copy;
    });

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!query.trim() || isTyping) return;
        const userMessage = { type: 'user', text: query, time: new Date() };
        const priorChat = chat; // snapshot for conversation history (before adding this turn)
        setChat(prev => [...prev, userMessage]);
        const currentQuery = query;
        setQuery('');
        setIsTyping(true);

        let pSessionId = activeSessionId;
        if (!pSessionId && token) {
            try {
                const sRes = await fetch('http://localhost:8000/api/v1/chat/sessions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ title: "New Chat" })
                });
                if (sRes.ok) {
                    const sData = await sRes.json();
                    pSessionId = sData.id;
                    setActiveSessionId(pSessionId);
                    setSessions(prev => [sData, ...prev]);
                }
            } catch (error) { console.error('Failed to create session:', error); }
        }
        if (pSessionId && token) {
            fetch(`http://localhost:8000/api/v1/chat/sessions/${pSessionId}/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ role: 'user', content: currentQuery })
            }).then(() => fetchSessions());
        }

        const history = priorChat.map(msg => ({
            role: msg.type === 'user' ? 'user' : 'model',
            content: msg.text
        })).slice(-12);

        let started = false;
        const ensureAi = () => {
            if (!started) {
                started = true;
                setIsTyping(false);  // drop the typing dots; the streaming bubble takes over
                setChat(prev => [...prev, { type: 'ai', text: '', sources: [], time: new Date() }]);
            }
        };

        let streamedText = '';
        let finalText = '';
        let mappedSources = [];
        try {
            const response = await fetch('http://localhost:8000/api/v1/chat/stream', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify({ query: currentQuery, conversation_history: history, filters: null })
            });
            if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const parts = buffer.split('\n\n');
                buffer = parts.pop();  // keep the incomplete trailing chunk
                for (const part of parts) {
                    for (const line of part.split('\n')) {
                        if (!line.startsWith('data:')) continue;
                        const payload = line.slice(5).trim();
                        if (!payload) continue;
                        let ev;
                        try { ev = JSON.parse(payload); } catch { continue; }
                        if (ev.type === 'status') {
                            ensureAi();
                            if (!streamedText) updateLastAi({ text: `*${ev.content}*` });
                        } else if (ev.type === 'token') {
                            ensureAi();
                            streamedText += ev.content;
                            updateLastAi({ text: streamedText });
                        } else if (ev.type === 'final') {
                            ensureAi();
                            finalText = ev.content || streamedText;
                            updateLastAi({ text: finalText });
                        } else if (ev.type === 'sources') {
                            ensureAi();
                            const uniq = new Set();
                            mappedSources = (ev.sources || [])
                                .map(src => ({ name: (src.title || src.judge_name || src.court || 'Legal Document').substring(0, 70), court: src.court || '', year: src.year || '', pdf_url: src.pdf_url || '' }))
                                .filter(s => { if (uniq.has(s.name)) return false; uniq.add(s.name); return true; })
                                .slice(0, 5);
                            updateLastAi({ sources: mappedSources });
                        } else if (ev.type === 'error') {
                            ensureAi();
                            finalText = '⚠️ ' + (ev.message || 'Error generating the response.');
                            updateLastAi({ text: finalText });
                        }
                    }
                }
            }

            const answerText = finalText || streamedText || 'No response received.';
            if (pSessionId && token) {
                fetch(`http://localhost:8000/api/v1/chat/sessions/${pSessionId}/messages`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ role: 'ai', content: answerText, sources: mappedSources })
                });
            }
        } catch (error) {
            console.error('Backend error:', error);
            ensureAi();
            updateLastAi({ text: '⚠️ **Connection Error.** Please make sure the backend server is running.' });
        } finally {
            setIsTyping(false);
            inputRef.current?.focus();
        }
    };

    const handleSuggestion = (text) => { setQuery(text); inputRef.current?.focus(); };

    const suggestions = [
        { label: 'Bail under 302 PPC', text: 'What are the legal grounds for bail in murder cases under Section 302 PPC?', icon: '⚖️' },
        { label: 'Article 199 Writs', text: 'What powers does the Islamabad High Court have under Article 199 to issue writs?', icon: '📜' },
        { label: 'Khula Procedure', text: 'What is the legal procedure for khula and dissolution of marriage in Pakistan?', icon: '💍' },
        { label: 'FIR Quashment', text: 'Under what circumstances can an FIR be quashed by the High Court?', icon: '🔍' },
    ];

    const formatTime = (date) => date?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || '';

    return (
        <div className="flex-1 flex h-full bg-[#0a0f1e] overflow-hidden w-full">
            {/* ── Sidebar (History) ── */}
            <div className="hidden md:flex flex-col w-72 border-r border-white/5 bg-[#0a0f1e]/80 backdrop-blur-xl shrink-0">
                <div className="p-4 border-b border-white/5">
                    <button onClick={handleNewChat}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-gold-500/30 text-sm font-semibold text-gold-400 hover:bg-gold-500/10 hover:border-gold-500/50 transition-all">
                        <Plus size={16} /> New Conversation
                    </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-3 space-y-1 scrollbar-hide">
                    {sessions.length === 0 ? (
                        <div className="text-center text-slate-500 text-xs mt-6 p-4">
                            No chat history yet. Start a conversation!
                        </div>
                    ) : (
                        sessions.map(s => (
                            <div key={s.id} 
                                onClick={() => loadSession(s.id)}
                                className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all border
                                    ${activeSessionId === s.id 
                                        ? 'bg-white/10 border-white/20' 
                                        : 'bg-transparent border-transparent hover:bg-white/5 hover:border-white/10'}`}>
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <MessageSquare size={16} className={activeSessionId === s.id ? 'text-gold-400' : 'text-slate-500'} />
                                    <div className="flex flex-col overflow-hidden">
                                        <span className={`text-[13px] font-medium truncate w-40 ${activeSessionId === s.id ? 'text-white' : 'text-slate-300'}`}>
                                            {s.title}
                                        </span>
                                    </div>
                                </div>
                                <button className="opacity-0 hover:opacity-100 group-hover:opacity-100 p-1 text-slate-500 hover:text-red-400 transition-all"
                                    onClick={(e) => deleteSession(e, s.id)}>
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* ── Main Chat Area ── */}
            <div className="flex-1 flex flex-col h-full min-w-0">
                {/* ── Chat Header ── */}
                <div className="flex items-center justify-between px-6 h-[68px] border-b border-white/5 bg-[#0a0f1e]/80 backdrop-blur-xl flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <div className="absolute inset-0 bg-gold-400/20 blur-lg rounded-xl animate-pulse-slow" />
                            <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-gold-500 to-amber-600 flex items-center justify-center shadow-lg shadow-gold-500/20">
                                <Scale size={20} className="text-white" />
                            </div>
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-white">Justice AI Legal Chat</h2>
                            <p className="text-[11px] text-slate-500 font-medium flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)] animate-pulse" />
                                Hybrid RAG Engine Active — {chat.filter(m => m.type === 'user').length} queries
                            </p>
                        </div>
                    </div>
                </div>

                {/* ── Messages Area ── */}
                <div ref={chatContainerRef} onScroll={handleScroll}
                    className="flex-1 overflow-y-auto px-4 md:px-6 py-6 relative scrollbar-hide">

                    {chat.length === 0 && !isTyping ? (
                        <div className="h-full flex flex-col items-center justify-center max-w-2xl mx-auto text-center animate-fade-in">
                            <div className="relative mb-8">
                                <div className="absolute inset-0 bg-gold-400/15 blur-3xl rounded-full scale-150 animate-pulse-slow" />
                                <div className="relative w-24 h-24 rounded-3xl bg-gradient-to-br from-[#111827] to-[#1a1f35] border border-white/10 shadow-2xl flex items-center justify-center">
                                    <Scale size={48} className="text-gold-400" />
                                </div>
                            </div>
                            <h2 className="font-display text-3xl md:text-4xl font-extrabold text-white mb-3">How can I <span className="text-gradient-gold">help</span> you today?</h2>
                            <p className="text-slate-500 text-base mb-10 max-w-md">
                                Ask any legal question about Pakistani law. I'll search through Supreme Court, High Court judgments and Federal Statutes.
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                                {suggestions.map((s, i) => (
                                    <button key={i} onClick={() => handleSuggestion(s.text)}
                                        className="text-left p-5 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:border-gold-500/30 hover:bg-white/[0.06] hover:-translate-y-1 hover:shadow-xl hover:shadow-gold-500/5 transition-all duration-300 group">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-lg">{s.icon}</span>
                                            <span className="text-sm font-bold text-white group-hover:text-gold-400 transition-colors">{s.label}</span>
                                        </div>
                                        <p className="text-xs text-slate-500 leading-relaxed">{s.text}</p>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="max-w-3xl mx-auto space-y-6 pb-4">
                            {chat.map((msg, idx) => (
                                <div key={idx} className={`chat-msg flex gap-3 ${msg.type === 'user' ? 'flex-row-reverse' : ''}`}>
                                    <div className={`w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center mt-1 shadow-lg
                                        ${msg.type === 'user'
                                            ? 'bg-gradient-to-br from-indigo-500 to-purple-600 shadow-indigo-500/20'
                                            : 'bg-gradient-to-br from-gold-500 to-amber-600 shadow-gold-500/20'}`}>
                                        {msg.type === 'user' ? <User size={16} className="text-white" /> : <Scale size={16} className="text-white" />}
                                    </div>

                                    <div className={`flex flex-col max-w-[85%] ${msg.type === 'user' ? 'items-end' : 'items-start'}`}>
                                        <div className={`text-[13px] font-semibold mb-1.5 flex items-center gap-2
                                            ${msg.type === 'user' ? 'text-slate-500' : 'text-gold-400'}`}>
                                            {msg.type === 'user' ? 'You' : 'Justice AI'}
                                            <span className="text-[11px] text-slate-600 font-normal">{formatTime(msg.time)}</span>
                                        </div>

                                        <div className={`px-5 py-4 rounded-2xl text-[14px] leading-relaxed
                                            ${msg.type === 'user'
                                                ? 'bg-gradient-to-r from-indigo-600 to-purple-700 text-white rounded-tr-md shadow-lg shadow-indigo-500/10'
                                                : 'bg-white/[0.04] border border-white/[0.08] text-slate-300 rounded-tl-md shadow-lg shadow-black/20 prose prose-invert max-w-none prose-sm'}`}>
                                            {msg.type === 'ai' ? (
                                                <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>{msg.text}</ReactMarkdown>
                                            ) : msg.text}
                                        </div>

                                        {msg.sources && msg.sources.length > 0 && (
                                            <div className="mt-2.5 space-y-1.5">
                                                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                                                    <BookOpen size={11} className="text-gold-400" /> Sources
                                                </span>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {msg.sources.map((src, sIdx) => (
                                                        <a key={sIdx} href={src.pdf_url || '#'} target="_blank" rel="noreferrer"
                                                            className="inline-flex items-center gap-1 bg-gold-500/10 border border-gold-500/20 text-gold-400 text-[11px] font-semibold px-2.5 py-1 rounded-lg hover:bg-gold-500/20 hover:border-gold-500/30 transition-all cursor-pointer">
                                                            {src.name}
                                                            {src.year && <span className="text-gold-600">({src.year})</span>}
                                                        </a>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}

                            {isTyping && (
                                <div className="flex gap-3 animate-fade-in">
                                    <div className="w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center mt-1 shadow-lg bg-gradient-to-br from-gold-500 to-amber-600 shadow-gold-500/20">
                                        <Scale size={16} className="text-white" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[13px] font-semibold text-gold-400 mb-1.5">Justice AI</span>
                                        <div className="bg-white/[0.04] border border-white/[0.08] px-5 py-4 rounded-2xl rounded-tl-md shadow-lg flex items-center gap-2">
                                            <div className="w-2 h-2 bg-gold-400 rounded-full typing-dot" />
                                            <div className="w-2 h-2 bg-gold-400 rounded-full typing-dot" />
                                            <div className="w-2 h-2 bg-gold-400 rounded-full typing-dot" />
                                            <span className="text-xs text-slate-500 ml-2 font-medium flex items-center gap-1.5">
                                                <Cpu size={12} className="animate-spin" /> Processing...
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div ref={chatEndRef} />
                        </div>
                    )}

                    {showScrollBtn && (
                        <button onClick={scrollToBottom}
                            className="fixed bottom-28 right-8 w-10 h-10 bg-white/10 backdrop-blur-xl border border-white/10 rounded-full shadow-lg flex items-center justify-center hover:bg-white/15 transition-all z-20 animate-fade-in">
                            <ArrowDown size={18} className="text-gold-400" />
                        </button>
                    )}
                </div>

                {/* ── Input Area ── */}
                <div className="px-4 md:px-6 py-5 bg-[#0a0f1e]/80 backdrop-blur-xl border-t border-white/5 flex-shrink-0 z-10 relative">
                    <div className="max-w-3xl mx-auto">
                        <form onSubmit={handleSearch} className="relative flex items-center">
                            <div className="flex-1 relative group">
                                <div className="absolute -inset-0.5 bg-gradient-to-r from-gold-500/20 via-amber-500/10 to-gold-500/20 rounded-2xl blur opacity-0 group-focus-within:opacity-100 transition-opacity duration-500" />
                                <input ref={inputRef} type="text" value={query} onChange={(e) => setQuery(e.target.value)}
                                    placeholder="Ask a legal question..."
                                    className="relative w-full bg-white/[0.04] text-white py-4 pl-5 pr-14 rounded-2xl border border-white/[0.08] focus:border-gold-500/40 focus:ring-2 focus:ring-gold-500/10 focus:outline-none placeholder:text-slate-600 font-medium text-[14.5px] transition-all" />
                                <button type="submit" disabled={!query.trim() || isTyping}
                                    className="btn-sheen absolute right-2 top-1/2 -translate-y-1/2 p-3 rounded-xl transition-all duration-300
                                        disabled:opacity-20 disabled:cursor-not-allowed
                                        bg-gold-gradient text-[#2a1e05] shadow-glow-gold hover:scale-105">
                                    <Send size={16} />
                                </button>
                            </div>
                        </form>
                        <div className="flex items-center justify-between mt-3 px-1">
                            <span className="text-[11px] text-slate-600 font-medium flex items-center gap-1.5">
                                <Sparkles size={11} className="text-gold-500" />
                                Powered by Hybrid RAG + Groq LLM
                            </span>
                            <span className="text-[11px] text-slate-600">Always verify critical citations</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
