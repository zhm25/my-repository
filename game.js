/* Energy Frontier — dependency-free simulation, shared by browser and tests. */
(function(root){
'use strict';
const W=32,H=22;
const RULES={
 hq:{name:'大本营',hp:800,armor:35,attack:14,range:3.5,rate:1.4,cap:500,production:9,drain:.5,cost:0},
 outpost:{name:'分据点',hp:320,armor:20,cap:220,production:5,drain:.4,cost:240},
 missile:{name:'导弹基地',hp:260,armor:15,attack:29,range:5,rate:2.5,cap:100,drain:.7,cost:180},
 army:{name:'战斗群',hp:210,armor:25,attack:23,range:3.3,rate:1.3,cap:100,drain:.12,cost:130,speed:1.65},
 engineer:{name:'工程队',hp:90,armor:5,cap:60,drain:0,cost:70,speed:1.9},
 pipe:{name:'输能管道',hp:55,armor:0,cap:0,drain:0,cost:4}
};
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),key=(x,y)=>y*W+x;
function rng(seed){let n=seed>>>0;return()=>{n+=0x6D2B79F5;let t=n;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
class Game{
 constructor({seed=2026,mode='human'}={}){
  this.seed=seed;this.mode=mode;this.random=rng(seed);this.time=0;this.entities=[];this.id=1;this.winner=null;this.logs=[];this.effects=[];this.aiClock=0;this.networkClock=0;this.visionClock=0;this.seen=[new Set(),new Set()];this.visible=[new Set(),new Set()];this.memory=[new Map(),new Map()];this.aiState=['发展','发展'];this.terrain=Array(W*H).fill('plain');
  for(let y=1;y<H-1;y++)for(let x=6;x<W/2;x++){
   const r=this.random();let type=r<.10?'mountain':r<.15?'water':r<.23?'resource':'plain';
   if(y===5||y===11||y===17||x===15)type='plain';
   this.terrain[key(x,y)]=type;this.terrain[key(W-1-x,y)]=type;
  }
  for(const [x,y] of [[8,7],[8,15],[13,3],[13,18]]){this.terrain[key(x,y)]='resource';this.terrain[key(W-1-x,y)]='resource';}
  for(let side=0;side<2;side++){
   const x=side?28:3;this.add('hq',side,x,11,{energy:350});this.add('engineer',side,x,12);this.add('army',side,x+(side?-1:1),11);
  }
  this.updateNetwork();this.updateVision();this.log('战局开始：保护大本营，向富能源区扩张。');
 }
 add(type,side,x,y,extra={}){const r=RULES[type];const e={id:this.id++,type,side,x,y,hp:r.hp,maxHp:r.hp,armor:r.armor,attack:r.attack||0,range:r.range||0,cap:r.cap,energy:r.cap,drain:r.drain,production:r.production||0,cooldown:0,level:1,jobs:[],path:[],order:null,connected:false,component:null,dead:false,ruin:false,building:!['army','engineer','pipe'].includes(type),progress:null,...extra};if(type==='outpost'&&this.terrain[key(Math.round(x),Math.round(y))]==='resource')e.production=8;this.entities.push(e);return e;}
 log(text,side=null){this.logs.unshift({time:this.time,text,side});if(this.logs.length>100)this.logs.pop();}
 get(id){return this.entities.find(e=>e.id===id&&!e.dead);}
 owned(side,type){return this.entities.filter(e=>!e.dead&&!e.ruin&&e.side===side&&(!type||e.type===type));}
 walkable(x,y){return x>=0&&y>=0&&x<W&&y<H&&!['mountain','water'].includes(this.terrain[key(x,y)]);}
 at(x,y){return this.entities.filter(e=>!e.dead&&Math.round(e.x)===x&&Math.round(e.y)===y);}
 path(start,end){
  const sx=Math.round(start.x),sy=Math.round(start.y),ex=Math.round(end.x),ey=Math.round(end.y);
  if(!this.walkable(ex,ey))return null;if(sx===ex&&sy===ey)return [];
  const q=[[sx,sy]],prev=new Map([[key(sx,sy),null]]);let i=0;
  while(i<q.length){const [x,y]=q[i++];for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy,k=key(nx,ny);if(!this.walkable(nx,ny)||prev.has(k))continue;prev.set(k,[x,y]);if(nx===ex&&ny===ey){const result=[];let p=[ex,ey];while(p[0]!==sx||p[1]!==sy){result.push({x:p[0],y:p[1]});p=prev.get(key(p[0],p[1]));}return result.reverse();}q.push([nx,ny]);}}return null;
 }
 canSee(side,e){return this.visible[side].has(key(Math.round(e.x),Math.round(e.y)));}
 updateVision(){
  for(let side=0;side<2;side++){
   const vis=new Set();for(const e of this.owned(side)){if(e.type==='pipe'||e.progress!==null)continue;const r=e.type==='army'?6:e.type==='engineer'?4:5;for(let y=Math.max(0,Math.floor(e.y-r));y<=Math.min(H-1,Math.ceil(e.y+r));y++)for(let x=Math.max(0,Math.floor(e.x-r));x<=Math.min(W-1,Math.ceil(e.x+r));x++)if(Math.hypot(e.x-x,e.y-y)<=r)vis.add(key(x,y));}
   this.visible[side]=vis;for(const k of vis)this.seen[side].add(k);
   for(const [id,m]of this.memory[side])if(vis.has(key(Math.round(m.x),Math.round(m.y)))&&!this.get(id))this.memory[side].delete(id);
   for(const e of this.entities)if(!e.dead&&e.building&&vis.has(key(Math.round(e.x),Math.round(e.y))))this.memory[side].set(e.id,{id:e.id,x:e.x,y:e.y,type:e.type,side:e.side,ruin:e.ruin});
  }
 }
 updateNetwork(){
  this.components=[];for(const e of this.entities){e.connected=false;e.component=null;}
  for(let side=0;side<2;side++){
   const nodes=this.owned(side).filter(e=>e.building||e.type==='pipe');const grid=new Map();for(const e of nodes){const k=key(Math.round(e.x),Math.round(e.y));if(!grid.has(k))grid.set(k,[]);grid.get(k).push(e);}
   const visited=new Set();for(const node of nodes){if(visited.has(node.id))continue;const c={side,nodes:[],sources:[],active:false};const q=[node];visited.add(node.id);for(let i=0;i<q.length;i++){const e=q[i];c.nodes.push(e);e.component=c;if(e.production&&e.progress===null)c.sources.push(e);for(const [dx,dy]of [[0,0],[1,0],[-1,0],[0,1],[0,-1]]){const x=Math.round(e.x)+dx,y=Math.round(e.y)+dy;if(x<0||x>=W||y<0||y>=H)continue;for(const n of grid.get(key(x,y))||[])if(!visited.has(n.id)){visited.add(n.id);q.push(n);}}}c.active=c.sources.length>0;for(const n of c.nodes)n.connected=c.active;this.components.push(c);}
  }
 }
 supplyComponent(e){
  let best=null;for(const c of this.components){if(c.side!==e.side||!c.active)continue;for(const n of c.nodes){if(n.progress!==null)continue;const r=n.type==='pipe'?1.3:(n.type==='hq'||n.type==='outpost'?3:0);if(r&&distance(n,e)<=r&&(!best||c.sources.reduce((s,v)=>s+v.energy,0)>best.sources.reduce((s,v)=>s+v.energy,0)))best=c;}}return best;
 }
 energyTick(dt){
  for(const e of this.entities){if(e.dead||e.ruin||e.progress!==null)continue;e.energy=Math.min(e.cap,Math.max(0,e.energy+e.production*dt-e.drain*dt));}
  for(const c of this.components){if(!c.active)continue;let budget=32*dt;const consumers=c.nodes.filter(e=>!e.production&&e.cap>0&&e.progress===null);for(const e of this.owned(c.side).filter(e=>!e.building&&e.type!=='pipe')){if(this.supplyComponent(e)===c)consumers.push(e);}
   consumers.sort((a,b)=>(a.type==='engineer'?0:1)-(b.type==='engineer'?0:1)||a.energy/a.cap-b.energy/b.cap);
   for(const e of consumers){let need=Math.min(e.cap-e.energy,12*dt,budget);for(const source of c.sources){const amount=Math.min(need,source.energy);source.energy-=amount;e.energy+=amount;need-=amount;budget-=amount;if(need<=0)break;}}
  }
 }
 validBuild(type,side,x,y,ruinId=null,knownOnly=false){
  if(!this.walkable(x,y))return '山地或水域不能建设';
  const occupants=this.at(x,y).filter(e=>!knownOnly||e.side===side||this.canSee(side,e));
  if(occupants.some(e=>e.id!==ruinId&&(e.building||e.ruin||(e.type==='pipe'&&e.side!==side))))return '此格已被建筑或敌方管道占用';
  if(type==='outpost'&&this.entities.some(e=>!e.dead&&e.id!==ruinId&&['hq','outpost'].includes(e.type)&&distance(e,{x,y})<6&&(!knownOnly||e.side===side||this.canSee(side,e))))return '据点之间至少相距 6 格（废墟也计入）';
  return null;
 }
 planPipe(engineer,start,end,append=false){
  if(!engineer||engineer.type!=='engineer')return '请先选择工程队';const route=this.path(start,end);if(route===null)return '没有可通行路线';if(this.path(engineer,start)===null)return '工程队无法到达起点';
  const jobs=[{kind:'pipe',x:Math.round(start.x),y:Math.round(start.y)},...route.map(p=>({...p,kind:'pipe'}))];if(!append){engineer.jobs=[];engineer.path=[];}engineer.order=null;engineer.jobs.push(...jobs);return null;
 }
 planBuild(engineer,type,x,y,auto=true,ruinId=null){
  if(!engineer||engineer.type!=='engineer')return '请先选择工程队';const side=engineer.side;
  const ruin=ruinId?this.get(ruinId):null;if(ruinId&&(!ruin||!ruin.ruin||ruin.type==='hq'))return '无法重建该目标';
  const err=this.validBuild(type,side,x,y,ruinId,true);if(err)return err;
  if(this.path(engineer,{x,y})===null)return '工程队无法抵达';engineer.jobs=[];engineer.path=[];engineer.order=null;
  if(auto){const sources=this.owned(side).filter(e=>e.production&&e.progress===null).map(e=>({e,path:this.path(e,{x,y})})).filter(v=>v.path!==null).sort((a,b)=>a.path.length-b.path.length);if(!sources.length)return '没有可连接的能源节点';const s=sources[0];this.planPipe(engineer,s.e,{x,y},false);}
  engineer.jobs.push({kind:'build',type,x,y,ruinId,targetId:null});return null;
 }
 order(e,kind,target){if(!e||e.dead||e.ruin||e.building||e.type==='pipe')return false;if(e.order&&e.order.kind===kind&&e.order.targetId===(kind==='attack'?target.id:null)&&distance(e.order,target)<.2)return true;const p=this.path(e,target);if(p===null)return false;e.jobs=[];e.path=p;e.order={kind,x:target.x,y:target.y,targetId:kind==='attack'?target.id:null};return true;}
 move(e,target,dt){
  if(distance(e,target)<.07){e.x=target.x;e.y=target.y;e.path=[];return true;}
  if(!e.path.length)e.path=this.path(e,target)||[];
  if(!e.path.length)return false;const next=e.path[0],d=distance(e,next),speed=RULES[e.type].speed*(e.energy<1?.45:1),step=Math.min(d,speed*dt);if(d){e.x+=(next.x-e.x)/d*step;e.y+=(next.y-e.y)/d*step;}if(e.type==='army')e.energy=Math.max(0,e.energy-.7*step);if(d<=step+.0001)e.path.shift();return distance(e,target)<.07;
 }
 work(e,dt){
  const job=e.jobs[0];if(!job)return;
  if(!this.move(e,job,dt))return;
  if(job.kind==='pipe'){
   const existing=this.at(job.x,job.y);if(existing.some(n=>n.side===e.side&&!n.ruin&&(n.type==='pipe'||n.building))){e.jobs.shift();return;}
   if(existing.some(n=>n.building||n.type==='pipe'||n.ruin)){e.jobs.shift();return;}
   if(e.energy>=4){e.energy-=4;this.add('pipe',e.side,job.x,job.y);e.jobs.shift();this.networkClock=0;}return;
  }
  if(job.kind==='build'){
   let target=job.targetId?this.get(job.targetId):null;
   if(job.targetId&&(!target||target.ruin||target.side!==e.side)){e.jobs.shift();this.log('施工目标已失效，工程队等待新指令。',e.side);return;}
   if(!target){const error=this.validBuild(job.type,e.side,job.x,job.y,job.ruinId);if(error){e.jobs.shift();this.log('施工取消：'+error,e.side);return;}
    if(job.ruinId){target=this.get(job.ruinId);if(!target||!target.ruin){e.jobs.shift();return;}Object.assign(target,{side:e.side,ruin:false,hp:30,progress:0,energy:0,buildCost:RULES[job.type].cost*.6});}
    else target=this.add(job.type,e.side,job.x,job.y,{hp:30,energy:0,progress:0,buildCost:RULES[job.type].cost});
    job.targetId=target.id;this.networkClock=0;
   }
   const spent=Math.min(12*dt,e.energy,target.buildCost-target.progress);e.energy-=spent;target.progress+=spent;target.hp=Math.min(target.maxHp,target.hp+spent/target.buildCost*(target.maxHp-30));
   if(target.progress>=target.buildCost-.001){target.progress=null;e.jobs.shift();this.networkClock=0;this.log(RULES[target.type].name+'建设完成。',e.side);}
  }
 }
 recruit(side,type){const hq=this.owned(side,'hq')[0],max=type==='army'?3:2;if(!hq)return '大本营不存在';if(this.owned(side,type).length>=max)return '已达到单位上限';if(hq.energy<RULES[type].cost)return '大本营能源不足';hq.energy-=RULES[type].cost;this.add(type,side,hq.x+(side?-1:1),hq.y+1);this.log('增援 '+RULES[type].name+' 已部署。',side);return null;}
 upgrade(e){if(!e||e.type!=='army')return '请选择战斗群';if(e.level>=5)return '已达到最高等级';const base=this.owned(e.side).find(n=>n.production&&n.progress===null&&distance(n,e)<=3&&n.energy>=90);if(!base)return '需要靠近库存至少 90 的己方能源节点';base.energy-=90;e.level++;e.maxHp+=40;e.hp=Math.min(e.maxHp,e.hp+40);e.attack+=6;e.armor+=8;e.cap+=15;return null;}
 repair(e){const base=this.owned(e.side).find(n=>n.production&&n.progress===null&&distance(n,e)<=3&&n.energy>=40);if(!base)return '需要靠近库存至少 40 的己方能源节点';if(e.hp>=e.maxHp)return '生命值已满';base.energy-=40;e.hp=Math.min(e.maxHp,e.hp+90);return null;}
 lineOfSight(a,b){const n=Math.ceil(distance(a,b)*3);for(let i=1;i<n;i++){const x=Math.round(a.x+(b.x-a.x)*i/n),y=Math.round(a.y+(b.y-a.y)*i/n);if(this.terrain[key(x,y)]==='mountain')return false;}return true;}
 canFire(e,t){return t&&!t.dead&&distance(e,t)<=e.range&&this.canSee(e.side,t)&&(e.type==='missile'||this.lineOfSight(e,t));}
 autoTarget(e){return this.entities.filter(t=>!t.dead&&!t.ruin&&t.side!==e.side&&['army','missile','hq'].includes(t.type)&&this.canFire(e,t)).sort((a,b)=>(a.type==='army'?0:1)-(b.type==='army'?0:1)||distance(e,a)-distance(e,b))[0];}
 damage(target,amount,attacker){if(target.dead)return;target.hp-=amount*100/(100+target.armor);if(target.hp>0)return;target.hp=0;if(target.ruin){target.dead=true;this.log('一处废墟已清除。',attacker.side);}else if(target.building){target.ruin=true;target.hp=100;target.energy=0;target.progress=null;target.connected=false;target.component=null;this.log(RULES[target.type].name+'被摧毁，留下废墟。',target.side);if(target.type==='hq'){this.winner=1-target.side;this.log((this.winner===0?'蓝方':'红方')+'攻陷大本营，获得胜利！');}}else{target.dead=true;if(target.type!=='pipe')this.log(RULES[target.type].name+'已损失。',target.side);}this.networkClock=0;}
 tick(dt){
  if(this.winner!==null)return;this.time+=dt;this.networkClock-=dt;this.visionClock-=dt;if(this.networkClock<=0){this.updateNetwork();this.networkClock=.4;}if(this.visionClock<=0){this.updateVision();this.visionClock=.25;}this.energyTick(dt);
  for(const e of this.entities){if(e.dead||e.ruin||e.progress!==null)continue;e.cooldown=Math.max(0,e.cooldown-dt);
   if(e.type==='engineer'){if(e.jobs.length)this.work(e,dt);else if(e.order&&this.move(e,e.order,dt))e.order=null;continue;}
   if(!e.attack)continue;let target=null;
   if(e.order?.kind==='attack'){const t=this.get(e.order.targetId);if(!t||(!this.canSee(e.side,t)&&!t.building)){e.order=null;e.path=[];}else if(this.canSee(e.side,t)){target=t;e.order.x=t.x;e.order.y=t.y;}}
   const explicit=target;const auto=this.autoTarget(e);if(!target||!this.canFire(e,target))target=auto;
   if(target&&this.canFire(e,target)&&e.energy>=2&&e.cooldown===0){const cost=e.type==='missile'?5:2;if(e.energy>=cost){e.energy-=cost;e.cooldown=RULES[e.type].rate;this.effects.push({x:e.x,y:e.y,tx:target.x,ty:target.y,side:e.side,ttl:.24,missile:e.type==='missile'});this.damage(target,e.attack,e);if(this.winner!==null)break;}}
   if(e.type==='army'&&e.order){const halt=(e.order.kind==='attack'&&explicit&&this.canFire(e,explicit))||(e.order.kind==='advance'&&target&&this.canFire(e,target)&&e.energy>=2);if(!halt){const arrived=this.move(e,e.order,dt);if(arrived&&e.order.kind!=='attack')e.order=null;}}
  }
  this.effects=this.effects.filter(f=>(f.ttl-=dt)>0);this.aiClock-=dt;if(this.aiClock<=0){for(let side=0;side<2;side++)if(this.mode==='ai'||side===1)this.think(side);this.aiClock=2;}
  if(this.entities.length>450)this.entities=this.entities.filter(e=>!e.dead);
 }
 think(side){
  const hq=this.owned(side,'hq')[0];if(!hq)return;let armies=this.owned(side,'army');const engineers=this.owned(side,'engineer');const enemies=this.entities.filter(e=>!e.dead&&!e.ruin&&e.side!==side&&this.canSee(side,e));const threat=enemies.filter(e=>e.type==='army'&&distance(e,hq)<8).sort((a,b)=>distance(a,hq)-distance(b,hq))[0];
  if(armies.length<3&&hq.energy>RULES.army.cost+30)this.recruit(side,'army');if(!engineers.length&&hq.energy>70)this.recruit(side,'engineer');
  const nodes=this.owned(side).filter(e=>e.production&&e.progress===null);
  for(const eng of engineers){
   if(eng.jobs.length){
    if(eng.energy<4&&!this.supplyComponent(eng)){
     eng.stalled=(eng.stalled||0)+2;
     if(eng.stalled>=8){const remaining=eng.jobs.slice();const destination={x:Math.round(eng.x),y:Math.round(eng.y)};const source=[...nodes].sort((a,b)=>distance(a,eng)-distance(b,eng))[0];if(source){this.planPipe(eng,source,destination);eng.jobs.push(...remaining);}eng.stalled=0;}
    }else eng.stalled=0;
    continue;
   }
   const damagedNetwork=this.owned(side).filter(e=>e.type==='missile'&&!e.connected&&e.progress===null)[0];
   if(damagedNetwork){this.planBuildConnection(eng,damagedNetwork);continue;}
   const unfinished=this.owned(side).find(e=>e.progress!==null);if(unfinished){eng.jobs=[{kind:'build',type:unfinished.type,x:unfinished.x,y:unfinished.y,targetId:unfinished.id}];eng.path=[];continue;}
   const ruin=this.entities.find(e=>!e.dead&&e.ruin&&e.type!=='hq'&&this.canSee(side,e)&&nodes.some(n=>distance(n,e)<10));
   if(ruin&&!enemies.some(e=>e.type==='army'&&distance(e,ruin)<5)){this.planBuild(eng,ruin.type,ruin.x,ruin.y,true,ruin.id);continue;}
   if(nodes.length<4){const candidates=[];for(let y=1;y<H-1;y++)for(let x=2;x<W-2;x++){if(this.validBuild('outpost',side,x,y,null,true))continue;const d=Math.min(...nodes.map(n=>distance(n,{x,y})));if(d>10||d<6)continue;const progress=side?W-1-x:x;if(progress>22)continue;const score=(this.terrain[key(x,y)]==='resource'?12:0)+progress*.25-d*.5; candidates.push({x,y,score});}candidates.sort((a,b)=>b.score-a.score);for(const p of candidates){if(!this.planBuild(eng,'outpost',p.x,p.y,true))break;}if(eng.jobs.length)continue;}
   for(const n of [...nodes].reverse()){if(this.owned(side,'missile').some(m=>distance(m,n)<4))continue;const dx=side?-2:2;const spots=[{x:n.x+dx,y:n.y},{x:n.x,y:n.y+2},{x:n.x,y:n.y-2}];const p=spots.find(p=>!this.validBuild('missile',side,p.x,p.y));if(p){this.planBuild(eng,'missile',p.x,p.y,true);break;}}
  }
  armies=this.owned(side,'army');const assault=armies.length>=3||this.time>140;this.aiState[side]=threat?'紧急回防':assault?'集中进攻':'补给 / 扩张';
  for(const a of armies){
   const base=[...nodes].sort((n,m)=>distance(n,a)-distance(m,a))[0];
   if(a.energy<20||a.hp<a.maxHp*.35||a.retreating){a.retreating=true;this.order(a,'move',base);this.repair(a);if(a.energy>a.cap*.8&&a.hp>a.maxHp*.8)a.retreating=false;continue;}
   if(distance(a,base)<=3&&hq.energy>200&&a.level<3)this.upgrade(a);
   if(threat){this.order(a,'attack',threat);continue;}
   if(!assault){this.order(a,'move',{x:hq.x+(side?-2:2),y:hq.y});continue;}
   const targets=enemies.filter(e=>e.building||e.type==='army'||e.type==='pipe').sort((x,y)=>distance(a,x)-distance(a,y));
   const local=targets.find(e=>distance(a,e)<7);if(local)this.order(a,'attack',local);
   else {const remembered=[...this.memory[side].values()].filter(e=>e.side!==side&&!e.ruin);const goal=remembered.find(e=>e.type==='hq')||{x:side?3:28,y:11};this.order(a,'advance',goal);}
  }
 }
 planBuildConnection(e,target){const sources=this.owned(e.side).filter(n=>n.production&&n.progress===null).sort((a,b)=>distance(a,target)-distance(b,target));if(sources[0])this.planPipe(e,sources[0],target);}
}
root.EnergyFrontier={Game,RULES,W,H,distance,key};if(typeof module!=='undefined')module.exports=root.EnergyFrontier;
})(typeof window!=='undefined'?window:globalThis);
