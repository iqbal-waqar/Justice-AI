import React, { useState, useEffect, useRef } from 'react';
import { apiFetch, isUrduText } from '../api';
import {
    Upload, FileText, Trash2, MessageSquare, ArrowLeft, Loader2, HardDrive, Layers, Puzzle, FileUp, ShieldCheck
} from 'lucide-react';
import { AssistantMessage, AssistantThinking, Composer, UserMessage } from '../components/chat';
import { Button, EmptyState, PageHeader } from '../components/ui';
import { LanguageToggle, useI18n } from '../i18n';

/* Status pill for an uploaded document: ready / processing / failed. */
function StatusPill({ status }) {
    const { t } = useI18n();
    const look = status === 'ready'
        ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
        : status === 'processing' ? 'bg-amber-50 text-amber-800 ring-amber-200' : 'bg-red-50 text-red-700 ring-red-200';
    return (
        <span className={`inline-flex items-center gap-1.5 h-[22px] px-2 rounded-full ring-1 ring-inset text-[11px] font-semibold ${look}`}>
            {status === 'processing'
                ? <Loader2 size={11} className="animate-spin" />
                : <span className={`w-1.5 h-1.5 rounded-full ${status === 'ready' ? 'bg-emerald-500' : 'bg-red-500'}`} />}
            {t(status)}
        </span>
    );
}



export default function DocumentsPage() {
    const { t, lang } = useI18n();
    const [documents, setDocuments] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [activeDoc, setActiveDoc] = useState(null); // Document being chatted with
    const [chat, setChat] = useState([]);
    const [query, setQuery] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [dragOver, setDragOver] = useState(false);
    const fileInputRef = useRef(null);
    const chatEndRef = useRef(null);
    const inputRef = useRef(null);

    const token = localStorage.getItem('justiceai_token');
    const headers = { Authorization: `Bearer ${token}` };
    const jsonHeaders = { ...headers, 'Content-Type': 'application/json' };

    useEffect(() => { fetchDocuments(); }, []);
    useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chat, isTyping]);

    const fetchDocuments = async () => {
        try {
            const res = await apiFetch(`/api/v1/documents`, { headers });
            if (res.ok) setDocuments(await res.json());
        } catch (e) { console.error('Failed to fetch documents:', e); }
    };

    const handleUpload = async (file) => {
        if (!file || !file.name.toLowerCase().endsWith('.pdf')) {
            alert(t('Only PDF files are supported.'));
            return;
        }
        if (file.size > 20 * 1024 * 1024) {
            alert(t('File too large. Maximum size is 20MB.'));
            return;
        }

        setUploading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await apiFetch(`/api/v1/documents/upload`, {
                method: 'POST', headers, body: formData,
            });
            if (res.ok) {
                fetchDocuments();
            } else {
                const err = await res.json();
                alert(err.detail || t('Upload failed'));
            }
        } catch (e) {
            console.error('Upload error:', e);
            alert(t('Upload failed. Check server connection.'));
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (docId) => {
        if (!confirm(t('Delete this document and all its data?'))) return;
        try {
            await apiFetch(`/api/v1/documents/${docId}`, { method: 'DELETE', headers });
            setDocuments(prev => prev.filter(d => d.id !== docId));
            if (activeDoc?.id === docId) { setActiveDoc(null); setChat([]); }
        } catch (e) { console.error('Delete error:', e); }
    };

    const openDocChat = (doc) => {
        setActiveDoc(doc);
        setChat([]);
        setQuery('');
        setTimeout(() => inputRef.current?.focus(), 100);
    };

    const handleDocChat = async (e) => {
        e.preventDefault();
        if (!query.trim() || isTyping || !activeDoc) return;

        const userMsg = { role: 'user', text: query, time: new Date() };
        setChat(prev => [...prev, userMsg]);
        const q = query;
        setQuery('');
        setIsTyping(true);

        try {
            const res = await apiFetch(`/api/v1/documents/${activeDoc.id}/chat`, {
                method: 'POST', headers: jsonHeaders,
                body: JSON.stringify({ query: q }),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            setChat(prev => [...prev, {
                role: 'ai', text: data.answer,
                chunks: data.chunks_used, time: new Date(),
            }]);
        } catch (err) {
            setChat(prev => [...prev, {
                role: 'ai', text: '⚠️ ' + t('Error getting response. Please try again.'),
                time: new Date(),
            }]);
        } finally {
            setIsTyping(false);
            inputRef.current?.focus();
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file) handleUpload(file);
    };

    const formatSize = (bytes) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    // ── Document Chat View ──
    if (activeDoc) {
        const docSuggestions = [t('Summarize this document'), t('What are the key legal provisions?'), t('Who are the parties involved?'), t('What was the final verdict?')];
        return (
            <div className="flex-1 flex flex-col h-full bg-white">
                {/* Header */}
                <header className="flex items-center gap-3 px-6 h-[72px] border-b border-line bg-white/85 backdrop-blur-xl flex-shrink-0 z-10">
                    <button onClick={() => { setActiveDoc(null); setChat([]); }} aria-label={t('Back')} title={t('Back')}
                        className="w-9 h-9 -ms-1.5 rounded-xl flex items-center justify-center hover:bg-paper-200 text-slate-500 hover:text-ink-950 transition-colors">
                        <ArrowLeft size={19} className="rtl:rotate-180" />
                    </button>
                    <div className="relative w-10 h-10 rounded-xl bg-ink-gradient flex items-center justify-center flex-shrink-0 shadow-[0_6px_16px_-6px_rgba(11,18,32,0.55)] ring-1 ring-white/5">
                        <span className="absolute inset-0 rounded-xl bg-ink-sheen" />
                        <FileText size={18} className="relative text-gold-300" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <h1 className="page-title text-[19px] leading-tight text-ink-950 truncate" dir="auto">{activeDoc.original_name}</h1>
                        <p className="text-[13px] text-slate-500 truncate mt-0.5">{t('{pages} pages · {chunks} chunks · Ask anything about this document', { pages: activeDoc.page_count, chunks: activeDoc.chunk_count })}</p>
                    </div>
                    <span className="w-px h-6 bg-line mx-1 hidden sm:block" />
                    <LanguageToggle />
                </header>

                {/* Chat Messages */}
                <div className="relative flex-1 overflow-y-auto">
                    {chat.length === 0 && !isTyping ? (
                        <>
                            <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[380px] bg-[radial-gradient(60%_70%_at_50%_0%,rgba(212,168,83,0.12)_0%,rgba(250,249,246,0.6)_45%,transparent_75%)]" />
                            <div className="relative min-h-full flex flex-col items-center justify-center text-center px-4 py-12 animate-fade-in">
                                <div className="relative mb-7">
                                    <span aria-hidden className="absolute -inset-3 rounded-[22px] bg-gold-400/20 blur-xl" />
                                    <div className="relative w-14 h-14 rounded-2xl bg-ink-gradient flex items-center justify-center shadow-lift ring-1 ring-white/5">
                                        <FileText size={24} className="text-gold-300" />
                                    </div>
                                </div>
                                <h2 className={`page-title ${lang === 'ur' ? 'text-[1.7rem]' : 'text-[2rem] leading-tight'} text-ink-950 mb-3`}>{t('Ask about this document')}</h2>
                                <p className="text-slate-500 text-[15px] leading-relaxed max-w-md mb-9">
                                    {t('Ask any question about')} <span className="text-ink-900 font-semibold" dir="auto">"{activeDoc.original_name}"</span>.
                                    {' '}{t('Answers come exclusively from this document.')}
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl">
                                    {docSuggestions.map((s, i) => (
                                        <button key={i} onClick={() => { setQuery(s); inputRef.current?.focus(); }}
                                            className="group flex items-center gap-3 text-start p-4 rounded-2xl bg-white border border-line shadow-soft hover:border-gold-400/60 hover:shadow-lift hover:-translate-y-0.5 text-[14px] font-medium text-ink-900 transition-all duration-200">
                                            <span className="w-8 h-8 rounded-lg bg-paper-200 ring-1 ring-inset ring-line flex items-center justify-center flex-shrink-0 group-hover:bg-ink-900 group-hover:ring-ink-900 transition-colors">
                                                <MessageSquare size={14} className="text-gold-700 group-hover:text-gold-300 transition-colors" />
                                            </span>
                                            {s}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="max-w-3xl mx-auto px-4 sm:px-6 space-y-10 pb-12 pt-10">
                            {chat.map((msg, idx) => msg.role === 'user'
                                ? <UserMessage key={idx} text={msg.text} />
                                : <AssistantMessage key={idx} name={t('Document analysis')} text={msg.text}
                                    note={msg.chunks ? (msg.chunks === 1 ? t('From 1 passage of the document') : t('From {n} passages of the document', { n: msg.chunks })) : undefined} />)}
                            {isTyping && <AssistantThinking name={t('Document analysis')} label={t('Reading the document')} />}
                            <div ref={chatEndRef} />
                        </div>
                    )}
                </div>

                {/* Input */}
                <div className="relative px-4 sm:px-6 pb-4 pt-2 bg-white flex-shrink-0">
                    <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-10 h-10 bg-gradient-to-t from-white to-white/0" />
                    <Composer value={query} onChange={setQuery} onSubmit={handleDocChat} disabled={isTyping} inputRef={inputRef}
                        urdu={isUrduText(query)} placeholder={t('Ask about this document, in English or اردو…')}
                        footer={t('Answers come only from “{name}”.', { name: activeDoc.original_name })} />
                </div>
            </div>
        );
    }

    // ── Document List View ──
    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-paper-100">
            <PageHeader icon={FileUp} title={t('Document analysis')}
                subtitle={documents.length === 1 ? t('1 document uploaded') : t('{n} documents uploaded', { n: documents.length })} />

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 lg:px-8 py-8">
                <div className="max-w-5xl mx-auto">
                    {/* Upload Zone */}
                    <div
                        role="button" tabIndex={0}
                        onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !uploading) { e.preventDefault(); fileInputRef.current?.click(); } }}
                        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={handleDrop}
                        onClick={() => !uploading && fileInputRef.current?.click()}
                        className={`relative overflow-hidden mb-10 px-8 py-12 rounded-3xl border-2 border-dashed cursor-pointer transition-all duration-200 text-center group focus-visible:outline-none focus-visible:shadow-focus
                            ${dragOver
                                ? 'border-gold-500 bg-amber-50/60 shadow-lift'
                                : 'border-line-strong bg-white shadow-soft hover:border-gold-400/70 hover:shadow-lift'}`}
                    >
                        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_80%_at_50%_0%,rgba(212,168,83,0.10)_0%,transparent_70%)] opacity-0 group-hover:opacity-100 transition-opacity" />
                        <input ref={fileInputRef} type="file" accept=".pdf" className="hidden"
                            onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} />

                        {uploading ? (
                            <div className="relative flex flex-col items-center gap-3">
                                <span className="w-14 h-14 rounded-2xl bg-ink-gradient flex items-center justify-center shadow-lift">
                                    <Loader2 size={24} className="text-gold-300 animate-spin" />
                                </span>
                                <p className="page-title text-[18px] text-ink-950 mt-1">{t('Processing document…')}</p>
                                <p className="text-[13px] text-slate-500">{t('Extracting text, chunking, and embedding')}</p>
                                <div className="w-56 h-1.5 mt-2 rounded-full bg-paper-200 overflow-hidden">
                                    <div className="h-full w-1/2 rounded-full bg-gold-gradient animate-pulse" />
                                </div>
                            </div>
                        ) : (
                            <div className="relative flex flex-col items-center">
                                <span className="relative mb-5 w-16 h-16 flex items-center justify-center">
                                    <span className="absolute inset-0 rounded-2xl bg-gradient-to-br from-amber-50 to-paper-200 ring-1 ring-line rotate-6 transition-transform group-hover:rotate-12" />
                                    <span className="relative w-16 h-16 rounded-2xl bg-white ring-1 ring-line shadow-soft flex items-center justify-center">
                                        <Upload size={24} className="text-gold-600 transition-transform group-hover:-translate-y-0.5" strokeWidth={1.9} />
                                    </span>
                                </span>
                                <p className="page-title text-[19px] text-ink-950 mb-1.5">{t('Drop your PDF here or click to upload')}</p>
                                <p className="text-[13.5px] text-slate-500 mb-5">{t('Case files, FIRs, judgments, contracts — up to 20MB')}</p>
                                <span className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-ink-900 text-white text-sm font-semibold shadow-[0_1px_2px_rgba(11,18,32,0.25),inset_0_1px_0_rgba(255,255,255,0.08)] group-hover:bg-ink-800 transition-colors">
                                    <FileUp size={15} className="text-gold-300" /> {t('Choose a PDF')}
                                </span>
                                <span className="inline-flex items-center gap-1.5 mt-5 text-[12px] text-slate-400">
                                    <ShieldCheck size={13} className="text-emerald-600" /> {t('Only you can see the documents you upload.')}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Document Grid */}
                    {documents.length === 0 ? (
                        <EmptyState icon={FileText} title={t('No documents yet')} text={t('Upload a PDF to start chatting with your documents.')} />
                    ) : (
                        <>
                            <div className="flex items-center gap-2.5 mb-4">
                                <h2 className="page-title text-[19px] text-ink-950">{t('Your documents')}</h2>
                                <span className="h-6 min-w-[24px] px-2 rounded-full bg-paper-200 ring-1 ring-inset ring-line text-[12px] font-semibold text-slate-600 flex items-center justify-center tabular-nums">{documents.length}</span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                {documents.map(doc => (
                                    <div key={doc.id}
                                        className="group flex flex-col p-5 rounded-2xl bg-white border border-line shadow-soft hover:shadow-lift hover:border-line-strong hover:-translate-y-0.5 transition-all duration-200">
                                        <div className="flex items-start gap-3.5 mb-4">
                                            <div className="relative w-11 h-12 rounded-lg bg-paper-100 ring-1 ring-inset ring-line flex flex-col items-center justify-center flex-shrink-0">
                                                <FileText size={18} className="text-ink-700" />
                                                <span className="absolute -bottom-1.5 px-1 rounded bg-red-600 text-white text-[8.5px] font-bold tracking-wide leading-[13px]">PDF</span>
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <h3 className="font-sans text-[14px] font-semibold tracking-normal text-ink-950 truncate" dir="auto" title={doc.original_name}>
                                                    {doc.original_name}
                                                </h3>
                                                <div className="mt-1.5"><StatusPill status={doc.status} /></div>
                                            </div>
                                            <button onClick={(e) => { e.stopPropagation(); handleDelete(doc.id); }} title={t('Delete')} aria-label={t('Delete')}
                                                className="w-8 h-8 -me-1.5 -mt-1 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-red-50 text-slate-400 hover:text-red-600 transition-all">
                                                <Trash2 size={14} />
                                            </button>
                                        </div>

                                        <div className="grid grid-cols-3 divide-x divide-line rtl:divide-x-reverse rounded-xl bg-paper-50 ring-1 ring-inset ring-line mb-4 text-center">
                                            <div className="py-2 px-1">
                                                <HardDrive size={12} className="mx-auto text-slate-400 mb-1" />
                                                <span className="block text-[12px] font-semibold text-ink-900 tabular-nums" dir="ltr">{formatSize(doc.file_size)}</span>
                                            </div>
                                            <div className="py-2 px-1">
                                                <Layers size={12} className="mx-auto text-slate-400 mb-1" />
                                                <span className="block text-[12px] font-semibold text-ink-900">{t('{n} pages', { n: doc.page_count })}</span>
                                            </div>
                                            <div className="py-2 px-1">
                                                <Puzzle size={12} className="mx-auto text-slate-400 mb-1" />
                                                <span className="block text-[12px] font-semibold text-ink-900">{t('{n} chunks', { n: doc.chunk_count })}</span>
                                            </div>
                                        </div>

                                        <Button variant={doc.status === 'ready' ? 'primary' : 'secondary'} icon={MessageSquare} className="w-full mt-auto"
                                            onClick={() => doc.status === 'ready' && openDocChat(doc)} disabled={doc.status !== 'ready'}>
                                            {t('Chat with document')}
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
