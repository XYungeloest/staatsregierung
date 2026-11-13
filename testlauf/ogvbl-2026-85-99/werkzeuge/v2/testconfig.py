import json,sys
V='Vorbereitete Fassung (Testlauf): Annahme durch die Volkskammer und Verkündung sind unterstellt. '
VK='Volkskammer des Freistaates Ostdeutschland'
MIN='Staatssekretariat des Innern und für Staats- und Grenzsicherheit'
POL=['Sicherheitsrecht und Polizeirecht']
VS=['Verfassungsschutz']
def e(**k):
    d={'enactingBody':VK,'responsibleMinistry':MIN,'subjects':POL,'verifiedAt':'2026-11-13'}
    d.update(k); d['summary']=V+d['summary']; return d
cfg={
'OGVBl.|2026|85':[e(slug='gesetz-bezeichnung-volkspolizei',shortTitle='Volkspolizei-Bezeichnungsgesetz',type='aenderungsvorschrift',summary='Führt die amtliche Bezeichnung Volkspolizei ein und benennt die Polizeihochschule und ihre Hochschulgradverordnung um.',affectedNorms=['ostdeutsches-polizeivollzugsdienstgesetz','ostdeutsches-polizeifachhochschulgesetz','vo-bezeichnung-hochschulgrade-fh-polizei'])],
'OGVBl.|2026|86':[e(slug='gesetz-organisation-volkspolizei',shortTitle='Gesetz über die Organisation der Volkspolizei',type='aenderungsvorschrift',summary='Führt das Volkspolizeiorganisationsgesetz ein, verweist die Polizeiorganisation im Polizeivollzugsdienstgesetz darauf und passt Folgerecht an.',affectedNorms=['ostdeutsches-polizeivollzugsdienstgesetz','gesetz-zur-ausfuehrung-des-pass-und-personalausweisgesetzes-im-freistaat-ostdeutschland','landesjugendhilfegesetz','ostdeutsches-informationssicherheitsgesetz']),
                  e(slug='volkspolizeiorganisationsgesetz',shortTitle='Volkspolizeiorganisationsgesetz',abbr='VPOG',type='gesetz',summary='Regelt Aufbau, Polizeidienststellen, bürgernahe Polizeiarbeit, Kennzeichnung und Berichte der Volkspolizei.')],
'OGVBl.|2026|87':[e(slug='gesetz-reform-polizeiausbildung',shortTitle='Polizeiausbildungsreformgesetz',type='aenderungsvorschrift',summary='Ergänzt das Polizeifachhochschulgesetz um Pflichtkompetenzen, Fortbildungspflicht und Führungsqualifizierung.',affectedNorms=['ostdeutsches-polizeifachhochschulgesetz','ausbildungs-und-pruefungsordnung-polizei'])],
'OGVBl.|2026|88':[e(slug='gesetz-einfuehrung-polizeibeschwerdestelle',shortTitle='Gesetz zur Einführung der Polizei-Beschwerde- und Ermittlungsstelle',type='aenderungsvorschrift',summary='Führt das Polizeibeschwerdestellengesetz ein und fasst § 98 des Polizeivollzugsdienstgesetzes neu.',affectedNorms=['ostdeutsches-polizeivollzugsdienstgesetz'])],
'OGVBl.|2026|89':[e(slug='gesetz-digitalisierung-volkspolizei',shortTitle='Gesetz über die Digitalisierung der Volkspolizei',type='aenderungsvorschrift',summary='Führt das Polizeidigitalisierungsgesetz ein.'),
                  e(slug='polizeidigitalisierungsgesetz',shortTitle='Polizeidigitalisierungsgesetz',abbr='PolDigG',type='gesetz',summary='Regelt elektronische Vorgangsbearbeitung, Online-Wache, Leitstellen, Interoperabilität und Informationssicherheit der Volkspolizei.')],
'OGVBl.|2026|90':[e(slug='gesetz-einfuehrung-ostdeutsches-sicherheitsgesetz',shortTitle='Gesetz über die Einführung eines Ostdeutschen Sicherheitsgesetzes',type='aenderungsvorschrift',summary='Führt das Ostdeutsche Sicherheitsgesetz über Sicherheitskabinett, Lagezentrum und Krisenstab ein.')],
'OGVBl.|2026|91':[e(slug='gesetz-einfuehrung-staatsschutzamt-errichtungsgesetz',shortTitle='Gesetz zur Einführung eines Gesetzes zur Errichtung des Landesamtes für Staatsschutz',type='aenderungsvorschrift',subjects=VS,summary='Führt das Gesetz zur Errichtung des Landesamtes für Staatsschutz ein.')],
'OGVBl.|2026|92':[e(slug='gesetz-einfuehrung-staatsschutz-nachrichtendienstgesetz',shortTitle='Gesetz zur Einführung eines Staatsschutz- und Nachrichtendienstgesetzes',type='aenderungsvorschrift',subjects=VS,summary='Führt das Staatsschutz- und Nachrichtendienstgesetz ein.')],
'OGVBl.|2026|93':[e(slug='gesetz-einfuehrung-staatsschutz-kontrollgesetz',shortTitle='Gesetz über die Einführung eines Staatsschutz-Kontrollgesetzes',type='aenderungsvorschrift',subjects=VS,summary='Führt das Staatsschutz-Kontrollgesetz ein.'),
                  e(slug='staatsschutz-kontrollgesetz',shortTitle='Staatsschutz-Kontrollgesetz',abbr='OstSKG',type='gesetz',subjects=VS,summary='Regelt das Parlamentarische Kontrollgremium und die Staatsschutzkommission.')],
'OGVBl.|2026|94':[e(slug='gesetz-einfuehrung-kritis-gesetz',shortTitle='Gesetz zur Einführung eines KRITIS-Gesetzes',type='aenderungsvorschrift',effectiveOverride='2027-01-01',dateNote='Artikel 1 § 3 Absatz 2 tritt am Tag nach der Verkündung in Kraft, im Übrigen gilt das Gesetz ab 1. Januar 2027.',summary='Führt das Ostdeutsche KRITIS-Gesetz ein.'),
                  e(slug='ostdeutsches-kritis-gesetz',shortTitle='Ostdeutsches KRITIS-Gesetz',abbr='OstKRITISG',type='gesetz',effectiveOverride='2027-01-01',dateNote='§ 3 Absatz 2 tritt am Tag nach der Verkündung in Kraft, im Übrigen gilt das Gesetz ab 1. Januar 2027.',summary='Regelt Bestimmung, Registrierung, Risikoanalyse, Resilienzpflichten und Meldepflichten für kritische Infrastrukturen.')],
'OGVBl.|2026|95':[e(slug='gesetz-einfuehrung-luftverkehrssicherungsgesetz',shortTitle='Gesetz zur Einführung eines Luftverkehrssicherungsgesetzes',type='aenderungsvorschrift',summary='Führt das Ostdeutsche Luftverkehrssicherungsgesetz ein.')],
'OGVBl.|2026|96':[e(slug='gesetz-aenderung-pvdg-terrorismusabwehr',shortTitle='Gesetz zur Stärkung der Terrorismusabwehr',type='aenderungsvorschrift',summary='Fügt Schutzbereiche, eine Meldeauflage zur Terrorabwehr und Maßnahmen gegen unbemannte Fluggeräte in das Polizeivollzugsdienstgesetz ein.',affectedNorms=['ostdeutsches-polizeivollzugsdienstgesetz'])],
'OGVBl.|2026|97':[e(slug='gesetz-staerkung-wehrhafte-demokratie',shortTitle='Gesetz zur Stärkung der wehrhaften Demokratie',type='aenderungsvorschrift',subjects=VS,summary='Führt das Verfassungstreueprüfungsgesetz und das Demokratieförderungsgesetz ein.'),
                  e(slug='verfassungstreuepruefungsgesetz',shortTitle='Verfassungstreueprüfungsgesetz',abbr='VTPG',type='gesetz',subjects=VS,summary='Regelt Anfragen beim Landesamt für Staatsschutz vor Einstellungen in sicherheitsrelevante Bereiche.'),
                  e(slug='demokratiefoerderungsgesetz',shortTitle='Demokratieförderungsgesetz',abbr='DemFG',type='gesetz',subjects=VS,summary='Regelt Landesprogramm, Trägerförderung, Ausstiegsprogramm und Beirat zur Demokratieförderung.')],
'OGVBl.|2026|98':[e(slug='gesetz-einfuehrung-sicherheitsbehoerden-zusammenarbeitsgesetz',shortTitle='Gesetz zur Einführung eines Sicherheitsbehörden-Zusammenarbeitsgesetzes',type='aenderungsvorschrift',summary='Führt das Sicherheitsbehörden-Zusammenarbeitsgesetz ein.'),
                  e(slug='sicherheitsbehoerden-zusammenarbeitsgesetz',shortTitle='Sicherheitsbehörden-Zusammenarbeitsgesetz',abbr='OstSZG',type='gesetz',summary='Regelt Datenübermittlung, Projektdateien und Fallkonferenzen zwischen Staatsschutz, Volkspolizei und Kasernierter Grenzpolizei.')],
'OGVBl.|2026|99':[e(slug='ost-sicherheitsreform-anpassungsgesetz',shortTitle='Gesetz zur Einführung der Ost-Sicherheitsreform',type='aenderungsvorschrift',subjects=VS,summary='Hebt Verfassungsschutzgesetz und Artikel-10-Ausführungsgesetz auf und passt Bezeichnungen im Landesrecht an.',affectedNorms=['ostdeutsches-verfassungsschutzgesetz','ostdeutsches-artikel-10-gesetz-ausfuehrungsgesetz'])],
}
src=open(sys.argv[1],encoding='utf-8').read()
anchor='const NEW_PUBLICATION_CONFIG = {\n'
assert src.count(anchor)==1
block=''.join("  '%s': %s,\n"%(k,json.dumps(v,ensure_ascii=False,indent=2)) for k,v in cfg.items())
block='  // TESTLAUF OGVBl. 2026 Nr. 85-99 (vorbereitete Fassungen, nicht produktiv)\n'+block
src=src.replace(anchor,anchor+block)
open(sys.argv[1],'w',encoding='utf-8').write(src)
print('inserted',len(cfg),'issues')
