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
    def test_09_busy_delegated_scout_waits_then_retries_after_cancellation(self):
        self.career()
        r=self.page.evaluate('''()=>{const p=GameState.players.find(p=>p.clubId!==GameState.userClub.id);FM_DEPTH.scout(p.id);const report=FM_DEPTH.ensure().reports[p.id],o=FM_OFFICE.office();report.level=40;o.scoutChoice=report.staffId;o.responsibilities.scouting='staff';GameState.today='2026-01-18';const cash=GameState.userClub.presupuesto_dolares;FM_OFFICE.onDay(GameState.today);const blocked={cash:cash-GameState.userClub.presupuesto_dolares,last:o.lastScouting,status:o.assignmentStatus,falseSuccess:GameState.inbox.some(m=>m.title==='Plan de ojeo delegado')};FM_OFFICE.cancelObservation(p.id);const cancelled={status:report.status,known:FM_DEPTH.knowledge(p).level,cash:cash-GameState.userClub.presupuesto_dolares};GameState.today='2026-01-19';FM_OFFICE.onDay(GameState.today);const active=Object.values(FM_DEPTH.ensure().reports).filter(r=>r.status==='active');return {blocked,cancelled,active:active.length,staff:active[0]?.staffId,chosen:o.scoutChoice,last:o.lastScouting,charged:cash-GameState.userClub.presupuesto_dolares}}''')
        self.assertEqual(r['blocked']['cash'],0);self.assertIsNone(r['blocked']['last']);self.assertFalse(r['blocked']['falseSuccess']);self.assertIn('ocupados',r['blocked']['status'])
        self.assertEqual(r['cancelled'],{'status':'cancelled','known':40,'cash':0});self.assertEqual(r['active'],1);self.assertEqual(r['staff'],r['chosen']);self.assertEqual(r['last'],'2026-01-19');self.assertEqual(r['charged'],1500)
    def test_10_existing_manager_profile_changes_only_after_valid_confirmation(self):
        self.career();self.page.evaluate('()=>{const s=FM_OFFICE.ensure();delete s.profileConfigured;delete s.profileDraft}');self.nav('office')
        self.page.fill('[data-office-stat="tactica"]','20');self.page.locator('[data-office-stat="tactica"]').blur()
        self.assertEqual(self.page.evaluate('FM_OFFICE.ensure().profile.stats.tactica'),10)
        self.page.click('[data-office-profile-save]');self.assertFalse(self.page.evaluate('!!FM_OFFICE.ensure().profileConfigured'))
        self.page.fill('[data-office-stat="entrenamiento"]','5');self.page.locator('[data-office-stat="entrenamiento"]').blur()
        self.page.fill('[data-office-stat="motivacion"]','5');self.page.locator('[data-office-stat="motivacion"]').blur()
        self.page.select_option('[data-office-style]','Tiki-Taka');self.page.click('[data-office-profile-save]')
        self.assertEqual(self.page.evaluate('FM_OFFICE.ensure().profile.stats.tactica'),20);self.assertEqual(self.page.evaluate('GameState.tactics.style'),'Tiki-Taka')
        self.assertTrue(self.page.locator('[data-office-stat="tactica"]').is_disabled())
        self.page.reload(wait_until='domcontentloaded');self.assertEqual(self.page.evaluate('FM_OFFICE.ensure().profile.stats.tactica'),20)
    def test_11_all_clubs_have_goals_and_champion_goal_uses_actual_titles(self):
        self.career()
        r=self.page.evaluate('''()=>{FM_OFFICE.ensure();const all=GameState.world.clubs.every(c=>c.objective&&c.objectiveSeason===GameState.year),id=GameState.userClub.id,others=GameState.world.clubs.filter(c=>c.leagueId==='ARG1'&&c.id!==id).map(c=>c.id),h={year:GameState.year,worldRankings:{ARG1:[id,...others]},sportingFormats:{champions:{APERTURA:others[0],CLAUSURA:others[1]},nacionalChampion:null,promoted:[],relegated:[]}},before=FM_OFFICE.reviewObjective(id,h);h.sportingFormats.champions.CLAUSURA=id;return {all,before,after:FM_OFFICE.reviewObjective(id,h)}}''')
        self.assertTrue(r['all']);self.assertEqual(r['before']['position'],1);self.assertFalse(r['before']['met']);self.assertTrue(r['after']['met'])
    def test_12_automatic_continue_announces_medical_clearance(self):
        self.career()
        self.page.evaluate('''()=>{const p=mine().find(p=>!GameState.tactics.xi.includes(p.id));p.injury=1;GameState.world.clock.slot=3;FM_OFFICE.start()}''')
        self.page.wait_for_function('!FM_OFFICE.running.active',timeout=20000)
        self.assertTrue(self.page.evaluate("GameState.inbox.some(m=>m.title==='Alta médica del plantel')"))
    def test_13_inbox_cancels_assignment_and_shows_its_due_date(self):
        self.career()
        r=self.page.evaluate('''()=>{const p=GameState.players.find(p=>p.clubId!==GameState.userClub.id);FM_DEPTH.scout(p.id);const r=FM_DEPTH.ensure().reports[p.id],m=GameState.inbox.find(m=>m.playerId===p.id&&m.title==='Observación iniciada');GameState.world.inboxUI.selected=m.id;view='inbox';render();return {id:p.id,due:r.dueDate,body:document.querySelector('.fm-inbox-reader').innerText,cash:GameState.userClub.presupuesto_dolares}}''')
        self.assertIn('fecha prevista',r['body']);self.page.click('[data-inbox-action="scout-cancel"]')
        self.assertEqual(self.page.evaluate('(id)=>FM_DEPTH.ensure().reports[id].status',r['id']),'cancelled');self.assertEqual(self.page.evaluate('GameState.userClub.presupuesto_dolares'),r['cash'])
        self.assertFalse(self.page.locator('[data-inbox-action="scout-cancel"]').count())
    def test_14_staff_weekly_wages_are_not_duplicated_on_repeat_or_reload(self):
        self.career()
        r=self.page.evaluate('''()=>{const o=FM_OFFICE.office(),wages=o.staff.reduce((n,e)=>n+e.salary,0),cash=GameState.userClub.presupuesto_dolares;GameState.today='2026-01-24';FM_OFFICE.onDay(GameState.today);FM_OFFICE.onDay(GameState.today);saveGame(true);return {charged:cash-GameState.userClub.presupuesto_dolares,wages,cash:GameState.userClub.presupuesto_dolares,rows:GameState.finance.ledger.filter(r=>r.category==='empleados').length}}''')
        self.assertEqual(r['charged'],r['wages']);self.assertEqual(r['rows'],1)
        self.page.reload(wait_until='domcontentloaded');self.page.evaluate('FM_OFFICE.onDay(GameState.today)');self.assertEqual(self.page.evaluate('GameState.userClub.presupuesto_dolares'),r['cash'])
    def test_15_manager_and_delegation_controls_are_visible_without_scrolling(self):
        self.career();self.page.evaluate('delete FM_OFFICE.ensure().profileConfigured')
        for size in [{'width':1280,'height':720},{'width':390,'height':844}]:
            self.page.set_viewport_size(size);self.nav('office')
            for label,selector in [('Identidad del entrenador','[data-office-profile-save]'),('Responsabilidades','[data-office-responsibility="contracts"]'),('Encargo de búsqueda delegado','[data-office-assignment="budget"]')]:
                self.page.get_by_role('button',name=label,exact=True).click()
                geometry=self.page.locator(selector).evaluate('e=>({top:e.getBoundingClientRect().top,bottom:e.getBoundingClientRect().bottom,height:innerHeight})')
                self.assertGreaterEqual(geometry['top'],0,(size,label,geometry));self.assertLessEqual(geometry['bottom'],geometry['height'],(size,label,geometry))

    def test_16_previous_season_review_uses_previous_league_and_agreed_objective(self):
        self.career()
        result=self.page.evaluate("""()=>{const c=GameState.world.clubs.find(c=>c.leagueId==='ARG2'&&c.objective==='Conseguir el ascenso'),id=c.id,rankings=Object.fromEntries(GameState.world.leagues.map(l=>[l.id,l.clubIds.slice()])),h={year:2026,worldRankings:rankings,sportingFormats:{champions:{APERTURA:'river',CLAUSURA:'boca'},promoted:[id],relegated:[],nacionalChampion:null}};GameState.year=2027;c.leagueId='ARG1';const before=FM_OFFICE.reviewObjective(id,h);GameState.world.depth.projects[id]={boardReview:before};FM_OFFICE.ensure();const after=FM_OFFICE.reviewObjective(id,h);return {before,after}}""")
        for review in [result['before'],result['after']]:
            self.assertEqual(review['leagueId'],'ARG2');self.assertEqual(review['objective'],'Conseguir el ascenso');self.assertTrue(review['met'])
