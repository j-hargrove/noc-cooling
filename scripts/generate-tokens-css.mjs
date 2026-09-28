#!/usr/bin/env node
// Mechanically flattens contract/tokens.json into CSS custom properties, one
// per scalar leaf. This is the ONLY place a design token's literal value may
// appear — every component style (src/ui/app.css) consumes these by name.
//
// Rules (deliberately simple and total, so this needs no judgment calls):
//  - object keys become one '-'-joined CSS custom property name, camelCase
//    segments kebab-cased (`criticalOnRaised` -> `critical-on-raised`).
//  - any key starting with '$' (metadata: $comment, $reserved, ...) is
//    skipped, at any depth.
//  - string / number leaves become `--the-path: <value>;`.
//  - array leaves are skipped: they're consumed directly from
//    contract/tokens.json by non-CSS layers (the canvas field in step 5,
//    haptics patterns) that need real arrays, not a CSS value.
//
// Run directly (`node scripts/generate-tokens-css.mjs`) to (re)write
// src/ui/tokens.generated.css. src/ui/tokens-css.test.ts imports
// `generateTokensCss` and fails if the checked-in file is stale.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = join(__dirname, '..');
export const TOKENS_PATH = join(REPO_ROOT, 'contract', 'tokens.json');
export const OUTPUT_PATH = join(REPO_ROOT, 'src', 'ui', 'tokens.generated.css');

const kebab = (segment) => segment.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

/** @param {unknown} tokens @returns {string} */
export function generateTokensCss(tokens) {
  /** @type {{ path: string; value: string | number }[]} */
  const leaves = [];

  const walk = (node, path) => {
    if (node === null || Array.isArray(node) || typeof node !== 'object') return;
    for (const [key, value] of Object.entries(node)) {
      if (key.startsWith('$')) continue;
      const nextPath = [...path, kebab(key)];
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        walk(value, nextPath);
      } else if (typeof value === 'string' || typeof value === 'number') {
        leaves.push({ path: nextPath.join('-'), value });
      }
      // arrays and everything else: intentionally skipped (see header comment)
    }
  };
  walk(tokens, []);

  const lines = [
    '/*',
    ' * GENERATED FILE. Do not hand-edit — run `npm run tokens:css`.',
    ' * Source: contract/tokens.json, via scripts/generate-tokens-css.mjs.',
    ' * src/ui/tokens-css.test.ts fails if this file is stale.',
    ' */',
    ':root {',
    ...leaves.map(({ path, value }) => `  --${path}: ${value};`),
    '}',
    '',
  ];
  return lines.join('\n');
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const tokens = JSON.parse(readFileSync(TOKENS_PATH, 'utf8'));
  writeFileSync(OUTPUT_PATH, generateTokensCss(tokens));
  console.log(`Wrote ${OUTPUT_PATH}`);
}
