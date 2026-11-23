// Lists interface text that has no Urdu translation.
//
//   npm run i18n:check            all files
//   npm run i18n:check -- src/pages/ChatPage.jsx src/data/site.js
//
// Finds every t('…') / translate('…') call with a literal English string and checks
// that src/locales/ur has an entry for it. Also flags calls whose text is built at
// run time (template literals with ${…}), which can never match a dictionary entry —
// use a placeholder instead: t('{n} cases', { n }).
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = new URL('..', import.meta.url).pathname;
const src = join(root, 'src');
const ur = (await import(pathToFileURL(join(src, 'locales/ur/index.js')).href)).default;

function walk(dir) {
    return readdirSync(dir).flatMap((name) => {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) return name === 'locales' ? [] : walk(p);
        return /\.(jsx?|tsx?)$/.test(name) ? [p] : [];
    });
}

const files = process.argv.slice(2).length ? process.argv.slice(2).map((f) => join(root, f)) : walk(src);
const call = /\b(?:t|translate)\(\s*(?:'((?:\\.|[^'\\])*)'|"((?:\\.|[^"\\])*)"|`((?:\\.|[^`\\])*)`)/g;
const unescape = (s) => s.replace(/\\(['"`\\])/g, '$1').replace(/\\n/g, '\n');

let missing = 0, dynamic = 0, total = 0;
for (const file of files) {
    const text = readFileSync(file, 'utf8');
    const rows = [];
    for (const m of text.matchAll(call)) {
        const raw = m[1] ?? m[2] ?? m[3];
        const line = text.slice(0, m.index).split('\n').length;
        total++;
        if (m[3] !== undefined && raw.includes('${')) { dynamic++; rows.push(`  ${line}: built at run time — use a {placeholder}: ${raw.slice(0, 70)}`); continue; }
        const key = unescape(raw);
        if (!(key in ur)) { missing++; rows.push(`  ${line}: ${key.slice(0, 90)}`); }
    }
    if (rows.length) console.log(`${relative(root, file)}\n${rows.join('\n')}`);
}
console.log(`\n${total} translated strings checked: ${missing} without Urdu, ${dynamic} built at run time.`);
process.exit(missing || dynamic ? 1 : 0);
