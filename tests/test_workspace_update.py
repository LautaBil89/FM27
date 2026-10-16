#!/usr/bin/env python3
"""Real-browser checks of viewport workspaces and the integrated management flow."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import unittest

from playwright.sync_api import sync_playwright

URL=os.environ.get('FM27_TEST_URL','http://127.0.0.1:8000/index.html')
ROOT=Path(__file__).resolve().parents[1]


class WorkspaceUpdate(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pw=sync_playwright().start()
        cls.browser=cls.pw.chromium.launch(executable_path=os.environ.get('FM27_CHROMIUM') or shutil.which('chromium'),headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])

    @classmethod
    def tearDownClass(cls):
        cls.browser.close();cls.pw.stop()

    def setUp(self):
        self.context=self.browser.new_context(viewport={'width':1366,'height':768})
        self.page=self.context.new_page();self.errors=[]
        self.page.on('pageerror',lambda e:self.errors.append(str(e)))
        self.page.on('dialog',lambda d:d.accept())
        self.page.route('https://**/*',lambda r:r.abort())
        self.page.goto(URL,wait_until='domcontentloaded')
        self.page.evaluate('''()=>{let n=14102026;Math.random=()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296}}''')

    def tearDown(self):
        self.context.close();self.assertEqual(self.errors,[])

    def career(self,mode='realistic',club='boca'):
        self.page.fill('#manager','DT paneles')
        self.page.select_option('#careerCompetitionFormat',mode)
        self.page.select_option('#club',club)
        self.page.click('[data-action="new"]')
        self.page.wait_for_selector('aside')

    def nav(self,view):
        self.page.evaluate('(v)=>{view=v;render()}',view)

    def fit(self):
        result=self.page.evaluate('''()=>({doc:document.documentElement.scrollHeight,body:document.body.scrollHeight,width:document.documentElement.scrollWidth,height:innerHeight,viewport:innerWidth})''')
        self.assertLessEqual(result['doc'],result['height']+1,result)
        self.assertLessEqual(result['body'],result['height']+1,result)
        self.assertLessEqual(result['width'],result['viewport']+1,result)

    def visible_in_viewport(self,selector):
        result=self.page.locator(selector).first.evaluate('''e=>{const r=e.getBoundingClientRect();return {visible:!!e.getClientRects().length,top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:innerWidth,height:innerHeight}}''')
        self.assertTrue(result['visible'],result)
        self.assertGreaterEqual(result['top'],-1,result);self.assertLessEqual(result['bottom'],result['height']+1,result)

    def vacancy(self):
        self.page.evaluate('''()=>{const p=mine().find(p=>!GameState.tactics.xi.includes(p.id)&&!WORLD_ENGINE.isForeign(p)&&CLUB_AI.canRelease(p).ok);if(!p)throw Error('No reserve slot');p.clubId=null;WORLD_ENGINE.reindex();autoLineup();render()}''')

    def offer(self,loan=False):
        self.nav('market');self.page.evaluate('buy(1068088)')
        self.page.fill('#negotiation [name="fee"]','1000000')
        if loan:
            self.page.select_option('#negotiation [name="dealType"]','loan')
            self.page.fill('#negotiation [name="fee"]','100000')
            self.page.fill('#negotiation [name="wageShare"]','50')
        self.page.click('#negotiation button[type="submit"]')
        return self.page.evaluate('GameState.offers.find(o=>o.playerId===1068088).id')

    def next_day(self):
        self.page.evaluate('()=>{for(let i=0;i<4;i++)WORLD_CLOCK.advance({silent:true});render()}')

    def test_01_welcome_and_all_workspaces_fit_three_sizes(self):
        for size in [(1366,768),(1280,720),(390,844)]:
            self.page.set_viewport_size({'width':size[0],'height':size[1]});self.fit();self.visible_in_viewport('[data-action="new"]')
        self.career()
        for size in [(1366,768),(1280,720),(390,844)]:
            self.page.set_viewport_size({'width':size[0],'height':size[1]})
            for target in ['dashboard','inbox','squad','tactics','tables','market','training','scouting','finances','match','dressing-room']:
                with self.subTest(size=size,view=target):
                    self.nav(target);self.fit();self.visible_in_viewport('.fm-continue')
                    if target=='dashboard':self.visible_in_viewport('[data-view="match"]')

    def test_02_long_player_lists_scroll_locally_to_last_row(self):
        self.career();self.nav('squad')
        result=self.page.evaluate('''()=>{const list=document.querySelector('#content .scroll');const before=window.scrollY;list.scrollTop=list.scrollHeight;const row=list.querySelector('tbody tr:last-child').getBoundingClientRect(),box=list.getBoundingClientRect();return {height:list.clientHeight,scroll:list.scrollHeight,top:list.scrollTop,last:row.bottom,bottom:box.bottom,page:window.scrollY-before}}''')
        self.assertGreater(result['scroll'],result['height']);self.assertGreater(result['top'],0)
        self.assertLessEqual(result['last'],result['bottom']+2);self.assertEqual(result['page'],0)
        self.visible_in_viewport('#rosterPos')
        self.nav('market');self.visible_in_viewport('[data-world-market-page="1"]')

    def test_03_tactical_and_player_panels_keep_actions_reachable(self):
        self.career();self.nav('tactics')
        for pane in ['pitch','bench','team','player','plans','squad']:
            self.page.click(f'[data-ws-key="tactics"][data-ws-tab="{pane}"]');self.fit()
            if pane=='pitch':
                for i in range(11):self.visible_in_viewport(f'[data-tw-slot="{i}"]')
            if pane=='bench':
                for i in range(11,18):self.visible_in_viewport(f'[data-tw-slot="{i}"]')
            if pane=='plans':self.visible_in_viewport('[data-tw-save]')
        self.page.evaluate('details(GameState.tactics.xi[0])')
        for tab in ['summary','attributes','progress','stats','contract','sources']:
            self.page.click(f'[data-fp-tab="{tab}"]');self.fit();self.visible_in_viewport('[data-fp-back]')

    def test_04_offer_requires_club_then_player_then_one_signature(self):
        self.career();self.vacancy();before=self.page.evaluate('GameState.userClub.presupuesto_dolares')
        offer=self.offer();self.assertEqual(self.page.evaluate('(id)=>GameState.offers.find(o=>o.id===id).stage',offer),'club')
        self.next_day()
        status=self.page.evaluate('(id)=>({offer:GameState.offers.find(o=>o.id===id),cash:GameState.userClub.presupuesto_dolares,club:player(1068088).clubId,reserved:MARKET_CONTRACTS.reserved()})',offer)
        self.assertTrue(status['offer']['awaitingPlayerTerms']);self.assertNotEqual(status['club'],'boca')
        self.assertEqual(status['cash'],before);self.assertEqual(status['reserved'],1000000)
        self.page.evaluate('(id)=>MARKET_CONTRACTS.openPlayerNegotiation(id)',offer)
        self.page.fill('#negotiation [name="wage"]','2000')
        self.page.select_option('#negotiation [name="playingTime"]','Titular')
        self.page.click('[data-nw-tab="bonuses"]');self.page.fill('#negotiation [name="bonus"]','1500')
        self.page.fill('#negotiation [name="appearanceBonus"]','50')
        self.page.click('#negotiation button[type="submit"]');self.next_day()
        actual=self.page.evaluate('(id)=>({offer:GameState.offers.find(o=>o.id===id),p:player(1068088),cash:GameState.userClub.presupuesto_dolares})',offer)
        self.assertEqual(actual['offer']['status'],'accepted');self.assertEqual(actual['p']['clubId'],'boca')
        self.assertEqual(actual['p']['squadRole'],'Titular');self.assertEqual(actual['p']['contractBonuses']['appearance'],50)
        self.assertEqual(actual['cash'],before-1001500)
        self.page.evaluate('()=>{CLUB_AI.processUserOffers();CLUB_AI.processUserOffers();saveGame(true)}')
        self.assertEqual(self.page.evaluate('GameState.userClub.presupuesto_dolares'),actual['cash'])
        self.page.reload(wait_until='domcontentloaded');self.assertEqual(self.page.evaluate('player(1068088).clubId'),'boca')

    def test_05_loan_keeps_owner_contract_and_returns_once(self):
        self.career();self.vacancy();original=self.page.evaluate('({club:player(1068088).clubId,wage:player(1068088).salario,contract:player(1068088).contract})')
        offer=self.offer(loan=True);self.next_day();self.page.evaluate('(id)=>MARKET_CONTRACTS.openPlayerNegotiation(id)',offer)
        self.page.click('#negotiation button[type="submit"]');self.next_day()
        loan=self.page.evaluate('({p:player(1068088),loan:GameState.world.ai.contracts.loans.find(l=>l.playerId===1068088),wage:MARKET_CONTRACTS.loanWageFor(player(1068088),"boca")})')
        self.assertEqual(loan['p']['clubId'],'boca');self.assertEqual(loan['p']['contract'],original['contract']);self.assertEqual(loan['wage'],original['wage']/2)
        self.page.evaluate('(date)=>{MARKET_CONTRACTS.returnLoans(date);MARKET_CONTRACTS.returnLoans(date)}',loan['loan']['endDate'])
        self.assertEqual(self.page.evaluate('player(1068088).clubId'),original['club'])

    def test_06_visible_offer_errors_and_mobile_menu(self):
        self.career();self.page.set_viewport_size({'width':390,'height':844});self.page.click('[data-ws-menu="toggle"]')
        self.page.click('.ws-menu [data-view="market"]');self.assertFalse(self.page.locator('.ws-menu').is_visible())
        self.page.evaluate('buy(1068088)');self.page.click('#negotiation button[type="submit"]')
        self.assertEqual(self.page.evaluate('GameState.offers.filter(o=>o.type==="buy").length'),0)
        self.visible_in_viewport('[data-offer-feedback]');self.assertIn('plazas',self.page.locator('[data-offer-error]').inner_text())
        self.page.click('[data-contract-help="squad"]');self.assertEqual(self.page.evaluate('view'),'squad')

    def test_07_relationship_cooldown_and_promises_use_actual_minutes(self):
        self.career();self.nav('dressing-room')
        data=self.page.evaluate('''()=>{const p=mine()[0];p.lastRating=8;const r=FM_DRESSING_ROOM.ensure().players[p.id],before={moral:p.moral,trust:r.trust};FM_DRESSING_ROOM.talk(p.id,'praise');const after={moral:p.moral,trust:r.trust};FM_DRESSING_ROOM.talk(p.id,'praise');const twice={moral:p.moral,trust:r.trust};FM_DRESSING_ROOM.promiseMinutes(p.id);p.minutes+=90;FM_DRESSING_ROOM.onMatchResult({id:'recorded-a'});p.minutes+=90;FM_DRESSING_ROOM.onMatchResult({id:'recorded-b'});const fulfilled=r.promise.status,trust=r.trust;FM_DRESSING_ROOM.onDayAdvance();return {before,after,twice,fulfilled,trust,again:r.trust}}''')
        self.assertGreater(data['after']['moral'],data['before']['moral']);self.assertEqual(data['after'],data['twice'])
        self.assertEqual(data['fulfilled'],'fulfilled');self.assertEqual(data['trust'],data['again'])

    def test_08_realistic_full_world_season_and_next_year(self):
        self.career()
        result=self.page.evaluate('''()=>{let turns=0,matches=0;while(!GameState.finished){if(WORLD_CLOCK.ready()){const e=currentEvent(),g=fixture(e);WORLD_ENGINE.completeOne({home:g.home===GameState.userClub.id?2:0,away:g.away===GameState.userClub.id?2:0,pen:null});matches++}else WORLD_CLOCK.advance({silent:true});if(++turns>2200)throw Error('Calendar stalled')}const s=FM_COMPETITIONS.seasonSummary();const result={s,turns,matches,first:Object.values(WORLD_ENGINE.tableFor('ARG1')).map(r=>r.pj),second:Object.values(WORLD_ENGINE.tableFor('ARG2')).map(r=>r.pj),cups:Object.values(GameState.world.cups).map(c=>c.winner),bytes:WORLD_STORAGE.inspect(GameState).localStorageBytes};saveGame(true);const backup=JSON.parse(localStorage.getItem('fm27-pasion-v1'));WORLD_STORAGE.importState(backup,{confirm:false});nextSeason();result.year=GameState.year;result.zones=Object.values(GameState.world.competitionFormats).map(f=>[f.zones.A.length,f.zones.B.length]);result.titles=Object.keys(s.champions).length;return result}''')
        self.assertEqual(set(result['first']),{32});self.assertEqual(set(result['second']),{34})
        self.assertEqual(result['titles'],2);self.assertEqual(len(set(result['s']['promoted'])),2);self.assertEqual(len(set(result['s']['relegated'])),2)
        self.assertTrue(all(result['cups']));self.assertEqual(result['year'],2027);self.assertEqual(result['zones'],[[15,15],[18,18]])
        self.assertLess(result['bytes'],5*1024*1024)

    def test_09_real_key_plays_and_ai_adjustments_do_not_change_user_tactics(self):
        self.career()
        result=self.page.evaluate('''()=>{while(!WORLD_CLOCK.ready())WORLD_CLOCK.advance({silent:true});autoLineup();startMatch();const m=GameState.match,user=JSON.stringify(GameState.tactics);m.paused=false;let calls=0;while(!m.done&&calls++<110){if(m.paused){m.paused=false;m.halfTime=false}tick()}m.paused=true;const key=m.keyPlays?.at(-1);return {minute:m.minute,plays:m.keyPlays?.length||0,key,shots:m.stats[0].shots+m.stats[1].shots,changes:m.aiAdjustments,decisions:m.simulation?.aiDecisions||[],userSame:user===JSON.stringify(GameState.tactics),allActual:(m.keyPlays||[]).every(k=>m.chances.some(c=>c.minute===k.minute&&c.playerId===k.playerId&&c.xg===k.xg))}}''')
        self.assertGreater(result['plays'],0);self.assertLessEqual(result['plays'],60);self.assertTrue(result['allActual'])
        self.assertTrue(result['userSame']);self.assertEqual(result['changes'],[20,35,45,60,75])
        self.assertEqual(len(result['changes']),len(set(result['changes'])))
        decision_minutes=[decision['minute'] for decision in result['decisions']]
        self.assertEqual(len(decision_minutes),len(set(decision_minutes)))
        for decision in result['decisions']:
            self.assertIn(decision['minute'],result['changes'])
            self.assertTrue(decision['reason']);self.assertTrue(decision['evidence'])
            for field in ['tempo','line','pressing','width']:
                self.assertLessEqual(abs(decision['after'][field]-decision['before'][field]),12)

    def test_10_previous_world_save_keeps_played_calendar_and_money(self):
        old=subprocess.check_output(['git','show','5c8b7d5:index.html'],cwd=ROOT)
        route=URL+'?old-workspace=1';self.page.route(route,lambda r:r.fulfill(status=200,content_type='text/html',body=old))
        self.page.goto(route,wait_until='domcontentloaded');self.page.fill('#manager','DT anterior');self.page.click('[data-action="new"]')
        self.page.evaluate('()=>{for(let i=0;i<4;i++)WORLD_CLOCK.advance({silent:true});saveGame(true)}')
        signature=self.page.evaluate('({today:GameState.today,cash:GameState.userClub.presupuesto_dolares,index:GameState.eventIndex,calendar:JSON.stringify(GameState.calendar),players:GameState.players.length})')
        self.page.goto(URL,wait_until='domcontentloaded');self.page.wait_for_selector('aside')
        actual=self.page.evaluate('({today:GameState.today,cash:GameState.userClub.presupuesto_dolares,index:GameState.eventIndex,calendar:JSON.stringify(GameState.calendar),players:GameState.players.length})')
        self.assertEqual(actual,signature);self.assertFalse(self.page.evaluate('FM_COMPETITIONS.active()'))

    def test_11_secondary_controls_fit_low_desktop_and_mobile(self):
        self.career()
        for width,height in [(1280,720),(390,844)]:
            self.page.set_viewport_size({'width':width,'height':height})
            self.nav('tactics')
            for pane,selectors in [('pitch',[f'[data-tw-slot="{i}"]' for i in range(11)]),('bench',[f'[data-tw-slot="{i}"]' for i in range(11,18)]),('team',['[data-tw-team="formation"]','[data-tw-team="style"]','#tw-pressing']),('plans',['[data-tw-plan-name]','[data-tw-save]'])]:
                self.page.click(f'[data-ws-key="tactics"][data-ws-tab="{pane}"]')
                for selector in selectors:
                    self.visible_in_viewport(selector)
                    self.assertTrue(self.page.locator(selector).evaluate('''e=>{const r=e.getBoundingClientRect(),at=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return at===e||e.contains(at)}'''),f'Control covered or clipped: {width} {selector}')
            self.nav('dressing-room');self.page.click('[data-social-pane="talk"]')
            self.visible_in_viewport('[data-social-promise]')
            self.page.evaluate('details(mine()[0].id)')
            for tab in ['attributes','contract','sources']:
                self.page.click(f'[data-fp-tab="{tab}"]');self.fit();self.visible_in_viewport('[data-fp-back]')
        self.vacancy();offer=self.offer();self.next_day()
        self.page.evaluate('(id)=>MARKET_CONTRACTS.openPlayerNegotiation(id)',offer)
        for tab in ['terms','bonuses']:
            self.page.click(f'[data-nw-tab="{tab}"]');self.visible_in_viewport('#negotiation button[type="submit"]');self.fit()

    def test_12_personal_terms_cannot_change_the_agreed_loan(self):
        self.career();self.vacancy();offer=self.offer(loan=True);self.next_day()
        result=self.page.evaluate('''id=>{const o=GameState.offers.find(o=>o.id===id),before={fee:o.fee,dealType:o.dealType,months:o.loanMonths,share:o.wageShare};const r=MARKET_CONTRACTS.submitPlayerTerms(id,{playingTime:'Titular',wage:2000,years:5,fee:1,dealType:'permanent',loanMonths:12,wageShare:0,appearanceBonus:50,goalBonus:100,cleanSheetBonus:20});return {ok:r.ok,before,after:{fee:o.fee,dealType:o.dealType,months:o.loanMonths,share:o.wageShare}}}''',offer)
        self.assertTrue(result['ok']);self.assertEqual(result['before'],result['after'])
        self.next_day()
        paid=self.page.evaluate('''()=>{const p=player(1068088),e={id:'bonus-fixture'},g={home:'boca',away:'river'},r={home:2,away:0},before={[p.id]:{minutes:p.minutes,goals:p.goals}};p.minutes+=90;p.goals+=1;const cash=GameState.userClub.presupuesto_dolares,first=MARKET_CONTRACTS.onMatchResult(e,g,r,before),second=MARKET_CONTRACTS.onMatchResult(e,g,r,before);return {first,second,debit:cash-GameState.userClub.presupuesto_dolares}}''')
        self.assertEqual(paid,{'first':170,'second':0,'debit':170})

    def test_13_classic_career_can_enable_formats_only_next_season(self):
        self.career(mode='classic');self.nav('tables')
        before=self.page.evaluate('JSON.stringify(GameState.calendar)')
        self.page.click('[data-reg-next]' if self.page.locator('[data-reg-next]').count() else '[data-arg-next-format]')
        self.assertEqual(self.page.evaluate('JSON.stringify(GameState.calendar)'),before)
        self.assertFalse(self.page.evaluate('FM_COMPETITIONS.active()'))
        result=self.page.evaluate("""()=>{let n=0;while(!GameState.finished){if(WORLD_CLOCK.ready()){const g=fixture(currentEvent());WORLD_ENGINE.completeOne({home:g.home===GameState.userClub.id?2:0,away:g.away===GameState.userClub.id?2:0,pen:null})}else WORLD_CLOCK.advance({silent:true});if(++n>2200)throw Error('stalled')}nextSeason();return {active:FM_COMPETITIONS.active(),year:GameState.year,history:GameState.world.competitionHistory,zones:Object.values(GameState.world.competitionFormats).map(f=>[f.zones.A.length,f.zones.B.length])}}""")
        self.assertTrue(result['active']);self.assertEqual(result['year'],2027)
        self.assertEqual(result['zones'],[[15,15],[18,18]])
        self.assertTrue(result['history'])


if __name__=='__main__':unittest.main(verbosity=2)
