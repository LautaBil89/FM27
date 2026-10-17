"""Recovery checkpoints validate real careers and never replace a valid save on failure."""
import os
import shutil
import unittest
from playwright.sync_api import sync_playwright

URL=os.environ.get('FM27_TEST_URL','http://127.0.0.1:8066/index.html')

class CareerIntegrity(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pw=sync_playwright().start()
        cls.browser=cls.pw.chromium.launch(executable_path=os.environ.get('FM27_CHROMIUM') or shutil.which('chromium'),args=['--no-sandbox','--disable-dev-shm-usage'])
    @classmethod
    def tearDownClass(cls):
        cls.browser.close();cls.pw.stop()
    def setUp(self):
        self.context=self.browser.new_context(viewport={'width':1280,'height':720});self.page=self.context.new_page();self.errors=[]
        self.page.on('pageerror',lambda e:self.errors.append(str(e)))
        self.page.route('https://**/*',lambda r:r.abort())
        self.page.goto(URL,wait_until='domcontentloaded')
    def tearDown(self):
        self.context.close();self.assertEqual(self.errors,[])
    def career(self):
        self.page.fill('#manager','DT respaldo');self.page.click('[data-action="new"]');self.page.wait_for_selector('aside')
    def test_01_checkpoints_restore_money_tactics_and_journal(self):
        self.career()
        r=self.page.evaluate('''async()=>{await new Promise(r=>setTimeout(r,800));const cash=GameState.userClub.presupuesto_dolares;FM_INTEGRITY.record('tactica','Preparar bloque medio','Plan antes del clásico');let point=await FM_INTEGRITY.checkpoint('Antes de la decisión');if(!point){await new Promise(r=>setTimeout(r,500));point=await FM_INTEGRITY.checkpoint('Antes de la decisión')}if(!point)throw Error(FM_INTEGRITY.ui.notice);GameState.userClub.presupuesto_dolares-=123456;GameState.tactics.tempo=25;saveGame(true);const restored=await FM_INTEGRITY.restore(point.id,{confirm:false});return {restored,cash,now:GameState.userClub.presupuesto_dolares,journal:FM_INTEGRITY.ensure().journal.map(r=>r.title),count:(await FM_INTEGRITY.list()).length}}''')
        self.assertTrue(r['restored']);self.assertEqual(r['now'],r['cash']);self.assertIn('Preparar bloque medio',r['journal']);self.assertIn('Carrera recuperada',r['journal']);self.assertGreater(r['count'],0)
    def test_02_corrupt_checkpoint_is_rejected_without_replacing_primary(self):
        self.career()
        r=self.page.evaluate('''async()=>{await new Promise(r=>setTimeout(r,800));const before=GameState.userClub.presupuesto_dolares,stored=localStorage.getItem(KEY);await new Promise((resolve,reject)=>{const r=indexedDB.open('fm27-career-checkpoints',1);r.onsuccess=()=>{const t=r.result.transaction('checkpoints','readwrite');t.objectStore('checkpoints').put({id:'corrupt-test',createdAt:Date.now(),raw:'{"broken":true}'});t.oncomplete=resolve;t.onerror=reject}});const restored=await FM_INTEGRITY.restore('corrupt-test',{confirm:false});return {restored,before,after:GameState.userClub.presupuesto_dolares,same:stored===localStorage.getItem(KEY),notice:FM_INTEGRITY.ui.notice}}''')
        self.assertFalse(r['restored']);self.assertEqual(r['after'],r['before']);self.assertTrue(r['same']);self.assertIn('No se pudo recuperar',r['notice'])
    def test_03_primary_save_survives_unavailable_checkpoint_storage(self):
        self.page.evaluate("Object.defineProperty(window,'indexedDB',{value:undefined,configurable:true})");self.career()
        r=self.page.evaluate('''async()=>({saved:saveGame(true),copy:await FM_INTEGRITY.checkpoint(),primary:!!localStorage.getItem(KEY),status:FM_INTEGRITY.ui.status})''')
        self.assertTrue(r['saved']);self.assertTrue(r['primary']);self.assertIsNone(r['copy']);self.assertEqual(r['status'],'unavailable')
    def test_05_background_save_creates_checkpoint_with_matching_payload_date(self):
        self.career()
        self.page.evaluate("""()=>{GameState.today=new Date(Date.parse(GameState.today)+86400000).toISOString().slice(0,10);GameState.manager='Respaldo desde worker';WORLD_STORAGE.scheduleSave()}""")
        self.page.wait_for_function('!WORLD_STORAGE.pending()',timeout=30000)
        r=self.page.evaluate("""async()=>{const until=Date.now()+10000;let row;while(Date.now()<until){row=(await FM_INTEGRITY.list()).find(r=>r.manager==='Respaldo desde worker');if(row)break;await new Promise(resolve=>setTimeout(resolve,100))}if(!row)throw Error('El autoguardado no creó punto de recuperación');const db=await new Promise((resolve,reject)=>{const q=indexedDB.open('fm27-career-checkpoints',1);q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error)});const stored=await new Promise((resolve,reject)=>{const q=db.transaction('checkpoints','readonly').objectStore('checkpoints').get(row.id);q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error)});db.close();const decoded=WORLD_STORAGE.decode(JSON.parse(stored.raw));return {date:row.date,payloadDate:decoded.today,manager:decoded.manager}}""")
        self.assertEqual(r['date'],r['payloadDate']);self.assertEqual(r['manager'],'Respaldo desde worker')

    def test_04_decision_history_is_bounded_and_survives_reload(self):
        self.career()
        r=self.page.evaluate('''()=>{for(let n=0;n<180;n++)FM_INTEGRITY.record('decision','Decisión '+n,'Evidencia registrada '+n);saveGame(true);return FM_INTEGRITY.ensure().journal.length}''')
        self.assertEqual(r,120);self.page.reload(wait_until='domcontentloaded');self.assertEqual(self.page.evaluate('FM_INTEGRITY.ensure().journal[0].title'),'Decisión 179')
