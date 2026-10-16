"""The standalone default career exposes real-world modules without hidden controls."""
import os
import shutil
import unittest
from playwright.sync_api import sync_playwright
URL=os.environ.get('FM27_TEST_URL','http://127.0.0.1:8000/index.html')
class RealismWorkspace(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pw=sync_playwright().start();cls.browser=cls.pw.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    @classmethod
    def tearDownClass(cls):cls.browser.close();cls.pw.stop()
    def setUp(self):
        self.ctx=self.browser.new_context(viewport={'width':1280,'height':720});self.page=self.ctx.new_page();self.errors=[];self.page.on('pageerror',lambda e:self.errors.append(str(e)));self.page.route('https://**/*',lambda r:r.abort());self.page.goto(URL,wait_until='domcontentloaded')
    def tearDown(self):self.ctx.close();self.assertEqual(self.errors,[])
    def fit(self):
        self.assertTrue(self.page.evaluate('document.documentElement.scrollHeight<=innerHeight+1&&document.documentElement.scrollWidth<=innerWidth+1'))
    def hit(self,selector):
        r=self.page.locator(selector).first.evaluate('''e=>{const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;return {inside:r.width>0&&r.height>0&&r.top>=0&&r.bottom<=innerHeight&&r.left>=0&&r.right<=innerWidth,hit:e.contains(document.elementFromPoint(x,y))}}''');self.assertTrue(r['inside'] and r['hit'],(selector,r))
    def career(self):self.page.fill('#manager','DT mundo');self.page.click('[data-action="new"]');self.page.wait_for_selector('aside')
    def test_welcome_rule_selectors_are_clickable_on_desktop_and_mobile(self):
        for size in [{'width':1280,'height':720},{'width':390,'height':844}]:
            self.page.set_viewport_size(size);self.fit()
            for selector in ['#manager','#worldCareerCountry','#worldCareerLeague','#club','#careerCompetitionFormat','#careerCalendarMode','[data-action="new"]']:self.hit(selector)
            self.assertEqual(self.page.locator('#careerCalendarMode').input_value(),'realistic')
    def test_default_realistic_catalog_and_save_keep_real_and_fictional_identities_separate(self):
        self.career();r=self.page.evaluate('''()=>{const text=WORLD_STORAGE.serialize(GameState),decoded=WORLD_STORAGE.decode(JSON.parse(text));return {clubs:GameState.world.clubs.length,leagues:GameState.world.leagues.length,real:GameState.players.filter(p=>p.realIdentity).length,fake:GameState.players.filter(p=>!p.realIdentity).length,honest:GameState.players.filter(p=>!p.realIdentity).every(p=>p.synthetic&&!p.transfermarkt&&p.nombre.toLowerCase().includes('reserva')&&p.identitySource.includes('ficticia')),base:WORLD_DATABASE.metadata.baseCounts,mode:FM_SEASONS.active(),players:GameState.players.length,restored:decoded.players.length,bytes:text.length*2}}''');self.assertEqual([r['clubs'],r['leagues'],r['real']],[565,30,15183]);self.assertEqual(r['base'],{'leagues':16,'clubs':310,'players':9220});self.assertTrue(r['mode'] and r['honest']);self.assertGreater(r['fake'],0);self.assertEqual(r['players'],r['restored']);self.assertLess(r['bytes'],5*1024*1024)
    def test_seasons_finance_medical_and_registration_are_accessible_without_page_scroll(self):
        self.career()
        for size in [{'width':1280,'height':720},{'width':390,'height':844}]:
            self.page.set_viewport_size(size)
            for tab in ['calendar','model']:
                self.page.evaluate("tab=>{view='tables';WORLD_UI.state.tab=tab;render()}",tab);self.fit();self.hit('[data-world-tab="'+tab+'"]')
                if tab=='calendar':self.assertTrue(self.page.locator('.season-overview .ws-list').is_visible())
            self.page.evaluate("view='finances';render()");self.fit();self.hit('[data-finance-tab="budget"]');self.page.click('[data-finance-tab="budget"]');self.assertTrue(self.page.locator('[data-finance-loan]').is_visible())
            self.page.evaluate("view='training';FM_WORKSPACE.ui.tabs.training='4';render()");self.fit();self.assertTrue(self.page.locator('[data-ws-key="training"][data-ws-tab="4"]').is_visible())
            self.page.evaluate("view='squad';render()");self.page.click('[data-rr-open]');self.fit();self.hit('#details [data-action="close"]');self.page.click('#details [data-action="close"]')
    def test_automatic_selection_respects_match_quota_and_preserves_live_selection(self):
        self.career();r=self.page.evaluate("""()=>{for(const p of mine().filter(p=>WORLD_ENGINE.isForeign(p))){for(const key of ['ritmo','tiro','pase','regate','defensa','fisico'])p[key]=95;p.condicion_fisica=100}GameState.tactics.xi=[];GameState.tactics.bench=[];autoLineup();const chosen=[...GameState.tactics.xi,...GameState.tactics.bench],foreign=chosen.filter(id=>WORLD_ENGINE.isForeign(player(id))).length,limit=FM_REGISTRATION.profile(GameState.userClub.id).foreignMatch;GameState.match={done:false};autoLineup();const unchanged=JSON.stringify(chosen)===JSON.stringify([...GameState.tactics.xi,...GameState.tactics.bench]);GameState.match=null;return {foreign,limit,size:chosen.length,unique:new Set(chosen).size,unchanged,reason:FM_REGISTRATION.lineupReason(chosen)}}""");self.assertEqual([r['size'],r['unique']],[18,18]);self.assertLessEqual(r['foreign'],r['limit']);self.assertTrue(r['unchanged']);self.assertEqual(r['reason'],'')
    def test_fractional_attributes_remain_inside_limits_during_growth_and_ageing(self):
        self.career();r=self.page.evaluate("""()=>{const p=mine().find(p=>p.posicion!=='POR');p.fecha_nacimiento='2006-01-01';p.edad=20;for(const key of ['ritmo','tiro','pase','regate','defensa','fisico'])p[key]=50;p.ritmo=98.7;p.injury=0;const e=FM_DEVELOPMENT.evolution(p);e.ceiling=99;e.lastDay=GameState.today;e.backgroundProgress.ritmo=1;const tomorrow=new Date(Date.parse(GameState.today)+86400000).toISOString().slice(0,10);FM_DEVELOPMENT.advanceBiology(p,tomorrow,true);const maximum=p.ritmo;p.fecha_nacimiento='1960-01-01';p.edad=66;p.fisico=1.5;e.ageProgress.fisico=1;FM_DEVELOPMENT.advanceBiology(p,new Date(Date.parse(tomorrow)+86400000).toISOString().slice(0,10),false);return {maximum,minimum:p.fisico}}""");self.assertEqual(r,{'maximum':99,'minimum':1})
if __name__=='__main__':unittest.main()
