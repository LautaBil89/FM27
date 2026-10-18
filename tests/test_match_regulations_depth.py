"""Exercise live match rules, instructions and recorded individual decisions."""
import unittest
import test_offer_form as fixture


class MatchRegulationsDepth(unittest.TestCase):
    setUpClass = classmethod(fixture.OfferFormScenarios.setUpClass.__func__)
    tearDownClass = classmethod(fixture.OfferFormScenarios.tearDownClass.__func__)
    setUp = fixture.OfferFormScenarios.setUp
    tearDown = fixture.OfferFormScenarios.tearDown
    seed = fixture.OfferFormScenarios.seed

    def match(self):
        self.page.evaluate("""()=>{const e=WORLD_CLOCK.nextFixture();GameState.today=e.date;WORLD_CLOCK.ensure().slot=WORLD_CLOCK.eventSlot(e);startMatch();clearInterval(timer);timer=null;GameState.match.paused=true;view='dashboard';render()}""")

    def test_tactical_team_factors_reach_recorded_possessions(self):
        self.match()
        r = self.page.evaluate("""()=>{
          const base=structuredClone(GameState.match),people=structuredClone(GameState.players),tactics=structuredClone(GameState.tactics),originalRandom=Math.random,originalInjury=FM_MEDICINE.maybeInjury;
          FM_MEDICINE.maybeInjury=()=>null;
          function sample(shout){GameState.match=structuredClone(base);GameState.players=structuredClone(people);WORLD_ENGINE.reindex();GameState.tactics=structuredClone(tactics);const m=GameState.match;if(shout)m.shout={attack:80,build:80,defense:80,until:100};let seed=891;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};while(m.minute<30&&!m.done){m.paused=false;tick()}return {passes:m.stats[m.userSide].completedPasses,xg:m.stats[m.userSide].xg,chains:JSON.stringify(m.simulation.chains)}}
          const baseRun=sample(false),boosted=sample(true);Math.random=originalRandom;FM_MEDICINE.maybeInjury=originalInjury;return {different:baseRun.chains!==boosted.chains,base:baseRun.passes,boost:boosted.passes,baseXg:baseRun.xg,boostXg:boosted.xg};
        }""")
        self.assertTrue(r['different'])
        self.assertTrue(r['boost'] > r['base'] or r['boostXg'] > r['baseXg'], r)

    def test_penalty_sequence_uses_the_actual_fallback_taker(self):
        self.match()
        r = self.page.evaluate("""()=>{const m=GameState.match,side=m.userSide,s=FM_SIMULATION.ensure(m),original=Math.random;GameState.tactics.penaltyTaker=-1;s.owner=side;s.carrier=m.lineups[side][6];s.progress=88;s.lateral=50;m.minute=1;Math.random=()=>0;const passage=FM_SIMULATION.step(m),shot=FM_SIMULATION.shotContext(m,side);FM_SIMULATION.recordChance(m,{minute:1,side,playerId:shot.shooterId,type:shot.type,xg:shot.xg,outcome:'gol'});Math.random=original;const chain=s.chains.at(-1);return {passage,shot,actor:chain.actions.findLast(a=>a.type==='remate').playerId,chainScorer:chain.playerId,expected:FM_MATCH_RULES.active(m,side).filter(id=>id!==FM_MATCH_RULES.keeperId(m,side)).sort((a,b)=>FM_ATTRIBUTES.skill(player(b),'penales')-FM_ATTRIBUTES.skill(player(a),'penales'))[0]}}""")
        self.assertTrue(r['passage']['shot'])
        self.assertEqual(r['shot']['type'], 'penal')
        self.assertEqual(r['shot']['shooterId'], r['expected'])
        self.assertEqual(r['actor'], r['expected'])
        self.assertEqual(r['chainScorer'], r['expected'])

    def test_fewer_than_seven_abandons_without_fictional_scorers(self):
        self.match()
        r = self.page.evaluate("""()=>{const m=GameState.match,side=m.userSide;m.score[side]=2;m.score[1-side]=1;m.red.push(...m.lineups[side].slice(1,6));const minute=m.minute;m.paused=false;tick();return {done:m.done,paused:m.paused,abandoned:m.abandoned,score:m.score,side,minute:minute===m.minute,goals:m.goalEvents.length}}""")
        self.assertTrue(r['done']); self.assertTrue(r['paused']); self.assertTrue(r['minute'])
        self.assertEqual(r['score'][r['side']], 0)
        self.assertEqual(r['score'][1-r['side']], 3)
        self.assertEqual(r['goals'], 0)
        self.assertEqual(r['abandoned']['playedScore'][r['side']], 2)

    def test_live_formation_and_emergency_keeper_use_existing_players(self):
        self.match()
        r = self.page.evaluate("""()=>{const m=GameState.match,side=m.userSide,before=[...m.lineups[side]],subs=m.substitutions,normal=FM_MATCH_RULES.keeperAbility(player(FM_MATCH_RULES.keeperId(m,side)));view='match';render();document.querySelector('[data-mc-tab="changes"]').click();return {normal,before,subs,side}}""")
        self.page.locator('[data-mc-formation]').select_option('4-2-3-1')
        candidate = self.page.evaluate('FM_MATCH_RULES.active(GameState.match,GameState.match.userSide).find(id=>player(id).posicion!=="POR")')
        self.page.locator('[data-mc-keeper]').select_option(str(candidate))
        after = self.page.evaluate("""()=>{const m=GameState.match;return {formation:GameState.tactics.formation,ids:m.lineups[m.userSide],subs:m.substitutions,keeper:FM_MATCH_RULES.keeperId(m,m.userSide),ability:FM_MATCH_RULES.keeperAbility(player(FM_MATCH_RULES.keeperId(m,m.userSide)))}}""")
        self.assertEqual(after['formation'], '4-2-3-1'); self.assertCountEqual(after['ids'], r['before'])
        self.assertEqual(after['subs'], r['subs']); self.assertEqual(after['keeper'], candidate)
        self.assertLess(after['ability'], r['normal'])

    def test_individual_shootout_order_excludes_extra_eligible_players(self):
        self.match()
        r = self.page.evaluate("""()=>{const m=GameState.match,side=m.userSide,other=1-side,original=Math.random;m.red.push(m.lineups[other].at(-1));m.pendingPenalties=true;m.paused=true;const preferred=[...FM_MATCH_RULES.active(m,side)].reverse(),set=FM_TACTICS.setShootoutOrder(preferred),keeper=FM_MATCH_RULES.keeperId(m,side),selection=FM_MATCH_RULES.shootout(m,side);Math.random=()=>.2;const resolved=resolveMatchPenalties();Math.random=original;return {set,resolved,done:m.done,selection,keeper,pen:m.pen,eligible:[FM_MATCH_RULES.active(m,0),FM_MATCH_RULES.active(m,1)]}}""")
        self.assertTrue(r['set']); self.assertTrue(r['resolved']); self.assertTrue(r['done'])
        self.assertEqual(len(r['pen']['order'][0]), len(r['pen']['order'][1]))
        self.assertEqual(len(r['selection']['excluded']), 1)
        self.assertIn(r['keeper'], r['selection']['order'])
        self.assertEqual(r['pen']['kicks'][0]['playerId'], r['pen']['order'][0][0])
        self.assertTrue(all(k['playerId'] in r['eligible'][k['side']] for k in r['pen']['kicks']))
        self.assertNotEqual(r['pen']['home'], r['pen']['away'])

    def test_competition_rules_are_snapshotted_and_extra_time_adds_one_change(self):
        self.match()
        r = self.page.evaluate("""()=>{const m=GameState.match,initial=FM_MATCH_RULES.limits(m);GameState.calendar.find(e=>e.id===m.eventId).matchRules={bench:3,substitutions:2,windows:1};const unchanged=FM_MATCH_RULES.limits(m);m.extraTime=true;m.regulationEnd=94;m.minute=94;return {initial,unchanged,extra:FM_MATCH_RULES.limits(m),free:FM_MATCH_RULES.freeWindow(m),europe:FM_MATCH_RULES.profile({type:'LPF',leagueId:'IT1'})}}""")
        self.assertEqual(r['initial'], r['unchanged'])
        self.assertEqual(r['extra']['substitutions'], r['initial']['substitutions']+1)
        self.assertEqual(r['extra']['windows'], r['initial']['windows']+1)
        self.assertTrue(r['free']); self.assertEqual(r['europe']['bench'], 15)


if __name__ == '__main__':
    unittest.main()
