'use strict';
const {Game,PITCHES,ZONES}=window.BaseballEngine;
const $=id=>document.getElementById(id),canvas=$('field'),ctx=canvas.getContext('2d');
let saved=null;try{saved=JSON.parse(localStorage.getItem('pitchlab-v1'));}catch{}
const game=new Game(saved);let phase='idle',meterStart=0,flightStart=0,flightPitch=null,lastImpact=null,hitSoundPlayed=false,releaseSoundPlayed=false,cheerUntil=0,assetsReady=false,assetError=false,frameId=0;
const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const stadium=new Image(),players=new Image();let loaded=0;
stadium.src='assets/stadium.png';players.src='assets/players.png';
for(const img of [stadium,players]){img.onload=()=>{if(++loaded===2){assetsReady=true;render();notice('플레이볼! 코스와 구종을 고르고 첫 공을 던져보세요.');}};img.onerror=()=>{assetError=true;notice('경기장 이미지를 불러오지 못했습니다. 다운로드한 단일 HTML 파일로 다시 열어주세요.');render();};}
// Individual sprite crops keep the broad swing and low catcher poses within their own frames.
const SPRITES=[
 [[55,0,200,418,150],[350,0,205,418,445],[620,0,331,418,785],[952,0,302,418,1147]],
 [[18,418,290,420,165],[325,418,210,420,455],[621,462,412,376,770],[994,440,260,398,1150]],
 [[25,970,250,270,155],[315,974,300,266,470],[674,842,225,398,790],[975,837,275,403,1120]]
];
const ZONE={x:736,y:306,w:77,h:113};
function persist(){try{localStorage.setItem('pitchlab-v1',JSON.stringify(game.save()));}catch{}}
function notice(text){$('notice').textContent=text;}
function dots(id,count,total,type){$(id).innerHTML=Array.from({length:total},(_,i)=>'<em class="'+(i<count?'on ':'')+type+'"></em>').join('');$(id).setAttribute('aria-label',count+' '+type);}
function render(){
 const locked=phase!=='idle'||game.finished;
 $('points').textContent=game.points;$('runs').textContent=game.runs;$('outsText').textContent=game.outs+' OUT';
 dots('ballsDots',game.balls,3,'ball');dots('strikesDots',game.strikes,2,'strike');dots('outsDots',game.outs,3,'out');
 game.bases.forEach((on,i)=>$('base'+(i+1)).classList.toggle('on',on));const runners=game.bases.map((v,i)=>v?(i+1)+'루':null).filter(Boolean);$('baseLabel').textContent=runners.length?runners.join(' · '):'주자 없음';
 $('staminaText').textContent=game.stamina+' / 100';$('staminaBar').style.width=game.stamina+'%';$('staminaBar').style.background=game.stamina<25?'#ff9476':'var(--lime)';
 $('zoneName').textContent=ZONES[game.target];$('targetGrid').innerHTML=ZONES.map((n,i)=>'<button data-target="'+i+'" aria-label="'+n+'" aria-pressed="'+(i===game.target)+'" class="'+(i===game.target?'selected':'')+'" '+(locked?'disabled':'')+'><span>'+(i+1)+'</span></button>').join('');
 $('pitchList').innerHTML=PITCHES.filter(p=>game.unlocked.includes(p.id)).map(p=>'<button data-pitch="'+p.id+'" class="pitch-choice '+(p.id===game.pitchId?'active':'')+'" aria-pressed="'+(p.id===game.pitchId)+'" '+(locked?'disabled':'')+'><b>'+p.name+'</b><small>'+p.cap+' km/h</small></button>').join('');$('pitchCount').textContent=game.unlocked.length+' / 5';$('pitchAdvice').textContent=game.pitch.label+' · 스태미너 −'+game.pitch.drain;
 const batter=game.batter;$('batterName').textContent=batter.name;$('batterRole').textContent=batter.role+' · #'+batter.number;$('batterAdvice').textContent=batter.desc;$('contactBar').style.width=batter.contact*100+'%';$('powerBar').style.width=batter.power*100+'%';
 $('pitchBtn').disabled=!assetsReady||phase==='flight'||game.finished||(phase==='idle'&&game.stamina<game.pitch.drain);$('restBtn').disabled=locked||game.stamina>=100;$('coachOpen').disabled=phase!=='idle';
 $('pitchBtnText').textContent=game.finished?'이닝 종료':phase==='aim'?'지금 릴리스!':phase==='flight'?'투구 중…':'투구 준비';
 $('timingStatus').textContent=game.finished?'COMPLETE':phase==='aim'?'RELEASE!':phase==='flight'?'PITCHING':'READY';
 $('timingTitle').textContent=phase==='aim'?'연두색 중앙에서 한 번 더!':phase==='flight'?'타자와 승부 중…':'완벽한 순간에 던져라.';
 $('fieldHint').textContent=phase==='aim'?'중앙에 맞춰 스페이스 / 버튼':phase==='flight'?game.pitch.full+' · '+ZONES[game.target]:ZONES[game.target]+' · '+game.pitch.full;
 $('sessionStats').textContent=game.stats.pitches+'구 · 삼진 '+game.stats.ks+' · 피안타 '+game.stats.hits;
 $('pitchLog').innerHTML=game.log.slice(0,8).map(r=>'<tr><td>'+r.number+'</td><td>'+r.batterName+'</td><td>'+r.pitchName+'</td><td>'+r.speed.toFixed(1)+' km/h</td><td style="color:'+(r.grade==='PERFECT'?'var(--lime)':r.grade==='GOOD'?'var(--blue)':'var(--orange)')+'">'+r.grade+'</td><td>'+r.call+'</td><td style="color:var(--lime)">+'+r.reward+' P</td></tr>').join('');$('logEmpty').hidden=game.log.length>0;
 renderCoach();
}
function renderCoach(){
 $('coachPoints').textContent=game.points+' P';$('coachList').innerHTML=PITCHES.filter(p=>p.cost>0).map(p=>{const known=game.unlocked.includes(p.id);return '<div class="coach-row"><div><strong style="color:'+p.color+'">'+p.full+'</strong><p>'+p.label+'</p><p>최대 '+p.cap+' km/h · 체력 −'+p.drain+'</p></div><button class="buy" data-learn="'+p.id+'" '+(known||game.points<p.cost||phase!=='idle'?'disabled':'')+'>'+(known?'습득 완료':p.cost+' P')+'</button></div>';}).join('');
}
const sound={on:false,audio:null,crowdGain:null,master:null};
function initSound(){if(sound.audio)return;try{const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;const a=sound.audio=new Audio();const master=sound.master=a.createGain();master.gain.value=.6;master.connect(a.destination);const buffer=a.createBuffer(1,a.sampleRate*3,a.sampleRate);const data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*.4;const crowd=a.createBufferSource();crowd.buffer=buffer;crowd.loop=true;const filter=a.createBiquadFilter();filter.type='bandpass';filter.frequency.value=650;filter.Q.value=.65;const g=sound.crowdGain=a.createGain();g.gain.value=0;crowd.connect(filter).connect(g).connect(master);crowd.start();}catch{sound.on=false;}}
function soundNoise(duration,freq,volume,type='lowpass'){if(!sound.on||!sound.audio)return;const a=sound.audio,buffer=a.createBuffer(1,Math.ceil(a.sampleRate*duration),a.sampleRate);const data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1);const node=a.createBufferSource(),filter=a.createBiquadFilter(),gain=a.createGain();node.buffer=buffer;filter.type=type;filter.frequency.value=freq;gain.gain.setValueAtTime(volume,a.currentTime);gain.gain.exponentialRampToValueAtTime(.001,a.currentTime+duration);node.connect(filter).connect(gain).connect(sound.master);node.start();node.stop(a.currentTime+duration);}
function soundTone(freq,time,volume){if(!sound.on||!sound.audio)return;const a=sound.audio,o=a.createOscillator(),g=a.createGain();o.type='triangle';o.frequency.value=freq;g.gain.setValueAtTime(volume,a.currentTime);g.gain.exponentialRampToValueAtTime(.001,a.currentTime+time);o.connect(g).connect(sound.master);o.start();o.stop(a.currentTime+time);}
function cheer(duration=1700){cheerUntil=performance.now()+duration;if(sound.on&&sound.crowdGain){const a=sound.audio;const gain=sound.crowdGain.gain;gain.cancelScheduledValues(a.currentTime);gain.setValueAtTime(.12,a.currentTime);gain.linearRampToValueAtTime(.026,a.currentTime+duration/1000);}}
function beginPitch(){
 if(phase!=='idle'||game.finished||!assetsReady||$('coachDialog').open)return;
 if(game.stamina<game.pitch.drain){notice('스태미너가 부족합니다. 타임 · 휴식을 눌러 회복하세요.');return;}
 if(sound.on){initSound();sound.audio?.resume();}phase='aim';meterStart=performance.now();$('callout').hidden=true;lastImpact=null;$('needle').style.left='0%';notice('게이지가 중앙에 도착하면 한 번 더 누르세요. 놓치면 MISS 투구가 됩니다.');render();soundTone(430,.09,.035);
}
function release(now=performance.now(),missed=false){
 if(phase!=='aim')return;const position=Math.min(1,Math.max(0,(now-meterStart)/1500));
 try{flightPitch=game.prepare(position,missed);}catch(e){phase='idle';notice(e.message);render();return;}
 phase='flight';flightStart=now;hitSoundPlayed=false;releaseSoundPlayed=false;$('needle').style.left=position*100+'%';$('speed').textContent=flightPitch.speed.toFixed(1);$('grade').textContent=flightPitch.grade+' · 구위 '+flightPitch.quality;persist();render();notice(flightPitch.grade==='PERFECT'?'완벽한 릴리스! '+game.pitch.full+'이 목표로 향합니다.':flightPitch.grade==='GOOD'?'좋은 릴리스. 공이 타자에게 향합니다.':'타이밍 MISS! 구속과 제구가 흔들렸습니다.');
}
function finishFlight(){
 if(phase!=='flight'||!game.pending)return;const record=game.finishPitch();phase='idle';flightPitch=null;lastImpact={x:ZONE.x+record.x*ZONE.w,y:ZONE.y+record.y*ZONE.h,at:performance.now(),inside:record.inside};persist();render();$('callTitle').textContent=record.call;$('callDetail').textContent=record.detail+' +'+record.reward+' P';$('callout').classList.toggle('contact',['single','double','triple','homeRun','ball'].includes(record.event.kind));$('callout').hidden=false;notice(record.detail+' +'+record.reward+' P');
 if(record.pa||record.event.kind==='foul')cheer(record.call==='STRIKEOUT'||record.call==='HOME RUN'?2200:1200);
 if(game.finished){$('endTitle').textContent=game.runs===0?'무실점 이닝!':'이닝 종료';$('endSummary').textContent='오렌지 폭스를 상대로 '+game.stats.pitches+'구 · '+game.runs+'실점';$('endStats').innerHTML='<div><strong>'+game.stats.ks+'</strong><span>삼진</span></div><div><strong>'+game.stats.hits+'</strong><span>피안타</span></div><div><strong>'+game.stats.perfect+'</strong><span>PERFECT</span></div>';$('endPanel').hidden=false;}
}
function action(){if(phase==='idle')beginPitch();else if(phase==='aim')release();}
function shadow(x,y,rx,ry){ctx.save();ctx.fillStyle='#11281a55';ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fill();ctx.restore();}
function sprite(row,col,x,foot,scale,mirror=false,bob=0,alpha=1){const [sx,sy,sw,sh,anchor]=SPRITES[row][col];ctx.save();ctx.globalAlpha=alpha;ctx.translate(x,foot+bob);if(mirror)ctx.scale(-1,1);ctx.drawImage(players,sx,sy,sw,sh,-(anchor-sx)*scale,-sh*scale,sw*scale,sh*scale);ctx.restore();}
function drawZone(now,fade=1){
 ctx.save();ctx.globalAlpha=fade;ctx.fillStyle='#101e3266';ctx.fillRect(ZONE.x,ZONE.y,ZONE.w,ZONE.h);ctx.strokeStyle='#eefbd6b0';ctx.lineWidth=1.3;ctx.strokeRect(ZONE.x,ZONE.y,ZONE.w,ZONE.h);for(let i=1;i<3;i++){ctx.beginPath();ctx.moveTo(ZONE.x+i*ZONE.w/3,ZONE.y);ctx.lineTo(ZONE.x+i*ZONE.w/3,ZONE.y+ZONE.h);ctx.moveTo(ZONE.x,ZONE.y+i*ZONE.h/3);ctx.lineTo(ZONE.x+ZONE.w,ZONE.y+i*ZONE.h/3);ctx.stroke();}const tx=ZONE.x+game.target%3*ZONE.w/3,ty=ZONE.y+Math.floor(game.target/3)*ZONE.h/3;ctx.fillStyle='#dfff7c44';ctx.fillRect(tx,ty,ZONE.w/3,ZONE.h/3);ctx.strokeStyle='#dfff7c';ctx.lineWidth=2;ctx.strokeRect(tx,ty,ZONE.w/3,ZONE.h/3);const cx=tx+ZONE.w/6,cy=ty+ZONE.h/6;ctx.beginPath();ctx.moveTo(cx-6,cy);ctx.lineTo(cx+6,cy);ctx.moveTo(cx,cy-6);ctx.lineTo(cx,cy+6);ctx.stroke();ctx.restore();
}
function drawBall(x,y,r=5,alpha=1){ctx.save();ctx.globalAlpha=alpha;ctx.shadowColor='#ffffffaa';ctx.shadowBlur=8;ctx.fillStyle='#fffced';ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;ctx.strokeStyle='#df5e52';ctx.lineWidth=.8;ctx.beginPath();ctx.arc(x-1,y,r*.6,-.8,.8);ctx.stroke();ctx.restore();}
function flightPosition(u,p){const type=PITCHES.find(t=>t.id===p.type),endX=ZONE.x+p.x*ZONE.w,endY=ZONE.y+p.y*ZONE.h;const breakStrength=p.quality/75,bend=Math.sin(Math.PI*u)*breakStrength;return {x:455+(endX-455)*u+type.breakX*120*bend,y:400+(endY-400)*u-55*Math.sin(Math.PI*u)-type.breakY*110*bend};}
function drawField(now){
 ctx.clearRect(0,0,1200,700);
 if(!assetsReady){ctx.fillStyle='#112630';ctx.fillRect(0,0,1200,700);ctx.fillStyle='#dfff7c';ctx.textAlign='center';ctx.font='24px system-ui';ctx.fillText(assetError?'이미지를 불러오지 못했습니다':'경기장 준비 중…',600,350);return;}
 ctx.drawImage(stadium,0,0,1200,700);
 // Small waves move actual spectator sections; no artificial audience sprites are added.
 if(!reducedMotion){const cheering=now<cheerUntil;for(let i=0;i<8;i++){const sx=i*192,dy=Math.sin(now/(cheering?105:430)+i*.9)*(cheering?3.3:.65);ctx.drawImage(stadium,sx,180,192,360,i*150,180/1024*700+dy,150,360/1024*700);}}
 let pitcherFrame=0,batterFrame=0,catcherFrame=0;
 const idleBob=reducedMotion?0:Math.sin(now/420)*1.2;
 if(phase==='aim')pitcherFrame=(now-meterStart)>260?1:0;
 let t=0;if(phase==='flight'){t=(now-flightStart)/1000;pitcherFrame=t<.22?1:t<.59?2:3;if(flightPitch.event.swing)batterFrame=t<.76?0:t<1.13?1:t<1.40?2:3;catcherFrame=t<1.24?0:flightPitch.event.contact?2:1;}
 else if(lastImpact&&now-lastImpact.at<650){catcherFrame=game.log[0]?.call==='STRIKEOUT'?3:1;}
 shadow(390,610,75,13);shadow(676,425,42,8);shadow(810,433,34,7);
 sprite(2,catcherFrame,811,433,.40,false,phase==='idle'?idleBob*.5:0);
 sprite(1,batterFrame,676,425,.43,true,phase==='idle'?idleBob:0);
 drawZone(now,phase==='flight'?.58:.9);
 sprite(0,pitcherFrame,390+(phase==='flight'?Math.min(1,t)*18:0),610,.67,false,phase==='idle'?idleBob:0);
 if(phase==='flight'){
  if(t>.38&&!releaseSoundPlayed){releaseSoundPlayed=true;soundNoise(.22,2100,.07,'bandpass');}
  const u=Math.max(0,Math.min(1,(t-.38)/.86));
  if(t>=.38&&t<=1.24){for(let k=4;k>=0;k--){const q=flightPosition(Math.max(0,u-k*.033),flightPitch);drawBall(q.x,q.y,5.2-u*1.7,k===0?1:.12*(5-k));}}
  if(t>=1.24&&!hitSoundPlayed){hitSoundPlayed=true;if(flightPitch.event.contact){soundNoise(.1,3400,.34,'highpass');soundTone(840,.09,.10);}else{soundNoise(.10,950,.26);soundTone(170,.09,.12);}}
  if(t>1.24&&flightPitch.event.contact){const v=Math.min(1,(t-1.24)/1.06),kind=flightPitch.event.kind;const ex=ZONE.x+flightPitch.x*ZONE.w,ey=ZONE.y+flightPitch.y*ZONE.h;const isGround=kind==='groundOut'||kind==='single';const endX=kind==='foul'?1180:kind==='homeRun'?80:kind==='double'?85:kind==='triple'?30:260;const endY=isGround?690:kind==='homeRun'?-60:kind==='foul'?110:100;const bx=ex+(endX-ex)*v,by=ey+(endY-ey)*v-(isGround?0:Math.sin(v*Math.PI)*100);drawBall(bx,by,4+v*3,1-v*.45);if(!isGround){ctx.strokeStyle='#ffebbd70';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(bx+18,by+10);ctx.lineTo(bx,by);ctx.stroke();}}
  if(t>=(flightPitch.event.contact?2.65:1.9))finishFlight();
 }
 if(lastImpact&&phase==='idle'&&now-lastImpact.at<2500){ctx.strokeStyle=lastImpact.inside?'#dfff7c':'#ff9a62';ctx.lineWidth=2;ctx.beginPath();ctx.arc(lastImpact.x,lastImpact.y,6,0,Math.PI*2);ctx.stroke();}
}
function frame(now){
 if(phase==='aim'){const pos=Math.min(1,(now-meterStart)/1500);$('needle').style.left=pos*100+'%';if(pos>=1)release(now,true);}
 drawField(now);frameId=requestAnimationFrame(frame);
}
function configTarget(cell){if(phase!=='idle')throw Error('투구가 끝난 뒤 목표를 선택하세요.');const result=game.setTarget(cell);render();return result;}
function configPitch(id){if(phase!=='idle')throw Error('투구가 끝난 뒤 구종을 선택하세요.');const result=game.selectPitch(id);render();return result;}
$('pitchBtn').addEventListener('click',action);
$('targetGrid').addEventListener('click',e=>{const b=e.target.closest('[data-target]');if(b&&!b.disabled)configTarget(Number(b.dataset.target));});
$('pitchList').addEventListener('click',e=>{const b=e.target.closest('[data-pitch]');if(b&&!b.disabled)configPitch(b.dataset.pitch);});
canvas.addEventListener('click',e=>{if(phase!=='idle'||game.finished)return;const rect=canvas.getBoundingClientRect(),x=(e.clientX-rect.left)/rect.width*1200,y=(e.clientY-rect.top)/rect.height*700;if(x>=ZONE.x&&x<ZONE.x+ZONE.w&&y>=ZONE.y&&y<ZONE.y+ZONE.h)configTarget(Math.floor((y-ZONE.y)/ZONE.h*3)*3+Math.floor((x-ZONE.x)/ZONE.w*3));});
$('restBtn').addEventListener('click',()=>{if(phase!=='idle')return;game.rest();persist();render();notice('타임! 스태미너를 30 회복했습니다. 다음 타자와 승부하세요.');});
$('coachOpen').addEventListener('click',()=>{if(phase!=='idle')return;renderCoach();$('coachDialog').showModal();});$('coachClose').addEventListener('click',()=>$('coachDialog').close());
$('coachList').addEventListener('click',e=>{const b=e.target.closest('[data-learn]');if(!b||b.disabled)return;try{const result=game.learn(b.dataset.learn);persist();render();$('coachNotice').textContent=result.pitch+' 습득 완료! 다음 투구에 사용할 수 있습니다.';soundTone(700,.2,.05);}catch(err){$('coachNotice').textContent=err.message;}});
$('nextInning').addEventListener('click',()=>{if(phase!=='idle')return;game.resetInning();game.stamina=100;persist();$('endPanel').hidden=true;$('callout').hidden=true;$('speed').textContent='—';$('grade').textContent='READY TO PITCH';lastImpact=null;render();notice('새 이닝 시작! 포인트와 구종은 유지되고 스태미너가 회복됩니다.');});
$('soundBtn').addEventListener('click',()=>{sound.on=!sound.on;if(sound.on){initSound();if(!sound.audio){notice('이 브라우저는 사운드를 지원하지 않습니다.');sound.on=false;}else{sound.audio.resume();sound.crowdGain.gain.value=.026;}}else if(sound.crowdGain)sound.crowdGain.gain.value=0;$('soundBtn').textContent=sound.on?'사운드 ON':'사운드 OFF';$('soundBtn').setAttribute('aria-pressed',String(sound.on));});
document.addEventListener('keydown',e=>{if(e.repeat||$('coachDialog').open)return;const tag=document.activeElement?.tagName;if(['INPUT','TEXTAREA','SELECT'].includes(tag))return;if(e.code==='Space'){if(tag==='BUTTON'&&document.activeElement!==$('pitchBtn'))return;e.preventDefault();action();}else if(/^[1-9]$/.test(e.key)&&phase==='idle'&&!game.finished){e.preventDefault();configTarget(Number(e.key)-1);}});
document.addEventListener('visibilitychange',()=>{if(document.hidden){if(phase==='aim'){phase='idle';render();notice('화면을 벗어나 투구 준비를 취소했습니다.');}else if(phase==='flight')finishFlight();if(sound.audio)sound.audio.suspend();}else if(sound.on)sound.audio?.resume();});
if(document.modelContext?.registerTool){const lifecycle=new AbortController();const definitions=[{name:'read_baseball_state',description:'현재 야구 경기 카운트, 주자, 스태미너, 포인트와 습득 구종을 읽습니다.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:false},execute:()=>({...game.snapshot(),phase})},{name:'configure_next_pitch',description:'다음 공의 9칸 목표와 배운 구종을 선택합니다. 실제 투구는 사용자가 리듬 타이밍으로 수행합니다.',inputSchema:{type:'object',properties:{cell:{type:'integer',minimum:0,maximum:8},pitch:{type:'string',enum:PITCHES.map(p=>p.id)}},required:['cell','pitch'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute:input=>{if(phase!=='idle'||game.finished)throw Error('투구를 설정할 수 없는 상태입니다.');if(!Number.isInteger(input.cell)||input.cell<0||input.cell>8||!game.unlocked.includes(input.pitch))throw Error('잘못된 목표 또는 배우지 않은 구종입니다.');configTarget(input.cell);configPitch(input.pitch);return {target:ZONES[game.target],pitch:game.pitch.full};}}];for(const def of definitions){try{Promise.resolve(document.modelContext.registerTool(def,{signal:lifecycle.signal})).catch(()=>{});}catch{}}window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});}
render();notice('경기장과 선수 이미지를 준비하고 있습니다.');frameId=requestAnimationFrame(frame);
