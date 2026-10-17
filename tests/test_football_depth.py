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


class FootballDepth(unittest.TestCase):
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

    def test_01_scouting_progress_cost_reloads_and_stale_reports(self):
        self.career()
        r=self.page.evaluate("""()=>{const p=player(1068088),cash=GameState.userClub.presupuesto_dolares,start=GameState.today;const before=FM_DEPTH.knowledge(p);MANAGEMENT.scout(p.id);const charged=cash-GameState.userClub.presupuesto_dolares;MANAGEMENT.scout(p.id);const once=cash-GameState.userClub.presupuesto_dolares,levels=[];for(const d of [1,2,4,7]){GameState.today=new Date(Date.parse(start)+d*86400000).toISOString().slice(0,10);FM_DEPTH.progress(GameState.today);levels.push(FM_DEPTH.knowledge(p).level)}saveGame(true);return {before,charged,once,levels,range:FM_DEPTH.range(p),actual:overall(p)}}""")
        self.assertEqual(r['before']['level'],15);self.assertEqual(r['charged'],1500);self.assertEqual(r['once'],1500)
        self.assertEqual(r['levels'],[15,40,70,100]);self.assertEqual(r['range'],str(r['actual']))
        self.page.reload();self.page.wait_for_selector('aside')
        self.assertEqual(self.page.evaluate('FM_DEPTH.knowledge(player(1068088)).level'),100)
        self.assertLess(self.page.evaluate("()=>{GameState.today='2026-04-24';return FM_DEPTH.knowledge(player(1068088)).level}"),100)

    def test_02_policy_changes_targets_asking_prices_and_academy(self):
        self.career()
        r=self.page.evaluate("""()=>{const p=player(1068088),id=p.clubId,pr=FM_DEPTH.project(id);p.edad=20;p.potential=overall(p)+15;const out={};for(const type of ['academy','balance','contender']){pr.policy=type;out[type]={score:FM_DEPTH.projectScore(p,id),price:CLUB_AI.askingPrice(p)}}const child=structuredClone(p),old={pase:child.pase,regate:child.regate,defensa:child.defensa};pr.academy='Técnica';FM_DEPTH.youth(club(id),child);return {...out,child,old}}""")
        self.assertGreater(r['academy']['score'],r['contender']['score']);self.assertGreater(r['academy']['price'],r['balance']['price'])
        self.assertEqual(r['child']['pase'],min(99,r['old']['pase']+3));self.assertEqual(r['child']['defensa'],r['old']['defensa'])

    def test_03_player_values_role_cups_and_competition(self):
        self.career()
        r=self.page.evaluate("""()=>{const p=player(1068088);p.edad=28;p.salario=5000;const o={toClub:'boca',stage:'player'},starter=FM_DEPTH.personal(p,{...o,playingTime:'Titular'}),project=FM_DEPTH.personal(p,{...o,playingTime:'Proyecto'});CLUB_AI.ensure().competition.push({playerId:p.id,date:GameState.today,bidders:['boca','river']});const contested=FM_DEPTH.personal(p,{...o,playingTime:'Proyecto'});return {starter,project,contested}}""")
        self.assertGreater(r['project']['wage'],r['starter']['wage']);self.assertGreater(r['contested']['wage'],r['project']['wage'])
        self.assertTrue(any('continental' in t for t in r['starter']['reasons']))

    def loan_purchase(self,mode):
        self.vacancy()
        return self.page.evaluate("""mode=>{const p=player(1068088),owner=p.clubId,fee=Math.max(10000,p.valor_mercado);GameState.userClub.wageBudget=1000000;const result=MARKET_CONTRACTS.executeTransfer({id:'test-loan',playerId:p.id,fromClub:owner,toClub:'boca',dealType:'loan',fee:100000,wage:p.salario,bonus:0,years:1,loanMonths:6,wageShare:50,purchaseMode:mode,purchaseFee:fee,playingTime:'Rotación'});if(!result.ok)throw Error(result.reason);const l=MARKET_CONTRACTS.ensure().loans.find(l=>l.playerId===p.id);return {id:l.id,owner,fee,end:l.endDate}}""",mode)

    def test_04_optional_purchase_is_atomic_and_once(self):
        self.career();loan=self.loan_purchase('option')
        r=self.page.evaluate("""id=>{const before=GameState.userClub.presupuesto_dolares,a=MARKET_CONTRACTS.purchaseLoan(id),after=GameState.userClub.presupuesto_dolares,b=MARKET_CONTRACTS.purchaseLoan(id);return {a:a.ok,b:b.ok,debit:before-after,twice:after-GameState.userClub.presupuesto_dolares,club:player(1068088).clubId,loan:player(1068088).loanId}}""",loan['id'])
        self.assertTrue(r['a']);self.assertFalse(r['b']);self.assertEqual(r['debit'],loan['fee']);self.assertEqual(r['twice'],0);self.assertEqual(r['club'],'boca');self.assertIsNone(r.get('loan'))

    def test_05_mandatory_purchase_reserves_and_survives_insufficient_funds(self):
        self.career();loan=self.loan_purchase('mandatory')
        r=self.page.evaluate("""l=>{const reserved=MARKET_CONTRACTS.reserved(),cash=GameState.userClub.presupuesto_dolares;GameState.userClub.presupuesto_dolares=0;MARKET_CONTRACTS.returnLoans(l.end);const pending=MARKET_CONTRACTS.ensure().loans.find(x=>x.id===l.id).status,club=player(1068088).clubId;GameState.userClub.presupuesto_dolares=cash;MARKET_CONTRACTS.returnLoans(l.end);const after=GameState.userClub.presupuesto_dolares;MARKET_CONTRACTS.returnLoans(l.end);return {reserved,pending,club,status:MARKET_CONTRACTS.ensure().loans.find(x=>x.id===l.id).status,debit:cash-after,twice:after-GameState.userClub.presupuesto_dolares}}""",loan)
        self.assertGreaterEqual(r['reserved'],loan['fee']);self.assertEqual(r['pending'],'active');self.assertEqual(r['club'],'boca');self.assertEqual(r['status'],'purchased');self.assertEqual(r['debit'],loan['fee']);self.assertEqual(r['twice'],0)

    def test_06_match_advice_has_evidence_and_requires_explicit_action(self):
        self.career()
        r=self.page.evaluate("""()=>{while(!WORLD_CLOCK.ready())WORLD_CLOCK.advance({silent:true});startMatch();const m=GameState.match;m.paused=true;m.minute=40;m.chances=[{side:m.userSide,xg:.03,playerId:m.lineups[m.userSide][9]},{side:m.userSide,xg:.04},{side:m.userSide,xg:.03},{side:1-m.userSide,xg:.9}];const before=JSON.stringify(GameState.tactics),rows=FM_DEPTH.analysis(),same=before===JSON.stringify(GameState.tactics);FM_DEPTH.adjust('protect');return {rows,same,line:GameState.tactics.line,paused:m.paused}}""")
        self.assertTrue(r['same']);self.assertEqual(r['line'],35);self.assertTrue(r['paused']);self.assertTrue(any(x['action']=='protect' for x in r['rows']));self.assertTrue(any(x['action']=='patient' for x in r['rows']))

    def test_07_complete_season_job_switch_preserves_world(self):
        self.career(mode='classic')
        r=self.page.evaluate("""()=>{let n=0;while(!GameState.finished){if(WORLD_CLOCK.ready()){const g=fixture(currentEvent());WORLD_ENGINE.completeOne({home:g.home==='boca'?2:0,away:g.away==='boca'?2:0,pen:null})}else WORLD_CLOCK.advance({silent:true});if(++n>2200)throw Error('stalled')}FM_DEPTH.seasonReview();const s=FM_DEPTH.ensure(),reviews=s.reviews.length;FM_DEPTH.seasonReview();const job=s.jobs[0];if(!job)throw Error('No projects');FM_DEPTH.acceptJob(job.clubId);const target=job.clubId,history=GameState.history.length;nextSeason();saveGame(true);return {target,club:GameState.userClub.id,year:GameState.year,league:GameState.world.userLeagueId,actualLeague:club(target).leagueId,xi:GameState.tactics.xi.map(id=>player(id).clubId),reviews,sameReviews:s.reviews.length,history,afterHistory:GameState.history.length,stints:s.stints.length,players:GameState.players.length}}""")
        self.assertEqual(r['club'],r['target']);self.assertEqual(r['year'],2027);self.assertEqual(r['league'],r['actualLeague']);self.assertTrue(all(c==r['target'] for c in r['xi']));self.assertEqual(len(r['xi']),11)
        self.assertEqual(r['reviews'],r['sameReviews']);self.assertEqual(r['history'],r['afterHistory']);self.assertEqual(r['stints'],2);self.assertGreaterEqual(r['players'],9220)
        self.page.reload();self.page.wait_for_selector('aside');self.assertEqual(self.page.evaluate('GameState.userClub.id'),r['target'])

    def test_08_filters_and_comparison_persist(self):
        self.career();self.nav('market');self.page.click('[data-market-filters-open="market"]');self.page.select_option('[data-mf-key="country"]',label='España');self.page.select_option('[data-mf-key="league"]','ES1');self.page.fill('[data-mf-key="ageMax"]','25');self.page.locator('#market-filter-form button[type="submit"]').click();self.page.evaluate('saveGame(true)')
        self.page.reload();self.page.wait_for_selector('aside');self.nav('market')
        self.page.click('[data-market-filters-open="market"]');self.assertEqual(self.page.locator('[data-mf-key="country"]').input_value(),'España');self.assertEqual(self.page.locator('[data-mf-key="league"]').input_value(),'ES1');self.assertEqual(self.page.locator('[data-mf-key="ageMax"]').input_value(),'25');self.page.click('[data-mf-close]')
        self.page.evaluate('()=>{GameState.scouting.shortlist=[1068088];view="scouting";render()}');self.page.click('[data-depth-compare]');self.assertIn('1068088',str(self.page.evaluate('FM_DEPTH.ui.compare')))
        self.page.reload();self.page.wait_for_selector('aside');self.nav('scouting');self.assertIn(1068088,self.page.evaluate('FM_DEPTH.ui.compare'))

    def test_09_new_panels_and_loan_controls_fit(self):
        self.career()
        for w,h in [(1280,720),(390,844)]:
            self.page.set_viewport_size({'width':w,'height':h})
            for view in ['career','scouting']:
                self.nav(view);self.fit();self.visible_in_viewport('.fm-continue')
                for tab in self.page.locator('.ws-tabs [data-ws-tab]').all():
                    tab.click();self.fit()
            self.page.evaluate('buy(1068088)');self.page.select_option('#negotiation [name="dealType"]','loan');self.page.select_option('#negotiation [name="purchaseMode"]','mandatory')
            for selector in ['#negotiation [name="purchaseMode"]','#negotiation [name="purchaseFee"]','#negotiation button[type="submit"]']:
                self.visible_in_viewport(selector)
                self.assertTrue(self.page.locator(selector).evaluate('e=>{const r=e.getBoundingClientRect(),at=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return at===e||e.contains(at)}'))
            self.page.click('#negotiation [data-action="close"]')
    def test_10_real_rival_proposal_can_win_a_contract_without_charging_user(self):
        self.career();self.vacancy()
        r=self.page.evaluate("""()=>{const p=player(1068088),c=GameState.world.clubs.find(c=>c.id!=='boca'&&c.id!==p.clubId&&squad(c.id).length<32&&CLUB_AI.canReceive(p,c.id,1000).ok);if(!c)throw Error('No suitable rival');const e=CLUB_AI.economy(c.id);e.cash=10000000;e.wageBudget=1000000;e.reputation=98;const id='choice-test',bid={id:'rival-choice',offerId:id,playerId:p.id,fromClub:p.clubId,toClub:c.id,fee:100000,wage:1000,bonus:0,years:3,releaseClause:p.clausula_rescision,type:'buy',dealType:'permanent',playingTime:'Titular',date:GameState.today,expires:'2026-12-31',status:'open'};FM_DEPTH.ensure().rivalBids.push(bid);GameState.userClub.reputacion=20;const cash=GameState.userClub.presupuesto_dolares,text=FM_DEPTH.chooseRival(p,{id,toClub:'boca',wage:100,playingTime:'Proyecto'});return {text,club:p.clubId,rival:c.id,debit:cash-GameState.userClub.presupuesto_dolares,status:bid.status}}""")
        self.assertTrue(r['text']);self.assertEqual(r['club'],r['rival']);self.assertEqual(r['debit'],0);self.assertEqual(r['status'],'accepted')

    def test_11_season_review_pays_title_once_and_blocks_dismissed_manager(self):
        self.career(mode='classic')
        r=self.page.evaluate("""()=>{const p=mine()[0];p.appearances=1;p.contractBonuses={title:1000};GameState.finished=true;GameState.history=[{year:2026,position:1,champion:'boca',cup:null,sudCup:null,objectiveMet:true,worldRankings:Object.fromEntries(GameState.world.leagues.map(l=>[l.id,l.clubIds]))}];const cash=GameState.userClub.presupuesto_dolares;FM_DEPTH.seasonReview();const after=GameState.userClub.presupuesto_dolares;FM_DEPTH.seasonReview();const once=after-GameState.userClub.presupuesto_dolares;const s=FM_DEPTH.ensure();s.dismissed=true;s.nextClub=null;nextSeason();return {debit:cash-after,once,titles:s.honours.length,year:GameState.year,view}}""")
        self.assertEqual(r['debit'],1000);self.assertEqual(r['once'],0);self.assertEqual(r['titles'],1);self.assertEqual(r['year'],2026);self.assertEqual(r['view'],'career')



if __name__=='__main__':unittest.main(verbosity=2)
