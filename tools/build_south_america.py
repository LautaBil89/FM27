#!/usr/bin/env python3
"""Import public, season-labelled Transfermarkt South American league pages.

The HTML cache stays outside the repository. No requests occur in the game.
Usage: python tools/build_south_america.py [--cache PATH] [--output PATH]
Requires lxml. League membership and player identities are observed facts;
club finances, strengths and display colours are simulation parameters.
"""
import argparse
import concurrent.futures
import datetime as dt
import json
import math
import re
import time
import urllib.error
import urllib.request
from pathlib import Path

from lxml import html

ROOT = Path(__file__).resolve().parents[1]
SPECS = [
    ('BRA1', 'Campeonato Brasileiro Série A', 'Brasil', 'BRA1', 20, 6, 6, 9),
    ('URU1', 'Primera División de Uruguay', 'Uruguay', 'URU1', 16, 4, 4, 6),
    ('CHI1', 'Liga de Primera de Chile', 'Chile', 'CLPD', 16, 4, 4, 6),
    ('PAR1', 'Primera División de Paraguay', 'Paraguay', 'PR1C', 12, 4, 4, 6),
    ('BOL1', 'División Profesional de Bolivia', 'Bolivia', 'BO1A', 16, 4, 4, 6),
    ('ECU1', 'LigaPro Serie A', 'Ecuador', 'EC1N', 16, 4, 4, 6),
    ('PER1', 'Liga 1 de Perú', 'Perú', 'TDeA', 18, 4, 4, 6),
    ('COL1', 'Primera A de Colombia', 'Colombia', 'COL1', 20, 4, 4, 6),
    ('VEN1', 'Liga FUTVE', 'Venezuela', 'VZ1C', 14, 4, 4, 6),
]
PALETTE = ['#1d4ed8', '#dc2626', '#059669', '#d97706', '#6d28d9', '#0891b2']
COLOURS = {614: ('#dc2626', '#111827'), 1023: ('#15803d', '#f8fafc'),
           861: ('#facc15', '#111827'), 866: ('#f8fafc', '#1d4ed8'),
           221: ('#f8fafc', '#111827'), 199: ('#f8fafc', '#111827'),
           978: ('#111827', '#f8fafc'), 330: ('#111827', '#f8fafc'),
           585: ('#f8fafc', '#dc2626'), 2462: ('#9f1239', '#15803d'),
           210: ('#38bdf8', '#111827'), 6600: ('#dc2626', '#f8fafc'),
           1214: ('#dc2626', '#1d4ed8'), 629: ('#f8fafc', '#111827'),
           2433: ('#f8fafc', '#111827')}
RIVAL_PAIRS = [(614, 2462), (199, 1023), (210, 6600), (978, 537),
               (776, 679), (861, 866), (1306, 2619), (2433, 1037),
               (1214, 629), (6878, 5570), (8056, 6985),
               (184, 6593), (2729, 2734), (8172, 10093), (2352, 9961),
               (2350, 11648), (4561, 3523), (9855, 6362),
               (17426, 19104), (531, 13297)]
# These are publicly listed affiliated youth squads, used only where a first
# team season page lacks two named keepers. Their source remains explicit.
YOUTH_SUPPLEMENTS = {87068: [(105657, 'Libertad FC Sub-20')]}
HISTORICAL_SUPPLEMENTS = {20590: (2024, {567016})}


def content(node):
    return ' '.join(node.text_content().split())


def iso(value):
    match = re.search(r'(\d{2})/(\d{2})/(\d{4})', value)
    return f'{match[3]}-{match[2]}-{match[1]}' if match else None


def euro(value):
    if value.strip() in ('-', '', '?'):
        return None
    match = re.search(r'([\d.,]+)\s*(mill\.|mil)?', value)
    if not match:
        return None
    multiplier = {'mill.': 1_000_000, 'mil': 1000}.get(match[2], 1)
    return round(float(match[1].replace('.', '').replace(',', '.')) * multiplier)


def coarse(value):
    if value == 'Portero':
        return 'POR'
    if any(word in value.lower() for word in ('defensa', 'lateral', 'carrilero')):
        return 'DEF'
    if any(word in value.lower() for word in ('extremo', 'delantero', 'punta')):
        return 'DEL'
    return 'MED'


def fetch(url, filename, cache):
    target = cache / filename
    if target.exists():
        return target.read_bytes()
    for attempt in range(2):
        try:
            with urllib.request.urlopen(url, timeout=40) as response:
                data = response.read()
            target.write_bytes(data)
            return data
        except urllib.error.HTTPError as error:
            # Respect denials. Never change identity, proxy, or access route.
            if error.code in (401, 403, 429):
                raise
            if attempt:
                raise
        except (TimeoutError, urllib.error.URLError):
            if attempt:
                raise
        time.sleep(1)


def league_page(spec, cache):
    league_id, name, country, tm_code, expected, lib, sud, foreign = spec
    url = f'https://www.transfermarkt.com.ar/x/startseite/wettbewerb/{tm_code}/saison_id/2025'
    root = html.fromstring(fetch(url, f'{tm_code}-league.html', cache))
    title = root.xpath('//title/text()')[0]
    if '2026' not in title:
        raise ValueError(f'{league_id}: expected calendar 2026, received {title!r}')
    tables = root.xpath('//table[contains(@class,"items")]')
    if not tables:
        raise ValueError(f'{league_id}: no membership table')
    clubs = []
    seen = set()
    for link in tables[0].xpath('./tbody/tr/td[contains(@class,"hauptlink")]/a[contains(@href,"/startseite/verein/")]'):
        cid = int(re.search(r'/verein/(\d+)', link.get('href'))[1])
        if cid not in seen:
            seen.add(cid)
            clubs.append({'tmId': cid, 'nombre': content(link), 'leagueId': league_id,
                          'country': country, 'sourceUrl': 'https://www.transfermarkt.com.ar' + link.get('href')})
    if len(clubs) < 10:
        raise ValueError(f'{league_id}: only {len(clubs)} verified clubs')
    if len(clubs) != expected:
        print(f'NOTE {league_id}: {len(clubs)} page members, expected informal count {expected}', flush=True)
    league = dict(id=league_id, name=name, country=country, confederation='CONMEBOL', tier=1,
                  clubIds=[], doubleRound=True, foreignLimit=foreign, libSlots=lib, sudSlots=sud,
                  relegationCount=4 if league_id == 'BRA1' else 2, sourceSeason='2026', sourceUrl=url)
    source = {'url': url, 'title': title, 'season': '2026', 'type': 'league-membership',
              'retrievedAt': dt.datetime.now(dt.timezone.utc).isoformat()}
    print(f'{league_id}: verified {title}; {len(clubs)} clubs', flush=True)
    return league, clubs, source


def squad_page(club, cache, season_id=2025):
    cid = club['tmId']
    season = str(season_id + 1)
    url = f'https://www.transfermarkt.com.ar/x/kader/verein/{cid}/saison_id/{season_id}/plus/1'
    filename = f'{cid}-squad.html' if season_id == 2025 else f'{cid}-squad-{season_id}.html'
    root = html.fromstring(fetch(url, filename, cache))
    title = root.xpath('//title/text()')[0]
    if season not in title:
        raise ValueError(f'{club["nombre"]}: squad season not {season}: {title}')
    table = root.xpath('//table[contains(@class,"items")]')[0]
    headers = [content(node) for node in table.xpath('.//thead//th')]
    current_column = 'Club actual' in headers
    offset = int(current_column)
    retrieved = dt.datetime.now(dt.timezone.utc).isoformat()
    rows = []
    for row in table.xpath('./tbody/tr'):
        cells = row.xpath('./td')
        links = row.xpath('.//td[@class="hauptlink"]/a[contains(@href,"/profil/spieler/")]')
        if not links:
            continue
        link = links[0]
        player_id = int(re.search(r'/spieler/(\d+)', link.get('href'))[1])
        birth = iso(content(cells[2]))
        positions = row.xpath('.//table[contains(@class,"inline-table")]/tr[last()]/td')
        detail = content(positions[0]) if positions else ''
        nations = cells[3].xpath('.//img/@title')
        if not birth or not detail or not nations:
            continue
        height = content(cells[4 + offset])
        hm = re.search(r'(\d)[,.](\d{2})', height)
        foot = content(cells[5 + offset]).strip().capitalize()
        foot = {'Ambidiestro': 'Ambidiestro', 'Derecho': 'Derecho', 'Izquierdo': 'Izquierdo'}.get(foot)
        number = content(cells[0])
        actual = None
        if current_column:
            other = cells[4].xpath('.//a[contains(@href,"/verein/")]/@href')
            if other:
                actual = int(re.search(r'/verein/(\d+)', other[0])[1])
        rows.append(dict(playerId=player_id, name=content(link), dateOfBirth=birth,
                         position=coarse(detail), positionDetail=detail, nationalities=nations,
                         foot=foot, heightCm=int(hm[1] + hm[2]) if hm else None,
                         marketValueEUR=euro(content(cells[-1])), valuationDate=None,
                         contractEnd=None if current_column else iso(content(cells[-2])),
                         shirtNumber=int(number) if number.isdigit() else None,
                         joinedDate=iso(content(cells[6 + offset])),
                         profileUrl='https://www.transfermarkt.com.ar' + link.get('href'),
                         sourceUrl=url, sourceSeason=season, sourceType='direct', retrievedAt=retrieved,
                         _actualClub=actual))
    stadium = None
    capacity = None
    for li in root.xpath('//li[contains(@class,"data-header__label")]'):
        if 'Estadio:' in content(li):
            stadium_links = li.xpath('.//a[contains(@href,"/stadion/")]')
            if stadium_links:
                stadium = content(stadium_links[0])
            cap = re.search(r'([\d.]+)\s*Aforo', content(li))
            if cap:
                capacity = int(cap[1].replace('.', ''))
    return club, rows, stadium, capacity, {'url': url, 'title': title, 'season': season,
                                           'type': 'selected-season-participants', 'retrievedAt': retrieved}


def select(rows, used_ids, club_tm_id):
    eligible = [p for p in rows if p['playerId'] not in used_ids]
    eligible.sort(key=lambda p: (p.get('_actualClub') in (None, club_tm_id), p['marketValueEUR'] or 0), reverse=True)
    picked = []
    for position, minimum in [('POR', 2), ('DEF', 6), ('MED', 6), ('DEL', 4)]:
        group = [p for p in eligible if p['position'] == position][:minimum]
        picked.extend(group)
    ids = {p['playerId'] for p in picked}
    picked.extend(p for p in eligible if p['playerId'] not in ids)
    return picked[:32]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cache', type=Path, default=Path('/tmp/fm27-world/sa-cache'))
    parser.add_argument('--output', type=Path, default=ROOT / 'data/world/south-america.json')
    args = parser.parse_args()
    args.cache.mkdir(parents=True, exist_ok=True)
    legacy = json.loads((ROOT / 'data/world/legacy-club-ids.json').read_text())
    output = dict(leagues=[], clubs=[], players=[], reserves=[], sources=[], notes=[
        'Membresía de primeras divisiones verificada en páginas de temporada 2026. Las ligas con Apertura/Clausura se unifican en una liga de carrera simplificada.',
        'Planteles seleccionados de hasta 32 participantes reales observados en páginas de temporada 2026; no equivalen a listas oficiales de inscripción ni a una nómina vigente en una fecha exacta.',
        'Valores EUR observados en la página sin fecha individual de tasación: valuationDate permanece null. Presupuestos, salarios, reputación, fuerzas, colores secundarios y aforos sin publicación son parámetros de simulación.',
        'Los límites de extranjeros son reglas simplificadas de esta carrera y no una transcripción de todos los reglamentos nacionales.',
    ])
    club_tasks = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
        for league, clubs, source in executor.map(lambda spec: league_page(spec, args.cache), SPECS):
            output['leagues'].append(league)
            output['sources'].append(source)
            club_tasks.extend(clubs)
    used = set()
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
        for club, rows, stadium, capacity, source in executor.map(lambda task: squad_page(task, args.cache), club_tasks):
            club_id = legacy.get(str(club['tmId']), f'tm-{club["tmId"]}')
            for youth_id, youth_name in YOUTH_SUPPLEMENTS.get(club['tmId'], []):
                youth = dict(club, tmId=youth_id, nombre=youth_name)
                _, youth_rows, _, _, youth_source = squad_page(youth, args.cache)
                known = {p['playerId'] for p in rows}
                for player in youth_rows:
                    if player['playerId'] not in known:
                        player['affiliationSource'] = 'youth-team'
                        player['affiliationClubId'] = youth_id
                        rows.append(player)
                output['sources'].append(youth_source)
                output['notes'].append(f'{club["nombre"]}: se complementa la selección con jugadores reales de {youth_name}, identificados como affiliationSource=youth-team; no se afirma su inscripción en el primer equipo.')
            if club['tmId'] in HISTORICAL_SUPPLEMENTS:
                historical_season, identities = HISTORICAL_SUPPLEMENTS[club['tmId']]
                _, old_rows, _, _, old_source = squad_page(club, args.cache, historical_season)
                for player in old_rows:
                    if player['playerId'] in identities:
                        player['affiliationSource'] = 'historical-season-participant'
                        rows.append(player)
                output['sources'].append(old_source)
                output['notes'].append(f'{club["nombre"]}: arquero suplente Sebastián Guerra (TM567016), participante real publicado en 2025, complementa la selección ante la falta de segundo arquero identificado en 2026. Su afiliación histórica se conserva explícitamente; no se afirma pertenencia vigente.')
            selected = select(rows, used, club['tmId'])
            if len(selected) < 18 or sum(p['position'] == 'POR' for p in selected) < 2:
                raise ValueError(f'{club["nombre"]}: insufficient unique real identities ({len(selected)}, GK={sum(p["position"] == "POR" for p in selected)})')
            if not all(any(p['position'] == pos for p in selected) for pos in ('DEF', 'MED', 'DEL')):
                raise ValueError(f'{club["nombre"]}: missing position coverage')
            value = sum(p['marketValueEUR'] or 100_000 for p in selected)
            rating = max(48, min(85, round(55 + 8 * math.log10(max(value / len(selected), 25_000) / 50_000))))
            colour, secondary = COLOURS.get(club['tmId'], (PALETTE[club['tmId'] % len(PALETTE)], '#f8fafc'))
            world_club = dict(club, id=club_id, rival=None, rating=rating,
                              short=''.join(w[0] for w in club['nombre'].split() if w[0].isalpha())[:4].upper(),
                              color=colour, secondary=secondary, stadium=stadium,
                              city=None, capacity=capacity or 12000,
                              budget=max(500_000, round(value * .16 * 1.10)),
                              wageBudget=max(20_000, round(value * .0015 * 1.10)), reputation=rating)
            output['clubs'].append(world_club)
            next(l for l in output['leagues'] if l['id'] == club['leagueId'])['clubIds'].append(club_id)
            for p in selected:
                p.pop('_actualClub', None)
                p['clubId'] = club_id
                used.add(p['playerId'])
                output['players'].append(p)
            selected_ids = {p['playerId'] for p in selected}
            for p in rows:
                if p['playerId'] not in selected_ids:
                    p.pop('_actualClub', None)
                    p['clubId'] = club_id
                    output['reserves'].append(p)
            output['sources'].append(source)
            print(f'{club["leagueId"]} {club["nombre"]}: {len(selected)} / {len(rows)} real players', flush=True)
    by_tm = {c['tmId']: c for c in output['clubs']}
    for first, second in RIVAL_PAIRS:
        if first in by_tm and second in by_tm:
            by_tm[first]['rival'] = by_tm[second]['id']
            by_tm[second]['rival'] = by_tm[first]['id']
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(output, ensure_ascii=False, indent=2) + '\n')
    print(f'WROTE {args.output}: {len(output["leagues"])} leagues, {len(output["clubs"])} clubs, {len(output["players"])} players', flush=True)


if __name__ == '__main__':
    main()
