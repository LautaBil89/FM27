"""Cross-boundary cases for persistent planning, analysis and financial decisions."""
import unittest
import test_professional_upgrade as fixture

class ProfessionalIntegration(unittest.TestCase):
    setUpClass=classmethod(fixture.ProfessionalUpgrade.setUpClass.__func__)
    tearDownClass=classmethod(fixture.ProfessionalUpgrade.tearDownClass.__func__)
    setUp=fixture.ProfessionalUpgrade.setUp
    tearDown=fixture.ProfessionalUpgrade.tearDown
    seed=fixture.ProfessionalUpgrade.seed

    def test_manager_renewal_pays_old_days_at_old_rate(self):
        r=self.page.evaluate("""()=>{const s=FM_GOVERNANCE.ensure(),c=s.activeContract;c.salary=1000;c.end=new Date(Date.parse(GameState.today)+30*86400000).toISOString().slice(0,10);s.managerPayDate=new Date(Date.parse(GameState.today)-6*86400000).toISOString().slice(0,10);const before=s.managerEarnings||0,result=FM_GOVERNANCE.renewManager(),first=s.managerEarnings-before;GameState.today=new Date(Date.parse(GameState.today)+7*86400000).toISOString().slice(0,10);FM_GOVERNANCE.careerDay(GameState.today);return{ok:result.ok,first,total:s.managerEarnings-before,salary:c.salary}}""")
        self.assertTrue(r['ok']);self.assertEqual(r['salary'],1050)
        self.assertEqual(r['first'],857);self.assertEqual(r['total'],1907)

    def test_filter_observes_attribute_change_during_same_day(self):
        r=self.page.evaluate("""()=>{const p=mine()[0],f=FM_MARKET_FILTERS.get('market');f.qualityMin=95;FM_MARKET_FILTERS.prepare();const before=FM_MARKET_FILTERS.matches(p);for(const key of ['ritmo','tiro','pase','regate','defensa','fisico'])p[key]=99;const after=FM_MARKET_FILTERS.matches(p);return{before,after}}""")
        self.assertFalse(r['before']);self.assertTrue(r['after'])

    def test_february_29_training_dates_remain_valid_after_age_twenty_one(self):
        r=self.page.evaluate("""()=>{const p=mine().find(p=>p.posicion==='MED');p.fecha_nacimiento='2008-02-29';p.birthYear=2008;p.trainingHistory=[];FM_IDENTITY.update(p,'2026-01-03');FM_IDENTITY.update(p,'2029-03-01');WORLD_STORAGE.validate(GameState);return{age:p.edad,end:p.trainingHistory[0].to,months:p.trainingHistory[0].months}}""")
        self.assertEqual(r['age'],21);self.assertEqual(r['end'],'2029-03-01');self.assertGreater(r['months'],36)

    def test_supplemental_refill_shares_the_identity_allocator(self):
        r=self.page.evaluate("""()=>{const c=GameState.world.clubs.find(c=>c.supplemental);for(const p of squad(c.id).filter(p=>p.posicion==='POR'))p.clubId=null;WORLD_ENGINE.reindex();const reserved=WORLD_ENGINE.nextPlayerId();FM_PYRAMIDS.ensureSquads();const next=WORLD_ENGINE.nextPlayerId();WORLD_STORAGE.validate(GameState);return{keepers:squad(c.id).filter(p=>p.posicion==='POR').length,reusedReserved:GameState.players.some(p=>p.id===reserved),alreadyUsed:GameState.players.some(p=>p.id===next),unique:new Set(GameState.players.map(p=>p.id)).size===GameState.players.length}}""")
        self.assertGreaterEqual(r['keepers'],2);self.assertFalse(r['reusedReserved']);self.assertFalse(r['alreadyUsed']);self.assertTrue(r['unique'])

    def test_projected_international_cup_finishes_in_a_later_four_year_cycle(self):
        r=self.page.evaluate("""()=>{const w=FM_SEASONS.windows(2030).find(w=>w.kind==='world-cup');GameState.today=w.start;const e=FM_NATIONALS.setup(w,2030);GameState.today=e.returnDate;FM_NATIONALS.onDay(GameState.today);WORLD_STORAGE.validate(GameState);return{teams:e.teams.length,fixtures:e.fixtures.length,completed:e.fixtures.filter(g=>g.result).length,winner:e.winner,stage:e.stage,adapted:e.formatNote.includes('no es el Mundial oficial')}}""")
        self.assertEqual(r['teams'],16);self.assertEqual(r['fixtures'],31);self.assertEqual(r['completed'],31);self.assertTrue(r['winner']);self.assertEqual(r['stage'],'completed');self.assertTrue(r['adapted'])

    def test_promises_require_future_progress_and_cannot_be_farmed(self):
        r=self.page.evaluate("""()=>{const p=mine()[0],zero=FM_PROJECTS.promise(p.id,'minutes',0,90),already=FM_PROJECTS.promise(p.id,'continental',1,90),valid=FM_PROJECTS.promise(p.id,'minutes',90,90);p.careerStats=[['2026','boca','LPF',1,90,0,0,0,0,7]];FM_PROJECTS.reviewPromises(GameState.today);const repeat=FM_PROJECTS.promise(p.id,'minutes',90,90);return{zero:zero.ok,already:already.ok,valid:valid.ok,status:valid.promise.status,repeat:repeat.ok}}""")
        self.assertFalse(r['zero']);self.assertFalse(r['already']);self.assertTrue(r['valid']);self.assertEqual(r['status'],'fulfilled');self.assertFalse(r['repeat'])

    def test_buyback_keeps_personal_terms_deadline_and_medical_review(self):
        r=self.page.evaluate("""()=>{const p=player(1068088),s=FM_AGENTS.ensure();s.conditions.push({id:'recompra-qa',kind:'buyback',playerId:p.id,payer:p.clubId,recipient:'boca',amount:1000,threshold:1,status:'active',start:GameState.today,expires:'2028-01-01'});const r=FM_AGENTS.buyback('recompra-qa');return{ok:r.ok,reason:r.reason,stage:r.offer?.stage,personal:r.offer?.awaitingPlayerTerms,medical:r.offer?.requiresMedical,deadline:r.offer?.personalDeadline,owner:p.clubId}}""")
        self.assertTrue(r['ok'],r);self.assertEqual(r['stage'],'player');self.assertTrue(r['personal']);self.assertTrue(r['medical']);self.assertTrue(r['deadline']);self.assertNotEqual(r['owner'],'boca')

    def test_completed_medical_investment_improves_recovery(self):
        r=self.page.evaluate("""()=>{GameState.userClub.presupuesto_dolares=100000000;const paid=FM_PROJECTS.startProject('medical'),cash=GameState.userClub.presupuesto_dolares;GameState.today=paid.project.due;FM_PROJECTS.onDay(GameState.today);const p=mine().find(p=>!p.injury),m=FM_MEDICINE.state(p);m.lastDay=GameState.today;m.tissueFatigue=30;m.work=[];p.condicion_fisica=40;const baseline=structuredClone(m),day=new Date(Date.parse(GameState.today)+86400000).toISOString().slice(0,10);paid.project.status='active';FM_MEDICINE.recoverPlayer(p,day);const without=p.condicion_fisica;GameState.world.medicine.players[p.id]=baseline;p.condicion_fisica=40;paid.project.status='completed';FM_MEDICINE.recoverPlayer(p,day);return{ok:paid.ok,without,with:p.condicion_fisica,costOnce:GameState.userClub.presupuesto_dolares===cash,support:FM_PROJECTS.medicalSupport('boca')}}""")
        self.assertTrue(r['ok']);self.assertTrue(r['costOnce']);self.assertGreater(r['with'],r['without']);self.assertEqual(r['support'],.03)

    def test_preseason_refills_use_current_calendar_age_before_next_day(self):
        r=self.page.evaluate("""()=>{GameState.today='2027-07-01';const c=GameState.world.clubs.find(c=>c.leagueId==='GB1'),ids=new Set(GameState.players.map(p=>p.id));for(const p of squad(c.id).filter(p=>p.posicion==='POR'))p.clubId=null;WORLD_ENGINE.reindex();WORLD_ENGINE.refillLeague('GB1');const generated=GameState.players.filter(p=>!ids.has(p.id));WORLD_STORAGE.validate(GameState);return{count:generated.length,ages:generated.every(p=>p.edad===FM_IDENTITY.age(p,GameState.today)),unique:new Set(GameState.players.map(p=>p.id)).size===GameState.players.length}}""")
        self.assertGreater(r['count'],0);self.assertTrue(r['ages']);self.assertTrue(r['unique'])

    def test_unavailable_recovery_archive_does_not_resurrect_deleted_career(self):
        r=self.page.evaluate("""async()=>{await FM_CAREERS.saveCurrent();const id=GameState.careerId;FM_INTEGRITY.removeCareer=async()=>{throw Error('Archivo de recuperación bloqueado')};const removed=await FM_CAREERS.remove(id,false);return{removed,noActive:GameState===null,primary:localStorage.getItem(KEY),count:(await FM_CAREERS.list()).length,notice:FM_CAREERS.ui.notice}}""")
        self.assertTrue(r['removed']);self.assertTrue(r['noActive']);self.assertIsNone(r['primary']);self.assertEqual(r['count'],0);self.assertIn('recuperación',r['notice'])

    def test_ai_reviews_registration_and_departures_in_open_window(self):
        r=self.page.evaluate("""()=>{GameState.today='2026-01-25';const id='river',rows=FM_REGISTRATION.list(id),p=squad(id).find(p=>p.nacionalidad==='Argentina');FM_REGISTRATION.unregister(p.id,id);delete GameState.world.registration.clubs[id].reviewSignature;const before=FM_REGISTRATION.eligible(p,id),changed=FM_REGISTRATION.reviewAI(id);return{before,changed,after:FM_REGISTRATION.eligible(p,id),listed:FM_REGISTRATION.list(id).includes(p.id)}}""")
        self.assertFalse(r['before']);self.assertTrue(r['changed']);self.assertTrue(r['after']);self.assertTrue(r['listed'])

    def test_delete_removes_career_payload_metadata_and_checkpoints(self):
        r=self.page.evaluate("""async()=>{await FM_CAREERS.saveCurrent();const id=GameState.careerId;await FM_INTEGRITY.checkpoint('Eliminar con carrera');const before=(await FM_INTEGRITY.list()).length;await FM_CAREERS.remove(id,false);const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('fm27-career-checkpoints');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});const sizes=await Promise.all(['checkpoints','metadata'].map(name=>new Promise((resolve,reject)=>{const r=db.transaction(name).objectStore(name).getAll();r.onsuccess=()=>resolve(r.result.filter(row=>row.careerId===id).length);r.onerror=()=>reject(r.error)})));return{before,sizes,careers:(await FM_CAREERS.list()).length,noActive:GameState===null}}""")
        self.assertGreater(r['before'],0);self.assertEqual(r['sizes'],[0,0]);self.assertEqual(r['careers'],0);self.assertTrue(r['noActive'])

    def test_analysis_uses_recorded_actions_and_routine_keeps_responsibilities(self):
        r=self.page.evaluate("""()=>{const ids=mine().filter(p=>p.posicion!=='POR').map(p=>p.id),report={userSide:0,chains:[{side:0,supplierId:ids[0],xg:.25,actions:[{side:0,type:'pase',success:true,playerId:ids[0],receiverId:ids[1],from:{x:50,y:70},to:{x:50,y:30}},{side:1,type:'pase',success:true},{side:0,type:'intercepción',success:true}]}]},m=FM_ANALYSIS.metrics(report,0);FM_TACTICS.ensure();GameState.tactics.setPieces.cornerTaker=ids[0];GameState.tactics.setPieces.nearPost=ids[1];const saved=FM_ANALYSIS.saveRoutine('Primer palo con apoyo');GameState.tactics.setPieces.cornerTaker=ids[2];const row=FM_ANALYSIS.ensure().routines.boca[0],loaded=FM_ANALYSIS.loadRoutine(row.id),kept=GameState.tactics.setPieces.cornerTaker===ids[0];player(ids[0]).clubId=null;WORLD_ENGINE.reindex();const departed=FM_ANALYSIS.loadRoutine(row.id);return{passes:m.passes,xa:m.xa,threat:m.threat,ratio:m.passesPerDefensiveAction,zones:m.zones.reduce((a,b)=>a+b),saved:saved.ok,loaded:loaded.ok,kept,departed:departed.ok}}""")
        self.assertEqual(r['passes'],1);self.assertEqual(r['xa'][0][1],.25);self.assertGreater(r['threat'],0);self.assertEqual(r['ratio'],1);self.assertEqual(r['zones'],1)
        self.assertTrue(r['saved']);self.assertTrue(r['loaded']);self.assertTrue(r['kept']);self.assertFalse(r['departed'])

    def test_route_scout_records_a_played_quick_match_once(self):
        r=self.page.evaluate("""()=>{const staff=FM_OFFICE.office().staff.find(e=>e.role==='Ojeador'),route=FM_PROGRAMMES.route(staff.id,'España',4);const e=GameState.calendar.find(e=>!e.done&&e.type==='LPF'&&e.leagueId==='ES1'&&e.date>=FM_PROGRAMMES.ensure().routes[staff.id].arrives),g=structuredClone(e.games[0]);GameState.today=e.date;const pid=aiXI(g.home)[0],p=player(pid),report={status:'active',started:FM_PROGRAMMES.ensure().routes[staff.id].start,level:40,staffId:staff.id,staffName:staff.name};FM_DEPTH.ensure().reports[pid]=report;delete g.quickStatsRecorded;delete g.statisticsRecorded;WORLD_ENGINE.simulatedStats(g,{home:1,away:0},e);const d=FM_SCOUT_NETWORK.dossier(p),before=d.matches.length;WORLD_ENGINE.simulatedStats(g,{home:1,away:0},e);return{route:route.ok,before,after:d.matches.length,sample:d.observations.at(-1).matchSample,minutes:d.matches[0].minutes}}""")
        self.assertTrue(r['route']);self.assertEqual(r['before'],1);self.assertEqual(r['after'],1);self.assertEqual(r['sample'],1);self.assertGreater(r['minutes'],0)

    def test_route_charges_exact_weeks_and_agency_relationship_affects_terms(self):
        r=self.page.evaluate("""()=>{const e=FM_OFFICE.office().staff.find(e=>e.role==='Ojeador'),q=FM_PROGRAMMES.routeQuote('Argentina'),before=GameState.userClub.presupuesto_dolares;FM_PROGRAMMES.route(e.id,'Argentina',1);const route=FM_PROGRAMMES.ensure().routes[e.id];GameState.today=route.end;FM_PROGRAMMES.onDay(GameState.today);const charged=before-GameState.userClub.presupuesto_dolares,p=mine()[0],a=FM_AGENTS.agency(p);a.relationship=10;const difficult=MARKET_CONTRACTS.negotiationProfile(p);a.relationship=90;const trusted=MARKET_CONTRACTS.negotiationProfile(p);return{charged,expected:q.cost+q.weekly,difficult,trusted}}""")
        self.assertEqual(r['charged'],r['expected']);self.assertGreater(r['difficult']['wage'],r['trusted']['wage']);self.assertLess(r['difficult']['patience'],r['trusted']['patience'])

    def test_club_bonus_is_accepted_before_personal_terms_and_cannot_be_changed_afterward(self):
        r=self.page.evaluate("""()=>{const p=player(1068088);GameState.userClub.wageBudget=10000000;const raw={stage:'club',type:'buy',playerId:p.id,toClub:'boca',dealType:'permanent',fee:100000,wage:100,years:3,appearanceMilestone:10,appearanceMilestoneAmount:1000},r=MARKET_CONTRACTS.submitOffer(raw);if(!r.ok)throw Error(r.reason);const o=r.offer,credit=FM_AGENTS.clubCredit(o,p);Object.assign(o,{stage:'player',clubAccepted:true,awaitingPlayerTerms:true,awaitingUser:true});const proposed=MARKET_CONTRACTS.submitPlayerTerms(o.id,{wage:10000,years:3,bonus:0,releaseClause:p.clausula_rescision,playingTime:'Rotación',appearanceMilestoneAmount:1});return{ok:proposed.ok,reason:proposed.reason,credit,clause:o.contingencies[0]}}""")
        self.assertTrue(r['ok'],r);self.assertGreater(r['credit'],0);self.assertEqual(r['clause']['amount'],1000)

    def test_press_review_uses_results_after_announcement(self):
        r=self.page.evaluate("""()=>{FM_PROJECTS.onDay(GameState.today);const p=FM_PROJECTS.ensure().press.find(p=>p.status==='open');club('boca').form=['G','G','G','G','G'];FM_PROJECTS.answerPress(p.id,'ambitious');const afterAnswer=GameState.userClub.confianza_directiva;GameState.calendar.push({id:'press-evidence',date:p.answered,type:'CUP',done:true,games:[{home:'boca',away:'river',result:{home:0,away:1}}]});GameState.today=p.followup;FM_PROJECTS.onDay(GameState.today);return{reviewed:p.reviewed,delta:GameState.userClub.confianza_directiva-afterAnswer}}""")
        self.assertTrue(r['reviewed']);self.assertEqual(r['delta'],-3)

if __name__=='__main__':unittest.main(verbosity=2)
