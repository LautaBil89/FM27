"""Background codec must remain responsive and never replace a newer/manual save."""
import unittest
from test_offer_form import OfferFormScenarios

class BackgroundSave(unittest.TestCase):
    setUpClass=classmethod(OfferFormScenarios.setUpClass.__func__)
    tearDownClass=classmethod(OfferFormScenarios.tearDownClass.__func__)
    setUp=OfferFormScenarios.setUp
    tearDown=OfferFormScenarios.tearDown
    seed=OfferFormScenarios.seed

    def settled(self):
        self.page.wait_for_function('!WORLD_STORAGE.pending()',timeout=30000)

    def test_background_roundtrip_and_event_loop_remain_responsive(self):
        self.page.evaluate("""()=>{window.workerObserved=false;const Original=Worker;window.Worker=class extends Original{constructor(...args){super(...args);workerObserved=true}};window.saveFrames=[];window.savingFrames=true;let before=performance.now();function frame(now){saveFrames.push(now-before);before=now;if(savingFrames)requestAnimationFrame(frame)}requestAnimationFrame(frame);GameState.manager='Guardado en segundo plano';for(let i=0;i<8;i++)WORLD_STORAGE.scheduleSave()}""")
        self.settled()
        result=self.page.evaluate("""()=>{savingFrames=false;const s=WORLD_STORAGE.decode(JSON.parse(localStorage.getItem(KEY)));return {worker:workerObserved,manager:s.manager,players:s.players.length,maxFrame:Math.max(...saveFrames),frames:saveFrames.length,format:JSON.parse(localStorage.getItem(KEY)).format}}""")
        self.assertTrue(result['worker']);self.assertEqual(result['manager'],'Guardado en segundo plano')
        self.assertEqual(result['players'],15630);self.assertEqual(result['format'],'FM27-COMPACT-LZ')
        self.assertGreater(result['frames'],10)
        self.assertLess(result['maxFrame'],700,'Codec work must not block the UI for a second')

    def test_newer_revision_manual_save_and_reload_win_over_inflight_worker(self):
        self.page.evaluate("""()=>{window.codecReplies=0;const Original=Worker;window.Worker=class extends Original{constructor(...args){super(...args);this.addEventListener('message',()=>codecReplies++)}};GameState.manager='Viejo';WORLD_STORAGE.scheduleSave()}""")
        self.page.wait_for_timeout(450)
        self.page.evaluate("""()=>{GameState.manager='Nuevo';WORLD_STORAGE.scheduleSave();GameState.manager='Manual definitivo';saveGame(true)}""")
        self.page.wait_for_function('codecReplies>=1',timeout=30000)
        self.settled()
        self.assertEqual(self.page.evaluate('WORLD_STORAGE.decode(JSON.parse(localStorage.getItem(KEY))).manager'),'Manual definitivo')
        self.page.evaluate("""()=>{GameState.manager='Al salir';WORLD_STORAGE.scheduleSave();window.dispatchEvent(new Event('pagehide'))}""")
        self.page.reload(wait_until='domcontentloaded');self.page.wait_for_selector('aside')
        self.assertEqual(self.page.evaluate('GameState.manager'),'Al salir')

    def test_newest_autosave_and_no_worker_fallback(self):
        self.page.evaluate("""()=>{GameState.manager='Primera revisión';WORLD_STORAGE.scheduleSave()}""")
        self.page.wait_for_timeout(450)
        self.page.evaluate("""()=>{GameState.manager='Última revisión';WORLD_STORAGE.scheduleSave()}""")
        self.settled()
        self.assertEqual(self.page.evaluate('WORLD_STORAGE.decode(JSON.parse(localStorage.getItem(KEY))).manager'),'Última revisión')
        # Use a new document to exercise a browser where workers cannot start.
        self.page.reload(wait_until='domcontentloaded');self.page.wait_for_selector('aside')
        self.page.evaluate("""()=>{window.Worker=class{constructor(){throw Error('Workers deshabilitados')}};GameState.manager='Compatibilidad';WORLD_STORAGE.scheduleSave()}""")
        self.settled()
        self.assertEqual(self.page.evaluate('WORLD_STORAGE.decode(JSON.parse(localStorage.getItem(KEY))).manager'),'Compatibilidad')

    def test_import_cannot_be_overwritten_and_failed_background_write_keeps_backup(self):
        self.page.evaluate("""()=>{window.codecReplies=0;const Original=Worker;window.Worker=class extends Original{constructor(...args){super(...args);this.addEventListener('message',()=>codecReplies++)}};GameState.manager='Anterior al import';WORLD_STORAGE.scheduleSave()}""")
        self.page.wait_for_timeout(450)
        self.page.evaluate("""()=>{const imported=structuredClone(GameState);imported.manager='Importada';WORLD_STORAGE.importState(imported,{confirm:false,render:false})}""")
        self.page.wait_for_function('codecReplies>=1',timeout=30000)
        self.assertEqual(self.page.evaluate('WORLD_STORAGE.decode(JSON.parse(localStorage.getItem(KEY))).manager'),'Importada')
        self.page.evaluate("""()=>{window.safeBackup=localStorage.getItem(KEY);window.realStorageWrite=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key===KEY)throw new DOMException('Sin espacio','QuotaExceededError');return realStorageWrite.call(this,key,value)};GameState.manager='No entra';WORLD_STORAGE.scheduleSave()}""")
        self.settled()
        self.assertTrue(self.page.evaluate('localStorage.getItem(KEY)===safeBackup'))
        self.assertIn('se agotó el espacio',self.page.locator('#toast').inner_text())
        self.page.evaluate('()=>{Storage.prototype.setItem=realStorageWrite}')

if __name__=='__main__':unittest.main()
