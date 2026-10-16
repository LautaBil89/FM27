"""Real browser seasons, interdivision games and compressed save compatibility."""
import os
import shutil
import unittest

from playwright.sync_api import sync_playwright

URL = os.environ.get('FM27_TEST_URL', 'http://127.0.0.1:8000/index.html')


class PyramidIntegration(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pw = sync_playwright().start()
        cls.browser = cls.pw.chromium.launch(
            executable_path=os.environ.get('FM27_CHROMIUM') or shutil.which('chromium'),
            headless=True, args=['--no-sandbox', '--disable-dev-shm-usage'])

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.pw.stop()

    def setUp(self):
        self.context = self.browser.new_context(viewport={'width': 1366, 'height': 768})
        self.page = self.context.new_page()
        self.errors = []
        self.page.on('pageerror', lambda e: self.errors.append(str(e)))
        self.page.on('dialog', lambda d: d.accept())
        self.page.route('https://**/*', lambda route: route.abort())
        self.page.goto(URL, wait_until='domcontentloaded')

    def tearDown(self):
        self.context.close()
        self.assertEqual(self.errors, [])

    def season(self, lower_id):
        self.page.evaluate('''id=>{
            const c=WORLD_DATABASE.leagues.find(l=>l.id===id).clubIds[0];
            WORLD_ENGINE.createWorldCareer('DT integración ascensos',c,'Buscar el ascenso',{competitionFormat:'realistic',calendarMode:'realistic'});
        }''', lower_id)
        # The simulation uses the production result processor and medical/statistical hooks.
        # It stops before promotion games so the disputed upper/lower membership is saved.
        disputed = self.page.evaluate('''id=>{
            const upper=FM_PYRAMIDS.rules[id].upper,ids=new Set([id,upper]),before=Object.fromEntries([...ids].map(l=>[l,WORLD_ENGINE.league(l).clubIds.length]));
            let count=0;
            while(true){
                const promotion=GameState.calendar.find(e=>e.leagueId===id&&e.pyramidPhase==='PROMOCION'&&e.games.length&&!e.done);
                if(promotion){
                    WORLD_STORAGE.validate(GameState);const saved=WORLD_STORAGE.serialize(GameState),restored=WORLD_STORAGE.decode(JSON.parse(saved));WORLD_STORAGE.validate(restored);
                    const cross=promotion.games.every(g=>[g.home,g.away].filter(c=>WORLD_ENGINE.league(upper).clubIds.includes(c)).length===1);
                    return {id,upper,count,before,cross,label:promotion.interdivisionUpper,bytes:saved.length*2,players:GameState.players.length,season:FM_SEASONS.leagueSeason(id).year,promotion:promotion.id};
                }
                const e=GameState.calendar.filter(e=>ids.has(e.leagueId)&&!e.done).sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id))[0];
                if(!e)throw Error('No promotion was created for '+id);
                if(++count>180)throw Error('Competition did not finish '+id);
                GameState.today=e.date;WORLD_CLOCK.ensure().slot=3;
                if(!WORLD_ENGINE.completeOne(fixture(e)?{home:1,away:0,pen:null}:null,e))throw Error('Result processor refused '+e.id);
            }
        }''', lower_id)
        self.assertTrue(disputed['cross'])
        self.assertEqual(disputed['label'], disputed['upper'])
        self.assertGreater(disputed['players'], 15183)
        self.assertLess(disputed['bytes'], 5 * 1024 * 1024)
        completed = self.page.evaluate('''id=>{
            const upper=FM_PYRAMIDS.rules[id].upper,ids=new Set([id,upper]);let count=0;
            while(true){
                const e=GameState.calendar.filter(e=>ids.has(e.leagueId)&&!e.done).sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id))[0];
                if(!e)break;if(++count>180)throw Error('Finals did not finish '+id);
                GameState.today=e.date;WORLD_CLOCK.ensure().slot=3;
                if(!WORLD_ENGINE.completeOne(fixture(e)?{home:1,away:0,pen:null}:null,e))throw Error('Result processor refused '+e.id);
            }
            const summary=structuredClone(FM_PYRAMIDS.movementSummary(id));WORLD_STORAGE.validate(GameState);
            const first=FM_SEASONS.leagueSeason(id),second=FM_SEASONS.leagueSeason(upper),oldYear=first.year,rollover=[first.rolloverDate,second.rolloverDate].sort().at(-1);
            GameState.finished=false;GameState.today=rollover;
            const own=mine()[0];own.condicion_fisica=61;const healthBefore=own.condicion_fisica;
            const rolled=FM_SEASONS.rollover(id),newYear=FM_SEASONS.leagueSeason(id).year,healthAfter=own.condicion_fisica;
            WORLD_STORAGE.validate(GameState);
            const counts=Object.fromEntries([...ids].map(l=>[l,WORLD_ENGINE.league(l).clubIds.length]));
            const key=id+':'+oldYear,moves=GameState.world.pyramids.movementKeys.filter(k=>k===key).length;
            const membership=JSON.stringify([...ids].map(l=>WORLD_ENGINE.league(l).clubIds));FM_SEASONS.rollover(upper);const unchanged=membership===JSON.stringify([...ids].map(l=>WORLD_ENGINE.league(l).clubIds));
            const saved=WORLD_STORAGE.serialize(GameState),decoded=WORLD_STORAGE.decode(JSON.parse(saved));WORLD_STORAGE.validate(decoded);saveGame(true);
            return {summary,rolled,oldYear,newYear,counts,moves,unchanged,healthBefore,healthAfter,bytes:saved.length*2,userLeague:GameState.world.userLeagueId,userClub:GameState.userClub.id,players:GameState.players.length};
        }''', lower_id)
        self.assertTrue(completed['summary']['ready'])
        self.assertEqual(len(completed['summary']['promoted']), len(completed['summary']['relegated']))
        self.assertTrue(completed['rolled'])
        self.assertEqual(completed['newYear'], completed['oldYear'] + 1)
        self.assertEqual(completed['counts'], disputed['before'])
        self.assertEqual(completed['moves'], 1)
        self.assertTrue(completed['unchanged'])
        self.assertEqual(completed['healthAfter'], completed['healthBefore'])
        self.assertLess(completed['bytes'], 5 * 1024 * 1024)
        self.page.reload(wait_until='domcontentloaded')
        self.page.wait_for_selector('aside')
        restored = self.page.evaluate('''()=>{WORLD_STORAGE.validate(GameState);return {club:GameState.userClub.id,league:GameState.world.userLeagueId,players:GameState.players.length}}''')
        self.assertEqual(restored['club'], completed['userClub'])
        self.assertEqual(restored['league'], completed['userLeague'])
        self.assertEqual(restored['players'], completed['players'])

    def test_german_promotion_and_compressed_save(self):
        self.season('L2')

    def test_french_playoffs_promotion_and_compressed_save(self):
        self.season('FR2')

    def test_bolivian_historical_pool_promotion_and_compressed_save(self):
        self.season('BOL2')


if __name__ == '__main__':
    unittest.main(verbosity=2)
