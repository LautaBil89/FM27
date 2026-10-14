#!/usr/bin/env python3
"""Embed the reviewed data snapshot into the standalone HTML; no network access."""
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
data_file = root / 'data' / 'transfermarkt-2025.json'
html_file = root / 'index.html'
database = json.loads(data_file.read_text())
rows = [row for team in database['rosters'].values() for row in team] + database['market']
if len({row[0] for row in rows}) != len(rows):
    raise SystemExit('Repeated names in the playable snapshot')
references = database['playerDetails']
ids = [references[row[0]]['playerId'] for row in rows]
if len(set(ids)) != len(rows):
    raise SystemExit('Repeated Transfermarkt identities')
html = html_file.read_text()
start_marker = 'const REAL_DATABASE = '
end_marker = '\nconst CLUB_META = '
if html.count(start_marker) != 1 or html.count(end_marker) != 1:
    raise SystemExit('Database boundaries missing or ambiguous')
head, remainder = html.split(start_marker, 1)
_, tail = remainder.split(end_marker, 1)
serialized = json.dumps(database, ensure_ascii=False, indent=2).replace('<', '\\u003c')
html_file.write_text(head + start_marker + serialized + ';' + end_marker + tail)
print(f'Embedded {len(rows)} reviewed identities in index.html')
