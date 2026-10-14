#!/usr/bin/env python3
"""Build the five complete European leagues from public Transfermarkt pages.

Only normally accessible HTTPS pages are requested. A supplied Transfermarkt CSV
archive complements biographies and individually dated valuations; its historical
current_club_id column is never used as proof of season membership. The generated
file is embedded at build time, so the game makes no runtime network requests.
Requires Python 3 and lxml. Example:
  python tools/build_europe.py --archive /path/archive.zip --cache /tmp/tm-europe
"""
import argparse
import collections
import concurrent.futures
import csv
import datetime as dt
import io
import json
import math
import re
import time
import urllib.request
import zipfile
from pathlib import Path
from lxml import html

LEAGUES = [
    ('GB1', 'Premier League', 'Inglaterra', 'premier-league', 20, 3),
    ('ES1', 'LaLiga', 'España', 'laliga', 20, 3),
    ('IT1', 'Serie A', 'Italia', 'serie-a', 20, 3),
    ('L1', 'Bundesliga', 'Alemania', 'bundesliga', 18, 3),
    ('FR1', 'Ligue 1', 'Francia', 'ligue-1', 18, 3),
]
HOST = 'https://www.transfermarkt.com.ar'
SEASON = '2025/26'
VALUE_CUTOFF = '2026-06-12'
ARCHIVE_SOURCE = 'https://github.com/dcaribou/transfermarkt-datasets'
RIVAL_PAIRS = [(281, 985), (11, 148), (31, 29), (631, 931), (762, 289), (1237, 873),
               (418, 131), (13, 418), (368, 150), (3368, 1049), (681, 621), (714, 131),
               (46, 5), (506, 416), (12, 398),
               (27, 16), (15, 3), (18, 3), (39, 24), (86, 41),
               (583, 244), (1082, 826), (995, 273), (667, 347), (417, 162)]
COLORS = {
    281: ('#6cabdd', '#ffffff'), 985: ('#da291c', '#fbe122'),
    11: ('#ef0107', '#ffffff'), 148: ('#132257', '#ffffff'),
    31: ('#c8102e', '#ffffff'), 631: ('#034694', '#ffffff'),
    418: ('#ffffff', '#d4af37'), 131: ('#a50044', '#004d98'),
    13: ('#cb3524', '#ffffff'), 46: ('#c8102e', '#ffffff'),
    27: ('#dc052d', '#0066b2'), 16: ('#fde100', '#111111'),
    5: ('#fb090b', '#000000'), 46: ('#0068a8', '#000000'),
    12: ('#8e1f2f', '#f0bc42'), 506: ('#000000', '#ffffff'), 24: ('#000000', '#ffffff'),
    398: ('#87d8f7', '#ffffff'), 1049: ('#8e1f2f', '#ffffff'),
    583: ('#004170', '#da291c'), 244: ('#2faee0', '#ffffff'),
}
CITIES = {
    281: 'Manchester', 985: 'Manchester', 11: 'Londres', 148: 'Londres', 631: 'Londres',
    31: 'Liverpool', 29: 'Liverpool', 873: 'Londres', 762: 'Newcastle upon Tyne',
    989: 'Bournemouth', 703: 'Nottingham', 1237: 'Brighton', 405: 'Birmingham',
    1148: 'Londres', 379: 'Londres', 289: 'Sunderland', 543: 'Wolverhampton',
    931: 'Londres', 399: 'Leeds', 1132: 'Burnley',
    418: 'Madrid', 131: 'Barcelona', 13: 'Madrid', 1050: 'Villarreal',
    681: 'San Sebastián', 150: 'Sevilla', 621: 'Bilbao', 940: 'Vigo', 12321: 'Girona',
    368: 'Sevilla', 1049: 'Valencia', 714: 'Barcelona', 1531: 'Elche', 3368: 'Valencia',
    367: 'Madrid', 331: 'Pamplona', 3709: 'Getafe', 237: 'Palma', 1108: 'Vitoria-Gasteiz',
    2497: 'Oviedo',
    46: 'Milán', 506: 'Turín', 5: 'Milán', 12: 'Roma', 800: 'Bérgamo', 6195: 'Nápoles',
    1047: 'Como', 1025: 'Bolonia', 398: 'Roma', 430: 'Florencia', 6574: 'Sassuolo',
    410: 'Udine', 130: 'Parma', 1390: 'Cagliari', 252: 'Génova', 416: 'Turín',
    1005: 'Lecce', 4172: 'Pisa', 276: 'Verona', 2239: 'Cremona',
    27: 'Múnich', 23826: 'Leipzig', 15: 'Leverkusen', 16: 'Dortmund', 79: 'Stuttgart',
    24: 'Fráncfort', 533: 'Sinsheim', 60: 'Friburgo', 82: 'Wolfsburgo', 41: 'Hamburgo',
    167: 'Augsburgo', 86: 'Bremen', 18: 'Mönchengladbach', 39: 'Maguncia', 3: 'Colonia',
    89: 'Berlín', 2036: 'Heidenheim', 35: 'Hamburgo',
    583: 'París', 244: 'Marsella', 667: 'Estrasburgo', 162: 'Mónaco', 1041: 'Lyon',
    273: 'Rennes', 1082: 'Lille', 826: 'Lens', 417: 'Niza', 415: 'Toulouse',
    10004: 'París', 1420: 'Angers', 1158: 'Lorient', 995: 'Nantes', 290: 'Auxerre',
    3911: 'Brest', 347: 'Metz', 738: 'Le Havre',
}
SHORTS = {281: 'MCI', 985: 'MUN', 11: 'ARS', 148: 'TOT', 631: 'CHE', 31: 'LIV',
          418: 'RMA', 131: 'FCB', 13: 'ATM', 27: 'BAY', 16: 'BVB', 5: 'MIL',
          46: 'INT', 506: 'JUV', 12: 'ROM', 398: 'LAZ', 583: 'PSG', 244: 'OM'}


def text(element):
    return ' '.join(element.text_content().replace('\u200b', '').split())


def date_es(value):
    m = re.search(r'(\d{2})/(\d{2})/(\d{4})', value)
    return f'{m[3]}-{m[2]}-{m[1]}' if m else None


def iso_date(value):
    return value[:10] if re.match(r'^\d{4}-\d{2}-\d{2}', value or '') else None


def money(value):
    if value.strip() in ('', '-', '—'):
        return None
    m = re.search(r'([\d.,]+)\s*(mil mill\.|mill\.|mil|m|k)?', value)
    if not m:
        return None
    number = float(m[1].replace('.', '').replace(',', '.'))
    multiplier = {'mil mill.': 1e9, 'mill.': 1e6, 'mil': 1e3, 'm': 1e6, 'k': 1e3}.get(m[2], 1)
    return round(number * multiplier)


def position(detail):
    if detail == 'Portero':
        return 'POR'
    if detail.startswith(('Defensa', 'Lateral', 'Carrilero')):
        return 'DEF'
    if detail.startswith(('Delantero', 'Extremo', 'Segundo delantero')):
        return 'DEL'
    return 'MED'


def fetch(url, path):
    if not path.exists():
        for attempt in range(3):
            try:
                with urllib.request.urlopen(url, timeout=40) as response:
                    data = response.read()
                path.write_bytes(data)
                break
            except Exception:
                if attempt == 2:
                    raise
                time.sleep(0.5 * (attempt + 1))
    data = path.read_bytes()
    document = html.fromstring(data)
    title = document.xpath('//title/text()')
    if not title or ('Transfermarkt' not in title[0]):
        raise ValueError(f'Unexpected public page at {url}')
    retrieved = dt.datetime.fromtimestamp(path.stat().st_mtime, dt.timezone.utc).isoformat()
    return document, title[0], retrieved


def league_members(config, cache):
    lid, name, country, slug, count, relegations = config
    url = f'{HOST}/{slug}/startseite/wettbewerb/{lid}/saison_id/2025'
    doc, title, retrieved = fetch(url, cache / f'{lid}-league.html')
    selected = [s.strip() for s in doc.xpath('//select//option[@selected]/text()')]
    if '25/26' not in title or '25/26' not in selected:
        raise ValueError(f'Wrong season: {title}; selected {selected}')
    clubs = []
    for row in doc.xpath('//table[contains(@class,"items")]/tbody/tr'):
        links = row.xpath('.//a[contains(@href,"/startseite/verein/")]')
        if not links:
            continue
        link = next((a for a in links if text(a)), links[0])
        cid = int(re.search(r'/verein/(\d+)', link.get('href'))[1])
        if any(c['tmId'] == cid for c in clubs):
            continue
        cname = text(link) or link.get('title') or link.xpath('.//img/@title')[0]
        clubs.append({'tmId': cid, 'nombre': cname, 'slug': link.get('href').split('/')[1],
                      'leagueId': lid, 'country': country})
    if len(clubs) != count:
        raise ValueError(f'{lid}: expected {count} clubs, found {len(clubs)}')
    league = {'id': lid, 'name': name, 'country': country, 'confederation': 'UEFA',
              'tier': 1, 'clubIds': [f'tm-{c["tmId"]}' for c in clubs], 'doubleRound': True,
              'foreignLimit': 99, 'libSlots': 0, 'sudSlots': 0,
              'relegationCount': relegations, 'sourceSeason': SEASON, 'sourceUrl': url}
    return league, clubs, {'url': url, 'kind': 'league-membership', 'season': SEASON,
                           'pageTitle': title, 'retrievedAt': retrieved}


def squad_members(club, cache):
    cid = club['tmId']
    url = f'{HOST}/{club["slug"]}/kader/verein/{cid}/saison_id/2025/plus/1'
    doc, title, retrieved = fetch(url, cache / f'squad-{cid}.html')
    if 'Plantilla detallada 25/26' not in title:
        raise ValueError(f'Wrong squad season: {title}')
    stadium = doc.xpath('//li[contains(@class,"data-header__label")][contains(text(),"Estadio:")]')
    if stadium:
        ground = stadium[0].xpath('.//a')
        capacity = re.search(r'([\d.]+)\s+Aforo', text(stadium[0]))
        if ground:
            club['stadium'] = text(ground[0])
        if capacity:
            club['capacity'] = int(capacity[1].replace('.', ''))
    table = doc.xpath('//table[contains(@class,"items")]')[0]
    headers = [text(x) for x in table.xpath('.//thead//th')]
    current = 'Club actual' in headers
    offset = 1 if current else 0
    players = []
    for row in table.xpath('./tbody/tr'):
        links = row.xpath('.//td[@class="hauptlink"]/a[contains(@href,"/profil/spieler/")]')
        if not links:
            continue
        tds = row.xpath('./td')
        link = links[0]
        pid = int(re.search(r'/spieler/(\d+)', link.get('href'))[1])
        detail = text(row.xpath('.//table[contains(@class,"inline-table")]/tr[last()]/td')[0])
        birth = date_es(text(tds[2]))
        if not birth:
            raise ValueError(f'Missing birth date for {pid} in {cid}')
        height = re.match(r'(\d),([\d]+)m', text(tds[4 + offset]))
        current_club = tds[4].xpath('.//a[contains(@href,"/verein/")]/@href') if current else []
        current_id = int(re.search(r'/verein/(\d+)', current_club[0])[1]) if current_club else cid
        players.append({'playerId': pid, 'clubId': f'tm-{cid}', 'name': text(link),
                        'dateOfBirth': birth, 'position': position(detail), 'positionDetail': detail,
                        'nationalities': tds[3].xpath('.//img/@title'),
                        'foot': text(tds[5 + offset]) if text(tds[5 + offset]) not in ('', '-') else None,
                        'heightCm': int(height[1]) * 100 + int(height[2]) if height else None,
                        'marketValueEUR': money(text(tds[-1])), 'valuationDate': None,
                        'contractEnd': None if current else date_es(text(tds[-2])),
                        'shirtNumber': int(text(tds[0])) if text(tds[0]).isdigit() else None,
                        'profileUrl': HOST + link.get('href'), 'sourceUrl': url,
                        'sourceSeason': SEASON, 'sourceType': 'direct', 'retrievedAt': retrieved,
                        '_joined': date_es(text(tds[6 + offset])), '_observedClubId': current_id})
    if len({p['playerId'] for p in players}) != len(players):
        raise ValueError(f'Duplicate player in squad {cid}')
    return players, {'url': url, 'kind': 'season-squad', 'season': SEASON,
                     'pageTitle': title, 'retrievedAt': retrieved, 'participants': len(players)}


def read_archive(path, player_ids):
    profiles, clubs, values = {}, {}, {}
    if not path:
        return profiles, clubs, values
    with zipfile.ZipFile(path) as archive:
        for filename, dest, key in [('players.csv', profiles, 'player_id'), ('clubs.csv', clubs, 'club_id')]:
            with archive.open(filename) as handle:
                for row in csv.DictReader(io.TextIOWrapper(handle, encoding='utf-8')):
                    rid = int(row[key])
                    if filename == 'clubs.csv' or rid in player_ids:
                        dest[rid] = row
        with archive.open('player_valuations.csv') as handle:
            for row in csv.DictReader(io.TextIOWrapper(handle, encoding='utf-8')):
                pid = int(row['player_id'])
                if pid not in player_ids or row['date'] > VALUE_CUTOFF:
                    continue
                val = int(row['market_value_in_eur'] or 0)
                if val > 0 and (pid not in values or row['date'] > values[pid][0]):
                    values[pid] = (row['date'], val)
    return profiles, clubs, values


def select_squads(rosters, profiles):
    occurrences = collections.defaultdict(list)
    for cid, rows in rosters.items():
        for row in rows:
            occurrences[row['playerId']].append((cid, row))
    assigned = {cid: [] for cid in rosters}
    for pid, possibilities in occurrences.items():
        archived = int(profiles.get(pid, {}).get('current_club_id') or 0)
        owner, row = max(possibilities, key=lambda item: (
            item[0] == archived, item[0] == item[1]['_observedClubId'],
            item[1]['_joined'] or '', item[1]['marketValueEUR'] or 0))
        assigned[owner].append(row)
    selected = {}
    for cid, rows in assigned.items():
        rows.sort(key=lambda p: (p['marketValueEUR'] or 0, p['dateOfBirth']), reverse=True)
        chosen = []
        for pos, floor in [('POR', 2), ('DEF', 6), ('MED', 6), ('DEL', 4)]:
            chosen.extend([p for p in rows if p['position'] == pos][:floor])
        chosen_ids = {p['playerId'] for p in chosen}
        chosen.extend(p for p in rows if p['playerId'] not in chosen_ids)
        selected[cid] = chosen[:32]
        if len(selected[cid]) < 18 or sum(p['position'] == 'POR' for p in selected[cid]) < 2:
            raise ValueError(f'Insufficient uniquely assigned real squad {cid}: '
                             f'{len(selected[cid])} players, '
                             f'{sum(p["position"] == "POR" for p in selected[cid])} keepers')
    return selected


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--archive', type=Path)
    parser.add_argument('--cache', type=Path, default=Path('/tmp/fm27-world/europe-cache'))
    parser.add_argument('--output', type=Path, default=Path('data/world/europe.json'))
    parser.add_argument('--workers', type=int, default=3)
    args = parser.parse_args()
    args.cache.mkdir(parents=True, exist_ok=True)
    leagues, raw_clubs, sources = [], [], []
    with concurrent.futures.ThreadPoolExecutor(max_workers=min(args.workers, 3)) as pool:
        for league, clubs, source in pool.map(lambda cfg: league_members(cfg, args.cache), LEAGUES):
            leagues.append(league); raw_clubs.extend(clubs); sources.append(source)
            print(f'Membership {league["id"]}: {len(clubs)} clubs verified', flush=True)
    rosters = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=min(args.workers, 3)) as pool:
        for club, result in zip(raw_clubs, pool.map(lambda c: squad_members(c, args.cache), raw_clubs)):
            rows, source = result
            rosters[club['tmId']] = rows; sources.append(source)
            print(f'Squad {club["nombre"]}: {len(rows)} season participants', flush=True)
    profiles, archived_clubs, values = read_archive(args.archive, {p['playerId'] for rows in rosters.values() for p in rows})
    for rows in rosters.values():
        for p in rows:
            pid = p['playerId']; archived = profiles.get(pid, {})
            if pid in values:
                p['valuationDate'], p['marketValueEUR'] = values[pid]
                p['valuationSourceUrl'] = ARCHIVE_SOURCE
            if archived.get('contract_expiration_date'):
                p['contractEnd'] = iso_date(archived['contract_expiration_date'])
                p['contractSourceUrl'] = ARCHIVE_SOURCE
    selected = select_squads(rosters, profiles)
    clubs, players, reserves = [], [], []
    palette = ['#2453b4', '#c52e42', '#176b4a', '#7651aa', '#d6a53b', '#329caf']
    ids = {c['tmId'] for c in raw_clubs}
    for raw in raw_clubs:
        cid = raw['tmId']; squad = selected[cid]; info = archived_clubs.get(cid, {})
        total = sum(p['marketValueEUR'] or 500000 for p in squad)
        rating = max(57, min(90, round(36 + 9 * math.log10(max(1, total / 1000)))))
        rival = next((b if a == cid else a for a, b in RIVAL_PAIRS if cid in (a, b) and a in ids and b in ids), None)
        main_color, secondary = COLORS.get(cid, (palette[cid % len(palette)], '#f8fafc'))
        source = next(s for s in sources if s['kind'] == 'season-squad' and f'/verein/{cid}/' in s['url'])
        club = {'id': f'tm-{cid}', 'nombre': raw['nombre'], 'tmId': cid,
                'leagueId': raw['leagueId'], 'country': raw['country'],
                'rival': f'tm-{rival}' if rival else None, 'rating': rating,
                'short': SHORTS.get(cid, ''.join(w[0] for w in raw['nombre'].split()[:3]).upper()),
                'color': main_color, 'secondary': secondary,
                'stadium': raw.get('stadium') or info.get('stadium_name') or f'Estadio de {raw["nombre"]}',
                'city': CITIES[cid], 'capacity': raw.get('capacity') or int(info.get('stadium_seats') or 25000),
                'budget': round(max(3e6, total * 0.18 * 1.1)),
                'wageBudget': round(max(350000, total * 0.0035 * 1.1)),
                'reputation': max(40, min(95, rating + 2)), 'sourceUrl': source['url']}
        clubs.append(club)
        for p in squad:
            p['joinedDate'] = p.pop('_joined', None); p.pop('_observedClubId', None)
            players.append(p)
        selected_ids = {p['playerId'] for p in squad}
        for p in rosters[cid]:
            if p['playerId'] not in selected_ids:
                p['joinedDate'] = p.pop('_joined', None); p.pop('_observedClubId', None)
                reserves.append(p)
    notes = [
        'Membresías completas 2025/26: Premier League 20, LaLiga 20, Serie A 20, Bundesliga 18 y Ligue 1 18, verificadas en sus páginas de competición.',
        'Planteles seleccionados de participantes reales de la temporada 2025/26 publicados en vistas detalladas de Transfermarkt; no se presentan como nóminas vigentes en octubre de 2026. Máximo 32 jugadores jugables por club y una sola afiliación por identidad en esta base.',
        'Tasaciones con fecha individual proceden de player_valuations.csv del archivo Transfermarkt, último valor positivo hasta 2026-06-12. Los valores observados sólo en la tabla histórica conservan valuationDate=null; la fecha de recuperación no se usa como fecha de tasación.',
        'Los contratos son referencias publicadas en el archivo complementario, no condiciones financieras de la carrera. Presupuestos, salarios, reputaciones y atributos deportivos son estimaciones del simulador.',
        'Las competiciones europeas usan cupo extranjero abierto dentro de la simulación; las reglas de inscripción regionales y de formación local no se representan.',
        'reserves conserva candidatos adicionales verificados por club para resolver afiliaciones duplicadas al combinar las bases. Sus apariciones en planteles históricos de más de un club reflejan transferencias reales, no identidades distintas.',
    ]
    result = {'leagues': leagues, 'clubs': clubs, 'players': players, 'reserves': reserves,
              'sources': sources, 'notes': notes}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'Wrote {args.output}: {len(clubs)} clubs, {len(players)} players, '
          f'{sum(p["valuationDate"] is not None for p in players)} dated valuations', flush=True)


if __name__ == '__main__':
    main()
