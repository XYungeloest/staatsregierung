import json,sys
def walk(nodes,out,depth=0):
    for n in nodes:
        t=n.get('type'); lab=n.get('label') or ''; ti=n.get('title') or ''; tx=n.get('text') or ''
        ind='  '*depth
        if t in ('paragraph','article','section','part','chapter','heading','attachment','annex','quotedProvision','quote'):
            out.append(f"{ind}[{t}] {lab} {ti}".rstrip()+ (f" :: {tx}" if tx else ''))
        else:
            out.append(f"{ind}<{t}> {lab} {tx}".rstrip())
        if n.get('children'): walk(n['children'],out,depth+1)
d=json.load(open(sys.argv[1]))
out=[f"### Ausgabe {d['issue']} | {d['title']} | {d['type']} | in Kraft {d['effectiveDate']}"]
walk(d['body'],out)
for n in d['introduced']:
    out.append(f"\n### EINGEFÜHRT: {n['title']} | {n.get('shortTitle')} | {n.get('abbr')} | {n['type']}")
    walk(n['body'],out)
print('\n'.join(out))
