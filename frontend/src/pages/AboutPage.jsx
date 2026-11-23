import React from 'react';
import {
    Target, Layers, ShieldCheck, Cpu, MessageSquareText, Languages, FolderLock, Wallet, CalendarClock, FileSearch,
    Search, Filter, Sparkles, Lock, Library, Users, Landmark, Scale, Gavel, BookOpen, ScrollText, UsersRound,
} from 'lucide-react';
import { useI18n } from '../i18n';
import { Card, ClosingCta, Eyebrow, H2, IconTile, Lead, PageIntro, Section, SectionHead } from '../components/marketing';

export default function AboutPage() {
    const { t, lang } = useI18n();
    const screen = (name) => `/screens/${lang === 'ur' ? 'ur' : 'en'}/${name}.webp`;

    const MODULES = [
        { icon: MessageSquareText, title: t('Legal research'), text: t('Ask a question and get a clear answer built only from past judgments and statutes, each one cited and linked.') },
        { icon: Languages, title: t('English, اردو and voice'), text: t('Type or speak in English, Urdu or Roman Urdu. Citations stay exactly as the court reported them.') },
        { icon: FileSearch, title: t('Document analysis'), text: t('Upload an FIR, a judgment or a contract and ask questions answered only from that document.') },
        { icon: Library, title: t('Law library'), text: t('Federal and Punjab laws by category, Urdu court forms and your office’s own documents on one shelf.') },
        { icon: CalendarClock, title: t('Case diary'), text: t('Hearings and case notes in one diary, with WhatsApp and email reminders before every date.') },
        { icon: Users, title: t('Clients & cases'), text: t('One file per client with their cases, documents, hearings and balance, shared with your team.') },
        { icon: FolderLock, title: t('Document vault'), text: t('Every petition, order and piece of evidence encrypted before storage and visible only to your firm.') },
        { icon: Wallet, title: t('Billing'), text: t('Fees, expenses and payments in rupees, approved by a partner before they count.') },
    ];
    const PIPELINE = [
        { icon: Sparkles, title: t('Understanding'), text: t('A language model reads the question and the conversation: what is being asked, in which language, whether it is a follow-up, which courts and years matter, and the precise English legal query to search.') },
        { icon: Search, title: t('Hybrid retrieval'), text: t('Keyword matching (BM25) finds exact sections and citations; semantic search (Voyage AI embeddings) finds judgments that discuss the same idea in other words. Results are fused and re-ranked.') },
        { icon: Filter, title: t('Relevance review'), text: t('A reviewer step must quote the passage that shows each judgment addresses the question. Anything that merely shares a keyword is dropped; if nothing is on point, the answer says so.') },
        { icon: MessageSquareText, title: t('Grounded answer'), text: t('The answer is written only from the retrieved passages, cites them inline, and is checked again: section numbers not found in the sources are marked “unverified”.') },
    ];
    const SOURCES = [
        [Landmark, t('Supreme Court of Pakistan'), t('Reported judgments')],
        [Scale, t('Lahore High Court'), t('Judgments approved for reporting')],
        [Scale, t('Islamabad High Court'), t('Reported judgments')],
        [Gavel, t('Punjab district courts'), t('Judgments from Sahiwal, Okara, Pakpattan, Kasur and Rawalpindi')],
        [BookOpen, t('Federal and Punjab statutes'), t('Including the full Pakistan Penal Code and Code of Criminal Procedure')],
        [ScrollText, t('LHC Rules and Orders'), t('Instructions to the civil and criminal courts of Punjab')],
        [UsersRound, t('Judge profiles'), t('Sitting and former judges of the superior courts')],
    ];
    const PRINCIPLES = [
        { icon: ShieldCheck, title: t('Grounded, not generated'), text: t('Answers come from retrieved judgments and statutes. If the collection does not cover a question, Justice AI says so rather than guessing.') },
        { icon: Layers, title: t('Pakistani law first'), text: t('Indian provisions are mapped to their Pakistani equivalents, and citations follow Pakistani reporting (PLD, SCMR, CLC, LHC).') },
        { icon: Cpu, title: t('Transparent by design'), text: t('You can watch each research step happen, open every cited judgment, and see exactly which references could not be verified.') },
        { icon: Lock, title: t('Confidential by default'), text: t('Client documents are encrypted before storage, limited to your firm and logged on every access; money records need a second approver.') },
    ];

    return (
        <div className="bg-paper-50">
            <PageIntro eyebrow={t('About Justice AI')} title={t('Making Pakistani law easy to find — and safe to rely on.')}
                lead={t('Justice AI is a legal workspace for Pakistani advocates, law firms and students. It brings past judgments of the superior and district courts and the federal and Punjab statutes into one place you can question in English or Urdu — and around that research it provides the tools a practice runs on: an encrypted document vault, maker-checker billing and a case diary with reminders.')} />

            {/* the product */}
            <Section className="pb-20 sm:pb-24">
                <div className="relative max-w-5xl mx-auto">
                    <div aria-hidden className="absolute -inset-x-16 -bottom-16 top-24 rounded-[60px] bg-[radial-gradient(ellipse_at_center,rgba(191,149,63,0.22),transparent_70%)] blur-3xl" />
                    <div className="relative rounded-[22px] p-1.5 bg-white/70 ring-1 ring-line shadow-[0_2px_4px_rgba(18,29,47,0.04),0_50px_100px_-40px_rgba(11,18,32,0.45)] backdrop-blur">
                        <div className="rounded-2xl bg-white ring-1 ring-line overflow-hidden">
                            <div className="flex items-center gap-2 px-4 h-10 border-b border-line bg-paper-100">
                                <span className="w-2.5 h-2.5 rounded-full bg-[#f0b4a8]" /><span className="w-2.5 h-2.5 rounded-full bg-[#efd59b]" /><span className="w-2.5 h-2.5 rounded-full bg-[#b9dcb4]" />
                                <span className="mx-auto px-3 h-6 inline-flex items-center rounded-md bg-white ring-1 ring-line text-[11px] text-slate-500">justice-ai · {t('Dashboard')}</span>
                                <span className="w-12" />
                            </div>
                            <img src={screen('dashboard')} alt={t('Dashboard')} draggable={false} className="w-full aspect-[16/10] object-cover object-top" />
                        </div>
                    </div>
                </div>
            </Section>

            {/* problem / approach */}
            <section className="bg-white border-y border-line py-20 sm:py-24">
                <div className="max-w-6xl mx-auto px-5 sm:px-8 grid md:grid-cols-2 gap-5">
                    {[[Target, t('The problem'), t('Pakistani judgments are spread across separate court websites, published as PDFs and searchable mostly by title or citation. Finding the authority for a legal point means hours of reading. General-purpose AI chatbots fill the gap by inventing cases that do not exist — a serious risk in court. Meanwhile, case files live in WhatsApp chats, fees in a paper register and hearings on a wall calendar.')],
                      [Layers, t('Our approach'), t('Justice AI answers every question by first searching the actual judgments and statutes, checking that what it found really addresses the question, and only then writing an answer that cites those sources. Around that research engine we built the practice tools lawyers asked for — so the authority you find, the documents you file and the fees you charge all live in one secure workspace.')]].map(([Icon, title, text]) => (
                        <Card key={title} className="p-8 sm:p-10 bg-paper-50">
                            <div className="mb-6"><IconTile icon={Icon} size="lg" /></div>
                            <h2 className="font-serif text-[26px] font-semibold text-ink-950 mb-3 rtl:pt-1">{title}</h2>
                            <p className="text-[15.5px] text-slate-600 leading-relaxed">{text}</p>
                        </Card>
                    ))}
                </div>
            </section>

            {/* modules */}
            <Section className="py-20 sm:py-24">
                <SectionHead eyebrow={t('What it includes')} title={t('Eight modules, one workspace.')} />
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {MODULES.map(m => (
                        <Card key={m.title} hover className="p-6">
                            <IconTile icon={m.icon} />
                            <h3 className="font-serif text-[19px] font-semibold text-ink-950 leading-snug mt-5 mb-2 rtl:pt-1">{m.title}</h3>
                            <p className="text-[14px] text-slate-600 leading-relaxed">{m.text}</p>
                        </Card>
                    ))}
                </div>
            </Section>

            {/* pipeline */}
            <section className="bg-white border-y border-line py-20 sm:py-24">
                <div className="max-w-6xl mx-auto px-5 sm:px-8 grid lg:grid-cols-[0.85fr_1.15fr] gap-12 lg:gap-16">
                    <div className="lg:sticky lg:top-28 self-start">
                        <Eyebrow>{t('How an answer is made')}</Eyebrow>
                        <H2>{t('Four steps between your question and the answer')}</H2>
                        <Lead>{t('Each answer passes through four stages. You see them happen live, and you can open every source it relied on.')}</Lead>
                    </div>
                    <ol className="relative">
                        <span aria-hidden className="absolute start-[23px] top-6 bottom-6 w-px bg-gradient-to-b from-gold-300 via-gold-400/60 to-transparent" />
                        {PIPELINE.map((p, i) => (
                            <li key={p.title} className="relative flex gap-6 pb-6 last:pb-0">
                                <span className="relative z-10 w-12 h-12 rounded-full bg-white ring-1 ring-line shadow-soft flex items-center justify-center flex-shrink-0">
                                    <span className="w-9 h-9 rounded-full bg-ink-gradient flex items-center justify-center"><p.icon size={16} className="text-gold-300" /></span>
                                </span>
                                <Card className="flex-1 p-6 bg-paper-50">
                                    <div className="flex items-center justify-between gap-4 mb-1.5">
                                        <h3 className="font-sans text-[16.5px] font-semibold text-ink-950">{p.title}</h3>
                                        <span className="text-[12px] font-semibold tracking-[0.14em] text-gold-700 rtl:tracking-normal">{String(i + 1).padStart(2, '0')}</span>
                                    </div>
                                    <p className="text-[14.5px] text-slate-600 leading-relaxed">{p.text}</p>
                                </Card>
                            </li>
                        ))}
                    </ol>
                </div>
            </section>

            {/* coverage & technology: the deep-navy band */}
            <section className="relative overflow-hidden bg-ink-gradient py-20 sm:py-24">
                <span aria-hidden className="absolute inset-0 bg-ink-sheen pointer-events-none" />
                <div aria-hidden className="absolute -bottom-40 end-0 w-[520px] h-[320px] rounded-full bg-gold-500/15 blur-3xl pointer-events-none" />
                <div className="relative max-w-6xl mx-auto px-5 sm:px-8 grid lg:grid-cols-[0.8fr_1.2fr] gap-12 lg:gap-16 items-start">
                    <div className="min-w-0">
                        <Eyebrow light>{t('Coverage')}</Eyebrow>
                        <H2 className="text-white">{t('What is in the collection')}</H2>
                        <p className="text-white/55 mt-3 text-[15px] leading-relaxed">{t('Every answer is drawn from this collection, and every source opens the court’s or the government’s own document.')}</p>
                    </div>
                    <div className="min-w-0">
                        <ul className="grid sm:grid-cols-2 gap-3">
                            {SOURCES.map(([Icon, name, what]) => (
                                <li key={name} className="flex items-start gap-4 p-4 rounded-2xl bg-white/[0.04] ring-1 ring-white/10 hover:bg-white/[0.07] transition-colors">
                                    <span className="w-10 h-10 rounded-xl bg-white/[0.06] ring-1 ring-gold-400/25 flex items-center justify-center flex-shrink-0"><Icon size={17} className="text-gold-300" /></span>
                                    <div className="min-w-0"><div className="text-[15px] font-semibold text-white leading-snug">{name}</div><div className="text-[13px] text-white/50 mt-1 leading-relaxed">{what}</div></div>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </section>

            {/* principles */}
            <Section className="py-20 sm:py-24">
                <SectionHead eyebrow={t('Principles')} title={t('What we hold ourselves to.')} />
                <div className="grid sm:grid-cols-2 gap-4">
                    {PRINCIPLES.map(p => (
                        <Card key={p.title} hover className="flex gap-5 p-6 sm:p-7">
                            <IconTile icon={p.icon} />
                            <div className="min-w-0">
                                <h3 className="text-[16.5px] font-semibold text-ink-950 mb-1.5">{p.title}</h3>
                                <p className="text-[14.5px] text-slate-600 leading-relaxed">{p.text}</p>
                            </div>
                        </Card>
                    ))}
                </div>
                <div className="mt-6 flex gap-4 p-6 rounded-2xl bg-amber-50/80 ring-1 ring-amber-200 text-[14.5px] text-amber-950 leading-relaxed">
                    <ShieldCheck size={20} className="text-gold-700 flex-shrink-0 mt-0.5" />
                    <p><b>{t('Important:')}</b> {t('Justice AI is a research and practice-management tool. Its answers summarise reported judgments and statutes to help you find authority faster; they are not legal advice. Always read the cited judgment before relying on it in court.')}</p>
                </div>
            </Section>

            <ClosingCta />
        </div>
    );
}
