#!/usr/bin/env python3
"""Checkpoints retain the final recorded action before a pause, finish or reload."""
import unittest

import test_match_formats as base


class MatchPersistence(unittest.TestCase):
    setUpClass = classmethod(base.MatchFormats.setUpClass.__func__)
    tearDownClass = classmethod(base.MatchFormats.tearDownClass.__func__)
    setUp = base.MatchFormats.setUp
    tearDown = base.MatchFormats.tearDown
    career = base.MatchFormats.career
    match = base.MatchFormats.match

    def checkpoint(self, target, extra_time=False):
        self.career(); self.match()
        state = self.page.evaluate("""async({target,extraTime})=>{
          const m=GameState.match;
          view='dashboard';m.minute=target-1;m.paused=false;m.addedTime=2;
          m.halfTimeTaken=target>45;m.aiAdjustments=[];
          if(extraTime){currentEvent().stage='FINAL';m.extraTime=true;m.regulationEnd=90;m.extraEnd=120;m.extraHalfTimeTaken=target>105;m.extraHalfTime=false}
          GameState.tactics.tempo=100;
          const s=FM_SIMULATION.ensure(m);s.owner=m.userSide;s.carrier=m.lineups[m.userSide].find(id=>player(id).posicion==='DEL');s.progress=90;s.lateral=50;
          Math.random=()=>.04;
          tick();clearInterval(timer);timer=null;const waiting=Date.now();while(WORLD_STORAGE.pending()){if(Date.now()-waiting>30000)throw Error('Autoguardado del partido sin completar');await new Promise(resolve=>setTimeout(resolve,25))}
          const snapshot=match=>({minute:match.minute,score:match.score,chances:match.chances,keyPlays:match.keyPlays,chains:match.simulation.chains,decisions:match.simulation.aiDecisions,adjustments:match.aiAdjustments,aiTactics:match.aiTactics});
          const live=snapshot(m),saved=snapshot(WORLD_STORAGE.decode(JSON.parse(localStorage.getItem(KEY))).match);
          return {live,saved,paused:m.paused,done:m.done};
        }""", {'target': target, 'extraTime': extra_time})
        self.assertEqual(state['live']['minute'], target)
        self.assertEqual(len(state['live']['chances']), 1)
        self.assertEqual(state['live']['chances'][0]['outcome'], 'gol')
        self.assertTrue(state['live']['chances'][0]['chainId'])
        self.assertEqual(state['live']['chains'][-1]['outcome'], 'gol')
        self.assertEqual(state['live'], state['saved'])
        self.page.reload(wait_until='domcontentloaded');self.page.wait_for_selector('.mc-root')
        restored=self.page.evaluate("""()=>{const m=GameState.match;return {minute:m.minute,score:m.score,chances:m.chances,keyPlays:m.keyPlays,chains:m.simulation.chains,decisions:m.simulation.aiDecisions,adjustments:m.aiAdjustments,aiTactics:m.aiTactics}}""")
        self.assertEqual(restored,state['live'])
        self.assertTrue(self.page.evaluate('GameState.match.paused'))
        return state

    def test_01_half_time_checkpoint_retains_last_goal_and_sequence(self):
        state=self.checkpoint(45)
        self.assertTrue(state['paused']);self.assertFalse(state['done'])

    def test_02_final_checkpoint_retains_last_goal_and_sequence(self):
        state=self.checkpoint(92)
        self.assertTrue(state['paused']);self.assertTrue(state['done'])

    def test_03_extra_time_periodic_checkpoint_retains_last_goal(self):
        state=self.checkpoint(110,extra_time=True)
        self.assertFalse(state['paused']);self.assertFalse(state['done'])

    def test_04_extra_time_final_checkpoint_retains_last_goal(self):
        state=self.checkpoint(120,extra_time=True)
        self.assertTrue(state['paused']);self.assertTrue(state['done'])


if __name__=='__main__':unittest.main(verbosity=2)
