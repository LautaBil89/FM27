"""Exercise actual AI policy over a year without simulating unrelated competitions."""
from pathlib import Path
import shutil
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[1]
HARNESS = r'''
const vm=require('vm'),fs=require('fs'),assert=require('assert');
const scenario=process.argv[3];
function world(listed=false){
  const clubs=['ours','buyer-a','buyer-b','buyer-c'].map(id=>({id,nombre:id,country:'Argentina',rating:70,reputation:70,budget:1e8,wageBudget:1e6}));
  let id=1;const players=[];
  for(const c of clubs)for(const [position,count]of Object.entries(c.id==='ours'?{POR:3,DEF:7,MED:7,DEL:7}:{POR:2,DEF:6,MED:7,DEL:7}))for(let n=0;n<count;n++)players.push({id:id++,clubId:c.id,nombre:c.id+' '+position+' '+n,posicion:position,edad:26,nacionalidad:'Argentina',valor_mercado:10000,salario:100,clausula_rescision:100000,contract:2028,contractEnd:'2028-12-31',registered:true,moral:70,quality:c.id==='ours'?70:60});
  const state={worldVersion:1,today:'2026-01-01',year:2026,eventIndex:0,userClub:{...clubs[0],presupuesto_dolares:1e8,reputacion:70},world:{clubs,cups:{}},players,offers:[],transferListed:listed?players.filter(p=>p.clubId==='ours').map(p=>p.id):[]};
  const ctx={GameState:state,console,document:{addEventListener(){}},messages:[],render(){},nextSeason(){},actions:{},saveGame(){},toast(){},news(){},autoLineup(){},locked:()=>false,money:n=>String(n),date:s=>s,foreigners:()=>0,overall:p=>p.quality,WORLD_ENGINE:{isForeign:()=>false,foreignLimit:()=>32,reindex(){}},FM_OFFICE:{office:()=>({loanListed:[]}),isLoanListed:()=>false},MANAGEMENT:{addMessage(...args){ctx.messages.push(args)},transaction(){}}};
  ctx.window=ctx;ctx.squad=id=>ctx.GameState.players.filter(p=>p.clubId===id);ctx.mine=()=>ctx.squad(ctx.GameState.userClub.id);ctx.player=id=>ctx.GameState.players.find(p=>p.id===Number(id));ctx.club=id=>ctx.GameState.world.clubs.find(c=>c.id===id);
  vm.createContext(ctx);vm.runInContext(fs.readFileSync(process.argv[1],'utf8'),ctx);vm.runInContext(fs.readFileSync(process.argv[2],'utf8'),ctx);return ctx;
}
const day=(n)=>new Date(Date.parse('2026-01-01T12:00:00Z')+n*86400000).toISOString().slice(0,10);
function contacts(listed){const c=world(listed),rows=[];for(let d=0;d<365;d++){c.GameState.today=day(d);const before=c.GameState.offers.length;c.CLUB_AI.makeSaleOffers(day(d));const after=c.GameState.offers.length;c.CLUB_AI.makeSaleOffers(day(d));assert.equal(c.GameState.offers.length,after,'four daily turns must not reroll contact');if(after>before){const o=c.GameState.offers[0];rows.push({date:day(d),id:o.playerId,unsolicited:o.unsolicited});assert.equal(o.fromClub,'ours');assert.equal(o.rivals.length,0,'potential candidates are not firm rival bids');o.status='rejected'}if(d===180)c.GameState=JSON.parse(JSON.stringify(c.GameState))}return {c,rows}}
if(scenario==='cadence'){
  const unlisted=contacts(false),listed=contacts(true);assert(unlisted.rows.length>=4&&unlisted.rows.length<=22,JSON.stringify(unlisted.rows));assert(listed.rows.length>unlisted.rows.length,JSON.stringify({u:unlisted.rows.length,l:listed.rows.length}));
  for(const {rows}of[unlisted,listed])for(let i=0;i<rows.length;i++){const recent=rows.filter(r=>Date.parse(r.date)<=Date.parse(rows[i].date)&&Date.parse(r.date)>Date.parse(rows[i].date)-30*86400000);assert(recent.length<=3);assert(recent.filter(r=>r.unsolicited).length<=2);if(i)assert(Date.parse(rows[i].date)-Date.parse(rows[i-1].date)>=(rows[i].unsolicited?10:6)*86400000);for(const old of rows.slice(0,i).filter(r=>r.id===rows[i].id))assert(Date.parse(rows[i].date)-Date.parse(old.date)>=45*86400000)}
  assert(unlisted.c.GameState.world.ai.salesActivity.ours.lastChecked==='2026-12-31');assert.equal(listed.c.GameState.world.ai.competition.length,0);console.log(JSON.stringify({unlisted:unlisted.rows.length,listed:listed.rows.length}));
}
if(scenario==='pending-and-migration'){
  const c=world(true);c.GameState.offers=[0,1,2].map(n=>({id:'old-'+n,playerId:n+1,type:'sell',fromClub:'ours',toClub:'buyer-a',status:'pending',createdDate:day(0)}));for(let d=0;d<30;d++){c.GameState.today=day(d);c.CLUB_AI.makeSaleOffers(day(d));assert.equal(c.GameState.offers.length,3)}
  c.GameState.offers.forEach(o=>o.status='rejected');c.GameState.world.ai.salesActivity={};c.GameState.today=day(5);c.CLUB_AI.makeSaleOffers(day(5));assert.equal(c.GameState.world.ai.salesActivity.ours.contacts.length,3,'upgrade must remember recent existing proposals');assert.equal(c.GameState.offers.length,3);
}
if(scenario==='rivals'){
  const c=world(),p=c.mine()[5];let created=0,negative=null;for(let n=0;n<1000;n++){c.FM_DEPTH.ensure().rivalBids=[];const offer={id:'sample-'+n,playerId:p.id,fromClub:p.clubId,toClub:'ours',fee:10000,createdDate:day(0),dealType:'permanent'};if(c.FM_DEPTH.inviteRival(p,offer))created++;else negative=offer;assert.equal(c.FM_DEPTH.inviteRival(p,offer),null,'one check per negotiation, even on a negative result')}
  assert(created>=60&&created<=150,'ordinary negotiations should have occasional competition: '+created);c.GameState.offers=[negative];c.FM_DEPTH.ensure().rivalBids=[];c.GameState=JSON.parse(JSON.stringify(c.GameState));let calls=0;c.CLUB_AI.interestFor=()=>{calls++;throw Error('negative rival roll repeated')};assert.equal(c.FM_DEPTH.inviteRival(c.player(p.id),c.GameState.offers[0]),null);assert.equal(calls,0);assert(c.GameState.offers[0].rivalCheckedAt);
  console.log(JSON.stringify({rivalBids:created,total:1000}));
}
if(scenario==='confirmed-only'){
  const c=world(),p=c.mine()[5],offer={toClub:'buyer-a',playingTime:'Rotación'};p.salario=1000;c.CLUB_AI.ensure();const original=c.FM_DEPTH.personal(p,offer).wage;
  c.GameState.world.ai.competition.push({date:day(0),playerId:p.id,bidders:['buyer-b','buyer-c'],winner:'buyer-b'});assert.equal(c.FM_DEPTH.personal(p,offer).wage,original,'historic completed battles must not count as a live offer');
  c.FM_DEPTH.ensure().rivalBids.push({playerId:p.id,fromClub:p.clubId,toClub:'buyer-b',status:'open',expires:day(10)});assert.equal(c.FM_DEPTH.rivalOffers(p,offer).length,1);assert(c.FM_DEPTH.personal(p,offer).wage>original);
  p.clubId='buyer-c';assert.equal(c.FM_DEPTH.rivalOffers(p,offer).length,0,'rival proposal must end when ownership changes');
}
'''


@unittest.skipUnless(shutil.which('node'), 'Node is required')
class MarketFrequency(unittest.TestCase):
    def run_case(self, scenario):
        result = subprocess.run(['node', '-e', HARNESS, str(ROOT / 'src/club-ai.js'), str(ROOT / 'src/football-depth.js'), scenario], capture_output=True, text=True, timeout=45)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_yearly_contact_volume_spacing_cooldowns_and_reload(self):
        self.run_case('cadence')

    def test_pending_limit_and_existing_career_history_are_respected(self):
        self.run_case('pending-and-migration')

    def test_rival_bids_are_occasional_and_negative_rolls_persist(self):
        self.run_case('rivals')

    def test_only_current_firm_rival_proposals_affect_player_demands(self):
        self.run_case('confirmed-only')


if __name__ == '__main__':
    unittest.main()
