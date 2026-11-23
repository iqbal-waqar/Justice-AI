import React, { useEffect, useState } from 'react';
import { Outlet, NavLink, Link, useNavigate } from 'react-router-dom';
import {
    Home, MessageSquare, CalendarDays, ChevronsLeft, ChevronsRight,
    LogOut, FileUp, Users, FolderLock, Wallet, UsersRound, Library
} from 'lucide-react';

import { clearSession, profilePictureUrl } from '../api';
import Logo from './Logo';
import { useI18n } from '../i18n';

const COLLAPSE_KEY = 'justiceai_sidebar_collapsed';

/* App shell: a deep-navy sidebar that carries the brand (gold for the active
   page), and the light paper canvas where each page renders. */
export default function Layout() {
    // On phones and small tablets the sidebar starts as the narrow icon rail so pages keep their width.
    const isSmall = () => typeof window !== 'undefined' && window.matchMedia('(max-width: 900px)').matches;
    const [sidebarOpen, setSidebarOpen] = useState(() => {
        if (isSmall()) return false;
        try { return localStorage.getItem(COLLAPSE_KEY) !== '1'; } catch { return true; }
    });
    useEffect(() => {
        const mq = window.matchMedia('(max-width: 900px)');
        const onChange = (e) => { if (e.matches) setSidebarOpen(false); };
        mq.addEventListener('change', onChange);
        return () => mq.removeEventListener('change', onChange);
    }, []);
    const { t } = useI18n();
    const navigate = useNavigate();

    const toggleSidebar = () => setSidebarOpen(open => {
        try { localStorage.setItem(COLLAPSE_KEY, open ? '1' : '0'); } catch { /* private mode */ }
        return !open;
    });

    const readUser = () => { try { return JSON.parse(localStorage.getItem('justiceai_user')) || null; } catch { return null; } };
    const [user, setUser] = useState(readUser);
    // Refresh the name and photo when the profile page changes them.
    useEffect(() => {
        const onUpdate = () => setUser(readUser());
        window.addEventListener('justiceai:user-updated', onUpdate);
        return () => window.removeEventListener('justiceai:user-updated', onUpdate);
    }, []);
    const initials = user?.full_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';
    const profilePicUrl = profilePictureUrl(user?.profile_picture);

    const sections = [
        {
            title: t('Research'), items: [
                { to: '/dashboard', icon: Home, label: t('Dashboard') },
                { to: '/chat', icon: MessageSquare, label: t('Legal research') },
                { to: '/documents', icon: FileUp, label: t('Document analysis') },
                { to: '/library', icon: Library, label: t('Law library') },
            ],
        },
        {
            title: t('Practice'), items: [
                { to: '/diary', icon: CalendarDays, label: t('Case diary') },
                { to: '/clients', icon: Users, label: t('Clients & cases') },
                { to: '/vault', icon: FolderLock, label: t('Document vault') },
                { to: '/billing', icon: Wallet, label: t('Billing') },
                { to: '/team', icon: UsersRound, label: t('Team') },
            ],
        },
    ];

    const handleLogout = () => {
        clearSession();
        navigate('/login');
    };

    return (
        <div className="h-screen flex bg-paper-100 text-slate-800 overflow-hidden">
            {/* ─── Sidebar ─── */}
            <aside className={`relative flex flex-col bg-ink-gradient text-white transition-[width] duration-200 ease-out z-30
                ${sidebarOpen ? 'w-[256px] min-w-[256px]' : 'w-[76px] min-w-[76px]'}`}>
                {/* soft gold glow in the corner, purely decorative */}
                <span aria-hidden className="pointer-events-none absolute inset-0 bg-ink-sheen" />

                <div className={`relative flex items-center h-[72px] flex-shrink-0 ${sidebarOpen ? 'px-5 justify-between' : 'justify-center'}`}>
                    <Link to="/" title={t('Justice AI website')} className="rounded-xl">
                        <Logo size={36} light showText={sidebarOpen} />
                    </Link>
                </div>

                <nav className="relative flex-1 px-3 pb-4 overflow-y-auto scrollbar-hide">
                    {sections.map(section => (
                        <div key={section.title} className="mt-3 first:mt-1">
                            {sidebarOpen
                                ? <div className="px-3 pt-3 pb-2 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white/35">{section.title}</div>
                                : <div className="mx-4 my-3 border-t border-white/10" />}
                            <div className="space-y-0.5">
                                {section.items.map(({ to, icon: Icon, label }) => (
                                    <NavLink key={to} to={to} end={to === '/dashboard'} title={sidebarOpen ? undefined : label}
                                        className={({ isActive }) =>
                                            `group relative flex items-center gap-3 h-10 rounded-xl text-[14px] transition-colors ${sidebarOpen ? 'px-3' : 'justify-center'}
                                            ${isActive ? 'bg-white/[0.08] text-white font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]' : 'text-white/60 font-medium hover:text-white hover:bg-white/[0.05]'}`}>
                                        {({ isActive }) => (
                                            <>
                                                {isActive && <span className="absolute start-0 top-2 bottom-2 w-[3px] rounded-e-full bg-gold-400 shadow-[0_0_12px_rgba(212,168,83,0.7)]" />}
                                                <Icon size={18} strokeWidth={isActive ? 2.2 : 1.9}
                                                    className={`flex-shrink-0 transition-colors ${isActive ? 'text-gold-300' : 'text-white/45 group-hover:text-white/80'}`} />
                                                {sidebarOpen && <span className="truncate">{label}</span>}
                                            </>
                                        )}
                                    </NavLink>
                                ))}
                            </div>
                        </div>
                    ))}
                </nav>

                {/* Account */}
                <div className="relative p-3 border-t border-white/10 space-y-1">
                    <NavLink to="/profile" title={t('Your profile')}
                        className={({ isActive }) => `flex items-center gap-3 p-2 rounded-xl transition-colors ${sidebarOpen ? '' : 'justify-center'} ${isActive ? 'bg-white/[0.08]' : 'hover:bg-white/[0.05]'}`}>
                        <span className="relative w-9 h-9 rounded-full overflow-hidden bg-gold-gradient flex items-center justify-center flex-shrink-0 ring-2 ring-white/10">
                            {profilePicUrl
                                ? <img src={profilePicUrl} alt="" className="w-full h-full object-cover" />
                                : <span className="text-[#2a1e05] text-[12px] font-bold">{initials}</span>}
                        </span>
                        {sidebarOpen && (
                            <span className="flex-1 min-w-0">
                                <span className="block text-[13.5px] font-semibold text-white truncate">{user?.full_name || t('User')}</span>
                                <span className="block text-[12px] text-white/45 truncate ltr text-start">{user?.email || ''}</span>
                            </span>
                        )}
                    </NavLink>
                    <div className={`flex items-center gap-1 ${sidebarOpen ? '' : 'flex-col'}`}>
                        <button onClick={handleLogout} title={t('Log out')}
                            className={`flex items-center gap-3 h-9 rounded-xl text-[13.5px] font-medium text-white/55 hover:text-red-300 hover:bg-red-500/10 transition-colors ${sidebarOpen ? 'px-3 flex-1' : 'justify-center w-full'}`}>
                            <LogOut size={17} strokeWidth={1.9} className="flex-shrink-0 rtl:rotate-180" />
                            {sidebarOpen && <span>{t('Log out')}</span>}
                        </button>
                        <button onClick={toggleSidebar} aria-label={sidebarOpen ? t('Collapse sidebar') : t('Expand sidebar')}
                            title={sidebarOpen ? t('Collapse sidebar') : t('Expand sidebar')}
                            className={`h-9 rounded-xl flex items-center justify-center text-white/45 hover:text-white hover:bg-white/[0.06] transition-colors ${sidebarOpen ? 'w-9' : 'w-full'}`}>
                            {sidebarOpen ? <ChevronsLeft size={17} className="rtl:rotate-180" /> : <ChevronsRight size={17} className="rtl:rotate-180" />}
                        </button>
                    </div>
                </div>
            </aside>

            {/* ─── Main Content ─── */}
            <main className="flex-1 flex flex-col overflow-hidden bg-paper-100">
                <Outlet />
            </main>
        </div>
    );
}
