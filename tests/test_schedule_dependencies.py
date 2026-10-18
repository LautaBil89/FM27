"""Postponed knockout phases must wait for their real sporting predecessors."""
import json
from pathlib import Path
import subprocess
import unittest

ROOT=Path(__file__).resolve().parents[1]
SETUP=r"""
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const season={version:1,careerStart:'2026-01-03',leagues:{ARG1:{year:2026,end:'2026-12-13'}},history:[],reviewed:[]};
const semifinal={id:'2026-ARG1-SF',type:'LPF',leagueId:'ARG1',localCompetition:'APERTURA',phase:'knockout',stage:'SF',round:1,date:'2026-06-02',done:false,games:[{home:'a',away:'b',result:null}]};
const final={id:'2026-ARG1-FINAL',type:'LPF',leagueId:'ARG1',localCompetition:'APERTURA',phase:'knockout',stage:'FINAL',round:1,date:'2026-05-24',done:false,games:[]};
const s={world:{seasonCalendar:season},calendar:[final,semifinal],today:'2026-06-10',eventIndex:0};
const c={console,structuredClone,Date,GameState:s,WORLD_CLOCK:{eventSlot:()=>2},fixture:()=>null,eventDue:e=>!e.done&&e.date<=s.today,FM_EXTRA_CUPS:{owns:()=>false}};c.window=c;vm.createContext(c);vm.runInContext(fs.readFileSync('src/season-calendar.js','utf8'),c);
const api=c.FM_SEASONS,source=fs.readFileSync('src/world-engine.js','utf8'),start=source.indexOf('  function completeOne('),end=source.indexOf('    if(!background)settleFinances',start);assert(start>=0&&end>start);vm.runInContext(source.slice(start,end)+'return true;};window.canEnter=completeOne;',c);
"""

class ScheduleDependencies(unittest.TestCase):
    def run_js(self,body):
        p=subprocess.run(['node','-e',SETUP+body],cwd=ROOT,capture_output=True,text=True,timeout=15)
        self.assertEqual(p.returncode,0,p.stdout+p.stderr)
        return json.loads(p.stdout)

    def test_postponed_semifinal_cannot_complete_empty_final(self):
        r=self.run_js("""
const before=JSON.stringify(final);assert.equal(api.eventReady(final),false);assert.equal(c.canEnter(null,final),false);assert.equal(JSON.stringify(final),before);semifinal.done=true;assert.equal(api.eventReady(final),false);semifinal.games[0].result={home:1,away:0};assert.equal(api.eventReady(final),true);console.log(JSON.stringify({untouched:true}));
""")
        self.assertTrue(r['untouched'])

    def test_postponement_moves_dependent_final_and_preserves_other_competitions(self):
        r=self.run_js("""
const other={...final,id:'2026-OTHER',leagueId:'GB1',date:'2026-05-22'};s.calendar.push(other);assert(api.reconcileDependencies()>0);assert.equal(final.originalDate,'2026-05-24');assert.equal(final.date,'2026-06-05');assert.equal(other.date,'2026-05-22');assert.equal(api.reconcileDependencies(),0);assert.equal(c.canEnter(null,final),false);console.log(JSON.stringify({date:final.date,other:other.date}));
""")
        self.assertEqual(r['date'],'2026-06-05')
