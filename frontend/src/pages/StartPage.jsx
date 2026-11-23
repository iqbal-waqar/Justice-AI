import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Briefcase, ChevronRight, FolderOpen, Search } from 'lucide-react';
import Logo from '../components/Logo';
import { LanguageToggle, useI18n } from '../i18n';
import { GRID_BG } from '../components/marketing';

/* The front door: who are you? Lawyers sign in to the workspace, clients open the
   case their lawyer shared, and anyone can look up a listed lawyer. */
export default function StartPage() {
    const { t } = useI18n();
    const OPTIONS = [
        { to: '/login', icon: Briefcase, dark: true, title: t('I’m a lawyer or munshi'), text: t('Manage your cases, hearing dates, clients and fees in one place.') },
        { to: '/client', icon: FolderOpen, title: t('My lawyer shared a case with me'), text: t('See your hearing dates, fees and receipts. Sign in with your email address.') },
        { to: '/lawyers', icon: Search, title: t('Find a lawyer'), text: t('Search listed lawyers by city and area of law. Free, no account needed.') },
    ];
    return (
        <div className="relative min-h-screen bg-paper-50 flex flex-col">
            <div aria-hidden className="absolute inset-0 pointer-events-none" style={{ ...GRID_BG, maskImage: 'radial-gradient(ellipse 70% 60% at 50% 0%, black 20%, transparent 100%)' }} />
            <div aria-hidden className="absolute top-[-280px] left-1/2 -translate-x-1/2 w-[900px] h-[520px] rounded-full bg-[radial-gradient(closest-side,rgba(232,201,134,0.5),rgba(232,201,134,0.1)_55%,transparent)] blur-2xl pointer-events-none" />
            <header className="relative max-w-3xl w-full mx-auto px-5 sm:px-8 h-20 flex items-center justify-between">
                <Link to="/" className="inline-flex items-center gap-1.5 h-9 px-2.5 -ms-2.5 rounded-lg text-sm font-medium text-slate-500 hover:text-ink-950 hover:bg-paper-200 transition-colors">
                    <ArrowLeft size={15} className="rtl:rotate-180" /> {t('Back to website')}
                </Link>
                <LanguageToggle />
            </header>
            <main className="relative flex-1 flex items-center">
                <div className="max-w-3xl w-full mx-auto px-5 sm:px-8 py-10">
                    <div className="flex justify-center mb-6"><Logo size={44} /></div>
                    <h1 className="font-serif text-[2rem] sm:text-[2.6rem] leading-[1.1] font-semibold tracking-[-0.02em] text-ink-950 text-center text-balance rtl:text-[1.7rem] sm:rtl:text-[2.1rem] rtl:tracking-normal rtl:pt-2">{t('How can we help you today?')}</h1>
                    <p className="text-[16px] text-slate-600 text-center mt-3 mb-10">{t('Choose the door that fits you.')}</p>
                    <div className="space-y-3">
                        {OPTIONS.map(o => (
                            <Link key={o.to} to={o.to}
                                className={`group flex items-center gap-5 p-5 sm:p-6 rounded-2xl ring-1 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lift ${o.dark
                                    ? 'bg-ink-gradient ring-white/10 text-white shadow-[0_18px_40px_-20px_rgba(11,18,32,0.7)]'
                                    : 'bg-white ring-line text-ink-950 shadow-soft hover:ring-line-strong'}`}>
                                <span className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 ${o.dark ? 'bg-white/[0.08] ring-1 ring-gold-400/30' : 'bg-paper-100 ring-1 ring-line'}`}>
                                    <o.icon size={24} className={o.dark ? 'text-gold-300' : 'text-gold-700'} />
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="block font-serif text-[20px] sm:text-[21px] font-semibold leading-snug rtl:pt-1">{o.title}</span>
                                    <span className={`block text-[14px] leading-relaxed mt-1 ${o.dark ? 'text-white/65' : 'text-slate-600'}`}>{o.text}</span>
                                </span>
                                <ChevronRight size={20} className={`flex-shrink-0 transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5 ${o.dark ? 'text-gold-300' : 'text-slate-400 group-hover:text-ink-900'}`} />
                            </Link>
                        ))}
                    </div>
                    <p className="text-center text-[13px] text-slate-500 mt-8">
                        {t('New here as a lawyer?')} <Link to="/login?mode=signup" className="font-semibold text-ink-950 underline decoration-gold-400 decoration-2 underline-offset-4">{t('Create a free account')}</Link>
                    </p>
                </div>
            </main>
        </div>
    );
}
