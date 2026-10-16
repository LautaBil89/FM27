#!/usr/bin/env python3
"""Browser coverage for career-only hierarchy, actual participation and mentoring."""
import os
import shutil
import unittest
from playwright.sync_api import sync_playwright

URL=os.environ.get('FM27_TEST_URL','http://127.0.0.1:8000/index.html')

class DressingRoomDepth(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pw=sync_playwright().start()
        cls.browser=cls.pw.chromium.launch(executable_path=os.environ.get('FM27_CHROMIUM') or shutil.which('chromium'),headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])

    @classmethod
    def tearDownClass(cls):
        cls.browser.close();cls.pw.stop()

    def setUp(self):
        self.context=self.browser.new_context(viewport={'width':1280,'height':720})
        self.page=self.context.new_page();self.errors=[]
        self.page.on('pageerror',lambda e:self.errors.append(str(e)))
        self.page.on('dialog',lambda d:d.accept())
        self.page.route('https://**/*',lambda r:r.abort())
        self.page.goto(URL,wait_until='domcontentloaded')
        self.page.fill('#manager','DT vestuario')
        self.page.select_option('#club','boca')
        self.page.click('[data-action="new"]');self.page.wait_for_selector('aside')

    def tearDown(self):
        self.context.close();self.assertEqual(self.errors,[])

    def test_01_previous_relationship_migrates_without_losing_commitment(self):
        result=self.page.evaluate('''()=>{const p=mine()[0];GameState.world.dressingRoom={version:1,players:{[p.id]:{trust:43,role:'Titular',minutes:90,opportunities:2,lastMinutes:p.minutes||0,joined:GameState.today,promise:{status:'active',target:180,baseline:0,deadline:'2026-03-01'}}},history:[],matches:[]};const s=FM_DRESSING_ROOM.ensure(),r=s.players[p.id],out={id:p.id,trust:r.trust,role:r.role,minutes:r.minutes,promise:r.promise,traits:r.traits,leadership:r.leadership,hierarchy:FM_DRESSING_ROOM.hierarchy()};saveGame(true);return out}''')
        self.assertEqual(result['trust'],43);self.assertEqual(result['role'],'Titular');self.assertEqual(result['minutes'],90);self.assertEqual(result['promise']['target'],180)
        self.assertTrue(all(1<=n<=20 for n in result['traits'].values()))
        self.assertEqual(sum(p['rank']=='Capitán' for p in result['hierarchy']),1)
        self.page.reload();self.page.wait_for_selector('aside')
        actual=self.page.evaluate('(id)=>FM_DRESSING_ROOM.ensure().players[id]',result['id'])
        self.assertEqual(actual['traits'],result['traits']);self.assertEqual(actual['trust'],43);self.assertEqual(actual['promise'],result['promise'])

    def test_02_minutes_concern_uses_actual_eligible_games_and_cannot_be_talked_away(self):
        result=self.page.evaluate('''()=>{const p=mine()[0],r=FM_DRESSING_ROOM.ensure().players[p.id];r.role='Titular';p.injury=5;for(let i=0;i<3;i++)FM_DRESSING_ROOM.onMatchResult({id:'unavailable-'+i});const absent=FM_DRESSING_ROOM.participation(p.id);p.injury=0;p.ban=0;p.registered=true;for(let i=0;i<3;i++)FM_DRESSING_ROOM.onMatchResult({id:'available-'+i});const before=r.trust,e=FM_DRESSING_ROOM.participation(p.id),text=FM_DRESSING_ROOM.talk(p.id,'minutes'),active=r.concern.active;FM_DRESSING_ROOM.setRole(p.id,'Proyecto');return {absent,e,text,active,before,after:r.trust,recent:r.recent.length}}''')
        self.assertEqual(result['absent']['matches'],0);self.assertEqual(result['e']['matches'],3)
        self.assertEqual(result['e']['minutes'],0);self.assertEqual(result['e']['target'],165)
        self.assertTrue(result['active']);self.assertIn('165',result['text'])
        self.assertLess(result['after'],result['before']);self.assertLessEqual(result['recent'],6)

    def test_03_injury_extends_promise_once_and_actual_minutes_fulfil_it_once(self):
        result=self.page.evaluate('''()=>{const p=mine()[0],r=FM_DRESSING_ROOM.ensure().players[p.id];p.injury=0;FM_DRESSING_ROOM.promiseMinutes(p.id);const original=r.promise.deadline;GameState.today=new Date(Date.parse(GameState.today)+86400000).toISOString().slice(0,10);p.injury=5;FM_DRESSING_ROOM.onDayAdvance();const extended=r.promise.deadline;FM_DRESSING_ROOM.onDayAdvance();const once=r.promise.deadline;p.injury=0;p.minutes=(p.minutes||0)+90;FM_DRESSING_ROOM.onMatchResult({id:'promise-one'});FM_DRESSING_ROOM.onMatchResult({id:'promise-one'});const half=r.minutes;p.minutes+=90;FM_DRESSING_ROOM.onMatchResult({id:'promise-two'});const trust=r.trust;FM_DRESSING_ROOM.onDayAdvance();return {original,extended,once,half,status:r.promise.status,trust,again:r.trust,messages:GameState.inbox.filter(m=>m.title==='Promesa cumplida').length}}''')
        self.assertGreater(result['extended'],result['original']);self.assertEqual(result['extended'],result['once'])
        self.assertEqual(result['half'],90);self.assertEqual(result['status'],'fulfilled');self.assertEqual(result['trust'],result['again']);self.assertEqual(result['messages'],1)

    def test_04_mentoring_has_capacity_deadline_persistence_and_bounded_effects(self):
        result=self.page.evaluate('''()=>{const s=FM_DRESSING_ROOM.ensure(),mentor=mine().find(p=>p.edad>=26),young=mine().filter(p=>p.edad<=23).slice(0,3);if(young.length<3)throw Error('Insufficient young players');s.players[mentor.id].leadership=16;s.players[mentor.id].traits.professionalism=16;for(const p of young)s.players[p.id].traits.professionalism=12;const base=FM_DRESSING_ROOM.developmentModifier(young[0]);FM_DRESSING_ROOM.startMentoring(mentor.id,young[0].id);const active=FM_DRESSING_ROOM.developmentModifier(young[0]);FM_DRESSING_ROOM.startMentoring(mentor.id,young[0].id);FM_DRESSING_ROOM.startMentoring(mentor.id,young[1].id);FM_DRESSING_ROOM.startMentoring(mentor.id,young[2].id);const capacity=s.mentoring.filter(m=>m.status==='active').length;GameState.today=s.mentoring[0].deadline;FM_DRESSING_ROOM.onDayAdvance();const completed=s.mentoring.map(m=>m.status),professionalism=s.players[young[0].id].traits.professionalism,trust=s.players[young[0].id].trust;FM_DRESSING_ROOM.onDayAdvance();saveGame(true);return {base,active,capacity,completed,professionalism,trust,again:s.players[young[0].id].trust,id:young[0].id,count:s.mentoring.length}}''')
        self.assertGreater(result['active'],result['base']);self.assertLessEqual(result['active'],1.10)
        self.assertEqual(result['capacity'],2);self.assertEqual(result['completed'],['completed','completed']);self.assertEqual(result['professionalism'],13);self.assertEqual(result['trust'],result['again'])
        self.page.reload();self.page.wait_for_selector('aside')
        self.assertEqual(self.page.evaluate('(id)=>FM_DRESSING_ROOM.ensure().players[id].traits.professionalism',result['id']),13)
        self.assertEqual(self.page.evaluate('FM_DRESSING_ROOM.ensure().mentoring.length'),2)

    def test_05_transfer_interrupts_mentoring_without_unearned_development(self):
        result=self.page.evaluate('''()=>{const s=FM_DRESSING_ROOM.ensure(),mentor=mine().find(p=>p.edad>=26),young=mine().find(p=>p.edad<=23);s.players[mentor.id].leadership=16;s.players[mentor.id].traits.professionalism=16;const before=s.players[young.id].traits.professionalism;FM_DRESSING_ROOM.startMentoring(mentor.id,young.id);mentor.clubId='river';WORLD_ENGINE.reindex();GameState.today=new Date(Date.parse(GameState.today)+86400000).toISOString().slice(0,10);FM_DRESSING_ROOM.onDayAdvance();FM_DRESSING_ROOM.onDayAdvance();return {before,after:s.players[young.id].traits.professionalism,status:s.mentoring[0].status,messages:GameState.inbox.filter(m=>m.title==='Mentoría interrumpida').length}}''')
        self.assertEqual(result['status'],'interrupted');self.assertEqual(result['before'],result['after']);self.assertEqual(result['messages'],1)

    def test_06_leadership_and_meeting_have_evidence_cooldowns_and_bounds(self):
        result=self.page.evaluate('''()=>{const s=FM_DRESSING_ROOM.ensure(),captain=player(GameState.tactics.captain),r=s.players[captain.id],before=r.trust;FM_DRESSING_ROOM.talk(captain.id,'leadership');const after=r.trust;FM_DRESSING_ROOM.talk(captain.id,'leadership');const twice=r.trust;club(GameState.userClub.id).form=['G','G','G'];const text=FM_DRESSING_ROOM.teamMeeting('demand'),boost=s.meetingBoost;FM_DRESSING_ROOM.teamMeeting('encourage');const unchanged=s.meetingBoost;r.trust=0;r.adaptation=0;const low=FM_DRESSING_ROOM.matchModifier(captain);r.trust=100;r.adaptation=100;s.meetingBoost=100;const high=FM_DRESSING_ROOM.matchModifier(captain),other=GameState.players.find(p=>p.clubId!==GameState.userClub.id);return {before,after,twice,text,boost,unchanged,low,high,external:FM_DRESSING_ROOM.matchModifier(other)}}''')
        self.assertGreater(result['after'],result['before']);self.assertEqual(result['after'],result['twice'])
        self.assertIn('0 derrotas',result['text']);self.assertEqual(result['boost'],-1);self.assertEqual(result['unchanged'],-1)
        self.assertGreaterEqual(result['low'],.97);self.assertLessEqual(result['high'],1.03);self.assertEqual(result['external'],1)

    def test_07_initial_form_is_not_presented_as_recorded_match_evidence(self):
        result=self.page.evaluate('''()=>{const p=mine()[0],r=FM_DRESSING_ROOM.ensure().players[p.id];delete p.lastRating;p.estado_forma=9;p.appearances=0;const before={trust:r.trust,moral:p.moral,lastTalk:r.lastTalk},praise=FM_DRESSING_ROOM.talk(p.id,'praise'),criticize=FM_DRESSING_ROOM.talk(p.id,'criticize'),after={trust:r.trust,moral:p.moral,lastTalk:r.lastTalk};p.lastRating=8;const recorded=FM_DRESSING_ROOM.talk(p.id,'praise');return {before,after,praise,criticize,recorded,trust:r.trust}}''')
        self.assertEqual(result['before'],result['after']);self.assertIn('estimación',result['praise']);self.assertIn('estimación',result['criticize'])
        self.assertIn('8.0',result['recorded']);self.assertGreater(result['trust'],result['after']['trust'])

    def test_08_all_workspaces_keep_actions_visible_on_mobile_and_low_desktop(self):
        self.page.evaluate('()=>{view="dressing-room";render()}')
        for width,height in [(1280,720),(390,844)]:
            self.page.set_viewport_size({'width':width,'height':height})
            for pane,selectors in [('players',['.dr-person']),('talk',['[data-social-player]','[data-social-conversation]','[data-social-converse]','[data-social-promise]']),('group',['[data-social-captain]','[data-social-meeting="demand"]']),('commitments',['[data-social-mentor]','[data-social-young]','[data-social-mentoring]'])]:
                self.page.click(f'[data-social-pane="{pane}"]')
                dimensions=self.page.evaluate('({height:innerHeight,width:innerWidth,scroll:document.documentElement.scrollHeight,wide:document.documentElement.scrollWidth})')
                self.assertLessEqual(dimensions['scroll'],height+1,dimensions);self.assertLessEqual(dimensions['wide'],width+1,dimensions)
                for selector in selectors:
                    rect=self.page.locator(selector).first.evaluate('''e=>{const r=e.getBoundingClientRect(),at=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,visible:!!e.getClientRects().length,covered:at!==e&&!e.contains(at)}}''')
                    self.assertTrue(rect['visible'],(pane,selector,rect));self.assertGreaterEqual(rect['top'],0,(pane,selector,rect));self.assertLessEqual(rect['bottom'],height+1,(pane,selector,rect));self.assertFalse(rect['covered'],(pane,selector,rect))

    def test_09_new_role_expectations_fit_a_full_roster_and_preserve_explicit_roles(self):
        result=self.page.evaluate("""()=>{const s=FM_DRESSING_ROOM.ensure(),members=mine(),old=s.players[members.at(-1).id];const count=Object.fromEntries(['Titular','Rotación','Proyecto'].map(role=>[role,members.filter(p=>s.players[p.id].role===role).length]));const target=members.reduce((sum,p)=>sum+FM_DRESSING_ROOM.participation(p.id).expected,0);old.role='Titular';const p=members.find(p=>s.players[p.id].role==='Proyecto'),r=s.players[p.id];r.recent=Array.from({length:3},(_,i)=>({id:'r'+i,eligible:true,minutes:0}));const early=FM_DRESSING_ROOM.participation(p.id);r.recent=Array.from({length:6},(_,i)=>({id:'r'+i,eligible:true,minutes:0}));const later=FM_DRESSING_ROOM.participation(p.id);FM_DRESSING_ROOM.ensure();return {count,target,early,later,preserved:s.players[members.at(-1).id].role}}""")
        self.assertGreater(result['count']['Proyecto'],0);self.assertLessEqual(result['target'],990);self.assertFalse(result['early']['enough']);self.assertTrue(result['later']['enough']);self.assertEqual(result['preserved'],'Titular')

if __name__=='__main__':unittest.main(verbosity=2)
