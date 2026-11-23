import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    ArrowLeft, ArrowRight, Building2, CalendarDays, CheckCircle2, Clock, FolderOpen, Hash, Landmark, Loader2, LogOut,
    Mail, MapPin, Phone, Receipt, RefreshCw, ShieldCheck, Wallet,
} from 'lucide-react';
import { API_BASE, formatPKR } from '../api';
import Logo from '../components/Logo';
import { Badge } from '../components/ui';
import { LanguageToggle, useI18n } from '../i18n';
import { GRID_BG } from '../components/marketing';

/* The client portal: no account and no password. The client types the email their
   lawyer shared the case with, receives a one-time code, and sees the hearings,
   fees and receipts of every case shared with that address. The client's token is
   kept apart from a lawyer's login so both can exist in one browser. */

const TOKEN_KEY = 'justiceai_client_token';
const EMAIL_KEY = 'justiceai_client_email';

async function call(path, { method = 'GET', body, token } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${API_BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        const d = data?.detail;
        throw new Error(Array.isArray(d) ? d.map(x => x.msg).join('; ') : (d || `Request failed (${res.status})`));
    }
    return data;
}

function tokenValid(token) {
    if (!token) return false;
    try { const p = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); return p.exp * 1000 > Date.now() + 10_000; } catch { return false; }
}

export default function ClientPortalPage() {
    const { t, lang } = useI18n();
    const [token, setToken] = useState(() => { const v = localStorage.getItem(TOKEN_KEY); return tokenValid(v) ? v : null; });
    const [email, setEmail] = useState(() => localStorage.getItem(EMAIL_KEY) || '');
    const signOut = () => { localStorage.removeItem(TOKEN_KEY); setToken(null); };
    const signIn = (tok, mail) => { localStorage.setItem(TOKEN_KEY, tok); localStorage.setItem(EMAIL_KEY, mail); setEmail(mail); setToken(tok); };
    const fmtDate = (d) => d ? new Date(d).toLocaleDateString(lang === 'ur' ? 'ur-PK' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

    return (
        <div className="relative min-h-screen bg-paper-50">
            <div aria-hidden className="absolute inset-x-0 top-0 h-[520px] pointer-events-none" style={{ ...GRID_BG, maskImage: 'radial-gradient(ellipse 70% 60% at 50% 0%, black 20%, transparent 100%)' }} />
            <div aria-hidden className="absolute top-[-280px] left-1/2 -translate-x-1/2 w-[900px] h-[520px] rounded-full bg-[radial-gradient(closest-side,rgba(232,201,134,0.45),rgba(232,201,134,0.1)_55%,transparent)] blur-2xl pointer-events-none" />
            <header className="relative max-w-5xl mx-auto px-5 sm:px-8 h-20 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Link to="/start" className="inline-flex items-center gap-1.5 h-9 px-2.5 -ms-2.5 rounded-lg text-sm font-medium text-slate-500 hover:text-ink-950 hover:bg-paper-200 transition-colors">
                        <ArrowLeft size={15} className="rtl:rotate-180" /> {t('Back')}
                    </Link>
                    <Logo size={34} />
                </div>
                <div className="flex items-center gap-2">
                    {token && <button onClick={signOut} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-medium text-slate-600 hover:text-red-600 hover:bg-red-50 transition-colors"><LogOut size={15} className="rtl:rotate-180" />{t('Sign out')}</button>}
                    <LanguageToggle />
                </div>
            </header>
            <main className="relative max-w-5xl mx-auto px-5 sm:px-8 pb-20">
                {token ? <Cases token={token} email={email} onExpired={signOut} fmtDate={fmtDate} /> : <SignIn initialEmail={email} onSignedIn={signIn} />}
            </main>
        </div>
    );
}

/* ── step 1 and 2: email, then the code ───────────────────────────────────── */
function SignIn({ initialEmail, onSignedIn }) {
    const { t } = useI18n();
    const [email, setEmail] = useState(initialEmail);
    const [stage, setStage] = useState('email');
    const [code, setCode] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [resendIn, setResendIn] = useState(0);
    const codeRef = useRef(null);

    useEffect(() => { if (resendIn <= 0) return; const id = setTimeout(() => setResendIn(s => s - 1), 1000); return () => clearTimeout(id); }, [resendIn]);
    useEffect(() => { if (stage === 'code') codeRef.current?.focus(); }, [stage]);

    const sendCode = async (e) => {
        e?.preventDefault(); setBusy(true); setError('');
        try { const r = await call('/api/v1/client/request-code', { method: 'POST', body: { email: email.trim() } }); setResendIn(r.resend_in || 60); setStage('code'); }
        catch (err) { setError(err.message); } finally { setBusy(false); }
    };
    const verify = async (e) => {
        e?.preventDefault(); if (code.length < 6) return; setBusy(true); setError('');
        try { const r = await call('/api/v1/client/verify', { method: 'POST', body: { email: email.trim(), code } }); onSignedIn(r.access_token, r.email); }
        catch (err) { setError(err.message); } finally { setBusy(false); }
    };

    return (
        <div className="max-w-md mx-auto mt-6 sm:mt-10">
            <div className="text-center mb-8">
                <span className="inline-flex w-14 h-14 rounded-2xl bg-ink-gradient ring-1 ring-white/5 items-center justify-center shadow-[0_12px_30px_-10px_rgba(11,18,32,0.6)] mb-5"><FolderOpen size={24} className="text-gold-300" /></span>
                <h1 className="font-serif text-[1.9rem] sm:text-[2.2rem] leading-tight font-semibold tracking-[-0.02em] text-ink-950 rtl:tracking-normal rtl:text-[1.6rem] rtl:pt-1">{stage === 'email' ? t('See the case your lawyer shared') : t('Enter the code we emailed')}</h1>
                <p className="text-[15px] text-slate-600 mt-2.5 leading-relaxed">
                    {stage === 'email' ? t('Sign in with the email address your lawyer used to share the case. We will send you a one-time code — no password needed.')
                        : <>{t('A 6-digit code was sent to')} <bdi dir="ltr" className="font-semibold text-ink-950">{email.trim()}</bdi>. {t('It works for 10 minutes.')}</>}
                </p>
            </div>
            <div className="rounded-2xl bg-white ring-1 ring-line shadow-lift p-6 sm:p-7">
                {error && <div className="mb-4 flex items-start gap-2.5 px-4 py-3 rounded-xl bg-red-50/80 ring-1 ring-red-200 text-[13.5px] text-red-800" role="alert">{error}</div>}
                {stage === 'email' ? (
                    <form onSubmit={sendCode} className="space-y-4">
                        <label className="block">
                            <span className="block text-[12.5px] font-semibold text-ink-800 mb-1.5">{t('Email address')}</span>
                            <div className="relative">
                                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input type="email" required autoFocus value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" dir="ltr"
                                    className="w-full h-11 pl-10 pr-3.5 rounded-xl bg-white border border-line-strong text-sm text-ink-950 placeholder:text-slate-400 focus:outline-none focus:border-gold-500 focus:shadow-focus transition" />
                            </div>
                        </label>
                        <button type="submit" disabled={busy || !email.trim()} className="group w-full h-11 inline-flex items-center justify-center gap-2 rounded-xl bg-ink-900 text-white text-[15px] font-semibold hover:bg-ink-800 disabled:opacity-45 transition-colors">
                            {busy ? <Loader2 size={16} className="animate-spin" /> : <>{t('Send me a code')} <ArrowRight size={16} className="text-gold-300 rtl:rotate-180" /></>}
                        </button>
                    </form>
                ) : (
                    <form onSubmit={verify} className="space-y-4">
                        <label className="block">
                            <span className="block text-[12.5px] font-semibold text-ink-800 mb-1.5">{t('Verification code')}</span>
                            <input ref={codeRef} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" maxLength={6} value={code} dir="ltr"
                                onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                className="w-full h-14 text-center text-[26px] font-semibold tracking-[0.5em] rounded-xl bg-white border border-line-strong text-ink-950 focus:outline-none focus:border-gold-500 focus:shadow-focus transition" />
                        </label>
                        <button type="submit" disabled={busy || code.length < 6} className="w-full h-11 inline-flex items-center justify-center gap-2 rounded-xl bg-ink-900 text-white text-[15px] font-semibold hover:bg-ink-800 disabled:opacity-45 transition-colors">
                            {busy ? <Loader2 size={16} className="animate-spin" /> : <><CheckCircle2 size={16} className="text-gold-300" />{t('Open my cases')}</>}
                        </button>
                        <div className="flex items-center justify-between text-[13px] text-slate-500">
                            <button type="button" onClick={() => { setStage('email'); setCode(''); setError(''); }} className="hover:text-ink-950">{t('Use a different email')}</button>
                            <button type="button" disabled={resendIn > 0 || busy} onClick={sendCode} className="inline-flex items-center gap-1.5 font-semibold text-ink-950 disabled:text-slate-400">
                                <RefreshCw size={13} />{resendIn > 0 ? t('Resend in {n}s', { n: resendIn }) : t('Resend code')}
                            </button>
                        </div>
                    </form>
                )}
            </div>
            <p className="flex items-start gap-2 text-[12.5px] text-slate-500 leading-relaxed mt-5 px-1"><ShieldCheck size={15} className="text-emerald-600 flex-shrink-0 mt-px" />{t('Only the cases your lawyer has shared with this email are shown. Your lawyer can withdraw access at any time.')}</p>
        </div>
    );
}

/* ── the shared cases ──────────────────────────────────────────────────────── */
function Cases({ token, email, onExpired, fmtDate }) {
    const { t } = useI18n();
    const [cases, setCases] = useState(null);
    const [error, setError] = useState('');
    const [openId, setOpenId] = useState(null);

    useEffect(() => {
        call('/api/v1/client/cases', { token })
            .then(c => { setCases(c); setOpenId(c[0]?.matter_id ?? null); })
            .catch(e => { if (/sign in again/i.test(e.message)) onExpired(); else setError(e.message); });
    }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

    const current = useMemo(() => cases?.find(c => c.matter_id === openId) || null, [cases, openId]);
    const today = new Date().toISOString().slice(0, 10);

    if (error) return <div className="max-w-md mx-auto mt-10 px-4 py-3 rounded-xl bg-red-50/80 ring-1 ring-red-200 text-[13.5px] text-red-800">{error}</div>;
    if (!cases) return <div className="flex justify-center py-24 text-slate-400"><Loader2 size={22} className="animate-spin" /></div>;
    if (!cases.length) return (
        <div className="max-w-md mx-auto mt-12 text-center">
            <FolderOpen size={32} className="mx-auto text-slate-300 mb-4" />
            <h2 className="font-serif text-[22px] font-semibold text-ink-950">{t('No shared cases right now')}</h2>
            <p className="text-[14.5px] text-slate-600 mt-2">{t('When your lawyer shares a case with {email}, it will appear here.', { email })}</p>
        </div>
    );

    return (
        <div className="mt-4 sm:mt-8">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-6">
                <div>
                    <p className="text-[12.5px] font-semibold uppercase tracking-[0.16em] text-gold-700 eyebrow">{t('Your cases')}</p>
                    <h1 className="font-serif text-[1.8rem] sm:text-[2.1rem] font-semibold tracking-[-0.02em] text-ink-950 rtl:tracking-normal rtl:text-[1.6rem] rtl:pt-1">{cases[0].client_name}</h1>
                </div>
                <p className="text-[13px] text-slate-500 inline-flex items-center gap-1.5"><Mail size={14} /><bdi dir="ltr">{email}</bdi></p>
            </div>
            <div className="grid lg:grid-cols-[0.36fr_0.64fr] gap-5 items-start">
                <div className="space-y-2">
                    {cases.map(c => {
                        const on = c.matter_id === openId;
                        return (
                            <button key={c.matter_id} onClick={() => setOpenId(c.matter_id)}
                                className={`w-full text-start p-4 rounded-2xl ring-1 transition-all ${on ? 'bg-white ring-line-strong shadow-lift' : 'bg-white/60 ring-line hover:bg-white hover:ring-line-strong'}`}>
                                <div className="flex items-start justify-between gap-3">
                                    <span className="font-semibold text-[15px] text-ink-950 leading-snug">{c.title}</span>
                                    <Badge value={c.status} />
                                </div>
                                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-slate-500">
                                    {c.case_number && <span className="inline-flex items-center gap-1"><Hash size={12} /><span className="font-mono" dir="ltr">{c.case_number}</span></span>}
                                    {c.court && <span className="inline-flex items-center gap-1"><Landmark size={12} />{c.court}</span>}
                                </div>
                                {c.next_hearing && <div className="mt-2.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 ring-1 ring-amber-200 text-[12px] font-semibold text-amber-800"><CalendarDays size={12} />{t('Next hearing')}: {fmtDate(c.next_hearing)}</div>}
                            </button>
                        );
                    })}
                </div>

                {current && (
                    <div className="space-y-4">
                        {/* lawyer */}
                        <div className="rounded-2xl bg-ink-gradient text-white p-5 relative overflow-hidden">
                            <span aria-hidden className="absolute inset-0 bg-ink-sheen pointer-events-none" />
                            <div className="relative flex flex-wrap items-center gap-x-6 gap-y-2 text-[13.5px]">
                                <span className="inline-flex items-center gap-2 font-semibold text-[15px]"><Building2 size={16} className="text-gold-300" />{current.firm_name}</span>
                                {current.lawyer_name && <span className="text-white/75">{t('Lawyer')}: <span className="text-white font-medium">{current.lawyer_name}</span></span>}
                                {current.lawyer_phone && <a href={`tel:${current.lawyer_phone}`} className="inline-flex items-center gap-1.5 text-gold-300 hover:text-gold-200"><Phone size={14} /><bdi dir="ltr">{current.lawyer_phone}</bdi></a>}
                                {current.lawyer_email && <a href={`mailto:${current.lawyer_email}`} className="inline-flex items-center gap-1.5 text-gold-300 hover:text-gold-200"><Mail size={14} /><bdi dir="ltr">{current.lawyer_email}</bdi></a>}
                            </div>
                        </div>

                        {/* money summary */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {[[t('Fees'), current.total_fees, 'text-ink-950'], [t('Expenses'), current.total_expenses, 'text-ink-950'], [t('Paid'), current.total_paid, 'text-emerald-700'], [t('Balance due'), current.balance_due, Number(current.balance_due) > 0 ? 'text-red-600' : 'text-emerald-700']].map(([l, v, tone]) => (
                                <div key={l} className="p-4 rounded-2xl bg-white ring-1 ring-line shadow-soft">
                                    <div className="text-[12px] text-slate-500">{l}</div>
                                    <div dir="ltr" className={`text-[20px] font-semibold tabular-nums mt-1 text-start ${tone}`}>{formatPKR(v)}</div>
                                </div>
                            ))}
                        </div>

                        {/* hearings */}
                        <section className="rounded-2xl bg-white ring-1 ring-line shadow-soft overflow-hidden">
                            <div className="flex items-center gap-2.5 px-5 h-13 py-3.5 border-b border-line"><span className="w-7 h-7 rounded-lg bg-paper-200 text-ink-700 flex items-center justify-center"><CalendarDays size={15} /></span><h2 className="text-[14.5px] font-semibold text-ink-950">{t('Hearing dates')}</h2></div>
                            {current.hearings.length === 0 ? <p className="px-5 py-6 text-[13.5px] text-slate-500">{t('No hearing dates have been entered for this case yet.')}</p> : (
                                <ul className="divide-y divide-line">
                                    {current.hearings.map(h => {
                                        const future = h.hearing_date >= today && h.status === 'upcoming';
                                        return (
                                            <li key={h.id} className="flex items-center gap-4 px-5 py-3.5">
                                                <span className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center flex-shrink-0 ring-1 ${future ? 'bg-amber-50 ring-amber-200 text-amber-900' : 'bg-paper-100 ring-line text-slate-500'}`}>
                                                    <span className="text-[10px] font-semibold uppercase leading-none">{new Date(h.hearing_date).toLocaleDateString('en-GB', { month: 'short' })}</span>
                                                    <span className="text-[17px] font-semibold leading-tight tabular-nums">{new Date(h.hearing_date).getDate()}</span>
                                                </span>
                                                <div className="min-w-0 flex-1">
                                                    <div className="text-[14px] font-semibold text-ink-950">{fmtDate(h.hearing_date)}{h.hearing_time && <span className="font-normal text-slate-500"> · <Clock size={12} className="inline -mt-0.5" /> <span dir="ltr">{h.hearing_time}</span></span>}</div>
                                                    <div className="text-[12.5px] text-slate-500 mt-0.5 flex flex-wrap gap-x-3">{h.court && <span className="inline-flex items-center gap-1"><MapPin size={12} />{h.court}</span>}{h.notes && <span dir="auto">{h.notes}</span>}</div>
                                                </div>
                                                <Badge value={h.status} />
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </section>

                        {/* fees and receipts */}
                        <section className="rounded-2xl bg-white ring-1 ring-line shadow-soft overflow-hidden">
                            <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-line"><span className="w-7 h-7 rounded-lg bg-paper-200 text-ink-700 flex items-center justify-center"><Wallet size={15} /></span><h2 className="text-[14.5px] font-semibold text-ink-950">{t('Fees and receipts')}</h2><span className="ms-auto text-[12px] text-slate-400">{t('Approved entries only')}</span></div>
                            {current.entries.length === 0 ? <p className="px-5 py-6 text-[13.5px] text-slate-500">{t('No fees or payments have been recorded for this case yet.')}</p> : (
                                <ul className="divide-y divide-line">
                                    {current.entries.map(e => (
                                        <li key={e.id} className="flex items-center gap-4 px-5 py-3.5">
                                            <span className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ring-1 ${e.entry_type === 'payment' ? 'bg-emerald-50 ring-emerald-200 text-emerald-700' : e.entry_type === 'expense' ? 'bg-orange-50 ring-orange-200 text-orange-700' : 'bg-ink-50 ring-ink-200 text-ink-800'}`}>
                                                {e.entry_type === 'payment' ? <Receipt size={15} /> : <Wallet size={15} />}
                                            </span>
                                            <div className="min-w-0 flex-1">
                                                <div className="text-[14px] font-medium text-ink-950" dir="auto">{e.description}</div>
                                                <div className="text-[12.5px] text-slate-500 mt-0.5 flex flex-wrap gap-x-3"><span>{fmtDate(e.entry_date)}</span><Badge value={e.entry_type} />{e.reference && <span dir="ltr">{t('Ref')} {e.reference}</span>}{e.payment_method && <span>{t(e.payment_method)}</span>}</div>
                                            </div>
                                            <span dir="ltr" className={`text-[15px] font-semibold tabular-nums ${e.entry_type === 'payment' ? 'text-emerald-700' : 'text-ink-950'}`}>{e.entry_type === 'payment' ? '− ' : ''}{formatPKR(e.amount)}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>
                    </div>
                )}
            </div>
        </div>
    );
}
