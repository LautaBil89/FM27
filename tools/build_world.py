#!/usr/bin/env python3
"""Merge reviewed Transfermarkt snapshots and embed the complete world locally."""
import argparse
import collections
import json
import re
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PARTS = ('argentina', 'south-america', 'europe')
EXPECTED = {'ARG1': 30, 'ARG2': 36, 'GB1': 20, 'ES1': 20,
            'IT1': 20, 'L1': 18, 'FR1': 18}
SOUTH_AMERICA = {'ARG1', 'BRA1', 'URU1', 'CHI1', 'PAR1', 'BOL1',
                 'ECU1', 'PER1', 'COL1', 'VEN1'}


def preference(player):
    # Season pages include outgoing loans/transfers. Prefer the later documented
    # arrival, while preserving real alternatives for squads that need coverage.
    return (player.get('joinedDate') or '', player.get('sourceSeason') or '',
            player.get('contractEnd') or '', player.get('valuationDate') or '',
            player.get('marketValueEUR') or 0)


def merge():
    parts = [json.loads((ROOT / 'data/world' / (name + '.json')).read_text())
             for name in PARTS]
    leagues = [league for part in parts for league in part['leagues']]
    clubs = [club for part in parts for club in part['clubs']]
    club_map = {club['id']: club for club in clubs}
    if len(club_map) != len(clubs) or len({c['tmId'] for c in clubs}) != len(clubs):
        raise ValueError('Repeated club identities across snapshots')
    if len({league['id'] for league in leagues}) != len(leagues):
        raise ValueError('Repeated league identities')
    for league in leagues:
        members = league['clubIds']
        if len(members) != len(set(members)):
            raise ValueError('Repeated members in ' + league['id'])
        if len(members) != EXPECTED.get(league['id'], len(members)):
            raise ValueError('Incomplete league ' + league['id'])
        if league['id'] in SOUTH_AMERICA and len(members) < 10:
            raise ValueError('Fewer than ten clubs in ' + league['id'])
        for member in members:
            if member not in club_map or club_map[member]['leagueId'] != league['id']:
                raise ValueError('Inconsistent league membership: ' + member)
    if SOUTH_AMERICA - {league['id'] for league in leagues}:
        raise ValueError('A CONMEBOL country is missing')
    candidates = collections.defaultdict(dict)
    for part in parts:
        for p in part['players'] + part.get('reserves', []):
            if p['clubId'] not in club_map:
                raise ValueError('Unknown club for ' + p['name'])
            if p['position'] not in ('POR', 'DEF', 'MED', 'DEL'):
                raise ValueError('Invalid position for ' + p['name'])
            if not p.get('dateOfBirth') or not p.get('nationalities'):
                raise ValueError('Missing biography for ' + p['name'])
            if not re.search(r'/spieler/' + str(p['playerId']) + r'(?:$|[/?])', p['profileUrl']):
                raise ValueError('Wrong profile identity for ' + p['name'])
            old = candidates[p['clubId']].get(p['playerId'])
            if old is None or preference(p) > preference(old):
                candidates[p['clubId']][p['playerId']] = p
    alternatives = collections.defaultdict(list)
    for pool in candidates.values():
        for p in pool.values():
            alternatives[p['playerId']].append(p)
    assigned = {pid: max(options, key=preference)
                for pid, options in alternatives.items()}
    reassigned = []

    def roster(cid):
        return [p for p in assigned.values() if p['clubId'] == cid]

    # Resolve rare transfer overlaps without inventing players or cloning them.
    # A player can only move from a source club with enough real alternatives.
    for club in sorted(clubs, key=lambda c: len(candidates[c['id']])):
        cid = club['id']
        for position, minimum in [('POR', 2), ('DEF', 3), ('MED', 3), ('DEL', 2), (None, 18)]:
            def need():
                return len([p for p in roster(cid) if position is None or p['position'] == position]) < minimum
            while need():
                options = sorted(candidates[cid].values(), key=preference, reverse=True)
                found = False
                for p in options:
                    current = assigned[p['playerId']]
                    if current['clubId'] == cid or (position and p['position'] != position):
                        continue
                    donor = roster(current['clubId'])
                    if len(donor) <= 18:
                        continue
                    floor = {'POR': 2, 'DEF': 3, 'MED': 3, 'DEL': 2}[current['position']]
                    if sum(q['position'] == current['position'] for q in donor) <= floor:
                        continue
                    assigned[p['playerId']] = p
                    reassigned.append({'playerId': p['playerId'], 'name': p['name'],
                                       'from': current['clubId'], 'to': cid})
                    found = True
                    break
                if not found:
                    raise ValueError(f'Insufficient distinct real players at {club["nombre"]}: {position or "total"}')
    selected = []
    for club in clubs:
        pool = sorted(roster(club['id']),
                      key=lambda p: (p.get('marketValueEUR') or 0, preference(p)), reverse=True)
        chosen = []
        # Preserve a useful spread of positions even in large season rosters.
        for pos, amount in [('POR', 3), ('DEF', 8), ('MED', 8), ('DEL', 5)]:
            chosen.extend([p for p in pool if p['position'] == pos][:amount])
        used = {p['playerId'] for p in chosen}
        chosen.extend([p for p in pool if p['playerId'] not in used][:32 - len(chosen)])
        if not 18 <= len(chosen) <= 32 or sum(p['position'] == 'POR' for p in chosen) < 2:
            raise ValueError('Incomplete selected roster: ' + club['nombre'])
        selected.extend(chosen)
    assert len({p['playerId'] for p in selected}) == len(selected)
    notes = [note for part in parts for note in part.get('notes', [])]
    notes.append('Selected real season participants, with one club per Transfermarkt identity; not a live registration list.')
    sources = [source for part in parts for source in part.get('sources', [])]
    starting_cups = json.loads((ROOT / 'data/world/continental-2026.json').read_text())
    cup_members = set()
    for key, cup in starting_cups.items():
        if len(cup['teams']) != 32 or len(cup['groups']) != 8:
            raise ValueError('Incomplete continental field: ' + key)
        for cid in cup['teams']:
            if cid not in club_map:
                raise ValueError('Missing continental participant: ' + cid)
            if cid in cup_members:
                raise ValueError('Club assigned to both continental cups: ' + cid)
            cup_members.add(cid)
        sources.append({'url': cup['sourceUrl'], 'title': cup['sourceTitle'],
                        'sourceSeason': '2026', 'type': 'continental-group-membership'})
    dated = sum(bool(p.get('valuationDate')) and p.get('marketValueEUR') is not None for p in selected)
    db = {'schemaVersion': 1, 'leagues': leagues, 'clubs': clubs,
          'players': selected, 'sources': sources, 'notes': notes,
          'startingCups': starting_cups,
          'metadata': {'name': 'Transfermarkt', 'season': '2026 / 2025–26',
                       'southAmericaSeason': '2026', 'europeSeason': '2025/26',
                       'clubs': len(clubs), 'leagues': len(leagues),
                       'players': len(selected), 'datedValues': dated,
                       'retrievedAt': max(p.get('retrievedAt', '') for p in selected),
                       'eurToUsd': 1.10, 'selection': 'Verified season participants; unique curated playable identities',
                       'crossClubOverlaps': sum(len(options) > 1 for options in alternatives.values()),
                       'coverageReassignments': reassigned}}
    output = ROOT / 'data/world-database.json'
    output.write_text(json.dumps(db, ensure_ascii=False, indent=2) + '\n')
    return db


def expanded_catalog(base):
    supplement = json.loads((ROOT / 'data/world/pyramids.json').read_text())
    merged = {**base}
    for kind, key in [('leagues', 'id'), ('clubs', 'id'), ('players', 'playerId')]:
        merged[kind] = base[kind] + supplement[kind]
        if len({item[key] for item in merged[kind]}) != len(merged[kind]):
            raise ValueError('Repeated supplemental ' + kind)
    members = {c['id']: c for c in merged['clubs']}
    for league in merged['leagues']:
        if len(league['clubIds']) != len(set(league['clubIds'])):
            raise ValueError('Repeated supplemental members: ' + league['id'])
        if any(cid not in members or members[cid]['leagueId'] != league['id'] for cid in league['clubIds']):
            raise ValueError('Inconsistent supplemental membership: ' + league['id'])
    if any(p['clubId'] not in members for p in merged['players']):
        raise ValueError('Unknown supplemental player club')
    merged['sources'] = base['sources'] + supplement.get('sources', [])
    merged['notes'] = base['notes'] + supplement.get('notes', [])
    merged['metadata'] = {**base['metadata'],
        'baseCounts': {kind: len(base[kind]) for kind in ('leagues', 'clubs', 'players')},
        'supplementCounts': {kind: len(supplement[kind]) for kind in ('leagues', 'clubs', 'players')},
        **{kind: len(merged[kind]) for kind in ('leagues', 'clubs', 'players')},
        'selection': 'Historical verified identities; supplemental gaps use separately labelled fictional reserves in careers'}
    return merged


def embed(db):
    scripts = [ROOT / 'src' / name for name in
               ('world-engine.js', 'competition-formats.js', 'domestic-regulations.js', 'football-pyramid.js', 'season-calendar.js', 'world-ui.js', 'vendor/lz-string.js', 'world-storage.js',
                'club-ai.js', 'registration-rules.js', 'market-contracts.js', 'player-profile.js',
                'tactics-workbench.js', 'match-simulation.js', 'match-calibration.js', 'action-inbox.js', 'dressing-room.js', 'match-realism.js', 'negotiation-workspace.js', 'football-depth.js', 'match-centre.js', 'management-office.js', 'scouting-network.js', 'sports-medicine.js', 'development-centre.js', 'club-finances.js', 'career-integrity.js', 'viewport-workspace.js')]
    styles = [ROOT / 'src' / name for name in
              ('world-ui.css', 'player-profile.css', 'tactics-workbench.css', 'action-inbox.css', 'dressing-room.css', 'match-realism.css', 'negotiation-workspace.css', 'viewport-workspace.css', 'football-depth.css', 'match-centre.css', 'management-office.css', 'development-centre.css', 'career-integrity.css', 'football-pyramid.css', 'season-calendar.css', 'registration-rules.css', 'sports-medicine.css', 'club-finances.css', 'scouting-network.css')]
    for path in scripts + styles:
        if not path.exists():
            raise FileNotFoundError('Implementation not ready: ' + str(path))
    file = ROOT / 'index.html'
    html = file.read_text()
    html = re.sub(r'\n/\* WORLD_EXPANSION_START \*/.*?/\* WORLD_EXPANSION_END \*/\n', '', html, flags=re.S)
    html = re.sub(r'\n/\* WORLD_CSS_START \*/.*?/\* WORLD_CSS_END \*/\n', '', html, flags=re.S)
    # Narrow hooks keep legacy careers working and allow the larger universe to
    # supply indexed lookups, country-specific registration and cup tie rules.
    for binding in ('club', 'player', 'squad', 'foreigners'):
        html = html.replace('const ' + binding + '=id=>', 'let ' + binding + '=id=>', 1)
    if 'function foreignLimit(' not in html:
        marker = 'const overall=p=>'
        helpers = "function isForeign(p,id=GameState?.userClub.id){return GameState?.worldVersion&&window.WORLD_ENGINE?WORLD_ENGINE.isForeign(p,id):p.nacionalidad!=='Argentina'&&!p.registrationArgentina}\nfunction foreignLimit(id=GameState?.userClub.id){return GameState?.worldVersion&&window.WORLD_ENGINE?WORLD_ENGINE.foreignLimit(id):6}\n"
        html = html.replace(marker, helpers + marker, 1)
    for target in ('GameState.userClub.id', 'offer.toClub'):
        old = "p.nacionalidad!=='Argentina'&&!p.registrationArgentina&&foreigners(" + target + ')>=6'
        new = 'isForeign(p,' + target + ')&&foreigners(' + target + ')>=foreignLimit(' + target + ')'
        html = html.replace(old, new)
    html = html.replace("toast('El plantel ya tiene 6 extranjeros')", "toast('El plantel ya alcanzó el límite de extranjeros de su liga')")
    html = html.replace("toast('Los seis cupos de extranjeros están ocupados')", "toast('Los cupos de extranjeros de esta liga están ocupados')")
    old_match_quota = "ids.filter(id => player(id).nacionalidad !== 'Argentina' && !player(id).registrationArgentina && player(id).registered !== false).length > 6"
    new_match_quota = 'ids.filter(id => isForeign(player(id),GameState.userClub.id) && player(id).registered !== false).length > foreignLimit(GameState.userClub.id)'
    html = html.replace(old_match_quota, new_match_quota)
    html = html.replace("toast('La convocatoria supera el límite de seis extranjeros.')", "toast('La convocatoria supera el límite de extranjeros de esta liga.')")
    old_penalty = "if (currentEvent()?.type === 'LIB' && m.score[0] === m.score[1]) {"
    new_penalty = "if (GameState?.worldVersion ? WORLD_ENGINE.needsPenalties(m) : currentEvent()?.type === 'LIB' && m.score[0] === m.score[1]) {"
    html = html.replace(old_penalty, new_penalty)
    html = html.replace("const threshold = competition === 'LIB' ? 3 : 5;", "const threshold = ['LIB','SUD'].includes(competition) ? 3 : 5;")
    old_competition = "const competition = event => event ?"
    new_competition = "const competition = event => GameState?.worldVersion && window.WORLD_ENGINE ? WORLD_ENGINE.competitionLabel(event) : event ?"
    html = html.replace(old_competition, new_competition)
    old_source = "const tmProfileSource = p => {\n    const source = p.transfermarkt;"
    new_source = "const tmProfileSource = p => {\n    if(GameState?.worldVersion&&window.WORLD_UI?.profileSource)return WORLD_UI.profileSource(p);\n    const source = p.transfermarkt;"
    html = html.replace(old_source, new_source)
    old_meta = "const record = typeof CLUB_META !== 'undefined' ? CLUB_META[id] || {} : {};"
    new_meta = "const record = {...(typeof CLUB_META !== 'undefined' ? CLUB_META[id] || {} : {}),...(GameState?.worldVersion?GameState.world.clubs.find(c=>c.id===id):{})};"
    html = html.replace(old_meta, new_meta)
    html = html.replace('title="Evaluación relativa al fútbol argentino"', 'title="Evaluación estimada del jugador"')
    html = html.replace("const addMessage = (title,body,type='club') => {", "const addMessage = (title,body,type='club',options={}) => {")
    html = html.replace("GameState.inbox.unshift({id:GameState.nextMessageId++,title,body,date:GameState.today,read:false,type});", "GameState.inbox.unshift({...options,id:GameState.nextMessageId++,title,body,date:GameState.today,read:false,type});")
    html = html.replace("const wageBill = () => mine().reduce((total,p)=>total+p.salario,0);", "const wageBill = () => GameState?.worldVersion&&window.CLUB_AI?CLUB_AI.wageBill(GameState.userClub.id):mine().reduce((total,p)=>total+p.salario,0);")
    html = html.replace("const pendingCommitments=()=>GameState.offers.filter", "const pendingCommitments=()=>GameState?.worldVersion&&window.CLUB_AI?CLUB_AI.reservation(GameState.userClub.id):GameState.offers.filter")
    html = html.replace('Compromisos de fichajes pendientes:', 'Compromisos de fichajes y cuotas:')
    if 'function discretionaryFunds(' not in html:
        html = html.replace('const overall=p=>', "function discretionaryFunds(){return GameState?.worldVersion&&window.CLUB_AI?CLUB_AI.availableBudget(GameState.userClub.id):GameState.userClub.presupuesto_dolares}\nconst overall=p=>", 1)
    if 'function registrationLimit(' not in html:
        helper = "function registrationLimit(id=GameState?.userClub.id){const held=GameState?.worldVersion?(GameState.world.ai?.contracts?.loans||[]).filter(l=>l.status==='active'&&l.ownerClub===id&&isForeign(player(l.playerId),id)).length:0;return Math.max(0,foreignLimit(id)-held)}\n"
        html = html.replace('const overall=p=>', helper + 'const overall=p=>', 1)
    html = html.replace('GameState.userClub.presupuesto_dolares<cost', 'discretionaryFunds()<cost')
    html = html.replace('GameState.userClub.presupuesto_dolares-pendingCommitments()<1000000', 'discretionaryFunds()-(GameState.worldVersion?0:pendingCommitments())<1000000')
    html = html.replace('meta=CLUB_META[u.id];return', 'meta=(GameState.worldVersion?club(u.id):CLUB_META[u.id]);return')
    html = html.replace('money(u.presupuesto_dolares-pendingCommitments())', 'money(GameState.worldVersion?discretionaryFunds():u.presupuesto_dolares-pendingCommitments())')
    html = html.replace("renew=function(id){if(locked())return;const p=player(id),cost=", "renew=function(id){if(locked())return;if(GameState.worldVersion&&player(id)?.loanId)return toast('El contrato del jugador pertenece al club propietario del préstamo');const p=player(id),cost=")
    html = html.replace('el.checked&&isForeign(p,GameState.userClub.id)&&foreigners(GameState.userClub.id)>=foreignLimit(GameState.userClub.id)', 'el.checked&&isForeign(p,GameState.userClub.id)&&foreigners(GameState.userClub.id)>=registrationLimit(GameState.userClub.id)')
    if 'CLUB_AI.submitOffer(form)' not in html:
        html = html.replace('function sendOffer(form){', 'function sendOffer(form){\n    if(GameState?.worldVersion&&window.CLUB_AI)return CLUB_AI.submitOffer(form);', 1)
    html = html.replace('function resolveSale(id,accept){const offer=', 'function resolveSale(id,accept){if(GameState?.worldVersion&&window.CLUB_AI)return CLUB_AI.respondToSaleOffer(id,accept);const offer=', 1)
    html = html.replace('const views={dashboard,', "const views={player:()=>window.FM_PLAYER?FM_PLAYER.renderPage():roster(),dashboard,", 1)
    html = html.replace("const tabInfo=tabs.find(item=>item[0]===view)||tabs[0];", "const tabInfo=view==='player'?['player','squad','Ficha del jugador']:tabs.find(item=>item[0]===view)||tabs[0];")
    html = html.replace('compactMoney(mine().reduce((sum,p)=>sum+p.salario,0))', 'compactMoney(MANAGEMENT.wageBill())')
    # Metadata permits inbox actions to refer to a real entity, rather than
    # interpreting the narrative text of medical/scouting/contract messages.
    html = html.replace("GameState.scouting.reports[id].verdict}.`, 'ojeo');", "GameState.scouting.reports[id].verdict}.`, 'ojeo',{playerId:id,action:'scout'});")
    html = html.replace("renueva hasta diciembre de ${p.contract}.`, 'contratos');", "renueva hasta diciembre de ${p.contract}.`, 'contratos',{playerId:p.id,action:'contract'});")
    html = html.replace("días de baja.`, 'medico')", "días de baja.`, 'medico',{playerId:p.id,action:'medical'})")
    # Tactical settings affect player suitability, collective attack/defence,
    # movement, work rate and card risk. The exported modifiers are bounded.
    html = html.replace('return fit * roleFits(p) * fitness * moraleFactor * formFactor;', "return fit * roleFits(p) * fitness * moraleFactor * formFactor * (GameState?.worldVersion&&window.FM_TACTICS?FM_TACTICS.playerMatchFactor(p,side===m.userSide?GameState.tactics:m.aiTactics,expected):1);")
    old_position = "const fit = expected === p.posicion ? 1 : p.posicion === 'POR' ? .55 : .84;"
    new_position = "const exactSlot=GameState?.worldVersion&&window.FM_TACTICS&&side===m.userSide?FM_TACTICS.slots(t.formation)[m.lineups[side].indexOf(p.id)]:null;\n      const fit = exactSlot?.length ? .55+FM_TACTICS.positionFit(p,exactSlot)*.0045 : expected === p.posicion ? 1 : p.posicion === 'POR' ? .55 : .84;"
    html = html.replace(old_position, new_position)
    old_factors = 'return { attack, build, defense, keeper: keeper ? keeper.defensa'
    new_factors = "if(GameState?.worldVersion&&window.FM_TACTICS){const modifiers=FM_TACTICS.teamMatchModifiers(side===m.userSide?GameState.tactics:m.aiTactics);attack*=modifiers.attack;defense*=modifiers.defence;build*=modifiers.movement;}\n    return { attack, build, defense, keeper: keeper ? keeper.defensa"
    if 'attack*=modifiers.attack;' not in html:
        html = html.replace(old_factors, new_factors, 1)
    if 'FM_TACTICS.teamMatchModifiers(teamSide===m.userSide?' not in html:
        html = html.replace('work * intensity * (1.18 - p.fisico * .003)', "work * intensity * (1.18 - p.fisico * .003) * (GameState?.worldVersion&&window.FM_TACTICS?FM_TACTICS.teamMatchModifiers(teamSide===m.userSide?GameState.tactics:m.aiTactics).stamina:1)")
    old_aggression = "const aggression = (t.style === 'Garra/Huevo' ? 1.25 : 1) * (calm ? .75 : 1);"
    new_aggression = "const aggression = (t.style === 'Garra/Huevo' ? 1.25 : 1) * (calm ? .75 : 1) * (GameState?.worldVersion&&window.FM_TACTICS?FM_TACTICS.teamMatchModifiers(foulSide===m.userSide?GameState.tactics:m.aiTactics).foulRisk:1);"
    html = html.replace(old_aggression, new_aggression)
    html = html.replace('50 + (home.build - away.build) * .52 + 2.3 +', '50 + (home.build - away.build) * .52 + (m.neutral?0:2.3) +')
    html = html.replace('clamp(1.35+delta,.35,2.7)', 'clamp((g.neutral?1.225:1.35)+delta,.35,2.7)')
    html = html.replace('clamp(1.1-delta,.3,2.5)', 'clamp((g.neutral?1.225:1.1)-delta,.3,2.5)')
    html = html.replace('function scout(id){const p=', 'function scout(id){if(GameState?.worldVersion&&window.FM_DEPTH)return FM_DEPTH.scout(id);const p=')
    html = html.replace('function scoutingView(){const list=', 'function scoutingView(){if(GameState?.worldVersion&&window.FM_DEPTH)return FM_DEPTH.scouting();const list=')
    html = html.replace('if (m.minute >= 90 + m.addedTime) {\n      m.done = true;', 'if (m.minute >= 90 + m.addedTime) {\n      if(window.FM_REGULATIONS?.extend(m)){if(m.minute%5===0)saveGame(true);if(view==="match")render();return;}\n      m.done = true;')
    js = '\n'.join(path.read_text() for path in scripts)
    db = expanded_catalog(db)
    database = json.dumps(db, ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c')
    benchmarks = json.dumps(json.loads((ROOT / 'data/world/match-benchmarks.json').read_text()), ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c')
    expansion = '\n/* WORLD_EXPANSION_START */\nconst WORLD_DATABASE = ' + database + ';\nconst WORLD_MATCH_BENCHMARKS = ' + benchmarks + ';\n' + js + '\n/* WORLD_EXPANSION_END */\n'
    marker = 'restoreGame();if(GameState?.match)view="match";render();'
    if html.count(marker) != 1:
        raise ValueError('Ambiguous startup boundary')
    html = html.replace(marker, expansion + marker)
    css = '\n/* WORLD_CSS_START */\n' + '\n'.join(path.read_text() for path in styles) + '\n/* WORLD_CSS_END */\n'
    html = html.replace('</style>', css + '</style>', 1)
    # Readers must see either the previous complete game or the new one.
    # Publishing in place can serve an empty/partial document during a rebuild.
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', dir=file.parent,
                                         prefix='.fm27-build-', suffix='.html', delete=False) as output:
            temporary = Path(output.name)
            output.write(html)
        temporary.chmod(file.stat().st_mode & 0o777)
        temporary.replace(file)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--data-only', action='store_true')
    args = parser.parse_args()
    world = merge()
    if not args.data_only:
        embed(world)
    catalog = world if args.data_only else expanded_catalog(world)
    print(f'World: {len(catalog["leagues"])} competitions, {len(catalog["clubs"])} clubs, {len(catalog["players"])} unique real identities')
