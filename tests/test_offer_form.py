#!/usr/bin/env python3
"""Exercise real market buttons and visible negotiation failures in the browser.

Fixtures change only the capacity or balance being tested. Player identities and
the actual offer form come from the embedded database; every submission is a
click on the same control a manager uses in the game.
"""
import os
from pathlib import Path
import shutil
import tempfile
import unittest

from playwright.sync_api import sync_playwright


URL = os.environ.get('FM27_TEST_URL', 'http://127.0.0.1:8000/index.html')
ARTIFACTS = Path(tempfile.gettempdir()) / 'fm27-offer-form-qa'
TARGET_ID = 1068088  # Patricio Albornoz, the real inexpensive Argentine keeper.


class OfferFormScenarios(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        ARTIFACTS.mkdir(parents=True, exist_ok=True)
        cls.pw = sync_playwright().start()
        executable = os.environ.get('FM27_CHROMIUM') or shutil.which('chromium') or shutil.which('google-chrome')
        options = {'headless': True, 'args': ['--no-sandbox', '--disable-dev-shm-usage']}
        if executable:
            options['executable_path'] = executable
        cls.browser = cls.pw.chromium.launch(**options)

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.pw.stop()

    def setUp(self):
        self.context = self.browser.new_context(viewport={'width': 1440, 'height': 960})
        self.page = self.context.new_page()
        self.page.set_default_timeout(10000)
        self.errors = []
        self.page.on('pageerror', lambda error: self.errors.append(str(error)))
        self.page.on('dialog', lambda dialog: dialog.accept())
        self.page.route('https://**/*', lambda route: route.abort())
        self.page.goto(URL, wait_until='domcontentloaded')
        self.page.wait_for_selector('#worldCareerCountry')
        self.seed()
        self.page.fill('#manager', 'DT ofertas visibles')
        self.page.locator('#worldCareerCountry').select_option(label='Argentina')
        self.page.locator('#worldCareerLeague').select_option('ARG1')
        self.page.locator('#club').select_option('boca')
        self.page.click('[data-action="new"]')
        self.page.wait_for_function('GameState?.version===3')

    def tearDown(self):
        if self.errors:
            self.page.screenshot(path=str(ARTIFACTS / (self._testMethodName + '-error.png')), full_page=True)
        self.context.close()
        self.assertEqual(self.errors, [], 'Uncaught application errors')

    def seed(self):
        self.page.evaluate("""()=>{
            let seed=14102026;
            Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
        }""")

    def vacancy(self):
        """Free a local reserve slot without changing the foreign registration."""
        return self.page.evaluate("""()=>{
            CLUB_AI.ensure();MARKET_CONTRACTS.ensure();
            const id=GameState.userClub.id;
            const p=mine().find(p=>!GameState.tactics.xi.includes(p.id)&&
                !WORLD_ENGINE.isForeign(p,id)&&CLUB_AI.canRelease(p,id).ok);
            if(!p)throw Error('No hay suplente local para preparar la vacante');
            p.clubId=null;WORLD_ENGINE.reindex();autoLineup();saveGame(true);render();
            return {id:p.id,count:mine().length,foreign:foreigners(id)};
        }""")

    def open_market_offer(self, player_id=TARGET_ID):
        name = self.page.evaluate('(id)=>player(id).nombre', player_id)
        self.page.locator('aside [data-view="market"]').click()
        self.page.locator('#marketQuery').fill(name)
        self.page.locator('#content [data-buy="' + str(player_id) + '"]').click()
        self.page.wait_for_selector('#negotiation')
        self.assertTrue(self.page.locator('#details').is_visible())
        self.assertIn(name, self.page.locator('#details').inner_text())

    def financial_snapshot(self, player_id=TARGET_ID):
        return self.page.evaluate("""(id)=>{
            CLUB_AI.ensure();MARKET_CONTRACTS.ensure();
            return {cash:GameState.userClub.presupuesto_dolares,
                offers:JSON.stringify(GameState.offers),ledger:JSON.stringify(GameState.finance.ledger),
                targetClub:player(id).clubId,roster:mine().map(p=>p.id),
                reserved:CLUB_AI.reservation(GameState.userClub.id)};
        }""", player_id)

    def submit(self):
        self.page.locator('#negotiation button[type="submit"]').click()

    def visible_error(self, pattern):
        feedback = self.page.locator('#negotiation [data-offer-feedback]')
        self.assertTrue(self.page.locator('#details').is_visible())
        self.assertTrue(feedback.is_visible(), 'Feedback must be inside the open modal')
        self.assertEqual(feedback.get_attribute('role'), 'alert')
        self.assertRegex(self.page.locator('#negotiation [data-offer-error]').inner_text(), pattern)

    def test_01_full_initial_roster_explains_failure_and_links_to_squad(self):
        self.assertEqual(self.page.evaluate('mine().length'), 32)
        self.open_market_offer()
        resources = self.page.locator('#negotiation [data-offer-resources]')
        self.assertTrue(resources.is_visible())
        for label in ['32 / 32', '6 / 6', 'Margen salarial', 'Fondos disponibles']:
            self.assertIn(label, resources.inner_text())
        before = self.financial_snapshot()
        self.submit()
        self.visible_error('plazas')
        self.assertEqual(self.financial_snapshot(), before)
        self.assertIn('Vendé', self.page.locator('[data-offer-hint]').inner_text())
        self.page.locator('[data-contract-help="squad"]').click()
        self.assertFalse(self.page.locator('#details').is_visible())
        self.assertEqual(self.page.evaluate('view'), 'squad')
        self.assertEqual(self.page.evaluate('mine().length'), 32)

    def test_02_valid_actual_form_persists_and_signs_after_four_turns(self):
        self.assertEqual(self.vacancy()['count'], 31)
        self.open_market_offer()
        before = self.financial_snapshot()
        entered = self.page.locator('#negotiation').evaluate("""form=>({
            fee:Number(form.elements.fee.value),wage:Number(form.elements.wage.value),
            bonus:Number(form.elements.bonus.value),releaseClause:Number(form.elements.releaseClause.value)
        })""")
        self.assertTrue(self.page.locator('#negotiation').evaluate('form=>form.checkValidity()'))
        self.submit()
        self.assertFalse(self.page.locator('#details').is_visible())
        pending = self.page.evaluate("""id=>({offer:GameState.offers.find(o=>o.playerId===id),
            count:GameState.offers.filter(o=>o.playerId===id).length,
            cash:GameState.userClub.presupuesto_dolares,owner:player(id).clubId,
            reserved:CLUB_AI.reservation(GameState.userClub.id),clock:WORLD_CLOCK.info()})""", TARGET_ID)
        self.assertEqual(pending['count'], 1)
        self.assertEqual(pending['offer']['status'], 'pending')
        self.assertEqual(pending['cash'], before['cash'])
        self.assertEqual(pending['owner'], before['targetClub'])
        self.assertEqual(pending['reserved'], entered['fee']+entered['bonus'])
        self.page.reload(wait_until='domcontentloaded')
        self.page.wait_for_selector('aside')
        self.seed()
        self.assertEqual(self.page.evaluate('(id)=>GameState.offers.find(o=>o.id===id)', pending['offer']['id']), pending['offer'])
        for step in range(4):
            self.page.locator('[data-action="continue"]').first.click()
            state = self.page.evaluate('(id)=>GameState.offers.find(o=>o.id===id).status', pending['offer']['id'])
            self.assertEqual(state, 'pending' if step<3 else 'accepted')
        signed = self.page.evaluate("""id=>({owner:player(id).clubId,count:mine().length,
            offers:GameState.offers.filter(o=>o.playerId===id).length,
            fees:GameState.finance.ledger.filter(r=>r.category==='fichajes'),
            target:player(id),clock:WORLD_CLOCK.info()})""", TARGET_ID)
        self.assertEqual(signed['owner'], 'boca')
        self.assertEqual(signed['count'], 32)
        self.assertEqual(signed['offers'], 1)
        self.assertEqual(len(signed['fees']), 1)
        self.assertEqual(signed['fees'][0]['amount'], -(entered['fee']+entered['bonus']))
        self.assertEqual(signed['target']['salario'], entered['wage'])
        self.assertNotEqual(signed['clock']['date'], pending['clock']['date'])

    def test_03_insufficient_cash_preserves_terms_and_allows_corrected_resubmission(self):
        self.vacancy()
        cash = self.page.evaluate('GameState.userClub.presupuesto_dolares')
        self.page.evaluate('GameState.userClub.presupuesto_dolares=0')
        self.open_market_offer()
        self.page.locator('#negotiation [name="fee"]').fill('15000')
        self.page.locator('#negotiation [name="wage"]').fill('250')
        self.page.locator('#negotiation [name="bonus"]').fill('700')
        before = self.financial_snapshot()
        self.submit()
        self.visible_error('fondos')
        self.assertEqual(self.financial_snapshot(), before)
        for field, value in [('fee','15000'), ('wage','250'), ('bonus','700')]:
            self.assertEqual(self.page.locator('#negotiation [name="'+field+'"]').input_value(), value)
        self.assertTrue(self.page.locator('[data-contract-help="finances"]').is_visible())
        self.page.evaluate('(cash)=>GameState.userClub.presupuesto_dolares=cash', cash)
        self.submit()
        self.assertFalse(self.page.locator('#details').is_visible())
        offered = self.page.evaluate("""id=>({offers:GameState.offers.filter(o=>o.playerId===id),
            cash:GameState.userClub.presupuesto_dolares})""", TARGET_ID)
        self.assertEqual(len(offered['offers']), 1)
        self.assertEqual(offered['offers'][0]['fee'], 15000)
        self.assertEqual(offered['offers'][0]['wage'], 250)
        self.assertEqual(offered['offers'][0]['bonus'], 700)
        self.assertEqual(offered['cash'], cash)

    def test_04_foreign_registration_failure_is_visible_and_links_to_squad(self):
        fixture = self.vacancy()
        self.assertEqual(fixture['foreign'], 6)
        target = self.page.evaluate("""()=>{
            const id=GameState.userClub.id;
            const p=GameState.players.filter(p=>p.clubId&&p.clubId!==id&&
                WORLD_ENGINE.isForeign(p,id)&&!p.loanId&&CLUB_AI.canRelease(p,p.clubId).ok)
                .sort((a,b)=>a.valor_mercado-b.valor_mercado)[0];
            if(!p)throw Error('No hay objetivo extranjero negociable');
            return {id:p.id,name:p.nombre};
        }""")
        self.open_market_offer(target['id'])
        before = self.financial_snapshot(target['id'])
        self.submit()
        self.visible_error('extranjeros')
        self.assertEqual(self.financial_snapshot(target['id']), before)
        self.page.locator('[data-contract-help="squad"]').click()
        self.assertEqual(self.page.evaluate('view'), 'squad')
        self.assertFalse(self.page.locator('#details').is_visible())

    def test_05_native_invalid_amount_is_reported_inside_form_and_integer_wage_is_valid(self):
        self.vacancy()
        self.open_market_offer()
        self.page.locator('#negotiation [name="wage"]').fill('150')
        self.assertTrue(self.page.locator('#negotiation [name="wage"]').evaluate('field=>field.validity.valid'))
        fee = self.page.locator('#negotiation [name="fee"]').input_value()
        self.page.locator('#negotiation [name="fee"]').fill('-1')
        before = self.financial_snapshot()
        self.submit()
        self.visible_error('importe del pase')
        self.assertIn('mínimo', self.page.locator('[data-offer-error]').inner_text())
        self.assertEqual(self.financial_snapshot(), before)
        self.assertEqual(self.page.locator('#negotiation [name="fee"]').input_value(), '-1')
        self.page.locator('#negotiation [name="fee"]').fill(fee)
        self.submit()
        self.assertFalse(self.page.locator('#details').is_visible())
        self.assertEqual(self.page.evaluate('(id)=>GameState.offers.find(o=>o.playerId===id).wage', TARGET_ID), 150)

    def test_06_loan_mode_ignores_disabled_stale_purchase_terms_and_sends_once(self):
        self.vacancy()
        self.open_market_offer()
        self.assertTrue(self.page.locator('#negotiation [name="wageShare"]').is_disabled())
        self.page.locator('#negotiation [name="wage"]').fill('150')
        self.assertTrue(self.page.locator('#negotiation [name="wage"]').evaluate('field=>field.validity.valid'))
        self.page.locator('#negotiation [name="bonus"]').fill('-10')
        self.page.locator('#negotiation [name="releaseClause"]').fill('-1')
        self.page.locator('#negotiation [name="dealType"]').select_option('loan')
        for field in ['wage','bonus','releaseClause','years','sellOnPercent','installments']:
            self.assertTrue(self.page.locator('#negotiation [name="'+field+'"]').is_disabled(), field)
        self.assertFalse(self.page.locator('#negotiation [name="wage"]').is_visible())
        self.assertFalse(self.page.locator('#negotiation [name="wageShare"]').is_disabled())
        self.page.locator('#negotiation [name="loanMonths"]').select_option('6')
        self.page.locator('#negotiation [name="wageShare"]').fill('50')
        self.assertTrue(self.page.locator('#negotiation').evaluate('form=>form.checkValidity()'))
        before = self.financial_snapshot()
        self.submit()
        self.assertFalse(self.page.locator('#details').is_visible())
        pending = self.page.evaluate("""id=>({offers:GameState.offers.filter(o=>o.playerId===id),
            cash:GameState.userClub.presupuesto_dolares,owner:player(id).clubId,
            roster:mine().map(p=>p.id)})""", TARGET_ID)
        self.assertEqual(len(pending['offers']), 1)
        self.assertEqual(pending['offers'][0]['dealType'], 'loan')
        self.assertEqual(pending['offers'][0]['loanMonths'], 6)
        self.assertEqual(pending['offers'][0]['wageShare'], 50)
        self.assertEqual(pending['offers'][0]['bonus'], 0)
        self.assertGreater(pending['offers'][0]['fee'], 0)
        self.assertEqual(pending['cash'], before['cash'])
        self.assertEqual(pending['owner'], before['targetClub'])
        self.assertEqual(pending['roster'], before['roster'])


if __name__ == '__main__':
    unittest.main(verbosity=2)
