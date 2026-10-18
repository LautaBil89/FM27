"""Independent saved careers: migration, real controls and failed-write isolation."""
import json
from pathlib import Path
import unittest
import test_offer_form as fixture


class CareerLibrary(unittest.TestCase):
    setUpClass=classmethod(fixture.OfferFormScenarios.setUpClass.__func__)
    tearDownClass=classmethod(fixture.OfferFormScenarios.tearDownClass.__func__)
    setUp=fixture.OfferFormScenarios.setUp
    tearDown=fixture.OfferFormScenarios.tearDown
    seed=fixture.OfferFormScenarios.seed

    def settled(self):
        self.page.evaluate('async()=>{await FM_CAREERS.initialize();await FM_CAREERS.saveCurrent();await FM_CAREERS.flush()}')

    def copy_as_second(self):
        return self.page.evaluate("""async()=>{const first=GameState.careerId;const copy=structuredClone(GameState);copy.manager='DT segunda carrera';copy.userClub.presupuesto_dolares-=12345;await FM_CAREERS.importCareer(copy);return {first,second:GameState.careerId,cash:GameState.userClub.presupuesto_dolares}}""")

    def test_new_career_button_keeps_first_and_loads_its_exact_progress_after_reload(self):
        self.settled()
        first=self.page.evaluate("""async()=>{GameState.userClub.presupuesto_dolares-=4321;GameState.tactics.tempo=27;await FM_CAREERS.saveCurrent();return {id:GameState.careerId,cash:GameState.userClub.presupuesto_dolares,manager:GameState.manager,players:GameState.players.length}}""")
        self.page.click('aside [data-action="reset"]')
        self.page.wait_for_selector('#manager')
        self.page.fill('#manager','DT carrera nueva')
        self.page.click('[data-action="new"]',timeout=30000)
        self.page.wait_for_selector('aside')
        second=self.page.evaluate("""async()=>{await FM_CAREERS.saveCurrent();return{id:GameState.careerId,count:(await FM_CAREERS.list()).length}}""")
        self.assertNotEqual(first['id'],second['id']);self.assertEqual(second['count'],2)
        self.page.reload(wait_until='domcontentloaded');self.page.wait_for_selector('aside')
        self.assertEqual(self.page.evaluate('GameState.careerId'),second['id'])
        self.page.click('aside [data-careers-open]')
        self.page.locator('[data-careers-load="'+first['id']+'"]').click()
        self.page.wait_for_function('(id)=>GameState.careerId===id',arg=first['id'])
        result=self.page.evaluate("""()=>({cash:GameState.userClub.presupuesto_dolares,tempo:GameState.tactics.tempo,manager:GameState.manager,players:GameState.players.length})""")
        self.assertEqual(result,{'cash':first['cash'],'tempo':27,'manager':first['manager'],'players':first['players']})
        self.assertEqual(self.page.evaluate('async()=>(await FM_CAREERS.list()).length'),2)

    def test_single_save_migrates_once_without_changing_its_players_or_money(self):
        self.settled()
        before=self.page.evaluate("""async()=>{await FM_CAREERS.flush();const s=structuredClone(GameState);delete s.careerId;delete s.careerName;delete s.careerMigrated;const db=await new Promise((ok,no)=>{const r=indexedDB.open('fm27-career-library',1);r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)});await new Promise((ok,no)=>{const t=db.transaction('careers','readwrite');t.objectStore('careers').clear();t.oncomplete=ok;t.onerror=no});db.close();const legacy=WORLD_STORAGE.serialize(s);WORLD_STORAGE.cancelPending();GameState=null;window.GameState=null;localStorage.setItem(KEY,legacy);return {cash:s.userClub.presupuesto_dolares,manager:s.manager,ids:s.players.map(p=>p.id)}}""")
        self.page.reload(wait_until='domcontentloaded');self.page.wait_for_selector('aside');self.settled()
        after=self.page.evaluate("""async()=>({id:GameState.careerId,migrated:GameState.careerMigrated,count:(await FM_CAREERS.list()).length,cash:GameState.userClub.presupuesto_dolares,manager:GameState.manager,ids:GameState.players.map(p=>p.id)})""")
        self.assertTrue(after['id'].startswith('career-'));self.assertTrue(after['migrated']);self.assertEqual(after['count'],1)
        for key in ['cash','manager','ids']:self.assertEqual(after[key],before[key])
        self.page.reload(wait_until='domcontentloaded');self.page.wait_for_selector('aside');self.settled()
        self.assertEqual(self.page.evaluate('GameState.careerId'),after['id'])
        self.assertEqual(self.page.evaluate('async()=>(await FM_CAREERS.list()).length'),1)

    def test_rename_export_and_import_same_copy_create_independent_careers(self):
        self.settled();ids=self.copy_as_second()
        self.page.evaluate("(id)=>FM_CAREERS.rename(id,'Proyecto original')",ids['first'])
        with self.page.expect_download() as download:
            self.page.evaluate('(id)=>FM_CAREERS.exportCareer(id)',ids['first'])
        payload=json.loads(Path(download.value.path()).read_text(encoding='utf-8'))
        self.assertEqual(payload['state']['careerId'],ids['first'])
        self.assertEqual(payload['state']['careerName'],'Proyecto original')
        self.assertEqual(self.page.evaluate('GameState.careerId'),ids['second'])
        imported=self.page.evaluate("""async p=>{await FM_CAREERS.importCareer(p);return{id:GameState.careerId,count:(await FM_CAREERS.list()).length,name:GameState.careerName}}""",payload)
        self.assertNotIn(imported['id'],[ids['first'],ids['second']]);self.assertEqual(imported['count'],3)
        self.assertEqual(imported['name'],'Proyecto original')

    def test_background_codec_cannot_write_the_old_career_into_the_new_slot(self):
        self.settled()
        first=self.page.evaluate("""()=>{GameState.manager='DT autoguardado anterior';WORLD_STORAGE.scheduleSave();return GameState.careerId}""")
        ids=self.copy_as_second()
        self.page.evaluate("""async()=>{GameState.manager='DT autoguardado nuevo';WORLD_STORAGE.scheduleSave();await new Promise(resolve=>{const poll=()=>WORLD_STORAGE.pending()?setTimeout(poll,30):resolve();poll()});await FM_CAREERS.flush()}""")
        self.page.evaluate('(id)=>FM_CAREERS.load(id)',first)
        self.assertEqual(self.page.evaluate('GameState.manager'),'DT autoguardado anterior')
        self.page.evaluate('(id)=>FM_CAREERS.load(id)',ids['second'])
        self.assertEqual(self.page.evaluate('GameState.manager'),'DT autoguardado nuevo')
        self.assertEqual(self.page.evaluate('async()=>(await FM_CAREERS.list()).length'),2)

    def test_failed_archive_and_corrupt_slot_never_discard_current_career(self):
        self.settled()
        r=self.page.evaluate("""async()=>{const id=GameState.careerId,cash=GameState.userClub.presupuesto_dolares;const put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(){throw new DOMException('Full','QuotaExceededError')};let failed=false;try{await FM_CAREERS.beginNew()}catch{failed=true}finally{IDBObjectStore.prototype.put=put}const preserved=GameState.careerId===id&&GameState.userClub.presupuesto_dolares===cash;await FM_CAREERS.saveCurrent();const db=await new Promise((ok,no)=>{const q=indexedDB.open('fm27-career-library',1);q.onsuccess=()=>ok(q.result);q.onerror=()=>no(q.error)});await new Promise((ok,no)=>{const t=db.transaction('careers','readwrite');t.objectStore('careers').put({id:'career-corrupt',name:'Rota',raw:'{"broken":true}'});t.oncomplete=ok;t.onerror=no});db.close();const primary=localStorage.getItem(KEY);let rejected=false;try{await FM_CAREERS.load('career-corrupt')}catch{rejected=true}return {failed,preserved,rejected,same:primary===localStorage.getItem(KEY),id:GameState.careerId,expected:id}}""")
        self.assertTrue(r['failed']);self.assertTrue(r['preserved']);self.assertTrue(r['rejected']);self.assertTrue(r['same']);self.assertEqual(r['id'],r['expected'])
        self.page.evaluate("()=>{window.originalCareerPut=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(){throw new DOMException('Full','QuotaExceededError')};}")
        try:
            with self.page.expect_download() as backup:
                self.page.evaluate('FM_CAREERS.exportCareer(GameState.careerId)')
            exported=json.loads(Path(backup.value.path()).read_text(encoding='utf-8'))
            self.assertEqual(exported['state']['careerId'],r['expected'])
        finally:
            self.page.evaluate('()=>{IDBObjectStore.prototype.put=originalCareerPut;}')


    def test_deleting_one_career_keeps_the_other_and_cannot_resurrect_from_late_save(self):
        self.settled();ids=self.copy_as_second()
        self.page.evaluate('(id)=>FM_CAREERS.remove(id,false)',ids['first'])
        self.assertEqual(self.page.evaluate('GameState.careerId'),ids['second'])
        self.assertEqual(self.page.evaluate('async()=>(await FM_CAREERS.list()).map(r=>r.id)'),[ids['second']])
        result=self.page.evaluate("""async id=>{const raw=localStorage.getItem(KEY),source={careerId:GameState.careerId,careerName:GameState.careerName,manager:GameState.manager,today:GameState.today,year:GameState.year,userClub:GameState.userClub};await FM_CAREERS.remove(id,false);FM_CAREERS.onSaved(raw,source);await FM_CAREERS.flush();return{state:GameState,primary:localStorage.getItem(KEY),count:(await FM_CAREERS.list()).length}}""",ids['second'])
        self.assertIsNone(result['state']);self.assertIsNone(result['primary']);self.assertEqual(result['count'],0)

    def test_recovery_checkpoints_are_partitioned_and_cannot_replace_another_career(self):
        self.settled()
        first=self.page.evaluate("""async()=>{await new Promise(r=>setTimeout(r,700));const checkpoint=await FM_INTEGRITY.checkpoint('Copia exclusiva A');if(!checkpoint)throw Error(FM_INTEGRITY.ui.notice);return{id:GameState.careerId,checkpoint:checkpoint.id}}""")
        self.copy_as_second()
        r=self.page.evaluate("""async d=>{await new Promise(r=>setTimeout(r,700));const original=GameState.careerId,primary=localStorage.getItem(KEY),rejected=!(await FM_INTEGRITY.restore(d.checkpoint,{confirm:false}));const unaffected=GameState.careerId===original&&localStorage.getItem(KEY)===primary;for(let i=0;i<7;i++)await FM_INTEGRITY.checkpoint('B '+i);const second=(await FM_INTEGRITY.list()).length;await FM_CAREERS.load(d.id);const rows=await FM_INTEGRITY.list();return{rejected,unaffected,second,retained:rows.some(r=>r.id===d.checkpoint),allOwn:rows.every(r=>r.careerId===d.id)}}""",first)
        self.assertTrue(r['rejected']);self.assertTrue(r['unaffected']);self.assertEqual(r['second'],6);self.assertTrue(r['retained']);self.assertTrue(r['allOwn'])

    def test_two_paused_matches_with_same_fixture_id_restore_the_correct_shell_and_score(self):
        self.settled()
        first=self.page.evaluate("""async()=>{const e=WORLD_CLOCK.nextFixture();GameState.today=e.date;WORLD_CLOCK.ensure().slot=WORLD_CLOCK.eventSlot(e);startMatch();clearInterval(timer);timer=null;GameState.match.paused=true;GameState.match.minute=17;GameState.match.score=[2,1];await FM_CAREERS.saveCurrent();return{id:GameState.careerId,manager:GameState.manager,event:GameState.match.eventId}}""")
        self.copy_as_second()
        self.assertIn('DT segunda carrera',self.page.locator('.fm-clubbox').inner_text())
        self.page.evaluate("async()=>{GameState.match.score=[4,3];GameState.match.minute=38;await FM_CAREERS.saveCurrent()}")
        self.page.evaluate('(id)=>FM_CAREERS.load(id)',first['id'])
        state=self.page.evaluate('()=>({event:GameState.match.eventId,minute:GameState.match.minute,score:GameState.match.score,paused:GameState.match.paused})')
        self.assertEqual(state,{'event':first['event'],'minute':17,'score':[2,1],'paused':True})
        self.assertIn(first['manager'],self.page.locator('.fm-clubbox').inner_text())
        self.page.set_viewport_size({'width':390,'height':844})
        self.page.evaluate('FM_CAREERS.show()')
        bounds=self.page.locator('#careers-dialog').bounding_box()
        self.assertGreaterEqual(bounds['x'],0);self.assertLessEqual(bounds['x']+bounds['width'],391)
        self.assertLessEqual(bounds['height'],844)


if __name__ == "__main__":
    unittest.main()
