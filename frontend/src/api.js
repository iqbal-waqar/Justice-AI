// Single place for talking to the backend.
// - The backend address comes from VITE_API_URL (frontend/.env).
// - Authenticated requests that come back 401 (expired/invalid login) end the
//   session and send the user to /login instead of surfacing "Connection Error".

import { translate } from './i18n';

export const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/+$/, '');

const TOKEN_KEY = 'justiceai_token';
const USER_KEY = 'justiceai_user';
const LOGOUT_REASON_KEY = 'justiceai_logout_reason';

export const getToken = () => localStorage.getItem(TOKEN_KEY);

/** True if the JWT is missing, unreadable, or expires within the next 10 seconds. */
export function isTokenExpired(token) {
    if (!token) return true;
    try {
        const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        return !payload.exp || payload.exp * 1000 < Date.now() + 10_000;
    } catch {
        return true;
    }
}

export function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
}

export function endSession(reason = translate('Your session has expired. Please sign in again.')) {
    clearSession();
    sessionStorage.setItem(LOGOUT_REASON_KEY, reason);
    if (window.location.pathname !== '/login') window.location.assign('/login');
}

/** One-time message shown on the login page after a forced logout. */
export function takeLogoutReason() {
    const reason = sessionStorage.getItem(LOGOUT_REASON_KEY) || '';
    sessionStorage.removeItem(LOGOUT_REASON_KEY);
    return reason;
}

export class SessionExpiredError extends Error {
    constructor() { super('Session expired'); this.name = 'SessionExpiredError'; }
}

/**
 * fetch() against the backend. `path` starts with "/api/v1/…".
 * Adds the Authorization header when logged in; on 401 for a logged-in request,
 * ends the session and throws SessionExpiredError.
 */
/** Full URL for a file link: external links are absolute, files kept by the API (uploaded pictures,
 *  district-court judgment PDFs) are /data/… paths on the API. */
export function profilePictureUrl(path) {
    if (!path) return null;
    return /^https?:\/\//.test(path) ? path : `${API_BASE}${path}`;
}

/** Save the signed-in user and tell the open pages (sidebar, profile) it changed. */
export function storeUser(user) {
    localStorage.setItem('justiceai_user', JSON.stringify(user));
    window.dispatchEvent(new Event('justiceai:user-updated'));
}

export async function apiFetch(path, options = {}) {
    const token = getToken();
    const headers = { ...(options.headers || {}) };
    if (token && !headers.Authorization) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
    if (res.status === 401 && token) {
        endSession();
        throw new SessionExpiredError();
    }
    return res;
}

// ── Urdu helpers ──────────────────────────────────────────────────────────
const URDU_CHARS = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/g;
const LATIN_CHARS = /[A-Za-z]/g;

/** True when most letters in `text` are Urdu script (render it right-to-left). */
export function isUrduText(text) {
    if (!text) return false;
    const urdu = (text.match(URDU_CHARS) || []).length;
    const latin = (text.match(LATIN_CHARS) || []).length;
    return urdu + latin > 0 && urdu / (urdu + latin) >= 0.3;
}

const LANG_KEY = 'justiceai_answer_lang';
/** Answer-language preference: 'en' (default) or 'ur'. */
export const getAnswerLang = () => { try { return localStorage.getItem(LANG_KEY) === 'ur' ? 'ur' : 'en'; } catch { return 'en'; } };
export const setAnswerLang = (lang) => { try { localStorage.setItem(LANG_KEY, lang); } catch { /* ignore */ } };

/**
 * Inside right-to-left Urdu text, runs like "489-F PPC" or "(2023 SCMR 2122)" are
 * reordered by the bidi algorithm ("F PPC-489"). Wrapping each English/number run
 * in Unicode isolate marks (LRI … PDI) keeps it in left-to-right order. Markdown
 * markers (* _ # >) are left outside the runs so formatting still works.
 */
const LATIN_RUN = /[A-Za-z0-9(][A-Za-z0-9 .,:;'’&()/–-]*[A-Za-z0-9).]/g;
export function isolateLatinRuns(text) {
    if (!text) return text;
    return text.replace(LATIN_RUN, (run) => `\u2066${run}\u2069`);
}

/** JSON request helper: returns parsed JSON, throws Error(detail) on failure. */
export async function apiJson(path, { method = 'GET', body, headers = {} } = {}) {
    const isForm = body instanceof FormData;
    const res = await apiFetch(path, {
        method,
        headers: { ...(isForm || body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers },
        body: body === undefined ? undefined : (isForm ? body : JSON.stringify(body)),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        const d = data?.detail;
        throw new Error(Array.isArray(d) ? d.map(x => x.msg).join('; ') : (d || translate('Request failed ({status})', { status: res.status })));
    }
    return data;
}

/** Fetch a protected file as a Blob (downloads need the Authorization header). */
export async function apiBlob(path) {
    const res = await apiFetch(path);
    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || translate('Download failed ({status})', { status: res.status }));
    }
    return res.blob();
}

/** Save a Blob as a file. */
export function saveBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export const formatPKR = (v) => {
    const n = Number(v || 0);
    return `Rs ${Math.abs(n).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
};
export const formatBytes = (b) => b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(1)} MB`;
export const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
