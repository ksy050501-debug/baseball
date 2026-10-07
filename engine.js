(function(root){
'use strict';
const PITCHES=[
 {id:'fast',name:'포심',full:'포심 패스트볼',cap:155,drain:6,cost:0,breakX:0,breakY:-.03,label:'빠른 직구',color:'#dfff7c'},
 {id:'slider',name:'슬라이더',full:'슬라이더',cap:140,drain:8,cost:160,breakX:-.28,breakY:.08,label:'횡으로 꺾이는 공',color:'#80caff'},
 {id:'change',name:'체인지업',full:'체인지업',cap:130,drain:7,cost:210,breakX:.16,breakY:.18,label:'직구 궤적의 느린 공',color:'#f8ce79'},
 {id:'curve',name:'커브',full:'커브',cap:119,drain:9,cost:260,breakX:-.08,breakY:.4,label:'큰 낙차의 변화구',color:'#b99dff'},
 {id:'split',name:'스플리터',full:'스플리터',cap:141,drain:10,cost:340,breakX:.035,breakY:.28,label:'플레이트 앞 급격한 낙차',color:'#ffa197'}
];
const BATTERS=[
 {name:'한도윤',number:7,role:'컨택형',contact:.78,power:.40,patience:.60,desc:'공을 잘 맞히지만 장타력은 낮습니다.'},
 {name:'강태오',number:24,role:'장타형',contact:.60,power:.90,patience:.38,desc:'적극적으로 스윙하며 실투를 장타로 연결합니다.'},
 {name:'이준서',number:11,role:'선구안형',contact:.70,power:.55,patience:.90,desc:'볼을 잘 골라냅니다. 스트라이크로 승부하세요.'},
 {name:'박시우',number:32,role:'균형형',contact:.73,power:.68,patience:.58,desc:'컨택과 장타력이 고르게 좋습니다.'},
 {name:'윤지호',number:5,role:'적극형',contact:.68,power:.65,patience:.24,desc:'유인구에도 스윙합니다. 코너를 활용하세요.'}
];
const ZONES=['좌측 높게','가운데 높게','우측 높게','좌측 가운데','가운데','우측 가운데','좌측 낮게','가운데 낮게','우측 낮게'];
const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
function pitchPhysics(type,stamina,position,target,rng=Math.random,missed=false){
 const offsetMs=Math.abs(position-.5)*1500,grade=!missed&&offsetMs<=45?'PERFECT':!missed&&offsetMs<=140?'GOOD':'MISS';
 const fatigue=(100-stamina)/100,max=type.cap*(1-.13*fatigue);
 const speed=Math.round(max*(grade==='PERFECT'?.985+rng()*.015:grade==='GOOD'?.94+rng()*.045:.73+rng()*.25)*10)/10;
 const spread=(grade==='PERFECT'?.035:grade==='GOOD'?.13:.62)*(1+.9*fatigue),angle=rng()*Math.PI*2,r=Math.sqrt(rng())*spread;
 const x=(target%3+.5)/3+Math.cos(angle)*r,y=(Math.floor(target/3)+.5)/3+Math.sin(angle)*r;
 const quality=Math.round(75*(grade==='PERFECT'?1:grade==='GOOD'?.88:.55)*(1-.28*fatigue));
 return {type:type.id,grade,speed,quality,x,y,inside:x>=0&&x<=1&&y>=0&&y<=1,offsetMs};
}
function decideBatter(p,batter,count,previous,rng=Math.random){
 const edgeDistance=Math.max(Math.abs(p.x-.5),Math.abs(p.y-.5)),near=edgeDistance<.68;
 const swingChance=p.inside?.70+(1-batter.patience)*.18+(count.strikes===2?.09:0):clamp(.36-batter.patience*.28+(near?.11:0)+(count.strikes===2&&near?.16:0),.04,.65);
 const swing=rng()<swingChance;if(!swing)return {kind:p.inside?'calledStrike':'ball',swing:false};
 const mixed=previous&&previous.type!==p.type?Math.min(.12,Math.abs(previous.speed-p.speed)/180+.045):0,center=clamp(1-edgeDistance*2,0,1);
 const contactChance=clamp(.37+batter.contact*.50+center*.17-(p.speed-110)*.0021-p.quality*.0017-mixed-(p.inside?0:.18),.13,.91);
 if(rng()>contactChance)return {kind:'swingStrike',swing:true};
 if(rng()<.36+(count.strikes===2?.08:0))return {kind:'foul',swing:true,contact:true};
 const hitChance=clamp(.16+center*.27+batter.contact*.16-p.quality*.0015+(p.grade==='MISS'?.13:0),.12,.63);
 if(rng()>hitChance)return {kind:rng()<.52?'groundOut':'flyOut',swing:true,contact:true};
 const extra=rng();return {kind:extra<batter.power*.10?'homeRun':extra<.035+batter.power*.10?'triple':extra<.22+batter.power*.19?'double':'single',swing:true,contact:true};
}
class Game {
 constructor(saved=null,rng=Math.random){this.rng=rng;this.points=0;this.stamina=100;this.unlocked=['fast'];this.pitchId='fast';this.target=4;this.pending=null;if(saved&&Number.isFinite(saved.points)&&saved.points>=0){this.points=Math.floor(saved.points);if(Number.isFinite(saved.stamina))this.stamina=clamp(saved.stamina,0,100);if(Array.isArray(saved.unlocked))this.unlocked=[...new Set(['fast',...saved.unlocked.filter(id=>PITCHES.some(p=>p.id===id))])];}this.resetInning();}
 get pitch(){return PITCHES.find(p=>p.id===this.pitchId);}get batter(){return BATTERS[this.batterIndex%BATTERS.length];}
 resetInning(){if(this.pending)throw Error('투구가 끝난 뒤 새 이닝을 시작하세요.');this.balls=0;this.strikes=0;this.outs=0;this.runs=0;this.bases=[false,false,false];this.batterIndex=0;this.finished=false;this.previous=null;this.stats={pitches:0,ks:0,hits:0,walks:0,perfect:0};this.log=[];}
 setTarget(cell){if(this.pending)throw Error('투구 중에는 코스를 바꿀 수 없습니다.');if(!Number.isInteger(cell)||cell<0||cell>8)throw Error('목표는 0~8이어야 합니다.');this.target=cell;return {target:ZONES[cell]};}
 selectPitch(id){if(this.pending)throw Error('투구 중에는 구종을 바꿀 수 없습니다.');if(!this.unlocked.includes(id))throw Error('아직 배우지 않은 구종입니다.');this.pitchId=id;return {pitch:this.pitch.full};}
 learn(id){if(this.pending)throw Error('투구가 끝난 뒤 코칭을 받으세요.');const p=PITCHES.find(p=>p.id===id);if(!p||p.cost===0)throw Error('배울 수 없는 구종입니다.');if(this.unlocked.includes(id))throw Error('이미 배운 구종입니다.');if(this.points<p.cost)throw Error('포인트가 부족합니다.');this.points-=p.cost;this.unlocked.push(id);this.pitchId=id;return {pitch:p.full,points:this.points};}
 rest(){if(this.pending)throw Error('투구 중에는 휴식할 수 없습니다.');this.stamina=Math.min(100,this.stamina+30);return this.stamina;}
 prepare(position,missed=false){if(this.finished)throw Error('이닝이 종료되었습니다. 새 이닝을 시작하세요.');if(this.pending)throw Error('이미 투구 중입니다.');if(!Number.isFinite(position)||position<0||position>1)throw Error('잘못된 타이밍입니다.');if(this.stamina<this.pitch.drain)throw Error('스태미너가 부족합니다. 타임을 요청해 휴식하세요.');const p=pitchPhysics(this.pitch,this.stamina,position,this.target,this.rng,missed);p.event=decideBatter(p,this.batter,this,this.previous,this.rng);p.batterName=this.batter.name;p.pitchName=this.pitch.full;p.target=this.target;this.stamina=Math.max(0,this.stamina-this.pitch.drain);this.pending=p;return p;}
 nextBatter(){this.batterIndex++;this.balls=0;this.strikes=0;}
 advance(hit){let scored=0;const next=[false,false,false];for(let i=2;i>=0;i--){if(!this.bases[i])continue;if(i+hit>=3)scored++;else next[i+hit]=true;}if(hit===4)scored++;else next[hit-1]=true;this.bases=next;this.runs+=scored;return scored;}
 walk(){let scored=0;if(this.bases[0]){if(this.bases[1]){if(this.bases[2])scored++;this.bases[2]=true;}this.bases[1]=true;}this.bases[0]=true;this.runs+=scored;return scored;}
 finishPitch(){
  if(!this.pending)throw Error('처리할 투구가 없습니다.');const p=this.pending;this.pending=null;const event=p.event;let call='',detail='',scored=0,pa=false;
  this.stats.pitches++;if(p.grade==='PERFECT')this.stats.perfect++;let reward=(p.grade==='PERFECT'?36:p.grade==='GOOD'?20:6)+Math.floor(p.quality/15);
  if(event.kind==='ball'){this.balls++;call='BALL';detail='타자가 공을 골랐습니다.';if(this.balls===4){scored=this.walk();this.stats.walks++;call='BASE ON BALLS';detail='볼넷 · 타자가 1루로 진루합니다.';pa=true;}}
  else if(event.kind==='calledStrike'||event.kind==='swingStrike'){this.strikes++;reward+=12;call=event.kind==='calledStrike'?'STRIKE':'SWING & MISS';detail=event.kind==='calledStrike'?'루킹 스트라이크.':'헛스윙!';if(this.strikes===3){this.outs++;this.stats.ks++;reward+=50;call='STRIKEOUT';detail='삼진! '+p.batterName+'을 잡았습니다.';pa=true;}}
  else if(event.kind==='foul'){this.strikes=Math.min(2,this.strikes+1);call='FOUL';detail='파울 · 2스트라이크에서는 카운트가 늘지 않습니다.';reward+=8;}
  else if(event.kind==='groundOut'||event.kind==='flyOut'){this.outs++;pa=true;reward+=30;call=event.kind==='groundOut'?'GROUND OUT':'FLY OUT';detail=event.kind==='groundOut'?'내야수가 땅볼을 처리했습니다.':'외야수가 뜬공을 잡았습니다.';}
  else {const amount={single:1,double:2,triple:3,homeRun:4}[event.kind];if(!amount)throw Error('알 수 없는 타격 결과입니다.');scored=this.advance(amount);this.stats.hits++;pa=true;call={single:'SINGLE',double:'DOUBLE',triple:'TRIPLE',homeRun:'HOME RUN'}[event.kind];detail={single:'안타 · 타자가 1루로 진루합니다.',double:'2루타 · 주자가 2개 베이스를 진루합니다.',triple:'3루타 · 타자가 3루로 진루합니다.',homeRun:'홈런! 모든 주자가 홈으로 들어옵니다.'}[event.kind];}
  if(scored)detail+=' '+scored+'실점.';if(pa)this.nextBatter();if(this.outs>=3){this.finished=true;reward+=this.runs===0?100:40;}
  this.points+=reward;this.previous={type:p.type,speed:p.speed};const record={...p,call,detail,reward,scored,pa,number:this.stats.pitches};this.log.unshift(record);this.log=this.log.slice(0,30);return record;
 }
 save(){return {points:this.points,stamina:this.stamina,unlocked:this.unlocked};}
 snapshot(){return {points:this.points,stamina:this.stamina,pitch:this.pitch.full,target:this.target,unlocked:[...this.unlocked],balls:this.balls,strikes:this.strikes,outs:this.outs,runs:this.runs,bases:[...this.bases],finished:this.finished,batter:this.batter.name,stats:{...this.stats}};}
}
const api={Game,PITCHES,BATTERS,ZONES,pitchPhysics,decideBatter};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.BaseballEngine=api;
})(typeof window!=='undefined'?window:globalThis);
