"""Browser regressions for club expectations and day-to-day football operations."""
import os
import shutil
import unittest
from playwright.sync_api import sync_playwright

URL=os.environ.get('FM27_TEST_URL','http://127.0.0.1:8000/index.html')

class ManagementOffice(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pw=sync_playwright().start()
        cls.browser=cls.pw.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    @classmethod
    def tearDownClass(cls):
        cls.browser.close();cls.pw.stop()
    def setUp(self):
        self.context=self.browser.new_context(viewport={'width':1366,'height':768})
        self.page=self.context.new_page();self.errors=[]
        self.page.on('pageerror',lambda e:self.errors.append(str(e)))
        self.page.route('https://**/*',lambda r:r.abort())
        self.page.goto(URL,wait_until='domcontentloaded')
    def tearDown(self):
        self.context.close();self.assertEqual(self.errors,[])
    def career(self):
        self.page.fill('#manager','DT de pruebas');self.page.click('[data-action="new"]');self.page.wait_for_selector('aside')
    def nav(self,v):
        self.page.evaluate('(v)=>{view=v;render()}',v)
    def test_01_board_sets_objectives_and_manager_profile_has_real_budget(self):
        self.assertEqual(self.page.locator('#objective').count(),0)
        self.page.click('[data-ws-key="welcome"][data-ws-tab="manager"]')
        self.page.select_option('[data-office-style]','Tiki-Taka')
        self.page.fill('[data-office-stat="tactica"]','20');self.page.locator('[data-office-stat="tactica"]').blur()
        self.page.click('[data-action="new"]');self.assertFalse(self.page.evaluate('!!GameState'))
        self.page.fill('[data-office-stat="disciplina"]','1');self.page.locator('[data-office-stat="disciplina"]').blur()
        self.page.fill('[data-office-stat="motivacion"]','9');self.page.locator('[data-office-stat="motivacion"]').blur()
        self.page.click('[data-ws-key="welcome"][data-ws-tab="career"]');self.career()
        r=self.page.evaluate('()=>({profile:FM_OFFICE.ensure().profile,style:GameState.tactics.style,goals:[...new Set(GameState.world.clubs.map(c=>FM_OFFICE.objectiveFor(c.id)))],objective:GameState.userClub.objective})')
        self.assertEqual(r['profile']['stats']['tactica'],20);self.assertEqual(r['style'],'Tiki-Taka');self.assertGreaterEqual(len(r['goals']),4)
        self.page.reload(wait_until='domcontentloaded');self.assertEqual(self.page.evaluate('FM_OFFICE.ensure().profile.stats.tactica'),20)
    def test_02_exact_position_and_dual_nationality_filters_persist(self):
        self.career();self.nav('market')
        self.page.select_option('[data-office-filter="position"]','LD');self.page.select_option('[data-office-filter="nationality"]','Argentina')
        r=self.page.evaluate('''()=>{const f=FM_OFFICE.filters.market,rows=GameState.players.filter(p=>p.clubId!==GameState.userClub.id&&FM_OFFICE.matches(p,f));return {count:rows.length,valid:rows.every(p=>FM_PLAYER.naturalPositions(p).includes('LD')&&p.nationalities.includes('Argentina')),dual:GameState.players.some(p=>p.nationalities.length>1&&FM_OFFICE.matches(p,{position:'ALL',nationality:p.nationalities[1]}))}}''')
        self.assertGreater(r['count'],0);self.assertTrue(r['valid']);self.assertTrue(r['dual'])
        self.page.reload(wait_until='domcontentloaded');self.nav('market');self.assertEqual(self.page.locator('[data-office-filter="position"]').input_value(),'LD')
        self.nav('scouting');self.page.select_option('[data-office-filter="position"]','LI');self.assertEqual(self.page.evaluate('FM_OFFICE.filters.scouting.position'),'LI')
    def test_03_loan_listing_creates_real_loan_with_return_obligation(self):
        self.career()
        r=self.page.evaluate('''()=>{const p=mine().find(p=>CLUB_AI.canRelease(p).ok&&CLUB_AI.interestFor(p.id).length);if(!p)throw Error('No eligible loan');FM_OFFICE.toggleLoan(p.id);CLUB_AI.makeSaleOffers(GameState.today);const o=GameState.offers.find(o=>o.playerId===p.id&&o.type==='sell');if(!o)throw Error('No loan offer');const before=GameState.userClub.presupuesto_dolares;CLUB_AI.respondToSaleOffer(o.id,true);return {type:o.dealType,status:o.status,loan:MARKET_CONTRACTS.ensure().loans.find(l=>l.playerId===p.id&&l.status==='active'),club:p.clubId,owner:GameState.userClub.id,before,after:GameState.userClub.presupuesto_dolares}}''')
        self.assertEqual(r['type'],'loan');self.assertEqual(r['status'],'accepted');self.assertIsNotNone(r['loan']);self.assertEqual(r['loan']['ownerClub'],r['owner']);self.assertNotEqual(r['club'],r['owner']);self.assertGreater(r['after'],r['before'])
    def test_04_unsolicited_approaches_work_outside_transfer_window(self):
        self.career()
        r=self.page.evaluate('''()=>{GameState.today='2026-04-10';GameState.transferListed=[];CLUB_AI.makeSaleOffers(GameState.today);const o=GameState.offers.find(o=>o.type==='sell');return {open:transferWindowOpen(),offer:o&&{unsolicited:o.unsolicited,from:o.fromClub},owned:GameState.userClub.id}}''')
        self.assertFalse(r['open']);self.assertTrue(r['offer']['unsolicited']);self.assertEqual(r['offer']['from'],r['owned'])
    def test_05_automatic_continue_stops_on_news_and_manual_stop_is_stable(self):
        self.career();self.page.click('.fm-continue');self.page.wait_for_function('FM_OFFICE.running.turns>=1||!FM_OFFICE.running.active')
        if self.page.evaluate('FM_OFFICE.running.active'):
            self.page.click('[data-action="office-stop"]')
        before=self.page.evaluate('GameState.world.clock.ticks');self.page.wait_for_timeout(400);self.assertEqual(self.page.evaluate('GameState.world.clock.ticks'),before)
        self.page.evaluate('''()=>{const original=WORLD_CLOCK.advance;let n=0;WORLD_CLOCK.advance=o=>{const result=original(o);if(++n===2)FM_INBOX.push({title:'Resultado del encargo técnico',body:'Informe disponible para el DT.',type:'ojeo'});return result};FM_OFFICE.start()}''')
        self.page.wait_for_function('!FM_OFFICE.running.active',timeout=20000)
        self.assertIn('Resultado del encargo técnico',self.page.evaluate('FM_OFFICE.running.reason'))
        self.assertEqual(self.page.evaluate('FM_OFFICE.running.turns'),2)
    def test_06_delegation_uses_employee_capacity_and_charges_only_once(self):
        self.career()
        r=self.page.evaluate('''()=>{const o=FM_OFFICE.office();o.responsibilities.scouting='staff';o.responsibilities.training='staff';o.assignment={position:'LD',nationality:'Argentina',age:30,budget:5000000};for(const p of mine())p.condicion_fisica=60;GameState.today='2026-01-18';const before=GameState.userClub.presupuesto_dolares;FM_OFFICE.onDay(GameState.today);const after=GameState.userClub.presupuesto_dolares;FM_OFFICE.onDay(GameState.today);const report=Object.entries(FM_DEPTH.ensure().reports).find(([,r])=>r.status==='active');return {cost:before-after,duplicate:after-GameState.userClub.presupuesto_dolares,focus:GameState.training.focus,report:report&&report[1],valid:report&&FM_OFFICE.matches(player(Number(report[0])),o.assignment)}}''')
        self.assertEqual(r['cost'],1500);self.assertEqual(r['duplicate'],0);self.assertEqual(r['focus'],'Recuperación');self.assertTrue(r['valid']);self.assertTrue(r['report']['staffId'])
        self.page.reload(wait_until='domcontentloaded');self.assertEqual(self.page.evaluate("FM_OFFICE.office().responsibilities.scouting"),'staff')
    def test_07_inbox_explains_sender_deadline_and_personal_contract_stage(self):
        self.career()
        text=self.page.evaluate('''()=>{const p=GameState.players.find(p=>p.clubId&&p.clubId!==GameState.userClub.id),o={id:'office-test',playerId:p.id,type:'buy',status:'pending',stage:'player',awaitingUser:true,awaitingPlayerTerms:true,fromClub:p.clubId,toClub:GameState.userClub.id,fee:1000000,wage:5000,expiresAt:'2026-02-01'};GameState.offers.push(o);const m=FM_INBOX.push({title:'Pase acordado',body:'El club acepta el pase.',type:'mercado',offerId:o.id,playerId:p.id,action:'offer'});GameState.world.inboxUI.selected=m.id;view='inbox';render();return document.querySelector('.fm-inbox-reader').innerText}''')
        self.assertIn('De:',text);self.assertIn('Vencimiento:',text);self.assertIn('Próximo paso:',text);self.assertIn('Negociar contrato',text);self.assertNotIn('Contraoferta pendiente',text)
    def test_08_new_office_and_filters_fit_desktop_and_mobile(self):
        self.career()
        for size in [{'width':1280,'height':720},{'width':390,'height':844}]:
            self.page.set_viewport_size(size)
            for v in ['office','market','scouting','inbox']:
                self.nav(v)
                self.assertTrue(self.page.evaluate('document.documentElement.scrollHeight<=innerHeight+1'),(size,v))
                self.assertTrue(self.page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),(size,v))
