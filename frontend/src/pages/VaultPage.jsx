import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FolderLock, Upload, Search, FileText, Image as ImageIcon, FileSpreadsheet, File, Download, Eye, Edit3, Trash2, ShieldCheck, History, Lock, HardDrive, UploadCloud, Pencil } from 'lucide-react';
import { apiJson, apiBlob, saveBlob, formatBytes, formatDate } from '../api';
import { PageHeader, Button, Modal, Field, inputClass, controlClass, textareaClass, Alert, EmptyState, StatCard, Card, Tabs } from '../components/ui';
import { useI18n } from '../i18n';

const CATEGORIES = [
    ['petition', 'Petition'], ['order', 'Order'], ['judgment', 'Judgment'], ['evidence', 'Evidence'],
    ['correspondence', 'Correspondence'], ['agreement', 'Agreement'], ['identity', 'Identity / KYC'], ['other', 'Other'],
];
const CAT_LABEL = Object.fromEntries(CATEGORIES);
const ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.txt';

/* File-type tile: icon, tint and a short label (PDF, DOC…). */
const fileKind = (type = '', name = '') => {
    const ext = (name.split('.').pop() || '').toUpperCase().slice(0, 4);
    if (type.startsWith('image/')) return { Icon: ImageIcon, tint: 'bg-violet-50 text-violet-600 ring-violet-100', label: ext || 'IMG' };
    if (type.includes('sheet') || type.includes('excel')) return { Icon: FileSpreadsheet, tint: 'bg-emerald-50 text-emerald-600 ring-emerald-100', label: ext || 'XLS' };
    if (type === 'application/pdf') return { Icon: FileText, tint: 'bg-red-50 text-red-600 ring-red-100', label: 'PDF' };
    if (type.includes('word')) return { Icon: FileText, tint: 'bg-sky-50 text-sky-600 ring-sky-100', label: ext || 'DOC' };
    return { Icon: File, tint: 'bg-paper-200 text-ink-700 ring-line', label: ext || 'FILE' };
};
const ACTION_LOOK = {
    upload: [UploadCloud, 'bg-emerald-50 text-emerald-600 ring-emerald-200'],
    view: [Eye, 'bg-ink-50 text-ink-700 ring-ink-200'],
    download: [Download, 'bg-sky-50 text-sky-600 ring-sky-200'],
    update: [Pencil, 'bg-amber-50 text-gold-700 ring-amber-200'],
    delete: [Trash2, 'bg-red-50 text-red-600 ring-red-200'],
};

export default function VaultPage() {
    const [params, setParams] = useSearchParams();
    const { t, lang } = useI18n();
    const fmtDate = (d) => (lang === 'ur' && d) ? new Date(d).toLocaleDateString('ur-PK', { day: 'numeric', month: 'short', year: 'numeric' }) : formatDate(d);
    const [docs, setDocs] = useState([]);
    const [clients, setClients] = useState([]);
    const [firm, setFirm] = useState(null);
    const [stats, setStats] = useState(null);
    const [tab, setTab] = useState('documents');
    const [audit, setAudit] = useState([]);
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState('');
    const [error, setError] = useState('');
    const [upload, setUpload] = useState(null);     // upload form state
    const [edit, setEdit] = useState(null);
    const [busy, setBusy] = useState(false);
    const [dragOver, setDragOver] = useState(false);
    const fileRef = useRef(null);

    const clientFilter = params.get('client') || '';
    const matterFilter = params.get('matter') || '';
    const setFilter = (k, v) => { const p = new URLSearchParams(params); v ? p.set(k, v) : p.delete(k); if (k === 'client') p.delete('matter'); setParams(p); };

    const loadDocs = async () => {
        const q = new URLSearchParams();
        if (clientFilter) q.set('client_id', clientFilter);
        if (matterFilter) q.set('matter_id', matterFilter);
        if (category) q.set('category', category);
        if (search.trim()) q.set('search', search.trim());
        try { setDocs(await apiJson(`/api/v1/vault/documents?${q}`)); } catch (e) { setError(e.message); }
    };
    const loadMeta = async () => {
        try {
            const [c, f, s] = await Promise.all([apiJson('/api/v1/clients'), apiJson('/api/v1/firm'), apiJson('/api/v1/vault/stats')]);
            setClients(c); setFirm(f); setStats(s);
        } catch (e) { setError(e.message); }
    };
    useEffect(() => { loadMeta(); }, []);
    useEffect(() => { const timer = setTimeout(loadDocs, 200); return () => clearTimeout(timer); }, [clientFilter, matterFilter, category, search]);
    useEffect(() => { if (tab === 'activity') apiJson('/api/v1/vault/audit').then(setAudit).catch(e => setError(e.message)); }, [tab]);

    const mattersOf = (cid) => clients.find(c => String(c.id) === String(cid))?.matters || [];
    const openUpload = (file) => setUpload({ file, title: file ? file.name.replace(/\.[^.]+$/, '') : '', category: 'other', client_id: clientFilter, matter_id: matterFilter, description: '' });

    const doUpload = async () => {
        if (!upload?.file) return;
        if (upload.file.size > 25 * 1024 * 1024) { setError(t('File is larger than 25 MB.')); return; }
        setBusy(true); setError('');
        const form = new FormData();
        form.append('file', upload.file);
        form.append('title', upload.title);
        form.append('category', upload.category);
        if (upload.description) form.append('description', upload.description);
        if (upload.matter_id) form.append('matter_id', upload.matter_id);
        else if (upload.client_id) form.append('client_id', upload.client_id);
        try { await apiJson('/api/v1/vault/documents', { method: 'POST', body: form }); setUpload(null); loadDocs(); loadMeta(); }
        catch (e) { setError(e.message); } finally { setBusy(false); }
    };
    const view = async (d) => {
        const win = window.open('', '_blank');   // open synchronously so pop-up blockers allow it
        try {
            const blob = await apiBlob(`/api/v1/vault/documents/${d.id}/file?inline=true`);
            const url = URL.createObjectURL(blob);
            if (win) win.location.href = url; else saveBlob(blob, d.original_filename);
            setTimeout(() => URL.revokeObjectURL(url), 60_000);
        } catch (e) { win?.close(); setError(e.message); }
    };
    const download = async (d) => {
        try { saveBlob(await apiBlob(`/api/v1/vault/documents/${d.id}/file`), d.original_filename); }
        catch (e) { setError(e.message); }
    };
    const saveEdit = async () => {
        setBusy(true); setError('');
        try {
            const { id, title, category: cat, description, client_id, matter_id } = edit;
            await apiJson(`/api/v1/vault/documents/${id}`, { method: 'PUT', body: { title, category: cat, description, client_id: client_id ? Number(client_id) : null, matter_id: matter_id ? Number(matter_id) : null } });
            setEdit(null); loadDocs();
        } catch (e) { setError(e.message); } finally { setBusy(false); }
    };
    const remove = async (d) => {
        if (!confirm(t('Permanently delete "{title}" from the vault?', { title: d.title }))) return;
        try { await apiJson(`/api/v1/vault/documents/${d.id}`, { method: 'DELETE' }); loadDocs(); loadMeta(); }
        catch (e) { setError(e.message); }
    };
    const canDelete = (d) => firm && (firm.can_approve || d.uploaded_by === firm.my_user_id);
    const totalShown = useMemo(() => docs.reduce((n, d) => n + d.size_bytes, 0), [docs]);

    const tabs = [
        { value: 'documents', label: <span className="flex items-center gap-1.5"><FileText size={14} />{t('Documents')}</span> },
        ...(firm?.can_approve ? [{ value: 'activity', label: <span className="flex items-center gap-1.5"><History size={14} />{t('Activity log')}</span> }] : []),
    ];

    return (
        <div className="relative flex-1 flex flex-col h-full overflow-hidden bg-paper-100"
            onDragOver={e => { e.preventDefault(); setDragOver(true); }} onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(false); }}
            onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) openUpload(f); }}>
            <PageHeader icon={FolderLock} title={t('Secure Document Vault')}
                subtitle={t('Petitions, orders, evidence — encrypted, shared with your firm, every access logged')}>
                <input ref={fileRef} type="file" accept={ACCEPT} className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) openUpload(f); e.target.value = ''; }} />
                <Button icon={Upload} onClick={() => fileRef.current?.click()}>{t('Upload')}</Button>
            </PageHeader>

            <div className="flex-1 overflow-y-auto">
                <div className="max-w-6xl mx-auto px-6 lg:px-8 py-6 space-y-5">
                    <Alert onClose={() => setError('')}>{error}</Alert>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <StatCard label={t('Documents')} value={stats?.document_count ?? '—'} icon={FileText} />
                        <StatCard label={t('Storage used')} value={stats ? <span className="ltr inline-block">{formatBytes(stats.total_bytes)}</span> : '—'} icon={HardDrive} />
                        <StatCard label={t('Encryption')} value="AES-256" sub={t('encrypted before storage')} tone="green" icon={Lock} />
                        <StatCard label={t('Stored on')} value={stats ? (stats.storage_backend === 's3' ? t('Cloud') : stats.storage_backend === 'local' ? t('Server disk') : t('Not set')) : '—'}
                            sub={stats?.storage_backend === 's3' ? t('S3-compatible (R2 / S3)') : t('development mode')} tone="indigo" icon={ShieldCheck} />
                    </div>

                    <Tabs value={tab} onChange={setTab} options={tabs} />

                    {tab === 'documents' ? (<>
                        <div className="flex flex-wrap gap-2.5">
                            <div className="relative flex-1 min-w-[220px]">
                                <Search size={15} className="absolute start-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('Search titles and file names…')} className={`${inputClass} ps-10`} />
                            </div>
                            <select value={clientFilter} onChange={e => setFilter('client', e.target.value)} aria-label={t('Client')} className={`${controlClass} w-48`}>
                                <option value="">{t('All clients')}</option>
                                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                            <select value={matterFilter} onChange={e => setFilter('matter', e.target.value)} disabled={!clientFilter} aria-label={t('Case')} className={`${controlClass} w-48 disabled:opacity-50`}>
                                <option value="">{t('All cases')}</option>
                                {mattersOf(clientFilter).map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
                            </select>
                            <select value={category} onChange={e => setCategory(e.target.value)} aria-label={t('Category')} className={`${controlClass} w-44`}>
                                <option value="">{t('All categories')}</option>
                                {CATEGORIES.map(([v, l]) => <option key={v} value={v}>{t(l)}</option>)}
                            </select>
                        </div>

                        {docs.length === 0 ? (
                            <Card>
                                <EmptyState icon={FolderLock} title={stats?.document_count ? t('No documents match these filters') : t('Your vault is empty')}
                                    text={t('Upload petitions, orders, evidence and correspondence. Files are encrypted before they are stored and only your firm can open them.')}
                                    action={<Button icon={Upload} onClick={() => fileRef.current?.click()}>{t('Upload a document')}</Button>} />
                            </Card>
                        ) : (
                            <Card className="overflow-hidden">
                                <div className="flex items-center justify-between gap-3 px-5 h-11 border-b border-line bg-paper-50 text-[12px] text-slate-500">
                                    <span>{docs.length === 1 ? t('1 document') : t('{n} documents', { n: docs.length })} · <span className="ltr inline-block">{formatBytes(totalShown)}</span></span>
                                    <span className="flex items-center gap-1.5 text-emerald-700 font-medium"><Lock size={12} />{t('Encrypted at rest')}</span>
                                </div>
                                <div className="divide-y divide-line">
                                    {docs.map(d => {
                                        const { Icon, tint, label } = fileKind(d.content_type, d.original_filename);
                                        return (
                                            <div key={d.id} className="group flex items-center gap-4 px-5 py-3.5 hover:bg-paper-50/70 transition-colors">
                                                <div className={`relative w-11 h-11 rounded-xl ring-1 flex items-center justify-center flex-shrink-0 ${tint}`}>
                                                    <Icon size={19} />
                                                    <span className="absolute -bottom-1.5 inset-x-0 mx-auto w-fit px-1 rounded bg-white ring-1 ring-line text-[8.5px] font-bold tracking-wide text-slate-500 ltr">{label}</span>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <button onClick={() => view(d)} className="text-[14px] font-semibold text-ink-950 truncate hover:text-gold-700 text-start transition-colors">{d.title}</button>
                                                        <span className="px-2 h-[20px] inline-flex items-center rounded-full bg-paper-200 ring-1 ring-inset ring-line text-slate-600 text-[10.5px] font-semibold flex-shrink-0">{CAT_LABEL[d.category] ? t(CAT_LABEL[d.category]) : d.category}</span>
                                                    </div>
                                                    <div className="flex flex-wrap items-center gap-x-2 text-[12px] text-slate-500 mt-1">
                                                        {d.client_name && <><span className="font-medium text-slate-600">{d.client_name}{d.matter_title ? ` · ${d.matter_title}` : ''}</span><span className="text-slate-300">·</span></>}
                                                        <span className="ltr inline-block">{formatBytes(d.size_bytes)}</span>
                                                        <span className="text-slate-300">·</span>
                                                        <span>{d.uploaded_by_name ? t('{date} by {name}', { date: fmtDate(d.created_at), name: d.uploaded_by_name }) : fmtDate(d.created_at)}</span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
                                                    <Button size="sm" variant="ghost" icon={Eye} title={t('Open')} aria-label={t('Open')} onClick={() => view(d)} />
                                                    <Button size="sm" variant="ghost" icon={Download} title={t('Download')} aria-label={t('Download')} onClick={() => download(d)} />
                                                    <Button size="sm" variant="ghost" icon={Edit3} title={t('Edit details')} aria-label={t('Edit details')} onClick={() => setEdit({ ...d, client_id: d.client_id || '', matter_id: d.matter_id || '', description: d.description || '' })} />
                                                    {canDelete(d) && <Button size="sm" variant="ghost" icon={Trash2} title={t('Delete')} aria-label={t('Delete')} onClick={() => remove(d)} className="hover:!text-red-600 hover:!bg-red-50" />}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </Card>
                        )}
                    </>) : (
                        <Card className="overflow-hidden">
                            {!audit.length ? (
                                <EmptyState icon={History} title={t('No activity yet.')} text={t('Every upload, view, download, edit and deletion is recorded here.')} />
                            ) : (
                                <ol className="px-5 py-4">
                                    {audit.map((a, i) => {
                                        const [AIcon, look] = ACTION_LOOK[a.action] || [History, 'bg-paper-200 text-slate-600 ring-line'];
                                        return (
                                            <li key={a.id} className="relative flex gap-4 pb-5 last:pb-0">
                                                {i < audit.length - 1 && <span aria-hidden className="absolute start-[17px] top-10 bottom-0 w-px bg-line" />}
                                                <span className={`relative w-9 h-9 rounded-full ring-1 flex items-center justify-center flex-shrink-0 ${look}`}><AIcon size={15} /></span>
                                                <div className="flex-1 min-w-0 pt-1">
                                                    <div className="text-[13.5px] text-ink-900">
                                                        <span className="font-semibold">{a.user_name || '—'}</span>
                                                        <span className="mx-1.5 inline-flex items-center px-2 h-[20px] rounded-full bg-paper-200 text-[11px] font-semibold text-slate-600 capitalize">{t(a.action)}</span>
                                                        <span className="text-slate-700">{a.document_title || '—'}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-[12px] text-slate-400 mt-1">
                                                        <span>{new Date(a.created_at).toLocaleString(lang === 'ur' ? 'ur-PK' : 'en-GB')}</span>
                                                        {a.ip_address && <><span>·</span><span className="font-mono ltr">IP {a.ip_address}</span></>}
                                                    </div>
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ol>
                            )}
                        </Card>
                    )}
                </div>
            </div>

            {dragOver && (
                <div className="pointer-events-none absolute inset-3 z-20 rounded-3xl border-2 border-dashed border-gold-500 bg-paper-50/90 backdrop-blur-sm flex flex-col items-center justify-center gap-3 animate-fade-in">
                    <span className="w-16 h-16 rounded-2xl bg-ink-gradient flex items-center justify-center shadow-lift"><UploadCloud size={28} className="text-gold-300" /></span>
                    <span className="page-title text-[20px] text-ink-950">{t('Drop the file to upload it to the vault')}</span>
                    <span className="flex items-center gap-1.5 text-[13px] text-emerald-700"><Lock size={13} />{t('Encrypted with AES-256 before it leaves the server.')}</span>
                </div>
            )}

            {upload && (
                <Modal title={t('Upload to vault')} onClose={() => setUpload(null)} footer={<>
                    <Button variant="secondary" onClick={() => setUpload(null)}>{t('Cancel')}</Button>
                    <Button icon={Lock} loading={busy} disabled={!upload.file} onClick={doUpload}>{t('Encrypt & upload')}</Button></>}>
                    <div className="space-y-4">
                        <Field label={t('File')} hint={t('PDF, Word, Excel, JPG, PNG or TXT · up to 25 MB')}>
                            <input type="file" accept={ACCEPT} onChange={e => { const f = e.target.files?.[0]; if (f) setUpload(u => ({ ...u, file: f, title: u.title || f.name.replace(/\.[^.]+$/, '') })); }}
                                className="block w-full text-sm text-slate-600 file:me-3 file:h-9 file:px-3.5 file:rounded-lg file:border-0 file:bg-ink-900 file:text-white file:font-semibold file:cursor-pointer hover:file:bg-ink-800 p-1.5 rounded-xl border border-dashed border-line-strong bg-paper-50" />
                            {upload.file && <span className="block text-[12px] text-slate-500 mt-1.5">{upload.file.name} · <span className="ltr inline-block">{formatBytes(upload.file.size)}</span></span>}
                        </Field>
                        <Field label={t('Title')}><input value={upload.title} onChange={e => setUpload(u => ({ ...u, title: e.target.value }))} className={inputClass} /></Field>
                        <Field label={t('Category')}>
                            <select value={upload.category} onChange={e => setUpload(u => ({ ...u, category: e.target.value }))} className={inputClass}>
                                {CATEGORIES.map(([v, l]) => <option key={v} value={v}>{t(l)}</option>)}
                            </select>
                        </Field>
                        <div className="grid grid-cols-2 gap-3">
                            <Field label={t('Client')}>
                                <select value={upload.client_id} onChange={e => setUpload(u => ({ ...u, client_id: e.target.value, matter_id: '' }))} className={inputClass}>
                                    <option value="">{t('— none —')}</option>
                                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </Field>
                            <Field label={t('Case')}>
                                <select value={upload.matter_id} onChange={e => setUpload(u => ({ ...u, matter_id: e.target.value }))} disabled={!upload.client_id} className={`${inputClass} disabled:opacity-50`}>
                                    <option value="">{t('— none —')}</option>
                                    {mattersOf(upload.client_id).map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
                                </select>
                            </Field>
                        </div>
                        <Field label={t('Description')}><textarea rows={2} value={upload.description} onChange={e => setUpload(u => ({ ...u, description: e.target.value }))} className={textareaClass} /></Field>
                        <p className="flex items-center gap-2 text-[12px] text-emerald-800 px-3 py-2.5 rounded-xl bg-emerald-50/70 border border-emerald-100"><Lock size={13} className="flex-shrink-0" />{t('Encrypted with AES-256 before it leaves the server.')}</p>
                    </div>
                </Modal>
            )}
            {edit && (
                <Modal title={t('Document details')} onClose={() => setEdit(null)} footer={<>
                    <Button variant="secondary" onClick={() => setEdit(null)}>{t('Cancel')}</Button>
                    <Button loading={busy} disabled={!edit.title.trim()} onClick={saveEdit}>{t('Save')}</Button></>}>
                    <div className="space-y-4">
                        <Field label={t('Title')}><input value={edit.title} onChange={e => setEdit(d => ({ ...d, title: e.target.value }))} className={inputClass} /></Field>
                        <Field label={t('Category')}>
                            <select value={edit.category} onChange={e => setEdit(d => ({ ...d, category: e.target.value }))} className={inputClass}>
                                {CATEGORIES.map(([v, l]) => <option key={v} value={v}>{t(l)}</option>)}
                            </select>
                        </Field>
                        <div className="grid grid-cols-2 gap-3">
                            <Field label={t('Client')}>
                                <select value={edit.client_id} onChange={e => setEdit(d => ({ ...d, client_id: e.target.value, matter_id: '' }))} className={inputClass}>
                                    <option value="">{t('— none —')}</option>
                                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </Field>
                            <Field label={t('Case')}>
                                <select value={edit.matter_id} onChange={e => setEdit(d => ({ ...d, matter_id: e.target.value }))} disabled={!edit.client_id} className={`${inputClass} disabled:opacity-50`}>
                                    <option value="">{t('— none —')}</option>
                                    {mattersOf(edit.client_id).map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
                                </select>
                            </Field>
                        </div>
                        <Field label={t('Description')}><textarea rows={2} value={edit.description} onChange={e => setEdit(d => ({ ...d, description: e.target.value }))} className={textareaClass} /></Field>
                        <div className="text-[12px] text-slate-500 px-3 py-2.5 rounded-xl bg-paper-50 border border-line break-all">
                            {t('File: {name}', { name: edit.original_filename })}
                            <span className="block mt-1 font-mono text-[11px] text-slate-400 ltr">SHA-256 {edit.sha256.slice(0, 16)}…</span>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
}
