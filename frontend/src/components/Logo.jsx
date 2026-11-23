import React from 'react';
import { Scale } from 'lucide-react';
import { useI18n } from '../i18n';

/* One brand mark everywhere: navy tile, gold scales, serif wordmark. */
export function LogoMark({ size = 36, light = false }) {
    return (
        <span style={{ width: size, height: size }}
            className={`inline-flex items-center justify-center rounded-[10px] flex-shrink-0 ${light
                ? 'bg-white/[0.07] ring-1 ring-gold-400/30 shadow-[0_0_20px_-6px_rgba(212,168,83,0.5)]'
                : 'bg-ink-900 ring-1 ring-ink-950/10 shadow-sm'}`}>
            <Scale size={Math.round(size * 0.52)} className="text-gold-300" strokeWidth={2} />
        </span>
    );
}

export default function Logo({ size = 36, light = false, tagline = false, showText = true }) {
    const { t } = useI18n();
    return (
        <span className="inline-flex items-center gap-2.5">
            <LogoMark size={size} light={light} />
            {showText && (
                <span className="leading-none">
                    <span className={`font-serif text-[19px] font-semibold tracking-tight ${light ? 'text-white' : 'text-ink-950'}`}>
                        Justice <span className={light ? 'text-gold-300' : 'text-gold-700'}>AI</span>
                    </span>
                    {tagline && <span className={`block text-[10px] font-medium tracking-[0.18em] uppercase mt-1 ${light ? 'text-white/50' : 'text-slate-400'}`}>{t('Legal workspace')}</span>}
                </span>
            )}
        </span>
    );
}
