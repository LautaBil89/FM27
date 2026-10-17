/* Compact local saves; exported backups retain the complete, hydrated career. */
const WORLD_STORAGE = (() => {
  const FORMAT = 'FM27-COMPACT', COMPRESSED_FORMAT = 'FM27-COMPACT-LZ', CODEC_VERSION = 1, MAX_IMPORT_BYTES = 50 * 1024 * 1024;
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  const forbidden = new Set(['__proto__', 'prototype', 'constructor']);
  const missing = Symbol('absent');
  const dbPlayers = new Map(WORLD_DATABASE.players.map(p => [p.playerId, p]));
  const dbClubs = new Map(WORLD_DATABASE.clubs.map(c => [c.id, c]));
  const dbLeagues = new Map(WORLD_DATABASE.leagues.map(l => [l.id, l]));
  const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const same = (a, b) => a === b || (typeof a === 'object' && typeof b === 'object' && JSON.stringify(a) === JSON.stringify(b));
  const copy = value => JSON.parse(JSON.stringify(value));
  const fail = message => { throw Error(message); };
  const string = (value, maximum = 150) => typeof value === 'string' && value.length > 0 && value.length <= maximum;
  const integer = (value, minimum = 0, maximum = 10000000) => Number.isSafeInteger(value) && value >= minimum && value <= maximum;
  const finite = (value, minimum = 0, maximum = 1e13) => Number.isFinite(value) && value >= minimum && value <= maximum;
  const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value + 'T12:00:00Z')) && new Date(value + 'T12:00:00Z').toISOString().slice(0, 10) === value;
  const bytes = value => typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(value).length : unescape(encodeURIComponent(value)).length;

  function safeJSON(value, depth = 0) {
    if (depth > 40) fail('estructura demasiado profunda');
    if (typeof value === 'number' && !Number.isFinite(value)) fail('número no válido');
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value) && value.length > 100000) fail('lista demasiado grande');
    for (const key of Object.keys(value)) {
      if (forbidden.has(key)) fail('clave no permitida');
      safeJSON(value[key], depth + 1);
    }
  }

  function mask(indices, count) {
    const values = Array(Math.ceil(count / 6)).fill(0);
    for (const index of indices) values[Math.floor(index / 6)] |= 1 << (index % 6);
    while (values.length && !values[values.length - 1]) values.pop();
    return values.map(n => alphabet[n]).join('');
  }
  function bits(value, count) {
    if (typeof value !== 'string' || value.length > Math.ceil(count / 6)) fail('máscara de guardado no válida');
    const indices = [];
    for (let i = 0; i < value.length; i++) {
      const number = alphabet.indexOf(value[i]);
      if (number < 0) fail('máscara de guardado no válida');
      for (let j = 0; j < 6; j++) if (number & (1 << j)) {
        if (i * 6 + j >= count) fail('columna de guardado no válida');
        indices.push(i * 6 + j);
      }
    }
    return indices;
  }

  function playerReference(p) {
    const id = p.transfermarkt?.playerId ?? p.playerId;
    return p.realIdentity !== false && dbPlayers.has(id) ? id : null;
  }
  const identityTemplates = new Map();
  function identity(reference) {
    if (reference === null) return {};
    if(identityTemplates.has(reference))return identityTemplates.get(reference);
    const ref = dbPlayers.get(reference);
    if (!ref) fail('la base instalada no incluye un jugador de este guardado');
    const template=WORLD_ENGINE.hydratePlayerIdentity({}, ref);identityTemplates.set(reference,template);return template;
  }
  function residual(record, base, preserved) {
    const result = {};
    for (const key of Object.keys(record)) {
      if (record[key] === undefined) continue;
      if (preserved.has(key) || !own(base, key) || !same(record[key], base[key])) result[key] = record[key];
    }
    // An absent field must not reappear merely because it exists in the database template.
    const omitted = Object.keys(base).filter(key => !own(record, key));
    if (omitted.length) result._identityOmitted = omitted;
    return result;
  }

  function packRecords(records, referenceFor, templateFor, preserved = new Set()) {
    const references = records.map(referenceFor);
    const reduced = records.map((record, i) => residual(record, templateFor(references[i]), preserved));
    const keys = [...new Set(reduced.flatMap(record => Object.keys(record)))].sort();
    if (keys.length > 256) fail('demasiados campos en los registros');
    const defaults = [], absentDefaults = [];
    for (let i = 0; i < keys.length; i++) {
      const frequency = new Map();
      for (const record of reduced) {
        const value = own(record, keys[i]) ? record[keys[i]] : missing;
        const token = value === missing ? missing : JSON.stringify(value);
        const found = frequency.get(token);
        if (found) found.count++; else frequency.set(token, {value, count: 1});
      }
      let common = {value: missing, count: 0};
      for (const candidate of frequency.values()) if (candidate.count > common.count) common = candidate;
      if (common.value === missing) { defaults.push(null); absentDefaults.push(i); }
      else defaults.push(common.value);
    }
    const absentSet = new Set(absentDefaults);
    const rows = reduced.map((record, r) => {
      const changed = [], removed = [], values = [];
      for (let i = 0; i < keys.length; i++) {
        const exists = own(record, keys[i]);
        if (exists ? (!absentSet.has(i) && same(record[keys[i]], defaults[i])) : absentSet.has(i)) continue;
        changed.push(i);
        if (exists) values.push(record[keys[i]]); else removed.push(i);
      }
      return [references[r], mask(changed, keys.length), mask(removed, keys.length), ...values];
    });
    return {keys, defaults, absent: mask(absentDefaults, keys.length), rows};
  }

  function unpackRecords(packed, templateFor, maximum) {
    if (!object(packed) || !Array.isArray(packed.keys) || packed.keys.length > 256 || !Array.isArray(packed.defaults) || packed.defaults.length !== packed.keys.length || !Array.isArray(packed.rows) || packed.rows.length > maximum) fail('registros compactos no válidos');
    const keys = packed.keys;
    if (keys.some(key => !string(key, 100) || forbidden.has(key)) || new Set(keys).size !== keys.length) fail('campos compactos no válidos');
    const absent = new Set(bits(packed.absent, keys.length));
    return packed.rows.map(row => {
      if (!Array.isArray(row) || row.length < 3 || row.length > keys.length + 3) fail('fila compacta no válida');
      const changed = bits(row[1], keys.length), removed = new Set(bits(row[2], keys.length));
      if ([...removed].some(i => !changed.includes(i)) || row.length !== 3 + changed.length - removed.size) fail('datos compactos incompletos');
      const result = copy(templateFor(row[0]));
      for (let i = 0; i < keys.length; i++) if (!absent.has(i)) result[keys[i]] = copy(packed.defaults[i]);
      let at = 3;
      for (const index of changed) {
        if (removed.has(index)) delete result[keys[index]];
        else result[keys[index]] = row[at++];
      }
      if (own(result, '_identityOmitted')) {
        if (!Array.isArray(result._identityOmitted) || result._identityOmitted.some(key => !string(key, 100) || forbidden.has(key))) fail('identidad compacta no válida');
        for (const key of result._identityOmitted) delete result[key];
        delete result._identityOmitted;
      }
      return result;
    });
  }

  function table(table, clubs) {
    if (!object(table) || Object.keys(table).length !== clubs.length) fail('tabla de posiciones incompleta');
    for (const id of clubs) {
      const row = table[id];
      if (!object(row) || row.id !== id || !['pj', 'g', 'e', 'p', 'gf', 'gc', 'pts'].every(key => integer(row[key])) || row.pj !== row.g + row.e + row.p || row.pts !== row.g * 3 + row.e) fail('tabla de posiciones no válida');
    }
  }
  function result(score, home, away, clubs) {
    if (score == null) return;
    if (!object(score) || !integer(score.home, 0, 100) || !integer(score.away, 0, 100) || (score.winner != null && (!clubs.has(score.winner) || ![home, away].includes(score.winner)))) fail('resultado no válido');
    if (score.pen != null && (!object(score.pen) || !integer(score.pen.home, 0, 100) || !integer(score.pen.away, 0, 100))) fail('penales no válidos');
  }
  function cupNodes(value, clubs, depth = 0) {
    if (depth > 20) fail('cuadro continental demasiado profundo');
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) { for (const child of value) cupNodes(child, clubs, depth + 1); return; }
    if (own(value, 'home') && own(value, 'away') && typeof value.home !== 'number') {
      if (!clubs.has(value.home) || !clubs.has(value.away) || value.home === value.away) fail('cruce continental no válido');
      result(value.result, value.home, value.away, clubs);
      if (value.winner != null && ![value.home, value.away].includes(value.winner)) fail('ganador continental no válido');
    }
    if (Array.isArray(value.teams) && (value.teams.some(id => !clubs.has(id)) || new Set(value.teams).size !== value.teams.length)) fail('grupo continental no válido');
    if (own(value, 'winner') && value.winner != null && !clubs.has(value.winner)) fail('campeón continental no válido');
    for (const child of Object.values(value)) cupNodes(child, clubs, depth + 1);
  }

  function validateWorld(s, aliases = true) {
    if (!object(s) || s.version !== 3 || s.worldVersion !== 1 || !object(s.world) || !Array.isArray(s.world.clubs) || !Array.isArray(s.world.leagues) || !Array.isArray(s.players) || !Array.isArray(s.calendar) || !object(s.userClub) || !object(s.tactics) || !object(s.world.cups)) fail('estructura de carrera mundial incompatible');
    if (!string(s.manager, 100) || !integer(s.year, 2020, 2300) || !validDate(s.today) || !integer(s.eventIndex, 0, s.calendar.length) || !finite(s.userClub.presupuesto_dolares, -1e13) || !finite(s.userClub.presupuesto_pesos, -1e16, 1e16)) fail('datos de carrera no válidos');
    if (own(s.world, 'clock')) {
      const clock=s.world.clock;
      if (!object(clock) || clock.version!==1 || !integer(clock.slot,0,3) || !integer(clock.ticks,0,1e9) || !validDate(clock.lastProcessedDay) || (clock.lastTrainingDate!==null&&!validDate(clock.lastTrainingDate)) || (clock.lastMatchNotice!==null&&!string(clock.lastMatchNotice,150)) || !Array.isArray(clock.recent) || clock.recent.length>32) fail('reloj de carrera no válido');
      for (const entry of clock.recent) if (!object(entry) || !validDate(entry.date) || !integer(entry.slot,0,3) || !string(entry.title,200) || !string(entry.body,3000)) fail('actividad diaria no válida');
    }
    if (['confianza_directiva', 'presion_hinchada', 'reputacion'].some(key => own(s.userClub, key) && !finite(s.userClub[key], 0, 100)) || (own(s.userClub, 'wageBudget') && !finite(s.userClub.wageBudget)) || (own(s.userClub, 'ticketPrice') && !finite(s.userClub.ticketPrice, 0, 10000))) fail('economía o directiva no válida');
    if (s.players.length > 40000 || s.world.clubs.length > 1200 || !s.world.clubs.length || s.world.leagues.length > 100 || !s.world.leagues.length || s.calendar.length > 12000) fail('tamaño de carrera no válido');
    const clubs = new Set(), leagues = new Map(), membership = new Set();
    for (const c of s.world.clubs) {
      if (!object(c) || !string(c.id, 100) || clubs.has(c.id) || !string(c.nombre, 150) || !string(c.leagueId, 30)) fail('club no válido o duplicado');
      clubs.add(c.id);
    }
    for (const l of s.world.leagues) {
      if (!object(l) || !string(l.id, 30) || leagues.has(l.id) || !Array.isArray(l.clubIds) || l.clubIds.length < 2 || l.clubIds.length > 100 || l.clubIds.some(id => !clubs.has(id) || membership.has(id)) || new Set(l.clubIds).size !== l.clubIds.length) fail('liga no válida o duplicada');
      for (const id of l.clubIds) membership.add(id);
      leagues.set(l.id, l); table(l.standings, l.clubIds);
    }
    if (membership.size !== clubs.size || s.world.clubs.some(c => !leagues.get(c.leagueId)?.clubIds.includes(c.id))) fail('pertenencia de clubes no válida');
    const userLeague = leagues.get(s.world.userLeagueId);
    if (!userLeague || !userLeague.clubIds.includes(s.userClub.id)) fail('club del entrenador no válido');
    if (Array.isArray(s.external)) for (const c of s.external) {
      if (!object(c) || !string(c.id, 100) || clubs.has(c.id)) fail('club externo no válido o duplicado');
      clubs.add(c.id);
    }
    const ids = new Set(), referenceIds = new Set();
    for (const p of s.players) {
      if (!object(p) || !integer(p.id, 1, Number.MAX_SAFE_INTEGER) || ids.has(p.id) || !string(p.nombre, 150) || !['POR', 'DEF', 'MED', 'DEL'].includes(p.posicion) || (p.clubId != null && !clubs.has(p.clubId))) fail('jugador no válido o duplicado');
      if (!['ritmo', 'tiro', 'pase', 'regate', 'defensa', 'fisico'].every(key => finite(p[key], 1, 99)) || !['condicion_fisica', 'moral'].every(key => finite(p[key], 0, 100)) || !['valor_mercado', 'salario', 'clausula_rescision'].every(key => finite(p[key])) || !integer(p.injury, 0, 100000) || !integer(p.ban, 0, 10000)) fail('atributos de jugador no válidos');
      if (p.fecha_nacimiento != null && !validDate(p.fecha_nacimiento)) fail('fecha de nacimiento no válida');
      const ref = p.transfermarkt?.playerId ?? p.playerId;
      if (p.realIdentity && ref != null) {
        if (!integer(ref, 1, Number.MAX_SAFE_INTEGER) || referenceIds.has(ref)) fail('identidad real duplicada o no válida');
        referenceIds.add(ref);
      }
      ids.add(p.id);
    }
    const lineup = [...(s.tactics.xi || []), ...(s.tactics.bench || [])].filter(id => id != null);
    if (!Array.isArray(s.tactics.xi) || !Array.isArray(s.tactics.bench) || s.tactics.xi.length > 11 || s.tactics.bench.length > 7 || lineup.some(id => !ids.has(id)) || new Set(lineup).size !== lineup.length || !FORMATIONS[s.tactics.formation]) fail('alineación no válida');
    const events = new Set(); let previousDate = '';
    for (const e of s.calendar) {
      if (!object(e) || !string(e.id, 150) || events.has(e.id) || !['LPF', 'LIB', 'SUD'].includes(e.type) || !validDate(e.date) || e.date < previousDate || typeof e.done !== 'boolean' || !Array.isArray(e.games) || e.games.length > 300 || (e.type === 'LPF' && !leagues.has(e.leagueId))) fail('calendario no válido');
      previousDate = e.date; events.add(e.id);
      const used = new Set();
      for (const g of e.games) {
        if (!object(g) || !clubs.has(g.home) || !clubs.has(g.away) || g.home === g.away || used.has(g.home) || used.has(g.away)) fail('partido del calendario no válido');
        if(e.type==='LPF'){
          const lower=leagues.get(e.leagueId),upper=leagues.get(e.interdivisionUpper);
          const domestic=lower.clubIds.includes(g.home)&&lower.clubIds.includes(g.away);
          const promotion=e.pyramid===true&&e.phase==='knockout'&&e.pyramidPhase==='PROMOCION'&&lower.tier===2&&upper?.tier===1&&upper.country===lower.country&&lower.upperLeagueId===upper.id&&((upper.clubIds.includes(g.home)&&lower.clubIds.includes(g.away))||(lower.clubIds.includes(g.home)&&upper.clubIds.includes(g.away)));
          if(!domestic&&!promotion)fail('partido de otra liga');
        }
        used.add(g.home); used.add(g.away); result(g.result, g.home, g.away, clubs);
      }
    }
    if (!object(s.world.cups.LIB) || !object(s.world.cups.SUD)) fail('faltan competiciones continentales');
    for (const cup of Object.values(s.world.cups)) {
      if (!object(cup) || !Array.isArray(cup.groups) || cup.groups.length > 32 || !Array.isArray(cup.stages) || cup.stages.length > 10 || cup.stages.some(stage => !object(stage) || !Array.isArray(stage.ties) || stage.ties.length > 64 || stage.ties.some(tie => !object(tie) || !Array.isArray(tie.legs) || tie.legs.length > 2))) fail('competición continental no válida');
      if (cup.participants != null && (!Array.isArray(cup.participants) || cup.participants.length > 128 || cup.participants.some(id => !clubs.has(id)) || new Set(cup.participants).size !== cup.participants.length)) fail('participantes continentales no válidos');
      cupNodes(cup, clubs);
      if (object(cup.groupTables)) for (const [key, rows] of Object.entries(cup.groupTables)) {
        const group = cup.groups?.find(g => g.id === key);
        if (!group || !Array.isArray(group.teams)) fail('tabla continental sin grupo');
        table(rows, group.teams);
      }
    }
    if (!Array.isArray(s.news) || s.news.length > 5000 || s.news.some(n => !object(n) || !string(n.title, 1000) || typeof n.body !== 'string' || n.body.length > 20000 || !validDate(n.date))) fail('noticias no válidas');
    if (s.scouting != null && (!object(s.scouting) || !Array.isArray(s.scouting.shortlist) || s.scouting.shortlist.some(id => !ids.has(id)) || !object(s.scouting.reports))) fail('ojeo no válido');
    if (s.match) {
      const m = s.match;
      if (!object(m) || !clubs.has(m.home) || !clubs.has(m.away) || m.home === m.away || !integer(m.minute, 0, 130) || ![0, 1].includes(m.userSide) || !Array.isArray(m.lineups) || m.lineups.length !== 2 || m.lineups.some(list => !Array.isArray(list) || list.length > 11) || m.lineups.flat().some(id => !ids.has(id)) || new Set(m.lineups.flat()).size !== m.lineups.flat().length || !Array.isArray(m.score) || m.score.length !== 2 || !m.score.every(n => integer(n, 0, 100)) || !Array.isArray(m.stats) || m.stats.length !== 2 || !object(m.ratings) || !Array.isArray(m.feed) || !['red', 'injured', 'used'].every(key => Array.isArray(m[key]) && m[key].every(id => ids.has(id)))) fail('partido en curso no válido');
      if (Object.entries(m.ratings).some(([id, rating]) => !ids.has(Number(id)) || !finite(rating, 0, 10))) fail('calificaciones del partido no válidas');
      for (const stats of m.stats) if (!object(stats) || Object.values(stats).some(value => typeof value === 'number' && !finite(value, 0, 100000))) fail('estadísticas del partido no válidas');
    }
    if (aliases) {
      if (!Array.isArray(s.league) || s.league.length !== userLeague.clubIds.length || s.league.some(c => !userLeague.clubIds.includes(c.id)) || new Set(s.league.map(c => c.id)).size !== s.league.length || !Array.isArray(s.continental)) fail('clubes de la carrera no válidos');
      table(s.standings, userLeague.clubIds); table(s.annual, userLeague.clubIds);
    }
    return true;
  }

  function encode(s) {
    validateWorld(s);
    const state = {...s, world: {...s.world}};
    state.players = packRecords(s.players, playerReference, identity, new Set(['id', 'clubId']));
    state.world.clubs = packRecords(s.world.clubs, c => dbClubs.has(c.id) ? c.id : null, id => id === null ? {} : dbClubs.get(id), new Set(['id']));
    state.world.leagues = s.world.leagues.map(l => {
      const ref = dbLeagues.get(l.id) || {}, reduced = residual(l, ref, new Set(['id', 'clubIds', 'standings', 'rounds']));
      return reduced;
    });
    delete state.league; delete state.continental; delete state.standings; delete state.annual;
    // The compatibility cup is an alias of the user's continental competition.
    if (s.cup && Object.values(s.world.cups).some(cup => cup === s.cup || same(cup, s.cup))) delete state.cup;
    return {format: FORMAT, codecVersion: CODEC_VERSION, version: 3, worldVersion: s.worldVersion, state};
  }

  function decode(raw) {
    safeJSON(raw);
    if(raw?.format===COMPRESSED_FORMAT){
      if(raw.codecVersion!==1||typeof raw.data!=='string'||raw.data.length>MAX_IMPORT_BYTES||typeof LZString==='undefined')fail('copia comprimida incompatible');
      const unpacked=LZString.decompressFromUTF16(raw.data,MAX_IMPORT_BYTES);
      if(typeof unpacked!=='string'||!unpacked||bytes(unpacked)>MAX_IMPORT_BYTES)fail('copia comprimida dañada o demasiado grande');
      raw=JSON.parse(unpacked);safeJSON(raw);
      if(raw?.format!==FORMAT)fail('contenido comprimido incompatible');
    }
    let state;
    if (raw?.format === FORMAT) {
      if (raw.codecVersion !== CODEC_VERSION || raw.version !== 3 || raw.worldVersion !== 1 || !object(raw.state) || !object(raw.state.world)) fail('versión de guardado compacto incompatible');
      state = copy(raw.state);
      state.players = unpackRecords(state.players, identity, 40000);
      state.world.clubs = unpackRecords(state.world.clubs, id => {
        if (id === null) return {};
        if (!dbClubs.has(id)) fail('la base instalada no incluye un club del guardado');
        return dbClubs.get(id);
      }, 1200);
      if (!Array.isArray(state.world.leagues)) fail('ligas compactas no válidas');
      state.world.leagues = state.world.leagues.map(l => {
        if (!object(l) || !dbLeagues.has(l.id)) fail('la base instalada no incluye una liga del guardado');
        const result = {...copy(dbLeagues.get(l.id)), ...l};
        if (Array.isArray(result._identityOmitted)) { for (const key of result._identityOmitted) delete result[key]; delete result._identityOmitted; }
        return result;
      });
      validateWorld(state, false);
      WORLD_ENGINE.hydrateWorldState(state);
    } else {
      state = copy(raw?.format === 'FM27' && raw.state ? raw.state : raw);
      if (state?.version === 3) { validateWorld(state); WORLD_ENGINE.hydrateWorldState(state); }
      else MANAGEMENT.validateImported(state);
    }
    if (state.version === 3) validateWorld(state);
    if (state.match && !state.match.done) state.match.paused = true;
    return state;
  }

  function serialize(s) {
    const payload = s.version === 3 ? encode(s) : s;
    if (s.version !== 3) MANAGEMENT.validateImported(s);
    const serialized=JSON.stringify(payload);
    if(s.version===3&&serialized.length*2>3800000&&typeof LZString!=='undefined'){
      const compressed=JSON.stringify({format:COMPRESSED_FORMAT,codecVersion:1,data:LZString.compressToUTF16(serialized)});
      if(compressed.length<serialized.length)return compressed;
    }
    return serialized;
  }
  // Autosaves use a single background codec. The public manual save stays synchronous.
  let saveRevision=0,saveTimer=null,saveDirty=false,dirtySince=0,saveWorker=null,workerBusy=false,workerFailed=false,workerState=null,workerRevision=-1;
  function invalidateAutosave(){saveRevision++;if(saveTimer!==null)clearTimeout(saveTimer);saveTimer=null;saveDirty=false;dirtySince=0;}
  function saveError(error){toast('No se pudo guardar la carrera: '+(error.name==='QuotaExceededError'?'se agotó el espacio del navegador. Exportá una copia de seguridad.':error.message||'revisá los permisos del navegador.'));}
  function backgroundWorker(){
    if(saveWorker||workerFailed)return saveWorker;
    if(typeof Worker==='undefined'||typeof Blob==='undefined'){workerFailed=true;return null}
    try{
      const definitions={own,object,same,copy,fail,string,integer,finite,validDate,mask,playerReference,identity,residual,packRecords,table,result,cupNodes,validateWorld,encode,serialize};
      const source=`const FORMAT='${FORMAT}',COMPRESSED_FORMAT='${COMPRESSED_FORMAT}',CODEC_VERSION=${CODEC_VERSION},alphabet=${JSON.stringify(alphabet)},missing=Symbol('absent'),identityTemplates=new Map();let dbPlayers,dbClubs,dbLeagues,FORMATIONS;const WORLD_ENGINE={hydratePlayerIdentity:${WORLD_ENGINE.hydratePlayerIdentity.toString()}};const f=String.fromCharCode,LZString={_compress:${LZString._compress.toString()},compressToUTF16:${LZString.compressToUTF16.toString()}};`+Object.entries(definitions).map(([name,fn])=>`const ${name}=${fn.toString()};`).join('\n')+`self.onmessage=({data})=>{if(data.init){dbPlayers=new Map(data.init.players.map(p=>[p.playerId,p]));dbClubs=new Map(data.init.clubs.map(c=>[c.id,c]));dbLeagues=new Map(data.init.leagues.map(l=>[l.id,l]));FORMATIONS=data.init.formations;return}try{self.postMessage({id:data.id,text:serialize(data.state),snapshot:{manager:data.state.manager,today:data.state.today,year:data.state.year,userClub:{id:data.state.userClub.id,nombre:data.state.userClub.nombre}}})}catch(error){self.postMessage({id:data.id,error:error.message})}};`;
      const url=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));
      try{saveWorker=new Worker(url)}finally{URL.revokeObjectURL(url)}
      saveWorker.onmessage=({data})=>{
        workerBusy=false;
        if(data.id===saveRevision&&workerState===GameState){
          if(data.error)saveError(new Error(data.error));
          else try{localStorage.setItem(KEY,data.text);window.FM_INTEGRITY?.onSaved?.(data.text,data.snapshot)}catch(error){saveError(error)}
        }
        workerState=null;
        if(saveDirty){clearTimeout(saveTimer);saveTimer=setTimeout(runAutosave,0)}
      };
      saveWorker.onerror=event=>{event.preventDefault();saveWorker?.terminate();saveWorker=null;workerFailed=true;workerBusy=false;const retry=saveDirty||workerState===GameState&&workerRevision===saveRevision;workerState=null;if(retry)save(true)};
      saveWorker.postMessage({init:{players:WORLD_DATABASE.players,clubs:WORLD_DATABASE.clubs,leagues:WORLD_DATABASE.leagues,formations:FORMATIONS}});
      return saveWorker;
    }catch(error){saveWorker?.terminate();saveWorker=null;workerFailed=true;return null}
  }
  function runAutosave(){
    saveTimer=null;if(!saveDirty)return;if(!GameState){invalidateAutosave();return}if(workerBusy)return;
    if(GameState.version!==3){save(true);return}
    const worker=backgroundWorker();if(!worker){save(true);return}
    saveDirty=false;dirtySince=0;workerBusy=true;workerState=GameState;workerRevision=saveRevision;
    try{worker.postMessage({id:saveRevision,state:GameState})}catch(error){workerBusy=false;workerState=null;save(true)}
  }
  function scheduleSave(){
    if(!GameState)return false;
    saveRevision++;saveDirty=true;dirtySince||=Date.now();clearTimeout(saveTimer);
    saveTimer=setTimeout(runAutosave,Math.max(0,Math.min(350,2000-(Date.now()-dirtySince))));return true;
  }
  function autosavePending(){return saveDirty||workerBusy&&workerRevision===saveRevision}
  function flushSave(){return autosavePending()?save(true):true}
  window.addEventListener?.('pagehide',flushSave);
  document.addEventListener?.('visibilitychange',()=>{if(document.hidden)flushSave()});
  function save(silent = false) {
    invalidateAutosave();
    if (!GameState) return false;
    try {
      const raw=serialize(GameState);localStorage.setItem(KEY,raw);window.FM_INTEGRITY?.onSaved?.(raw,GameState);
      if (!silent) toast('Carrera guardada');
      return true;
    } catch (error) {
      toast('No se pudo guardar la carrera: ' + (error.name === 'QuotaExceededError' ? 'se agotó el espacio del navegador. Exportá una copia de seguridad.' : error.message || 'revisá los permisos del navegador.'));
      return false;
    }
  }
  function restore() {
    try {
      const text = localStorage.getItem(KEY);
      if (!text) return false;
      if (bytes(text) > MAX_IMPORT_BYTES) fail('guardado demasiado grande');
      const candidate = decode(JSON.parse(text));
      invalidateAutosave();
      GameState = candidate; window.GameState = candidate;
      if (candidate.version !== 3) MANAGEMENT.ensure();
      return true;
    } catch (error) { toast('No se pudo abrir el guardado: ' + error.message); return false; }
  }
  function importState(raw, options = {}) {
    const candidate = decode(raw);
    if (GameState && options.confirm !== false && !confirm('¿Reemplazar la carrera actual por esta copia de seguridad?')) return false;
    // Persist first: a rejected or oversized import cannot replace the current career.
    if (options.persist !== false) localStorage.setItem(KEY, serialize(candidate));
    invalidateAutosave();
    clearInterval(timer); timer = null;
    GameState = candidate; window.GameState = candidate;
    if (candidate.version !== 3) MANAGEMENT.ensure();
    view = GameState.match ? 'match' : 'dashboard';
    if (options.render !== false) render();
    return true;
  }
  function exportGame() {
    if (!GameState) return;
    try {
      if (GameState.version === 3) validateWorld(GameState); else MANAGEMENT.validateImported(GameState);
      const blob = new Blob([JSON.stringify({format: 'FM27', exportedAt: new Date().toISOString(), state: GameState})], {type: 'application/json'});
      const url = URL.createObjectURL(blob), link = document.createElement('a');
      link.href = url; link.download = `FM27-${GameState.userClub.id}-${GameState.year}.json`; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 3000); toast('Copia de seguridad exportada');
    } catch (error) { toast('No se pudo exportar la carrera: ' + error.message); }
  }
  function importGame() {
    const input = document.createElement('input'); input.type = 'file'; input.accept = '.json,application/json';
    input.addEventListener('change', async () => {
      const file = input.files[0]; if (!file) return;
      try {
        if (file.size > MAX_IMPORT_BYTES) fail('el archivo supera el límite de 50 MB');
        const text = await file.text();
        if (bytes(text) > MAX_IMPORT_BYTES) fail('el archivo supera el límite de 50 MB');
        if (importState(JSON.parse(text))) toast('Carrera importada correctamente');
      } catch (error) { toast('No se pudo importar la carrera: ' + (error.name === 'QuotaExceededError' ? 'no hay espacio para guardar la copia en este navegador.' : error.message)); }
    }); input.click();
  }
  saveGame = save; restoreGame = restore;
  window.saveGame = save;
  window.loadGame = function () { if (!restore()) return false; view = GameState.match ? 'match' : 'dashboard'; render(); return true; };
  Object.assign(actions, {save: () => save(), export: exportGame, import: importGame});
  return {scheduleSave,flushSave,pending:autosavePending,encode, decode, validate: s => s?.version === 3 ? validateWorld(s) : MANAGEMENT.validateImported(s), serialize, importState, exportGame, importGame, maxImportBytes: MAX_IMPORT_BYTES,
    inspect: s => { const text = serialize(s); return {players: s.players.length, characters: text.length, utf8Bytes: bytes(text), localStorageBytes: text.length * 2, hydratedBytes: bytes(JSON.stringify(s))}; }};
})();
window.WORLD_STORAGE = WORLD_STORAGE;
