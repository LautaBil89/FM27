#!/usr/bin/env python3
"""Dates, consent and registration remain independent of immutable source records."""
import os
from pathlib import Path
import shutil
import unittest
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
URL=os.environ.get('FM27_TEST_URL','http://127.0.0.1:8066/index.html')

class RealContracts(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pw=sync_playwright().start()
        cls.browser=cls.pw.chromium.launch(executable_path=os.environ.get('FM27_CHROMIUM') or shutil.which('chromium'),headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    @classmethod
    def tearDownClass(cls):cls.browser.close();cls.pw.stop()
    def setUp(self):
        self.context=self.browser.new_context(viewport={'width':1280,'height':720});self.page=self.context.new_page();self.errors=[]
        self.page.on('pageerror',lambda e:self.errors.append(str(e)));self.page.on('dialog',lambda d:d.accept());self.page.route('https://**/*',lambda r:r.abort())
        self.page.goto(URL,wait_until='domcontentloaded');self.page.fill('#manager','DT contratos');self.page.select_option('#club','boca');self.page.click('[data-action="new"]');self.page.wait_for_selector('aside')
        # Enables isolated source checks before the root HTML build is finalized.
        if not self.page.evaluate('Boolean(window.FM_REGISTRATION)'):
            for name in ['registration-rules.js','club-ai.js','market-contracts.js','negotiation-workspace.js']:
                self.page.add_script_tag(content=(ROOT/'src'/name).read_text())
        self.page.evaluate('MARKET_CONTRACTS.migrateContracts()')
    def tearDown(self):self.context.close();self.assertEqual(self.errors,[])
    def vacancy(self):
        self.page.evaluate('''()=>{const p=mine().find(p=>!GameState.tactics.xi.includes(p.id)&&!WORLD_ENGINE.isForeign(p)&&CLUB_AI.canRelease(p).ok);p.clubId=null;WORLD_ENGINE.reindex();autoLineup()}''')
    def test_01_country_profiles_and_dual_passport(self):
        result=self.page.evaluate('''()=>{const es=GameState.world.clubs.find(c=>c.country==='España'),br=GameState.world.clubs.find(c=>c.country==='Brasil'),de=GameState.world.clubs.find(c=>c.country==='Alemania');return{es:FM_REGISTRATION.profile(es.id),br:FM_REGISTRATION.profile(br.id),de:FM_REGISTRATION.profile(de.id),eu:FM_REGISTRATION.isForeign({nacionalidad:'Argentina',nationalities:['Argentina','Italia']},es.id),nonEU:FM_REGISTRATION.isForeign({nacionalidad:'Argentina'},es.id)}}''')
        self.assertEqual(result['es']['foreignSquad'],3);self.assertEqual(result['br']['foreignMatch'],9);self.assertEqual(result['de']['foreignSquad'],99)
        self.assertFalse(result['eu']);self.assertTrue(result['nonEU'])
    def test_02_legacy_dates_do_not_change_source(self):
        r=self.page.evaluate('''()=>{const p=mine()[0],source=JSON.stringify(p.transfermarkt);p.contract=2029;delete p.contractEnd;MARKET_CONTRACTS.migrateContracts();return{end:p.contractEnd,source:source===JSON.stringify(p.transfermarkt),legacy:p.contract,tag:p.contractDateSource}}''')
        self.assertEqual(r['end'],'2029-12-31');self.assertTrue(r['source']);self.assertEqual(r['legacy'],2029);self.assertEqual(r['tag'],'career-estimate')
    def test_03_precontract_six_months_and_english_permission(self):
        r=self.page.evaluate('''()=>{const clubs=GameState.world.clubs.filter(c=>c.country==='Inglaterra'),p=squad(clubs[0].id).find(p=>p.edad>=18&&CLUB_AI.canRelease(p).ok);p.contract=2026;p.contractEnd='2026-06-30';return{early:MARKET_CONTRACTS.precontractEligibility(p,clubs[1].id,'2025-12-29'),jan:MARKET_CONTRACTS.precontractEligibility(p,clubs[1].id,'2026-01-15',true),jun:MARKET_CONTRACTS.precontractEligibility(p,clubs[1].id,'2026-06-01'),foreign:MARKET_CONTRACTS.precontractEligibility(p,'boca','2026-01-15')}}''')
        self.assertFalse(r['early']['ok']);self.assertFalse(r['jan']['ok']);self.assertIn('permiso',r['jan']['reason']);self.assertTrue(r['jun']['ok']);self.assertTrue(r['foreign']['ok'])
    def test_04_consent_requires_actual_response_and_is_idempotent(self):
        r=self.page.evaluate('''()=>{const clubs=GameState.world.clubs.filter(c=>c.country==='Inglaterra'),p=squad(clubs[0].id).find(p=>p.edad>=18&&CLUB_AI.canRelease(p).ok);p.contract=2026;p.contractEnd='2026-06-30';const request=MARKET_CONTRACTS.requestPrecontractConsent(p.id,clubs[1].id),before=MARKET_CONTRACTS.precontractEligibility(p,clubs[1].id);GameState.today=MARKET_CONTRACTS.addMonths(GameState.today,0).slice(0,8)+'18';MARKET_CONTRACTS.progressContracts(GameState.today);const after=MARKET_CONTRACTS.precontractEligibility(p,clubs[1].id),n=GameState.inbox.length;MARKET_CONTRACTS.progressContracts(GameState.today);return{request,before,after,repeat:GameState.inbox.length===n}}''')
        self.assertTrue(r['request']['ok']);self.assertFalse(r['before']['ok']);self.assertTrue(r['after']['ok']);self.assertTrue(r['repeat'])
    def test_05_precontract_keeps_ownership_until_expiry_then_no_fee(self):
        self.vacancy()
        r=self.page.evaluate('''()=>{const p=player(1068088);p.contract=2026;p.contractEnd='2026-06-30';GameState.userClub.wageBudget=10000000;const from=p.clubId,cash=GameState.userClub.presupuesto_dolares,source=JSON.stringify(p.transfermarkt),offer={id:'qa-precontract',playerId:p.id,type:'buy',dealType:'permanent',fromClub:from,toClub:'boca',fee:0,bonus:1000,wage:1000,years:3,precontract:true,releaseClause:0,stage:'player',status:'pending'};const agreed=MARKET_CONTRACTS.agreeTransfer(offer),waiting=p.clubId===from;GameState.today=offer.registrationDate;MARKET_CONTRACTS.settle(GameState.today);const balance=GameState.userClub.presupuesto_dolares;MARKET_CONTRACTS.settle(GameState.today);return{agreed:agreed.ok,deferred:agreed.deferred,waiting,owner:p.clubId,date:offer.registrationDate,spent:cash-balance,repeat:balance===GameState.userClub.presupuesto_dolares,source:source===JSON.stringify(p.transfermarkt),status:offer.status}}''')
        self.assertTrue(r['agreed']);self.assertTrue(r['deferred']);self.assertTrue(r['waiting']);self.assertEqual(r['owner'],'boca');self.assertEqual(r['spent'],1000);self.assertTrue(r['repeat']);self.assertTrue(r['source'])
    def test_06_loan_cannot_outlive_exact_parent_contract(self):
        self.vacancy()
        r=self.page.evaluate('''()=>{const p=player(1068088);p.contract=2026;p.contractEnd='2026-04-30';return MARKET_CONTRACTS.submitOffer({playerId:p.id,type:'buy',dealType:'loan',fee:100000,wage:p.salario,loanMonths:6,wageShare:50,years:1,bonus:0})}''')
        self.assertFalse(r['ok']);self.assertIn('vence',r['reason'])
    def test_07_anniversary_increases_charge_once(self):
        r=self.page.evaluate('''()=>{const p=mine()[0];p.salario=1000;MARKET_CONTRACTS.setContract(p,4,'2026-01-17',{annualIncrease:10,releaseClause:100000});GameState.today='2028-01-17';MARKET_CONTRACTS.progressContracts(GameState.today);const wage=p.salario,next=p.contractWageEscalator.nextDate;MARKET_CONTRACTS.progressContracts(GameState.today);return{wage,next,repeat:p.salario===wage,end:p.contractEnd}}''')
        self.assertEqual(r['wage'],1210);self.assertEqual(r['next'],'2029-01-17');self.assertTrue(r['repeat'])
    def test_08_termination_releases_rights_and_debits_once(self):
        r=self.page.evaluate('''()=>{const p=mine().find(p=>CLUB_AI.canRelease(p).ok&&p.personalidad!=='Ambicioso'),q=MARKET_CONTRACTS.terminationQuote(p),cash=GameState.userClub.presupuesto_dolares,first=MARKET_CONTRACTS.terminateContract(p.id,true),balance=GameState.userClub.presupuesto_dolares,second=MARKET_CONTRACTS.terminateContract(p.id,true);return{q,first,owner:p.clubId,spent:cash-balance,second:second.ok,repeat:balance===GameState.userClub.presupuesto_dolares}}''')
        self.assertTrue(r['first']['ok']);self.assertIsNone(r['owner']);self.assertEqual(r['spent'],r['q']['fee']);self.assertFalse(r['second']);self.assertTrue(r['repeat'])
    def test_09_ownership_and_domestic_and_continental_lists_are_separate(self):
        r=self.page.evaluate('''()=>{const p=mine()[0],owner=p.clubId,dom=FM_REGISTRATION.list().includes(p.id),lib=FM_REGISTRATION.list('boca','LIB').includes(p.id);FM_REGISTRATION.unregister(p.id,'boca','LIB');const continental=FM_REGISTRATION.eligible(p,'boca',{type:'LIB'}),domestic=FM_REGISTRATION.eligible(p,'boca',{type:'LPF'});FM_REGISTRATION.unregister(p.id);return{dom,lib,continental,domestic,owner:p.clubId===owner,registered:p.registered,eligible:FM_REGISTRATION.eligible(p,'boca',{type:'LPF'})}}''')
        self.assertTrue(r['dom']);self.assertTrue(r['lib']);self.assertFalse(r['continental']);self.assertTrue(r['domestic']);self.assertTrue(r['owner']);self.assertFalse(r['registered']);self.assertFalse(r['eligible'])
    def test_10_nationality_does_not_invent_training_history(self):
        r=self.page.evaluate('''()=>{const c=GameState.world.clubs.find(c=>c.country==='Inglaterra'),p={nacionalidad:'Inglaterra'};return{unverified:FM_REGISTRATION.trained(p,c.id),verified:FM_REGISTRATION.trained({...p,trainingHistory:[{country:'Inglaterra',clubId:c.id,months:36,beforeAge:21}]},c.id,true)}}''')
        self.assertFalse(r['unverified']);self.assertTrue(r['verified'])
    def test_11_renewal_has_exact_date_budget_and_confirmation(self):
        r=self.page.evaluate('''()=>{const p=mine()[0],cash=GameState.userClub.presupuesto_dolares,terms={years:4,wage:Math.round(p.salario*1.15),bonus:1000,annualIncrease:5,releaseClause:100000};GameState.userClub.wageBudget=10000000;const preview=MARKET_CONTRACTS.renewContract(p.id,terms),unchanged=GameState.userClub.presupuesto_dolares===cash,done=MARKET_CONTRACTS.renewContract(p.id,{...terms,confirmed:true});return{preview:preview.ok,unchanged,done:done.ok,end:p.contractEnd,percent:p.contractWageEscalator.percent,spent:cash-GameState.userClub.presupuesto_dolares}}''')
        self.assertFalse(r['preview']);self.assertTrue(r['unchanged']);self.assertTrue(r['done']);self.assertEqual(r['end'],'2030-12-31');self.assertEqual(r['percent'],5);self.assertEqual(r['spent'],1000)
    def test_12_contract_and_registration_forms_fit_mobile(self):
        self.page.evaluate('renew(mine()[0].id)');self.assertTrue(self.page.locator('#contract-renewal').is_visible())
        for width,height in [(1280,720),(390,844)]:
            self.page.set_viewport_size({'width':width,'height':height});r=self.page.locator('#contract-renewal button[type="submit"]').evaluate('(e)=>{const r=e.getBoundingClientRect();return{bottom:r.bottom,top:r.top,height:innerHeight}}');self.assertGreaterEqual(r['top'],0);self.assertLessEqual(r['bottom'],r['height'])
        self.page.locator('#details [data-action="close"]').click();self.page.evaluate("()=>{$('#details').innerHTML=FM_REGISTRATION.panel()+'<button data-action=\"close\">Cerrar</button>';$('#details').showModal()}")
        self.assertTrue(self.page.locator('.rr-panel').is_visible())
    def test_13_english_last_month_tracks_exact_expiry_month(self):
        r=self.page.evaluate('''()=>{const clubs=GameState.world.clubs.filter(c=>c.country==='Inglaterra'),p=squad(clubs[0].id).find(p=>p.edad>=18);p.contract=2026;p.contractEnd='2026-12-31';return {july:MARKET_CONTRACTS.precontractEligibility(p,clubs[1].id,'2026-07-15'),december:MARKET_CONTRACTS.precontractEligibility(p,clubs[1].id,'2026-12-01'),expired:MARKET_CONTRACTS.precontractEligibility(p,'boca','2027-01-01')}}''')
        self.assertFalse(r['july']['ok']);self.assertTrue(r['december']['ok']);self.assertFalse(r['expired']['ok'])

    def test_14_club_ai_uses_board_authorization_not_only_cash(self):
        r=self.page.evaluate('''()=>{if(window.FM_FINANCES?.account){const b=FM_FINANCES.account();b.board.authorized=123;b.board.spent=0;b.board.saleAllocation=0;GameState.offers.push({id:'sample',playerId:1068088,fromClub:player(1068088).clubId,toClub:'boca',type:'buy',dealType:'permanent',stage:'club',status:'pending',fee:106,bonus:0});return {normal:CLUB_AI.availableBudget(),excluded:CLUB_AI.availableBudget('boca','sample')}}const original=window.FM_FINANCES;window.FM_FINANCES={available:(id,exclude)=>id==='boca'&&exclude==='sample'?123:17};try{return {normal:CLUB_AI.availableBudget(),excluded:CLUB_AI.availableBudget('boca','sample')}}finally{window.FM_FINANCES=original}}''')
        self.assertEqual(r['normal'],17);self.assertEqual(r['excluded'],123)


    def test_15_npc_renewal_never_shortens_an_existing_long_contract(self):
        r=self.page.evaluate('''()=>{const c=GameState.world.clubs.find(c=>c.country==='Inglaterra'),p=squad(c.id).find(p=>p.edad>=18&&p.edad<34),e=CLUB_AI.economy(c.id),end=Number(GameState.today.slice(0,4))+8;p.contract=end;p.contractEnd=end+'-06-30';p.salario=1000;e.cash=100000000;e.wageBudget=100000000;CLUB_AI.renewClub(c,true);return {end:p.contractEnd,expected:end+'-06-30',wage:p.salario}}''')
        self.assertEqual(r['end'],r['expected']);self.assertEqual(r['wage'],1000)


if __name__=='__main__':unittest.main(verbosity=2)
