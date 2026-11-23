import React from 'react';
import { Link } from 'react-router-dom';
import {
    Scale, ShieldCheck, Languages, CalendarClock, FileSearch, MessageSquareText, Search, Filter, PenLine, BookOpen,
    FolderLock, Wallet, KeyRound, ChevronDown, Check, X, Minus, Library, Users, Server, Upload, ArrowRight,
} from 'lucide-react';
import { useI18n } from '../i18n';
import { BillingPreview, Card, ClosingCta, DiaryPreview, DocumentPreview, Eyebrow, GRID_BG, H2, IconTile, Lead, LibraryPreview, PageIntro, ResearchPreview, Section, SectionHead, SecurityEvidence, TeamPreview, Tick, UrduPreview, VaultPreview } from '../components/marketing';

/* The four information pages behind the public navigation:
   Features, How it works, Security, FAQ. */

/* One feature, as its own band: alternating white / paper backgrounds with hairlines,
   a numbered module label, copy on one side and a framed product preview on the other. */
function FeatureRow({ index, label, icon: Icon, title, text, points, children, flip }) {
    const even = index % 2 === 1;
    return (
        <section className={`py-16 sm:py-20 ${even ? 'bg-white border-y border-line' : ''}`}>
            <div className="max-w-6xl mx-auto px-5 sm:px-8 grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
                <div className={`min-w-0 ${flip ? 'lg:order-2' : ''}`}>
                    <div className="inline-flex items-center gap-2.5 ps-1 pe-3.5 py-1 rounded-full bg-paper-100 ring-1 ring-line text-[12.5px] font-semibold text-ink-800 mb-6">
                        <span className="w-7 h-7 rounded-full bg-ink-900 flex items-center justify-center"><Icon size={13} className="text-gold-300" /></span>
                        <span className="text-gold-700 tabular-nums">{String(index + 1).padStart(2, '0')}</span>
                        <span className="w-px h-3.5 bg-line-strong" />{label}
                    </div>
                    <h2 className="font-serif text-[1.75rem] sm:text-[2.1rem] leading-[1.15] font-semibold tracking-[-0.015em] text-ink-950 mb-4 text-balance rtl:text-[1.5rem] sm:rtl:text-[1.8rem] rtl:tracking-normal rtl:pt-2">{title}</h2>
                    <p className="text-[16px] text-slate-600 leading-relaxed mb-6">{text}</p>
                    <ul className="space-y-3">{points.map(p => <Tick key={p}>{p}</Tick>)}</ul>
                </div>
                <div className={`min-w-0 ${flip ? 'lg:order-1' : ''}`}>
                    <div className={`relative overflow-hidden rounded-[28px] ring-1 ring-line p-5 sm:p-8 ${even ? 'bg-gradient-to-br from-paper-100 via-paper-50 to-amber-50/60' : 'bg-white shadow-soft'}`}>
                        <div aria-hidden className="absolute inset-0 pointer-events-none" style={{ ...GRID_BG, maskImage: 'radial-gradient(ellipse 80% 70% at 50% 40%, black 10%, transparent 80%)' }} />
                        <div aria-hidden className="absolute -top-24 -end-24 w-64 h-64 rounded-full bg-gold-300/20 blur-3xl pointer-events-none" />
                        <div className="relative">{children}</div>
                    </div>
                </div>
            </div>
        </section>
    );
}

export function FeaturesPage() {
    const { t } = useI18n();
    return (
        <div className="bg-paper-50">
            <PageIntro eyebrow={t('Features')} title={t('Everything a practice needs, in one workspace.')}
                lead={t('Research, documents, hearings and accounts share the same clients and cases, so nothing is typed twice.')} />
            <div className="pb-6">
                    <FeatureRow index={0} label={t('Legal research')} icon={MessageSquareText} title={t('Ask the way you would ask a senior colleague.')}
                        text={t('Justice AI works out what you mean, searches past judgments and statutes, checks that what it found really answers the question, and writes a clear answer with the authorities cited as it goes.')}
                        points={[t('Only real judgments are cited, each linked to the court’s PDF'), t('Follow-up questions keep the context of the conversation'), t('Indian provisions are mapped to their Pakistani equivalents'), t('When the law reports don’t cover a point, it says so')]}>
                        <ResearchPreview />
                    </FeatureRow>
                    <FeatureRow index={1} label={t('English, اردو and voice')} flip icon={Languages} title={t('English, اردو and voice')}
                        text={t('Ask in the language your client speaks, typed or spoken. Answers can be written in Urdu, with case names, citations and section numbers kept in English exactly as reported.')}
                        points={[t('Questions in English, Urdu or Roman Urdu'), t('Answers in English or Urdu, your choice'), t('Voice questions from the microphone button')]}>
                        <UrduPreview />
                    </FeatureRow>
                    <FeatureRow index={2} label={t('Document analysis')} icon={FileSearch} title={t('Ask a document, not the internet.')}
                        text={t('Upload an FIR, a judgment or a contract and ask questions answered only from that document. Nothing outside the file is used.')}
                        points={[t('PDF documents, private to your account'), t('Answers quote the page they come from'), t('Ask follow-ups in the same conversation')]}>
                        <DocumentPreview />
                    </FeatureRow>
                    <FeatureRow index={3} label={t('Law library')} flip icon={Library} title={t('The statute book and your forms, on one shelf.')}
                        text={t('Browse federal and Punjab laws by category and open the official text. Keep Urdu court forms and your office’s own documents next to them.')}
                        points={[t('Federal and Punjab laws, including the full PPC and Cr.P.C.'), t('The Lahore High Court Rules and Orders'), t('Add your own resources for the whole firm')]}>
                        <LibraryPreview />
                    </FeatureRow>
                    <FeatureRow index={4} label={t('Case diary')} icon={CalendarClock} title={t('Be in the right courtroom on the right day.')}
                        text={t('Keep hearings and case notes in one diary. Reminders go out by WhatsApp and email two days and one day before every date.')}
                        points={[t('A separate WhatsApp number per hearing, for a junior or clerk'), t('Notes saved to your account, on any device'), t('Reminders stop once a hearing is marked completed')]}>
                        <DiaryPreview />
                    </FeatureRow>
                    <FeatureRow index={5} label={t('Document vault')} flip icon={FolderLock} title={t('Every petition, order and piece of evidence, in its place.')}
                        text={t('File documents under the client and case they belong to. They are encrypted before they are stored, visible only to your firm, and every access is recorded.')}
                        points={[t('AES-256 encryption before storage'), t('Organised by client, case and category'), t('A full record of who opened what, and when')]}>
                        <VaultPreview />
                    </FeatureRow>
                    <FeatureRow index={6} label={t('Billing')} icon={Wallet} title={t('Accounts with a second pair of eyes.')}
                        text={t('Record fees, case expenses and client payments in rupees. A partner approves each entry before it counts, so nobody can change the books alone.')}
                        points={[t('Maker-checker approval on every entry'), t('Live balance for every client and case'), t('Statement of account as a PDF in one click')]}>
                        <BillingPreview />
                    </FeatureRow>
                    <FeatureRow index={7} label={t('Clients & cases')} flip icon={Users} title={t('Clients, cases and your team.')}
                        text={t('One file per client with their cases, documents, hearings and balance — shared with partners, associates and clerks, each with the actions that suit their role.')}
                        points={[t('Invite colleagues by email; they join with consent'), t('Owners and partners approve; associates and clerks record'), t('Solo advocates can allow self-approval, marked as such')]}>
                        <TeamPreview />
                    </FeatureRow>
            </div>
            <ClosingCta />
        </div>
    );
}

const Mark = ({ v }) => v === 'yes'
    ? <span className="inline-flex w-7 h-7 rounded-full bg-emerald-500 shadow-[0_4px_10px_-4px_rgba(16,185,129,0.7)] items-center justify-center"><Check size={14} strokeWidth={3} className="text-white" /></span>
    : v === 'no'
        ? <span className="inline-flex w-7 h-7 rounded-full bg-paper-200 ring-1 ring-line items-center justify-center"><X size={13} className="text-slate-400" /></span>
        : v === 'part' ? <PartlyLabel /> : <Minus size={14} className="inline text-slate-300" />;
function PartlyLabel() {
    const { t } = useI18n();
    return <span className="text-[12.5px] text-slate-500">{t('Partly')}</span>;
}

export function HowItWorksPage() {
    const { t } = useI18n();
    const STEPS = [
        { icon: PenLine, title: t('Ask'), text: t('Type or speak your question — a section, a legal issue or your client’s facts — in English, Urdu or Roman Urdu.') },
        { icon: Search, title: t('Understand & search'), text: t('Justice AI works out what you mean, resolves follow-ups, then searches judgments and statutes by keyword and by meaning.') },
        { icon: Filter, title: t('Verify'), text: t('A reviewer step keeps only judgments that genuinely address your issue, quoting the passage that proves it.') },
        { icon: BookOpen, title: t('Answer'), text: t('You get a clear answer with inline citations and practical next steps, streamed live, with every source one click away.') },
    ];
    const COMPARE = [
        [t('Cites only judgments it actually retrieved'), 'yes', 'no', 'na'],
        [t('Every source linked to the court’s own record'), 'yes', 'no', 'yes'],
        [t('A clear answer in seconds'), 'yes', 'yes', 'no'],
        [t('Says so when the law reports don’t cover a point'), 'yes', 'no', 'na'],
        [t('Questions and answers in Urdu and Roman Urdu'), 'yes', 'part', 'no'],
        [t('Client files, billing and hearings in the same place'), 'yes', 'no', 'no'],
    ];
    return (
        <div className="bg-paper-50">
            <PageIntro eyebrow={t('How it works')} title={t('From question to cited answer, and you can watch every step.')}
                lead={t('Each answer passes through four stages. You see them happen live, and you can open every source it relied on.')} />
            <Section className="pb-20 sm:pb-24">
                <ol className="relative grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <span aria-hidden className="hidden lg:block absolute top-[44px] start-[12%] end-[12%] h-px bg-gradient-to-r from-transparent via-gold-400/60 to-transparent" />
                    {STEPS.map((s, i) => (
                        <li key={s.title} className="relative">
                            <Card hover className="p-6 h-full">
                                <div className="flex items-center justify-between mb-5">
                                    <IconTile icon={s.icon} />
                                    <span className="font-serif text-[1.9rem] leading-none font-semibold text-gold-300/80 tabular-nums">{String(i + 1).padStart(2, '0')}</span>
                                </div>
                                <h3 className="font-sans text-[16.5px] font-semibold text-ink-950 mb-1.5">{s.title}</h3>
                                <p className="text-[14px] text-slate-600 leading-relaxed">{s.text}</p>
                            </Card>
                        </li>
                    ))}
                </ol>
            </Section>
            <section className="bg-white border-y border-line py-20 sm:py-24">
                <div className="max-w-6xl mx-auto px-5 sm:px-8">
                    <div className="grid lg:grid-cols-[0.85fr_1.15fr] gap-10 lg:gap-14 items-center">
                        <div className="min-w-0">
                            <SectionHead eyebrow={t('Why Justice AI')} title={t('A fabricated citation is worse than no citation.')}
                                lead={t('General chatbots are known to invent cases. Court websites have the real ones, but finding the right paragraph takes hours. Justice AI is built to give you both: speed, and sources you can open.')} />
                        </div>
                        <div className="min-w-0 overflow-x-auto rounded-2xl ring-1 ring-line shadow-soft bg-white">
                            <table className="w-full min-w-[560px] text-[14px]">
                                <thead>
                                    <tr className="bg-paper-100">
                                        <th className="px-5 py-4 w-[44%]"></th>
                                        <th className="px-3 py-4 text-center font-semibold text-white bg-ink-900"><span className="inline-flex items-center gap-1.5"><Scale size={14} className="text-gold-300" />Justice AI</span></th>
                                        <th className="px-3 py-4 text-center font-medium text-slate-600">{t('General AI chatbot')}</th>
                                        <th className="px-3 py-4 text-center font-medium text-slate-600">{t('Searching court websites')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {COMPARE.map(([label, a, b, c]) => (
                                        <tr key={label} className="border-t border-line hover:bg-paper-50 transition-colors">
                                            <td className="px-5 py-3.5 text-ink-900 text-start">{label}</td>
                                            <td className="px-3 py-3.5 text-center bg-amber-50/50 border-x border-amber-100"><Mark v={a} /></td>
                                            <td className="px-3 py-3.5 text-center"><Mark v={b} /></td>
                                            <td className="px-3 py-3.5 text-center"><Mark v={c} /></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </section>
            <ClosingCta />
        </div>
    );
}

export function SecurityPage() {
    const { t } = useI18n();
    const FLOW = [
        { icon: Upload, title: t('Uploaded'), text: t('A file is added under its client and case, from the vault or straight from a case file.') },
        { icon: KeyRound, title: t('Encrypted in the app'), text: t('Justice AI encrypts it with AES-256-GCM before it leaves the server. The key never goes to storage.') },
        { icon: Server, title: t('Stored scrambled'), text: t('Only ciphertext reaches Cloudflare R2 or your S3-compatible bucket. The provider cannot read it.') },
        { icon: ShieldCheck, title: t('Checked when opened'), text: t('On every open the file is decrypted and its integrity verified. A modified file is refused, never served.') },
    ];
    const GROUPS = [
        { icon: FolderLock, title: t('Documents'), items: [
            [t('AES-256 encryption'), t('Vault files are encrypted inside Justice AI before they are stored. The storage provider only ever holds scrambled data.')],
            [t('Tamper detection'), t('Every stored file is integrity-checked when opened. A modified file is refused, never served.')],
            [t('Complete audit trail'), t('Every upload, view, download and deletion is recorded with the person and the time.')]] },
        { icon: Wallet, title: t('Money'), items: [
            [t('Maker-checker accounts'), t('One person records a fee or payment; a partner approves it. Nobody can change the books alone.')],
            [t('Locked once approved'), t('Approved entries cannot be edited. A mistake is corrected by voiding the entry with a reason, which stays on record.')],
            [t('Firm-level isolation'), t('Clients, documents and accounts belong to your firm. No other firm can see or open them.')]] },
        { icon: MessageSquareText, title: t('Research'), items: [
            [t('Honest answers'), t('If the judgments don’t cover a question, Justice AI says so instead of inventing an authority.')],
            [t('Private document analysis'), t('A PDF you upload for analysis is visible to you alone and is never used to answer anyone else.')],
            [t('Verified sign-in'), t('Accounts are confirmed by an email code or Google sign-in, and WhatsApp numbers by a one-time code.')]] },
    ];
    const ROLES = [t('Owner'), t('Partner'), t('Associate'), t('Clerk')];
    const Y = 'yes', N = 'no', OWN = 'own';
    const MATRIX = [
        [t('Research, case files and the vault'), Y, Y, Y, Y],
        [t('Record fees, expenses and payments'), Y, Y, Y, Y],
        [t('Approve or reject billing entries'), Y, Y, N, N],
        [t('Delete a vault document'), Y, Y, OWN, OWN],
        [t('View the vault activity log'), Y, Y, N, N],
        [t('Invite members and set roles'), Y, N, N, N],
        [t('Change firm settings'), Y, N, N, N],
    ];
    const Cell = ({ v }) => v === 'own'
        ? <span className="text-[11.5px] font-semibold text-slate-500">{t('Own uploads')}</span>
        : <Mark v={v} />;
    return (
        <div className="bg-paper-50">
            <PageIntro eyebrow={t('Security & trust')} title={t('Your clients’ confidences stay confidential.')}
                lead={t('Lawyers hold some of the most sensitive information there is. Documents are protected at rest, access is limited to your firm, money records need a second approver, and research answers are never invented.')} />

            {/* how a file is protected */}
            <Section className="pb-20 sm:pb-24">
                <ol className="relative grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <span aria-hidden className="hidden lg:block absolute top-[44px] start-[12%] end-[12%] h-px bg-gradient-to-r from-transparent via-gold-400/60 to-transparent" />
                    {FLOW.map((f, i) => (
                        <li key={f.title} className="relative">
                            <Card hover className="p-6 h-full">
                                <div className="flex items-center justify-between mb-5">
                                    <IconTile icon={f.icon} />
                                    <span className="font-serif text-[1.9rem] leading-none font-semibold text-gold-300/80 tabular-nums">{String(i + 1).padStart(2, '0')}</span>
                                </div>
                                <h3 className="font-sans text-[16.5px] font-semibold text-ink-950 mb-1.5">{f.title}</h3>
                                <p className="text-[14px] text-slate-600 leading-relaxed">{f.text}</p>
                            </Card>
                        </li>
                    ))}
                </ol>
            </Section>

            {/* evidence */}
            <section className="bg-white border-y border-line py-20 sm:py-24">
                <div className="max-w-6xl mx-auto px-5 sm:px-8 grid lg:grid-cols-[0.8fr_1.2fr] gap-12 lg:gap-16 items-center">
                    <div className="min-w-0">
                        <Eyebrow>{t('In practice')}</Eyebrow>
                        <H2>{t('Protection you can see on every file and every rupee.')}</H2>
                        <Lead>{t('Open any document and you see its encryption and integrity status. Open the log and you see who touched it. Open the books and you see who recorded and who approved.')}</Lead>
                        <ul className="mt-7 space-y-3">
                            {[t('AES-256 encryption before storage'), t('Only your firm can open your files'), t('Every access is logged'), t('Maker-checker approval on every entry')].map(x => <Tick key={x}>{x}</Tick>)}
                        </ul>
                    </div>
                    <SecurityEvidence />
                </div>
            </section>

            {/* three groups */}
            <Section className="py-20 sm:py-24">
                <SectionHead eyebrow={t('Safeguards')} title={t('Documents, money and research, each protected in its own way.')} />
                <div className="grid lg:grid-cols-3 gap-5">
                    {GROUPS.map(g => (
                        <Card key={g.title} className="p-6 sm:p-7">
                            <div className="flex items-center gap-3 pb-5 mb-5 border-b border-line">
                                <IconTile icon={g.icon} />
                                <h3 className="font-serif text-[21px] font-semibold text-ink-950 rtl:pt-1">{g.title}</h3>
                            </div>
                            <ul className="space-y-5">
                                {g.items.map(([title, text]) => (
                                    <li key={title} className="flex gap-3">
                                        <span className="mt-0.5 w-5 h-5 rounded-full bg-emerald-50 ring-1 ring-emerald-200 flex items-center justify-center flex-shrink-0"><Check size={12} strokeWidth={3} className="text-emerald-700" /></span>
                                        <div className="min-w-0">
                                            <div className="text-[15px] font-semibold text-ink-950">{title}</div>
                                            <p className="text-[14px] text-slate-600 leading-relaxed mt-1">{text}</p>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </Card>
                    ))}
                </div>
            </Section>

            {/* who can do what */}
            <section className="bg-white border-y border-line py-20 sm:py-24">
                <div className="max-w-6xl mx-auto px-5 sm:px-8">
                    <SectionHead eyebrow={t('Roles')} title={t('Who can do what in your firm.')}
                        lead={t('Everyone works from the same client files; each role sees the actions that suit it. Nobody can approve an entry they recorded themselves.')} />
                    <div className="overflow-x-auto rounded-2xl ring-1 ring-line shadow-soft bg-white">
                        <table className="w-full min-w-[640px] text-[14px]">
                            <thead>
                                <tr className="bg-paper-100">
                                    <th className="px-5 py-4 text-start font-medium text-slate-500 w-[40%]">{t('Action')}</th>
                                    {ROLES.map((r, i) => <th key={r} className={`px-3 py-4 text-center font-semibold ${i === 0 ? 'text-white bg-ink-900' : 'text-ink-900'}`}>{r}</th>)}
                                </tr>
                            </thead>
                            <tbody>
                                {MATRIX.map(([label, ...cells]) => (
                                    <tr key={label} className="border-t border-line hover:bg-paper-50 transition-colors">
                                        <td className="px-5 py-3.5 text-ink-900 text-start">{label}</td>
                                        {cells.map((v, i) => <td key={i} className={`px-3 py-3.5 text-center ${i === 0 ? 'bg-amber-50/50 border-x border-amber-100' : ''}`}><Cell v={v} /></td>)}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>
            <ClosingCta />
        </div>
    );
}

export function FaqPage() {
    const { t } = useI18n();
    const GROUPS = [
        { key: 'research', icon: MessageSquareText, title: t('Research'), items: [
            [t('Is Justice AI a substitute for a lawyer’s judgment?'), t('No. It is a research and practice-management tool. It finds and summarises reported judgments and statutes so you reach the authority faster; always read the cited judgment before relying on it in court.')],
            [t('Which courts and laws are covered?'), t('Past judgments of the Supreme Court of Pakistan, the Lahore High Court, the Islamabad High Court and Punjab district courts; federal and Punjab statutes, including the full PPC and Cr.P.C.; the Lahore High Court Rules and Orders; and profiles of sitting and former judges.')],
            [t('How do I know a citation is real?'), t('Justice AI only cites judgments it has actually retrieved, and each one links to the court’s own PDF. Any section number it cannot find in those judgments is marked “unverified”.')],
            [t('What happens when the law reports don’t cover my question?'), t('The answer says so plainly. Justice AI never fills a gap with an invented authority; it tells you the retrieved judgments do not address the point and suggests how to narrow or rephrase the question.')]] },
        { key: 'language', icon: Languages, title: t('Urdu and voice'), items: [
            [t('Can I ask in Urdu?'), t('Yes — type or speak in Urdu, Roman Urdu or English. Answers can be written in Urdu, with case names, citations and section numbers kept in English exactly as reported.')],
            [t('Can I ask by voice?'), t('Yes. Press the microphone button and ask in Urdu, English or Roman Urdu; the question is transcribed and researched like any typed question.')]] },
        { key: 'practice', icon: CalendarClock, title: t('Practice tools'), items: [
            [t('Will I be reminded of my hearings?'), t('Yes. The case diary sends WhatsApp and email reminders two days and one day before every hearing, and stops once the hearing is marked completed.')],
            [t('Can my clerk record fees without being able to approve them?'), t('Yes. Clerks and associates record entries; only an owner or partner can approve them, and nobody can approve an entry they recorded themselves.')],
            [t('How do I invite my team?'), t('From the Team page the firm owner invites colleagues by email as partner, associate or clerk. They accept the invitation with their own account, and the owner can change roles later.')]] },
        { key: 'security', icon: ShieldCheck, title: t('Security & privacy'), items: [
            [t('Where are my documents stored, and who can see them?'), t('Documents are encrypted with AES-256 before storage on cloud object storage (Cloudflare R2 or any S3-compatible service). Only members of your firm can open them, and every access is logged.')],
            [t('Is a document I upload for analysis used to answer other people?'), t('No. A PDF you upload for analysis is visible to you alone and is used only to answer your own questions about it.')],
            [t('Is it free?'), t('Yes. Create an account with Google or email and start researching; there is no charge to use the workspace.')]] },
    ];
    return (
        <div className="bg-paper-50">
            <PageIntro eyebrow={t('Questions')} title={t('Frequently asked.')}
                lead={<>{t('Can’t find what you need?')} <Link to="/about" className="font-semibold text-ink-950 underline decoration-gold-400 decoration-2 underline-offset-4 hover:decoration-gold-600">{t('Read more about the project')}</Link>{t('.')}</>} />
            <Section className="pb-24 sm:pb-32">
                <div className="grid lg:grid-cols-[0.3fr_0.7fr] gap-10 lg:gap-16">
                    <nav className="lg:sticky lg:top-28 self-start">
                        <ul className="flex lg:flex-col gap-2 overflow-x-auto pb-2 lg:pb-0">
                            {GROUPS.map(g => (
                                <li key={g.key}>
                                    <a href={`#faq-${g.key}`} className="inline-flex lg:flex items-center gap-3 px-4 py-3 rounded-xl bg-white ring-1 ring-line shadow-soft text-[14px] font-semibold text-ink-900 hover:ring-gold-300 hover:text-gold-700 transition-colors whitespace-nowrap">
                                        <span className="w-8 h-8 rounded-lg bg-paper-100 ring-1 ring-line flex items-center justify-center flex-shrink-0"><g.icon size={15} className="text-gold-700" /></span>{g.title}
                                        <span className="ms-auto text-[12px] text-slate-400 tabular-nums hidden lg:inline">{g.items.length}</span>
                                    </a>
                                </li>
                            ))}
                        </ul>
                        <div className="hidden lg:block mt-6 p-5 rounded-2xl bg-ink-gradient text-white relative overflow-hidden">
                            <span aria-hidden className="absolute inset-0 bg-ink-sheen pointer-events-none" />
                            <div className="relative">
                                <div className="text-[15px] font-semibold">{t('Still have a question?')}</div>
                                <p className="text-[13px] text-white/60 leading-relaxed mt-1.5">{t('The About page explains how answers are made and what is in the collection.')}</p>
                                <Link to="/about" className="group mt-3 inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-gold-300">{t('About the project')} <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" /></Link>
                            </div>
                        </div>
                    </nav>
                    <div className="space-y-12">
                        {GROUPS.map((g, gi) => (
                            <div key={g.key} id={`faq-${g.key}`} className="scroll-mt-28">
                                <div className="flex items-center gap-3 mb-4">
                                    <IconTile icon={g.icon} />
                                    <h2 className="font-serif text-[22px] font-semibold text-ink-950 rtl:pt-1">{g.title}</h2>
                                </div>
                                <div className="space-y-3">
                                    {g.items.map(([q, a], i) => (
                                        <details key={q} open={gi === 0 && i === 0} className="group rounded-2xl bg-white ring-1 ring-line px-6 transition-shadow open:shadow-lift open:ring-line-strong hover:ring-line-strong">
                                            <summary className="flex items-center gap-4 cursor-pointer list-none py-5">
                                                <span className="font-serif text-[15px] text-gold-600 tabular-nums w-7 flex-shrink-0">{String(i + 1).padStart(2, '0')}</span>
                                                <span className="flex-1 text-[16px] font-semibold text-ink-950">{q}</span>
                                                <span className="w-8 h-8 rounded-full bg-paper-200 group-open:bg-ink-900 flex items-center justify-center flex-shrink-0 transition-colors">
                                                    <ChevronDown size={16} className="text-slate-500 group-open:text-gold-300 transition-transform group-open:rotate-180" />
                                                </span>
                                            </summary>
                                            <p className="ms-11 pb-6 -mt-1 ps-4 border-s-2 border-gold-300 text-slate-600 leading-relaxed text-[15px] pe-10">{a}</p>
                                        </details>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </Section>
            <ClosingCta />
        </div>
    );
}
