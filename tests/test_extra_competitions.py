"""Run the real additional-competition module against deterministic career universes.

Fixtures provide club identities and the engine boundary; draws, calendar construction,
extra time, results, qualification, prizes and next-round progression are production code.
"""
import json
from pathlib import Path
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[1]
BOOT = r"""
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const database=JSON.parse(fs.readFileSync('data/world-database.json','utf8'));
const clone=x=>structuredClone(x),noop=()=>{};
let receipts=[],resolved=null;
const w={version:3,worldVersion:1,year:2026,today:'2026-01-03',manager:'DT QA',userClub:{id:'boca',nombre:'Boca Juniors',reputacion:80,presupuesto_dolares:1e7},inbox:[],players:[],calendar:[],eventIndex:0,world:{clubs:clone(database.clubs),leagues:clone(database.leagues),cups:{},seasonCalendar:{lastDay:null,history:[]}}};
for(const l of w.world.leagues)l.standings=Object.fromEntries(l.clubIds.map(id=>[id,{id,pj:0,g:0,e:0,p:0,gf:0,gc:0,pts:0}]));
const c={GameState:w,structuredClone,Date,Math:Object.create(Math),Set,Map,JSON,console,document:{addEventListener:noop},news:noop,MANAGEMENT:{addMessage:noop},clamp:(n,a=0,b=100)=>Math.min(b,Math.max(a,n)),club:id=>w.world.clubs.find(c=>c.id===id),penalties:()=>({home:5,away:4}),WORLD_CLOCK:{eventSlot:e=>e.type==='LPF'?2:3},CLUB_AI:{ensure:noop,transaction:(id,amount,label)=>{receipts.push({id,amount,label});return true}},FM_SEASONS:{active:()=>true,referenceYear:(id,day)=>day<'2026-07-01'?2025:2026,leagueSeason:id=>({year:['GB1','ES1','IT1','L1','FR1'].includes(id)?2025:2026}),internationalBreak:()=>null},esc:String,date:String,money:String,render:noop};
c.window=c;c.Math.random=()=>.99;c.WORLD_ENGINE={league:id=>w.world.leagues.find(l=>l.id===id),sortedRows:table=>Object.values(table).sort((a,b)=>a.id.localeCompare(b.id)),reindex:noop,hydrateWorldState:noop,playerFromReference:(r,team,id)=>({id,clubId:team.id,nombre:r.name,realIdentity:false,synthetic:true,posicion:r.position}),makeContinentalCalendar:(year,previous)=>{resolved={year,eligible:previous.__resolvedCups};return[]}};
vm.createContext(c);vm.runInContext(fs.readFileSync('src/uefa-guest-clubs.js','utf8'),c);vm.runInContext(fs.readFileSync('src/continental-competitions.js','utf8'),c);const api=c.FM_EXTRA_CUPS;
function play(e,score={home:0,away:0}){assert(api.ready(e),'event ready '+e.id);w.today=e.date;for(const g of e.games){const r={...score};api.simulateExtra(e,g,r);g.result=r;api.recordResult(e,g,r)}api.onEventComplete(e);e.done=true}
function finish(id){let iterations=0;for(;;){const pending=w.calendar.filter(e=>e.extraCupId===id&&!e.done).sort((a,b)=>a.date.localeCompare(b.date)).find(e=>api.ready(e));if(!pending)break;play(pending);assert(++iterations<300,'finite competition')}return api.all().find(c=>c.id===id)}
"""


class ExtraCompetitions(unittest.TestCase):
    def run_js(self, scenario):
        result = subprocess.run(['node', '-e', BOOT + '\n' + scenario], cwd=ROOT, text=True, capture_output=True, timeout=90)
        self.assertEqual(result.returncode, 0, result.stderr or result.stdout)
        return json.loads(result.stdout)

    def test_01_three_disjoint_uefa_fields_distinct_opponents_and_balanced_venues(self):
        result = self.run_js(r"""
api.ensure();const cups=api.all().filter(c=>['UCL','UEL','UEC'].includes(c.type));assert.equal(cups.length,3);assert.equal(new Set(cups.flatMap(c=>c.participants)).size,108);
for(const cup of cups){const count=cup.type==='UEC'?6:8,events=w.calendar.filter(e=>e.extraCupId===cup.id);assert.equal(cup.participants.length,36);assert.equal(events.length,count);for(const id of cup.participants){const games=events.flatMap(e=>e.games).filter(g=>g.home===id||g.away===id);assert.equal(games.length,count);assert.equal(games.filter(g=>g.home===id).length,count/2);assert.equal(new Set(games.map(g=>g.home===id?g.away:g.home)).size,count);assert(games.every(g=>c.club(g.home).country!==c.club(g.away).country))}}
const guests=w.world.clubs.filter(c=>c.external);assert.equal(guests.length,80);assert(guests.every(c=>c.sourceUrl.startsWith('https://www.uefa.com/')));assert(w.players.every(p=>p.synthetic&&!p.realIdentity&&p.nombre.includes('reserva simulada')));console.log(JSON.stringify({cups:3,participants:108,guests:guests.length}));
""")
        self.assertEqual(result['participants'], 108)

    def test_02_uefa_top_eight_byes_playoffs_knockout_extra_time_and_one_title_prize(self):
        result = self.run_js(r"""
api.ensure();const cup=api.all().find(c=>c.type==='UCL');for(const event of w.calendar.filter(e=>e.extraCupId===cup.id&&e.phase==='league').sort((a,b)=>a.round-b.round))play(event);
assert.equal(cup.seeded.length,8);const po=cup.stages.find(s=>s.key==='PLAYOFF');assert.equal(po.ties.length,8);assert(po.ties.every(t=>!cup.seeded.includes(t.home)&&!cup.seeded.includes(t.away)));finish(cup.id);assert(cup.winner);assert.equal(cup.stages.find(s=>s.key==='R16').ties.length,8);assert.equal(cup.stages.find(s=>s.key==='FINAL').ties.length,1);const final=w.calendar.find(e=>e.extraCupId===cup.id&&e.stage==='FINAL');assert(final.neutral);assert(final.games[0].result.extraTime);assert(final.games[0].result.pen);const before=receipts.filter(r=>r.label==='Campeón de '+cup.name).length;api.onEventComplete(final);assert.equal(receipts.filter(r=>r.label==='Campeón de '+cup.name).length,before);assert.equal(before,1);console.log(JSON.stringify({winner:cup.winner,stages:cup.stages.length}));
""")
        self.assertEqual(result['stages'], 5)

    def test_03_all_national_entrants_reach_a_bracket_and_champion_is_unique(self):
        result = self.run_js(r"""
api.ensure();const cups=api.all().filter(c=>c.type==='CUP');assert.equal(cups.length,15);for(const cup of cups){const expected=w.world.leagues.filter(l=>l.country===cup.country&&[1,2].includes(l.tier)).flatMap(l=>l.clubIds);assert.deepEqual([...cup.participants].sort(),expected.sort());finish(cup.id);assert(cup.winner,cup.id);const allTies=cup.stages.flatMap(s=>s.ties);assert(cup.participants.every(id=>allTies.some(t=>t.home===id||t.away===id)),cup.id+' entrant missing');const final=w.calendar.find(e=>e.extraCupId===cup.id&&e.stage==='FINAL');assert(final.neutral);assert.equal(api.domesticWinner(cup.country,cup.year),cup.winner)}assert(w.calendar.every((e,i,a)=>!i||e.date>=a[i-1].date));console.log(JSON.stringify({cups:cups.length,winners:cups.filter(c=>c.winner).length}));
""")
        self.assertEqual(result['winners'], 15)

    def test_04_future_conmebol_preliminaries_resolve_47_into_32_and_sudamericana_44_into_32(self):
        result = self.run_js(r"""
api.ensure();w.today='2027-01-02';const sa=w.world.leagues.filter(l=>l.confederation==='CONMEBOL'&&l.tier===1);w.world.cups={LIB:{winner:'boca'},SUD:{winner:sa.find(l=>l.country==='Brasil').clubIds[0]}};const prep=api.prepareContinental(2027,null);assert(prep);w.calendar.push(...prep.events);w.calendar.sort((a,b)=>a.date.localeCompare(b.date));const lib=api.all().find(c=>c.id==='LIB_PRE:2027'),sud=api.all().find(c=>c.id==='SUD_PRE:2027');assert.equal(lib.participants.length,47);assert.equal(new Set(lib.participants).size,47);assert.equal(sud.participants.length,44);assert.equal(new Set(sud.participants).size,44);finish(sud.id);finish(lib.id);assert(resolved);assert.equal(resolved.eligible.LIB.length,32);assert.equal(resolved.eligible.SUD.length,32);assert.equal(new Set([...resolved.eligible.LIB,...resolved.eligible.SUD]).size,64);assert(resolved.eligible.LIB.includes('boca'));assert(resolved.eligible.LIB.includes(w.world.cups.SUD.winner));const losers=api.ensure().preliminaries[2027].libLosers;assert.equal(losers.length,4);assert(losers.every(id=>resolved.eligible.SUD.includes(id)));console.log(JSON.stringify({lib:32,sud:32,losers:4}));
""")
        self.assertEqual(result['losers'], 4)

    def test_05_initial_2026_conmebol_groups_are_preserved_and_reload_does_not_duplicate_cups(self):
        result = self.run_js(r"""
assert.equal(api.prepareContinental(2026,null),null);api.ensure();const before=w.calendar.length,guestCount=w.players.length,cups=api.all().length;api.ensure();assert.equal(w.calendar.length,before);const restored=clone(w);c.GameState=restored;w.world=restored.world;w.calendar=restored.calendar;w.players=restored.players;w.inbox=restored.inbox;api.ensure();assert.equal(w.calendar.length,before);assert.equal(w.players.length,guestCount);assert.equal(api.all().length,cups);console.log(JSON.stringify({cups,events:before}));
""")
        self.assertEqual(result['cups'], 18)

    def test_06_league_table_is_idempotent_and_cup_results_do_not_create_league_points(self):
        result = self.run_js(r"""
api.ensure();const cup=api.all().find(c=>c.type==='UEL'),event=w.calendar.find(e=>e.extraCupId===cup.id),g=event.games[0],r={home:2,away:1};api.recordResult(event,g,r);const saved=JSON.stringify(cup.table);assert.equal(api.recordResult(event,g,r),false);assert.equal(JSON.stringify(cup.table),saved);assert.equal(cup.table[g.home].pts,3);assert.equal(cup.table[g.away].pts,0);assert.equal(cup.table[g.away].awayGoals,1);assert(w.world.leagues.every(l=>Object.values(l.standings).every(r=>r.pts===0)));console.log(JSON.stringify({home:3,away:0}));
""")
        self.assertEqual(result['home'], 3)

    def test_07_preliminary_exception_allows_nine_brazilian_entries_without_breaking_group_draw(self):
        result = self.run_js(r"""
const source=fs.readFileSync('src/world-engine.js','utf8'),countryDraw=source.slice(source.indexOf('  function countryDraw('),source.indexOf('  function qualifiedTeams(')),seededShuffle=source.slice(source.indexOf('  function seededShuffle('),source.indexOf('  function roundRobin('));c.countryOfClub=id=>c.club(id).country;vm.runInContext(seededShuffle+countryDraw+'window.__draw=countryDraw;',c);const bra=w.world.leagues.find(l=>l.country==='Brasil'&&l.tier===1).clubIds.slice(0,9),others=[],countries=w.world.leagues.filter(l=>l.confederation==='CONMEBOL'&&l.tier===1&&l.country!=='Brasil');for(let i=0;others.length<23;i++)for(const l of countries)if(others.length<23)others.push(l.clubIds[i]);const teams=[...bra,...others],preliminary=[...bra.slice(-2),...others.slice(-2)],groups=c.__draw(teams,2027,preliminary);assert.equal(groups.length,8);assert.equal(new Set(groups.flatMap(g=>g.teams)).size,32);assert(groups.every(g=>g.teams.length===4));for(const g of groups){for(const country of new Set(g.teams.map(id=>c.club(id).country))){const same=g.teams.filter(id=>c.club(id).country===country);assert(same.length<=2);if(same.length===2)assert(same.some(id=>preliminary.includes(id)))}}console.log(JSON.stringify({groups:8,brazil:9}));
""")
        self.assertEqual(result['brazil'], 9)

    def test_08_historical_cup_winner_does_not_pay_or_credit_the_current_manager(self):
        result = self.run_js(r"""
api.ensure();const cup=api.all().find(c=>c.type==='CUP'&&c.country==='Argentina');w.world.initializingHistory=true;const oldRep=w.userClub.reputacion;for(;;){const e=w.calendar.filter(e=>e.extraCupId===cup.id&&!e.done).sort((a,b)=>a.date.localeCompare(b.date)).find(e=>api.ready(e));if(!e)break;w.today=e.date;for(const g of e.games){const score=g.home==='boca'?{home:4,away:0}:g.away==='boca'?{home:0,away:4}:{home:1,away:0};g.result=score;api.recordResult(e,g,score)}api.onEventComplete(e);e.done=true}assert.equal(cup.winner,'boca');assert.equal(w.userClub.reputacion,oldRep);assert(!receipts.some(r=>r.id==='boca'&&r.label==='Campeón de '+cup.name));console.log(JSON.stringify({winner:cup.winner,reputation:oldRep}));
""")
        self.assertEqual(result['winner'], 'boca')

    def test_09_legacy_annual_cups_finish_in_their_calendar_year(self):
        result = self.run_js(r"""
c.FM_SEASONS.active=()=>false;c.FM_SEASONS.leagueSeason=()=>null;api.ensure();const cups=api.all();assert(cups.every(c=>c.year===2026));assert(cups.every(c=>c.annualCalendar));for(const cup of cups)finish(cup.id);assert(cups.every(c=>c.winner));assert(w.calendar.every(e=>e.date.startsWith('2026-')));assert(cups.filter(c=>c.type==='UCL').every(c=>c.formatNote.includes('legado')));console.log(JSON.stringify({cups:cups.length,last:w.calendar.at(-1).date}));
""")
        self.assertEqual(result['cups'], 18)

    def test_10_annual_calendar_rebuild_keeps_existing_extra_fixtures_and_results(self):
        result = self.run_js(r"""
c.FM_SEASONS.active=()=>false;c.FM_SEASONS.leagueSeason=()=>null;c.FM_SEASONS.reshape=x=>x;c.FM_SEASONS.careerStart=()=>null;api.ensure();const first=w.calendar.find(e=>e.type==='UCL');play(first,{home:2,away:0});const retained=w.calendar.filter(e=>api.owns(e)),tableBefore=JSON.stringify(api.all().find(c=>c.type==='UCL').table);w.year=2027;
const src=fs.readFileSync('src/world-engine.js','utf8'),rr=src.slice(src.indexOf('  function roundRobin('),src.indexOf('  function sortedRows(')),build=src.slice(src.indexOf('  function makeWorldCalendar('),src.indexOf('  function eventGames('));c.blankTable=ids=>Object.fromEntries(ids.map(id=>[id,{id,pj:0,g:0,e:0,p:0,gf:0,gc:0,pts:0}]));c.DAY=86400000;c.iso=x=>new Date(x).toISOString().slice(0,10);c.eventSlot=e=>e.type==='LPF'?2:3;c.hydrateWorldState=()=>{};c.makeContinentalCalendar=()=>[];vm.runInContext(rr+build+'window.__rebuild=makeWorldCalendar;',c);c.__rebuild();assert(retained.every(e=>w.calendar.includes(e)));assert.equal(new Set(w.calendar.map(e=>e.id)).size,w.calendar.length);assert.equal(JSON.stringify(api.all().find(c=>c.type==='UCL').table),tableBefore);assert(first.done);assert.equal(first.games[0].result.home,2);console.log(JSON.stringify({retained:retained.length,result:2}));
""")
        self.assertGreater(result['retained'], 20)

    def test_11_guest_squads_replenish_after_retirements_once_per_european_edition(self):
        result = self.run_js(r"""
const source=fs.readFileSync('src/world-engine.js','utf8'),allocator=source.slice(source.indexOf('  let identityState='),source.indexOf('  function indexState('));c.isWorld=()=>true;
w.world.lifecycle={retired:{91000001:{id:91000001,retired:true}},reserve:{clubs:{sample:{youth:[{id:91000005}]}}}};w.world.development={clubs:{sample:{academy:[{id:91000008}]}}};vm.runInContext(allocator+'window.WORLD_ENGINE.nextPlayerId=nextPlayerId;',c);
api.ensure();assert(api.all().some(cup=>cup.id==='UCL:2025'));assert(!api.all().some(cup=>cup.id==='UCL:2026'));
const guests=w.world.clubs.filter(c=>c.external),first=guests[0],second=guests[1],retired=w.players.filter(p=>p.clubId===first.id||p.clubId===second.id&&p.posicion==='POR');
for(const p of retired)w.world.lifecycle.retired[p.id]={...p,clubId:null,retired:true};const removed=new Set(retired.map(p=>p.id));w.players=w.players.filter(p=>!removed.has(p.id));const before=w.players.length;w.today='2026-07-01';api.onDay(w.today);
assert.equal(w.players.length,before+20);assert(api.all().some(cup=>cup.id==='UCL:2026'));for(const team of guests){const pool=w.players.filter(p=>p.clubId===team.id);assert(pool.length>=18);for(const [pos,min]of [['POR',2],['DEF',5],['MED',5],['DEL',3]])assert(pool.filter(p=>p.posicion===pos).length>=min)}
const ids=w.players.map(p=>p.id);assert.equal(new Set(ids).size,ids.length);assert(ids.every(id=>!w.world.lifecycle.retired[id]));assert(ids.every(id=>id>91000008));assert(w.players.every(p=>p.synthetic&&!p.realIdentity&&p.nombre.includes('reserva simulada')));
const count=w.players.length,eventCount=w.calendar.length;api.onDay('2026-07-02');assert.equal(w.players.length,count);assert.equal(w.calendar.length,eventCount);assert.equal(api.all().filter(cup=>cup.id==='UCL:2026').length,1);assert(w.world.extraCompetitions.guestRosterEditions[2025]);assert(w.world.extraCompetitions.guestRosterEditions[2026]);
console.log(JSON.stringify({added:20,unique:ids.length,editions:2}));
""")
        self.assertEqual(result['added'], 20)

    def test_12_guest_allocator_fallback_preserves_retired_and_youth_identity_references(self):
        result = self.run_js(r"""
w.world.lifecycle={retired:{90000001:{id:90000001}},reserve:{clubs:{sample:{youth:[{id:90000003}]}}}};w.world.development={clubs:{sample:{academy:[{id:90000004}]}}};api.ensure();const used=w.players.map(p=>p.id);assert(!used.includes(90000001));assert(!used.includes(90000003));assert(!used.includes(90000004));assert.equal(new Set(used).size,used.length);
const guest=w.world.clubs.find(c=>c.external),old=w.players.filter(p=>p.clubId===guest.id);for(const p of old)w.world.lifecycle.retired[p.id]={...p,retired:true};const oldIds=new Set(old.map(p=>p.id));w.players=w.players.filter(p=>!oldIds.has(p.id));w.today='2026-07-01';api.onDay(w.today);const replacement=w.players.filter(p=>p.clubId===guest.id);assert.equal(replacement.length,18);assert(replacement.every(p=>!oldIds.has(p.id)&&!w.world.lifecycle.retired[p.id]));console.log(JSON.stringify({replacement:18,retired:old.length}));
""")
        self.assertEqual(result['replacement'], 18)

    def test_13_archived_continental_champions_keep_their_automatic_group_places(self):
        result = self.run_js(r"""
api.ensure();w.today='2027-01-02';const argentina=w.world.leagues.find(l=>l.country==='Argentina'&&l.tier===1),brasil=w.world.leagues.find(l=>l.country==='Brasil'&&l.tier===1),lib=argentina.clubIds.at(-1),sud=brasil.clubIds.at(-1);w.world.cups={};w.world.seasonCalendar.cupHistory=[{year:2026,LIB:{winner:lib},SUD:{winner:sud}}];const prep=api.prepareContinental(2027,null);assert(prep);const pending=api.ensure().preliminaries[2027];assert(pending.direct.includes(lib));assert(pending.direct.includes(sud));assert.equal(pending.direct.length,28);assert(!pending.sudDirect.includes(lib)&&!pending.sudNational.includes(lib));assert(!pending.sudDirect.includes(sud)&&!pending.sudNational.includes(sud));console.log(JSON.stringify({holders:2,direct:28}));
""")
        self.assertEqual(result['holders'], 2)
