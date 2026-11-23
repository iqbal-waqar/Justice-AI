import React, { useEffect, useState } from 'react';
import { X, Loader2, AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { LanguageToggle, useI18n } from '../i18n';

/* Shared building blocks of the workspace. One visual language:
   warm paper canvas, white cards with warm hairlines, navy ink for structure,
   gold for emphasis, serif page titles. Pages pass already-translated text. */

// Same look without a width, for controls that set their own (w-40, w-48…):
// combining w-full with another width lets w-full win and stretch the control.
export const controlClass = "h-10 px-3.5 rounded-xl bg-white border border-line-strong text-sm text-ink-950 placeholder:text-slate-400 shadow-[0_1px_1px_rgba(18,29,47,0.03)] hover:border-ink-300 focus:outline-none focus:border-gold-500 focus:shadow-focus transition-[border-color,box-shadow] disabled:bg-paper-100 disabled:text-slate-400";
export const inputClass = `w-full ${controlClass}`;
// Textareas share the look but grow with their rows.
export const textareaClass = "w-full px-3.5 py-2.5 rounded-xl bg-white border border-line-strong text-sm text-ink-950 placeholder:text-slate-400 hover:border-ink-300 focus:outline-none focus:border-gold-500 focus:shadow-focus transition-[border-color,box-shadow] resize-none";

/* Page header: navy tile with gold icon, serif title, actions, and the
   EN / اردو switch in the top-right corner. */
export function PageHeader({ icon: Icon, title, subtitle, children }) {
    return (
        <header className="relative flex items-center justify-between gap-4 px-6 lg:px-8 min-h-[72px] py-3.5 border-b border-line bg-white/85 backdrop-blur-xl flex-shrink-0 z-10">
            <div className="flex items-center gap-3.5 min-w-0">
                <div className="relative w-10 h-10 rounded-xl bg-ink-gradient flex items-center justify-center flex-shrink-0 shadow-[0_6px_16px_-6px_rgba(11,18,32,0.55)] ring-1 ring-white/5">
                    <span className="absolute inset-0 rounded-xl bg-ink-sheen" />
                    <Icon size={18} className="relative text-gold-300" strokeWidth={2} />
                </div>
                <div className="min-w-0">
                    <h1 className="page-title text-[21px] leading-tight text-ink-950 truncate">{title}</h1>
                    {subtitle && <p className="text-[13px] text-slate-500 truncate mt-0.5">{subtitle}</p>}
                </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
                {children}
                {children && <span className="w-px h-6 bg-line mx-1 hidden sm:block" />}
                <LanguageToggle />
            </div>
        </header>
    );
}

export function Button({ variant = 'primary', size = 'md', icon: Icon, children, loading, className = '', ...props }) {
    const styles = {
        primary: 'bg-ink-900 text-white shadow-[0_1px_2px_rgba(11,18,32,0.25),inset_0_1px_0_rgba(255,255,255,0.08)] hover:bg-ink-800 active:bg-ink-950',
        gold: 'bg-gold-gradient text-[#2a1e05] shadow-[0_1px_2px_rgba(132,95,31,0.3),inset_0_1px_0_rgba(255,255,255,0.35)] hover:brightness-[1.04] active:brightness-95',
        secondary: 'bg-white border border-line-strong text-ink-900 shadow-[0_1px_2px_rgba(18,29,47,0.04)] hover:bg-paper-50 hover:border-ink-300',
        danger: 'bg-white border border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300',
        success: 'bg-emerald-600 text-white shadow-sm hover:bg-emerald-500',
        ghost: 'text-slate-600 hover:text-ink-950 hover:bg-paper-200',
    };
    const sizes = { sm: 'h-8 px-3 text-[13px] rounded-lg gap-1.5', md: 'h-10 px-4 text-sm rounded-xl gap-2', lg: 'h-11 px-5 text-[15px] rounded-xl gap-2' };
    return (
        <button {...props} disabled={props.disabled || loading}
            className={`inline-flex items-center justify-center font-semibold whitespace-nowrap transition-all duration-150 focus-visible:outline-none focus-visible:shadow-focus disabled:opacity-45 disabled:cursor-not-allowed ${sizes[size] || sizes.md} ${styles[variant]} ${className}`}>
            {loading ? <Loader2 size={15} className="animate-spin" /> : Icon && <Icon size={15} strokeWidth={2.2} />}
            {children}
        </button>
    );
}

/* White surface used for every panel on a page. */
export function Card({ className = '', children, ...props }) {
    return <div {...props} className={`bg-white border border-line rounded-2xl shadow-soft ${className}`}>{children}</div>;
}

/* Card header row: icon, title, optional action on the far side. */
export function CardHeader({ icon: Icon, title, action, className = '' }) {
    return (
        <div className={`flex items-center justify-between gap-3 px-5 h-14 border-b border-line ${className}`}>
            <div className="flex items-center gap-2.5 min-w-0">
                {Icon && <span className="w-7 h-7 rounded-lg bg-paper-200 text-ink-700 flex items-center justify-center flex-shrink-0"><Icon size={15} /></span>}
                <h3 className="text-[14.5px] font-semibold text-ink-950 truncate">{title}</h3>
            </div>
            {action}
        </div>
    );
}

export function Modal({ title, onClose, children, footer, wide = false }) {
    const { t } = useI18n();
    useEffect(() => {
        const onKey = (e) => e.key === 'Escape' && onClose?.();
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);
    return (
        <div className="fixed inset-0 bg-ink-950/45 backdrop-blur-[3px] flex items-center justify-center z-50 p-4 animate-fade-in" onMouseDown={onClose}>
            <div onMouseDown={e => e.stopPropagation()} role="dialog" aria-modal="true"
                className={`bg-white rounded-2xl shadow-pop ring-1 ring-ink-950/5 w-full ${wide ? 'max-w-2xl' : 'max-w-md'} max-h-[90vh] flex flex-col animate-slide-up`}>
                <div className="flex items-center justify-between gap-4 px-6 pt-5 pb-4 border-b border-line">
                    <h3 className="page-title text-[19px] text-ink-950">{title}</h3>
                    <button onClick={onClose} aria-label={t('Close')} className="w-8 h-8 -me-1.5 rounded-lg flex items-center justify-center hover:bg-paper-200 text-slate-400 hover:text-ink-950 transition-colors"><X size={17} /></button>
                </div>
                <div className="px-6 py-5 overflow-y-auto">{children}</div>
                {footer && <div className="px-6 py-4 border-t border-line bg-paper-50 rounded-b-2xl flex justify-end gap-2">{footer}</div>}
            </div>
        </div>
    );
}

export function Field({ label, hint, children }) {
    return (
        <label className="block">
            <span className="block text-[12.5px] font-semibold text-ink-800 mb-1.5">{label}</span>
            {children}
            {hint && <span className="block text-[11.5px] text-slate-500 mt-1.5">{hint}</span>}
        </label>
    );
}

export function StatCard({ label, value, sub, tone = 'slate', icon: Icon }) {
    const tones = {
        slate: ['text-ink-950', 'bg-paper-200 text-ink-700 ring-line'],
        gold: ['text-gold-700', 'bg-amber-50 text-gold-700 ring-amber-200/70'],
        green: ['text-emerald-700', 'bg-emerald-50 text-emerald-700 ring-emerald-200/70'],
        indigo: ['text-ink-950', 'bg-ink-50 text-ink-800 ring-ink-200/70'],
        red: ['text-red-600', 'bg-red-50 text-red-600 ring-red-200/70'],
    };
    const [valueTone, iconTone] = tones[tone] || tones.slate;
    return (
        <div className="relative overflow-hidden p-5 rounded-2xl bg-white border border-line shadow-soft">
            <div className="flex items-start justify-between gap-3 mb-3">
                <span className="text-[13px] font-medium text-slate-500">{label}</span>
                {Icon && <span className={`w-9 h-9 rounded-xl ring-1 flex items-center justify-center flex-shrink-0 ${iconTone}`}><Icon size={16} /></span>}
            </div>
            <div className={`text-[26px] leading-none font-semibold tracking-tight tabular-nums ${valueTone}`}>{value}</div>
            {sub && <div className="text-[12.5px] text-slate-500 mt-2">{sub}</div>}
        </div>
    );
}

const BADGE = {
    pending: 'bg-amber-50 text-amber-800 ring-amber-200',
    approved: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    rejected: 'bg-red-50 text-red-700 ring-red-200',
    voided: 'bg-slate-100 text-slate-500 ring-slate-200 line-through',
    fee: 'bg-ink-50 text-ink-800 ring-ink-200',
    expense: 'bg-orange-50 text-orange-700 ring-orange-200',
    payment: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    open: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    closed: 'bg-slate-100 text-slate-600 ring-slate-200',
    owner: 'bg-amber-50 text-gold-700 ring-amber-200',
    partner: 'bg-ink-50 text-ink-800 ring-ink-200',
    associate: 'bg-ink-50 text-ink-800 ring-ink-200',
    clerk: 'bg-paper-200 text-slate-600 ring-line-strong',
};
const DOT = {
    pending: 'bg-amber-500', approved: 'bg-emerald-500', rejected: 'bg-red-500', open: 'bg-emerald-500',
    closed: 'bg-slate-400', payment: 'bg-emerald-500', expense: 'bg-orange-500', fee: 'bg-ink-500',
};
export function Badge({ value, children }) {
    const { t } = useI18n();
    return (
        <span className={`inline-flex items-center gap-1.5 h-[22px] px-2 rounded-full ring-1 ring-inset text-[11px] font-semibold capitalize whitespace-nowrap ${BADGE[value] || BADGE.clerk}`}>
            {DOT[value] && <span className={`w-1.5 h-1.5 rounded-full ${DOT[value]}`} />}
            {children || t(value)}
        </span>
    );
}

export function Alert({ tone = 'error', children, onClose }) {
    const { t } = useI18n();
    if (!children) return null;
    const look = {
        error: ['bg-red-50/80 border-red-200 text-red-800', AlertCircle, 'text-red-500'],
        success: ['bg-emerald-50/80 border-emerald-200 text-emerald-800', CheckCircle2, 'text-emerald-500'],
    }[tone] || ['bg-amber-50/80 border-amber-200 text-amber-900', Info, 'text-amber-500'];
    const [toneClass, Icon, iconClass] = look;
    // A browser that cannot reach the server reports "Failed to fetch"; say it plainly.
    const text = children === 'Failed to fetch' || children === 'NetworkError when attempting to fetch resource.'
        ? t("Can't reach the server. Check your connection and try again.") : children;
    return (
        <div role={tone === 'error' ? 'alert' : 'status'} className={`flex items-start gap-3 px-4 py-3 rounded-xl border text-sm animate-fade-in ${toneClass}`}>
            <Icon size={17} className={`flex-shrink-0 mt-px ${iconClass}`} />
            <span className="flex-1 min-w-0">{text}</span>
            {onClose && <button onClick={onClose} aria-label={t('Close')} className="opacity-50 hover:opacity-100 transition-opacity"><X size={15} /></button>}
        </div>
    );
}

/** Small modal asking for a required reason (reject / void). */
export function ReasonModal({ title, label, confirmLabel, onConfirm, onClose }) {
    const { t } = useI18n();
    const [note, setNote] = useState('');
    const [busy, setBusy] = useState(false);
    return (
        <Modal title={title} onClose={onClose} footer={<>
            <Button variant="secondary" onClick={onClose}>{t('Cancel')}</Button>
            <Button variant="danger" loading={busy} disabled={!note.trim()}
                onClick={async () => { setBusy(true); try { await onConfirm(note.trim()); } finally { setBusy(false); } }}>{confirmLabel}</Button>
        </>}>
            <Field label={label}>
                <textarea autoFocus rows={3} value={note} onChange={e => setNote(e.target.value)} className={textareaClass} />
            </Field>
        </Modal>
    );
}

export function EmptyState({ icon: Icon, title, text, action }) {
    return (
        <div className="text-center py-16 px-6 animate-fade-in">
            <span className="relative mx-auto mb-5 w-16 h-16 flex items-center justify-center">
                <span className="absolute inset-0 rounded-2xl bg-gradient-to-br from-amber-50 to-paper-200 ring-1 ring-line rotate-6" />
                <span className="relative w-16 h-16 rounded-2xl bg-white ring-1 ring-line shadow-soft flex items-center justify-center"><Icon size={24} className="text-gold-600" strokeWidth={1.8} /></span>
            </span>
            <h3 className="page-title text-[18px] text-ink-950 mb-1.5">{title}</h3>
            <p className="text-sm text-slate-500 mb-6 max-w-sm mx-auto leading-relaxed">{text}</p>
            {action}
        </div>
    );
}

/* Segmented tabs (e.g. "All entries / Statements"). */
export function Tabs({ value, onChange, options }) {
    return (
        <div role="tablist" className="inline-flex items-center gap-1 p-1 rounded-xl bg-paper-200/80 ring-1 ring-inset ring-line">
            {options.map(o => (
                <button key={o.value} role="tab" aria-selected={value === o.value} onClick={() => onChange(o.value)}
                    className={`h-8 px-3.5 rounded-lg text-[13px] font-semibold transition-all ${value === o.value ? 'bg-white text-ink-950 shadow-soft ring-1 ring-line' : 'text-slate-500 hover:text-ink-950'}`}>
                    {o.label}
                </button>
            ))}
        </div>
    );
}
