"""Transfers and registration remain independent at ownership capacity boundaries."""
import unittest
import test_offer_form as fixture


class SquadOwnership(unittest.TestCase):
    setUpClass=classmethod(fixture.OfferFormScenarios.setUpClass.__func__)
    tearDownClass=classmethod(fixture.OfferFormScenarios.tearDownClass.__func__)
    setUp=fixture.OfferFormScenarios.setUp
    tearDown=fixture.OfferFormScenarios.tearDown
    seed=fixture.OfferFormScenarios.seed

    def test_foreign_signing_stays_unregistered_and_can_be_registered_after_freeing_a_slot(self):
        result=self.page.evaluate("""()=>{
          CLUB_AI.ensure();MARKET_CONTRACTS.ensure();
          GameState.userClub.wageBudget=10000000;
          const id=GameState.userClub.id,initial=mine().length;
          const p=GameState.players.find(p=>p.clubId&&p.clubId!==id&&WORLD_ENGINE.isForeign(p,id)&&!p.loanId&&CLUB_AI.canRelease(p).ok);
          const old=FM_REGISTRATION.list(id).slice(),blocked=FM_REGISTRATION.canRegister(p,id);
          const moved=MARKET_CONTRACTS.executeTransfer({id:'ownership-test',playerId:p.id,fromClub:p.clubId,toClub:id,fee:0,wage:100,years:2});
          if(!moved.ok)throw Error(moved.reason);
          const before={registered:p.registered,eligible:FM_REGISTRATION.eligible(p,id),listed:FM_REGISTRATION.list(id).includes(p.id),xi:GameState.tactics.xi.includes(p.id)};
          const failed=FM_REGISTRATION.register(p.id);
          FM_REGISTRATION.unregister(old.find(pid=>WORLD_ENGINE.isForeign(player(pid),id)),id);
          const added=FM_REGISTRATION.register(p.id);
          saveGame(true);
          return {initial,count:mine().length,blocked,moved:moved.ok,before,failed,added,pid:p.id,eligible:FM_REGISTRATION.eligible(p,id)};
        }""")
        self.assertTrue(result['moved']);self.assertEqual(result['count'],result['initial']+1)
        self.assertFalse(result['blocked']['ok']);self.assertFalse(result['failed']['ok'])
        self.assertEqual(result['before'],dict(registered=False,eligible=False,listed=False,xi=False))
        self.assertTrue(result['added']['ok']);self.assertTrue(result['eligible'])
        self.page.reload(wait_until='domcontentloaded',timeout=60000);self.page.wait_for_selector('aside',timeout=30000)
        self.assertTrue(self.page.evaluate('(id)=>FM_REGISTRATION.eligible(player(id),"boca")',result['pid']))

    def test_fortieth_transfer_succeeds_forty_first_is_atomic_and_pending_slots_count(self):
        result=self.page.evaluate("""()=>{
          CLUB_AI.ensure();MARKET_CONTRACTS.ensure();GameState.userClub.wageBudget=10000000;
          const free=GameState.players.filter(p=>p.clubId!=='boca'&&!p.loanId);for(const p of free.slice(0,12))p.clubId=null;
          for(const p of free.splice(0,39-mine().length)){p.clubId='boca';p.registered=false}
          WORLD_ENGINE.reindex();
          const a=free[0],b=free[1];
          const pending={id:'capacity-reserved',status:'pending',type:'buy',playerId:a.id,toClub:'boca'};
          GameState.offers.push(pending);const reserved=CLUB_AI.canReceive(b,'boca',100);
          GameState.offers=GameState.offers.filter(o=>o.id!==pending.id);
          const offer=p=>({id:'capacity-'+p.id,playerId:p.id,fromClub:null,toClub:'boca',fee:0,wage:100,years:2});
          const last=MARKET_CONTRACTS.executeTransfer(offer(a)),before=GameState.userClub.presupuesto_dolares;
          const overflow=MARKET_CONTRACTS.executeTransfer(offer(b));
          return {reserved,last:last.ok,overflow,count:mine().length,untouched:b.clubId===null,cashSame:before===GameState.userClub.presupuesto_dolares};
        }""")
        self.assertFalse(result['reserved']['ok']);self.assertTrue(result['last'])
        self.assertFalse(result['overflow']['ok']);self.assertIn('40',result['overflow']['reason'])
        self.assertEqual(result['count'],40);self.assertTrue(result['untouched']);self.assertTrue(result['cashSame'])

    def test_international_intake_quota_is_consumed_by_registration_not_ownership(self):
        result=self.page.evaluate("""()=>{
          const id=GameState.world.clubs.find(c=>c.country==='Italia').id;
          GameState.userClub.id=id;
          for(const pid of FM_REGISTRATION.list(id).slice())FM_REGISTRATION.unregister(pid,id);
          const candidates=GameState.players.filter(p=>p.edad>=23&&p.clubId&&club(p.clubId)?.country==='Argentina'&&p.nationalities?.length===1&&p.nationalities[0]==='Argentina').slice(0,3);
          const results=[];
          for(const p of candidates){const from=p.clubId;p.clubId=id;WORLD_ENGINE.reindex();FM_REGISTRATION.onTransfer(p,from,id);results.push(FM_REGISTRATION.register(p.id,id,'domestic',{transfer:true}))}
          return {results,owned:candidates.every(p=>p.clubId===id),registered:candidates.map(p=>p.registered)};
        }""")
        self.assertEqual(len(result['results']),3)
        self.assertTrue(result['results'][0]['ok']);self.assertTrue(result['results'][1]['ok'])
        self.assertFalse(result['results'][2]['ok']);self.assertIn('extracomunitarias',result['results'][2]['reason'])
        self.assertTrue(result['owned']);self.assertEqual(result['registered'],[True,True,False])

if __name__=='__main__':unittest.main()
