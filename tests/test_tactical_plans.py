"""Tactical plans must retain their trade-offs, legal assignments and saved practice."""
import os
import shutil
import unittest
from playwright.sync_api import sync_playwright

URL = os.environ.get('FM27_TEST_URL', 'http://127.0.0.1:8000/index.html')


class TacticalPlans(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pw = sync_playwright().start()
        cls.browser = cls.pw.chromium.launch(executable_path=shutil.which('chromium'), headless=True,
                                           args=['--no-sandbox', '--disable-dev-shm-usage'])

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.pw.stop()

    def setUp(self):
        self.context = self.browser.new_context(viewport={'width': 1366, 'height': 768})
        self.page = self.context.new_page()
        self.errors = []
        self.page.on('pageerror', lambda e: self.errors.append(str(e)))
        self.page.route('https://**/*', lambda r: r.abort())
        self.page.goto(URL, wait_until='domcontentloaded')
        self.page.fill('#manager', 'Laboratorio táctico')
        self.page.click('[data-action="new"]')
        self.page.wait_for_selector('aside')

    def tearDown(self):
        self.context.close()
        self.assertEqual(self.errors, [])

    def test_01_phase_defaults_and_invalid_values_are_safe(self):
        r = self.page.evaluate('''()=>{const t=GameState.tactics;delete t.phases;delete t.setPieces;FM_TACTICS.ensure();
            const plan=FM_TACTICS.matchPlan(t),before=JSON.stringify(t.phases);
            return {plan,bad:FM_TACTICS.setPhase('inPossession','buildUp','Teletransportar'),
                badKey:FM_TACTICS.setPhase('inPossession','toString','Corta'),badRoutine:FM_TACTICS.setPiece('toString','Corto'),
                badInstruction:FM_TACTICS.setInstruction(t.xi[0],'toString','Normal'),
                unchanged:before===JSON.stringify(t.phases),ai:FM_TACTICS.matchPlan({formation:'4-4-2',xi:[]})}}''')
        self.assertEqual(r['plan']['inPossession']['buildUp'], 'Mixta')
        self.assertEqual(r['plan']['outOfPossession']['block'], 'Medio')
        self.assertEqual(r['plan']['transition']['onLoss'], 'Equilibrada')
        self.assertEqual(r['ai']['transition']['onWin'], 'Equilibrada')
        self.assertFalse(r['bad'])
        self.assertFalse(r['badKey'])
        self.assertFalse(r['badRoutine'])
        self.assertFalse(r['badInstruction'])
        self.assertTrue(r['unchanged'])

    def test_02_plans_have_skill_dependent_benefits_and_costs(self):
        r = self.page.evaluate('''()=>{const t=GameState.tactics;FM_TACTICS.ensure();
            const base=FM_TACTICS.phaseModifiers(t);FM_TACTICS.setPhase('outOfPossession','block','Alto');
            FM_TACTICS.setPhase('transition','onLoss','Contrapresión');const high=FM_TACTICS.phaseModifiers(t);
            FM_TACTICS.setPhase('inPossession','buildUp','Corta');
            const members=t.xi.map(player),old=members.map(p=>p.pase);members.forEach(p=>p.pase=35);
            const lowSkill=FM_TACTICS.phaseModifiers(t);members.forEach(p=>p.pase=90);
            const highSkill=FM_TACTICS.phaseModifiers(t);members.forEach((p,i)=>p.pase=old[i]);
            FM_TACTICS.setPhase('transition','onWin','Contraatacar');const counter=FM_TACTICS.phaseModifiers(t);
            return {base,high,lowSkill,highSkill,counter,finite:Object.values(counter).every(Number.isFinite)}}''')
        self.assertGreater(r['high']['press'], r['base']['press'])
        self.assertGreater(r['high']['stamina'], r['base']['stamina'])
        self.assertGreater(r['highSkill']['possession'], r['lowSkill']['possession'])
        self.assertGreater(r['counter']['transition'], r['high']['transition'])
        self.assertTrue(r['finite'])

    def test_03_rehearsals_belong_to_a_routine_and_survive_reload(self):
        r = self.page.evaluate('''()=>{FM_TACTICS.ensure();FM_TACTICS.setPiece('practice','Prioritario');
            const initial=FM_TACTICS.matchPlan().setPieces.familiarity;FM_TACTICS.trainFamiliarity(8);
            const trained=FM_TACTICS.matchPlan().setPieces.familiarity;
            FM_TACTICS.setPiece('corner','Segundo palo');const alternate=FM_TACTICS.matchPlan().setPieces.familiarity;
            FM_TACTICS.setPiece('corner','Primer palo');saveGame(true);
            return {initial,trained,alternate,restored:FM_TACTICS.matchPlan().setPieces.familiarity}}''')
        self.assertGreater(r['trained'], r['initial'])
        self.assertEqual(r['alternate'], r['initial'])
        self.assertEqual(r['restored'], r['trained'])
        self.page.reload(wait_until='domcontentloaded')
        self.assertEqual(self.page.evaluate('FM_TACTICS.matchPlan().setPieces.familiarity'), r['trained'])

    def test_04_set_piece_roles_and_opponent_marks_validate_ownership(self):
        r = self.page.evaluate('''()=>{const a=mine().find(p=>p.posicion!=='POR'),b=mine().find(p=>p.id!==a.id&&p.posicion!=='POR');
            const outside=GameState.players.find(p=>p.clubId!==GameState.userClub.id&&p.posicion!=='POR');
            const keeper=mine().find(p=>p.posicion==='POR'),opponent=FM_TACTICS.markingOpponents()[0];
            return {first:FM_TACTICS.setPiece('nearPost',a.id),duplicate:FM_TACTICS.setPiece('farPost',a.id),
                other:FM_TACTICS.setPiece('farPost',b.id),foreign:FM_TACTICS.setPiece('cornerTaker',outside.id),
                keeper:FM_TACTICS.setPiece('cornerTaker',keeper.id),ownMark:FM_TACTICS.setMarkingTarget(a.id,b.id),
                opponent:Boolean(opponent),mark:opponent&&FM_TACTICS.setMarkingTarget(a.id,opponent.id),
                target:FM_TACTICS.instructionsFor(a.id).markingTarget,expected:opponent?.id}}''')
        self.assertTrue(r['first'])
        self.assertFalse(r['duplicate'])
        self.assertTrue(r['other'])
        self.assertFalse(r['foreign'])
        self.assertFalse(r['keeper'])
        self.assertFalse(r['ownMark'])
        self.assertTrue(r['opponent'])
        self.assertTrue(r['mark'])
        self.assertEqual(r['target'], r['expected'])

    def test_05_saved_plan_restores_phases_and_individual_instructions(self):
        r = self.page.evaluate('''()=>{const id=GameState.tactics.xi[1];FM_TACTICS.setPhase('inPossession','progression','Bandas');
            FM_TACTICS.setPhase('transition','onWin','Contraatacar');FM_TACTICS.setPiece('corner','Corto');
            FM_TACTICS.setInstruction(id,'pressing','Contener');FM_TACTICS.setInstruction(id,'dribbling','Soltar rápido');
            const saved=FM_TACTICS.savePlan('Salir por afuera');FM_TACTICS.setPhase('inPossession','progression','Centro');
            FM_TACTICS.setPiece('corner','Segundo palo');FM_TACTICS.setInstruction(id,'pressing','Intensa');
            const loaded=FM_TACTICS.loadPlan(saved);return {loaded,plan:FM_TACTICS.matchPlan(),instructions:FM_TACTICS.instructionsFor(id)}}''')
        self.assertTrue(r['loaded'])
        self.assertEqual(r['plan']['inPossession']['progression'], 'Bandas')
        self.assertEqual(r['plan']['transition']['onWin'], 'Contraatacar')
        self.assertEqual(r['plan']['setPieces']['corner'], 'Corto')
        self.assertEqual(r['instructions']['pressing'], 'Contener')
        self.assertEqual(r['instructions']['dribbling'], 'Soltar rápido')

    def test_06_phase_and_set_piece_controls_fit_both_viewports(self):
        self.page.evaluate("()=>{view='tactics';render()}")
        for size in [{'width': 1280, 'height': 720}, {'width': 390, 'height': 844}]:
            self.page.set_viewport_size(size)
            for top, subtabs, selector in [
                ('phases', ['inPossession', 'outOfPossession', 'transition', 'assessment'], 'data-tw-phase-tab'),
                ('set-pieces', ['attack', 'roles', 'defence'], 'data-tw-set-tab'),
            ]:
                self.page.evaluate("()=>{view='tactics';render()}")
                self.page.click(f'[data-ws-key="tactics"][data-ws-tab="{top}"]')
                for sub in subtabs:
                    self.page.click(f'[{selector}="{sub}"]')
                    self.assertTrue(self.page.evaluate('document.documentElement.scrollHeight<=innerHeight+1'), (size, top, sub))
                    self.assertTrue(self.page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'), (size, top, sub))
                    root = '.tw-phases' if top == 'phases' else '.tw-set-pieces'
                    self.assertTrue(self.page.evaluate('''selector=>[...document.querySelectorAll(selector+' select')].every(el=>{
                        const r=el.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight&&r.left>=0&&r.right<=innerWidth})''', root), (size, top, sub))
        self.page.click('[data-ws-key="tactics"][data-ws-tab="phases"]')
        self.page.click('[data-tw-phase-tab="transition"]')
        self.page.select_option('[data-tw-phase="transition"][data-tw-phase-field="onWin"]', 'Contraatacar')
        self.assertEqual(self.page.evaluate('FM_TACTICS.matchPlan().transition.onWin'), 'Contraatacar')

    def test_07_live_adjustments_keep_the_same_players(self):
        r = self.page.evaluate('''()=>{for(let i=0;i<500&&!WORLD_CLOCK.ready();i++)WORLD_CLOCK.advance({silent:true});
            startMatch();clearInterval(timer);timer=null;GameState.match.paused=true;
            const before=JSON.stringify(GameState.match.lineups),formation=GameState.tactics.formation;
            const phase=FM_TACTICS.setPhase('outOfPossession','block','Bajo'),setPiece=FM_TACTICS.setPiece('corner','Corto');
            const load=FM_TACTICS.loadPlan('missing'),instruction=FM_TACTICS.setInstruction(GameState.tactics.xi[1],'pressing','Contener');
            return {phase,setPiece,instruction,load,same:before===JSON.stringify(GameState.match.lineups),formation:formation===GameState.tactics.formation}}''')
        self.assertTrue(r['phase'])
        self.assertTrue(r['setPiece'])
        self.assertTrue(r['instruction'])
        self.assertFalse(r['load'])
        self.assertTrue(r['same'])
        self.assertTrue(r['formation'])

    def test_08_rehearsal_priority_allocates_training_time(self):
        r = self.page.evaluate('''()=>{const t=GameState.tactics;FM_TACTICS.ensure();
            t.familiarity={};t.setPieces.familiarity={};FM_TACTICS.setPiece('practice','Mínimo');
            const minimum=FM_TACTICS.trainFamiliarity(8),minimumRoutine=FM_TACTICS.matchPlan().setPieces.familiarity;
            t.familiarity={};t.setPieces.familiarity={};FM_TACTICS.setPiece('practice','Prioritario');
            const priority=FM_TACTICS.trainFamiliarity(8),priorityRoutine=FM_TACTICS.matchPlan().setPieces.familiarity;
            return {minimum,minimumRoutine,priority,priorityRoutine}}''')
        self.assertGreater(r['minimum'], r['priority'])
        self.assertGreater(r['priorityRoutine'], r['minimumRoutine'])


if __name__ == '__main__':
    unittest.main(verbosity=2)
