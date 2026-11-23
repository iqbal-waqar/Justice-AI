import React, { useEffect, useState } from 'react';
import { UsersRound, Mail, Trash2, Check, X, ShieldCheck, Building2, Send, Clock, Users } from 'lucide-react';
import { apiJson, formatDate } from '../api';
import { PageHeader, Button, Field, inputClass, controlClass, Badge, Alert, Card, CardHeader } from '../components/ui';
import { useI18n } from '../i18n';

const ROLE_HELP = {
    owner: 'Everything, including team and firm settings',
    partner: 'Approves billing; deletes clients and documents',
    associate: 'Manages clients, cases, documents and billing entries',
    clerk: 'Records documents and billing entries for approval',
};
const initials = (name) => (name || '?').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

export default function TeamPage() {
    const { t, lang } = useI18n();
    const fmtDate = (d) => (lang === 'ur' && d) ? new Date(d).toLocaleDateString('ur-PK', { day: 'numeric', month: 'short', year: 'numeric' }) : formatDate(d);
    const [firm, setFirm] = useState(null);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [invite, setInvite] = useState({ email: '', role: 'associate' });
    const [name, setName] = useState('');
    const [busy, setBusy] = useState(false);

    const apply = (f) => { setFirm(f); setName(f.name); };
    const call = async (fn, msg) => {
        setBusy(true); setError(''); setNotice('');
        try { apply(await fn()); if (msg) setNotice(msg); } catch (e) { setError(e.message); } finally { setBusy(false); }
    };
    useEffect(() => { call(() => apiJson('/api/v1/firm')); }, []);
    if (!firm) return (
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-paper-100">
            <PageHeader icon={UsersRound} title={t('Team & Firm')} subtitle={busy ? t('Loading…') : ''} />
            <div className="max-w-4xl w-full mx-auto px-6 lg:px-8 py-6"><Alert>{error}</Alert></div>
        </div>
    );
    const owner = firm.my_role === 'owner';

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-paper-100">
            <PageHeader icon={UsersRound} title={t('Team & Firm')}
                subtitle={[firm.name, firm.members.length === 1 ? t('1 member') : t('{n} members', { n: firm.members.length }), t('you are {role}', { role: t(firm.my_role) })].join(' · ')} />
            <div className="flex-1 overflow-y-auto">
                <div className="max-w-4xl mx-auto px-6 lg:px-8 py-6 space-y-5">
                    <Alert onClose={() => setError('')}>{error}</Alert>
                    <Alert tone="success" onClose={() => setNotice('')}>{notice}</Alert>

                    {firm.my_invitations.length > 0 && (
                        <div className="relative overflow-hidden p-5 rounded-2xl bg-ink-gradient text-white shadow-lift">
                            <span aria-hidden className="absolute inset-0 bg-ink-sheen" />
                            <h3 className="relative page-title text-[18px] flex items-center gap-2"><Mail size={17} className="text-gold-300" />{t("You've been invited")}</h3>
                            <div className="relative mt-3 space-y-2">
                                {firm.my_invitations.map(inv => (
                                    <div key={inv.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl p-3.5 bg-white/[0.07] ring-1 ring-white/10">
                                        <div className="text-[14px] flex items-center gap-2 flex-wrap"><b>{inv.firm_name}</b> <span className="text-white/60">{t('invited you as')}</span> <Badge value={inv.role} /></div>
                                        <div className="flex gap-2">
                                            <Button size="sm" variant="gold" icon={Check} loading={busy} onClick={() => {
                                                if (confirm(t("Join {firm}? You will leave your current practice. Its clients, documents and billing will then be shared with that firm's team.", { firm: inv.firm_name })))
                                                    call(() => apiJson(`/api/v1/firm/invitations/${inv.id}/accept`, { method: 'POST' }), t('You joined {firm}.', { firm: inv.firm_name }));
                                            }}>{t('Accept')}</Button>
                                            <Button size="sm" variant="ghost" icon={X} className="!text-white/70 hover:!text-white hover:!bg-white/10" onClick={() => call(() => apiJson(`/api/v1/firm/invitations/${inv.id}/decline`, { method: 'POST' }))}>{t('Decline')}</Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <Card>
                        <CardHeader icon={Building2} title={t('Firm')} />
                        <div className="p-5 space-y-4">
                            <Field label={t('Firm name')}>
                                <div className="flex gap-2">
                                    <input value={name} disabled={!owner} onChange={e => setName(e.target.value)} className={inputClass} />
                                    {owner && <Button disabled={name.trim().length < 2 || name === firm.name} loading={busy} onClick={() => call(() => apiJson('/api/v1/firm', { method: 'PUT', body: { name } }), t('Firm name saved.'))}>{t('Save')}</Button>}
                                </div>
                            </Field>
                            <div className="flex items-start justify-between gap-5 p-4 rounded-xl bg-paper-50 border border-line">
                                <div className="flex gap-3">
                                    <span className="w-9 h-9 rounded-xl bg-emerald-50 ring-1 ring-emerald-200/70 text-emerald-600 flex items-center justify-center flex-shrink-0"><ShieldCheck size={17} /></span>
                                    <div>
                                        <div className="text-[14px] font-semibold text-ink-950">{t('Maker-checker for billing')}</div>
                                        <p className="text-[12.5px] leading-relaxed text-slate-500 mt-1 max-w-lg">
                                            {t('Every fee, expense and payment is checked by a second person before it counts. Turn on self-approval only for a solo practice; such approvals are permanently marked "self".')}
                                        </p>
                                    </div>
                                </div>
                                <label className={`flex items-center gap-2.5 text-[12.5px] font-semibold text-ink-900 whitespace-nowrap ${owner ? 'cursor-pointer' : 'opacity-60'}`}>
                                    <span className="relative inline-flex">
                                        <input type="checkbox" disabled={!owner} checked={firm.allow_self_approval}
                                            onChange={e => call(() => apiJson('/api/v1/firm', { method: 'PUT', body: { allow_self_approval: e.target.checked } }),
                                                e.target.checked ? t('Self-approval allowed.') : t('Strict maker-checker restored.'))}
                                            className="peer sr-only" />
                                        <span className="w-10 h-6 rounded-full bg-slate-300 peer-checked:bg-gold-500 peer-focus-visible:shadow-focus transition-colors" />
                                        <span className="absolute top-0.5 start-0.5 w-5 h-5 rounded-full bg-white shadow-soft transition-transform peer-checked:translate-x-4 rtl:peer-checked:-translate-x-4" />
                                    </span>
                                    {t('Allow self-approval')}
                                </label>
                            </div>
                        </div>
                    </Card>

                    <Card className="overflow-hidden">
                        <CardHeader icon={Users} title={t('Members')}
                            action={<span className="px-2 h-[22px] inline-flex items-center rounded-full bg-paper-200 text-[11.5px] font-semibold text-slate-600 tabular-nums">{firm.members.length}</span>} />
                        <div className="divide-y divide-line">
                            {firm.members.map(m => {
                                const me = m.user_id === firm.my_user_id;
                                return (
                                    <div key={m.id} className="flex items-center gap-3.5 px-5 py-3.5 hover:bg-paper-50/70 transition-colors">
                                        <span className={`w-10 h-10 rounded-full flex items-center justify-center text-[12px] font-bold flex-shrink-0 ${m.role === 'owner' ? 'bg-gold-gradient text-[#2a1e05]' : 'bg-ink-gradient text-gold-300'}`}>
                                            {initials(m.full_name)}
                                        </span>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-[14px] font-semibold text-ink-950 flex items-center gap-2">
                                                <span className="truncate">{m.full_name}</span>
                                                {me && <span className="px-1.5 h-[18px] inline-flex items-center rounded-md bg-paper-200 text-[10.5px] font-semibold text-slate-500">{t('(you)')}</span>}
                                            </div>
                                            <div className="text-[12px] text-slate-500 truncate mt-0.5"><span className="ltr inline-block">{m.email}</span>{ROLE_HELP[m.role] ? <> · {t(ROLE_HELP[m.role])}</> : ''}</div>
                                        </div>
                                        {owner && m.role !== 'owner' ? (<>
                                            <select value={m.role} aria-label={t('Role')} onChange={e => call(() => apiJson(`/api/v1/firm/members/${m.id}`, { method: 'PUT', body: { role: e.target.value } }))} className={`${controlClass} h-9 w-36 capitalize`}>
                                                <option value="partner">{t('partner')}</option><option value="associate">{t('associate')}</option><option value="clerk">{t('clerk')}</option>
                                            </select>
                                            <Button size="sm" variant="ghost" icon={Trash2} title={t('Remove')} aria-label={t('Remove')} className="hover:!text-red-600 hover:!bg-red-50"
                                                onClick={() => confirm(t('Remove {name} from the firm?', { name: m.full_name })) && call(() => apiJson(`/api/v1/firm/members/${m.id}`, { method: 'DELETE' }), t('Member removed.'))} />
                                        </>) : <Badge value={m.role} />}
                                    </div>
                                );
                            })}
                        </div>
                    </Card>

                    {owner && (
                        <Card>
                            <CardHeader icon={Mail} title={t('Invite a colleague')} />
                            <div className="p-5 space-y-4">
                                <div className="grid sm:grid-cols-[1fr_160px_auto] gap-3 items-end">
                                    <Field label={t('Email')}><input type="email" value={invite.email} onChange={e => setInvite(i => ({ ...i, email: e.target.value }))} placeholder="colleague@example.com" className={inputClass} /></Field>
                                    <Field label={t('Role')}>
                                        <select value={invite.role} onChange={e => setInvite(i => ({ ...i, role: e.target.value }))} className={`${inputClass} capitalize`}>
                                            <option value="partner">{t('partner')}</option><option value="associate">{t('associate')}</option><option value="clerk">{t('clerk')}</option>
                                        </select>
                                    </Field>
                                    <Button icon={Send} loading={busy} disabled={!/\S+@\S+\.\S+/.test(invite.email)} className="[&_svg]:rtl:-scale-x-100" onClick={() =>
                                        call(() => apiJson('/api/v1/firm/invitations', { method: 'POST', body: invite }), t('Invitation sent to {email}. They accept it from Team in their own account.', { email: invite.email }))
                                            .then(() => setInvite({ email: '', role: 'associate' }))}>{t('Invite')}</Button>
                                </div>
                                {ROLE_HELP[invite.role] && <p className="text-[12.5px] text-slate-500"><span className="font-semibold text-ink-800 capitalize">{t(invite.role)}:</span> {t(ROLE_HELP[invite.role])}</p>}
                                <p className="text-[12px] leading-relaxed text-slate-500 p-3 rounded-xl bg-paper-50 border border-line">{t('Nobody joins without accepting. They sign in (or sign up) with this email and accept from the Team page.')}</p>
                                {firm.sent_invitations.length > 0 && (
                                    <div className="pt-1">
                                        <div className="text-[12px] font-semibold text-slate-500 mb-2">{t('Pending invitations')}</div>
                                        <div className="rounded-xl border border-line divide-y divide-line overflow-hidden">
                                            {firm.sent_invitations.map(inv => (
                                                <div key={inv.id} className="flex items-center gap-3 px-3.5 py-2.5 text-sm bg-white">
                                                    <span className="w-8 h-8 rounded-full bg-amber-50 ring-1 ring-amber-200/70 text-gold-700 flex items-center justify-center flex-shrink-0"><Clock size={14} /></span>
                                                    <span className="flex-1 min-w-0 flex flex-wrap items-center gap-2">
                                                        <span className="ltr inline-block font-medium text-ink-900 truncate">{inv.email}</span>
                                                        <Badge value={inv.role} />
                                                        <span className="text-[12px] text-slate-400">{t('invited {date}', { date: fmtDate(inv.created_at) })}</span>
                                                    </span>
                                                    <Button size="sm" variant="ghost" icon={X} title={t('Cancel invitation')} aria-label={t('Cancel invitation')} onClick={() => call(() => apiJson(`/api/v1/firm/invitations/${inv.id}`, { method: 'DELETE' }))} />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
}
