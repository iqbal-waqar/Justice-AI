import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X, ChevronDown, ChevronRight, ArrowRight, ArrowLeft, Check, Cloud, CloudOff, Landmark, Hash, Calendar, ListOrdered, Shield, Gavel, UserPlus, Users, Loader2, ExternalLink, CheckCircle2, FileText, Building2, Scale, Clock } from 'lucide-react';
import { apiJson } from '../api';
import { Button, Field, inputClass, textareaClass, Alert } from './ui';
import { useI18n } from '../i18n';
import { PUNJAB_DISTRICTS, LHC_BENCHES, COURT_TYPES, CASE_CATEGORIES, levelOf, courtLabel, benchFor, benchFromCourt } from '../data/courts';

/* Add / edit a case in four steps — Basic info · Court & client · Classify & proceed · Assignment.
   Type the case number and tap Fetch: the case fills itself from the court's website
   (Punjab district courts and the Lahore High Court). A lawyer who only knows the judge
   and the date finds the case in that day's cause list; a criminal case is found by FIR. */

const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const emptyForm = {
    district: 'Sahiwal', court_type: 'District and Sessions Courts', bench: 'Multan',
    case_number: '', title: '', description: '', filed_on: '', next_hearing: '',
    client_id: '', new_client: null, judge: '', category: '', fir_number: '', fir_year: '', police_station: '',
    status: 'open', stage: '', assigned_to: '', source: 'manual', source_url: '',
};
const districtId = (name) => PUNJAB_DISTRICTS.find(d => d.name === name)?.id;

export default function CaseWizard({ initial, clients, firm, onClose, onSaved }) {
    const { t } = useI18n();
    const editing = Boolean(initial?.id);
    const [step, setStep] = useState(0);
    const [form, setForm] = useState(() => {
        const base = { ...emptyForm };
        if (initial) for (const [k, v] of Object.entries(initial)) if (k in base) base[k] = v ?? '';
        if (initial?.court_type) base.court_type = initial.court_type;
        else if (initial?.court) base.court_type = COURT_TYPES.flatMap(g => g.items).find(i => initial.court.startsWith(i)) || base.court_type;
        if (initial?.district) base.district = initial.district;
        base.bench = benchFromCourt(initial?.court) || benchFor(base.district);
        if (initial?.client_id) base.client_id = initial.client_id;
        if (initial?.filed_on) base.filed_on = String(initial.filed_on).slice(0, 10);
        if (initial?.next_hearing) base.next_hearing = String(initial.next_hearing).slice(0, 10);
        if (initial?.assigned_to) base.assigned_to = String(initial.assigned_to);
        if (!editing && !initial?.filed_on) base.filed_on = today();
        return base;
    });
    const set = (patch) => setForm(f => ({ ...f, ...(typeof patch === 'function' ? patch(f) : patch) }));
    const [fetching, setFetching] = useState(false);
    const [fetchError, setFetchError] = useState('');
    const [fetched, setFetched] = useState(null);          // the record read from the court website
    const [importHearings, setImportHearings] = useState(true);
    const [sheet, setSheet] = useState(null);              // 'causelist' | 'fir'
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const level = levelOf(form.court_type);
    const isDistrict = level.value === 'district';
    const canFetch = level.fetch && form.case_number.trim() && (!isDistrict || form.district);
    const setDistrict = (district) => set(f => ({ district, bench: benchFor(district) }));

    /* ── fetch from the court website ── */
    const applyRecord = (rec) => {
        setFetched(rec);
        set(f => ({
            title: rec.title || f.title,
            case_number: rec.case_number || f.case_number,
            judge: rec.judge || f.judge,
            category: rec.category || f.category,
            stage: rec.stage || rec.short_order || f.stage,
            filed_on: rec.filed_on || f.filed_on,
            next_hearing: rec.next_hearing || f.next_hearing,
            fir_number: rec.fir_number || f.fir_number,
            fir_year: rec.fir_year || f.fir_year,
            police_station: rec.police_station || f.police_station,
            district: rec.district || f.district,
            bench: rec.bench || f.bench,
            status: /dispos|decided|closed/i.test(rec.status || '') ? 'closed' : 'open',
            source: rec.source, source_url: rec.source_url || '',
            description: f.description || (rec.title_urdu ? rec.title_urdu : ''),
        }));
    };
    const fetchCase = async () => {
        setFetching(true); setFetchError(''); setFetched(null);
        try {
            const body = isDistrict
                ? { court: 'district', case_number: form.case_number.trim(), district_id: districtId(form.district) }
                : { court: 'lhc', case_number: form.case_number.trim(), bench: (LHC_BENCHES.find(b => b.name === form.bench) || LHC_BENCHES[0]).code };
            applyRecord(await apiJson('/api/v1/court-lookup/case', { method: 'POST', body }));
        } catch (e) { setFetchError(e.message); } finally { setFetching(false); }
    };

    /* ── save ── */
    const steps = [t('Basic info'), t('Court & client'), t('Classify & proceed'), t('Assignment')];
    const stepTitles = [t('Basic information'), t('Court and client'), t('Classify and proceed'), t('Assignment')];
    const stepOk = [
        form.title.trim() && form.district && form.filed_on,
        Boolean(form.client_id) || Boolean(form.new_client?.name?.trim()),
        true, true,
    ];
    const save = async () => {
        setSaving(true); setError('');
        try {
            const body = {
                title: form.title.trim(), case_number: form.case_number.trim() || null, status: form.status,
                description: form.description.trim() || null, court: courtLabel(form) || null,
                district: form.district || null, court_type: form.court_type || null,
                judge: form.judge || null, category: form.category || null, stage: form.stage || null,
                filed_on: form.filed_on || null, next_hearing: form.next_hearing || null,
                fir_number: form.fir_number || null, fir_year: form.fir_year || null, police_station: form.police_station || null,
                source: form.source || 'manual', source_url: form.source_url || null,
                assigned_to: form.assigned_to ? Number(form.assigned_to) : null,
                proceedings: importHearings && fetched?.proceedings?.length ? fetched.proceedings.map(p => ({ date: p.date, stage: p.stage, order: p.order || null })) : [],
            };
            if (!editing) {
                if (form.new_client?.name?.trim()) body.new_client = { name: form.new_client.name.trim(), phone: form.new_client.phone || null, email: form.new_client.email || null };
                else body.client_id = Number(form.client_id);
            }
            const saved = await apiJson(editing ? `/api/v1/matters/${initial.id}` : '/api/v1/matters', { method: editing ? 'PUT' : 'POST', body });
            onSaved?.(saved);
        } catch (e) { setError(e.message); } finally { setSaving(false); }
    };

    const members = firm?.members || [];
    const client = clients.find(c => c.id === Number(form.client_id));

    return (
        <div className="fixed inset-0 bg-ink-950/45 backdrop-blur-[3px] flex items-center justify-center z-50 p-4 animate-fade-in" onMouseDown={onClose}>
            <div onMouseDown={e => e.stopPropagation()} role="dialog" aria-modal="true" className="bg-white rounded-2xl shadow-pop ring-1 ring-ink-950/5 w-full max-w-2xl max-h-[92vh] flex flex-col animate-slide-up overflow-hidden">
                {/* header + stepper */}
                <div className="px-6 pt-5 pb-4 border-b border-line bg-paper-50">
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <h3 className="page-title text-[19px] text-ink-950">{editing ? t('Edit case') : t('Add case')}</h3>
                            <p className="text-[12.5px] text-slate-500 mt-0.5">{t('Step {n} of {total} — {title}', { n: step + 1, total: 4, title: stepTitles[step] })}</p>
                        </div>
                        <button onClick={onClose} aria-label={t('Close')} className="w-8 h-8 -me-1.5 rounded-lg flex items-center justify-center hover:bg-paper-200 text-slate-400 hover:text-ink-950 transition-colors"><X size={17} /></button>
                    </div>
                    <div className="grid grid-cols-4 gap-1.5 mt-4">
                        {steps.map((_, i) => <span key={i} className={`h-1.5 rounded-full transition-colors ${i <= step ? 'bg-gold-500' : 'bg-paper-300'}`} />)}
                    </div>
                    <ol className="grid grid-cols-4 mt-3">
                        {steps.map((label, i) => {
                            const done = i < step, on = i === step;
                            return (
                                <li key={label} className="flex flex-col items-center text-center gap-1.5">
                                    <button type="button" onClick={() => i < step && setStep(i)} disabled={i > step}
                                        className={`w-8 h-8 rounded-full text-[12.5px] font-bold flex items-center justify-center ring-1 transition-colors ${on ? 'bg-ink-950 text-gold-300 ring-ink-950' : done ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-white text-slate-400 ring-line'}`}>
                                        {done ? <Check size={14} /> : i + 1}
                                    </button>
                                    <span className={`text-[11.5px] leading-tight font-semibold ${on ? 'text-ink-950' : 'text-slate-500'}`}>{label}</span>
                                </li>
                            );
                        })}
                    </ol>
                </div>

                <div className="px-6 py-5 overflow-y-auto flex-1">
                    <Alert onClose={() => setError('')}>{error}</Alert>
                    {step === 0 && <StepBasic form={form} set={set} setDistrict={setDistrict} level={level} canFetch={canFetch} fetching={fetching} fetchCase={fetchCase} fetchError={fetchError} fetched={fetched} openSheet={setSheet} />}
                    {step === 1 && <StepCourtClient form={form} set={set} clients={clients} editing={editing} client={client} />}
                    {step === 2 && <StepClassify form={form} set={set} fetched={fetched} importHearings={importHearings} setImportHearings={setImportHearings} />}
                    {step === 3 && <StepAssign form={form} set={set} members={members} client={client} />}
                </div>

                <div className="px-6 py-4 border-t border-line bg-paper-50 flex items-center justify-between gap-2">
                    <Button variant="secondary" icon={ArrowLeft} onClick={() => step ? setStep(step - 1) : onClose()} className="rtl:[&_svg]:rotate-180">{step ? t('Back') : t('Cancel')}</Button>
                    {step < 3
                        ? <Button icon={ArrowRight} disabled={!stepOk[step]} onClick={() => setStep(step + 1)} className="rtl:[&_svg]:rotate-180">{t('Next')}</Button>
                        : <Button icon={Check} loading={saving} disabled={!stepOk.every(Boolean)} onClick={save}>{editing ? t('Save changes') : t('Save case')}</Button>}
                </div>
            </div>

            {sheet === 'causelist' && <CauseListSheet district={form.district} courtType={form.court_type} onPick={(rec) => { applyRecord(rec); setSheet(null); }} onClose={() => setSheet(null)} />}
            {sheet === 'fir' && <FirSheet district={form.district} onPick={(rec) => { applyRecord(rec); setSheet(null); }} onClose={() => setSheet(null)} />}
        </div>
    );
}

/* ── Step 1 · Basic information ── */
function StepBasic({ form, set, setDistrict, level, canFetch, fetching, fetchCase, fetchError, fetched, openSheet }) {
    const { t } = useI18n();
    const isDistrict = level.value === 'district';
    return (
        <div className="space-y-4">
            <Field label={<Lbl icon={Building2} text={t('City')} required />}>
                <SearchSelect value={form.district} onChange={setDistrict} options={PUNJAB_DISTRICTS.map(d => ({ value: d.name, label: d.name }))} placeholder={t('Select district')} />
            </Field>
            <Field label={<Lbl icon={Landmark} text={t('Court type')} required />}>
                <SearchSelect value={form.court_type} onChange={v => set({ court_type: v })} groups={COURT_TYPES.map(g => ({ label: t(g.group), options: g.items.map(i => ({ value: i, label: t(i) })) }))} />
            </Field>
            {level.value === 'lhc' && (
                <Field label={<Lbl icon={Scale} text={t('Bench')} required />} hint={t('Preset from the city — change it if the case is filed elsewhere.')}>
                    <SearchSelect value={form.bench} onChange={v => set({ bench: v })} options={LHC_BENCHES.map(b => ({ value: b.name, label: t(b.name) }))} searchable={false} />
                </Field>
            )}

            <Field label={<Lbl icon={Hash} text={t('Case number')} required={false} />}>
                <div className="flex gap-2">
                    <input value={form.case_number} onChange={e => set({ case_number: e.target.value })} onKeyDown={e => e.key === 'Enter' && canFetch && fetchCase()}
                        placeholder={isDistrict ? t('CMS number, e.g. 170836126') : level.value === 'lhc' ? t('e.g. 57482/26') : t('As printed on the file')} className={`${inputClass} ltr font-mono`} />
                    {level.fetch && <Button icon={fetching ? Loader2 : Search} onClick={fetchCase} disabled={!canFetch || fetching} className={`flex-shrink-0 ${fetching ? '[&_svg]:animate-spin' : ''}`}>{fetching ? t('Fetching…') : t('Fetch')}</Button>}
                </div>
            </Field>
            {isDistrict && (
                <div className="space-y-1.5 -mt-1">
                    <button type="button" onClick={() => openSheet('causelist')} className="flex items-center gap-2 text-[13px] font-semibold text-gold-700 hover:text-gold-800 hover:underline"><ListOrdered size={15} />{t("Don't know the case number? Find it in a cause list")}</button>
                    <button type="button" onClick={() => openSheet('fir')} className="flex items-center gap-2 text-[13px] font-semibold text-gold-700 hover:text-gold-800 hover:underline"><Shield size={15} />{t('Or search by FIR number')}</button>
                </div>
            )}
            {fetchError && <p className="text-[13px] text-red-600 flex items-start gap-1.5"><CloudOff size={15} className="mt-0.5 flex-shrink-0" />{fetchError}</p>}
            {fetched ? (
                <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-emerald-50 ring-1 ring-emerald-200 text-[13px] text-emerald-800">
                    <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0 text-emerald-600" />
                    <span>{t('Filled from {source}. Check the details below and edit anything that needs it.', { source: fetched.source === 'lhc_case_status' ? t('the Lahore High Court website') : t('the Punjab district courts portal') })}
                        {fetched.source_url && <> · <a href={fetched.source_url} target="_blank" rel="noreferrer" className="underline inline-flex items-center gap-1">{t('Open on court site')}<ExternalLink size={12} /></a></>}</span>
                </div>
            ) : level.fetch ? (
                <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-paper-100 ring-1 ring-line text-[13px] text-slate-600">
                    <Cloud size={16} className="mt-0.5 flex-shrink-0 text-gold-600" />
                    <span>{isDistrict
                        ? t('Connected to {court} (Punjab Judiciary portal). Enter the case number and tap Fetch to auto-fill.', { court: courtLabel(form) })
                        : t('Connected to the Lahore High Court case status. Enter the case number and tap Fetch — the court site can take up to a minute.')}</span>
                </div>
            ) : (
                <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-paper-100 ring-1 ring-line text-[13px] text-slate-600">
                    <CloudOff size={16} className="mt-0.5 flex-shrink-0 text-slate-400" />
                    <span>{t('This court does not publish case status for auto-fill. Enter the details by hand.')}</span>
                </div>
            )}

            <Field label={<Lbl icon={FileText} text={t('Case title')} required />}><input value={form.title} onChange={e => set({ title: e.target.value })} placeholder={t('e.g. Asif v. State — post-arrest bail')} className={inputClass} dir="auto" /></Field>
            <Field label={<Lbl icon={FileText} text={t('Case description')} />}><textarea rows={3} value={form.description} onChange={e => set({ description: e.target.value })} placeholder={t('Enter case description')} className={textareaClass} dir="auto" /></Field>
            <div className="grid sm:grid-cols-2 gap-3">
                <Field label={<Lbl icon={Calendar} text={t('Register date')} required />}><input type="date" value={form.filed_on} onChange={e => set({ filed_on: e.target.value })} className={inputClass} /></Field>
                <Field label={<Lbl icon={Calendar} text={t('Next date')} />}><input type="date" value={form.next_hearing} onChange={e => set({ next_hearing: e.target.value })} className={inputClass} /></Field>
            </div>
        </div>
    );
}

/* ── Step 2 · Court & client ── */
function StepCourtClient({ form, set, clients, editing, client }) {
    const { t } = useI18n();
    const adding = form.new_client !== null;
    return (
        <div className="space-y-4">
            <div className="rounded-xl ring-1 ring-line bg-paper-50 p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                    <span className="text-[12.5px] font-semibold text-ink-800 flex items-center gap-1.5"><Users size={14} className="text-gold-600" />{t('Client')} <span className="text-red-500">*</span></span>
                    {!editing && <button type="button" onClick={() => set({ new_client: adding ? null : { name: '', phone: '', email: '' }, client_id: '' })} className="text-[12.5px] font-semibold text-gold-700 hover:underline flex items-center gap-1"><UserPlus size={14} />{adding ? t('Choose an existing client') : t('Add a new client')}</button>}
                </div>
                {adding ? (
                    <div className="grid sm:grid-cols-3 gap-3">
                        <Field label={t('Full name *')}><input autoFocus value={form.new_client.name} onChange={e => set({ new_client: { ...form.new_client, name: e.target.value } })} className={inputClass} /></Field>
                        <Field label={t('Phone')}><input type="tel" value={form.new_client.phone} onChange={e => set({ new_client: { ...form.new_client, phone: e.target.value } })} placeholder="03XXXXXXXXX" className={`${inputClass} ltr`} /></Field>
                        <Field label={t('Email')}><input type="email" value={form.new_client.email} onChange={e => set({ new_client: { ...form.new_client, email: e.target.value } })} className={`${inputClass} ltr`} /></Field>
                    </div>
                ) : editing ? (
                    <div className="text-[14px] font-semibold text-ink-950">{client?.name || t('Client')}</div>
                ) : (
                    <SearchSelect value={form.client_id ? String(form.client_id) : ''} onChange={v => set({ client_id: v })} placeholder={t('Select client')}
                        options={clients.map(c => ({ value: String(c.id), label: c.name, hint: c.phone || c.email || '' }))} />
                )}
            </div>

            <Field label={<Lbl icon={Gavel} text={t('Judge / presiding officer')} />}><input value={form.judge} onChange={e => set({ judge: e.target.value })} placeholder={t('e.g. Mr. Gul Abbas, AD&SJ, Sahiwal')} className={inputClass} /></Field>
            <Field label={<Lbl icon={Scale} text={t('Case category')} />}>
                <input list="case-categories" value={form.category} onChange={e => set({ category: e.target.value })} placeholder={t('e.g. Family Appeal')} className={inputClass} />
                <datalist id="case-categories">{CASE_CATEGORIES.map(c => <option key={c} value={c} />)}</datalist>
            </Field>
            <div className="rounded-xl ring-1 ring-line p-4 space-y-3">
                <span className="text-[12.5px] font-semibold text-ink-800 flex items-center gap-1.5"><Shield size={14} className="text-gold-600" />{t('FIR (criminal cases)')}</span>
                <div className="grid grid-cols-3 gap-3">
                    <Field label={t('FIR number')}><input value={form.fir_number} onChange={e => set({ fir_number: e.target.value })} className={`${inputClass} ltr`} /></Field>
                    <Field label={t('FIR year')}><input value={form.fir_year} onChange={e => set({ fir_year: e.target.value.replace(/\D/g, '').slice(0, 4) })} placeholder="2026" className={`${inputClass} ltr`} /></Field>
                    <Field label={t('Police station')}><input value={form.police_station} onChange={e => set({ police_station: e.target.value })} className={inputClass} /></Field>
                </div>
            </div>
        </div>
    );
}

/* ── Step 3 · Classify & proceed ── */
function StepClassify({ form, set, fetched, importHearings, setImportHearings }) {
    const { t, lang } = useI18n();
    const fmt = (d) => d ? new Date(d).toLocaleDateString(lang === 'ur' ? 'ur-PK' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
    const procs = fetched?.proceedings || [];
    return (
        <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-3">
                <Field label={<Lbl icon={Clock} text={t('Status')} />}>
                    <SearchSelect value={form.status} onChange={v => set({ status: v })} searchable={false} options={[{ value: 'open', label: t('open') }, { value: 'closed', label: t('closed') }]} />
                </Field>
                <Field label={<Lbl icon={ListOrdered} text={t('Current stage')} />}><input value={form.stage} onChange={e => set({ stage: e.target.value })} placeholder={t('e.g. Arguments, Evidence, Framing of issues')} className={inputClass} dir="auto" /></Field>
            </div>

            {fetched && (
                <div className="rounded-xl ring-1 ring-emerald-200 bg-emerald-50/60 overflow-hidden">
                    <div className="px-4 py-3 border-b border-emerald-200/70 flex items-center gap-2 text-[13px] font-semibold text-emerald-800"><CheckCircle2 size={15} />{t('Read from the court record')}</div>
                    <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-2 px-4 py-3 text-[13px]">
                        {[[t('Court status'), fetched.status], [t('Decision'), fetched.decision], [t('Short order'), fetched.short_order], [t('Institution no.'), fetched.institution_number],
                          [t('Last hearing'), fmt(fetched.last_hearing)], [t('Decided on'), fetched.decided_on ? fmt(fetched.decided_on) : null], [t('Offence'), fetched.offence]].filter(([, v]) => v).map(([k, v]) => (
                            <div key={k} className="flex gap-2 min-w-0"><dt className="text-slate-500 flex-shrink-0">{k}:</dt><dd className="text-ink-950 font-medium truncate" dir="auto">{v}</dd></div>
                        ))}
                    </dl>
                </div>
            )}

            {procs.length > 0 ? (
                <div className="rounded-xl ring-1 ring-line overflow-hidden">
                    <label className="flex items-center gap-3 px-4 py-3 bg-paper-50 border-b border-line cursor-pointer">
                        <input type="checkbox" checked={importHearings} onChange={e => setImportHearings(e.target.checked)} className="w-4 h-4 accent-gold-600" />
                        <span className="text-[13.5px] font-semibold text-ink-950">{t('File these {n} hearings in the case diary', { n: procs.length })}</span>
                    </label>
                    <ul className="max-h-56 overflow-y-auto divide-y divide-line">
                        {[...procs].reverse().map((p, i) => (
                            <li key={i} className="flex items-start gap-3 px-4 py-2.5 text-[13px]">
                                <span className="w-24 flex-shrink-0 tabular-nums text-slate-500">{fmt(p.date)}</span>
                                <span className="min-w-0"><span className="font-medium text-ink-950" dir="auto">{p.stage}</span>{p.order && <span className="block text-slate-500" dir="auto">{p.order}</span>}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            ) : (
                <div className="px-4 py-4 rounded-xl border border-dashed border-line-strong text-[13px] text-slate-500">{t('Hearings are added in the case diary. If the case is fetched from a district court, its proceeding history is filed there for you.')}</div>
            )}
        </div>
    );
}

/* ── Step 4 · Assignment ── */
function StepAssign({ form, set, members, client }) {
    const { t } = useI18n();
    const roleLabel = { owner: t('Owner'), partner: t('Partner'), associate: t('Associate'), clerk: t('Clerk') };
    return (
        <div className="space-y-4">
            <div>
                <span className="block text-[12.5px] font-semibold text-ink-800 mb-2">{t('Assign to')}</span>
                <ul className="rounded-xl ring-1 ring-line divide-y divide-line overflow-hidden">
                    {[{ user_id: '', full_name: t('Unassigned'), role: null }, ...members].map(m => {
                        const on = String(form.assigned_to || '') === String(m.user_id || '');
                        return (
                            <li key={m.user_id || 'none'}>
                                <button type="button" onClick={() => set({ assigned_to: m.user_id ? String(m.user_id) : '' })} className={`w-full flex items-center gap-3 px-4 py-3 text-start transition-colors ${on ? 'bg-amber-50/70' : 'hover:bg-paper-50'}`}>
                                    <span className={`w-5 h-5 rounded-full ring-1 flex items-center justify-center flex-shrink-0 ${on ? 'bg-gold-500 ring-gold-500 text-white' : 'ring-line-strong bg-white'}`}>{on && <Check size={12} />}</span>
                                    <span className="flex-1 min-w-0"><span className="block text-[14px] font-medium text-ink-950 truncate">{m.full_name}</span>{m.role && <span className="block text-[12px] text-slate-500">{roleLabel[m.role] || m.role}{m.email ? ` · ${m.email}` : ''}</span>}</span>
                                </button>
                            </li>
                        );
                    })}
                </ul>
            </div>
            <div className="rounded-xl bg-paper-100 ring-1 ring-line p-4 text-[13px] space-y-1.5">
                <div className="text-[12.5px] font-semibold text-ink-800 mb-1">{t('Summary')}</div>
                <Row k={t('Case title')} v={form.title} />
                <Row k={t('Client')} v={form.new_client?.name || client?.name} />
                <Row k={t('Court')} v={courtLabel(form)} />
                <Row k={t('Case number')} v={form.case_number} mono />
                <Row k={t('Judge / presiding officer')} v={form.judge} />
                <Row k={t('Status')} v={form.status === 'open' ? t('open') : t('closed')} />
                <Row k={t('Next date')} v={form.next_hearing} mono />
            </div>
        </div>
    );
}
const Row = ({ k, v, mono }) => v ? <div className="flex gap-2"><span className="text-slate-500 w-32 flex-shrink-0">{k}</span><span className={`text-ink-950 font-medium min-w-0 truncate ${mono ? 'font-mono ltr text-start' : ''}`} dir="auto">{v}</span></div> : null;
const Lbl = ({ icon: Icon, text, required }) => <span className="inline-flex items-center gap-1.5"><Icon size={13} className="text-gold-600" />{text}{required && <span className="text-red-500">*</span>}</span>;

/* ── Searchable select (district, court type, client) ── */
export function SearchSelect({ value, onChange, options = [], groups, placeholder, searchable = true }) {
    const { t } = useI18n();
    const [open, setOpen] = useState(false);
    const [q, setQ] = useState('');
    const ref = useRef(null);
    const all = groups ? groups.flatMap(g => g.options) : options;
    const current = all.find(o => o.value === value);
    useEffect(() => {
        if (!open) return;
        const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, [open]);
    const match = (o) => !q || o.label.toLowerCase().includes(q.toLowerCase()) || (o.hint || '').toLowerCase().includes(q.toLowerCase());
    const render = (list) => list.filter(match).map(o => (
        <li key={o.value}>
            <button type="button" onClick={() => { onChange(o.value); setOpen(false); setQ(''); }}
                className={`w-full text-start px-3.5 py-2.5 text-[13.5px] flex items-center justify-between gap-3 transition-colors ${o.value === value ? 'bg-amber-50/70 text-ink-950 font-semibold' : 'text-ink-900 hover:bg-paper-50'}`}>
                <span className="min-w-0 truncate">{o.label}{o.hint && <span className="block text-[11.5px] font-normal text-slate-500 ltr text-start truncate">{o.hint}</span>}</span>
                {o.value === value && <Check size={14} className="text-gold-600 flex-shrink-0" />}
            </button>
        </li>
    ));
    return (
        <div ref={ref} className="relative">
            <button type="button" onClick={() => setOpen(o => !o)} className={`${inputClass} flex items-center justify-between gap-2 text-start`}>
                <span className={`truncate ${current ? 'text-ink-950' : 'text-slate-400'}`}>{current?.label || placeholder || t('Select…')}</span>
                <ChevronDown size={15} className={`text-slate-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && (
                <div className="absolute z-20 mt-1.5 inset-x-0 bg-white rounded-xl shadow-pop ring-1 ring-ink-950/10 overflow-hidden animate-fade-in">
                    {searchable && (
                        <div className="p-2 border-b border-line">
                            <div className="relative">
                                <Search size={14} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder={t('Search')} className={`${inputClass} h-9 ps-9 pe-8 bg-paper-50`} />
                                {q && <button type="button" onClick={() => setQ('')} className="absolute end-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-ink-950"><X size={14} /></button>}
                            </div>
                        </div>
                    )}
                    <ul className="max-h-60 overflow-y-auto py-1">
                        {groups ? groups.map(g => {
                            const items = g.options.filter(match);
                            return items.length ? <li key={g.label}><div className="px-3.5 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{g.label}</div><ul>{render(g.options)}</ul></li> : null;
                        }) : render(options)}
                        {!all.some(match) && <li className="px-3.5 py-4 text-center text-[13px] text-slate-400">{t('No matches.')}</li>}
                    </ul>
                </div>
            )}
        </div>
    );
}

/* ── Sheet: find the case in a judge's cause list ── */
function Sheet({ title, text, onClose, children }) {
    const { t } = useI18n();
    return (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-ink-950/40 p-0 sm:p-4 animate-fade-in" onMouseDown={onClose}>
            <div onMouseDown={e => e.stopPropagation()} role="dialog" aria-modal="true" className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-pop ring-1 ring-ink-950/5 max-h-[88vh] flex flex-col animate-slide-up">
                <div className="px-5 pt-4 pb-3 border-b border-line">
                    <div className="mx-auto w-10 h-1 rounded-full bg-paper-300 mb-3 sm:hidden" />
                    <div className="flex items-start justify-between gap-3">
                        <div><h4 className="text-[17px] font-semibold text-ink-950">{title}</h4><p className="text-[12.5px] text-slate-500 mt-0.5">{text}</p></div>
                        <button onClick={onClose} aria-label={t('Close')} className="w-8 h-8 -me-1.5 rounded-lg flex items-center justify-center hover:bg-paper-200 text-slate-400 hover:text-ink-950"><X size={17} /></button>
                    </div>
                </div>
                <div className="p-4 overflow-y-auto flex-1">{children}</div>
            </div>
        </div>
    );
}

/* Which designations in a judge's title belong to a court type ("Mr. Ahmed Khalid, CJ-III, Sahiwal"). */
const TYPE_DESIGNATIONS = {
    'District and Sessions Courts': /\b(DSJ|AD&SJ|ADSJ|Sessions)\b/i, 'Criminal Courts': /\b(DSJ|AD&SJ|ADSJ|SCJ \(Criminal|JM|Magistrate)/i,
    'Civil Courts': /\b(CJ|SCJ)\b|SCJ \(Civil/i, 'Family Courts': /family|JFC/i, 'Magistrate Courts': /\bJM\b|Magistrate/i,
    'Judicial Magistrates': /\bJM\b|Judicial Magistrate/i, 'Juvenile Courts': /juvenile/i, 'Banking Courts': /banking/i, 'Labour Courts': /labour/i,
    'Anti-Terrorism Courts': /\bATC\b|terror/i, 'Accountability Courts': /accountab/i, 'Consumer Protection Courts': /consumer/i,
    'Narcotics Control Courts': /narcotic|\bCNS\b/i, 'Environmental Protection Tribunals': /environment/i, 'Special Courts and Tribunals': /special|tribunal|banking|labour|consumer|accountab|narcotic|ATC/i,
};

function CauseListSheet({ district, courtType, onPick, onClose }) {
    const { t, lang } = useI18n();
    const did = districtId(district);
    const [date, setDate] = useState(today());
    const [judges, setJudges] = useState(null);
    const [q, setQ] = useState('');
    const [judge, setJudge] = useState(null);
    const [list, setList] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    useEffect(() => { setJudges(null); apiJson(`/api/v1/court-lookup/judges?district_id=${did}`).then(r => setJudges(r.judges)).catch(e => setError(e.message)); }, [did]);
    const openJudge = async (j, on = date) => {
        setJudge(j); setList(null); setBusy(true); setError('');
        try { setList(await apiJson('/api/v1/court-lookup/cause-list', { method: 'POST', body: { district_id: did, court_id: j.court_id, date: on } })); }
        catch (e) { setError(e.message); } finally { setBusy(false); }
    };
    // A new date reloads the same judge's list for that day; before a judge is chosen it only changes the date.
    const changeDate = (on) => { setDate(on); if (judge && on) openJudge(judge, on); };
    const pick = async (c) => {
        setBusy(true); setError('');
        try { onPick(await apiJson('/api/v1/court-lookup/cause-list/pick', { method: 'POST', body: { court: 'district', case_number: c.case_number, district_id: did } })); }
        catch (e) { setError(e.message); setBusy(false); }
    };
    const fmt = (d) => d ? new Date(d).toLocaleDateString(lang === 'ur' ? 'ur-PK' : 'en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
    const typeRe = TYPE_DESIGNATIONS[courtType];
    const ofType = (j) => Boolean(typeRe && typeRe.test(j.name));
    const shown = (judges || []).filter(j => j.name.toLowerCase().includes(q.toLowerCase())).sort((a, b) => Number(ofType(b)) - Number(ofType(a)));
    const firstOther = shown.findIndex(j => !ofType(j));
    return (
        <Sheet title={t('Find your case in a cause list')} text={t('Choose the court and a date your case was listed. Then tap your case.')} onClose={onClose}>
            <div className="space-y-3">
                <div className="flex items-center gap-3 px-3.5 h-11 rounded-xl bg-emerald-50 ring-1 ring-emerald-200 text-[13.5px] text-emerald-900">
                    <Calendar size={15} className="text-emerald-700" /><span className="font-semibold">{t('Hearing date')}:</span>
                    <input type="date" value={date} onChange={e => changeDate(e.target.value)} className="bg-transparent flex-1 outline-none ltr text-start font-semibold" />
                </div>
                <Alert onClose={() => setError('')}>{error}</Alert>
                {!judge ? (
                    <>
                        <div className="relative">
                            <Search size={15} className="absolute start-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                            <input value={q} onChange={e => setQ(e.target.value)} placeholder={t('Type judge or court name')} className={`${inputClass} ps-10`} />
                        </div>
                        {judges === null ? <p className="text-[13px] text-slate-400 py-6 text-center">{t('Loading the judges of {district}…', { district })}</p> : (
                            <ul className="divide-y divide-line rounded-xl ring-1 ring-line overflow-hidden">
                                {typeRe && shown.some(ofType) && <li className="px-3.5 pt-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gold-700 bg-paper-50">{t(courtType)}</li>}
                                {shown.map((j, i) => (
                                    <li key={j.court_id}>{typeRe && i === firstOther && i > 0 && <div className="px-3.5 pt-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400 bg-paper-50">{t('Other courts in {district}', { district })}</div>}<button type="button" onClick={() => openJudge(j)} className="w-full flex items-center gap-3 px-3.5 py-3 text-start hover:bg-paper-50">
                                        <Landmark size={16} className="text-gold-600 flex-shrink-0" /><span className="flex-1 text-[13.5px] text-ink-950">{j.name}</span><ChevronRight size={15} className="text-slate-300 rtl:rotate-180" /></button></li>
                                ))}
                                {!shown.length && <li className="px-4 py-6 text-center text-[13px] text-slate-400">{t('No matches.')}</li>}
                            </ul>
                        )}
                    </>
                ) : (
                    <>
                        <button type="button" onClick={() => { setJudge(null); setList(null); }} className="flex items-center gap-1.5 text-[13px] font-semibold text-gold-700 hover:underline"><ArrowLeft size={14} className="rtl:rotate-180" />{t('All judges')}</button>
                        <div className="px-3.5 py-2.5 rounded-xl bg-paper-100 ring-1 ring-line text-[13px]"><span className="font-semibold text-ink-950">{judge.name}</span><span className="text-slate-500"> · {fmt(date)}</span></div>
                        {busy && !list ? <p className="text-[13px] text-slate-400 py-6 text-center flex items-center justify-center gap-2"><Loader2 size={15} className="animate-spin" />{t('Reading the cause list from the court portal…')}</p>
                            : list && !list.cases.length ? <p className="text-[13px] text-slate-500 py-6 text-center">{t('No cases listed before this judge on that date. Try another date.')}</p>
                            : list && (
                                <ul className="divide-y divide-line rounded-xl ring-1 ring-line overflow-hidden">
                                    {list.cases.map(c => (
                                        <li key={c.serial}><button type="button" disabled={busy} onClick={() => pick(c)} className="w-full px-3.5 py-3 text-start hover:bg-paper-50 disabled:opacity-60">
                                            <div className="flex items-center justify-between gap-3"><span className="text-[14px] font-semibold text-ink-950" dir="auto">{c.title}</span><span className="font-mono text-[12px] text-slate-500 ltr">{c.case_number}</span></div>
                                            <div className="flex flex-wrap gap-x-3 text-[12px] text-slate-500 mt-0.5">{c.fir && <span dir="auto">{t('FIR')} {c.fir}</span>}{c.offence && <span className="ltr">{c.offence}</span>}{c.today && <span dir="auto">{c.today}</span>}{c.next_hearing && <span>{t('Next')}: {fmt(c.next_hearing)}</span>}</div>
                                        </button></li>
                                    ))}
                                </ul>
                            )}
                    </>
                )}
            </div>
        </Sheet>
    );
}

/* ── Sheet: find the case by FIR ── */
function FirSheet({ district, onPick, onClose }) {
    const { t, lang } = useI18n();
    const did = districtId(district);
    const [stations, setStations] = useState(null);
    const [q, setQ] = useState('');
    const [f, setF] = useState({ fir_number: '', fir_year: String(new Date().getFullYear()), station: null });
    const [results, setResults] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    useEffect(() => { setStations(null); apiJson(`/api/v1/court-lookup/police-stations?district_id=${did}`).then(r => setStations(r.police_stations)).catch(e => setError(e.message)); }, [did]);
    const canSearch = /^\d+$/.test(f.fir_number.trim()) && /^\d{4}$/.test(f.fir_year) && f.station;
    const search = async (e) => {
        e.preventDefault(); if (!canSearch) return;
        setBusy(true); setError(''); setResults(null);
        try { setResults((await apiJson('/api/v1/court-lookup/fir', { method: 'POST', body: { district_id: did, fir_number: f.fir_number.trim(), fir_year: f.fir_year, police_station_id: f.station.id } })).results); }
        catch (err) { setError(err.message); } finally { setBusy(false); }
    };
    const pick = async (r) => {
        setBusy(true); setError('');
        try { onPick(r.detail_url ? await apiJson(`/api/v1/court-lookup/detail?url=${encodeURIComponent(r.detail_url)}`) : { ...r, source: 'punjab_district_portal' }); }
        catch (err) { setError(err.message); setBusy(false); }
    };
    const fmt = (d) => d ? new Date(d).toLocaleDateString(lang === 'ur' ? 'ur-PK' : 'en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
    const shown = (stations || []).filter(s => s.name.toLowerCase().includes(q.toLowerCase()));
    return (
        <Sheet title={t('Find your case by FIR')} text={t('Enter the FIR number, year and police station. All cases from that FIR are listed.')} onClose={onClose}>
            <form onSubmit={search} className="space-y-3">
                <div className="grid grid-cols-[1.6fr_1fr] gap-3">
                    <input autoFocus required value={f.fir_number} placeholder={t('FIR no.')} className={`${inputClass} h-11 ltr`}
                        onChange={e => { const m = e.target.value.match(/^\s*(\d*)\s*\/\s*(\d{2,4})\s*$/); setF(x => m ? { ...x, fir_number: m[1], fir_year: m[2].length === 2 ? `20${m[2]}` : m[2] } : { ...x, fir_number: e.target.value }); setResults(null); }} />
                    <input required value={f.fir_year} onChange={e => { setF(x => ({ ...x, fir_year: e.target.value.replace(/\D/g, '').slice(0, 4) })); setResults(null); }} placeholder="2026" className={`${inputClass} h-11 ltr text-center font-mono`} />
                </div>
                <div className="relative">
                    <Search size={15} className="absolute start-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input value={f.station ? f.station.name : q} onChange={e => { setQ(e.target.value); setF(x => ({ ...x, station: null })); setResults(null); }} placeholder={t('Type police station name')} className={`${inputClass} h-11 ps-10 pe-9 ${f.station ? 'font-semibold' : ''}`} />
                    {(f.station || q) && <button type="button" onClick={() => { setQ(''); setF(x => ({ ...x, station: null })); setResults(null); }} className="absolute end-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-ink-950"><X size={15} /></button>}
                </div>
                <Button type="submit" icon={Search} loading={busy && results === null && Boolean(f.station)} disabled={!canSearch} className="w-full h-11">{t('Search')}</Button>
                <Alert onClose={() => setError('')}>{error}</Alert>

                {!f.station && (
                    stations === null ? <p className="text-[13px] text-slate-400 py-6 text-center">{t('Loading the police stations of {district}…', { district })}</p> : (
                        <ul className="divide-y divide-line">
                            {shown.map(s => (
                                <li key={s.id}><button type="button" onClick={() => { setF(x => ({ ...x, station: s })); setQ(''); }} className="w-full flex items-center gap-3 px-2 py-3 text-start hover:bg-paper-50 rounded-lg">
                                    <Shield size={16} className="text-gold-600 flex-shrink-0" /><span className="text-[13.5px] text-ink-950">{s.name}</span></button></li>
                            ))}
                            {!shown.length && <li className="px-4 py-6 text-center text-[13px] text-slate-400">{t('No matches.')}</li>}
                        </ul>
                    )
                )}
                {results && !results.length && <p className="text-[13px] text-slate-500 py-4 text-center">{t('No case is registered on FIR {fir} at {station}. Check the number and year, or try another police station.', { fir: `${f.fir_number}/${f.fir_year}`, station: f.station?.name })}</p>}
                {results && results.length > 0 && (
                    <div>
                        <div className="text-[12.5px] font-semibold text-ink-800 mb-2">{results.length === 1 ? t('1 case on this FIR — tap it to fill the form') : t('{n} cases on this FIR — tap yours to fill the form', { n: results.length })}</div>
                        <ul className="divide-y divide-line rounded-xl ring-1 ring-line overflow-hidden">
                            {results.map(r => (
                                <li key={r.case_number}><button type="button" disabled={busy} onClick={() => pick(r)} className="w-full px-3.5 py-3 text-start hover:bg-paper-50 disabled:opacity-60">
                                    <div className="flex items-center justify-between gap-3"><span className="text-[14px] font-semibold text-ink-950">{r.title}</span><span className="font-mono text-[12px] text-slate-500 ltr">{r.case_number}</span></div>
                                    <div className="text-[12.5px] text-slate-600 mt-0.5">{r.category}</div>
                                    <div className="flex flex-wrap gap-x-3 text-[12px] text-slate-500 mt-0.5"><span>{r.judge}{r.judge_designation ? `, ${r.judge_designation}` : ''}</span>{r.status && <span>· {r.status}{r.stage ? `, ${r.stage}` : ''}</span>}{r.date && <span>· {fmt(r.date)}</span>}</div>
                                </button></li>
                            ))}
                        </ul>
                    </div>
                )}
            </form>
        </Sheet>
    );
}
