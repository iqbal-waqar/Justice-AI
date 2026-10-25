import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    User, Mail, Phone, MapPin, Briefcase, Shield, Camera,
    Save, LogOut, Bell, Calendar, MessageSquare, Edit3, X,
    Scale, Award, Clock, CheckCircle
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function ProfilePage() {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState('');
    const [activeTab, setActiveTab] = useState('profile');

    const [form, setForm] = useState({
        full_name: '', phone: '', city: '',
        bar_council_id: '', specialization: '', notification_email: '',
    });

    const token = localStorage.getItem('justiceai_token');

    useEffect(() => { fetchProfile(); }, []);

    const fetchProfile = async () => {
        try {
            const res = await fetch(`${API}/api/v1/auth/me`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) { navigate('/login'); return; }
            const data = await res.json();
            setUser(data);
            setForm({
                full_name: data.full_name || '',
                phone: data.phone || '',
                city: data.city || '',
                bar_council_id: data.bar_council_id || '',
                specialization: data.specialization || '',
                notification_email: data.notification_email || '',
            });
            localStorage.setItem('justiceai_user', JSON.stringify(data));
        } catch { navigate('/login'); }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await fetch(`${API}/api/v1/auth/profile`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify(form),
            });
            const data = await res.json();
            setUser(data);
            localStorage.setItem('justiceai_user', JSON.stringify(data));
            setEditing(false);
            showToast('✓ Profile updated successfully!');
        } catch { showToast('✗ Failed to update profile'); }
        setSaving(false);
    };

    const handleLogout = () => {
        localStorage.removeItem('justiceai_token');
        localStorage.removeItem('justiceai_user');
        navigate('/login');
    };

    const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };
    const update = (key, val) => setForm(f => ({ ...f, [key]: val }));

    const initials = user?.full_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';
    const profilePicUrl = user?.profile_picture || null;

    if (!user) return (
        <div className="flex-1 flex items-center justify-center bg-surface-50">
            <div className="w-10 h-10 border-4 border-gold-500/20 border-t-gold-500 rounded-full animate-spin" />
        </div>
    );

    return (
        <div className="flex-1 overflow-y-auto bg-surface-50">
            {/* Toast */}
            {toast && (
                <div className="fixed top-6 right-6 z-50 px-6 py-3.5 rounded-2xl bg-primary-900 text-white text-sm font-semibold shadow-2xl animate-fade-in border border-white/10 backdrop-blur-sm">
                    {toast}
                </div>
            )}

            {/* ═══ Hero Banner ═══ */}
            <div className="relative h-56 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-primary-900 via-[#1a2744] to-primary-800" />
                {/* Animated orbs */}
                <div className="absolute top-8 left-[15%] w-48 h-48 bg-gold-500/15 rounded-full blur-3xl animate-pulse" />
                <div className="absolute bottom-4 right-[20%] w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl" />
                <div className="absolute top-12 right-[10%] w-32 h-32 bg-amber-400/10 rounded-full blur-2xl" />
                {/* Grid pattern */}
                <div className="absolute inset-0 opacity-5" style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
                }} />
            </div>

            {/* ═══ Main Content ═══ */}
            <div className="max-w-5xl mx-auto px-6 -mt-24 relative z-10 pb-12">

                {/* ─── Profile Header Card ─── */}
                <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
                    <div className="px-8 py-7 flex flex-col sm:flex-row items-start sm:items-center gap-6">
                        {/* Avatar */}
                        <div className="relative group flex-shrink-0">
                            <div className="w-24 h-24 rounded-2xl overflow-hidden ring-4 ring-white shadow-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                                {profilePicUrl ? (
                                    <img src={profilePicUrl} alt={user.full_name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                ) : (
                                    <span className="text-3xl font-black text-white">{initials}</span>
                                )}
                            </div>
                            {/* Online indicator */}
                            <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 rounded-lg border-[3px] border-white shadow-sm" />
                        </div>

                        {/* Name & Info */}
                        <div className="flex-1 min-w-0">
                            <h1 className="text-2xl font-black text-primary-900 tracking-tight">{user.full_name}</h1>
                            <p className="text-sm text-slate-500 mt-0.5">{user.email}</p>
                            <div className="flex flex-wrap items-center gap-2 mt-3">
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-gold-50 to-amber-50 text-gold-700 text-xs font-bold border border-gold-200/60">
                                    <Scale size={12} /> {user.role === 'admin' ? 'Admin' : 'Lawyer'}
                                </span>
                                {user.specialization && (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-bold border border-indigo-100">
                                        <Briefcase size={12} /> {user.specialization}
                                    </span>
                                )}
                                {user.city && (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 text-slate-600 text-xs font-bold border border-slate-100">
                                        <MapPin size={12} /> {user.city}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                            {editing ? (
                                <>
                                    <button onClick={() => setEditing(false)}
                                        className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-600 text-sm font-semibold hover:bg-slate-200 transition-all flex items-center gap-2">
                                        <X size={15} /> Cancel
                                    </button>
                                    <button onClick={handleSave} disabled={saving}
                                        className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-gold-500 to-amber-500 text-white text-sm font-bold shadow-lg shadow-gold-500/25 hover:shadow-gold-500/40 hover:-translate-y-0.5 transition-all flex items-center gap-2 disabled:opacity-50">
                                        {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={15} />}
                                        Save Changes
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button onClick={() => setEditing(true)}
                                        className="px-5 py-2.5 rounded-xl bg-primary-900 text-white text-sm font-bold hover:bg-primary-800 transition-all flex items-center gap-2 shadow-lg shadow-primary-900/20">
                                        <Edit3 size={15} /> Edit Profile
                                    </button>
                                    <button onClick={handleLogout}
                                        className="px-4 py-2.5 rounded-xl bg-red-50 text-red-500 text-sm font-bold hover:bg-red-100 transition-all border border-red-100">
                                        <LogOut size={15} />
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* ─── Stats Cards ─── */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                    {[
                        { icon: MessageSquare, label: 'AI Queries', value: '—', gradient: 'from-indigo-500 to-purple-600', bg: 'bg-indigo-50' },
                        { icon: Calendar, label: 'Hearings', value: '—', gradient: 'from-amber-500 to-orange-500', bg: 'bg-amber-50' },
                        { icon: Award, label: 'Cases', value: '—', gradient: 'from-emerald-500 to-teal-500', bg: 'bg-emerald-50' },
                        { icon: Clock, label: 'Member Since', value: 'Apr 2026', gradient: 'from-slate-600 to-slate-700', bg: 'bg-slate-50' },
                    ].map((s, i) => (
                        <div key={i} className={`${s.bg} rounded-2xl p-5 border border-white shadow-sm hover:shadow-md transition-shadow`}>
                            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.gradient} flex items-center justify-center shadow-lg mb-3`}>
                                <s.icon size={18} className="text-white" />
                            </div>
                            <p className="text-xl font-black text-primary-900">{s.value}</p>
                            <p className="text-xs text-slate-500 font-medium mt-0.5">{s.label}</p>
                        </div>
                    ))}
                </div>

                {/* ─── Profile Details ─── */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
                    {/* Left — Personal Info */}
                    <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                        <div className="px-7 py-5 border-b border-slate-100 flex items-center justify-between">
                            <div>
                                <h3 className="text-base font-bold text-primary-900">Personal Information</h3>
                                <p className="text-xs text-slate-400 mt-0.5">Your professional details</p>
                            </div>
                            {editing && (
                                <span className="px-3 py-1 rounded-full bg-gold-50 text-gold-600 text-xs font-bold border border-gold-100 animate-pulse">
                                    Editing
                                </span>
                            )}
                        </div>
                        <div className="p-7 grid grid-cols-1 md:grid-cols-2 gap-5">
                            <Field icon={User} label="Full Name" value={form.full_name}
                                editing={editing} onChange={v => update('full_name', v)} />
                            <Field icon={Mail} label="Email Address" value={user.email} editing={false} />
                            <Field icon={Phone} label="Phone Number" value={form.phone}
                                editing={editing} onChange={v => update('phone', v)} placeholder="+92 300 1234567" />
                            <Field icon={MapPin} label="City" value={form.city}
                                editing={editing} onChange={v => update('city', v)} placeholder="Islamabad" />
                            <Field icon={Shield} label="Bar Council ID" value={form.bar_council_id}
                                editing={editing} onChange={v => update('bar_council_id', v)} placeholder="PBC-12345" />
                            <Field icon={Briefcase} label="Specialization" value={form.specialization}
                                editing={editing} onChange={v => update('specialization', v)} placeholder="Criminal, Corporate" />
                        </div>
                    </div>

                    {/* Right — Notifications + Quick Actions */}
                    <div className="space-y-6">
                        {/* Notification Settings */}
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                            <div className="px-6 py-5 border-b border-slate-100">
                                <h3 className="text-base font-bold text-primary-900 flex items-center gap-2">
                                    <Bell size={16} className="text-gold-500" /> Notifications
                                </h3>
                            </div>
                            <div className="p-6">
                                <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-2">Email for Hearing Alerts</p>
                                {editing ? (
                                    <input
                                        type="email"
                                        value={form.notification_email}
                                        onChange={e => update('notification_email', e.target.value)}
                                        placeholder="your@gmail.com"
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-primary-900 focus:outline-none focus:border-gold-400 focus:ring-2 focus:ring-gold-400/20 transition-all bg-slate-50"
                                    />
                                ) : (
                                    <p className="px-4 py-3 rounded-xl bg-slate-50 text-sm text-primary-900 border border-slate-100">
                                        {user.notification_email || <span className="text-slate-300 italic">Not configured</span>}
                                    </p>
                                )}
                                <div className="mt-4 flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-100">
                                    <CheckCircle size={16} className="text-emerald-500 flex-shrink-0" />
                                    <p className="text-xs text-emerald-700">You'll get email reminders 1-2 days before hearings</p>
                                </div>
                            </div>
                        </div>

                        {/* Quick Actions */}
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                            <div className="px-6 py-5 border-b border-slate-100">
                                <h3 className="text-base font-bold text-primary-900">Quick Actions</h3>
                            </div>
                            <div className="p-4 space-y-1">
                                {[
                                    { icon: MessageSquare, label: 'Start Legal Research', to: '/chat', color: 'text-indigo-500' },
                                    { icon: Calendar, label: 'Manage Case Diary', to: '/diary', color: 'text-amber-500' },
                                ].map((item, i) => (
                                    <button key={i} onClick={() => navigate(item.to)}
                                        className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-medium text-primary-900 hover:bg-slate-50 transition-colors text-left group">
                                        <item.icon size={18} className={`${item.color} group-hover:scale-110 transition-transform`} />
                                        {item.label}
                                        <span className="ml-auto text-slate-300 group-hover:text-slate-400">→</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ── Reusable Field Component ── */
function Field({ icon: Icon, label, value, editing, onChange, placeholder }) {
    return (
        <div>
            <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                <Icon size={12} /> {label}
            </label>
            {editing && onChange ? (
                <input
                    value={value || ''}
                    onChange={e => onChange(e.target.value)}
                    placeholder={placeholder}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-primary-900 font-medium focus:outline-none focus:border-gold-400 focus:ring-2 focus:ring-gold-400/20 transition-all bg-slate-50 hover:border-slate-300"
                />
            ) : (
                <p className="px-4 py-3 rounded-xl bg-slate-50 text-sm text-primary-900 font-medium border border-slate-100 min-h-[44px]">
                    {value || <span className="text-slate-300 italic font-normal">Not set</span>}
                </p>
            )}
        </div>
    );
}
