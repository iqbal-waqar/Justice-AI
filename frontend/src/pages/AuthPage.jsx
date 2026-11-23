import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../firebase';
import {
    ArrowLeft, ArrowRight, Briefcase, CalendarClock, CheckCircle2, Eye, EyeOff, FolderLock, Languages, Lock, Mail,
    MailCheck, MapPin, MessageSquareText, Phone, ShieldCheck, User, Wallet, AlertCircle, Info,
} from 'lucide-react';

import { API_BASE as API, takeLogoutReason } from '../api';
import Logo from '../components/Logo';
import { LanguageToggle, useI18n } from '../i18n';
import { COVERAGE, TOTAL_JUDGMENTS, TOTAL_STATUTES, fmt } from '../data/site';

const HIGHLIGHTS = [
    { icon: MessageSquareText, title: 'Research grounded in real judgments', text: 'Clear answers with every case cited and linked to the court record.' },
    { icon: Languages, title: 'English, اردو and voice', text: 'Ask the way you speak; citations stay exactly as reported.' },
    { icon: FolderLock, title: 'Encrypted document vault', text: 'Client files organised by case and visible only to your firm.' },
    { icon: Wallet, title: 'Billing with a second approver', text: 'Fees, expenses and payments, with statements in one click.' },
    { icon: CalendarClock, title: 'Hearing reminders', text: 'WhatsApp and email reminders before every date.' },
];

const Spinner = ({ dark }) => <span className={`w-5 h-5 border-2 rounded-full animate-spin ${dark ? 'border-slate-300 border-t-slate-600' : 'border-white/30 border-t-white'}`} />;

const fieldBox = "w-full h-11 bg-white border border-line-strong rounded-xl text-[14.5px] text-ink-950 placeholder:text-slate-400 shadow-[0_1px_1px_rgba(18,29,47,0.03)] hover:border-ink-300 focus:outline-none focus:border-gold-500 focus:shadow-focus transition-[border-color,box-shadow]";

function TextField({ icon: Icon, label, trailing, ...props }) {
    return (
        <label className="block">
            <span className="block text-[12.5px] font-semibold text-ink-800 mb-1.5">{label}</span>
            <span className="relative block">
                <Icon size={16} className="absolute start-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input {...props} className={`${fieldBox} ${trailing ? 'pl-10 pr-11 rtl:pl-11 rtl:pr-10' : 'pl-10 pr-3.5 rtl:pl-3.5 rtl:pr-10'}`} />
                {trailing}
            </span>
        </label>
    );
}

/* Six separate digit boxes over one real input: typing, pasting and one-time-code
   autofill all go to the input; the boxes only show what is in it. */
function CodeInput({ value, onChange, label, ...props }) {
    const [focused, setFocused] = useState(false);
    const digits = Array.from({ length: 6 }, (_, i) => value[i] || '');
    const active = Math.min(value.length, 5);
    return (
        <label className="block">
            <span className="block text-[12.5px] font-semibold text-ink-800 mb-2">{label}</span>
            <span className="relative block" dir="ltr">
                <input {...props} value={value} onChange={onChange} maxLength={6}
                    onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-text z-10" aria-label={label} />
                <span className="grid grid-cols-6 gap-2 sm:gap-2.5" aria-hidden>
                    {digits.map((d, i) => (
                        <span key={i}
                            className={`h-14 rounded-xl border bg-white flex items-center justify-center text-[24px] font-semibold text-ink-950 tabular-nums transition-all
                                ${focused && i === active ? 'border-gold-500 shadow-focus' : d ? 'border-ink-300' : 'border-line-strong'}`}>
                            {d || (focused && i === active ? <span className="w-px h-6 bg-ink-900 animate-pulse" /> : <span className="w-2 h-2 rounded-full bg-paper-300" />)}
                        </span>
                    ))}
                </span>
            </span>
        </label>
    );
}

/* Navy brand side of the sign-in screen: what the product is, why it can be trusted. */
function BrandPanel() {
    const { t } = useI18n();
    return (
        <aside className="hidden lg:flex lg:w-[50%] xl:w-[52%] relative overflow-hidden bg-ink-gradient text-white">
            <span aria-hidden className="absolute inset-0 bg-ink-sheen" />
            <span aria-hidden className="absolute inset-0 pointer-events-none opacity-60"
                style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px)', backgroundSize: '56px 56px', maskImage: 'radial-gradient(ellipse 80% 70% at 25% 15%, black 25%, transparent 100%)', WebkitMaskImage: 'radial-gradient(ellipse 80% 70% at 25% 15%, black 25%, transparent 100%)' }} />
            <span aria-hidden className="absolute -top-40 -end-32 w-[520px] h-[520px] rounded-full bg-gold-500/20 blur-[120px] pointer-events-none" />
            <span aria-hidden className="absolute -bottom-48 -start-24 w-[440px] h-[440px] rounded-full bg-ink-500/30 blur-[110px] pointer-events-none" />

            <div className="relative z-10 flex flex-col justify-between w-full px-14 py-12 xl:px-20">
                <Link to="/" aria-label={t('Justice AI home')} className="self-start rounded-xl"><Logo size={40} tagline light /></Link>

                <div className="max-w-xl py-10">
                    <span className="inline-flex items-center gap-2 h-7 px-3 rounded-full bg-white/[0.06] ring-1 ring-gold-400/25 text-[12px] font-medium text-gold-300 mb-6">
                        <span className="w-1.5 h-1.5 rounded-full bg-gold-400 shadow-[0_0_8px_rgba(212,168,83,0.9)]" />
                        {t('Grounded in real Pakistani judgments')}
                    </span>
                    <h1 className="font-serif text-[2.7rem] xl:text-[3.25rem] leading-[1.06] font-semibold tracking-tight text-white mb-5">
                        {t('The legal workspace')} <span className="italic text-gold-300">{t('built for Pakistan.')}</span>
                    </h1>
                    <p className="text-[16px] text-white/65 leading-relaxed mb-10 max-w-lg">
                        {t('Research the law in seconds, then keep your files, fees and hearings in one secure place.')}
                    </p>
                    <ul className="space-y-3">
                        {HIGHLIGHTS.map(h => (
                            <li key={h.title} className="flex items-center gap-4 p-3 -mx-3 rounded-2xl hover:bg-white/[0.03] transition-colors">
                                <span className="w-10 h-10 rounded-xl bg-white/[0.06] ring-1 ring-white/10 flex items-center justify-center flex-shrink-0">
                                    <h.icon size={18} className="text-gold-300" strokeWidth={1.9} />
                                </span>
                                <span className="min-w-0">
                                    <span className="block text-[14.5px] font-semibold text-white">{t(h.title)}</span>
                                    <span className="block text-[13.5px] text-white/50 leading-relaxed">{t(h.text)}</span>
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>

                <div className="grid grid-cols-3 gap-6 pt-7 border-t border-white/10">
                    {[[fmt(TOTAL_JUDGMENTS), t('judgments')], [fmt(TOTAL_STATUTES), t('federal & Punjab statutes')], [fmt(COVERAGE.judges), t('judge profiles')]].map(([n, l]) => (
                        <div key={l}>
                            <div className="font-serif text-[28px] leading-none font-semibold text-white tabular-nums">{n}</div>
                            <div className="text-[12.5px] text-white/45 mt-2">{l}</div>
                        </div>
                    ))}
                </div>
            </div>
        </aside>
    );
}

/* Shell of the email / WhatsApp code screens: paper canvas, one centred card. */
function CodeScreen({ icon: Icon, tone = 'ink', children, footer }) {
    const tile = tone === 'green'
        ? 'bg-emerald-50 ring-emerald-200/80 text-emerald-700'
        : 'bg-ink-gradient ring-white/5 text-gold-300 shadow-[0_8px_20px_-8px_rgba(11,18,32,0.6)]';
    return (
        <div className="relative min-h-screen bg-paper-100 flex flex-col items-center justify-center px-5 py-16 overflow-hidden">
            <span aria-hidden className="absolute -top-40 start-1/2 -translate-x-1/2 w-[720px] h-[420px] rounded-full bg-amber-100/60 blur-[100px] pointer-events-none" />
            <LanguageToggle className="absolute top-4 right-4 z-10" />
            <div className="relative mb-8"><Logo size={40} tagline /></div>
            <div className="relative w-full max-w-[440px] bg-white border border-line rounded-3xl shadow-[0_1px_2px_rgba(18,29,47,0.04),0_30px_60px_-30px_rgba(18,29,47,0.25)] p-7 sm:p-9">
                <span className={`w-12 h-12 rounded-2xl ring-1 flex items-center justify-center mb-6 ${tile}`}>
                    <Icon size={22} />
                </span>
                {children}
            </div>
            {footer}
        </div>
    );
}

export default function AuthPage() {
    const [searchParams] = useSearchParams();
    const { t } = useI18n();
    // /login?mode=signup opens straight on the sign-up form (landing page "Get started").
    const [isLogin, setIsLogin] = useState(searchParams.get('mode') !== 'signup');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const [error, setError] = useState('');
    // Shown once after a forced logout (expired/invalid session).
    const [notice] = useState(() => takeLogoutReason());
    const navigate = useNavigate();

    // Phone verification
    const [verifyStep, setVerifyStep] = useState(false);
    const [phoneNumber, setPhoneNumber] = useState('');
    const [otpCode, setOtpCode] = useState('');
    const [codeSent, setCodeSent] = useState(false);
    const [sendingCode, setSendingCode] = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [jwtToken, setJwtToken] = useState('');

    // Email verification (email + password sign-ups): a 6-digit code sent to the address.
    const [emailStep, setEmailStep] = useState(null);     // the address awaiting a code, or null
    const [emailCode, setEmailCode] = useState('');
    const [emailInfo, setEmailInfo] = useState('');
    const [resendIn, setResendIn] = useState(0);
    useEffect(() => {
        if (resendIn <= 0) return;
        const timer = setTimeout(() => setResendIn(n => n - 1), 1000);
        return () => clearTimeout(timer);
    }, [resendIn]);
    const openEmailStep = (email, info) => { setEmailStep(email); setEmailCode(''); setEmailInfo(info || ''); setResendIn(60); setError(''); };
    // The API answers errors as text, or as { message } for the "confirm your email" case.
    const errorText = (detail, fallback) => (typeof detail === 'string' ? detail : detail?.message) || fallback;

    const [form, setForm] = useState({ full_name: '', email: '', password: '', phone: '', bar_council_id: '', specialization: '', city: '', notification_email: '' });
    const update = (key, val) => setForm(f => ({ ...f, [key]: val }));

    const saveAndRedirect = (data) => {
        localStorage.setItem('justiceai_token', data.access_token);
        localStorage.setItem('justiceai_user', JSON.stringify(data.user));
        if (!data.user.phone_verified) { setJwtToken(data.access_token); setVerifyStep(true); return; }
        navigate('/dashboard');
    };

    const handleGoogleSignIn = async () => {
        setError(''); setGoogleLoading(true);
        try {
            const result = await signInWithPopup(auth, googleProvider);
            const idToken = await result.user.getIdToken();
            const res = await fetch(`${API}/api/v1/auth/google`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ credential: idToken }) });
            const data = await res.json();
            if (!res.ok) { setError(errorText(data.detail, t('Google sign-in failed'))); setGoogleLoading(false); return; }
            saveAndRedirect(data);
        } catch (err) { if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') setError(err.message || t('Google sign-in failed')); }
        setGoogleLoading(false);
    };

    const handleSubmit = async (e) => {
        e.preventDefault(); setError(''); setLoading(true);
        const endpoint = isLogin ? '/api/v1/auth/login' : '/api/v1/auth/signup';
        const body = isLogin ? { email: form.email, password: form.password } : { ...form, notification_email: form.notification_email || form.email };
        try {
            const res = await fetch(`${API}${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
            const data = await res.json();
            if (!res.ok) {
                // Signing in to an account whose email was never confirmed: a new code has been sent.
                if (data.detail?.code === 'email_not_verified') openEmailStep(data.detail.email, data.detail.message);
                else setError(errorText(data.detail, t('Something went wrong. Please try again.')));
            } else if (data.verification_required) {
                openEmailStep(data.email, data.message);
            } else {
                saveAndRedirect(data);
            }
        } catch { setError(t('Network error. Please check your connection.')); }
        setLoading(false);
    };

    const handleVerifyEmail = async (e) => {
        e?.preventDefault();
        if (emailCode.length !== 6) return;
        setError(''); setVerifying(true);
        try {
            const res = await fetch(`${API}/api/v1/auth/email/verify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: emailStep, code: emailCode }) });
            const data = await res.json();
            if (!res.ok) { setError(errorText(data.detail, t('That code is not correct.'))); setVerifying(false); return; }
            setEmailStep(null);
            saveAndRedirect(data);
        } catch { setError(t('Network error. Please check your connection.')); }
        setVerifying(false);
    };

    const handleResendEmail = async () => {
        setError(''); setEmailInfo('');
        try {
            const res = await fetch(`${API}/api/v1/auth/email/resend`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: emailStep }) });
            const data = await res.json();
            if (!res.ok) { setError(errorText(data.detail, t('Could not send a new code.'))); return; }
            setEmailInfo(t('A new code is on its way to {email}.', { email: emailStep }));
            setEmailCode('');
            setResendIn(60);
        } catch { setError(t('Network error. Please check your connection.')); }
    };

    // Twilio WhatsApp OTP
    const handleSendCode = async () => {
        if (!phoneNumber.trim()) { setError(t('Please enter your WhatsApp number')); return; }
        setError(''); setSendingCode(true);
        try {
            const res = await fetch(`${API}/api/v1/auth/phone/send-code`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwtToken}` }, body: JSON.stringify({ phone: phoneNumber }) });
            const data = await res.json();
            if (!res.ok) { setError(data.detail || t('Failed to send code')); setSendingCode(false); return; }
            setCodeSent(true);
        } catch { setError(t('Network error. Please check your connection.')); }
        setSendingCode(false);
    };

    const handleVerifyCode = async () => {
        if (!otpCode.trim()) { setError(t('Please enter the code')); return; }
        setError(''); setVerifying(true);
        try {
            const res = await fetch(`${API}/api/v1/auth/phone/verify`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwtToken}` }, body: JSON.stringify({ phone: phoneNumber, code: otpCode }) });
            const data = await res.json();
            if (!res.ok) { setError(data.detail || t('Invalid code')); setVerifying(false); return; }
            localStorage.setItem('justiceai_user', JSON.stringify(data));
            navigate('/dashboard');
        } catch { setError(t('Network error. Please check your connection.')); }
        setVerifying(false);
    };

    const errorBox = error && (
        <div role="alert" className="mb-5 flex items-start gap-2.5 px-4 py-3 rounded-xl bg-red-50/80 border border-red-200 text-red-800 text-sm animate-fade-in">
            <AlertCircle size={17} className="text-red-500 flex-shrink-0 mt-px" /><span>{error}</span>
        </div>
    );
    const primaryBtn = "w-full h-11 rounded-xl bg-ink-900 hover:bg-ink-800 active:bg-ink-950 text-white font-semibold text-[14.5px] shadow-[0_1px_2px_rgba(11,18,32,0.25),inset_0_1px_0_rgba(255,255,255,0.08)] transition-colors flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:shadow-focus disabled:opacity-50 disabled:cursor-not-allowed";
    const title = "font-serif text-[1.75rem] leading-tight font-semibold text-ink-950 tracking-tight mb-2";

    // ═══ EMAIL VERIFICATION SCREEN ═══
    if (emailStep) {
        return (
            <CodeScreen icon={MailCheck}
                footer={<p className="relative mt-6 text-[13px] text-slate-500 max-w-md text-center leading-relaxed">{t('Can’t find it? Check your spam folder, or make sure the address is spelled correctly.')}</p>}>
                <form onSubmit={handleVerifyEmail}>
                    <h2 className={title}>{t('Check your email')}</h2>
                    <p className="text-[14.5px] text-slate-500 leading-relaxed mb-7">
                        {t('We sent a 6-digit code to')} <span className="inline-block max-w-full truncate align-bottom font-semibold text-ink-950" dir="ltr">{emailStep}</span>{t('. Enter it below to finish. The code expires in 10 minutes.')}
                    </p>
                    {errorBox}
                    {emailInfo && !error && (
                        <div className="mb-5 flex items-start gap-2.5 px-4 py-3 rounded-xl bg-emerald-50/80 border border-emerald-200 text-emerald-800 text-sm">
                            <CheckCircle2 size={17} className="text-emerald-500 flex-shrink-0 mt-px" /><span>{emailInfo}</span>
                        </div>
                    )}
                    <div className="mb-6">
                        <CodeInput label={t('Verification code')} value={emailCode} onChange={e => setEmailCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            type="text" inputMode="numeric" autoComplete="one-time-code" autoFocus />
                    </div>
                    <button type="submit" disabled={verifying || emailCode.length !== 6} className={primaryBtn}>
                        {verifying ? <Spinner /> : <><CheckCircle2 size={16} /> {t('Verify and continue')}</>}
                    </button>
                    <div className="mt-5 pt-5 border-t border-line flex items-center justify-between gap-3 text-sm">
                        <button type="button" onClick={() => { setEmailStep(null); setError(''); }} className="inline-flex items-center gap-1.5 text-slate-500 hover:text-ink-950 transition-colors"><ArrowLeft size={14} className="rtl:rotate-180" />{t('Use a different email')}</button>
                        <button type="button" onClick={handleResendEmail} disabled={resendIn > 0}
                            className="font-semibold text-gold-700 hover:text-gold-600 disabled:font-medium disabled:text-slate-400 disabled:cursor-not-allowed transition-colors tabular-nums">
                            {resendIn > 0 ? t('Resend code in {n}s', { n: resendIn }) : t('Resend code')}
                        </button>
                    </div>
                </form>
            </CodeScreen>
        );
    }

    // ═══ PHONE VERIFICATION SCREEN ═══
    if (verifyStep) {
        return (
            <CodeScreen icon={Phone} tone="green"
                footer={<button onClick={() => navigate('/dashboard')} className="relative mt-6 text-sm font-medium text-slate-500 hover:text-ink-950 transition-colors">{t('Skip for now')}</button>}>
                    <h2 className={title}>{codeSent ? t('Enter the code') : t('Add your WhatsApp number')}</h2>
                    <p className="text-[14.5px] text-slate-500 leading-relaxed mb-7">
                        {codeSent ? t('We sent a 6-digit code to {phone} on WhatsApp.', { phone: phoneNumber }) : t('Hearing reminders are sent to this number. We will send a 6-digit code to confirm it.')}
                    </p>
                    {errorBox}

                    {!codeSent ? (
                        <div className="space-y-5">
                            <TextField icon={Phone} label={t('WhatsApp number')} value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} placeholder="0315 2876491" type="tel" autoFocus />
                            <button onClick={handleSendCode} disabled={sendingCode} className={primaryBtn}>
                                {sendingCode ? <Spinner /> : <>{t('Send code on WhatsApp')} <ArrowRight size={16} className="rtl:rotate-180" /></>}
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-5">
                            <CodeInput label={t('Verification code')} value={otpCode} onChange={e => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                type="tel" inputMode="numeric" autoComplete="one-time-code" autoFocus />
                            <button onClick={handleVerifyCode} disabled={verifying || otpCode.length !== 6} className={primaryBtn}>
                                {verifying ? <Spinner /> : <><CheckCircle2 size={16} /> {t('Verify number')}</>}
                            </button>
                            <button onClick={() => { setCodeSent(false); setOtpCode(''); setError(''); }} className="w-full inline-flex items-center justify-center gap-1.5 text-sm text-slate-500 hover:text-ink-950 transition-colors"><ArrowLeft size={14} className="rtl:rotate-180" />{t('Use a different number')}</button>
                        </div>
                    )}
            </CodeScreen>
        );
    }

    // ═══ LOGIN / SIGNUP SCREEN ═══
    return (
        <div className="min-h-screen flex bg-white">
            <BrandPanel />
            <main className="relative w-full lg:w-[50%] xl:w-[48%] flex flex-col min-h-screen bg-white">
                <span aria-hidden className="lg:hidden absolute inset-x-0 top-0 h-56 bg-gradient-to-b from-paper-200/70 to-transparent pointer-events-none" />
                <div className="relative flex items-center justify-between rtl:flex-row-reverse px-5 sm:px-10 h-16 flex-shrink-0">
                    <Link to="/start" className="inline-flex items-center gap-1.5 h-9 px-2.5 -ms-2.5 rounded-lg text-sm font-medium text-slate-500 hover:text-ink-950 hover:bg-paper-200 transition-colors">
                        <ArrowLeft size={15} className="rtl:rotate-180" /> {t('Back')}
                    </Link>
                    <LanguageToggle />
                </div>

                <div className="relative flex-1 flex items-center justify-center px-5 sm:px-10 py-8">
                    <div className="w-full max-w-[408px]">
                        <div className="lg:hidden mb-8"><Logo size={40} tagline /></div>
                        <h2 className="font-serif text-[2.1rem] leading-[1.1] font-semibold text-ink-950 tracking-tight mb-2.5">{isLogin ? t('Welcome back') : t('Create your account')}</h2>
                        <p className="text-[15px] text-slate-500 mb-8">{isLogin ? t('Sign in to your legal workspace.') : t('Free to start. It takes under a minute.')}</p>

                        {/* Sign in / Create account switch */}
                        <div role="tablist" className="grid grid-cols-2 p-1 rounded-xl bg-paper-200/80 ring-1 ring-inset ring-line mb-6">
                            {[[true, t('Sign in')], [false, t('Create account')]].map(([login, label]) => (
                                <button key={label} role="tab" aria-selected={isLogin === login} type="button"
                                    onClick={() => { setIsLogin(login); setError(''); }}
                                    className={`h-9 rounded-lg text-[14px] font-semibold transition-all ${isLogin === login ? 'bg-white text-ink-950 shadow-soft ring-1 ring-line' : 'text-slate-500 hover:text-ink-950'}`}>
                                    {label}
                                </button>
                            ))}
                        </div>

                        {notice && !error && (
                            <div className="mb-5 flex items-start gap-2.5 px-4 py-3 rounded-xl bg-amber-50/80 border border-amber-200 text-amber-900 text-sm">
                                <Info size={17} className="text-amber-500 flex-shrink-0 mt-px" /><span>{notice}</span>
                            </div>
                        )}
                        {errorBox}

                        <button onClick={handleGoogleSignIn} disabled={googleLoading}
                            className="w-full h-11 rounded-xl bg-white text-ink-950 font-semibold text-[14.5px] border border-line-strong shadow-[0_1px_2px_rgba(18,29,47,0.04)] hover:bg-paper-50 hover:border-ink-300 transition-colors flex items-center justify-center gap-3 focus-visible:outline-none focus-visible:shadow-focus disabled:opacity-50">
                            {googleLoading ? <Spinner dark /> : <>
                                <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
                                {t('Continue with Google')}
                            </>}
                        </button>
                        <div className="flex items-center gap-4 my-6"><div className="flex-1 h-px bg-line" /><span className="text-[12px] font-medium text-slate-400">{t('or with email')}</span><div className="flex-1 h-px bg-line" /></div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            {!isLogin && <TextField icon={User} label={t('Full name')} required value={form.full_name} onChange={e => update('full_name', e.target.value)} placeholder={t('Advocate Ayesha Khan')} autoComplete="name" />}
                            <TextField icon={Mail} label={t('Email')} required type="email" value={form.email} onChange={e => update('email', e.target.value)} placeholder="you@example.com" autoComplete="email" />
                            <TextField icon={Lock} label={t('Password')} required type={showPassword ? 'text' : 'password'} value={form.password} onChange={e => update('password', e.target.value)}
                                placeholder={isLogin ? t('Your password') : t('At least 8 characters')} minLength={isLogin ? undefined : 8} autoComplete={isLogin ? 'current-password' : 'new-password'}
                                trailing={<button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? t('Hide password') : t('Show password')}
                                    className="absolute end-1.5 top-1/2 -translate-y-1/2 p-2 rounded-lg text-slate-400 hover:text-ink-950 hover:bg-paper-200 transition-colors">{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button>} />
                            {!isLogin && <>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-3">
                                    <TextField icon={Phone} label={t('WhatsApp number')} value={form.phone} onChange={e => update('phone', e.target.value)} placeholder="0315 2876491" type="tel" />
                                    <TextField icon={MapPin} label={t('City')} value={form.city} onChange={e => update('city', e.target.value)} placeholder={t('Lahore')} />
                                </div>
                                <TextField icon={Briefcase} label={t('Area of practice')} value={form.specialization} onChange={e => update('specialization', e.target.value)} placeholder={t('Criminal, family, corporate…')} />
                            </>}
                            <button type="submit" disabled={loading} className={`${primaryBtn} !mt-6`}>
                                {loading ? <Spinner /> : <>{isLogin ? t('Sign in') : t('Create account')} <ArrowRight size={16} className="rtl:rotate-180" /></>}
                            </button>
                        </form>

                        <p className="mt-7 flex items-start gap-3 p-3.5 rounded-xl bg-paper-100 ring-1 ring-inset ring-line text-[12.5px] text-slate-500 leading-relaxed">
                            <ShieldCheck size={16} className="text-emerald-600 flex-shrink-0 mt-0.5" />
                            {t('Your documents are encrypted and visible only to your firm. Justice AI assists research; it is not a substitute for legal advice.')}
                        </p>
                    </div>
                </div>

                <p className="relative px-5 sm:px-10 py-5 text-[12px] text-slate-400 flex-shrink-0">© {new Date().getFullYear()} Justice AI</p>
            </main>
        </div>
    );
}
