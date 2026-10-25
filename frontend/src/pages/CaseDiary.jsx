import React, { useState, useEffect } from 'react';
import {
    CalendarDays, Plus, Clock, MapPin, FileText, Trash2, Edit3,
    AlertCircle, CheckCircle, Bell, Search, ChevronDown, X, Save, StickyNote,
    Scale, Gavel, Filter, LayoutGrid, List
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const STORAGE_KEY_NOTES = 'justiceai_notes';

function loadFromStorage(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; }
}

export default function CaseDiary() {
    const [activeTab, setActiveTab] = useState('hearings');
    const [hearings, setHearings] = useState([]);
    const [notes, setNotes] = useState(() => loadFromStorage(STORAGE_KEY_NOTES, []));
    const [showAddHearing, setShowAddHearing] = useState(false);
    const [showAddNote, setShowAddNote] = useState(false);
    const [search, setSearch] = useState('');
    const [editingHearing, setEditingHearing] = useState(null);
    const [editingNote, setEditingNote] = useState(null);

    const [hForm, setHForm] = useState({ caseTitle: '', caseNumber: '', court: '', date: '', time: '', notes: '' });
    const [nForm, setNForm] = useState({ title: '', caseRef: '', content: '', priority: 'normal' });

    const token = localStorage.getItem('justiceai_token');
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

    useEffect(() => { fetchHearings(); }, []);
    useEffect(() => { localStorage.setItem(STORAGE_KEY_NOTES, JSON.stringify(notes)); }, [notes]);

    const fetchHearings = async () => {
        try {
            const res = await fetch(`${API}/api/v1/hearings`, { headers });
            if (res.ok) {
                const data = await res.json();
                setHearings(data.map(h => ({
                    id: h.id, caseTitle: h.case_title, caseNumber: h.case_number || '',
                    court: h.court || '', date: h.hearing_date, time: h.hearing_time || '',
                    notes: h.notes || '', status: h.status,
                })));
            }
        } catch (e) { console.error('Failed to fetch hearings:', e); }
    };

    const handleAddHearing = async (e) => {
        e.preventDefault();
        if (!hForm.caseTitle || !hForm.date) return;
        const body = { case_title: hForm.caseTitle, case_number: hForm.caseNumber, court: hForm.court, hearing_date: hForm.date, hearing_time: hForm.time || null, notes: hForm.notes || null };
        try {
            if (editingHearing !== null) {
                const h = hearings[editingHearing];
                await fetch(`${API}/api/v1/hearings/${h.id}`, { method: 'PUT', headers, body: JSON.stringify(body) });
                setEditingHearing(null);
            } else {
                await fetch(`${API}/api/v1/hearings`, { method: 'POST', headers, body: JSON.stringify(body) });
            }
            fetchHearings();
        } catch (e) { console.error('Failed to save hearing:', e); }
        setHForm({ caseTitle: '', caseNumber: '', court: '', date: '', time: '', notes: '' });
        setShowAddHearing(false);
    };

    const deleteHearing = async (id) => {
        try { await fetch(`${API}/api/v1/hearings/${id}`, { method: 'DELETE', headers }); fetchHearings(); }
        catch (e) { console.error('Failed to delete:', e); }
    };
    const toggleHearingStatus = async (id) => {
        const h = hearings.find(x => x.id === id);
        const newStatus = h.status === 'completed' ? 'upcoming' : 'completed';
        try { await fetch(`${API}/api/v1/hearings/${id}`, { method: 'PUT', headers, body: JSON.stringify({ status: newStatus }) }); fetchHearings(); }
        catch (e) { console.error(e); }
    };
    const editHearing = (idx) => {
        const h = hearings[idx];
        setHForm({ caseTitle: h.caseTitle, caseNumber: h.caseNumber, court: h.court, date: h.date, time: h.time, notes: h.notes });
        setEditingHearing(idx);
        setShowAddHearing(true);
    };

    const handleAddNote = (e) => {
        e.preventDefault();
        if (!nForm.title || !nForm.content) return;
        if (editingNote !== null) {
            setNotes(prev => prev.map((n, i) => i === editingNote ? { ...nForm, id: n.id, createdAt: n.createdAt, updatedAt: new Date().toISOString() } : n));
            setEditingNote(null);
        } else {
            setNotes(prev => [...prev, { ...nForm, id: Date.now(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }]);
        }
        setNForm({ title: '', caseRef: '', content: '', priority: 'normal' });
        setShowAddNote(false);
    };

    const deleteNote = (id) => setNotes(prev => prev.filter(n => n.id !== id));
    const editNote = (idx) => {
        const n = notes[idx];
        setNForm({ title: n.title, caseRef: n.caseRef, content: n.content, priority: n.priority });
        setEditingNote(idx);
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

    const priorityColors = {
        high: 'bg-red-500/10 text-red-400 border-red-500/20',
        normal: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
        low: 'bg-slate-500/10 text-slate-400 border-slate-500/20'
    };

    const inputClass = "w-full px-4 py-3.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-gold-500/40 focus:ring-1 focus:ring-gold-500/10 transition-all";

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#0a0f1e]">
            {/* ── Header ── */}
            <div className="flex items-center justify-between px-6 h-[68px] border-b border-white/5 bg-[#0a0f1e]/80 backdrop-blur-xl flex-shrink-0">
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <div className="absolute inset-0 bg-indigo-500/20 blur-lg rounded-xl animate-pulse-slow" />
                        <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                            <CalendarDays size={20} className="text-white" />
                        </div>
                    </div>
                    <div>
                        <h2 className="text-sm font-bold text-white">Case Diary & Notes</h2>
                        <p className="text-[11px] text-slate-500 font-medium">
                            {upcomingCount} upcoming · {todayCount} today · {notes.length} note{notes.length !== 1 && 's'}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
                        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                            placeholder="Search..."
                            className="pl-8 pr-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white w-48 focus:outline-none focus:border-gold-500/40 focus:ring-1 focus:ring-gold-500/10 placeholder:text-slate-600 transition-all" />
                    </div>
                </div>
            </div>

            {/* ── Stats Strip ── */}
            <div className="grid grid-cols-4 gap-3 px-6 py-4 border-b border-white/5">
                {[
                    { val: hearings.length, label: 'Total', color: 'text-white', bg: 'from-slate-500/10 to-slate-600/5' },
                    { val: upcomingCount, label: 'Upcoming', color: 'text-indigo-400', bg: 'from-indigo-500/10 to-indigo-600/5' },
                    { val: todayCount, label: 'Today', color: 'text-gold-400', bg: 'from-gold-500/10 to-amber-600/5' },
                    { val: completedCount, label: 'Completed', color: 'text-emerald-400', bg: 'from-emerald-500/10 to-emerald-600/5' },
                ].map((s, i) => (
                    <div key={i} className={`p-3 rounded-xl bg-gradient-to-br ${s.bg} border border-white/[0.04] text-center`}>
                        <div className={`text-2xl font-black ${s.color}`}>{s.val}</div>
                        <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mt-0.5">{s.label}</div>
                    </div>
                ))}
            </div>

            {/* ── Tabs ── */}
            <div className="flex items-center gap-2 px-6 py-3 border-b border-white/5">
                {[
                    { key: 'hearings', icon: CalendarDays, label: 'Hearings' },
                    { key: 'notes', icon: StickyNote, label: 'Notes' },
                ].map(tab => (
                    <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300
                            ${activeTab === tab.key
                                ? 'bg-gradient-to-r from-gold-500 to-amber-600 text-white shadow-lg shadow-gold-500/20'
                                : 'text-slate-500 hover:text-white hover:bg-white/5'}`}>
                        <tab.icon size={16} />
                        {tab.label}
                    </button>
                ))}
                <div className="flex-1" />
                <button
                    onClick={() => activeTab === 'hearings' ? setShowAddHearing(true) : setShowAddNote(true)}
                    className="group flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-white/[0.04] border border-white/[0.08] text-white hover:bg-white/[0.08] hover:border-gold-500/30 transition-all duration-300">
                    <Plus size={16} className="text-gold-400 group-hover:rotate-90 transition-transform duration-300" />
                    Add {activeTab === 'hearings' ? 'Hearing' : 'Note'}
                </button>
            </div>

            {/* ── Content ── */}
            <div className="flex-1 overflow-y-auto p-6">
                {activeTab === 'hearings' ? (
                    <div className="max-w-4xl mx-auto space-y-3">
                        {filteredHearings.length === 0 ? (
                            <div className="text-center py-24 animate-fade-in">
                                <div className="relative inline-block mb-6">
                                    <div className="absolute inset-0 bg-indigo-500/10 blur-2xl rounded-full scale-150" />
                                    <CalendarDays size={56} className="relative text-slate-600" />
                                </div>
                                <h3 className="text-xl font-bold text-white mb-2">No Hearings Scheduled</h3>
                                <p className="text-sm text-slate-500 mb-6">Click "Add Hearing" to schedule your first court date.</p>
                            </div>
                        ) : filteredHearings.map((h, idx) => (
                            <div key={h.id}
                                className={`group flex items-start gap-4 p-5 rounded-2xl border backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl animate-slide-up
                                    ${h.status === 'completed'
                                        ? 'bg-emerald-500/5 border-emerald-500/15 hover:shadow-emerald-500/5'
                                        : isOverdue(h.date)
                                            ? 'bg-red-500/5 border-red-500/15 hover:shadow-red-500/5'
                                            : 'bg-white/[0.03] border-white/[0.06] hover:border-white/15 hover:shadow-white/5'}`}>
                                <button onClick={() => toggleHearingStatus(h.id)}
                                    className={`mt-0.5 w-7 h-7 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all duration-300
                                        ${h.status === 'completed'
                                            ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                                            : 'border-slate-600 hover:border-gold-400 hover:shadow-gold-400/20'}`}>
                                    {h.status === 'completed' && <CheckCircle size={14} />}
                                </button>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1.5">
                                        <h4 className={`font-bold text-sm ${h.status === 'completed' ? 'text-slate-500 line-through' : 'text-white'}`}>{h.caseTitle}</h4>
                                        {isOverdue(h.date) && h.status !== 'completed' && (
                                            <span className="text-[10px] font-bold text-red-400 bg-red-500/15 border border-red-500/20 px-2 py-0.5 rounded-full animate-pulse">OVERDUE</span>
                                        )}
                                        {h.date === new Date().toISOString().split('T')[0] && h.status !== 'completed' && (
                                            <span className="text-[10px] font-bold text-gold-400 bg-gold-500/15 border border-gold-500/20 px-2 py-0.5 rounded-full">TODAY</span>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                                        {h.caseNumber && <span className="font-mono bg-white/5 px-2 py-0.5 rounded border border-white/5">{h.caseNumber}</span>}
                                        <span className="flex items-center gap-1"><CalendarDays size={12} />{new Date(h.date).toLocaleDateString('en-PK', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                        {h.time && <span className="flex items-center gap-1"><Clock size={12} />{h.time}</span>}
                                        {h.court && <span className="flex items-center gap-1"><MapPin size={12} />{h.court}</span>}
                                    </div>
                                    {h.notes && <p className="text-xs text-slate-500 mt-2 line-clamp-2 leading-relaxed">{h.notes}</p>}
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                    <button onClick={() => editHearing(idx)} className="p-2 rounded-xl hover:bg-white/5 text-slate-500 hover:text-white transition-all"><Edit3 size={14} /></button>
                                    <button onClick={() => deleteHearing(h.id)} className="p-2 rounded-xl hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-all"><Trash2 size={14} /></button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4">
                        {filteredNotes.length === 0 ? (
                            <div className="col-span-2 text-center py-24 animate-fade-in">
                                <div className="relative inline-block mb-6">
                                    <div className="absolute inset-0 bg-gold-500/10 blur-2xl rounded-full scale-150" />
                                    <StickyNote size={56} className="relative text-slate-600" />
                                </div>
                                <h3 className="text-xl font-bold text-white mb-2">No Notes Yet</h3>
                                <p className="text-sm text-slate-500 mb-6">Click "Add Note" to create your first case note.</p>
                            </div>
                        ) : filteredNotes.map((n, idx) => (
                            <div key={n.id}
                                className="group p-5 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:border-white/15 hover:bg-white/[0.05] hover:-translate-y-1 hover:shadow-xl transition-all duration-300 animate-slide-up">
                                <div className="flex items-start justify-between mb-3">
                                    <div>
                                        <h4 className="font-bold text-sm text-white mb-1 group-hover:text-gold-400 transition-colors">{n.title}</h4>
                                        {n.caseRef && <span className="text-[11px] font-mono bg-white/5 text-slate-500 px-2 py-0.5 rounded border border-white/5">{n.caseRef}</span>}
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${priorityColors[n.priority]}`}>{n.priority}</span>
                                        <div className="flex opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                            <button onClick={() => editNote(idx)} className="p-1.5 rounded-lg hover:bg-white/5 text-slate-500 hover:text-white transition-all"><Edit3 size={13} /></button>
                                            <button onClick={() => deleteNote(n.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-all"><Trash2 size={13} /></button>
                                        </div>
                                    </div>
                                </div>
                                <p className="text-sm text-slate-400 leading-relaxed whitespace-pre-wrap line-clamp-6">{n.content}</p>
                                <p className="text-[11px] text-slate-600 mt-3">Updated {new Date(n.updatedAt).toLocaleDateString('en-PK', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* ── Add Hearing Modal ── */}
            {showAddHearing && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 animate-fade-in" onClick={() => { setShowAddHearing(false); setEditingHearing(null); }}>
                    <form onClick={e => e.stopPropagation()} onSubmit={handleAddHearing}
                        className="bg-[#111827] border border-white/10 rounded-3xl shadow-2xl shadow-black/50 w-full max-w-md p-7 animate-slide-up">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                                    <Gavel size={20} className="text-white" />
                                </div>
                                <h3 className="text-lg font-bold text-white">{editingHearing !== null ? 'Edit Hearing' : 'Schedule Hearing'}</h3>
                            </div>
                            <button type="button" onClick={() => { setShowAddHearing(false); setEditingHearing(null); }}
                                className="p-2 rounded-xl hover:bg-white/5 text-slate-400 hover:text-white transition-all"><X size={18} /></button>
                        </div>
                        <div className="space-y-3">
                            <input required value={hForm.caseTitle} onChange={e => setHForm(f => ({ ...f, caseTitle: e.target.value }))} placeholder="Case Title *" className={inputClass} />
                            <input value={hForm.caseNumber} onChange={e => setHForm(f => ({ ...f, caseNumber: e.target.value }))} placeholder="Case Number" className={inputClass} />
                            <input value={hForm.court} onChange={e => setHForm(f => ({ ...f, court: e.target.value }))} placeholder="Court Name" className={inputClass} />
                            <div className="grid grid-cols-2 gap-3">
                                <input required type="date" value={hForm.date} onChange={e => setHForm(f => ({ ...f, date: e.target.value }))} className={inputClass} />
                                <input type="time" value={hForm.time} onChange={e => setHForm(f => ({ ...f, time: e.target.value }))} className={inputClass} />
                            </div>
                            <textarea value={hForm.notes} onChange={e => setHForm(f => ({ ...f, notes: e.target.value }))} placeholder="Notes (optional)" rows={3} className={`${inputClass} resize-none`} />
                        </div>
                        <button type="submit"
                            className="mt-6 w-full py-3.5 rounded-xl bg-gradient-to-r from-gold-500 to-amber-600 hover:from-gold-400 hover:to-amber-500 text-white font-bold text-sm shadow-lg shadow-gold-500/20 hover:shadow-gold-500/30 transition-all flex items-center justify-center gap-2">
                            <Save size={16} />
                            {editingHearing !== null ? 'Save Changes' : 'Schedule Hearing'}
                        </button>
                    </form>
                </div>
            )}

            {/* ── Add Note Modal ── */}
            {showAddNote && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 animate-fade-in" onClick={() => { setShowAddNote(false); setEditingNote(null); }}>
                    <form onClick={e => e.stopPropagation()} onSubmit={handleAddNote}
                        className="bg-[#111827] border border-white/10 rounded-3xl shadow-2xl shadow-black/50 w-full max-w-md p-7 animate-slide-up">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gold-500 to-amber-600 flex items-center justify-center shadow-lg shadow-gold-500/20">
                                    <StickyNote size={20} className="text-white" />
                                </div>
                                <h3 className="text-lg font-bold text-white">{editingNote !== null ? 'Edit Note' : 'Add Note'}</h3>
                            </div>
                            <button type="button" onClick={() => { setShowAddNote(false); setEditingNote(null); }}
                                className="p-2 rounded-xl hover:bg-white/5 text-slate-400 hover:text-white transition-all"><X size={18} /></button>
                        </div>
                        <div className="space-y-3">
                            <input required value={nForm.title} onChange={e => setNForm(f => ({ ...f, title: e.target.value }))} placeholder="Note Title *" className={inputClass} />
                            <input value={nForm.caseRef} onChange={e => setNForm(f => ({ ...f, caseRef: e.target.value }))} placeholder="Case Reference (optional)" className={inputClass} />
                            <select value={nForm.priority} onChange={e => setNForm(f => ({ ...f, priority: e.target.value }))} className={inputClass}>
                                <option value="low">Low Priority</option>
                                <option value="normal">Normal Priority</option>
                                <option value="high">High Priority</option>
                            </select>
                            <textarea required value={nForm.content} onChange={e => setNForm(f => ({ ...f, content: e.target.value }))} placeholder="Note content *" rows={5} className={`${inputClass} resize-none`} />
                        </div>
                        <button type="submit"
                            className="mt-6 w-full py-3.5 rounded-xl bg-gradient-to-r from-gold-500 to-amber-600 hover:from-gold-400 hover:to-amber-500 text-white font-bold text-sm shadow-lg shadow-gold-500/20 hover:shadow-gold-500/30 transition-all flex items-center justify-center gap-2">
                            <Save size={16} />
                            {editingNote !== null ? 'Save Changes' : 'Add Note'}
                        </button>
                    </form>
                </div>
            )}
        </div>
    );
}
