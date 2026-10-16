#!/usr/bin/env python3
"""Build auditable result benchmarks from public completed-match tables.

The runtime contains aggregates and the exact result sample, never bookmaker data.
Transfermarkt's season URL sometimes resolves to a different current phase: the
page title and observed dates define the sample, not the URL's season_id value.
Run: python3 tools/build_benchmarks.py --cache /tmp/fm-realism-sources/benchmarks
"""
import argparse
import concurrent.futures
import csv
import datetime as dt
import hashlib
import io
import json
import re
import urllib.request
from pathlib import Path
from lxml import html

ROOT = Path(__file__).resolve().parents[1]
SPECS = [
    ('GB1', 'football-data', 'E0', 'Premier League', 380),
    ('ES1', 'football-data', 'SP1', 'LaLiga', 380),
    ('IT1', 'football-data', 'I1', 'Serie A', 380),
    ('L1', 'football-data', 'D1', 'Bundesliga', 306),
    ('FR1', 'football-data', 'F1', 'Ligue 1', 306),
    ('ARG1', 'football-data-world', 'ARG', 'Liga Profesional Argentina', None),
    ('BRA1', 'football-data-world', 'BRA', 'Brasileirão Série A', 380),
    ('URU1', 'transfermarkt', 'URU1', 'Primera División de Uruguay', None),
    ('CHI1', 'rsssf-table', 'tablesc/chile2025.html', 'Primera División de Chile', 16),
    ('PAR1', 'rsssf-results', 'tablesp/para2025.html', 'Primera División de Paraguay', 132),
    ('BOL1', 'rsssf-results', 'tablesb/bol2025.html', 'División Profesional de Bolivia', 240),
    ('ECU1', 'rsssf-table', 'tablese/ecua2025.html', 'Serie A de Ecuador', 16),
    ('PER1', 'rsssf-results', 'tablesp/peru2025.html', 'Liga 1 de Perú', 171),
    ('COL1', 'rsssf-table', 'tablesc/col2025.html', 'Primera A de Colombia', 20),
    ('VEN1', 'rsssf-table', 'tablesv/venez2025.html', 'Primera División de Venezuela', 14),
]


def source_url(spec):
    lid, kind, code, _, _ = spec
    if kind == 'football-data':
        return f'https://www.football-data.co.uk/mmz4281/2526/{code}.csv'
    if kind == 'football-data-world':
        return f'https://www.football-data.co.uk/new/{code}.csv'
    if kind.startswith('rsssf'):
        return f'https://www.rsssf.org/{code}'
    return f'https://www.transfermarkt.com.ar/x/gesamtspielplan/wettbewerb/{code}/saison_id/2025'


def fetch(spec, cache):
    path = cache / (spec[0] + ('-rsssf' if spec[1].startswith('rsssf') else ''))
    if not path.exists():
        with urllib.request.urlopen(source_url(spec), timeout=60) as response:
            payload = response.read()
        path.write_bytes(payload)
    return path


def numeric(value):
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def csv_results(payload, kind):
    rows = csv.DictReader(io.StringIO(payload.decode('utf-8-sig')))
    matches = []
    for row in rows:
        if kind == 'football-data-world' and row.get('Season') != '2025':
            continue
        h = numeric(row.get('FTHG' if kind == 'football-data' else 'HG'))
        a = numeric(row.get('FTAG' if kind == 'football-data' else 'AG'))
        if h is None or a is None:
            continue
        try:
            date = dt.datetime.strptime(row['Date'], '%d/%m/%Y').date().isoformat()
        except ValueError:
            date = dt.datetime.strptime(row['Date'], '%d/%m/%y').date().isoformat()
        match = dict(date=date, home=row.get('HomeTeam', row.get('Home')),
                     away=row.get('AwayTeam', row.get('Away')), homeGoals=h, awayGoals=a)
        for field, keys in {'shots': ('HS', 'AS'), 'shotsOnTarget': ('HST', 'AST'),
                            'fouls': ('HF', 'AF'), 'yellowCards': ('HY', 'AY'),
                            'redCards': ('HR', 'AR')}.items():
            values = [numeric(row.get(key)) for key in keys]
            if all(v is not None for v in values):
                match[field] = values
        matches.append(match)
    return matches


def transfermarkt_results(payload, cutoff):
    doc = html.fromstring(payload)
    title = ' '.join(doc.xpath('//title/text()'))
    matches, seen, inherited_date = [], set(), None
    for row in doc.xpath('//tr[.//a[contains(@href,"/spielbericht/")]]'):
        cells = row.xpath('./td')
        if len(cells) != 7:
            continue
        text = [' '.join(' '.join(cell.itertext()).split()) for cell in cells]
        date_match = re.search(r'(\d{2}/\d{2}/\d{2,4})', text[0])
        if date_match:
            raw = date_match.group(1)
            inherited_date = dt.datetime.strptime(raw, '%d/%m/%y' if len(raw) == 8 else '%d/%m/%Y').date()
        score = re.fullmatch(r'(\d+)\s*:\s*(\d+)', text[4])
        refs = row.xpath('.//a[contains(@href,"/spielbericht/")]/@href')
        ref = re.search(r'/spielbericht/(\d+)', refs[0]).group(1) if refs else None
        if not score or not inherited_date or inherited_date > cutoff or ref in seen:
            continue
        seen.add(ref)
        matches.append(dict(date=inherited_date.isoformat(), home=text[2], away=text[6],
                            homeGoals=int(score.group(1)), awayGoals=int(score.group(2)), sourceMatchId=ref))
    return matches, title


def aggregate(matches):
    n = len(matches)
    metrics = dict(matches=n, homeGoals=sum(m['homeGoals'] for m in matches) / n,
                   awayGoals=sum(m['awayGoals'] for m in matches) / n,
                   drawRate=sum(m['homeGoals'] == m['awayGoals'] for m in matches) / n,
                   homeWinRate=sum(m['homeGoals'] > m['awayGoals'] for m in matches) / n,
                   awayWinRate=sum(m['homeGoals'] < m['awayGoals'] for m in matches) / n,
                   scorelessRate=sum(m['homeGoals'] == m['awayGoals'] == 0 for m in matches) / n)
    metrics['goalsPerMatch'] = metrics['homeGoals'] + metrics['awayGoals']
    for key in ('shots', 'shotsOnTarget', 'fouls', 'yellowCards', 'redCards'):
        available = [m[key] for m in matches if key in m]
        metrics[key] = dict(matches=len(available), home=sum(x[0] for x in available) / len(available),
                            away=sum(x[1] for x in available) / len(available)) if available else None
    return metrics


def rsssf_parse(payload, kind, expected):
    doc = html.fromstring(payload)
    text = doc.text_content()
    title = ' '.join(doc.xpath('//title/text()'))
    author_match = re.search(r'Authors?:\s*(.*?)\n', text)
    author = author_match.group(1).strip() if author_match else 'RSSSF contributors'
    months = {name: i for i, name in enumerate(('Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'), 1)}
    if kind == 'rsssf-table':
        rows = []
        pattern = r'^\s*\d+\.\s*(.*?)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*-\s*(\d+)\s+'
        for line in text.splitlines():
            match = re.match(pattern, line)
            if not match:
                continue
            team, played, wins, draws, losses, gf, ga = match.groups()
            rows.append(dict(team=team, played=int(played), wins=int(wins), draws=int(draws), losses=int(losses), goalsFor=int(gf), goalsAgainst=int(ga)))
            if len(rows) == expected:
                break
        if len(rows) != expected or sum(r['goalsFor'] for r in rows) != sum(r['goalsAgainst'] for r in rows) or any(r['played'] != r['wins']+r['draws']+r['losses'] for r in rows):
            raise ValueError(f'RSSSF {title}: first phase table does not reconcile')
        n = sum(r['played'] for r in rows) // 2
        metrics = dict(matches=n, homeGoals=None, awayGoals=None, drawRate=sum(r['draws'] for r in rows)/2/n,
                       homeWinRate=None, awayWinRate=None, scorelessRate=None,
                       goalsPerMatch=sum(r['goalsFor'] for r in rows)/n,
                       shots=None, shotsOnTarget=None, fouls=None, yellowCards=None, redCards=None)
        return [], rows, metrics, title, author
    matches, inherited_date = [], None
    for line in text.splitlines():
        date = re.search(r'\[([A-Z][a-z]{2}) (\d{1,2})\]', line)
        if date and date.group(1) in months:
            inherited_date = dt.date(2025, months[date.group(1)], int(date.group(2))).isoformat()
        match = re.match(r'^(?!\s|\[)(.+?)\s+(\d{1,2})-(\d{1,2})\s+(.+?)\s*$', line)
        if not match or inherited_date is None:
            continue
        home, h, a, away = match.groups()
        away = re.split(r'\s{2,}\[', away)[0].strip()
        matches.append(dict(date=inherited_date, home=home, away=away, homeGoals=int(h), awayGoals=int(a)))
        if len(matches) == expected:
            break
    if len(matches) != expected:
        raise ValueError(f'RSSSF {title}: expected {expected} first-phase scores, found {len(matches)}')
    return matches, [], aggregate(matches), title, author


def build_one(spec, path, cutoff):
    lid, kind, code, name, expected = spec
    payload = path.read_bytes()
    table_rows, author, provided_metrics = [], None, None
    if kind.startswith('football-data'):
        matches, title = csv_results(payload, kind), name + (' 2025/26' if kind == 'football-data' else ' 2025')
        scope = 'complete-season' if expected == len(matches) else 'source-season-records'
        caveat = ('Resultados registrados en el CSV para toda la temporada 2025/26.' if kind == 'football-data' else
                  'Resultados registrados como temporada 2025 en el CSV. La cobertura de Argentina incluye fases y eliminatorias según la fuente; no se certifica exhaustividad oficial.')
        season = '2025/26' if kind == 'football-data' else '2025'
    elif kind.startswith('rsssf'):
        matches, table_rows, provided_metrics, title, author = rsssf_parse(payload, kind, expected)
        scope, season = ('aggregate-phase-table' if table_rows else 'dated-phase-sample'), '2025'
        caveat = ('Primera tabla de la primera división publicada por RSSSF: temporada completa de Chile, fase regular de Ecuador, Apertura regular de Colombia/Venezuela. '
                  'Goles y empates se derivan de partidos jugados y balances de los clubes; no hay marcadores individuales ni reparto local/visitante. La localía del modelo es una estimación explícita.' if table_rows else
                  'Primera fase publicada de la primera división: Apertura de Paraguay/Perú y torneo regular de Bolivia. Marcadores y fechas según RSSSF; no incluye copas ni divisiones inferiores.')
    else:
        matches, title = transfermarkt_results(payload, cutoff)
        scope, season = 'dated-phase-sample', None
        caveat = ('Muestra de partidos finalizados de la fase servida por Transfermarkt. No representa necesariamente toda la temporada. '
                  'El parámetro saison_id/2025 de la URL no certifica el año: mandan el título y las fechas observadas. No contiene tarjetas, tiros ni xG.')
    matches = sorted(matches, key=lambda m: (m['date'], m['home'], m['away']))
    if kind == 'rsssf-results' and lid in ('PAR1', 'BOL1'):
        table_metrics = rsssf_parse(payload, 'rsssf-table', 12 if lid == 'PAR1' else 16)[2]
        if any(abs(provided_metrics[key] - table_metrics[key]) > 1e-10 for key in ('goalsPerMatch', 'drawRate')):
            raise ValueError(f'{lid}: individual results do not reconcile with the phase table')
    if len(matches) < 20 and not table_rows:
        raise ValueError(f'{lid}: insufficient completed result sample ({len(matches)})')
    if expected is not None and kind == 'football-data' and len(matches) != expected:
        raise ValueError(f'{lid}: expected {expected} completed games, observed {len(matches)}')
    canonical = json.dumps(table_rows or matches, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode()
    return dict(leagueId=lid, name=name, scope=scope, season=season, title=title,
                firstMatch=matches[0]['date'] if matches else None, lastMatch=matches[-1]['date'] if matches else None,
                metrics=provided_metrics or aggregate(matches), caveat=caveat,
                metricEstimates=['homeAwayGoals'] if table_rows else [],
                source=dict(provider='RSSSF' if kind.startswith('rsssf') else 'Transfermarkt' if kind == 'transfermarkt' else 'Football-Data.co.uk',
                            author=author,
                            url=source_url(spec), retrievedAt=dt.datetime.fromtimestamp(path.stat().st_mtime, dt.timezone.utc).isoformat(),
                            rawSha256=hashlib.sha256(payload).hexdigest(), sampleSha256=hashlib.sha256(canonical).hexdigest()),
                results=matches, tableRows=table_rows)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cache', type=Path, default=Path('/tmp/fm-realism-sources/benchmarks'))
    parser.add_argument('--output', type=Path, default=ROOT / 'data/world/match-benchmarks.json')
    parser.add_argument('--cutoff', type=dt.date.fromisoformat, default=dt.datetime.now(dt.timezone.utc).date())
    args = parser.parse_args()
    args.cache.mkdir(parents=True, exist_ok=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
        paths = list(pool.map(lambda spec: fetch(spec, args.cache), SPECS))
    leagues = [build_one(spec, path, args.cutoff) for spec, path in zip(SPECS, paths)]
    local_ids = ['ARG1', 'BRA1', 'URU1', 'PAR1', 'BOL1', 'PER1']
    local_rows = [row for row in leagues if row['leagueId'] in local_ids]
    local_home = sum(row['metrics']['homeGoals'] * row['metrics']['matches'] for row in local_rows)
    local_away = sum(row['metrics']['awayGoals'] * row['metrics']['matches'] for row in local_rows)
    locality_estimate = dict(homeShare=local_home/(local_home+local_away), references=local_ids,
                             method='Pooled home goals / all goals in the six dated South American result samples; borrowed, not measured for the target league.')
    for row in leagues:
        if 'homeAwayGoals' in row['metricEstimates']:
            row['homeAwayEstimate'] = locality_estimate
    result = dict(schema=1, builtAt=dt.datetime.now(dt.timezone.utc).isoformat(), cutoff=args.cutoff.isoformat(),
                  description='Empirical completed-match samples; generated fixtures, player ratings and simulated results are separate.',
                  model=dict(name='Poisson with bounded Dixon–Coles low-score correction',
                             sourceUrl='https://doi.org/10.1111/1467-9876.00065',
                             borrowedHomeShare=locality_estimate,
                             note='Implementation adapts a published family of models; parameters are fitted to these samples, not supplied by the paper.'),
                  limitations=['Phases and seasons have different coverage; phase samples are explicitly labelled.',
                               'No sampled league has empirical xG or injury observations in this dataset.',
                               'Lower divisions without their own sample borrow a labelled top-division reference; this is a simulation estimate.'],
                  leagues=leagues)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, separators=(',', ':')) + '\n')
    for league in leagues:
        print(f"{league['leagueId']}: {league['metrics']['matches']} matches, {league['firstMatch'] or league['season']}–{league['lastMatch'] or league['season']}, {league['scope']}")


if __name__ == '__main__':
    main()
