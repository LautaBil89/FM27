"""Loans retain their sporting, contractual and squad history across later events."""
import unittest
import test_offer_form as fixture

class LoanContinuity(unittest.TestCase):
    setUpClass=classmethod(fixture.OfferFormScenarios.setUpClass.__func__)
    tearDownClass=classmethod(fixture.OfferFormScenarios.tearDownClass.__func__)
    setUp=fixture.OfferFormScenarios.setUp
    tearDown=fixture.OfferFormScenarios.tearDown
    seed=fixture.OfferFormScenarios.seed
    vacancy=fixture.OfferFormScenarios.vacancy

    def loan(self,mode='option'):
        self.vacancy()
        return self.page.evaluate("""mode=>{const p=player(1068088);p.contract=2029;p.contractEnd='2029-06-30';p.salario=1000;p.appearances=12;GameState.userClub.wageBudget=10000000;
          const result=MARKET_CONTRACTS.executeTransfer({id:'continuity-loan',playerId:p.id,dealType:'loan',fromClub:p.clubId,toClub:'boca',fee:1000,wage:p.salario,loanMonths:12,wageShare:50,purchaseMode:mode,purchaseFee:Math.max(10000,p.valor_mercado),purchaseAppearances:10,playingTime:'Rotación'});
          if(!result.ok)throw Error(result.reason);const registered=FM_REGISTRATION.register(p.id,'boca','domestic',{transfer:true});if(!registered.ok)throw Error(registered.reason);autoLineup();const loan=MARKET_CONTRACTS.ensure().loans.find(l=>l.playerId===p.id);window.loanCaseId=loan.id;return{id:loan.id,fee:loan.purchaseFee,owner:loan.ownerClub,end:loan.endDate};
        }""",mode)

    def test_purchase_keeps_relationship_lineup_morale_and_exact_contract(self):
        loan=self.loan()
        result=self.page.evaluate("""id=>{const p=player(1068088),room=FM_DRESSING_ROOM.ensure(),r=room.players[p.id];r.trust=67;r.minutes=321;r.adaptation=89;r.promise={status:'active',start:GameState.today,deadline:'2026-12-31',target:500,baseline:0};p.moral=73;
          const relationship=JSON.stringify(FM_DRESSING_ROOM.ensure().players[p.id]),tactics=JSON.stringify(GameState.tactics),end=p.contractEnd,cash=GameState.userClub.presupuesto_dolares,result=MARKET_CONTRACTS.purchaseLoan(id);
          return{result,relationship:relationship===JSON.stringify(FM_DRESSING_ROOM.ensure().players[p.id]),tactics:tactics===JSON.stringify(GameState.tactics),moral:p.moral,end:p.contractEnd,expectedEnd:end,spent:cash-GameState.userClub.presupuesto_dolares};
        }""",loan['id'])
        self.assertTrue(result['result']['ok'],result)
        self.assertTrue(result['relationship'],result);self.assertTrue(result['tactics'])
        self.assertEqual(result['moral'],73);self.assertEqual(result['end'],result['expectedEnd'])
        self.assertEqual(result['spent'],loan['fee'])
        self.page.reload(wait_until='domcontentloaded');self.page.wait_for_selector('aside')
        self.assertEqual(self.page.evaluate('FM_DRESSING_ROOM.ensure().players[1068088].minutes'),321)

    def test_conditional_appearances_survive_reset_and_reload(self):
        loan=self.loan('conditional')
        self.page.evaluate("""()=>{const p=player(1068088),loan=MARKET_CONTRACTS.ensure().loans.find(l=>l.playerId===p.id);delete loan.appearanceCount;delete loan.lastAppearanceCount;p.appearances+=8;MARKET_CONTRACTS.returnLoans(GameState.today);p.appearances=0;p.appearances+=4;saveGame(true)}""")
        self.page.reload(wait_until='domcontentloaded');self.page.wait_for_selector('aside')
        result=self.page.evaluate("""id=>{const loan=MARKET_CONTRACTS.ensure().loans.find(l=>l.id===id),cash=GameState.userClub.presupuesto_dolares,result=MARKET_CONTRACTS.purchaseLoan(id);return{result,spent:cash-GameState.userClub.presupuesto_dolares,count:loan.appearanceCount,status:loan.status}}""",loan['id'])
        self.assertTrue(result['result']['ok'],result)
        self.assertEqual(result['count'],12);self.assertEqual(result['spent'],loan['fee'])
        self.assertEqual(result['status'],'purchased')

    def test_annual_raise_updates_both_wage_shares_and_survives_return(self):
        loan=self.loan('none')
        result=self.page.evaluate("""id=>{const p=player(1068088),l=MARKET_CONTRACTS.ensure().loans.find(l=>l.id===id);p.contractWageEscalator={percent:10,nextDate:GameState.today};MARKET_CONTRACTS.progressContracts(GameState.today);const borrower=MARKET_CONTRACTS.loanWageFor(p,'boca'),owner=MARKET_CONTRACTS.loanWageFor(p,l.ownerClub),wage=p.salario;MARKET_CONTRACTS.returnLoans(l.endDate);return{borrower,owner,wage,returnedWage:p.salario,club:p.clubId};}""",loan['id'])
        self.assertEqual(result['wage'],1100)
        self.assertEqual(result['borrower'],550);self.assertEqual(result['owner'],550)
        self.assertEqual(result['returnedWage'],1100);self.assertEqual(result['club'],loan['owner'])

    def test_purchase_keeps_domestic_and_cup_registration_choices(self):
        loan=self.loan()
        result=self.page.evaluate("""id=>{const p=player(1068088);FM_REGISTRATION.list('boca','LIB');FM_REGISTRATION.unregister(p.id,'boca');const lib=FM_REGISTRATION.list('boca','LIB').includes(p.id),result=MARKET_CONTRACTS.purchaseLoan(id);return{result,registered:p.registered,domestic:FM_REGISTRATION.list('boca').includes(p.id),cup:FM_REGISTRATION.list('boca','LIB').includes(p.id),lib};}""",loan['id'])
        self.assertTrue(result['result']['ok'],result)
        self.assertFalse(result['registered']);self.assertFalse(result['domestic'])
        self.assertEqual(result['cup'],result['lib'])

    def test_agreed_purchase_is_not_blocked_by_parent_roster_coverage(self):
        loan=self.loan()
        self.page.evaluate("""id=>{const l=MARKET_CONTRACTS.ensure().loans.find(l=>l.id===id);squad(l.ownerClub).filter(p=>p.posicion==='POR').forEach(p=>p.clubId=null);WORLD_ENGINE.reindex()}""",loan['id'])
        result=self.page.evaluate('(id)=>MARKET_CONTRACTS.purchaseLoan(id)',loan['id'])
        self.assertTrue(result['ok'],result)

    def test_real_fixture_records_appearances_once(self):
        self.loan('conditional')
        result=self.page.evaluate("""()=>{const p=player(1068088),loan=MARKET_CONTRACTS.ensure().loans.find(l=>l.playerId===p.id);squad('boca').filter(q=>q.posicion==='POR'&&q.id!==p.id).forEach(q=>q.injury=3);const event=WORLD_CLOCK.nextFixture();GameState.today=event.date;WORLD_CLOCK.ensure().slot=WORLD_CLOCK.eventSlot(event);const before=p.appearances,played=WORLD_ENGINE.completeOne({home:1,away:0},event),count=loan.appearanceCount,again=WORLD_ENGINE.completeOne({home:1,away:0},event);return{played,again,delta:p.appearances-before,count,final:loan.appearanceCount}}""")
        self.assertTrue(result['played'],result);self.assertFalse(result['again'])
        self.assertEqual(result['delta'],1);self.assertEqual(result['count'],1)
        self.assertEqual(result['final'],1)


    def test_failed_purchase_keeps_loan_player_and_squad_unchanged(self):
        loan=self.loan()
        result=self.page.evaluate("""id=>{const p=player(1068088),loan=MARKET_CONTRACTS.ensure().loans.find(l=>l.id===id);GameState.userClub.presupuesto_dolares=0;const before={player:structuredClone(p),loan:JSON.stringify(loan),tactics:JSON.stringify(GameState.tactics),room:JSON.stringify(FM_DRESSING_ROOM.ensure())},result=MARKET_CONTRACTS.purchaseLoan(id);return{result,beforePlayer:before.player,afterPlayer:structuredClone(p),loan:before.loan===JSON.stringify(loan),tactics:before.tactics===JSON.stringify(GameState.tactics),room:before.room===JSON.stringify(FM_DRESSING_ROOM.ensure()),cash:GameState.userClub.presupuesto_dolares}}""",loan['id'])
        self.assertFalse(result['result']['ok'],result)
        self.assertEqual(result['beforePlayer'],result['afterPlayer'])
        for key in ['loan','tactics','room']:self.assertTrue(result[key],(key,result))
        self.assertEqual(result['cash'],0)


    def test_real_league_rollover_preserves_last_matches_before_reset(self):
        self.page.evaluate("GameState.today='2026-07-01'")
        loan=self.loan('conditional')
        result=self.page.evaluate("""id=>{const p=player(1068088),loan=MARKET_CONTRACTS.ensure().loans.find(l=>l.id===id),registry=FM_SEASONS.registry(),year=FM_SEASONS.leagueSeason('ARG1').year;p.appearances+=8;
          // Fixture represents closed leagues whose promotion movements were settled.
          registry.movementKeys??=[];registry.movementKeys.push('ARG:'+year);
          for(const lid of FM_SEASONS.pairedLeagues('ARG1')){const l=WORLD_ENGINE.league(lid),s=FM_SEASONS.leagueSeason(lid);s.status='completed';if(GameState.today<s.rolloverDate)GameState.today=s.rolloverDate;registry.history.push({leagueId:lid,year,ranking:[...l.clubIds],clubIds:[...l.clubIds],standings:structuredClone(l.standings),champion:l.clubIds[0]})}
          const rolled=FM_SEASONS.rollover('ARG1'),reset=p.appearances,prior=loan.appearanceCount;p.appearances+=4;const result=MARKET_CONTRACTS.purchaseLoan(id);return{rolled,reset,prior,count:loan.appearanceCount,result};
        }""",loan['id'])
        self.assertTrue(result['rolled'],result);self.assertEqual(result['reset'],0)
        self.assertEqual(result['prior'],8);self.assertEqual(result['count'],12)
        self.assertTrue(result['result']['ok'],result)


class RegistrationContinuity(unittest.TestCase):
    setUpClass=classmethod(fixture.OfferFormScenarios.setUpClass.__func__)
    tearDownClass=classmethod(fixture.OfferFormScenarios.tearDownClass.__func__)
    setUp=fixture.OfferFormScenarios.setUp
    tearDown=fixture.OfferFormScenarios.tearDown
    seed=fixture.OfferFormScenarios.seed

    def test_domestic_removal_does_not_cancel_cup_eligibility(self):
        result=self.page.evaluate("""()=>{const p=mine().find(p=>GameState.tactics.xi.includes(p.id));FM_REGISTRATION.list('boca','LIB');FM_REGISTRATION.unregister(p.id,'boca');const cup=FM_REGISTRATION.eligible(p,'boca',{type:'LIB'}),domestic=FM_REGISTRATION.eligible(p,'boca',{type:'LPF'});const next=WORLD_CLOCK.nextFixture();next.type='LIB';return{cup,domestic,available:available(p),reason:FM_TACTICS.validateLineup().issues};}""")
        self.assertTrue(result['cup']);self.assertFalse(result['domestic'])
        self.assertTrue(result['available']);self.assertFalse(any('inscrito' in s for s in result['reason']))

    def test_wrong_club_duplicates_and_unknown_ids_are_not_eligible(self):
        result=self.page.evaluate("""()=>{const p=mine()[0];FM_REGISTRATION.list('boca','LIB');p.clubId='river';const wrong=FM_REGISTRATION.eligible(p,'boca',{type:'LIB'});p.clubId='boca';return{wrong,empty:FM_REGISTRATION.eligible(null,'boca'),duplicate:FM_REGISTRATION.lineupReason([p.id,p.id]),missing:FM_REGISTRATION.lineupReason([-99999])}}""")
        self.assertFalse(result['wrong']);self.assertFalse(result['empty']);self.assertTrue(result['duplicate']);self.assertTrue(result['missing'])

    def test_register_and_unregister_are_both_blocked_during_match(self):
        result=self.page.evaluate("""()=>{const p=mine()[0];FM_REGISTRATION.unregister(p.id,'boca');GameState.match={paused:true};const before=JSON.stringify(FM_REGISTRATION.list()),added=FM_REGISTRATION.register(p.id,'boca'),removed=FM_REGISTRATION.unregister(mine()[1].id,'boca');GameState.match=null;return{added,removed,same:before===JSON.stringify(FM_REGISTRATION.list()),registered:p.registered}}""")
        self.assertFalse(result['added']['ok']);self.assertFalse(result['removed']['ok'])
        self.assertTrue(result['same']);self.assertFalse(result['registered'])
