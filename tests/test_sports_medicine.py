"""Workload exposure, rehab and individual development are persistent career decisions."""
import os
import shutil
import unittest

from playwright.sync_api import sync_playwright

URL = os.environ.get('FM27_TEST_URL', 'http://127.0.0.1:8000/index.html')


class SportsMedicine(unittest.TestCase):
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
        self.page.fill('#manager', 'DT médico')
        self.page.click('[data-action="new"]')
        self.page.wait_for_selector('aside')
        self.assertTrue(self.page.evaluate('!!window.FM_MEDICINE'))

    def tearDown(self):
        self.context.close()
        self.assertEqual(self.errors, [])

    def test_01_load_travel_and_rest_change_risk_without_changing_real_identity(self):
        r = self.page.evaluate('''()=>{const p=mine().find(p=>p.posicion==='DEL'),source=JSON.stringify(p.transfermarkt),base=FM_MEDICINE.risk(p);for(let i=0;i<3;i++){const day=new Date(Date.parse(GameState.today)-i*2*86400000).toISOString().slice(0,10);FM_MEDICINE.appearance(p,{id:'packed-'+i,date:day,minutes:90,distance:2400,load:1.2,random:()=>1})}const loaded=FM_MEDICINE.risk(p),condition=p.condicion_fisica,day=new Date(Date.parse(GameState.today)+4*86400000).toISOString().slice(0,10);FM_MEDICINE.state(p).restUntil=day;FM_MEDICINE.recoverPlayer(p,day);return {base,loaded,after:FM_MEDICINE.risk(p,day),condition,rested:p.condicion_fisica,unchanged:source===JSON.stringify(p.transfermarkt)}}''')
        self.assertGreater(r['loaded']['score'], r['base']['score'])
        self.assertEqual(r['loaded']['minutes'], 270)
        self.assertEqual(r['loaded']['travel'], 7200)
        self.assertGreater(r['rested'], r['condition'])
        self.assertLess(r['after']['score'], r['loaded']['score'])
        self.assertTrue(r['unchanged'])

    def test_02_legacy_injury_migrates_without_rerolling_and_recovers_only_once(self):
        r = self.page.evaluate('''()=>{const p=mine()[0];delete FM_MEDICINE.ensure().players[p.id];p.injury=8;p.condicion_fisica=61;const first=structuredClone(FM_MEDICINE.report(p)),day=new Date(Date.parse(GameState.today)+1*86400000).toISOString().slice(0,10);FM_MEDICINE.recoverPlayer(p,day);const once={injury:p.injury,condition:p.condicion_fisica};FM_MEDICINE.recoverPlayer(p,day);return {first,once,twice:{injury:p.injury,condition:p.condicion_fisica}}}''')
        self.assertEqual(r['first']['injury']['remaining'], 8)
        self.assertTrue(r['first']['injury']['legacy'])
        self.assertEqual(r['once']['injury'], 7)
        self.assertEqual(r['once'], r['twice'])

    def test_03_rehab_stages_return_and_recurrence_are_linked_to_same_case(self):
        r = self.page.evaluate('''()=>{const p=mine()[1],start=GameState.today;FM_MEDICINE.injure(p,{type:'hamstring',days:10,notify:false});const stages=[];for(const delta of [3,7,9,10]){GameState.today=new Date(Date.parse(start)+delta*86400000).toISOString().slice(0,10);FM_MEDICINE.recoverPlayer(p,GameState.today);stages.push(FM_MEDICINE.report(p))}const returnRisk=FM_MEDICINE.risk(p),again=FM_MEDICINE.injure(p,{type:'hamstring',days:10,notify:false});return {stages,returnRisk,again,history:FM_MEDICINE.report(p).history}}''')
        self.assertEqual(r['stages'][0]['injury']['stage'], 'Tratamiento')
        self.assertEqual(r['stages'][1]['injury']['stage'], 'Rehabilitación individual')
        self.assertEqual(r['stages'][2]['injury']['stage'], 'Reintegración al grupo')
        self.assertIsNone(r['stages'][3]['injury'])
        self.assertTrue(r['returnRisk']['returning'])
        self.assertLessEqual(r['stages'][3]['minuteLimit'], 60)
        self.assertTrue(r['again']['recurrence'])
        self.assertGreater(r['again']['days'], 10)
        self.assertEqual(len(r['history']), 2)

    def test_04_fitness_and_match_sharpness_diverge_after_long_absence(self):
        r = self.page.evaluate('''()=>{const p=mine()[1],start=GameState.today;FM_MEDICINE.state(p).sharpness=95;FM_MEDICINE.injure(p,{type:'ligament',days:60,notify:false});GameState.today=new Date(Date.parse(start)+60*86400000).toISOString().slice(0,10);FM_MEDICINE.recoverPlayer(p,GameState.today);const report=FM_MEDICINE.report(p),factor=FM_MEDICINE.factor(p);FM_MEDICINE.appearance(p,{id:'controlled-return',minutes:25,fatigue:false,random:()=>1});return {report,factor,after:FM_MEDICINE.report(p)}}''')
        self.assertGreater(r['report']['condition'], r['report']['sharpness'])
        self.assertGreater(r['after']['sharpness'], r['report']['sharpness'])
        self.assertLess(r['factor'], 1)
        self.assertGreaterEqual(r['factor'], .9)

    def test_05_match_minute_and_appearance_are_idempotent_and_keeper_load_is_lower(self):
        r = self.page.evaluate('''()=>{const keeper=mine().find(p=>p.posicion==='POR'),outfield=mine().find(p=>p.posicion==='DEL'),m={home:GameState.userClub.id,away:GameState.league.find(c=>c.id!==GameState.userClub.id).id,eventId:'medical-test',userSide:0,lineups:[[keeper.id,outfield.id],[]],minute:1,red:[],injured:[],minutesPlayed:{[keeper.id]:1,[outfield.id]:1}};FM_MEDICINE.onMinute(m);const once=[keeper.condicion_fisica,outfield.condicion_fisica];FM_MEDICINE.onMinute(m);const twice=[keeper.condicion_fisica,outfield.condicion_fisica];const first=FM_MEDICINE.afterMatch(m),sharp=FM_MEDICINE.report(outfield).sharpness,second=FM_MEDICINE.afterMatch(m);return {once,twice,first,second,sharp,final:FM_MEDICINE.report(outfield).sharpness}}''')
        self.assertEqual(r['once'], r['twice'])
        self.assertGreater(r['once'][0], r['once'][1])
        self.assertTrue(r['first'])
        self.assertFalse(r['second'])
        self.assertEqual(r['sharp'], r['final'])

    def test_06_specialist_cost_is_reserved_once_and_does_not_guarantee_faster_healing(self):
        r = self.page.evaluate('''()=>{const p=mine()[1];GameState.userClub.presupuesto_dolares=10000000;FM_MEDICINE.injure(p,{type:'strain',days:18,notify:false});const before=GameState.userClub.presupuesto_dolares,days=p.injury,first=FM_MEDICINE.setRehab(p.id,'Especialista'),paid=before-GameState.userClub.presupuesto_dolares;FM_MEDICINE.setRehab(p.id,'Normal');FM_MEDICINE.setRehab(p.id,'Especialista');return {first,paid,days,after:p.injury,total:before-GameState.userClub.presupuesto_dolares,receipts:Object.values(FM_MEDICINE.ensure().receipts).length}}''')
        self.assertTrue(r['first'])
        self.assertGreater(r['paid'], 0)
        self.assertEqual(r['paid'], r['total'])
        self.assertEqual(r['days'], r['after'])
        self.assertEqual(r['receipts'], 1)

    def test_07_exact_travel_is_not_claimed_for_unknown_locations(self):
        r = self.page.evaluate('''()=>{const a=club(GameState.userClub.id),b=GameState.league.find(c=>c.id!==a.id),same=FM_MEDICINE.travel(a.id,a.id);const previous={city:b.city,country:b.country};b.city='Ciudad sin coordenadas';b.country='País sin referencia';const unknown=FM_MEDICINE.travel(a.id,b.id);Object.assign(b,previous);return {same,unknown}}''')
        self.assertEqual(r['same']['km'], 0)
        self.assertTrue(r['unknown']['estimated'])
        self.assertIn('sin ubicación', r['unknown']['basis'])
        self.assertGreater(r['unknown']['km'], 0)

    def test_08_exposure_probability_uses_individual_minutes_and_published_scope(self):
        r = self.page.evaluate('''()=>{const p=mine()[1],original=FM_MEDICINE.state(p);original.tissueFatigue=0;original.sharpness=100;p.condicion_fisica=100;const risk=FM_MEDICINE.risk(p),prob=FM_MEDICINE.incidence.match/60000*risk.multiplier;const rejected=FM_MEDICINE.maybeInjury(p,null,{random:()=>prob+.00001});const accepted=FM_MEDICINE.maybeInjury(p,null,{random:()=>0});return {prob,rejected,accepted,source:FM_MEDICINE.incidence.source,unit:FM_MEDICINE.incidence.unit}}''')
        self.assertGreater(r['prob'], .0001)
        self.assertLess(r['prob'], .002)
        self.assertIsNone(r['rejected'])
        self.assertIsNotNone(r['accepted'])
        self.assertIn('2011', r['source'])
        self.assertIn('individual', r['unit'])

    def test_09_development_has_plateaus_and_environment_changes_actual_growth(self):
        r = self.page.evaluate('''()=>{const p=mine().find(p=>p.posicion==='MED'),source=JSON.stringify(p.transfermarkt);p.edad=20;p.fecha_nacimiento='2006-01-01';p.potential=95;const e=FM_DEVELOPMENT.evolution(p);e.ceiling=95;e.phaseYear=GameState.year;e.phase='Meseta';e.rate=.25;p.minutes=0;p.moral=80;const poor=FM_DEVELOPMENT.developmentRate(p,'pase',{coach:45,manager:5});p.minutes=1800;e.phase='Despegue';e.rate=1.55;const good=FM_DEVELOPMENT.developmentRate(p,'pase',{coach:90,manager:18});p.injury=30;const injured=FM_DEVELOPMENT.developmentRate(p,'pase',{coach:90,manager:18});return {poor,good,injured,unchanged:source===JSON.stringify(p.transfermarkt)}}''')
        self.assertGreater(r['good'], r['poor'] * 3)
        self.assertLess(r['injured'], r['good'])
        self.assertTrue(r['unchanged'])

    def test_10_aging_is_gradual_position_specific_and_not_repeated_at_season_end(self):
        r = self.page.evaluate('''()=>{const keeper=mine().find(p=>p.posicion==='POR'),wing=mine().find(p=>p.posicion==='DEL');for(const p of [keeper,wing]){p.fecha_nacimiento='1990-01-01';p.edad=36;p.ritmo=80;p.fisico=80;FM_DEVELOPMENT.evolution(p).lastDay=GameState.today}const start=GameState.today;GameState.today=new Date(Date.parse(start)+365*86400000).toISOString().slice(0,10);FM_DEVELOPMENT.advanceBiology(keeper,GameState.today);FM_DEVELOPMENT.advanceBiology(wing,GameState.today);const once=[keeper.ritmo,wing.ritmo];FM_DEVELOPMENT.advanceBiology(wing,GameState.today);const first=FM_DEVELOPMENT.seasonEnd(GameState.year),second=FM_DEVELOPMENT.seasonEnd(GameState.year);return {once,final:[keeper.ritmo,wing.ritmo],first,second}}''')
        self.assertGreater(r['once'][0], r['once'][1])
        self.assertEqual(r['once'], r['final'])
        self.assertTrue(r['first'])
        self.assertFalse(r['second'])

    def test_11_medical_cases_and_progression_survive_save_reload(self):
        r = self.page.evaluate('''()=>{const p=mine()[2];FM_MEDICINE.injure(p,{type:'ankle',days:20,notify:false});FM_DEVELOPMENT.evolution(p).ageProgress.ritmo=.81;FM_MEDICINE.state(p).sharpness=54;saveGame(true);return {id:p.id,caseId:FM_MEDICINE.report(p).injury.id}}''')
        self.page.reload(wait_until='domcontentloaded')
        loaded = self.page.evaluate('''id=>{const p=player(id);return {injury:p.injury,id:FM_MEDICINE.report(p).injury.id,sharpness:FM_MEDICINE.report(p).sharpness,aging:FM_DEVELOPMENT.evolution(p).ageProgress.ritmo}}''', r['id'])
        self.assertEqual(loaded['injury'], 20)
        self.assertEqual(loaded['id'], r['caseId'])
        self.assertEqual(loaded['sharpness'], 54)
        self.assertEqual(loaded['aging'], .81)

    def test_12_medical_workspace_fits_desktop_and_mobile(self):
        for size in [{'width': 1280, 'height': 720}, {'width': 390, 'height': 844}]:
            self.page.set_viewport_size(size)
            self.page.evaluate("()=>{view='training';render()}")
            self.page.click('[data-ws-key="training"][data-ws-tab="4"]')
            self.assertTrue(self.page.locator('.med-centre').is_visible())
            bounds = self.page.evaluate('''()=>({h:document.documentElement.scrollHeight,w:document.documentElement.scrollWidth,vh:innerHeight,vw:innerWidth})''')
            self.assertLessEqual(bounds['h'], bounds['vh'] + 1)
            self.assertLessEqual(bounds['w'], bounds['vw'] + 1)

    def test_13_quick_match_counts_minutes_extra_time_and_travel_once(self):
        r = self.page.evaluate('''()=>{const home=GameState.userClub.id,away=GameState.league.find(c=>c.id!==home).id,h=mine().find(p=>p.posicion==='DEL'),a=squad(away).find(p=>p.posicion==='DEL'),e={id:'quick-medical',date:GameState.today},g={home,away},lineups=[[h.id],[a.id]],random=Math.random;Math.random=()=>1;const first=FM_MEDICINE.afterQuickMatch(e,g,{extraTime:true},lineups),after=[h.condicion_fisica,a.condicion_fisica],second=FM_MEDICINE.afterQuickMatch(e,g,{extraTime:true},lineups);Math.random=random;return {first,second,after,final:[h.condicion_fisica,a.condicion_fisica],minutes:[FM_MEDICINE.loads(h).minutes,FM_MEDICINE.loads(a).minutes],travel:FM_MEDICINE.loads(a).travel}}''')
        self.assertTrue(r['first'])
        self.assertFalse(r['second'])
        self.assertEqual(r['after'], r['final'])
        self.assertEqual(r['minutes'], [120, 120])
        self.assertLess(r['after'][0], 85)
        self.assertGreaterEqual(r['travel'], 0)

    def test_14_daily_medical_updates_do_not_charge_or_heal_twice(self):
        r = self.page.evaluate('''()=>{const p=mine()[1],medical=FM_MEDICINE.state(p);p.condicion_fisica=60;medical.tissueFatigue=45;FM_MEDICINE.injure(p,{type:'overload',days:5,notify:false});const day=new Date(Date.parse(GameState.today)+1*86400000).toISOString().slice(0,10),before=GameState.userClub.presupuesto_dolares;FM_MEDICINE.onDay(day);const first=FM_MEDICINE.report(p);FM_MEDICINE.onDay(day);const second=FM_MEDICINE.report(p);return {first,second,cost:before-GameState.userClub.presupuesto_dolares}}''')
        self.assertEqual(r['first'], r['second'])
        self.assertEqual(r['first']['injury']['remaining'], 4)
        self.assertEqual(r['cost'], 0)


if __name__ == '__main__':
    unittest.main()
