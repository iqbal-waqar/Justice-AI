import React, { useState, useEffect, useRef } from 'react';
import {
    Upload, FileText, Trash2, MessageSquare, X, Send, ArrowLeft,
    CheckCircle, AlertCircle, Loader2, File, Clock, Layers, Sparkles, Bot
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function DocumentsPage() {
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
            const res = await fetch(`${API}/api/v1/documents`, { headers });
            if (res.ok) setDocuments(await res.json());
        } catch (e) { console.error('Failed to fetch documents:', e); }
    };

    const handleUpload = async (file) => {
        if (!file || !file.name.toLowerCase().endsWith('.pdf')) {
            alert('Only PDF files are supported.');
            return;
        }
        if (file.size > 20 * 1024 * 1024) {
            alert('File too large. Maximum size is 20MB.');
            return;
        }

        setUploading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch(`${API}/api/v1/documents/upload`, {
                method: 'POST', headers, body: formData,
            });
            if (res.ok) {
                fetchDocuments();
            } else {
                const err = await res.json();
                alert(err.detail || 'Upload failed');
            }
        } catch (e) {
            console.error('Upload error:', e);
            alert('Upload failed. Check server connection.');
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (docId) => {
        if (!confirm('Delete this document and all its data?')) return;
        try {
            await fetch(`${API}/api/v1/documents/${docId}`, { method: 'DELETE', headers });
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
            const res = await fetch(`${API}/api/v1/documents/${activeDoc.id}/chat`, {
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
                role: 'ai', text: '⚠️ Error getting response. Please try again.',
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

    const statusIcon = (status) => {
        if (status === 'ready') return <CheckCircle size={14} className="text-emerald-400" />;
        if (status === 'processing') return <Loader2 size={14} className="text-gold-400 animate-spin" />;
        return <AlertCircle size={14} className="text-red-400" />;
    };

    // ── Document Chat View ──
    if (activeDoc) {
        return (
            <div className="flex-1 flex flex-col h-full bg-[#0a0f1e]">
                {/* Header */}
                <div className="flex items-center gap-3 px-6 h-[68px] border-b border-white/5 bg-[#0a0f1e]/80 backdrop-blur-xl flex-shrink-0">
                    <button onClick={() => { setActiveDoc(null); setChat([]); }}
                        className="p-2 rounded-xl hover:bg-white/5 text-slate-400 hover:text-white transition-all">
                        <ArrowLeft size={20} />
                    </button>
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
                        <FileText size={20} className="text-white" />
                    </div>
                    <div className="min-w-0">
                        <h2 className="text-sm font-bold text-white truncate">{activeDoc.original_name}</h2>
                        <p className="text-[11px] text-slate-500">{activeDoc.page_count} pages · {activeDoc.chunk_count} chunks · Ask anything about this document</p>
                    </div>
                </div>

                {/* Chat Messages */}
                <div className="flex-1 overflow-y-auto px-6 py-6">
                    {chat.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center animate-fade-in">
                            <div className="relative mb-6">
                                <div className="absolute inset-0 bg-violet-500/15 blur-3xl rounded-full scale-150 animate-pulse-slow" />
                                <div className="relative w-20 h-20 rounded-3xl bg-gradient-to-br from-[#111827] to-[#1a1f35] border border-white/10 shadow-2xl flex items-center justify-center">
                                    <FileText size={40} className="text-violet-400" />
                                </div>
                            </div>
                            <h3 className="text-2xl font-black text-white mb-2">Chat with your Document</h3>
                            <p className="text-slate-500 text-sm max-w-md mb-8">
                                Ask any question about <span className="text-violet-400 font-semibold">"{activeDoc.original_name}"</span>. 
                                Answers come exclusively from this document.
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
                                {['Summarize this document', 'What are the key legal provisions?', 'Who are the parties involved?', 'What was the final verdict?'].map((s, i) => (
                                    <button key={i} onClick={() => { setQuery(s); inputRef.current?.focus(); }}
                                        className="text-left p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:border-violet-500/30 hover:bg-white/[0.06] text-sm text-slate-400 hover:text-white transition-all duration-300">
                                        {s}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="max-w-3xl mx-auto space-y-5 pb-4">
                            {chat.map((msg, idx) => (
                                <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                                    <div className={`w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center mt-1 shadow-lg
                                        ${msg.role === 'user'
                                            ? 'bg-gradient-to-br from-indigo-500 to-purple-600'
                                            : 'bg-gradient-to-br from-violet-500 to-purple-600'}`}>
                                        {msg.role === 'user' ? '👤' : <Bot size={14} className="text-white" />}
                                    </div>
                                    <div className={`max-w-[85%] ${msg.role === 'user' ? 'items-end' : ''}`}>
                                        <div className={`px-5 py-4 rounded-2xl text-[14px] leading-relaxed
                                            ${msg.role === 'user'
                                                ? 'bg-gradient-to-r from-indigo-600 to-purple-700 text-white rounded-tr-md'
                                                : 'bg-white/[0.04] border border-white/[0.08] text-slate-300 rounded-tl-md prose prose-invert max-w-none prose-sm'}`}>
                                            {msg.role === 'ai' ? (
                                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.text}</ReactMarkdown>
                                            ) : msg.text}
                                        </div>
                                        {msg.chunks && (
                                            <span className="text-[10px] text-slate-600 mt-1 inline-block">
                                                📄 Used {msg.chunks} chunks from document
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {isTyping && (
                                <div className="flex gap-3 animate-fade-in">
                                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg">
                                        <Bot size={14} className="text-white" />
                                    </div>
                                    <div className="bg-white/[0.04] border border-white/[0.08] px-5 py-4 rounded-2xl rounded-tl-md flex items-center gap-2">
                                        <Loader2 size={14} className="text-violet-400 animate-spin" />
                                        <span className="text-xs text-slate-500">Analyzing document...</span>
                                    </div>
                                </div>
                            )}
                            <div ref={chatEndRef} />
                        </div>
                    )}
                </div>

                {/* Input */}
                <div className="px-6 py-5 bg-[#0a0f1e]/80 backdrop-blur-xl border-t border-white/5 flex-shrink-0">
                    <form onSubmit={handleDocChat} className="max-w-3xl mx-auto relative">
                        <div className="relative group">
                            <div className="absolute -inset-0.5 bg-gradient-to-r from-violet-500/20 via-purple-500/10 to-violet-500/20 rounded-2xl blur opacity-0 group-focus-within:opacity-100 transition-opacity duration-500" />
                            <input ref={inputRef} type="text" value={query} onChange={e => setQuery(e.target.value)}
                                placeholder="Ask about this document..."
                                className="relative w-full bg-white/[0.04] text-white py-4 pl-5 pr-14 rounded-2xl border border-white/[0.08] focus:border-violet-500/40 focus:ring-2 focus:ring-violet-500/10 focus:outline-none placeholder:text-slate-600 font-medium text-[14.5px] transition-all" />
                            <button type="submit" disabled={!query.trim() || isTyping}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-3 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-400 hover:to-purple-500 text-white shadow-lg disabled:opacity-20 transition-all">
                                <Send size={16} />
                            </button>
                        </div>
                        <p className="text-[11px] text-slate-600 mt-2 px-1 flex items-center gap-1.5">
                            <Sparkles size={11} className="text-violet-500" />
                            Answers come exclusively from "{activeDoc.original_name}"
                        </p>
                    </form>
                </div>
            </div>
        );
    }

    // ── Document List View ──
    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#0a0f1e]">
            {/* Header */}
            <div className="flex items-center justify-between px-6 h-[68px] border-b border-white/5 bg-[#0a0f1e]/80 backdrop-blur-xl flex-shrink-0">
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <div className="absolute inset-0 bg-violet-500/20 blur-lg rounded-xl animate-pulse-slow" />
                        <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
                            <Upload size={20} className="text-white" />
                        </div>
                    </div>
                    <div>
                        <h2 className="text-sm font-bold text-white">Document Analysis</h2>
                        <p className="text-[11px] text-slate-500 font-medium">{documents.length} document{documents.length !== 1 && 's'} uploaded</p>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
                <div className="max-w-4xl mx-auto">
                    {/* Upload Zone */}
                    <div
                        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={handleDrop}
                        onClick={() => !uploading && fileInputRef.current?.click()}
                        className={`relative mb-8 p-10 rounded-3xl border-2 border-dashed cursor-pointer transition-all duration-300 text-center group
                            ${dragOver
                                ? 'border-violet-500 bg-violet-500/10 scale-[1.02]'
                                : 'border-white/10 bg-white/[0.02] hover:border-violet-500/30 hover:bg-white/[0.04]'}`}
                    >
                        <input ref={fileInputRef} type="file" accept=".pdf" className="hidden"
                            onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} />

                        {uploading ? (
                            <div className="flex flex-col items-center gap-3 animate-pulse">
                                <Loader2 size={40} className="text-violet-400 animate-spin" />
                                <p className="text-sm font-semibold text-white">Processing document...</p>
                                <p className="text-xs text-slate-500">Extracting text, chunking, and embedding</p>
                            </div>
                        ) : (
                            <>
                                <div className="relative inline-block mb-4">
                                    <div className="absolute inset-0 bg-violet-500/10 blur-2xl rounded-full scale-150 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    <Upload size={40} className="relative text-slate-500 group-hover:text-violet-400 transition-colors" />
                                </div>
                                <p className="text-sm font-bold text-white mb-1">Drop your PDF here or click to upload</p>
                                <p className="text-xs text-slate-500">Case files, FIRs, judgments, contracts — up to 20MB</p>
                            </>
                        )}
                    </div>

                    {/* Document Grid */}
                    {documents.length === 0 ? (
                        <div className="text-center py-16 animate-fade-in">
                            <FileText size={56} className="mx-auto text-slate-700 mb-4" />
                            <h3 className="text-lg font-bold text-white mb-2">No Documents Yet</h3>
                            <p className="text-sm text-slate-500">Upload a PDF to start chatting with your documents.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {documents.map(doc => (
                                <div key={doc.id}
                                    className="group p-5 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:border-white/15 hover:bg-white/[0.05] hover:-translate-y-1 hover:shadow-xl transition-all duration-300">
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-600/20 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
                                                <FileText size={18} className="text-violet-400" />
                                            </div>
                                            <div className="min-w-0">
                                                <h4 className="text-sm font-bold text-white truncate group-hover:text-violet-400 transition-colors">
                                                    {doc.original_name}
                                                </h4>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    {statusIcon(doc.status)}
                                                    <span className="text-[11px] text-slate-500 capitalize">{doc.status}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <button onClick={(e) => { e.stopPropagation(); handleDelete(doc.id); }}
                                            className="p-2 rounded-xl opacity-0 group-hover:opacity-100 hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-all">
                                            <Trash2 size={14} />
                                        </button>
                                    </div>

                                    <div className="flex items-center gap-4 text-[11px] text-slate-500 mb-4">
                                        <span className="flex items-center gap-1"><File size={11} />{formatSize(doc.file_size)}</span>
                                        <span className="flex items-center gap-1"><Layers size={11} />{doc.page_count} pages</span>
                                        <span className="flex items-center gap-1"><Clock size={11} />{doc.chunk_count} chunks</span>
                                    </div>

                                    <button onClick={() => doc.status === 'ready' && openDocChat(doc)}
                                        disabled={doc.status !== 'ready'}
                                        className="w-full py-3 rounded-xl text-sm font-semibold transition-all duration-300 flex items-center justify-center gap-2
                                            disabled:opacity-30 disabled:cursor-not-allowed
                                            bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-400 hover:to-purple-500 text-white shadow-lg shadow-violet-500/20 hover:shadow-violet-500/30">
                                        <MessageSquare size={16} />
                                        Chat with Document
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
