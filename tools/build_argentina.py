#!/usr/bin/env python3
"""Refresh the reviewed Argentine world chunk from public Transfermarkt pages.

Only normal HTTPS pages are fetched. Cached responses are retained outside the
repository. An optional published CSV ZIP supplies individually dated values;
its historical club assignment is never used to establish current membership.
Run: python tools/build_argentina.py --archive /path/to/archive.zip
"""
import argparse
import concurrent.futures
import csv
import datetime as dt
import io
import json
import math
import re
import time
import urllib.error
import urllib.request
import zipfile
from collections import Counter
from pathlib import Path

from lxml import html

ROOT = Path(__file__).resolve().parents[1]
DOMAIN = 'https://www.transfermarkt.com.ar'
LEAGUES = [('ARG1', 'liga-profesional', 'Liga Profesional Argentina', 1, 30),
           ('ARG2', 'primera-nacional', 'Primera Nacional', 2, 36)]
POSITIONS = {'Portero': 'POR', 'Defensa central': 'DEF', 'Lateral izquierdo': 'DEF',
             'Lateral derecho': 'DEF', 'Defensa': 'DEF', 'Pivote': 'MED',
             'Mediocentro': 'MED', 'Centrocampista': 'MED', 'Mediocentro ofensivo': 'MED', 'Interior izquierdo': 'MED',
             'Interior derecho': 'MED', 'Mediapunta': 'MED', 'Extremo izquierdo': 'DEL',
             'Extremo derecho': 'DEL', 'Delantero centro': 'DEL', 'Delantero': 'DEL', 'Segundo delantero': 'DEL'}
# Club presentation; grounds and capacities come from each squad page.
PRESENTATION = {
    189: ('Boca Juniors', 'Buenos Aires', 'BOC', '#fbbf24', '#153a82'),
    209: ('River Plate', 'Buenos Aires', 'RIV', '#ef4444', '#f8fafc'),
    1418: ('Rosario Central', 'Rosario', 'CEN', '#fbbf24', '#2563eb'),
    1444: ('Racing Club', 'Avellaneda', 'RAC', '#7dd3fc', '#f8fafc'),
    288: ('Estudiantes de La Plata', 'La Plata', 'EST', '#ef4444', '#f8fafc'),
    12179: ('Independiente Rivadavia', 'Mendoza', 'IRV', '#1e3a8a', '#f8fafc'),
    1775: ('San Lorenzo', 'Buenos Aires', 'SLO', '#2563eb', '#dc2626'),
    1029: ('Vélez Sarsfield', 'Buenos Aires', 'VEL', '#f8fafc', '#2563eb'),
    11831: ('Tigre', 'Victoria', 'TIG', '#2563eb', '#dc2626'),
    3938: ('Talleres', 'Córdoba', 'TAL', '#f8fafc', '#1e3a8a'),
    333: ('Lanús', 'Lanús', 'LAN', '#9f1239', '#f8fafc'),
    1030: ('Argentinos Juniors', 'Buenos Aires', 'ARG', '#ef4444', '#f8fafc'),
    1286: ("Newell's Old Boys", 'Rosario', 'NOB', '#dc2626', '#111827'),
    928: ('Platense', 'Vicente López', 'PLA', '#9a6534', '#f8fafc'),
    1234: ('Independiente', 'Avellaneda', 'IND', '#dc2626', '#f8fafc'),
    2402: ('Defensa y Justicia', 'Florencio Varela', 'DYJ', '#facc15', '#16a34a'),
    1106: ('Gimnasia y Esgrima La Plata', 'La Plata', 'GEL', '#f8fafc', '#1e3a8a'),
    2417: ('Belgrano', 'Córdoba', 'BEL', '#38bdf8', '#1e3a8a'),
    2063: ('Huracán', 'Buenos Aires', 'HUR', '#f8fafc', '#dc2626'),
    14687: ('Gimnasia y Esgrima Mendoza', 'Mendoza', 'GME', '#f8fafc', '#111827'),
    25184: ('Barracas Central', 'Buenos Aires', 'BAR', '#ef4444', '#f8fafc'),
    1829: ('Instituto', 'Córdoba', 'INS', '#ef4444', '#f8fafc'),
    7097: ('Unión de Santa Fe', 'Santa Fe', 'UNI', '#ef4444', '#f8fafc'),
    14554: ('Atlético Tucumán', 'San Miguel de Tucumán', 'ATU', '#7dd3fc', '#f8fafc'),
    12454: ('Sarmiento de Junín', 'Junín', 'SAR', '#16a34a', '#f8fafc'),
    830: ('Banfield', 'Banfield', 'BAN', '#16a34a', '#f8fafc'),
    19775: ('Deportivo Riestra', 'Buenos Aires', 'RIE', '#111827', '#f8fafc'),
    31284: ('Central Córdoba', 'Santiago del Estero', 'CCO', '#111827', '#f8fafc'),
    12301: ('Aldosivi', 'Mar del Plata', 'ALD', '#16a34a', '#facc15'),
    14602: ('Estudiantes de Río Cuarto', 'Río Cuarto', 'ERC', '#38bdf8', '#f8fafc'),
    12574: ('Godoy Cruz', 'Mendoza', 'GOD', '#2563eb', '#f8fafc'),
    1070: ('Colón', 'Santa Fe', 'COL', '#dc2626', '#111827'),
    8057: ('Atlanta', 'Buenos Aires', 'ATL', '#2563eb', '#facc15'),
    2154: ('Chacarita Juniors', 'San Martín', 'CHA', '#dc2626', '#111827'),
    10534: ('Nueva Chicago', 'Buenos Aires', 'NCH', '#16a34a', '#111827'),
    14318: ('Deportivo Madryn', 'Puerto Madryn', 'MAD', '#facc15', '#111827'),
    10511: ('San Martín de San Juan', 'San Juan', 'SSJ', '#16a34a', '#111827'),
    4557: ('Ferro Carril Oeste', 'Buenos Aires', 'FER', '#16a34a', '#f8fafc'),
    12709: ('San Martín de Tucumán', 'San Miguel de Tucumán', 'SMT', '#dc2626', '#f8fafc'),
    12458: ('Deportivo Morón', 'Morón', 'MOR', '#f8fafc', '#dc2626'),
    19806: ('Patronato', 'Paraná', 'PAT', '#dc2626', '#111827'),
    14542: ('Temperley', 'Temperley', 'TEM', '#38bdf8', '#f8fafc'),
    1771: ('Tristán Suárez', 'Tristán Suárez', 'TSU', '#2563eb', '#f8fafc'),
    38545: ('Agropecuario', 'Carlos Casares', 'AGR', '#16a34a', '#dc2626'),
    1826: ('Quilmes', 'Quilmes', 'QUI', '#f8fafc', '#1e3a8a'),
    19523: ('Deportivo Maipú', 'Maipú', 'MAI', '#dc2626', '#111827'),
    5208: ('Los Andes', 'Lomas de Zamora', 'LAN', '#dc2626', '#f8fafc'),
    10885: ('Gimnasia y Esgrima Jujuy', 'San Salvador de Jujuy', 'GJU', '#7dd3fc', '#f8fafc'),
    14312: ('Estudiantes de Buenos Aires', 'Caseros', 'EBA', '#f8fafc', '#111827'),
    10403: ('Racing de Córdoba', 'Córdoba', 'RCO', '#7dd3fc', '#f8fafc'),
    12672: ('Almirante Brown', 'Isidro Casanova', 'ALM', '#facc15', '#111827'),
    6062: ('Defensores de Belgrano', 'Buenos Aires', 'DEF', '#dc2626', '#111827'),
    12100: ('All Boys', 'Buenos Aires', 'ALL', '#f8fafc', '#111827'),
    10233: ('Atlético de Rafaela', 'Rafaela', 'RAF', '#7dd3fc', '#f8fafc'),
    14977: ('Almagro', 'José Ingenieros', 'ALM', '#2563eb', '#111827'),
    14688: ('Gimnasia y Tiro', 'Salta', 'GYT', '#7dd3fc', '#f8fafc'),
    19634: ('San Miguel', 'Los Polvorines', 'SMI', '#16a34a', '#f8fafc'),
    14670: ('Central Norte', 'Salta', 'CNO', '#111827', '#f8fafc'),
    58188: ('Güemes', 'Santiago del Estero', 'GUE', '#2563eb', '#dc2626'),
    30038: ('Mitre', 'Santiago del Estero', 'MIT', '#facc15', '#111827'),
    13339: ('Colegiales', 'Munro', 'COL', '#2563eb', '#dc2626'),
    12677: ('Acassuso', 'San Isidro', 'ACA', '#facc15', '#2563eb'),
    12681: ('Chaco For Ever', 'Resistencia', 'CFE', '#111827', '#f8fafc'),
    14686: ('Ferrocarril Midland', 'Libertad', 'MID', '#2563eb', '#f8fafc'),
    91422: ('Ciudad de Bolívar', 'San Carlos de Bolívar', 'BOL', '#38bdf8', '#f8fafc'),
    13651: ('San Telmo', 'Dock Sud', 'STE', '#38bdf8', '#1e3a8a'),
}
RIVAL_PAIRS = [(189, 209), (1444, 1234), (1775, 2063), (1286, 1418),
               (3938, 2417), (288, 1106), (333, 830), (7097, 1070),
               (12179, 14687), (14554, 12709), (14688, 14670),
               (30038, 58188), (8057, 2154), (12672, 12458),
               (14312, 14977), (12100, 10534), (5208, 14542),
               (4557, 1029), (1030, 928)]


def clean(node):
    return ' '.join(node.text_content().split())


def iso(value):
    match = re.search(r'(\d{2})/(\d{2})/(\d{4})', value)
    return f'{match[3]}-{match[2]}-{match[1]}' if match else None


def euros(value):
    match = re.search(r'([\d.,]+)\s*(mill\.|mil|m|k)?', value)
    if not match or value.strip() in ('-', ''):
        return None
    number = float(match[1].replace('.', '').replace(',', '.'))
    return round(number * (1_000_000 if match[2] in ('mill.', 'm') else 1_000 if match[2] in ('mil', 'k') else 1))


def fetch(url, path):
    if path.exists():
        return html.fromstring(path.read_bytes())
    for attempt in range(3):
        try:
            with urllib.request.urlopen(url, timeout=40) as response:
                data = response.read()
            path.write_bytes(data)
            time.sleep(.35)
            return html.fromstring(data)
        except (urllib.error.URLError, TimeoutError):
            if attempt == 2:
                raise
            time.sleep(1 + attempt)


def league_members(code, slug, cache):
    url = f'{DOMAIN}/{slug}/startseite/wettbewerb/{code}/saison_id/2025'
    document = fetch(url, cache / f'{code}.html')
    title = document.xpath('//title/text()')[0]
    selected = [s.strip() for s in document.xpath('//select//option[@selected]/text()')]
    if '2026' not in title or '2026' not in selected:
        raise ValueError(f'Unexpected league season: {code} {title} {selected}')
    table = document.xpath('//table[contains(@class,"items")]')[0]
    clubs = []
    for row in table.xpath('./tbody/tr'):
        links = row.xpath('./td[contains(@class,"hauptlink")]/a[contains(@href,"/startseite/verein/")]')
        if not links:
            continue
        link = links[0]
        tm_id = int(re.search(r'/verein/(\d+)', link.get('href'))[1])
        clubs.append({'tmId': tm_id, 'pageName': clean(link),
                      'sourceUrl': DOMAIN + link.get('href'),
                      'squadUrl': DOMAIN + link.get('href').replace('/startseite/', '/kader/') + '/plus/1',
                      'totalValueEUR': euros(clean(row.xpath('./td')[-1])), 'leagueId': code})
    return clubs, {'url': url, 'title': title, 'sourceSeason': '2026', 'type': 'league-membership'}


def squad(team, cache):
    cache_path = cache / f"squad-{team['tmId']}.html"
    document = fetch(team['squadUrl'], cache_path)
    retrieved_at = dt.datetime.fromtimestamp(cache_path.stat().st_mtime, dt.timezone.utc).isoformat()
    title = document.xpath('//title/text()')[0]
    selected = [s.strip() for s in document.xpath('//select//option[@selected]/text()')]
    if '2026' not in title or '2026' not in selected:
        raise ValueError(f"Unexpected squad season: {team['tmId']} {title} {selected}")
    table = document.xpath('//table[contains(@class,"items")]')[0]
    headers = [clean(n) for n in table.xpath('.//thead//th')]
    offset = 1 if 'Club actual' in headers else 0
    records = []
    for row in table.xpath('./tbody/tr'):
        cells = row.xpath('./td')
        links = row.xpath('.//td[@class="hauptlink"]/a[contains(@href,"/profil/spieler/")]')
        if not links:
            continue
        link = links[0]
        position = clean(row.xpath('.//table[contains(@class,"inline-table")]/tr[last()]/td')[0])
        if position not in POSITIONS:
            raise ValueError(f'Unmapped position: {position}')
        birth = iso(clean(cells[2]))
        nations = cells[3].xpath('.//img/@title')
        if not birth or not nations:
            raise ValueError(f'Missing identity fields: {team["tmId"]} {clean(link)}')
        height = re.search(r'(\d[.,]\d{2})\s*m', clean(cells[4 + offset]))
        shirt = re.fullmatch(r'\d+', clean(cells[0]))
        foot = clean(cells[5 + offset]).capitalize()
        records.append({'playerId': int(re.search(r'/spieler/(\d+)', link.get('href'))[1]),
                        'name': clean(link), 'dateOfBirth': birth, 'position': POSITIONS[position],
                        'positionDetail': position, 'nationalities': nations,
                        'foot': foot if foot in ('Derecho', 'Izquierdo', 'Ambidiestro') else None,
                        'heightCm': round(float(height[1].replace(',', '.')) * 100) if height else None,
                        'marketValueEUR': euros(clean(cells[-1])), 'valuationDate': None,
                        'valuationSourceUrl': team['squadUrl'], 'valuationSourceType': 'direct',
                        'contractEnd': None if offset else iso(clean(cells[-2])),
                        'shirtNumber': int(shirt[0]) if shirt else None,
                        'profileUrl': DOMAIN + link.get('href'), 'sourceUrl': team['squadUrl'],
                        'sourceSeason': '2026', 'sourceType': 'direct',
                        'retrievedAt': retrieved_at,
                        'joinedDate': iso(clean(cells[6 + offset])),
                        '_joined': iso(clean(cells[6 + offset])) or '', '_tmClubId': team['tmId']})
    info = ' '.join(clean(n) for n in document.xpath('//*[contains(@class,"data-header__items")]'))
    ground = re.search(r'Estadio:\s*(.*?)\s+([\d.]+)\s+Aforo', info)
    if not ground:
        raise ValueError(f'Ground absent: {team["tmId"]} {info}')
    return team, records, {'url': team['squadUrl'], 'title': title, 'sourceSeason': '2026',
                           'type': 'detailed-squad', 'rawPlayers': len(records)}, ground[1], int(ground[2].replace('.', ''))


def archive_values(path, player_ids):
    if not path:
        return {}
    latest = {}
    today = dt.date.today().isoformat()
    with zipfile.ZipFile(path) as archive:
        entry = next(n for n in archive.namelist() if n.endswith('player_valuations.csv'))
        with archive.open(entry) as raw:
            for row in csv.DictReader(io.TextIOWrapper(raw, encoding='utf-8-sig')):
                player_id = int(row['player_id'])
                value = int(row['market_value_in_eur'] or '0')
                date = row['date'][:10]
                if player_id in player_ids and value > 0 and date <= today and (player_id not in latest or date > latest[player_id][0]):
                    latest[player_id] = (date, value)
    return latest


def select(records):
    # Keep two verified goalkeepers and positional coverage before value ranking.
    ranked = sorted(records, key=lambda p: (p['marketValueEUR'] or 0, p['_joined'], -p['playerId']), reverse=True)
    selected = []
    for position, minimum in [('POR', 2), ('DEF', 4), ('MED', 4), ('DEL', 2)]:
        matching = [p for p in ranked if p['position'] == position]
        if len(matching) < minimum:
            raise ValueError(f'Insufficient {position}: {len(matching)}')
        selected.extend(matching[:minimum])
    ids = {p['playerId'] for p in selected}
    selected.extend(p for p in ranked if p['playerId'] not in ids)
    return selected[:32]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cache', type=Path, default=Path('/tmp/fm27-world/argentina'))
    parser.add_argument('--archive', type=Path)
    args = parser.parse_args()
    args.cache.mkdir(parents=True, exist_ok=True)
    legacy = json.loads((ROOT / 'data/world/legacy-club-ids.json').read_text())
    source = (ROOT / 'index.html').read_text()
    match = re.search(r'(?:let|const) CLUB_META\s*=\s*', source)
    if not match:
        raise ValueError('Existing club presentation metadata not found in index.html')
    start = match.end()
    existing_meta, _ = json.JSONDecoder().raw_decode(source[start:])
    members, leagues, sources = [], [], []
    for code, slug, name, tier, expected in LEAGUES:
        teams, reference = league_members(code, slug, args.cache)
        if len(teams) != expected:
            raise ValueError(f'{code}: expected {expected} clubs, found {len(teams)}')
        members.extend(teams)
        sources.append(reference)
        leagues.append({'id': code, 'name': name, 'country': 'Argentina', 'confederation': 'CONMEBOL',
                        'tier': tier, 'clubIds': [legacy.get(str(t['tmId']), f'tm-{t["tmId"]}') for t in teams],
                        'doubleRound': False, 'foreignLimit': 6, 'libSlots': 6 if tier == 1 else 0,
                        'sudSlots': 6 if tier == 1 else 0, 'relegationCount': 2 if tier == 1 else 4,
                        'sourceSeason': '2026', 'sourceUrl': reference['url'],
                        **({'promotionTo': 'ARG1'} if tier == 2 else {})})
    results = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
        futures = {executor.submit(squad, team, args.cache): team for team in members}
        for future in concurrent.futures.as_completed(futures):
            result = future.result()
            results.append(result)
            print(result[0]['tmId'], result[0]['pageName'], len(result[1]), Counter(p['position'] for p in result[1]), flush=True)
    # If a season page retains a transferred player, keep their latest published
    # joining date instead of creating duplicate playable identities.
    owners = {}
    for team, roster, *_ in results:
        for player in roster:
            key = (player['_joined'], player['marketValueEUR'] or 0, -team['tmId'])
            if player['playerId'] not in owners or key > owners[player['playerId']][0]:
                owners[player['playerId']] = (key, team['tmId'])
    values = archive_values(args.archive, set(owners))
    rival_ids = {}
    for a, b in RIVAL_PAIRS:
        rival_ids[a], rival_ids[b] = b, a
    clubs, players, reserves, notes = [], [], [], []
    for team, roster, reference, stadium, capacity in sorted(results, key=lambda item: (item[0]['leagueId'], item[0]['tmId'])):
        tm_id = team['tmId']
        club_id = legacy.get(str(tm_id), f'tm-{tm_id}')
        tier = 1 if team['leagueId'] == 'ARG1' else 2
        name, city, short, color, secondary = PRESENTATION[tm_id]
        total_value = team['totalValueEUR'] or sum(p['marketValueEUR'] or 0 for p in roster)
        rating = round(max(48 if tier == 2 else 59, min(68 if tier == 2 else 84, (48 if tier == 2 else 60) + 5 * math.log2(max(1, total_value / (1_000_000 if tier == 2 else 5_000_000))))))
        meta = existing_meta.get(club_id, {})
        rival = rival_ids.get(tm_id)
        clubs.append({'id': club_id, 'nombre': name, 'tmId': tm_id, 'leagueId': team['leagueId'],
                      'country': 'Argentina', 'rival': legacy.get(str(rival), f'tm-{rival}') if rival else None,
                      'rating': rating, 'short': short, 'color': color, 'secondary': secondary,
                      'stadium': stadium, 'city': city, 'capacity': capacity,
                      'budget': meta.get('budget', max(600_000, round(total_value * .12 / 100_000) * 100_000)),
                      'wageBudget': meta.get('wageBudget', max(12_000, round(total_value / 500 / 1000) * 1000)),
                      'reputation': meta.get('reputation', rating), 'sourceUrl': team['sourceUrl']})
        filtered = [p for p in roster if owners[p['playerId']][1] == tm_id]
        chosen = select(filtered)
        if len(chosen) < 18:
            raise ValueError(f'{name}: only {len(chosen)} playable identities')
        chosen_ids = {p['playerId'] for p in chosen}
        for player in roster:
            player = dict(player, clubId=club_id)
            player.pop('_tmClubId')
            player.pop('_joined')
            if player['playerId'] in values:
                date, value = values[player['playerId']]
                player['marketValueEUR'], player['valuationDate'] = value, date
                player['valuationSourceUrl'] = 'https://github.com/dcaribou/transfermarkt-datasets'
                player['valuationSourceType'] = 'archive'
            (players if player['playerId'] in chosen_ids else reserves).append(player)
        sources.append(reference)
        if len(chosen) < len(roster):
            notes.append(f'{name}: selección de {len(chosen)} identidades verificadas entre {len(roster)} participantes publicados; máximo jugable 32 y deduplicación por ficha más reciente.')
    if len(players) != len({p['playerId'] for p in players}):
        raise ValueError('Duplicate Argentine player IDs')
    notes.extend(['Membresía de Primera y Primera Nacional verificada en páginas Transfermarkt con temporada visible 2026 (saison_id/2025).',
                  'Planteles publicados consultados directamente; una página de temporada puede incluir participantes transferidos. Se conserva una sola identidad por jugador según la fecha de incorporación más reciente.',
                  'Las tasaciones con fecha individual proceden del archivo CSV publicado de Transfermarkt; las cifras de ficha directa sin fecha de tasación mantienen valuationDate=null.',
                  'Presupuestos, masa salarial, reputación y valoración deportiva son estimaciones para la simulación; no son cuentas oficiales.',
                  'Calendario y ascensos/descensos adaptados a una competición anual jugable; la membresía de clubes sí corresponde a 2026.'])
    if args.archive:
        sources.append({'url': 'https://github.com/dcaribou/transfermarkt-datasets', 'type': 'dated-player-valuations',
                        'title': 'Transfermarkt datasets · David Cariboo', 'latestMatchedValuationDate': max(v[0] for v in values.values())})
    output = {'leagues': leagues, 'clubs': clubs, 'players': players, 'reserves': reserves, 'sources': sources, 'notes': notes}
    destination = ROOT / 'data/world/argentina.json'
    destination.write_text(json.dumps(output, ensure_ascii=False, indent=2) + '\n')
    print('WRITTEN', destination, len(clubs), len(players), 'dated values', sum(bool(p['valuationDate']) for p in players), flush=True)


if __name__ == '__main__':
    main()
