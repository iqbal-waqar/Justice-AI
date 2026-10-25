import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Scale, MessageSquare, CalendarDays, Search, Shield, Zap, BookOpen,
    ArrowRight, Sparkles, Brain, Database, GraduationCap, Star,
    ChevronRight, Globe, Lock, BarChart3, Users, Clock, CheckCircle2
} from 'lucide-react';

/* ── Animated counter hook ── */
function useCounter(end, duration = 2000, startOnView = true) {
    const [count, setCount] = useState(0);
    const ref = useRef(null);
    const started = useRef(false);

    useEffect(() => {
        if (!startOnView) return;
        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting && !started.current) {
                started.current = true;
                let start = 0;
                const step = end / (duration / 16);
                const timer = setInterval(() => {
                    start += step;
                    if (start >= end) { setCount(end); clearInterval(timer); }
                    else setCount(Math.floor(start));
                }, 16);
            }
        }, { threshold: 0.3 });
        if (ref.current) observer.observe(ref.current);
        return () => observer.disconnect();
    }, [end, duration, startOnView]);

    return [count, ref];
}

/* ── Scroll-reveal hook ── */
function useReveal() {
    const ref = useRef(null);
    const [visible, setVisible] = useState(false);
    useEffect(() => {
        const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold: 0.15 });
        if (ref.current) obs.observe(ref.current);
        return () => obs.disconnect();
    }, []);
    return [ref, visible];
}

/* ── Floating particles component ── */
function Particles({ count = 30 }) {
    const particles = useRef(
        Array.from({ length: count }, (_, i) => ({
            id: i,
            x: Math.random() * 100,
            y: Math.random() * 100,
            size: Math.random() * 3 + 1,
            duration: Math.random() * 20 + 10,
            delay: Math.random() * 10,
            opacity: Math.random() * 0.5 + 0.1,
        }))
    ).current;

    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {particles.map(p => (
                <div key={p.id} className="absolute rounded-full bg-gold-400"
                    style={{
                        left: `${p.x}%`, top: `${p.y}%`,
                        width: p.size, height: p.size,
                        opacity: p.opacity,
                        animation: `float ${p.duration}s ease-in-out ${p.delay}s infinite alternate`,
                    }} />
            ))}
        </div>
    );
}

/* ── Glowing orb component ── */
function GlowOrb({ className, color = 'from-indigo-500/20 to-purple-500/10' }) {
    return <div className={`absolute rounded-full bg-gradient-to-br ${color} blur-3xl animate-pulse-slow ${className}`} />;
}

export default function HomePage() {
    const navigate = useNavigate();
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

    const handleMouseMove = (e) => {
        const { clientX, clientY } = e;
        setMousePos({ x: (clientX / window.innerWidth - 0.5) * 20, y: (clientY / window.innerHeight - 0.5) * 20 });
    };

    const [docs, docsRef] = useCounter(61794, 2500);
    const [courts, courtsRef] = useCounter(3, 1000);
    const [accuracy, accuracyRef] = useCounter(97, 2000);

    const [featRef, featVisible] = useReveal();
    const [howRef, howVisible] = useReveal();
    const [courtRef, courtVisible] = useReveal();
    const [ctaRef, ctaVisible] = useReveal();

    const features = [
        { icon: Brain, title: 'AI-Powered Legal Research', desc: 'Ask complex legal questions in plain language. Our hybrid RAG engine searches 61,000+ case law chunks across Supreme Court and High Court databases.', color: 'from-indigo-500 to-purple-600', glow: 'shadow-indigo-500/25' },
        { icon: Search, title: 'Hybrid Search Engine', desc: 'Combines semantic vector search with keyword matching (BM25) and cross-encoder reranking for the most accurate results.', color: 'from-emerald-500 to-teal-600', glow: 'shadow-emerald-500/25' },
        { icon: Shield, title: 'Anti-Hallucination Guards', desc: 'Every answer is grounded in actual court documents. If evidence is insufficient, the system tells you honestly.', color: 'from-amber-500 to-orange-600', glow: 'shadow-amber-500/25' },
        { icon: CalendarDays, title: 'Case Diary & Notes', desc: 'Track hearing dates, add case notes, and set reminders. Never miss a court date again with integrated case management.', color: 'from-pink-500 to-rose-600', glow: 'shadow-pink-500/25' },
        { icon: Database, title: 'Comprehensive Database', desc: 'Access judgments from Supreme Court, Islamabad High Court, Lahore High Court, and Federal/Provincial statutes.', color: 'from-sky-500 to-blue-600', glow: 'shadow-sky-500/25' },
        { icon: Zap, title: 'Conversational Memory', desc: 'Ask follow-up questions naturally. The system remembers your conversation context without re-searching.', color: 'from-violet-500 to-fuchsia-600', glow: 'shadow-violet-500/25' },
    ];

    const steps = [
        { num: '01', title: 'Ask Your Question', desc: 'Type any legal question in plain Urdu or English — from constitutional law to criminal appeals.', icon: MessageSquare },
        { num: '02', title: 'AI Retrieves & Analyzes', desc: 'Our hybrid engine searches across 61,000+ legal documents using semantic + keyword search with reranking.', icon: Brain },
        { num: '03', title: 'Get Cited Answers', desc: 'Receive accurate, citation-backed answers grounded in actual court judgments and statutes.', icon: CheckCircle2 },
    ];

    const courtData = [
        { name: 'Supreme Court of Pakistan', cases: '25,000+', icon: '⚖️', color: 'from-amber-500/20 to-amber-600/5', border: 'border-amber-500/30' },
        { name: 'Islamabad High Court', cases: '18,000+', icon: '🏛️', color: 'from-indigo-500/20 to-indigo-600/5', border: 'border-indigo-500/30' },
        { name: 'Lahore High Court', cases: '15,000+', icon: '📜', color: 'from-emerald-500/20 to-emerald-600/5', border: 'border-emerald-500/30' },
        { name: 'Federal & Provincial Laws', cases: '3,700+', icon: '📚', color: 'from-purple-500/20 to-purple-600/5', border: 'border-purple-500/30' },
    ];

    return (
        <div className="flex-1 overflow-y-auto bg-[#030712] text-white" onMouseMove={handleMouseMove}>

            {/* ═══════════ HERO SECTION ═══════════ */}
            <section className="relative min-h-[92vh] flex items-center justify-center overflow-hidden">
                {/* Background image with overlay */}
                <div className="absolute inset-0">
                    <img src="/images/hero-bg.png" alt="" className="w-full h-full object-cover opacity-50" />
                    <div className="absolute inset-0 bg-gradient-to-b from-[#030712]/60 via-[#030712]/40 to-[#030712]" />
                </div>

                <Particles count={40} />
                <GlowOrb className="w-[600px] h-[600px] -top-40 -right-40" color="from-indigo-600/15 to-purple-600/10" />
                <GlowOrb className="w-[500px] h-[500px] -bottom-32 -left-32" color="from-gold-500/15 to-amber-500/10" />

                {/* Parallax hero icon */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] h-[340px] opacity-15 pointer-events-none"
                    style={{ transform: `translate(calc(-50% + ${mousePos.x}px), calc(-50% + ${mousePos.y}px))` }}>
                    <img src="/images/justice-icon.png" alt="" className="w-full h-full object-contain" />
                </div>

                <div className="relative z-10 max-w-5xl mx-auto text-center px-6">
                    {/* Animated badge */}
                    <div className="inline-flex items-center gap-2 bg-white/5 backdrop-blur-xl border border-white/10 px-5 py-2.5 rounded-full text-sm font-semibold text-gold-400 mb-8"
                        style={{ animation: 'fadeIn 0.8s ease-out' }}>
                        <Sparkles size={16} className="animate-pulse" />
                        Pakistan's First AI Legal Research Platform
                    </div>

                    <h1 className="text-5xl sm:text-6xl md:text-8xl font-black tracking-tight leading-[1.05] mb-6"
                        style={{ animation: 'slideUp 0.8s ease-out 0.2s both' }}>
                        <span className="text-white">The Future of</span>
                        <br />
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-gold-400 via-amber-400 to-gold-600 drop-shadow-lg">
                            Legal Intelligence
                        </span>
                    </h1>

                    <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed mb-12 font-medium"
                        style={{ animation: 'slideUp 0.8s ease-out 0.4s both' }}>
                        Justice AI analyzes 61,000+ judgments from Pakistan's Supreme Court, High Courts, and Federal Statutes
                        — delivering citation-backed legal answers in seconds.
                    </p>

                    {/* CTA Buttons */}
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4"
                        style={{ animation: 'slideUp 0.8s ease-out 0.6s both' }}>
                        <button onClick={() => navigate('/chat')}
                            className="group relative flex items-center gap-3 bg-gradient-to-r from-gold-500 to-amber-600 hover:from-gold-400 hover:to-amber-500 text-white px-10 py-4.5 rounded-2xl font-bold text-base shadow-2xl shadow-gold-500/30 hover:-translate-y-1 transition-all duration-300 overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                            <MessageSquare size={20} />
                            Start Legal Research
                            <ArrowRight size={18} className="group-hover:translate-x-1.5 transition-transform" />
                        </button>
                        <button onClick={() => navigate('/diary')}
                            className="flex items-center gap-3 bg-white/5 hover:bg-white/10 backdrop-blur-xl text-white px-10 py-4.5 rounded-2xl font-bold text-base border border-white/10 hover:border-white/20 shadow-xl hover:-translate-y-1 transition-all duration-300">
                            <CalendarDays size={20} />
                            Open Case Diary
                        </button>
                    </div>

                    {/* Scroll indicator */}
                    <div className="mt-16 flex flex-col items-center gap-2 text-slate-500 text-xs font-medium"
                        style={{ animation: 'fadeIn 1s ease-out 1.2s both' }}>
                        <span>Scroll to explore</span>
                        <div className="w-5 h-8 rounded-full border-2 border-slate-600 flex justify-center pt-1.5">
                            <div className="w-1 h-2 bg-gold-400 rounded-full animate-bounce" />
                        </div>
                    </div>
                </div>
            </section>

            {/* ═══════════ STATS BAR ═══════════ */}
            <section className="relative py-12 border-y border-white/5 bg-white/[0.02] backdrop-blur-xl">
                <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 px-6">
                    {[
                        { ref: docsRef, val: docs.toLocaleString(), label: 'Legal Documents', suffix: '+' },
                        { ref: courtsRef, val: courts, label: 'Courts Covered', suffix: '' },
                        { ref: accuracyRef, val: accuracy, label: 'Accuracy Rate', suffix: '%' },
                        { ref: null, val: '24/7', label: 'Availability', suffix: '' },
                    ].map((s, i) => (
                        <div key={i} ref={s.ref} className="text-center group">
                            <div className="text-4xl md:text-5xl font-black bg-clip-text text-transparent bg-gradient-to-b from-white to-slate-400 group-hover:from-gold-400 group-hover:to-amber-400 transition-all duration-500">
                                {s.val}{s.suffix}
                            </div>
                            <div className="text-sm text-slate-500 font-medium mt-2 uppercase tracking-wider">{s.label}</div>
                        </div>
                    ))}
                </div>
            </section>

            {/* ═══════════ FEATURES GRID ═══════════ */}
            <section ref={featRef} className="relative px-6 py-24 overflow-hidden">
                <GlowOrb className="w-[500px] h-[500px] top-20 -right-40" color="from-purple-600/10 to-indigo-600/5" />

                <div className="max-w-6xl mx-auto">
                    <div className={`text-center mb-16 transition-all duration-1000 ${featVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                        <div className="inline-flex items-center gap-2 text-gold-400 text-sm font-bold uppercase tracking-widest mb-4">
                            <BarChart3 size={16} /> Core Capabilities
                        </div>
                        <h2 className="text-4xl md:text-5xl font-black text-white mb-5">
                            Everything You Need for
                            <br />
                            <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">Legal Research</span>
                        </h2>
                        <p className="text-slate-400 text-lg max-w-2xl mx-auto">
                            Built specifically for Pakistani lawyers and legal professionals with cutting-edge AI technology.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {features.map((f, i) => (
                            <div key={i}
                                className={`group relative p-7 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:border-white/15 hover:bg-white/[0.06] backdrop-blur-sm transition-all duration-500 cursor-default hover:-translate-y-2 hover:shadow-2xl ${f.glow} ${featVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}
                                style={{ transitionDelay: `${i * 100}ms` }}>
                                {/* Hover glow */}
                                <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${f.color} opacity-0 group-hover:opacity-5 transition-opacity duration-500`} />
                                <div className={`relative w-14 h-14 rounded-2xl bg-gradient-to-br ${f.color} flex items-center justify-center mb-5 shadow-lg ${f.glow} group-hover:scale-110 group-hover:rotate-3 transition-all duration-500`}>
                                    <f.icon size={26} className="text-white" />
                                </div>
                                <h3 className="relative text-lg font-bold text-white mb-2 group-hover:text-gold-400 transition-colors">{f.title}</h3>
                                <p className="relative text-sm text-slate-400 leading-relaxed">{f.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ═══════════ HOW IT WORKS ═══════════ */}
            <section ref={howRef} className="relative px-6 py-24 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-indigo-950/20 to-transparent" />

                <div className="relative max-w-5xl mx-auto">
                    <div className={`text-center mb-16 transition-all duration-1000 ${howVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                        <div className="inline-flex items-center gap-2 text-emerald-400 text-sm font-bold uppercase tracking-widest mb-4">
                            <Clock size={16} /> Simple Process
                        </div>
                        <h2 className="text-4xl md:text-5xl font-black text-white mb-5">
                            How It <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-teal-400">Works</span>
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {steps.map((s, i) => (
                            <div key={i}
                                className={`relative text-center p-8 rounded-2xl bg-white/[0.03] border border-white/[0.06] transition-all duration-700 ${howVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}
                                style={{ transitionDelay: `${i * 200}ms` }}>
                                <div className="text-6xl font-black text-white/5 absolute top-4 right-6">{s.num}</div>
                                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-emerald-500/20">
                                    <s.icon size={28} className="text-white" />
                                </div>
                                <h3 className="text-xl font-bold text-white mb-3">{s.title}</h3>
                                <p className="text-sm text-slate-400 leading-relaxed">{s.desc}</p>
                                {i < 2 && <ChevronRight size={24} className="hidden md:block absolute -right-5 top-1/2 -translate-y-1/2 text-slate-600" />}
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ═══════════ COURTS COVERED ═══════════ */}
            <section ref={courtRef} className="relative px-6 py-24 overflow-hidden">
                <div className="absolute inset-0">
                    <img src="/images/features-bg.png" alt="" className="w-full h-full object-cover opacity-20" />
                    <div className="absolute inset-0 bg-[#030712]/80" />
                </div>

                <div className="relative max-w-5xl mx-auto">
                    <div className={`text-center mb-16 transition-all duration-1000 ${courtVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                        <div className="inline-flex items-center gap-2 text-amber-400 text-sm font-bold uppercase tracking-widest mb-4">
                            <Globe size={16} /> Coverage
                        </div>
                        <h2 className="text-4xl md:text-5xl font-black text-white mb-5">
                            Courts & <span className="bg-clip-text text-transparent bg-gradient-to-r from-gold-400 to-amber-400">Databases</span>
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        {courtData.map((c, i) => (
                            <div key={i}
                                className={`group relative p-6 rounded-2xl bg-gradient-to-br ${c.color} border ${c.border} hover:scale-[1.03] transition-all duration-500 cursor-default ${courtVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}
                                style={{ transitionDelay: `${i * 150}ms` }}>
                                <div className="flex items-center gap-4">
                                    <div className="text-4xl">{c.icon}</div>
                                    <div>
                                        <h3 className="text-lg font-bold text-white">{c.name}</h3>
                                        <p className="text-sm text-slate-400 mt-1"><span className="text-gold-400 font-bold">{c.cases}</span> indexed documents</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ═══════════ CTA SECTION ═══════════ */}
            <section ref={ctaRef} className="relative px-6 py-28 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/50 via-[#030712] to-purple-950/30" />
                <Particles count={20} />
                <GlowOrb className="w-[400px] h-[400px] top-10 left-1/2 -translate-x-1/2" color="from-gold-500/15 to-amber-500/10" />

                <div className={`relative max-w-3xl mx-auto text-center transition-all duration-1000 ${ctaVisible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-12 scale-95'}`}>
                    <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-gold-500 to-amber-600 flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-gold-500/30 animate-pulse-slow">
                        <GraduationCap size={40} className="text-white" />
                    </div>
                    <h2 className="text-4xl md:text-5xl font-black text-white mb-5 leading-tight">
                        Ready to Transform Your<br />
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-gold-400 to-amber-400">Legal Practice?</span>
                    </h2>
                    <p className="text-slate-400 text-lg mb-10 max-w-xl mx-auto">
                        Join hundreds of lawyers already using Justice AI for faster, more accurate legal research.
                    </p>
                    <button onClick={() => navigate('/chat')}
                        className="group relative inline-flex items-center gap-3 bg-gradient-to-r from-gold-500 to-amber-600 hover:from-gold-400 hover:to-amber-500 text-white px-12 py-5 rounded-2xl font-bold text-lg shadow-2xl shadow-gold-500/30 hover:-translate-y-1 transition-all duration-300 overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                        <Scale size={22} />
                        Ask Your First Question
                        <ArrowRight size={20} className="group-hover:translate-x-1.5 transition-transform" />
                    </button>
                </div>
            </section>

            {/* ═══════════ FOOTER ═══════════ */}
            <footer className="px-6 py-10 border-t border-white/5 bg-[#030712]">
                <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-gold-500 to-amber-600 flex items-center justify-center shadow-lg">
                            <Scale size={18} className="text-white" />
                        </div>
                        <span className="font-extrabold text-white text-lg">Justice<span className="text-gold-400">AI</span></span>
                        <span className="text-slate-600 text-sm">— AI Legal Intelligence for Pakistan</span>
                    </div>
                    <p className="text-sm text-slate-600">
                        Always verify critical citations. This is an AI-assisted research tool.
                    </p>
                </div>
            </footer>
        </div>
    );
}
