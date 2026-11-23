import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, FileText, Lock, Bell, Mic, CheckCircle2, Scale, BookOpen, History, KeyRound, ShieldCheck } from 'lucide-react';
import { isolateLatinRuns } from '../api';
import { useI18n } from '../i18n';

/* Building blocks shared by the public pages (landing, features, how it works,
   security, FAQ). One visual language: paper canvas, white cards with warm
   hairlines, navy tiles with gold icons, serif headings.

   Urdu: Nastaliq letters rise and fall far beyond Latin ones, so headings get a
   smaller rtl: size and a little top padding, small labels switch to the compact
   Naskh face (class "eyebrow", see index.css), and gradient text becomes solid
   gold (background-clip would cut the tall strokes). */

export const GRID_BG = { backgroundImage: 'linear-gradient(rgba(18,29,47,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(18,29,47,0.045) 1px, transparent 1px)', backgroundSize: '56px 56px' };

export const Eyebrow = ({ children, light = false, className = '' }) => (
    <p className={`eyebrow inline-flex items-center gap-2.5 text-[12px] font-semibold uppercase tracking-[0.18em] mb-4 ${light ? 'text-gold-300' : 'text-gold-700'} ${className}`}>
        <span className={`w-6 h-px flex-shrink-0 ${light ? 'bg-gold-400/70' : 'bg-gradient-to-r from-gold-500 to-gold-300'}`} />{children}
    </p>
);

export const H1 = ({ children, className = '' }) => (
    <h1 className={`font-serif text-[2.5rem] sm:text-[3.6rem] leading-[1.06] font-semibold tracking-[-0.025em] text-balance rtl:text-[2rem] sm:rtl:text-[2.7rem] rtl:tracking-normal rtl:pt-2 ${className || 'text-ink-950'}`}>{children}</h1>
);

export const H2 = ({ children, className = '' }) => (
    <h2 className={`font-serif text-[1.9rem] sm:text-[2.5rem] leading-[1.12] font-semibold tracking-[-0.02em] text-balance rtl:text-[1.55rem] sm:rtl:text-[1.95rem] rtl:tracking-normal rtl:pt-2 ${className || 'text-ink-950'}`}>{children}</h2>
);

export const Lead = ({ children, className = '' }) => (
    <p className={`text-[16.5px] sm:text-[17.5px] leading-relaxed mt-4 ${className || 'text-slate-600'}`}>{children}</p>
);

export const Section = ({ id, className = '', children }) => (
    <section id={id} className={className}><div className="max-w-6xl mx-auto px-5 sm:px-8">{children}</div></section>
);

/* White card; `hover` adds the gentle lift used for anything clickable or showcased. */
export const Card = ({ className = '', hover = false, children }) => (
    <div className={`rounded-2xl bg-white border border-line shadow-soft ${hover ? 'transition-all duration-300 hover:-translate-y-1 hover:shadow-lift hover:border-line-strong' : ''} ${className}`}>{children}</div>
);

/* Navy tile with a gold icon — the brand's icon treatment. */
export const IconTile = ({ icon: Icon, size = 'md' }) => (
    <span className={`relative inline-flex items-center justify-center flex-shrink-0 rounded-xl bg-ink-gradient ring-1 ring-white/5 shadow-[0_8px_18px_-8px_rgba(11,18,32,0.6)] ${size === 'lg' ? 'w-12 h-12' : 'w-10 h-10'}`}>
        <span className="absolute inset-0 rounded-xl bg-ink-sheen" />
        <Icon size={size === 'lg' ? 21 : 18} className="relative text-gold-300" />
    </span>
);

export const Tick = ({ children }) => (
    <li className="flex gap-3 text-[14.5px] text-slate-700 leading-relaxed">
        <span className="mt-0.5 w-5 h-5 rounded-full bg-emerald-50 ring-1 ring-emerald-200 flex items-center justify-center flex-shrink-0"><Check size={12} strokeWidth={3} className="text-emerald-700" /></span>
        <span className="min-w-0">{children}</span>
    </li>
);

/* Primary (navy) and secondary (white) call-to-action buttons. */
export const PrimaryLink = ({ to, children, className = '' }) => (
    <Link to={to} className={`group inline-flex items-center justify-center gap-2 px-6 h-12 rounded-xl bg-ink-900 text-white text-[15px] font-semibold shadow-[0_10px_30px_-10px_rgba(11,18,32,0.6),inset_0_1px_0_rgba(255,255,255,0.1)] hover:bg-ink-800 transition-all ${className}`}>
        {children} <ArrowRight size={17} className="text-gold-300 transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
    </Link>
);
export const SecondaryLink = ({ to, children, className = '' }) => (
    <Link to={to} className={`inline-flex items-center justify-center gap-2 px-6 h-12 rounded-xl bg-white ring-1 ring-line-strong text-ink-950 text-[15px] font-semibold shadow-soft hover:ring-ink-300 hover:shadow-lift transition-all ${className}`}>{children}</Link>
);
/* A quiet "Learn more →" text link. */
export const MoreLink = ({ to, children }) => (
    <Link to={to} className="group inline-flex items-center gap-1.5 text-[14.5px] font-semibold text-ink-950 hover:text-gold-700 transition-colors">
        {children} <ArrowRight size={15} className="text-gold-600 transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
    </Link>
);

/* Section header: eyebrow, heading, optional lead, optional link on the far side. */
export function SectionHead({ eyebrow, title, lead, link, light = false }) {
    return (
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-10 sm:mb-12">
            <div className="max-w-2xl min-w-0">
                <Eyebrow light={light}>{eyebrow}</Eyebrow>
                <H2 className={light ? 'text-white' : ''}>{title}</H2>
                {lead && <Lead className={light ? 'text-white/60' : ''}>{lead}</Lead>}
            </div>
            {link && <div className="flex-shrink-0 lg:pb-1.5">{link}</div>}
        </div>
    );
}

/* Opening block of an information page (Features, How it works, Security, FAQ). */
export function PageIntro({ eyebrow, title, lead, children }) {
    return (
        <section className="relative overflow-hidden pt-32 sm:pt-36 pb-14 sm:pb-16">
            <div aria-hidden className="absolute inset-0 pointer-events-none" style={{ ...GRID_BG, maskImage: 'radial-gradient(ellipse 70% 60% at 50% 0%, black 20%, transparent 100%)' }} />
            <div aria-hidden className="absolute top-[-280px] left-1/2 -translate-x-1/2 w-[900px] h-[520px] rounded-full bg-[radial-gradient(closest-side,rgba(232,201,134,0.5),rgba(232,201,134,0.1)_55%,transparent)] blur-2xl pointer-events-none" />
            <div className="relative max-w-3xl mx-auto px-5 sm:px-8 text-center">
                <Eyebrow className="justify-center">{eyebrow}</Eyebrow>
                <H1>{title}</H1>
                {lead && <Lead className="text-slate-600 max-w-2xl mx-auto">{lead}</Lead>}
                {children}
            </div>
        </section>
    );
}

/* Closing call to action shared by every public page. */
export function ClosingCta() {
    const { t } = useI18n();
    return (
        <Section className="py-20 sm:py-24">
            <div className="relative overflow-hidden rounded-[28px] bg-ink-gradient px-6 py-14 sm:px-16 sm:py-16 text-center shadow-pop">
                <span aria-hidden className="absolute inset-0 bg-ink-sheen pointer-events-none" />
                <div aria-hidden className="absolute -top-32 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full bg-gold-500/20 blur-3xl pointer-events-none" />
                <div className="relative">
                    <H2 className="text-white">{t('Your next brief starts here.')}</H2>
                    <p className="text-[16.5px] text-white/60 max-w-xl mx-auto mt-4 mb-8">{t('Create a free account in under a minute with Google or email, and ask your first question.')}</p>
                    <div className="flex flex-col sm:flex-row justify-center gap-3">
                        <Link to="/start" className="group inline-flex items-center justify-center gap-2 px-6 h-12 rounded-xl bg-gold-gradient text-[#2a1e05] text-[15px] font-semibold shadow-[0_10px_30px_-10px_rgba(212,168,83,0.7)] hover:brightness-105 transition-all">
                            {t('Get started free')} <ArrowRight size={17} className="transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
                        </Link>
                        <Link to="/about" className="inline-flex items-center justify-center gap-2 px-6 h-12 rounded-xl bg-white/[0.06] ring-1 ring-white/15 text-white text-[15px] font-semibold hover:bg-white/[0.1] transition-colors">{t('About the project')}</Link>
                    </div>
                </div>
            </div>
        </Section>
    );
}

/* ── small product previews (landing page and Features page) ─────────────── */
export function VaultPreview() {
    const { t } = useI18n();
    const rows = [[t('FIR No. 452/2026'), t('Evidence')], [t('Bail petition (filed)'), t('Petition')], [t('Interim order 03-11-2026'), t('Order')]];
    return (
        <div className="space-y-2">
            {rows.map(([title, c]) => (
                <div key={title} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white ring-1 ring-line shadow-soft">
                    <span className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center flex-shrink-0"><FileText size={15} className="text-emerald-600" /></span>
                    <div className="flex-1 min-w-0"><div className="text-[12.5px] font-semibold text-ink-900 truncate">{title}</div><div className="text-[10.5px] text-slate-400 truncate">{t('Muhammad Asif · Asif v. State')}</div></div>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-paper-200 text-slate-600 flex-shrink-0">{c}</span>
                    <Lock size={13} className="text-emerald-600 flex-shrink-0" />
                </div>
            ))}
        </div>
    );
}
export function BillingPreview() {
    const { t } = useI18n();
    const rows = [[t('Bail petition — drafting & hearing'), t('Rs {amount}', { amount: '75,000' }), 'approved'], [t('Court fee & stamp paper'), t('Rs {amount}', { amount: '3,200' }), 'approved'], [t('Travel to Rawalpindi bench'), t('Rs {amount}', { amount: '2,000' }), 'pending']];
    return (
        <div className="space-y-2">
            {rows.map(([d, a, st]) => (
                <div key={d} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white ring-1 ring-line shadow-soft">
                    <div className="flex-1 min-w-0"><div className="text-[12.5px] font-semibold text-ink-900 truncate">{d}</div><div className="text-[10.5px] text-slate-400 truncate">{t('recorded by the clerk')}</div></div>
                    <span dir="ltr" className="text-[12.5px] font-bold tabular-nums text-ink-900 flex-shrink-0">{a}</span>
                    {st === 'approved'
                        ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex-shrink-0">{t('Approved')}</span>
                        : <span className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-ink-900 text-white flex-shrink-0">{t('Approve')}</span>}
                </div>
            ))}
            <div className="flex items-center justify-between px-3 pt-1 text-[11.5px]"><span className="text-slate-500">{t('Balance due')}</span><span dir="ltr" className="font-bold text-red-600">{t('Rs {amount}', { amount: '28,200' })}</span></div>
        </div>
    );
}
export function DiaryPreview() {
    const { t } = useI18n();
    return (
        <div className="space-y-2.5">
            <div className="px-3 py-2.5 rounded-xl bg-white ring-1 ring-line shadow-soft">
                <div className="flex items-center justify-between gap-2"><span className="text-[12.5px] font-semibold text-ink-900 truncate">{t('Asif v. State — bail')}</span><span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 flex-shrink-0">{t('Tomorrow')}</span></div>
                <div className="text-[10.5px] text-slate-400 mt-0.5 truncate">{t('Lahore High Court')} · {t('9:00 AM')} · <span dir="ltr">Crl.Misc. 1234-B/2026</span></div>
            </div>
            <div className="flex gap-2 items-start">
                <span className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0"><Bell size={13} className="text-white" /></span>
                <div className="px-3 py-2 rounded-2xl rounded-ss-md bg-emerald-50 border border-emerald-100 text-[11.5px] text-emerald-900 leading-relaxed">
                    <b>{t('WhatsApp reminder:')}</b> {t('Hearing tomorrow — Asif v. State, Lahore High Court, 9:00 AM.')}
                </div>
            </div>
        </div>
    );
}
export function ResearchPreview() {
    const { t } = useI18n();
    return (
        <Card className="p-5 text-[13.5px] leading-relaxed text-slate-700 shadow-lift">
            <p className="font-semibold text-ink-950 mb-2">{t('What is the effect of delay in lodging an FIR?')}</p>
            <p>{t('Unexplained delay casts doubt on the prosecution story and the benefit goes to the accused. The FIR is the cornerstone of the case, as the Supreme Court held in Mst. Asia Bibi v. The State (PLD 2019 SC 64)…')}</p>
            <div className="mt-4 pt-4 border-t border-line space-y-2 text-[12.5px] text-slate-500">
                {[t('Understood the question'), t('Searched case law across all courts'), t('Found {n} judgments on point', { n: 4 }), t('Checked every statement against the sources')].map(x => <div key={x} className="flex items-center gap-2"><CheckCircle2 size={14} className="text-emerald-600 flex-shrink-0" />{x}</div>)}
            </div>
        </Card>
    );
}
export function UrduPreview() {
    const { t } = useI18n();
    return (
        <div className="space-y-3">
            <div dir="rtl" className="urdu-text ms-auto max-w-[92%] px-4 py-2 rounded-2xl rounded-ss-md bg-ink-900 text-white text-[14px] shadow-soft">
                {isolateLatinRuns('کیا دفعہ 489-F PPC کے تحت جرم قابلِ ضمانت ہے؟')}
            </div>
            <div className="rounded-2xl bg-white ring-1 ring-line shadow-soft p-4">
                <div className="flex items-center gap-2 mb-2.5">
                    <span className="w-6 h-6 rounded-lg bg-ink-900 flex items-center justify-center"><Scale size={12} className="text-gold-300" /></span>
                    <span className="text-[12.5px] font-semibold text-ink-950">Justice AI</span>
                    <span className="ms-auto text-[11px] px-2 py-0.5 rounded-full bg-paper-100 ring-1 ring-line text-slate-500">{t('Answer in Urdu')}</span>
                </div>
                <p dir="rtl" className="urdu-text text-[13.5px] text-slate-700 leading-[2.1]">
                    {isolateLatinRuns('جی ہاں۔ دفعہ 489-F PPC کی زیادہ سے زیادہ سزا تین سال ہے، اس لیے یہ دفعہ 497 ضابطہ فوجداری کی ممانعتی شق سے باہر ہے؛ ضمانت اصول ہے اور انکار استثنا۔')}
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                    {['Noman Khaliq v. The State', 'Abdul Saboor v. The State'].map((n, i) => (
                        <span key={n} dir="ltr" className="inline-flex items-center gap-1.5 ps-1.5 pe-2.5 py-1 rounded-full bg-paper-50 ring-1 ring-line text-[11.5px] text-slate-700">
                            <span className="w-4 h-4 rounded-full bg-ink-900 text-white text-[9px] font-semibold flex items-center justify-center">{i + 1}</span>{n}
                        </span>
                    ))}
                </div>
            </div>
            <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-white ring-1 ring-line shadow-soft text-[12.5px] text-slate-600">
                <span className="w-7 h-7 rounded-full bg-amber-50 ring-1 ring-amber-200 flex items-center justify-center flex-shrink-0"><Mic size={13} className="text-gold-700" /></span>
                {t('or just say it — voice questions in Urdu, English or Roman Urdu')}
            </div>
        </div>
    );
}

export function DocumentPreview() {
    const { t } = useI18n();
    return (
        <div className="space-y-2.5">
            <div className="flex items-center gap-3 px-3.5 py-3 rounded-xl bg-white ring-1 ring-line shadow-soft">
                <span className="w-9 h-9 rounded-lg bg-red-50 ring-1 ring-red-100 flex items-center justify-center flex-shrink-0"><FileText size={16} className="text-red-500" /></span>
                <div className="min-w-0 flex-1"><div className="text-[12.5px] font-semibold text-ink-950 truncate" dir="ltr">FIR_452_2026.pdf</div><div className="text-[11px] text-slate-500">{t('{n} pages', { n: 6 })} · {t('Ready')}</div></div>
                <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">{t('Private')}</span>
            </div>
            <div className="flex justify-end"><span className="px-3.5 py-2 rounded-2xl rounded-ee-md bg-ink-900 text-white text-[12.5px] shadow-soft">{t('Which sections are invoked?')}</span></div>
            <div className="rounded-2xl bg-white ring-1 ring-line shadow-soft p-3.5 text-[12.5px] text-slate-700 leading-relaxed">
                {t('Sections 420, 468 and 471 PPC are invoked in the FIR, registered at Police Station Sadar.')}
                <span className="ms-2 inline-flex items-center px-2 py-0.5 rounded-full bg-paper-100 ring-1 ring-line text-[11px] text-slate-500">{t('page {n}', { n: 2 })}</span>
            </div>
        </div>
    );
}

export function LibraryPreview() {
    const { t } = useI18n();
    const rows = [['Pakistan Penal Code, 1860', t('Federal')], ['Code of Criminal Procedure, 1898', t('Federal')], ['Punjab Pre-emption Act, 1991', t('Punjab')]];
    return (
        <div className="space-y-2">
            {rows.map(([title, j]) => (
                <div key={title} className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-white ring-1 ring-line shadow-soft">
                    <span className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${j === t('Punjab') ? 'bg-emerald-50 ring-1 ring-emerald-100' : 'bg-ink-50 ring-1 ring-ink-100'}`}><BookOpen size={14} className={j === t('Punjab') ? 'text-emerald-600' : 'text-ink-700'} /></span>
                    <span className="flex-1 min-w-0 text-[12.5px] font-semibold text-ink-950 truncate" dir="ltr">{title}</span>
                    <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-paper-100 ring-1 ring-line text-slate-600 flex-shrink-0">{j}</span>
                </div>
            ))}
        </div>
    );
}

export function TeamPreview() {
    const { t } = useI18n();
    const rows = [['AK', t('Ayesha Khan'), t('Owner / Partner'), 'bg-gold-gradient text-[#2a1e05]'], ['IA', t('Imran Ali'), t('Associate'), 'bg-ink-900 text-white'], ['HS', t('Hira Saleem'), t('Clerk'), 'bg-ink-900 text-white']];
    return (
        <div className="space-y-2">
            {rows.map(([ini, name, role, tone]) => (
                <div key={name} className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-white ring-1 ring-line shadow-soft">
                    <span className={`w-8 h-8 rounded-full text-[10.5px] font-bold flex items-center justify-center flex-shrink-0 ${tone}`}>{ini}</span>
                    <span className="flex-1 min-w-0 text-[12.5px] font-semibold text-ink-950 truncate">{name}</span>
                    <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-paper-100 ring-1 ring-line text-slate-600 flex-shrink-0">{role}</span>
                </div>
            ))}
        </div>
    );
}

export const Chips = ({ items }) => (
    <div className="flex flex-wrap gap-2">
        {items.map(x => <span key={x} className="px-3 py-2 rounded-xl bg-white ring-1 ring-line shadow-soft text-[12.5px] text-slate-700">{x}</span>)}
    </div>
);


/* Fades a block in as it scrolls into view (no-op when the user prefers reduced motion). */
export function Reveal({ children, className = '', delay = 0 }) {
    const ref = React.useRef(null);
    const [shown, setShown] = React.useState(false);
    React.useEffect(() => {
        const el = ref.current;
        if (!el || typeof IntersectionObserver === 'undefined') { setShown(true); return; }
        const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setShown(true); io.disconnect(); } }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
        io.observe(el);
        return () => io.disconnect();
    }, []);
    return <div ref={ref} style={{ transitionDelay: `${delay}ms` }} className={`reveal ${shown ? 'is-visible' : ''} ${className}`}>{children}</div>;
}

/* Evidence of how documents and money are protected: an encrypted file, the activity
   log, a maker-checker approval and an honest "not covered" answer, in one panel. */
export function SecurityEvidence() {
    const { t } = useI18n();
    return (
                <div className="relative rounded-[28px] bg-gradient-to-br from-paper-200 via-paper-100 to-amber-50/60 ring-1 ring-line p-4 sm:p-6 overflow-hidden">
                    <div aria-hidden className="absolute inset-0 pointer-events-none" style={{ ...GRID_BG, maskImage: 'radial-gradient(ellipse 80% 70% at 50% 40%, black 10%, transparent 80%)' }} />
                    <div className="relative grid sm:grid-cols-2 gap-3">
                        <div className="rounded-2xl bg-white ring-1 ring-line shadow-soft p-4">
                            <div className="flex items-center gap-3">
                                <span className="w-10 h-10 rounded-xl bg-emerald-50 ring-1 ring-emerald-200 flex items-center justify-center flex-shrink-0"><FileText size={18} className="text-emerald-600" /></span>
                                <div className="min-w-0 flex-1"><div className="text-[13px] font-semibold text-ink-950 truncate" dir="ltr">bail_petition.pdf</div><div className="text-[11.5px] text-slate-500 truncate">{t('Muhammad Asif · Asif v. State')}</div></div>
                                <Lock size={15} className="text-emerald-600 flex-shrink-0" />
                            </div>
                            <div className="mt-3.5 pt-3.5 border-t border-line flex flex-wrap items-center gap-2 text-[11.5px]">
                                <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 font-semibold">AES-256</span>
                                <span className="px-2 py-0.5 rounded-full bg-paper-100 text-slate-600 ring-1 ring-line">{t('Integrity checked')}</span>
                            </div>
                        </div>
                        <div className="rounded-2xl bg-white ring-1 ring-line shadow-soft p-4">
                            <div className="flex items-center gap-2 text-[12.5px] font-semibold text-ink-950 pb-3 mb-3 border-b border-line"><History size={14} className="text-gold-700" />{t('Activity log')}</div>
                            <div className="space-y-2.5 text-[12px]">
                                {[['HS', t('Hira Saleem uploaded'), '09:15'], ['IA', t('Imran Ali viewed'), '10:42'], ['AK', t('Ayesha Khan downloaded'), '11:03']].map(([ini, what, when]) => (
                                    <div key={what} className="flex items-center gap-2.5">
                                        <span className="w-6 h-6 rounded-full bg-ink-900 text-white text-[9.5px] font-semibold flex items-center justify-center flex-shrink-0">{ini}</span>
                                        <span className="flex-1 min-w-0 truncate text-slate-700">{what}</span>
                                        <span dir="ltr" className="text-slate-400 tabular-nums">{when}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="rounded-2xl bg-white ring-1 ring-line shadow-soft p-4">
                            <div className="flex items-center gap-2 text-[12.5px] font-semibold text-ink-950 pb-3 mb-3 border-b border-line"><KeyRound size={14} className="text-gold-700" />{t('Maker-checker approval')}</div>
                            <div className="flex items-center gap-3">
                                <div className="flex-1 min-w-0"><div className="text-[12.5px] font-semibold text-ink-950 truncate">{t('Court fee & stamp paper')}</div><div className="text-[11px] text-slate-500 truncate">{t('recorded by the clerk')}</div></div>
                                <span dir="ltr" className="text-[12.5px] font-bold tabular-nums text-ink-900 flex-shrink-0">Rs 3,200</span>
                                <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-ink-900 text-white flex-shrink-0">{t('Approve')}</span>
                            </div>
                        </div>
                        <div className="rounded-2xl bg-white ring-1 ring-line shadow-soft p-4">
                            <div className="flex items-center gap-2 text-[12.5px] font-semibold text-ink-950 pb-3 mb-3 border-b border-line"><ShieldCheck size={14} className="text-emerald-600" />{t('Honest answers')}</div>
                            <p className="text-[12px] text-slate-600 leading-relaxed">{t('“The retrieved judgments do not address this point.” — said plainly, instead of inventing an authority.')}</p>
                        </div>
                    </div>
                </div>
    );
}
