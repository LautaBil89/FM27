#!/usr/bin/env python3
"""Calendar scenarios for the four-turn daily simulation.

These tests run the embedded game with external requests blocked. Fast season
checks use the public silent clock mode, retaining recovery, finances, club AI
and competition processing while skipping presentation work between turns.
"""
from datetime import date, timedelta
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
ARTIFACTS = Path(tempfile.gettempdir()) / 'fm27-daily-clock-qa'


class DailyClockScenarios(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        ARTIFACTS.mkdir(parents=True, exist_ok=True)
        cls.previous_world = subprocess.check_output(['git', 'show', '6e69360:index.html'], cwd=REPO)
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
        self.page = self.context.new_page()
        self.page.set_default_timeout(15000)
        self.errors = []
        self.page.on('pageerror', lambda error: self.errors.append(str(error)))
        self.page.on('dialog', lambda dialog: dialog.accept())
        self.page.route('https://**/*', lambda route: route.abort())
        self.page.goto(URL, wait_until='domcontentloaded')
        self.page.wait_for_selector('#worldCareerCountry')
        self.seed()

    def tearDown(self):
        if self.errors:
            self.page.screenshot(path=str(ARTIFACTS / (self._testMethodName + '-error.png')), full_page=True)
        self.context.close()
        self.assertEqual(self.errors, [], 'Uncaught application errors')

    def seed(self):
        self.page.evaluate("""()=>{
            let seed=4102026;
            Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
        }""")

    def career(self, club_id='boca', league_id='ARG1'):
        country = self.page.evaluate('(id)=>WORLD_DATABASE.leagues.find(l=>l.id===id).country', league_id)
        self.page.fill('#manager', 'DT cuatro turnos')
        self.page.locator('#worldCareerCountry').select_option(label=country)
        self.page.locator('#worldCareerLeague').select_option(league_id)
        if club_id is None:
            club_id = self.page.locator('#club option').first.get_attribute('value')
        self.page.locator('#club').select_option(club_id)
        if self.page.locator("#careerCompetitionFormat").count():
            self.page.select_option("#careerCompetitionFormat", "classic")
        self.page.click('[data-action="new"]')
        self.page.wait_for_function('GameState?.version===3')

    def clock(self):
        return self.page.evaluate('WORLD_CLOCK.info()')

    def reach_match(self):
        return self.page.evaluate("""()=>{
            let count=0;
            while(!WORLD_CLOCK.ready()&&!GameState.finished){
                WORLD_CLOCK.advance({silent:true});
                if(++count>1600)throw Error('No se encontró un partido pendiente');
            }
            return {count,clock:WORLD_CLOCK.info(),event:currentEvent(),next:WORLD_CLOCK.nextFixture()};
        }""")

    def test_01_clock_runs_four_exact_periods_without_skipping_the_day(self):
        # Continue now runs until news; test the underlying four-period API here.
        self.career()
        opening = self.page.evaluate("""()=>({today:GameState.today,slot:WORLD_CLOCK.info().slot,
            start:GameState.calendar[0].date,ticks:GameState.world.clock.ticks,
            played:GameState.calendar.filter(e=>e.done).length})""")
        self.assertEqual(date.fromisoformat(opening['today']), date.fromisoformat(opening['start'])-timedelta(days=7))
        self.assertEqual(opening['slot'], 0)
        self.assertEqual(opening['played'], 0)
        periods = [('Mañana', '08:00'), ('Mediodía', '12:00'), ('Tarde', '18:00'), ('Noche', '21:00')]
        self.assertEqual((self.clock()['label'], self.clock()['time']), periods[0])
        for step in range(1, 5):
            self.page.evaluate('WORLD_CLOCK.advance()')
            current = self.clock()
            self.assertEqual(current['slot'], step % 4)
            self.assertEqual((current['label'], current['time']), periods[step % 4])
            expected = date.fromisoformat(opening['today'])+timedelta(days=step//4)
            self.assertEqual(current['date'], expected.isoformat())
            self.assertFalse(current['ready'])
            self.assertEqual(self.page.evaluate('view'), 'dashboard')
            self.assertEqual(self.page.evaluate('GameState.world.clock.ticks'), opening['ticks']+step)
            self.assertEqual(self.page.evaluate('GameState.calendar.filter(e=>e.done).length'), 0)

    def test_02_future_kickoff_is_blocked_and_npc_matches_wait_for_their_period(self):
        self.career()
        premature = self.page.evaluate("""()=>{
            const before={today:GameState.today,eventIndex:GameState.eventIndex,
                cash:GameState.userClub.presupuesto_dolares,results:GameState.calendar.filter(e=>e.done).length};
            autoLineup();startMatch();clearInterval(timer);timer=null;
            completeEvent({home:8,away:0});
            return {before,after:{today:GameState.today,eventIndex:GameState.eventIndex,
                cash:GameState.userClub.presupuesto_dolares,results:GameState.calendar.filter(e=>e.done).length},match:GameState.match};
        }""")
        self.assertIsNone(premature['match'])
        self.assertEqual(premature['before'], premature['after'])
        morning = self.page.evaluate("""()=>{
            const first=GameState.calendar[0].date;
            while(GameState.today<first)WORLD_CLOCK.advance({silent:true});
            return {clock:WORLD_CLOCK.info(),played:GameState.calendar.filter(e=>e.done).length};
        }""")
        self.assertEqual(morning['clock']['slot'], 0)
        self.assertEqual(morning['played'], 0)
        self.page.evaluate('WORLD_CLOCK.advance({silent:true})')
        self.assertEqual(self.clock()['slot'], 1)
        self.assertEqual(self.page.evaluate('GameState.calendar.filter(e=>e.done).length'), 0)
        self.page.evaluate('WORLD_CLOCK.advance({silent:true})')
        due = self.page.evaluate("""()=>({clock:WORLD_CLOCK.info(),played:GameState.calendar.filter(e=>e.done).length,
            userPlayed:GameState.standings[GameState.userClub.id].pj,
            futurePlayed:GameState.calendar.filter(e=>e.done&&e.date>GameState.today).length,
            otherLeagues:GameState.world.leagues.filter(l=>l.id!==GameState.world.userLeagueId)
                .map(l=>Object.values(l.standings).reduce((sum,r)=>sum+r.pj,0)),
            userResult:fixture(currentEvent())?.result})""")
        self.assertTrue(due['clock']['ready'])
        self.assertGreater(due['played'], 0)
        self.assertEqual(due['userPlayed'], 0)
        self.assertEqual(due['futurePlayed'], 0)
        self.assertTrue(all(n>0 for n in due['otherLeagues']))
        self.assertIsNone(due['userResult'])
        self.page.evaluate('WORLD_ENGINE.completeOne()')
        self.assertEqual(self.page.evaluate('GameState.standings[GameState.userClub.id].pj'), 0)
        self.assertIsNone(self.page.evaluate('fixture(currentEvent())?.result'))
        before = self.page.evaluate('({today:GameState.today,slot:WORLD_CLOCK.info().slot,played:GameState.standings[GameState.userClub.id].pj})')
        self.page.evaluate('WORLD_CLOCK.advance()')
        self.assertEqual(self.page.evaluate('view'), 'match')
        self.assertEqual(self.page.evaluate('({today:GameState.today,slot:WORLD_CLOCK.info().slot,played:GameState.standings[GameState.userClub.id].pj})'), before)

    def test_03_recovery_training_and_weekly_finance_are_not_multiplied_by_four(self):
        self.career()
        original = self.page.evaluate("""()=>{
            const injured=mine().find(p=>!GameState.tactics.xi.includes(p.id));
            injured.injury=10;injured.condicion_fisica=50;GameState.training.intensity='Normal';
            return {id:injured.id,today:GameState.today,sessions:GameState.training.sessions,
                wages:MANAGEMENT.wageBill(),ledger:GameState.finance.ledger.length};
        }""")
        for _ in range(3):
            self.page.evaluate('WORLD_CLOCK.advance({silent:true})')
        within_day = self.page.evaluate('(id)=>({injury:player(id).injury,condition:player(id).condicion_fisica,sessions:GameState.training.sessions,ledger:GameState.finance.ledger.length})', original['id'])
        self.assertEqual(within_day, {'injury':10,'condition':50,'sessions':original['sessions']+1,'ledger':original['ledger']})
        self.page.evaluate('WORLD_CLOCK.advance({silent:true})')
        next_day = self.page.evaluate('(id)=>({injury:player(id).injury,condition:player(id).condicion_fisica,sessions:GameState.training.sessions})', original['id'])
        self.assertEqual(next_day, {'injury':9,'condition':54,'sessions':original['sessions']+1})
        week = self.page.evaluate("""(id)=>{
            for(let n=0;n<24;n++)WORLD_CLOCK.advance({silent:true});
            return {injury:player(id).injury,sessions:GameState.training.sessions,clock:WORLD_CLOCK.info(),
                salaries:GameState.finance.ledger.filter(r=>r.category==='salarios'||r.type==='salarios'),
                sponsor:GameState.finance.ledger.filter(r=>r.category==='patrocinio'||r.type==='patrocinio'),
                date:GameState.finance.lastFinancialDate};
        }""", original['id'])
        self.assertEqual(week['injury'], 3)
        self.assertEqual(week['sessions'], original['sessions']+7)
        self.assertEqual(week['clock']['slot'], 0)
        self.assertEqual(week['date'], week['clock']['date'])
        self.assertEqual(len(week['salaries']), 1)
        self.assertEqual(len(week['sponsor']), 1)
        self.assertEqual(week['salaries'][0]['amount'], -original['wages'])

    def test_04_transfer_reply_arrives_on_the_next_calendar_day_before_any_match(self):
        self.career()
        offer = self.page.evaluate("""()=>{
            CLUB_AI.ensure();const user=GameState.userClub.id;
            if(mine().length>=32){const vacancy=mine().find(p=>!GameState.tactics.xi.includes(p.id)&&CLUB_AI.canRelease(p,user).ok);
                if(!vacancy)throw Error('Sin plaza para el refuerzo');vacancy.clubId=null;WORLD_ENGINE.reindex();autoLineup()}
            const p=GameState.players.filter(p=>p.clubId&&p.clubId!==user&&!WORLD_ENGINE.isForeign(p,user)&&
                p.posicion==='MED'&&CLUB_AI.canRelease(p,p.clubId).ok).sort((a,b)=>a.valor_mercado-b.valor_mercado)[0];
            if(!p)throw Error('Sin objetivo negociable');
            p.valor_mercado=100000;p.salario=1000;p.contract=2028;p.clausula_rescision=100000;
            const result=CLUB_AI.submitOffer({playerId:p.id,dealType:'permanent',activateClause:true,
                fee:100000,wage:2000,years:3,bonus:0,releaseClause:300000});
            if(!result.ok)throw Error(result.reason);
            return {id:result.offer.id,playerId:p.id,owner:p.clubId,user,today:GameState.today,
                eventIndex:GameState.eventIndex,cash:GameState.userClub.presupuesto_dolares};
        }""")
        self.page.evaluate('()=>{for(let n=0;n<3;n++)WORLD_CLOCK.advance({silent:true})}')
        self.assertEqual(self.page.evaluate('(id)=>GameState.offers.find(o=>o.id===id).status', offer['id']), 'pending')
        self.assertEqual(self.page.evaluate('(id)=>player(id).clubId', offer['playerId']), offer['owner'])
        self.page.evaluate('WORLD_CLOCK.advance({silent:true})')
        replied = self.page.evaluate("""(data)=>({offer:GameState.offers.find(o=>o.id===data.id),club:player(data.playerId).clubId,
            today:GameState.today,eventIndex:GameState.eventIndex,cash:GameState.userClub.presupuesto_dolares,
            matches:GameState.calendar.filter(e=>e.done).length})""", offer)
        self.assertEqual(replied['offer']['status'], 'accepted')
        self.assertEqual(replied['club'], offer['user'])
        self.assertEqual(replied['today'], (date.fromisoformat(offer['today'])+timedelta(days=1)).isoformat())
        self.assertEqual(replied['eventIndex'], offer['eventIndex'])
        self.assertEqual(replied['matches'], 0)
        self.assertEqual(replied['cash'], offer['cash']-100000)
        self.assertEqual(replied['offer']['resolvedDate'], replied['today'])

    def test_05_finishing_a_match_keeps_the_same_day_and_remaining_period(self):
        self.career()
        self.reach_match()
        before = self.clock()
        finished = self.page.evaluate("""()=>{
            autoLineup();startMatch();clearInterval(timer);timer=null;
            if(!GameState.match)throw Error('No inició el partido habilitado');
            view='dashboard';let ticks=0;
            while(!GameState.match.done){GameState.match.paused=false;tick();if(++ticks>130)throw Error('Partido detenido')}
            const score=[...GameState.match.score];finishMatch();
            return {clock:WORLD_CLOCK.info(),played:GameState.standings[GameState.userClub.id].pj,
                lastDate:GameState.lastMatch.date,lastScore:GameState.lastMatch.result,score,
                match:GameState.match,future:GameState.calendar.filter(e=>e.done&&e.date>GameState.today).length};
        }""")
        self.assertEqual(finished['clock']['date'], before['date'])
        self.assertEqual(finished['clock']['slot'], before['slot'])
        self.assertEqual(finished['played'], 1)
        self.assertEqual(finished['lastDate'], before['date'])
        self.assertEqual([finished['lastScore']['home'],finished['lastScore']['away']], finished['score'])
        self.assertIsNone(finished['match'])
        self.assertEqual(finished['future'], 0)
        self.page.evaluate('WORLD_CLOCK.advance()')
        evening = self.clock()
        self.assertEqual(evening['date'], before['date'])
        self.assertEqual(evening['slot'], 3)
        self.page.evaluate('WORLD_CLOCK.advance()')
        following = self.clock()
        self.assertEqual(following['date'], (date.fromisoformat(before['date'])+timedelta(days=1)).isoformat())
        self.assertEqual(following['slot'], 0)

    def test_06_period_and_clock_history_survive_reload_export_and_import(self):
        self.career()
        self.page.evaluate('()=>{for(let n=0;n<6;n++)WORLD_CLOCK.advance({silent:true});saveGame(true);render()}')
        original = self.page.evaluate('({today:GameState.today,clock:structuredClone(GameState.world.clock),info:WORLD_CLOCK.info()})')
        self.assertEqual(original['clock']['slot'], 2)
        self.page.reload(wait_until='domcontentloaded')
        self.page.wait_for_selector('aside')
        after_reload = self.page.evaluate('({today:GameState.today,clock:structuredClone(GameState.world.clock),info:WORLD_CLOCK.info()})')
        self.assertEqual(after_reload, original)
        with self.page.expect_download() as download:
            self.page.evaluate('WORLD_STORAGE.exportGame()')
        backup = json.loads(Path(download.value.path()).read_text())
        self.assertEqual(backup['state']['world']['clock'], original['clock'])
        self.page.evaluate('()=>{for(let n=0;n<5;n++)WORLD_CLOCK.advance({silent:true})}')
        self.page.evaluate('(raw)=>WORLD_STORAGE.importState(raw,{confirm:false})', backup)
        self.assertEqual(self.page.evaluate('({today:GameState.today,clock:structuredClone(GameState.world.clock),info:WORLD_CLOCK.info()})'), original)
        self.page.evaluate('WORLD_CLOCK.advance()')
        self.assertEqual(self.clock()['slot'], 3)
        self.assertEqual(self.clock()['date'], original['today'])

    def load_previous(self):
        previous_url = URL+'?daily-clock-previous=1'
        self.page.route(previous_url, lambda route: route.fulfill(status=200, content_type='text/html', body=self.previous_world))
        self.page.evaluate('()=>{clearInterval(timer);timer=null;localStorage.clear()}')
        self.page.goto(previous_url, wait_until='domcontentloaded')
        self.page.wait_for_selector('#worldCareerCountry')
        self.seed()
        self.career()
        self.assertFalse(self.page.evaluate('!!GameState.world.clock'))

    def preserved_signature(self):
        return self.page.evaluate("""()=>({today:GameState.today,eventIndex:GameState.eventIndex,
            cash:GameState.userClub.presupuesto_dolares,pesos:GameState.userClub.presupuesto_pesos,
            wages:GameState.userClub.wageBudget,confidence:GameState.userClub.confianza_directiva,
            standings:JSON.stringify(GameState.world.leagues.map(l=>l.standings)),
            results:JSON.stringify(GameState.calendar.map(e=>({id:e.id,done:e.done,results:e.games.map(g=>g.result)}))),
            xi:[...GameState.tactics.xi],bench:[...GameState.tactics.bench],
            players:JSON.stringify(GameState.players.map(p=>({id:p.id,clubId:p.clubId,injury:p.injury,
                condition:p.condicion_fisica,goals:p.goals,minutes:p.minutes,contract:p.contract,salary:p.salario}))),
            finance:JSON.stringify(GameState.finance),ai:JSON.stringify((()=>{
                const ai=structuredClone(GameState.world.ai);
                // New careers keep a registration queue; an empty migration
                // queue has no financial or sporting effect. Actual records
                // must still match exactly across loading and continuation.
                if(Array.isArray(ai.contracts?.registrations)&&ai.contracts.registrations.length===0)
                    delete ai.contracts.registrations;
                return ai;
            })()),
            match:GameState.match?{minute:GameState.match.minute,score:GameState.match.score,
                lineups:GameState.match.lineups,substitutions:GameState.match.substitutions}:null})""")

    def test_07_previous_played_career_gets_a_clock_without_resimulating_or_spending(self):
        self.load_previous()
        self.page.evaluate("""()=>{
            const g=fixture(currentEvent());completeEvent({home:g.home===GameState.userClub.id?3:0,
                away:g.away===GameState.userClub.id?3:0});saveGame(true);
        }""")
        before = self.preserved_signature()
        self.page.goto(URL, wait_until='domcontentloaded')
        self.page.wait_for_selector('aside')
        self.assertEqual(self.preserved_signature(), before)
        clock = self.clock()
        self.assertEqual(clock['date'], before['today'])
        self.assertEqual(clock['slot'], 2)
        self.assertTrue(clock['ready'])
        self.page.evaluate('WORLD_CLOCK.advance()')
        self.assertEqual(self.page.evaluate('view'), 'match')
        self.assertEqual(self.page.evaluate('GameState.today'), before['today'])
        self.assertIsNone(self.page.evaluate('fixture(currentEvent())?.result'))
        # Old careers deferred the current week's payroll until kickoff. The
        # first daily continuation may settle that due expense and NPC rounds;
        # repeating Continue while the user match is due must be idempotent.
        continued = self.preserved_signature()
        self.page.evaluate('WORLD_CLOCK.advance()')
        self.assertEqual(self.preserved_signature(), continued)
        self.page.evaluate('saveGame(true)')
        self.page.reload(wait_until='domcontentloaded')
        self.assertEqual(self.clock()['slot'], 2)
        self.assertEqual(self.preserved_signature(), continued)

    def test_08_previous_live_match_stays_paused_at_its_minute_when_clock_is_added(self):
        self.load_previous()
        self.page.evaluate("""()=>{
            autoLineup();startMatch();clearInterval(timer);timer=null;view='dashboard';
            while(GameState.match.minute<19){GameState.match.paused=false;tick()}
            GameState.match.paused=false;saveGame(true);
        }""")
        before = self.preserved_signature()
        self.page.goto(URL, wait_until='domcontentloaded')
        self.page.wait_for_selector('aside')
        self.assertEqual(self.preserved_signature(), before)
        self.assertTrue(self.page.evaluate('GameState.match.paused'))
        self.assertEqual(self.clock()['slot'], 2)
        self.page.evaluate('WORLD_CLOCK.advance()')
        self.assertEqual(self.page.evaluate('view'), 'match')
        self.assertEqual(self.preserved_signature(), before)
        self.assertTrue(self.page.evaluate('GameState.match.paused'))

    def test_09_full_season_advances_daily_without_leaving_future_results_or_duplicate_games(self):
        self.career(None, 'ARG2')
        season = self.page.evaluate("""()=>{
            let turns=0,matches=0;const dates=[];
            while(!GameState.finished){
                const beforeDate=GameState.today,beforeSlot=WORLD_CLOCK.info().slot;
                if(WORLD_CLOCK.ready()){
                    const g=fixture(currentEvent());if(!g)throw Error('Turno de partido sin rival');
                    completeEvent({home:g.home===GameState.userClub.id?6:0,away:g.away===GameState.userClub.id?6:0});
                    if(GameState.today!==beforeDate||WORLD_CLOCK.info().slot!==beforeSlot)throw Error('El cierre del partido saltó la fecha');
                    matches++;
                }else{
                    WORLD_CLOCK.advance({silent:true});turns++;
                    if(GameState.today<beforeDate)throw Error('La fecha retrocedió');
                    if(GameState.today!==beforeDate)dates.push(GameState.today);
                }
                if(GameState.calendar.some(e=>e.done&&e.date>GameState.today))throw Error('Se simuló una fecha futura');
                if(turns>1800||matches>100)throw Error('La temporada quedó detenida');
            }
            saveGame(true);
            return {turns,matches,dates,today:GameState.today,clock:WORLD_CLOCK.info(),history:GameState.history[0],
                leagues:GameState.world.leagues.map(l=>({id:l.id,size:l.clubIds.length,format:l.format,table:l.standings})),
                allDone:GameState.calendar.every(e=>e.done&&e.games.every(g=>!!g.result)),
                cups:Object.fromEntries(Object.entries(GameState.world.cups).map(([id,c])=>[id,c.winner])),
                save:WORLD_STORAGE.inspect(GameState)};
        }""")
        self.assertGreater(season['turns'], 1000)
        self.assertEqual(season['matches'], 35)
        self.assertEqual(len(season['dates']), len(set(season['dates'])))
        self.assertTrue(season['allDone'])
        self.assertEqual(season['history']['position'], 1)
        self.assertTrue(all(season['cups'].values()))
        for league in season['leagues']:
            with self.subTest(league=league['id']):
                rounds=(league['size']-1)*(2 if league['format']=='double' else 1)
                self.assertTrue(all(r['pj']==rounds for r in league['table'].values()))
                self.assertEqual(sum(r['gf'] for r in league['table'].values()), sum(r['gc'] for r in league['table'].values()))
        self.assertLess(season['save']['localStorageBytes'], 5*1024*1024)
        self.page.evaluate('nextSeason()')
        new = self.page.evaluate('({year:GameState.year,date:GameState.today,first:GameState.calendar[0].date,clock:WORLD_CLOCK.info(),played:GameState.calendar.filter(e=>e.done).length,league:GameState.world.userLeagueId})')
        self.assertEqual(new['year'], 2027)
        self.assertEqual(new['league'], 'ARG1')
        self.assertEqual(date.fromisoformat(new['date']), date.fromisoformat(new['first'])-timedelta(days=7))
        self.assertEqual(new['clock']['slot'], 0)
        self.assertEqual(new['played'], 0)
        self.page.reload(wait_until='domcontentloaded')
        self.assertEqual(self.page.evaluate('GameState.today'), new['date'])
        self.assertEqual(self.clock()['slot'], 0)


if __name__ == '__main__':
    unittest.main(verbosity=2)
