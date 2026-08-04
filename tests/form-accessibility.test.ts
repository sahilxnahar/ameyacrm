import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/*
 * The form and field layer, from the August 2026 audit (AMH-013, AMH-031).
 *
 * Both findings are the same shape: a control that works perfectly with a mouse
 * and is unusable any other way. Neither shows up in a screenshot, in a manual
 * click-through, or in any test that renders and asserts on text — which is
 * exactly why they survived through sixteen versions.
 */

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), 'utf8');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(join(root, dir))) {
    const rel = `${dir}/${name}`;
    if (statSync(join(root, rel)).isDirectory()) walk(rel, out);
    else if (rel.endsWith('.tsx')) out.push(rel);
  }
  return out;
}
const TSX = walk('src');

/** The body of every `<button>` / `<Button>`, with its attributes. */
function buttons(src: string): Array<{ attrs: string; body: string }> {
  const out: Array<{ attrs: string; body: string }> = [];
  for (const tag of ['button', 'Button']) {
    const open = new RegExp(`<${tag}\\b`, 'g');
    let m: RegExpExecArray | null;
    let cursor = 0;
    while ((m = open.exec(src))) {
      if (m.index < cursor) continue;
      let j = m.index + m[0].length;
      let depth = 0;
      while (j < src.length) {
        const c = src[j];
        if (c === '{') depth++;
        else if (c === '}') depth--;
        else if (c === '>' && depth === 0) break;
        j++;
      }
      const attrs = src.slice(m.index + m[0].length, j);
      if (src[j - 1] === '/') { cursor = j; continue; }
      let k = j + 1;
      let level = 1;
      while (k < src.length && level > 0) {
        if (src.startsWith(`<${tag}`, k) && !src.startsWith('</', k)) { level++; k++; }
        else if (src.startsWith(`</${tag}`, k)) { level--; k += tag.length + 3; }
        else k++;
      }
      out.push({ attrs, body: src.slice(j + 1, k - tag.length - 3) });
      cursor = k;
    }
  }
  return out;
}

// A self-closing capitalised element carrying only presentational props: an icon.
const ICON = /<[A-Z]\w*\s+(?:(?:className|aria-hidden|strokeWidth|size|style)=(?:"[^"]*"|\{[^{}]*\})\s*)*\/>/g;

describe('every button says what it does (AMH-031)', () => {
  it('no icon-only button is left without an accessible name', () => {
    /*
     * 52 buttons across the product were an icon and nothing else — a bin, an X,
     * a tick — with no text, no aria-label and no title. To a screen reader each
     * announces as "button" and nothing more, so a blind user on the payments
     * screen was offered two identical unnamed buttons, one of which approves a
     * payment and one of which rejects it. Voice control had no name to say.
     *
     * The labels are phrased as what the button DOES to WHICH thing — "Approve
     * this payment", not "Approve" — because a screen-reader user tabbing a table
     * hears the button out of its visual row context.
     */
    const nameless: string[] = [];
    for (const file of TSX) {
      const src = read(file);
      for (const { attrs, body } of buttons(src)) {
        if (/aria-label|title=/.test(attrs)) continue;
        if (/sr-only|aria-label/.test(body)) continue;
        const stripped = body
          .replace(ICON, '')
          .replace(/<[^>]*>/g, '')
          .replace(/[\s{}()?:'"]/g, '');
        if (/[A-Za-z0-9]/.test(stripped)) continue; // something can render text
        nameless.push(`${file}: ${body.trim().replace(/\s+/g, ' ').slice(0, 50)}`);
      }
    }
    expect(nameless, `unnamed icon buttons:\n${nameless.join('\n')}`).toEqual([]);
  });
});

describe('every label is attached to its control (AMH-013)', () => {
  const field = read('src/components/ui/field.tsx');

  it('Field nests the control inside the label rather than referencing an id', () => {
    /*
     * `Field` rendered `<label htmlFor={htmlFor}>` as a SIBLING, which associates
     * nothing unless the caller also puts a matching id on the input. Counted:
     * 192 uses of `Field`, `htmlFor` passed on ZERO of them. Not one label in the
     * product was attached to its control.
     *
     * Nesting is association by containment: no id, nothing to remember, and it
     * cannot drift out of sync the way a matched pair can.
     */
    expect(field).toMatch(/<label className=\{cn\('block space-y-1'/);
    expect(field).toMatch(/<span className=\{labelCls\}>\{labelText\}<\/span>\s*\n\s*\{children\}/);
  });

  it('keeps the sibling form as an escape hatch, for a control that labels itself', () => {
    // Nesting one <label> inside another is invalid, so a control that renders
    // its own label needs the old shape. Checked at the time: none currently do.
    expect(field).toMatch(/if \(htmlFor\)/);
    expect(field).toMatch(/<label htmlFor=\{htmlFor\}/);
  });

  it('emits no empty <label> when there is nothing to label', () => {
    // A <label> with no text announces as a labelled group containing nothing,
    // which is worse than the plain div it replaced.
    expect(field).toMatch(/if \(!label\)/);
  });

  it('the required marker is not carried by colour alone', () => {
    // A red asterisk is a convention, not a name: a screen reader says "star" or
    // skips it, and a colour-blind reader gets nothing.
    expect(field).toContain('aria-hidden');
    expect(field).toContain('(required)');
  });

  it('every Field body still contains at most one form control', () => {
    /*
     * This is the assumption the whole fix rests on: with implicit association
     * the browser picks the FIRST labelable descendant, so a Field wrapping two
     * controls would silently label the wrong one. It held for 181 of 183 when
     * the change was made, and the two exceptions render one control at a time.
     *
     * Asserted rather than assumed, because the day someone puts two inputs in
     * one Field is the day the label quietly points at the wrong box.
     */
    const offenders: string[] = [];
    for (const file of TSX) {
      const src = read(file);
      for (const m of src.matchAll(/<Field\b[^>]*>([\s\S]*?)<\/Field>/g)) {
        const body = m[1] ?? "";
        // Count controls that can be reached at the same time — a ternary offers
        // one or the other, never both, so collapse each branch to one.
        const branches = body.split(/\?|:/);
        const most = Math.max(
          ...branches.map((b) => (b.match(/<(input|select|textarea|Input|Select|Textarea)\b/g) ?? []).length),
        );
        if (most > 1) offenders.push(`${file}: ${body.trim().replace(/\s+/g, ' ').slice(0, 60)}`);
      }
    }
    expect(offenders, `Fields with more than one reachable control:\n${offenders.join('\n')}`).toEqual([]);
  });
});

describe('a rejected save says which box is wrong (AMH-015)', () => {
  it('a validation failure comes back keyed by field, not just as one string', async () => {
    const { z } = await import('zod');
    const { toActionError } = await import('../src/server/actions/_helpers');
    const schema = z.object({
      name: z.string().min(1, 'Give the project a name.'),
      code: z.string().max(12, 'Twelve characters at most.'),
    });
    const parsed = schema.safeParse({ name: '', code: 'WAY-TOO-LONG-A-CODE' });
    expect(parsed.success).toBe(false);
    const out = toActionError(parsed.error);

    // The summary still exists — every current caller reads `.error`.
    expect(out.error).toContain('Give the project a name.');
    // And now the same information is addressable per field.
    expect(out.fields).toEqual({
      name: 'Give the project a name.',
      code: 'Twelve characters at most.',
    });
  });

  it('keeps the first message per field, not the last', async () => {
    const { z } = await import('zod');
    const { toActionError } = await import('../src/server/actions/_helpers');
    // Zod can raise several issues for one input; the earliest is the one that
    // says what to do about it.
    const schema = z.object({ pan: z.string().min(10, 'Ten characters.').regex(/^[A-Z]/, 'Starts with a letter.') });
    const parsed = schema.safeParse({ pan: '1' });
    expect(parsed.success).toBe(false);
    expect(toActionError(parsed.error).fields?.pan).toBe('Ten characters.');
  });

  it('a non-validation failure carries no field map', async () => {
    const { toActionError } = await import('../src/server/actions/_helpers');
    expect(toActionError(new Error('boom')).fields).toBeUndefined();
  });

  it('the projects form renders the message under the box it belongs to', () => {
    const src = read('src/components/admin/projects-view.tsx');
    expect(src).toContain('setFieldErrors(r.fields ?? {})');
    // Every named input in the create form has somewhere to show its message.
    for (const f of ['name', 'code', 'city', 'reraNumber', 'address', 'description']) {
      expect(src, `${f} has no inline error slot`).toContain(`error={fieldErrors.${f}}`);
    }
    // The toast stays: it is what someone notices. Inline is what they act on.
    expect(src).toContain('toast.error(r.error)');
  });

  it('clears the previous errors before trying again', () => {
    // Stale red text next to a box that is now correct is worse than none.
    const src = read('src/components/admin/projects-view.tsx');
    expect(src).toMatch(/setFieldErrors\(\{\}\);\s*\n\s*start\(async/);
  });
});

describe('long forms warn before throwing the work away (AMH-015)', () => {
  it('the guard is honest about what it cannot cover', () => {
    const src = read('src/lib/forms/use-unsaved-changes.ts');
    expect(src).toContain('beforeunload');
    // An in-app navigation is NOT covered — the App Router has no supported
    // block hook. Saying so in the file is the difference between a known
    // limitation and a bug someone finds later.
    expect(src).toMatch(/does NOT cover an in-app navigation/);
  });

  it('the listener is attached once, not on every keystroke', () => {
    const src = read('src/lib/forms/use-unsaved-changes.ts');
    // Reading `dirty` through a ref keeps the effect's dep array empty.
    expect(src).toContain('dirtyRef.current = dirty');
    expect(src).toMatch(/removeEventListener\('beforeunload'/);
  });

  it('the two longest forms use it', () => {
    // The site log is filled in on a phone, on site, and can be twenty minutes
    // of work; the RA bill is a money document with a computed preview.
    for (const f of ['src/components/site-ops/daily-log-form.tsx', 'src/components/construction/ra-bills-view.tsx']) {
      expect(read(f), `${f} is unguarded`).toContain('useUnsavedChanges(');
    }
  });

  it('the site log stops warning once it has been saved', () => {
    // A guard that fires after a successful save trains people to click through
    // it, and then it protects nothing. Here the flag is derived from the very
    // fields the save handler resets, so it goes false on its own.
    const src = read('src/components/site-ops/daily-log-form.tsx');
    expect(src).toMatch(/useUnsavedChanges\(labor > 0 \|\| notes\.trim\(\) !== '' \|\| photos\.length > 0\)/);
    expect(src).toMatch(/setLabor\(0\); setNotes\(''\); setPhotos\(\[\]\)/);
  });
});
