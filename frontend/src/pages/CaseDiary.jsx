import React, { useState, useEffect } from 'react';
import { apiFetch } from '../api';
import { useI18n } from '../i18n';
import { PageHeader, Button, Modal, Field, Tabs, EmptyState, inputClass, textareaClass } from '../components/ui';
import {
    CalendarDays, Plus, Clock, MapPin, Trash2, Edit3, Check, Search, Save, StickyNote, Hash,
    CalendarCheck2, CalendarClock, ListChecks, Sun,
} from 'lucide-react';


// Notes used to live only in this browser's localStorage; they're migrated to
// the server once (see importLocalNotes) and the key is then removed.
const LEGACY_NOTES_KEY = 'justiceai_notes';

const toNote = (n) => ({
    id: n.id, title: n.title, caseRef: n.case_ref || '', content: n.content,
    priority: n.priority, createdAt: n.created_at, updatedAt: n.updated_at,
});

export default function CaseDiary() {
    const { t, lang } = useI18n();
    const dateLocale = lang === 'ur' ? 'ur-PK' : 'en-PK';
    const [activeTab, setActiveTab] = useState('hearings');
    const [hearings, setHearings] = useState([]);
    const [notes, setNotes] = useState([]);
    const [showAddHearing, setShowAddHearing] = useState(false);
    const [showAddNote, setShowAddNote] = useState(false);
    const [search, setSearch] = useState('');
    const [editingHearing, setEditingHearing] = useState(null);
    const [editingNote, setEditingNote] = useState(null);

    const [hForm, setHForm] = useState({ caseTitle: '', caseNumber: '', court: '', date: '', time: '', notes: '', notifyPhone: '', matterId: '' });
    const [matters, setMatters] = useState([]);   // the firm's cases, for linking a hearing to one
    useEffect(() => { apiFetch('/api/v1/clients').then(r => r.ok ? r.json() : []).then(cs => setMatters(cs.flatMap(c => c.matters.map(m => ({ ...m, client_name: c.name }))))).catch(() => {}); }, []);
    const [nForm, setNForm] = useState({ title: '', caseRef: '', content: '', priority: 'normal' });

    const token = localStorage.getItem('justiceai_token');
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

    useEffect(() => { fetchHearings(); loadNotes(); }, []);

    const fetchNotes = async () => {
        try {
            const res = await apiFetch(`/api/v1/notes`, { headers });
            if (res.ok) setNotes((await res.json()).map(toNote));
        } catch (e) { console.error('Failed to fetch notes:', e); }
    };

    // Upload any notes left in localStorage by the old version, then remove them.
    const importLocalNotes = async () => {
        let legacy = [];
        try { legacy = JSON.parse(localStorage.getItem(LEGACY_NOTES_KEY)) || []; } catch { legacy = []; }
        if (!Array.isArray(legacy) || legacy.length === 0) return false;
        const payload = legacy
            .filter(n => n && n.title && n.content)
            .map(n => ({
                title: String(n.title).slice(0, 300),
                case_ref: n.caseRef ? String(n.caseRef).slice(0, 100) : null,
                content: String(n.content),
                priority: ['low', 'normal', 'high'].includes(n.priority) ? n.priority : 'normal',
                created_at: n.createdAt || null,
                updated_at: n.updatedAt || null,
            }));
        try {
            const res = await apiFetch(`/api/v1/notes/import`, { method: 'POST', headers, body: JSON.stringify({ notes: payload }) });
            if (!res.ok) return false;  // keep localStorage intact so nothing is lost
            localStorage.removeItem(LEGACY_NOTES_KEY);
            setNotes((await res.json()).map(toNote));
            return true;
        } catch (e) { console.error('Failed to import local notes:', e); return false; }
    };

    const loadNotes = async () => {
        if (!(await importLocalNotes())) await fetchNotes();
    };

    const fetchHearings = async () => {
        try {
            const res = await apiFetch(`/api/v1/hearings`, { headers });
            if (res.ok) {
                const data = await res.json();
                setHearings(data.map(h => ({
                    id: h.id, caseTitle: h.case_title, caseNumber: h.case_number || '', matterId: h.matter_id ? String(h.matter_id) : '',
                    court: h.court || '', date: h.hearing_date, time: h.hearing_time || '',
                    notes: h.notes || '', notifyPhone: h.notify_phone || '', status: h.status,
                })));
            }
        } catch (e) { console.error('Failed to fetch hearings:', e); }
    };

    const handleAddHearing = async (e) => {
        e.preventDefault();
        if (!hForm.caseTitle || !hForm.date) return;
        const body = { case_title: hForm.caseTitle, case_number: hForm.caseNumber, court: hForm.court, hearing_date: hForm.date, hearing_time: hForm.time || null, notes: hForm.notes || null, notify_phone: hForm.notifyPhone || null, matter_id: hForm.matterId ? Number(hForm.matterId) : null };
        try {
            if (editingHearing !== null) {
                await apiFetch(`/api/v1/hearings/${editingHearing}`, { method: 'PUT', headers, body: JSON.stringify(body) });
                setEditingHearing(null);
            } else {
                await apiFetch(`/api/v1/hearings`, { method: 'POST', headers, body: JSON.stringify(body) });
            }
            fetchHearings();
        } catch (e) { console.error('Failed to save hearing:', e); }
        setHForm({ caseTitle: '', caseNumber: '', court: '', date: '', time: '', notes: '', notifyPhone: '', matterId: '' });
        setShowAddHearing(false);
    };

    const deleteHearing = async (id) => {
        try { await apiFetch(`/api/v1/hearings/${id}`, { method: 'DELETE', headers }); fetchHearings(); }
        catch (e) { console.error('Failed to delete:', e); }
    };
    const toggleHearingStatus = async (id) => {
        const h = hearings.find(x => x.id === id);
        const newStatus = h.status === 'completed' ? 'upcoming' : 'completed';
        try { await apiFetch(`/api/v1/hearings/${id}`, { method: 'PUT', headers, body: JSON.stringify({ status: newStatus }) }); fetchHearings(); }
        catch (e) { console.error(e); }
    };
    // Edit by id: the list is rendered filtered + sorted, so a list index does not
    // match the position in `hearings`/`notes` and would open the wrong item.
    const editHearing = (id) => {
        const h = hearings.find(x => x.id === id);
        if (!h) return;
        setHForm({ caseTitle: h.caseTitle, caseNumber: h.caseNumber, court: h.court, date: h.date, time: h.time, notes: h.notes, notifyPhone: h.notifyPhone || '', matterId: h.matterId || '' });
        setEditingHearing(id);
        setShowAddHearing(true);
    };

    const handleAddNote = async (e) => {
        e.preventDefault();
        if (!nForm.title || !nForm.content) return;
        const body = { title: nForm.title, case_ref: nForm.caseRef || null, content: nForm.content, priority: nForm.priority };
        try {
            const res = editingNote !== null
                ? await apiFetch(`/api/v1/notes/${editingNote}`, { method: 'PUT', headers, body: JSON.stringify(body) })
                : await apiFetch(`/api/v1/notes`, { method: 'POST', headers, body: JSON.stringify(body) });
            if (!res.ok) { alert(t('Could not save the note. Please try again.')); return; }
            await fetchNotes();
        } catch (e) { console.error('Failed to save note:', e); alert(t('Could not save the note. Check your connection.')); return; }
        setEditingNote(null);
        setNForm({ title: '', caseRef: '', content: '', priority: 'normal' });
        setShowAddNote(false);
    };

    const deleteNote = async (id) => {
        try {
            const res = await apiFetch(`/api/v1/notes/${id}`, { method: 'DELETE', headers });
            if (res.ok) setNotes(prev => prev.filter(n => n.id !== id));
        } catch (e) { console.error('Failed to delete note:', e); }
    };
    const editNote = (id) => {
        const n = notes.find(x => x.id === id);
        if (!n) return;
        setNForm({ title: n.title, caseRef: n.caseRef, content: n.content, priority: n.priority });
        setEditingNote(id);
        setShowAddNote(true);
    };

    const filteredHearings = hearings
        .filter(h => !search || h.caseTitle.toLowerCase().includes(search.toLowerCase()) || h.caseNumber.toLowerCase().includes(search.toLowerCase()))
        .sort((a, b) => new Date(a.date) - new Date(b.date));

    const filteredNotes = notes
        .filter(n => !search || n.title.toLowerCase().includes(search.toLowerCase()) || n.content.toLowerCase().includes(search.toLowerCase()))
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    const upcomingCount = hearings.filter(h => h.status !== 'completed' && new Date(h.date) >= new Date()).length;
    const todayCount = hearings.filter(h => h.date === new Date().toISOString().split('T')[0]).length;
    const completedCount = hearings.filter(h => h.status === 'completed').length;
    const isOverdue = (date) => new Date(date) < new Date() && new Date(date).toDateString() !== new Date().toDateString();

    const priorityLook = {
        high: { chip: 'bg-red-50 text-red-700 ring-red-200', bar: 'bg-red-400' },
        normal: { chip: 'bg-ink-50 text-ink-800 ring-ink-200', bar: 'bg-ink-400' },
        low: { chip: 'bg-paper-200 text-slate-600 ring-line-strong', bar: 'bg-slate-300' },
    };
    const todayStr = new Date().toISOString().split('T')[0];
    const closeHearing = () => { setShowAddHearing(false); setEditingHearing(null); };
    const closeNote = () => { setShowAddNote(false); setEditingNote(null); };

    const stats = [
        { val: hearings.length, label: t('Total'), icon: ListChecks, chip: 'bg-paper-200 text-ink-700 ring-line' },
        { val: upcomingCount, label: t('Upcoming'), icon: CalendarClock, chip: 'bg-ink-50 text-ink-700 ring-ink-100' },
        { val: todayCount, label: t('Today'), icon: Sun, chip: 'bg-amber-50 text-gold-700 ring-amber-100' },
        { val: completedCount, label: t('Completed'), icon: CalendarCheck2, chip: 'bg-emerald-50 text-emerald-700 ring-emerald-100' },
    ];

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-paper-100">
            <PageHeader icon={CalendarDays} title={t('Case Diary & Notes')}
                subtitle={`${t('{n} upcoming', { n: upcomingCount })} · ${t('{n} today', { n: todayCount })} · ${notes.length === 1 ? t('1 note') : t('{n} notes', { n: notes.length })}`}>
                <div className="relative hidden md:block">
                    <Search size={15} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder={t('Search…')}
                        className={`${inputClass} !w-56 ps-9`} />
                </div>
                <Button icon={Plus} onClick={() => activeTab === 'hearings' ? setShowAddHearing(true) : setShowAddNote(true)}>
                    {activeTab === 'hearings' ? t('Add Hearing') : t('Add Note')}
                </Button>
            </PageHeader>

            <div className="flex-1 overflow-y-auto">
                <div className="max-w-5xl mx-auto px-6 lg:px-8 py-7 space-y-6">
                    {/* stats */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {stats.map(st => (
                            <div key={st.label} className="flex items-center gap-4 p-4 rounded-2xl bg-white border border-line shadow-soft">
                                <span className={`w-11 h-11 rounded-xl ring-1 flex items-center justify-center flex-shrink-0 ${st.chip}`}><st.icon size={18} /></span>
                                <div className="min-w-0">
                                    <div className="text-[24px] leading-none font-semibold tabular-nums text-ink-950">{st.val}</div>
                                    <div className="text-[12.5px] text-slate-500 mt-1 truncate">{st.label}</div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* tabs */}
                    <div className="flex items-center justify-between gap-3">
                        <Tabs value={activeTab} onChange={setActiveTab} options={[
                            { value: 'hearings', label: <span className="inline-flex items-center gap-2"><CalendarDays size={14} />{t('Hearings')}<span className="text-[11px] tabular-nums text-slate-400">{hearings.length}</span></span> },
                            { value: 'notes', label: <span className="inline-flex items-center gap-2"><StickyNote size={14} />{t('Notes')}<span className="text-[11px] tabular-nums text-slate-400">{notes.length}</span></span> },
                        ]} />
                        <div className="relative md:hidden">
                            <Search size={15} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder={t('Search…')} className={`${inputClass} !w-44 ps-9`} />
                        </div>
                    </div>

                    {activeTab === 'hearings' ? (
                        filteredHearings.length === 0 ? (
                            <div className="rounded-2xl bg-white border border-line shadow-soft">
                                <EmptyState icon={CalendarDays} title={t('No Hearings Scheduled')} text={t('Click "Add Hearing" to schedule your first court date.')}
                                    action={<Button icon={Plus} onClick={() => setShowAddHearing(true)}>{t('Add Hearing')}</Button>} />
                            </div>
                        ) : (
                            <ul className="space-y-3">
                                {filteredHearings.map((h) => {
                                    const d = new Date(h.date + 'T00:00:00');
                                    const done = h.status === 'completed';
                                    const overdue = !done && isOverdue(h.date);
                                    const today = !done && h.date === todayStr;
                                    const tile = done ? ['bg-emerald-600 text-white', 'bg-emerald-50 text-emerald-700', 'ring-emerald-200']
                                        : overdue ? ['bg-red-500 text-white', 'bg-red-50 text-red-700', 'ring-red-200']
                                            : today ? ['bg-gold-500 text-white', 'bg-amber-50 text-gold-700', 'ring-amber-200']
                                                : ['bg-ink-900 text-gold-300', 'bg-white text-ink-950', 'ring-line'];
                                    return (
                                        <li key={h.id} className={`group relative flex items-stretch gap-4 p-4 rounded-2xl bg-white border shadow-soft hover:shadow-lift hover:border-line-strong transition-all duration-200 animate-slide-up ${overdue ? 'border-red-200' : today ? 'border-amber-200' : 'border-line'}`}>
                                            <div className={`w-[58px] flex-shrink-0 self-start text-center rounded-xl overflow-hidden ring-1 ${tile[2]}`}>
                                                <div className={`text-[10px] font-bold uppercase tracking-wider py-1 ${tile[0]}`}>{d.toLocaleDateString(dateLocale, { month: 'short' })}</div>
                                                <div className={`text-[22px] font-bold leading-none pt-1.5 tabular-nums ${tile[1]}`}>{d.getDate()}</div>
                                                <div className={`text-[10px] font-medium pb-1.5 pt-0.5 ${tile[1]} opacity-70`}>{d.toLocaleDateString(dateLocale, { weekday: 'short' })}</div>
                                            </div>
                                            <div className="flex-1 min-w-0 py-0.5">
                                                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                                                    <h4 dir="auto" className={`text-[15px] font-semibold ${done ? 'text-slate-400 line-through' : 'text-ink-950'}`}>{h.caseTitle}</h4>
                                                    {overdue && <span className="inline-flex items-center gap-1.5 h-[22px] px-2 rounded-full ring-1 ring-inset ring-red-200 bg-red-50 text-red-700 text-[11px] font-semibold"><span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />{t('OVERDUE')}</span>}
                                                    {today && <span className="inline-flex items-center gap-1.5 h-[22px] px-2 rounded-full ring-1 ring-inset ring-amber-200 bg-amber-50 text-amber-800 text-[11px] font-semibold"><span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />{t('TODAY')}</span>}
                                                    {done && <span className="inline-flex items-center gap-1 h-[22px] px-2 rounded-full ring-1 ring-inset ring-emerald-200 bg-emerald-50 text-emerald-700 text-[11px] font-semibold capitalize"><Check size={11} />{t('completed')}</span>}
                                                </div>
                                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12.5px] text-slate-500">
                                                    {h.caseNumber && <span className="inline-flex items-center gap-1 h-6 px-2 rounded-md bg-paper-100 ring-1 ring-line text-[11.5px] font-semibold tracking-wide text-ink-800 tabular-nums ltr"><Hash size={11} className="text-slate-400" />{h.caseNumber}</span>}
                                                    {h.time && <span className="inline-flex items-center gap-1.5"><Clock size={13} className="text-slate-400" /><span className="ltr">{h.time}</span></span>}
                                                    {h.court && <span className="inline-flex items-center gap-1.5"><MapPin size={13} className="text-slate-400" /><span dir="auto">{h.court}</span></span>}
                                                </div>
                                                {h.notes && <p dir="auto" className="text-[13px] text-slate-600 mt-2.5 line-clamp-2 leading-relaxed ps-3 border-s-2 border-gold-300/70">{h.notes}</p>}
                                            </div>
                                            <div className="flex flex-col items-end justify-between gap-2">
                                                <button onClick={() => toggleHearingStatus(h.id)} title={done ? t('Mark as upcoming') : t('Mark as completed')} aria-label={done ? t('Mark as upcoming') : t('Mark as completed')}
                                                    className={`w-8 h-8 rounded-full ring-1 flex items-center justify-center transition-all ${done ? 'bg-emerald-500 ring-emerald-500 text-white shadow-[0_4px_12px_-4px_rgba(16,185,129,0.6)]' : 'bg-white ring-line-strong text-transparent hover:ring-emerald-400 hover:text-emerald-500'}`}>
                                                    <Check size={15} strokeWidth={2.5} />
                                                </button>
                                                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                                                    <button onClick={() => editHearing(h.id)} title={t('Edit')} aria-label={t('Edit')} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-paper-200 text-slate-400 hover:text-ink-950 transition-colors"><Edit3 size={14} /></button>
                                                    <button onClick={() => deleteHearing(h.id)} title={t('Delete')} aria-label={t('Delete')} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"><Trash2 size={14} /></button>
                                                </div>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        )
                    ) : (
                        filteredNotes.length === 0 ? (
                            <div className="rounded-2xl bg-white border border-line shadow-soft">
                                <EmptyState icon={StickyNote} title={t('No Notes Yet')} text={t('Click "Add Note" to create your first case note.')}
                                    action={<Button icon={Plus} onClick={() => setShowAddNote(true)}>{t('Add Note')}</Button>} />
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {filteredNotes.map((n) => {
                                    const look = priorityLook[n.priority] || priorityLook.normal;
                                    return (
                                        <article key={n.id} className="group relative overflow-hidden p-5 ps-6 rounded-2xl bg-white border border-line shadow-soft hover:shadow-lift hover:-translate-y-0.5 hover:border-line-strong transition-all duration-200 animate-slide-up">
                                            <span className={`absolute start-0 top-0 bottom-0 w-1 ${look.bar}`} />
                                            <div className="flex items-start justify-between gap-3 mb-3">
                                                <div className="min-w-0">
                                                    <h4 dir="auto" className="text-[15px] font-semibold text-ink-950 mb-1.5 group-hover:text-gold-700 transition-colors">{n.title}</h4>
                                                    {n.caseRef && <span className="inline-flex items-center gap-1 h-6 px-2 rounded-md bg-paper-100 ring-1 ring-line text-[11.5px] font-semibold tracking-wide text-ink-800 tabular-nums ltr"><Hash size={11} className="text-slate-400" />{n.caseRef}</span>}
                                                </div>
                                                <span className={`inline-flex items-center h-[22px] px-2 rounded-full ring-1 ring-inset text-[11px] font-semibold flex-shrink-0 ${look.chip}`}>{t(n.priority)}</span>
                                            </div>
                                            <p dir="auto" className="text-[13.5px] text-slate-600 leading-relaxed whitespace-pre-wrap line-clamp-6">{n.content}</p>
                                            <div className="flex items-center justify-between gap-2 mt-4 pt-3 border-t border-line">
                                                <span className="text-[11.5px] text-slate-400">{t('Updated {date}', { date: new Date(n.updatedAt).toLocaleDateString(dateLocale, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) })}</span>
                                                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                                                    <button onClick={() => editNote(n.id)} title={t('Edit')} aria-label={t('Edit')} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-paper-200 text-slate-400 hover:text-ink-950 transition-colors"><Edit3 size={13} /></button>
                                                    <button onClick={() => deleteNote(n.id)} title={t('Delete')} aria-label={t('Delete')} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"><Trash2 size={13} /></button>
                                                </div>
                                            </div>
                                        </article>
                                    );
                                })}
                            </div>
                        )
                    )}
                </div>
            </div>

            {/* ── Add / edit hearing ── */}
            {showAddHearing && (
                <Modal title={editingHearing !== null ? t('Edit Hearing') : t('Schedule Hearing')} onClose={closeHearing}
                    footer={<>
                        <Button variant="secondary" type="button" onClick={closeHearing}>{t('Cancel')}</Button>
                        <Button type="submit" form="hearing-form" icon={Save}>{editingHearing !== null ? t('Save Changes') : t('Schedule Hearing')}</Button>
                    </>}>
                    <form id="hearing-form" onSubmit={handleAddHearing} className="space-y-4">
                        {matters.length > 0 && (
                            <Field label={t('Client case')} hint={t('Linking the hearing to a case shows it to the client if you share that case.')}>
                                <select value={hForm.matterId} className={inputClass}
                                    onChange={e => { const m = matters.find(x => String(x.id) === e.target.value); setHForm(f => ({ ...f, matterId: e.target.value, caseTitle: m && !f.caseTitle ? m.title : f.caseTitle, caseNumber: m && !f.caseNumber ? (m.case_number || '') : f.caseNumber, court: m && !f.court ? (m.court || '') : f.court })); }}>
                                    <option value="">{t('Not linked to a case')}</option>
                                    {matters.map(m => <option key={m.id} value={m.id}>{m.client_name} — {m.title}</option>)}
                                </select>
                            </Field>
                        )}
                        <Field label={t('Case Title *')}>
                            <input required value={hForm.caseTitle} onChange={e => setHForm(f => ({ ...f, caseTitle: e.target.value }))} className={inputClass} />
                        </Field>
                        <div className="grid grid-cols-2 gap-3">
                            <Field label={t('Case Number')}>
                                <input value={hForm.caseNumber} onChange={e => setHForm(f => ({ ...f, caseNumber: e.target.value }))} className={inputClass} />
                            </Field>
                            <Field label={t('Court Name')}>
                                <input value={hForm.court} onChange={e => setHForm(f => ({ ...f, court: e.target.value }))} className={inputClass} />
                            </Field>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <Field label={t('Date')}>
                                <input required type="date" value={hForm.date} onChange={e => setHForm(f => ({ ...f, date: e.target.value }))} className={inputClass} />
                            </Field>
                            <Field label={t('Time')}>
                                <input type="time" value={hForm.time} onChange={e => setHForm(f => ({ ...f, time: e.target.value }))} className={inputClass} />
                            </Field>
                        </div>
                        <Field label={t('WhatsApp reminders')} hint={t('Reminders go to this number; leave empty to use your profile number.')}>
                            <input type="tel" value={hForm.notifyPhone} onChange={e => setHForm(f => ({ ...f, notifyPhone: e.target.value }))} placeholder={t('WhatsApp No. for reminders (e.g. 03XXXXXXXXX)')} className={inputClass} />
                        </Field>
                        <Field label={t('Notes (optional)')}>
                            <textarea value={hForm.notes} onChange={e => setHForm(f => ({ ...f, notes: e.target.value }))} rows={3} className={textareaClass} />
                        </Field>
                    </form>
                </Modal>
            )}

            {/* ── Add / edit note ── */}
            {showAddNote && (
                <Modal title={editingNote !== null ? t('Edit Note') : t('Add Note')} onClose={closeNote}
                    footer={<>
                        <Button variant="secondary" type="button" onClick={closeNote}>{t('Cancel')}</Button>
                        <Button type="submit" form="note-form" icon={Save}>{editingNote !== null ? t('Save Changes') : t('Add Note')}</Button>
                    </>}>
                    <form id="note-form" onSubmit={handleAddNote} className="space-y-4">
                        <Field label={t('Note Title *')}>
                            <input required value={nForm.title} onChange={e => setNForm(f => ({ ...f, title: e.target.value }))} className={inputClass} />
                        </Field>
                        <div className="grid grid-cols-2 gap-3">
                            <Field label={t('Case Reference (optional)')}>
                                <input value={nForm.caseRef} onChange={e => setNForm(f => ({ ...f, caseRef: e.target.value }))} className={inputClass} />
                            </Field>
                            <Field label={t('Priority')}>
                                <select value={nForm.priority} onChange={e => setNForm(f => ({ ...f, priority: e.target.value }))} className={inputClass}>
                                    <option value="low">{t('Low Priority')}</option>
                                    <option value="normal">{t('Normal Priority')}</option>
                                    <option value="high">{t('High Priority')}</option>
                                </select>
                            </Field>
                        </div>
                        <Field label={t('Note content *')}>
                            <textarea required value={nForm.content} onChange={e => setNForm(f => ({ ...f, content: e.target.value }))} rows={6} className={textareaClass} />
                        </Field>
                    </form>
                </Modal>
            )}
        </div>
    );
}
