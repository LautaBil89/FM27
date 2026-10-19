"""Existing players answer renewal proposals; signing is dated, budgeted and atomic."""
import unittest
import test_offer_form as fixture

class RenewalNegotiations(unittest.TestCase):
    setUpClass=classmethod(fixture.OfferFormScenarios.setUpClass.__func__)
    tearDownClass=classmethod(fixture.OfferFormScenarios.tearDownClass.__func__)
    setUp=fixture.OfferFormScenarios.setUp
    tearDown=fixture.OfferFormScenarios.tearDown
    seed=fixture.OfferFormScenarios.seed

    def player_fixture(self):
        return self.page.evaluate("""()=>{FM_DRESSING_ROOM.ensure();const p=mine().find(p=>p.edad>=24&&p.edad<30&&!p.loanId&&p.salario<25000);if(!p)throw Error('No hay candidato');GameState.userClub.wageBudget=10000000;window.renewPid=p.id;return {id:p.id,wage:p.salario,end:MARKET_CONTRACTS.contractEnd(p),cash:GameState.userClub.presupuesto_dolares}}""")

    def tomorrow(self):
        self.page.evaluate("""()=>{GameState.today=new Date(Date.parse(GameState.today)+86400000).toISOString().slice(0,10);CLUB_AI.processUserOffers();render()}""")

    def test_actual_form_counter_two_rounds_then_accept_without_resetting_relationship(self):
        p=self.player_fixture()
        self.page.evaluate("""()=>{const r=FM_DRESSING_ROOM.ensure().players[renewPid];r.trust=67;r.minutes=321;r.promise={status:'active',start:GameState.today,deadline:'2026-12-31',target:500,baseline:0};renew(renewPid)}""")
        self.page.fill('#contract-renewal [name=wage]','100')
        self.page.fill('#contract-renewal [name=bonus]','0')
        self.page.click('#contract-renewal button[type=submit]')
        self.assertFalse(self.page.locator('#details').is_visible())
        self.assertEqual(self.page.evaluate('player(renewPid).salario'),p['wage'])
        self.assertEqual(self.page.evaluate('MARKET_CONTRACTS.contractEnd(player(renewPid))'),p['end'])
        self.assertEqual(self.page.evaluate('GameState.userClub.presupuesto_dolares'),p['cash'])
        self.tomorrow()
        for _ in range(2):
            self.page.evaluate('renew(renewPid)')
            self.assertTrue(self.page.locator('[data-renew-decision=accept]').is_visible())
            wage=int(self.page.locator('#contract-renewal [name=wage]').input_value())
            self.page.fill('#contract-renewal [name=wage]',str(int(wage*.7)))
            self.page.click('#contract-renewal button[type=submit]')
            self.tomorrow()
        self.page.evaluate("""()=>{view='inbox';render();const r=FM_RENEWALS.current(renewPid),m=GameState.inbox.find(m=>m.offerId===r.id);document.querySelector('[data-inbox-open="'+m.id+'"]').click()}""")
        self.assertTrue(self.page.locator('[data-inbox-action=renewal-open]').is_visible())
        final=self.page.evaluate('structuredClone(FM_RENEWALS.current(renewPid).counter)')
        self.page.locator('[data-inbox-action=renewal-accept]').click()
        self.assertEqual(self.page.evaluate('player(renewPid).salario'),p['wage'])
        self.tomorrow()
        result=self.page.evaluate("""()=>({p:player(renewPid),r:FM_RENEWALS.all().find(r=>r.playerId===renewPid),room:FM_DRESSING_ROOM.ensure().players[renewPid],cash:GameState.userClub.presupuesto_dolares,fees:GameState.finance.ledger.filter(x=>x.category==='contratos'&&x.description?.includes('renovación'))})""")
        self.assertEqual(result['r']['status'],'accepted');self.assertEqual(result['r']['counterRounds'],2)
        self.assertEqual(result['p']['salario'],final['wage']);self.assertEqual(result['cash'],p['cash']-final['bonus'])
        self.assertEqual(result['room']['trust'],67);self.assertEqual(result['room']['minutes'],321);self.assertEqual(result['room']['promise']['status'],'active')
        self.assertEqual(result['room']['role'],final['playingTime'])
        before=self.page.evaluate('GameState.userClub.presupuesto_dolares');self.page.evaluate('FM_RENEWALS.process();FM_RENEWALS.process()')
        self.assertEqual(self.page.evaluate('GameState.userClub.presupuesto_dolares'),before)

    def test_reservations_count_only_raise_and_survive_reload_then_cancel(self):
        p=self.player_fixture()
        r=self.page.evaluate("""()=>{const p=player(renewPid),before=CLUB_AI.reservation(),wages=CLUB_AI.reservedWages('boca'),count=mine().length,result=MARKET_CONTRACTS.renewContract(p.id,{confirmed:true,years:5,wage:p.salario+1000,bonus:2000});return {ok:result.ok,reserved:CLUB_AI.reservation()-before,wages:CLUB_AI.reservedWages('boca')-wages,duplicate:MARKET_CONTRACTS.renewContract(p.id,{confirmed:true}).ok,countSame:mine().length===count}}""")
        self.assertTrue(r['ok']);self.assertEqual(r['reserved'],2000);self.assertEqual(r['wages'],1000);self.assertFalse(r['duplicate']);self.assertTrue(r['countSame'])
        self.page.reload(wait_until='domcontentloaded');self.page.wait_for_selector('aside')
        self.assertTrue(self.page.evaluate('(id)=>!!FM_RENEWALS.current(id)',p['id']))
        self.page.evaluate('(id)=>FM_RENEWALS.respond(FM_RENEWALS.current(id).id,false)',p['id'])
        self.assertEqual(self.page.evaluate('CLUB_AI.reservation()'),0);self.assertEqual(self.page.evaluate("CLUB_AI.reservedWages('boca')"),0)
        self.assertEqual(self.page.evaluate('(id)=>player(id).salario',p['id']),p['wage'])

    def test_budget_expiry_departure_and_counter_errors_leave_old_contract_intact(self):
        p=self.player_fixture()
        self.page.evaluate("""()=>{const p=player(renewPid);MARKET_CONTRACTS.renewContract(p.id,{confirmed:true,years:5,wage:100,bonus:0})}""")
        self.tomorrow()
        result=self.page.evaluate("""()=>{const r=FM_RENEWALS.current(renewPid),b=FM_FINANCES.account().board;b.authorized=0;b.saleAllocation=0;b.spent=0;const before=JSON.stringify(r),reply=FM_RENEWALS.respond(r.id,true);return {ok:reply.ok,reason:reply.reason,unchanged:before===JSON.stringify(r)}}""")
        self.assertFalse(result['ok']);self.assertIn('fondos',result['reason']);self.assertTrue(result['unchanged'])
        self.page.evaluate("""()=>{const r=FM_RENEWALS.current(renewPid);GameState.today=new Date(Date.parse(r.expiresDate)+86400000).toISOString().slice(0,10);FM_RENEWALS.process()}""")
        self.assertFalse(self.page.evaluate('!!FM_RENEWALS.current(renewPid)'));self.assertEqual(self.page.evaluate('player(renewPid).salario'),p['wage'])
        self.assertEqual(self.page.evaluate('MARKET_CONTRACTS.contractEnd(player(renewPid))'),p['end'])

    def test_player_departure_releases_reservations_and_signed_exit_blocks_renewal(self):
        self.player_fixture()
        r=self.page.evaluate("""()=>{const p=player(renewPid),start=MARKET_CONTRACTS.renewContract(p.id,{confirmed:true,years:5,wage:p.salario+500,bonus:1000}),owner=p.clubId;p.clubId='river';WORLD_ENGINE.reindex();FM_RENEWALS.process();const cancelled=!FM_RENEWALS.current(p.id),freed=CLUB_AI.reservation()===0;p.clubId=owner;WORLD_ENGINE.reindex();const s=MARKET_CONTRACTS.ensure();s.registrations.push({offerId:'future-sale',playerId:p.id,status:'agreed',registrationDate:'2026-07-01',offer:{fromClub:owner,toClub:'river'}});const attempt=MARKET_CONTRACTS.renewContract(p.id,{confirmed:true,years:5});return {start:start.ok,cancelled,freed,attempt}}""")
        self.assertTrue(r['start']);self.assertTrue(r['cancelled']);self.assertTrue(r['freed']);self.assertFalse(r['attempt']['ok']);self.assertIn('firmó',r['attempt']['reason'])

    def test_auxiliary_coaching_cannot_push_fractional_attributes_above_99(self):
        self.player_fixture()
        # Only one eligible trainee, close to a real attribute improvement. The
        # six headline values are averages and need not gain a whole point.
        result=self.page.evaluate("""()=>{FM_OFFICE.ensure().profile.stats.entrenamiento=20;for(const p of mine())p.edad=30;const p=mine()[0],keys=['ritmo','tiro','pase','regate','defensa','fisico'];p.edad=20;p.injury=0;p.ban=0;p.registered=true;p.potential=99;FM_MEDICINE.state(p).restUntil=null;for(const key of keys)p[key]=98.75;p.attributes=Object.fromEntries(FM_ATTRIBUTES.keys.map(k=>[k,98.75]));p.attributeBaseline=keys.map(()=>98.75);p.attributeProjection=Array(12).fill(98.75);p.attributeTrainingProgress=Object.fromEntries(FM_ATTRIBUTES.keys.map(k=>[k,.9]));let day=GameState.today;for(let i=1;i<=32;i++){day=new Date(Date.parse(day)+86400000).toISOString().slice(0,10);GameState.today=day;FM_OFFICE.onDay(day)}WORLD_STORAGE.validate(GameState);const values=[...Object.values(FM_ATTRIBUTES.values(p)),...keys.map(k=>p[k])];return {max:Math.max(...values),grew:Object.values(p.attributes).some(n=>n===99)}}""")
        self.assertLessEqual(result['max'],99);self.assertTrue(result['grew'])

    def test_counter_facts_and_only_latest_message_requires_decision(self):
        self.player_fixture()
        self.page.evaluate("""()=>{const p=player(renewPid);p.edad=21;p.contract=2026;p.contractEnd='2026-06-30';FM_INBOX.refreshAlerts(true);window.reminderBody=GameState.inbox.find(m=>m.action==='contract'&&m.playerId===p.id).body;MARKET_CONTRACTS.renewContract(p.id,{confirmed:true,years:1,wage:100,bonus:0})}""")
        self.tomorrow()
        self.page.evaluate("""()=>{view='inbox';render();const r=FM_RENEWALS.current(renewPid),m=GameState.inbox.find(m=>m.id===r.lastMessageId);document.querySelector('[data-inbox-open="'+m.id+'"]').click()}""")
        self.assertIn('3 años',self.page.locator('.fm-inbox-facts').inner_text())
        r=self.page.evaluate("""()=>{const r=FM_RENEWALS.current(renewPid);const decisions=GameState.inbox.filter(m=>m.offerId===r.id&&FM_INBOX.isPending(m)).length;GameState.inbox=GameState.inbox.filter(m=>m.offerId!==r.id);FM_INBOX.ensure();return {decisions,years:r.counter.years,exactDate:reminderBody.includes(date('2026-06-30')),restored:GameState.inbox.filter(m=>m.offerId===r.id&&FM_INBOX.isPending(m)).length}}""")
        self.assertEqual(r['decisions'],1);self.assertEqual(r['years'],3);self.assertTrue(r['exactDate']);self.assertEqual(r['restored'],1)

    def test_repeated_low_offers_end_dialogue_and_impose_reopening_date(self):
        p=self.player_fixture()
        self.page.evaluate("""()=>MARKET_CONTRACTS.renewContract(renewPid,{confirmed:true,years:5,wage:100,bonus:0})""")
        self.tomorrow()
        for _ in range(10):
            if not self.page.evaluate('!!FM_RENEWALS.current(renewPid)'):
                break
            r=self.page.evaluate("""()=>MARKET_CONTRACTS.renewContract(renewPid,{confirmed:true,years:5,wage:100,bonus:0})""")
            self.assertTrue(r['ok']);self.tomorrow()
        self.assertFalse(self.page.evaluate('!!FM_RENEWALS.current(renewPid)'))
        self.assertFalse(self.page.evaluate("MARKET_CONTRACTS.renewContract(renewPid,{confirmed:true,years:5}).ok"))
        self.assertEqual(self.page.evaluate('player(renewPid).salario'),p['wage'])
        self.assertEqual(self.page.evaluate('GameState.userClub.presupuesto_dolares'),p['cash'])

    def test_agreed_end_date_does_not_grow_an_extra_year_at_midnight(self):
        p=self.player_fixture()
        r=self.page.evaluate("""()=>{const p=player(renewPid);GameState.today='2026-12-31';p.contract=2027;p.contractEnd='2027-12-31';const sent=MARKET_CONTRACTS.renewContract(p.id,{confirmed:true,years:1,wage:p.salario*2,bonus:p.salario*12});return {ok:sent.ok,end:sent.negotiation.endDate}}""")
        self.assertTrue(r['ok']);self.assertEqual(r['end'],'2027-12-31');self.tomorrow()
        self.assertEqual(self.page.evaluate('FM_RENEWALS.all().find(r=>r.playerId===renewPid).status'),'accepted')
        self.assertEqual(self.page.evaluate('MARKET_CONTRACTS.contractEnd(player(renewPid))'),'2027-12-31')

    def test_reply_arrives_after_four_real_daily_turns_without_waiting_for_match(self):
        self.player_fixture()
        self.page.evaluate("""()=>MARKET_CONTRACTS.renewContract(renewPid,{confirmed:true,years:5,wage:100,bonus:0})""")
        for _ in range(3):
            self.page.evaluate('WORLD_CLOCK.advance({silent:true})')
            self.assertFalse(self.page.evaluate('FM_RENEWALS.current(renewPid).awaitingUser'))
        self.page.evaluate('WORLD_CLOCK.advance({silent:true})')
        self.assertTrue(self.page.evaluate('FM_RENEWALS.current(renewPid).awaitingUser'))
        self.assertIsNone(self.page.evaluate('GameState.match'))

    def test_form_stays_in_view_and_switches_to_invalid_bonus_tab(self):
        self.player_fixture();self.page.evaluate('renew(renewPid)')
        for w,h in [(1280,720),(390,844)]:
            self.page.set_viewport_size({'width':w,'height':h});r=self.page.locator('#contract-renewal button[type=submit]').bounding_box();self.assertGreaterEqual(r['y'],0);self.assertLessEqual(r['y']+r['height'],h)
        self.page.locator('[data-renew-pane=bonuses]').click();self.page.fill('#contract-renewal [name=appearanceBonus]','-1');self.page.locator('[data-renew-pane=terms]').click()
        self.page.click('#contract-renewal button[type=submit]')
        self.assertTrue(self.page.locator('#contract-renewal [name=appearanceBonus]').is_visible());self.assertTrue(self.page.locator('[data-offer-feedback]').is_visible())
        self.assertFalse(self.page.evaluate('!!FM_RENEWALS.current(renewPid)'))

if __name__=='__main__':unittest.main()
