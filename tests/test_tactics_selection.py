"""The XI, seven substitutes and non-selected players remain usable together."""
import unittest
import test_offer_form as fixture


class TacticsSelection(unittest.TestCase):
    setUpClass = classmethod(fixture.OfferFormScenarios.setUpClass.__func__)
    tearDownClass = classmethod(fixture.OfferFormScenarios.tearDownClass.__func__)
    setUp = fixture.OfferFormScenarios.setUp
    tearDown = fixture.OfferFormScenarios.tearDown
    seed = fixture.OfferFormScenarios.seed

    def open_selection(self):
        self.page.evaluate("()=>{view='tactics';FM_WORKSPACE.ui.tabs.tactics='pitch';render()}")

    def test_01_formation_bench_and_reserves_share_a_bounded_workspace(self):
        for width, height in [(1440, 960), (1366, 768), (1280, 720), (900, 768), (390, 844)]:
            with self.subTest(width=width):
                self.page.set_viewport_size({'width': width, 'height': height})
                self.open_selection()
                result = self.page.evaluate('''()=>{
                    const b=document.querySelector('.tw-selection-board'),p=b.querySelector('.tw-pitch-card').getBoundingClientRect(),
                        bench=b.querySelector('.ws-bench').getBoundingClientRect(),reserve=b.querySelector('.tw-reserves').getBoundingClientRect();
                    const bounds=el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&r.top>=0&&r.bottom<=innerHeight+1&&r.left>=0&&r.right<=innerWidth+1};
                    const bank=b.querySelector('.tw-bench').getBoundingClientRect();return {benchFits:[...b.querySelectorAll('.tw-bench [data-tw-slot]')].every(el=>{const r=el.getBoundingClientRect();return r.top>=bank.top&&r.bottom<=bank.bottom+1}),allSlots:[...b.querySelectorAll('[data-tw-slot]')].every(bounds),count:b.querySelectorAll('[data-tw-slot]').length,
                        reserves:b.querySelectorAll('[data-tw-reserve]').length,expected:mine().filter(p=>!GameState.tactics.xi.includes(p.id)&&!GameState.tactics.bench.includes(p.id)).length,
                        alongside:bench.left>=p.right,below:reserve.top>=bench.bottom,formation:bounds(b.querySelector('[data-tw-team="formation"]')),
                        pageFits:document.documentElement.scrollHeight<=innerHeight+1&&document.documentElement.scrollWidth<=innerWidth+1,
                        extraTabs:document.querySelectorAll('[data-ws-key="tactics"][data-ws-tab="bench"],[data-ws-key="tactics"][data-ws-tab="squad"]').length};
                }''')
                self.assertTrue(result['pageFits'], result)
                self.assertTrue(result['allSlots'], result)
                self.assertTrue(result['benchFits'], result)
                self.assertTrue(result['formation'], result)
                self.assertTrue(result['alongside'], result)
                self.assertTrue(result['below'], result)
                self.assertEqual(result['count'], 18)
                self.assertEqual(result['reserves'], result['expected'])
                self.assertEqual(result['extraTabs'], 0)
                if width in [1366, 900]:
                    self.page.screenshot(path=f'/tmp/fm27-tactics-{width}.png')

    def test_02_keyboard_swap_and_reserve_assignment_need_no_tab_change(self):
        self.open_selection()
        pair = self.page.evaluate('''()=>{const all=[...GameState.tactics.xi,...GameState.tactics.bench];
            for(let source=11;source<18;source++){const p=player(all[source]);if(p.posicion==='POR')continue;
                const target=all.slice(1,11).findIndex(id=>player(id).posicion===p.posicion)+1;
                if(target>0)return {source,target,a:p.id,b:all[target],all};}throw Error('No matching substitute');}''')
        self.page.locator(f'[data-tw-slot="{pair["source"]}"]').focus()
        self.page.keyboard.press('Space')
        self.page.locator(f'[data-tw-slot="{pair["target"]}"]').focus()
        self.page.keyboard.press('Enter')
        swapped = self.page.evaluate('[...GameState.tactics.xi,...GameState.tactics.bench]')
        self.assertEqual(swapped[pair['target']], pair['a'])
        self.assertEqual(swapped[pair['source']], pair['b'])
        self.assertEqual(set(swapped), set(pair['all']))
        target = self.page.evaluate('''()=>{const all=[...GameState.tactics.xi,...GameState.tactics.bench],p=mine().find(p=>!all.includes(p.id)&&available(p)&&!WORLD_ENGINE.isForeign(p));
            const slot=p.posicion==='POR'?0:1;return {id:p.id,slot,old:all[slot]};}''')
        self.page.click(f'[data-tw-slot="{target["slot"]}"]')
        self.page.click(f'.tw-reserves [data-tw-use="{target["id"]}"]')
        self.assertEqual(self.page.evaluate('(i)=>GameState.tactics.xi[i]', target['slot']), target['id'])
        self.assertEqual(self.page.locator(f'.tw-reserves [data-tw-reserve="{target["id"]}"]').count(), 0)
        self.assertEqual(self.page.locator(f'.tw-reserves [data-tw-reserve="{target["old"]}"]').count(), 1)
        self.assertEqual(self.page.evaluate('new Set([...GameState.tactics.xi,...GameState.tactics.bench]).size'), 18)
        self.page.evaluate('saveGame(true)')
        self.page.reload(wait_until='domcontentloaded')
        self.assertEqual(self.page.evaluate('(i)=>GameState.tactics.xi[i]', target['slot']), target['id'])

    def test_03_formation_updates_and_unavailable_reserves_keep_real_restrictions(self):
        self.open_selection()
        self.page.select_option('.tw-selection-board [data-tw-team="formation"]', '4-2-3-1')
        self.assertEqual(self.page.evaluate('GameState.tactics.formation'), '4-2-3-1')
        self.assertEqual(self.page.locator('.tw-selection-board [data-tw-slot]').count(), 18)
        target = self.page.evaluate('''()=>{const all=[...GameState.tactics.xi,...GameState.tactics.bench],p=mine().find(p=>!all.includes(p.id));
            p.injury=3;render();return p.id;}''')
        self.assertTrue(self.page.locator(f'.tw-reserves [data-tw-use="{target}"]').is_disabled())
        self.assertIn('lesión', self.page.locator(f'[data-tw-reserve="{target}"]').inner_text())
        before = self.page.evaluate('JSON.stringify(GameState.tactics.xi)')
        self.assertFalse(self.page.evaluate('(id)=>FM_TACTICS.assignSlot(1,id)', target))
        self.assertEqual(self.page.evaluate('JSON.stringify(GameState.tactics.xi)'), before)
        self.page.evaluate('''()=>{const e=WORLD_CLOCK.nextFixture();GameState.today=e.date;WORLD_CLOCK.ensure().slot=WORLD_CLOCK.eventSlot(e);
            autoLineup();startMatch();clearInterval(timer);timer=null;GameState.match.paused=true;view='tactics';render();}''')
        self.assertTrue(self.page.locator('.tw-selection-board [data-tw-team="formation"]').is_disabled())
        self.assertTrue(self.page.evaluate("[...document.querySelectorAll('.tw-reserves [data-tw-use]')].every(b=>b.disabled)"))


if __name__ == '__main__':
    unittest.main(verbosity=2)
