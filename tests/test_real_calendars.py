"""Independent football seasons, sporting phase order and safe career boundaries."""
import json
import os
import shutil
import unittest
from playwright.sync_api import sync_playwright

URL = os.environ.get('FM27_TEST_URL', 'http://127.0.0.1:8000/index.html')


class RealCalendars(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pw = sync_playwright().start()
        cls.browser = cls.pw.chromium.launch(executable_path=shutil.which('chromium'), headless=True,
                                            args=['--no-sandbox', '--disable-dev-shm-usage'])

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.pw.stop()

    def setUp(self):
        self.context = self.browser.new_context(viewport={'width': 1366, 'height': 768})
        self.page = self.context.new_page()
        self.errors = []
        self.page.on('pageerror', lambda error: self.errors.append(str(error)))
        self.page.route('https://**/*', lambda route: route.abort())
        self.page.goto(URL, wait_until='domcontentloaded')
        self.page.evaluate('''()=>{let seed=876234;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};window.__qaCareer=(id='boca',mode='realistic')=>WORLD_ENGINE.createWorldCareer('DT de calendario',id,undefined,{calendarMode:mode});}''')

    def tearDown(self):
        self.context.close()
        self.assertEqual(self.errors, [])

    def test_01_new_south_american_career_warms_europe_without_changing_its_cycle(self):
        r = self.page.evaluate('''()=>{__qaCareer();const european=GameState.calendar.filter(e=>e.leagueId==='GB1');return {today:GameState.today,user:FM_SEASONS.leagueSeason('ARG1'),europe:FM_SEASONS.leagueSeason('GB1'),past:european.filter(e=>e.date<GameState.today).length,played:european.filter(e=>e.date<GameState.today&&e.done).length,next:WORLD_CLOCK.nextFixture().date,generated:GameState.calendar.every(e=>e.generatedFixture),source:european[0].calendarProvenance}}''')
        self.assertEqual(r['today'], '2026-01-03')
        self.assertEqual(r['user']['label'], '2026')
        self.assertEqual(r['europe']['label'], '2025/26')
        self.assertGreater(r['past'], 0)
        self.assertEqual(r['past'], r['played'])
        self.assertEqual(r['next'], '2026-01-24')
        self.assertTrue(r['generated'])
        self.assertIn('No es el fixture oficial', r['source'])

    def test_02_european_career_starts_in_july_and_first_divisions_respect_breaks(self):
        r = self.page.evaluate('''()=>{__qaCareer('tm-11');return {today:GameState.today,season:FM_SEASONS.leagueSeason('GB1'),next:WORLD_CLOCK.nextFixture().date,violations:GameState.calendar.filter(e=>e.type==='LPF'&&WORLD_ENGINE.league(e.leagueId).tier===1&&FM_SEASONS.internationalBreak(e.date,e.leagueId)).map(e=>e.id),worldCup:FM_SEASONS.windows(2026).find(w=>w.kind==='world-cup')}}''')
        self.assertEqual(r['today'], '2026-07-04')
        self.assertEqual(r['season']['label'], '2026/27')
        self.assertGreaterEqual(r['next'], '2026-08-01')
        self.assertEqual(r['violations'], [])
        self.assertEqual(r['worldCup']['end'], '2026-07-19')

    def test_03_lower_division_playoffs_follow_regular_competitions(self):
        r = self.page.evaluate('''()=>{__qaCareer();return ['GB2','ES2','IT2','L2','FR2'].map(id=>{const events=GameState.calendar.filter(e=>e.leagueId===id),regular=events.filter(e=>e.pyramidPhase==='LIGA'),playoffs=events.filter(e=>e.phase==='knockout');return {id,last:regular.at(-1).date,first:playoffs[0].date,end:events.at(-1).date,metadata:FM_SEASONS.leagueSeason(id),year:GameState.world.pyramids.leagues[id].year,legGaps:[...new Set(playoffs.map(e=>e.pyramidPhase))].map(p=>playoffs.filter(e=>e.pyramidPhase===p)).filter(es=>es.length===2).map(es=>(Date.parse(es[1].date)-Date.parse(es[0].date))/86400000)}})}''')
        for league in r:
            self.assertGreater(league['first'], league['last'], league['id'])
            self.assertTrue(all(gap >= 3 for gap in league['legGaps']), league['id'])
            self.assertEqual(league['year'], 2025)
            self.assertEqual(league['metadata']['label'], '2025/26')
            self.assertLessEqual(league['end'], '2026-06-10')

    def test_04_postponements_reject_breaks_and_preserve_original_date(self):
        r = self.page.evaluate('''()=>{__qaCareer();const event=GameState.calendar.find(e=>e.leagueId==='ARG1'&&e.date>='2026-02-14'&&e.date<='2026-03-01'),before=event.date,bad=FM_SEASONS.postpone(event.id,'Ensayo de receso','2026-03-24'),unchanged=event.date===before,good=FM_SEASONS.postpone(event.id,'Lluvia en el estadio');return {bad,unchanged,good:good.ok,date:good.event?.date,old:good.event?.originalDate,reason:good.event?.postponed?.reason,sorted:GameState.calendar.every((e,i,a)=>!i||e.date>=a[i-1].date)}}''')
        self.assertFalse(r['bad']['ok'])
        self.assertTrue(r['unchanged'])
        self.assertTrue(r['good'])
        self.assertGreater(r['date'], r['old'])
        self.assertEqual(r['reason'], 'Lluvia en el estadio')
        self.assertTrue(r['sorted'])

    def test_05_rollover_waits_for_both_categories_and_does_not_mutate_other_leagues(self):
        r = self.page.evaluate('''()=>{__qaCareer();const a=FM_SEASONS.leagueSeason('GB1'),b=FM_SEASONS.leagueSeason('GB2');a.status='completed';b.status='active';GameState.today='2026-07-04';const before=JSON.stringify(GameState.calendar),members=JSON.stringify(GameState.world.leagues.map(l=>[l.id,l.clubIds]));return {result:FM_SEASONS.rollover('GB1'),same:before===JSON.stringify(GameState.calendar),members:members===JSON.stringify(GameState.world.leagues.map(l=>[l.id,l.clubIds])),arg:FM_SEASONS.leagueSeason('ARG1').year}}''')
        self.assertFalse(r['result'])
        self.assertTrue(r['same'])
        self.assertTrue(r['members'])
        self.assertEqual(r['arg'], 2026)

    def test_06_real_contract_dates_are_used_only_when_current_at_career_start(self):
        r = self.page.evaluate('''()=>{__qaCareer('tm-11');const refs=new Map(WORLD_DATABASE.players.map(p=>[p.playerId,p]));let accepted=0,expired=0,wrong=[];for(const p of GameState.players.filter(p=>p.realIdentity)){const ref=refs.get(p.id);if(ref.contractEnd&&ref.contractEnd>=GameState.today){accepted++;if(p.contractEnd!==ref.contractEnd||p.contractDateSource!=='published-reference')wrong.push(p.id)}else if(ref.contractEnd&&ref.contractEnd<GameState.today){expired++;const cross=WORLD_ENGINE.league(club(p.clubId).leagueId).confederation==='UEFA';if(p.contractEnd<GameState.today||!p.contractEnd.endsWith(cross?'06-30':'12-31')||p.contractDateSource!=='career-estimate')wrong.push(p.id)}if(p.transfermarkt.contractEnd!==ref.contractEnd)wrong.push(p.id)}return {accepted,expired,wrong}}''')
        self.assertGreater(r['accepted'], 0)
        self.assertGreater(r['expired'], 0)
        self.assertEqual(r['wrong'], [])

    def test_07_continental_year_refresh_keeps_european_scores_and_calendar(self):
        r = self.page.evaluate('''()=>{__qaCareer('tm-11');for(const e of GameState.calendar.filter(e=>e.type!=='LPF'))e.done=true;GameState.world.cups.LIB.winner=GameState.world.cups.LIB.participants[0];GameState.world.cups.SUD.winner=GameState.world.cups.SUD.participants[0];const winner=GameState.world.cups.LIB.winner,before=JSON.stringify(GameState.calendar.filter(e=>e.type==='LPF')),table=JSON.stringify(WORLD_ENGINE.league('GB1').standings);GameState.today='2027-01-01';const first=FM_SEASONS.rollContinentalYear(GameState.today),second=FM_SEASONS.rollContinentalYear(GameState.today);return {first,second,year:GameState.world.cups.LIB?.year||GameState.world.extraCompetitions?.preliminaries?.[2027]?.year,same:before===JSON.stringify(GameState.calendar.filter(e=>e.type==='LPF')),table:table===JSON.stringify(WORLD_ENGINE.league('GB1').standings),history:FM_SEASONS.registry().cupHistory,winner,season:FM_SEASONS.leagueSeason('GB1').label}}''')
        self.assertTrue(r['first'])
        self.assertFalse(r['second'])
        self.assertEqual(r['year'], 2027)
        self.assertEqual(r['season'], '2026/27')
        self.assertTrue(r['same'])
        self.assertTrue(r['table'])
        self.assertEqual(len(r['history']), 1)
        self.assertEqual(r['history'][0]['LIB']['winner'], r['winner'])

    def test_08_season_review_waits_for_an_interdivision_fixture(self):
        r = self.page.evaluate('''()=>{__qaCareer();for(const e of GameState.calendar)if(fixture(e))e.done=true;const s=FM_SEASONS.leagueSeason('ARG1');s.status='completed';FM_SEASONS.registry().history.push(FM_SEASONS.snapshot('ARG1'));const e={id:'2026-test-promocion',type:'LPF',leagueId:'ARG2',date:'2026-12-28',games:[{home:GameState.userClub.id,away:WORLD_ENGINE.league('ARG2').clubIds[0],result:null}],done:false};GameState.calendar.push(e);const before=FM_SEASONS.finishUserSeason();e.done=true;const after=FM_SEASONS.finishUserSeason(),twice=FM_SEASONS.finishUserSeason();return {before,after,twice,history:GameState.history.length}}''')
        self.assertFalse(r['before'])
        self.assertTrue(r['after'])
        self.assertFalse(r['twice'])
        self.assertEqual(r['history'], 1)

    def test_09_annual_career_can_request_migration_without_changing_current_save(self):
        r = self.page.evaluate('''()=>{__qaCareer('boca','annual');const before=JSON.stringify({calendar:GameState.calendar,players:GameState.players.map(p=>[p.id,p.clubId,p.condicion_fisica,p.injury,p.contractEnd]),cash:GameState.userClub.presupuesto_dolares});FM_SEASONS.requestMigration();return {active:FM_SEASONS.active(),request:GameState.world.nextCalendarMode,same:before===JSON.stringify({calendar:GameState.calendar,players:GameState.players.map(p=>[p.id,p.clubId,p.condicion_fisica,p.injury,p.contractEnd]),cash:GameState.userClub.presupuesto_dolares})}}''')
        self.assertFalse(r['active'])
        self.assertEqual(r['request'], 'realistic')
        self.assertTrue(r['same'])

    def test_10_financial_day_observes_weekly_payroll_after_settlement(self):
        r = self.page.evaluate('''()=>{__qaCareer();const first=GameState.today,through=new Date(Date.parse(first)+7*86400000).toISOString().slice(0,10),calls=[],original=FM_FINANCES.onDay;FM_FINANCES.onDay=day=>{calls.push({day,payroll:GameState.finance.lastFinancialDate});return original(day)};WORLD_ENGINE.recoverTo(through);FM_FINANCES.onDay=original;return {first,through,calls}}''')
        self.assertEqual(len(r['calls']), 7)
        self.assertEqual(r['calls'][-1]['day'], r['through'])
        self.assertEqual(r['calls'][-1]['payroll'], r['through'])

    def test_11_full_world_seasons_archive_results_and_exchange_each_pair_once(self):
        r = self.page.evaluate('''()=>{__qaCareer();const summaries=[];for(const target of ['2026-07-10','2027-01-20','2027-07-10']){let n=0;while(true){const e=GameState.calendar.find(e=>!e.done&&e.date<=target);if(!e)break;GameState.today=e.date;WORLD_CLOCK.ensure().slot=3;FM_MEDICINE.onDay(GameState.today);FM_SEASONS.onDay(GameState.today);if(GameState.finished)FM_SEASONS.resumeCareer();if(!WORLD_ENGINE.completeOne(fixture(e)?{home:1,away:0}:null,e)&&e.date<=GameState.today)throw Error('Fecha sin resolver: '+e.id);if(++n>2500)throw Error('Calendario bloqueado')}GameState.today=target;FM_SEASONS.onDay(target,{force:true});summaries.push({target,n,ARG:FM_SEASONS.leagueSeason('ARG1').year,GB:FM_SEASONS.leagueSeason('GB1').year,cup:GameState.world.cups.LIB?.year||GameState.world.extraCompetitions?.preliminaries?.[Number(target.slice(0,4))]?.year,movements:GameState.world.pyramids.movementKeys.slice(),argMovements:FM_SEASONS.registry().movementKeys?.slice()||[]})}const history=FM_SEASONS.registry().history;return {summaries,history:history.map(h=>({id:h.leagueId,year:h.year,fixtures:h.fixtures.length,scores:h.fixtures.flatMap(e=>e.games).filter(g=>g.result).length,clubs:h.clubIds.length})),membership:GameState.world.leagues.every(l=>l.clubIds.every(id=>club(id).leagueId===l.id)&&new Set(l.clubIds).size===l.clubIds.length),unique:GameState.world.pyramids.movementKeys.length===new Set(GameState.world.pyramids.movementKeys).size,duplicates:history.map(h=>h.leagueId+':'+h.year).filter((v,i,a)=>a.indexOf(v)!==i),arg:FM_SEASONS.registry().movementKeys}}''')
        self.assertEqual([(s['ARG'], s['GB'], s['cup']) for s in r['summaries']],
                         [(2026, 2026, 2026), (2027, 2026, 2027), (2027, 2027, 2027)])
        self.assertTrue(r['membership'])
        self.assertTrue(r['unique'])
        self.assertEqual(r['duplicates'], [])
        self.assertEqual(r['arg'], ['ARG:2026'])
        self.assertGreaterEqual(len(r['history']), 40)
        self.assertTrue(all(h['fixtures'] > 0 and h['scores'] > 0 and h['clubs'] >= 12 for h in r['history']))


if __name__ == '__main__':
    unittest.main()
