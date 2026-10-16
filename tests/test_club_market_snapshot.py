"""Weekly bid evaluation may share a snapshot, never prices after ownership/cash changes."""
import os
import shutil
import unittest
from playwright.sync_api import sync_playwright
URL=os.environ.get('FM27_TEST_URL','http://127.0.0.1:8000/index.html')
class ClubMarketSnapshot(unittest.TestCase):
    def test_weekly_bids_preserve_cash_and_discard_read_only_snapshot_before_transfers(self):
        with sync_playwright() as pw:
            browser=pw.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
            page=browser.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.route('https://**/*',lambda r:r.abort());page.goto(URL,wait_until='domcontentloaded')
            result=page.evaluate('''()=>{WORLD_ENGINE.createWorldCareer('DT mercado','boca',undefined,{calendarMode:'annual'});for(let i=0;i<20;i++)WORLD_CLOCK.advance({silent:true});const books=GameState.world.clubs.map(c=>FM_FINANCES.snapshot(c.id)),p=GameState.players.find(p=>p.clubId&&p.clubId!==GameState.userClub.id&&p.edad>=30);const before=CLUB_AI.askingPrice(p);p.valor_mercado*=2;const after=CLUB_AI.askingPrice(p);return {reconciled:books.every(b=>b.reconciled),negative:books.filter(b=>b.cash<0).length,transfers:GameState.world.ai.log.filter(e=>e.type==='transfer').length,before,after}}''')
            browser.close();self.assertEqual(errors,[]);self.assertTrue(result['reconciled']);self.assertEqual(result['negative'],0);self.assertGreater(result['transfers'],0);self.assertGreater(result['after'],result['before']*1.8)
if __name__=='__main__':unittest.main()
