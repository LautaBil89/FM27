"""Repeat negotiations through real controls, daily replies and saved careers."""
import unittest
from test_offer_form import OfferFormScenarios

class NegotiationRounds(unittest.TestCase):
    setUpClass=classmethod(OfferFormScenarios.setUpClass.__func__)
    tearDownClass=classmethod(OfferFormScenarios.tearDownClass.__func__)
    setUp=OfferFormScenarios.setUp
    tearDown=OfferFormScenarios.tearDown
    seed=OfferFormScenarios.seed
    vacancy=OfferFormScenarios.vacancy

    def tomorrow(self):
        self.page.evaluate("""()=>{GameState.today=new Date(Date.parse(GameState.today)+86400000).toISOString().slice(0,10);MARKET_CONTRACTS.processOffers();render()}""")

    def test_buy_counter_twice_then_personal_counter_preserves_agreed_fee(self):
        self.vacancy()
        # The personal proposal must be below his wage even when no rival club bids.
        self.page.evaluate('player(1068088).salario=1000')
        result=self.page.evaluate("""()=>MARKET_CONTRACTS.submitOffer({stage:'club',playerId:1068088,fee:1,installments:0,upfrontPercent:100})""")
        self.assertTrue(result['ok']);oid=result['offer']['id']
        self.tomorrow()
        for _ in range(2):
            self.page.evaluate('(id)=>MARKET_CONTRACTS.openCounterNegotiation(id)',oid)
            price=int(self.page.locator('#counter-negotiation [name=fee]').input_value())
            self.page.fill('#counter-negotiation [name=fee]',str(int(price*.75)))
            self.page.click('#counter-negotiation button[type=submit]')
            self.assertFalse(self.page.locator('#details').is_visible())
            self.assertFalse(self.page.evaluate('(id)=>MARKET_CONTRACTS.counterOffer(id,{fee:2}).ok',oid))
            self.assertFalse(self.page.evaluate('(id)=>GameState.offers.find(o=>o.id===id).awaitingUser',oid))
            self.tomorrow()
        self.assertEqual(self.page.evaluate('(id)=>GameState.offers.find(o=>o.id===id).counterRounds',oid),2)
        self.page.evaluate('(id)=>{const o=GameState.offers.find(o=>o.id===id);if(o.counter)MARKET_CONTRACTS.respondCounter(id,true)}',oid)
        self.tomorrow()
        agreed=self.page.evaluate('(id)=>GameState.offers.find(o=>o.id===id).fee',oid)
        self.assertTrue(self.page.evaluate('(id)=>GameState.offers.find(o=>o.id===id).awaitingPlayerTerms',oid))
        self.page.evaluate('(id)=>MARKET_CONTRACTS.submitPlayerTerms(id,{wage:100,years:3,releaseClause:0,playingTime:"Rotación"})',oid)
        self.tomorrow()
        self.page.evaluate('(id)=>MARKET_CONTRACTS.openCounterNegotiation(id)',oid)
        wage=int(self.page.locator('#counter-negotiation [name=wage]').input_value())
        self.page.fill('#counter-negotiation [name=wage]',str(wage+100))
        self.page.click('#counter-negotiation button[type=submit]')
        self.assertEqual(self.page.evaluate('(id)=>GameState.offers.find(o=>o.id===id).fee',oid),agreed)
        self.tomorrow()
        self.assertEqual(self.page.evaluate('(id)=>GameState.offers.find(o=>o.id===id).status',oid),'accepted')
        self.assertEqual(self.page.evaluate('player(1068088).clubId'),'boca')

    def test_received_sale_market_controls_multiple_rounds_reload_and_no_early_transfer(self):
        fixture=self.page.evaluate("""()=>{
          CLUB_AI.ensure();MARKET_CONTRACTS.ensure();
          const p=mine().filter(p=>!WORLD_ENGINE.isForeign(p,'boca')&&CLUB_AI.canRelease(p,'boca').ok).sort((a,b)=>a.salario-b.salario)[0],b=club('river');
          squad(b.id).slice(-2).forEach(q=>q.clubId=null);WORLD_ENGINE.reindex();
          const o={id:'sale-counter-test',type:'sell',dealType:'permanent',playerId:p.id,fromClub:'boca',toClub:b.id,fee:1000,wage:p.salario,bonus:0,years:3,installments:0,upfrontPercent:100,sellOnPercent:0,releaseClause:0,status:'pending',createdDate:GameState.today,expiresAt:MARKET_CONTRACTS.addMonths(GameState.today,1)};
          GameState.offers.unshift(o);view='market';render();return {player:p.id,cash:GameState.userClub.presupuesto_dolares};
        }""")
        self.page.locator('[data-ws-tab="offers"]').click()
        for _ in range(2):
            self.page.locator('[data-negotiate-counter="sale-counter-test"]').click()
            fee=int(self.page.locator('#counter-negotiation [name=fee]').input_value())
            self.page.fill('#counter-negotiation [name=fee]',str(fee+100))
            self.page.click('#counter-negotiation button[type=submit]')
            self.assertFalse(self.page.evaluate("CLUB_AI.respondToSaleOffer('sale-counter-test',true)"))
            self.tomorrow()
            self.assertEqual(self.page.evaluate("GameState.offers.find(o=>o.id==='sale-counter-test').status"),'pending',self.page.evaluate("GameState.offers.find(o=>o.id==='sale-counter-test')"))
            self.assertEqual(self.page.evaluate('(id)=>player(id).clubId',fixture['player']),'boca')
            self.assertEqual(self.page.evaluate('GameState.userClub.presupuesto_dolares'),fixture['cash'])
        self.page.evaluate('saveGame(true)');self.page.reload(wait_until='domcontentloaded');self.page.wait_for_selector('aside')
        self.assertEqual(self.page.evaluate("GameState.offers.find(o=>o.id==='sale-counter-test').counterRounds"),2)
        self.assertGreaterEqual(self.page.evaluate("GameState.offers.find(o=>o.id==='sale-counter-test').negotiationHistory.length"),5)
        self.page.evaluate("view='market';render()")
        self.page.locator('[data-ws-tab="offers"]').click()
        self.page.locator('[data-sale="sale-counter-test"][data-decision="accept"]').click()
        self.assertEqual(self.page.evaluate('(id)=>player(id).clubId',fixture['player']),'river')
        self.assertGreater(self.page.evaluate('GameState.userClub.presupuesto_dolares'),fixture['cash'])
        self.assertFalse(self.page.evaluate("MARKET_CONTRACTS.counterOffer('sale-counter-test',{fee:9000}).ok"))

    def test_inbox_counter_button_and_mobile_loan_terms(self):
        self.vacancy()
        self.page.evaluate("""()=>{const p=player(1068088);MARKET_CONTRACTS.submitOffer({stage:'club',playerId:p.id,dealType:'loan',fee:1,wageShare:0,loanMonths:6,purchaseMode:'none'})}""")
        self.tomorrow()
        self.page.set_viewport_size({'width':390,'height':844})
        self.page.evaluate("""()=>{view='inbox';render();const m=GameState.inbox.find(m=>m.offerId===GameState.offers[0].id);document.querySelector('[data-inbox-open="'+m.id+'"]').click()}""")
        self.page.locator('[data-inbox-action="negotiate-counter"]').click()
        self.assertTrue(self.page.locator('#counter-negotiation [name=wageShare]').is_visible())
        self.page.fill('#counter-negotiation [name=fee]','1')
        self.page.fill('#counter-negotiation [name=wageShare]','25')
        submit=self.page.locator('#counter-negotiation button[type=submit]')
        rect=submit.bounding_box();self.assertLess(rect['y']+rect['height'],844)
        submit.click()
        self.assertFalse(self.page.locator('#details').is_visible())
        self.assertEqual(self.page.evaluate('GameState.offers[0].wageShare'),25)
        self.assertEqual(self.page.evaluate('GameState.offers[0].counterRounds'),1)
        self.tomorrow()
        self.assertTrue(self.page.evaluate('GameState.offers[0].awaitingUser'))

    def test_club_context_varies_and_stale_actions_are_atomic(self):
        result=self.page.evaluate("""()=>{
          CLUB_AI.ensure();MARKET_CONTRACTS.ensure();const p=player(1068088),e=CLUB_AI.economy(p.clubId);
          const healthy=MARKET_CONTRACTS.clubNegotiation(p,{toClub:'boca'});e.debt=1e12;GameState.transferListed.push(p.id);
          const pressured=MARKET_CONTRACTS.clubNegotiation(p,{toClub:'boca'});
          const before=JSON.stringify(GameState.offers),bad=MARKET_CONTRACTS.counterOffer('does-not-exist',{fee:100});
          return {healthy,pressured,atomic:before===JSON.stringify(GameState.offers),bad};
        }""")
        self.assertGreater(result['healthy']['resistance'],result['pressured']['resistance'])
        self.assertTrue(result['atomic']);self.assertFalse(result['bad']['ok'])

if __name__=='__main__':unittest.main()
