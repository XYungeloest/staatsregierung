import re,html,sys
s=open(sys.argv[1],encoding='utf-8').read()
s=re.sub(r'(?is)<(script|style)[^>]*>.*?</\1>','',s)
s=re.sub(r'(?i)<br\s*/?>','\n',s)
s=re.sub(r'(?i)</(p|div|h\d|li|tr|table)>','\n',s)
s=re.sub(r'<[^>]+>','',s); s=html.unescape(s)
s=re.sub(r'[ \t\xa0]+',' ',s); s=re.sub(r'\n\s*\n+','\n',s)
print(s)
