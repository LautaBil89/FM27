#!/usr/bin/env python3
"""Exercise the compact world codec and transactional import without browser/CDN access."""
import json
from pathlib import Path
import shutil
import subprocess
import unittest

REPO = Path(__file__).resolve().parents[1]
NODE = shutil.which('node')

HARNESS = r"""
const fs = require('fs'), vm = require('vm'), assert = require('assert');
const clubs = [], leagues = [], players = [];
for (let l = 0; l < 30; l++) {
  const ids = [];
  for (let c = 0; c < 10; c++) {
    const id = `club-${l}-${c}`; ids.push(id);
    clubs.push({id, nombre:`Club ${l}-${c}`, leagueId:`league-${l}`, country:'Argentina', rating:70,
      color:'#334455', secondary:'#aabbcc', stadium:`Estadio ${l}-${c}`, city:`Ciudad ${l}`,
      sourceUrl:`https://www.transfermarkt.com/club/startseite/verein/${l*10+c+1}`, budget:12000000});
  }
  leagues.push({id:`league-${l}`, name:`League ${l}`, clubIds:ids, tier:1, foreignLimit:6, sourceSeason:'2026',
    sourceUrl:'https://www.transfermarkt.com/league/startseite/wettbewerb/ARG1', doubleRound:true});
}
for (let i = 1; i <= 10000; i++) players.push({playerId:100000+i, clubId:clubs[(i-1)%clubs.length].id,
  name:`Real reference ${i}`, dateOfBirth:`${1990+i%15}-06-15`, position:['POR','DEF','MED','DEL'][i%4],
  nationalities:['Argentina'], positionDetail:'Defensor central', foot:'Derecho', heightCm:180,
  marketValueEUR:100000+i*50, valuationDate:'2026-06-01', contractEnd:'2028-12-31', shirtNumber:i%30+1,
  profileUrl:`https://www.transfermarkt.com/player/profil/spieler/${100000+i}`,
  sourceUrl:'https://www.transfermarkt.com/club/kader/verein/1', sourceSeason:'2026', sourceType:'archive', retrievedAt:'2026-10-14'});
const hydrateIdentity = (p,r) => Object.assign(p,{nombre:r.name, playerId:r.playerId, realIdentity:true,
  fecha_nacimiento:r.dateOfBirth, birthYear:Number(r.dateOfBirth.slice(0,4)), posicion:r.position,
  positionDetail:r.positionDetail, nacionalidad:r.nationalities[0], nationalities:r.nationalities,
  foot:r.foot,heightCm:r.heightCm,shirtNumber:r.shirtNumber,registrationArgentina:true,
  transfermarkt:{...r, playerId:r.playerId, publishedName:r.name}});
const table = ids => Object.fromEntries(ids.map(id=>[id,{id,pj:0,g:0,e:0,p:0,gf:0,gc:0,pts:0}]));
const state = {version:3,worldVersion:1,manager:'DT pruebas',year:2026,today:'2026-02-01',eventIndex:0,
  userClub:{id:clubs[0].id,nombre:clubs[0].nombre,presupuesto_dolares:12000000,presupuesto_pesos:14400000000},
  players:players.map((r,i)=>Object.assign(hydrateIdentity({id:i+1,clubId:r.clubId},r), {
    edad:2026-Number(r.dateOfBirth.slice(0,4))-1,ritmo:50+i%40,tiro:40+i%45,pase:45+i%42,
    regate:48+i%42,defensa:43+i%43,fisico:52+i%35,condicion_fisica:100,moral:70,estado_forma:6.5,
    valor_mercado:r.marketValueEUR*1.1,salario:2000+i%4000,clausula_rescision:r.marketValueEUR*2.2,
    injury:0,ban:0,contract:2028,goals:0,appearances:0,minutes:0,assists:0,potential:80,
    trainingFocus:'Equipo',form:[],registered:true,marketValueOrigin:'Transfermarkt EUR convertido a USD de juego'})),
  calendar:[],world:{clubs:clubs.map(c=>({...c,form:[],relegated:false})),
    leagues:leagues.map(l=>({...l,standings:table(l.clubIds),rounds:[],format:'double'})),
    userLeagueId:leagues[0].id,cups:{LIB:{groups:[],groupTables:{},stages:[],winner:null},SUD:{groups:[],groupTables:{},stages:[],winner:null}}},
  tactics:{formation:'4-3-3',xi:Array.from({length:11},(_,i)=>i+1),bench:Array.from({length:7},(_,i)=>i+12)},
  news:[],match:null,external:[],finance:{ledger:[],seasonIncome:0,seasonExpense:0},
  scouting:{shortlist:[],reports:{}},offers:[],transferListed:[],history:[],inbox:[]};
for(let round=0;round<18;round++) for(const league of leagues) {
  const id=`event-${league.id}-${round}`, date=new Date(Date.UTC(2026,1,1+round*7)).toISOString().slice(0,10);
  state.calendar.push({id,date,type:'LPF',leagueId:league.id,round:round+1,done:false,
    games:Array.from({length:5},(_,i)=>({home:league.clubIds[i],away:league.clubIds[9-i],result:null}))});
  state.world.leagues.find(l=>l.id===league.id).rounds.push(id);
}
const hydrate = s => {
  const map = new Map(s.world.clubs.map(c=>[c.id,c])), l=s.world.leagues.find(l=>l.id===s.world.userLeagueId);
  s.league=l.clubIds.map(id=>map.get(id)); s.continental=s.world.clubs.filter(c=>!l.clubIds.includes(c.id));
  s.standings=l.standings;s.annual=l.standings;s.cup=s.world.cups.LIB;return s;
};
hydrate(state);
let memory = new Map(), failQuota=false, messages=[];
const context = vm.createContext({console,TextEncoder,Blob,URL,setTimeout,clearInterval,
  WORLD_DATABASE:{players,clubs,leagues},WORLD_ENGINE:{hydratePlayerIdentity:hydrateIdentity,hydrateWorldState:hydrate},
  MANAGEMENT:{validateImported:s=>{if(![1,2].includes(s?.version))throw Error('legacy invalid')},ensure:()=>{}},
  FORMATIONS:{'4-3-3':[]},KEY:'fm27-pasion-v1',actions:{},GameState:state,view:'dashboard',timer:null,
  localStorage:{setItem:(k,v)=>{if(failQuota){const e=Error('quota');e.name='QuotaExceededError';throw e;}memory.set(k,v)},getItem:k=>memory.get(k)||null},
  toast:m=>messages.push(m),confirm:()=>true,render:()=>{},window:{},document:{}});
vm.runInContext(fs.readFileSync(process.argv[1],'utf8'),context);
const storage=context.window.WORLD_STORAGE;
const plain=x=>JSON.parse(JSON.stringify(x));
const scenario=process.argv[2];
if(scenario==='size') {
  const information=storage.inspect(state);
  assert(information.localStorageBytes<4.5*1024*1024,JSON.stringify(information));
  assert(information.hydratedBytes>information.utf8Bytes*2);
  console.log(JSON.stringify(information));
}
if(scenario==='roundtrip') {
  const p=state.players[0];p.clubId=clubs[1].id;p.salario=19340;p.contract=2031;p.ritmo=94;p.injury=21;p.ban=2;
  p.nombre='Nombre corregido';p.foot='Izquierdo';p.transfermarkt={...p.transfermarkt,contractEnd:'2032-12-31'};
  p.form=[8.5,9.3];p.unknownFutureField={nested:[2,4,'preserve']};p.appearances=7;p.goals=4;
  delete state.players[1].heightCm;
  const youth={...plain(state.players[2]),id:20000,nombre:'Juvenil ficticio',realIdentity:false,playerId:undefined,transfermarkt:undefined};
  state.players.push(youth);state.finance.ledger.push({amount:15000,label:'Venta',date:state.today});
  state.world.clubs[0].rating=87;state.world.clubs[0].form=['G','E'];state.world.clubs[0].stadium='Ampliación';
  state.world.leagues[0].foreignLimit=8;
  const packed=storage.encode(state), restored=storage.decode(plain(packed));
  assert.deepStrictEqual(plain(restored),plain(state));
  assert.strictEqual(restored.league[0],restored.world.clubs[0]);
  assert.strictEqual(restored.annual,restored.world.leagues[0].standings);
  assert.strictEqual(restored.cup,restored.world.cups.LIB);
  assert(!JSON.stringify(packed).includes('https://www.transfermarkt.com/player/profil/spieler/100010'));
}
if(scenario==='invalid') {
  context.window.saveGame(true);const old=memory.get(context.KEY),current=context.GameState;
  for(const edit of [s=>s.players.push(s.players[0]),s=>s.players[0].clubId='missing',
    s=>s.world.leagues[0].standings[clubs[0].id].pts=2,
    s=>s.calendar[0].date='2026-02-31',s=>s.calendar[0].games[0].result={home:-1,away:0},
    s=>s.tactics.xi.push(s.tactics.xi[0]),s=>s.world.clubs[0].leagueId='missing']) {
    const candidate=plain(state);edit(candidate);assert.throws(()=>storage.importState(candidate,{confirm:false}));
    assert.strictEqual(context.GameState,current);assert.strictEqual(memory.get(context.KEY),old);
  }
  const malicious=JSON.parse('{"version":3,"__proto__":{"polluted":true}}');
  assert.throws(()=>storage.decode(malicious));assert.strictEqual({}.polluted,undefined);
  memory.set(context.KEY,'{"broken":true}');assert.strictEqual(context.window.loadGame(),false);
  assert.strictEqual(context.GameState,current);
}
if(scenario==='quota') {
  context.window.saveGame(true);const old=memory.get(context.KEY),current=context.GameState;
  failQuota=true;const candidate=plain(state);candidate.manager='Imported';
  assert.throws(()=>storage.importState(candidate,{confirm:false}));assert.strictEqual(context.GameState,current);
  assert.strictEqual(memory.get(context.KEY),old);assert.strictEqual(context.window.saveGame(),false);
  assert(messages.at(-1).includes('espacio'));assert(!messages.at(-1).includes('Carrera guardada'));
}
if(scenario==='paused') {
  const ids=Array.from({length:22},(_,i)=>i+1);
  state.match={home:clubs[0].id,away:clubs[1].id,userSide:0,minute:31,paused:false,done:false,
    score:[1,0],lineups:[ids.slice(0,11),ids.slice(11)],stats:[{shots:3,xg:0.4},{shots:2,xg:0.1}],
    ratings:Object.fromEntries(ids.map(id=>[id,6.5])),feed:[],red:[],injured:[],used:[],substitutions:2};
  state.players[0].condicion_fisica=81;
  const restored=storage.decode(plain(storage.encode(state)));
  assert.strictEqual(restored.match.paused,true);state.match.paused=true;
  assert.deepStrictEqual(plain(restored),plain(state));
}
if(scenario==='legacy') {
  const legacy={version:2,players:[],userClub:{id:'boca'},year:2026,legacyField:'preserve'};
  assert.deepStrictEqual(plain(storage.decode({format:'FM27',state:legacy})),legacy);
  assert.deepStrictEqual(JSON.parse(storage.serialize(legacy)),legacy);
}
"""


@unittest.skipUnless(NODE, 'Node.js is needed for the standalone storage scenarios')
class WorldStorageScenarios(unittest.TestCase):
    def run_scenario(self, scenario):
        result = subprocess.run([NODE, '-e', HARNESS, str(REPO / 'src/world-storage.js'), scenario], capture_output=True, text=True, timeout=45)
        self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
        return result.stdout

    def test_10000_player_career_fits_local_storage(self):
        information = json.loads(self.run_scenario('size'))
        self.assertEqual(information['players'], 10000)

    def test_changed_career_and_source_fields_survive_compaction(self):
        self.run_scenario('roundtrip')

    def test_invalid_import_and_restore_preserve_existing_career(self):
        self.run_scenario('invalid')

    def test_quota_failure_preserves_existing_career(self):
        self.run_scenario('quota')

    def test_live_match_resumes_paused_with_exact_progress(self):
        self.run_scenario('paused')

    def test_legacy_payloads_keep_the_existing_format(self):
        self.run_scenario('legacy')


if __name__ == '__main__':
    unittest.main(verbosity=2)
