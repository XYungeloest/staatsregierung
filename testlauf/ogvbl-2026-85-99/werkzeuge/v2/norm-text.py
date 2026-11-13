# Gibt die am Datum geltende gespeicherte Fassung einer Norm aus dem Original-Checkout aus (nur lesend).
# Aufruf: python3 -I norm-text.py <slug> <YYYY-MM-DD> [Paragraphlabel ...]   z. B. "§ 97" "§ 101"
import json,glob,os,sys
ROOT='staatsregierung/content/normen'
slug,date,*labels=sys.argv[1:]
best=None
for f in glob.glob(os.path.join(ROOT,slug,'versions','*.json')):
    v=json.load(open(f,encoding='utf-8'))
    if v['validFrom']<=date and (v.get('validTo') in (None,'') or v['validTo']>=date):
        if best is None or v['validFrom']>best['validFrom']: best=v
if not best: sys.exit('keine Fassung gültig am '+date)
print('#',best['versionId'],'gültig',best['validFrom'],'bis',best.get('validTo'),'|',best.get('citation'))
def walk(nodes,depth,show):
    for n in nodes:
        t=n.get('type'); lab=n.get('label') or ''; ti=n.get('title') or ''; tx=n.get('text') or ''
        s=show or (t=='paragraph' and (not labels or lab in labels)) or (t=='article' and lab in labels)
        if s:
            print('  '*depth+(f'[{t}] {lab} {ti}'.rstrip() if t in('paragraph','article','section','chapter','part','heading','annex','attachment') else f'<{t}> {lab}'.rstrip())+(' :: '+tx if tx else ''))
        walk(n.get('children') or [],depth+1,s)
walk(best.get('body',[]),0,False)
