# Prüft Ersetzungsbefehle der v2-Blätter gegen die am Wirksamkeitstag geltende gespeicherte Fassung (nur lesend).
import json,glob,os,sys,re
ROOT='staatsregierung/content/normen'
def version(slug,date):
    best=None
    for f in glob.glob(os.path.join(ROOT,slug,'versions','*.json')):
        v=json.load(open(f,encoding='utf-8'))
        if v['validFrom']<=date and (v.get('validTo') in (None,'') or v['validTo']>=date):
            if best is None or v['validFrom']>best['validFrom']: best=v
    return best
def units(v):
    out=[]
    def walk(nodes,par,sub):
        for n in nodes:
            t=n.get('type'); lab=n.get('label') or ''
            p=lab if t=='paragraph' else par
            s=lab if t=='subparagraph' else (None if t=='paragraph' else sub)
            if n.get('text'): out.append((p,s,t,lab,n['text']))
            walk(n.get('children') or [],p,s)
    walk(v.get('body',[]),None,None); return out
CHECKS=[
 ('Nr. 85 Art. 1 Nr. 2','ostdeutsches-polizeivollzugsdienstgesetz','2026-12-01','§ 46','des Landespolizeipräsidenten oder seines Vertreters im Amt'),
 ('Nr. 85 Art. 2 Nr. 2','ostdeutsches-polizeifachhochschulgesetz','2026-12-01','§ 1','Hochschule der Ostdeutschen Polizei (FH)'),
 ('Nr. 85 Art. 2 Nr. 3','ostdeutsches-polizeifachhochschulgesetz','2026-12-01','§ 16','die Landespolizeipräsidentin oder der Landespolizeipräsident'),
 ('Nr. 85 Art. 3 Nr. 2','vo-bezeichnung-hochschulgrade-fh-polizei','2026-12-01','§ 1','Hochschule der Ostdeutschen Polizei (FH)'),
 ('Nr. 86 Art. 3 Abs. 1','gesetz-zur-ausfuehrung-des-pass-und-personalausweisgesetzes-im-freistaat-ostdeutschland','2026-12-01','§ 2','die Polizeidirektionen nach § 97 Absatz 1 Nummer 5 des Ostdeutschen Polizeivollzugsdienstgesetzes vom 11. Mai 2019 (SächsGVBl. S. 358), in der jeweils geltenden Fassung'),
 ('Nr. 86 Art. 3 Abs. 2','landesjugendhilfegesetz','2026-12-01','§ 5','von der zuständigen Polizeidirektion gemäß § 97 Absatz 1 Nummer 5 des Ostdeutschen Polizeivollzugsdienstgesetzes vom 11. Mai 2019 (SächsGVBl. S. 358), in der jeweils geltenden Fassung,'),
 ('Nr. 86 Art. 3 Abs. 3 Nr. 1 (§ 7)','ostdeutsches-informationssicherheitsgesetz','2026-12-01','§ 7','dem Landespolizeipräsidium'),
 ('Nr. 86 Art. 3 Abs. 3 Nr. 1 (§ 9)','ostdeutsches-informationssicherheitsgesetz','2026-12-01','§ 9','dem Landespolizeipräsidium'),
 ('Nr. 86 Art. 3 Abs. 3 Nr. 2 (§ 10)','ostdeutsches-informationssicherheitsgesetz','2026-12-01','§ 10','des Landespolizeipräsidiums'),
]
for name,slug,date,par,needle in CHECKS:
    v=version(slug,date)
    if not v: print(name,'KEINE FASSUNG',slug); continue
    us=units(v); tot=sum(u[4].count(needle) for u in us); inpar=[(u[1],u[2],u[3],u[4]) for u in us if u[0]==par and needle in u[4]]
    print(f'{name}: {slug} Fassung {v["versionId"]} | Treffer gesamt {tot}, in {par}: {len(inpar)}')
    for sub,t,lab,tx in inpar: print('    ',sub,t,lab,'::',tx[:400])
    print('    Zitat:',v.get('citation'))
