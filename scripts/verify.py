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

print(f"\n  {len(pages)} pages · {len(re.findall(r'^model ', s, re.M))} models · {'ALL CHECKS PASSED' if not fail else str(fail) + ' FAILURE(S)'}")
sys.exit(1 if fail else 0)
