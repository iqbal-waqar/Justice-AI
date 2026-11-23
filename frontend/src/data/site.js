// Content shared by the public pages. Coverage numbers are distinct documents
// counted in the Qdrant index (LegalDocument_v3) on 2026-11-22 — update them
// after a re-ingest.

export const COVERAGE = {
    judgments: { sc: 2245, lhc: 4766, ihc: 1873, district: 634 },
    statutes: { federal: 527, punjab: 632 },
    judges: 282,
    // District courts whose judgments are indexed (ingest_district_courts.py).
    districts: ['Sahiwal', 'Okara', 'Pakpattan', 'Kasur', 'Rawalpindi'],
    // Lahore High Court Rules and Orders, Volumes I–IV (ingest_court_rules.py).
    rulesVolumes: 4,
};
export const SUPERIOR_JUDGMENTS = COVERAGE.judgments.sc + COVERAGE.judgments.lhc + COVERAGE.judgments.ihc;
export const TOTAL_JUDGMENTS = SUPERIOR_JUDGMENTS + COVERAGE.judgments.district;
export const TOTAL_STATUTES = COVERAGE.statutes.federal + COVERAGE.statutes.punjab;

export const fmt = (n) => n.toLocaleString('en-US');

/* Blog posts are Markdown. Newest first. The English text here is also the key for
   its Urdu translation (src/locales/ur/site.js); pages render it through t(). A post
   body may contain {judgments} / {statutes}, filled in when the page renders it. */
export const POSTS = [
    {
        slug: 'vault-and-billing',
        title: 'Introducing the Document Vault and maker-checker Billing',
        excerpt: 'Keep every petition, order and piece of evidence in an encrypted vault, and run your office accounts with a second pair of eyes on every rupee.',
        date: '2026-11-11',
        readMins: 4,
        tag: 'Launch',
        body: `
Research is only one part of running a practice. Files and fees are the other two — and they are usually spread across WhatsApp chats, a shared drive and a register on the clerk's desk. Justice AI now handles both.

### Document Vault

- **Organised by client and case.** Every file sits under the client and the case it belongs to, with a category: petition, order, judgment, evidence, correspondence, agreement or identity documents.
- **Encrypted before it is stored.** Files are encrypted with AES-256 inside Justice AI before they reach storage, so the storage provider only ever holds scrambled data. If a stored file is altered, Justice AI detects it and refuses to open it.
- **Only your firm can open it.** Documents are visible to members of your firm and nobody else.
- **Every access is recorded.** Uploads, views, downloads, edits and deletions are logged with the person and the time. Owners and partners can review the log.

### Billing & Financials

- **Fees, case expenses and payments** are recorded per client and per case, in rupees.
- **Maker-checker approval.** Anyone in the office can record an entry; an owner or partner approves it before it counts. Nobody can approve their own entry, so a single person cannot change the books alone.
- **Locked once approved.** Approved entries cannot be edited. A mistake is corrected by voiding the entry with a reason, which stays on record.
- **Statements in one click.** Export a client's statement of account as a PDF for any period, with the opening balance carried forward.

### Built for teams

Invite colleagues as partners, associates or clerks. Everyone works from the same client files, documents and ledger, and each role sees the actions that suit it. Solo advocates can allow self-approval, and every such approval is marked as self-approved.
`,
    },
    {
        slug: 'ask-in-urdu',
        title: 'Ask in Urdu, get answers in Urdu',
        excerpt: 'Justice AI now understands questions written in Urdu or Roman Urdu and can answer in Urdu — while keeping every citation exactly as the court reported it.',
        date: '2026-11-11',
        readMins: 3,
        tag: 'Feature',
        body: `
Many clients describe their problem in Urdu, and much of a lawyer's working day happens in Urdu too. Justice AI now works the same way.

### How it works

- **Type your question in Urdu** (اردو) or Roman Urdu — for example *"489-F mein zamanat kaise milti hai?"*
- Justice AI translates it into precise legal English, because the judgments themselves are reported in English, and searches the full collection.
- The answer is written in formal Urdu. **Case names, citations, court names and section numbers stay in English**, exactly as they appear in the law reports, so you can quote and verify them.

### Choose the answer language

The chat has an **English / اردو** switch. On English, a question typed in Urdu script still gets an Urdu answer; on اردو, every answer comes back in Urdu — even when you ask in English. Urdu text is displayed right-to-left in a proper Nastaliq font.

### Same safeguards

Urdu answers go through the same checks as English ones: only judgments that actually address your question are used, and any section number that cannot be found in the retrieved text is marked *(unverified)*.
`,
    },
    {
        slug: 'grounded-answers',
        title: 'Why every answer cites a real judgment',
        excerpt: 'General-purpose chatbots invent case law. Here is how Justice AI checks its sources before it writes a single sentence.',
        date: '2026-11-08',
        readMins: 4,
        tag: 'Trust',
        body: `
A fabricated citation in a bail application is worse than no citation at all. General-purpose AI assistants are known to invent plausible-sounding cases. Justice AI is built around a simple rule: **it only cites what it has actually retrieved.**

### Three checks before an answer is written

1. **Search the real record.** Your question is matched against {judgments} reported judgments of the Supreme Court, Lahore High Court and Islamabad High Court, plus {statutes} federal and Punjab statutes.
2. **Relevance review.** A second model reviews the retrieved passages and must quote the exact words showing each judgment addresses your issue. Documents that merely share a keyword are dropped.
3. **Citation check.** After the answer is written, every section and article number is checked against the retrieved text. Anything not found there is kept but marked *(unverified)*, so you know exactly what to double-check.

### When the answer is "not covered"

If nothing in the collection genuinely addresses your question, Justice AI says so and lists the closest documents it found — instead of attributing holdings to judgments that do not contain them.

### Click through to the source

Every judgment cited links to the court's own PDF, so the original text is one click away.
`,
    },
    {
        slug: 'whatsapp-hearing-reminders',
        title: 'Never miss a hearing: WhatsApp reminders',
        excerpt: 'The Case Diary keeps every hearing in one place and sends a WhatsApp reminder two days and one day before each date.',
        date: '2026-11-05',
        readMins: 2,
        tag: 'Feature',
        body: `
Research is only half of practice; the other half is being in the right courtroom on the right day.

### The Case Diary

Add a hearing with the case title, number, court, date and time. Each hearing can have its **own WhatsApp number** — useful when a junior or clerk should receive the reminder instead of you.

### Reminders

Justice AI checks your diary several times a day and sends a reminder **two days and one day before** each hearing, by WhatsApp and email. Mark a hearing completed and the reminders stop.

### Notes that follow you

Case notes are saved to your account, not your browser, so they are there on any device you sign in from.
`,
    },
    {
        slug: 'how-search-works',
        title: 'Inside the search: finding the right precedent',
        excerpt: 'Keyword search misses synonyms; pure AI search misses exact section numbers. Justice AI uses both, then re-ranks.',
        date: '2026-11-02',
        readMins: 4,
        tag: 'Technology',
        body: `
Lawyers search in two very different ways: by **exact reference** ("Section 489-F PPC", "2023 SCMR 2122") and by **concept** ("bail where the complainant delayed the FIR"). A good legal search engine has to handle both.

### Hybrid retrieval

- **Keyword matching (BM25)** finds exact section numbers, citations and party names.
- **Semantic search** finds judgments that discuss the same legal idea in different words.
- The two result lists are fused, so a judgment strong on either signal is considered.

### Re-ranking

The best candidates are then re-scored by a dedicated ranking model that reads your question and each passage together. Only the top few judgments — with up to two of their most relevant passages each — reach the answer.

### Understanding the question first

Before searching, Justice AI works out what kind of question you asked (case law, statute, judge, or something outside law), resolves follow-ups like *"explain the first case"* from the conversation, applies year filters such as *"judgments from 2020"*, and maps Indian provisions (for example Section 482 CrPC) to their Pakistani equivalents (Section 561-A Cr.P.C.).
`,
    },
];

export const getPost = (slug) => POSTS.find(p => p.slug === slug);
export const formatDate = (iso, lang = 'en') =>
    new Date(iso + 'T00:00:00').toLocaleDateString(lang === 'ur' ? 'ur-PK' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

/* Values for the {placeholders} in post bodies. */
export const POST_VARS = { judgments: fmt(TOTAL_JUDGMENTS), statutes: fmt(TOTAL_STATUTES) };

/* Platform modules, shared by the landing and about pages. */
export const MODULES = [
    { key: 'research', title: 'AI legal research', text: 'Ask in plain language and get a clear answer that explains the law and cites the judgments it relies on — each one linked to the court record.' },
    { key: 'language', title: 'English, اردو & voice', text: 'Ask in English, Urdu or Roman Urdu, by typing or by speaking. Answers come back in your language with citations kept exactly as reported.' },
    { key: 'vault', title: 'Secure document vault', text: 'Petitions, orders and evidence filed by client and case, encrypted before storage, with every access recorded.' },
    { key: 'billing', title: 'Billing & financials', text: 'Fees, case expenses and client payments with maker-checker approval, live balances and PDF statements.' },
    { key: 'diary', title: 'Case diary & reminders', text: 'Hearings and notes in one place, with WhatsApp and email reminders two days and one day before every date.' },
    { key: 'analysis', title: 'Document analysis', text: 'Upload a PDF — an FIR, a judgment, a contract — and ask questions answered only from that document.' },
];
