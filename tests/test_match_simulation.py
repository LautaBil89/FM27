#!/usr/bin/env python3
"""Causal possession chains, decisions and migration in the real browser."""
import unittest
from tests import test_match_formats as fixtures


class MatchSimulation(unittest.TestCase):
    setUpClass = classmethod(fixtures.MatchFormats.setUpClass.__func__)
    tearDownClass = classmethod(fixtures.MatchFormats.tearDownClass.__func__)
    setUp = fixtures.MatchFormats.setUp
    tearDown = fixtures.MatchFormats.tearDown
    career = fixtures.MatchFormats.career
    match = fixtures.MatchFormats.match

    def test_01_chains_reconcile_passes_xg_and_participating_players(self):
        self.career(); self.match()
        r=self.page.evaluate("""()=>{const m=GameState.match;view='dashboard';while(m.minute<35){m.paused=false;tick()}const ids=new Set([...m.initialLineups.flat(),...m.lineups.flat()]);return {chains:m.simulation.chains.length,actions:m.simulation.chains.flatMap(c=>c.actions).length,passes:m.stats.map(s=>s.passes),recorded:[0,1].map(side=>Object.entries(m.simulation.playerActions).filter(([id])=>player(Number(id)).clubId===(side===0?m.home:m.away)).reduce((n,[,s])=>n+s.passes,0)),bad:m.simulation.chains.flatMap(c=>c.actions).some(a=>a.playerId&&!ids.has(a.playerId)),shots:m.stats.map(s=>s.shots),chanceShots:[0,1].map(side=>m.chances.filter(c=>c.side===side&&c.type!=='VAR').length),xg:m.stats.map(s=>s.xg),chanceXg:[0,1].map(side=>m.chances.filter(c=>c.side===side).reduce((n,c)=>n+c.xg,0)),linked:m.chances.every(c=>c.chainId&&c.reason&&c.sequencePoints.length)}}""")
        self.assertEqual(r['chains'],35); self.assertGreater(r['actions'],150)
        self.assertEqual(r['passes'],r['recorded']); self.assertFalse(r['bad'])
        self.assertEqual(r['shots'],r['chanceShots']); self.assertTrue(r['linked'])
        for actual,recorded in zip(r['xg'],r['chanceXg']): self.assertAlmostEqual(actual,recorded,places=8)

    def test_02_old_live_match_migrates_and_stays_paused_after_reload(self):
        self.career(); self.match()
        r=self.page.evaluate("""()=>{const m=GameState.match;delete m.simulation;delete m.keyPlays;m.minute=25;m.paused=false;view='dashboard';tick();m.paused=true;saveGame(true);return {minute:m.minute,chains:m.simulation.chains.length,positions:FM_SIMULATION.positions(m,m.userSide).length}}""")
        self.assertEqual(r,{'minute':26,'chains':1,'positions':11})
        self.page.reload();self.page.wait_for_selector('.mc-root')
        self.assertTrue(self.page.evaluate('GameState.match.paused'))
        self.assertEqual(self.page.evaluate('GameState.match.simulation.chains.length'),1)

    def test_03_red_cards_and_injuries_exclude_players_from_future_actions(self):
        self.career();self.match()
        r=self.page.evaluate("""()=>{const m=GameState.match,a=m.lineups[0][2],b=m.lineups[1][3];m.red.push(a);m.injured.push(b);view='dashboard';for(let n=0;n<12;n++){m.paused=false;tick()}return {excluded:m.simulation.chains.flatMap(c=>c.actions).some(c=>[a,b].includes(c.playerId)||[a,b].includes(c.receiverId)),visible:FM_SIMULATION.positions(m,0).length+FM_SIMULATION.positions(m,1).length,ids:m.chances.map(c=>c.playerId),a,b}}""")
        self.assertFalse(r['excluded']); self.assertIn(r['visible'],[20,21])
        self.assertNotIn(r['a'],r['ids']); self.assertNotIn(r['b'],r['ids'])

    def test_04_short_and_direct_play_change_observed_pass_success(self):
        self.career();self.match()
        r=self.page.evaluate("""()=>{const saved=structuredClone(GameState.match),base=structuredClone(GameState.tactics);function sample(style){const m=GameState.match=structuredClone(saved);GameState.tactics=structuredClone(base);GameState.tactics.phases={inPossession:{buildUp:style,progression:'Mixta',finalThird:'Equilibrado',crosses:'Mixtos'}};m.aiTactics.phases={inPossession:{buildUp:style}};m.aiTactics.style='Equilibrado';GameState.tactics.style='Equilibrado';let seed=941;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};for(let i=1;i<=90;i++){m.minute=i;FM_SIMULATION.step(m)}return {attempts:m.stats.reduce((n,s)=>n+s.passes,0),success:m.stats.reduce((n,s)=>n+s.completedPasses,0)}}return {short:sample('Corta'),direct:sample('Directa')}}""")
        self.assertGreater(r['short']['success']/r['short']['attempts'],r['direct']['success']/r['direct']['attempts']+.03)

    def test_05_opponent_adjustments_have_evidence_and_bounded_changes(self):
        self.career();self.match()
        r=self.page.evaluate("""()=>{const m=GameState.match;FM_SIMULATION.ensure(m);m.minute=60;m.score[m.userSide]=2;m.score[1-m.userSide]=0;const before={...m.aiTactics};const adjusted=FM_MATCH_REALISM.adaptAI(m),once=m.simulation.aiDecisions.length;FM_MATCH_REALISM.adaptAI(m);return {adjusted,once,record:m.simulation.aiDecisions[0],before,after:m.aiTactics,duplicates:m.simulation.aiDecisions.filter(d=>d.minute===60).length}}""")
        self.assertTrue(r['adjusted']); self.assertEqual(r['once'],1)
        self.assertTrue(r['record']['evidence']);self.assertTrue(r['record']['reason']);self.assertEqual(r['duplicates'],1)
        for key in ['line','pressing','tempo']: self.assertLessEqual(abs(r['after'][key]-r['before'][key]),12)

    def test_06_seeded_match_distribution_remains_football_like(self):
        self.career();self.match()
        r=self.page.evaluate("""()=>{const saved=structuredClone(GameState.match);view='dashboard';let shots=0,xg=0,passes=0;const conditions=GameState.players.map(p=>p.condicion_fisica);for(let k=0;k<8;k++){GameState.match=structuredClone(saved);for(let i=0;i<GameState.players.length;i++)GameState.players[i].condicion_fisica=conditions[i];const m=GameState.match;let seed=331+k*97;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};while(!m.done){m.paused=false;tick();if(m.minute>130)throw Error('clock stalled')}shots+=m.stats.reduce((n,s)=>n+s.shots,0);xg+=m.stats.reduce((n,s)=>n+s.xg,0);passes+=m.stats.reduce((n,s)=>n+s.passes,0)}return {shots:shots/8,xg:xg/8,passes:passes/8}}""")
        self.assertGreater(r['shots'],10);self.assertLess(r['shots'],40)
        self.assertGreater(r['xg'],.8);self.assertLess(r['xg'],5)
        self.assertGreater(r['passes'],450);self.assertLess(r['passes'],1100)

    def test_07_open_play_shooter_is_actual_carrier_without_fictional_assist(self):
        self.career();self.match()
        r=self.page.evaluate("""()=>{const m=GameState.match,s=FM_SIMULATION.ensure(m),side=m.userSide,id=m.lineups[side][6];s.owner=side;s.carrier=id;s.progress=88;s.lateral=50;m.minute=1;Math.random=()=>.02;const result=FM_SIMULATION.step(m),shot=FM_SIMULATION.shotContext(m,side);return {id,result,shooter:shot?.shooterId,supplier:shot?.supplierId,actor:s.chains.at(-1).actions.at(-1).playerId}}""")
        self.assertTrue(r['result']['shot']);self.assertEqual(r['shooter'],r['id']);self.assertEqual(r['actor'],r['id']);self.assertIsNone(r['supplier'])

    def test_08_short_corner_records_actual_taker_and_receiver(self):
        self.career();self.match()
        r=self.page.evaluate("""()=>{const m=GameState.match,side=m.userSide,ids=m.lineups[side],taker=ids[5],receiver=ids[8],cover=ids[2];GameState.tactics.setPieces={corner:'Corto',cornerTaker:taker,edgeOfArea:receiver,stayBack:cover};const s=FM_SIMULATION.ensure(m);s.owner=side;s.carrier=ids[6];s.progress=75;m.stats[side].corners=1;m.minute=1;Math.random=()=>.02;FM_SIMULATION.step(m);const a=s.chains.at(-1).actions;return {taker,receiver,cover,corner:a.find(a=>a.type==='córner'),pass:a.find(a=>a.reason==='Córner corto al apoyo designado'),shot:s.lastShot}}""")
        self.assertEqual(r['corner']['playerId'],r['taker']);self.assertEqual(r['pass']['playerId'],r['taker']);self.assertEqual(r['pass']['receiverId'],r['receiver']);self.assertEqual(r['shot']['shooterId'],r['receiver'])

    def test_09_extra_time_match_saves_complete_highlights_below_storage_budget(self):
        self.career();self.match()
        r=self.page.evaluate("""()=>{const m=GameState.match;for(let i=1;i<=120;i++){m.minute=i;const result=FM_SIMULATION.step(m);if(result.shot){const c=FM_SIMULATION.shotContext(m,result.side);FM_SIMULATION.recordChance(m,{minute:i,side:result.side,playerId:c.shooterId,type:c.type,xg:c.xg,outcome:'desviado'})}}saveGame(true);return {size:WORLD_STORAGE.inspect(GameState),chains:m.simulation.chains.length,first:m.simulation.chains[0].minute,last:m.simulation.chains.at(-1).minute,saved:!!localStorage.getItem('fm27-pasion-v1')}}""")
        self.assertTrue(r['saved']);self.assertEqual((r['chains'],r['first'],r['last']),(120,1,120))
        self.assertLess(r['size']['localStorageBytes'],5*1024*1024,r['size'])


if __name__=='__main__':unittest.main()
