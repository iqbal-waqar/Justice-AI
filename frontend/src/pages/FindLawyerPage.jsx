import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Award, Briefcase, Building2, Landmark, Languages, Loader2, Mail, MapPin, Phone, Search, ShieldCheck, Users } from 'lucide-react';
import { API_BASE, profilePictureUrl } from '../api';
import { useI18n } from '../i18n';
import { Card, ClosingCta, GRID_BG, PageIntro, Section } from '../components/marketing';

/* Public directory of lawyers who completed their profile and chose to be listed.
   No account needed. /lawyers lists and filters; /lawyers/:id shows one lawyer. */

const initials = (name) => (name || '?').split(' ').filter(Boolean).slice(0, 2).map(n => n[0]).join('').toUpperCase();

function Avatar({ lawyer, size = 56 }) {
    const url = profilePictureUrl(lawyer.profile_picture);
    return url
        ? <img src={url} alt="" style={{ width: size, height: size }} className="rounded-2xl object-cover ring-1 ring-line flex-shrink-0" />
        : <span style={{ width: size, height: size }} className="rounded-2xl bg-ink-gradient text-gold-300 font-semibold flex items-center justify-center flex-shrink-0 ring-1 ring-white/5" aria-hidden>{initials(lawyer.full_name)}</span>;
}

export default function FindLawyerPage() {
    const { id } = useParams();
    return id ? <LawyerProfile id={id} /> : <Directory />;
}

function Directory() {
    const { t } = useI18n();
    const [data, setData] = useState(null);
    const [error, setError] = useState('');
    const [city, setCity] = useState('');
    const [area, setArea] = useState('');
    const [q, setQ] = useState('');

    useEffect(() => {
        const params = new URLSearchParams(); if (city) params.set('city', city); if (area) params.set('area', area); if (q.trim()) params.set('q', q.trim());
        const ctrl = new AbortController();
        const id = setTimeout(() => {
            fetch(`${API_BASE}/api/v1/lawyers?${params}`, { signal: ctrl.signal }).then(r => r.json()).then(setData)
                .catch(e => { if (e.name !== 'AbortError') setError(t("Can't reach the server. Check your connection and try again.")); });
        }, 250);
        return () => { clearTimeout(id); ctrl.abort(); };
    }, [city, area, q]); // eslint-disable-line react-hooks/exhaustive-deps

    const lawyers = data?.lawyers || [];
    return (
        <div className="bg-paper-50">
            <PageIntro eyebrow={t('Find a lawyer')} title={t('Lawyers listed on Justice AI.')}
                lead={t('Search by city and area of law. Every lawyer here keeps their cases, hearings and accounts on Justice AI and has chosen to be listed.')} />
            <Section className="pb-24 sm:pb-28">
                {/* filters */}
                <div className="rounded-2xl bg-white ring-1 ring-line shadow-soft p-3 sm:p-4 flex flex-col lg:flex-row gap-3 mb-6">
                    <div className="relative flex-1">
                        <Search size={16} className="absolute start-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input value={q} onChange={e => setQ(e.target.value)} placeholder={t('Search by name, court or specialty…')}
                            className="w-full h-11 ps-10 pe-3.5 rounded-xl bg-paper-50 border border-line-strong text-sm text-ink-950 placeholder:text-slate-400 focus:outline-none focus:border-gold-500 focus:shadow-focus transition" />
                    </div>
                    <select value={city} onChange={e => setCity(e.target.value)} className="h-11 px-3.5 rounded-xl bg-paper-50 border border-line-strong text-sm text-ink-950 focus:outline-none focus:border-gold-500 lg:w-56">
                        <option value="">{t('All cities')}</option>
                        {(data?.cities || []).map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <select value={area} onChange={e => setArea(e.target.value)} className="h-11 px-3.5 rounded-xl bg-paper-50 border border-line-strong text-sm text-ink-950 focus:outline-none focus:border-gold-500 lg:w-64">
                        <option value="">{t('All areas of law')}</option>
                        {(data?.areas || []).map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                </div>

                {error && <p className="text-[13.5px] text-red-700 mb-4">{error}</p>}
                {!data && !error && <div className="flex justify-center py-20 text-slate-400"><Loader2 size={22} className="animate-spin" /></div>}
                {data && lawyers.length === 0 && (
                    <div className="text-center py-20">
                        <Users size={30} className="mx-auto text-slate-300 mb-4" />
                        <h2 className="font-serif text-[22px] font-semibold text-ink-950">{t('No listed lawyers match yet')}</h2>
                        <p className="text-[14.5px] text-slate-600 mt-2 max-w-md mx-auto">{t('Try another city or area of law. Lawyers appear here once they complete their public profile on Justice AI.')}</p>
                    </div>
                )}
                {lawyers.length > 0 && (
                    <>
                        <p className="text-[13px] text-slate-500 mb-4">{lawyers.length === 1 ? t('1 lawyer') : t('{n} lawyers', { n: lawyers.length })}</p>
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {lawyers.map(l => (
                                <Link key={l.id} to={`/lawyers/${l.id}`} className="group block">
                                    <Card hover className="p-5 h-full flex flex-col">
                                        <div className="flex items-start gap-4">
                                            <Avatar lawyer={l} />
                                            <div className="min-w-0 flex-1">
                                                <h3 className="font-serif text-[18px] font-semibold text-ink-950 leading-snug group-hover:text-gold-700 transition-colors rtl:pt-1">{l.full_name}</h3>
                                                <div className="text-[13px] text-slate-500 mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                                                    {l.city && <span className="inline-flex items-center gap-1"><MapPin size={12} />{l.city}</span>}
                                                    {l.experience_years != null && <span className="inline-flex items-center gap-1"><Award size={12} />{t('{n} yrs', { n: l.experience_years })}</span>}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="mt-4 flex flex-wrap gap-1.5">
                                            {l.practice_areas.slice(0, 4).map(a => <span key={a} className="px-2.5 py-1 rounded-full bg-paper-100 ring-1 ring-line text-[11.5px] font-semibold text-ink-800">{a}</span>)}
                                            {l.practice_areas.length > 4 && <span className="px-2 py-1 text-[11.5px] text-slate-500">+{l.practice_areas.length - 4}</span>}
                                        </div>
                                        {l.bio && <p className="text-[13.5px] text-slate-600 leading-relaxed mt-3 line-clamp-3" dir="auto">{l.bio}</p>}
                                        <div className="mt-auto pt-4 flex items-center justify-between text-[12.5px] text-slate-500">
                                            <span className="inline-flex items-center gap-1.5 min-w-0">{l.firm_name && <><Building2 size={12} className="flex-shrink-0" /><span className="truncate">{l.firm_name}</span></>}</span>
                                            {l.bar_council_id && <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold flex-shrink-0"><ShieldCheck size={13} />{t('Bar Council ID')}</span>}
                                        </div>
                                    </Card>
                                </Link>
                            ))}
                        </div>
                    </>
                )}
            </Section>
            <ClosingCta />
        </div>
    );
}

function LawyerProfile({ id }) {
    const { t, lang } = useI18n();
    const [l, setL] = useState(null);
    const [error, setError] = useState('');
    useEffect(() => {
        fetch(`${API_BASE}/api/v1/lawyers/${id}`).then(async r => { if (!r.ok) throw new Error((await r.json()).detail || 'Not found'); return r.json(); })
            .then(setL).catch(e => setError(e.message));
    }, [id]);
    const since = useMemo(() => l?.member_since ? new Date(l.member_since).toLocaleDateString(lang === 'ur' ? 'ur-PK' : 'en-GB', { month: 'long', year: 'numeric' }) : '', [l, lang]);

    return (
        <div className="bg-paper-50 min-h-screen">
            <section className="relative overflow-hidden pt-28 sm:pt-32 pb-10">
                <div aria-hidden className="absolute inset-0 pointer-events-none" style={{ ...GRID_BG, maskImage: 'radial-gradient(ellipse 70% 60% at 50% 0%, black 20%, transparent 100%)' }} />
                <div aria-hidden className="absolute top-[-280px] left-1/2 -translate-x-1/2 w-[900px] h-[520px] rounded-full bg-[radial-gradient(closest-side,rgba(232,201,134,0.45),rgba(232,201,134,0.1)_55%,transparent)] blur-2xl pointer-events-none" />
                <div className="relative max-w-4xl mx-auto px-5 sm:px-8">
                    <Link to="/lawyers" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-ink-950 mb-6"><ArrowLeft size={15} className="rtl:rotate-180" />{t('All lawyers')}</Link>
                    {error && <p className="text-[14px] text-red-700">{error}</p>}
                    {!l && !error && <div className="flex justify-center py-20 text-slate-400"><Loader2 size={22} className="animate-spin" /></div>}
                    {l && (
                        <div className="grid lg:grid-cols-[1fr_320px] gap-6 items-start">
                            <Card className="p-6 sm:p-8">
                                <div className="flex items-start gap-5">
                                    <Avatar lawyer={l} size={84} />
                                    <div className="min-w-0">
                                        <h1 className="font-serif text-[1.8rem] sm:text-[2.2rem] leading-tight font-semibold tracking-[-0.02em] text-ink-950 rtl:tracking-normal rtl:text-[1.6rem] rtl:pt-1">{l.full_name}</h1>
                                        <div className="text-[14px] text-slate-500 mt-2 flex flex-wrap gap-x-4 gap-y-1">
                                            {l.city && <span className="inline-flex items-center gap-1.5"><MapPin size={14} />{l.city}</span>}
                                            {l.firm_name && <span className="inline-flex items-center gap-1.5"><Building2 size={14} />{l.firm_name}</span>}
                                            {l.experience_years != null && <span className="inline-flex items-center gap-1.5"><Award size={14} />{t('{n} years of practice', { n: l.experience_years })}</span>}
                                        </div>
                                        <div className="mt-3 flex flex-wrap gap-1.5">
                                            {l.practice_areas.map(a => <span key={a} className="px-2.5 py-1 rounded-full bg-paper-100 ring-1 ring-line text-[12px] font-semibold text-ink-800">{a}</span>)}
                                        </div>
                                    </div>
                                </div>
                                {l.bio && <div className="mt-7 pt-6 border-t border-line"><h2 className="text-[12.5px] font-semibold uppercase tracking-[0.14em] text-gold-700 eyebrow mb-2">{t('About')}</h2><p className="text-[15px] text-slate-700 leading-relaxed whitespace-pre-line" dir="auto">{l.bio}</p></div>}
                                <dl className="mt-6 grid sm:grid-cols-2 gap-4 text-[14px]">
                                    {l.courts && <div className="flex gap-3"><Landmark size={16} className="text-gold-700 flex-shrink-0 mt-0.5" /><div><dt className="text-[12px] text-slate-500">{t('Courts')}</dt><dd className="text-ink-950 font-medium">{l.courts}</dd></div></div>}
                                    {l.languages && <div className="flex gap-3"><Languages size={16} className="text-gold-700 flex-shrink-0 mt-0.5" /><div><dt className="text-[12px] text-slate-500">{t('Languages')}</dt><dd className="text-ink-950 font-medium">{l.languages}</dd></div></div>}
                                    {l.bar_council_id && <div className="flex gap-3"><ShieldCheck size={16} className="text-emerald-600 flex-shrink-0 mt-0.5" /><div><dt className="text-[12px] text-slate-500">{t('Bar Council ID')}</dt><dd className="text-ink-950 font-medium" dir="ltr">{l.bar_council_id}</dd></div></div>}
                                    {since && <div className="flex gap-3"><Briefcase size={16} className="text-gold-700 flex-shrink-0 mt-0.5" /><div><dt className="text-[12px] text-slate-500">{t('On Justice AI since')}</dt><dd className="text-ink-950 font-medium">{since}</dd></div></div>}
                                </dl>
                            </Card>
                            <div className="rounded-2xl bg-ink-gradient text-white p-6 relative overflow-hidden lg:sticky lg:top-28">
                                <span aria-hidden className="absolute inset-0 bg-ink-sheen pointer-events-none" />
                                <div className="relative">
                                    <h2 className="font-serif text-[20px] font-semibold rtl:pt-1">{t('Contact')}</h2>
                                    <p className="text-[13px] text-white/60 mt-1 mb-5">{t('Reach the lawyer directly. Justice AI does not take part in the engagement.')}</p>
                                    <div className="space-y-2">
                                        {l.phone && <a href={`tel:${l.phone}`} className="flex items-center gap-3 px-4 h-12 rounded-xl bg-white/[0.06] ring-1 ring-white/10 hover:bg-white/[0.1] transition-colors"><Phone size={16} className="text-gold-300" /><bdi dir="ltr" className="font-medium">{l.phone}</bdi></a>}
                                        {l.phone && <a href={`https://wa.me/${l.phone.replace(/\D/g, '').replace(/^0/, '92')}`} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 h-12 rounded-xl bg-gold-gradient text-[#2a1e05] font-semibold hover:brightness-105 transition">{t('Message on WhatsApp')}</a>}
                                        {l.email && <a href={`mailto:${l.email}`} className="flex items-center gap-3 px-4 h-12 rounded-xl bg-white/[0.06] ring-1 ring-white/10 hover:bg-white/[0.1] transition-colors"><Mail size={16} className="text-gold-300" /><bdi dir="ltr" className="font-medium truncate">{l.email}</bdi></a>}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
}
