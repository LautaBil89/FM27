"""Browser checks for the visual desk, real career data and bounded navigation."""
import unittest
import test_offer_form as fixture


class VisualWorkspace(unittest.TestCase):
    setUpClass = classmethod(fixture.OfferFormScenarios.setUpClass.__func__)
    tearDownClass = classmethod(fixture.OfferFormScenarios.tearDownClass.__func__)
    setUp = fixture.OfferFormScenarios.setUp
    tearDown = fixture.OfferFormScenarios.tearDown
    seed = fixture.OfferFormScenarios.seed

    def test_dashboard_panels_and_primary_match_action_fit(self):
        for width,height in [(1920,1080),(1440,900),(1366,768),(900,768),(390,844),(360,640)]:
            self.page.set_viewport_size({'width':width,'height':height})
            self.page.evaluate('()=>{FM_VISUAL.ui.dashboard="overview";view="dashboard";render()}')
            r=self.page.locator('.world-next-match-actions button').bounding_box()
            self.assertLessEqual(r['y']+r['height'],height+1)
            self.assertGreaterEqual(r['y'],0)
            if width<=650:
                for tab in ['club','agenda','overview']:
                    self.page.click('[data-v-dashboard="'+tab+'"]')
                    self.assertEqual(self.page.locator('[data-v-dashboard="'+tab+'"]').get_attribute('aria-pressed'),'true')
                self.assertEqual(self.page.locator('.v-match-hero').is_visible(),True)
            self.assertTrue(self.page.evaluate('document.documentElement.scrollHeight<=innerHeight+1&&document.documentElement.scrollWidth<=innerWidth+1'))
        self.page.click('.world-next-match-actions button')
        self.assertEqual(self.page.evaluate('view'),'match')
        self.page.set_viewport_size({'width':1440,'height':900})
        self.page.evaluate('()=>{view="dashboard";render()}')
        rival=self.page.locator('.v-agenda-list [data-world-club]').first
        club=rival.get_attribute('data-world-club')
        rival.click()
        self.assertEqual(self.page.evaluate('WORLD_UI.state.worldClub'),club)
        self.assertEqual(self.page.evaluate('view'),'tables')

    def test_dashboard_message_opens_exact_reader_and_marks_read(self):
        self.page.evaluate('()=>{FM_VISUAL.ui.dashboard="overview";view="dashboard";render()}')
        message=self.page.locator('[data-v-message]').first
        target=int(message.get_attribute('data-v-message'))
        message.click()
        self.assertEqual(self.page.evaluate('view'),'inbox')
        self.assertEqual(self.page.evaluate('GameState.world.inboxUI.selected'),target)
        self.assertTrue(self.page.evaluate('(id)=>GameState.inbox.find(m=>m.id===id).read',target))
        self.assertFalse(self.page.locator('.fm-inbox-reader .v-empty-inbox').count())
        self.page.set_viewport_size({'width':390,'height':844})
        self.page.wait_for_selector('[data-ws-key="inbox-mobile"][data-ws-tab="reading"]')
        self.assertEqual(self.page.evaluate('GameState.world.inboxUI.selected'),target)

    def test_visual_player_attributes_do_not_reveal_scouting_secrets(self):
        r=self.page.evaluate('()=>{const p=mine()[0];FM_PLAYER.open(p.id);return {id:p.id,pace:p.ritmo}}')
        radar=self.page.locator('.v-radar svg')
        self.assertIn('Ritmo: '+str(r['pace']),radar.get_attribute('aria-label'))
        self.assertEqual(self.page.locator('.fp-monogram .v-shirt').count(),1)
        other=self.page.evaluate('GameState.players.find(p=>p.clubId&&p.clubId!==GameState.userClub.id).id')
        self.page.evaluate('(id)=>FM_PLAYER.open(id)',other)
        self.assertEqual(self.page.locator('.v-radar').count(),0)

    def test_finance_chart_uses_recorded_cash_and_fits_its_card(self):
        r=self.page.evaluate('''()=>{const b=FM_FINANCES.account(),before=b.trackedCash;GameState.userClub.presupuesto_dolares+=20000;FM_FINANCES.recordCash(GameState.userClub.id,20000,'Ingreso de prueba','patrocinio');view='finances';FM_FINANCES.ui.tab='summary';render();return {delta:b.trackedCash-before,rows:b.ledger.length}}''')
        self.assertEqual(r,{'delta':20000,'rows':1})
        self.assertIn('saldo final',self.page.locator('.v-cash-chart svg').get_attribute('aria-label'))
        self.assertTrue(self.page.evaluate('''()=>{const c=document.querySelector('.v-cash-chart').getBoundingClientRect();return [...document.querySelector('.v-cash-chart').children].every(n=>{const b=n.getBoundingClientRect();return b.top>=c.top&&b.bottom<=c.bottom+1})}'''))
        self.assertEqual(self.page.evaluate('FM_FINANCES.account().ledger.length'),1)

    def test_weekly_training_and_scouting_empty_state_are_actionable(self):
        self.page.evaluate('()=>{view="training";render()}')
        self.assertEqual(self.page.locator('.v-training-week tbody tr').count(),7)
        self.assertEqual(self.page.locator('.v-load-bars').count(),7)
        self.page.evaluate('()=>{view="scouting";render()}')
        self.page.locator('.v-empty-state [data-view="market"]').click()
        self.assertEqual(self.page.evaluate('view'),'market')
        self.assertTrue(self.page.locator('#marketQuery').is_visible())

    def test_decoration_is_idempotent_and_does_not_replace_search_control(self):
        self.page.evaluate('()=>{view="market";render();window.visualSearch=document.getElementById("marketQuery");for(let i=0;i<10;i++)FM_VISUAL.decorate()}')
        self.assertEqual(self.page.locator('.v-context').count(),1)
        self.assertEqual(self.page.locator('.v-nav-label').count(),3)
        self.assertTrue(self.page.evaluate('visualSearch===document.getElementById("marketQuery")'))
        self.assertTrue(self.page.evaluate('''()=>[...document.querySelectorAll('table button[data-player]')].every(b=>b.querySelectorAll('.v-player-initial').length===1)'''))

    def test_batched_market_sort_preserves_each_order_and_refreshes_observations(self):
        r=self.page.evaluate('''()=>{const f=FM_MARKET_FILTERS.get(),sample=GameState.players.filter(p=>p.clubId!==GameState.userClub.id).slice(0,70),checks=[];for(const sort of ['quality','potential','name','age','value','wage','goals','assists','condition','coverage'])for(const direction of ['asc','desc']){f.sort=sort;f.direction=direction;const expected=sample.slice().sort((a,b)=>FM_MARKET_FILTERS.compare(a,b)).map(p=>p.id),actual=FM_MARKET_FILTERS.sortPlayers(sample).map(p=>p.id);checks.push({sort,direction,ok:JSON.stringify(actual)===JSON.stringify(expected)});}const p=mine()[0],members=mine();f.sort='quality';f.direction='desc';FM_MARKET_FILTERS.sortPlayers(members);p.ritmo=99;p.tiro=99;p.pase=99;p.regate=99;p.defensa=99;p.fisico=99;const updated=FM_MARKET_FILTERS.sortPlayers(members),expected=members.slice().sort((a,b)=>FM_MARKET_FILTERS.compare(a,b));return {checks,fresh:updated.map(p=>p.id).join()===expected.map(p=>p.id).join(),first:updated[0].id,target:p.id}}''')
        self.assertTrue(all(c['ok'] for c in r['checks']),r)
        self.assertTrue(r['fresh'],r)
        self.assertEqual(r['first'],r['target'])


if __name__=='__main__':unittest.main(verbosity=2)
