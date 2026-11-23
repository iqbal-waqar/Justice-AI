import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, CalendarDays, ChevronDown, Download, ExternalLink, Eye, FileText, Library, Loader2, Plus, Search, ShieldCheck, Trash2, Upload, X, Landmark, Scale, ChevronLeft, ChevronRight } from 'lucide-react';
import { apiBlob, apiJson, formatBytes, saveBlob } from '../api';
import { Alert, Button, EmptyState, Field, Modal, PageHeader, Tabs, inputClass, textareaClass } from '../components/ui';
import { useI18n } from '../i18n';

const TAG_SUGGESTIONS = ['Civil', 'Criminal', 'Family', 'Session Court', 'Civil Court', 'High Court', 'Supreme Court', 'Urdu', 'English'];

/* ── Laws ─────────────────────────────────────────────────────────────── */
function LawRow({ law, open, onToggle }) {
    const { t } = useI18n();
    const punjab = law.jurisdiction === 'Punjab';
    return (
        <div className={`rounded-2xl bg-white border overflow-hidden transition-all duration-200 ${open ? 'border-line-strong shadow-lift' : 'border-line shadow-soft hover:border-line-strong hover:shadow-lift'}`}>
            <button type="button" onClick={onToggle} aria-expanded={open}
                className="group w-full flex items-center gap-4 px-5 py-4 text-start transition-colors">
                <span className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ring-1 ${punjab ? 'bg-emerald-50 ring-emerald-100' : 'bg-ink-gradient ring-ink-900'}`}>
                    {punjab ? <Scale size={17} className="text-emerald-700" /> : <Landmark size={17} className="text-gold-300" />}
                </span>
                <span className="flex-1 min-w-0">
                    <span dir="auto" className="block text-[15px] font-semibold text-ink-950 leading-snug group-hover:text-ink-800 text-start">{law.title}</span>
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5 text-[12.5px]">
                        <span className={`inline-flex items-center h-[22px] px-2 rounded-full ring-1 ring-inset font-semibold text-[11px] ${punjab ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-ink-50 text-ink-800 ring-ink-200'}`}>{t(law.jurisdiction)}</span>
                        <span className="text-gold-700 font-medium">{t(law.category)}</span>
                        {(law.law_no || law.year) && <span className="text-slate-400">· <span className="ltr inline-block">{law.law_no || law.year}</span></span>}
                    </span>
                </span>
                <span className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${open ? 'bg-paper-200 text-ink-900' : 'text-slate-400 group-hover:bg-paper-100'}`}>
                    <ChevronDown size={17} className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
                </span>
            </button>
            {open && (
                <div className="px-5 pb-5 animate-fade-in">
                    <div className="rounded-xl bg-paper-100 border border-line p-4">
                        {law.year && (
                            <p className="flex items-center gap-2 text-[13.5px] text-slate-600 mb-4">
                                <CalendarDays size={15} className="text-slate-400" /> {t('Year of enactment:')} <b className="font-semibold text-ink-950">{law.year}</b>
                            </p>
                        )}
                        <div className="flex flex-wrap gap-2">
                            {law.pdf_url && (
                                <a href={law.pdf_url} target="_blank" rel="noreferrer"
                                    className="inline-flex items-center gap-2 px-4 h-10 rounded-xl bg-ink-900 text-white text-sm font-semibold hover:bg-ink-800 transition-colors shadow-[0_1px_2px_rgba(11,18,32,0.25)]">
                                    <Eye size={16} className="text-gold-300" /> {t('View document')}
                                </a>
                            )}
                            {law.source_url && (
                                <a href={law.source_url} target="_blank" rel="noreferrer"
                                    className="inline-flex items-center gap-2 px-4 h-10 rounded-xl bg-white border border-line-strong text-ink-950 text-sm font-semibold hover:border-ink-300 transition-colors">
                                    <ExternalLink size={15} className="rtl:-scale-x-100" /> {t('Official source')}
                                </a>
                            )}
                        </div>
                        <p className="text-[12px] text-slate-400 mt-3">{law.jurisdiction === 'Punjab' ? t('Opens the official copy published by the Punjab Code (punjablaws.gov.pk).') : t('Opens the official copy published by the Pakistan Code (pakistancode.gov.pk).')}</p>
                    </div>
                </div>
            )}
        </div>
    );
}

function LawsTab() {
    const { t } = useI18n();
    const [q, setQ] = useState('');
    const [jurisdiction, setJurisdiction] = useState('');
    const [category, setCategory] = useState('');
    const [data, setData] = useState(null);
    const [items, setItems] = useState([]);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [openId, setOpenId] = useState(null);

    const load = async (nextPage, append) => {
        setLoading(true); setError('');
        try {
            const params = new URLSearchParams({ q, jurisdiction, category, page: String(nextPage), page_size: '30' });
            const res = await apiJson(`/api/v1/library/laws?${params}`);
            setData(res);
            setItems(prev => append ? [...prev, ...res.items] : res.items);
            setPage(nextPage);
        } catch (e) { setError(e.message); }
        setLoading(false);
    };

    useEffect(() => {
        const timer = setTimeout(() => load(1, false), 250);
        return () => clearTimeout(timer);
    }, [q, jurisdiction, category]);

    return (
        <div>
            <div className="flex flex-col lg:flex-row gap-3 p-3 mb-5 rounded-2xl bg-white border border-line shadow-soft">
                <div className="relative flex-1">
                    <Search size={17} className="absolute start-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input value={q} onChange={e => setQ(e.target.value)} placeholder={t('Search laws, acts and ordinances…')}
                        className={`${inputClass} ps-10 !h-11 bg-paper-50`} />
                </div>
                <div role="tablist" className="flex p-1 rounded-xl bg-paper-200/80 ring-1 ring-inset ring-line h-11 flex-shrink-0">
                    {[['', t('All')], ['Federal', t('Federal')], ['Punjab', t('Punjab')]].map(([v, l]) => (
                        <button key={v || 'all'} type="button" role="tab" aria-selected={jurisdiction === v}
                            onClick={() => { setJurisdiction(v); setCategory(''); }}
                            className={`px-4 rounded-lg text-[13px] font-semibold transition-all ${jurisdiction === v ? 'bg-white text-ink-950 shadow-soft ring-1 ring-line' : 'text-slate-500 hover:text-ink-950'}`}>{l}</button>
                    ))}
                </div>
                <select value={category} onChange={e => setCategory(e.target.value)} aria-label={t('Category')}
                    className={`${inputClass} lg:!w-64 !h-11 bg-paper-50`}>
                    <option value="">{t('All categories')}</option>
                    {(data?.categories || []).map(c => <option key={c} value={c}>{t(c)}</option>)}
                </select>
            </div>

            <div className="flex items-center justify-between mb-3 px-1">
                <p className="text-[13px] font-medium text-slate-500">
                    {data ? ((q || jurisdiction || category)
                        ? t(data.total === 1 ? '{n} law of {total}' : '{n} laws of {total}', { n: data.total.toLocaleString(), total: data.library_total.toLocaleString() })
                        : t(data.total === 1 ? '{n} law' : '{n} laws', { n: data.total.toLocaleString() })) : ' '}
                </p>
            </div>

            <Alert onClose={() => setError('')}>{error}</Alert>

            {data && items.length === 0 && !loading ? (
                <div className="rounded-2xl bg-white border border-line shadow-soft"><EmptyState icon={BookOpen} title={t('No laws match')} text={t('Try a different word, or clear the filters.')} /></div>
            ) : (
                <div className="space-y-2.5">
                    {items.map(law => <LawRow key={law.id} law={law} open={openId === law.id} onToggle={() => setOpenId(openId === law.id ? null : law.id)} />)}
                </div>
            )}

            {loading && <div className="flex justify-center py-6"><Loader2 size={22} className="animate-spin text-ink-700" /></div>}
            {!loading && data && <Pager page={page} total={data.total} pageSize={30} onChange={p => { load(p, false); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />}
        </div>
    );
}

/* ── Resources ────────────────────────────────────────────────────────── */
function Thumbnail({ id }) {
    const [url, setUrl] = useState(null);
    useEffect(() => {
        let alive = true, made = null;
        apiBlob(`/api/v1/library/resources/${id}/thumbnail`)
            .then(b => { if (alive) { made = URL.createObjectURL(b); setUrl(made); } })
            .catch(() => {});
        return () => { alive = false; if (made) URL.revokeObjectURL(made); };
    }, [id]);
    return (
        <div className="relative w-24 h-28 sm:w-28 sm:h-[136px] rounded-xl ring-1 ring-line bg-paper-50 overflow-hidden flex-shrink-0 flex items-center justify-center shadow-[0_8px_20px_-10px_rgba(18,29,47,0.35)] rotate-[1.5deg] group-hover:rotate-0 transition-transform duration-300">
            {url ? <img src={url} alt="" className="w-full h-full object-cover object-top" /> : <FileText size={26} className="text-slate-300" />}
            <span className="absolute bottom-1.5 end-1.5 h-5 px-1.5 rounded-md bg-red-600 text-white text-[9.5px] font-bold tracking-wide flex items-center">PDF</span>
        </div>
    );
}

function ResourceCard({ res, onOpen, onDownload, onDelete, busy }) {
    const { t } = useI18n();
    return (
        <div className="group rounded-2xl bg-white border border-line shadow-soft p-5 flex gap-4 sm:gap-6 hover:shadow-lift hover:border-line-strong transition-all duration-200">
            <div className="flex-1 min-w-0">
                <div className="flex items-start gap-3">
                    <span className="w-10 h-10 rounded-xl bg-emerald-50 ring-1 ring-emerald-100 flex items-center justify-center flex-shrink-0">
                        <FileText size={18} className="text-emerald-700" />
                    </span>
                    <div className="min-w-0">
                        <h3 dir="auto" className="font-sans text-[16px] font-semibold text-ink-950 leading-snug text-start">{res.title}</h3>
                        {res.description && <p dir="auto" className="text-[13.5px] text-slate-500 mt-0.5 line-clamp-2">{res.description}</p>}
                    </div>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-3">
                    <span className="inline-flex items-center h-6 px-2.5 rounded-full bg-emerald-50 ring-1 ring-inset ring-emerald-200 text-[11.5px] font-semibold text-emerald-800">{t(res.category)}</span>
                    {res.tags.map(tag => <span key={tag} className="inline-flex items-center h-6 px-2.5 rounded-full bg-paper-100 ring-1 ring-inset ring-line text-[11.5px] text-slate-600">{t(tag)}</span>)}
                    {res.language && !res.tags.some(tag => tag.toLowerCase() === res.language.toLowerCase()) && (
                        <span className="inline-flex items-center h-6 px-2.5 rounded-full bg-paper-100 ring-1 ring-inset ring-line text-[11.5px] text-slate-600">{t(res.language)}</span>
                    )}
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-4">
                    <Button size="sm" variant="primary" icon={Eye} onClick={() => onOpen(res)} loading={busy === `open-${res.id}`}>{t('View')}</Button>
                    <Button size="sm" variant="secondary" icon={Download} onClick={() => onDownload(res)} loading={busy === `dl-${res.id}`}>{t('Download')}</Button>
                    {res.can_delete && <Button size="sm" variant="ghost" icon={Trash2} onClick={() => onDelete(res)} className="text-red-600 hover:text-red-700 hover:bg-red-50">{t('Delete')}</Button>}
                    <span className="text-[12px] text-slate-400 ms-auto">
                        {res.page_count ? `${res.page_count === 1 ? t('1 page') : t('{n} pages', { n: res.page_count })} · ` : ''}<span className="ltr inline-block">{formatBytes(res.size_bytes)}</span>
                        {res.uploaded_by_name ? ` · ${t('added by {name}', { name: res.uploaded_by_name })}` : ''}
                    </span>
                </div>
            </div>
            <Thumbnail id={res.id} />
        </div>
    );
}

function Section({ icon: Icon, title, count, open, onToggle, children }) {
    const { t } = useI18n();
    return (
        <section className="rounded-3xl bg-paper-200/50 border border-line p-4 sm:p-5">
            <button type="button" onClick={onToggle} aria-expanded={open} className="group w-full flex items-center gap-3.5 text-start">
                <span className="relative w-11 h-11 rounded-xl bg-ink-gradient ring-1 ring-ink-900 flex items-center justify-center shadow-[0_6px_14px_-6px_rgba(11,18,32,0.5)]">
                    <span className="absolute inset-0 rounded-xl bg-ink-sheen" />
                    <Icon size={18} className="relative text-gold-300" />
                </span>
                <span className="flex-1">
                    <span className="block page-title text-[18px] text-ink-950">{title}</span>
                    <span className="block text-[12.5px] text-slate-500">{count === 1 ? t('1 resource') : t('{n} resources', { n: count })}</span>
                </span>
                <span className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 group-hover:bg-white group-hover:text-ink-900 transition-colors">
                    <ChevronDown size={17} className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
                </span>
            </button>
            {open && <div className="mt-4 space-y-3">{children}</div>}
        </section>
    );
}

function AddResourceModal({ categories, onClose, onAdded }) {
    const { t } = useI18n();
    const [file, setFile] = useState(null);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState('General');
    const [language, setLanguage] = useState('');
    const [tags, setTags] = useState([]);
    const [tagInput, setTagInput] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const fileRef = useRef(null);

    const addTag = (raw) => {
        const v = raw.trim();
        if (v && !tags.some(x => x.toLowerCase() === v.toLowerCase()) && tags.length < 8) setTags([...tags, v]);
        setTagInput('');
    };
    const pick = (f) => {
        if (!f) return;
        if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) { setError(t('Please choose a PDF file.')); return; }
        if (f.size > 20 * 1024 * 1024) { setError(t('The file is larger than 20 MB.')); return; }
        setError(''); setFile(f);
        if (!title) setTitle(f.name.replace(/\.pdf$/i, ''));
    };
    const submit = async () => {
        if (!file) { setError(t('Choose a PDF to add.')); return; }
        setBusy(true); setError('');
        try {
            const body = new FormData();
            body.append('file', file);
            body.append('title', title);
            body.append('description', description);
            body.append('category', category);
            body.append('tags', tags.join(','));
            body.append('language', language);
            onAdded(await apiJson('/api/v1/library/resources', { method: 'POST', body }));
        } catch (e) { setError(e.message); }
        setBusy(false);
    };

    return (
        <Modal title={t('Add resource')} onClose={onClose} wide footer={<>
            <Button variant="secondary" onClick={onClose}>{t('Cancel')}</Button>
            <Button variant="primary" icon={Upload} loading={busy} onClick={submit}>{t('Add to library')}</Button>
        </>}>
            <div className="space-y-4">
                <Alert onClose={() => setError('')}>{error}</Alert>
                <button type="button" onClick={() => fileRef.current?.click()}
                    onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); pick(e.dataTransfer.files?.[0]); }}
                    className={`w-full rounded-2xl border-2 border-dashed px-5 py-8 text-center transition-colors ${file ? 'border-emerald-300 bg-emerald-50/40' : 'border-line-strong bg-paper-50 hover:border-gold-500 hover:bg-amber-50/40'}`}>
                    {file ? (
                        <span className="inline-flex items-center gap-2 text-[14px] font-medium text-ink-950"><FileText size={18} className="text-emerald-700" /><span className="ltr">{file.name}</span><span className="text-slate-400 font-normal ltr">({formatBytes(file.size)})</span></span>
                    ) : (
                        <>
                            <span className="mx-auto mb-3 w-12 h-12 rounded-2xl bg-white ring-1 ring-line shadow-soft flex items-center justify-center"><Upload size={20} className="text-gold-600" /></span>
                            <span className="block text-[14px] font-medium text-ink-950">{t('Choose a PDF or drop it here')}</span>
                            <span className="block text-[12.5px] text-slate-500 mt-0.5">{t('Forms, templates, notices, checklists — up to 20 MB')}</span>
                        </>
                    )}
                </button>
                <input ref={fileRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={e => { pick(e.target.files?.[0]); e.target.value = ''; }} />
                <div className="grid sm:grid-cols-2 gap-4">
                    <Field label={t('Title')}><input value={title} onChange={e => setTitle(e.target.value)} maxLength={200} className={inputClass} placeholder={t('e.g. Bail petition template')} /></Field>
                    <Field label={t('Category')}>
                        <select value={category} onChange={e => setCategory(e.target.value)} className={inputClass}>
                            {categories.map(c => <option key={c} value={c}>{t(c)}</option>)}
                        </select>
                    </Field>
                </div>
                <Field label={t('Description (optional)')}><textarea rows={2} value={description} onChange={e => setDescription(e.target.value)} maxLength={500} className={textareaClass} placeholder={t('What it is and when to use it')} /></Field>
                <div className="grid sm:grid-cols-[1fr_180px] gap-4">
                    <Field label={t('Tags (optional)')} hint={t('Press Enter to add a tag. Up to 8.')}>
                        <div className="flex flex-wrap items-center gap-1.5 min-h-10 px-2.5 py-1.5 rounded-xl border border-line-strong bg-white hover:border-ink-300 focus-within:border-gold-500 focus-within:shadow-focus transition-[border-color,box-shadow]">
                            {tags.map(tag => (
                                <span key={tag} className="inline-flex items-center gap-1 ps-2.5 pe-1 py-0.5 rounded-full bg-ink-50 border border-ink-100 text-[12.5px] text-ink-900">
                                    {t(tag)}<button type="button" aria-label={t('Remove {tag}', { tag })} onClick={() => setTags(tags.filter(x => x !== tag))} className="p-0.5 rounded-full hover:bg-ink-100"><X size={12} /></button>
                                </span>
                            ))}
                            <input value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(tagInput); } }}
                                className="flex-1 min-w-[90px] text-sm outline-none bg-transparent py-0.5" placeholder={tags.length ? '' : t('e.g. Criminal')} />
                        </div>
                    </Field>
                    <Field label={t('Language (optional)')}>
                        <select value={language} onChange={e => setLanguage(e.target.value)} className={inputClass}>
                            <option value="">—</option><option value="English">{t('English')}</option><option value="Urdu">{t('Urdu')}</option><option value="English & Urdu">{t('English & Urdu')}</option>
                        </select>
                    </Field>
                </div>
                <div className="flex flex-wrap gap-1.5">
                    {TAG_SUGGESTIONS.filter(tag => !tags.includes(tag)).map(tag => (
                        <button key={tag} type="button" onClick={() => addTag(tag)} className="inline-flex items-center gap-1 h-7 px-2.5 rounded-full bg-paper-100 ring-1 ring-inset ring-line text-[12px] text-slate-600 hover:ring-gold-400 hover:text-ink-950 hover:bg-white transition-colors"><Plus size={11} />{t(tag)}</button>
                    ))}
                </div>
                <p className="text-[12.5px] text-slate-500 flex items-center gap-1.5"><ShieldCheck size={14} className="text-emerald-600" />{t('Resources you add are visible to your firm only.')}</p>
            </div>
        </Modal>
    );
}

function ResourcesTab() {
    const { t } = useI18n();
    const [items, setItems] = useState([]);
    const [categories, setCategories] = useState(['General']);
    const [q, setQ] = useState('');
    const [tag, setTag] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [adding, setAdding] = useState(false);
    const [busy, setBusy] = useState('');
    const [openSystem, setOpenSystem] = useState(true);
    const [openFirm, setOpenFirm] = useState(true);
    const PAGE = 12;
    const [sysPage, setSysPage] = useState(1);
    const [firmPage, setFirmPage] = useState(1);
    useEffect(() => { setSysPage(1); setFirmPage(1); }, [q, tag]);

    const load = async () => {
        setLoading(true); setError('');
        try { setItems(await apiJson('/api/v1/library/resources')); } catch (e) { setError(e.message); }
        setLoading(false);
    };
    useEffect(() => {
        load();
        apiJson('/api/v1/library/resource-categories').then(setCategories).catch(() => {});
    }, []);

    const allTags = useMemo(() => [...new Set(items.flatMap(r => r.tags))].sort(), [items]);
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    const shown = items.filter(r => (!tag || r.tags.includes(tag))
        && terms.every(term => [r.title, r.description, r.category, r.language, ...r.tags].join(' ').toLowerCase().includes(term)));
    const system = shown.filter(r => r.is_system);
    const firm = shown.filter(r => !r.is_system);

    const open = async (res) => {
        setBusy(`open-${res.id}`);
        const tab = window.open('', '_blank');
        try {
            const blob = await apiBlob(`/api/v1/library/resources/${res.id}/file`);
            const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
            if (tab) tab.location.href = url; else window.open(url, '_blank');
            setTimeout(() => URL.revokeObjectURL(url), 60_000);
        } catch (e) { tab?.close(); setError(e.message); }
        setBusy('');
    };
    const download = async (res) => {
        setBusy(`dl-${res.id}`);
        try { saveBlob(await apiBlob(`/api/v1/library/resources/${res.id}/file?download=true`), res.original_filename); } catch (e) { setError(e.message); }
        setBusy('');
    };
    const remove = async (res) => {
        if (!window.confirm(t('Delete “{title}” from your firm\'s library?', { title: res.title }))) return;
        try { await apiJson(`/api/v1/library/resources/${res.id}`, { method: 'DELETE' }); setItems(items.filter(x => x.id !== res.id)); } catch (e) { setError(e.message); }
    };
    const cardProps = { onOpen: open, onDownload: download, onDelete: remove, busy };

    return (
        <div>
            <div className="flex flex-col sm:flex-row gap-3 p-3 mb-4 rounded-2xl bg-white border border-line shadow-soft">
                <div className="relative flex-1">
                    <Search size={17} className="absolute start-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input value={q} onChange={e => setQ(e.target.value)} placeholder={t('Search resources…')} className={`${inputClass} ps-10 !h-11 bg-paper-50`} />
                </div>
                <Button variant="primary" size="lg" icon={Plus} onClick={() => setAdding(true)}>{t('Add resource')}</Button>
            </div>
            {allTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-5">
                    {['', ...allTags].map(tg => (
                        <button key={tg || 'all'} type="button" onClick={() => setTag(tg)}
                            className={`h-8 px-3.5 rounded-full text-[12.5px] font-semibold ring-1 ring-inset transition-colors ${tag === tg ? 'bg-ink-900 ring-ink-900 text-white shadow-soft' : 'bg-white ring-line text-slate-600 hover:ring-ink-300 hover:text-ink-950'}`}>
                            {tg ? t(tg) : t('All')}
                        </button>
                    ))}
                </div>
            )}
            <Alert onClose={() => setError('')}>{error}</Alert>
            {loading ? (
                <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-ink-700" /></div>
            ) : (
                <div className="space-y-5">
                    <div id="system-resources" className="scroll-mt-24" />
                    <Section icon={ShieldCheck} title={t('System resources')} count={system.length} open={openSystem} onToggle={() => setOpenSystem(!openSystem)}>
                        {system.length ? <>
                            {system.slice((sysPage - 1) * PAGE, sysPage * PAGE).map(r => <ResourceCard key={r.id} res={r} {...cardProps} />)}
                            <Pager page={sysPage} total={system.length} pageSize={PAGE} onChange={p => { setSysPage(p); document.getElementById('system-resources')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }} />
                        </> : <p className="text-sm text-slate-500 px-1">{t('No built-in resources match.')}</p>}
                    </Section>
                    <Section icon={Library} title={t("Your firm's resources")} count={firm.length} open={openFirm} onToggle={() => setOpenFirm(!openFirm)}>
                        {firm.length ? <>
                            {firm.slice((firmPage - 1) * PAGE, firmPage * PAGE).map(r => <ResourceCard key={r.id} res={r} {...cardProps} />)}
                            <Pager page={firmPage} total={firm.length} pageSize={PAGE} onChange={setFirmPage} />
                        </> : (
                            <div className="text-center py-8">
                                <p className="text-sm text-slate-500 mb-3">{items.some(r => !r.is_system) ? t('No resources match.') : t('Add the forms and templates your office uses, so everyone can find them here.')}</p>
                                <Button variant="secondary" icon={Plus} onClick={() => setAdding(true)}>{t('Add resource')}</Button>
                            </div>
                        )}
                    </Section>
                </div>
            )}
            {adding && <AddResourceModal categories={categories} onClose={() => setAdding(false)}
                onAdded={(res) => { setItems(prev => [...prev, res]); setAdding(false); setOpenFirm(true); }} />}
        </div>
    );
}

/* ── Pager: « 1 2 … 7 » ──────────────────────────────────────────────── */
function Pager({ page, total, pageSize, onChange }) {
    const { t } = useI18n();
    const pages = Math.max(1, Math.ceil(total / pageSize));
    if (pages <= 1) return null;
    const around = [...new Set([1, pages, page - 1, page, page + 1].filter(n => n >= 1 && n <= pages))].sort((a, b) => a - b);
    const items = [];
    around.forEach((n, i) => { if (i && n - around[i - 1] > 1) items.push('…'); items.push(n); });
    const btn = 'min-w-[40px] h-10 px-3 rounded-xl text-[13.5px] font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed';
    return (
        <nav aria-label={t('Pages')} className="flex flex-wrap items-center justify-center gap-1.5 mt-8">
            <button onClick={() => onChange(page - 1)} disabled={page <= 1} className={`${btn} bg-white ring-1 ring-line text-ink-900 hover:ring-ink-300 inline-flex items-center gap-1`}><ChevronLeft size={15} className="rtl:rotate-180" />{t('Previous')}</button>
            {items.map((n, i) => n === '…'
                ? <span key={`e${i}`} className="px-1 text-slate-400">…</span>
                : <button key={n} onClick={() => onChange(n)} aria-current={n === page ? 'page' : undefined}
                    className={`${btn} ${n === page ? 'bg-ink-900 text-white shadow-soft' : 'bg-white ring-1 ring-line text-ink-900 hover:ring-ink-300'}`}>{n}</button>)}
            <button onClick={() => onChange(page + 1)} disabled={page >= pages} className={`${btn} bg-white ring-1 ring-line text-ink-900 hover:ring-ink-300 inline-flex items-center gap-1`}>{t('Next')}<ChevronRight size={15} className="rtl:rotate-180" /></button>
            <span className="basis-full text-center text-[12.5px] text-slate-500 mt-2">{t('Page {page} of {pages}', { page, pages })}</span>
        </nav>
    );
}

/* ── Page ─────────────────────────────────────────────────────────────── */
export default function LibraryPage() {
    const { t } = useI18n();
    const [tab, setTab] = useState(() => { try { return localStorage.getItem('justiceai_library_tab') || 'laws'; } catch { return 'laws'; } });
    const choose = (key) => { setTab(key); try { localStorage.setItem('justiceai_library_tab', key); } catch { /* ignore */ } };
    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-paper-100">
            <PageHeader icon={Library} title={t('Law library')} subtitle={t('Federal and Punjab laws, plus the forms and documents your office uses')} />
            <div className="flex-1 overflow-y-auto">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-7">
                    <div className="mb-6">
                        <Tabs value={tab} onChange={choose} options={[
                            { value: 'laws', label: <span className="inline-flex items-center gap-2"><BookOpen size={15} />{t('Laws')}</span> },
                            { value: 'resources', label: <span className="inline-flex items-center gap-2"><FileText size={15} />{t('Resources & documents')}</span> },
                        ]} />
                    </div>
                    {tab === 'laws' ? <LawsTab /> : <ResourcesTab />}
                </div>
            </div>
        </div>
    );
}
