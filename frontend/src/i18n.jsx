import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import ur from './locales/ur';

/* English / Urdu interface.

   Every piece of interface text is written in English and passed through t():
       t('Sign in')                          → "سائن اِن" when Urdu is chosen
       t('{n} cases', { n: 4 })              → placeholders are filled in after translating
   The English text itself is the key, so a string without an Urdu entry simply
   stays in English. Urdu entries live in src/locales/ur/*.js; run
   `npm run i18n:check` to list strings that have none.

   Choosing Urdu also switches the page to right-to-left (dir="rtl") and the
   Nastaliq typeface (see index.css). The choice is remembered per browser. */

const STORAGE_KEY = 'justiceai_lang';
const LANGS = ['en', 'ur'];

function readLang() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        return LANGS.includes(saved) ? saved : 'en';
    } catch {
        return 'en';
    }
}

let currentLang = readLang();

function fill(text, vars) {
    if (!vars) return text;
    return text.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined && vars[k] !== null ? String(vars[k]) : m));
}

/** Translate outside React components (data files, api.js). Components should use useI18n().t,
 *  which also re-renders them when the language changes. */
export function translate(text, vars) {
    if (typeof text !== 'string') return text;
    const out = currentLang === 'ur' ? (ur[text] ?? text) : text;
    return fill(out, vars);
}

function applyToDocument(lang) {
    const html = document.documentElement;
    html.lang = lang;
    html.dir = lang === 'ur' ? 'rtl' : 'ltr';
}

const I18nContext = createContext({ lang: 'en', dir: 'ltr', setLang: () => {}, t: translate });

export function LanguageProvider({ children }) {
    const [lang, setLangState] = useState(currentLang);

    useEffect(() => { applyToDocument(lang); }, [lang]);

    const setLang = useCallback((next) => {
        if (!LANGS.includes(next)) return;
        currentLang = next;
        try { localStorage.setItem(STORAGE_KEY, next); } catch { /* private mode */ }
        setLangState(next);
    }, []);

    // t depends on lang so every consumer re-renders when it changes.
    const t = useCallback((text, vars) => translate(text, vars), [lang]); // eslint-disable-line react-hooks/exhaustive-deps
    const value = useMemo(() => ({ lang, dir: lang === 'ur' ? 'rtl' : 'ltr', setLang, t }), [lang, setLang, t]);
    return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
    return useContext(I18nContext);
}

/** The EN / اردو switch shown in the top-right corner. */
export function LanguageToggle({ dark = false, className = '' }) {
    const { lang, setLang } = useI18n();
    const base = dark
        ? 'bg-white/10 ring-1 ring-white/15'
        : 'bg-slate-100 ring-1 ring-slate-200';
    const option = (code, label, extra = '') => {
        const active = lang === code;
        const tone = active
            ? (dark ? 'bg-white text-ink-950 shadow-sm' : 'bg-white text-ink-950 shadow-sm')
            : (dark ? 'text-white/70 hover:text-white' : 'text-slate-500 hover:text-ink-950');
        return (
            <button type="button" onClick={() => setLang(code)} aria-pressed={active}
                lang={code} dir={code === 'ur' ? 'rtl' : 'ltr'}
                className={`px-2.5 h-7 rounded-md text-[12.5px] font-semibold leading-none transition-colors ${tone} ${extra}`}>
                {label}
            </button>
        );
    };
    return (
        <div dir="ltr" role="group" aria-label="Language / زبان"
            className={`inline-flex items-center gap-0.5 p-0.5 rounded-lg flex-shrink-0 ${base} ${className}`}>
            {option('en', 'EN')}
            {option('ur', 'اردو', 'font-urdu text-[13px]')}
        </div>
    );
}
