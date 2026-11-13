import sys,re,hashlib,os
src,outdir=sys.argv[1],sys.argv[2]
s=open(src,encoding='utf-8').read()
b=s.find('<body'); bodytag_end=s.find('>',b)+1
head=s[:b]; bodytag=s[b:bodytag_end]
body=s[bodytag_end:]
# header div
hd_end=body.find('</div>')+len('</div>')
headerdiv=body[:hd_end]
rest=body[hd_end:]
footer_start=rest.rfind('<div>')
footer=rest[footer_start:]  # '<div>..Seite..</div></body></html>'
content=rest[:footer_start]
logo_pat=re.compile(r'<p class="c[0-9]+"><span style="[^"]*"><img alt="" src="images/image1.png"')
starts=[m.start() for m in logo_pat.finditer(content)]
print('logos',len(starts))
segs=[content[st:(starts[i+1] if i+1<len(starts) else len(content))] for i,st in enumerate(starts)]
for seg in segs:
    m=re.search(r'<span class="c[0-9]+">Nr\. (\d+)</span>',seg) or re.search(r'>Nr\. (\d+)<',seg)
    nr=m.group(1)
    hdiv=headerdiv.replace('OGVBl. Nr. 85','OGVBl. Nr. %s'%nr)
    assert ('OGVBl. Nr. %s'%nr) in hdiv
    html=head+bodytag+hdiv+seg+footer
    fn=os.path.join(outdir,'OGVBl. 2026 Nr. %s.html'%nr)
    open(fn,'w',encoding='utf-8').write(html)
    print(nr, len(html), hashlib.sha256(html.encode()).hexdigest()[:16], fn)
# verify: concatenation of segments == content (lossless)
assert ''.join(segs)==content[starts[0]:]
assert content[:starts[0]]==''
print('lossless split ok')
