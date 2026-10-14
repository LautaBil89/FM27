#!/usr/bin/env python3
"""Browser scenarios against the real, embedded world database.

The public match clock and event completion API run synchronously so an entire
world season can be checked without waiting for the presentation timer.
"""
from collections import Counter
from datetime import date
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

from playwright.sync_api import sync_playwright


REPO = Path(__file__).resolve().parents[1]
URL = os.environ.get('FM27_TEST_URL', 'http://127.0.0.1:8000/index.html')
KEY = 'fm27-pasion-v1'
ARTIFACTS = Path(tempfile.gettempdir()) / 'fm27-world-qa'


class WorldGameScenarios(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        ARTIFACTS.mkdir(parents=True, exist_ok=True)
        cls.legacy = subprocess.check_output(['git', 'show', '69acd7b:index.html'], cwd=REPO)
        cls.pw = sync_playwright().start()
        executable = os.environ.get('FM27_CHROMIUM') or shutil.which('chromium') or shutil.which('google-chrome')
        options = {'headless': True, 'args': ['--no-sandbox', '--disable-dev-shm-usage']}
        if executable:
            options['executable_path'] = executable
        cls.browser = cls.pw.chromium.launch(**options)

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.pw.stop()

    def setUp(self):
        self.context = self.browser.new_context(viewport={'width': 1440, 'height': 960}, accept_downloads=True)
        self.errors = []
        self.page = self.context.new_page()
        self.page.set_default_timeout(10000)
        self.page.on('pageerror', lambda error: self.errors.append(str(error)))
        self.page.on('dialog', lambda dialog: dialog.accept())
        # All player data and gameplay must work with external requests blocked.
        self.page.route('https://**/*', lambda route: route.abort())
        self.page.goto(URL, wait_until='domcontentloaded')
        self.page.wait_for_selector('#worldCareerCountry')
        self.seed()

    def seed(self):
        self.page.evaluate("""()=>{
            let seed=872341;
            Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
            window.__qaReachReady=()=>{
                if(!window.WORLD_CLOCK||GameState?.version!==3)return;
                let turns=0;
                while(!GameState.finished&&!WORLD_CLOCK.ready()){
                    WORLD_CLOCK.advance({silent:true});
                    if(++turns>1600)throw Error('Daily calendar did not reach a playable fixture');
                }
            };
        }""")

    def tearDown(self):
        if self.errors:
            self.page.screenshot(path=str(ARTIFACTS / (self._testMethodName + '.png')), full_page=True)
        self.context.close()
        self.assertEqual(self.errors, [], 'Uncaught application errors')

    def career(self, league_id='ARG1', club_id='boca'):
        country = self.page.evaluate('(id)=>WORLD_DATABASE.leagues.find(l=>l.id===id).country', league_id)
        self.page.locator('#manager').fill('DT de prueba mundial')
        self.page.locator('#worldCareerCountry').select_option(label=country)
        self.page.locator('#worldCareerLeague').select_option(league_id)
        if club_id is None:
            club_id = self.page.locator('#club option').first.get_attribute('value')
        self.page.locator('#club').select_option(club_id)
        if self.page.locator('#careerCompetitionFormat').count():
            self.page.select_option('#careerCompetitionFormat','classic')
        self.page.locator('[data-action="new"]').click()
        self.page.wait_for_function('GameState?.version===3 && !!currentEvent()')
        return self.page.evaluate('({club:GameState.userClub,league:GameState.world.userLeagueId})')

    def fresh_welcome(self):
        self.page.evaluate("""()=>{
            clearInterval(timer);timer=null;localStorage.clear();GameState=null;window.GameState=null;view='dashboard';render();
        }""")

    def nav(self, target):
        self.page.locator('aside [data-view="' + target + '"]').click()
        self.assertGreater(len(self.page.locator('#content').inner_text()), 100)

    def play_match(self, minute=None):
        self.page.evaluate('__qaReachReady()')
        self.page.evaluate('()=>{autoLineup();startMatch();clearInterval(timer);timer=null;}')
        self.assertTrue(self.page.evaluate('!!GameState.match'), self.page.locator('#toast').inner_text())
        return self.page.evaluate("""(minute)=>{
            view='dashboard';let ticks=0;
            while(!GameState.match.done && (minute===null || GameState.match.minute<minute)){
                GameState.match.paused=false;tick();if(++ticks>130)throw Error('Clock stalled');
            }
            return GameState.match;
        }""", minute)

    def test_01_real_world_coverage_and_local_registration(self):
        self.career()
        coverage = self.page.evaluate("""()=>({
            leagues:GameState.world.leagues.map(l=>({id:l.id,country:l.country,count:l.clubIds.length,confederation:l.confederation})),
            players:GameState.players.length,real:GameState.players.every(p=>p.realIdentity && p.transfermarkt?.playerId && p.fecha_nacimiento),
            unique:new Set(GameState.players.map(p=>p.transfermarkt.playerId)).size,
            squads:GameState.world.clubs.map(c=>({id:c.id,name:c.nombre,total:squad(c.id).length,
              positions:Object.fromEntries(['POR','DEF','MED','DEL'].map(pos=>[pos,squad(c.id).filter(p=>p.posicion===pos).length])),
              registeredForeign:foreigners(c.id),limit:WORLD_ENGINE.foreignLimit(c.id)})),
            references:WORLD_DATABASE.startingCups,
            cups:GameState.world.cups,
            paredes:mine().find(p=>p.transfermarkt.playerId===166237),today:GameState.today
        })""")
        counts = {l['id']: l['count'] for l in coverage['leagues']}
        self.assertEqual(counts['ARG1'], 30)
        self.assertEqual(counts['ARG2'], 36)
        self.assertEqual({k: counts[k] for k in ['GB1', 'ES1', 'IT1', 'L1', 'FR1']},
                         {'GB1': 20, 'ES1': 20, 'IT1': 20, 'L1': 18, 'FR1': 18})
        south_america = [l for l in coverage['leagues'] if l['confederation']=='CONMEBOL' and l['id']!='ARG2']
        self.assertEqual(len(south_america), 10)
        self.assertTrue(all(l['count'] >= 10 for l in south_america))
        self.assertTrue(coverage['real'])
        self.assertEqual(coverage['players'], coverage['unique'])
        for team in coverage['squads']:
            with self.subTest(club=team['name']):
                self.assertGreaterEqual(team['total'], 18)
                self.assertLessEqual(team['total'], 32)
                self.assertGreaterEqual(team['positions']['POR'], 2)
                self.assertTrue(all(team['positions'][pos] >= 2 for pos in ['DEF', 'MED', 'DEL']))
                self.assertLessEqual(team['registeredForeign'], team['limit'])
        for cup_id in ['LIB', 'SUD']:
            cup = coverage['cups'][cup_id]
            reference = coverage['references'][cup_id]
            self.assertEqual(cup['participants'], reference['teams'])
            self.assertEqual([(g['id'], g['teams']) for g in cup['groups']],
                             [(g['id'], g['teams']) for g in reference['groups']])
            self.assertEqual(len(set(cup['participants'])), 32)
            self.assertTrue(cup['realStartingGroups'])
        self.assertFalse(set(coverage['cups']['LIB']['participants']) & set(coverage['cups']['SUD']['participants']))
        self.assertIn('Paredes', coverage['paredes']['nombre'])
        birthday = date.fromisoformat(coverage['paredes']['fecha_nacimiento'])
        today = date.fromisoformat(coverage['today'])
        expected_age = today.year - birthday.year - ((today.month, today.day) < (birthday.month, birthday.day))
        self.assertEqual(coverage['paredes']['edad'], expected_age)

    def test_02_all_european_leagues_and_argentine_second_division_play(self):
        for league_id in ['GB1', 'ES1', 'IT1', 'L1', 'FR1', 'ARG2']:
            with self.subTest(league=league_id):
                self.fresh_welcome()
                career = self.career(league_id, None)
                self.assertEqual(career['league'], league_id)
                self.page.evaluate('__qaReachReady()')
                local = self.page.evaluate("""()=>({
                    country:GameState.userClub.country,id:GameState.userClub.id,club:club(GameState.userClub.id),
                    domestic:GameState.players.find(p=>p.nationalities.includes(GameState.userClub.country)),
                    argentine:GameState.players.find(p=>p.nationalities.length===1 && p.nationalities[0]==='Argentina'),
                    foreigners:foreigners(GameState.userClub.id),limit:WORLD_ENGINE.foreignLimit(),
                    quota:mine().filter(p=>p.registered!==false&&!p.nationalities.includes(GameState.userClub.country)).length,
                    label:WORLD_ENGINE.competitionLabel(currentEvent())
                })""")
                self.assertIn(self.page.evaluate('WORLD_ENGINE.userLeague().name'), local['label'])
                self.assertFalse(self.page.evaluate('(p)=>WORLD_ENGINE.isForeign(p)', local['domestic']))
                if league_id != 'ARG2':
                    self.assertTrue(self.page.evaluate('(p)=>WORLD_ENGINE.isForeign(p)', local['argentine']))
                    self.assertEqual(local['limit'], 99)
                    self.assertEqual(local['foreigners'], local['quota'])
                opponent = self.page.evaluate("""()=>{
                    const g=fixture(currentEvent()),id=g.home===GameState.userClub.id?g.away:g.home;
                    const best=squad(id).filter(p=>p.posicion!=='POR').sort((a,b)=>overall(b)-overall(a));
                    best[0].registered=false;best[1].ban=2;best[1].banCompetition=currentEvent().type;
                    return {excluded:[best[0].id,best[1].id],id};
                }""")
                match = self.play_match()
                self.assertTrue(match['done'])
                self.assertGreaterEqual(match['minute'], 90)
                self.assertEqual(len(match['lineups'][0]), 11)
                self.assertEqual(len(match['lineups'][1]), 11)
                side = 1 - match['userSide']
                self.assertFalse(set(opponent['excluded']) & set(match['lineups'][side]))
                self.assertAlmostEqual(sum(s['possession'] for s in match['stats']), 100)
                self.assertEqual(sum(match['score']), len(match['goalEvents']))
                self.page.evaluate('finishMatch()')
                self.assertGreater(self.page.evaluate('GameState.standings[GameState.userClub.id].pj'), 0)
                self.assertTrue(self.page.evaluate('!!GameState.lastMatch'))

    def test_03_continental_groups_and_two_leg_aggregate(self):
        self.career()
        self.page.evaluate("""()=>{
            while(currentEvent() && currentEvent().date<'2026-06-01'){
                __qaReachReady();
                if(!currentEvent()||currentEvent().date>='2026-06-01')break;
                const g=fixture(currentEvent());
                WORLD_ENGINE.completeOne(g?{home:g.home===GameState.userClub.id?5:0,away:g.away===GameState.userClub.id?5:0}:null);
            }
        }""")
        cups = self.page.evaluate('GameState.world.cups')
        group_results = self.page.evaluate("GameState.calendar.filter(e=>e.phase==='groups'&&e.done).flatMap(e=>e.games).map(g=>g.result)")
        self.assertEqual(len(group_results), 192)
        self.assertTrue(any(r['home']==r['away'] for r in group_results))
        self.assertTrue(all(r['pen'] is None for r in group_results), 'Drawn group games never use a shootout')
        for cup_id, cup in cups.items():
            self.assertTrue(cup['groupDone'])
            self.assertTrue(all(row['pj']==6 for table in cup['groupTables'].values() for row in table.values()))
            for table in cup['groupTables'].values():
                self.assertEqual(sum(row['gf'] for row in table.values()), sum(row['gc'] for row in table.values()))
            expected_stage = 'R16' if cup_id=='LIB' else 'PLAYOFF'
            self.assertEqual(cup['stages'][0]['key'], expected_stage)
            self.assertEqual(len(cup['stages'][0]['ties']), 8)
        playoffs = cups['SUD']['stages'][0]['ties']
        self.assertEqual(set(t['home'] for t in playoffs), set(cups['LIB']['groupThirds']))
        self.assertEqual(set(t['away'] for t in playoffs), set(cups['SUD']['groupRunners']))
        self.page.evaluate("""()=>{
            while(currentEvent()){
                __qaReachReady();
                if(!currentEvent()||(currentEvent().type==='LIB' && currentEvent().stage==='R16' && currentEvent().leg===1))break;
                const g=fixture(currentEvent());
                WORLD_ENGINE.completeOne(g?{home:g.home===GameState.userClub.id?2:0,away:g.away===GameState.userClub.id?2:0}:null);
            }
        }""")
        first = self.page.evaluate('fixture(currentEvent())')
        self.assertIsNotNone(first)
        self.assertFalse(self.page.evaluate('WORLD_ENGINE.needsPenalties({score:[0,0]})'))
        self.page.evaluate("""()=>{const g=fixture(currentEvent());WORLD_ENGINE.completeOne({home:g.home===GameState.userClub.id?2:0,away:g.away===GameState.userClub.id?2:0});}""")
        tie = self.page.evaluate('(id)=>GameState.world.cups.LIB.stages[0].ties.find(t=>t.id===id)', first['tieId'])
        self.assertIsNone(tie['winner'])
        self.assertIsNone(tie['legs'][0]['result']['pen'])
        self.page.evaluate("""()=>{
            while(currentEvent()){
                __qaReachReady();
                if(!currentEvent()||(currentEvent().type==='LIB' && currentEvent().stage==='R16' && currentEvent().leg===2))break;
                const g=fixture(currentEvent());
                WORLD_ENGINE.completeOne(g?{home:g.home===GameState.userClub.id?2:0,away:g.away===GameState.userClub.id?2:0}:null);
            }
        }""")
        check = self.page.evaluate("""()=>{
            const g=fixture(currentEvent()),userHome=g.home===GameState.userClub.id;
            return {draw:WORLD_ENGINE.needsPenalties({score:userHome?[0,2]:[2,0]}),
                    win:WORLD_ENGINE.needsPenalties({score:userHome?[0,1]:[1,0]})};
        }""")
        self.assertTrue(check['draw'], 'A tied aggregate requires penalties on the return leg')
        self.assertFalse(check['win'], 'Losing the return leg by one still wins a 2–1 aggregate')
        self.page.evaluate("""()=>{const g=fixture(currentEvent());WORLD_ENGINE.completeOne({home:g.home===GameState.userClub.id?0:1,away:g.away===GameState.userClub.id?0:1});}""")
        tie = self.page.evaluate('(id)=>GameState.world.cups.LIB.stages[0].ties.find(t=>t.id===id)', first['tieId'])
        self.assertEqual(tie['winner'], 'boca')
        self.assertEqual(sorted(tie['aggregate'].values()), [1, 2])
        self.assertIsNone(tie['legs'][1]['result']['pen'])
        self.assertEqual(tie['legs'][0]['home'], tie['legs'][1]['away'])
        self.assertEqual(tie['legs'][0]['away'], tie['legs'][1]['home'])

    def test_04_full_world_season_cups_and_argentine_promotion(self):
        self.career('ARG2', None)
        original = self.page.evaluate('({user:GameState.userClub.id,arg1:[...WORLD_ENGINE.league("ARG1").clubIds],arg2:[...WORLD_ENGINE.league("ARG2").clubIds]})')
        summary = self.page.evaluate("""()=>{
            let count=0;while(currentEvent()){
                __qaReachReady();
                if(!currentEvent())break;
                const g=fixture(currentEvent());
                WORLD_ENGINE.completeOne(g?{home:g.home===GameState.userClub.id?6:0,away:g.away===GameState.userClub.id?6:0}:null);
                if(++count>1000)throw Error('Season did not terminate');
            }
            return {finished:GameState.finished,history:GameState.history[0],
                leagues:GameState.world.leagues.map(l=>({id:l.id,clubs:l.clubIds,format:l.format,table:l.standings})),
                events:GameState.calendar.map(e=>({id:e.id,type:e.type,leagueId:e.leagueId,phase:e.phase,done:e.done,games:e.games})),
                cups:GameState.world.cups,scorers:GameState.players.filter(p=>p.goals>0).length,
                finite:GameState.players.every(p=>Number.isFinite(p.condicion_fisica)&&p.condicion_fisica>=0&&p.condicion_fisica<=100)};
        }""")
        self.assertTrue(summary['finished'])
        self.assertTrue(summary['finite'])
        self.assertGreater(summary['scorers'], 100)
        self.assertEqual(summary['history']['position'], 1)
        for league in summary['leagues']:
            with self.subTest(league=league['id']):
                expected = (len(league['clubs'])-1) * (2 if league['format']=='double' else 1)
                self.assertTrue(all(row['pj']==expected for row in league['table'].values()))
                self.assertEqual(sum(row['gf'] for row in league['table'].values()), sum(row['gc'] for row in league['table'].values()))
                matches = [g for e in summary['events'] if e.get('leagueId')==league['id'] for g in e['games']]
                pairs = Counter(tuple(sorted([g['home'], g['away']])) for g in matches)
                self.assertTrue(all(n==(2 if league['format']=='double' else 1) for n in pairs.values()))
                self.assertEqual(len(pairs), len(league['clubs'])*(len(league['clubs'])-1)//2)
        self.assertTrue(all(e['done'] and all(g['result'] is not None for g in e['games']) for e in summary['events']))
        for cup_id, cup in summary['cups'].items():
            self.assertIn(cup['winner'], [t['winner'] for t in cup['stages'][-1]['ties']])
            self.assertEqual([s['key'] for s in cup['stages']], ['PLAYOFF','R16','QF','SF','FINAL'] if cup_id=='SUD' else ['R16','QF','SF','FINAL'])
            for stage in cup['stages']:
                for tie in stage['ties']:
                    self.assertEqual(len(tie['legs']), 1 if stage['key']=='FINAL' else 2)
                    self.assertTrue(all(leg['result']['pen'] is None for leg in tie['legs'][:-1]),
                                    'An opening leg cannot settle the tie with penalties')
                    totals = {tie['home']: 0, tie['away']: 0}
                    for leg in tie['legs']:
                        totals[leg['home']] += leg['result']['home']
                        totals[leg['away']] += leg['result']['away']
                    self.assertEqual(tie['aggregate'], {'home': totals[tie['home']], 'away': totals[tie['away']]})
                    if totals[tie['home']] != totals[tie['away']]:
                        self.assertEqual(tie['winner'], max(totals, key=totals.get))
                    else:
                        self.assertIsNotNone(tie['legs'][-1]['result']['pen'])
        expected_promoted = summary['history']['worldRankings']['ARG2'][:2]
        expected_relegated = summary['history']['worldRankings']['ARG1'][-2:]
        self.page.evaluate('nextSeason()')
        next_year = self.page.evaluate("""()=>({year:GameState.year,league:GameState.world.userLeagueId,
            arg1:WORLD_ENGINE.league('ARG1').clubIds,arg2:WORLD_ENGINE.league('ARG2').clubIds,
            all:GameState.world.clubs.map(c=>({id:c.id,leagueId:c.leagueId})),
            cups:GameState.world.cups,today:GameState.today,xi:GameState.tactics.xi,
            save:WORLD_STORAGE.inspect(GameState),saved:JSON.parse(localStorage.getItem('fm27-pasion-v1')).format})""")
        self.assertEqual(next_year['year'], 2027)
        self.assertEqual(next_year['league'], 'ARG1')
        self.assertEqual(set(next_year['arg1']), (set(original['arg1'])-set(expected_relegated)) | set(expected_promoted))
        self.assertEqual(set(next_year['arg2']), (set(original['arg2'])-set(expected_promoted)) | set(expected_relegated))
        self.assertEqual(len(next_year['arg1']), 30)
        self.assertEqual(len(next_year['arg2']), 36)
        self.assertTrue(set(expected_promoted) <= {c['id'] for c in next_year['all'] if c['leagueId']=='ARG1'})
        self.assertEqual(len(set(next_year['xi'])), 11)
        for cup in next_year['cups'].values():
            self.assertEqual(len(set(cup['participants'])), 32)
            self.assertFalse(cup['realStartingGroups'])
        # Promotion connects the divisions; it does not grant a cup place.
        arg_slots = self.page.evaluate('WORLD_ENGINE.qualificationSlots(WORLD_ENGINE.league("ARG1")).lib')
        self.assertTrue(set(summary['history']['worldRankings']['ARG1'][:arg_slots]) <= set(next_year['cups']['LIB']['participants']))
        self.assertEqual(next_year['saved'], 'FM27-COMPACT')
        self.assertLess(next_year['save']['localStorageBytes'], 5*1024*1024)
        self.page.reload(wait_until='domcontentloaded')
        self.assertEqual(self.page.evaluate('GameState.world.userLeagueId'), 'ARG1')
        self.assertEqual(self.page.evaluate('GameState.year'), 2027)

    def test_05_real_world_compact_save_export_import_and_paused_resume(self):
        self.career()
        match = self.play_match(31)
        self.page.evaluate('()=>{GameState.match.paused=true;saveGame(true);}'); before = self.page.evaluate('JSON.stringify(GameState)')
        size = self.page.evaluate('WORLD_STORAGE.inspect(GameState)')
        self.assertLess(size['localStorageBytes'], 5*1024*1024)
        self.assertGreater(size['hydratedBytes'], 10*1024*1024)
        with self.page.expect_download() as event:
            self.page.evaluate('WORLD_STORAGE.exportGame()')
        download = event.value
        with tempfile.TemporaryDirectory(prefix='fm27-world-export-') as directory:
            path = Path(directory) / 'career.json';download.save_as(str(path));exported = json.loads(path.read_text())
        self.assertEqual(exported['format'], 'FM27')
        self.assertEqual(len(exported['state']['players']), 9220)
        self.page.reload(wait_until='domcontentloaded')
        self.assertEqual(json.loads(self.page.evaluate('JSON.stringify(GameState)')), json.loads(before))
        self.assertTrue(self.page.evaluate('GameState.match.paused'))
        self.assertEqual(self.page.evaluate('GameState.match.minute'), match['minute'])
        self.page.evaluate("""()=>{GameState.userClub.presupuesto_dolares-=1000;saveGame(true)}""")
        self.page.evaluate('(raw)=>WORLD_STORAGE.importState(raw,{confirm:false})', exported)
        self.assertEqual(json.loads(self.page.evaluate('JSON.stringify(GameState)')), json.loads(before))
        completed = self.page.evaluate("""()=>{
            clearInterval(timer);timer=null;view='dashboard';let ticks=0;
            while(!GameState.match.done){GameState.match.paused=false;tick();if(++ticks>110)throw Error('resume stalled')}
            return GameState.match;
        }""")
        self.assertTrue(completed['done'])
        self.assertGreater(completed['minute'], match['minute'])
        self.page.evaluate('finishMatch()')
        self.assertGreater(self.page.evaluate('GameState.standings.boca.pj'), 0)

    def test_06_previous_real_career_keeps_played_results_and_economics(self):
        old_url = URL.replace('index.html', 'legacy-world-qa.html')
        self.page.route('**/legacy-world-qa.html', lambda route: route.fulfill(content_type='text/html', body=self.legacy))
        self.page.goto(old_url, wait_until='domcontentloaded');self.seed()
        self.page.fill('#manager', 'DT carrera anterior');self.page.select_option('#club', 'boca')
        if self.page.locator("#careerCompetitionFormat").count():
            self.page.select_option("#careerCompetitionFormat", "classic")
        self.page.click('[data-action="new"]');self.page.wait_for_function('GameState?.version===2')
        self.play_match();self.page.evaluate('finishMatch()')
        self.page.evaluate("""()=>{
            MANAGEMENT.transaction(-13000,'Gasto de la carrera anterior','otros');
            GameState.tactics.formation='4-4-2';autoLineup();saveGame(true);
        }""")
        before = self.page.evaluate('JSON.stringify(GameState)')
        self.page.goto(URL, wait_until='domcontentloaded')
        self.seed()
        self.page.wait_for_selector('aside')
        self.assertEqual(self.page.evaluate('GameState.version'), 2)
        self.assertFalse(self.page.evaluate('!!GameState.worldVersion'))
        self.assertEqual(self.page.evaluate('JSON.stringify(GameState)'), before)
        self.assertEqual(self.page.evaluate('GameState.league.length'), 12)
        self.assertGreater(self.page.evaluate('GameState.standings.boca.pj'), 0)
        self.play_match();self.page.evaluate('finishMatch()')
        self.assertGreater(self.page.evaluate('GameState.standings.boca.pj'), 1)

    def test_07_mobile_navigation_cups_world_market_and_player_sources(self):
        self.page.set_viewport_size({'width': 390, 'height': 844})
        self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'), 391)
        self.career()
        for target in ['dashboard','inbox','squad','tactics','training','scouting','market','tables','finances','match']:
            with self.subTest(view=target):
                self.nav(target)
                self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'), 391)
        self.nav('tables')
        for tab in ['LIB','SUD','world']:
            self.page.locator('[data-world-tab="' + tab + '"]').click()
            self.assertGreater(len(self.page.locator('#content').inner_text()), 100)
            self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'), 391)
        self.page.locator('#worldBrowseCountry').select_option(label='España')
        self.assertEqual(self.page.locator('.world-club-card').count(), 12)
        self.page.locator('.world-club-card').first.click()
        self.assertIn('españa', self.page.locator('.world-club-profile').inner_text().casefold())
        self.page.click('[data-ws-key="tables"][data-ws-tab="1"]')
        self.page.locator('#content [data-player]:visible').first.click()
        self.assertEqual(self.page.evaluate('view'),'player')
        self.assertTrue(self.page.locator('.fp-workspace').is_visible())
        self.page.locator('[data-fp-tab="sources"]').click()
        self.assertIn('Transfermarkt', self.page.locator('.fp-tab-content').inner_text())
        self.assertTrue(self.page.locator('.fp-tab-content a[href*="transfermarkt"]').first.get_attribute('href').startswith('https://'))
        self.nav('market')
        self.page.locator('#worldMarketCountry').select_option(label='España')
        self.page.locator('#worldMarketLeague').select_option('ES1')
        self.assertEqual(self.page.locator('#content tbody tr').count(), 25)
        self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'), 391)


if __name__ == '__main__':
    unittest.main(verbosity=2)
