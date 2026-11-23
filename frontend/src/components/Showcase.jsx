import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarClock, FileSearch, FolderLock, LayoutDashboard, MessageSquareText, Wallet } from 'lucide-react';
import { useI18n } from '../i18n';

/* "See it in action": real screens of the app (public/screens/<lang>/*.webp, captured
   from the product with sample data), one per module, in a browser frame. The
   tabs advance on their own every few seconds and stop while the pointer is over them. */

const PERIOD = 6000;

export default function Showcase() {
    const { t, lang } = useI18n();
    const TABS = [
        { key: 'research', icon: MessageSquareText, title: t('Legal research'), text: t('A question in English or Urdu, the research steps as they happen, and an answer with every source linked.') },
        { key: 'dashboard', icon: LayoutDashboard, title: t('Dashboard'), text: t('Today’s hearings, outstanding fees, entries waiting for your approval and recent research, on one screen.') },
        { key: 'diary', icon: CalendarClock, title: t('Case diary'), text: t('Every hearing with its court, time and case number — and a WhatsApp reminder before each date.') },
        { key: 'billing', icon: Wallet, title: t('Billing'), text: t('Fees, expenses and payments per client and case. A partner approves each entry before it counts.') },
        { key: 'vault', icon: FolderLock, title: t('Document vault'), text: t('Petitions, orders and evidence filed under the right client and case, encrypted before storage.') },
        { key: 'documents', icon: FileSearch, title: t('Document analysis'), text: t('Upload an FIR or a judgment and ask questions answered only from that document.') },
    ];
    const [active, setActive] = useState(0);
    const [paused, setPaused] = useState(false);
    const [tick, setTick] = useState(0); // restarts the progress bar

    useEffect(() => {
        if (paused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        const id = setTimeout(() => { setActive(a => (a + 1) % TABS.length); setTick(x => x + 1); }, PERIOD);
        return () => clearTimeout(id);
    }, [active, paused, tick, TABS.length]);

    const choose = (i) => { setActive(i); setTick(x => x + 1); };
    const src = (key) => `/screens/${lang === 'ur' ? 'ur' : 'en'}/${key}.webp`;

    return (
        <div className="grid lg:grid-cols-[0.78fr_1.22fr] gap-8 lg:gap-12 items-start" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
            <div role="tablist" className="grid sm:grid-cols-2 lg:grid-cols-1 gap-2">
                {TABS.map((tab, i) => {
                    const on = i === active;
                    return (
                        <button key={tab.key} role="tab" aria-selected={on} onClick={() => choose(i)}
                            className={`relative overflow-hidden text-start rounded-2xl ring-1 transition-all duration-300 ${on ? 'bg-white ring-line-strong shadow-lift' : 'bg-transparent ring-transparent hover:bg-white/70 hover:ring-line'}`}>
                            <div className="flex items-start gap-3.5 p-4">
                                <span className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${on ? 'bg-ink-gradient ring-1 ring-white/5' : 'bg-paper-200 ring-1 ring-line'}`}>
                                    <tab.icon size={17} className={on ? 'text-gold-300' : 'text-ink-700'} />
                                </span>
                                <span className="min-w-0">
                                    <span className={`block text-[15px] font-semibold ${on ? 'text-ink-950' : 'text-ink-800'}`}>{tab.title}</span>
                                    <span className={`block text-[13px] leading-relaxed mt-1 transition-all duration-300 ${on ? 'text-slate-600 max-h-24 opacity-100' : 'text-slate-500 max-h-0 opacity-0 lg:max-h-0'} overflow-hidden`}>{tab.text}</span>
                                </span>
                            </div>
                            {on && <span key={tick} className={`absolute bottom-0 start-0 h-[3px] bg-gradient-to-r from-gold-500 to-gold-300 ${paused ? '' : 'showcase-progress'}`} style={{ width: paused ? '100%' : undefined }} />}
                        </button>
                    );
                })}
                <Link to="/features" className="group mt-2 inline-flex items-center gap-1.5 px-4 text-[14.5px] font-semibold text-ink-950 hover:text-gold-700 transition-colors">
                    {t('Explore the features')} <ArrowRight size={15} className="text-gold-600 transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
                </Link>
            </div>

            <div className="relative">
                <div aria-hidden className="absolute -inset-6 rounded-[40px] bg-[radial-gradient(ellipse_at_center,rgba(191,149,63,0.18),transparent_70%)] blur-2xl pointer-events-none" />
                <div className="relative rounded-[22px] p-1.5 bg-white/70 ring-1 ring-line shadow-[0_2px_4px_rgba(18,29,47,0.04),0_50px_100px_-40px_rgba(11,18,32,0.45)] backdrop-blur">
                    <div className="rounded-2xl bg-white ring-1 ring-line overflow-hidden">
                        <div className="flex items-center gap-2 px-4 h-10 border-b border-line bg-paper-100">
                            <span className="w-2.5 h-2.5 rounded-full bg-[#f0b4a8]" /><span className="w-2.5 h-2.5 rounded-full bg-[#efd59b]" /><span className="w-2.5 h-2.5 rounded-full bg-[#b9dcb4]" />
                            <span className="mx-auto px-3 h-6 inline-flex items-center rounded-md bg-white ring-1 ring-line text-[11px] text-slate-500">justice-ai · {TABS[active].title}</span>
                            <span className="w-12" />
                        </div>
                        <div className="relative aspect-[16/10] bg-paper-100">
                            {TABS.map((tab, i) => (
                                <img key={tab.key} src={src(tab.key)} alt={tab.title} loading={i === 0 ? 'eager' : 'lazy'} draggable={false}
                                    className={`absolute inset-0 w-full h-full object-cover object-top transition-all duration-700 ${i === active ? 'opacity-100 scale-100' : 'opacity-0 scale-[1.015]'}`} />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
