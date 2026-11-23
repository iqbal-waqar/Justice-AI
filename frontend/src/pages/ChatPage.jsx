import React, { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiFetch, SessionExpiredError, isUrduText, getAnswerLang, setAnswerLang } from '../api';
import { ArrowDown, Gavel, HeartHandshake, MessageSquare, PenSquare, ScrollText, ShieldAlert, Trash2 } from 'lucide-react';
import { AssistantMessage, AssistantThinking, Composer, UserMessage } from '../components/chat';
import { LogoMark } from '../components/Logo';
import { LanguageToggle, useI18n } from '../i18n';

export default function ChatPage() {
    const { t, lang } = useI18n();
    const [query, setQuery] = useState('');
    const [chat, setChat] = useState([]);
    const [isTyping, setIsTyping] = useState(false);   // waiting for the first status / token
    const [busy, setBusy] = useState(false);           // a question is being answered
    const [showScrollBtn, setShowScrollBtn] = useState(false);
    // Answer language: 'en' answers in English unless the question is typed in Urdu
    // script; 'ur' always answers in Urdu. Remembered per browser.
    const [answerLang, setAnswerLangState] = useState(getAnswerLang());
    const changeAnswerLang = (lang) => { setAnswerLangState(lang); setAnswerLang(lang); };

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
            const res = await apiFetch('/api/v1/chat/sessions', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setSessions(data);
            }
        } catch(e) { console.error('Error fetching sessions:', e); }
    };

    useEffect(() => { fetchSessions(); }, [token]);

    // Deep links from the dashboard: /chat?session=12 opens a conversation,
    // /chat?q=... pre-fills a question.
    const [searchParams, setSearchParams] = useSearchParams();
    useEffect(() => {
        const sid = Number(searchParams.get('session'));
        const q = searchParams.get('q');
        if (sid) loadSession(sid);
        if (q) setQuery(q);
        if (sid || q) setSearchParams({}, { replace: true });
    }, []);
    // Follow the answer as it streams, unless the reader has scrolled up to read.
    useEffect(() => { if (!showScrollBtn) chatEndRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' }); }, [chat, isTyping]);
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
            const res = await apiFetch(`/api/v1/chat/sessions/${id}/messages`, {
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
            await apiFetch(`/api/v1/chat/sessions/${id}`, {
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

    // Append a live research step to the most recent AI message (skips duplicates).
    const appendStep = (step) => setChat(prev => {
        const copy = [...prev];
        for (let i = copy.length - 1; i >= 0; i--) {
            if (copy[i].type === 'ai') {
                const steps = copy[i].steps || [];
                if (steps[steps.length - 1] !== step) copy[i] = { ...copy[i], steps: [...steps, step] };
                break;
            }
        }
        return copy;
    });

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!query.trim() || busy) return;
        const userMessage = { type: 'user', text: query, time: new Date() };
        const priorChat = chat; // snapshot for conversation history (before adding this turn)
        setChat(prev => [...prev, userMessage]);
        const currentQuery = query;
        setQuery('');
        setIsTyping(true);
        setBusy(true);

        let pSessionId = activeSessionId;
        if (!pSessionId && token) {
            try {
                const sRes = await apiFetch('/api/v1/chat/sessions', {
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
            apiFetch(`/api/v1/chat/sessions/${pSessionId}/messages`, {
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
                setChat(prev => [...prev, { type: 'ai', text: '', sources: [], steps: [], time: new Date(), streaming: true }]);
            }
        };

        let streamedText = '';
        let finalText = '';
        let mappedSources = [];
        try {
            const response = await apiFetch('/api/v1/chat/stream', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify({ query: currentQuery, conversation_history: history, filters: null, language: answerLang === 'ur' ? 'ur' : 'auto' })
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
                            appendStep(ev.content);
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
                                .map(src => ({ name: (src.title || src.judge_name || src.court || t('Legal document')).substring(0, 70), court: src.court || '', year: src.year || '', pdf_url: src.pdf_url || '' }))
                                .filter(s => { if (uniq.has(s.name)) return false; uniq.add(s.name); return true; })
                                .slice(0, 8);
                            updateLastAi({ sources: mappedSources });
                        } else if (ev.type === 'error') {
                            ensureAi();
                            finalText = '⚠️ ' + (ev.message || t('Error generating the response.'));
                            updateLastAi({ text: finalText });
                        }
                    }
                }
            }

            const answerText = finalText || streamedText || t('No response received.');
            if (pSessionId && token) {
                apiFetch(`/api/v1/chat/sessions/${pSessionId}/messages`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ role: 'ai', content: answerText, sources: mappedSources })
                });
            }
        } catch (error) {
            if (error instanceof SessionExpiredError) return;  // already redirecting to /login
            console.error('Backend error:', error);
            ensureAi();
            updateLastAi({ text: '⚠️ ' + t('**Connection error.** Please make sure the backend server is running.') });
        } finally {
            setIsTyping(false);
            setBusy(false);
            updateLastAi({ streaming: false });
            inputRef.current?.focus();
        }
    };

    const handleSuggestion = (text) => { setQuery(text); inputRef.current?.focus(); };

    const suggestionsEn = [
        { label: 'Bail in a murder case', text: 'What are the legal grounds for bail in murder cases under Section 302 PPC?', icon: Gavel },
        { label: 'Writ jurisdiction', text: 'What powers does the High Court have under Article 199 to issue writs?', icon: ScrollText },
        { label: 'Khula procedure', text: 'What is the legal procedure for khula and dissolution of marriage in Pakistan?', icon: HeartHandshake },
        { label: 'Quashing an FIR', text: 'Under what circumstances can an FIR be quashed by the High Court?', icon: ShieldAlert },
    ];
    const suggestionsUr = [
        { label: 'دفعہ 302 میں ضمانت', text: 'قتل کے مقدمے میں دفعہ 302 PPC کے تحت ضمانت بعد از گرفتاری کن بنیادوں پر ملتی ہے؟', icon: Gavel },
        { label: 'آرٹیکل 199 رٹ', text: 'آرٹیکل 199 کے تحت ہائی کورٹ کون سی رٹ جاری کر سکتی ہے؟', icon: ScrollText },
        { label: 'خلع کا طریقہ کار', text: 'پاکستان میں خلع اور تنسیخ نکاح کا قانونی طریقہ کار کیا ہے؟', icon: HeartHandshake },
        { label: 'ایف آئی آر کا اخراج', text: 'ہائی کورٹ کن حالات میں ایف آئی آر ختم کر سکتی ہے؟', icon: ShieldAlert },
    ];
    // Urdu questions when the answer language or the interface is Urdu; they are real
    // questions, so they also go into the box as typed.
    const suggestUr = answerLang === 'ur' || lang === 'ur';
    const suggestions = suggestUr ? suggestionsUr : suggestionsEn;
    const queryIsUrdu = isUrduText(query);

    const formatTime = (date) => date?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || '';

    const activeTitle = sessions.find(s => s.id === activeSessionId)?.title;
    const empty = chat.length === 0 && !isTyping;
    const ur = answerLang === 'ur';

    // Conversation list grouped by when it was last used.
    const groupOf = (s) => {
        const when = new Date(s.updated_at || s.created_at || 0);
        if (Number.isNaN(when.getTime()) || when.getTime() === 0) return 'recent';
        const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
        const days = (startOfToday - when) / 86400000;
        if (days <= 0) return 'today';
        if (days <= 1) return 'yesterday';
        if (days <= 7) return 'week';
        return 'older';
    };
    const groupLabels = { today: t('Today'), yesterday: t('Yesterday'), week: t('Previous 7 days'), older: t('Older'), recent: t('Recent') };
    const grouped = ['today', 'yesterday', 'week', 'older', 'recent']
        .map(key => ({ key, items: sessions.filter(s => groupOf(s) === key) }))
        .filter(g => g.items.length);

    const languageToggle = (
        <div role="radiogroup" aria-label={t('Answer language')} title={t('Language of the answer')}
            className="flex items-center gap-0.5 p-0.5 rounded-full bg-paper-100 ring-1 ring-inset ring-line">
            {[{ key: 'en', label: 'English' }, { key: 'ur', label: 'اردو' }].map(opt => (
                <button key={opt.key} type="button" role="radio" aria-checked={answerLang === opt.key}
                    onClick={() => changeAnswerLang(opt.key)}
                    className={`px-3 h-7 rounded-full text-[12.5px] font-semibold transition-all ${opt.key === 'ur' ? 'urdu-input leading-none' : ''}
                        ${answerLang === opt.key ? 'bg-white text-ink-950 shadow-soft ring-1 ring-line' : 'text-slate-500 hover:text-ink-950'}`}>
                    {opt.label}
                </button>
            ))}
        </div>
    );

    const composer = (
        <Composer value={query} onChange={setQuery} onSubmit={handleSearch} disabled={busy} inputRef={inputRef}
            urdu={queryIsUrdu || (ur && !query)} voiceLanguage={answerLang} left={languageToggle}
            placeholder={ur ? 'اپنا قانونی سوال اردو یا انگریزی میں لکھیں…' : t('Ask a legal question in English or اردو…')}
            footer={t('Justice AI cites real judgments, but it can make mistakes. Read the cited judgment before relying on it.')} />
    );

    return (
        <div className="flex-1 flex h-full bg-white overflow-hidden w-full">
            {/* ── Conversation history ── */}
            <aside className="hidden md:flex flex-col w-[272px] border-e border-line bg-paper-50 shrink-0">
                <div className="h-[72px] px-4 flex items-center border-b border-line flex-shrink-0">
                    <button onClick={handleNewChat}
                        className="w-full flex items-center gap-2.5 px-3.5 h-10 rounded-xl bg-ink-900 text-white text-[13.5px] font-semibold shadow-[0_1px_2px_rgba(11,18,32,0.25),inset_0_1px_0_rgba(255,255,255,0.08)] hover:bg-ink-800 transition-colors">
                        <PenSquare size={15} className="text-gold-300" />
                        <span className="flex-1 text-start">{t('New chat')}</span>
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto px-3 py-3 scrollbar-hide">
                    {sessions.length === 0 ? (
                        <div className="mx-1 mt-2 p-4 rounded-2xl border border-dashed border-line-strong text-center">
                            <MessageSquare size={18} className="mx-auto text-slate-300 mb-2" />
                            <p className="text-slate-500 text-[12.5px] leading-relaxed">{t('Your conversations will appear here.')}</p>
                        </div>
                    ) : grouped.map(group => (
                        <div key={group.key} className="mb-4">
                            <div className="px-2.5 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">{groupLabels[group.key]}</div>
                            <div className="space-y-0.5">
                                {group.items.map(s => {
                                    const active = activeSessionId === s.id;
                                    return (
                                        <div key={s.id} onClick={() => loadSession(s.id)}
                                            className={`group relative flex items-center gap-2 ps-3 pe-1.5 h-10 rounded-xl cursor-pointer transition-all
                                                ${active ? 'bg-white text-ink-950 shadow-soft ring-1 ring-line' : 'text-slate-600 hover:bg-paper-200/70 hover:text-ink-950'}`}>
                                            {active && <span className="absolute start-0 top-2.5 bottom-2.5 w-[3px] rounded-e-full bg-gold-500" />}
                                            <span dir="auto" className={`flex-1 truncate text-start text-[13.5px] ${active ? 'font-semibold' : ''}`}>{s.title}</span>
                                            <button title={t('Delete conversation')} aria-label={t('Delete conversation')} onClick={(e) => deleteSession(e, s.id)}
                                                className="opacity-0 group-hover:opacity-100 focus:opacity-100 w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all">
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </aside>

            {/* ── Conversation ── */}
            <div className="flex-1 flex flex-col h-full min-w-0">
                <header className="flex items-center justify-between gap-3 px-6 h-[72px] border-b border-line bg-white/85 backdrop-blur-xl flex-shrink-0 z-10">
                    <div className="flex items-center gap-3.5 min-w-0">
                        <div className="relative w-10 h-10 rounded-xl bg-ink-gradient flex items-center justify-center flex-shrink-0 shadow-[0_6px_16px_-6px_rgba(11,18,32,0.55)] ring-1 ring-white/5">
                            <span className="absolute inset-0 rounded-xl bg-ink-sheen" />
                            <MessageSquare size={18} className="relative text-gold-300" />
                        </div>
                        <div className="min-w-0">
                            <h1 className="page-title text-[21px] leading-tight text-ink-950 truncate" dir={activeTitle ? 'auto' : undefined}>{activeTitle || t('Legal research')}</h1>
                            <p className="text-[13px] text-slate-500 truncate mt-0.5">{t('Answers grounded in Pakistani judgments and statutes')}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <button onClick={handleNewChat} className="md:hidden inline-flex items-center gap-1.5 px-3 h-9 rounded-xl border border-line-strong bg-white text-[13px] font-semibold text-ink-950 shadow-soft">
                            <PenSquare size={14} /> {t('New chat')}
                        </button>
                        <span className="w-px h-6 bg-line mx-1 hidden sm:block" />
                        <LanguageToggle />
                    </div>
                </header>

                {empty ? (
                    /* ── Start screen: greeting, composer, suggestions ── */
                    <div className="relative flex-1 overflow-y-auto">
                        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(60%_70%_at_50%_0%,rgba(212,168,83,0.13)_0%,rgba(250,249,246,0.6)_45%,transparent_75%)]" />
                        <div className="relative min-h-full flex flex-col items-center justify-center px-4 py-12">
                            <div className="relative mb-7">
                                <span aria-hidden className="absolute -inset-3 rounded-[22px] bg-gold-400/20 blur-xl" />
                                <span className="relative block"><LogoMark size={56} /></span>
                            </div>
                            <span className="inline-flex items-center gap-2 h-7 px-3 rounded-full bg-white ring-1 ring-line shadow-soft text-[12px] font-semibold text-ink-800 mb-4">
                                <span className="w-1.5 h-1.5 rounded-full bg-gold-500" />
                                {t('Every answer cites the judgment it came from')}
                            </span>
                            <h1 className={`page-title ${lang === 'ur' ? 'text-[1.7rem] sm:text-[2rem]' : 'text-[2.1rem] sm:text-[2.6rem] leading-[1.15]'} text-ink-950 mb-3 text-center max-w-2xl`}>
                                {t('What would you like to research?')}
                            </h1>
                            <p className="text-slate-500 text-[15px] leading-relaxed mb-9 text-center max-w-xl">
                                {t('Answers come from judgments of the Supreme Court, the Lahore and Islamabad High Courts and Punjab district courts, and from federal and Punjab statutes, with every source linked.')}
                            </p>
                            {composer}
                            <div className="w-full max-w-3xl mt-9">
                                <div className="text-[11.5px] font-semibold uppercase tracking-[0.12em] text-slate-400 mb-3 px-1">{t('Try asking')}</div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {suggestions.map((s, i) => (
                                        <button key={i} onClick={() => handleSuggestion(s.text)} dir={suggestUr ? 'rtl' : 'ltr'}
                                            className={`${suggestUr ? 'text-right urdu-input' : 'text-left'} group flex items-start gap-3.5 p-4 rounded-2xl border border-line bg-white shadow-soft hover:border-gold-400/60 hover:shadow-lift hover:-translate-y-0.5 transition-all duration-200`}>
                                            <span className="w-9 h-9 rounded-xl bg-paper-200 ring-1 ring-inset ring-line flex items-center justify-center flex-shrink-0 transition-colors group-hover:bg-ink-900 group-hover:ring-ink-900">
                                                <s.icon size={16} className="text-gold-700 group-hover:text-gold-300 transition-colors" />
                                            </span>
                                            <span className="min-w-0">
                                                <span className="block text-[14px] font-semibold text-ink-950">{s.label}</span>
                                                <span className="block text-[13px] leading-relaxed text-slate-500 mt-0.5">{s.text}</span>
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <>
                        <div ref={chatContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto relative">
                            <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-10 pb-12 space-y-10">
                                {chat.map((msg, idx) => msg.type === 'user'
                                    ? <UserMessage key={idx} text={msg.text} />
                                    : <AssistantMessage key={idx} text={msg.text} steps={msg.steps} sources={msg.sources}
                                        time={formatTime(msg.time)} done={!msg.streaming} />)}
                                {isTyping && <AssistantThinking label={busy ? t('Reading your question') : t('Opening conversation')} />}
                                <div ref={chatEndRef} />
                            </div>
                            {showScrollBtn && (
                                <div className="sticky bottom-3 h-0 flex justify-center z-20">
                                    <button onClick={scrollToBottom} aria-label={t('Scroll to latest')}
                                        className="-translate-y-full w-10 h-10 bg-white ring-1 ring-line rounded-full shadow-lift flex items-center justify-center hover:bg-paper-50 transition-colors">
                                        <ArrowDown size={17} className="text-ink-900" />
                                    </button>
                                </div>
                            )}
                        </div>
                        <div className="relative px-4 sm:px-6 pb-4 pt-2 flex-shrink-0 bg-white">
                            <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-10 h-10 bg-gradient-to-t from-white to-white/0" />
                            {composer}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
