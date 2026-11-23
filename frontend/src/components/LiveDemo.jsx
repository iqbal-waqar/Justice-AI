import React, { useEffect, useRef, useState } from 'react';
import { ArrowUp, CheckCircle2, ExternalLink, Loader2, Mic, Scale, Lock } from 'lucide-react';
import { isolateLatinRuns } from '../api';
import { useI18n } from '../i18n';

/* The research screen, running by itself: a question is typed, the four research
   steps tick off, the answer streams in and the sources appear — then it starts
   again with the next question. Stops animating when the tab is hidden, and shows
   the finished state at once for visitors who prefer less motion. */

const SCENARIOS = {
    en: [
        { q: 'Is the offence under section 489-F PPC bailable?', found: 4,
          a: 'The judgments do not call it "bailable". Section 489-F PPC carries a maximum of three years, so it falls outside the prohibitory clause of Section 497 Cr.P.C. — bail is therefore the rule and refusal the exception. The Supreme Court applied this in Noman Khaliq v. The State (2023 SCMR 2122).',
          s: ['Noman Khaliq v. The State', 'Abdul Saboor v. The State', 'Pakistan Penal Code, 1860'] },
        { q: 'What is the effect of delay in lodging an FIR?', found: 5,
          a: 'Unexplained delay casts doubt on the prosecution story and the benefit goes to the accused. A delay that is explained — distance to the police station, the condition of the injured — does not by itself damage the case, as the Supreme Court held in Mst. Asia Bibi v. The State (PLD 2019 SC 64).',
          s: ['Mst. Asia Bibi v. The State', 'Muhammad Ashraf v. The State'] },
    ],
    ur: [
        { q: 'کیا دفعہ 489-F PPC کے تحت جرم قابلِ ضمانت ہے؟', found: 4,
          a: 'فیصلے اسے "قابلِ ضمانت" نہیں کہتے۔ دفعہ 489-F PPC کی زیادہ سے زیادہ سزا تین سال ہے، اس لیے یہ دفعہ 497 ضابطہ فوجداری کی ممانعتی شق سے باہر ہے — چنانچہ ضمانت اصول ہے اور انکار استثنا۔ سپریم کورٹ نے Noman Khaliq v. The State (2023 SCMR 2122) میں یہی اصول لاگو کیا۔',
          s: ['Noman Khaliq v. The State', 'Abdul Saboor v. The State', 'Pakistan Penal Code, 1860'] },
        { q: 'ایف آئی آر درج کرانے میں تاخیر کا کیا اثر ہوتا ہے؟', found: 5,
          a: 'بلا وضاحت تاخیر استغاثہ کی کہانی کو مشکوک بنا دیتی ہے اور اس کا فائدہ ملزم کو جاتا ہے۔ جس تاخیر کی وضاحت موجود ہو — تھانے کا فاصلہ، زخمی کی حالت — وہ بذاتِ خود مقدمے کو نقصان نہیں پہنچاتی، جیسا کہ سپریم کورٹ نے Mst. Asia Bibi v. The State (PLD 2019 SC 64) میں قرار دیا۔',
          s: ['Mst. Asia Bibi v. The State', 'Muhammad Ashraf v. The State'] },
    ],
};

const reduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function LiveDemo() {
    const { t, lang } = useI18n();
    const scenarios = SCENARIOS[lang] || SCENARIOS.en;
    const [idx, setIdx] = useState(0);
    const sc = scenarios[idx % scenarios.length];
    const steps = [t('Understood the question'), t('Searched case law across all courts'), t('Found {n} judgments on point', { n: sc.found }), t('Checked every statement against the sources')];
    const words = sc.a.split(' ');
    const done = { typed: sc.q.length, step: steps.length, word: words.length, sources: true };
    const [st, setSt] = useState(() => reduced() ? done : { typed: 0, step: 0, word: 0, sources: false });
    const timer = useRef();

    useEffect(() => {
        if (reduced()) { setSt(done); return; }
        let cancelled = false;
        const wait = (ms) => new Promise(r => { timer.current = setTimeout(r, ms); });
        const paused = () => document.visibilityState === 'hidden';
        (async () => {
            setSt({ typed: 0, step: 0, word: 0, sources: false });
            await wait(700);
            for (let i = 1; i <= sc.q.length && !cancelled; i++) { setSt(s => ({ ...s, typed: i })); await wait(paused() ? 0 : 28 + Math.random() * 30); }
            await wait(500);
            for (let i = 1; i <= steps.length && !cancelled; i++) { setSt(s => ({ ...s, step: i })); await wait(650); }
            await wait(250);
            for (let i = 1; i <= words.length && !cancelled; i++) { setSt(s => ({ ...s, word: i })); await wait(paused() ? 0 : 55 + Math.random() * 45); }
            await wait(400);
            if (!cancelled) setSt(s => ({ ...s, sources: true }));
            await wait(6500);
            if (!cancelled) setIdx(i => i + 1);
        })();
        return () => { cancelled = true; clearTimeout(timer.current); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [idx, lang]);

    const urdu = lang === 'ur';
    const typing = st.typed < sc.q.length;
    const answering = st.step === steps.length && st.word < words.length;
    const text = urdu ? isolateLatinRuns(words.slice(0, st.word).join(' ')) : words.slice(0, st.word).join(' ');

    return (
        <div className="rounded-[22px] p-1.5 bg-white/70 ring-1 ring-line shadow-[0_2px_4px_rgba(18,29,47,0.04),0_60px_120px_-40px_rgba(11,18,32,0.5)] backdrop-blur text-start">
            <div className="rounded-2xl bg-white ring-1 ring-line overflow-hidden">
                <div className="flex items-center gap-2 px-4 h-10 border-b border-line bg-paper-100">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#f0b4a8]" /><span className="w-2.5 h-2.5 rounded-full bg-[#efd59b]" /><span className="w-2.5 h-2.5 rounded-full bg-[#b9dcb4]" />
                    <span className="mx-auto px-3 h-6 inline-flex items-center gap-1.5 rounded-md bg-white ring-1 ring-line text-[11px] text-slate-500"><Lock size={10} className="text-emerald-600" />justice-ai · {t('Legal research')}</span>
                    <span className="w-12" />
                </div>
                <div className="px-5 sm:px-8 py-6 min-h-[420px] sm:min-h-[440px] flex flex-col text-[13.5px] bg-gradient-to-b from-white to-paper-50">
                    {/* question */}
                    <div className="flex justify-end min-h-[44px]">
                        {st.typed > 0 && (
                            <div dir={urdu ? 'rtl' : 'ltr'} className={`max-w-[85%] px-4 py-2.5 rounded-3xl rounded-ee-lg bg-ink-900 text-white shadow-soft ${urdu ? 'urdu-text text-[14px] leading-[1.9]' : ''}`}>
                                {urdu ? isolateLatinRuns(sc.q.slice(0, st.typed)) : sc.q.slice(0, st.typed)}{typing && <span className="inline-block w-[2px] h-[1em] bg-gold-300 ms-0.5 align-middle animate-pulse" />}
                            </div>
                        )}
                    </div>
                    {/* steps */}
                    <div className={`mt-4 transition-opacity duration-500 ${st.step > 0 ? 'opacity-100' : 'opacity-0'}`}>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="w-6 h-6 rounded-lg bg-ink-900 flex items-center justify-center"><Scale size={12} className="text-gold-300" /></span>
                            <span className="text-[12.5px] font-semibold text-ink-950">Justice AI</span>
                            {st.step < steps.length ? <span className="text-[11.5px] text-slate-400 flex items-center gap-1"><Loader2 size={12} className="animate-spin text-gold-600" />{t('Researching…')}</span>
                                : <span className="text-[11.5px] text-slate-400 flex items-center gap-1"><CheckCircle2 size={12} className="text-emerald-600" />{t('Researched in {n} steps', { n: steps.length })}</span>}
                        </div>
                        <ol className="ps-8 grid sm:grid-cols-2 gap-x-6 gap-y-1.5 text-[12.5px]">
                            {steps.map((s, i) => (
                                <li key={s} className={`flex items-center gap-2 transition-all duration-500 ${i < st.step ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'}`}>
                                    <CheckCircle2 size={14} className="text-emerald-600 flex-shrink-0" /><span className="text-slate-600">{s}</span>
                                </li>
                            ))}
                        </ol>
                    </div>
                    {/* answer */}
                    <div className={`ps-8 mt-3.5 flex-1 ${st.word > 0 ? '' : 'invisible'}`}>
                        <p dir={urdu ? 'rtl' : 'ltr'} className={`text-slate-700 ${urdu ? 'urdu-text text-[14.5px] leading-[2.05]' : 'leading-[1.75]'}`}>
                            {text}{answering && <span className="inline-block w-[2px] h-[1em] bg-ink-900 ms-0.5 align-middle animate-pulse" />}
                        </p>
                        <div className={`mt-3.5 flex flex-wrap gap-1.5 transition-all duration-500 ${st.sources ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'}`}>
                            {sc.s.map((n, i) => (
                                <span key={n} dir="ltr" className="inline-flex items-center gap-1.5 ps-1.5 pe-2.5 py-1 rounded-full bg-white ring-1 ring-line shadow-soft text-[11.5px] text-slate-700">
                                    <span className="w-4 h-4 rounded-full bg-ink-900 text-white text-[9px] font-semibold flex items-center justify-center">{i + 1}</span>{n}<ExternalLink size={10} className="text-slate-400" />
                                </span>
                            ))}
                        </div>
                    </div>
                    {/* composer */}
                    <div className="mt-5 flex items-center gap-3 ps-5 pe-2 h-12 rounded-full ring-1 ring-line-strong bg-white shadow-soft text-slate-400">
                        <span className="flex-1 truncate">{t('Ask a follow-up, in English or اردو…')}</span>
                        <Mic size={16} />
                        <span className="w-8 h-8 rounded-full bg-ink-900 flex items-center justify-center"><ArrowUp size={15} className="text-gold-300" /></span>
                    </div>
                </div>
            </div>
        </div>
    );
}
