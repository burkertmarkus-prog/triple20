const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const engine=require('../double-ko.js'),source=fs.readFileSync(require('node:path').join(__dirname,'../app.js'),'utf8');
const context=vm.createContext({esc:String});
vm.runInContext(source.slice(source.indexOf('function tvBracketGame('),source.indexOf('function tvKnockoutBracketHtml(')),context);
for(const size of [18,32,40,64]){
 const plan=engine.create(Array.from({length:size},(_,i)=>`P${i}`)),preview=engine.evaluate(plan).preview;
 for(const kind of ['upper','lower']){
  context.matches=preview;context.kind=kind;context.count=kind==='upper'?Math.log2(plan.size):2*Math.log2(plan.size)-2;context.size=size;
  const html=vm.runInContext('tvBracketColumns(tvBracketRounds(matches,kind,count,size),{limit:3})',context);
  assert(html.includes(kind==='upper'?'<h3>Runde 1':'<h3>Verliererrunde 1'),`${size} ${kind} must start at round 1`);
 }
}
context.rounds=Array.from({length:6},(_,i)=>({label:`Runde ${i+1}`,matches:[{a:'A',b:'B',sa:i===0?null:2,sb:i===0?null:0}]}));
assert(vm.runInContext('tvBracketColumns(rounds,{limit:3})',context).includes('<h3>Runde 1'),'Later results cannot hide pending round 1');
context.rounds.forEach((round,i)=>{round.matches[0].sa=i<4?2:null});
const advanced=vm.runInContext('tvBracketColumns(rounds,{limit:3})',context);assert(advanced.includes('<h3>Runde 5'));assert(!advanced.includes('<h3>Runde 1'));
assert(vm.runInContext('tvBracketColumns(rounds,{finals:true})',context).includes('<h3>Runde 6'));
console.log('OK: initial upper/lower windows for 18/32/40/64 players, asynchronous branches, later progress and final-phase view.');
