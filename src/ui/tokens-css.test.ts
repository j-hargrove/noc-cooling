import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
// @ts-expect-error -- plain .mjs, no type declarations; see the file itself.
import { generateTokensCss, OUTPUT_PATH, TOKENS_PATH } from '../../scripts/generate-tokens-css.mjs';

describe('src/ui/tokens.generated.css is up to date with contract/tokens.json', () => {
  it('regenerating produces byte-identical output to the checked-in file', () => {
    const tokens = JSON.parse(readFileSync(TOKENS_PATH, 'utf8'));
    const fresh = generateTokensCss(tokens);
    const checkedIn = readFileSync(OUTPUT_PATH, 'utf8');
    expect(checkedIn).toBe(fresh);
  });

  it('every generated custom property has a non-empty value', () => {
    const checkedIn = readFileSync(join(process.cwd(), 'src', 'ui', 'tokens.generated.css'), 'utf8');
    const declarations = [...checkedIn.matchAll(/^\s*(--[a-z0-9-]+):\s*(.*);\s*$/gm)];
    expect(declarations.length).toBeGreaterThan(100); // sanity: tokens.json is a large file
    for (const [, name, value] of declarations) {
      expect(value.trim(), `${name} should not be empty`).not.toBe('');
    }
  });
});
