import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Users, Plus, Search, Phone, Mail, Briefcase, FolderLock, Wallet, Edit3, Trash2, FileDown, ChevronRight, CreditCard, MapPin, Landmark, Hash, FileText, Share2, X, Send, CheckCircle2 } from 'lucide-react';
import { apiJson, apiBlob, saveBlob, formatPKR, formatDate } from '../api';
import { PageHeader, Button, Modal, Field, inputClass, textareaClass, Badge, Alert, EmptyState, Card } from '../components/ui';
import { useI18n } from '../i18n';
import CaseWizard from '../components/CaseWizard';

const emptyClient = { name: '', phone: '', email: '', cnic: '', address: '', notes: '' };
const initials = (name) => (name || '?').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

export default function ClientsPage() {
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const { t, lang } = useI18n();
    const fmtDate = (d) => (lang === 'ur' && d) ? new Date(d).toLocaleDateString('ur-PK', { day: 'numeric', month: 'short', year: 'numeric' }) : formatDate(d);
    const [clients, setClients] = useState([]);
    const [firm, setFirm] = useState(null);
    const [search, setSearch] = useState('');
    const [selectedId, setSelectedId] = useState(null);
    const [error, setError] = useState('');
    const [clientForm, setClientForm] = useState(null);   // {id?, ...fields}
    const [matterForm, setMatterForm] = useState(null);   // null | {} new case | {...matter} edit
    const [busy, setBusy] = useState(false);
    const [shareFor, setShareFor] = useState(null);     // matter being shared with its client

    const load = async () => {
        try {
            const [c, f] = await Promise.all([apiJson('/api/v1/clients'), apiJson('/api/v1/firm')]);
            setClients(c); setFirm(f);
            const wanted = Number(params.get('client'));
            if (!selectedId && c.length) setSelectedId(wanted && c.some(x => x.id === wanted) ? wanted : c[0].id);
            const share = Number(params.get('share'));
            if (share) setShareFor(c.flatMap(x => x.matters).find(m => m.id === share) || null);
        } catch (e) { setError(e.message); }
    };
    useEffect(() => { load(); }, []);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return !q ? clients : clients.filter(c => [c.name, c.phone, c.email, c.cnic].some(v => (v || '').toLowerCase().includes(q))
            || c.matters.some(m => [m.title, m.case_number].some(v => (v || '').toLowerCase().includes(q))));
    }, [clients, search]);
    const selected = clients.find(c => c.id === selectedId);

    const saveClient = async () => {
        setBusy(true); setError('');
        try {
            const { id, ...body } = clientForm;
            const saved = await apiJson(id ? `/api/v1/clients/${id}` : '/api/v1/clients', { method: id ? 'PUT' : 'POST', body });
            setClientForm(null); await load(); setSelectedId(saved.id);
        } catch (e) { setError(e.message); } finally { setBusy(false); }
    };
    const removeClient = async (c) => {
        if (!confirm(t('Delete client "{name}"? This cannot be undone.', { name: c.name }))) return;
        try { await apiJson(`/api/v1/clients/${c.id}`, { method: 'DELETE' }); setSelectedId(null); await load(); }
        catch (e) { setError(e.message); }
    };
    const removeMatter = async (m) => {
        if (!confirm(t('Delete case "{title}"?', { title: m.title }))) return;
        try { await apiJson(`/api/v1/matters/${m.id}`, { method: 'DELETE' }); await load(); }
        catch (e) { setError(e.message); }
    };
    const statement = async (c) => {
        try { saveBlob(await apiBlob(`/api/v1/billing/statement/${c.id}.pdf`), `Statement-${c.name}.pdf`); }
        catch (e) { setError(e.message); }
    };

    const balanceText = (b) => Number(b) > 0 ? t('{amount} due', { amount: formatPKR(b) }) : Number(b) < 0 ? t('{amount} advance', { amount: formatPKR(b) }) : t('Settled');
    const balanceTone = (b) => Number(b) > 0 ? 'text-red-600' : Number(b) < 0 ? 'text-emerald-600' : 'text-slate-400';

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-paper-100">
            <PageHeader icon={Users} title={t('Clients & Cases')}
                subtitle={[clients.length === 1 ? t('1 client') : t('{n} clients', { n: clients.length }),
                    t('{n} cases', { n: clients.reduce((n, c) => n + c.matters.length, 0) }), firm?.name].filter(Boolean).join(' · ')}>
                <Button icon={Plus} onClick={() => setClientForm({ ...emptyClient })}>{t('New client')}</Button>
            </PageHeader>

            <div className="flex-1 flex overflow-hidden">
                {/* list */}
                <aside className="w-[320px] border-e border-line bg-white flex flex-col flex-shrink-0">
                    <div className="p-4 border-b border-line">
                        <div className="relative">
                            <Search size={15} className="absolute start-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                            <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('Search clients or cases…')} className={`${inputClass} ps-10 bg-paper-50`} />
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2.5 space-y-0.5">
                        {filtered.map(c => {
                            const on = selectedId === c.id;
                            return (
                                <button key={c.id} onClick={() => setSelectedId(c.id)}
                                    className={`group relative w-full flex items-center gap-3 text-start p-3 rounded-xl transition-all ${on ? 'bg-amber-50/70 ring-1 ring-gold-400/40' : 'hover:bg-paper-50'}`}>
                                    {on && <span className="absolute start-0 top-3 bottom-3 w-[3px] rounded-e-full bg-gold-500" />}
                                    <span className={`w-10 h-10 rounded-full flex items-center justify-center text-[12px] font-bold flex-shrink-0 ${on ? 'bg-ink-900 text-gold-300' : 'bg-paper-200 text-ink-700 ring-1 ring-line'}`}>{initials(c.name)}</span>
                                    <span className="flex-1 min-w-0">
                                        <span className="block text-[14px] font-semibold text-ink-950 truncate">{c.name}</span>
                                        <span className="flex items-center gap-1.5 mt-0.5 text-[12px] text-slate-500">
                                            <span>{c.matters.length === 1 ? t('1 case') : t('{n} cases', { n: c.matters.length })}</span>
                                            <span className="text-slate-300">·</span>
                                            <span className={`font-semibold truncate ${balanceTone(c.balance)}`}>{balanceText(c.balance)}</span>
                                        </span>
                                    </span>
                                    <ChevronRight size={15} className={`flex-shrink-0 rtl:rotate-180 transition-colors ${on ? 'text-gold-600' : 'text-slate-300 group-hover:text-slate-400'}`} />
                                </button>
                            );
                        })}
                        {!filtered.length && <p className="text-center text-[13px] text-slate-400 py-10">{clients.length ? t('No matches.') : t('No clients yet.')}</p>}
                    </div>
                </aside>

                {/* detail */}
                <div className="flex-1 overflow-y-auto">
                    <div className="max-w-4xl mx-auto px-6 lg:px-8 py-6 space-y-5">
                        <Alert onClose={() => setError('')}>{error}</Alert>
                        {!selected ? (
                            <Card>
                                <EmptyState icon={Users} title={t('Add your first client')}
                                    text={t('Clients hold your cases. Documents in the vault and billing entries are filed against them.')}
                                    action={<Button icon={Plus} onClick={() => setClientForm({ ...emptyClient })}>{t('New client')}</Button>} />
                            </Card>
                        ) : (
                            <>
                                <Card className="overflow-hidden">
                                    <div className="relative px-6 pt-6 pb-5">
                                        <span aria-hidden className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-paper-200/70 to-transparent" />
                                        <div className="relative flex items-start justify-between gap-4">
                                            <div className="flex items-center gap-4 min-w-0">
                                                <span className="w-14 h-14 rounded-2xl bg-ink-gradient text-gold-300 text-[18px] font-bold flex items-center justify-center flex-shrink-0 shadow-[0_8px_20px_-8px_rgba(11,18,32,0.55)]">{initials(selected.name)}</span>
                                                <div className="min-w-0">
                                                    <h2 className="page-title text-[24px] leading-tight text-ink-950 truncate">{selected.name}</h2>
                                                    <p className="text-[13px] text-slate-500 mt-0.5">{t('Client since {date}', { date: fmtDate(selected.created_at) })}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1.5 flex-shrink-0">
                                                <Button variant="secondary" size="sm" icon={FileDown} onClick={() => statement(selected)}>{t('Statement PDF')}</Button>
                                                <Button variant="secondary" size="sm" icon={Edit3} onClick={() => setClientForm({ ...emptyClient, ...Object.fromEntries(Object.entries(selected).map(([k, v]) => [k, v ?? ''])), id: selected.id })}>{t('Edit')}</Button>
                                                {firm?.can_approve && <Button variant="ghost" size="sm" icon={Trash2} title={t('Delete')} aria-label={t('Delete')} onClick={() => removeClient(selected)} className="hover:!text-red-600 hover:!bg-red-50" />}
                                            </div>
                                        </div>

                                        {(selected.phone || selected.email || selected.cnic || selected.address) && (
                                            <div className="relative grid sm:grid-cols-2 gap-2 mt-5">
                                                {[[Phone, selected.phone, true], [Mail, selected.email, true], [CreditCard, selected.cnic, true], [MapPin, selected.address, false]].filter(([, v]) => v).map(([Icon, v, ltr], i) => (
                                                    <span key={i} className="flex items-center gap-2.5 px-3 h-10 rounded-xl bg-paper-50 border border-line text-[13.5px] text-ink-900 min-w-0">
                                                        <Icon size={15} className="text-gold-600 flex-shrink-0" />
                                                        <span className={`truncate ${ltr ? 'ltr' : ''}`}>{v}</span>
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                        {selected.notes && <p dir="auto" className="relative mt-4 text-[13.5px] leading-relaxed text-slate-600 whitespace-pre-wrap ps-3 border-s-2 border-gold-400/60">{selected.notes}</p>}
                                    </div>

                                    <div className="grid grid-cols-3 border-t border-line divide-x divide-line rtl:divide-x-reverse">
                                        <div className="px-5 py-4">
                                            <div className="text-[12px] font-medium text-slate-500">{t('Balance')}</div>
                                            <div className={`text-[20px] font-semibold tabular-nums mt-1 ${Number(selected.balance) > 0 ? 'text-red-600' : 'text-emerald-600'}`}><span className="ltr inline-block">{formatPKR(selected.balance)}</span></div>
                                            <div className="text-[12px] text-slate-400 mt-0.5">{Number(selected.balance) > 0 ? t('due from client') : Number(selected.balance) < 0 ? t('advance held') : t('settled')}</div>
                                        </div>
                                        <button onClick={() => navigate(`/vault?client=${selected.id}`)} className="group px-5 py-4 text-start hover:bg-paper-50 transition-colors">
                                            <div className="text-[12px] font-medium text-slate-500 flex items-center gap-1.5"><FolderLock size={13} className="text-gold-600" />{t('Vault')}</div>
                                            <div className="text-[20px] font-semibold text-ink-950 tabular-nums mt-1">{selected.document_count}</div>
                                            <div className="text-[12px] text-slate-400 mt-0.5 flex items-center gap-1 group-hover:text-ink-700">{t('documents')} <ChevronRight size={12} className="rtl:rotate-180" /></div>
                                        </button>
                                        <button onClick={() => navigate(`/billing?client=${selected.id}`)} className="group px-5 py-4 text-start hover:bg-paper-50 transition-colors">
                                            <div className="text-[12px] font-medium text-slate-500 flex items-center gap-1.5"><Wallet size={13} className="text-gold-600" />{t('Billing')}</div>
                                            <div className="text-[20px] font-semibold text-ink-950 mt-1">{t('Ledger')}</div>
                                            <div className="text-[12px] text-slate-400 mt-0.5 flex items-center gap-1 group-hover:text-ink-700">{t('fees & payments')} <ChevronRight size={12} className="rtl:rotate-180" /></div>
                                        </button>
                                    </div>
                                </Card>

                                <div className="flex items-center justify-between pt-1">
                                    <h3 className="flex items-center gap-2.5 text-[15px] font-semibold text-ink-950">
                                        <span className="w-7 h-7 rounded-lg bg-paper-200 text-ink-700 flex items-center justify-center"><Briefcase size={15} /></span>
                                        {t('Cases')}
                                        <span className="px-2 h-[22px] inline-flex items-center rounded-full bg-paper-200 text-[11.5px] font-semibold text-slate-600 tabular-nums">{selected.matters.length}</span>
                                    </h3>
                                    <Button variant="secondary" size="sm" icon={Plus} onClick={() => setMatterForm({ client_id: selected.id })}>{t('Add case')}</Button>
                                </div>
                                {selected.matters.length === 0 && (
                                    <div className="px-5 py-8 rounded-2xl border border-dashed border-line-strong text-center text-[13.5px] text-slate-500">{t('No cases yet for this client.')}</div>
                                )}
                                <div className="space-y-3">
                                    {selected.matters.map(m => (
                                        <Card key={m.id} className="group p-5 hover:shadow-lift hover:border-line-strong transition-all">
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2.5 flex-wrap">
                                                        <span className="font-semibold text-[15px] text-ink-950">{m.title}</span>
                                                        <Badge value={m.status} />
                                                    </div>
                                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-[12.5px] text-slate-500">
                                                        {m.case_number && <span className="flex items-center gap-1.5"><Hash size={13} className="text-slate-400" /><span className="font-mono ltr">{m.case_number}</span></span>}
                                                        {m.court && <span className="flex items-center gap-1.5"><Landmark size={13} className="text-slate-400" />{m.court}</span>}
                                                        <span className="flex items-center gap-1.5"><FileText size={13} className="text-slate-400" />{m.document_count === 1 ? t('1 document') : t('{n} documents', { n: m.document_count })}</span>
                                                    </div>
                                                    {m.description && <p dir="auto" className="text-[13px] leading-relaxed text-slate-500 mt-2.5 line-clamp-2">{m.description}</p>}
                                                </div>
                                                <div className="flex gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                                    <Button size="sm" variant="ghost" icon={Share2} title={t('Share with client')} aria-label={t('Share with client')} onClick={() => setShareFor(m)} />
                                                    <Button size="sm" variant="ghost" icon={FolderLock} title={t('Vault')} aria-label={t('Vault')} onClick={() => navigate(`/vault?client=${selected.id}&matter=${m.id}`)} />
                                                    <Button size="sm" variant="ghost" icon={Edit3} title={t('Edit')} aria-label={t('Edit')} onClick={() => setMatterForm(m)} />
                                                    {firm?.can_approve && <Button size="sm" variant="ghost" icon={Trash2} title={t('Delete')} aria-label={t('Delete')} onClick={() => removeMatter(m)} className="hover:!text-red-600 hover:!bg-red-50" />}
                                                </div>
                                            </div>
                                        </Card>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {clientForm && (
                <Modal title={clientForm.id ? t('Edit client') : t('New client')} onClose={() => setClientForm(null)} footer={<>
                    <Button variant="secondary" onClick={() => setClientForm(null)}>{t('Cancel')}</Button>
                    <Button loading={busy} disabled={!clientForm.name.trim()} onClick={saveClient}>{t('Save')}</Button></>}>
                    <div className="space-y-4">
                        <Field label={t('Full name *')}><input autoFocus value={clientForm.name} onChange={e => setClientForm(f => ({ ...f, name: e.target.value }))} className={inputClass} /></Field>
                        <div className="grid grid-cols-2 gap-3">
                            <Field label={t('Phone')}><input type="tel" value={clientForm.phone} onChange={e => setClientForm(f => ({ ...f, phone: e.target.value }))} placeholder="03XXXXXXXXX" className={inputClass} /></Field>
                            <Field label={t('CNIC')}><input value={clientForm.cnic} onChange={e => setClientForm(f => ({ ...f, cnic: e.target.value }))} placeholder="35202-1234567-1" className={`${inputClass} ltr`} /></Field>
                        </div>
                        <Field label={t('Email')}><input type="email" value={clientForm.email} onChange={e => setClientForm(f => ({ ...f, email: e.target.value }))} className={inputClass} /></Field>
                        <Field label={t('Address')}><input value={clientForm.address} onChange={e => setClientForm(f => ({ ...f, address: e.target.value }))} className={inputClass} /></Field>
                        <Field label={t('Notes')}><textarea rows={3} value={clientForm.notes} onChange={e => setClientForm(f => ({ ...f, notes: e.target.value }))} className={textareaClass} /></Field>
                    </div>
                </Modal>
            )}
            {shareFor && <ShareModal matter={shareFor} client={selected} onClose={() => setShareFor(null)} />}
            {matterForm && <CaseWizard initial={matterForm} clients={clients} firm={firm} onClose={() => setMatterForm(null)} onSaved={async () => { setMatterForm(null); await load(); }} />}
        </div>
    );
}

/* Share a case with the client: they sign in to the client portal with this email
   (one-time code) and see the case's hearings, approved fees and receipts. */
function ShareModal({ matter, client, onClose }) {
    const { t, lang } = useI18n();
    const [shares, setShares] = useState(null);
    const [email, setEmail] = useState(client?.email || '');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [done, setDone] = useState('');
    const load = () => apiJson(`/api/v1/matters/${matter.id}/shares`).then(setShares).catch(e => setError(e.message));
    useEffect(() => { load(); }, [matter.id]); // eslint-disable-line react-hooks/exhaustive-deps
    const share = async (e) => {
        e.preventDefault(); setBusy(true); setError(''); setDone('');
        try { await apiJson(`/api/v1/matters/${matter.id}/shares`, { method: 'POST', body: { email: email.trim() } }); setDone(t('Shared. We emailed {email} a link to the client portal.', { email: email.trim() })); await load(); }
        catch (err) { setError(err.message); } finally { setBusy(false); }
    };
    const revoke = async (id) => {
        if (!window.confirm(t('Remove this client’s access to the case?'))) return;
        try { await apiJson(`/api/v1/shares/${id}`, { method: 'DELETE' }); await load(); } catch (err) { setError(err.message); }
    };
    const fmt = (d) => new Date(d).toLocaleDateString(lang === 'ur' ? 'ur-PK' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    return (
        <Modal title={t('Share with client')} onClose={onClose} footer={<Button variant="secondary" onClick={onClose}>{t('Close')}</Button>}>
            <div className="space-y-5">
                <div className="px-4 py-3 rounded-xl bg-paper-100 ring-1 ring-line">
                    <div className="text-[14px] font-semibold text-ink-950">{matter.title}</div>
                    <div className="text-[12.5px] text-slate-500 mt-0.5">{client?.name}{matter.case_number ? <> · <span className="font-mono ltr">{matter.case_number}</span></> : null}</div>
                </div>
                <p className="text-[13.5px] text-slate-600 leading-relaxed">{t('The client signs in at the client portal with this email and a one-time code — no password. They see the hearing dates, approved fees and payments of this case only.')}</p>
                <Alert tone="error" onClose={() => setError('')}>{error}</Alert>
                <Alert tone="success" onClose={() => setDone('')}>{done}</Alert>
                <form onSubmit={share} className="flex gap-2">
                    <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="client@example.com" className={`${inputClass} ltr`} />
                    <Button type="submit" icon={Send} loading={busy} disabled={!email.trim()}>{t('Share')}</Button>
                </form>
                <div>
                    <div className="text-[12.5px] font-semibold text-ink-800 mb-2">{t('Who can see this case')}</div>
                    {shares === null ? <div className="text-[13px] text-slate-400">{t('Loading…')}</div>
                        : shares.length === 0 ? <div className="px-4 py-5 rounded-xl border border-dashed border-line-strong text-center text-[13px] text-slate-500">{t('Not shared with anyone yet.')}</div>
                        : (
                            <ul className="divide-y divide-line rounded-xl ring-1 ring-line overflow-hidden">
                                {shares.map(s => (
                                    <li key={s.id} className="flex items-center gap-3 px-4 py-3 bg-white">
                                        <span className="w-8 h-8 rounded-full bg-emerald-50 ring-1 ring-emerald-200 flex items-center justify-center flex-shrink-0"><CheckCircle2 size={15} className="text-emerald-600" /></span>
                                        <div className="min-w-0 flex-1"><div className="text-[13.5px] font-medium text-ink-950 truncate ltr text-start">{s.client_email}</div><div className="text-[12px] text-slate-500">{t('Shared {date}', { date: fmt(s.created_at) })}{s.shared_by_name ? ` · ${s.shared_by_name}` : ''}</div></div>
                                        <Button size="sm" variant="ghost" icon={X} title={t('Remove access')} aria-label={t('Remove access')} onClick={() => revoke(s.id)} className="hover:!text-red-600 hover:!bg-red-50" />
                                    </li>
                                ))}
                            </ul>
                        )}
                </div>
            </div>
        </Modal>
    );
}
