#!/usr/bin/env python3
"""Check source reconciliation and 3,000 seeded score-model season samples.

These are statistical score-model trials, not a claim that 3,000 complete careers
with transfers, injuries and finances were played in the browser.
"""
import hashlib
import json
import math
from pathlib import Path
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / 'data/world/match-benchmarks.json'


def node(script):
    prelude = """const fs=require('fs'),vm=require('vm');
const data=JSON.parse(fs.readFileSync('data/world/match-benchmarks.json','utf8'));
const context={WORLD_MATCH_BENCHMARKS:data,window:{}};
vm.createContext(context);vm.runInContext(fs.readFileSync('src/match-calibration.js','utf8'),context);
const M=context.window.FM_CALIBRATION;
function seeded(start){let value=start;return()=>{value=(Math.imul(value,1664525)+1013904223)>>>0;return value/4294967296}}
"""
    result = subprocess.run(['node', '-'], input=prelude+script, cwd=ROOT, text=True, capture_output=True, check=True)
    return json.loads(result.stdout)


class MatchCalibration(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = json.loads(DATA_PATH.read_text())

    def test_01_fifteen_leagues_have_auditable_nonfabricated_samples(self):
        rows = self.data['leagues']
        self.assertEqual(len(rows), 15)
        self.assertEqual(len({row['leagueId'] for row in rows}), 15)
        self.assertEqual(sum(row['metrics']['matches'] for row in rows), 4076)
        for row in rows:
            with self.subTest(row['leagueId']):
                self.assertRegex(row['source']['url'], r'^https://')
                self.assertRegex(row['source']['rawSha256'], r'^[a-f0-9]{64}$')
                canonical = json.dumps(row['tableRows'] or row['results'], ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode()
                self.assertEqual(hashlib.sha256(canonical).hexdigest(), row['source']['sampleSha256'])
                if row['tableRows']:
                    self.assertFalse(row['results'])
                    self.assertIsNone(row['firstMatch'])
                    self.assertIsNone(row['lastMatch'])
                    self.assertIsNone(row['metrics']['homeGoals'])
                    self.assertIsNone(row['metrics']['awayGoals'])
                    self.assertEqual(row['metricEstimates'], ['homeAwayGoals'])
                    self.assertIn('no hay marcadores individuales', row['caveat'])
                else:
                    self.assertEqual(row['metrics']['matches'], len(row['results']))
                    self.assertEqual(len({(r['date'],r['home'],r['away']) for r in row['results']}), len(row['results']))
                    self.assertLessEqual(row['firstMatch'], row['lastMatch'])
                    self.assertTrue(all(r['date'] <= self.data['cutoff'] for r in row['results']))
        uruguay = next(r for r in rows if r['leagueId']=='URU1')
        self.assertTrue(uruguay['firstMatch'].startswith('2026-'))
        self.assertEqual(uruguay['scope'], 'dated-phase-sample')
        self.assertIsNone(uruguay['season'])

    def test_02_metrics_reconcile_with_actual_results_or_final_table(self):
        for row in self.data['leagues']:
            metrics = row['metrics']
            with self.subTest(row['leagueId']):
                if row['tableRows']:
                    table = row['tableRows']
                    played = sum(r['played'] for r in table)
                    self.assertEqual(sum(r['goalsFor'] for r in table), sum(r['goalsAgainst'] for r in table))
                    self.assertTrue(all(r['played']==r['wins']+r['draws']+r['losses'] for r in table))
                    self.assertEqual(played/2, metrics['matches'])
                    self.assertAlmostEqual(sum(r['goalsFor'] for r in table)/(played/2), metrics['goalsPerMatch'])
                    self.assertAlmostEqual(sum(r['draws'] for r in table)/played, metrics['drawRate'])
                else:
                    matches = row['results']
                    self.assertAlmostEqual(sum(r['homeGoals'] for r in matches)/len(matches), metrics['homeGoals'])
                    self.assertAlmostEqual(sum(r['awayGoals'] for r in matches)/len(matches), metrics['awayGoals'])
                    self.assertAlmostEqual(sum(r['homeGoals']==r['awayGoals'] for r in matches)/len(matches), metrics['drawRate'])
                    for key in ('shots','fouls','yellowCards','redCards'):
                        if metrics[key] is not None:
                            recorded = [m[key] for m in matches if key in m]
                            self.assertEqual(metrics[key]['matches'], len(recorded))
                            self.assertAlmostEqual(sum(v[0] for v in recorded)/len(recorded), metrics[key]['home'])
                self.assertNotIn('xg', metrics)
                self.assertNotIn('injuries', metrics)

    def test_03_two_hundred_seasons_per_league_match_goals_draws_and_locality(self):
        result = node("""const reports=[];let total=0;
for(const row of data.leagues){const rng=seeded(2077+total),sample=[],n=row.metrics.matches*200;for(let i=0;i<n;i++)sample.push(M.simulate(65,65,row.leagueId,rng));const report=M.diagnostics(row.leagueId,sample);reports.push({id:row.leagueId,...report});total+=n}
console.log(JSON.stringify({seasons:200*data.leagues.length,matches:total,reports}));
""")
        self.assertEqual(result['seasons'], 3000)
        self.assertEqual(result['matches'], 815200)
        for report in result['reports']:
            with self.subTest(report['id']):
                n = report['matches']
                for key in ('homeGoals','awayGoals'):
                    tolerance = max(.025,6*math.sqrt(report['expected'][key]/n))
                    self.assertLess(abs(report['deviation'][key]), tolerance)
                self.assertLess(abs(report['deviation']['drawRate']), .015)

    def test_04_strength_and_neutral_venue_change_probabilities_without_extra_goals(self):
        result = node("""const equal=M.rates(65,65,'BRA1'),strong=M.rates(85,50,'BRA1'),weak=M.rates(50,85,'BRA1'),neutral=M.rates(65,65,'BRA1',{neutral:true});const rng=seeded(445),wins={strong:0,weak:0};for(let i=0;i<15000;i++){let r=M.simulate(85,50,'BRA1',rng);wins.strong+=r.home>r.away;r=M.simulate(50,85,'BRA1',rng);wins.weak+=r.home>r.away}console.log(JSON.stringify({equal,strong,weak,neutral,wins}));
""")
        self.assertGreater(result['strong']['home'], result['equal']['home'])
        self.assertLess(result['weak']['home'], result['equal']['home'])
        self.assertAlmostEqual(result['neutral']['home'], result['neutral']['away'])
        for key in ('strong','weak','neutral'):
            self.assertAlmostEqual(result[key]['total'],result['equal']['total'])
        self.assertGreater(result['wins']['strong'], result['wins']['weak']*2)

    def test_05_fallbacks_and_home_advantage_estimates_are_disclosed(self):
        result = node("""const england=M.profile('GB1'),lower=M.profile('GB2'),ecuador=M.profile('ECU1'),unknown=M.profile('UNKNOWN'),html=M.sourceHTML('ECU1'),lowerHTML=M.sourceHTML('GB2');console.log(JSON.stringify({england,lower,ecuador,unknown,html,lowerHTML}));
""")
        self.assertFalse(result['england']['estimated'])
        self.assertFalse(result['england']['homeAdvantageEstimated'])
        self.assertTrue(result['lower']['estimated'])
        self.assertEqual(result['lower']['referenceId'], 'GB1')
        self.assertEqual(result['lower']['scope'], 'borrowed-reference')
        self.assertTrue(result['ecuador']['homeAdvantageEstimated'])
        self.assertIsNone(result['ecuador']['metrics']['homeGoals'])
        self.assertTrue(result['unknown']['estimated'])
        self.assertIn('No es una medición de esta liga', result['html'])
        self.assertIn('Referencia prestada', result['lowerHTML'])
        self.assertNotIn('null — null', result['html'])

    def test_06_seed_reproduces_results_and_tuning_stays_bounded(self):
        result = node("""const a=seeded(441),b=seeded(441),left=Array.from({length:200},()=>M.simulate(65,65,'ARG1',a)),right=Array.from({length:200},()=>M.simulate(65,65,'ARG1',b));console.log(JSON.stringify({same:JSON.stringify(left)===JSON.stringify(right),profiles:data.leagues.map(row=>({id:row.leagueId,tuning:M.tuning(row.leagueId),rate:M.rates(999,-999,row.leagueId)}))}));
""")
        self.assertTrue(result['same'])
        for profile in result['profiles']:
            with self.subTest(profile['id']):
                tuning = profile['tuning']
                self.assertTrue(.78<=tuning['shotFrequency']<=1.24)
                self.assertTrue(.78<=tuning['conversion']<=1.25)
                self.assertTrue(.7<=tuning['foulFrequency']<=1.35)
                self.assertTrue(.7<=tuning['yellowFrequency']<=1.35)
                self.assertTrue(.65<=tuning['redFrequency']<=1.4)
                self.assertGreater(profile['rate']['home'], 0)
                self.assertGreater(profile['rate']['away'], 0)

    def test_07_two_hundred_balanced_league_seasons_preserve_total_goals(self):
        result = node("""const reports=[];const ratings=Array.from({length:20},(_,i)=>52+i*1.35);
for(const row of data.leagues){const rng=seeded(6021+reports.length),results=[];for(let season=0;season<200;season++)for(let home=0;home<20;home++)for(let away=0;away<20;away++)if(home!==away)results.push(M.simulate(ratings[home],ratings[away],row.leagueId,rng));reports.push({id:row.leagueId,...M.diagnostics(row.leagueId,results)})}console.log(JSON.stringify(reports));
""")
        self.assertEqual(sum(row['matches'] for row in result), 1140000)
        for report in result:
            with self.subTest(report['id']):
                self.assertLess(abs(report['observed']['goalsPerMatch']-report['expected']['goalsPerMatch']), .045)
                self.assertLess(abs(report['deviation']['drawRate']), .04)
                self.assertLess(abs(report['deviation']['homeGoals']), .055)
                self.assertLess(abs(report['deviation']['awayGoals']), .055)


if __name__ == '__main__':
    unittest.main()
