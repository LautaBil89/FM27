#!/usr/bin/env python3
"""Build supplemental, source-labelled lower divisions without touching the base database.

Uses normally accessible Transfermarkt season pages with cached HTML and no runtime
requests. The original database identities always take precedence. Missing player
coverage is recorded, never replaced with a fabricated published identity.
"""
import argparse
import concurrent.futures
import datetime as dt
import json
import math
import re
import urllib.request
from pathlib import Path
from lxml import html
import build_europe as eu
import build_south_america as sa

ROOT = Path(__file__).resolve().parents[1]
# Internal id, source code, name, country, count, confederation, upper division.
SPECS = [
 ('GB2','GB2','EFL Championship','Inglaterra',24,'UEFA','GB1'),
 ('ES2','ES2','Segunda División','España',22,'UEFA','ES1'),
 ('IT2','IT2','Serie B','Italia',20,'UEFA','IT1'),
 ('L2','L2','2. Bundesliga','Alemania',18,'UEFA','L1'),
 ('FR2','FR2','Ligue 2','Francia',18,'UEFA','FR1'),
 ('BRA2','BRA2','Campeonato Brasileiro Série B','Brasil',20,'CONMEBOL','BRA1'),
 ('CHI2','CL2B','Liga de Ascenso de Chile','Chile',16,'CONMEBOL','CHI1'),
 ('URU2','URU2','Segunda División de Uruguay','Uruguay',14,'CONMEBOL','URU1'),
 ('PAR2','PAR2','División Intermedia','Paraguay',16,'CONMEBOL','PAR1'),
 ('ECU2','EC2L','LigaPro Serie B','Ecuador',12,'CONMEBOL','ECU1'),
 ('PER2','PER2','Liga 2 de Perú','Perú',18,'CONMEBOL','PER1'),
 ('COL2','CO2T','Torneo BetPlay','Colombia',16,'CONMEBOL','COL1'),
 ('VEN2','VN2A','Liga FUTVE 2','Venezuela',17,'CONMEBOL','VEN1'),
]
HOST='https://www.transfermarkt.com.ar'


def members(spec, cache):
 lid,code,name,country,count,conf,upper=spec
 path=cache/f'{code}-league.html'
 url=f'{HOST}/x/startseite/wettbewerb/{code}/saison_id/2025'
 if not path.exists():
  path.write_bytes(urllib.request.urlopen(url,timeout=40).read())
 doc=html.fromstring(path.read_bytes());title=doc.xpath('//title/text()')[0]
 season='2025/26' if conf=='UEFA' else '2026'
 if ('25/26' if conf=='UEFA' else '2026') not in title: raise ValueError(f'{lid}: unexpected season {title}')
 clubs=[]
 for row in doc.xpath('//table[contains(@class,"items")]/tbody/tr'):
  a=row.xpath('.//td[contains(@class,"hauptlink")]/a[contains(@href,"/startseite/verein/")]')
  if not a:continue
  a=a[0];cid=int(re.search(r'/verein/(\d+)',a.get('href'))[1])
  if any(c['tmId']==cid for c in clubs):continue
  clubs.append(dict(tmId=cid,nombre=sa.content(a),slug=a.get('href').split('/')[1],country=country,leagueId=lid,sourceUrl=HOST+a.get('href')))
 if len(clubs)!=count:raise ValueError(f'{lid}: expected {count} source teams, observed {len(clubs)}')
 league=dict(id=lid,name=name,country=country,confederation=conf,tier=2,upperLeagueId=upper,clubIds=[f'tm-{c["tmId"]}'for c in clubs],doubleRound=True,foreignLimit=99 if conf=='UEFA' else 6,libSlots=0,sudSlots=0,relegationCount=0,sourceSeason=season,sourceUrl=url,supplemental=True,rosterCoverage='season-participants',lowerBoundary='La tercera categoría queda fuera de la simulación; no se adjudican descensos ficticios.')
 source=dict(url=url,title=title,kind='league-membership',season=season,retrievedAt=dt.datetime.fromtimestamp(path.stat().st_mtime,dt.timezone.utc).isoformat())
 return league,clubs,source


def squad(raw,cache):
 try:
  if raw['country'] in ('Inglaterra','España','Italia','Alemania','Francia'):
   try:rows,source=eu.squad_members(raw,cache)
   except ValueError as error:
    if 'Missing birth date' not in str(error):raise
    # Skip an unpublished birth date rather than discard the verified squad.
    path=cache/f'squad-{raw["tmId"]}.html';doc=html.fromstring(path.read_bytes());rows=[]
    headers=[eu.text(x)for x in doc.xpath('//table[contains(@class,"items")]/thead//th')];offset=int('Club actual'in headers)
    url=f'{HOST}/{raw["slug"]}/kader/verein/{raw["tmId"]}/saison_id/2025/plus/1';stamp=dt.datetime.fromtimestamp(path.stat().st_mtime,dt.timezone.utc).isoformat()
    for row in doc.xpath('//table[contains(@class,"items")]/tbody/tr'):
     links=row.xpath('.//td[@class="hauptlink"]/a[contains(@href,"/profil/spieler/")]');td=row.xpath('./td')
     if not links or len(td)<8:continue
     birth=eu.date_es(eu.text(td[2]));positions=row.xpath('.//table[contains(@class,"inline-table")]/tr[last()]/td')
     if not birth or not positions:continue
     link=links[0];detail=eu.text(positions[0]);pid=int(re.search(r'/spieler/(\d+)',link.get('href'))[1]);height=re.match(r'(\d),([\d]+)m',eu.text(td[4+offset]))
     rows.append(dict(playerId=pid,name=eu.text(link),dateOfBirth=birth,position=eu.position(detail),positionDetail=detail,nationalities=td[3].xpath('.//img/@title'),foot=eu.text(td[5+offset])or None,heightCm=int(height[1])*100+int(height[2])if height else None,marketValueEUR=eu.money(eu.text(td[-1])),valuationDate=None,contractEnd=None if offset else eu.date_es(eu.text(td[-2])),shirtNumber=int(eu.text(td[0]))if eu.text(td[0]).isdigit()else None,profileUrl=HOST+link.get('href'),sourceUrl=url,sourceSeason='2025/26',sourceType='direct',retrievedAt=stamp))
    source=dict(url=url,title=doc.xpath('//title/text()')[0],season='2025/26',kind='season-squad',retrievedAt=stamp,skippedUnpublishedBiographies=True)
   stadium=raw.get('stadium');capacity=raw.get('capacity')
  else:
   try:_,rows,stadium,capacity,source=sa.squad_page(raw,cache)
   except (IndexError,ValueError):
    _,rows,stadium,capacity,source=sa.squad_page(raw,cache,2024)
    source['historicalSupplement']=True
    for p in rows:p['affiliationSource']='historical-season-participant'
  return raw,rows,stadium,capacity,source,None
 except Exception as e:return raw,[],None,None,None,str(e)


def build(args):
 args.cache.mkdir(parents=True,exist_ok=True)
 base=json.loads((ROOT/'data/world-database.json').read_text());base_ids={p['playerId']for p in base['players']};base_clubs={c['tmId']for c in base['clubs']}
 output=dict(version=1,referenceSeasons={'UEFA':'2025/26','CONMEBOL':'2026'},leagues=[],clubs=[],players=[],sources=[],notes=[
  'Catálogo adicional: no cambia ninguna identidad, afiliación ni atributo de la base original de 310 clubes y 9220 jugadores.',
  'Los clubes y participantes de temporada son identidades publicadas; atributos deportivos, colores, salarios, presupuestos y reputaciones son parámetros de simulación.',
  'La membresía europea corresponde a 2025/26 y la sudamericana a 2026; no se afirma que sean nóminas vigentes en octubre de 2026.',
  'Una identidad aparece una sola vez. Las identidades presentes en la base original siempre conservan su afiliación original; los planteles adicionales omiten esos duplicados.',
  'Cada club publica su cobertura real. Si faltan jugadores para un once y banco, el motor crea reservas claramente ficticias; no se presentan como nombres reales ni como fichajes publicados.',
  'Sólo se representa el intercambio entre primera y segunda categoría; las terceras divisiones y sanciones administrativas no se simulan.'
 ])
 raw_clubs=[]
 with concurrent.futures.ThreadPoolExecutor(max_workers=3)as pool:
  for league,clubs,source in pool.map(lambda s:members(s,args.cache),SPECS):
   if any(c['tmId']in base_clubs for c in clubs):raise ValueError(f'{league["id"]}: overlapping original membership')
   output['leagues'].append(league);raw_clubs.extend(clubs);output['sources'].append(source);print(f'Members {league["id"]}: {len(clubs)}',flush=True)
 used=set(base_ids);palette=['#2453b4','#c52e42','#176b4a','#7651aa','#d6a53b','#329caf']
 with concurrent.futures.ThreadPoolExecutor(max_workers=3)as pool:
  for raw,rows,stadium,capacity,source,error in pool.map(lambda c:squad(c,args.cache),raw_clubs):
   cid=raw['tmId'];selected=[];eligible=[p for p in rows if p['playerId']not in used]
   eligible.sort(key=lambda p:(p.get('_actualClub',p.get('_observedClubId'))in(None,cid),p['marketValueEUR']or 0),reverse=True)
   for pos,n in [('POR',2),('DEF',6),('MED',6),('DEL',4)]:selected.extend([p for p in eligible if p['position']==pos][:n])
   picked={p['playerId']for p in selected};selected.extend(p for p in eligible if p['playerId']not in picked);selected=selected[:26]
   total=sum(p['marketValueEUR']or 100000 for p in selected);rating=max(42,min(81,round(34+8*math.log10(max(1,total/1000)))))
   club=dict(id=f'tm-{cid}',tmId=cid,nombre=raw['nombre'],leagueId=raw['leagueId'],country=raw['country'],rival=None,rating=rating,short=''.join(w[0]for w in raw['nombre'].split()[:3]).upper(),color=palette[cid%len(palette)],secondary='#f8fafc',stadium=stadium or f'Campo de {raw["nombre"]}',city='Ciudad sin verificar',capacity=capacity or 12000,budget=round(max(250000,total*.14*1.1)),wageBudget=round(max(20000,total*.003*1.1)),reputation=max(25,min(85,rating)),sourceUrl=source['url']if source else raw['sourceUrl'],supplemental=True,referenceSeason='2025/26'if raw['country']in('Inglaterra','España','Italia','Alemania','Francia')else'2026',rosterCoverage={'publishedParticipants':len(rows),'selectedIdentities':len(selected),'keepers':sum(p['position']=='POR'for p in selected),'missingCoverage':bool(error)or len(selected)<18,'historicalSupplement':bool(source and source.get('historicalSupplement')),'sourceSeason':source.get('season')if source else None,'error':error,'unknownGround':not bool(stadium),'estimatedCapacity':not bool(capacity)})
   # Reserve teams cannot be promoted into their parent's division.
   if raw['leagueId']=='ES2'and cid==9899:club['reserveParentId']='tm-681'
   if raw['leagueId']=='ECU2'and cid==62074:club['reserveParentId']='tm-19309'
   if raw['leagueId']=='PER2'and cid==38335:club['reserveParentId']='tm-21655'
   ven_parents={117712:'tm-45193',76267:'tm-14596',43372:'tm-18018'}
   if cid in ven_parents:club['reserveParentId']=ven_parents[cid]
   output['clubs'].append(club)
   if source:output['sources'].append(source)
   for p in selected:
    used.add(p['playerId']);p['clubId']=club['id'];p['joinedDate']=p.pop('_joined',p.get('joinedDate'));p.pop('_observedClubId',None);p.pop('_actualClub',None);output['players'].append(p)
   print(f'Squad {club["nombre"]}: {len(selected)} real, {club["rosterCoverage"]["keepers"]} keepers'+(f' [{error}]'if error else ''),flush=True)
 add_bolivia(output,args.cache)
 args.output.parent.mkdir(parents=True,exist_ok=True);args.output.write_text(json.dumps(output,ensure_ascii=False,indent=2)+'\n')
 print(f'Written {args.output}: {len(output["clubs"])} clubs / {len(output["players"])} real identities',flush=True)


def add_bolivia(output,cache):
 """A documented historical candidate pool, never an invented official 2026 field."""
 url='https://www.rsssf.org/tablesb/bol2025.html';path=cache/'bolivia-reference-2025.html'
 if not path.exists():path.write_bytes(urllib.request.urlopen(url,timeout=30).read())
 doc=html.fromstring(path.read_bytes());text=doc.text_content();part=text[text.rfind('Copa Simón Bolívar 2025'):]
 expected=['Ciudad Nueva SC Academia','Río San Juan Humi','Fancesa','Chocorosi','Primero de Mayo','Guadalajara Qaqacacha','Unión Tarija','Ingenieros','Torre Fuerte','Nueva Cliza','Nacional Sucre','San Juan','Olympic','Ingenio','Chaco FC','Universitario (Sucre)','Deportivo Shalón','Libertad FC','3 der Febrero','Municipal Tiquipaya','Municipal Tarija','Pucarani','Universitario (Pando)']
 if not all(name in part for name in expected):raise ValueError('Bolivian historical source no longer confirms the reference pool')
 # Real Potosí already belongs to the original 2026 first division. Its vacated
 # reference-pool slot is taken by the documented 2025 relegated Wilstermann.
 expected.append('Jorge Wilstermann');ids=[]
 for i,name in enumerate(expected):
  cid=f'ref-bol-{i+1:02d}';ids.append(cid)
  output['clubs'].append(dict(id=cid,nombre=name.replace('3 der Febrero','3 de Febrero'),leagueId='BOL2',country='Bolivia',rival=None,rating=48+(i%8),short=''.join(w[0]for w in name.split()[:3]).upper(),color=['#2453b4','#c52e42','#176b4a'][i%3],secondary='#f8fafc',stadium=f'Campo de {name}',city='Localidad no verificada',capacity=5000,budget=200000,wageBudget=15000,reputation=35+(i%10),sourceUrl=url,supplemental=True,referenceSeason='2025 · pool adaptado',rosterCoverage={'publishedParticipants':0,'selectedIdentities':0,'keepers':0,'missingCoverage':True,'sourceSeason':None,'unknownGround':True,'estimatedCapacity':True},identitySource='RSSSF: club real; no se ha verificado plantilla',historicalPool=True))
 output['leagues'].append(dict(id='BOL2',name='Copa Simón Bolívar · fase nacional',country='Bolivia',confederation='CONMEBOL',tier=2,upperLeagueId='BOL1',clubIds=ids,doubleRound=False,foreignLimit=6,libSlots=0,sudSlots=0,relegationCount=0,sourceSeason='2025 · referencia histórica adaptada',sourceUrl=url,supplemental=True,format='regional-promotion-cup',historicalPool=True,rosterCoverage='unverified',lowerBoundary='Las asociaciones departamentales y su clasificación inicial no se simulan.'))
 output['sources'].append(dict(url=url,title='Bolivia 2025 · Copa Simón Bolívar',author='Tim Venables · RSSSF',kind='historical-national-phase-membership-and-format',season='2025',retrievedAt=dt.datetime.fromtimestamp(path.stat().st_mtime,dt.timezone.utc).isoformat()))
 output['notes'].append('Bolivia: Transfermarkt no publicó participantes de la fase nacional 2026 al consultar la fuente. Se usa un pool histórico de 24 clubes reales de RSSSF 2025, sustituyendo al ya ascendido Real Potosí por el descendido Wilstermann. No equivale a la nómina, sorteo ni clasificación departamental oficial de 2026. Sus plantillas sin verificar se completan con reservas ficticias explícitas. El formato respeta seis grupos de cuatro, dieciséis clasificados (dos por grupo y cuatro terceros), eliminatorias dobles, ascenso del campeón y promoción del subcampeón.')

if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--cache',type=Path,default=Path('/tmp/fm27-pyramids'));p.add_argument('--output',type=Path,default=ROOT/'data/world/pyramids.json');build(p.parse_args())
