import React, { useState, useEffect, useRef } from 'react';
import { apiFetch, profilePictureUrl, storeUser } from '../api';
import { useNavigate } from 'react-router-dom';
import {
    User, Mail, Phone, MapPin, Briefcase, Shield, Camera,
    Save, LogOut, Bell, Calendar, MessageSquare, Edit3, X,
    Scale, Award, CheckCircle, Loader2, ChevronRight, Globe
} from 'lucide-react';
import { LanguageToggle, useI18n } from '../i18n';
import { Button, Card, CardHeader, inputClass } from '../components/ui';

export default function ProfilePage() {
    const navigate = useNavigate();
    const { t } = useI18n();
    const [user, setUser] = useState(null);
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState('');
    const [activeTab, setActiveTab] = useState('profile');
    const [uploading, setUploading] = useState(false);
    const photoInput = useRef(null);

    const [form, setForm] = useState({
        full_name: '', phone: '', city: '',
        bar_council_id: '', specialization: '', notification_email: '',
        bio: '', practice_areas: '', experience_years: '', courts: '', languages: '', directory_listed: false,
    });

    const token = localStorage.getItem('justiceai_token');

    useEffect(() => { fetchProfile(); }, []);

    const fetchProfile = async () => {
        try {
            const res = await apiFetch(`/api/v1/auth/me`, {
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
                bio: data.bio || '', practice_areas: data.practice_areas || '',
                experience_years: data.experience_years ?? '', courts: data.courts || '', languages: data.languages || '',
                directory_listed: !!data.directory_listed,
            });
            storeUser(data);
        } catch { navigate('/login'); }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await apiFetch(`/api/v1/auth/profile`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ ...form, experience_years: form.experience_years === '' ? null : Number(form.experience_years) }),
            });
            const data = await res.json();
            setUser(data);
            storeUser(data);
            setEditing(false);
            showToast(t('Profile updated'));
        } catch { showToast(t('Could not update the profile')); }
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
    const profilePicUrl = profilePictureUrl(user?.profile_picture);

    const handlePhoto = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';               // allow choosing the same file again later
        if (!file) return;
        if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) { showToast(t('Please choose a JPG, PNG or WebP image')); return; }
        if (file.size > 5 * 1024 * 1024) { showToast(t('The photo is larger than 5 MB')); return; }
        setUploading(true);
        try {
            const body = new FormData();
            body.append('file', file);
            const res = await apiFetch('/api/v1/auth/profile/picture', { method: 'POST', body });
            const data = await res.json();
            if (!res.ok) { showToast(data.detail || t('Could not upload the photo')); return; }
            setUser(data);
            storeUser(data);
            showToast(t('Profile photo updated'));
        } catch { showToast(t('Could not upload the photo')); }
        finally { setUploading(false); }
    };

    if (!user) return (
        <div className="flex-1 flex items-center justify-center bg-paper-100">
            <Loader2 size={28} className="text-gold-500 animate-spin" />
        </div>
    );

    // A quick read of the account, from what the profile actually holds.
    const status = [
        { icon: Scale, label: t('Role'), value: user.role === 'admin' ? t('Admin') : t('Lawyer'), ok: true },
        { icon: Phone, label: t('WhatsApp'), value: user.phone_verified ? t('Verified') : user.phone ? t('Not verified') : t('Not set'), ok: !!user.phone_verified },
        { icon: Shield, label: t('Bar Council ID'), value: user.bar_council_id ? t('On file') : t('Not set'), ok: !!user.bar_council_id },
        { icon: Bell, label: t('Hearing alerts'), value: (user.notification_email || user.email) ? t('Email on') : t('Not configured'), ok: !!(user.notification_email || user.email) },
    ];

    return (
        <div className="flex-1 overflow-y-auto bg-paper-100">
            {/* Toast */}
            {toast && (
                <div role="status" className="fixed top-6 end-6 z-50 flex items-center gap-2.5 ps-4 pe-5 py-3 rounded-xl bg-ink-950 text-white text-sm font-medium shadow-pop ring-1 ring-white/10 animate-slide-up">
                    <CheckCircle size={16} className="text-gold-300 flex-shrink-0" />
                    {toast}
                </div>
            )}

            {/* ═══ Cover ═══ */}
            <div className="relative h-48 overflow-hidden bg-ink-gradient">
                <span aria-hidden className="absolute inset-0 bg-ink-sheen" />
                <span aria-hidden className="absolute inset-0 pointer-events-none opacity-70"
                    style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)', backgroundSize: '48px 48px', maskImage: 'radial-gradient(ellipse 70% 100% at 70% 0%, black 25%, transparent 100%)', WebkitMaskImage: 'radial-gradient(ellipse 70% 100% at 70% 0%, black 25%, transparent 100%)' }} />
                <span aria-hidden className="absolute -top-28 end-[10%] w-96 h-96 rounded-full bg-gold-500/25 blur-[100px] pointer-events-none" />
                <span aria-hidden className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-gold-400/40 to-transparent" />
                <LanguageToggle dark className="absolute top-5 right-6 z-10" />
            </div>

            <div className="max-w-5xl mx-auto px-5 sm:px-8 -mt-24 relative z-10 pb-14">

                {/* ─── Identity card ─── */}
                <div className="bg-white rounded-2xl border border-line shadow-lift overflow-hidden">
                    <div className="px-6 sm:px-8 pt-7 pb-6 flex flex-col sm:flex-row items-start sm:items-end gap-6">
                        {/* Avatar */}
                        <div className="relative flex-shrink-0">
                            <button type="button" onClick={() => photoInput.current?.click()} disabled={uploading}
                                title={t('Change profile photo')} aria-label={t('Change profile photo')}
                                className="relative group w-28 h-28 rounded-[22px] overflow-hidden ring-4 ring-white shadow-lift bg-ink-gradient flex items-center justify-center focus-visible:outline-none focus-visible:shadow-focus">
                                {profilePicUrl ? (
                                    <img src={profilePicUrl} alt={user.full_name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                ) : (
                                    <span className="font-serif text-[38px] font-semibold text-gold-300">{initials}</span>
                                )}
                                <span className={`absolute inset-0 flex flex-col items-center justify-center gap-1 bg-ink-950/60 text-white text-[11.5px] font-medium transition-opacity ${uploading ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100'}`}>
                                    {uploading ? <Loader2 size={20} className="animate-spin" /> : <><Camera size={20} />{t('Change')}</>}
                                </span>
                            </button>
                            <button type="button" onClick={() => photoInput.current?.click()} disabled={uploading}
                                aria-label={uploading ? t('Uploading…') : profilePicUrl ? t('Change photo') : t('Upload photo')}
                                title={uploading ? t('Uploading…') : profilePicUrl ? t('Change photo') : t('Upload photo')}
                                className="absolute -bottom-1.5 -end-1.5 w-9 h-9 rounded-full bg-gold-gradient text-[#2a1e05] ring-4 ring-white shadow-soft flex items-center justify-center hover:brightness-105 disabled:opacity-60 transition">
                                {uploading ? <Loader2 size={15} className="animate-spin" /> : <Camera size={15} />}
                            </button>
                            <input ref={photoInput} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={handlePhoto} />
                        </div>

                        {/* Name & Info */}
                        <div className="flex-1 min-w-0">
                            <h1 className="page-title text-[28px] leading-tight text-ink-950 truncate">{user.full_name}</h1>
                            <p className="text-sm text-slate-500 mt-1"><bdi dir="ltr">{user.email}</bdi></p>
                            <div className="flex flex-wrap items-center gap-2 mt-3.5">
                                <span className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-amber-50 text-gold-700 text-[12px] font-semibold ring-1 ring-inset ring-amber-200">
                                    <Scale size={12} /> {user.role === 'admin' ? t('Admin') : t('Lawyer')}
                                </span>
                                {user.specialization && (
                                    <span className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-ink-50 text-ink-800 text-[12px] font-semibold ring-1 ring-inset ring-ink-200">
                                        <Briefcase size={12} /> {user.specialization}
                                    </span>
                                )}
                                {user.city && (
                                    <span className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-paper-200 text-slate-600 text-[12px] font-semibold ring-1 ring-inset ring-line-strong">
                                        <MapPin size={12} /> {user.city}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-2 flex-shrink-0 self-stretch sm:self-auto">
                            {editing ? (
                                <>
                                    <Button variant="secondary" icon={X} onClick={() => setEditing(false)}>{t('Cancel')}</Button>
                                    <Button icon={Save} loading={saving} onClick={handleSave}>{t('Save changes')}</Button>
                                </>
                            ) : (
                                <>
                                    <Button icon={Edit3} onClick={() => setEditing(true)}>{t('Edit profile')}</Button>
                                    <Button variant="danger" onClick={handleLogout} title={t('Log out')} aria-label={t('Log out')} className="!px-3">
                                        <LogOut size={16} className="rtl:rotate-180" />
                                    </Button>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Account status strip */}
                    <div className="grid grid-cols-2 md:grid-cols-4 border-t border-line bg-paper-50/70 divide-line divide-x rtl:divide-x-reverse">
                        {status.map(s => (
                            <div key={s.label} className="flex items-center gap-3 px-5 sm:px-6 py-4 min-w-0 [&:nth-child(3)]:border-t md:[&:nth-child(3)]:border-t-0 [&:nth-child(4)]:border-t md:[&:nth-child(4)]:border-t-0 border-line">
                                <span className={`w-9 h-9 rounded-xl ring-1 flex items-center justify-center flex-shrink-0 ${s.ok ? 'bg-emerald-50 text-emerald-700 ring-emerald-200/80' : 'bg-white text-slate-400 ring-line-strong'}`}>
                                    <s.icon size={16} />
                                </span>
                                <span className="min-w-0">
                                    <span className="block text-[12px] text-slate-500 truncate">{s.label}</span>
                                    <span className={`block text-[13.5px] font-semibold truncate ${s.ok ? 'text-ink-950' : 'text-slate-500'}`}>{s.value}</span>
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ─── Profile Details ─── */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
                    {/* Personal information */}
                    <Card className="lg:col-span-2 overflow-hidden">
                        <CardHeader icon={User} title={t('Personal information')}
                            action={editing
                                ? <span className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full bg-amber-50 text-gold-700 text-[11.5px] font-semibold ring-1 ring-inset ring-amber-200"><span className="w-1.5 h-1.5 rounded-full bg-gold-500 animate-pulse" />{t('Editing')}</span>
                                : <span className="text-[12.5px] text-slate-400">{t('Your professional details')}</span>} />
                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-5">
                            <Field icon={User} label={t('Full name')} value={form.full_name}
                                editing={editing} onChange={v => update('full_name', v)} />
                            <Field icon={Mail} label={t('Email address')} value={user.email} editing={false} ltr />
                            <Field icon={Phone} label={t('Phone number')} value={form.phone}
                                editing={editing} onChange={v => update('phone', v)} placeholder="+92 300 1234567" ltr />
                            <Field icon={MapPin} label={t('City')} value={form.city}
                                editing={editing} onChange={v => update('city', v)} placeholder={t('Islamabad')} />
                            <Field icon={Shield} label={t('Bar Council ID')} value={form.bar_council_id}
                                editing={editing} onChange={v => update('bar_council_id', v)} placeholder="PBC-12345" />
                            <Field icon={Briefcase} label={t('Specialization')} value={form.specialization}
                                editing={editing} onChange={v => update('specialization', v)} placeholder={t('Criminal, Corporate')} />
                        </div>
                    </Card>

                    {/* Public profile: Find a lawyer */}
                    <PublicProfileCard user={user} form={form} editing={editing} update={update} />

                    <div className="space-y-6">
                        {/* Notifications */}
                        <Card className="overflow-hidden">
                            <CardHeader icon={Bell} title={t('Notifications')} />
                            <div className="p-5">
                                <div className="text-[12.5px] font-semibold text-ink-800 mb-1.5">{t('Email for hearing alerts')}</div>
                                {editing ? (
                                    <input type="email" value={form.notification_email}
                                        onChange={e => update('notification_email', e.target.value)}
                                        placeholder="your@gmail.com" className={inputClass} />
                                ) : (
                                    <div className="h-10 px-3.5 flex items-center rounded-xl bg-paper-100 ring-1 ring-inset ring-line text-sm text-ink-950 min-w-0">
                                        {user.notification_email ? <bdi dir="ltr" className="truncate">{user.notification_email}</bdi> : <span className="text-slate-400">{t('Not configured')}</span>}
                                    </div>
                                )}
                                <div className="mt-4 flex items-start gap-2.5 px-3.5 py-3 rounded-xl bg-emerald-50/80 ring-1 ring-inset ring-emerald-200/80">
                                    <CheckCircle size={16} className="text-emerald-600 flex-shrink-0 mt-px" />
                                    <p className="text-[12.5px] leading-relaxed text-emerald-800">{t('You’ll get email reminders 1–2 days before hearings')}</p>
                                </div>
                            </div>
                        </Card>

                        {/* Quick Actions */}
                        <Card className="overflow-hidden">
                            <CardHeader icon={Award} title={t('Quick actions')} />
                            <div className="p-2">
                                {[
                                    { icon: MessageSquare, label: t('Start legal research'), to: '/chat' },
                                    { icon: Calendar, label: t('Manage case diary'), to: '/diary' },
                                ].map((item, i) => (
                                    <button key={i} onClick={() => navigate(item.to)}
                                        className="w-full flex items-center gap-3 px-3 h-12 rounded-xl text-sm font-medium text-ink-950 hover:bg-paper-100 transition-colors text-start group">
                                        <span className="w-8 h-8 rounded-lg bg-paper-200 text-ink-700 flex items-center justify-center group-hover:bg-ink-900 group-hover:text-gold-300 transition-colors"><item.icon size={16} /></span>
                                        {item.label}
                                        <ChevronRight size={16} className="ms-auto text-slate-300 group-hover:text-ink-700 rtl:rotate-180 transition-colors" />
                                    </button>
                                ))}
                            </div>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ── Read-only value, or an input while editing ── */
function Field({ icon: Icon, label, value, editing, onChange, placeholder, ltr = false }) {
    const { t } = useI18n();
    return (
        <div>
            <label className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-800 mb-1.5">
                <Icon size={13} className="text-slate-400" /> {label}
            </label>
            {editing && onChange ? (
                <input value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder}
                    className={`${inputClass} ${ltr ? 'ltr rtl:text-right' : ''}`} />
            ) : (
                <div className="h-10 px-3.5 flex items-center rounded-xl bg-paper-100 ring-1 ring-inset ring-line text-sm text-ink-950 font-medium min-w-0">
                    {value ? <bdi dir={ltr ? 'ltr' : undefined} className="truncate">{value}</bdi> : <span className="text-slate-400 font-normal">{t('Not set')}</span>}
                </div>
            )}
        </div>
    );
}

/* ── Public profile shown in "Find a lawyer" once complete and switched on ── */
const AREA_SUGGESTIONS = ['Criminal', 'Family', 'Civil', 'Property', 'Corporate', 'Tax', 'Labour', 'Banking', 'Constitutional', 'Immigration', 'Intellectual property', 'Service'];
function PublicProfileCard({ user, form, editing, update }) {
    const { t } = useI18n();
    const areas = (form.practice_areas || '').split(',').map(a => a.trim()).filter(Boolean);
    const toggleArea = (a) => update('practice_areas', (areas.includes(a) ? areas.filter(x => x !== a) : [...areas, a]).join(', '));
    const checks = [
        [t('Your name'), !!(form.full_name || '').trim()],
        [t('City'), !!(form.city || '').trim()],
        [t('At least one area of law'), areas.length > 0],
        [t('A short introduction (40+ characters)'), (form.bio || '').trim().length >= 40],
        [t('A phone number or email'), !!((form.phone || '').trim() || user.email)],
    ];
    const complete = checks.every(([, ok]) => ok);
    const live = complete && form.directory_listed;
    return (
        <Card className="lg:col-span-2 overflow-hidden">
            <CardHeader icon={Globe} title={t('Public profile — Find a lawyer')}
                action={live
                    ? <a href={`/lawyers/${user.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full bg-emerald-50 text-emerald-700 text-[11.5px] font-semibold ring-1 ring-inset ring-emerald-200"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />{t('Listed')} · {t('View')}</a>
                    : <span className="inline-flex items-center h-6 px-2.5 rounded-full bg-paper-200 text-slate-600 text-[11.5px] font-semibold ring-1 ring-inset ring-line">{t('Not listed')}</span>} />
            <div className="p-6 grid lg:grid-cols-[1fr_260px] gap-6">
                <div className="space-y-5">
                    <p className="text-[13.5px] text-slate-600 leading-relaxed">{t('Clients looking for a lawyer can find you by city and area of law. Your name, city, areas, introduction and contact details are shown; your cases and clients never are.')}</p>
                    <div>
                        <div className="text-[12.5px] font-semibold text-ink-800 mb-1.5">{t('Areas of law')}</div>
                        {editing ? (
                            <>
                                <div className="flex flex-wrap gap-1.5 mb-2">
                                    {AREA_SUGGESTIONS.map(a => (
                                        <button type="button" key={a} onClick={() => toggleArea(a)}
                                            className={`px-2.5 h-8 rounded-full text-[12.5px] font-semibold ring-1 transition-colors ${areas.includes(a) ? 'bg-ink-900 text-white ring-ink-900' : 'bg-white text-ink-800 ring-line-strong hover:bg-paper-100'}`}>{t(a)}</button>
                                    ))}
                                </div>
                                <input value={form.practice_areas} onChange={e => update('practice_areas', e.target.value)} placeholder={t('Or type your own, separated by commas')} className={inputClass} />
                            </>
                        ) : (
                            <div className="flex flex-wrap gap-1.5 min-h-[32px]">
                                {areas.length ? areas.map(a => <span key={a} className="px-2.5 h-8 inline-flex items-center rounded-full bg-paper-100 ring-1 ring-line text-[12.5px] font-semibold text-ink-800">{a}</span>) : <span className="text-[13px] text-slate-400">{t('Not set')}</span>}
                            </div>
                        )}
                    </div>
                    <div>
                        <div className="text-[12.5px] font-semibold text-ink-800 mb-1.5">{t('Introduction')}</div>
                        {editing
                            ? <textarea rows={4} value={form.bio} onChange={e => update('bio', e.target.value)} placeholder={t('Who you are, what you handle, and where you appear. 2–4 sentences.')} className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-line-strong text-sm text-ink-950 placeholder:text-slate-400 focus:outline-none focus:border-gold-500 focus:shadow-focus resize-none" />
                            : <p dir="auto" className="text-[14px] text-slate-700 leading-relaxed whitespace-pre-line min-h-[40px]">{form.bio || <span className="text-slate-400">{t('Not set')}</span>}</p>}
                    </div>
                    <div className="grid sm:grid-cols-3 gap-4">
                        {[['experience_years', t('Years of practice'), '12', 'number'], ['courts', t('Courts you appear in'), t('Lahore High Court, Sessions Court Lahore'), 'text'], ['languages', t('Languages'), t('Urdu, English, Punjabi'), 'text']].map(([k, label, ph, type]) => (
                            <div key={k}>
                                <div className="text-[12.5px] font-semibold text-ink-800 mb-1.5">{label}</div>
                                {editing ? <input type={type} min={type === 'number' ? 0 : undefined} value={form[k]} onChange={e => update(k, e.target.value)} placeholder={ph} className={inputClass} />
                                    : <div className="text-[14px] text-ink-950 min-h-[24px]">{form[k] !== '' && form[k] != null ? form[k] : <span className="text-slate-400">{t('Not set')}</span>}</div>}
                            </div>
                        ))}
                    </div>
                </div>
                <div className="rounded-2xl bg-paper-50 ring-1 ring-line p-4 self-start">
                    <div className="text-[12.5px] font-semibold text-ink-800 mb-3">{t('Before you can be listed')}</div>
                    <ul className="space-y-2">
                        {checks.map(([label, ok]) => (
                            <li key={label} className="flex items-center gap-2.5 text-[13px]">
                                <span className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ring-1 ${ok ? 'bg-emerald-50 ring-emerald-200 text-emerald-700' : 'bg-white ring-line-strong text-slate-300'}`}><CheckCircle size={12} /></span>
                                <span className={ok ? 'text-ink-950' : 'text-slate-500'}>{label}</span>
                            </li>
                        ))}
                    </ul>
                    <label className={`mt-4 flex items-center justify-between gap-3 px-3.5 h-12 rounded-xl ring-1 ${complete ? 'bg-white ring-line-strong cursor-pointer' : 'bg-paper-100 ring-line opacity-70'}`}>
                        <span className="text-[13.5px] font-semibold text-ink-950">{t('List me in Find a lawyer')}</span>
                        <button type="button" role="switch" aria-checked={!!form.directory_listed} disabled={!editing || !complete}
                            onClick={() => update('directory_listed', !form.directory_listed)}
                            className={`relative w-11 h-6 rounded-full transition-colors ${form.directory_listed ? 'bg-gold-gradient' : 'bg-slate-300'} disabled:cursor-not-allowed`}>
                            <span className={`absolute top-0.5 start-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${form.directory_listed ? 'translate-x-5 rtl:-translate-x-5' : ''}`} />
                        </button>
                    </label>
                    {!editing && <p className="text-[12px] text-slate-500 mt-2">{t('Press Edit profile to change these.')}</p>}
                </div>
            </div>
        </Card>
    );
}
