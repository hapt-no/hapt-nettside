import json,re
d=json.load(open(__import__('os').path.join(__import__('os').path.dirname(__file__),'linsedata.json')))
GR={
 'Epson EB-PU2100/PU2200':'Epson EB-PU2100/PU2200, EB-PU2010, EB-L1000 (L17xx/L15xx)',
 'Epson EB-PU1000/PU2010':'Epson EB-PU2100/PU2200, EB-PU2010, EB-L1000 (L17xx/L15xx)',
 'Epson EB-L1000 (L17xx/L15xx)':'Epson EB-PU2100/PU2200, EB-PU2010, EB-L1000 (L17xx/L15xx)',
 'Epson EB-PU1000 (0,76")':'Epson EB-PU1000 (PU1007/PU1008, 0,76")',
 'Epson EB-PQ2200 (4K-forbedring)':'Epson EB-PQ2200',
 'Panasonic 3-chip DLP (ET-D75LE/ET-D3LE), 0,96" WUXGA':'Panasonic PT-RQ35K/RZ34K/RZ31K/RZ21K (0,96" WUXGA, 16:10)',
 'Panasonic 3-chip DLP (ET-D75LE/ET-D3LE), WQXGA':'Panasonic PT-RQ32K/RQ22K (WQXGA)',
 'Barco G62 (G-linser)':'Barco G62 / G60 / G50 (WUXGA)',
 'Barco G100 (GC-linser)':'Barco G100 (WUXGA 0,96")',
 'Barco F80 (GLD/FLD/FLDX)':'Barco F80 (0,67" WQXGA+)',
}
alle=set(c['projektorfamilie'] for l in d['linser'] for c in l['kompatibilitet'])
def gruppe(p):
    f=p['familie']
    if f in GR: return GR[f]
    if f.startswith('Panasonic 1-chip'): return next(x for x in alle if x.startswith('Panasonic PT-REQ'))
    if f.startswith('Barco'):
        return 'Barco UDX-4K / UDM-4K (WQXGA 0,9")' if p['opplosning_px'][0]==2560 else 'Barco UDX-W / HDX (WUXGA 0,96")'
    raise Exception(f)
def frem(p):
    m=p['modell']
    if 'PU22' in m or 'PU21' in m: return 'PU2200'
    if 'PU2010' in m: return 'PU2010'
    if 'PU100' in m: return 'PU1000'
    if 'EB-L1' in m: return 'L17xx'
    return None
def shift(s):
    if not isinstance(s,dict): return {'txt':str(s)} if s else None
    o={}
    if s.get('vertikal_pct') is not None: o['opp']=o['ned']=s['vertikal_pct']
    if s.get('vertikal_maks_pct') is not None and s.get('vertikal_min_pct') is None: o['opp']=o['ned']=s['vertikal_maks_pct']
    if s.get('vertikal_min_pct') is not None: o['ned']=-s['vertikal_min_pct']; o['opp']=s['vertikal_maks_pct']
    if s.get('vertikal_opp_pct') is not None: o['opp']=s['vertikal_opp_pct']
    if s.get('vertikal_ned_pct') is not None: o['ned']=s['vertikal_ned_pct']
    if s.get('horisontal_pct') is not None: o['h']=s['horisontal_pct']
    if s.get('vertikal_ved_maks_horisontal_pct') is not None: o['vh']=s['vertikal_ved_maks_horisontal_pct']
    if s.get('merknad'): o['txt']=s['merknad']
    if s.get('status'): o['txt']=(o.get('txt','')+' '+s['status']).strip()
    return o
L=[]
for l in d['linser']:
    f={}
    for c in l['kompatibilitet']:
        fo=c.get('formel') or {}
        te=c.get('kastforhold_effektivt') or [None,None]
        f[c['projektorfamilie']]={'a0':fo.get('a_min',te[0]),'b0':fo.get('b_min_m'),'a1':fo.get('a_maks',te[1]),'b1':fo.get('b_maks_m'),
            'tr':c.get('kastforhold_oppgitt'),'note':c.get('merknad') or fo.get('merknad'),'k':c.get('kilde') or []}
    ls=l.get('linseforskyvning')
    L.append({'n':l['navn'],'nr':l.get('delenummer'),'m':l['merke'],'type':l.get('type'),'ref':l.get('avstand_maales_fra'),'st':l.get('status'),
      'note':l.get('merknad'),'frem':l.get('fremspring_fra_kabinettfront_mm'),'L1':l.get('linsefremspring_L1_m'),'f':f,'k':l.get('kilder') or [],
      'shift':shift(ls) if isinstance(ls,dict) else None})
P=[]
for p in d['projektorer']:
    g=gruppe(p); assert g in alle,(g)
    ps={}
    for e in (p['linseforskyvning'].get('per_linse') or []):
        for navn in e['linser']:
            base=navn.replace('-familien','')
            for i,l in enumerate(L):
                if g in l['f'] and re.search(re.escape(base)+r'(?![0-9])', l['n']): ps[i]=shift(e)
    P.append({'m':p['merke'],'n':p['modell'],'g':g,'res':p['opplosning_px'],'asp':p['aspekt'],'lm':p['lumen'],'lmNote':p.get('lumen_merknad'),
      'panel':p.get('panel_diagonal_tommer'),'kg':p.get('vekt_kg'),'kgNote':p.get('vekt_merknad'),'shift':shift(p['linseforskyvning'].get('generelt') or {}),'ls':ps,
      'frem':frem(p),'st':p.get('status'),'note':p.get('merknad'),'k':p.get('kilder') or []})
for p in P:
    n=sum(1 for l in L if p['g'] in l['f'])
    print(p['n'],'linser:',n,'shift-linser:',len(p['ls']))
K={k['id']:k['url'] for k in d['kilder']}
js='// Projektor- og linsedata, samlet 2026-10-15 fra produsentenes datablad (kilder i K). Avstand L [m] = a * bildebredde [m] + b.\n// Status per oppføring: bekreftet, delvis, estimert, sekundaerkilde, ikke_bekreftet. Generert fra linsedata.json; rett i den og bygg på nytt.\nwindow.HaptProjektorData = '+json.dumps({'P':P,'L':L,'K':K},ensure_ascii=False,separators=(',',':'))+';\n'
open(__import__('os').path.join(__import__('os').path.dirname(__file__),'..','data.js'),'w').write(js)
print(len(js))
