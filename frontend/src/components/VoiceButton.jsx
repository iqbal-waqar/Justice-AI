import React, { useEffect, useRef, useState } from 'react';
import { Mic, Square, Loader2 } from 'lucide-react';
import { apiFetch, getToken, SessionExpiredError } from '../api';
import { useI18n } from '../i18n';

const MAX_SECONDS = 90;

// Pick an audio format this browser can record (Chrome/Firefox: webm/ogg, Safari: mp4).
function pickMimeType() {
    const options = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
    return options.find(t => window.MediaRecorder?.isTypeSupported?.(t)) || '';
}

/**
 * Microphone button: record a spoken question, send it for transcription, and
 * hand the text back via onTranscript. The text goes into the input box so the
 * user can check it before sending — nothing is sent automatically.
 *
 * language: 'ur' tells the transcriber the speech is Urdu; anything else auto-detects.
 */
export default function VoiceButton({ onTranscript, language = 'auto', disabled = false, className = '' }) {
    const { t } = useI18n();
    const [state, setState] = useState('idle');   // idle | recording | transcribing
    const [seconds, setSeconds] = useState(0);
    const [error, setError] = useState('');
    const recorderRef = useRef(null);
    const chunksRef = useRef([]);
    const timerRef = useRef(null);
    const streamRef = useRef(null);

    const stopTracks = () => {
        streamRef.current?.getTracks().forEach(track => track.stop());
        streamRef.current = null;
        clearInterval(timerRef.current);
    };
    useEffect(() => () => { recorderRef.current?.state === 'recording' && recorderRef.current.stop(); stopTracks(); }, []);

    // Clear the error message after a few seconds.
    useEffect(() => {
        if (!error) return;
        const timer = setTimeout(() => setError(''), 5000);
        return () => clearTimeout(timer);
    }, [error]);

    const upload = async (blob, mimeType) => {
        setState('transcribing');
        try {
            const ext = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('ogg') ? 'ogg' : 'webm';
            const form = new FormData();
            form.append('audio', blob, `question.${ext}`);
            form.append('language', language === 'ur' ? 'ur' : 'auto');
            const res = await apiFetch('/api/v1/voice/transcribe', {
                method: 'POST',
                headers: { Authorization: `Bearer ${getToken()}` },
                body: form,
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.detail || t('Could not transcribe the recording.'));
            onTranscript?.(data.text);
        } catch (e) {
            if (!(e instanceof SessionExpiredError)) setError(e.message || t('Could not transcribe the recording.'));
        } finally {
            setState('idle');
        }
    };

    const start = async () => {
        setError('');
        if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
            setError(t('Voice input is not supported in this browser.'));
            return;
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;
            const mimeType = pickMimeType();
            const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
            chunksRef.current = [];
            recorder.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
            recorder.onstop = () => {
                stopTracks();
                const type = recorder.mimeType || mimeType || 'audio/webm';
                const blob = new Blob(chunksRef.current, { type });
                if (blob.size < 1500) { setState('idle'); setError(t('Recording was too short.')); return; }
                upload(blob, type);
            };
            recorderRef.current = recorder;
            recorder.start();
            setSeconds(0);
            setState('recording');
            timerRef.current = setInterval(() => {
                setSeconds(s => {
                    if (s + 1 >= MAX_SECONDS) recorder.state === 'recording' && recorder.stop();
                    return s + 1;
                });
            }, 1000);
        } catch (e) {
            stopTracks();
            setError(e?.name === 'NotAllowedError'
                ? t('Microphone access was blocked. Allow it in the browser address bar.')
                : t('No microphone was found.'));
        }
    };

    const stop = () => recorderRef.current?.state === 'recording' && recorderRef.current.stop();

    const mmss = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

    return (
        // `absolute` from the caller must not be combined with `relative`: both set
        // `position`, and Tailwind's `relative` wins, which pushed the mic out of the
        // input box. Either positioning still anchors the error popup.
        <div className={/\b(absolute|fixed)\b/.test(className) ? className : `relative ${className}`}>
            {state === 'recording' ? (
                <button type="button" onClick={stop} title={t('Stop and transcribe')}
                    className="flex items-center gap-1.5 h-9 ps-2.5 pe-3 rounded-full bg-red-500 text-white text-xs font-semibold shadow-[0_6px_14px_-6px_rgba(239,68,68,0.7)] hover:bg-red-600 transition-colors">
                    <span className="relative flex w-2.5 h-2.5">
                        <span className="absolute inline-flex h-full w-full rounded-full bg-white opacity-75 animate-ping" />
                        <span className="relative inline-flex rounded-full w-2.5 h-2.5 bg-white" />
                    </span>
                    <Square size={11} fill="currentColor" />
                    <span className="tabular-nums" dir="ltr">{mmss}</span>
                </button>
            ) : (
                <button type="button" onClick={start} disabled={disabled || state === 'transcribing'}
                    title={state === 'transcribing' ? t('Transcribing…') : t('Ask by voice (English, اردو or Roman Urdu)')}
                    aria-label={t('Ask by voice')}
                    className="flex items-center justify-center w-9 h-9 rounded-full text-slate-500 hover:text-ink-950 hover:bg-paper-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                    {state === 'transcribing' ? <Loader2 size={18} className="animate-spin text-ink-700" /> : <Mic size={18} />}
                </button>
            )}
            {error && (
                <div role="alert" className="absolute bottom-full end-0 mb-2 w-64 px-3.5 py-2.5 rounded-xl bg-ink-950 text-white text-xs leading-relaxed shadow-pop ring-1 ring-white/10 animate-fade-in z-30">
                    {error}
                </div>
            )}
        </div>
    );
}
