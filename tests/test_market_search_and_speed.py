"""Typing preserves its DOM node and match pace has a genuinely slower 1x."""
import unittest
import test_offer_form as fixture

class MarketSearchAndSpeed(unittest.TestCase):
    setUpClass=classmethod(fixture.OfferFormScenarios.setUpClass.__func__)
    tearDownClass=classmethod(fixture.OfferFormScenarios.tearDownClass.__func__)
    setUp=fixture.OfferFormScenarios.setUp
    tearDown=fixture.OfferFormScenarios.tearDown
    seed=fixture.OfferFormScenarios.seed

    def market(self):
        self.page.evaluate("view='market';render()")

    def test_typing_across_debounce_keeps_focus_node_and_selection(self):
        self.market()
        field=self.page.locator('#marketQuery')
        self.page.evaluate("window.searchNode=document.getElementById('marketQuery')")
        field.press_sequentially('Albornoz',delay=230)
        self.page.wait_for_timeout(250)
        result=self.page.evaluate("""()=>({same:window.searchNode===document.getElementById('marketQuery'),focus:document.activeElement.id,query:marketQuery,value:searchNode.value,caret:searchNode.selectionStart,rows:[...document.querySelectorAll('.fm-table-card tbody tr')].map(n=>n.textContent)})""")
        self.assertTrue(result['same']);self.assertEqual(result['focus'],'marketQuery')
        self.assertEqual(result['query'],'Albornoz');self.assertEqual(result['value'],'Albornoz');self.assertEqual(result['caret'],8)
        self.assertTrue(result['rows']);self.assertTrue(all('albornoz' in n.lower() for n in result['rows']))
        field.press('Home');field.press_sequentially('Patricio ',delay=20)
        self.page.wait_for_timeout(250)
        self.assertEqual(field.input_value(),'Patricio Albornoz')
        self.assertEqual(self.page.evaluate('document.activeElement.selectionStart'),9)

    def test_focused_search_survives_other_redraw_and_click_is_not_swallowed(self):
        self.market();field=self.page.locator('#marketQuery');field.fill('Patricio Albornoz')
        self.page.wait_for_timeout(250)
        self.page.evaluate("document.getElementById('marketQuery').setSelectionRange(2,7,'backward');render()")
        self.assertEqual(self.page.evaluate('document.activeElement.id'),'marketQuery')
        self.assertEqual(self.page.evaluate('[document.activeElement.selectionStart,document.activeElement.selectionEnd,document.activeElement.selectionDirection]'),[2,7,'backward'])
        self.page.locator('[data-buy="1068088"]').click()
        self.page.wait_for_selector('#negotiation')

    def test_new_1x_is_three_times_slower_than_3x_with_live_interval(self):
        self.page.evaluate("""()=>{const e=WORLD_CLOCK.nextFixture();GameState.today=e.date;WORLD_CLOCK.ensure().slot=WORLD_CLOCK.eventSlot(e);startMatch();clearInterval(timer);timer=null;GameState.match.paused=true;view='match';render()}""")
        self.assertEqual(self.page.locator('#speed').input_value(),'1500')
        options=self.page.locator('#speed option').evaluate_all('(nodes)=>nodes.map(n=>({value:Number(n.value),label:n.textContent}))')
        self.assertEqual([o['value'] for o in options],[1500,500,150,50])
        self.page.evaluate("""()=>{window.realInterval=window.setInterval;window.intervalDelays=[];window.setInterval=(fn,delay)=>{intervalDelays.push(delay);return realInterval(fn,delay)}}""")
        self.page.click('[data-action="play"]')
        self.page.select_option('#speed','500')
        self.page.select_option('#speed','1500')
        result=self.page.evaluate("""()=>{const result={delays:intervalDelays.slice(),paused:GameState.match.paused};clearInterval(timer);timer=null;GameState.match.paused=true;window.setInterval=realInterval;return result}""")
        self.assertFalse(result['paused']);self.assertEqual(result['delays'][-3:],[1500,500,1500])
