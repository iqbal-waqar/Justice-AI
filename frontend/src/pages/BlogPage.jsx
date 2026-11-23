import React from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ArrowLeft, ArrowRight, Clock } from 'lucide-react';
import { POSTS, POST_VARS, getPost, formatDate } from '../data/site';
import { useI18n } from '../i18n';

/* /blog lists posts; /blog/:slug shows one. */
export default function BlogPage() {
    const { slug } = useParams();
    const { t, lang } = useI18n();
    if (slug) {
        const post = getPost(slug);
        return post ? <BlogPost post={post} /> : <Navigate to="/blog" replace />;
    }

    const [featured, ...rest] = POSTS;
    return (
        <div className="bg-paper-50">
            <section className="relative overflow-hidden pt-36 sm:pt-44 pb-16">
                <div aria-hidden className="absolute inset-0 pointer-events-none" style={{ ...GRID_BG, maskImage: 'radial-gradient(ellipse 70% 70% at 30% 0%, black 25%, transparent 100%)' }} />
                <div aria-hidden className="absolute top-[-240px] start-[-120px] w-[820px] h-[500px] rounded-full bg-[radial-gradient(closest-side,rgba(232,201,134,0.45),transparent)] blur-2xl pointer-events-none" />
                <div className="relative max-w-6xl mx-auto px-5 sm:px-8">
                    <p className="inline-flex items-center gap-2.5 text-[12px] font-semibold uppercase tracking-[0.18em] text-gold-700 mb-5"><span className="w-6 h-px bg-gradient-to-r from-gold-500 to-gold-300" />{t('Blog')}</p>
                    <h1 className="font-serif text-[2.6rem] sm:text-[3.6rem] leading-[1.05] font-semibold tracking-[-0.03em] rtl:tracking-normal text-ink-950 mb-5 max-w-3xl text-balance">{t('News, features & how it works')}</h1>
                    <p className="text-[17px] sm:text-[18.5px] text-slate-600 max-w-2xl">{t('Product updates and a look under the hood of Justice AI.')}</p>
                </div>
            </section>

            <section className="max-w-6xl mx-auto px-5 sm:px-8 pb-24 space-y-5">
                <Link to={`/blog/${featured.slug}`} className="group relative block overflow-hidden rounded-[28px] bg-ink-gradient text-white p-8 sm:p-12 shadow-[0_30px_60px_-30px_rgba(11,18,32,0.6)]">
                    <span aria-hidden className="absolute inset-0 bg-ink-sheen pointer-events-none" />
                    <span aria-hidden className="absolute -top-24 -end-24 w-80 h-80 rounded-full bg-gold-500/20 blur-3xl group-hover:bg-gold-400/30 transition-colors duration-500" />
                    <div className="relative max-w-3xl">
                        <div className="flex flex-wrap items-center gap-3 text-[12.5px] text-white/50 mb-6">
                            <span className="px-2.5 py-0.5 rounded-full bg-gold-400/15 ring-1 ring-gold-400/30 text-gold-300 font-semibold">{t(featured.tag)}</span>
                            {formatDate(featured.date, lang)} <span className="w-1 h-1 rounded-full bg-white/30" /> {t('{n} min read', { n: featured.readMins })}
                        </div>
                        <h2 className="font-serif text-[1.9rem] sm:text-[2.6rem] leading-[1.12] font-semibold tracking-[-0.02em] rtl:tracking-normal mb-4 text-balance group-hover:text-gold-200 transition-colors">{t(featured.title)}</h2>
                        <p className="text-white/60 text-[16.5px] leading-relaxed max-w-2xl mb-8">{t(featured.excerpt)}</p>
                        <span className="inline-flex items-center gap-2 px-5 h-11 rounded-xl bg-white/[0.08] ring-1 ring-white/15 text-[14px] font-semibold text-white group-hover:bg-white group-hover:text-ink-950 transition-all">
                            {t('Read post')} <ArrowRight size={15} className="text-gold-400 rtl:rotate-180" />
                        </span>
                    </div>
                </Link>

                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
                    {rest.map(p => (
                        <Link key={p.slug} to={`/blog/${p.slug}`} className="group flex flex-col p-6 rounded-2xl bg-white ring-1 ring-line shadow-soft hover:shadow-lift hover:-translate-y-1 transition-all duration-300">
                            <div className="flex items-center gap-2 text-[12px] text-slate-500 mb-4">
                                <span className="px-2.5 py-0.5 rounded-full bg-amber-50 ring-1 ring-amber-200/70 text-gold-700 font-semibold">{t(p.tag)}</span>
                                {formatDate(p.date, lang)}
                            </div>
                            <h3 className="font-serif text-[19px] leading-snug font-semibold text-ink-950 mb-2.5 group-hover:text-gold-700 transition-colors">{t(p.title)}</h3>
                            <p className="text-[14px] text-slate-600 leading-relaxed line-clamp-4">{t(p.excerpt)}</p>
                            <span className="inline-flex items-center gap-1.5 mt-auto pt-5 text-[13.5px] font-semibold text-ink-950">{t('Read post')} <ArrowRight size={14} className="text-gold-600 transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" /></span>
                        </Link>
                    ))}
                </div>
            </section>
        </div>
    );
}

const GRID_BG = { backgroundImage: 'linear-gradient(rgba(18,29,47,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(18,29,47,0.045) 1px, transparent 1px)', backgroundSize: '56px 56px' };

/* Long-form article styles: serif headings, comfortable measure, gold accents. */
const PROSE = [
    'prose prose-slate max-w-none text-[17px] leading-[1.8] text-slate-700',
    'prose-p:my-5 prose-p:leading-[1.8] prose-li:my-1.5 prose-li:leading-[1.75]',
    'prose-headings:font-serif prose-headings:text-ink-950 prose-headings:tracking-[-0.015em] rtl:tracking-normal',
    '[&_h2]:text-[1.75rem] [&_h2]:mt-12 [&_h2]:mb-4 [&_h3]:!text-[1.4rem] [&_h3]:!font-semibold [&_h3]:!mt-11 [&_h3]:!mb-3 [&_h3]:!border-0 [&_h3]:!pb-0',
    'prose-a:text-ink-900 prose-a:decoration-gold-400 prose-a:decoration-2 prose-a:underline-offset-4 hover:prose-a:decoration-gold-600',
    'prose-strong:text-ink-950 [&_li::marker]:text-gold-500',
    '[&_blockquote]:!border-s-[3px] [&_blockquote]:!border-gold-400 [&_blockquote]:!bg-amber-50/60 [&_blockquote]:!rounded-e-xl [&_blockquote]:!not-italic [&_blockquote]:!text-ink-900',
    '[&_code]:!bg-paper-200 [&_code]:!text-ink-900 [&_code]:!rounded-md [&_code]:!px-1.5 [&_code]:before:content-none [&_code]:after:content-none',
    '[&_table]:!text-[14.5px] [&_th]:!bg-paper-100 [&_th]:!text-ink-900 [&_th]:!normal-case [&_th]:!tracking-normal [&_th]:!text-[13px]',
].join(' ');

function BlogPost({ post }) {
    const { t, lang } = useI18n();
    const idx = POSTS.findIndex(p => p.slug === post.slug);
    const next = POSTS[(idx + 1) % POSTS.length];
    return (
        <article className="bg-paper-50">
            <header className="relative overflow-hidden pt-36 sm:pt-40 pb-14 border-b border-line">
                <div aria-hidden className="absolute inset-0 pointer-events-none" style={{ ...GRID_BG, maskImage: 'radial-gradient(ellipse 70% 80% at 50% 0%, black 20%, transparent 100%)' }} />
                <div aria-hidden className="absolute top-[-260px] left-1/2 -translate-x-1/2 w-[900px] h-[520px] rounded-full bg-[radial-gradient(closest-side,rgba(232,201,134,0.4),transparent)] blur-2xl pointer-events-none" />
                <div className="relative max-w-3xl mx-auto px-5 sm:px-8">
                    <Link to="/blog" className="group inline-flex items-center gap-1.5 h-9 ps-2.5 pe-3.5 rounded-full bg-white ring-1 ring-line shadow-soft text-[13px] font-medium text-slate-600 hover:text-ink-950 transition-colors mb-8">
                        <ArrowLeft size={14} className="transition-transform group-hover:-translate-x-0.5 rtl:rotate-180 rtl:group-hover:translate-x-0.5" /> {t('All posts')}
                    </Link>
                    <div className="flex flex-wrap items-center gap-3 text-[13px] text-slate-500 mb-5">
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-50 ring-1 ring-amber-200/70 text-gold-700 font-semibold">{t(post.tag)}</span>
                        {formatDate(post.date, lang)}
                        <span className="w-1 h-1 rounded-full bg-slate-300" />
                        <span className="inline-flex items-center gap-1.5"><Clock size={13} />{t('{n} min read', { n: post.readMins })}</span>
                    </div>
                    <h1 className="font-serif text-[2.3rem] sm:text-[3.1rem] leading-[1.08] font-semibold tracking-[-0.025em] rtl:tracking-normal text-ink-950 mb-5 text-balance">{t(post.title)}</h1>
                    <p className="text-[18px] sm:text-[19px] text-slate-600 leading-relaxed">{t(post.excerpt)}</p>
                </div>
            </header>

            <div className="max-w-3xl mx-auto px-5 sm:px-8 py-14">
                <div className={PROSE}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{t(post.body, POST_VARS)}</ReactMarkdown>
                </div>

                <div className="mt-16 relative overflow-hidden p-7 sm:p-8 rounded-3xl bg-ink-gradient flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                    <span aria-hidden className="absolute inset-0 bg-ink-sheen pointer-events-none" />
                    <div className="relative min-w-0">
                        <p className="text-[11.5px] font-semibold text-gold-300 uppercase tracking-[0.16em] mb-2">{t('Next post')}</p>
                        <Link to={`/blog/${next.slug}`} className="font-serif text-[20px] leading-snug font-semibold text-white hover:text-gold-200 transition-colors">{t(next.title)}</Link>
                    </div>
                    <Link to="/login?mode=signup" className="relative group inline-flex items-center justify-center gap-2 px-5 h-11 rounded-xl bg-gold-gradient text-[#2a1e05] text-sm font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] hover:brightness-105 flex-shrink-0">
                        {t('Try Justice AI')} <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
                    </Link>
                </div>
            </div>
        </article>
    );
}
