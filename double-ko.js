/* Fixed dependency bracket. No network or UI state; old tournaments never use it. */
(function(root){
  'use strict';
  const ref=(id,result='winner')=>({id,result});
  function create(players){
    if(players.length<2||new Set(players).size!==players.length)throw new Error('Mindestens zwei eindeutige Spielernamen erforderlich.');
    const size=2**Math.ceil(Math.log2(players.length)),levels=Math.log2(size),nodes=[],upper=[];
    // Standard seed positions spread byes instead of putting them in one subtree.
    let seeds=[1,2];while(seeds.length<size){const total=seeds.length*2+1;seeds=seeds.flatMap(seed=>[seed,total-seed])}
    const slots=seeds.map(seed=>({player:players[seed-1]||null}));
    const add=(id,bracket,stage,inputs)=>{const node={id,bracket,stage,inputs};nodes.push(node);return node};
    for(let stage=1;stage<=levels;stage++){
      const row=[];for(let i=0;i<size/2**stage;i++)row.push(add(`U${stage}-${i+1}`,'upper',stage,stage===1?slots.slice(i*2,i*2+2):[ref(upper[stage-2][i*2].id),ref(upper[stage-2][i*2+1].id)]));upper.push(row);
    }
    let lower=[];
    if(levels>1){
      for(let i=0;i<size/4;i++)lower.push(add(`L1-${i+1}`,'lower',1,[ref(upper[0][i*2].id,'loser'),ref(upper[0][i*2+1].id,'loser')]));
      for(let stage=2;stage<=levels;stage++){
        // Cross incoming upper losers to postpone repeat encounters.
        lower=lower.map((node,i)=>add(`L${stage*2-2}-${i+1}`,'lower',stage*2-2,[ref(node.id),ref(upper[stage-1][lower.length-1-i].id,'loser')]));
        if(stage<levels){const previous=lower;lower=[];for(let i=0;i<previous.length/2;i++)lower.push(add(`L${stage*2-1}-${i+1}`,'lower',stage*2-1,[ref(previous[i*2].id),ref(previous[i*2+1].id)]))}
      }
    }
    const final=add('F1','grand',1,[ref(upper.at(-1)[0].id),levels===1?ref(upper[0][0].id,'loser'):ref(lower[0].id)]);
    add('F2','grand',2,final.inputs);
    return{version:1,size,nodes};
  }
  function evaluate(plan,matches=[]){
    const saved=new Map(matches.map(match=>[match.nodeId,match])),out=new Map(),resolved=[],preview=[];
    const input=source=>Object.hasOwn(source,'player')?source.player:out.get(source.id)?.[source.result];
    let champion='';
    for(const node of plan.nodes){
      if(node.id==='F2'){
        const first=out.get('F1');if(!first||first.winner===undefined)continue;
        const upper=input(node.inputs[0]);if(first.winner===upper){champion=upper;continue}
      }
      const [a,b]=node.inputs.map(input),meta={nodeId:node.id,bracket:node.bracket,stage:node.stage,round:node.stage};
      if(a===undefined||b===undefined){preview.push({...meta,a:a??'Noch offen',b:b??'Noch offen',sa:null,sb:null,preview:true});continue}
      if(a===null||b===null){out.set(node.id,{winner:a||b||null,loser:null});preview.push({...meta,a:a||b||'Freilos',b:'Freilos',sa:1,sb:0,automatic:true});continue}
      const old=saved.get(node.id),match=old&&old.a===a&&old.b===b?{...old,...meta}:{...meta,a,b,sa:null,sb:null};
      resolved.push(match);preview.push(match);
      if(match.sa!==null&&match.sb!==null){const winner=match.sa>match.sb?a:b;out.set(node.id,{winner,loser:winner===a?b:a});if(node.id==='F2')champion=winner}
    }
    // Preserve existing indices and game numbers as new branches become ready.
    const order=new Map(matches.map((match,index)=>[match.nodeId,index]));resolved.sort((a,b)=>(order.get(a.nodeId)??Infinity)-(order.get(b.nodeId)??Infinity));
    return{matches:resolved,preview,champion};
  }
  function descendants(plan,id){
    const ids=new Set([id]);for(const node of plan.nodes)if(node.inputs.some(source=>ids.has(source.id))||(node.id==='F2'&&ids.has('F1')))ids.add(node.id);ids.delete(id);return ids;
  }
  function correct(plan,matches,id,sa,sb){
    const target=matches.find(match=>match.nodeId===id);if(!target)throw new Error('Spiel nicht gefunden.');
    const changed=target.sa!==null&&(target.sa>target.sb)!==(sa>sb),dependent=descendants(plan,id);
    if(changed&&matches.some(match=>dependent.has(match.nodeId)&&match.sa!==null))throw new Error('Ein abhängiges Folgespiel ist bereits gespielt. Bitte zuerst dessen Ergebnisse rückgängig machen. Andere Turnierzweige bleiben unverändert.');
    const next=matches.filter(match=>!changed||!dependent.has(match.nodeId)).map(match=>match.nodeId===id?{...match,sa,sb}:{...match});
    return evaluate(plan,next).matches;
  }
  const api={create,evaluate,descendants,correct};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.T20DoubleKO=api;
})(globalThis);
