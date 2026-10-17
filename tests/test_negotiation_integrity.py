"""Malformed counterterms must not mutate contracts, reservations or agreed loans."""
import unittest
import test_offer_form as fixture

class NegotiationIntegrity(unittest.TestCase):
    setUpClass=classmethod(fixture.OfferFormScenarios.setUpClass.__func__)
    tearDownClass=classmethod(fixture.OfferFormScenarios.tearDownClass.__func__)
    setUp=fixture.OfferFormScenarios.setUp
    tearDown=fixture.OfferFormScenarios.tearDown
    seed=fixture.OfferFormScenarios.seed
    vacancy=fixture.OfferFormScenarios.vacancy
    open_market_offer=fixture.OfferFormScenarios.open_market_offer

    def counter_fixture(self,loan=False):
        self.vacancy()
        self.page.evaluate("""loan=>{
          const p=player(1068088);p.contractEnd='2029-12-31';p.contract=2029;GameState.userClub.wageBudget=10000000;
          const o={id:'integrity-counter',playerId:p.id,type:'buy',dealType:loan?'loan':'permanent',fromClub:p.clubId,toClub:'boca',fee:1000,wage:p.salario,years:3,bonus:0,releaseClause:p.clausula_rescision,stage:'player',clubAccepted:true,playerTermsSubmitted:true,status:'pending',awaitingUser:true,loanMonths:6,wageShare:50,purchaseMode:'none',purchaseFee:0,installments:0,upfrontPercent:100,sellOnPercent:0,playingTime:'Rotación',appearanceBonus:0,goalBonus:0,cleanSheetBonus:0,titleBonus:0,createdDate:GameState.today,personalDeadline:MARKET_CONTRACTS.addMonths(GameState.today,1),counter:{wage:p.salario*2,years:4,bonus:1000,wageShare:90}};
          GameState.offers.unshift(o);
        }""",loan)

    def test_invalid_counter_bonus_and_role_are_rejected_without_mutation(self):
        self.counter_fixture()
        for terms in [{'goalBonus':-1},{'appearanceBonus':100001},{'cleanSheetBonus':0.5},{'titleBonus':500001},{'playingTime':'Cualquier cosa'}]:
            result=self.page.evaluate("""terms=>{const before=JSON.stringify(GameState.offers),cash=GameState.userClub.presupuesto_dolares,old=player(1068088).salario,result=MARKET_CONTRACTS.counterOffer('integrity-counter',terms);return {result,same:before===JSON.stringify(GameState.offers),cash:cash===GameState.userClub.presupuesto_dolares,wage:old===player(1068088).salario}}""",terms)
            self.assertFalse(result['result']['ok'],terms)
            self.assertTrue(result['same'],terms)
            self.assertTrue(result['cash'])
            self.assertTrue(result['wage'])

    def test_loan_personal_counter_preserves_owner_and_club_terms(self):
        self.counter_fixture(True)
        self.page.evaluate("MARKET_CONTRACTS.openCounterNegotiation('integrity-counter')")
        self.assertEqual(self.page.locator('#counter-negotiation [name=wage],#counter-negotiation [name=years],#counter-negotiation [name=bonus],#counter-negotiation [name=releaseClause]').count(),0)
        self.page.locator('#details').evaluate('(dialog)=>dialog.close()')
        result=self.page.evaluate("""()=>{const p=player(1068088),wage=p.salario,owner=p.clubId,end=p.contractEnd,result=MARKET_CONTRACTS.counterOffer('integrity-counter',{wage:999999,years:5,bonus:99999,releaseClause:1,wageShare:99,fee:1,loanMonths:12,playingTime:'Titular',appearanceBonus:100});return {result,wage,owner,end,untouched:p.salario===wage&&p.contractEnd===end&&p.clubId===owner}}""")
        self.assertTrue(result['result']['ok'],result)
        offer=result['result']['offer']
        self.assertEqual(offer['wage'],result['wage']);self.assertEqual(offer['bonus'],0)
        self.assertEqual(offer['years'],1);self.assertEqual(offer['fee'],1000)
        self.assertEqual(offer['wageShare'],50);self.assertEqual(offer['loanMonths'],6)
        self.assertEqual(offer['appearanceBonus'],100);self.assertTrue(result['untouched'])
        self.page.reload(wait_until='domcontentloaded');self.page.wait_for_selector('aside')
        self.assertEqual(self.page.evaluate("GameState.offers.find(o=>o.id==='integrity-counter').wageShare"),50)
        self.page.evaluate("""()=>{const o=GameState.offers.find(o=>o.id==='integrity-counter');o.awaitingUser=true;o.counter={wage:o.wage,playingTime:o.playingTime};MARKET_CONTRACTS.openCounterNegotiation(o.id)}""")
        self.page.select_option('#counter-negotiation [name=playingTime]','Proyecto')
        self.page.fill('#counter-negotiation [name=appearanceBonus]','50')
        self.page.click('#counter-negotiation button[type=submit]')
        self.assertFalse(self.page.locator('#details').is_visible())
        self.assertEqual(self.page.evaluate("GameState.offers.find(o=>o.id==='integrity-counter').appearanceBonus"),50)
        self.assertEqual(self.page.evaluate("GameState.offers.find(o=>o.id==='integrity-counter').playingTime"),'Proyecto')
        self.assertEqual(self.errors,[])

    def test_unused_transfer_fields_do_not_block_a_loan(self):
        self.vacancy()
        result=self.page.evaluate("""()=>{const p=player(1068088);p.contract=2029;p.contractEnd='2029-12-31';return MARKET_CONTRACTS.submitOffer({stage:'club',playerId:p.id,dealType:'loan',fee:1,loanMonths:6,wageShare:50,purchaseMode:'none',purchaseFee:-999,installments:NaN,upfrontPercent:NaN,releaseClause:NaN,sellOnPercent:NaN,annualIncrease:NaN,activateClause:true})}""")
        self.assertTrue(result['ok'],result)
        self.assertEqual(result['offer']['purchaseFee'],0)
        self.assertEqual(result['offer']['installments'],0)
        self.assertFalse(result['offer']['activateClause'])

    def test_mode_switch_restores_separate_purchase_and_loan_drafts(self):
        self.page.evaluate("""()=>{const p=player(1068088);p.contractEnd=MARKET_CONTRACTS.addMonths(GameState.today,3);p.contract=Number(p.contractEnd.slice(0,4))}""")
        self.open_market_offer()
        form=self.page.locator('#negotiation');fee=form.locator('[name=fee]');mode=form.locator('[name=dealType]')
        fee.fill('257000');mode.select_option('precontract');self.assertEqual(fee.input_value(),'0')
        self.assertFalse(form.locator('[name=installments]').is_visible())
        mode.select_option('permanent');self.assertEqual(fee.input_value(),'257000')
        mode.select_option('loan');fee.fill('900');mode.select_option('permanent')
        self.assertEqual(fee.input_value(),'257000')
        mode.select_option('loan');self.assertEqual(fee.input_value(),'900')
        self.assertEqual(self.errors,[])

    def test_stale_loan_clause_does_not_reserve_money_for_permanent_transfer(self):
        result=self.page.evaluate("""()=>{const before=MARKET_CONTRACTS.reserved();const o={id:'stale-reserve',playerId:1068088,type:'buy',dealType:'permanent',toClub:'boca',status:'pending',fee:1000,bonus:0,purchaseMode:'mandatory',purchaseFee:10000000};GameState.offers.unshift(o);const permanent=MARKET_CONTRACTS.reserved()-before;o.dealType='loan';const loan=MARKET_CONTRACTS.reserved()-before;return{permanent,loan}}""")
        self.assertEqual(result['permanent'],1000)
        self.assertEqual(result['loan'],10001000)

    def test_accepting_personal_counter_preserves_club_terms_and_checks_deadline(self):
        self.counter_fixture(True)
        result=self.page.evaluate("""()=>{const o=GameState.offers.find(o=>o.id==='integrity-counter');o.counter.fee=999;o.counter.loanMonths=12;o.counter.purchaseMode='mandatory';o.counter.purchaseFee=100000000;o.personalDeadline='2000-01-01';const before=JSON.stringify(o),expired=MARKET_CONTRACTS.respondCounter(o.id,true),unchanged=before===JSON.stringify(o);o.personalDeadline=MARKET_CONTRACTS.addMonths(GameState.today,1);const accepted=MARKET_CONTRACTS.respondCounter(o.id,true);return {expired,unchanged,accepted,fee:o.fee,share:o.wageShare,months:o.loanMonths,mode:o.purchaseMode,wage:o.wage,ownerWage:player(o.playerId).salario}}""")
        self.assertFalse(result['expired']);self.assertTrue(result['unchanged'])
        self.assertTrue(result['accepted'],result)
        self.assertEqual(result['fee'],1000);self.assertEqual(result['share'],50)
        self.assertEqual(result['months'],6);self.assertEqual(result['mode'],'none')
        self.assertEqual(result['wage'],result['ownerWage'])
