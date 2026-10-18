"""Real controls for saved searches, contextual follow-up and archived match reports."""
import unittest
import test_offer_form as fixture

class ManagerWorkspaceDepth(unittest.TestCase):
    setUpClass=classmethod(fixture.OfferFormScenarios.setUpClass.__func__)
    tearDownClass=classmethod(fixture.OfferFormScenarios.tearDownClass.__func__)
    setUp=fixture.OfferFormScenarios.setUp
    tearDown=fixture.OfferFormScenarios.tearDown
    seed=fixture.OfferFormScenarios.seed

    def test_named_multi_position_or_search_and_columns_survive_reload(self):
        self.page.evaluate("view='market';render()")
        self.page.click('[data-market-filters-open="market"]')
        self.page.check('[data-mf-position="DFC"]');self.page.check('[data-mf-position="MCD"]')
        self.page.click('[data-mf-tab="advanced"]')
        self.page.select_option('[data-mf-key="sort"]','age');self.page.select_option('[data-mf-key="direction"]','asc')
        self.page.uncheck('[data-mf-column="wage"]')
        self.page.click('[data-mf-add-group]')
        self.page.select_option('[data-mf-group="0"][data-mf-condition="0"][data-mf-condition-key="field"]','age')
        self.page.select_option('[data-mf-group="0"][data-mf-condition="0"][data-mf-condition-key="op"]','lte')
        self.page.fill('[data-mf-group="0"][data-mf-condition="0"][data-mf-condition-key="value"]','23')
        self.page.click('[data-mf-add-condition="0"]')
        self.page.select_option('[data-mf-group="0"][data-mf-condition="1"][data-mf-condition-key="field"]','nationality')
        self.page.fill('[data-mf-group="0"][data-mf-condition="1"][data-mf-condition-key="value"]','Paraguay')
        self.page.fill('[data-mf-preset-name]','Centrales y pivotes jóvenes o paraguayos')
        self.page.click('[data-mf-save-preset]')
        self.assertIn('guardada',self.page.locator('[data-mf-preset-notice]').inner_text())
        self.page.click('#market-filter-form [type="submit"]')
        result=self.page.evaluate("""()=>{FM_MARKET_FILTERS.prepare();const pool=GameState.players.filter(p=>p.clubId!==GameState.userClub.id),actual=pool.filter(p=>FM_MARKET_FILTERS.matches(p)).sort((a,b)=>FM_MARKET_FILTERS.compare(a,b)),expected=pool.filter(p=>FM_PLAYER.naturalPositions(p).some(x=>['DFC','MCD'].includes(x))&&(p.edad<=23||(p.nationalities||[p.nacionalidad]).includes('Paraguay')));return {actual:actual.map(p=>p.id).sort((a,b)=>a-b),expected:expected.map(p=>p.id).sort((a,b)=>a-b),ages:actual.map(p=>p.edad),columns:FM_MARKET_FILTERS.columns(),saved:FM_MARKET_FILTERS.presets()}}""")
        self.assertEqual(result['actual'],result['expected']);self.assertGreater(len(result['actual']),0)
        self.assertEqual(result['ages'],sorted(result['ages']));self.assertNotIn('wage',result['columns'])
        self.assertEqual(len(result['saved']),1)
        self.assertEqual(self.page.locator('.fm-table-card thead th').count(),6)
        self.page.evaluate('saveGame(true)');self.page.reload(wait_until='domcontentloaded')
        self.page.wait_for_function('GameState?.version===3');self.page.evaluate("view='market';render()")
        self.page.click('[data-market-filters-open="market"]')
        self.page.select_option('[data-mf-preset]',result['saved'][0]['id']);self.page.click('[data-mf-load-preset]')
        self.assertTrue(self.page.is_checked('[data-mf-position="DFC"]'))
        self.page.click('[data-mf-delete-preset]');self.assertEqual(self.page.evaluate('FM_MARKET_FILTERS.presets().length'),0)
        self.page.keyboard.press('Escape')

    def test_contextual_player_situation_has_persisted_once_only_followup(self):
        data=self.page.evaluate("""()=>{for(const p of mine())p.moral=80;const p=mine().find(p=>!p.loanId);p.moral=20;const e=FM_INCIDENTS.create('family'),before=CLUB_AI.cash();const result=FM_INCIDENTS.resolve(e.id,'a');return{id:e.id,player:p.id,other:mine().find(q=>q.id!==p.id).id,before,after:CLUB_AI.cash(),unit:e.unit,due:e.followup.dueDate,ok:result.ok,moral:p.moral,context:e.context};}""")
        self.assertTrue(data['ok']);self.assertEqual(data['moral'],23);self.assertEqual(data['context']['playerId'],data['player'])
        self.assertEqual(data['before']-data['after'],round(data['unit']*.7))
        self.page.evaluate('saveGame(true)');self.page.reload(wait_until='domcontentloaded');self.page.wait_for_function('GameState?.version===3')
        result=self.page.evaluate("""d=>{GameState.today=d.due;FM_INCIDENTS.onDay(d.due,()=>.99);const e=FM_INCIDENTS.get(d.id),moral=player(d.player).moral,cash=CLUB_AI.cash();FM_INCIDENTS.onDay(d.due,()=>.99);return{status:e.followup.status,moral,other:player(d.other).moral,once:player(d.player).moral===moral&&CLUB_AI.cash()===cash,messages:GameState.inbox.filter(m=>m.sourceKey==='incident-followup:'+d.id).length,birthday:FM_INCIDENTS.eligible('birthday'),again:FM_INCIDENTS.resolve(d.id,'a').ok}}""",data)
        self.assertEqual(result['status'],'applied');self.assertEqual(result['moral'],26);self.assertEqual(result['other'],80)
        self.assertTrue(result['once']);self.assertEqual(result['messages'],1);self.assertFalse(result['again'])
        removed=self.page.evaluate("""()=>{const e=FM_INCIDENTS.create('family');const target=player(e.context.playerId);target.clubId=null;FM_INCIDENTS.ensureMessages();return{status:e.status,allowed:FM_INCIDENTS.choices(e.id).length}}""")
        self.assertEqual(removed,{'status':'cancelled','allowed':0})

    def test_match_reports_keep_their_own_notes_tactics_and_inbox_fixture(self):
        data=self.page.evaluate("""()=>{const e=WORLD_CLOCK.nextFixture();GameState.today=e.date;WORLD_CLOCK.ensure().slot=WORLD_CLOCK.eventSlot(e);startMatch();clearInterval(timer);timer=null;const m=GameState.match;m.paused=true;const initial=GameState.tactics.style;m.minute=45;GameState.tactics.style=initial==='Tiki-Taka'?'Garra/Huevo':'Tiki-Taka';render();for(const id of Object.keys(m.ratings)){m.minutesPlayed[id]=90;m.ratings[id]=7.7;}m.feed=[{minute:90,text:'Relato del primer encuentro'},{minute:15,text:'Gol conservado'}];m.minute=90;m.done=true;WORLD_ENGINE.recordLiveMatch(m,{home:2,away:1});const first=FM_MATCH_ARCHIVE.get(e.id),message=GameState.inbox.find(x=>x.fixtureId===e.id),p=first.players[0];GameState.match=null;const second={...m,eventId:e.id+'-test-second',feed:[{minute:90,text:'Otro encuentro'}],ratings:Object.fromEntries(Object.keys(m.ratings).map(id=>[id,5.5]))};FM_MATCH_ARCHIVE.record(second,{home:0,away:0},{...e,id:second.eventId});view='inbox';render();return{id:first.fixtureId,second:second.eventId,message:message.id,player:p.id,initial,decisionCount:first.decisions.length,firstNote:first.players[0].rating,secondNote:FM_MATCH_ARCHIVE.get(second.eventId).players[0].rating,records:FM_MATCH_ARCHIVE.playerRecords(p.id).length,reportCount:FM_MATCH_ARCHIVE.list().length}}""")
        self.assertEqual(data['firstNote'],7.7);self.assertEqual(data['secondNote'],5.5);self.assertGreater(data['decisionCount'],0);self.assertEqual(data['records'],2)
        self.page.click('[data-inbox-open="'+str(data['message'])+'"]');self.page.click('[data-inbox-action="report"]')
        self.assertIn('Relato del primer encuentro',self.page.locator('.fm-inbox-reader').inner_text())
        self.assertNotIn('Otro encuentro',self.page.locator('.fm-inbox-reader').inner_text())
        self.page.evaluate('saveGame(true)');self.page.reload(wait_until='domcontentloaded');self.page.wait_for_function('GameState?.version===3')
        self.assertEqual(self.page.evaluate('(id)=>FM_MATCH_ARCHIVE.get(id).players[0].rating',data['id']),7.7)
        self.page.evaluate("view='archive';render()")
        self.page.locator('[data-match-archive="'+data['id']+'"]').click()
        self.assertTrue(self.page.locator('.ma-dialog').is_visible())
        self.assertIn('Relato del primer encuentro',self.page.locator('.ma-dialog').inner_text())
        self.page.set_viewport_size({'width':390,'height':844})
        rect=self.page.locator('.ma-dialog').evaluate('e=>{const r=e.getBoundingClientRect();return [r.left,r.right,innerWidth]}')
        self.assertGreaterEqual(rect[0],0);self.assertLessEqual(rect[1],rect[2]);self.page.click('[data-match-archive-close]')
