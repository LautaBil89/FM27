"""The actual match clock and player workspace respect medical and scouting records."""
import unittest
from tests import test_match_formats as fixtures


class MedicalProfileIntegration(unittest.TestCase):
    setUpClass = classmethod(fixtures.MatchFormats.setUpClass.__func__)
    tearDownClass = classmethod(fixtures.MatchFormats.tearDownClass.__func__)
    setUp = fixtures.MatchFormats.setUp
    tearDown = fixtures.MatchFormats.tearDown
    career = fixtures.MatchFormats.career
    match = fixtures.MatchFormats.match
    fit = fixtures.MatchFormats.fit

    def test_01_actual_tick_applies_medical_fatigue_once_and_checks_each_active_player(self):
        self.career(); self.match()
        result = self.page.evaluate('''()=>{const m=GameState.match,originalMinute=FM_MEDICINE.onMinute,originalInjury=FM_MEDICINE.maybeInjury;let calls=0,checks=0,afterMinute={};FM_MEDICINE.onMinute=(current)=>{calls++;const result=originalMinute(current);afterMinute=Object.fromEntries(current.lineups.flat().map(id=>[id,player(id).condicion_fisica]));return result};FM_MEDICINE.maybeInjury=()=>{checks++;return null};view='dashboard';m.paused=false;tick();FM_MEDICINE.onMinute=originalMinute;FM_MEDICINE.maybeInjury=originalInjury;return {calls,checks,minute:m.minute,counts:Object.values(m.minutesPlayed),medicalMinutes:Object.values(m.medical.minutes),doubleFatigue:m.lineups.flat().some(id=>Math.abs(player(id).condicion_fisica-afterMinute[id])>1e-9)}}''')
        self.assertEqual(result['calls'], 1)
        self.assertEqual(result['checks'], 22)
        self.assertEqual(result['minute'], 1)
        self.assertEqual(result['counts'], [1] * 22)
        self.assertEqual(result['medicalMinutes'], [1] * 22)
        self.assertFalse(result['doubleFatigue'])

    def test_02_typed_injury_is_logged_once_and_excludes_future_actions(self):
        self.career(); self.match()
        result = self.page.evaluate('''()=>{const m=GameState.match,id=m.lineups[m.userSide][8],original=FM_MEDICINE.maybeInjury;FM_MEDICINE.maybeInjury=(p,current)=>p.id===id?original(p,current,{random:()=>0}):null;view='dashboard';m.paused=false;tick();m.paused=false;tick();FM_MEDICINE.maybeInjury=original;const p=player(id),report=FM_MEDICINE.report(p);return {injured:m.injured.filter(pid=>pid===id).length,events:m.injuryEvents.filter(e=>e.playerId===id),minutes:m.minutesPlayed[id],medicalMinutes:m.medical.minutes[id],diagnosis:report.injury.label,feed:m.feed.filter(row=>row.text.includes('pronóstico inicial')),actedAgain:m.simulation.chains.filter(c=>c.minute===2).some(c=>c.actions.some(a=>a.playerId===id||a.receiverId===id))}}''')
        self.assertEqual(result['injured'], 1)
        self.assertEqual(len(result['events']), 1)
        self.assertEqual(result['events'][0]['type'], result['diagnosis'])
        self.assertEqual(result['minutes'], 1)
        self.assertEqual(result['medicalMinutes'], 1)
        self.assertEqual(len(result['feed']), 1)
        self.assertFalse(result['actedAgain'])

    def test_03_hidden_potential_and_unobserved_changes_do_not_leak_to_profile(self):
        self.career()
        result = self.page.evaluate('''()=>{const p=GameState.players.find(p=>p.clubId&&p.clubId!==GameState.userClub.id),ownPlayer=mine()[0];FM_PLAYER.open(p.id);FM_PLAYER.state.tab='attributes';const before=FM_PLAYER.renderPage(),attributes=FM_PLAYER.attributes(p),stars=FM_PLAYER.relativeStars(p,true);p.potential=p.potential===99?1:99;for(const key of ['ritmo','tiro','pase','regate','defensa','fisico'])p[key]=p[key]>50?1:99;const after=FM_PLAYER.renderPage();ownPlayer.potential=99;FM_PLAYER.captureProgress();const saved=structuredClone(GameState.world.playerProgress[ownPlayer.id]);ownPlayer.potential=1;return {same:before===after,attributesSame:JSON.stringify(attributes)===JSON.stringify(FM_PLAYER.attributes(p)),starsSame:stars===FM_PLAYER.relativeStars(p,true),numericPotential:saved.some(r=>Object.hasOwn(r,'potential')),observed:saved.every(r=>r.potentialLow<r.potentialHigh)}}''')
        self.assertTrue(result['same'])
        self.assertTrue(result['attributesSame'])
        self.assertTrue(result['starsSame'])
        self.assertFalse(result['numericPotential'])
        self.assertTrue(result['observed'])

    def test_04_medical_profile_contract_and_observed_progress_fit_viewports(self):
        self.career()
        result = self.page.evaluate('''()=>{const p=mine()[1];MARKET_CONTRACTS.setContract(p,3,GameState.today);FM_MEDICINE.injure(p,{type:'hamstring',days:15,notify:false});FM_PLAYER.open(p.id);return {id:p.id,end:date(MARKET_CONTRACTS.contractEnd(p))}}''')
        self.page.click('[data-fp-tab="contract"]')
        self.assertIn(result['end'], self.page.locator('#content').inner_text())
        for width, height in [(1366,768), (1280,720), (390,844), (360,740)]:
            self.page.set_viewport_size({'width':width, 'height':height})
            self.page.click('[data-fp-tab="health"]')
            self.fit()
            self.assertIn('Condición y preparación', self.page.locator('#content').inner_text())
            buttons=self.page.locator('[data-ws-tab]')
            self.assertGreaterEqual(buttons.count(), 3)
        self.page.set_viewport_size({'width':1366,'height':768})
        self.page.evaluate("()=>{FM_PLAYER.state.tab='health';render()}")
        self.assertNotIn('historial médico privado', self.page.locator('#content').inner_text())

    def test_05_league_season_archive_does_not_archive_other_clubs(self):
        self.career()
        result=self.page.evaluate('''()=>{const ownLeague=GameState.world.userLeagueId,other=GameState.world.leagues.find(l=>l.id!==ownLeague),p=GameState.players.find(p=>other.clubIds.includes(p.clubId));FM_DEVELOPMENT.ensure();GameState.world.development.evolution.players={};const first=FM_DEVELOPMENT.seasonEnd(2026,ownLeague),again=FM_DEVELOPMENT.seasonEnd(2026,ownLeague),e=GameState.world.development.evolution;return {first,again,otherTouched:Object.hasOwn(e.players,p.id),keys:Object.keys(e.seasons),rows:e.seasons['2026:'+ownLeague].players.length,mine:mine().length}}''')
        self.assertTrue(result['first'])
        self.assertFalse(result['again'])
        self.assertFalse(result['otherTouched'])
        self.assertEqual(result['rows'],result['mine'])
        self.assertEqual(len(result['keys']),1)


if __name__ == '__main__':
    unittest.main()
