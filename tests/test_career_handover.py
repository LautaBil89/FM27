"""A manager's new employer retains club obligations without inheriting unsigned work."""
import unittest
import test_offer_form as fixture

class CareerHandover(unittest.TestCase):
    setUpClass=classmethod(fixture.OfferFormScenarios.setUpClass.__func__)
    tearDownClass=classmethod(fixture.OfferFormScenarios.tearDownClass.__func__)
    setUp=fixture.OfferFormScenarios.setUp
    tearDown=fixture.OfferFormScenarios.tearDown
    seed=fixture.OfferFormScenarios.seed
    vacancy=fixture.OfferFormScenarios.vacancy

    def closed_review(self):
        self.page.evaluate("""()=>{const s=FM_DEPTH.ensure(),h={clubId:'boca',year:GameState.year,leagueId:'ARG1',position:3,points:60,champion:'river',cup:null,sudCup:null,objectiveMet:true,worldRankings:Object.fromEntries(GameState.world.leagues.map(l=>[l.id,[...l.clubIds]]))};GameState.history.unshift(h);GameState.finished=true;s.reviews.push({year:GameState.year,clubId:'boca',leagueId:'ARG1',position:3,success:true});s.jobs=[{clubId:'river',year:GameState.year,status:'open',objective:'Salir Campeón'}];view='career';render()}""")

    def test_real_calendar_job_starts_through_actual_buttons_without_year_change(self):
        self.closed_review()
        self.assertTrue(self.page.evaluate('FM_SEASONS.active()'))
        self.page.get_by_role('button',name='Ofertas laborales',exact=True).click()
        before=self.page.evaluate('({date:GameState.today,year:GameState.year,players:GameState.players.length})')
        self.page.click('[data-depth-job="river"]')
        self.page.click('[data-action="season"]')
        result=self.page.evaluate("""()=>({club:GameState.userClub.id,date:GameState.today,year:GameState.year,players:GameState.players.length,xi:GameState.tactics.xi.map(id=>player(id).clubId),stints:FM_DEPTH.ensure().stints,next:FM_DEPTH.ensure().nextClub})""")
        self.assertEqual(result['club'],'river');self.assertEqual(result['date'],before['date'])
        self.assertEqual(result['year'],before['year']);self.assertEqual(result['players'],before['players'])
        self.assertEqual(result['xi'],['river']*11);self.assertEqual(len(result['stints']),2)
        self.assertIsNone(result['next'])
        self.page.reload(wait_until='domcontentloaded');self.page.wait_for_selector('aside')
        self.assertEqual(self.page.evaluate('GameState.userClub.id'),'river')

    def test_handover_cancels_unsigned_work_but_preserves_signed_obligations(self):
        result=self.page.evaluate("""()=>{const s=FM_DEPTH.ensure(),p=mine().find(p=>p.edad>=24&&p.edad<30&&!p.loanId);GameState.userClub.wageBudget=10000000;
          const renewal=MARKET_CONTRACTS.renewContract(p.id,{confirmed:true,wage:p.salario+100,bonus:1000,years:4});if(!renewal.ok)throw Error(renewal.reason);
          GameState.offers.push({id:'legacy-unsigned',playerId:1068088,type:'buy',fromClub:player(1068088).clubId,fee:1,status:'pending'},{id:'unsigned-old',playerId:1068088,type:'buy',fromClub:player(1068088).clubId,toClub:'boca',fee:1000,wage:1000,status:'pending',awaitingUser:true},{id:'signed-old',playerId:1068088,type:'buy',fromClub:player(1068088).clubId,toClub:'boca',fee:1000,wage:1000,status:'pending',awaitingRegistration:true,registrationDate:'2026-07-01'});
          const contracts=MARKET_CONTRACTS.ensure();contracts.payments.push({id:'owed-old',fromClub:'boca',toClub:'river',amount:1000,dueDate:'2026-07-01',status:'pending'});
          s.reports[1068088]={status:'active',level:40,started:GameState.today,staffId:'boca-staff-1'};GameState.scouting.shortlist=[1068088];GameState.scouting.reports[1068088]={verdict:'Información del club anterior'};FM_INBOX.push({title:'Mensaje exclusivo del club anterior',body:'Historia interna.',type:'directiva'});
          const source=JSON.stringify(player(1068088).transfermarkt),cash=CLUB_AI.cash('river'),oldCash=GameState.userClub.presupuesto_dolares,ok=FM_DEPTH.switchClub('river');view='inbox';render();
          return{ok,legacy:GameState.offers.find(o=>o.id==='legacy-unsigned').status,legacyClub:GameState.offers.find(o=>o.id==='legacy-unsigned').toClub,unsigned:GameState.offers.find(o=>o.id==='unsigned-old').status,signed:GameState.offers.find(o=>o.id==='signed-old').status,renewal:FM_RENEWALS.all().find(r=>r.id===renewal.renewal?.id||r.playerId===p.id).status,payment:contracts.payments.find(r=>r.id==='owed-old').status,shortlist:GameState.scouting.shortlist,reports:s.reports,oldArchived:s.clubWork.boca.inbox.some(m=>m.title==='Mensaje exclusivo del club anterior'),leaked:GameState.inbox.some(m=>m.title==='Mensaje exclusivo del club anterior'||m.offerId==='signed-old'),archivedReport:s.clubWork.boca.reports[1068088].status,cash:GameState.userClub.presupuesto_dolares,expectedCash:cash,oldCash:CLUB_AI.cash('boca'),expectedOld:oldCash,source:source===JSON.stringify(player(1068088).transfermarkt),summary:MARKET_CONTRACTS.summary().includes('signed-old')};
        }""")
        self.assertTrue(result['ok'],result)
        self.assertEqual(result['legacy'],'cancelled');self.assertEqual(result['legacyClub'],'boca')
        self.assertEqual(result['unsigned'],'cancelled');self.assertEqual(result['renewal'],'cancelled')
        self.assertEqual(result['signed'],'pending');self.assertEqual(result['payment'],'pending')
        self.assertEqual(result['shortlist'],[]);self.assertEqual(result['reports'],{})
        self.assertTrue(result['oldArchived']);self.assertFalse(result['leaked'])
        self.assertEqual(result['archivedReport'],'cancelled')
        self.assertEqual(result['cash'],result['expectedCash']);self.assertEqual(result['oldCash'],result['expectedOld'])
        self.assertTrue(result['source']);self.assertFalse(result['summary'])

    def test_returning_to_club_restores_club_files_without_retroactive_staff_pay(self):
        result=self.page.evaluate("""()=>{GameState.scouting.shortlist=[1068088];GameState.scouting.reports[1068088]={verdict:'Archivo de Boca'};const staff=FM_OFFICE.office(),staffIds=staff.staff.map(e=>e.id);staff.payDate='2020-01-01';FM_DEPTH.switchClub('river');GameState.scouting.shortlist=[mine()[0].id];const riverList=[...GameState.scouting.shortlist];GameState.today=new Date(Date.parse(GameState.today)+60*86400000).toISOString().slice(0,10);FM_DEPTH.switchClub('boca');return{staffDue:FM_OFFICE.office().staff.reduce((n,e)=>n+FM_GOVERNANCE.staffSalaryDue(e),0),shortlist:GameState.scouting.shortlist,report:GameState.scouting.reports[1068088],staff:FM_OFFICE.office().staff.map(e=>e.id),staffIds,payDate:FM_OFFICE.office().payDate,today:GameState.today,riverList,archived:FM_DEPTH.ensure().clubWork.river.scouting.shortlist,xi:GameState.tactics.xi.map(id=>player(id).clubId)}}""")
        self.assertEqual(result['shortlist'],[1068088]);self.assertEqual(result['report']['verdict'],'Archivo de Boca')
        self.assertEqual(result['staff'],result['staffIds']);self.assertEqual(result['payDate'],result['today'])
        self.assertEqual(result['staffDue'],0,'El nuevo DT no paga retroactivamente el período bajo control de la IA')
        self.assertEqual(result['archived'],result['riverList']);self.assertEqual(result['xi'],['boca']*11)

    def test_same_year_at_two_clubs_has_two_reviews_without_duplicate_titles(self):
        self.closed_review()
        result=self.page.evaluate("""()=>{FM_DEPTH.switchClub('river');const s=FM_DEPTH.ensure();GameState.history.unshift({clubId:'river',year:2026,leagueId:'ARG1',position:1,champion:'river',objectiveMet:true,worldRankings:Object.fromEntries(GameState.world.leagues.map(l=>[l.id,l.clubIds]))});GameState.finished=true;FM_DEPTH.seasonReview();const first=s.reviews.length,honours=s.honours.length,cash=GameState.userClub.presupuesto_dolares;FM_DEPTH.seasonReview();return{first,second:s.reviews.length,honours,again:s.honours.length,cash:cash===GameState.userClub.presupuesto_dolares,clubs:s.reviews.map(r=>r.clubId)}}""")
        self.assertEqual(result['first'],2);self.assertEqual(result['second'],2)
        self.assertEqual(result['honours'],1);self.assertEqual(result['again'],1)
        self.assertTrue(result['cash']);self.assertEqual(result['clubs'],['boca','river'])

    def test_legacy_domestic_snapshot_without_phase_winners_does_not_crash(self):
        result=self.page.evaluate("""()=>{GameState.history=[{year:GameState.year,leagueId:'ARG1',position:1,champion:'boca',objectiveMet:true,domesticFormats:{ARG1:{champion:'boca'}},worldRankings:Object.fromEntries(GameState.world.leagues.map(l=>[l.id,l.clubIds]))}];GameState.finished=true;FM_DEPTH.seasonReview();return{reviews:FM_DEPTH.ensure().reviews.length,honours:FM_DEPTH.ensure().honours}}""")
        self.assertEqual(result['reviews'],1);self.assertEqual(len(result['honours']),1)

    def test_invalid_or_live_match_club_switch_leaves_career_untouched(self):
        result=self.page.evaluate("""()=>{const before=JSON.stringify({club:GameState.userClub,tactics:GameState.tactics,offers:GameState.offers,history:GameState.history}),invalid=FM_DEPTH.switchClub('missing-club');GameState.match={paused:true};const live=FM_DEPTH.switchClub('river');GameState.match=null;return{invalid,live,same:before===JSON.stringify({club:GameState.userClub,tactics:GameState.tactics,offers:GameState.offers,history:GameState.history})}}""")
        self.assertFalse(result['invalid']);self.assertFalse(result['live']);self.assertTrue(result['same'])

    def test_signed_departure_executes_after_manager_takes_over_selling_club(self):
        self.vacancy()
        result=self.page.evaluate("""()=>{const p=squad('river').filter(p=>p.edad>=18&&!WORLD_ENGINE.isForeign(p,'boca')).sort((a,b)=>a.salario-b.salario)[0];p.contractEnd=MARKET_CONTRACTS.addMonths(GameState.today,1);p.contract=Number(p.contractEnd.slice(0,4));GameState.userClub.wageBudget=10000000;
          const offer={id:'signed-before-handover',type:'buy',playerId:p.id,dealType:'permanent',fromClub:'river',toClub:'boca',precontract:true,fee:0,wage:p.salario,bonus:0,years:3,releaseClause:p.clausula_rescision,status:'pending',stage:'player'},agreed=MARKET_CONTRACTS.agreeTransfer(offer);if(!agreed.ok)throw Error(agreed.reason);
          FM_DEPTH.switchClub('river');const pending=GameState.offers.find(o=>o.id===offer.id).awaitingRegistration;GameState.today=offer.registrationDate;const count=MARKET_CONTRACTS.registerAgreements(GameState.today);return{agreed,pending,count,owner:p.clubId,status:offer.status,record:MARKET_CONTRACTS.ensure().registrations.find(r=>r.offerId===offer.id).status};}""")
        self.assertTrue(result['agreed']['ok']);self.assertTrue(result['pending'])
        self.assertEqual(result['count'],1,result);self.assertEqual(result['owner'],'boca')
        self.assertEqual(result['status'],'accepted');self.assertEqual(result['record'],'registered')

    def test_signed_former_club_deal_does_not_send_notifications_to_new_club(self):
        self.vacancy()
        result=self.page.evaluate("""()=>{const p=player(1068088);p.contractEnd=MARKET_CONTRACTS.addMonths(GameState.today,1);p.contract=Number(p.contractEnd.slice(0,4));GameState.userClub.wageBudget=10000000;const offer={id:'old-club-private',type:'buy',playerId:p.id,dealType:'permanent',fromClub:p.clubId,toClub:'boca',precontract:true,fee:0,wage:p.salario,bonus:0,years:3,releaseClause:p.clausula_rescision,status:'pending',stage:'player'},agreed=MARKET_CONTRACTS.agreeTransfer(offer);if(!agreed.ok)throw Error(agreed.reason);FM_DEPTH.switchClub('river');const before=GameState.inbox.length;GameState.today=offer.registrationDate;const count=MARKET_CONTRACTS.registerAgreements(GameState.today);return{count,owner:p.clubId,before,after:GameState.inbox.length,status:offer.status}}""")
        self.assertEqual(result['count'],1,result);self.assertEqual(result['owner'],'boca')
        self.assertEqual(result['before'],result['after']);self.assertEqual(result['status'],'accepted')

    def test_joining_finished_league_does_not_award_pre_arrival_titles(self):
        result=self.page.evaluate("""()=>{const meta=FM_SEASONS.leagueSeason('ARG1');meta.status='completed';const history=GameState.history.length;FM_DEPTH.switchClub('river');FM_DEPTH.seasonReview();return{history,after:GameState.history.length,honours:FM_DEPTH.ensure().honours.length,finished:GameState.finished,pending:FM_SEASONS.registry().pendingUserYear,expected:meta.year+1,reviewed:FM_SEASONS.registry().reviewed.includes('ARG1:'+meta.year)}}""")
        self.assertEqual(result['after'],result['history']);self.assertEqual(result['honours'],0)
        self.assertFalse(result['finished']);self.assertTrue(result['reviewed'])
        self.assertEqual(result['pending'],result['expected'])

    def test_saved_accepted_job_recovers_when_career_was_already_resumed(self):
        self.closed_review()
        result=self.page.evaluate("""()=>{FM_DEPTH.acceptJob('river');GameState.finished=false;const done=FM_DEPTH.progress(GameState.today);saveGame(true);return{done,club:GameState.userClub.id,pending:FM_DEPTH.ensure().nextClub}}""")
        self.assertTrue(result['done']);self.assertEqual(result['club'],'river');self.assertIsNone(result['pending'])
        self.page.reload(wait_until='domcontentloaded');self.page.wait_for_selector('aside')
        self.assertEqual(self.page.evaluate('GameState.userClub.id'),'river')

    def test_user_review_does_not_dismiss_manager_in_unfinished_foreign_league(self):
        self.closed_review()
        result=self.page.evaluate("""()=>{const s=FM_DEPTH.ensure();s.reviews=[];const l=WORLD_ENGINE.league('FR1'),c=club(l.clubIds.at(-1)),meta=FM_SEASONS.leagueSeason(l.id),p=FM_DEPTH.project(c.id);meta.year=GameState.year;meta.status='active';p.policy='contender';p.boardFailures=1;const manager=p.manager,appointments=p.appointments.length;FM_DEPTH.seasonReview();return{manager:p.manager,expected:manager,appointments:p.appointments.length,before:appointments,review:p.lastReview}}""")
        self.assertEqual(result['manager'],result['expected'])
        self.assertEqual(result['appointments'],result['before']);self.assertIsNone(result['review'])

    def test_signed_loan_remains_approved_after_owner_salary_anniversary(self):
        self.vacancy()
        result=self.page.evaluate("""()=>{const p=squad('river').filter(p=>p.edad>=18&&!WORLD_ENGINE.isForeign(p,'boca')).sort((a,b)=>a.salario-b.salario)[0];p.contract=2029;p.contractEnd='2029-12-31';p.salario=1000;GameState.userClub.wageBudget=10000000;const date=new Date(Date.parse(GameState.today)+86400000).toISOString().slice(0,10),offer={id:'signed-loan-anniversary',type:'buy',playerId:p.id,dealType:'loan',fromClub:'river',toClub:'boca',fee:1000,wage:1000,bonus:0,years:1,loanMonths:6,wageShare:50,purchaseMode:'none',purchaseFee:0,installments:0,upfrontPercent:100,registrationDate:date,agreedDate:GameState.today,status:'pending',awaitingRegistration:true,stage:'registration'};GameState.offers.push(offer);MARKET_CONTRACTS.ensure().registrations.push({id:'signed-loan-record',offerId:offer.id,playerId:p.id,status:'agreed',registrationDate:date,agreedDate:GameState.today,offer:structuredClone(offer)});p.contractWageEscalator={percent:10,nextDate:date};FM_DEPTH.switchClub('river');GameState.today=date;MARKET_CONTRACTS.progressContracts(date);const count=MARKET_CONTRACTS.registerAgreements(date);return{count,status:offer.status,wage:p.salario,owner:p.clubId,share:MARKET_CONTRACTS.loanWageFor(p,'boca')};}""")
        self.assertEqual(result['count'],1,result);self.assertEqual(result['status'],'accepted')
        self.assertEqual(result['wage'],1100);self.assertEqual(result['owner'],'boca');self.assertEqual(result['share'],550)
