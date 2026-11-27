import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Briefcase, Plus, Search, Landmark, Hash, Gavel, Calendar, Edit3, Trash2, Share2, FolderLock, Users, Cloud, CalendarDays, ExternalLink, ChevronRight } from 'lucide-react';
import { apiJson } from '../api';
import { PageHeader, Button, Field, inputClass, Badge, Alert, EmptyState, Card, Tabs } from '../components/ui';
import { useI18n } from '../i18n';
import CaseWizard, { SearchSelect } from '../components/CaseWizard';
import { PUNJAB_DISTRICTS } from '../data/courts';

/* All the firm's cases in one place — case first, client as one of its fields.
   Add case opens the four-step form with Fetch from the court's website. */
export default function CasesPage() {
    const navigate = useNavigate();
    const [params, setParams] = useSearchParams();
    const { t, lang } = useI18n();
    const [matters, setMatters] = useState(null);
    const [clients, setClients] = useState([]);
    const [firm, setFirm] = useState(null);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState('open');
    const [district, setDistrict] = useState('');
    const [wizard, setWizard] = useState(params.get('new') === '1' ? {} : null);   // {} new, {...matter} edit

    const load = async () => {
        try {
            const [m, c, f] = await Promise.all([apiJson('/api/v1/matters'), apiJson('/api/v1/clients'), apiJson('/api/v1/firm')]);
            setMatters(m); setClients(c); setFirm(f);
        } catch (e) { setError(e.message); }
    };
    useEffect(() => { load(); }, []);

    const fmt = (d) => d ? new Date(d).toLocaleDateString(lang === 'ur' ? 'ur-PK' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : null;
    const todayIso = new Date().toISOString().slice(0, 10);
    const shown = useMemo(() => {
        const q = search.trim().toLowerCase();
        return (matters || []).filter(m => (status === 'all' || m.status === status) && (!district || m.district === district)
            && (!q || [m.title, m.case_number, m.client_name, m.court, m.judge, m.category].some(v => (v || '').toLowerCase().includes(q))));
    }, [matters, search, status, district]);
    const upcoming = (matters || []).filter(m => m.status === 'open' && m.next_hearing && m.next_hearing >= todayIso).length;

    const remove = async (m) => {
        if (!confirm(t('Delete case "{title}"?', { title: m.title }))) return;
        try { await apiJson(`/api/v1/matters/${m.id}`, { method: 'DELETE' }); await load(); } catch (e) { setError(e.message); }
    };
    const closeWizard = () => { setWizard(null); if (params.get('new')) { params.delete('new'); setParams(params, { replace: true }); } };

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-paper-100">
            <PageHeader icon={Briefcase} title={t('Cases')}
                subtitle={matters ? [matters.length === 1 ? t('1 case') : t('{n} cases', { n: matters.length }), upcoming ? t('{n} with a hearing coming up', { n: upcoming }) : null, firm?.name].filter(Boolean).join(' · ') : firm?.name}>
                <Button icon={Plus} onClick={() => setWizard({})}>{t('Add case')}</Button>
            </PageHeader>

            <div className="flex-1 overflow-y-auto">
                <div className="max-w-5xl mx-auto px-6 lg:px-8 py-6 space-y-4">
                    <Alert onClose={() => setError('')}>{error}</Alert>
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="relative flex-1 min-w-[220px]">
                            <Search size={15} className="absolute start-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                            <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('Search by title, number, client, judge…')} className={`${inputClass} ps-10 bg-white`} />
                        </div>
                        <div className="w-48"><SearchSelect value={district} onChange={setDistrict} placeholder={t('All districts')} options={[{ value: '', label: t('All districts') }, ...PUNJAB_DISTRICTS.map(d => ({ value: d.name, label: d.name }))]} /></div>
                        <Tabs value={status} onChange={setStatus} options={[{ value: 'open', label: t('Open') }, { value: 'closed', label: t('Closed') }, { value: 'all', label: t('All') }]} />
                    </div>

                    {matters === null ? <p className="text-[13px] text-slate-400 py-10 text-center">{t('Loading…')}</p>
                        : !matters.length ? (
                            <Card><EmptyState icon={Briefcase} title={t('Add your first case')}
                                text={t('Type the case number and the case fills itself in from the court’s website. Hearings, documents and fees are filed against it.')}
                                action={<Button icon={Plus} onClick={() => setWizard({})}>{t('Add case')}</Button>} /></Card>
                        ) : !shown.length ? (
                            <div className="px-5 py-10 rounded-2xl border border-dashed border-line-strong text-center text-[13.5px] text-slate-500">{t('No matches.')}</div>
                        ) : (
                            <div className="space-y-3">
                                {shown.map(m => {
                                    const soon = m.status === 'open' && m.next_hearing && m.next_hearing >= todayIso;
                                    return (
                                        <Card key={m.id} className="group p-5 hover:shadow-lift hover:border-line-strong transition-all">
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-2.5 flex-wrap">
                                                        <span className="font-semibold text-[15px] text-ink-950" dir="auto">{m.title}</span>
                                                        <Badge value={m.status} />
                                                        {m.source && m.source !== 'manual' && <span title={t('Filled from the court website')} className="inline-flex items-center gap-1 h-[22px] px-2 rounded-full bg-emerald-50 ring-1 ring-inset ring-emerald-200 text-emerald-700 text-[11px] font-semibold"><Cloud size={11} />{t('Court record')}</span>}
                                                    </div>
                                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-[12.5px] text-slate-500">
                                                        <button onClick={() => navigate(`/clients?client=${m.client_id}`)} className="flex items-center gap-1.5 hover:text-ink-950"><Users size={13} className="text-slate-400" />{m.client_name}</button>
                                                        {m.case_number && <span className="flex items-center gap-1.5"><Hash size={13} className="text-slate-400" /><span className="font-mono ltr">{m.case_number}</span></span>}
                                                        {m.court && <span className="flex items-center gap-1.5"><Landmark size={13} className="text-slate-400" />{m.court}</span>}
                                                        {m.judge && <span className="flex items-center gap-1.5 min-w-0"><Gavel size={13} className="text-slate-400 flex-shrink-0" /><span className="truncate max-w-[260px]">{m.judge}</span></span>}
                                                    </div>
                                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-[12.5px]">
                                                        {m.next_hearing && <span className={`flex items-center gap-1.5 font-semibold ${soon ? 'text-gold-700' : 'text-slate-500'}`}><Calendar size={13} />{t('Next')}: {fmt(m.next_hearing)}</span>}
                                                        {m.stage && <span className="text-slate-500" dir="auto">{m.stage}</span>}
                                                        {m.category && <span className="text-slate-500">{m.category}</span>}
                                                        {m.assigned_to_name && <span className="text-slate-500">{t('Assigned to {name}', { name: m.assigned_to_name })}</span>}
                                                    </div>
                                                </div>
                                                <div className="flex gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                                    <Button size="sm" variant="ghost" icon={CalendarDays} title={t('Case diary')} aria-label={t('Case diary')} onClick={() => navigate(`/diary?matter=${m.id}`)} />
                                                    <Button size="sm" variant="ghost" icon={FolderLock} title={t('Vault')} aria-label={t('Vault')} onClick={() => navigate(`/vault?client=${m.client_id}&matter=${m.id}`)} />
                                                    <Button size="sm" variant="ghost" icon={Share2} title={t('Share with client')} aria-label={t('Share with client')} onClick={() => navigate(`/clients?client=${m.client_id}&share=${m.id}`)} />
                                                    <Button size="sm" variant="ghost" icon={Edit3} title={t('Edit')} aria-label={t('Edit')} onClick={() => setWizard(m)} />
                                                    {firm?.can_approve && <Button size="sm" variant="ghost" icon={Trash2} title={t('Delete')} aria-label={t('Delete')} onClick={() => remove(m)} className="hover:!text-red-600 hover:!bg-red-50" />}
                                                </div>
                                            </div>
                                        </Card>
                                    );
                                })}
                            </div>
                        )}
                </div>
            </div>

            {wizard && <CaseWizard initial={wizard.id ? wizard : null} clients={clients} firm={firm} onClose={closeWizard} onSaved={async () => { closeWizard(); await load(); }} />}
        </div>
    );
}
