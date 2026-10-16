"""Large worlds round-trip within browser quota; corrupt compressed imports are atomic."""
import runpy
import shutil
import subprocess
import unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
BASE=runpy.run_path(str(ROOT/'tests/test_world_storage.py'))['HARNESS']
HARNESS=BASE.replace('i <= 10000','i <= 18000').replace("vm.runInContext(fs.readFileSync(process.argv[1],'utf8'),context);", "vm.runInContext(fs.readFileSync(process.argv[3],'utf8'),context);vm.runInContext(fs.readFileSync(process.argv[1],'utf8'),context);") + r'''
for(const p of state.players){p.medical={sharpness:55+p.id%45,load7:p.id%560,history:Array.from({length:6},(_,i)=>({date:`2026-01-${String(i+10).padStart(2,'0')}`,minutes:90,workload:p.id%400+i,source:'match'}))};}
if(scenario==='compression'){
  const raw=storage.serialize(state),packed=JSON.parse(raw);
  assert.strictEqual(packed.format,'FM27-COMPACT-LZ');
  assert(raw.length*2<5*1024*1024,raw.length*2);
  assert.deepStrictEqual(plain(storage.decode(packed)),plain(state));
  console.log(JSON.stringify(storage.inspect(state)));
}
if(scenario==='guard'){
  const lz=context.LZString,text='Career with repeated records '.repeat(10000),encoded=lz.compressToUTF16(text);
  assert.strictEqual(lz.decompressFromUTF16(encoded,text.length),text);
  assert.strictEqual(lz.decompressFromUTF16(encoded,1024),null);
  context.window.saveGame(true);const before=memory.get(context.KEY),old=context.GameState;
  const raw=JSON.parse(storage.serialize(state));
  for(const data of [raw.data.slice(0,10),'broken data',lz.compressToUTF16(JSON.stringify({format:'OTHER'}))]){
    assert.throws(()=>storage.importState({...raw,data},{confirm:false}));
    assert.strictEqual(context.GameState,old);assert.strictEqual(memory.get(context.KEY),before);
  }
}
'''
@unittest.skipUnless(shutil.which('node'),'Node required')
class CompressedStorage(unittest.TestCase):
    def run_case(self,scenario):
        result=subprocess.run(['node','-e',HARNESS,str(ROOT/'src/world-storage.js'),scenario,str(ROOT/'src/vendor/lz-string.js')],capture_output=True,text=True,timeout=90)
        self.assertEqual(result.returncode,0,result.stderr+result.stdout)
    def test_large_expanded_world_roundtrips_under_browser_quota(self):self.run_case('compression')
    def test_decoder_bounds_and_corrupt_import_preserve_current_career(self):self.run_case('guard')
if __name__=='__main__':unittest.main()
