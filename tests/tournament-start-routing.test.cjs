const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const source=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
assert.doesNotMatch(source,/function linkPlannedEventBeforeStart\s*\(/,'Freie Turnierstarts dürfen keinen geplanten Termin automatisch verknüpfen.');
assert.match(source,/state\.scheduledEventId\|\|state\.scheduledViaTournamentManagement!==true/,'Live-Push benötigt die ausdrückliche Vorbereitung über die Turnierleitung.');
assert.match(source,/scheduledViaTournamentManagement:true/,'Die Turniervorbereitung muss den offiziellen Start kennzeichnen.');
assert.match(source,/suggestions=seasonMembers\(setupSeason\(\)\)/,'Die Schweizer Nachmeldung muss den Kader des laufenden Bewerbs verwenden.');
assert.match(source,/const season=setupSeason\(\);if\(season/,'Ein nachgemeldeter Spieler muss in der Saison des laufenden Bewerbs gespeichert werden.');
console.log('OK: freie Starts senden keinen Push; Schweizer Nachmeldungen verwenden den richtigen Bewerb.');
