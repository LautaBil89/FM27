"""Unexpected situations use real inbox choices and persisted daily rolls."""
import unittest
import test_offer_form as fixture

class UnexpectedEvents(unittest.TestCase):
    setUpClass=classmethod(fixture.OfferFormScenarios.setUpClass.__func__)
    tearDownClass=classmethod(fixture.OfferFormScenarios.tearDownClass.__func__)
    setUp=fixture.OfferFormScenarios.setUp
    tearDown=fixture.OfferFormScenarios.tearDown
    seed=fixture.OfferFormScenarios.seed

    def test_inbox_decision_charges_once_and_survives_reload(self):
        data=self.page.evaluate("""()=>{const e=FM_INCIDENTS.create('boots');const p=mine()[0];p.moral=50;const cash=CLUB_AI.cash(),m=GameState.inbox.find(m=>m.incidentId===e.id);view='inbox';render();return{id:e.id,message:m.id,cash,unit:e.unit,p:p.id}}""")
        self.page.click(f'[data-inbox-open="{data["message"]}"]')
        self.page.click('[data-inbox-action="incident:a"]')
        result=self.page.evaluate("""id=>({status:FM_INCIDENTS.get(id).status,cash:CLUB_AI.cash(),again:FM_INCIDENTS.resolve(id,'a').ok,moral:mine()[0].moral})""",data['id'])
        self.assertEqual(result['status'],'resolved');self.assertFalse(result['again'])
        self.assertEqual(result['cash'],data['cash']-data['unit']);self.assertEqual(result['moral'],52)
        self.page.evaluate('saveGame(true)');self.page.reload(wait_until='domcontentloaded')
        self.page.wait_for_function('GameState?.version===3')
        self.assertEqual(self.page.evaluate('id=>FM_INCIDENTS.get(id).status',data['id']),'resolved')

    def test_daily_probability_cooldowns_expiry_and_all_25_effects(self):
        result=self.page.evaluate("""()=>{let failures=[];for(const d of FM_INCIDENTS.definitions){const e=FM_INCIDENTS.create(d.id);if(!e||FM_INCIDENTS.choices(e.id).length!==2||!FM_INCIDENTS.resolve(e.id,'b').ok)failures.push(d.id);}delete GameState.world.incidents;FM_INCIDENTS.onDay(GameState.today,()=>.99);FM_INCIDENTS.onDay(GameState.today,()=>0);const sameDay=GameState.world.incidents.history.length;const next=new Date(Date.parse(GameState.today+'T12:00:00Z')+86400000).toISOString().slice(0,10);GameState.today=next;FM_INCIDENTS.onDay(next,()=>0);const e=GameState.world.incidents.history[0];GameState.today=new Date(Date.parse(e.deadline+'T12:00:00Z')+86400000).toISOString().slice(0,10);FM_INCIDENTS.onDay(GameState.today,()=>.99);const cash=CLUB_AI.cash();FM_INCIDENTS.onDay(GameState.today,()=>0);return{failures,count:FM_INCIDENTS.definitions.length,sameDay,status:e.status,cashUnchanged:cash===CLUB_AI.cash(),weights:FM_INCIDENTS.definitions.map(d=>d.weight)}}""")
        self.assertEqual(result['count'],25);self.assertEqual(result['failures'],[])
        self.assertEqual(result['sameDay'],0);self.assertEqual(result['status'],'expired');self.assertTrue(result['cashUnchanged'])
        self.assertGreater(result['weights'][0],result['weights'][-1]*90)

    def test_unaffordable_and_live_match_choices_are_atomic(self):
        result=self.page.evaluate("""()=>{const e=FM_INCIDENTS.create('boots');GameState.userClub.presupuesto_dolares=0;const moral=mine()[0].moral;const failed=FM_INCIDENTS.resolve(e.id,'a');GameState.match={paused:true};const live=FM_INCIDENTS.resolve(e.id,'b');GameState.match=null;return{failed:failed.ok,live:live.ok,status:e.status,moralUnchanged:moral===mine()[0].moral,cash:CLUB_AI.cash()}}""")
        self.assertFalse(result['failed']);self.assertFalse(result['live']);self.assertEqual(result['status'],'pending');self.assertTrue(result['moralUnchanged']);self.assertEqual(result['cash'],0)

    def test_changing_employer_cancels_old_decision(self):
        result=self.page.evaluate("""()=>{const e=FM_INCIDENTS.create('sponsor');FM_DEPTH.switchClub('river');FM_INCIDENTS.ensureMessages();return{status:e.status,action:FM_INCIDENTS.resolve(e.id,'a').ok,pending:FM_INCIDENTS.pending(e.id),messages:GameState.inbox.filter(m=>m.incidentId===e.id).length}}""")
        self.assertEqual(result['status'],'cancelled');self.assertFalse(result['action']);self.assertFalse(result['pending']);self.assertEqual(result['messages'],0)

    def test_automatic_continue_stops_when_a_daily_situation_arrives(self):
        self.page.evaluate("""()=>{const original=FM_INCIDENTS.onDay;window.incidentCalls=0;FM_INCIDENTS.onDay=day=>{window.incidentCalls++;return original(day,()=>0)};WORLD_CLOCK.ensure().slot=3;FM_OFFICE.start()}""")
        self.page.wait_for_function('!FM_OFFICE.running.active&&FM_OFFICE.running.turns>0',timeout=30000)
        result=self.page.evaluate("""()=>({calls:window.incidentCalls,turns:FM_OFFICE.running.turns,events:GameState.world.incidents?.history.length,pending:GameState.inbox.some(m=>m.action==='incident'&&FM_INBOX.isPending(m))})""")
        self.assertEqual(result['calls'],1);self.assertEqual(result['turns'],1)
        self.assertEqual(result['events'],1);self.assertTrue(result['pending'])
