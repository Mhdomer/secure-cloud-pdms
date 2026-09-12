#!/usr/bin/env node
/**
 * Plural-aware en/ar translation parity check.
 *
 * Raw key comparison is wrong for a bilingual en/ar app: CLDR gives each
 * language its own set of plural categories, so Arabic legitimately carries
 * six variants of a counted key where English carries two. Comparing raw keys
 * reports that as twelve missing translations, and "fixing" it by copying
 * Arabic's categories into English produces keys Intl.PluralRules('en') can
 * never resolve. That regression already happened once (2026-09-13).
 *
 * So: compare base keys, and validate plural categories per language.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const LOCALES = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'locales');

// CLDR plural categories each language actually resolves at runtime.
const CATEGORIES = {
  en: ['one', 'other'],
  ar: ['zero', 'one', 'two', 'few', 'many', 'other'],
};
const ALL = ['zero', 'one', 'two', 'few', 'many', 'other'];
const SUFFIX = new RegExp(`_(${ALL.join('|')})$`);

/** Flatten nested JSON into dotted keys. */
function flatten(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, key, out);
    else out[key] = v;
  }
  return out;
}

/** Split flat keys into plain keys and plural groups (base -> Set of categories). */
function partition(flat) {
  const plain = new Set();
  const plurals = new Map();
  for (const key of Object.keys(flat)) {
    const m = key.match(SUFFIX);
    if (m) {
      const base = key.slice(0, -m[0].length);
      if (!plurals.has(base)) plurals.set(base, new Set());
      plurals.get(base).add(m[1]);
    } else {
      plain.add(key);
    }
  }
  return { plain, plurals };
}

function load(lang, ns) {
  return flatten(JSON.parse(readFileSync(join(LOCALES, lang, ns), 'utf8')));
}

const namespaces = readdirSync(join(LOCALES, 'en')).filter((f) => f.endsWith('.json'));
const errors = [];
let baseKeyTotal = 0;
let rawKeyTotal = 0;

for (const ns of namespaces) {
  let en, ar;
  try {
    en = load('en', ns);
    ar = load('ar', ns);
  } catch (e) {
    errors.push(`${ns}: could not load both locales — ${e.message}`);
    continue;
  }

  rawKeyTotal += Object.keys(en).length + Object.keys(ar).length;
  const a = partition(en);
  const b = partition(ar);

  const enBases = new Set([...a.plain, ...a.plurals.keys()]);
  const arBases = new Set([...b.plain, ...b.plurals.keys()]);
  baseKeyTotal += enBases.size;

  for (const k of enBases) if (!arBases.has(k)) errors.push(`${ns}: "${k}" in en, missing from ar`);
  for (const k of arBases) if (!enBases.has(k)) errors.push(`${ns}: "${k}" in ar, missing from en`);

  // A counted key must be plural in both languages, or plain in both.
  for (const base of a.plurals.keys())
    if (b.plain.has(base)) errors.push(`${ns}: "${base}" is plural in en but plain in ar`);
  for (const base of b.plurals.keys())
    if (a.plain.has(base)) errors.push(`${ns}: "${base}" is plural in ar but plain in en`);

  // Each language carries exactly its own categories: none missing, none dead.
  for (const [lang, { plurals }] of [['en', a], ['ar', b]]) {
    const expected = CATEGORIES[lang];
    for (const [base, got] of plurals) {
      for (const c of expected)
        if (!got.has(c)) errors.push(`${ns}: ${lang} "${base}" missing plural category _${c}`);
      for (const c of got)
        if (!expected.includes(c))
          errors.push(
            `${ns}: ${lang} "${base}_${c}" is unreachable — Intl.PluralRules('${lang}') ` +
              `only resolves ${expected.map((x) => `_${x}`).join(', ')}`,
          );
    }
  }
}

console.log(`namespaces checked : ${namespaces.length}`);
console.log(`raw keys (en + ar) : ${rawKeyTotal}`);
console.log(`base keys per lang : ${baseKeyTotal}`);

if (errors.length) {
  console.error(`\n${errors.length} problem(s):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log('\nen/ar parity OK — base keys match, plural categories correct per language.');
