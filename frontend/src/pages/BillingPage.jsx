import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Wallet, Plus, CheckCircle2, XCircle, Ban, Edit3, Trash2, FileDown, Clock, TrendingUp, Receipt, ShieldCheck, Users, Scale, Landmark, Banknote, FileText } from 'lucide-react';
import { apiJson, apiBlob, saveBlob, formatPKR, formatDate } from '../api';
import { PageHeader, Button, Modal, Field, inputClass, controlClass, Badge, Alert, EmptyState, StatCard, ReasonModal, Card, CardHeader, Tabs } from '../components/ui';
import { useI18n } from '../i18n';

const TYPES = [['fee', 'Professional fee'], ['expense', 'Case expense'], ['payment', 'Payment received']];
const TYPE_ICON = { fee: Scale, expense: Landmark, payment: Banknote };
const METHODS = [['cash', 'Cash'], ['bank_transfer', 'Bank transfer'], ['cheque', 'Cheque'], ['online', 'Online / wallet'], ['other', 'Other']];
const today = () => new Date().toISOString().slice(0, 10);
const initials = (name) => (name || '?').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

export default function BillingPage() {
    const [params, setParams] = useSearchParams();
    const { t, lang } = useI18n();
    const fmtDate = (d) => (lang === 'ur' && d) ? new Date(d).toLocaleDateString('ur-PK', { day: 'numeric', month: 'short', year: 'numeric' }) : formatDate(d);
    const [entries, setEntries] = useState([]);
    const [summary, setSummary] = useState(null);
    const [clients, setClients] = useState([]);
    const [firm, setFirm] = useState(null);
    const [tab, setTab] = useState('all');
    const [status, setStatus] = useState('');
    const [type, setType] = useState('');
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [form, setForm] = useState(null);
    const [reason, setReason] = useState(null);     // {entry, action}
    const [busy, setBusy] = useState(false);
    const [stmt, setStmt] = useState({ client_id: '', date_from: '', date_to: '' });

    const clientFilter = params.get('client') || '';
    const setClientFilter = (v) => { const p = new URLSearchParams(params); v ? p.set('client', v) : p.delete('client'); setParams(p); };

    const loadEntries = async () => {
        const q = new URLSearchParams();
        if (clientFilter) q.set('client_id', clientFilter);
        if (tab === 'review') q.set('awaiting_me', 'true');
        else if (status) q.set('status', status);
        if (type) q.set('entry_type', type);
        try { setEntries(await apiJson(`/api/v1/billing/entries?${q}`)); } catch (e) { setError(e.message); }
    };
    const loadMeta = async () => {
        try {
            const [s, c, f] = await Promise.all([apiJson('/api/v1/billing/summary'), apiJson('/api/v1/clients'), apiJson('/api/v1/firm')]);
            setSummary(s); setClients(c); setFirm(f);
        } catch (e) { setError(e.message); }
    };
    const reload = () => { loadEntries(); loadMeta(); };
    useEffect(() => { loadMeta(); }, []);
    useEffect(() => { if (tab !== 'statements') loadEntries(); }, [clientFilter, status, type, tab]);
    useEffect(() => { if (clientFilter) setStmt(s => ({ ...s, client_id: clientFilter })); }, [clientFilter]);

    const mattersOf = (cid) => clients.find(c => String(c.id) === String(cid))?.matters || [];

    const save = async () => {
        setBusy(true); setError('');
        const { id, client_id, matter_id, entry_type, amount, entry_date, description, reference, payment_method, billable } = form;
        const body = { matter_id: matter_id ? Number(matter_id) : null, amount, entry_date, description, reference: reference || null,
            payment_method: entry_type === 'payment' ? (payment_method || null) : null, billable };
        try {
            if (id) await apiJson(`/api/v1/billing/entries/${id}`, { method: 'PUT', body });
            else await apiJson('/api/v1/billing/entries', { method: 'POST', body: { ...body, client_id: Number(client_id), entry_type } });
            setForm(null);
            setNotice(id ? t('Entry updated.') : t('Entry recorded. It counts once an owner or partner approves it.'));
            reload();
        } catch (e) { setError(e.message); } finally { setBusy(false); }
    };
    const act = async (entry, action, note) => {
        setError('');
        try {
            await apiJson(`/api/v1/billing/entries/${entry.id}/${action}`, { method: 'POST', body: note ? { note } : {} });
            setReason(null); reload();
        } catch (e) { setError(e.message); setReason(null); }
    };
    const remove = async (e) => {
        if (!confirm(t('Delete this pending entry?'))) return;
        try { await apiJson(`/api/v1/billing/entries/${e.id}`, { method: 'DELETE' }); reload(); } catch (err) { setError(err.message); }
    };
    const downloadStatement = async () => {
        const c = clients.find(x => String(x.id) === String(stmt.client_id));
        if (!c) return;
        const q = new URLSearchParams();
        if (stmt.date_from) q.set('date_from', stmt.date_from);
        if (stmt.date_to) q.set('date_to', stmt.date_to);
        try { saveBlob(await apiBlob(`/api/v1/billing/statement/${c.id}.pdf?${q}`), `Statement-${c.name}-${today()}.pdf`); }
        catch (e) { setError(e.message); }
    };

    const soloNeedsSetup = firm && firm.can_approve && firm.approver_count < 2 && !firm.allow_self_approval;
    const signed = (e) => e.entry_type === 'payment' ? `− ${formatPKR(e.amount)}` : formatPKR(e.amount);
    const newEntry = () => setForm({ client_id: clientFilter || clients[0]?.id || '', matter_id: '', entry_type: 'fee', amount: '', entry_date: today(), description: '', reference: '', payment_method: 'cash', billable: true });

    const tabs = [
        { value: 'all', label: t('All entries') },
        ...(firm?.can_approve ? [{ value: 'review', label: summary?.awaiting_my_review ? t('Awaiting my approval ({n})', { n: summary.awaiting_my_review }) : t('Awaiting my approval') }] : []),
        { value: 'statements', label: t('Statements') },
    ];
    const th = 'px-4 h-10 text-[11px] font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap';

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-paper-100">
            <PageHeader icon={Wallet} title={t('Billing & Financials')}
                subtitle={t('Fees, case expenses and client payments — with maker-checker approval')}>
                <Button icon={Plus} disabled={!clients.length} onClick={newEntry}>{t('New entry')}</Button>
            </PageHeader>

            <div className="flex-1 overflow-y-auto">
                <div className="max-w-6xl mx-auto px-6 lg:px-8 py-6 space-y-5">
                    <Alert onClose={() => setError('')}>{error}</Alert>
                    <Alert tone="success" onClose={() => setNotice('')}>{notice}</Alert>
                    {soloNeedsSetup && (
                        <Alert tone="warning">
                            {t('You are the only approver, and maker-checker stops anyone approving their own entries.')} <Link to="/team" className="font-semibold underline">{t('Invite a partner')}</Link>{t(', or allow self-approval for a solo practice in')} <Link to="/team" className="font-semibold underline">{t('Team settings')}</Link>{t('.')}
                        </Alert>
                    )}
                    {!clients.length && firm && (
                        <Card>
                            <EmptyState icon={Users} title={t('Add a client first')} text={t('Billing entries are recorded against a client.')} action={<Link to="/clients"><Button icon={Plus}>{t('Add client')}</Button></Link>} />
                        </Card>
                    )}

                    {summary && (
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            <StatCard label={t('Outstanding')} value={<span className="ltr inline-block">{formatPKR(summary.outstanding)}</span>} sub={t('owed by clients')} tone="red" icon={TrendingUp} />
                            <StatCard label={t('Received this month')} value={<span className="ltr inline-block">{formatPKR(summary.received_this_month)}</span>} sub={t('approved payments')} tone="green" icon={Receipt} />
                            <StatCard label={t('Pending approval')} value={summary.pending_count} sub={<span className="ltr inline-block">{formatPKR(summary.pending_amount)}</span>} tone="gold" icon={Clock} />
                            <StatCard label={t('Awaiting my review')} value={summary.awaiting_my_review} sub={firm?.can_approve ? t('you can approve these') : t('only owners/partners approve')} tone="indigo" icon={ShieldCheck} />
                        </div>
                    )}

                    <div className="flex flex-wrap items-center gap-3">
                        <Tabs value={tab} onChange={setTab} options={tabs} />
                        <div className="flex-1" />
                        {tab !== 'statements' && <>
                            <select value={clientFilter} onChange={e => setClientFilter(e.target.value)} aria-label={t('Client')} className={`${controlClass} w-48`}>
                                <option value="">{t('All clients')}</option>
                                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                            <select value={type} onChange={e => setType(e.target.value)} aria-label={t('Type')} className={`${controlClass} w-44`}>
                                <option value="">{t('All types')}</option>
                                {TYPES.map(([v, l]) => <option key={v} value={v}>{t(l)}</option>)}
                            </select>
                            {tab === 'all' && (
                                <select value={status} onChange={e => setStatus(e.target.value)} aria-label={t('Status')} className={`${controlClass} w-36`}>
                                    <option value="">{t('Any status')}</option>
                                    {['pending', 'approved', 'rejected', 'voided'].map(s => <option key={s} value={s}>{t(s)}</option>)}
                                </select>
                            )}
                        </>}
                    </div>

                    {tab === 'statements' ? (
                        <div className="grid lg:grid-cols-[1.1fr_1fr] gap-5 items-start">
                            <Card>
                                <CardHeader icon={FileText} title={t('Client statement (PDF)')} />
                                <div className="p-5 space-y-4">
                                    <Field label={t('Client')}>
                                        <select value={stmt.client_id} onChange={e => setStmt(s => ({ ...s, client_id: e.target.value }))} className={inputClass}>
                                            <option value="">{t('Choose a client…')}</option>
                                            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                    </Field>
                                    <div className="grid grid-cols-2 gap-3">
                                        <Field label={t('From (optional)')}><input type="date" value={stmt.date_from} onChange={e => setStmt(s => ({ ...s, date_from: e.target.value }))} className={inputClass} /></Field>
                                        <Field label={t('To (optional)')}><input type="date" value={stmt.date_to} onChange={e => setStmt(s => ({ ...s, date_to: e.target.value }))} className={inputClass} /></Field>
                                    </div>
                                    <Button icon={FileDown} disabled={!stmt.client_id} onClick={downloadStatement} className="w-full">{t('Download statement')}</Button>
                                    <p className="text-[12px] leading-relaxed text-slate-500 p-3 rounded-xl bg-paper-50 border border-line">{t('Includes approved entries only, with the opening balance carried forward when a start date is set. Internal (non-billable) expenses are never shown to the client.')}</p>
                                </div>
                            </Card>
                            <Card className="overflow-hidden">
                                <CardHeader icon={Users} title={t('Client balances')} />
                                <div className="divide-y divide-line max-h-[420px] overflow-y-auto">
                                    {clients.map(c => {
                                        const bal = Number(c.balance);
                                        return (
                                            <div key={c.id} className="flex items-center gap-3 px-5 py-3 hover:bg-paper-50 transition-colors">
                                                <span className="w-8 h-8 rounded-full bg-paper-200 ring-1 ring-line text-ink-700 text-[11px] font-bold flex items-center justify-center flex-shrink-0">{initials(c.name)}</span>
                                                <span className="flex-1 min-w-0 text-sm font-medium text-ink-950 truncate">{c.name}</span>
                                                <span className={`text-[13px] font-semibold tabular-nums whitespace-nowrap ${bal > 0 ? 'text-red-600' : bal < 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                                                    {bal > 0 ? t('{amount} due', { amount: formatPKR(c.balance) }) : bal < 0 ? t('{amount} advance', { amount: formatPKR(c.balance) }) : t('Settled')}
                                                </span>
                                            </div>
                                        );
                                    })}
                                    {!clients.length && <p className="px-5 py-10 text-center text-sm text-slate-400">{t('No clients yet.')}</p>}
                                </div>
                            </Card>
                        </div>
                    ) : entries.length === 0 ? (
                        clients.length > 0 && (
                            <Card>
                                <EmptyState icon={Receipt} title={tab === 'review' ? t('Nothing waiting for you') : t('No entries yet')}
                                    text={tab === 'review' ? t('Entries recorded by your team that need your approval will appear here.') : t('Record a fee, a case expense or a payment received.')}
                                    action={tab !== 'review' && <Button icon={Plus} onClick={newEntry}>{t('New entry')}</Button>} />
                            </Card>
                        )
                    ) : (
                        <Card className="overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm min-w-[900px]">
                                    <thead className="sticky top-0 z-[1] bg-paper-50 border-b border-line">
                                        <tr>
                                            <th className={`${th} text-start`}>{t('Date')}</th>
                                            <th className={`${th} text-start`}>{t('Client / case')}</th>
                                            <th className={`${th} text-start`}>{t('Details')}</th>
                                            <th className={`${th} text-end`}>{t('Amount')}</th>
                                            <th className={`${th} text-start`}>{t('Status')}</th>
                                            <th className={`${th} text-end`}>{t('Actions')}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-line">
                                        {entries.map(e => {
                                            return (
                                                <tr key={e.id} className="align-top hover:bg-paper-50/70 transition-colors">
                                                    <td className="px-4 py-3.5 text-[13px] text-slate-500 whitespace-nowrap tabular-nums">{fmtDate(e.entry_date)}</td>
                                                    <td className="px-4 py-3.5">
                                                        <div className="font-semibold text-ink-950">{e.client_name}</div>
                                                        {e.matter_title && <div className="text-[12px] text-slate-500 mt-0.5">{e.matter_title}</div>}
                                                    </td>
                                                    <td className="px-4 py-3.5 max-w-[340px]">
                                                        <div className="flex items-center gap-2">
                                                            <Badge value={e.entry_type}>{t(TYPES.find(x => x[0] === e.entry_type)?.[1] || e.entry_type)}</Badge>
                                                            {e.entry_type === 'expense' && !e.billable && <span className="text-[11px] font-medium text-slate-400">{t('internal')}</span>}
                                                        </div>
                                                        <div dir="auto" className="text-ink-900 mt-1.5 text-start">{e.description}</div>
                                                        <div className="text-[11.5px] text-slate-400 mt-1">
                                                            {[e.reference && t('Ref {ref}', { ref: e.reference }), e.payment_method && t(METHODS.find(m => m[0] === e.payment_method)?.[1] || e.payment_method), t('by {name}', { name: e.created_by_name || '—' })].filter(Boolean).join(' · ')}
                                                        </div>
                                                    </td>
                                                    <td className={`px-4 py-3.5 text-end font-semibold tabular-nums whitespace-nowrap ${e.entry_type === 'payment' ? 'text-emerald-600' : 'text-ink-950'}`}>
                                                        <span className="ltr inline-block">{signed(e)}</span>
                                                    </td>
                                                    <td className="px-4 py-3.5">
                                                        <Badge value={e.status} />
                                                        {e.reviewed_by_name && <div className="text-[11px] text-slate-400 mt-1.5">{e.status === 'approved' ? t('Approved by {name}', { name: e.reviewed_by_name }) : e.status === 'rejected' ? t('Rejected by {name}', { name: e.reviewed_by_name }) : t('Voided by {name}', { name: e.reviewed_by_name })}{e.self_approved ? ` ${t('(self)')}` : ''}</div>}
                                                        {e.review_note && <div dir="auto" className="text-[11px] text-slate-500 italic mt-1 max-w-[190px] ps-2 border-s-2 border-line-strong">“{e.review_note}”</div>}
                                                    </td>
                                                    <td className="px-4 py-3.5">
                                                        <div className="flex justify-end items-center gap-1 whitespace-nowrap">
                                                            {e.can_review && <>
                                                                <Button size="sm" variant="success" icon={CheckCircle2} onClick={() => act(e, 'approve')}>{t('Approve')}</Button>
                                                                <Button size="sm" variant="danger" icon={XCircle} onClick={() => setReason({ entry: e, action: 'reject' })}>{t('Reject')}</Button>
                                                            </>}
                                                            {e.status === 'pending' && !e.can_review && firm?.can_approve && e.created_by === firm.my_user_id && !firm.allow_self_approval && (
                                                                <span className="text-[11px] text-slate-400 self-center">{t('needs another approver')}</span>
                                                            )}
                                                            {e.can_edit && <>
                                                                <Button size="sm" variant="ghost" icon={Edit3} title={t('Edit')} aria-label={t('Edit')} onClick={() => setForm({ ...e, matter_id: e.matter_id || '', reference: e.reference || '', payment_method: e.payment_method || 'cash', amount: String(e.amount) })} />
                                                                <Button size="sm" variant="ghost" icon={Trash2} title={t('Delete')} aria-label={t('Delete')} onClick={() => remove(e)} className="hover:!text-red-600 hover:!bg-red-50" />
                                                            </>}
                                                            {e.status === 'approved' && firm?.can_approve && (e.created_by !== firm.my_user_id || firm.allow_self_approval) && (
                                                                <Button size="sm" variant="ghost" icon={Ban} title={t('Void')} onClick={() => setReason({ entry: e, action: 'void' })}>{t('Void')}</Button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            <div className="px-4 h-11 flex items-center border-t border-line bg-paper-50 text-[12px] text-slate-500">
                                {entries.length === 1 ? t('1 entry') : t('{n} entries', { n: entries.length })}
                            </div>
                        </Card>
                    )}
                </div>
            </div>

            {form && (
                <Modal title={form.id ? t('Edit pending entry') : t('New billing entry')} onClose={() => setForm(null)} footer={<>
                    <Button variant="secondary" onClick={() => setForm(null)}>{t('Cancel')}</Button>
                    <Button loading={busy} disabled={!form.client_id || !(Number(form.amount) > 0) || !form.description.trim() || !form.entry_date} onClick={save}>{form.id ? t('Save') : t('Record entry')}</Button></>}>
                    <div className="space-y-4">
                        {!form.id && (
                            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={t('Type')}>
                                {TYPES.map(([v, l]) => {
                                    const Icon = TYPE_ICON[v];
                                    const on = form.entry_type === v;
                                    return (
                                        <button key={v} type="button" role="radio" aria-checked={on} onClick={() => setForm(f => ({ ...f, entry_type: v }))}
                                            className={`flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl border text-[12.5px] font-semibold transition-all ${on ? 'border-gold-500 bg-amber-50/70 text-gold-700 shadow-focus' : 'border-line-strong text-slate-500 hover:bg-paper-50 hover:text-ink-900'}`}>
                                            <Icon size={17} />{t(l)}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                        <div className="grid grid-cols-2 gap-3">
                            <Field label={t('Client')}>
                                <select value={form.client_id} disabled={!!form.id} onChange={e => setForm(f => ({ ...f, client_id: e.target.value, matter_id: '' }))} className={inputClass}>
                                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </Field>
                            <Field label={t('Case (optional)')}>
                                <select value={form.matter_id} onChange={e => setForm(f => ({ ...f, matter_id: e.target.value }))} className={inputClass}>
                                    <option value="">{t('— none —')}</option>
                                    {mattersOf(form.client_id).map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
                                </select>
                            </Field>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <Field label={t('Amount (PKR)')}><input type="number" min="0" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className={`${inputClass} tabular-nums`} /></Field>
                            <Field label={t('Date')}><input type="date" value={form.entry_date} onChange={e => setForm(f => ({ ...f, entry_date: e.target.value }))} className={inputClass} /></Field>
                        </div>
                        <Field label={t('Description')}><input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                            placeholder={form.entry_type === 'fee' ? t('e.g. Bail petition drafting and hearing') : form.entry_type === 'expense' ? t('e.g. Court fee and stamp paper') : t('e.g. Advance received')} className={inputClass} /></Field>
                        <div className="grid grid-cols-2 gap-3">
                            <Field label={t('Reference')}><input value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))} placeholder={t('Receipt / cheque no.')} className={inputClass} /></Field>
                            {form.entry_type === 'payment' && (
                                <Field label={t('Received by')}>
                                    <select value={form.payment_method} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))} className={inputClass}>
                                        {METHODS.map(([v, l]) => <option key={v} value={v}>{t(l)}</option>)}
                                    </select>
                                </Field>
                            )}
                            {form.entry_type === 'expense' && (
                                <Field label={t('Bill to client?')}>
                                    <select value={form.billable ? 'yes' : 'no'} onChange={e => setForm(f => ({ ...f, billable: e.target.value === 'yes' }))} className={inputClass}>
                                        <option value="yes">{t('Yes — recover from client')}</option><option value="no">{t('No — internal cost')}</option>
                                    </select>
                                </Field>
                            )}
                        </div>
                        <p className="flex items-start gap-2 text-[12px] leading-relaxed text-slate-500 p-3 rounded-xl bg-paper-50 border border-line">
                            <ShieldCheck size={14} className="text-gold-600 flex-shrink-0 mt-0.5" />
                            {t('The entry is saved as pending. It counts towards balances and statements only after an owner or partner approves it.')}
                        </p>
                    </div>
                </Modal>
            )}
            {reason && (
                <ReasonModal title={reason.action === 'reject' ? t('Reject entry') : t('Void approved entry')}
                    label={reason.action === 'reject' ? t('Reason for rejecting (shown to the person who recorded it)') : t('Reason for voiding (kept on record)')}
                    confirmLabel={reason.action === 'reject' ? t('Reject') : t('Void entry')}
                    onConfirm={(note) => act(reason.entry, reason.action, note)} onClose={() => setReason(null)} />
            )}
        </div>
    );
}
