import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../firebase';
import { Scale, Mail, Lock, User, Phone, MapPin, Briefcase, Eye, EyeOff, ArrowRight, Sparkles, Shield, CheckCircle } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function AuthPage() {
    const [isLogin, setIsLogin] = useState(true);
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    // Phone verification
    const [verifyStep, setVerifyStep] = useState(false);
    const [phoneNumber, setPhoneNumber] = useState('');
    const [otpCode, setOtpCode] = useState('');
    const [codeSent, setCodeSent] = useState(false);
    const [sendingCode, setSendingCode] = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [jwtToken, setJwtToken] = useState('');

    const [form, setForm] = useState({ full_name: '', email: '', password: '', phone: '', bar_council_id: '', specialization: '', city: '', notification_email: '' });
    const update = (key, val) => setForm(f => ({ ...f, [key]: val }));

    const saveAndRedirect = (data) => {
        localStorage.setItem('justiceai_token', data.access_token);
        localStorage.setItem('justiceai_user', JSON.stringify(data.user));
        if (!data.user.phone_verified) { setJwtToken(data.access_token); setVerifyStep(true); return; }
        navigate('/');
    };

    const handleGoogleSignIn = async () => {
        setError(''); setGoogleLoading(true);
        try {
            const result = await signInWithPopup(auth, googleProvider);
            const idToken = await result.user.getIdToken();
            const res = await fetch(`${API}/api/v1/auth/google`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ credential: idToken }) });
            const data = await res.json();
            if (!res.ok) { setError(data.detail || 'Google sign-in failed'); setGoogleLoading(false); return; }
            saveAndRedirect(data);
        } catch (err) { if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') setError(err.message || 'Google sign-in failed'); }
        setGoogleLoading(false);
    };

    const handleSubmit = async (e) => {
        e.preventDefault(); setError(''); setLoading(true);
        const endpoint = isLogin ? '/api/v1/auth/login' : '/api/v1/auth/signup';
        const body = isLogin ? { email: form.email, password: form.password } : { ...form, notification_email: form.notification_email || form.email };
        try {
            const res = await fetch(`${API}${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
            const data = await res.json();
            if (!res.ok) { setError(data.detail || 'Something went wrong'); setLoading(false); return; }
            saveAndRedirect(data);
        } catch { setError('Network error.'); }
        setLoading(false);
    };

    // Twilio WhatsApp OTP
    const handleSendCode = async () => {
        if (!phoneNumber.trim()) { setError('Please enter your WhatsApp number'); return; }
        setError(''); setSendingCode(true);
        try {
            const res = await fetch(`${API}/api/v1/auth/phone/send-code`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwtToken}` }, body: JSON.stringify({ phone: phoneNumber }) });
            const data = await res.json();
            if (!res.ok) { setError(data.detail || 'Failed to send code'); setSendingCode(false); return; }
            setCodeSent(true);
        } catch { setError('Network error'); }
        setSendingCode(false);
    };

    const handleVerifyCode = async () => {
        if (!otpCode.trim()) { setError('Please enter the code'); return; }
        setError(''); setVerifying(true);
        try {
            const res = await fetch(`${API}/api/v1/auth/phone/verify`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwtToken}` }, body: JSON.stringify({ phone: phoneNumber, code: otpCode }) });
            const data = await res.json();
            if (!res.ok) { setError(data.detail || 'Invalid code'); setVerifying(false); return; }
            localStorage.setItem('justiceai_user', JSON.stringify(data));
            navigate('/');
        } catch { setError('Network error'); }
        setVerifying(false);
    };

    const inputClass = "w-full pl-11 pr-4 py-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white placeholder-white/40 text-sm focus:outline-none focus:border-amber-400/60 focus:ring-1 focus:ring-amber-400/30 transition-all";
    const labelIcon = "absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40";

    // ═══ PHONE VERIFICATION SCREEN ═══
    if (verifyStep) {
        return (
            <div className="min-h-screen bg-[#0c1220] flex items-center justify-center p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl" />
                <div className="absolute bottom-0 left-0 w-72 h-72 bg-indigo-500/5 rounded-full blur-3xl" />
                <div className="w-full max-w-md relative z-10">
                    <div className="flex items-center gap-3 mb-10 justify-center">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20"><Scale size={24} className="text-white" /></div>
                        <div><h1 className="text-xl font-black text-white">JusticeAI</h1><p className="text-[10px] text-amber-400/80 tracking-widest uppercase">Legal Intelligence</p></div>
                    </div>
                    <div className="flex justify-center mb-6">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-xl shadow-emerald-500/20"><Phone size={28} className="text-white" /></div>
                    </div>
                    <h2 className="text-2xl font-black text-white text-center mb-2">{codeSent ? 'Enter Verification Code' : 'Verify WhatsApp Number'}</h2>
                    <p className="text-sm text-white/40 text-center mb-8">{codeSent ? 'We sent a 6-digit code to your WhatsApp' : 'Add your WhatsApp number for hearing reminders'}</p>
                    {error && <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">{error}</div>}

                    {!codeSent ? (
                        <div className="space-y-4">
                            <div className="relative"><Phone size={16} className={labelIcon} /><input value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} placeholder="03152876491" className={inputClass} type="tel" /></div>
                            <p className="text-xs text-white/30 px-1">📱 A 6-digit code will be sent to this number on WhatsApp</p>
                            <button onClick={handleSendCode} disabled={sendingCode}
                                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-bold text-sm shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                                {sendingCode ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><ArrowRight size={16} /> Send Code via WhatsApp</>}
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex justify-center gap-2">
                                {[...Array(6)].map((_, i) => (
                                    <div key={i} className={`w-11 h-14 rounded-xl border-2 flex items-center justify-center text-xl font-black transition-all ${otpCode[i] ? 'border-amber-400 bg-amber-400/10 text-amber-400' : 'border-white/20 bg-white/5 text-white/20'}`}>{otpCode[i] || '·'}</div>
                                ))}
                            </div>
                            <input value={otpCode} onChange={e => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="Enter 6-digit code" type="tel" maxLength={6} autoFocus
                                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white text-center text-lg tracking-[0.5em] font-bold placeholder-white/20 focus:outline-none focus:border-amber-400/60 transition-all" />
                            <button onClick={handleVerifyCode} disabled={verifying || otpCode.length !== 6}
                                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-white font-bold text-sm shadow-lg shadow-amber-500/20 hover:shadow-amber-500/40 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                                {verifying ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><CheckCircle size={16} /> Verify Number</>}
                            </button>
                            <button onClick={() => { setCodeSent(false); setOtpCode(''); setError(''); }} className="w-full py-2 text-sm text-white/30 hover:text-white/60 transition-colors">← Change number</button>
                        </div>
                    )}
                    <button onClick={() => navigate('/')} className="w-full mt-4 py-2 text-sm text-white/20 hover:text-white/40 transition-colors">Skip for now</button>
                </div>
            </div>
        );
    }

    // ═══ LOGIN / SIGNUP SCREEN ═══
    return (
        <div className="min-h-screen flex">
            <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden">
                <img src="/login-bg.png" alt="" className="absolute inset-0 w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-r from-[#0a0f1e]/80 via-[#0a0f1e]/50 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0a0f1e]/90 via-transparent to-[#0a0f1e]/30" />
                <div className="relative z-10 flex flex-col justify-between p-12 w-full">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20"><Scale size={24} className="text-white" /></div>
                        <div><h1 className="text-xl font-black text-white">JusticeAI</h1><p className="text-[11px] font-medium text-amber-400/80 tracking-widest uppercase">Legal Intelligence</p></div>
                    </div>
                    <div className="max-w-lg">
                        <h2 className="text-4xl font-black text-white leading-tight mb-4">Pakistan's Most Advanced<span className="block text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-amber-500">Legal Research AI</span></h2>
                        <p className="text-white/60 text-sm leading-relaxed mb-8">Search through Supreme Court & High Court judgments, federal statutes, and judge profiles — powered by Hybrid RAG with real-time legal intelligence.</p>
                        <div className="flex flex-wrap gap-3">
                            {[{ icon: Sparkles, text: 'AI-Powered Case Analysis' }, { icon: Shield, text: 'Grounded in Pakistani Law' }, { icon: Scale, text: '50,000+ Legal Documents' }].map((f, i) => (
                                <div key={i} className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm">
                                    <f.icon size={14} className="text-amber-400" /><span className="text-xs font-medium text-white/70">{f.text}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                    <p className="text-white/30 text-xs italic">"Justice delayed is justice denied." — William E. Gladstone</p>
                </div>
            </div>
            <div className="w-full lg:w-[45%] bg-[#0c1220] flex items-center justify-center p-6 lg:p-12 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl" />
                <div className="absolute bottom-0 left-0 w-72 h-72 bg-indigo-500/5 rounded-full blur-3xl" />
                <div className="w-full max-w-md relative z-10">
                    <div className="lg:hidden flex items-center gap-3 mb-10 justify-center">
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center"><Scale size={22} className="text-white" /></div>
                        <div><h1 className="text-lg font-black text-white">JusticeAI</h1><p className="text-[10px] text-amber-400/80 tracking-widest uppercase">Legal Intelligence</p></div>
                    </div>
                    <div className="mb-8">
                        <h2 className="text-2xl font-black text-white mb-1">{isLogin ? 'Welcome back' : 'Create your account'}</h2>
                        <p className="text-sm text-white/40">{isLogin ? 'Sign in to access your legal workspace' : 'Join thousands of legal professionals using AI'}</p>
                    </div>
                    {error && <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">{error}</div>}
                    <button onClick={handleGoogleSignIn} disabled={googleLoading}
                        className="w-full py-3 rounded-xl bg-white text-slate-700 font-semibold text-sm shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all flex items-center justify-center gap-3 disabled:opacity-50 mb-5">
                        {googleLoading ? <div className="w-5 h-5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" /> : <>
                            <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
                            Continue with Google
                        </>}
                    </button>
                    <div className="flex items-center gap-4 mb-5"><div className="flex-1 h-px bg-white/10" /><span className="text-xs text-white/30">or</span><div className="flex-1 h-px bg-white/10" /></div>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {!isLogin && <div className="relative"><User size={16} className={labelIcon} /><input required value={form.full_name} onChange={e => update('full_name', e.target.value)} placeholder="Full Name" className={inputClass} /></div>}
                        <div className="relative"><Mail size={16} className={labelIcon} /><input required type="email" value={form.email} onChange={e => update('email', e.target.value)} placeholder="Email Address" className={inputClass} /></div>
                        <div className="relative"><Lock size={16} className={labelIcon} /><input required type={showPassword ? 'text' : 'password'} value={form.password} onChange={e => update('password', e.target.value)} placeholder="Password" className={`${inputClass} pr-11`} />
                            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></div>
                        {!isLogin && <>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="relative"><Phone size={16} className={labelIcon} /><input value={form.phone} onChange={e => update('phone', e.target.value)} placeholder="WhatsApp No." className={inputClass} /></div>
                                <div className="relative"><MapPin size={16} className={labelIcon} /><input value={form.city} onChange={e => update('city', e.target.value)} placeholder="City" className={inputClass} /></div>
                            </div>
                            <div className="relative"><Briefcase size={16} className={labelIcon} /><input value={form.specialization} onChange={e => update('specialization', e.target.value)} placeholder="Specialization e.g. Criminal, Corporate" className={inputClass} /></div>
                        </>}
                        <button type="submit" disabled={loading}
                            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-white font-bold text-sm shadow-lg shadow-amber-500/20 hover:shadow-amber-500/40 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                            {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <>{isLogin ? 'Sign In' : 'Create Account'} <ArrowRight size={16} /></>}
                        </button>
                    </form>
                    <div className="mt-6 text-center">
                        <p className="text-sm text-white/40">{isLogin ? "Don't have an account?" : 'Already have an account?'}
                            <button onClick={() => { setIsLogin(!isLogin); setError(''); }} className="ml-2 text-amber-400 font-semibold hover:text-amber-300">{isLogin ? 'Sign Up' : 'Sign In'}</button>
                        </p>
                    </div>
                    <p className="mt-10 text-center text-[11px] text-white/20">© 2026 JusticeAI — Powered by Hybrid RAG + Groq LLM</p>
                </div>
            </div>
        </div>
    );
}
