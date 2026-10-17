"""Use the filter dialog, including cancel, combinations and observed attributes."""
import unittest
import test_offer_form as fixture


class MarketFilters(unittest.TestCase):
    setUpClass=classmethod(fixture.OfferFormScenarios.setUpClass.__func__)
    tearDownClass=classmethod(fixture.OfferFormScenarios.tearDownClass.__func__)
    setUp=fixture.OfferFormScenarios.setUp
    tearDown=fixture.OfferFormScenarios.tearDown
    seed=fixture.OfferFormScenarios.seed

    def market(self):
        self.page.evaluate("view='market';render()")

    def open(self, scope='market'):
        self.page.click('[data-market-filters-open="'+scope+'"]')
        self.assertTrue(self.page.locator('#market-filters-dialog').is_visible())

    def apply(self):
        self.page.click('#market-filter-form [type="submit"]')
        self.assertFalse(self.page.locator('#market-filters-dialog').count())

    def test_combined_exact_position_dual_nationality_location_age_and_wage(self):
        self.market()
        target=self.page.evaluate("""()=>{
          const p=GameState.players.find(p=>p.clubId&&p.clubId!==GameState.userClub.id&&p.nationalities?.length>1&&FM_PLAYER.naturalPositions(p).includes('LD'));
          if(!p)throw Error('Missing real dual-national fullback fixture');
          const c=club(p.clubId);return {id:p.id,age:p.edad,nation:p.nationalities[1],country:c.country,league:c.leagueId,club:c.id,wage:p.salario};
        }""")
        self.open()
        self.page.select_option('[data-mf-key="position"]','LD')
        self.page.select_option('[data-mf-key="nationality"]',target['nation'])
        self.page.fill('[data-mf-key="ageMin"]',str(target['age']))
        self.page.fill('[data-mf-key="ageMax"]',str(target['age']))
        self.page.select_option('[data-mf-key="country"]',target['country'])
        self.page.select_option('[data-mf-key="league"]',target['league'])
        self.page.select_option('[data-mf-key="club"]',target['club'])
        self.page.click('[data-mf-tab="contract"]')
        self.page.fill('[data-mf-key="wageMax"]',str(target['wage']))
        self.apply()
        result=self.page.evaluate("""target=>{
          const f=FM_MARKET_FILTERS.prepare('market'),all=GameState.players.filter(p=>p.clubId!==GameState.userClub.id&&FM_MARKET_FILTERS.matches(p));
          return {count:all.length,has:all.some(p=>p.id===target.id),valid:all.every(p=>FM_PLAYER.naturalPositions(p).includes('LD')&&p.nationalities.includes(target.nation)&&p.edad===target.age&&p.clubId===target.club&&p.salario<=target.wage),rows:[...document.querySelectorAll('.fm-table-card [data-player]')].map(n=>Number(n.dataset.player))};
        }""",target)
        self.assertGreater(result['count'],0);self.assertTrue(result['has']);self.assertTrue(result['valid'])
        self.assertIn(target['id'],result['rows'])
        self.assertTrue(self.page.locator('[data-market-filters-clear="market"]').is_visible())

    def test_drafts_cancel_invalid_ranges_and_clear_are_atomic(self):
        self.market();self.open()
        self.page.select_option('[data-mf-key="position"]','POR');self.page.keyboard.press('Escape')
        self.assertEqual(self.page.evaluate('FM_MARKET_FILTERS.get().position'),'ALL')
        self.open();self.page.fill('[data-mf-key="ageMin"]','30');self.page.fill('[data-mf-key="ageMax"]','20')
        self.page.click('#market-filter-form [type="submit"]')
        self.assertTrue(self.page.locator('.mf-error').is_visible())
        self.assertIn('mínimo',self.page.locator('.mf-error').inner_text())
        self.assertEqual(self.page.evaluate('FM_MARKET_FILTERS.get().ageMin'),'')
        self.page.fill('[data-mf-key="ageMin"]','18');self.apply()
        self.assertEqual(self.page.evaluate('FM_MARKET_FILTERS.get().ageMax'),20)
        self.open();self.page.click('[data-mf-reset]');self.page.keyboard.press('Escape')
        self.assertEqual(self.page.evaluate('FM_MARKET_FILTERS.get().ageMax'),20)
        self.page.click('[data-market-filters-clear="market"]')
        self.assertEqual(self.page.evaluate('FM_MARKET_FILTERS.get().ageMax'),'')
        self.assertFalse(self.page.locator('[data-market-filters-clear="market"]').count())

    def test_specific_attributes_use_observations_and_scans_do_not_create_dossiers(self):
        self.market()
        target=self.page.evaluate("""()=>{
          const p=GameState.players.find(p=>p.clubId&&p.clubId!==GameState.userClub.id&&!GameState.world.scoutNetwork?.players?.[p.id]?.[GameState.userClub.id]);
          const before=Object.keys(GameState.world.scoutNetwork?.players||{}).length;
          for(const q of GameState.players)FM_SCOUT_NETWORK.filterSnapshot(q);
          const after=Object.keys(GameState.world.scoutNetwork?.players||{}).length;
          const observed=FM_SCOUT_NETWORK.filterSnapshot(p),a=FM_PLAYER.attributes({...p,...observed.attributes},{observed:false}),score=Math.max(1,Math.round(a.pase/5));
          const oldPotential=p.potential;p.potential=1;const first=FM_SCOUT_NETWORK.filterSnapshot(p).potential;p.potential=99;const second=FM_SCOUT_NETWORK.filterSnapshot(p).potential;p.potential=oldPotential;
          return {id:p.id,name:p.nombre,score,before,after,first,second};
        }""")
        self.assertEqual(target['before'],target['after']);self.assertEqual(target['first'],target['second'])
        self.open();self.page.click('[data-mf-tab="football"]');self.page.click('[data-mf-add-rule]')
        self.page.select_option('[data-mf-rule="0"][data-mf-rule-key="attribute"]','pase')
        self.page.fill('[data-mf-rule="0"][data-mf-rule-key="min"]',str(target['score']))
        self.page.fill('[data-mf-rule="0"][data-mf-rule-key="max"]',str(target['score']))
        self.apply()
        self.assertTrue(self.page.evaluate('(id)=>FM_MARKET_FILTERS.matches(player(id))',target['id']))
        self.page.locator('#marketQuery').fill(target['name']);self.page.wait_for_timeout(250)
        self.assertTrue(self.page.locator('.fm-table-card [data-player="'+str(target['id'])+'"]').count())
        self.open();self.page.click('[data-mf-tab="football"]');self.page.click('[data-mf-remove-rule="0"]');self.apply()
        self.assertEqual(self.page.evaluate('FM_MARKET_FILTERS.get().rules'),[])

    def test_scouting_has_separate_filters_and_applied_values_survive_reload(self):
        ids=self.page.evaluate("""()=>{
          const a=GameState.players.find(p=>p.clubId!==GameState.userClub.id&&FM_PLAYER.naturalPositions(p).includes('POR'));
          const b=GameState.players.find(p=>p.clubId!==GameState.userClub.id&&FM_PLAYER.naturalPositions(p).includes('DC'));
          GameState.scouting.shortlist=[a.id,b.id];return {keeper:a.id,striker:b.id};
        }""")
        self.market();self.open();self.page.select_option('[data-mf-key="position"]','DC');self.apply()
        self.page.evaluate("view='scouting';render()")
        self.open('scouting');self.page.select_option('[data-mf-key="position"]','POR');self.apply()
        self.assertEqual(self.page.locator('.depth-scout [data-player]').count(),1)
        self.assertEqual(self.page.locator('.depth-scout [data-player]').get_attribute('data-player'),str(ids['keeper']))
        self.page.evaluate('saveGame(true)');self.page.reload(wait_until='domcontentloaded')
        self.market();self.open();self.assertEqual(self.page.locator('[data-mf-key="position"]').input_value(),'DC')
        self.page.keyboard.press('Escape');self.page.evaluate("view='scouting';render()")
        self.open('scouting');self.assertEqual(self.page.locator('[data-mf-key="position"]').input_value(),'POR')

    def test_mobile_dialog_remains_in_viewport_and_hidden_invalid_fields_are_explained(self):
        self.page.set_viewport_size({'width':390,'height':844});self.market();self.open()
        rect=self.page.locator('#market-filters-dialog').evaluate('e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:innerWidth,height:innerHeight}}')
        self.assertGreaterEqual(rect['left'],0);self.assertLessEqual(rect['right'],rect['width'])
        self.assertGreaterEqual(rect['top'],0);self.assertLessEqual(rect['bottom'],rect['height'])
        self.page.click('[data-mf-tab="condition"]');self.page.fill('[data-mf-key="conditionMin"]','101')
        self.page.click('[data-mf-tab="identity"]');self.page.click('#market-filter-form [type="submit"]')
        self.assertTrue(self.page.locator('#mf-panel-condition').is_visible());self.assertTrue(self.page.locator('.mf-error').is_visible())
        self.page.fill('[data-mf-key="conditionMin"]','90');self.apply()
        self.assertTrue(self.page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
