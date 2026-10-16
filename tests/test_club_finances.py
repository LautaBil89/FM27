"""Cash, accounting and authorization must reconcile without charging old careers twice."""
import os
from pathlib import Path
import shutil
import unittest
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
URL=os.environ.get('FM27_TEST_URL','http://127.0.0.1:8000/index.html')


class ClubFinances(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pw=sync_playwright().start()
        cls.browser=cls.pw.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])

    @classmethod
    def tearDownClass(cls):
        cls.browser.close();cls.pw.stop()

    def setUp(self):
        self.context=self.browser.new_context(viewport={'width':1366,'height':768})
        self.page=self.context.new_page();self.errors=[]
        self.page.on('pageerror',lambda e:self.errors.append(str(e)))
        self.page.route('https://**/*',lambda r:r.abort())
        self.page.goto(URL,wait_until='domcontentloaded')
        self.page.fill('#manager','DT contable');self.page.click('[data-action="new"]');self.page.wait_for_selector('aside')
        if not self.page.evaluate('!!window.FM_FINANCES'):
            self.page.add_script_tag(content=(ROOT/'src/club-finances.js').read_text())
        self.page.evaluate('FM_FINANCES.ensure()')

    def tearDown(self):
        self.context.close();self.assertEqual(self.errors,[])

    def test_01_migration_preserves_cash_and_does_not_invent_historical_debt_or_assets(self):
        r=self.page.evaluate('''()=>{const before=GameState.userClub.presupuesto_dolares,a=FM_FINANCES.account(),s=FM_FINANCES.snapshot();FM_FINANCES.onDay(GameState.today);return {before,cash:GameState.userClub.presupuesto_dolares,opening:a.openingCash,debt:s.debt,assets:s.assets,tax:s.taxLiability,reconciled:s.reconciled,provenance:a.provenance}}''')
        self.assertEqual(r['cash'],r['before']);self.assertEqual(r['opening'],r['before'])
        self.assertEqual([r['debt'],r['assets'],r['tax']],[0,0,0]);self.assertTrue(r['reconciled']);self.assertIn('No se inventan',r['provenance'])

    def test_02_nested_transactions_have_one_cash_entry_and_medical_expense(self):
        r=self.page.evaluate('''()=>{const id=GameState.userClub.id,b=FM_FINANCES.account(),before=b.trackedCash;CLUB_AI.transaction(id,-2500,'Consulta especializada','medico');const s=FM_FINANCES.snapshot();return {delta:before-s.cash,rows:b.ledger.filter(r=>r.label==='Consulta especializada').length,expense:s.expense,reconciled:s.reconciled}}''')
        self.assertEqual(r['delta'],2500);self.assertEqual(r['rows'],1);self.assertEqual(r['expense'],2500);self.assertTrue(r['reconciled'])

    def test_03_payroll_tax_is_accrued_once_then_paid_once(self):
        r=self.page.evaluate('''()=>{const b=FM_FINANCES.account(),cash=GameState.userClub.presupuesto_dolares;MANAGEMENT.transaction(-10000,'Salarios del plantel','salarios');const tax=b.taxLiability,expense=b.operatingExpense;GameState.today='2026-02-01';FM_FINANCES.onDay(GameState.today);const paid=b.taxPaid,after=GameState.userClub.presupuesto_dolares;FM_FINANCES.onDay(GameState.today);return {tax,expense,paid,balance:b.taxLiability,delta:cash-after,duplicate:after-GameState.userClub.presupuesto_dolares,reconciled:FM_FINANCES.snapshot().reconciled}}''')
        self.assertEqual(r['tax'],2400);self.assertEqual(r['expense'],12400);self.assertEqual(r['paid'],2400);self.assertEqual(r['balance'],0)
        self.assertEqual(r['delta'],12400);self.assertEqual(r['duplicate'],0);self.assertTrue(r['reconciled'])

    def test_04_asset_uses_full_fee_and_installments_are_not_expensed_twice(self):
        r=self.page.evaluate('''()=>{const b=FM_FINANCES.account(),p=mine()[0],id=GameState.userClub.id,fee=365000;CLUB_AI.transaction(id,-fee*.25,'Fichaje y prima: '+p.nombre,'fichajes');const transfer={id:'finance-acquire',playerId:p.id,fromClub:null,toClub:id,fee,bonus:0,years:1,contractEnd:'2027-01-17',date:'2026-01-17',installments:3};FM_FINANCES.onTransfer(transfer);const duplicate=FM_FINANCES.onTransfer(transfer);GameState.today='2026-02-16';FM_FINANCES.onDay(GameState.today);const a=b.assets[p.id];CLUB_AI.transaction(id,-10000,'Cuota de traspaso','cuotas');return {cost:a.cost,remaining:a.remaining,amortized:a.amortized,spent:b.board.spent,expense:b.operatingExpense,duplicate,reconciled:FM_FINANCES.snapshot().reconciled}}''')
        self.assertEqual(r['cost'],365000);self.assertEqual(r['amortized'],30000);self.assertEqual(r['remaining'],335000)
        self.assertEqual(r['spent'],365000);self.assertEqual(r['expense'],0);self.assertFalse(r['duplicate']);self.assertTrue(r['reconciled'])

    def test_05_sale_uses_book_value_and_reinvests_board_percentage(self):
        r=self.page.evaluate('''()=>{const id=GameState.userClub.id,p=mine()[0],other=GameState.world.clubs.find(c=>c.id!==id).id,b=FM_FINANCES.account();FM_FINANCES.onTransfer({id:'acquire',playerId:p.id,toClub:id,fromClub:null,fee:100000,years:2,dealType:'permanent'});CLUB_AI.transaction(id,150000,'Venta: '+p.nombre,'ventas');FM_FINANCES.onTransfer({id:'sale',playerId:p.id,fromClub:id,toClub:other,fee:150000,years:3,dealType:'permanent'});return {profit:b.saleProfit,allocation:b.board.saleAllocation,assets:FM_FINANCES.snapshot().assets,unknown:b.unknownCostSales,reconciled:FM_FINANCES.snapshot().reconciled}}''')
        self.assertEqual(r['profit'],50000);self.assertEqual(r['allocation'],112500);self.assertEqual(r['assets'],0);self.assertEqual(r['unknown'],0);self.assertTrue(r['reconciled'])

    def test_06_credit_adds_cash_but_not_transfer_authorization_and_pays_principal_once(self):
        r=self.page.evaluate('''()=>{const b=FM_FINANCES.account(),before=GameState.userClub.presupuesto_dolares,authorized=b.board.authorized,result=FM_FINANCES.takeLoan(12000,12);GameState.today='2026-02-17';FM_FINANCES.onDay(GameState.today);const l=result.loan,after=GameState.userClub.presupuesto_dolares;FM_FINANCES.onDay(GameState.today);return {ok:result.ok,remaining:l.remaining,payments:l.payments.length,delta:after-before,expense:b.operatingExpense,authorized:b.board.authorized===authorized,duplicate:after-GameState.userClub.presupuesto_dolares,reconciled:FM_FINANCES.snapshot().reconciled}}''')
        self.assertTrue(r['ok']);self.assertEqual(r['remaining'],11000);self.assertEqual(r['payments'],1);self.assertEqual(r['delta'],10900)
        self.assertEqual(r['expense'],100);self.assertTrue(r['authorized']);self.assertEqual(r['duplicate'],0);self.assertTrue(r['reconciled'])

    def test_07_old_statements_and_local_currency_are_disclosed_and_persist(self):
        r=self.page.evaluate('''()=>{MANAGEMENT.transaction(10000,'Patrocinio extraordinario','patrocinio');GameState.today='2026-02-01';FM_FINANCES.onDay(GameState.today);const b=FM_FINANCES.account(),m=FM_FINANCES.model(),statement=b.statements.find(s=>s.month==='2026-01');saveGame(true);return {statement,model:m,projection:FM_FINANCES.projection(),original:FM_FINANCES.snapshot()}}''')
        self.assertEqual(r['statement']['income'],10000);self.assertEqual(r['statement']['result'],10000);self.assertEqual(r['model']['currency'],'ARS')
        self.assertIn('No son cotizaciones',r['model']['source']);self.assertIn('Excluye futuros fichajes',r['projection']['assumptions'])
        self.page.reload(wait_until='domcontentloaded');self.page.wait_for_selector('aside')
        # Older builds used while developing the new standalone module need the same extension again.
        if not self.page.evaluate('!!window.FM_FINANCES'):
            self.page.add_script_tag(content=(ROOT/'src/club-finances.js').read_text())
        self.assertEqual(self.page.evaluate("FM_FINANCES.account().statements.find(s=>s.month==='2026-01').income"),10000)
        self.assertTrue(self.page.evaluate('FM_FINANCES.snapshot().reconciled'))

    def test_08_renewal_extends_amortization_and_termination_writes_off_once(self):
        r=self.page.evaluate('''()=>{const p=mine()[0],id=GameState.userClub.id,b=FM_FINANCES.account();FM_FINANCES.onTransfer({id:'owned',playerId:p.id,toClub:id,fee:100000,years:1});p.contractEnd='2028-01-17';FM_FINANCES.onRenewal(p,2);const end=b.assets[p.id].end,first=FM_FINANCES.onTermination(p,0),second=FM_FINANCES.onTermination(p,0);return {end,first,second,expense:b.operatingExpense,remaining:b.assets[p.id].remaining}}''')
        self.assertEqual(r['end'],'2028-01-17');self.assertTrue(r['first']);self.assertFalse(r['second']);self.assertEqual(r['expense'],100000);self.assertEqual(r['remaining'],0)

    def test_09_finance_controls_fit_both_viewports_and_lists_scroll_locally(self):
        self.page.add_style_tag(content=(ROOT/'src/club-finances.css').read_text())
        for viewport in [{'width':1280,'height':720},{'width':390,'height':844}]:
            self.page.set_viewport_size(viewport)
            for tab in ['summary','budget','assets','ledger','statements','rules']:
                self.page.evaluate('''tab=>{view='finances';FM_FINANCES.ui.tab=tab;render();document.querySelector('#content').innerHTML=FM_FINANCES.render()}''',tab)
                self.assertTrue(self.page.evaluate('document.documentElement.scrollHeight<=innerHeight+1'),(viewport,tab))
                self.assertTrue(self.page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),(viewport,tab))
                self.assertTrue(self.page.locator('[data-finance-tab="'+tab+'"]').is_visible())

    def test_10_installment_obligations_reduce_liquidity_without_double_reducing_board_budget(self):
        r=self.page.evaluate('''()=>{const id=GameState.userClub.id,p=mine()[0],b=FM_FINANCES.account(),authorized=b.board.authorized;FM_FINANCES.onTransfer({id:'installment-check',playerId:p.id,toClub:id,fee:400000,years:3});MARKET_CONTRACTS.ensure().payments.push({id:'finance-test-payment',fromClub:id,toClub:null,playerId:p.id,amount:300000,dueDate:'2026-03-17',status:'pending'});return {board:FM_FINANCES.boardAvailable(),expected:authorized-400000,reservations:FM_FINANCES.commitments().reservations}}''')
        self.assertEqual(r['board'],r['expected']);self.assertEqual(r['reservations'],300000)

    def test_11_finance_tab_events_redraw_the_global_workspace(self):
        self.page.evaluate('''()=>{const base=render;window.financeDraws=0;render=function(){window.financeDraws++;base();if(view==='finances')document.querySelector('#content').innerHTML=FM_FINANCES.render()};view='finances';render()}''')
        self.page.click('[data-finance-tab="budget"]')
        self.assertEqual(self.page.evaluate('FM_FINANCES.ui.tab'),'budget')
        self.assertTrue(self.page.locator('[data-finance-loan]').is_visible())
        self.assertGreaterEqual(self.page.evaluate('window.financeDraws'),2)
        self.page.select_option('[data-finance-currency]','local')
        self.assertEqual(self.page.evaluate('FM_FINANCES.ui.currency'),'local')
        self.assertIn('ARS',self.page.locator('.cf-body').inner_text())

    def test_12_season_review_is_scoped_to_finished_league_and_idempotent(self):
        r=self.page.evaluate('''()=>{const arg=GameState.world.clubs.find(c=>c.leagueId==='ARG1'),europe=GameState.world.clubs.find(c=>c.leagueId==='GB1'),a=FM_FINANCES.account(arg.id),e=FM_FINANCES.account(europe.id);a.board.spent=5000;e.board.spent=7000;const prior={season:e.board.season,authorized:e.board.authorized,spent:e.board.spent,sponsor:e.sponsor.factor};GameState.today='2027-01-01';FM_FINANCES.onSeason(2027,[arg.id]);const once={season:a.board.season,authorized:a.board.authorized,statements:a.statements.length,sponsor:a.sponsor.factor};FM_FINANCES.onSeason(2027,[arg.id]);return {prior,europe:{season:e.board.season,authorized:e.board.authorized,spent:e.board.spent,sponsor:e.sponsor.factor},arg:once,repeat:{season:a.board.season,authorized:a.board.authorized,statements:a.statements.length,sponsor:a.sponsor.factor}}}''')
        self.assertEqual(r['europe'],r['prior']);self.assertEqual(r['arg']['season'],2027);self.assertEqual(r['repeat'],r['arg'])

    def test_13_medical_cost_can_be_paid_when_transfer_authorization_is_exhausted(self):
        r=self.page.evaluate('''()=>{const p=mine()[0],b=FM_FINANCES.account();b.board.spent=b.board.authorized+b.board.saleAllocation;const before=GameState.userClub.presupuesto_dolares;FM_MEDICINE.injure(p,{type:'strain',days:20,random:()=>.5});const operating=FM_FINANCES.operatingAvailable(),transfer=CLUB_AI.availableBudget(),ok=FM_MEDICINE.setRehab(p.id,'Especialista');return {operating,transfer,ok,cost:before-GameState.userClub.presupuesto_dolares,plan:FM_MEDICINE.state(p).rehab,reconciled:FM_FINANCES.snapshot().reconciled}}''')
        self.assertGreater(r['operating'],1500);self.assertEqual(r['transfer'],0);self.assertTrue(r['ok']);self.assertGreaterEqual(r['cost'],1500)
        self.assertEqual(r['plan'],'Especialista');self.assertTrue(r['reconciled'])


if __name__=='__main__':
    unittest.main()
