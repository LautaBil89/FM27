#!/usr/bin/env python3
"""Browser regression scenarios for the self-contained FM27 career simulator.

Run while index.html is served from http://127.0.0.1:8000. These scenarios use
actual DOM controls for management actions and advance the public match clock
synchronously to avoid spending wall time on the presentation timer.
"""
import copy
import json
import os
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

from playwright.sync_api import sync_playwright

URL = os.environ.get('FM27_TEST_URL', 'http://127.0.0.1:8000/index.html')
KEY = 'fm27-pasion-v1'
REPO = Path(__file__).resolve().parents[1]
LEGACY = None
ARTIFACTS = Path(os.environ.get('FM27_TEST_ARTIFACTS', str(Path(tempfile.gettempdir()) / 'fm27-test-artifacts')))


class FM27Scenarios(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        global LEGACY
        ARTIFACTS.mkdir(parents=True, exist_ok=True)
        cls.fixture_dir = tempfile.TemporaryDirectory(prefix='fm27-legacy-')
        LEGACY = Path(cls.fixture_dir.name) / 'index-v1.html'
        LEGACY.write_bytes(subprocess.check_output(['git','show','63a61de:index.html'],cwd=REPO))
        cls.pw = sync_playwright().start()
        executable = os.environ.get('FM27_CHROMIUM') or shutil.which('chromium') or shutil.which('google-chrome')
        launch_options = {'headless': True, 'args': ['--no-sandbox', '--disable-dev-shm-usage']}
        if executable:
            launch_options['executable_path'] = executable
        cls.browser = cls.pw.chromium.launch(**launch_options)

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.pw.stop()
        cls.fixture_dir.cleanup()

    def setUp(self):
        self.context = self.browser.new_context(viewport={'width': 1440, 'height': 960}, accept_downloads=True)
        self.errors = []
        self.console_errors = []
        self.page = self.context.new_page()
        self.page.set_default_timeout(8000)
        self.page.on('pageerror', lambda error: self.errors.append(str(error)))
        self.page.on('console', self._console)
        self.page.on('dialog', lambda dialog: dialog.accept())
        # CDN access is unnecessary for gameplay; the bundled CSS remains usable.
        self.page.route('https://**/*', lambda route: route.abort())
        self.page.goto(URL, wait_until='domcontentloaded')
        self.page.wait_for_selector('#manager')
        self.page.evaluate("""() => {
          let seed=872341;
          Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
        }""")

    def _console(self, message):
        if message.type != 'error':
            return
        location = message.location.get('url', '')
        if location and not location.startswith('http://127.0.0.1:'):
            return
        if 'ERR_FAILED' in message.text or 'Failed to load resource' in message.text:
            return
        self.console_errors.append(message.text)

    def tearDown(self):
        if self.errors or self.console_errors:
            self.page.screenshot(path=str(ARTIFACTS / (self._testMethodName + '.png')), full_page=True)
        self.context.close()
        self.assertEqual(self.errors, [], 'Uncaught browser errors')
        self.assertEqual(self.console_errors, [], 'Application console errors')

    def career(self, club_id='boca'):
        self.page.locator('#manager').fill('DT de prueba')
        self.page.locator('#club').select_option(club_id)
        self.page.locator('#objective').select_option(label='Clasificar a Libertadores')
        self.page.locator('[data-action="new"]').click()
        self.page.wait_for_function('!!GameState && GameState.version===2')
        return self.state()

    def state(self):
        return self.page.evaluate('GameState')

    def nav(self, target):
        self.page.locator('aside [data-view="' + target + '"]').click()
        self.assertGreater(len(self.page.locator('#content').inner_text()), 100)

    def open_offer(self, player_id, fee=None, wage=None, bonus=None):
        self.page.evaluate('(id)=>buy(id)', player_id)
        form = self.page.locator('#negotiation')
        self.assertTrue(form.is_visible())
        self.assertTrue(form.evaluate('(form)=>form.checkValidity()'), 'Suggested contract values must be valid for immediate submission')
        if fee is not None:
            form.locator('[name="fee"]').fill(str(fee))
        if wage is not None:
            form.locator('[name="wage"]').fill(str(wage))
        if bonus is not None:
            form.locator('[name="bonus"]').fill(str(bonus))
        return form

    def submit_offer(self, form):
        form.locator('[type="submit"]').click()

    def match(self):
        self.page.evaluate('startMatch()')
        state = self.state()
        self.assertIsNotNone(state['match'], self.page.locator('#toast').inner_text())
        self.assertEqual(len(state['match']['lineups'][0]), 11)
        self.assertEqual(len(state['match']['lineups'][1]), 11)
        return state['match']

    def advance_minutes(self, until=None):
        return self.page.evaluate("""(until)=>{
          view='dashboard';
          let n=0;
          while(GameState.match && !GameState.match.done &&
               (until===null || GameState.match.minute<until)){
            GameState.match.paused=false;tick();
            if(++n>110)throw Error('Match clock exceeded 110 ticks');
          }
          return GameState.match;
        }""", until)

    def play_event(self):
        self.page.evaluate("""()=>{
          if(!fixture(currentEvent())){advance();return;}
          autoLineup();startMatch();
          if(!GameState.match)throw Error(document.querySelector('#toast').textContent);
          view='dashboard';let n=0;
          while(!GameState.match.done){GameState.match.paused=false;tick();if(++n>110)throw Error('Clock stalled');}
        }""")
        match = self.state().get('match')
        if match:
            self.assert_match_stats(match)
            self.page.evaluate('finishMatch()')
        return self.state()

    def assert_match_stats(self, match):
        self.assertTrue(match['done'])
        self.assertGreaterEqual(match['minute'], 92)
        self.assertLessEqual(match['minute'], 97)
        self.assertEqual(sum(match['score']), len(match['goalEvents']))
        self.assertAlmostEqual(sum(stat['possession'] for stat in match['stats']), 100, places=6)
        self.assertGreater(sum(stat['shots'] for stat in match['stats']), 0)
        self.assertGreater(sum(stat['xg'] for stat in match['stats']), 0)
        for side, stat in enumerate(match['stats']):
            self.assertLessEqual(stat['shotsOnTarget'], stat['shots'])
            self.assertLessEqual(match['score'][side], stat['shotsOnTarget'])
            self.assertLessEqual(stat['completedPasses'], stat['passes'])
            self.assertGreaterEqual(stat['xg'], 0)
            self.assertGreater(stat['passes'], 0)
            self.assertLessEqual(stat['red'], 11)
        for rating in match['ratings'].values():
            self.assertGreaterEqual(rating, 1)
            self.assertLessEqual(rating, 10)
        self.assertLessEqual(match['substitutions'], 5)
        self.assertLessEqual(match['aiSubstitutions'], 5)
        self.assertTrue(all(w <= 3 for w in match['substitutionWindows']))
        for side in (0, 1):
            self.assertEqual(len(match['lineups'][side]), len(set(match['lineups'][side])))
        for red_id in match['red']:
            self.assertFalse(any(event['out']==red_id and event['minute'] >=
                                 next(card['minute'] for card in match['cardEvents']
                                      if card['playerId']==red_id and 'amarilla' != card['type'])
                                 for event in match['subEvents']))

    def legal_pair(self, match):
        side = match['userSide']
        state = self.state()
        by_id = {p['id']: p for p in state['players']}
        lineup = match['lineups'][side]
        candidates = [pid for pid in match['bench'][side]
                      if pid not in match['used'] and pid not in match['lineups'][0]+match['lineups'][1]
                      and by_id[pid]['injury']==0 and by_id[pid]['ban']==0]
        # Use like-for-like outfield changes, then any legal outfield replacement.
        for pid in candidates:
            if by_id[pid]['posicion']=='POR':
                continue
            out = next((old for old in lineup if old not in match['red']
                        and by_id[old]['posicion']==by_id[pid]['posicion']), None)
            if out is not None:
                return out, pid
        for pid in candidates:
            if by_id[pid]['posicion']!='POR':
                out=next((old for old in lineup if old not in match['red'] and by_id[old]['posicion']!='POR'), None)
                if out is not None:
                    return out, pid
        self.fail('No legal bench/outfield pair available for substitution constraint scenario')

    def substitute_once(self):
        match = self.state()['match']
        pair = self.legal_pair(match)
        accepted = self.page.evaluate('(ids)=>makeMatchSubstitution(...ids)', list(pair))
        return accepted, self.state()['match']

    def test_01_real_career_calendar_and_ten_screens(self):
        state = self.career()
        self.assertEqual(state['userClub']['id'], 'boca')
        self.assertEqual(len(state['league']), 12)
        self.assertEqual(len(state['calendar']), 25)
        self.assertGreaterEqual(len(state['players']), 350)
        self.assertTrue(all(p['realIdentity'] for p in state['players']))
        self.assertTrue(any('Cavani' in p['nombre'] and p['clubId']=='boca' for p in state['players']))
        self.assertTrue(any('Armani' in p['nombre'] and p['clubId']=='river' for p in state['players']))
        self.assertIn('2025', state['databaseSnapshot'])
        pairs = {}
        for event in state['calendar']:
            import datetime
            weekday = datetime.date.fromisoformat(event['date']).weekday()
            if event['type']=='LPF':
                self.assertIn(weekday, [5,6])
                self.assertEqual(len(event['games']), 6)
                self.assertEqual(len(set(x for g in event['games'] for x in (g['home'],g['away']))), 12)
                for g in event['games']:
                    pairs[(g['home'],g['away'])] = pairs.get((g['home'],g['away']),0)+1
            else:
                self.assertIn(weekday, [1,2,3])
        self.assertEqual(len(pairs), 132)
        self.assertTrue(all(count==1 for count in pairs.values()))
        expected=['dashboard','inbox','squad','tactics','training','tables','market','scouting','finances','match']
        visible=self.page.locator('aside [data-view]').evaluate_all('(els)=>els.map(el=>el.dataset.view)')
        self.assertEqual(set(visible),set(expected))
        for tab in expected:
            self.nav(tab)
        self.nav('squad')
        cavani=next(p for p in state['players'] if 'Cavani' in p['nombre'] and p['clubId']=='boca')
        self.page.locator('[data-player="'+str(cavani['id'])+'"]').first.click()
        details=self.page.locator('#details')
        self.assertTrue(details.is_visible())
        text=details.inner_text().lower()
        self.assertIn('cavani', text)
        for required in ['velocidad','remate','pase','regate','defensa','físico','contrato','potencial']:
            self.assertIn(required, text)
        self.page.locator('#details [data-action="close"]').click()
        self.page.screenshot(path=str(ARTIFACTS / 'desktop.png'), full_page=True)
        self.page.set_viewport_size({'width':390,'height':844})
        self.nav('dashboard')
        self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'), 400)
        self.page.screenshot(path=str(ARTIFACTS / 'mobile.png'), full_page=True)

    def test_02_tactics_training_scouting_and_negotiation_outcomes(self):
        state=self.career()
        self.nav('tactics')
        self.page.locator('#formation').select_option('4-4-2')
        self.page.locator('#style').select_option('Tiki-Taka')
        self.page.locator('[data-tactic="mentality"]').select_option(label='Ofensiva')
        self.page.locator('[data-tactic="tempo"]').press('ArrowRight')
        self.page.locator('[data-tactic="tempo"]').press('ArrowRight')
        tactic=self.state()['tactics']
        self.assertEqual(tactic['formation'],'4-4-2')
        self.assertEqual(tactic['style'],'Tiki-Taka')
        self.assertEqual(tactic['tempo'],70)
        self.assertEqual(tactic['mentality'],'Ofensiva')
        by_id={p['id']:p for p in state['players']}
        self.assertTrue(any(by_id[pid]['posicion']=='POR' for pid in tactic['bench']))
        self.nav('training')
        self.page.locator('[data-training="focus"]').select_option(label='Ataque')
        self.page.locator('[data-training="intensity"]').select_option(label='Normal')
        trained=self.page.locator('[data-individual]').first
        trained_id=int(trained.get_attribute('data-individual'))
        trained.select_option(label='Defensa')
        self.assertEqual(self.page.evaluate('(id)=>player(id).trainingFocus',trained_id),'Defensa')
        foreign=next(p for p in state['players'] if p['clubId']!='boca' and p['nacionalidad']=='Argentina' and p['salario']<8000)
        self.page.evaluate('(id)=>details(id)',foreign['id'])
        self.page.locator('#details [data-shortlist="'+str(foreign['id'])+'"]').click()
        if self.page.locator('#details').is_visible():
            self.page.locator('#details [data-action="close"]').click()
        self.nav('scouting')
        self.assertIn(foreign['id'],self.state()['scouting']['shortlist'])
        funds=self.state()['userClub']['presupuesto_dolares']
        self.page.locator('[data-scout="'+str(foreign['id'])+'"]').first.click()
        self.assertEqual(self.state()['userClub']['presupuesto_dolares'],funds-1500)
        self.assertIn(str(foreign['id']),self.state()['scouting']['reports'])
        # Sufficient offer: deterministic checks, but acceptance occurs only after a round.
        fee=int(self.page.evaluate('(id)=>transferCost(player(id))',foreign['id']))
        form=self.open_offer(foreign['id'],fee=fee,wage=max(100,foreign['salario']*2),bonus=0)
        funds_before=self.state()['userClub']['presupuesto_dolares']
        self.submit_offer(form)
        pending=next(o for o in self.state()['offers'] if o['playerId']==foreign['id'])
        self.assertEqual(pending['status'],'pending')
        self.assertEqual(self.state()['userClub']['presupuesto_dolares'],funds_before)
        self.assertNotEqual(self.page.evaluate('(id)=>player(id).clubId',foreign['id']),'boca')
        # Underpriced second offer must be rejected without taking a transfer payment.
        second=next(p for p in state['players'] if p['id']!=foreign['id'] and p['clubId'] not in ['boca',None]
                    and p['nacionalidad']=='Argentina' and p['salario']<8000)
        form=self.open_offer(second['id'],fee=0,wage=max(100,second['salario']*2),bonus=0)
        self.submit_offer(form)
        after=self.play_event()
        accepted=next(o for o in after['offers'] if o['playerId']==foreign['id'])
        rejected=next(o for o in after['offers'] if o['playerId']==second['id'])
        self.assertEqual(accepted['status'],'accepted')
        self.assertEqual(rejected['status'],'rejected')
        self.assertIn('precio',rejected['reason'])
        self.assertEqual(self.page.evaluate('(id)=>player(id).clubId',foreign['id']),'boca')
        spending=[e for e in after['finance']['ledger'] if e['category']=='fichajes']
        self.assertEqual(len(spending),1)
        self.assertEqual(spending[0]['amount'],-fee)
        self.assertGreater(after['training']['sessions'],0)
        self.assertIn('ataque',after['training']['lastReport'])
        self.assertGreater(self.page.evaluate('(id)=>player(id).trainingProgress',trained_id),0)
        opening=after['finance']['openingBalance']
        self.assertEqual(after['userClub']['presupuesto_dolares'],opening+sum(e['amount'] for e in after['finance']['ledger']))

    def test_03_salary_and_foreign_limits(self):
        state=self.career()
        candidate=next(p for p in state['players'] if p['clubId']!='boca' and p['nacionalidad']=='Argentina' and p['salario']<8000)
        # Explicit boundary fixture: an offer one dollar beyond remaining wage room.
        remaining=self.page.evaluate('GameState.userClub.wageBudget-MANAGEMENT.wageBill()')
        wage=int(remaining//100*100+100)
        form=self.open_offer(candidate['id'],wage=wage,bonus=0)
        self.submit_offer(form)
        self.assertEqual(len(self.state()['offers']),0)
        self.assertIn('salarial',self.page.locator('#toast').inner_text())
        self.page.locator('#details [data-action="close"]').click()
        # Install an explicit full foreign-registration boundary using real database
        # identities, restoring the normal career immediately after the check.
        snapshot=self.state()
        self.page.evaluate("""()=>{
          const owned=mine();for(const p of owned)p.registrationArgentina=true;
          const foreign=GameState.players.filter(p=>p.clubId!==GameState.userClub.id&&p.nacionalidad!=='Argentina').slice(0,6);
          for(let i=0;i<foreign.length;i++){
            owned[i].clubId=null;foreign[i].clubId=GameState.userClub.id;foreign[i].registrationArgentina=false;foreign[i].registered=true;
          }
        }""")
        self.assertEqual(self.page.evaluate('foreigners(GameState.userClub.id)'),6)
        foreign=self.page.evaluate("GameState.players.find(p=>p.clubId!==GameState.userClub.id&&p.nacionalidad!=='Argentina'&&!p.registrationArgentina)")
        form=self.open_offer(foreign['id'],fee=0,wage=100,bonus=0)
        self.submit_offer(form)
        self.assertEqual(len(self.state()['offers']),0)
        self.assertIn('extranjeros',self.page.locator('#toast').inner_text())
        self.page.locator('#details [data-action="close"]').click()
        self.page.evaluate('(state)=>{GameState=state;window.GameState=state;saveGame(true);render()}',snapshot)

    def test_04_halftime_clock_reload_statistics_and_five_substitutions(self):
        self.career()
        match=self.match()
        by_id={p['id']:p for p in self.state()['players']}
        self.assertTrue(any(by_id[pid]['posicion']=='POR' for pid in match['bench'][match['userSide']]))
        match=self.advance_minutes(45)
        self.assertEqual(match['minute'],45)
        self.assertTrue(match['paused'])
        self.assertTrue(match['halfTime'])
        self.assertFalse(match['done'])
        accepted,match=self.substitute_once()
        self.assertTrue(accepted)
        self.assertEqual(match['substitutions'],1)
        self.assertEqual(match['substitutionWindows'][match['userSide']],0)
        self.advance_minutes(46)
        for _ in range(2):
            accepted,match=self.substitute_once()
            self.assertTrue(accepted)
        self.assertEqual(match['substitutionWindows'][match['userSide']],1)
        self.advance_minutes(55)
        accepted,match=self.substitute_once()
        self.assertTrue(accepted)
        self.advance_minutes(65)
        accepted,match=self.substitute_once()
        self.assertTrue(accepted)
        self.assertEqual(match['substitutions'],5)
        self.assertEqual(match['substitutionWindows'][match['userSide']],3)
        accepted,match=self.substitute_once()
        self.assertFalse(accepted)
        self.assertEqual(match['substitutions'],5)
        self.assertEqual(match['substitutionWindows'][match['userSide']],3)
        # Persist an active mid-match, then verify hydration cannot restart the clock.
        self.page.evaluate('GameState.match.paused=false;saveGame(true)')
        before=self.state()['match']
        self.page.reload(wait_until='domcontentloaded')
        self.page.wait_for_function('!!GameState && !!GameState.match')
        loaded=self.state()['match']
        self.assertEqual(loaded['minute'],before['minute'])
        self.assertEqual(loaded['score'],before['score'])
        self.assertTrue(loaded['paused'])
        self.page.wait_for_timeout(250)
        self.assertEqual(self.state()['match']['minute'],before['minute'])
        final=self.advance_minutes()
        self.assert_match_stats(final)
        self.page.evaluate('finishMatch()')
        after=self.state()
        self.assertEqual(after['eventIndex'],1)
        self.assertEqual(after['annual']['boca']['pj'],1)
        self.assertEqual(after['lastMatch']['result']['home'],final['score'][0])
        self.assertTrue(any(p['minutes']>0 for p in after['players'] if p['clubId']=='boca'))

    def test_05_three_windows_and_red_card_restrictions(self):
        self.career()
        match=self.match()
        for minute in (10,20,30):
            self.advance_minutes(minute)
            accepted,match=self.substitute_once()
            self.assertTrue(accepted)
        self.assertEqual(match['substitutions'],3)
        self.assertEqual(match['substitutionWindows'][match['userSide']],3)
        self.advance_minutes(40)
        accepted,match=self.substitute_once()
        self.assertFalse(accepted)
        self.assertEqual(match['substitutions'],3)
        self.advance_minutes(45)
        accepted,match=self.substitute_once()
        self.assertTrue(accepted)
        self.assertEqual(match['substitutions'],4)
        self.assertEqual(match['substitutionWindows'][match['userSide']],3)
        # Explicit disciplinary boundary: an expelled player remains absent and
        # cannot be replaced even though one substitution is still available.
        out,into=self.legal_pair(match)
        self.page.evaluate('(id)=>GameState.match.red.push(id)',out)
        accepted=self.page.evaluate('(ids)=>makeMatchSubstitution(...ids)',[out,into])
        self.assertFalse(accepted)
        active=self.page.evaluate('activeMatchPlayers(GameState.match.userSide)')
        self.assertNotIn(out,active)
        self.assertNotIn(into,active)
        self.assertEqual(self.state()['match']['substitutions'],4)

    def test_06_full_season_accounting_and_next_season_qualification(self):
        self.career()
        iterations=0
        while not self.state()['finished']:
            before=self.state()['eventIndex']
            after=self.play_event()
            self.assertEqual(after['eventIndex'],before+1)
            iterations+=1
            self.assertLessEqual(iterations,25)
        state=self.state()
        self.assertEqual(iterations,25)
        self.assertTrue(all(event['done'] for event in state['calendar']))
        self.assertTrue(all(row['pj']==22 for row in state['annual'].values()))
        self.assertEqual(state['annual'],state['standings'])
        self.assertEqual(sum(row['gf'] for row in state['annual'].values()),sum(row['gc'] for row in state['annual'].values()))
        for row in state['annual'].values():
            self.assertEqual(row['pts'],3*row['g']+row['e'])
            self.assertEqual(row['pj'],row['g']+row['e']+row['p'])
        self.assertIsNotNone(state['cup']['winner'])
        self.assertEqual([len(stage) for stage in state['cup']['stages']],[4,2,1])
        self.assertTrue(all(g['result'] and g['result']['winner'] for stage in state['cup']['stages'] for g in stage))
        self.assertEqual(len(state['history']),1)
        qualified=set(state['history'][0]['qualified'])
        expected_participation=state['userClub']['id'] in qualified
        self.page.evaluate('nextSeason()')
        next_state=self.state()
        self.assertEqual(next_state['year'],2027)
        self.assertEqual(next_state['eventIndex'],0)
        self.assertFalse(next_state['finished'])
        self.assertEqual(len(next_state['history']),1)
        cup_teams={team for g in next_state['cup']['stages'][0] for team in (g['home'],g['away'])}
        self.assertEqual('boca' in cup_teams,expected_participation)
        self.assertEqual(cup_teams.intersection(set(p['id'] for p in next_state['league'])),qualified)
        self.assertTrue(all(row['pj']==0 for row in next_state['annual'].values()))
        self.assertTrue(all(p['birthYear']+p['edad']==2027 for p in next_state['players']))
        self.assertTrue(any(not p['realIdentity'] for p in next_state['players']))

    def test_07_export_import_and_invalid_schema_preserve_career(self):
        state=self.career()
        with self.page.expect_download() as received:
            self.page.evaluate('MANAGEMENT.exportGame()')
        download=received.value
        export_path=ARTIFACTS/'career-export.json'
        download.save_as(str(export_path))
        exported=json.loads(export_path.read_text())
        self.assertEqual(exported['format'],'FM27')
        self.assertEqual(exported['state']['players'],state['players'])
        self.assertEqual(exported['state']['manager'],'DT de prueba')
        invalid_cases=[]
        broken=copy.deepcopy(exported)
        broken['state']['players'][1]['id']=broken['state']['players'][0]['id']
        invalid_cases.append(broken)
        broken=copy.deepcopy(exported)
        broken['state']['tactics']['xi'][0]=9999999
        invalid_cases.append(broken)
        broken=copy.deepcopy(exported)
        broken['state']['calendar'][0]['games'][0]['home']='unknown-club'
        invalid_cases.append(broken)
        broken=copy.deepcopy(exported)
        broken['state']['userClub']['presupuesto_dolares']='not-a-number'
        invalid_cases.append(broken)
        broken=copy.deepcopy(exported)
        broken['state']['annual']={}
        invalid_cases.append(broken)
        broken=copy.deepcopy(exported)
        broken['state']['cup']={'winner':None}
        invalid_cases.append(broken)
        for broken in invalid_cases:
            with self.page.expect_file_chooser() as received:
                self.page.evaluate('MANAGEMENT.importGame()')
            received.value.set_files({'name':'invalid.json','mimeType':'application/json','buffer':json.dumps(broken).encode()})
            self.page.wait_for_function("document.querySelector('#toast').textContent.startsWith('Guardado no válido')")
            self.assertEqual(self.state()['players'],state['players'])
            self.assertEqual(self.state()['manager'],'DT de prueba')
        self.page.evaluate("GameState.manager='Nombre temporal';saveGame(true);render()")
        with self.page.expect_file_chooser() as received:
            self.page.evaluate('MANAGEMENT.importGame()')
        received.value.set_files(str(export_path))
        self.page.wait_for_function("GameState.manager==='DT de prueba'")
        self.assertEqual(self.state()['players'],state['players'])
        self.assertEqual(self.state()['calendar'],state['calendar'])

    def test_08_legacy_career_migrates_without_replacing_players(self):
        self.assertTrue(LEGACY.exists(), 'Legacy fixture is the original full v1 HTML')
        legacy_url=URL.rsplit('/',1)[0]+'/legacy.html'
        self.page.route(legacy_url,lambda route: route.fulfill(status=200,content_type='text/html',body=LEGACY.read_text()))
        self.page.goto(legacy_url,wait_until='domcontentloaded')
        self.page.locator('#manager').fill('DT carrera anterior')
        self.page.locator('#club').select_option('newells')
        self.page.locator('[data-action="new"]').click()
        old=self.state()
        self.assertEqual(old['version'],1)
        self.page.goto(URL,wait_until='domcontentloaded')
        self.page.wait_for_function('!!GameState && GameState.version===2')
        migrated=self.state()
        self.assertEqual(migrated['manager'],old['manager'])
        self.assertEqual(migrated['userClub']['id'],'newells')
        self.assertEqual(len(migrated['players']),len(old['players']))
        for before,after in zip(old['players'],migrated['players']):
            for field in ['id','nombre','posicion','clubId','ritmo','tiro','pase','salario','valor_mercado']:
                self.assertEqual(after[field],before[field])
            self.assertFalse(after['realIdentity'])
        self.assertEqual(migrated['tactics']['xi'],old['tactics']['xi'])
        self.assertEqual(migrated['userClub']['presupuesto_dolares'],old['userClub']['presupuesto_dolares'])
        self.assertIn('anterior',migrated['databaseSnapshot'])
        self.assertIn('training',migrated)
        self.assertIn('scouting',migrated)
        self.nav('training')
        self.nav('scouting')
        self.play_event()
        self.assertEqual(self.state()['annual']['newells']['pj'],1)


if __name__=='__main__':
    unittest.main(verbosity=2)
