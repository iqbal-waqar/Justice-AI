import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
    Scale, Home, MessageSquare, CalendarDays, ChevronLeft, ChevronRight,
    LogOut, FileUp
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function Layout() {
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const navigate = useNavigate();

    const stored = localStorage.getItem('justiceai_user');
    const user = stored ? JSON.parse(stored) : null;
    const initials = user?.full_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';
    const profilePicUrl = user?.profile_picture?.startsWith('http')
        ? user.profile_picture
        : user?.profile_picture ? `${API}${user.profile_picture}` : null;

    const navItems = [
        { to: '/', icon: Home, label: 'Home', desc: 'Dashboard' },
        { to: '/chat', icon: MessageSquare, label: 'Legal Chat', desc: 'AI Research' },
        { to: '/diary', icon: CalendarDays, label: 'Case Diary', desc: 'Hearings & Notes' },
        { to: '/documents', icon: FileUp, label: 'Documents', desc: 'Upload & Analyze' },
    ];

    const handleLogout = () => {
        localStorage.removeItem('justiceai_token');
        localStorage.removeItem('justiceai_user');
        navigate('/login');
    };

    return (
        <div className="h-screen flex bg-primary-950 text-white overflow-hidden">
            {/* ─── Sidebar ─── */}
            <aside
                className={`relative flex flex-col bg-gradient-to-b from-[#0b1022] to-[#070b16] border-r border-white/5 transition-all duration-300 ease-in-out z-30 shadow-[1px_0_30px_-10px_rgba(0,0,0,0.6)]
          ${sidebarOpen ? 'w-[280px] min-w-[280px]' : 'w-[76px] min-w-[76px]'}`}
            >
                {/* top hairline glow */}
                <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-gold-500/[0.06] to-transparent" />

                {/* Logo */}
                <div className="relative flex items-center gap-3 px-5 h-[72px] border-b border-white/5 flex-shrink-0">
                    <div className="relative flex-shrink-0">
                        <div className="absolute inset-0 bg-gold-400/30 blur-lg rounded-xl animate-glow-pulse" />
                        <div className="relative w-10 h-10 rounded-xl bg-gold-gradient flex items-center justify-center shadow-glow-gold">
                            <Scale size={22} className="text-[#2a1e05]" />
                        </div>
                    </div>
                    {sidebarOpen && (
                        <div className="animate-fade-in">
                            <h1 className="font-display text-lg font-extrabold tracking-tight leading-none">
                                Justice<span className="text-gradient-gold">AI</span>
                            </h1>
                            <p className="text-[10px] text-slate-400 font-medium tracking-[0.2em] uppercase mt-0.5">Legal Intelligence</p>
                        </div>
                    )}
                </div>

                {/* Navigation */}
                <nav className="flex-1 px-3 py-6 space-y-1.5 overflow-y-auto scrollbar-hide">
                    {navItems.map(({ to, icon: Icon, label, desc }) => (
                        <NavLink
                            key={to}
                            to={to}
                            end={to === '/'}
                            className={({ isActive }) =>
                                `group relative flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all duration-200
                ${isActive
                                    ? 'bg-gradient-to-r from-gold-500/15 to-transparent text-white'
                                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                                }`
                            }
                        >
                            {({ isActive }) => (
                                <>
                                    {/* active accent bar */}
                                    <span className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 rounded-r-full bg-gold-gradient transition-all duration-300 ${isActive ? 'h-7 opacity-100' : 'h-0 opacity-0'}`} />
                                    <Icon size={20} className={`flex-shrink-0 transition-all group-hover:scale-110 ${isActive ? 'text-gold-400' : ''}`} />
                                    {sidebarOpen && (
                                        <div className="flex flex-col animate-fade-in min-w-0">
                                            <span className="leading-tight">{label}</span>
                                            <span className={`text-[10.5px] font-normal leading-tight truncate ${isActive ? 'text-gold-400/70' : 'text-slate-600 group-hover:text-slate-500'}`}>{desc}</span>
                                        </div>
                                    )}
                                </>
                            )}
                        </NavLink>
                    ))}
                </nav>

                {/* Bottom — User Profile */}
                <div className="px-3 py-4 border-t border-white/5 space-y-1.5">
                    <NavLink
                        to="/profile"
                        className={({ isActive }) =>
                            `flex items-center gap-3 p-2.5 rounded-2xl text-sm font-medium transition-all duration-200 group cursor-pointer
                            ${isActive ? 'glass-card' : 'hover:bg-white/5 border border-transparent'}`
                        }
                    >
                        <div className="relative flex-shrink-0">
                            <div className="w-9 h-9 rounded-full overflow-hidden bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-sm font-bold shadow-lg ring-2 ring-white/10">
                                {profilePicUrl ? (
                                    <img src={profilePicUrl} alt="" className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-white text-xs">{initials}</span>
                                )}
                            </div>
                            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-[#070b16]" />
                        </div>
                        {sidebarOpen && (
                            <div className="flex-1 min-w-0 animate-fade-in">
                                <p className="text-sm font-semibold text-white truncate">{user?.full_name || 'User'}</p>
                                <p className="text-[11px] text-gold-400/80 font-medium truncate">{user?.email || ''}</p>
                            </div>
                        )}
                    </NavLink>

                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all duration-200 group text-slate-400 hover:text-red-400 hover:bg-red-500/10 w-full"
                    >
                        <LogOut size={20} className="flex-shrink-0 group-hover:scale-110 group-hover:-translate-x-0.5 transition-transform" />
                        {sidebarOpen && <span className="animate-fade-in">Logout</span>}
                    </button>
                </div>

                {/* Toggle */}
                <button
                    onClick={() => setSidebarOpen(!sidebarOpen)}
                    className="absolute -right-3.5 top-20 w-7 h-7 bg-[#0b1022] border border-white/10 rounded-full flex items-center justify-center text-slate-400 hover:text-gold-400 hover:border-gold-500/40 hover:bg-[#12182b] transition-all duration-200 shadow-lg z-40"
                >
                    {sidebarOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
                </button>
            </aside>

            {/* ─── Main Content ─── */}
            <main className="flex-1 flex flex-col overflow-hidden bg-[#0a0f1e] rounded-tl-[28px] border-t border-l border-white/[0.06]">
                <Outlet />
            </main>
        </div>
    );
}
