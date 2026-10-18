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
        if self.page.locator("#careerCompetitionFormat").count():
            self.page.select_option("#careerCompetitionFormat", "classic")
        # A new world initializes all squads, staff and competition calendars.
        self.page.click('[data-action="new"]', timeout=30000)
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

    def player_agreement(self):
        self.page.evaluate("""()=>{for(let i=0;i<4;i++)WORLD_CLOCK.advance({silent:true});const o=GameState.offers.find(o=>o.playerId===1068088&&o.status==='pending');if(o.counter){MARKET_CONTRACTS.respondCounter(o.id,true);for(let i=0;i<4;i++)WORLD_CLOCK.advance({silent:true})}MARKET_CONTRACTS.openPlayerNegotiation(o.id)}""")
        self.assertEqual(self.page.locator('#negotiation').get_attribute('data-stage'), 'player')

    def visible_error(self, pattern):
        feedback = self.page.locator('#negotiation [data-offer-feedback]')
        self.assertTrue(self.page.locator('#details').is_visible())
        self.assertTrue(feedback.is_visible(), 'Feedback must be inside the open modal')
        self.assertEqual(feedback.get_attribute('role'), 'alert')
        self.assertRegex(self.page.locator('#negotiation [data-offer-error]').inner_text(), pattern)

    def test_01_forty_player_roster_explains_failure_and_links_to_squad(self):
        self.page.evaluate("()=>{for(const p of GameState.players.filter(p=>p.clubId!=='boca'&&p.id!==1068088&&!p.loanId).slice(0,40-mine().length)){p.clubId='boca';p.registered=false}WORLD_ENGINE.reindex()}")
        self.assertEqual(self.page.evaluate('mine().length'), 40)
        self.open_market_offer()
        resources = self.page.locator('#negotiation [data-offer-resources]')
        self.assertTrue(resources.is_visible())
        for label in ['40 / 40', '6 / 6', 'Margen salarial', 'Fondos disponibles']:
            self.assertIn(label, resources.inner_text())
        before = self.financial_snapshot()
        self.submit()
        self.visible_error('plazas')
        self.assertEqual(self.financial_snapshot(), before)
        self.assertIn('Vendé', self.page.locator('[data-offer-hint]').inner_text())
        self.page.locator('[data-contract-help="squad"]').click()
        self.assertFalse(self.page.locator('#details').is_visible())
        self.assertEqual(self.page.evaluate('view'), 'squad')
        self.assertEqual(self.page.evaluate('mine().length'), 40)

    def test_02_valid_actual_form_persists_and_signs_after_four_turns(self):
        self.vacancy();self.open_market_offer()
        before=self.financial_snapshot()
        self.submit()
        pending=self.page.evaluate('GameState.offers.find(o=>o.playerId===1068088)')
        self.assertEqual(pending['stage'],'club')
        self.assertEqual(self.page.evaluate('GameState.userClub.presupuesto_dolares'),before['cash'])
        self.page.reload(wait_until='domcontentloaded');self.page.wait_for_selector('aside')
        self.assertEqual(self.page.evaluate('GameState.offers.find(o=>o.playerId===1068088)'),pending)
        self.player_agreement()
        entered=self.page.locator('#negotiation').evaluate('form=>({wage:Number(form.elements.wage.value),releaseClause:Number(form.elements.releaseClause.value)})')
        self.page.click('[data-nw-tab="bonuses"]')
        entered['bonus']=int(self.page.locator('#negotiation [name="bonus"]').input_value())
        self.submit()
        for step in range(4):
            # Exercise exact response timing beneath the automatic Continue button.
            self.page.evaluate('WORLD_CLOCK.advance()')
            self.assertEqual(self.page.evaluate('GameState.offers.find(o=>o.playerId===1068088).status'),'pending')
        self.assertTrue(self.page.evaluate('GameState.offers.find(o=>o.playerId===1068088).awaitingMedical'))
        self.assertEqual(self.page.evaluate('GameState.userClub.presupuesto_dolares'),before['cash'])
        self.page.evaluate('()=>{for(let i=0;i<4;i++)WORLD_CLOCK.advance({silent:true})}')
        medical=self.page.evaluate('()=>{const o=GameState.offers.find(o=>o.playerId===1068088);return MARKET_CONTRACTS.respondMedical(o.id,true)}')
        self.assertTrue(medical['ok'],medical)
        self.assertEqual(self.page.evaluate('GameState.offers.find(o=>o.playerId===1068088).status'),'accepted')
        result=self.page.evaluate('({offer:GameState.offers.find(o=>o.playerId===1068088),p:player(1068088),cash:GameState.userClub.presupuesto_dolares,fees:GameState.finance.ledger.filter(r=>r.category==="fichajes")})')
        self.assertEqual(result['p']['clubId'],'boca');self.assertEqual(result['p']['salario'],entered['wage'])
        self.assertEqual(result['p']['clausula_rescision'],entered['releaseClause'])
        self.assertEqual(len(result['fees']),1);self.assertEqual(result['cash'],before['cash']-result['offer']['fee']-entered['bonus'])

    def test_03_insufficient_cash_preserves_terms_and_allows_corrected_resubmission(self):
        self.vacancy();cash=self.page.evaluate('GameState.userClub.presupuesto_dolares')
        self.page.evaluate('GameState.userClub.presupuesto_dolares=0');self.open_market_offer()
        self.page.fill('#negotiation [name="fee"]','15000');before=self.financial_snapshot();self.submit()
        self.visible_error('fondos');self.assertEqual(self.financial_snapshot(),before)
        self.assertEqual(self.page.locator('#negotiation [name="fee"]').input_value(),'15000')
        self.assertTrue(self.page.locator('[data-contract-help="finances"]').is_visible())
        self.page.evaluate('(cash)=>GameState.userClub.presupuesto_dolares=cash',cash);self.submit()
        self.assertFalse(self.page.locator('#details').is_visible())
        offer=self.page.evaluate('GameState.offers.find(o=>o.playerId===1068088)')
        self.assertEqual(offer['fee'],15000);self.assertEqual(offer['stage'],'club');self.assertEqual(offer['bonus'],0)
        self.assertEqual(self.page.evaluate('MARKET_CONTRACTS.pendingWages()'),0)
        self.assertEqual(self.page.evaluate('GameState.userClub.presupuesto_dolares'),cash)

    def test_04_full_foreign_registration_does_not_block_offer(self):
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
        self.submit()
        self.assertFalse(self.page.locator('#details').is_visible())
        self.assertEqual(self.page.evaluate('(id)=>GameState.offers.find(o=>o.playerId===id).stage',target['id']),'club')
        self.assertFalse(self.page.evaluate('(id)=>FM_REGISTRATION.canRegister(player(id),"boca").ok',target['id']))

    def test_05_native_invalid_amount_is_reported_inside_form_and_integer_wage_is_valid(self):
        self.vacancy();self.open_market_offer();self.page.fill('#negotiation [name="fee"]','-1')
        before=self.financial_snapshot();self.submit();self.visible_error('importe del pase')
        self.assertIn('mínimo',self.page.locator('[data-offer-error]').inner_text());self.assertEqual(self.financial_snapshot(),before)
        self.page.fill('#negotiation [name="fee"]','15000');self.submit();self.player_agreement()
        self.page.fill('#negotiation [name="wage"]','150')
        self.assertTrue(self.page.locator('#negotiation [name="wage"]').evaluate('e=>e.validity.valid'))
        self.submit();self.assertFalse(self.page.locator('#details').is_visible())
        self.assertEqual(self.page.evaluate('GameState.offers.find(o=>o.playerId===1068088).wage'),150)

    def test_06_loan_mode_ignores_disabled_stale_purchase_terms_and_sends_once(self):
        self.vacancy();self.open_market_offer()
        self.assertTrue(self.page.locator('#negotiation [name="wageShare"]').is_disabled())
        self.page.select_option('#negotiation [name="installments"]','3')
        self.page.fill('#negotiation [name="upfrontPercent"]','0');self.page.fill('#negotiation [name="sellOnPercent"]','-1')
        self.page.select_option('#negotiation [name="dealType"]','loan')
        for field in ['sellOnPercent','installments','upfrontPercent']:
            self.assertTrue(self.page.locator('#negotiation [name="'+field+'"]').is_disabled())
        self.page.select_option('#negotiation [name="loanMonths"]','6');self.page.fill('#negotiation [name="wageShare"]','50')
        self.assertTrue(self.page.locator('#negotiation').evaluate('f=>f.checkValidity()'))
        before=self.financial_snapshot();self.submit()
        offer=self.page.evaluate('GameState.offers.find(o=>o.playerId===1068088)')
        self.assertEqual(offer['dealType'],'loan');self.assertEqual(offer['stage'],'club');self.assertEqual(offer['wageShare'],50)
        self.assertEqual(offer['loanMonths'],6);self.assertEqual(offer['bonus'],0)
        self.assertEqual(self.page.evaluate('GameState.userClub.presupuesto_dolares'),before['cash'])
        self.assertEqual(self.page.evaluate('player(1068088).clubId'),before['targetClub'])


if __name__ == '__main__':
    unittest.main(verbosity=2)
