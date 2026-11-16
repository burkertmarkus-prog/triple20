const assert=require('node:assert/strict');
const engine=require('../double-ko.js');
let seed=971;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32};
let games=0;
for(const n of [2,3,4,5,6,7,8,9,16,18,20,31,32,33,40,63,64])for(let trial=0;trial<30;trial++){
  const players=Array.from({length:n},(_,i)=>`Spieler ${i+1}`),plan=engine.create(players);
  let matches=[],steps=0,finished;
  while(true){
    const view=engine.evaluate(plan,matches);matches=view.matches;
    if(view.champion){finished=view.champion;break}
    const ready=matches.filter(m=>m.sa===null),busy=ready.flatMap(m=>[m.a,m.b]);
    assert(ready.length,'No deadlock');assert.equal(new Set(busy).size,busy.length,'No player in two ready games');
    assert(!busy.includes('Freilos'));assert(++steps<=2*n-1);
    const losses=Object.fromEntries(players.map(p=>[p,0]));matches.filter(m=>m.sa!==null).forEach(m=>losses[m.sa>m.sb?m.b:m.a]++);
    for(const m of ready){assert(losses[m.a]<2&&losses[m.b]<2);if(m.bracket==='upper')assert.equal(losses[m.a]+losses[m.b],0);if(m.bracket==='lower')assert.equal(losses[m.a]+losses[m.b],2)}
    const m=ready[Math.floor(random()*ready.length)],win=random()<.5;
    matches=engine.correct(plan,matches,m.nodeId,win?2:0,win?0:2);games++;
    // Reload/persistence produces the same ready set and preserves game indices.
    assert.deepEqual(engine.evaluate(JSON.parse(JSON.stringify(plan)),JSON.parse(JSON.stringify(matches))).matches,matches);
  }
  const losses=Object.fromEntries(players.map(p=>[p,0]));matches.forEach(m=>losses[m.sa>m.sb?m.b:m.a]++);
  for(const p of players)assert.equal(losses[p],p===finished?(matches.some(m=>m.nodeId==='F2')?1:0):2);
  assert.equal(matches.length,2*n-2+(matches.some(m=>m.nodeId==='F2')?1:0));
}
// Two completed first-round games release their next game while the rest waits.
const plan=engine.create(Array.from({length:8},(_,i)=>`P${i}`));
let matches=engine.evaluate(plan).matches;
for(const id of ['U1-1','U1-2'])matches=engine.correct(plan,matches,id,2,0);
assert(matches.some(m=>m.nodeId==='U2-1'&&m.sa===null));assert(matches.some(m=>m.nodeId==='L1-1'&&m.sa===null));assert(matches.some(m=>m.nodeId==='U1-3'&&m.sa===null));
const before=structuredClone(matches);matches=engine.correct(plan,matches,'U2-1',2,0);
// Unrelated first-round game remains editable after a later-round result.
matches=engine.correct(plan,matches,'U1-3',0,2);
assert.throws(()=>engine.correct(plan,matches,'U1-1',0,2),/Folgespiel/);
matches=engine.correct(plan,matches,'U1-1',2,1);assert(matches.some(m=>m.nodeId==='U2-1'&&m.sa===2));
assert.deepEqual(engine.evaluate(plan,before).matches,before,'Undo snapshot restores readiness');
// Changing a winner before any dependent score removes stale participants.
let correction=engine.correct(plan,before,'U1-1',0,2);
assert.notEqual(correction.find(m=>m.nodeId==='U2-1').a,before.find(m=>m.nodeId==='U2-1').a);
for(const firstFinalWinner of [0,1]){
 const p=engine.create(['A','B']);let m=engine.evaluate(p).matches;m=engine.correct(p,m,'U1-1',2,0);m=engine.correct(p,m,'F1',firstFinalWinner?0:2,firstFinalWinner?2:0);
 assert.equal(m.some(x=>x.nodeId==='F2'),!!firstFinalWinner);
 if(firstFinalWinner){assert.equal(engine.evaluate(p,m).champion,'');m=engine.correct(p,m,'F2',0,2)}
 assert.equal(engine.evaluate(p,m).champion,firstFinalWinner?'B':'A');
}
console.log(`OK: 510 complete tournaments, ${games} results; async readiness, byes, corrections, undo, reset final and reload tested.`);
const seeded=engine.create(['S1','S2','S3','S4','S5','S6','S7','S8']),first=seeded.nodes.filter(node=>node.bracket==='upper'&&node.stage===1).map(node=>node.inputs.map(input=>input.player));
assert.deepEqual(first,[['S1','S8'],['S4','S5'],['S2','S7'],['S3','S6']]);
assert.deepEqual(seeded.nodes.find(node=>node.id==='U3-1').inputs.map(input=>input.id),['U2-1','U2-2']);
console.log('OK: standard seed positions keep seeds 1/2 in opposite halves and seeds 1-4 in separate quarters.');
