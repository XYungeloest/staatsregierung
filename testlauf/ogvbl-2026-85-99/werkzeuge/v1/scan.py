import json,os,re,sys,glob
root,date=sys.argv[1],sys.argv[2]
pats=[(k,re.compile(v)) for k,v in [
 ('PVDG §§97-101', r'§§?\s*(?:97|99|100|100a|101)\b[^.;]{0,120}Polizeivollzugsdienstgesetz'),
 ('Landespolizeipräsid', r'Landespolizeipräsid'),
 ('LfV', r'Landesamt(?:es)? für Verfassungsschutz'),
 ('VSG', r'Verfassungsschutzgesetz'),
 ('PKK', r'Parlamentarische[n]? Kontrollkommission'),
 ('G10-Kommission', r'G\s?10-Kommission'),
 ('AG G10', r'Artikel[- ]10-Gesetz-Ausführungsgesetz|Ausführung des Artikel 10-Gesetzes'),
 ('Hochschule alt', r'Hochschule der (?:Ostdeutschen|Sächsischen) Polizei'),
 ('Grenzpolizei', r'Grenzpolizei|KGrPol'),
 ('Volkspolizei', r'Volkspolizei'),
 ('Polizeiorganisationsverordnung', r'Polizeiorganisationsverordnung'),
 ('Staatsschutz', r'Staatsschutz'),
]]
res={}
for d in sorted(os.listdir(f'{root}/content/normen')):
    vs=[]
    for f in glob.glob(f'{root}/content/normen/{d}/versions/*.json'):
        v=json.load(open(f)); vs.append(v)
    cand=[v for v in vs if v['validFrom']<=date and (v['validTo'] is None or v['validTo']>=date)]
    if not cand: continue
    v=sorted(cand,key=lambda x:x['validFrom'])[-1]
    def walk(xs,path):
        for x in xs:
            p=path+[x.get('label') or '']
            for k in ('text','title'):
                t=x.get(k) or ''
                for name,pat in pats:
                    for m in pat.finditer(t):
                        res.setdefault(name,[]).append((d,v['versionId'],' '.join(q for q in p if q),t[max(0,m.start()-90):m.end()+90].replace('\n',' ')))
            walk(x.get('children',[]),p)
    walk(v.get('body',[]),[])
json.dump(res,open(sys.argv[3],"w"),ensure_ascii=False)
for name,_ in pats:
    hits=res.get(name,[])
    norms=sorted(set(h[0] for h in hits))
    print(f'\n##### {name}: {len(hits)} Treffer in {len(norms)} Normen')
    for h in hits[:60]: print(' -',h[0],'@',h[1],'|',h[2],'|',h[3])
