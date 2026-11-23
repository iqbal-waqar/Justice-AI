import React from 'react';
import { Link } from 'react-router-dom';
import {
    ArrowUp, Scale, ShieldCheck, Languages, CalendarClock, FileSearch, MessageSquareText, Search, Filter,
    PenLine, BookOpen, CheckCircle2, Lock, FolderLock, Wallet, Mic, UsersRound, History, LayoutDashboard, Users,
    ExternalLink, Library, Landmark, Gavel, ScrollText, Check, KeyRound, FileText, Sparkles, Quote,
} from 'lucide-react';
import { getToken, isTokenExpired } from '../api';
import LiveDemo from '../components/LiveDemo';
import Showcase from '../components/Showcase';
import { useI18n } from '../i18n';
import {
    BillingPreview, Card, ClosingCta, DiaryPreview, DocumentPreview, Eyebrow, GRID_BG, H2, IconTile, Lead, LibraryPreview,
    MoreLink, PrimaryLink, Reveal, Section, SecondaryLink, SecurityEvidence, TeamPreview, Tick, UrduPreview, VaultPreview,
} from '../components/marketing';

/* ── hero: the product itself, drawn with the app's own styles ───────────── */
function AppWindow() {
    const { t } = useI18n();
    const nav = [[LayoutDashboard, t('Dashboard')], [MessageSquareText, t('Legal research'), true], [FileSearch, t('Document analysis')], [Library, t('Law library')], [CalendarClock, t('Case diary')], [Users, t('Clients & cases')], [FolderLock, t('Document vault')], [Wallet, t('Billing')]];
    return (
        <div className="rounded-[22px] p-1.5 bg-white/70 ring-1 ring-line shadow-[0_2px_4px_rgba(18,29,47,0.04),0_60px_120px_-40px_rgba(11,18,32,0.5)] backdrop-blur text-start">
            <div className="rounded-2xl bg-white ring-1 ring-line overflow-hidden">
                <div className="flex items-center gap-2 px-4 h-10 border-b border-line bg-paper-100">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#f0b4a8]" /><span className="w-2.5 h-2.5 rounded-full bg-[#efd59b]" /><span className="w-2.5 h-2.5 rounded-full bg-[#b9dcb4]" />
                    <span className="mx-auto px-3 h-6 inline-flex items-center gap-1.5 rounded-md bg-white ring-1 ring-line text-[11px] text-slate-500"><Lock size={10} className="text-emerald-600" />justice-ai · {t('Legal research')}</span>
                    <span className="w-12" />
                </div>
                <div className="flex">
                    <div className="hidden md:flex flex-col relative w-52 bg-ink-gradient p-3 flex-shrink-0">
                        <span className="absolute inset-0 bg-ink-sheen pointer-events-none" />
                        <div className="relative flex items-center gap-2 px-2 pt-1 pb-4">
                            <span className="w-7 h-7 rounded-lg bg-white/[0.07] ring-1 ring-gold-400/30 flex items-center justify-center"><Scale size={14} className="text-gold-300" /></span>
                            <span className="font-serif text-[15px] font-semibold text-white">Justice <span className="text-gold-300">AI</span></span>
                        </div>
                        {nav.map(([Icon, label, active]) => (
                            <div key={label} className={`relative flex items-center gap-2.5 px-2.5 h-8 rounded-lg text-[12.5px] ${active ? 'bg-white/[0.08] text-white font-semibold' : 'text-white/55'}`}>
                                {active && <span className="absolute start-0 top-1.5 bottom-1.5 w-[2.5px] rounded-e-full bg-gold-400" />}
                                <Icon size={14} className={active ? 'text-gold-300' : 'text-white/40'} />{label}
                            </div>
                        ))}
                    </div>
                    <div className="flex-1 min-w-0 px-5 sm:px-10 py-7 space-y-5 text-[13.5px] bg-gradient-to-b from-white to-paper-50">
                        <div className="flex justify-end">
                            <div className="max-w-[80%] px-4 py-2.5 rounded-3xl rounded-ee-lg bg-ink-900 text-white shadow-soft">{t('Is the offence under section 489-F PPC bailable?')}</div>
                        </div>
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <span className="w-6 h-6 rounded-lg bg-ink-900 flex items-center justify-center"><Scale size={12} className="text-gold-300" /></span>
                                <span className="text-[12.5px] font-semibold text-ink-950">Justice AI</span>
                                <span className="text-[11.5px] text-slate-400 flex items-center gap-1"><CheckCircle2 size={12} className="text-emerald-600" />{t('Researched in {n} steps', { n: 5 })}</span>
                            </div>
                            <div className="ps-8 leading-[1.75] text-slate-700 space-y-2.5">
                                <p>{t('The judgments do not call it “bailable”. Section 489-F PPC carries a maximum of three years, so it falls')} <b className="font-semibold text-ink-950">{t('outside the prohibitory clause')}</b> {t('of Section 497 Cr.P.C. Bail is therefore the rule and refusal the exception.')}</p>
                                <p className="hidden sm:block">{t('The Supreme Court applied this in Noman Khaliq v. The State (2023 SCMR 2122) and Abdul Saboor v. The State (2022 SCMR 592), granting bail where the dispute was essentially over money owed.')}</p>
                            </div>
                            <div className="ps-8 mt-3.5 flex flex-wrap gap-1.5">
                                {['Noman Khaliq v. The State', 'Abdul Saboor v. The State', 'Pakistan Penal Code, 1860'].map((n, i) => (
                                    <span key={n} dir="ltr" className="inline-flex items-center gap-1.5 ps-1.5 pe-2.5 py-1 rounded-full bg-white ring-1 ring-line shadow-soft text-[11.5px] text-slate-700">
                                        <span className="w-4 h-4 rounded-full bg-ink-900 text-white text-[9px] font-semibold flex items-center justify-center">{i + 1}</span>{n}<ExternalLink size={10} className="text-slate-400" />
                                    </span>
                                ))}
                            </div>
                        </div>
                        <div className="flex items-center gap-3 ps-5 pe-2 h-12 rounded-full ring-1 ring-line-strong bg-white shadow-soft text-slate-400">
                            <span className="flex-1 truncate">{t('Ask a follow-up, in English or اردو…')}</span>
                            <Mic size={16} />
                            <span className="w-8 h-8 rounded-full bg-ink-900 flex items-center justify-center"><ArrowUp size={15} className="text-gold-300" /></span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

/* A compact research exchange shown inside the bento's featured card. */
function ResearchMini() {
    const { t } = useI18n();
    return (
        <div className="rounded-2xl bg-paper-50 ring-1 ring-line p-4 sm:p-5 space-y-3 text-[13px]">
            <div className="flex justify-end"><span className="px-3.5 py-2 rounded-2xl rounded-ee-md bg-ink-900 text-white shadow-soft">{t('What is the effect of delay in lodging an FIR?')}</span></div>
            <div className="flex gap-2.5">
                <span className="w-6 h-6 rounded-lg bg-ink-900 flex items-center justify-center flex-shrink-0 mt-0.5"><Scale size={12} className="text-gold-300" /></span>
                <div className="min-w-0">
                    <p className="text-slate-700 leading-relaxed">{t('Unexplained delay casts doubt on the prosecution story and the benefit goes to the accused. The FIR is the cornerstone of the case, as the Supreme Court held in Mst. Asia Bibi v. The State (PLD 2019 SC 64)…')}</p>
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {['Mst. Asia Bibi v. The State', 'Muhammad Ashraf v. The State'].map((n, i) => (
                            <span key={n} dir="ltr" className="inline-flex items-center gap-1.5 ps-1.5 pe-2.5 py-1 rounded-full bg-white ring-1 ring-line text-[11.5px] text-slate-700">
                                <span className="w-4 h-4 rounded-full bg-ink-900 text-white text-[9px] font-semibold flex items-center justify-center">{i + 1}</span>{n}<ExternalLink size={10} className="text-slate-400" />
                            </span>
                        ))}
                    </div>
                </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2 pt-3 border-t border-line text-[12.5px] text-slate-500">
                {[t('Understood the question'), t('Searched case law across all courts'), t('Found {n} judgments on point', { n: 4 }), t('Checked every statement against the sources')].map(x => (
                    <div key={x} className="flex items-center gap-2"><CheckCircle2 size={14} className="text-emerald-600 flex-shrink-0" />{x}</div>
                ))}
            </div>
        </div>
    );
}

/* One tile of the bento grid. */
function Tile({ icon, title, text, to = '/features', className = '', children }) {
    return (
        <Link to={to} className={`group block ${className}`}>
            <Card hover className="h-full p-6 flex flex-col">
                <div className="flex items-center gap-3">
                    <IconTile icon={icon} />
                    <h3 className="font-serif text-[19px] font-semibold text-ink-950 leading-snug group-hover:text-gold-700 transition-colors rtl:pt-1">{title}</h3>
                </div>
                <p className="text-[14px] text-slate-600 leading-relaxed mt-3">{text}</p>
                {children && <div className="mt-5">{children}</div>}
            </Card>
        </Link>
    );
}

export default function LandingPage() {
    const { t, lang } = useI18n();
    const signedIn = !isTokenExpired(getToken());
    const primary = signedIn ? { to: '/dashboard', label: t('Open your workspace') } : { to: '/start', label: t('Get started free') };

    const QUESTIONS = [
        t('Is the offence under section 489-F PPC bailable?'), t('What is the effect of delay in lodging an FIR?'),
        t('Grounds for post-arrest bail under Section 497 Cr.P.C.'), t('Procedure for khula in the Family Court'),
        t('Maintenance for children after divorce'), t('Quashing an FIR under Section 561-A Cr.P.C.'),
        t('Limitation for filing a civil revision'), t('Court hours of the civil courts in Punjab'),
    ];
    const SOURCES = [
        [Landmark, t('Supreme Court of Pakistan'), t('Reported judgments')], [Scale, t('Lahore High Court'), t('Reported judgments')],
        [Scale, t('Islamabad High Court'), t('Reported judgments')], [Gavel, t('Punjab district courts'), t('Past judgments')],
        [BookOpen, t('Federal and Punjab statutes'), t('Official text')], [ScrollText, t('LHC Rules and Orders'), t('Court rules')],
    ];
    const PRINCIPLES = [
        { n: '01', title: t('Grounded'), text: t('Every answer is built from past judgments and the official text of the law — never from the model’s memory.') },
        { n: '02', title: t('Verified'), text: t('A reviewer step reads each judgment it found and keeps only the ones that truly answer your question.') },
        { n: '03', title: t('Cited'), text: t('Every source is numbered in the answer and opens the court’s or the government’s own document.') },
    ];
    const STEPS = [
        { icon: PenLine, title: t('Ask'), text: t('In English, Urdu or Roman Urdu — a section, a legal issue or your client’s facts.') },
        { icon: Search, title: t('Search'), text: t('Justice AI works out what you mean and searches past judgments and statutes by keyword and by meaning.') },
        { icon: Filter, title: t('Verify'), text: t('A reviewer step keeps only judgments that genuinely address your issue.') },
        { icon: BookOpen, title: t('Answer'), text: t('A clear answer, streamed live, with every source one click away.') },
    ];

    return (
        <div className="bg-paper-50 overflow-x-clip">
            {/* ── Hero ── */}
            <section className="relative pt-32 sm:pt-40">
                <div aria-hidden className="absolute inset-0 pointer-events-none" style={{ ...GRID_BG, maskImage: 'radial-gradient(ellipse 70% 55% at 50% 0%, black 20%, transparent 100%)' }} />
                <div aria-hidden className="absolute top-[-280px] left-1/2 -translate-x-1/2 w-[1200px] h-[680px] rounded-full bg-[radial-gradient(closest-side,rgba(232,201,134,0.6),rgba(232,201,134,0.14)_55%,transparent)] blur-2xl pointer-events-none" />
                <div aria-hidden className="absolute top-[260px] -start-32 w-[520px] h-[520px] rounded-full bg-ink-200/40 blur-3xl pointer-events-none" />
                <div aria-hidden className="absolute top-[520px] -end-40 w-[560px] h-[560px] rounded-full bg-emerald-100/50 blur-3xl pointer-events-none" />
                <svg aria-hidden className="absolute left-1/2 -translate-x-1/2 top-[-120px] w-[1100px] h-[1100px] pointer-events-none opacity-[0.35]" viewBox="0 0 1100 1100" fill="none">
                    {[260, 380, 500].map(r => <circle key={r} cx="550" cy="550" r={r} stroke="url(#ring)" strokeWidth="1" />)}
                    <defs><linearGradient id="ring" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor="#d4a853" stopOpacity="0" /><stop offset="0.5" stopColor="#d4a853" stopOpacity="0.9" /><stop offset="1" stopColor="#d4a853" stopOpacity="0" /></linearGradient></defs>
                </svg>
                <div className="relative max-w-6xl mx-auto px-5 sm:px-8 text-center">
                    <Reveal>
                        <p className="eyebrow inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/80 backdrop-blur ring-1 ring-line shadow-soft text-[12.5px] font-semibold text-ink-800 mb-8">
                            <Sparkles size={13} className="text-gold-600" />{t('The legal workspace for Pakistani advocates')}
                        </p>
                        <h1 className="font-serif text-[2.75rem] sm:text-[4.5rem] leading-[1.03] font-semibold tracking-[-0.03em] text-ink-950 max-w-4xl mx-auto mb-6 text-balance rtl:text-[2.1rem] sm:rtl:text-[3.1rem] rtl:tracking-normal rtl:pt-3">
                            {t('Legal research and practice management,')}{' '}
                            <span className="italic text-gradient-gold pe-1 rtl:not-italic rtl:[background:none] rtl:text-gold-600">{t('built for Pakistan.')}</span>
                        </h1>
                        <p className="text-[17px] sm:text-[19px] text-slate-600 leading-relaxed max-w-2xl mx-auto mb-9 text-balance">
                            {t('Ask in English or Urdu and get an answer grounded in past judgments, with every source linked. Then run your files, fees and hearings from the same secure workspace.')}
                        </p>
                        <div className="flex flex-col sm:flex-row justify-center gap-3">
                            <PrimaryLink to={primary.to} className="btn-sheen h-[52px] px-7 rounded-2xl text-[15.5px]">{primary.label}</PrimaryLink>
                            <SecondaryLink to="/features" className="h-[52px] px-7 rounded-2xl text-[15.5px]">{t('See what it does')}</SecondaryLink>
                        </div>
                        <div className="mt-6 flex flex-wrap justify-center gap-x-7 gap-y-2 text-[13.5px] text-slate-500">
                            {[t('Free to start'), t('Sign in with Google'), t('English, اردو and voice')].map(x => (
                                <span key={x} className="inline-flex items-center gap-1.5"><Check size={14} strokeWidth={2.6} className="text-gold-600" />{x}</span>
                            ))}
                        </div>
                    </Reveal>
                    <div className="relative mt-16 sm:mt-20 max-w-6xl mx-auto">
                        <div aria-hidden className="absolute -inset-x-16 -bottom-16 top-24 rounded-[60px] bg-[radial-gradient(ellipse_at_center,rgba(191,149,63,0.25),transparent_70%)] blur-3xl" />
                        {/* two real screens behind the live demo */}
                        <img src={`/screens/${lang === 'ur' ? 'ur' : 'en'}/dashboard.webp`} alt="" aria-hidden draggable={false}
                            className="hidden lg:block absolute -start-10 top-16 w-[34%] rounded-2xl ring-1 ring-line shadow-lift [transform:perspective(1600px)_rotateY(14deg)] rtl:[transform:perspective(1600px)_rotateY(-14deg)] opacity-90" />
                        <img src={`/screens/${lang === 'ur' ? 'ur' : 'en'}/billing.webp`} alt="" aria-hidden draggable={false}
                            className="hidden lg:block absolute -end-10 top-24 w-[34%] rounded-2xl ring-1 ring-line shadow-lift [transform:perspective(1600px)_rotateY(-14deg)] rtl:[transform:perspective(1600px)_rotateY(14deg)] opacity-90" />
                        <div className="relative max-w-3xl mx-auto animate-slide-up"><LiveDemo /></div>
                    </div>
                </div>
            </section>

            {/* ── Example questions, drifting past ── */}
            <div className="marquee relative mt-14 sm:mt-16 py-2 overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_12%,black_88%,transparent)]">
                <div className="marquee-track gap-3 pe-3">
                    {[...QUESTIONS, ...QUESTIONS].map((q, i) => (
                        <span key={i} className="inline-flex items-center gap-2 ps-3 pe-4 py-2.5 rounded-full bg-white ring-1 ring-line shadow-soft text-[13.5px] text-ink-900 whitespace-nowrap">
                            <MessageSquareText size={14} className="text-gold-600 flex-shrink-0" />{q}
                        </span>
                    ))}
                </div>
            </div>

            {/* ── See it in action ── */}
            <Section className="pt-20 sm:pt-24 pb-4">
                <Reveal>
                    <div className="max-w-2xl mb-10 sm:mb-12">
                        <Eyebrow>{t('See it in action')}</Eyebrow>
                        <H2>{t('The whole practice, one screen at a time.')}</H2>
                        <Lead>{t('Real screens from Justice AI. Pick a module, or let them play.')}</Lead>
                    </div>
                </Reveal>
                <Reveal delay={80}><Showcase /></Reveal>
            </Section>

            {/* ── Sources ── */}
            <section className="mt-16 sm:mt-20 border-y border-line bg-white">
                <div className="max-w-6xl mx-auto px-5 sm:px-8 py-12 sm:py-14">
                    <p className="eyebrow flex items-center justify-center gap-4 text-[11.5px] font-semibold uppercase tracking-[0.2em] text-slate-400 mb-8">
                        <span className="hidden sm:block w-12 h-px bg-gradient-to-r from-transparent to-gold-300" />{t('Answers drawn from the official record of')}<span className="hidden sm:block w-12 h-px bg-gradient-to-l from-transparent to-gold-300" />
                    </p>
                    <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                        {SOURCES.map(([Icon, name, kind]) => (
                            <li key={name} className="group flex flex-col items-center text-center gap-3 px-3 py-5 rounded-2xl bg-paper-50 ring-1 ring-line transition-all duration-300 hover:bg-white hover:shadow-lift hover:-translate-y-0.5">
                                <span className="relative w-11 h-11 rounded-xl bg-ink-gradient ring-1 ring-white/5 flex items-center justify-center shadow-[0_8px_18px_-8px_rgba(11,18,32,0.6)]">
                                    <span className="absolute inset-0 rounded-xl bg-ink-sheen" /><Icon size={18} className="relative text-gold-300" />
                                </span>
                                <span className="text-[13.5px] font-semibold text-ink-950 leading-snug">{name}</span>
                                <span className="text-[11.5px] text-slate-500 -mt-1.5">{kind}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </section>

            {/* ── Bento: the platform ── */}
            <Section className="py-24 sm:py-32">
                <Reveal>
                    <div className="max-w-2xl mb-12 sm:mb-14">
                        <Eyebrow>{t('The platform')}</Eyebrow>
                        <H2>{t('Everything a practice needs, in one workspace.')}</H2>
                        <Lead>{t('Research, documents, hearings and accounts share the same clients and cases, so nothing is typed twice.')}</Lead>
                    </div>
                </Reveal>
                <div className="grid md:grid-cols-2 lg:grid-cols-6 gap-4">
                    <Reveal className="md:col-span-2 lg:col-span-4 lg:row-span-2">
                        <Tile icon={MessageSquareText} title={t('Legal research')} className="h-full"
                            text={t('Ask the way you would ask a senior colleague. Justice AI works out what you mean, searches past judgments and statutes, checks what it found, and writes a clear answer with the authorities cited as it goes.')}>
                            <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-2.5 mb-5">
                                {[t('Only real judgments are cited, each linked to the court’s PDF'), t('Follow-up questions keep the context of the conversation'), t('Indian provisions are mapped to their Pakistani equivalents'), t('When the law reports don’t cover a point, it says so')].map(x => <Tick key={x}>{x}</Tick>)}
                            </ul>
                            <ResearchMini />
                        </Tile>
                    </Reveal>
                    <Reveal className="lg:col-span-2 lg:row-span-2" delay={80}>
                        <Tile icon={Languages} title={t('English, اردو and voice')} className="h-full"
                            text={t('Type or speak in English, Urdu or Roman Urdu. Citations stay exactly as the court reported them.')}>
                            <UrduPreview />
                        </Tile>
                    </Reveal>
                    <Reveal className="lg:col-span-2"><Tile icon={CalendarClock} title={t('Case diary')} className="h-full" text={t('Hearings and case notes in one diary, with WhatsApp and email reminders before every date.')}><DiaryPreview /></Tile></Reveal>
                    <Reveal className="lg:col-span-2" delay={60}><Tile icon={FolderLock} title={t('Document vault')} className="h-full" text={t('Every petition, order and piece of evidence encrypted before storage and visible only to your firm.')}><VaultPreview /></Tile></Reveal>
                    <Reveal className="lg:col-span-2" delay={120}><Tile icon={Wallet} title={t('Billing')} className="h-full" text={t('Fees, expenses and payments in rupees, approved by a partner before they count.')}><BillingPreview /></Tile></Reveal>
                    <Reveal className="lg:col-span-2"><Tile icon={FileSearch} title={t('Document analysis')} className="h-full" text={t('Upload an FIR, a judgment or a contract and ask questions answered only from that document.')}><DocumentPreview /></Tile></Reveal>
                    <Reveal className="lg:col-span-2" delay={60}><Tile icon={Library} title={t('Law library')} className="h-full" text={t('Federal and Punjab laws by category, Urdu court forms and your office’s own documents on one shelf.')}><LibraryPreview /></Tile></Reveal>
                    <Reveal className="lg:col-span-2" delay={120}><Tile icon={UsersRound} title={t('Clients, cases and your team')} className="h-full" text={t('One file per client with their cases, documents, hearings and balance, shared with your team.')}><TeamPreview /></Tile></Reveal>
                </div>
                <div className="mt-10 text-center"><MoreLink to="/features">{t('Explore the features')}</MoreLink></div>
            </Section>

            {/* ── Principles: the one deep-navy band ── */}
            <section className="relative overflow-hidden bg-ink-gradient">
                <span aria-hidden className="absolute inset-0 bg-ink-sheen pointer-events-none" />
                <div aria-hidden className="absolute inset-0 pointer-events-none opacity-60" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)', backgroundSize: '56px 56px', maskImage: 'radial-gradient(ellipse 70% 90% at 50% 50%, black 20%, transparent 100%)' }} />
                <div aria-hidden className="absolute -top-32 end-[-120px] w-[560px] h-[560px] rounded-full bg-gold-500/15 blur-3xl pointer-events-none" />
                <div className="relative max-w-6xl mx-auto px-5 sm:px-8 py-24 sm:py-28">
                    <Reveal>
                        <div className="max-w-3xl">
                            <Eyebrow light>{t('Built on the official record')}</Eyebrow>
                            <H2 className="text-white">{t('Answers come from past judgments and the statute book, never from memory.')}</H2>
                        </div>
                    </Reveal>
                    <div className="mt-14 grid md:grid-cols-3 gap-px bg-white/10 rounded-2xl overflow-hidden ring-1 ring-white/10">
                        {PRINCIPLES.map((p, i) => (
                            <Reveal key={p.n} delay={i * 90} className="bg-ink-950/40">
                                <div className="p-7 sm:p-8 h-full">
                                    <div className="font-serif text-[2.6rem] leading-none text-gold-300/90 tabular-nums">{p.n}</div>
                                    <h3 className="font-serif text-[22px] font-semibold text-white mt-5 rtl:pt-1">{p.title}</h3>
                                    <p className="text-[14.5px] text-white/60 leading-relaxed mt-2.5">{p.text}</p>
                                </div>
                            </Reveal>
                        ))}
                    </div>
                    <Reveal delay={200}>
                        <div className="mt-8 flex flex-col sm:flex-row sm:items-center gap-3 text-[14px] text-white/60">
                            <Quote size={16} className="text-gold-300 flex-shrink-0" />
                            <span>{t('If the judgments don’t cover a question, Justice AI says so instead of inventing an authority.')}</span>
                        </div>
                    </Reveal>
                </div>
            </section>

            {/* ── How it works: timeline ── */}
            <Section className="py-24 sm:py-32">
                <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-12 lg:gap-20">
                    <Reveal>
                        <div className="lg:sticky lg:top-28">
                            <Eyebrow>{t('How research works')}</Eyebrow>
                            <H2>{t('From question to cited answer, and you can watch every step.')}</H2>
                            <Lead>{t('Each answer passes through four stages. You see them happen live, and you can open every source it relied on.')}</Lead>
                            <div className="mt-8"><MoreLink to="/how-it-works">{t('See the full process')}</MoreLink></div>
                        </div>
                    </Reveal>
                    <ol className="relative">
                        <span aria-hidden className="absolute start-[23px] top-6 bottom-6 w-px bg-gradient-to-b from-gold-300 via-gold-400/60 to-transparent" />
                        {STEPS.map((s, i) => (
                            <Reveal key={s.title} delay={i * 80}>
                                <li className="relative flex gap-6 pb-8 last:pb-0">
                                    <span className="relative z-10 w-12 h-12 rounded-full bg-white ring-1 ring-line shadow-soft flex items-center justify-center flex-shrink-0">
                                        <span className="w-9 h-9 rounded-full bg-ink-gradient flex items-center justify-center"><s.icon size={16} className="text-gold-300" /></span>
                                    </span>
                                    <Card className="flex-1 p-6">
                                        <div className="flex items-center justify-between gap-4 mb-1.5">
                                            <h3 className="font-sans text-[16.5px] font-semibold text-ink-950">{s.title}</h3>
                                            <span className="text-[12px] font-semibold tracking-[0.14em] text-gold-700 rtl:tracking-normal">{String(i + 1).padStart(2, '0')}</span>
                                        </div>
                                        <p className="text-[14.5px] text-slate-600 leading-relaxed">{s.text}</p>
                                    </Card>
                                </li>
                            </Reveal>
                        ))}
                    </ol>
                </div>
            </Section>

            {/* ── Security ── */}
            <section className="bg-white border-y border-line py-24 sm:py-32 overflow-hidden">
                <div className="max-w-6xl mx-auto px-5 sm:px-8 grid lg:grid-cols-[0.8fr_1.2fr] gap-12 lg:gap-16 items-center">
                    <Reveal>
                        <Eyebrow>{t('Security & trust')}</Eyebrow>
                        <H2>{t('Your clients’ confidences stay confidential.')}</H2>
                        <Lead>{t('Documents are protected at rest, access is limited to your firm, money records need a second approver, and research answers are never invented.')}</Lead>
                        <ul className="mt-7 space-y-3">
                            {[t('AES-256 encryption before storage'), t('Only your firm can open your files'), t('Every access is logged'), t('Maker-checker approval on every entry')].map(x => <Tick key={x}>{x}</Tick>)}
                        </ul>
                        <div className="mt-8"><MoreLink to="/security">{t('Read about security')}</MoreLink></div>
                    </Reveal>
                    <Reveal delay={100}>
                        <SecurityEvidence />
                    </Reveal>
                </div>
            </section>

            <ClosingCta />
        </div>
    );
}
