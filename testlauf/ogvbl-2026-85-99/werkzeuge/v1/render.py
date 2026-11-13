import json,sys
def walk(nodes,depth,out):
    for n in nodes:
        t=n.get('type'); lab=n.get('label') or ''; ti=n.get('title') or ''; tx=n.get('text') or ''
        ind='  '*(n.get('level',0) if t=='item' else 0)
        if t in ('paragraph','article','section','part','chapter','heading','attachment','annex'):
            out.append(f"\n[{t}] {lab} {ti}".rstrip())
            if tx: out.append(tx)
        else:
            out.append(f"{ind}{lab} {tx}".strip() if (lab or tx) else f"[{t}]")
        if n.get('children'): walk(n['children'],depth+1,out)
v=json.load(open(sys.argv[1]))
out=[f"# {v.get('versionId')} validFrom={v.get('validFrom')} validTo={v.get('validTo')} | {v.get('citation')}"]
walk(v.get('body',[]),0,out)
print('\n'.join(out))
