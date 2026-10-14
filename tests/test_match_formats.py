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


class MatchFormats(unittest.TestCase):
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

    def match(self):
        self.page.evaluate("()=>{while(!WORLD_CLOCK.ready())WORLD_CLOCK.advance({silent:true});startMatch();clearInterval(timer);timer=null;GameState.match.paused=true;view='match';render()}")

    def test_01_database_membership_and_real_identities_unchanged(self):
        import hashlib
        old=subprocess.check_output(['git','show','a8ac75b:data/world-database.json'],cwd=ROOT)
        self.assertEqual(hashlib.sha256(old).hexdigest(),hashlib.sha256((ROOT/'data/world-database.json').read_bytes()).hexdigest())
        self.career();r=self.page.evaluate('({leagues:GameState.world.leagues.length,clubs:GameState.world.clubs.length,players:GameState.players.length,formats:Object.keys(GameState.world.regulations.leagues).length})')
        self.assertEqual(r,{'leagues':16,'clubs':310,'players':9220,'formats':14})

    def test_02_live_views_fit_and_pitch_players_are_accessible(self):
        self.career();self.match()
        for w,h in [(1366,768),(1280,720),(390,844),(360,740)]:
            self.page.set_viewport_size({'width':w,'height':h})
            for tab in ['field','feed','changes','stats','ratings','advice']:
                self.page.click(f'[data-mc-tab="{tab}"]');self.fit();self.visible_in_viewport('[data-action="play"]')
                if tab=='field':
                    self.assertEqual(self.page.locator('.mc-player').count(),22)
                    bounds=self.page.locator('.mc-field').bounding_box()
                    self.assertLess(bounds['y']+bounds['height'],h)
                    for player in self.page.locator('.mc-player').all():
                        self.assertTrue(player.evaluate('e=>{const r=e.getBoundingClientRect(),at=document.elementFromPoint(r.left+r.width/2,r.top+10);return at===e||e.contains(at)}'))
                if tab=='changes':
                    for selector in ['#out','#in','[data-action="sub"]','#liveStyle','[data-mc-setting="mentality"]','[data-shout="animar"]']:
                        self.visible_in_viewport(selector)
                        self.assertTrue(self.page.locator(selector).evaluate('e=>{const r=e.getBoundingClientRect(),at=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return at===e||e.contains(at)}'))

    def test_03_changes_pause_and_two_substitutions_share_one_window(self):
        self.career();self.match()
        self.page.evaluate('()=>{GameState.match.minute=60;GameState.match.paused=false;render()}')
        self.page.click('[data-mc-tab="changes"]');self.assertTrue(self.page.evaluate('GameState.match.paused'))
        for i in range(2):
            pair=self.page.evaluate("()=>{const m=GameState.match,res=m.bench[m.userSide].filter(id=>!m.used.includes(id)&&!m.lineups.flat().includes(id)&&available(player(id))),into=res.find(id=>player(id).posicion!=='POR'),out=m.lineups[m.userSide].find(id=>player(id).posicion===player(into).posicion);return {out,into}}")
            self.page.select_option('#out',str(pair['out']));self.page.select_option('#in',str(pair['into']));self.page.click('[data-action="sub"]')
        self.assertEqual(self.page.evaluate('GameState.match.substitutions'),2)
        self.assertEqual(self.page.evaluate('GameState.match.substitutionWindows[GameState.match.userSide]'),1)
        self.page.select_option('[data-mc-setting="mentality"]','Ofensiva');self.assertEqual(self.page.evaluate('GameState.tactics.mentality'),'Ofensiva')
        self.page.reload();self.page.wait_for_selector('.mc-root');self.assertEqual(self.page.evaluate('GameState.match.substitutions'),2);self.assertTrue(self.page.evaluate('GameState.match.paused'))

    def test_04_match_feed_statistics_and_result_use_actual_engine(self):
        self.career();self.match()
        r=self.page.evaluate("""()=>{const m=GameState.match;view='dashboard';while(!m.done){m.paused=false;m.halfTime=false;tick();if(m.minute>130)throw Error('Clock stalled')}view='match';render();return {score:m.score,minute:m.minute,shots:m.stats.map(s=>s.shots),xg:m.stats.map(s=>s.xg),chances:m.chances.length}}""")
        self.assertGreaterEqual(r['minute'],92);self.page.click('[data-mc-tab="stats"]');self.assertEqual(self.page.locator('.mc-xg path').count(),2)
        self.page.click('[data-mc-tab="feed"]');self.assertEqual(self.page.locator('.mc-feed article').count(),self.page.evaluate('GameState.match.feed.length'))
        self.page.click('[data-action="finish"]');self.assertEqual(self.page.evaluate('[GameState.lastMatch.result.home,GameState.lastMatch.result.away]'),r['score'])
        self.assertIsNone(self.page.evaluate('GameState.match'))

    def test_05_complete_world_season_all_formats_and_rollover(self):
        self.career()
        r=self.page.evaluate("""()=>{let n=0;while(!GameState.finished){WORLD_CLOCK.processDueEvents();if(GameState.finished)break;if(WORLD_CLOCK.ready()){const g=fixture(currentEvent());WORLD_ENGINE.completeOne({home:g.home==='boca'?2:0,away:g.away==='boca'?2:0,pen:null})}else WORLD_CLOCK.advance({silent:true});if(++n>2400)throw Error('stalled')}const data=GameState.world.regulations,counts=Object.fromEntries(Object.entries(data.leagues).map(([id,s])=>[id,Object.fromEntries(Object.entries(s.tables).map(([p,t])=>[p,[...new Set(Object.values(t).map(r=>r.pj))]]))])),champions=Object.fromEntries(Object.entries(data.leagues).map(([id,s])=>[id,s.champion])),groups=Object.fromEntries(['ECU1','URU1','COL1','VEN1'].map(id=>[id,Object.fromEntries(Object.entries(data.leagues[id].stages).filter(([,s])=>s.groups).map(([p,s])=>[p,Object.fromEntries(Object.entries(s.groups).map(([g,t])=>[g,Object.values(t).map(r=>r.pj)]))]))])),summary=FM_REGULATIONS.summary();saveGame(true);WORLD_STORAGE.importState(JSON.parse(localStorage.getItem('fm27-pasion-v1')),{confirm:false});nextSeason();return {counts,champions,groups,summary,year:GameState.year,history:GameState.world.regulations.history.length,reset:Object.values(GameState.world.regulations.leagues).every(s=>!s.champion),cups:Object.values(GameState.world.cups).map(c=>c.participants.length)}}""")
        self.assertTrue(all(r['champions'].values()),r['champions'])
        for id,phase,count in [('BRA1','LIGA',38),('CHI1','LIGA',30),('BOL1','LIGA',30),('PAR1','APERTURA',22),('PAR1','CLAUSURA',22),('URU1','APERTURA',15),('URU1','CLAUSURA',15),('COL1','APERTURA',19),('COL1','FINALIZACION',19),('ECU1','INICIAL',30),('PER1','APERTURA',17),('PER1','CLAUSURA',17),('VEN1','APERTURA',13),('VEN1','CLAUSURA',13),('GB1','LIGA',38),('ES1','LIGA',38),('IT1','LIGA',38),('L1','LIGA',34),('FR1','LIGA',34)]:
            self.assertEqual(r['counts'][id][phase],[count],(id,phase))
        ecu=r['groups']['ECU1']['FASE_FINAL'];self.assertEqual(len(ecu['TITULO']),6);self.assertEqual(set(ecu['TITULO']),{40});self.assertEqual(set(ecu['SUDAMERICANA']),{36});self.assertEqual(set(ecu['DESCENSO']),{40})
        self.assertEqual(set(r['groups']['URU1']['INTERMEDIO']['A']),{7});self.assertEqual(set(r['groups']['COL1']['CUADRANGULARES']['A']),{6});self.assertEqual(set(r['groups']['VEN1']['AP_GRUPOS']['A']),{6})
        self.assertEqual(len(r['summary']['BRA1']['relegated']),4);self.assertEqual(len(r['summary']['L1']['playoff']),1)
        self.assertEqual(r['year'],2027);self.assertEqual(r['history'],1);self.assertTrue(r['reset']);self.assertEqual(r['cups'],[32,32])

    def test_06_every_league_phase_and_rules_view_fits(self):
        self.career();self.nav('tables')
        for size in [(1280,720),(390,844)]:
            self.page.set_viewport_size({'width':size[0],'height':size[1]})
            for league in ['URU1','PAR1','COL1','ECU1','PER1','VEN1','BOL1','BRA1','CHI1','GB1','ES1','IT1','L1','FR1']:
                self.page.select_option('#worldTableLeague',league)
                for tab in ['phase','annual','results','rules']:
                    self.page.click(f'[data-reg-tab="{tab}"]');self.fit();self.visible_in_viewport('#worldTableLeague')
                self.assertIn('calendario',self.page.locator('.arg-panel').inner_text().lower())

    def test_07_previous_career_can_enable_rules_next_year(self):
        old=subprocess.check_output(['git','show','a8ac75b:index.html'],cwd=ROOT);route=URL+'?old-match-formats=1';self.page.route(route,lambda r:r.fulfill(status=200,content_type='text/html',body=old));self.page.goto(route,wait_until='domcontentloaded');self.page.fill('#manager','Anterior');self.page.click('[data-action="new"]');self.page.evaluate('saveGame(true)')
        before=self.page.evaluate('JSON.stringify(GameState.calendar)');self.page.goto(URL,wait_until='domcontentloaded');self.page.wait_for_selector('aside');self.assertFalse(self.page.evaluate('FM_REGULATIONS.enabled()'));self.assertEqual(self.page.evaluate('JSON.stringify(GameState.calendar)'),before)
        self.nav('tables');self.page.click('[data-reg-next]');self.assertEqual(self.page.evaluate('JSON.stringify(GameState.calendar)'),before)
        r=self.page.evaluate("""()=>{let n=0;while(!GameState.finished){WORLD_CLOCK.processDueEvents();if(GameState.finished)break;if(WORLD_CLOCK.ready()){const g=fixture(currentEvent());WORLD_ENGINE.completeOne({home:g.home==='boca'?2:0,away:g.away==='boca'?2:0,pen:null})}else WORLD_CLOCK.advance({silent:true});if(++n>2400)throw Error('stalled')}nextSeason();return {active:FM_REGULATIONS.enabled(),year:GameState.year,count:Object.keys(GameState.world.regulations.leagues).length}}""")
        self.assertEqual(r,{'active':True,'year':2027,'count':14})

    def test_08_three_way_head_to_head_uses_a_mini_table(self):
        self.career()
        r=self.page.evaluate("""()=>{const l=WORLD_ENGINE.league('ES1'),ids=l.clubIds.slice(0,3),t=GameState.world.regulations.leagues.ES1.tables.LIGA;for(let i=0;i<ids.length;i++)Object.assign(t[ids[i]],{pts:50,pj:30,gf:[30,20,40][i],gc:10});const games=[{home:ids[0],away:ids[1],result:{home:1,away:0}},{home:ids[1],away:ids[2],result:{home:2,away:0}},{home:ids[2],away:ids[0],result:{home:3,away:0}}];GameState.calendar.push({leagueId:'ES1',regulation:true,regPhase:'LIGA',annual:true,games});return {ids,rank:FM_REGULATIONS.ordered(t,'ES1').slice(0,3).map(r=>r.id)}}""")
        self.assertEqual(r['rank'],[r['ids'][2],r['ids'][1],r['ids'][0]])
    def test_09_continental_final_plays_extra_time_before_penalties(self):
        self.career()
        r=self.page.evaluate("""()=>{let n=0;while(true){if(WORLD_CLOCK.ready()){const e=currentEvent(),g=fixture(e);if(e.type==='LIB'&&e.stage==='FINAL')break;WORLD_ENGINE.completeOne({home:g.home==='boca'?3:0,away:g.away==='boca'?3:0,pen:null})}else WORLD_CLOCK.advance({silent:true});if(++n>2200||GameState.finished)throw Error('No final')}autoLineup();startMatch();clearInterval(timer);const m=GameState.match;m.minute=90+m.addedTime-1;m.score=[0,0];m.paused=false;view='dashboard';Math.random=()=>.99;tick();const began={extra:!!m.extraTime,done:m.done,pen:m.pen||null};m.paused=false;while(!m.done){tick();if(m.minute>130)throw Error('extra time stalled')}view='match';render();return {began,end:m.minute,regulation:m.regulationEnd,score:m.score,pen:m.pen}}""")
        self.assertTrue(r['began']['extra']);self.assertFalse(r['began']['done']);self.assertIsNone(r['began']['pen']);self.assertEqual(r['end']-r['regulation'],30);self.assertNotEqual(r['pen']['home'],r['pen']['away'])

    def test_10_annual_leader_is_not_awarded_a_colombian_playoff_title(self):
        r=self.page.evaluate("""()=>{const id=WORLD_DATABASE.leagues.find(l=>l.id==='COL1').clubIds[0];WORLD_ENGINE.createWorldCareer('DT Colombia',id,'Salir Campeón');let n=0;while(!GameState.finished){WORLD_CLOCK.processDueEvents();if(GameState.finished)break;if(WORLD_CLOCK.ready()){const e=WORLD_CLOCK.nextFixture(),g=fixture(e);const regular=e.regPhase==='APERTURA'||e.regPhase==='FINALIZACION',win=regular&&e.phase!=='knockout',home=g.home===id;WORLD_ENGINE.completeOne({home:home===win?3:0,away:home===win?0:3,pen:null})}else WORLD_CLOCK.advance({silent:true});if(++n>2400)throw Error('stalled')}const h=GameState.history[0];return {id,position:h.position,met:h.objectiveMet,champion:h.champion,winners:GameState.world.regulations.leagues.COL1.winners}}""")
        self.assertEqual(r['position'],1);self.assertFalse(r['met']);self.assertNotEqual(r['champion'],r['id']);self.assertNotIn(r['id'],r['winners'].values())

    def test_11_afternoon_match_starts_before_an_older_calendar_night_event(self):
        self.career()
        r=self.page.evaluate("""()=>{const target=WORLD_CLOCK.nextFixture(),night=GameState.calendar.find(e=>e.phase==='groups'&&!fixture(e));night.date=target.date;GameState.calendar.splice(GameState.calendar.indexOf(night),1);GameState.calendar.unshift(night);GameState.eventIndex=0;GameState.today=target.date;GameState.world.clock.slot=2;const order=GameState.calendar.map(e=>e.id);startMatch();clearInterval(timer);if(!GameState.match)throw Error('Afternoon kickoff blocked');const m=GameState.match,started=m.eventId;view='dashboard';while(!m.done){m.paused=false;m.halfTime=false;tick();if(m.minute>130)throw Error('clock stalled')}finishMatch();const before={night:night.done,current:currentEvent().id};GameState.world.clock.slot=3;WORLD_CLOCK.processDueEvents();return {started,target:target.id,before,night:night.done,orderSame:JSON.stringify(order)===JSON.stringify(GameState.calendar.map(e=>e.id)),userResults:target.games.filter(g=>g.home==='boca'||g.away==='boca').map(g=>g.result)}}""")
        self.assertEqual(r['started'],r['target']);self.assertFalse(r['before']['night']);self.assertTrue(r['night']);self.assertTrue(r['orderSame']);self.assertEqual(len(r['userResults']),1);self.assertIsNotNone(r['userResults'][0])

    def test_12_header_controls_really_resume_pause_and_keep_the_clock(self):
        self.career();self.match();self.page.select_option('#speed','50')
        self.page.click('.fm-continue');self.page.wait_for_function('GameState.match.minute>0')
        self.page.click('.fm-continue');self.assertTrue(self.page.evaluate('GameState.match.paused'))
        minute=self.page.evaluate('GameState.match.minute');self.page.wait_for_timeout(150);self.assertEqual(self.page.evaluate('GameState.match.minute'),minute)
        self.page.click('[data-mc-tab="field"]');self.page.focus('[data-mc-tab="field"]');self.page.keyboard.press('ArrowRight');self.assertEqual(self.page.evaluate('FM_MATCH_CENTRE.ui.tab'),'feed')
        self.page.reload();self.page.wait_for_selector('.mc-root');self.assertEqual(self.page.evaluate('GameState.match.minute'),minute);self.assertTrue(self.page.evaluate('GameState.match.paused'))



if __name__=='__main__':unittest.main(verbosity=2)
