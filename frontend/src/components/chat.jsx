import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ArrowUp, BookOpenCheck, Check, ChevronDown, Copy, ExternalLink, Loader2, Scale } from 'lucide-react';
import { isUrduText, isolateLatinRuns, profilePictureUrl } from '../api';
import { LogoMark } from './Logo';
import VoiceButton from './VoiceButton';
import { useI18n } from '../i18n';

/* Shared conversation UI for Legal research and Document analysis.
   Answers are set as a well-typeset document on the page (no bubble or card),
   the way modern assistants present them; only the user's own message sits in
   a navy bubble. Each message keeps its own direction: Urdu right-to-left,
   English left-to-right, whatever the interface language. */

/* ── Markdown, typeset for reading ─────────────────────────────────────────── */
const md = {
    h1: ({ children }) => <h2 className="font-serif text-[21px] font-semibold text-ink-950 tracking-tight mt-8 mb-3 first:mt-0">{children}</h2>,
    h2: ({ children }) => <h2 className="font-serif text-[20px] font-semibold text-ink-950 tracking-tight mt-8 mb-3 first:mt-0">{children}</h2>,
    h3: ({ children }) => <h3 className="font-serif text-[17.5px] font-semibold text-ink-950 tracking-tight mt-7 mb-2.5 first:mt-0">{children}</h3>,
    h4: ({ children }) => <h4 className="text-[15px] font-semibold text-ink-950 mt-5 mb-2 first:mt-0">{children}</h4>,
    p: ({ children }) => <p className="my-3.5 first:mt-0 last:mb-0">{children}</p>,
    strong: ({ children }) => <strong className="font-semibold text-ink-950">{children}</strong>,
    em: ({ children }) => <em className="italic text-slate-900">{children}</em>,
    ul: ({ children }) => <ul className="my-3.5 ps-5 list-disc marker:text-gold-500 space-y-2">{children}</ul>,
    ol: ({ children }) => <ol className="my-3.5 ps-5 list-decimal marker:text-gold-700 marker:font-semibold space-y-2">{children}</ol>,
    li: ({ children }) => <li className="ps-1.5">{children}</li>,
    hr: () => <hr className="my-7 border-line" />,
    a: ({ href, children }) => <a href={href} target="_blank" rel="noreferrer" className="text-ink-800 font-medium underline decoration-gold-400/70 decoration-[1.5px] underline-offset-[3px] hover:text-ink-950 hover:decoration-gold-500">{children}</a>,
    blockquote: ({ children }) => <blockquote className="my-5 border-s-[3px] border-gold-500/80 bg-paper-100 rounded-e-xl ps-4 pe-4 py-3 text-slate-700 [&>p]:my-1.5">{children}</blockquote>,
    table: ({ children }) => (
        <div className="my-5 overflow-x-auto rounded-xl border border-line shadow-soft">
            <table className="w-full text-[14px] border-collapse">{children}</table>
        </div>
    ),
    thead: ({ children }) => <thead className="bg-paper-100">{children}</thead>,
    th: ({ children }) => <th className="text-start px-4 py-2.5 text-[12.5px] font-semibold text-ink-800 border-b border-line">{children}</th>,
    td: ({ children }) => <td className="px-4 py-2.5 border-t border-line/70 align-top">{children}</td>,
    img: ({ src, alt }) => <img src={src} alt={alt || ''} loading="lazy" className="my-4 w-32 h-40 object-cover rounded-xl border border-line shadow-soft" />,
    pre: ({ children }) => <pre className="my-4 p-4 rounded-xl bg-ink-950 text-slate-100 text-[13px] leading-relaxed font-mono overflow-x-auto">{children}</pre>,
    // react-markdown no longer passes `inline`; a fenced block has a language class or line breaks.
    code: ({ className, children }) => (className || String(children).includes('\n'))
        ? <code className="font-mono">{children}</code>
        : <code className="px-1.5 py-0.5 rounded-md bg-paper-200 text-[13px] font-mono text-ink-900">{children}</code>,
};

export function Markdown({ text }) {
    const urdu = isUrduText(text);
    return (
        <div dir={urdu ? 'rtl' : 'ltr'} className={`text-[15.5px] leading-[1.8] text-slate-800 break-words ${urdu ? 'urdu-text' : 'text-left'}`}>
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={md}>{urdu ? isolateLatinRuns(text) : text}</ReactMarkdown>
        </div>
    );
}

/* ── Messages ──────────────────────────────────────────────────────────────── */
export function UserMessage({ text }) {
    const urdu = isUrduText(text);
    return (
        <div className="flex justify-end animate-fade-in">
            <div dir={urdu ? 'rtl' : 'ltr'}
                className={`max-w-[82%] px-[18px] py-3 rounded-[22px] rounded-ee-md bg-ink-900 text-white text-[15px] leading-relaxed whitespace-pre-wrap break-words shadow-[0_8px_20px_-10px_rgba(11,18,32,0.55)] ${urdu ? 'urdu-text' : 'text-left'}`}>
                {urdu ? isolateLatinRuns(text) : text}
            </div>
        </div>
    );
}

function AssistantLabel({ name, time }) {
    return (
        <div className="flex items-center gap-2.5 mb-3">
            <LogoMark size={28} />
            <span className="text-[13.5px] font-semibold text-ink-950">{name}</span>
            {time && <span className="text-[12px] text-slate-400">{time}</span>}
        </div>
    );
}

function Steps({ steps, live }) {
    const { t } = useI18n();
    const [open, setOpen] = useState(false);
    if (!steps?.length) return null;
    if (live) {
        return (
            <div className="relative ps-1 space-y-2.5">
                {steps.map((step, i) => {
                    const current = i === steps.length - 1;
                    return (
                        <div key={i} className="relative flex items-start gap-3 text-[14px] animate-fade-in">
                            {i < steps.length - 1 && <span className="absolute start-[7px] top-[20px] -bottom-[14px] w-px bg-line-strong" />}
                            {current
                                ? <span className="relative mt-[3px] w-[15px] h-[15px] flex items-center justify-center flex-shrink-0">
                                    <span className="absolute inset-0 rounded-full bg-gold-400/30 animate-ping" />
                                    <span className="relative w-[9px] h-[9px] rounded-full bg-gold-500 ring-2 ring-white" />
                                  </span>
                                : <span className="mt-[3px] w-[15px] h-[15px] rounded-full bg-emerald-50 ring-1 ring-emerald-200 flex items-center justify-center flex-shrink-0">
                                    <Check size={10} strokeWidth={3} className="text-emerald-600" />
                                  </span>}
                            <span className={current ? 'text-ink-950 font-medium' : 'text-slate-400'}>{step}</span>
                        </div>
                    );
                })}
            </div>
        );
    }
    return (
        <div className="mb-4">
            <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
                className="inline-flex items-center gap-2 h-8 ps-2.5 pe-3 rounded-full bg-paper-100 ring-1 ring-inset ring-line text-[12.5px] font-medium text-slate-600 hover:text-ink-950 hover:bg-paper-200 transition-colors select-none">
                <BookOpenCheck size={14} className="text-gold-600" />
                {t('Researched in {n} steps', { n: steps.length })}
                <ChevronDown size={14} className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && (
                <ol className="mt-3 ms-[15px] ps-5 border-s border-line-strong space-y-2 animate-fade-in">
                    {steps.map((step, i) => (
                        <li key={i} className="relative text-[13px] text-slate-500">
                            <span className="absolute -start-[24.5px] top-[7px] w-[7px] h-[7px] rounded-full bg-white ring-[1.5px] ring-gold-500" />
                            {step}
                        </li>
                    ))}
                </ol>
            )}
        </div>
    );
}

function Sources({ sources }) {
    const { t } = useI18n();
    if (!sources?.length) return null;
    return (
        <div className="mt-6 pt-5 border-t border-line">
            <div className="flex items-center gap-2 mb-3">
                <Scale size={14} className="text-gold-600" />
                <span className="text-[12.5px] font-semibold text-ink-900">{t('Sources')}</span>
                <span className="h-5 min-w-[20px] px-1.5 rounded-full bg-paper-200 text-[11px] font-semibold text-slate-600 flex items-center justify-center tabular-nums">{sources.length}</span>
            </div>
            <div className="flex flex-wrap gap-2">
                {sources.map((src, i) => {
                    const body = (
                        <>
                            <span className="w-5 h-5 rounded-md bg-ink-900 text-gold-300 text-[10.5px] font-bold flex items-center justify-center flex-shrink-0 tabular-nums">{i + 1}</span>
                            <span dir="auto" className="truncate max-w-[280px] font-medium text-ink-900">{src.name}</span>
                            {src.year && <span className="text-slate-400 flex-shrink-0 tabular-nums">{src.year}</span>}
                        </>
                    );
                    const base = 'inline-flex items-center gap-2 h-9 ps-1.5 pe-3 rounded-xl border border-line bg-white text-[12.5px] shadow-soft';
                    return src.pdf_url ? (
                        <a key={i} href={profilePictureUrl(src.pdf_url)} target="_blank" rel="noreferrer" title={src.court ? t('Open the document — {court}', { court: src.court }) : t('Open the document')}
                            className={`${base} group hover:border-gold-400/70 hover:shadow-lift hover:-translate-y-px transition-all`}>
                            {body}<ExternalLink size={12} className="text-slate-300 group-hover:text-gold-600 flex-shrink-0 transition-colors" />
                        </a>
                    ) : (
                        <span key={i} title={src.court || undefined} className={base}>{body}</span>
                    );
                })}
            </div>
        </div>
    );
}

function CopyButton({ text }) {
    const { t } = useI18n();
    const [copied, setCopied] = useState(false);
    const copy = async () => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
        } catch { /* clipboard unavailable — nothing to do */ }
    };
    return (
        <button type="button" onClick={copy} title={t('Copy answer')}
            className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-[12.5px] font-medium text-slate-500 hover:text-ink-950 hover:bg-paper-200 transition-colors">
            {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
            {copied ? t('Copied') : t('Copy')}
        </button>
    );
}

/** An assistant turn: label, research steps, the answer as plain text, sources, actions. */
export function AssistantMessage({ name = 'Justice AI', text, steps, sources, time, note, done = true }) {
    return (
        <div className="animate-fade-in">
            <AssistantLabel name={name} />
            <div className="ps-[38px]">
                <Steps steps={steps} live={!text} />
                {text && <Markdown text={text} />}
                {text && <Sources sources={sources} />}
                {text && done && (
                    <div className="mt-3 -ms-2.5 flex items-center gap-2 text-[12.5px] text-slate-400">
                        <CopyButton text={text} />
                        {note && <span className="inline-flex items-center gap-1.5"><span className="w-1 h-1 rounded-full bg-slate-300" />{note}</span>}
                        {time && <span className="inline-flex items-center gap-1.5"><span className="w-1 h-1 rounded-full bg-slate-300" /><span dir="ltr">{time}</span></span>}
                    </div>
                )}
            </div>
        </div>
    );
}

/** Shown before the first status or token arrives. */
export function AssistantThinking({ name = 'Justice AI', label }) {
    const { t } = useI18n();
    return (
        <div className="animate-fade-in">
            <AssistantLabel name={name} />
            <div className="ps-[38px] flex items-center gap-3 text-[14px] text-slate-500">
                <span className="flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-gold-500 typing-dot" />
                    <span className="w-1.5 h-1.5 rounded-full bg-gold-500 typing-dot" />
                    <span className="w-1.5 h-1.5 rounded-full bg-gold-500 typing-dot" />
                </span>
                {label || t('Thinking')}
            </div>
        </div>
    );
}

/* ── Composer ──────────────────────────────────────────────────────────────── */
/** Message box: grows with the text, Enter sends, Shift+Enter adds a line. */
export function Composer({ value, onChange, onSubmit, disabled, placeholder, inputRef, urdu = false, voiceLanguage, left, footer }) {
    const { t } = useI18n();
    const localRef = useRef(null);
    const ref = inputRef || localRef;
    const formRef = useRef(null);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
    }, [value, ref]);

    const onKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            if (value.trim() && !disabled) formRef.current?.requestSubmit();
        }
    };

    const canSend = value.trim() && !disabled;
    return (
        <div className="max-w-3xl mx-auto w-full">
            <form ref={formRef} onSubmit={onSubmit}
                className="rounded-[24px] bg-white border border-line-strong shadow-lift focus-within:border-gold-500/70 focus-within:shadow-[0_0_0_4px_rgba(191,149,63,0.14),0_10px_28px_-10px_rgba(18,29,47,0.22)] transition-[border-color,box-shadow]">
                <textarea ref={ref} rows={1} value={value} onChange={e => onChange(e.target.value)} onKeyDown={onKeyDown}
                    dir="auto" placeholder={placeholder}
                    className={`block w-full resize-none bg-transparent px-5 pt-4 pb-1.5 text-[15.5px] leading-relaxed text-ink-950 placeholder:text-slate-400 focus:outline-none focus:shadow-none ${urdu ? 'urdu-input' : ''}`} />
                <div className="flex items-center justify-between gap-2 px-3 pb-3 pt-1">
                    <div className="flex items-center gap-2 min-w-0">{left}</div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                        <VoiceButton language={voiceLanguage} disabled={disabled}
                            onTranscript={(spoken) => { onChange(value.trim() ? `${value.trim()} ${spoken}` : spoken); ref.current?.focus(); }} />
                        <button type="submit" disabled={!canSend} aria-label={t('Send')}
                            className={`w-9 h-9 rounded-full flex items-center justify-center transition-all
                                ${canSend ? 'bg-ink-gradient text-gold-300 shadow-[0_6px_14px_-6px_rgba(11,18,32,0.6)] hover:scale-105' : 'bg-paper-200 text-slate-400 cursor-not-allowed'}`}>
                            {disabled ? <Loader2 size={17} className="animate-spin" /> : <ArrowUp size={18} strokeWidth={2.4} />}
                        </button>
                    </div>
                </div>
            </form>
            {footer && <p className="text-center text-[11.5px] text-slate-400 mt-2.5 px-4">{footer}</p>}
        </div>
    );
}
