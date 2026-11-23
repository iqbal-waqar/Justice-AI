import React, { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Menu, X, ArrowRight, ShieldCheck } from 'lucide-react';
import { getToken, isTokenExpired } from '../api';
import Logo from './Logo';
import { LanguageToggle, useI18n } from '../i18n';

/* Shell for the public pages (landing, about, blog): a glass top bar and a
   deep-navy footer. Signed-in visitors see "Open app" instead of "Sign in". */
export default function PublicLayout() {
    const [menuOpen, setMenuOpen] = useState(false);
    const { t } = useI18n();
    const [scrolled, setScrolled] = useState(false);
    const location = useLocation();
    const signedIn = !isTokenExpired(getToken());

    // Route changes go to the top; a link such as /#features scrolls to that
    // section once the page has rendered.
    useEffect(() => {
        setMenuOpen(false);
        if (!location.hash) { window.scrollTo(0, 0); return; }
        const id = decodeURIComponent(location.hash.slice(1));
        let tries = 0;
        const timer = setInterval(() => {
            const el = document.getElementById(id);
            if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); clearInterval(timer); }
            else if (++tries > 20) clearInterval(timer);
        }, 50);
        return () => clearInterval(timer);
    }, [location.pathname, location.hash, location.key]);
    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 12);
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    // The header is transparent over the top of the landing page, glass once scrolled.
    const solid = scrolled || menuOpen || location.pathname !== '/';

    const links = [
        { to: '/features', label: t('Features') },
        { to: '/how-it-works', label: t('How it works') },
        { to: '/security', label: t('Security') },
        { to: '/faq', label: t('FAQ') },
        { to: '/about', label: t('About') },
        { to: '/blog', label: t('Blog') },
    ];

    const linkClass = ({ isActive }) =>
        `px-3.5 h-9 inline-flex items-center rounded-full text-[13.5px] font-medium transition-colors ${isActive
            ? 'text-ink-950 bg-white shadow-soft ring-1 ring-line'
            : 'text-slate-600 hover:text-ink-950'}`;

    return (
        <div className="min-h-screen flex flex-col bg-paper-50 text-slate-700">
            <header className={`fixed top-0 inset-x-0 z-50 transition-all duration-300
                ${solid ? 'bg-paper-50/80 backdrop-blur-xl border-b border-line/80 shadow-[0_1px_0_rgba(255,255,255,0.6),0_8px_24px_-18px_rgba(18,29,47,0.25)]' : 'bg-transparent border-b border-transparent'}`}>
                <div className="max-w-6xl mx-auto px-5 sm:px-8 h-[68px] flex items-center justify-between gap-4">
                    <Link to="/" className="flex items-center gap-2.5 rounded-xl">
                        <Logo size={36} />
                    </Link>

                    <nav className="hidden lg:flex items-center gap-0.5 p-1 rounded-full bg-paper-200/60 ring-1 ring-inset ring-line/70">
                        {links.map(l => l.hash
                            ? <Link key={l.to} to={l.to} className={linkClass({ isActive: false })}>{l.label}</Link>
                            : <NavLink key={l.to} to={l.to} end={l.end} className={linkClass}>{l.label}</NavLink>)}
                    </nav>

                    <div className="hidden lg:flex items-center gap-2">
                        <LanguageToggle />
                        {signedIn ? (
                            <Link to="/dashboard" className="group inline-flex items-center gap-1.5 px-4 h-10 rounded-xl bg-ink-900 text-white text-sm font-semibold shadow-[0_1px_2px_rgba(11,18,32,0.25),inset_0_1px_0_rgba(255,255,255,0.08)] hover:bg-ink-800 transition-colors">
                                {t('Open app')} <ArrowRight size={15} className="text-gold-300 transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
                            </Link>
                        ) : (
                            <>
                                <Link to="/login" className="px-4 h-10 inline-flex items-center rounded-xl text-sm font-semibold text-ink-900 hover:bg-paper-200 transition-colors">
                                    {t('Sign in')}
                                </Link>
                                <Link to="/start" className="group inline-flex items-center gap-1.5 px-4 h-10 rounded-xl bg-ink-900 text-white text-sm font-semibold shadow-[0_1px_2px_rgba(11,18,32,0.25),inset_0_1px_0_rgba(255,255,255,0.08)] hover:bg-ink-800 transition-colors">
                                    {t('Get started')} <ArrowRight size={15} className="text-gold-300 transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
                                </Link>
                            </>
                        )}
                    </div>

                    <div className="lg:hidden flex items-center gap-1.5">
                        <LanguageToggle />
                        <button onClick={() => setMenuOpen(o => !o)} aria-label={t('Menu')} aria-expanded={menuOpen}
                            className="w-10 h-10 rounded-xl flex items-center justify-center text-ink-900 hover:bg-paper-200 transition-colors">
                            {menuOpen ? <X size={21} /> : <Menu size={21} />}
                        </button>
                    </div>
                </div>

                {menuOpen && (
                    <div className="lg:hidden border-t border-line bg-white/95 backdrop-blur-xl px-5 py-4 space-y-1 animate-fade-in shadow-lift">
                        {links.map(l => l.hash
                            ? <Link key={l.to} to={l.to} onClick={() => setMenuOpen(false)} className="flex items-center h-11 px-3 rounded-xl text-[15px] font-medium text-ink-900 hover:bg-paper-100">{l.label}</Link>
                            : (
                                <NavLink key={l.to} to={l.to} end={l.end}
                                    className={({ isActive }) => `flex items-center h-11 px-3 rounded-xl text-[15px] font-medium ${isActive ? 'bg-paper-200 text-ink-950' : 'text-ink-900 hover:bg-paper-100'}`}>
                                    {l.label}
                                </NavLink>
                            ))}
                        <div className="grid grid-cols-2 gap-2 pt-3">
                            {!signedIn && (
                                <Link to="/login" className="flex items-center justify-center h-11 rounded-xl border border-line-strong bg-white text-sm font-semibold text-ink-900">{t('Sign in')}</Link>
                            )}
                            <Link to={signedIn ? '/dashboard' : '/start'}
                                className={`flex items-center justify-center gap-1.5 h-11 rounded-xl bg-ink-900 text-white text-sm font-semibold ${signedIn ? 'col-span-2' : ''}`}>
                                {signedIn ? t('Open app') : t('Get started')} <ArrowRight size={15} className="text-gold-300 rtl:rotate-180" />
                            </Link>
                        </div>
                    </div>
                )}
            </header>

            <main className="flex-1">
                <Outlet />
            </main>

            <footer className="relative overflow-hidden bg-ink-gradient text-white/60">
                <span aria-hidden className="pointer-events-none absolute inset-0 bg-ink-sheen" />
                <span aria-hidden className="pointer-events-none absolute -top-px inset-x-0 h-px bg-gradient-to-r from-transparent via-gold-400/50 to-transparent" />
                <div className="relative max-w-6xl mx-auto px-5 sm:px-8 pt-16 pb-12 grid gap-12 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr]">
                    <div>
                        <Logo size={38} light />
                        <p className="text-[14px] leading-relaxed max-w-sm mt-5">
                            {t('The legal workspace for Pakistani advocates: AI research grounded in real judgments, an encrypted document vault, maker-checker billing and a case diary — in English and Urdu.')}
                        </p>
                        <div className="mt-6 inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.05] ring-1 ring-white/10 text-[12.5px] text-white/70">
                            <ShieldCheck size={15} className="text-gold-300" />{t('AES-256 encryption before storage')}
                        </div>
                    </div>
                    <div>
                        <h4 className="text-white text-[12px] font-semibold uppercase tracking-[0.14em] mb-4">{t('Explore')}</h4>
                        <ul className="space-y-2.5 text-[14px]">
                            {[['/features', t('Features')], ['/how-it-works', t('How it works')], ['/security', t('Security')], ['/faq', t('FAQ')], ['/about', t('About')], ['/blog', t('Blog')], ['/lawyers', t('Find a lawyer')], ['/client', t('For clients')]].map(([to, label]) => (
                                <li key={to}><Link to={to} className="hover:text-gold-300 transition-colors">{label}</Link></li>
                            ))}
                        </ul>
                    </div>
                    <div>
                        <h4 className="text-white text-[12px] font-semibold uppercase tracking-[0.14em] mb-4">{t('Coverage')}</h4>
                        <ul className="space-y-2.5 text-[14px]">
                            {[t('Supreme Court of Pakistan'), t('Lahore High Court'), t('Islamabad High Court'), t('Punjab district courts'), t('Federal & Punjab statutes')].map(c => (
                                <li key={c} className="flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-gold-400/70" />{c}</li>
                            ))}
                        </ul>
                    </div>
                </div>
                <div className="relative border-t border-white/10">
                    <div className="max-w-6xl mx-auto px-5 sm:px-8 py-6 flex flex-col sm:flex-row gap-2 justify-between text-[12.5px] text-white/40">
                        <span>© {new Date().getFullYear()} Justice AI</span>
                        <span>{t('Research assistance only — not a substitute for professional legal advice.')}</span>
                    </div>
                </div>
            </footer>
        </div>
    );
}
