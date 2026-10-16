#!/usr/bin/env python3
"""Browser checks for persisted staff opinions, uncertain development and honest provenance."""
import os
from pathlib import Path
import unittest

try:
    from tests import test_football_depth as browser_support
except ModuleNotFoundError:
    import test_football_depth as browser_support

ROOT=Path(__file__).resolve().parents[1]


class ScoutingUncertainty(unittest.TestCase):
    setUpClass=classmethod(browser_support.FootballDepth.setUpClass.__func__)
    tearDownClass=classmethod(browser_support.FootballDepth.tearDownClass.__func__)
    tearDown=browser_support.FootballDepth.tearDown
    career=browser_support.FootballDepth.career

    def setUp(self):
        browser_support.FootballDepth.setUp(self)
        # Also permits this focused suite before the root agent embeds the sources.
        if not self.page.evaluate('Boolean(window.FM_SCOUT_NETWORK)'):
            for name in ['club-ai.js','football-depth.js','scouting-network.js']:
                self.page.add_script_tag(content=(ROOT/'src'/name).read_text())
        self.career()

    def complete(self):
        return self.page.evaluate('''()=>{const p=player(1068088),cash=GameState.userClub.presupuesto_dolares,ok=FM_DEPTH.scout(p.id),r=FM_DEPTH.ensure().reports[p.id];GameState.today=new Date(Date.parse(r.started)+r.duration*86400000).toISOString().slice(0,10);FM_DEPTH.progress(GameState.today);return {ok,cost:cash-GameState.userClub.presupuesto_dolares,knowledge:FM_DEPTH.knowledge(p),quality:FM_SCOUT_NETWORK.assessment(p),potential:FM_SCOUT_NETWORK.assessment(p,{kind:'potential'}),staff:r.staffId,duration:r.duration}}''')

    def test_01_complete_coverage_is_not_perfect_confidence_or_potential(self):
        r=self.complete()
        self.assertTrue(r['ok']);self.assertEqual(r['cost'],1500)
        self.assertEqual(r['knowledge']['level'],100)
        self.assertLess(r['knowledge']['confidence'],100)
        self.assertLess(r['quality']['low'],r['quality']['high'])
        self.assertLess(r['potential']['low'],r['potential']['high'])
        self.assertGreaterEqual(r['potential']['high']-r['potential']['low'],5)

    def test_02_two_staff_can_disagree_and_repeated_same_staff_is_not_charged(self):
        self.complete()
        r=self.page.evaluate('''()=>{const p=player(1068088),o=FM_OFFICE.office(),first=FM_DEPTH.ensure().reports[p.id].staffId,cash=GameState.userClub.presupuesto_dolares;o.scoutChoice=first;const duplicate=FM_DEPTH.scout(p.id),charged=cash-GameState.userClub.presupuesto_dolares;const second=o.staff.find(e=>e.role==='Ojeador'&&e.id!==first);o.scoutChoice=second.id;const accepted=FM_DEPTH.scout(p.id),report=FM_DEPTH.ensure().reports[p.id];GameState.today=new Date(Date.parse(report.started)+report.duration*86400000).toISOString().slice(0,10);FM_DEPTH.progress(GameState.today);const opinions=FM_SCOUT_NETWORK.dossier(p).observations.filter(o=>o.coverage===100);return {duplicate,charged,accepted,opinions,html:FM_SCOUT_NETWORK.reportHTML(p)}}''')
        self.assertFalse(r['duplicate']);self.assertEqual(r['charged'],0);self.assertTrue(r['accepted'])
        self.assertEqual(len(r['opinions']),2)
        self.assertNotEqual(r['opinions'][0]['staff']['id'],r['opinions'][1]['staff']['id'])
        self.assertNotEqual(r['opinions'][0]['confidence'],r['opinions'][1]['confidence'])
        self.assertIn('opiniones',r['html'].lower())

    def test_03_staff_ability_and_regional_knowledge_change_confidence(self):
        r=self.page.evaluate('''()=>{const p=player(1068088),staff=FM_OFFICE.office().staff.filter(e=>e.role==='Ojeador');staff[0].ability=95;staff[0].region=club(p.clubId).country;staff[1].ability=35;staff[1].region='País sin conocimiento';const strong=FM_SCOUT_NETWORK.capture(p,{staffId:staff[0].id,level:100}),weak=FM_SCOUT_NETWORK.capture(p,{staffId:staff[1].id,level:100});return {strong,weak}}''')
        self.assertGreater(r['strong']['confidence'],r['weak']['confidence'])
        self.assertLess(r['strong']['spread'],r['weak']['spread'])
        self.assertLess(r['strong']['potentialSpread'],r['weak']['potentialSpread'])

    def test_04_true_potential_never_changes_a_public_or_owned_estimate(self):
        self.complete()
        r=self.page.evaluate('''()=>{const p=player(1068088),q=mine()[0],out={};for(const x of [p,q]){x.potential=99;const high=FM_DEPTH.potentialRange(x),score=FM_DEPTH.projectScore(x,x.clubId);x.potential=1;out[x.id]={high,low:FM_DEPTH.potentialRange(x),score,after:FM_DEPTH.projectScore(x,x.clubId),compat:FM_DEPTH.range(x,x.potential)}}return out}''')
        for item in r.values():
            self.assertEqual(item['high'],item['low'])
            self.assertEqual(item['score'],item['after'])
            self.assertEqual(item['low'],item['compat'])
            self.assertIn('–',item['low'])

    def test_05_observations_are_stable_across_render_and_reload(self):
        self.complete()
        before=self.page.evaluate('''()=>{const p=player(1068088),value=JSON.stringify(FM_SCOUT_NETWORK.dossier(p));for(let n=0;n<4;n++)render();saveGame(true);return {value,quality:FM_DEPTH.range(p),potential:FM_DEPTH.potentialRange(p)}}''')
        self.page.reload(wait_until='domcontentloaded');self.page.wait_for_selector('aside')
        # When running against a not-yet-rebuilt index, reinstall the dynamic module.
        if not self.page.evaluate('Boolean(window.FM_SCOUT_NETWORK)'):
            for name in ['club-ai.js','football-depth.js','scouting-network.js']:
                self.page.add_script_tag(content=(ROOT/'src'/name).read_text())
        after=self.page.evaluate('''()=>{const p=player(1068088);return {value:JSON.stringify(FM_SCOUT_NETWORK.dossier(p)),quality:FM_DEPTH.range(p),potential:FM_DEPTH.potentialRange(p)}}''')
        self.assertEqual(before,after)

    def test_06_legacy_quality_snapshot_is_preserved_but_potential_is_not_exact(self):
        r=self.page.evaluate('''()=>{const p=player(1068088);FM_DEPTH.ensure().reports[p.id]={level:100,completed:true,status:'complete',updated:GameState.today};GameState.scouting.reports[p.id]={date:GameState.today,rating:String(overall(p))};return {quality:FM_DEPTH.range(p),actual:Math.round(overall(p)),potential:FM_DEPTH.potentialRange(p),legacy:FM_DEPTH.knowledge(p).legacy}}''')
        self.assertTrue(r['legacy']);self.assertEqual(r['quality'],str(r['actual']))
        self.assertIn('–',r['potential'])

    def test_07_stale_reports_have_wider_intervals_and_lower_confidence(self):
        self.complete()
        r=self.page.evaluate('''()=>{const p=player(1068088),before=FM_SCOUT_NETWORK.assessment(p);GameState.today=new Date(Date.parse(GameState.today)+100*86400000).toISOString().slice(0,10);return {before,after:FM_SCOUT_NETWORK.assessment(p),knowledge:FM_DEPTH.knowledge(p)}}''')
        self.assertLess(r['after']['confidence'],r['before']['confidence'])
        self.assertGreater(r['after']['high']-r['after']['low'],r['before']['high']-r['before']['low'])
        self.assertLess(r['knowledge']['level'],100)

    def test_08_match_evidence_requires_a_finished_match_and_is_counted_once(self):
        r=self.page.evaluate('''()=>{const p=player(1068088);FM_DEPTH.scout(p.id);const m={id:'scout-evidence',date:GameState.today,minute:90,lineups:[[mine()[0].id],[p.id]],done:false};const premature=FM_SCOUT_NETWORK.observeMatch(m),before=FM_SCOUT_NETWORK.dossier(p).matches.length;m.done=true;const finished=FM_SCOUT_NETWORK.observeMatch(m),duplicate=FM_SCOUT_NETWORK.observeMatch(m),count=FM_SCOUT_NETWORK.dossier(p).matches.length;m.id='scout-evidence-2';FM_SCOUT_NETWORK.observeMatch(m);return {premature,before,finished,duplicate,count,risks:FM_SCOUT_NETWORK.risks(p)}}''')
        self.assertFalse(r['premature']);self.assertEqual(r['before'],0)
        self.assertTrue(r['finished']);self.assertFalse(r['duplicate']);self.assertEqual(r['count'],1)
        self.assertIn('2 partidos',r['risks'][1]['text'])

    def test_09_provenance_separates_published_identity_and_simulated_salary(self):
        r=self.page.evaluate('''()=>{const p=player(1068088),reference=JSON.stringify(p.transfermarkt),html=FM_SCOUT_NETWORK.sourceHTML(p);return {reference,after:JSON.stringify(p.transfermarkt),html}}''')
        self.assertEqual(r['reference'],r['after'])
        for text in ['Identidad publicada','salario','No son valoraciones oficiales','no se actualiza en vivo','consulta','Fecha de tasación']:
            self.assertIn(text,r['html'])

    def test_10_busy_capacity_and_duplicate_orders_do_not_charge_twice(self):
        r=self.page.evaluate('''()=>{const candidates=GameState.players.filter(p=>p.clubId!==GameState.userClub.id).slice(0,6),cash=GameState.userClub.presupuesto_dolares,results=candidates.map(p=>FM_DEPTH.scout(p.id)),after=GameState.userClub.presupuesto_dolares;const duplicate=FM_DEPTH.scout(candidates[0].id);return {results,cost:cash-after,duplicate,repeat:after-GameState.userClub.presupuesto_dolares,capacity:FM_OFFICE.scoutCapacity()}}''')
        self.assertEqual(sum(r['results']),r['capacity'])
        self.assertEqual(r['cost'],r['capacity']*1500)
        self.assertFalse(r['duplicate']);self.assertEqual(r['repeat'],0)

    def test_11_frozen_opinion_does_not_read_true_attributes_or_future_ceiling(self):
        self.complete()
        r=self.page.evaluate('''()=>{const p=player(1068088),before=FM_DEPTH.fit(p);for(const key of ['ritmo','tiro','pase','regate','defensa','fisico'])p[key]=1;p.potential=1;const after=FM_DEPTH.fit(p);return {before,after}}''')
        self.assertEqual(r['before'],r['after'])

    def test_12_ability_calibration_keeps_full_reports_imperfect_for_a_sample(self):
        r=self.page.evaluate('''()=>{const staff=FM_OFFICE.office().staff.find(e=>e.role==='Ojeador'),rows=GameState.players.filter(p=>p.clubId!==GameState.userClub.id).slice(0,120).map(p=>{const o=FM_SCOUT_NETWORK.capture(p,{staffId:staff.id,level:100}),truth=overall(p);return {inside:truth>=o.quality-o.spread-1&&truth<=o.quality+o.spread+1,spread:o.spread,potentialSpread:o.potentialSpread,confidence:o.confidence}});return {inside:rows.filter(r=>r.inside).length,total:rows.length,minSpread:Math.min(...rows.map(r=>r.spread)),minFuture:Math.min(...rows.map(r=>r.potentialSpread)),maxConfidence:Math.max(...rows.map(r=>r.confidence))}}''')
        self.assertGreaterEqual(r['inside'],r['total']*.9)
        self.assertGreaterEqual(r['minSpread'],3);self.assertGreaterEqual(r['minFuture'],5)
        self.assertLess(r['maxConfidence'],100)

    def test_13_manager_can_choose_which_observer_opinion_guides_recommendations(self):
        r=self.page.evaluate('''()=>{const p=player(1068088),staff=FM_OFFICE.office().staff.filter(e=>e.role==='Ojeador');FM_SCOUT_NETWORK.capture(p,{staffId:staff[0].id,level:100});FM_SCOUT_NETWORK.capture(p,{staffId:staff[1].id,level:100});const latest=FM_SCOUT_NETWORK.assessment(p).staffId,valid=FM_SCOUT_NETWORK.prefer(p.id,staff[0].id),selected=FM_SCOUT_NETWORK.assessment(p).staffId,invalid=FM_SCOUT_NETWORK.prefer(p.id,'nonexistent-employee');return {latest,selected,valid,invalid,expected:staff[0].id,html:FM_SCOUT_NETWORK.reportHTML(p)}}''')
        self.assertTrue(r['valid']);self.assertFalse(r['invalid'])
        self.assertNotEqual(r['latest'],r['selected']);self.assertEqual(r['selected'],r['expected'])
        self.assertIn('Opinión de referencia',r['html'])

    def test_14_npc_bidding_and_asking_prices_never_read_true_future_ceiling(self):
        r=self.page.evaluate('''()=>{const p=player(1068088);p.potential=99;const before={price:CLUB_AI.askingPrice(p),bidders:CLUB_AI.interestFor(p.id)};p.potential=1;return {before,after:{price:CLUB_AI.askingPrice(p),bidders:CLUB_AI.interestFor(p.id)}}}''')
        self.assertEqual(r['before'],r['after'])

    def test_15_attribute_opinions_freeze_until_a_new_observation(self):
        self.complete()
        r=self.page.evaluate('''()=>{const p=player(1068088),keys=['ritmo','tiro','pase','regate','defensa','fisico'],read=()=>Object.fromEntries(keys.map(k=>[k,FM_SCOUT_NETWORK.observedPlayer(p)[k]])),before=read();for(const key of keys)p[key]=1;p.potential=1;return {before,after:read(),source:FM_SCOUT_NETWORK.observedPlayer(p).transfermarkt===p.transfermarkt}}''')
        self.assertEqual(r['before'],r['after']);self.assertTrue(r['source'])

    def test_16_legacy_exact_quality_remains_a_snapshot_until_observed_again(self):
        r=self.page.evaluate('''()=>{const p=player(1068088);FM_DEPTH.ensure().reports[p.id]={level:100,completed:true,status:'complete',updated:GameState.today};GameState.scouting.reports[p.id]={date:GameState.today,rating:String(overall(p))};const before=FM_DEPTH.range(p);for(const key of ['ritmo','tiro','pase','regate','defensa','fisico'])p[key]=1;return {before,after:FM_DEPTH.range(p)}}''')
        self.assertEqual(r['before'],r['after'])


if __name__=='__main__':unittest.main(verbosity=2)
