'use strict';
const {Game,RULES,W,H,distance,key,MAX_LEVEL}=EnergyFrontier;
const $=id=>document.getElementById(id),canvas=$('map'),ctx=canvas.getContext('2d'),CELL=32;
let game=new Game(),selection=null,tool=null,pipeStart=null,hover=null,paused=true,speed=1,view=0,last=performance.now(),accumulator=0,uiClock=0;
const COLORS=['#52c9f3','#ff8282'];
function notify(message){$('hint').textContent=message;}
function friendly(e){return game.mode==='human'&&e&&e.side===0&&!e.ruin;}
function setTool(t){tool=t;pipeStart=null;notify(t==='pipe'?'铺管模式：点击起点，再点击终点。按住 Shift 可连续追加；Esc 取消。':t==='advance'?'进攻移动：点击目的地，沿途自动停下交战。':t==='rebuild'?'重建模式：点击可见废墟，需工程队施工和持续供能。':`建造${RULES[t]?.name||''}：点击目标位置。Esc 取消。`);renderPanels();}
function bar(label,value,max,energy=false){return `<div class="stat"><span>${label}</span><span>${Math.ceil(value)} / ${max}</span></div><div class="bar ${energy?'energy':''}"><div style="width:${Math.max(0,Math.min(100,value/max*100))}%"></div></div>`;}
function button(label,action,disabled=false){const b=document.createElement('button');b.textContent=label;b.disabled=disabled;b.onclick=action;return b;}
function renderPanels(){
 const time=Math.floor(game.time);$('clock').textContent=`${String(Math.floor(time/60)).padStart(2,'0')}:${String(time%60).padStart(2,'0')}`;$('pause').textContent=paused?'▶ 继续':'Ⅱ 暂停';$('step').disabled=!paused||game.winner!==null;
 $('mode-label').textContent=game.mode==='human'?'指挥模式 · 迷雾':'观战模式';$('seed-label').textContent=`SEED ${game.seed}`;
 $('economy').innerHTML=(game.mode==='human'?[0]:[0,1]).map(side=>{const owned=game.owned(side),sources=owned.filter(e=>e.production&&e.progress===null);return `<div class="faction-card"><div class="resource-row"><span style="color:${COLORS[side]}">${side?'红方':'蓝方'} ${game.mode==='ai'?'· '+game.aiState[side]:''}</span><strong>${Math.floor(sources.reduce((s,e)=>s+e.energy,0))} ⚡</strong></div><div class="resource-row"><span>节点总产出</span><span>+${sources.reduce((s,e)=>s+e.production,0)} / 秒</span></div><div class="resource-row"><span>战斗群 ${owned.filter(e=>e.type==='army').length} / 3</span><span>工程队 ${owned.filter(e=>e.type==='engineer').length} / 2</span></div></div>`;}).join('');
 const e=game.get(selection),visible=e&&(view==='all'||e.side===view||game.canSee(view,e));$('actions').replaceChildren();
 if(!visible){$('selection-kind').textContent='SELECT UNIT';$('selection').innerHTML='<div class="unit-title">等待指令</div><p class="unit-description">点击地图上的单位或建筑查看状态。选择工程队开始建设，选择大本营补充部队。</p>';}
 else{
  $('selection-kind').textContent=e.ruin?'RUINS':e.side===0?'BLUE FORCE':'RED FORCE';const state=e.ruin?'残留废墟 · 可重建 / 清除':e.progress!==null?`施工 ${Math.floor(e.progress/e.buildCost*100)}%` : e.type==='engineer'?e.jobs.length?`施工队列 ${e.jobs.length} 项${e.energy<1?' · 等待供能':''}`:'待命':e.type==='army'?e.energy<2?'缺能 · 低速撤退':e.order?'执行战术指令':'驻守':e.type==='pipe'?e.connected?'管网已连接能源节点':'孤立管段':e.connected?'管网在线':'离网运行';
  $('selection').innerHTML=`<div class="unit-title" style="color:${COLORS[e.side]}">${RULES[e.type].name}${e.ruin?'废墟':e.type==='army'?' · Lv.'+e.level:''}</div><div class="unit-description">${state}</div>${bar('生命值',e.hp,e.ruin?100:e.maxHp)}${e.cap&&!e.ruin?bar('能源库存',e.energy,e.cap,true):''}<div class="metrics"><div>${e.attack}<small>攻击力</small></div><div>${e.armor}<small>防御力</small></div><div>${e.range?e.range.toFixed(2):'—'}<small>攻击射程</small></div></div>${e.type==='army'?`<p class="muted">移速 ${e.speed.toFixed(2)} 格/秒 · 等级 ${e.level}/${MAX_LEVEL}${e.upgrading?`<br>升级投入 ${Math.floor(e.upgrading.paid)} / ${e.upgrading.cost}（离开节点暂停）`:''}</p>`:''}${!e.ruin?`<p class="muted">产出 ${e.progress===null?e.production:0}/秒 · 基础消耗 ${e.drain}/秒${e.attack?' · 射击额外耗能':''}</p>`:''}`;
  if(friendly(e)){
   if(e.type==='hq'){$('actions').append(button('补充战斗群 · 130',()=>notify(game.recruit(0,'army')||'战斗群已部署。')),button('补充工程队 · 70',()=>notify(game.recruit(0,'engineer')||'工程队已部署。')));}
   if(e.type==='army')$('actions').append(button('进攻移动 [A]',()=>setTool('advance')),button(e.upgrading?`升级投入 ${Math.floor(e.upgrading.paid)} / ${e.upgrading.cost}`:e.level>=MAX_LEVEL?'已满级':`升级 · ${game.upgradeCost(e)} 能源`,()=>notify(game.upgrade(e)||(e.upgrading?'已启动分期升级，保持在节点三格内。':'战斗群升级成功。')),!!e.upgrading||e.level>=MAX_LEVEL),button('修复 · 40',()=>notify(game.repair(e)||'已修复 90 生命值。')));
   if(['army','engineer'].includes(e.type))$('actions').append(button('停止 / 驻守',()=>{e.jobs=[];e.order=null;e.path=[];notify('已停止，原地待命。');}));
  }
 }
 document.querySelectorAll('[data-build]').forEach(b=>{b.disabled=!friendly(e)||e.type!=='engineer';b.classList.toggle('active',tool===b.dataset.build);});$('rebuild').disabled=!friendly(e)||e.type!=='engineer';
 $('log').replaceChildren(...game.logs.filter(l=>game.mode==='ai'||l.side===null||l.side===0).slice(0,30).map(l=>{const d=document.createElement('div');d.className='log-entry';const t=document.createElement('time');t.textContent=`${Math.floor(l.time/60)}:${String(Math.floor(l.time%60)).padStart(2,'0')}`;d.append(t,document.createTextNode((l.side!==null?(l.side?'红方 · ':'蓝方 · '):'')+l.text));return d;}));
 if(game.winner!==null){$('banner').hidden=false;$('banner').innerHTML=`${game.winner===0?'蓝方':'红方'}获胜<small>对方大本营已被攻陷 · 点击「新战局」重新部署</small>`;paused=true;}
}
function drawSymbol(e,ghost=false){
 const x=e.x*CELL+16,y=e.y*CELL+16;ctx.save();ctx.translate(x,y);ctx.globalAlpha=ghost?.42:1;const color=COLORS[e.side];ctx.strokeStyle=color;ctx.fillStyle=e.side?'#633b48':'#254858';ctx.lineWidth=2;
 if(e.ruin){ctx.fillStyle='#67656a';ctx.strokeStyle='#a4a0a2';ctx.beginPath();ctx.moveTo(-11,8);ctx.lineTo(-8,-3);ctx.lineTo(-1,1);ctx.lineTo(3,-9);ctx.lineTo(10,7);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();return;}
 if(e.type==='pipe'){ctx.strokeStyle=e.connected?color:'#56616d';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(-5,0);ctx.lineTo(5,0);ctx.moveTo(0,-5);ctx.lineTo(0,5);ctx.stroke();ctx.restore();return;}
 if(e.type==='army'){ctx.beginPath();ctx.moveTo(0,-11);ctx.lineTo(11,8);ctx.lineTo(0,4);ctx.lineTo(-11,8);ctx.closePath();ctx.fill();ctx.stroke();if(e.level>1){ctx.fillStyle=color;ctx.font='bold 8px sans-serif';ctx.fillText(e.level,-2,14);}}
 else if(e.type==='engineer'){ctx.fillRect(-8,-8,16,16);ctx.strokeRect(-8,-8,16,16);ctx.beginPath();ctx.moveTo(-5,0);ctx.lineTo(5,0);ctx.moveTo(0,-5);ctx.lineTo(0,5);ctx.stroke();}
 else if(e.type==='hq'){ctx.beginPath();for(let i=0;i<6;i++){const a=i*Math.PI/3;ctx[i?'lineTo':'moveTo'](Math.cos(a)*13,Math.sin(a)*13);}ctx.closePath();ctx.fill();ctx.stroke();ctx.fillStyle=color;ctx.fillRect(-4,-4,8,8);}
 else if(e.type==='outpost'){ctx.beginPath();ctx.moveTo(0,-11);ctx.lineTo(11,0);ctx.lineTo(0,11);ctx.lineTo(-11,0);ctx.closePath();ctx.fill();ctx.stroke();ctx.fillStyle=color;ctx.fillRect(-3,-3,6,6);}
 else if(e.type==='missile'){ctx.beginPath();ctx.arc(0,0,10,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.beginPath();ctx.moveTo(-5,5);ctx.lineTo(7,-7);ctx.moveTo(1,-7);ctx.lineTo(7,-7);ctx.lineTo(7,-1);ctx.stroke();}
 if(!ghost){ctx.fillStyle='#081019';ctx.fillRect(-12,-18,24,3);ctx.fillStyle=e.hp/e.maxHp<.35?'#ff9a76':'#8cd3af';ctx.fillRect(-12,-18,24*e.hp/e.maxHp,3);if(e.progress!==null){ctx.fillStyle='#e5bc6e';ctx.fillRect(-12,15,24*e.progress/e.buildCost,3);}else if(e.energy<2&&e.cap){ctx.fillStyle='#e5bc6e';ctx.font='bold 12px sans-serif';ctx.fillText('!',11,3);}}
 ctx.restore();
}
function draw(){
 ctx.clearRect(0,0,canvas.width,canvas.height);const vis=view==='all'?null:game.visible[view],seen=view==='all'?null:game.seen[view];
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){const k=key(x,y),t=game.terrain[k],known=!seen||seen.has(k),bright=!vis||vis.has(k);ctx.fillStyle=!known?'#0b1420':t==='mountain'?'#34414b':t==='water'?'#163b4d':t==='resource'?'#294a40':(x+y)%2?'#1b2e36':'#1d3038';ctx.fillRect(x*32,y*32,32,32);ctx.strokeStyle='#a6c6db09';ctx.strokeRect(x*32+.5,y*32+.5,32,32);if(known){ctx.fillStyle=t==='resource'?'#8da97a':t==='water'?'#488098':'#71808b';if(t==='mountain'){ctx.beginPath();ctx.moveTo(x*32+5,y*32+25);ctx.lineTo(x*32+15,y*32+7);ctx.lineTo(x*32+27,y*32+25);ctx.fill();}else if(t==='resource'){ctx.fillRect(x*32+13,y*32+13,6,6);}else if(t==='water'){ctx.font='20px sans-serif';ctx.fillText('≈',x*32+9,y*32+22);}}if(known&&!bright){ctx.fillStyle='#050c16aa';ctx.fillRect(x*32,y*32,32,32);}}
 const visible=e=>view==='all'||e.side===view&&!e.ruin||game.canSee(view,e);
 for(const c of game.components)for(const n of c.nodes){if(!visible(n))continue;for(const m of c.nodes){if(m.id<=n.id||!visible(m)||distance(n,m)>1.01)continue;ctx.strokeStyle=c.active?COLORS[c.side]+'88':'#67737b66';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(n.x*32+16,n.y*32+16);ctx.lineTo(m.x*32+16,m.y*32+16);ctx.stroke();}}
 if(view!=='all')for(const m of game.memory[view].values())if(!vis.has(key(Math.round(m.x),Math.round(m.y)))&&m.side!==view)drawSymbol(m,true);
 const sorted=game.entities.filter(e=>!e.dead&&visible(e)).sort((a,b)=>(a.type==='pipe'?0:a.building?1:2)-(b.type==='pipe'?0:b.building?1:2));for(const e of sorted)drawSymbol(e);
 const e=game.get(selection);if(e&&visible(e)){
  ctx.strokeStyle='#f2e9bc';ctx.lineWidth=2;ctx.strokeRect(e.x*32+1,e.y*32+1,30,30);
  if(e.range){ctx.beginPath();ctx.setLineDash([4,5]);ctx.strokeStyle=COLORS[e.side]+'66';ctx.arc(e.x*32+16,e.y*32+16,e.range*32,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);}
  if(friendly(e)||game.mode==='ai'){
   let route=e.jobs.length?e.jobs:e.path;if(route.length){ctx.strokeStyle='#e6c77b99';ctx.setLineDash([4,5]);ctx.beginPath();ctx.moveTo(e.x*32+16,e.y*32+16);for(const p of route)ctx.lineTo(p.x*32+16,p.y*32+16);ctx.stroke();ctx.setLineDash([]);}
  }
 }
 for(const f of game.effects){if(view!=='all'&&!vis.has(key(Math.round(f.x),Math.round(f.y)))&&!vis.has(key(Math.round(f.tx),Math.round(f.ty))))continue;ctx.strokeStyle=f.missile?'#ffc88b':COLORS[f.side];ctx.lineWidth=f.missile?3:1.5;ctx.beginPath();ctx.moveTo(f.x*32+16,f.y*32+16);ctx.lineTo(f.tx*32+16,f.ty*32+16);ctx.stroke();ctx.fillStyle='#ffe8b6';ctx.beginPath();ctx.arc(f.tx*32+16,f.ty*32+16,4,0,Math.PI*2);ctx.fill();}
 if(hover){ctx.strokeStyle=tool?'#efcc80aa':'#ffffff44';ctx.lineWidth=2;ctx.strokeRect(hover.x*32+1,hover.y*32+1,30,30);if(tool==='pipe'&&pipeStart){const path=game.path(pipeStart,hover)||[];ctx.fillStyle='#eccb7540';for(const p of [pipeStart,...path])ctx.fillRect(p.x*32+6,p.y*32+6,20,20);}if(tool==='outpost'){ctx.strokeStyle='#edc67c66';ctx.setLineDash([4,5]);ctx.beginPath();ctx.arc(hover.x*32+16,hover.y*32+16,6*32,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);}}
}
function position(event){const r=canvas.getBoundingClientRect();return{x:Math.max(0,Math.min(W-1,Math.floor((event.clientX-r.left)/r.width*W))),y:Math.max(0,Math.min(H-1,Math.floor((event.clientY-r.top)/r.height*H)))};}
function pick(p){return game.at(p.x,p.y).filter(e=>view==='all'||e.side===view&&!e.ruin||game.canSee(view,e)).sort((a,b)=>(a.type==='pipe'?2:a.building?1:0)-(b.type==='pipe'?2:b.building?1:0))[0];}
canvas.addEventListener('mousemove',ev=>{hover=position(ev);$('coords').textContent=`坐标 ${hover.x}, ${hover.y}`;});canvas.addEventListener('mouseleave',()=>{hover=null;});
canvas.addEventListener('click',ev=>{
 const p=position(ev),e=game.get(selection);if(tool&&friendly(e)&&game.winner===null){let err;
  if(tool==='advance'){if(!game.order(e,'advance',p))err='目的地不可到达';else tool=null;}
  else if(tool==='pipe'){if(!pipeStart){if(!game.walkable(p.x,p.y)){notify('请选择可通行的管道起点。');return;}pipeStart=p;notify('现在点击终点。');return;}err=game.planPipe(e,pipeStart,p,ev.shiftKey);if(!err){pipeStart=ev.shiftKey?p:null;if(!ev.shiftKey)tool=null;}}
  else if(tool==='rebuild'){const target=game.at(p.x,p.y).find(t=>t.ruin&&game.canSee(0,t));err=target?game.planBuild(e,target.type,p.x,p.y,$('auto-pipe').checked,target.id):'请选择可见的建筑废墟';if(!err)tool=null;}
  else{if(!game.seen[0].has(key(p.x,p.y))){notify('请先派单位探索该区域。');return;}err=game.planBuild(e,tool,p.x,p.y,$('auto-pipe').checked);if(!err)tool=null;}
  notify(err||'指令已下达。缺能时会暂停施工，请保持管网供能。');
 }else{const choices=game.at(p.x,p.y).filter(n=>view==='all'||n.side===view&&!n.ruin||game.canSee(view,n));const current=choices.findIndex(n=>n.id===selection);const picked=current>=0?choices[(current+1)%choices.length]:pick(p);selection=picked?.id||null;tool=null;pipeStart=null;}renderPanels();
});
canvas.addEventListener('contextmenu',ev=>{ev.preventDefault();if(game.winner!==null)return;const p=position(ev),e=game.get(selection),target=pick(p);if(!friendly(e)||!['army','engineer'].includes(e.type))return;tool=null;pipeStart=null;if(e.type==='engineer'&&target&&target.side===e.side&&target.progress!==null){e.jobs=[{kind:'build',type:target.type,x:target.x,y:target.y,targetId:target.id}];e.order=null;e.path=[];notify('已接手未完工建筑。请保持供能。');renderPanels();return;}const kind=e.type==='army'&&target&&(target.side!==e.side||target.ruin)?'attack':'move';const ok=game.order(e,kind,kind==='attack'?target:p);notify(ok?(kind==='attack'?'已指定攻击目标。':'移动指令已下达。'):'目的地不可到达。');renderPanels();});
document.querySelectorAll('[data-build]').forEach(b=>b.onclick=()=>setTool(b.dataset.build));$('rebuild').onclick=()=>setTool('rebuild');
$('pause').onclick=()=>{if(game.winner!==null)return;paused=!paused;renderPanels();};$('step').onclick=()=>{if(!paused)return;for(let i=0;i<10;i++)game.tick(.1);renderPanels();draw();};
$('speed').onchange=()=>{speed=Number($('speed').value);};$('view').onchange=()=>{view=$('view').value==='all'?'all':Number($('view').value);selection=null;renderPanels();};
let wasPaused=true;function openSetup(){wasPaused=paused;paused=true;$('setup').returnValue='';$('setup').showModal();} $('restart').onclick=openSetup;
$('setup').addEventListener('close',()=>{if($('setup').returnValue!=='start'){paused=wasPaused;return;}const seed=Number($('seed').value)||2026;game=new Game({seed,mode:$('mode').value,map:{symmetry:$('map-symmetry').value,mountains:Number($('map-mountains').value),water:Number($('map-water').value),resources:Number($('map-resources').value)}});window.currentGame=game;selection=null;tool=null;pipeStart=null;paused=false;speed=1;accumulator=0;view=game.mode==='ai'?'all':0;$('speed').value='1';$('view').value=String(view);$('view').disabled=game.mode==='human';$('speed').querySelector('[value="8"]').disabled=game.mode==='human';$('banner').hidden=true;notify(`地图已生成：山地 ${game.mapSettings.mountains} 格 / 水域 ${game.mapSettings.water} 格 / 富能源区 ${game.mapSettings.resources} 格。${game.mode==='ai'?'可切换视角、暂停或单步观察。':'左键选择，右键下令，空格暂停。'}`);renderPanels();});
let helpPaused=true;$('help').onclick=()=>{helpPaused=paused;paused=true;$('guide').showModal();};$('close-guide').onclick=()=>$('guide').close();$('guide').addEventListener('close',()=>{paused=helpPaused;renderPanels();});
document.addEventListener('keydown',ev=>{if(document.querySelector('dialog[open]')||['INPUT','SELECT','TEXTAREA'].includes(ev.target.tagName))return;if(ev.code==='Space'){ev.preventDefault();$('pause').click();}if(ev.key==='Escape'){tool=null;pipeStart=null;notify('已取消工具。左键选择，右键下令。');}if(ev.key.toLowerCase()==='a'&&friendly(game.get(selection))&&game.get(selection).type==='army')setTool('advance');});
function frame(now){const delta=Math.min((now-last)/1000,.2);last=now;if(!paused&&!document.querySelector('dialog[open]')){accumulator+=delta*speed;let steps=0;while(accumulator>=.1&&steps++<30){game.tick(.1);accumulator-=.1;}}uiClock+=delta;if(uiClock>.2){renderPanels();uiClock=0;}draw();requestAnimationFrame(frame);}
window.currentGame=game;renderPanels();draw();openSetup();requestAnimationFrame(frame);
