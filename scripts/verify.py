import re, glob, os, json, base64, collections, sys
fail = 0
def check(label, bad, detail=''):
    global fail
    ok = not bad
    print(f"  {'✓' if ok else '✗'} {label}" + ('' if ok else f'  → {bad}{detail}'))
    if not ok: fail += 1

s = open('prisma/schema.prisma').read()
check('no single-line enums', re.findall(r'enum\s+\w+\s*\{[^\n}]*\}', s))
rel = collections.Counter(re.findall(r'@relation\("(\w+)"', s))
check('all named relations paired', [k for k, v in rel.items() if v != 2])

dupfields = []
for m in re.finditer(r'model (\w+) \{(.*?)\n\}', s, re.S):
    names = re.findall(r'^\s{2}(\w+)\s', m.group(2), re.M)
    d = [n for n in set(names) if names.count(n) > 1]
    if d: dupfields.append((m.group(1), d))
check('no duplicate fields in a model', dupfields)

files = glob.glob('src/**/*.ts', recursive=True) + glob.glob('src/**/*.tsx', recursive=True) + ['middleware.ts']

# NEW: an identifier imported at module scope must not also be exported as a const.
shadow = []
for f in files:
    t = open(f).read()
    imported = set(re.findall(r"^import\s+(\w+)\s+from\s+'", t, re.M))
    imported |= {n.strip().split(' as ')[-1].strip() for m in re.findall(r"^import\s*\{([^}]*)\}\s*from", t, re.M) for n in m.split(',') if n.strip()}
    for name in re.findall(r"^export\s+const\s+(\w+)\s*=", t, re.M):
        if name in imported: shadow.append((f.replace('src/', ''), name))
check('no import/export name collisions', shadow)

miss = [(f, m) for f in files for m in re.findall(r"from '(@/[^']+)'", open(f).read())
        if not any(os.path.exists('src/' + m[2:] + e) for e in ('.ts', '.tsx', '/index.ts', '/index.tsx', '.css'))]
check('all internal imports resolve', miss)

leaks = []
for f in files:
    t = open(f).read()
    if not t.lstrip().startswith(("'use client'", '"use client"')): continue
    leaks += [(f, m) for m in re.findall(r"from '(@/lib/db/[^']+|@/config/env)'", t)]
    leaks += [(f, m) for m in re.findall(r"^import \{[^}]*\} from '(@/server/services/[^']+)'", t, re.M)]
check('no server code in client components', leaks)

# Required (non-optional) relation ids must never be handed a nullable value.
required_rel = {}
for m in re.finditer(r'model (\w+) \{(.*?)\n\}', s, re.S):
    for fm in re.finditer(r'^\s{2}(\w+Id)\s+String(\??)', m.group(2), re.M):
        if not fm.group(2):
            required_rel.setdefault(m.group(1), set()).add(fm.group(1))
nullable_writes = []
for f in glob.glob('src/**/*.ts', recursive=True):
    t = open(f).read()
    for mm in re.finditer(r'prisma\.(\w+)\.create\(', t):
        model = mm.group(1)[0].upper() + mm.group(1)[1:]
        for field in required_rel.get(model, ()):
            seg = t[mm.end():mm.end() + 700]
            if re.search(field + r':\s*(null|undefined)\b', seg):
                nullable_writes.append((f.replace('src/', ''), model + '.' + field))
check('no null written to a required relation', nullable_writes)

bad = []
for f in glob.glob('src/server/actions/*.ts'):
    t = open(f).read()
    if not t.lstrip().startswith(("'use server'", '"use server"')): continue
    bad += [(f.replace('src/', ''), m.group(1)) for m in re.finditer(r'^export (?!async function)(\w+)', t, re.M)
            if m.group(1) not in ('type', 'interface')]
check('only async exports in "use server" files', bad)

pages = {re.sub(r'/\([^)]+\)', '', f.replace('src/app', '').replace('/page.tsx', '')) or '/'
         for f in glob.glob('src/app/**/page.tsx', recursive=True)}
check('no dead nav links', [h for h in re.findall(r"href: '([^']+)'", open('src/config/navigation.ts').read()) if h.split('?')[0] not in pages])
check('no dead admin cards', [h for h in re.findall(r"href: '([^']+)'", open('src/app/(app)/admin/page.tsx').read()) if h not in pages])

b = ''.join(re.findall(r'"([A-Za-z0-9+/=]*)"', open('src/server/services/init-schema-sql.ts').read()))
sql = base64.b64decode(b).decode()
check('every model in the init SQL', [m for m in re.findall(r'^model (\w+)', s, re.M) if f'"{m}"' not in sql])

crons = json.load(open('vercel.json')).get('crons', [])
check('crons legal on Vercel Hobby', [c for c in crons if c['schedule'].split()[1] == '*'])

# ---------------------------------------------------------------- permissions
# A permission key that does not exist locks the page out completely, and the
# build says nothing. Caught "admin.settings.manage" (real key: setting).
defined_perms = set(re.findall(r"'([a-z]+(?:\.[a-z]+)+)'", open('src/lib/rbac/permissions.ts').read()))
bad_perms = []
for f in files:
    if not os.path.exists(f) or f.endswith('permissions.ts'):
        continue
    body = open(f).read()
    for m in re.finditer(r"(?:requirePermission|ensure|can)\(\s*(?:[A-Za-z_.]+,\s*)?'([a-z]+(?:\.[a-z]+)+)'", body):
        if m.group(1) not in defined_perms:
            bad_perms.append(f'{f}:{m.group(1)}')
check('every permission key exists', bad_perms)

# ---------------------------------------------------------------- type safety
# Suppressing type errors hid 217 problems for a year, four of them real runtime
# bugs. If this ever goes back to true, say so loudly.
cfg = open('next.config.mjs').read()
check('type errors fail the build', ['ignoreBuildErrors: true'] if 'ignoreBuildErrors: true' in cfg else [])

# ------------------------------------------------------------------ secrets
# A live key written into a tracked file is a key published to anyone who can
# read the repository. Caught three in the Apps Script connector.
secret_hits = []
for f in glob.glob('**/*.gs', recursive=True) + glob.glob('**/*.ts', recursive=True) + glob.glob('**/*.tsx', recursive=True) + glob.glob('**/*.md', recursive=True):
    if 'node_modules' in f or '.next' in f:
        continue
    try:
        body = open(f, encoding='utf-8', errors='ignore').read()
    except OSError:
        continue
    for m in re.finditer(r"['\"]([0-9a-f]{32,}|AIza[0-9A-Za-z_-]{30,}|sk-[A-Za-z0-9]{20,})['\"]", body):
        val = m.group(1)
        if val.count('0') == len(val) or 'EXAMPLE' in body[max(0, m.start()-40):m.start()].upper():
            continue
        secret_hits.append(f'{f}: {val[:8]}…')
check('no secrets in tracked files', secret_hits[:5])

# ── `overflow-x: hidden` on body silently breaks every sticky element ────────
# It turns body into a scroll container, so the sticky top bar comes unstuck
# with no error anywhere. `clip` trims the overflow without that side effect.
css = re.sub(r'/\*.*?\*/', '', open('src/app/globals.css', encoding='utf-8').read(), flags=re.S)
sticky_hits = [
    'globals.css: body has overflow-x: hidden — use `clip`, it does not break the sticky top bar'
    for block in re.findall(r'\bbody\s*\{([^}]*)\}', css)
    if re.search(r'overflow(-x)?\s*:\s*hidden', block)
]
check('sticky positioning survives the overflow rules', sticky_hits)


print(f"\n  {len(pages)} pages · {len(re.findall(r'^model ', s, re.M))} models · {'ALL CHECKS PASSED' if not fail else str(fail) + ' FAILURE(S)'}")
sys.exit(1 if fail else 0)
