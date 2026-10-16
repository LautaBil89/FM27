"""Real-browser checks of future transfers, agency motives and persistent club economies."""
import os
import shutil
import unittest
from playwright.sync_api import sync_playwright

URL=os.environ.get('FM27_TEST_URL','http://127.0.0.1:8000/index.html')

class FootballWorld(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pw=sync_playwright().start()
        cls.browser=cls.pw.chromium.launch(executable_path=os.environ.get('FM27_CHROMIUM') or shutil.which('chromium'),headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    @classmethod
    def tearDownClass(cls):
        cls.browser.close();cls.pw.stop()
    def setUp(self):
        self.context=self.browser.new_context(viewport={'width':1366,'height':768})
        self.page=self.context.new_page();self.errors=[]
        self.page.on('pageerror',lambda e:self.errors.append(str(e)))
        self.page.on('dialog',lambda d:d.accept())
        self.page.route('https://**/*',lambda r:r.abort())
        self.page.goto(URL,wait_until='domcontentloaded')
        self.page.fill('#manager','DT mundo persistente');self.page.select_option('#club','boca');self.page.click('[data-action="new"]');self.page.wait_for_selector('aside')
        self.page.evaluate('''()=>{const p=mine().find(p=>!GameState.tactics.xi.includes(p.id)&&!WORLD_ENGINE.isForeign(p)&&CLUB_AI.canRelease(p).ok);if(!p)throw Error('No slot');p.clubId=null;WORLD_ENGINE.reindex();autoLineup();GameState.userClub.wageBudget=1000000}''')
    def tearDown(self):
        self.context.close();self.assertEqual(self.errors,[])
    def test_01_closed_window_negotiation_reserves_and_registers_once_after_reload(self):
        self.page.evaluate('''()=>{GameState.today='2026-04-10';view='market';render();buy(1068088)}''')
        self.assertTrue(self.page.locator('#details[open]').is_visible())
        self.assertIn(self.page.evaluate("date('2026-07-01')"),self.page.locator('.nw-registration-note').inner_text())
        self.page.fill('#negotiation [name="fee"]','1000000');self.page.click('#negotiation button[type="submit"]')
        state=self.page.evaluate('''()=>{const o=GameState.offers.find(o=>o.playerId===1068088);GameState.today=o.responseDate;CLUB_AI.processUserOffers();return {id:o.id,stage:o.stage,owner:player(o.playerId).clubId,cash:GameState.userClub.presupuesto_dolares}}''')
        self.assertEqual(state['stage'],'player')
        self.page.evaluate('(id)=>MARKET_CONTRACTS.openPlayerNegotiation(id)',state['id'])
        self.page.fill('#negotiation [name="wage"]','20000');self.page.fill('#negotiation [name="releaseClause"]','3000000')
        self.page.click('[data-nw-tab="project"]');self.assertTrue(self.page.locator('.nw-project').is_visible())
        self.page.click('#negotiation button[type="submit"]')
        agreed=self.page.evaluate('''id=>{const o=GameState.offers.find(o=>o.id===id);GameState.today=o.responseDate;CLUB_AI.processUserOffers();const reserve=CLUB_AI.reservation();saveGame(true);return {status:o.status,registration:o.registrationDate,waiting:o.awaitingRegistration,club:player(o.playerId).clubId,cash:GameState.userClub.presupuesto_dolares,reserve,fee:o.fee,bonus:o.bonus,cancel:MARKET_CONTRACTS.cancelOffer(id)}}''',state['id'])
        self.assertTrue(agreed['waiting']);self.assertEqual(agreed['status'],'pending');self.assertEqual(agreed['registration'],'2026-07-01')
        self.assertEqual(agreed['club'],state['owner']);self.assertEqual(agreed['cash'],state['cash']);self.assertEqual(agreed['reserve'],agreed['fee']+agreed['bonus']);self.assertFalse(agreed['cancel'])
        self.page.reload(wait_until='domcontentloaded');self.page.wait_for_selector('aside')
        result=self.page.evaluate('''id=>{const o=GameState.offers.find(o=>o.id===id);GameState.today='2026-06-25';MARKET_CONTRACTS.expireOffers(GameState.today);const preserved=o.status,slots=MARKET_CONTRACTS.futureSlots();GameState.today='2026-07-01';const before=GameState.userClub.presupuesto_dolares;MARKET_CONTRACTS.settle(GameState.today);const after=GameState.userClub.presupuesto_dolares;MARKET_CONTRACTS.settle(GameState.today);return {preserved,slots,status:o.status,club:player(o.playerId).clubId,debit:before-after,twice:after-GameState.userClub.presupuesto_dolares,registered:MARKET_CONTRACTS.ensure().registrations.filter(r=>r.status==='registered').length}}''',state['id'])
        self.assertEqual(result['preserved'],'pending');self.assertEqual(result['slots'],1);self.assertEqual(result['status'],'accepted');self.assertEqual(result['club'],'boca');self.assertEqual(result['debit'],agreed['reserve']);self.assertEqual(result['twice'],0);self.assertEqual(result['registered'],1)
    def test_02_unsolicited_sale_waits_for_registration_and_never_expires(self):
        result=self.page.evaluate('''()=>{GameState.today='2026-04-10';GameState.transferListed=[];CLUB_AI.makeSaleOffers(GameState.today);const o=GameState.offers.find(o=>o.type==='sell');if(!o)throw Error('No approach');const p=player(o.playerId),cash=GameState.userClub.presupuesto_dolares;CLUB_AI.respondToSaleOffer(o.id,true);const before={club:p.clubId,status:o.status,waiting:o.awaitingRegistration,cash:GameState.userClub.presupuesto_dolares,unsolicited:o.unsolicited};GameState.today='2026-06-20';CLUB_AI.processUserOffers();const live=o.status,again=CLUB_AI.respondToSaleOffer(o.id,true);GameState.today='2026-07-01';MARKET_CONTRACTS.settle();const after=GameState.userClub.presupuesto_dolares;MARKET_CONTRACTS.settle();return {before,live,again,cash,after,twice:after-GameState.userClub.presupuesto_dolares,club:p.clubId,to:o.toClub,fee:o.fee,status:o.status}}''')
        self.assertTrue(result['before']['unsolicited']);self.assertTrue(result['before']['waiting']);self.assertEqual(result['before']['club'],'boca');self.assertEqual(result['before']['cash'],result['cash']);self.assertEqual(result['live'],'pending');self.assertFalse(result['again']);self.assertEqual(result['club'],result['to']);self.assertEqual(result['status'],'accepted');self.assertEqual(result['after']-result['cash'],result['fee']);self.assertEqual(result['twice'],0)
    def test_03_future_loan_validates_owner_contract_and_starts_on_arrival(self):
        result=self.page.evaluate('''()=>{GameState.today='2026-04-10';const p=player(1068088),owner=p.clubId,cash=GameState.userClub.presupuesto_dolares;p.contract=2026;const raw={id:'future-loan-test',type:'buy',dealType:'loan',playerId:p.id,fromClub:owner,toClub:'boca',fee:100000,wage:p.salario,bonus:0,years:1,loanMonths:6,wageShare:50,purchaseMode:'none',purchaseFee:0};const bad=MARKET_CONTRACTS.agreeTransfer({...raw});p.contract=2028;const good=MARKET_CONTRACTS.agreeTransfer(raw),before={club:p.clubId,loans:MARKET_CONTRACTS.ensure().loans.length,cash:GameState.userClub.presupuesto_dolares},duplicate=MARKET_CONTRACTS.agreeTransfer({...raw,id:'other-future-loan',awaitingRegistration:false});GameState.today='2026-07-01';MARKET_CONTRACTS.settle();return {bad,good:good.ok,duplicate:duplicate.ok,before,cash,loan:MARKET_CONTRACTS.ensure().loans.find(l=>l.playerId===p.id),owner,wages:MARKET_CONTRACTS.loanWageFor(p,'boca'),salary:p.salario}}''')
        self.assertFalse(result['bad']['ok']);self.assertIn('contrato',result['bad']['reason']);self.assertTrue(result['good']);self.assertFalse(result['duplicate']);self.assertEqual(result['before']['loans'],0);self.assertEqual(result['before']['club'],result['owner']);self.assertEqual(result['before']['cash'],result['cash']);self.assertEqual(result['loan']['startDate'],'2026-07-01');self.assertEqual(result['loan']['endDate'],'2027-01-01');self.assertEqual(result['wages'],round(result['salary']*.5))
    def test_04_club_finances_use_played_matches_and_coach_cycles_are_persistent(self):
        result=self.page.evaluate('''()=>{const c=GameState.world.clubs.find(c=>c.id!=='boca'),e=CLUB_AI.economy(c.id),p=FM_DEPTH.project(c.id);CLUB_AI.syncCoaches();const beforeStyle=CLUB_AI.tacticsFor(c.id),beforeCycle=e.coachCycle;p.manager++;CLUB_AI.syncCoaches();const changed=CLUB_AI.tacticsFor(c.id),cycle=e.coachCycle;GameState.calendar.push({id:'operating-gate-test',date:'2026-01-20',done:true,type:'LPF',leagueId:c.leagueId,games:[{home:c.id,away:'boca',result:{home:1,away:0}}]});GameState.calendar.sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));const userCash=GameState.userClub.presupuesto_dolares;GameState.today='2026-01-24';CLUB_AI.onDayAdvance();const report=structuredClone(e.operatingReport),snapshot=JSON.stringify(GameState.world.ai);CLUB_AI.onDayAdvance();saveGame(true);return {beforeStyle,beforeCycle,changed,cycle,report,cash:e.cash,userSame:GameState.userClub.presupuesto_dolares===userCash,idempotent:snapshot===JSON.stringify(GameState.world.ai),id:c.id}}''')
        self.assertEqual(result['cycle'],result['beforeCycle']+1);self.assertGreater(result['report']['matchday'],0);self.assertGreater(result['report']['commercial'],0);self.assertGreaterEqual(result['cash'],0);self.assertTrue(result['idempotent']);self.assertTrue(result['userSame'])
        self.page.reload(wait_until='domcontentloaded');self.page.wait_for_selector('aside');self.assertEqual(self.page.evaluate('(id)=>CLUB_AI.economy(id).coachCycle',result['id']),result['cycle'])
    def test_05_season_updates_reputation_sponsorship_and_review_only_once(self):
        result=self.page.evaluate('''()=>{const c=GameState.world.clubs.find(c=>c.id!=='boca'&&c.leagueId==='ARG1'),e=CLUB_AI.economy(c.id),old=e.reputation,rankings=Object.fromEntries(GameState.world.leagues.map(l=>[l.id,[...l.clubIds]]));rankings.ARG1=[c.id,...rankings.ARG1.filter(id=>id!==c.id)];GameState.history=[{year:2026,worldRankings:rankings,sportingFormats:{champions:{APERTURA:c.id,CLAUSURA:c.id},promoted:[],relegated:[]},cup:c.id,sudCup:null}];GameState.year=2027;GameState.today='2027-01-17';CLUB_AI.afterNextSeason();const after=e.reputation,review=structuredClone(e.seasonReviews.at(-1)),cash=e.cash;CLUB_AI.afterNextSeason();saveGame(true);return {old,after,source:c.reputation,review,repeat:e.reputation,cashSame:e.cash===cash,reviews:e.seasonReviews.length,sponsor:e.sponsorFactor}}''')
        self.assertGreater(result['after'],result['old']);self.assertEqual(result['source'],result['after']);self.assertEqual(result['repeat'],result['after']);self.assertTrue(result['cashSame']);self.assertEqual(result['reviews'],1);self.assertTrue(result['review']['champion']);self.assertTrue(result['review']['continental']);self.assertGreater(result['sponsor'],1)
    def test_06_agency_motive_changes_wage_and_personal_deadline_expires_without_charge(self):
        result=self.page.evaluate('''()=>{const p=player(1068088);p.personalidad='Profesional';const stable=MARKET_CONTRACTS.negotiationProfile(p,{toClub:'boca',years:3,playingTime:'Rotación'}),short=MARKET_CONTRACTS.negotiationProfile(p,{toClub:'boca',years:1,playingTime:'Rotación'}),cash=GameState.userClub.presupuesto_dolares;const submitted=MARKET_CONTRACTS.submitOffer({stage:'club',type:'buy',playerId:p.id,toClub:'boca',fee:1000000});if(!submitted.ok)throw Error(submitted.reason);const o=submitted.offer;GameState.today=o.responseDate;CLUB_AI.processUserOffers();const deadline=o.personalDeadline;if(!deadline)throw Error('No personal deadline');GameState.today=new Date(Date.parse(deadline)+86400000).toISOString().slice(0,10);MARKET_CONTRACTS.expireOffers(GameState.today);return {stable,short,deadline,status:o.status,cashSame:cash===GameState.userClub.presupuesto_dolares,reserved:MARKET_CONTRACTS.reserved(),reason:o.reason}}''')
        self.assertGreater(result['short']['wage'],result['stable']['wage']);self.assertTrue(result['stable']['simulated']);self.assertEqual(result['status'],'rejected');self.assertTrue(result['cashSame']);self.assertEqual(result['reserved'],0);self.assertIn('representante',result['reason'])

if __name__=='__main__':unittest.main(verbosity=2)
