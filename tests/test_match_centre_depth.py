#!/usr/bin/env python3
"""Match presentation consumes recorded actions without rerolling the simulation."""
import unittest

import test_match_formats as base


class MatchCentreDepth(unittest.TestCase):
    setUpClass = classmethod(base.MatchFormats.setUpClass.__func__)
    tearDownClass = classmethod(base.MatchFormats.tearDownClass.__func__)
    setUp = base.MatchFormats.setUp
    tearDown = base.MatchFormats.tearDown
    career = base.MatchFormats.career
    match = base.MatchFormats.match
    fit = base.MatchFormats.fit
    visible_in_viewport = base.MatchFormats.visible_in_viewport

    def live_actions(self,minutes=30):
        self.page.evaluate('''(n)=>{view='dashboard';const m=GameState.match;while(m.minute<n&&!m.done){m.paused=false;m.halfTime=false;tick()}m.paused=true;clearInterval(timer);timer=null;view='match';render()}''',minutes)

    def test_01_pitch_decisions_and_new_panels_fit_small_viewports(self):
        self.career();self.match()
        for w,h in [(1366,768),(1280,720),(390,844),(360,740)]:
            self.page.set_viewport_size({'width':w,'height':h})
            for tab in ['field','replays','advice','phases']:
                self.page.click(f'[data-mc-tab="{tab}"]');self.fit();self.visible_in_viewport('.mc-controls [data-action="play"]')
                if tab=='field':
                    self.assertEqual(self.page.locator('.mc-player').count(),22)
                    self.assertEqual(self.page.locator('.mc-field .mr-caption').count(),0)
                    for command in ['changes','advice','replays']:
                        self.visible_in_viewport(f'.mc-quick-commands [data-mc-open="{command}"]')
                    bounds=self.page.locator('.mc-field').bounding_box()
                    self.assertGreaterEqual(bounds['height'],130)
                if tab=='phases':
                    self.page.click('[data-tw-phase-tab="transition"]')
                    for control in self.page.locator('[data-tw-phase="transition"]').all():
                        self.assertTrue(control.is_visible())
                        self.assertLessEqual(control.bounding_box()['y']+control.bounding_box()['height'],h+1)

    def test_02_replay_pauses_clock_and_preserves_every_result_record(self):
        self.career();self.match();self.live_actions()
        self.assertGreater(self.page.evaluate('FM_MATCH_CENTRE.plays(GameState.match).length'),0)
        self.page.evaluate('GameState.match.paused=false')
        self.page.click('[data-mc-tab="replays"]')
        self.assertTrue(self.page.evaluate('GameState.match.paused'))
        before=self.page.evaluate('''()=>JSON.stringify({minute:GameState.match.minute,score:GameState.match.score,chances:GameState.match.chances,actions:GameState.match.simulation?.playerActions})''')
        self.assertGreater(self.page.locator('.mc-sequence path').count(),0)
        self.page.locator('[data-mc-replay]').last.click()
        self.page.click('[data-mc-replay-play]');self.page.wait_for_timeout(300)
        self.assertEqual(self.page.evaluate('''()=>JSON.stringify({minute:GameState.match.minute,score:GameState.match.score,chances:GameState.match.chances,actions:GameState.match.simulation?.playerActions})'''),before)
        self.page.click('[data-mc-tab="field"]')
        self.assertFalse(self.page.evaluate('FM_MATCH_CENTRE.ui.replayPlaying'))
        self.assertTrue(self.page.evaluate('GameState.match.paused'))
        self.page.click('[data-mc-tab="replays"]');self.page.click('.mc-controls [data-action="play"]')
        self.assertEqual(self.page.evaluate('FM_MATCH_CENTRE.ui.tab'),'field')
        self.page.click('.mc-controls [data-action="play"]')
        self.assertTrue(self.page.evaluate('GameState.match.paused'))

    def test_03_assistant_and_stats_display_recorded_engine_data(self):
        self.career();self.match();self.live_actions()
        expected=self.page.evaluate('''()=>({entries:GameState.match.simulation.teamMetrics.map(s=>s.finalThirdEntries||0),diagnostics:FM_SIMULATION.diagnostics(GameState.match,GameState.match.userSide).map(d=>d.text),players:Object.keys(GameState.match.simulation.playerActions).length})''')
        self.assertGreater(expected['players'],0)
        self.page.click('[data-mc-tab="advice"]')
        for text in expected['diagnostics']:
            self.assertIn(text,self.page.locator('.mc-assistant').inner_text())
        self.assertGreater(self.page.locator('.mc-player-insights tbody tr').count(),0)
        self.page.click('[data-mc-tab="stats"]')
        actual=self.page.evaluate("FM_MATCH_CENTRE.stats(GameState.match).find(r=>r[0]==='Entradas último tercio').slice(1)")
        self.assertEqual(actual,expected['entries'])
        self.page.click('[data-mc-chart="map"]');self.assertEqual(self.page.locator('.mc-shot-map').count(),1)
        self.page.click('[data-mc-chart="xg"]');self.assertEqual(self.page.locator('.mc-xg path').count(),2)

    def test_04_phase_adjustment_changes_saved_tactic_and_does_not_advance(self):
        self.career();self.match();self.page.click('[data-mc-tab="phases"]')
        self.page.click('[data-tw-phase-tab="transition"]')
        control=self.page.locator('[data-tw-phase="transition"]').first
        options=control.locator('option').evaluate_all('nodes=>nodes.map(n=>n.value)')
        selected=next(v for v in options if v!=control.input_value())
        control.select_option(selected)
        self.assertEqual(self.page.locator('[data-tw-phase="transition"]').first.input_value(),selected)
        self.assertEqual(self.page.evaluate('GameState.match.minute'),0)
        self.assertTrue(self.page.evaluate('GameState.match.paused'))
        self.page.reload();self.page.wait_for_selector('.mc-root')
        self.page.click('[data-mc-tab="phases"]');self.page.click('[data-tw-phase-tab="transition"]')
        self.assertEqual(self.page.locator('[data-tw-phase="transition"]').first.input_value(),selected)

    def test_05_replay_and_empty_shot_map_support_previous_match_records(self):
        self.career();self.match()
        self.page.evaluate('''()=>{delete GameState.match.simulation;GameState.match.keyPlays=[];GameState.match.chances=[];render()}''')
        self.page.click('[data-mc-tab="replays"]')
        self.assertTrue(self.page.locator('[data-mc-replay-play]').is_disabled())
        self.assertIn('Todavía no hay secuencias',self.page.locator('.mc-replay-caption').inner_text())
        self.page.click('[data-mc-tab="stats"]');self.page.click('[data-mc-chart="map"]')
        self.assertEqual(self.page.locator('.mc-shot-map .mc-shot').count(),0)
        self.assertIn('Todavía no hay remates con ubicación',self.page.locator('.mc-xg-card').inner_text())

    def test_06_early_chances_remain_replayable_and_shot_map_uses_origin(self):
        self.career();self.match();self.live_actions(90)
        chance=self.page.evaluate("GameState.match.chances.find(c=>c.type!=='VAR'&&c.shotLocation)")
        self.assertIsNotNone(chance)
        ids=self.page.evaluate('FM_MATCH_CENTRE.plays(GameState.match).map(p=>p.id)')
        self.assertIn(chance['chainId'],ids)
        self.page.click('[data-mc-tab="replays"]')
        self.page.select_option('[data-mc-replay-select]',chance['chainId'])
        self.assertEqual(self.page.evaluate('FM_MATCH_CENTRE.selectedPlay(GameState.match).id'),chance['chainId'])
        self.page.click('[data-mc-tab="stats"]');self.page.click('[data-mc-chart="map"]')
        marker=self.page.locator('.mc-shot-map .mc-shot').first
        self.assertAlmostEqual(float(marker.get_attribute('cx')),max(2,min(98,100-chance['shotLocation']['y'])),places=5)
        self.assertAlmostEqual(float(marker.get_attribute('cy')),max(3,min(97,chance['shotLocation']['x']))*.65,places=5)


    def test_07_live_refresh_preserves_pause_and_tab_controls(self):
        self.career();self.match()
        result=self.page.evaluate("""()=>{const button=document.querySelector('.fm-continue'),tab=document.querySelector('[data-mc-tab="changes"]'),m=GameState.match;for(let i=0;i<6;i++){m.paused=false;tick()}m.paused=true;clearInterval(timer);render();return {sameButton:button===document.querySelector('.fm-continue'),sameTab:tab===document.querySelector('[data-mc-tab="changes"]'),minute:m.minute}}""")
        self.assertTrue(result['sameButton']);self.assertTrue(result['sameTab']);self.assertEqual(result['minute'],6)
        self.page.select_option('#speed','50');self.page.click('.fm-continue');self.page.wait_for_function('GameState.match.minute>6');self.page.click('.fm-continue')
        self.assertTrue(self.page.evaluate('GameState.match.paused'))
        minute=self.page.evaluate('GameState.match.minute');self.page.wait_for_timeout(200);self.assertEqual(self.page.evaluate('GameState.match.minute'),minute)

if __name__=='__main__':unittest.main(verbosity=2)
