"""Isolated sporting tests: source catalog, all lower formats, exchanges and byes.

The browser suite checks integration; this suite exhausts conditional brackets
without mutating the generated standalone HTML or depending on internet access.
"""
import json
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HARNESS = r"""
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
global.window=global;global.document={addEventListener(){}};
const base=JSON.parse(fs.readFileSync('data/world-database.json','utf8'));
const supplement=JSON.parse(fs.readFileSync('data/world/pyramids.json','utf8'));
global.GameState=null;
global.club=id=>GameState.world.clubs.find(c=>c.id===id);
global.clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,v));
global.esc=s=>String(s??'');global.date=s=>s;global.render=()=>{};global.news=()=>{};
global.MANAGEMENT={transaction(){}};global.WORLD_CLOCK={eventSlot:()=>3};
function rr(ids,double=false){const ring=[...ids];if(ring.length%2)ring.push(null);const result=[];for(let r=0;r<ring.length-1;r++){const games=[];for(let i=0;i<ring.length/2;i++){let a=ring[i],b=ring[ring.length-1-i];if(!a||!b)continue;if((r+i)%2)[a,b]=[b,a];games.push({home:a,away:b,result:null})}result.push(games);ring.splice(1,0,ring.pop())}return double?[...result,...result.map(g=>g.map(m=>({home:m.away,away:m.home,result:null})))]:result}
global.WORLD_ENGINE={roundRobin:rr,reindex(){}};
global.FM_REGULATIONS={enabled:()=>false};
global.makePlayer=(id,clubId,pos,rating,country)=>({id,clubId,posicion:pos,nacionalidad:country,condicion_fisica:100,realIdentity:true,transfermarkt:{playerId:id}});
global.FM_COMPETITIONS={initializeNewCareer(){},buildCalendar:events=>events,updatesTable:()=>true,updateTables(){},onEventComplete(){},needsPenalties:()=>false,competitionLabel:()=>'',hydrate:x=>x,objectiveResult:(p,g,f)=>f};
vm.runInThisContext(fs.readFileSync('src/football-pyramid.js','utf8'));
const blank=ids=>Object.fromEntries(ids.map(id=>[id,{id,pj:0,g:0,e:0,p:0,gf:0,gc:0,pts:0}]));
function fresh(){
 GameState={worldVersion:1,year:2026,today:'2026-01-01',players:[],userClub:{id:'boca',reputacion:70},world:{clubs:structuredClone([...base.clubs,...supplement.clubs]),leagues:structuredClone([...base.leagues,...supplement.leagues]),userLeagueId:'ARG1'},calendar:[]};
 for(const l of GameState.world.leagues)l.standings=blank(l.clubIds);
 FM_PYRAMIDS.initialize();return GameState;
}
function mainAdd(table,id,gf,gc){const r=table[id];r.pj++;r.gf+=gf;r.gc+=gc;if(gf>gc){r.g++;r.pts+=3}else if(gf===gc){r.e++;r.pts++}else r.p++}
function prepare(id){
 fresh();const events=FM_PYRAMIDS.buildLeagueCalendar(id,2026),windows=FM_PYRAMIDS.phaseWindows(id,2026);
 for(const phase of Object.keys(windows)){const list=events.filter(e=>e.pyramidPhase===phase),[start,end]=windows[phase];for(const [i,e]of list.entries())e.date=new Date(+new Date(start)+(list.length===1?0:i/(list.length-1))*(new Date(end)-new Date(start))).toISOString().slice(0,10)}
 const upper=FM_PYRAMIDS.rules[id].upper;
 GameState.calendar=[...events,{id:`2026-${upper}-completed`,type:'LPF',leagueId:upper,date:id==='BOL2'?'2026-12-20':['GB2','ES2','IT2','L2','FR2'].includes(id)?'2027-05-22':'2026-12-13',games:[],done:true}];
 return events;
}
function playEvent(e,override=null){
 GameState.today=e.date;
 for(const g of e.games){const r={home:1,away:0,pen:null};g.result=r;if(FM_COMPETITIONS.updatesTable(e)){const t=GameState.world.leagues.find(l=>l.id===e.leagueId).standings;mainAdd(t,g.home,1,0);mainAdd(t,g.away,0,1)}FM_COMPETITIONS.updateTables(e,g,r)}
 if(override)override(e);FM_COMPETITIONS.onEventComplete(e);e.done=true;
}
function finish(id,override=null){let count=0;while(true){const e=GameState.calendar.filter(e=>!e.done).sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id))[0];if(!e)break;if(++count>180)throw Error('Infinite bracket '+id);playEvent(e,override)}return FM_PYRAMIDS.movementSummary(id)}
function state(id){return GameState.world.pyramids.leagues[id]}
function lower(id){return GameState.world.leagues.find(l=>l.id===id)}
"""


class FootballPyramids(unittest.TestCase):
    def js(self, body):
        result = subprocess.run(['node', '-e', HARNESS + '\n' + body], cwd=ROOT,
                                capture_output=True, text=True, timeout=45)
        self.assertEqual(result.returncode, 0, result.stderr)
        return json.loads(result.stdout or 'null')

    def test_catalog_has_verified_unique_identities_and_honest_coverage(self):
        self.js(r"""
assert.equal(base.clubs.length,310);assert.equal(base.players.length,9220);
assert.equal(supplement.leagues.length,14);assert.equal(supplement.clubs.length,255);assert.equal(supplement.players.length,5963);
assert.equal(new Set([...base.clubs,...supplement.clubs].map(c=>c.id)).size,565);
assert.equal(new Set([...base.players,...supplement.players].map(p=>p.playerId)).size,15183);
for(const p of supplement.players){assert.ok(p.name);assert.ok(p.profileUrl?.includes('/spieler/'));assert.ok(p.sourceUrl);assert.ok(p.retrievedAt);assert.ok(p.dateOfBirth)}
for(const l of supplement.leagues){assert.equal(l.clubIds.length,supplement.clubs.filter(c=>c.leagueId===l.id).length);assert.ok(l.sourceSeason);assert.ok(l.sourceUrl)}
const bol=supplement.leagues.find(l=>l.id==='BOL2');assert.equal(bol.historicalPool,true);assert.equal(bol.clubIds.length,24);assert.equal(supplement.players.filter(p=>bol.clubIds.includes(p.clubId)).length,0);assert.match(supplement.notes.join(' '),/No equivale a la nómina/);
console.log('null');
""")

    def test_missing_squads_get_explicit_fictional_reserves_once(self):
        self.js(r"""
fresh();const before=GameState.players.length;assert.ok(before>0);assert.equal(FM_PYRAMIDS.ensureSquads(),false);assert.equal(GameState.players.length,before);
for(const p of GameState.players){assert.equal(p.realIdentity,false);assert.equal(p.synthetic,true);assert.match(p.nombre,/simulada/);assert.equal(p.transfermarkt,undefined);assert.match(p.identitySource,/ficticia/)}
for(const c of supplement.clubs){const players=GameState.players.filter(p=>p.clubId===c.id);assert.equal(players.length,18);assert.equal(players.filter(p=>p.posicion==='POR').length,2)}
assert.equal(new Set(GameState.players.map(p=>p.id)).size,GameState.players.length);console.log('null');
""")

    def test_full_regular_schedules_have_exact_home_away_pairs(self):
        self.js(r"""
for(const [id,rounds]of Object.entries({GB2:46,ES2:42,IT2:38,L2:34,FR2:34,BRA2:38,CHI2:30,PAR2:30})){prepare(id);const events=GameState.calendar.filter(e=>e.leagueId===id&&e.pyramidPhase==='LIGA');assert.equal(events.length,rounds,id);const seen=new Set();for(const e of events){const teams=e.games.flatMap(g=>[g.home,g.away]);assert.equal(new Set(teams).size,teams.length,id+' duplicate in round');for(const g of e.games){const key=g.home+'>'+g.away;assert.ok(!seen.has(key),id+' duplicate match');seen.add(key)}}assert.equal(seen.size,lower(id).clubIds.length*rounds/2,id)}console.log('null');
""")

    def test_all_fourteen_formats_finish_and_exchange_once(self):
        self.js(r"""
const result=[];
for(const id of Object.keys(FM_PYRAMIDS.rules)){
 prepare(id);const top=lower(FM_PYRAMIDS.rules[id].upper),bottom=lower(id),topCount=top.clubIds.length,bottomCount=bottom.clubIds.length,summary=finish(id);
 assert.equal(summary.ready,true,id+' stuck '+JSON.stringify(state(id).completed));assert.ok(summary.promoted.length>=FM_PYRAMIDS.rules[id].promotions,id);assert.equal(summary.promoted.length,summary.relegated.length,id+' unbalanced');assert.equal(new Set([...summary.promoted,...summary.relegated]).size,summary.promoted.length+summary.relegated.length,id+' overlap');
 assert.equal(FM_PYRAMIDS.beforeLeagueRollover(id),true,id);assert.equal(top.clubIds.length,topCount,id);assert.equal(bottom.clubIds.length,bottomCount,id);for(const pid of summary.promoted){assert.ok(top.clubIds.includes(pid),id);assert.equal(club(pid).leagueId,top.id)}
 const membership=JSON.stringify([top.clubIds,bottom.clubIds]);assert.equal(FM_PYRAMIDS.beforeLeagueRollover(top.id),true);assert.equal(JSON.stringify([top.clubIds,bottom.clubIds]),membership);assert.equal(GameState.world.pyramids.history.length,1);result.push(id);
}
console.log(JSON.stringify(result));
""")

    def test_italian_conditional_brackets_all_entrant_counts(self):
        self.js(r"""
for(let entrants=1;entrants<=6;entrants++){
 prepare('IT2');let rewritten=false;
 const summary=finish('IT2',e=>{if(e.pyramidPhase!=='LIGA'||!e.pyramidLast)return;const rows=Object.values(lower('IT2').standings).sort((a,b)=>a.id.localeCompare(b.id));rows.forEach((r,i)=>r.pts=i<2?100-i:i<2+entrants?70-(i-2):30-(i-2));rewritten=true});
 assert.equal(rewritten,true);assert.equal(summary.ready,true,'entrants '+entrants);assert.equal(summary.promoted.length,3,'entrants '+entrants);assert.equal(state('IT2').italianCandidates?.length||1,entrants);
}console.log('null');
""")

    def test_reserve_club_can_win_title_but_cannot_gain_parent_division(self):
        self.js(r"""
prepare('ES2');const b=GameState.world.clubs.find(c=>c.leagueId==='ES2'&&c.reserveParentId);assert.ok(b);let seeded=false;
const summary=finish('ES2',e=>{if(e.pyramidPhase==='LIGA'&&e.pyramidLast){lower('ES2').standings[b.id].pts=999;seeded=true}});
assert.equal(seeded,true);assert.equal(state('ES2').champion,b.id);assert.ok(!summary.promoted.includes(b.id));assert.equal(summary.promoted.length,3);console.log('null');
""")

    def test_pending_other_division_and_promotion_block_rollover(self):
        self.js(r"""
prepare('L2');const topEvent=GameState.calendar.find(e=>e.leagueId==='L1');topEvent.done=false;topEvent.games=[{home:lower('L1').clubIds[0],away:lower('L1').clubIds[1],result:null}];
while(true){const e=GameState.calendar.find(e=>!e.done&&e.leagueId==='L2'&&e.pyramidPhase!=='PROMOCION');if(!e)break;playEvent(e)}
assert.equal(FM_PYRAMIDS.beforeLeagueRollover('L1'),false);assert.equal(state('L2').stages.PROMOCION.ties.length,0);
playEvent(topEvent);assert.equal(state('L2').stages.PROMOCION.ties.length,1);assert.equal(FM_PYRAMIDS.beforeLeagueRollover('L1'),false);
const summary=finish('L2');assert.equal(summary.ready,true);assert.equal(FM_PYRAMIDS.beforeLeagueRollover('L1'),true);console.log('null');
""")

    def test_spanish_sporting_advantage_never_rolls_penalties(self):
        self.js(r"""
prepare('ES2');for(const e of GameState.calendar.filter(e=>e.pyramidPhase==='LIGA'))playEvent(e);
const events=GameState.calendar.filter(e=>e.pyramidPhase==='SEMIFINAL').sort((a,b)=>a.pyramidLeg-b.pyramidLeg),tie=state('ES2').stages.SEMIFINAL.ties[0];
for(const e of events){for(const g of e.games)g.result={home:0,away:0};FM_COMPETITIONS.onEventComplete(e);e.done=true}
assert.equal(tie.winner,tie.home);assert.equal(tie.sportingAdvantage,true);assert.ok(!tie.legs.at(-1).result.pen);assert.equal(FM_PYRAMIDS.needsPenalties({score:[0,0]},events[1],tie.legs[1]),false);console.log('null');
""")

    def test_hydration_rebinds_leg_results_to_calendar_and_keeps_movement_key(self):
        self.js(r"""
prepare('GB2');for(const e of GameState.calendar.filter(e=>e.pyramidPhase==='LIGA'))playEvent(e);
const restored=JSON.parse(JSON.stringify(GameState));GameState=restored;FM_PYRAMIDS.hydrate(restored);const tie=state('GB2').stages.SEMIFINAL.ties[0],e=GameState.calendar.find(e=>e.id===tie.legs[0].eventId),g=e.games.find(g=>g.tieId===tie.id);assert.equal(tie.legs[0],g);g.result={home:4,away:1};assert.equal(tie.legs[0].result.home,4);console.log('null');
""")

    def test_phase_windows_order_dependencies_and_leave_rest(self):
        self.js(r"""
const deps={GB2:[['LIGA','SEMIFINAL'],['SEMIFINAL','FINAL']],ES2:[['LIGA','SEMIFINAL'],['SEMIFINAL','FINAL']],IT2:[['LIGA','PRELIMINAR'],['PRELIMINAR','SEMIFINAL'],['SEMIFINAL','FINAL']],L2:[['LIGA','PROMOCION']],FR2:[['LIGA','PLAYOFF_45'],['PLAYOFF_45','PLAYOFF_3'],['PLAYOFF_3','PROMOCION']],BRA2:[['LIGA','ASCENSO']],CHI2:[['LIGA','CUARTOS'],['CUARTOS','SEMIFINAL'],['SEMIFINAL','FINAL']],ECU2:[['INICIAL','HEXAGONALES']],URU2:[['COMPETENCIA','FINAL_COMPETENCIA'],['FINAL_COMPETENCIA','REGULAR'],['REGULAR','REPECHAJE'],['REPECHAJE','SEMIFINAL'],['SEMIFINAL','FINAL']],PER2:[['REGIONAL','CAMPEONATO'],['CAMPEONATO','CUARTOS'],['CUARTOS','SEMIFINAL'],['SEMIFINAL','FINAL'],['FINAL','SEGUNDO_ASCENSO']],COL2:[['APERTURA','APERTURA_GRUPOS'],['APERTURA_GRUPOS','APERTURA_FINAL'],['APERTURA_FINAL','CLAUSURA'],['CLAUSURA','CLAUSURA_GRUPOS'],['CLAUSURA_GRUPOS','CLAUSURA_FINAL'],['CLAUSURA_FINAL','GRAN_FINAL'],['GRAN_FINAL','SEGUNDO_ASCENSO']],VEN2:[['APERTURA','APERTURA_CUARTOS'],['APERTURA_CUARTOS','APERTURA_SEMIFINAL'],['APERTURA_SEMIFINAL','APERTURA_FINAL'],['APERTURA_FINAL','CLAUSURA'],['CLAUSURA','CLAUSURA_CUARTOS'],['CLAUSURA_CUARTOS','CLAUSURA_SEMIFINAL'],['CLAUSURA_SEMIFINAL','CLAUSURA_FINAL'],['CLAUSURA_FINAL','FINAL_ABSOLUTA']],BOL2:[['NACIONAL','OCTAVOS'],['OCTAVOS','CUARTOS'],['CUARTOS','SEMIFINAL'],['SEMIFINAL','FINAL'],['FINAL','PROMOCION']]};
for(const [id,dependencies]of Object.entries(deps)){const w=FM_PYRAMIDS.phaseWindows(id,2026);for(const [a,b]of dependencies)assert.ok(new Date(w[b][0])-new Date(w[a][1])>=3*86400000,`${id} ${a} -> ${b}`)}console.log('null');
""")

    def test_annual_calendar_keeps_all_lower_finals_inside_same_year(self):
        self.js(r"""
fresh();const events=FM_PYRAMIDS.buildCalendar([]);for(const e of events){assert.ok(e.date>='2026-01-24',e.id);assert.ok(e.date<='2026-12-20',e.id+' '+e.date)}assert.equal(new Set(events.map(e=>e.leagueId)).size,14);console.log('null');
""")

    def test_existing_real_outfield_roster_gets_keeper_coverage_without_relabelling(self):
        self.js(r"""
fresh();const c=supplement.clubs[0],original=Array.from({length:26},(_,i)=>({id:100+i,clubId:c.id,posicion:'DEF',realIdentity:true,nombre:'Published identity '+i,transfermarkt:{playerId:100+i}}));GameState.players=structuredClone(original);FM_PYRAMIDS.ensureSquads();const saved=GameState.players.filter(p=>p.id>=100&&p.id<126);assert.deepEqual(saved,original);assert.equal(GameState.players.filter(p=>p.clubId===c.id&&p.posicion==='POR').length,2);assert.ok(GameState.players.filter(p=>p.clubId===c.id&&p.synthetic).length>0);console.log('null');
""")

    def test_finished_promotion_enriches_both_season_records(self):
        self.js(r"""
prepare('L2');const upperRecord={leagueId:'L1',year:2026,relegated:[]};GameState.world.seasonCalendar={history:[upperRecord]};
finish('L2',e=>{if(e.pyramidPhase==='PROMOCION')for(const g of e.games)g.result=lower('L2').clubIds.includes(g.home)?{home:2,away:0}:{home:0,away:2}});
const record={leagueId:'L2',year:2026};FM_PYRAMIDS.onLeagueSeasonEnd('L2',record);assert.equal(record.champion,state('L2').champion);assert.equal(record.promoted.length,3);assert.equal(upperRecord.relegated.length,3);assert.ok(upperRecord.relegated.includes(state('L2').indirectOpponent));assert.ok(upperRecord.sporting.pyramid.playoff.winner);GameState.userClub.id=state('L2').indirectOpponent;GameState.world.userLeagueId='L1';assert.equal(FM_COMPETITIONS.objectiveResult(16,'Evitar el descenso',true),false);console.log('null');
""")

    def test_a_previously_empty_promotion_is_reopened_when_upper_opponent_qualifies(self):
        self.js(r"""
prepare('L2');const upper=GameState.calendar.find(e=>e.leagueId==='L1');upper.done=false;upper.games=[{home:lower('L1').clubIds[0],away:lower('L1').clubIds[1],result:null}];
for(const e of GameState.calendar.filter(e=>e.pyramidPhase==='LIGA'))playEvent(e);
const promotion=GameState.calendar.filter(e=>e.pyramidPhase==='PROMOCION');assert.ok(promotion.every(e=>e.games.length===0));for(const e of promotion)e.done=true;
upper.done=true;FM_PYRAMIDS.ensureInterdivision('L2');assert.ok(promotion.every(e=>!e.done&&e.games.length===1&&e.date>upper.date));
finish('L2');assert.equal(FM_PYRAMIDS.movementSummary('L2').ready,true);console.log('null');
""")

    def test_past_exchange_key_survives_lower_rebuild_before_upper(self):
        self.js(r"""
prepare('GB2');finish('GB2');assert.equal(FM_PYRAMIDS.beforeLeagueRollover('GB2'),true);const membership=JSON.stringify(lower('GB1').clubIds);FM_PYRAMIDS.buildLeagueCalendar('GB2',2027);assert.equal(state('GB2').year,2027);assert.equal(FM_PYRAMIDS.beforeLeagueRollover('GB1',{year:2026}),true);assert.equal(JSON.stringify(lower('GB1').clubIds),membership);assert.equal(GameState.world.pyramids.history.length,1);console.log('null');
""")


if __name__ == '__main__':
    unittest.main(verbosity=2)
