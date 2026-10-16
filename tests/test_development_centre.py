"""Development decisions affect workload, progression, registrations and real accounts."""
import os
import shutil
import unittest

from playwright.sync_api import sync_playwright

URL = os.environ.get('FM27_TEST_URL', 'http://127.0.0.1:8000/index.html')


class DevelopmentCentre(unittest.TestCase):
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
        self.page.fill('#manager', 'DT desarrollo')
        self.page.click('[data-action="new"]')
        self.page.wait_for_selector('aside')
        self.assertTrue(self.page.evaluate('!!window.FM_DEVELOPMENT'))

    def tearDown(self):
        self.context.close()
        self.assertEqual(self.errors, [])

    def test_01_microcycle_changes_around_real_fixtures(self):
        result = self.page.evaluate('''()=>{const e=FM_DEVELOPMENT.fixtures()[0],original=e.date;
          const rows=[0,1,2,4].map(delta=>{e.date=new Date(Date.parse(GameState.today)+delta*86400000).toISOString().slice(0,10);return FM_DEVELOPMENT.schedule()});
          e.date=original;return rows}''')
        self.assertEqual(result[0]['phase'], 'Activación de partido')
        self.assertEqual(result[0]['intensity'], 'Baja')
        self.assertEqual(result[1]['phase'], 'Preparación táctica')
        self.assertEqual(result[2]['phase'], 'Plan de partido')
        self.assertEqual(result[3]['intensity'], 'Alta')

    def test_02_training_is_once_per_day_and_fatigue_triggers_rest(self):
        result = self.page.evaluate('''()=>{const s=FM_DEVELOPMENT.ensure(),p=mine()[0];p.condicion_fisica=60;
          GameState.training.focus='Físico';GameState.training.intensity='Alta';
          const before={condition:p.condicion_fisica,sessions:GameState.training.sessions};
          const first=MANAGEMENT.applyTraining(1),after={condition:p.condicion_fisica,sessions:GameState.training.sessions};
          const second=MANAGEMENT.applyTraining(1);return {first,second,before,after,condition:p.condicion_fisica,sessions:GameState.training.sessions,load:FM_DEVELOPMENT.playerPlan(p).weeklyLoad}}''')
        self.assertTrue(result['first'])
        self.assertFalse(result['second'])
        self.assertGreater(result['after']['condition'], result['before']['condition'])
        self.assertEqual(result['sessions'], result['before']['sessions'] + 1)
        self.assertEqual(result['condition'], result['after']['condition'])
        self.assertEqual(result['load'], 0)

    def test_03_position_learning_changes_usable_positions_without_source_edits(self):
        result = self.page.evaluate('''()=>{const p=mine().find(p=>p.posicion==='DEF'),q=FM_DEVELOPMENT.playerPlan(p),original=JSON.stringify(p.transfermarkt);
          q.position='LD';q.positionProgress=99.99;p.condicion_fisica=100;p.trainingFocus='Equipo';GameState.training.focus='Defensa';GameState.training.intensity='Normal';
          MANAGEMENT.applyTraining(1);saveGame(true);return {source:original===JSON.stringify(p.transfermarkt),progress:q.positionProgress,learned:p.learnedPositions,natural:FM_PLAYER.naturalPositions(p)}}''')
        self.assertTrue(result['source'])
        self.assertEqual(result['progress'], 100)
        self.assertIn('LD', result['learned'])
        self.assertIn('LD', result['natural'])
        self.page.reload(wait_until='domcontentloaded')
        self.assertTrue(self.page.evaluate("mine().some(p=>(p.learnedPositions||[]).includes('LD'))"))

    def test_04_academy_intake_is_simulated_and_promotions_are_atomic(self):
        result = self.page.evaluate('''()=>{const s=FM_DEVELOPMENT.ensure(),p=s.academy[0];while(mine().length>=32){mine().find(p=>!GameState.tactics.xi.includes(p.id)).clubId=null;WORLD_ENGINE.reindex()}const size=GameState.players.length,cash=GameState.userClub.presupuesto_dolares;
          GameState.userClub.wageBudget=1000000;const first=FM_DEVELOPMENT.promote(p.id),after=GameState.userClub.presupuesto_dolares,second=FM_DEVELOPMENT.promote(p.id);
          return {count:s.academy.length,simulated:s.academy.every(p=>p.realIdentity===false&&p.nombre.includes('(juvenil)')),first,second,size,afterSize:GameState.players.length,cost:cash-after,expected:p.salario*4,duplicate:after-GameState.userClub.presupuesto_dolares,registered:player(p.id).registered,club:player(p.id).clubId,owner:GameState.userClub.id}}''')
        self.assertEqual(result['count'], 4)
        self.assertTrue(result['simulated'])
        self.assertTrue(result['first'])
        self.assertFalse(result['second'])
        self.assertEqual(result['afterSize'], result['size'] + 1)
        self.assertEqual(result['cost'], result['expected'])
        self.assertEqual(result['duplicate'], 0)
        self.assertEqual(result['club'], result['owner'])
        self.assertTrue(result['registered'])
        self.page.reload(wait_until='domcontentloaded')
        self.assertTrue(self.page.evaluate("mine().some(p=>p.realIdentity===false&&p.nombre.includes('(juvenil)'))"))

    def test_05_promotion_respects_full_roster_and_reserved_cash(self):
        result = self.page.evaluate('''()=>{const s=FM_DEVELOPMENT.ensure(),p=s.academy[0],size=GameState.players.length,cash=GameState.userClub.presupuesto_dolares;
          GameState.userClub.wageBudget=0;const blocked=FM_DEVELOPMENT.promote(p.id);return {blocked,unchanged:size===GameState.players.length,cash:GameState.userClub.presupuesto_dolares===cash,promoted:!!p.promoted}}''')
        self.assertFalse(result['blocked'])
        self.assertTrue(result['unchanged'])
        self.assertTrue(result['cash'])
        self.assertFalse(result['promoted'])

    def test_06_staff_hiring_uses_existing_weekly_payroll_and_rescission(self):
        result = self.page.evaluate('''()=>{const candidate=FM_DEVELOPMENT.candidates().find(c=>c.role==='Preparador'),office=FM_OFFICE.office();GameState.userClub.wageBudget=1000000;
          const cash=GameState.userClub.presupuesto_dolares,oldStaff=office.staff.length,first=FM_DEVELOPMENT.hire(candidate.id),after=GameState.userClub.presupuesto_dolares,duplicate=FM_DEVELOPMENT.hire(candidate.id),salary=office.staff.reduce((n,e)=>n+e.salary,0);
          GameState.today=new Date(Date.parse(GameState.today)+7*86400000).toISOString().slice(0,10);FM_OFFICE.onDay(GameState.today);const paid=GameState.finance.ledger.filter(r=>r.category==='empleados').reduce((n,r)=>n-r.amount,0);
          const beforeFire=GameState.userClub.presupuesto_dolares,fired=FM_DEVELOPMENT.fire(candidate.id);return {first,duplicate,fee:cash-after,expected:candidate.signingFee,paid,salary,oldStaff,count:office.staff.length,fired,fireCost:beforeFire-GameState.userClub.presupuesto_dolares,expectedFire:candidate.salary*4}}''')
        self.assertTrue(result['first'])
        self.assertFalse(result['duplicate'])
        self.assertEqual(result['fee'], result['expected'])
        self.assertEqual(result['paid'], result['expected'] + result['salary'])
        self.assertTrue(result['fired'])
        self.assertEqual(result['count'], result['oldStaff'])
        self.assertEqual(result['fireCost'], result['expectedFire'])

    def test_07_academy_expense_and_individual_delegation_are_once_daily(self):
        result = self.page.evaluate('''()=>{const s=FM_DEVELOPMENT.ensure(),p=mine()[0];s.delegation.individual='staff';p.condicion_fisica=55;
          GameState.today=new Date(Date.parse(GameState.today)+7*86400000).toISOString().slice(0,10);const cash=GameState.userClub.presupuesto_dolares;
          FM_DEVELOPMENT.onDay(GameState.today);const after=GameState.userClub.presupuesto_dolares;FM_DEVELOPMENT.onDay(GameState.today);return {focus:p.trainingFocus,load:FM_DEVELOPMENT.playerPlan(p).load,cost:cash-after,duplicate:after-GameState.userClub.presupuesto_dolares}}''')
        self.assertEqual(result['focus'], 'Recuperación')
        self.assertEqual(result['load'], 'Reducida')
        self.assertEqual(result['cost'], 250)
        self.assertEqual(result['duplicate'], 0)

    def test_08_training_panels_fit_desktop_and_mobile(self):
        for size in [{'width': 1280, 'height': 720}, {'width': 390, 'height': 844}]:
            self.page.set_viewport_size(size)
            self.page.evaluate("()=>{view='training';render()}")
            for tab in ['0', '1', '2', '3']:
                self.page.click(f'[data-ws-key="training"][data-ws-tab="{tab}"]')
                fits = self.page.evaluate('''()=>({height:document.documentElement.scrollHeight,width:document.documentElement.scrollWidth,viewportHeight:innerHeight,viewportWidth:innerWidth})''')
                self.assertLessEqual(fits['height'], fits['viewportHeight'] + 1, fits)
                self.assertLessEqual(fits['width'], fits['viewportWidth'] + 1, fits)
                self.assertTrue(self.page.locator(f'[data-ws-pane="{tab}"]').is_visible())


if __name__ == '__main__':
    unittest.main()
