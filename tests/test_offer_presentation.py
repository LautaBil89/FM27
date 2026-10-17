"""Operation-specific facts must remain coherent with old, default-filled offers."""
import unittest
import test_offer_form as offer_fixture

class OfferPresentation(unittest.TestCase):
    setUpClass=classmethod(offer_fixture.OfferFormScenarios.setUpClass.__func__)
    tearDownClass=classmethod(offer_fixture.OfferFormScenarios.tearDownClass.__func__)
    setUp=offer_fixture.OfferFormScenarios.setUp
    tearDown=offer_fixture.OfferFormScenarios.tearDown
    seed=offer_fixture.OfferFormScenarios.seed
    open_market_offer=offer_fixture.OfferFormScenarios.open_market_offer

    def test_legacy_defaults_and_counter_terms_are_operation_specific(self):
        data=self.page.evaluate("""()=>{
          const base={playerId:1068088,type:'sell',fromClub:'boca',toClub:'river',dealType:'permanent',kind:'loan',fee:9000,wage:300,years:3,loanMonths:6,wageShare:75,purchaseMode:'conditional',purchaseFee:7000,purchaseAppearances:10,installments:3,upfrontPercent:50,releaseClause:50000,bonus:1000};
          const snapshot=JSON.stringify(base),present=o=>MARKET_CONTRACTS.offerPresentation(o);
          return {permanent:present(base),loan:present({...base,dealType:'loan',awaitingUser:true,counter:{fee:12000,wageShare:25,loanMonths:12}}),plain:present({...base,dealType:'loan',purchaseMode:'none'}),renewal:present({...base,type:'renewal'}),club:present({...base,type:'buy',stage:'club'}),free:present({...base,precontract:true}),unchanged:snapshot===JSON.stringify(base)};
        }""")
        self.assertTrue(data['unchanged'])
        permanent=dict(data['permanent']['facts'])
        self.assertEqual(permanent['Modalidad'],'Venta definitiva')
        self.assertNotIn('Duración del préstamo',permanent)
        loan=dict(data['loan']['facts'])
        self.assertEqual(loan['Duración del préstamo'],'12 meses')
        self.assertTrue(loan['Salario a cargo del club receptor'].startswith('25%'))
        for field in ['Importe del pase','Duración del contrato','Cláusula de rescisión','Prima de firma','Forma de pago']:
            self.assertNotIn(field,loan)
        self.assertIn('Partidos para activar compra',loan)
        self.assertNotIn('Precio de compra futura',dict(data['plain']['facts']))
        self.assertNotIn('Importe del pase',dict(data['renewal']['facts']))
        self.assertNotIn('Salario semanal',dict(data['club']['facts']))
        self.assertNotIn('Forma de pago',dict(data['free']['facts']))

    def test_real_form_hides_inapplicable_purchase_clauses(self):
        self.open_market_offer()
        form=self.page.locator('#negotiation')
        form.locator('[name=dealType]').select_option('loan')
        self.assertIn('Cargo',form.locator('[data-contract-fee-label]').inner_text())
        self.assertTrue(form.locator('[name=purchaseFee]').is_disabled())
        self.assertFalse(form.locator('[name=purchaseFee]').is_visible())
        form.locator('[name=purchaseMode]').select_option('option')
        self.assertTrue(form.locator('[name=purchaseFee]').is_visible())
        self.assertTrue(form.locator('[name=purchaseAppearances]').is_disabled())
        form.locator('[name=purchaseMode]').select_option('conditional')
        self.assertTrue(form.locator('[name=purchaseAppearances]').is_visible())
        form.locator('[name=purchaseAppearances]').fill('999')
        form.locator('[name=purchaseMode]').select_option('none')
        self.assertTrue(form.locator('[name=purchaseAppearances]').is_disabled())
        form.locator('[name=dealType]').select_option('permanent')
        self.assertIn('traspaso',form.locator('[data-contract-fee-label]').inner_text())
        self.assertTrue(form.locator('[name=loanMonths]').is_disabled())
        self.assertFalse(form.locator('[name=wageShare]').is_visible())
        self.assertEqual(self.errors,[])

    def test_incoming_offer_inbox_market_and_saved_career_agree(self):
        self.page.evaluate("""()=>{
          const p=mine()[0];window.polishPlayer=p.id;
          const o={id:'polish-incoming',playerId:p.id,type:'sell',dealType:'permanent',fromClub:'boca',toClub:'river',fee:9000,wage:p.salario,years:3,loanMonths:6,wageShare:75,purchaseMode:'none',installments:0,status:'pending',createdDate:GameState.today,expiresAt:MARKET_CONTRACTS.addMonths(GameState.today,1)};
          GameState.offers.unshift(o);
          const m=FM_INBOX.push({title:'Oferta recibida',body:'Propuesta por el jugador.',type:'mercado',action:'sale',playerId:p.id,offerId:o.id});
          view='inbox';render();document.querySelector('[data-inbox-open="'+m.id+'"]').click();
        }""")
        facts=self.page.locator('.fm-inbox-facts').inner_text()
        self.assertIn('Venta definitiva',facts)
        self.assertNotIn('préstamo',facts.lower())
        self.page.evaluate("view='market';render()")
        row=self.page.locator('.fm-list-row').filter(has=self.page.locator('[data-sale="polish-incoming"]')).first
        self.assertIn('Venta definitiva',row.inner_text())
        self.assertNotIn('Compra',row.inner_text())
        self.page.evaluate("""()=>{const o=GameState.offers.find(o=>o.id==='polish-incoming');o.dealType='loan';o.purchaseMode='conditional';o.purchaseFee=7000;o.purchaseAppearances=12;saveGame(true)}""")
        self.page.reload(wait_until='domcontentloaded');self.page.wait_for_selector('aside')
        self.page.evaluate("""()=>{view='inbox';render();const m=GameState.inbox.find(m=>m.offerId==='polish-incoming');document.querySelector('[data-inbox-open="'+m.id+'"]').click()}""")
        facts=self.page.locator('.fm-inbox-facts').inner_text()
        self.assertIn('Duración del préstamo',facts)
        self.assertIn('Salario a cargo del club receptor',facts)
        self.assertIn('Partidos para activar compra',facts)
        self.assertNotIn('Importe del pase',facts)
        self.assertNotIn('Duración del contrato',facts)
        self.assertEqual(self.errors,[])
