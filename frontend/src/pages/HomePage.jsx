import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    CalendarClock, MessageSquareText, FolderLock, Wallet, Users, FileSearch, Plus, ShieldCheck, ChevronRight,
    Receipt, CalendarDays, AlertTriangle, FileText, CheckCircle2, Scale, TrendingUp, Clock, Sparkles, Search, ArrowRight,
} from 'lucide-react';
import { apiJson, formatPKR, formatDate, formatBytes } from '../api';
import { COVERAGE, TOTAL_JUDGMENTS, TOTAL_STATUTES, fmt } from '../data/site';
import { LanguageToggle, translate as tr, useI18n } from '../i18n';

const greeting = () => {
    const h = new Date().getHours();
    return h < 12 ? tr('Good morning') : h < 17 ? tr('Good afternoon') : tr('Good evening');
};
const todayISO = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const daysUntil = (d) => Math.round((new Date(d + 'T00:00:00') - new Date(todayISO() + 'T00:00:00')) / 86400000);
const whenLabel = (d) => { const n = daysUntil(d); return n === 0 ? tr('Today') : n === 1 ? tr('Tomorrow') : n < 7 ? tr('In {n} days', { n }) : formatDate(d); };
// The dashboard's own panel: a white card with a quiet header row.
function Panel({ title, icon: Icon, action, children, className = '' }) {
    return (
        <section className={`bg-white border border-line rounded-2xl shadow-soft overflow-hidden flex flex-col ${className}`}>
            <header className="flex items-center justify-between gap-3 px-5 h-14 border-b border-line">
                <h3 className="flex items-center gap-2.5 text-[14.5px] font-semibold text-ink-950 min-w-0">
                    <span className="w-7 h-7 rounded-lg bg-paper-200 text-gold-700 flex items-center justify-center flex-shrink-0"><Icon size={14} /></span>
                    <span className="truncate">{title}</span>
                </h3>
                {action}
            </header>
            <div className="flex-1 flex flex-col">{children}</div>
        </section>
    );
}
const PanelLink = ({ to, children }) => (
    <Link to={to} className="group inline-flex items-center gap-0.5 h-7 px-2 -me-2 rounded-lg text-[12.5px] font-semibold text-slate-500 hover:text-ink-950 hover:bg-paper-200 transition-colors">
        {children}<ChevronRight size={14} className="rtl:rotate-180 transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5" />
    </Link>
);
const Empty = ({ icon: Icon, text, to, cta }) => (
    <div className="my-auto px-6 py-10 text-center">
        <span className="mx-auto mb-3 w-12 h-12 rounded-2xl bg-paper-100 ring-1 ring-line flex items-center justify-center">
            <Icon size={20} className="text-gold-600" strokeWidth={1.8} />
        </span>
        <p className="text-[13.5px] text-slate-500">{text}</p>
        {to && (
            <Link to={to} className="inline-flex items-center gap-1.5 mt-3 h-8 px-3 rounded-lg text-[13px] font-semibold text-ink-900 bg-paper-100 ring-1 ring-line hover:bg-white hover:ring-ink-200 transition-colors">
                <Plus size={14} />{cta}
            </Link>
        )}
    </div>
);
const Loading = () => <div className="px-5 py-6 space-y-3">{[0, 1, 2].map(i => <div key={i} className="h-4 rounded-md bg-paper-200 animate-pulse" style={{ width: `${85 - i * 15}%` }} />)}</div>;

const KPI_TONES = {
    ink: { value: 'text-ink-950', chip: 'bg-ink-50 text-ink-700 ring-ink-100', bar: 'bg-ink-700' },
    red: { value: 'text-red-600', chip: 'bg-red-50 text-red-600 ring-red-100', bar: 'bg-red-500' },
    green: { value: 'text-emerald-700', chip: 'bg-emerald-50 text-emerald-700 ring-emerald-100', bar: 'bg-emerald-500' },
    amber: { value: 'text-amber-700', chip: 'bg-amber-50 text-gold-700 ring-amber-100', bar: 'bg-gold-500' },
};
function Kpi({ to, icon: Icon, label, value, sub, tone = 'ink' }) {
    const look = KPI_TONES[tone] || KPI_TONES.ink;
    return (
        <Link to={to} className="group relative overflow-hidden rounded-2xl bg-white border border-line shadow-soft p-5 hover:shadow-lift hover:-translate-y-0.5 hover:border-line-strong transition-all duration-200">
            <span className={`absolute inset-x-0 top-0 h-[3px] ${look.bar} opacity-0 group-hover:opacity-100 transition-opacity`} />
            <div className="flex items-start justify-between gap-3">
                <span className="text-[13px] font-medium text-slate-500 leading-snug">{label}</span>
                <span className={`w-9 h-9 rounded-xl ring-1 flex items-center justify-center flex-shrink-0 ${look.chip}`}><Icon size={16} /></span>
            </div>
            <div className={`mt-3 text-[28px] leading-none font-semibold tabular-nums tracking-tight ${look.value}`}>{value}</div>
            <div className="mt-2.5 flex items-center justify-between gap-2">
                <span className="text-[12px] text-slate-500 truncate">{sub}</span>
                <ChevronRight size={14} className="flex-shrink-0 text-slate-300 group-hover:text-ink-700 rtl:rotate-180 transition-colors" />
            </div>
        </Link>
    );
}

/* The one dark surface on the page: a navy invitation to research. */
function ResearchCard({ t }) {
    const topics = [t('Bail under 497 Cr.P.C.'), t('Khula'), t('Writ jurisdiction')];
    return (
        <section className="relative overflow-hidden rounded-2xl bg-ink-gradient text-white p-6 shadow-lift">
            <span aria-hidden className="absolute inset-0 bg-ink-sheen" />
            <span aria-hidden className="absolute -top-16 -end-16 w-48 h-48 rounded-full bg-gold-400/10 blur-2xl" />
            <div className="relative">
                <span className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full bg-white/[0.07] ring-1 ring-gold-400/30 text-[11px] font-semibold text-gold-300">
                    <Sparkles size={12} />{t('Ask Justice AI')}
                </span>
                <h3 className="page-title text-[22px] leading-snug mt-3.5 text-white">{t('Research any point of law in seconds.')}</h3>
                <p className="text-[13px] text-white/60 mt-1.5 leading-relaxed">{t('Every answer is cited to the judgment or statute it comes from.')}</p>
                <Link to="/chat" className="mt-5 flex items-center gap-3 h-11 px-4 rounded-xl bg-white/[0.07] ring-1 ring-white/10 text-[13.5px] text-white/55 hover:bg-white/[0.11] hover:ring-gold-400/40 transition-all">
                    <Search size={15} className="text-gold-300 flex-shrink-0" />
                    <span className="flex-1 truncate">{t('Ask a legal question…')}</span>
                    <span className="w-7 h-7 rounded-lg bg-gold-gradient flex items-center justify-center flex-shrink-0"><ArrowRight size={14} className="text-[#2a1e05] rtl:rotate-180" /></span>
                </Link>
                <div className="mt-3 flex flex-wrap gap-1.5">
                    {topics.map(topic => (
                        <Link key={topic} to="/chat" className="h-7 px-2.5 inline-flex items-center rounded-lg text-[12px] text-white/70 bg-white/[0.04] ring-1 ring-white/10 hover:text-white hover:ring-white/25 transition-colors">{topic}</Link>
                    ))}
                </div>
            </div>
        </section>
    );
}

export default function HomePage() {
    const navigate = useNavigate();
    const { t, lang } = useI18n();
    const dateLocale = lang === 'ur' ? 'ur-PK' : 'en-GB';
    const [hearings, setHearings] = useState(null);
    const [sessions, setSessions] = useState(null);
    const [summary, setSummary] = useState(null);
    const [monthEntries, setMonthEntries] = useState(null);
    const [vault, setVault] = useState(null);
    const [docs, setDocs] = useState(null);
    const [clients, setClients] = useState(null);
    const [firm, setFirm] = useState(null);
    const user = (() => { try { return JSON.parse(localStorage.getItem('justiceai_user')) || {}; } catch { return {}; } })();
    // Greet by first name, skipping a title written into the name ("Adv. Ahmad Mir" → "Ahmad").
    const nameWords = (user.full_name || '').split(/\s+/).filter(Boolean);
    const TITLES = /^(adv|advocate|mr|mrs|ms|miss|dr|barrister|justice|ch|chaudhry|syed|hafiz|molana|maulana|rana|mian|malik|sardar|sheikh|khawaja)\.?$/i;
    const firstName = nameWords.find(w => !TITLES.test(w)) || nameWords[0] || t('Counsel');

    useEffect(() => {
        // Panels load independently: one slow or failing call never blanks the page.
        const load = (path, set, fallback = []) => apiJson(path).then(set).catch(() => set(fallback));
        const monthStart = todayISO().slice(0, 8) + '01';
        load('/api/v1/hearings', setHearings);
        load('/api/v1/chat/sessions', setSessions);
        load('/api/v1/billing/summary', setSummary, undefined);
        load(`/api/v1/billing/entries?status=approved&date_from=${monthStart}`, setMonthEntries);
        load('/api/v1/vault/stats', setVault, undefined);
        load('/api/v1/vault/documents', setDocs);
        load('/api/v1/clients', setClients);
        load('/api/v1/firm', setFirm, undefined);
    }, []);

    // load() substitutes [] for a failed call, so only a real object counts as loaded data.
    const asObject = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : null);
    const billing = asObject(summary);
    const vaultStats = asObject(vault);
    const firmInfo = asObject(firm);

    const upcoming = useMemo(() => (hearings || [])
        .filter(h => h.status !== 'completed' && daysUntil(h.hearing_date) >= 0)
        .sort((a, b) => (a.hearing_date + (a.hearing_time || '')).localeCompare(b.hearing_date + (b.hearing_time || ''))), [hearings]);
    const overdue = (hearings || []).filter(h => h.status !== 'completed' && daysUntil(h.hearing_date) < 0);
    const soon = upcoming.filter(h => daysUntil(h.hearing_date) <= 1);
    const thisWeek = upcoming.filter(h => daysUntil(h.hearing_date) <= 7).length;
    const debtors = (clients || []).filter(c => Number(c.balance) > 0).sort((a, b) => Number(b.balance) - Number(a.balance)).slice(0, 3);
    const openCases = (clients || []).reduce((n, c) => n + c.matters.filter(m => m.status === 'open').length, 0);

    const month = useMemo(() => {
        const t = { billed: 0, received: 0 };
        (monthEntries || []).forEach(e => {
            if (e.entry_type === 'payment') t.received += Number(e.amount);
            else if (e.entry_type === 'fee' || e.billable) t.billed += Number(e.amount);
        });
        return t;
    }, [monthEntries]);
    const maxBar = Math.max(month.billed, month.received, 1);

    const attention = [
        billing?.awaiting_my_review > 0 && { icon: ShieldCheck, tone: 'amber', text: billing.awaiting_my_review === 1 ? t('1 billing entry needs your approval') : t('{n} billing entries need your approval', { n: billing.awaiting_my_review }), to: '/billing' },
        ...soon.map(h => ({ icon: CalendarClock, tone: 'amber', text: h.hearing_time ? t('{when}: {title} at {time}', { when: whenLabel(h.hearing_date), title: h.case_title, time: h.hearing_time }) : t('{when}: {title}', { when: whenLabel(h.hearing_date), title: h.case_title }), to: '/diary' })),
        overdue.length > 0 && { icon: AlertTriangle, tone: 'red', text: overdue.length === 1 ? t('1 past hearing is not marked completed') : t('{n} past hearings are not marked completed', { n: overdue.length }), to: '/diary' },
        ...debtors.map(c => ({ icon: Wallet, tone: 'ink', text: t('{name} owes {amount}', { name: c.name, amount: formatPKR(c.balance) }), to: `/billing?client=${c.id}` })),
    ].filter(Boolean).slice(0, 6);
    const attentionLoaded = hearings !== null && clients !== null && summary !== null;

    return (
        <div className="relative flex-1 overflow-y-auto bg-paper-100">
            {/* soft warm wash behind the greeting */}
            <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(70%_100%_at_15%_0%,rgba(212,168,83,0.10),transparent_70%)]" />
            <div className="relative max-w-[1200px] mx-auto px-6 lg:px-8 py-8 space-y-7">
                {/* greeting */}
                <div className="flex flex-wrap items-end justify-between gap-5">
                    <div className="min-w-0">
                        <p className="flex items-center gap-2 text-[12.5px] font-medium text-slate-500">
                            <span className="w-1.5 h-1.5 rounded-full bg-gold-500" />
                            {new Date().toLocaleDateString(dateLocale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                            {firmInfo?.name && <><span className="text-slate-300">/</span><span className="text-ink-700">{firmInfo.name}</span></>}
                        </p>
                        <h1 className="page-title text-[34px] leading-tight text-ink-950 mt-1.5">{greeting()}, {firstName}</h1>
                        <p className="text-[14px] text-slate-500 mt-1">{t('Here is your practice at a glance.')}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Link to="/diary" className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-white border border-line-strong text-sm font-semibold text-ink-900 shadow-soft hover:border-ink-300 hover:bg-paper-50 transition-colors"><Plus size={15} />{t('Add hearing')}</Link>
                        <Link to="/chat" className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-ink-900 text-white text-sm font-semibold shadow-[0_1px_2px_rgba(11,18,32,0.25),inset_0_1px_0_rgba(255,255,255,0.08)] hover:bg-ink-800 transition-colors"><MessageSquareText size={15} className="text-gold-300" />{t('New research')}</Link>
                        <span className="w-px h-6 bg-line mx-1 hidden sm:block" />
                        <LanguageToggle />
                    </div>
                </div>

                {/* KPIs */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <Kpi to="/diary" icon={CalendarClock} label={t('Hearings this week')} value={hearings === null ? '—' : thisWeek}
                        sub={upcoming[0] ? t('Next: {when}', { when: whenLabel(upcoming[0].hearing_date) }) : t('Nothing scheduled')} tone={soon.length ? 'amber' : 'ink'} />
                    <Kpi to="/billing" icon={TrendingUp} label={t('Outstanding fees')} value={billing ? formatPKR(billing.outstanding) : '—'}
                        sub={billing ? t('{amount} received this month', { amount: formatPKR(billing.received_this_month) }) : t('Approved entries only')} tone={billing && Number(billing.outstanding) > 0 ? 'red' : 'ink'} />
                    <Kpi to="/billing" icon={ShieldCheck} label={t('Awaiting your approval')} value={billing ? (billing.awaiting_my_review ?? 0) : '—'}
                        sub={billing ? t('{n} pending in the firm', { n: billing.pending_count ?? 0 }) : t('Maker-checker')} tone={billing?.awaiting_my_review ? 'amber' : 'green'} />
                    <Kpi to="/clients" icon={Users} label={t('Clients')} value={clients === null ? '—' : clients.length}
                        sub={clients ? (openCases === 1 ? t('1 open case') : t('{n} open cases', { n: openCases })) : t('Clients & cases')} />
                </div>

                {/* agenda + research + attention */}
                <div className="grid lg:grid-cols-3 gap-6 items-start">
                    <Panel title={t('Upcoming hearings')} icon={CalendarDays} className="lg:col-span-2 lg:row-span-2 self-stretch" action={<PanelLink to="/diary">{t('Case diary')}</PanelLink>}>
                        {hearings === null ? <Loading /> : upcoming.length === 0 ? (
                            <Empty icon={CalendarClock} text={t('No upcoming hearings.')} to="/diary" cta={t('Add a hearing')} />
                        ) : (
                            <ol className="divide-y divide-line">
                                {upcoming.slice(0, 6).map(h => {
                                    const n = daysUntil(h.hearing_date);
                                    const d = new Date(h.hearing_date + 'T00:00:00');
                                    const near = n <= 1;
                                    return (
                                        <li key={h.id}>
                                            <Link to="/diary" className="flex items-center gap-4 px-5 py-3.5 hover:bg-paper-50 transition-colors">
                                                <div className={`w-[52px] flex-shrink-0 text-center rounded-xl overflow-hidden ring-1 ${near ? 'ring-amber-200' : 'ring-line'}`}>
                                                    <div className={`text-[10px] font-bold uppercase tracking-wider py-0.5 ${near ? 'bg-gold-500 text-white' : 'bg-ink-900 text-gold-300'}`}>{d.toLocaleDateString(dateLocale, { month: 'short' })}</div>
                                                    <div className={`text-[19px] font-bold leading-none py-1.5 tabular-nums ${near ? 'bg-amber-50 text-gold-700' : 'bg-white text-ink-950'}`}>{d.getDate()}</div>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div dir="auto" className="text-[14px] font-semibold text-ink-950 truncate text-start">{h.case_title}</div>
                                                    <div className="text-[12.5px] text-slate-500 truncate mt-0.5">{[h.court, h.hearing_time, h.case_number].filter(Boolean).join(' · ') || '—'}</div>
                                                </div>
                                                <span className={`inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-[11.5px] font-semibold whitespace-nowrap ring-1 ring-inset ${near ? 'bg-amber-50 text-amber-800 ring-amber-200' : 'bg-paper-100 text-slate-600 ring-line'}`}>
                                                    {near && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />}{whenLabel(h.hearing_date)}
                                                </span>
                                            </Link>
                                        </li>
                                    );
                                })}
                            </ol>
                        )}
                        {hearings !== null && upcoming.length > 0 && (
                            <Link to="/diary" className="group mt-auto flex items-center justify-between gap-3 px-5 h-12 border-t border-line bg-paper-50 text-[13px] font-semibold text-slate-600 hover:text-ink-950 hover:bg-paper-100 transition-colors">
                                <span>{upcoming.length > 6 ? t('{n} more in the case diary', { n: upcoming.length - 6 }) : t('Open the case diary')}</span>
                                <ArrowRight size={15} className="text-gold-600 rtl:rotate-180 transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5" />
                            </Link>
                        )}
                    </Panel>

                    <ResearchCard t={t} />

                    <Panel title={t('Needs your attention')} icon={AlertTriangle}>
                        {!attentionLoaded ? <Loading /> : attention.length === 0 ? (
                            <div className="px-5 py-7 flex items-center gap-3">
                                <span className="w-10 h-10 rounded-xl bg-emerald-50 ring-1 ring-emerald-100 flex items-center justify-center flex-shrink-0"><CheckCircle2 size={19} className="text-emerald-600" /></span>
                                <p className="text-[13.5px] text-slate-600 leading-snug">{t('All clear — nothing needs you right now.')}</p>
                            </div>
                        ) : (
                            <ul className="divide-y divide-line">
                                {attention.map((a, i) => (
                                    <li key={i}>
                                        <Link to={a.to} className="group flex items-start gap-3 px-5 py-3 hover:bg-paper-50 transition-colors">
                                            <span className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${a.tone === 'red' ? 'bg-red-50 text-red-500' : a.tone === 'amber' ? 'bg-amber-50 text-gold-700' : 'bg-ink-50 text-ink-600'}`}><a.icon size={14} /></span>
                                            <span className="flex-1 text-[13px] text-ink-900 leading-snug pt-1">{a.text}</span>
                                            <ChevronRight size={14} className="mt-1.5 text-slate-300 group-hover:text-ink-700 rtl:rotate-180 flex-shrink-0" />
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Panel>
                </div>

                {/* money + documents + research history */}
                <div className="grid lg:grid-cols-3 gap-6">
                    <Panel title={t('This month')} icon={Receipt} action={<PanelLink to="/billing">{t('Billing')}</PanelLink>}>
                        {monthEntries === null ? <Loading /> : (
                            <div className="px-5 py-5 space-y-5">
                                {[[t('Fees & expenses billed'), month.billed, 'bg-ink-gradient'], [t('Payments received'), month.received, 'bg-gradient-to-r from-emerald-500 to-emerald-400']].map(([l, v, c]) => (
                                    <div key={l}>
                                        <div className="flex items-baseline justify-between mb-2">
                                            <span className="text-[13px] text-slate-500">{l}</span>
                                            <span className="text-[15px] font-semibold tabular-nums text-ink-950">{formatPKR(v)}</span>
                                        </div>
                                        <div className="h-2 rounded-full bg-paper-200 overflow-hidden">
                                            <div className={`h-full rounded-full ${c} transition-all duration-500`} style={{ width: `${Math.max((v / maxBar) * 100, v > 0 ? 4 : 0)}%` }} />
                                        </div>
                                    </div>
                                ))}
                                <p className="text-[11.5px] text-slate-400 leading-relaxed border-t border-line pt-3">{t('Approved entries dated this month. Pending entries count once approved.')}</p>
                            </div>
                        )}
                    </Panel>

                    <Panel title={t('Recent documents')} icon={FolderLock} action={<PanelLink to="/vault">{t('Vault')}</PanelLink>}>
                        {docs === null ? <Loading /> : docs.length === 0 ? (
                            <Empty icon={FolderLock} text={t('No documents yet.')} to="/vault" cta={t('Upload a document')} />
                        ) : (
                            <ul className="divide-y divide-line">
                                {docs.slice(0, 4).map(d => (
                                    <li key={d.id} className="flex items-center gap-3 px-5 py-3">
                                        <span className="w-8 h-8 rounded-lg bg-emerald-50 ring-1 ring-emerald-100 flex items-center justify-center flex-shrink-0"><FileText size={14} className="text-emerald-600" /></span>
                                        <div className="min-w-0 flex-1">
                                            <div dir="auto" className="text-[13px] font-medium text-ink-950 truncate text-start">{d.title}</div>
                                            <div className="text-[11.5px] text-slate-400 truncate">{d.client_name || t('Unfiled')} · <span className="ltr inline-block">{formatBytes(d.size_bytes)}</span></div>
                                        </div>
                                    </li>
                                ))}
                                {vaultStats && <li className="px-5 py-2.5 text-[11.5px] text-slate-400 bg-paper-50">{t('{n} documents', { n: vaultStats.document_count })} · <span className="ltr inline-block">{formatBytes(vaultStats.total_bytes)}</span> · {t('AES-256 encrypted')}</li>}
                            </ul>
                        )}
                    </Panel>

                    <Panel title={t('Recent research')} icon={MessageSquareText} action={<PanelLink to="/chat">{t('Legal chat')}</PanelLink>}>
                        {sessions === null ? <Loading /> : sessions.length === 0 ? (
                            <Empty icon={MessageSquareText} text={t('No research yet.')} to="/chat" cta={t('Ask a question')} />
                        ) : (
                            <ul className="divide-y divide-line">
                                {sessions.slice(0, 4).map(s => (
                                    <li key={s.id}>
                                        <button onClick={() => navigate(`/chat?session=${s.id}`)} className="group w-full flex items-center gap-3 text-start px-5 py-3 hover:bg-paper-50 transition-colors">
                                            <span className="w-8 h-8 rounded-lg bg-ink-50 ring-1 ring-ink-100 flex items-center justify-center flex-shrink-0"><MessageSquareText size={14} className="text-ink-600" /></span>
                                            <span className="min-w-0 flex-1">
                                                <span className="block text-[13px] font-medium text-ink-950 truncate" dir="auto">{s.title}</span>
                                                <span className="block text-[11.5px] text-slate-400">{s.updated_at ? formatDate(s.updated_at) : ''} · {t('{n} messages', { n: s.message_count })}</span>
                                            </span>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Panel>
                </div>

                {/* quick actions */}
                <section>
                    <h3 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-slate-400 mb-3">{t('Quick actions')}</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                        {[
                            [MessageSquareText, t('Research a point'), '/chat'],
                            [CalendarClock, t('Add a hearing'), '/diary'],
                            [Users, t('New client'), '/clients'],
                            [FolderLock, t('Upload a document'), '/vault'],
                            [Receipt, t('Record a fee'), '/billing'],
                            [FileSearch, t('Analyse a PDF'), '/documents'],
                        ].map(([Icon, label, to]) => (
                            <Link key={label} to={to} className="group flex flex-col items-start gap-3 p-4 rounded-2xl bg-white border border-line shadow-soft hover:shadow-lift hover:-translate-y-0.5 hover:border-line-strong transition-all duration-200">
                                <span className="w-9 h-9 rounded-xl bg-paper-200 ring-1 ring-line flex items-center justify-center group-hover:bg-ink-900 group-hover:ring-ink-900 transition-colors">
                                    <Icon size={16} className="text-ink-700 group-hover:text-gold-300 transition-colors" />
                                </span>
                                <span className="text-[13.5px] font-semibold text-ink-950 leading-tight">{label}</span>
                            </Link>
                        ))}
                    </div>
                </section>

                {/* coverage footer */}
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3.5 rounded-2xl bg-white/60 border border-line text-[12.5px] text-slate-500">
                    <span className="flex items-center gap-2 font-semibold text-ink-900"><Scale size={14} className="text-gold-600" />{t('Research covers')}</span>
                    <span><b className="font-semibold text-ink-900 tabular-nums">{fmt(COVERAGE.judgments.sc)}</b> {t('Supreme Court')}</span>
                    <span><b className="font-semibold text-ink-900 tabular-nums">{fmt(COVERAGE.judgments.lhc)}</b> {t('Lahore HC')}</span>
                    <span><b className="font-semibold text-ink-900 tabular-nums">{fmt(COVERAGE.judgments.ihc)}</b> {t('Islamabad HC')}</span>
                    <span><b className="font-semibold text-ink-900 tabular-nums">{fmt(COVERAGE.judgments.district)}</b> {t('District courts')}</span>
                    <span><b className="font-semibold text-ink-900 tabular-nums">{fmt(TOTAL_STATUTES)}</b> {t('statutes')}</span>
                    <span className="ms-auto flex items-center gap-1.5 text-slate-400"><Clock size={12} />{t('{n} judgments', { n: fmt(TOTAL_JUDGMENTS) })}</span>
                </div>
            </div>
        </div>
    );
}
