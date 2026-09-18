/* PIXEL PLANETAS
   Você acorda sem nada num planeta redondo. Sobreviva, evolua,
   construa um foguete e explore outros planetas, cada um com seus perigos.
   Mundo com wrap-around (dê a volta e retorna ao mesmo ponto).
   Vanilla JS + Canvas, pixel art procedural. MIT.
*/
(() => {
"use strict";
const $ = (id) => document.getElementById(id);
const canvas = $("game"), ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;
const mini = $("minimap"), mctx = mini.getContext("2d");
mctx.imageSmoothingEnabled = false;

const TILE = 32, WORLD_W = 128, WORLD_H = 128;
const IS_TOUCH = (window.matchMedia && window.matchMedia("(pointer:coarse)").matches) || ("ontouchstart" in window);
const SAVE_KEY = "pixel-planetas-save-v1";
const WPX = WORLD_W * TILE, WPY = WORLD_H * TILE;
let ZOOM = 1.5;

// ---------- utils ----------
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
const rand = (a,b)=>a+Math.random()*(b-a);
const irand = (a,b)=>Math.floor(rand(a,b+1));
const wrap = (v,m)=>((v%m)+m)%m;
// menor diferença com wrap (mundo redondo)
function wdx(a,b,m){ let d=(a-b)%m; if(d>m/2)d-=m; if(d<-m/2)d+=m; return d; }
const wdist = (ax,ay,bx,by)=>Math.hypot(wdx(ax,bx,WPX),wdx(ay,by,WPY));
const angTo = (ax,ay,bx,by)=>Math.atan2(wdx(by,ay,WPY),wdx(bx,ax,WPX));

// ---------- avisos: poucos e importantes ----------
let lastToastAt = 0;
function toast(msg, ms=2400, force){
  const now = performance.now();
  if(!force && now - lastToastAt < 900) return; // evita spam
  lastToastAt = now;
  const w = $("toast-wrap");
  while(w.children.length > 1) w.firstChild.remove();
  const d = document.createElement("div");
  d.className = "toast"; d.textContent = msg;
  w.appendChild(d);
  setTimeout(()=>d.remove(), ms);
}

// ---------- áudio ----------
let audioOn = true, AC=null;
function beep(freq=440, dur=0.08, type="square", vol=0.05){
  if(!audioOn) return;
  try{
    AC = AC || new (window.AudioContext||window.webkitAudioContext)();
    const o = AC.createOscillator(), g = AC.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.value = vol;
    o.connect(g); g.connect(AC.destination);
    o.start(); g.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime + dur);
    o.stop(AC.currentTime + dur);
  }catch(e){}
}
const sfx = {
  hit(){beep(160,0.08,"square")},
  hurt(){beep(110,0.15,"sawtooth")},
  pickup(){beep(660,0.06,"square"); setTimeout(()=>beep(880,0.06,"square"),60)},
  craft(){beep(520,0.08,"triangle"); setTimeout(()=>beep(780,0.1,"triangle"),90)},
  eat(){beep(300,0.09,"triangle")},
  build(){beep(240,0.12,"square")},
  level(){[523,659,784,1046].forEach((f,i)=>setTimeout(()=>beep(f,0.12,"square"),i*100))},
  die(){beep(220,0.3,"sawtooth"); setTimeout(()=>beep(110,0.4,"sawtooth"),200)},
  rocket(){[220,330,440,660,880].forEach((f,i)=>setTimeout(()=>beep(f,0.15,"sawtooth"),i*110))},
};

// ---------- planetas ----------
const PLANETS = [
  { id:"verde", name:"Verde", icon:"🌿", danger:1,
    desc:"Lar tranquilo. Aprenda a sobreviver aqui.",
    dayLen:240, eternalNight:false, hungerMul:1, cold:false, heat:false, xpMul:1, enemyMul:1,
    water:0.38, sand:0.44, rock:0.72, trees:0.10, rocks:0.10, bush:0.035, grass:0.05,
    dayTable:["bee","bee","boar","boar","slime","slime","slime","wolf"],
    nightTable:["skeleton","skeleton","ghost","bat","wolf","wolf","slime","bat"] },
  { id:"areia", name:"Kharos", icon:"🏜️", danger:2,
    desc:"Calor brutal: de dia a fome cai 2x mais rápido. Pouca madeira.",
    dayLen:210, eternalNight:false, hungerMul:1, heat:true, cold:false, xpMul:1.3, enemyMul:1.15,
    water:0.30, sand:0.62, rock:0.74, trees:0.03, rocks:0.16, bush:0.02, grass:0.03,
    dayTable:["scorpion","scorpion","golem","boar","scorpion","slime","golem","wolf"],
    nightTable:["skeleton","skeleton","bat","bat","wolf","scorpion","ghost","wolf"] },
  { id:"gelo", name:"Glacius", icon:"❄️", danger:3,
    desc:"Frio mortal: longe do fogo você congela. Fique perto de fogueira/tocha.",
    dayLen:210, eternalNight:false, hungerMul:1.2, heat:false, cold:true, xpMul:1.6, enemyMul:1.3,
    water:0.36, sand:0.42, rock:0.70, trees:0.07, rocks:0.13, bush:0.02, grass:0.03,
    dayTable:["wolf","wolf","boar","golem","wolf","boar","scorpion","golem"],
    nightTable:["skeleton","ghost","wolf","wolf","bat","skeleton","ghost","shade"] },
  { id:"sombra", name:"Noctis", icon:"🌑", danger:4,
    desc:"Noite eterna. XP em dobro. O Chefão mora aqui.",
    dayLen:240, eternalNight:true, hungerMul:1.3, heat:false, cold:false, xpMul:2, enemyMul:1.5,
    water:0.38, sand:0.45, rock:0.72, trees:0.08, rocks:0.11, bush:0.025, grass:0.04,
    dayTable:["skeleton","ghost","shade","bat","wolf","skeleton","ghost","bat"],
    nightTable:["skeleton","ghost","shade","bat","bat","ghost","shade","wolf"] },
];

// ---------- inimigos ----------
const ETYPES = {
  slime:   {hp:28, dmg:7,  speed:55,  xp:18, range:240, color:"#4ade80", name:"Slime",    nightOnly:false, ghost:false},
  bee:     {hp:20, dmg:6,  speed:135, xp:16, range:300, color:"#facc15", name:"Abelha",   nightOnly:false, ghost:false},
  boar:    {hp:55, dmg:10, speed:95,  xp:34, range:280, color:"#b45309", name:"Javali",   nightOnly:false, ghost:false},
  wolf:    {hp:42, dmg:11, speed:112, xp:30, range:340, color:"#9ca3af", name:"Lobo",     nightOnly:false, ghost:false},
  scorpion:{hp:36, dmg:12, speed:125, xp:34, range:320, color:"#f59e0b", name:"Escorpião",nightOnly:false, ghost:false},
  golem:   {hp:95, dmg:15, speed:45,  xp:55, range:260, color:"#78716c", name:"Golem",    nightOnly:false, ghost:false},
  skeleton:{hp:55, dmg:14, speed:82,  xp:42, range:460, color:"#e5e7eb", name:"Esqueleto",nightOnly:true,  ghost:false},
  ghost:   {hp:42, dmg:16, speed:72,  xp:52, range:500, color:"#c4b5fd", name:"Fantasma", nightOnly:true,  ghost:true},
  bat:     {hp:26, dmg:9,  speed:155, xp:36, range:480, color:"#7c3aed", name:"Morcego",  nightOnly:true,  ghost:false},
  shade:   {hp:64, dmg:18, speed:88,  xp:70, range:520, color:"#4c1d95", name:"Sombra",   nightOnly:true,  ghost:true},
  orc:     {hp:230,dmg:22, speed:72,  xp:200,range:650, color:"#166534", name:"Orc Chefão",nightOnly:true,ghost:false},
};

// ---------- ruído / geração ----------
function hash2(x,y,seed){
  let h = x*374761393 + y*668265263 + seed*1442695041;
  h = (h ^ (h>>13)) * 1274126177;
  return (((h ^ (h>>16)) >>> 0) % 10000) / 10000;
}
function smooth(t){return t*t*(3-2*t)}
function valueNoise(x,y,seed){
  const xi=Math.floor(x), yi=Math.floor(y);
  const xf=x-xi, yf=y-yi;
  const a=hash2(xi,yi,seed), b=hash2(xi+1,yi,seed), c=hash2(xi,yi+1,seed), d=hash2(xi+1,yi+1,seed);
  const u=smooth(xf), v=smooth(yf);
  return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v;
}
function fbm(x,y,seed){
  return valueNoise(x,y,seed)*0.6 + valueNoise(x*2.1+7,y*2.1+3,seed+9)*0.3 + valueNoise(x*4.3,y*4.3,seed+21)*0.1;
}

// tiles: 0 água, 1 areia, 2 grama, 3 floresta, 4 montanha
let tiles = new Uint8Array(WORLD_W*WORLD_H);
function genWorld(seed, P){
  for(let y=0;y<WORLD_H;y++)for(let x=0;x<WORLD_W;x++){
    const e = fbm(x*0.045, y*0.045, seed);
    const m = fbm(x*0.06+100, y*0.06+100, seed+500);
    let t;
    if(e<P.water) t=0;
    else if(e<P.sand) t=1;
    else if(e<0.62) t = m>0.55 ? 3 : 2;
    else if(e<P.rock) t = m>0.45 ? 3 : 2;
    else t=4;
    tiles[y*WORLD_W+x]=t;
  }
}
// mundo redondo: tiles repetem nas bordas
function tileAt(tx,ty){
  tx = wrap(tx, WORLD_W); ty = wrap(ty, WORLD_H);
  return tiles[ty*WORLD_W+tx];
}
function isSolidTile(tx,ty){ const t=tileAt(tx,ty); return t===0||t===4; }

// ---------- estado ----------
let player=null, resources=[], enemies=[], buildings=[], particles=[], floaters=[], drops=[];
let pois=[], critters=[], ambientP=[], sealife=[];
let planetIdx=0, seeds={}, storeBuildings={}, storePOIs={};
let day=1, timeOfDay=0.3, elapsed=0, kills=0;
let gameOver=false, started=false;
let keys={}, mouse={x:0,y:0,wx:0,wy:0};
let touchMove={x:0,y:0,active:false}, touchRun=false;
let cam={x:0,y:0};
let buildMode=null;
let attackAnim=0, hurtFlash=0, coldWarned=0;
const P = ()=>PLANETS[planetIdx];

function newPlayer(x,y){
  return {
    x, y, r:10, hp:100, maxHp:100, hunger:100, stamina:100,
    speed:135, facing:1, moving:false, frame:0, animT:0,
    atk:6, atkCD:0, hurtCD:0, xp:0, level:1, xpNext:60, hand:"none",
    inv:{wood:0, stone:0, fiber:0, fruit:0, raw:0, cooked:0, bandage:0, torch:0, egg:0, fish:0, pearl:0, rod:0, net:0, boat:0},
    tools:{axe:false, sword:0},
    torchLit:false, torchFuel:0, sheltered:false, mounted:null,
    swimming:false, sailing:false, breath:25, breathMax:25, fishing:null, netCD:0,
    buffAtkUntil:0, buffSpdUntil:0,
    questIdx:0, stats:{wood:0, stone:0, fiber:0, kills:0, craftedTorch:0, boss:false, visited:{verde:true}, chests:0, poisUsed:0, eggs:0, entered:false, companion:false, climbed:false, obelisk:false, fish:0, pearls:0},
    dead:false
  };
}
function findSpawn(){
  for(let i=0;i<2000;i++){
    const tx=irand(0,WORLD_W-1), ty=irand(0,WORLD_H-1);
    const t=tileAt(tx,ty);
    if(t===2||t===3) return {x:tx*TILE+TILE/2, y:ty*TILE+TILE/2};
  }
  return {x:WPX/2, y:WPY/2};
}
function treeVariant(id){
  const r=Math.random();
  if(id==="verde") return r<0.45?"oak":r<0.75?"pine":"birch";
  if(id==="areia") return r<0.5?"cactus":r<0.8?"palm":"dead";
  if(id==="gelo") return r<0.6?"snowpine":"icetree";
  return r<0.4?"shroomtree":r<0.7?"twisted":"crystaltree";
}
function bushVariant(id){
  const r=Math.random();
  if(id==="sombra") return r<0.5?"glowshroom":"darkberry";
  if(id==="gelo") return r<0.5?"frostberry":"iceherb";
  if(id==="areia") return r<0.5?"drybush":"aloevera";
  return r<0.4?"berry":r<0.7?"medical":"flowerbush";
}
function genResources(Pn){
  resources=[]; drops=[]; enemies=[]; particles=[]; floaters=[]; sealife=[];
  for(let y=0;y<WORLD_H;y++)for(let x=0;x<WORLD_W;x++){
    const t=tileAt(x,y), r=Math.random();
    if(t===3 && r<Pn.trees) resources.push({tx:x,ty:y,kind:"tree",hp:3,maxHp:3,v:treeVariant(Pn.id)});
    else if(t===4 && r<Pn.rocks) resources.push({tx:x,ty:y,kind:"rock",hp:4,maxHp:4});
    else if(t===2 && r<Pn.bush) resources.push({tx:x,ty:y,kind:"bush",hp:1,maxHp:1,berries:irand(2,4),v:bushVariant(Pn.id)});
    else if((t===2||t===3) && r>=Pn.bush && r<Pn.bush+Pn.grass) resources.push({tx:x,ty:y,kind:"grass",hp:1,maxHp:1});
    // fundo do mar: algas, ostras (pérola!) e corais
    if(t===0){
      if(r<0.045) resources.push({tx:x,ty:y,kind:"kelp",hp:1,maxHp:1});
      else if(r<0.06) resources.push({tx:x,ty:y,kind:"clam",hp:1,maxHp:1});
      else if(r<0.07) resources.push({tx:x,ty:y,kind:"coral",hp:1,maxHp:1});
    }
  }
}
// ---------- POIs: coisas interessantes no mundo ----------
function isNight(){ if(P().eternalNight) return true; return timeOfDay<0.22 || timeOfDay>0.78; }
function randWalkableSpot(){
  for(let i=0;i<60;i++){
    const tx=irand(0,WORLD_W-1), ty=irand(0,WORLD_H-1);
    const t=tileAt(tx,ty);
    if(t===2||t===3||t===1){
      if(resources.some(r=>r.tx===tx&&r.ty===ty)) continue;
      if(buildings.some(b=>b.tx===tx&&b.ty===ty)) continue;
      if(pois.some(p=>Math.abs(p.tx-tx)+Math.abs(p.ty-ty)<3)) continue;
      return {tx,ty};
    }
  }
  return null;
}
const CRITTER_HP={chicken:15,chick:8,pig:30,rabbit:12,bird:10,squirrel:12};
function genPOIs(Pn){
  pois=[]; critters=[]; ambientP=[];
  const id=Pn.id;
  const nChest=id==="sombra"?16:14, nCrys=id==="gelo"?22:18, nHerb=22, nOb=5, nRuin=8;
  const put=(kind,n)=>{
    for(let i=0;i<n;i++){
      const s=randWalkableSpot(); if(!s) continue;
      pois.push({kind,tx:s.tx,ty:s.ty,cd:0,seed:Math.random()*10});
    }
  };
  put("chest",nChest); put("crystal",nCrys); put("herb",nHerb); put("obelisk",nOb); put("ruin",nRuin);
  // cavernas: na borda das montanhas
  for(let i=0;i<4;i++){
    const s=randCaveSpot(); if(!s) continue;
    pois.push({kind:"cave",tx:s.tx,ty:s.ty,cd:0,seed:Math.random()*10,looted:false});
  }
  // bichinhos iniciais
  for(let i=0;i<10;i++) spawnCritter(true);
  if(id==="verde"||id==="areia"){ for(let i=0;i<3;i++) spawnAnimalAt("horse"); for(let i=0;i<2;i++) spawnAnimalAt("dog"); }
  if(id==="verde"){ for(let i=0;i<4;i++) spawnAnimalAt("chicken"); for(let i=0;i<3;i++) spawnAnimalAt("chick"); for(let i=0;i<3;i++) spawnAnimalAt("pig"); }
}
function randCaveSpot(){
  for(let i=0;i<80;i++){
    const tx=irand(0,WORLD_W-1), ty=irand(0,WORLD_H-1);
    if(tileAt(tx,ty)!==4) continue;
    // entrada: vizinho andável
    const dirs=[[1,0],[-1,0],[0,1],[0,-1]];
    for(const [ox,oy] of dirs){
      const nx=wrap(tx+ox,WORLD_W), ny=wrap(ty+oy,WORLD_H);
      const t=tileAt(nx,ny);
      if((t===2||t===3||t===1)&&!resources.some(r=>r.tx===nx&&r.ty===ny)&&!pois.some(p=>Math.abs(p.tx-nx)+Math.abs(p.ty-ny)<4))
        return {tx:nx,ty:ny};
    }
  }
  const s=randWalkableSpot(); return s;
}
function spawnAnimalAt(kind){
  const s=randWalkableSpot(); if(!s) return;
  const x=s.tx*TILE+16, y=s.ty*TILE+16;
  const c={kind,x,y,vx:0,vy:0,wt:0,wx:x,wy:y,frame:rand(0,9),flee:false,layT:rand(15,30)};
  if(CRITTER_HP[kind]){ c.hp=CRITTER_HP[kind]; c.maxHp=CRITTER_HP[kind]; }
  if(kind==="horse"){ c.hp=60; c.maxHp=60; }
  critters.push(c);
}
function spawnCritter(anywhere){
  const id=P().id, night=isNight();
  let kind="butterfly";
  const r=Math.random();
  if(id==="gelo") kind=night?(r<0.4?"firefly":r<0.7?"rabbit":r<0.9?"owl":"squirrel"):r<0.3?"penguin":r<0.5?"bird":r<0.7?"rabbit":r<0.85?"squirrel":r<0.95?"chicken":"butterfly";
  else if(id==="areia") kind=night?(r<0.5?"firefly":r<0.8?"rabbit":"owl"):r<0.3?"bird":r<0.5?"rabbit":r<0.65?"squirrel":r<0.8?"chicken":r<0.9?"butterfly":"pig";
  else if(id==="sombra") kind=r<0.45?"firefly":r<0.7?"batty":r<0.85?"rabbit":r<0.95?"squirrel":"chicken";
  else kind=night?(r<0.55?"firefly":r<0.8?"owl":r<0.9?"rabbit":"squirrel"):(r<0.25?"butterfly":r<0.4?"bird":r<0.55?"rabbit":r<0.65?"squirrel":r<0.75?"chicken":r<0.85?"chick":r<0.93?"pig":"bee2");
  const a=rand(0,Math.PI*2), d=anywhere?rand(0,700):rand(380,560);
  const x=wrap(player.x+Math.cos(a)*d,WPX), y=wrap(player.y+Math.sin(a)*d,WPY);
  if(critters.length>26) return;
  const c={kind,x,y,vx:0,vy:0,wt:0,wx:x,wy:y,frame:rand(0,9),flee:false,layT:rand(15,30)};
  if(CRITTER_HP[kind]){ c.hp=CRITTER_HP[kind]; c.maxHp=CRITTER_HP[kind]; }
  critters.push(c);
}
function nearestPOI(maxD){
  let best=null,bd=maxD;
  for(const p of pois){
    if(p.cd>0 && (p.kind==="obelisk"||p.kind==="ruin")) continue;
    const d=wdist(player.x,player.y,p.tx*TILE+16,p.ty*TILE+16);
    if(d<bd){bd=d;best=p;}
  }
  return best;
}
function poiLabel(p){
  return {chest:"🎁 baú",crystal:"🔮 cristal",herb:p&&P().id==="sombra"?"🍄 cogumelo":p&&P().id==="gelo"?"🌿 erva do gelo":"🌿 erva",obelisk:"🗿 obelisco",ruin:"🏛️ ruína",cave:"🕳️ caverna"}[p.kind]||"✨";
}
const RUIN_LORE=[
  "“Eles vieram das estrelas e ficaram…”",
  "“O Chefão dorme onde nunca amanhece.”",
  "“Quem acende a luz, acende a esperança.”",
  "“A volta completa revela o começo.”",
  "“Cristais cantam quando a noite cai.”",
  "“Plante, pesque, explore — sobreviva.”",
];
function interactPOI(p){
  const bx=p.tx*TILE+16, by=p.ty*TILE+16;
  player.stats.poisUsed=(player.stats.poisUsed||0)+1;
  if(p.kind==="chest"){
    // baú: some, volta depois
    pois.splice(pois.indexOf(p),1);
    setTimeout(()=>{ if(started&&!player.dead) pois.push({kind:"chest",...randWalkableSpot()||{tx:10,ty:10},cd:0,seed:Math.random()*10}); },180000);
    const roll=Math.random();
    burst(bx,by,"#ffd166",14); sfx.pickup();
    if(roll<0.3){ const q=irand(2,4); player.inv.cooked+=q; addFloater(bx,by-16,`+${q} 🍗 tesouro!`,"#ffd166"); }
    else if(roll<0.55){ const q=irand(4,7); player.inv.wood+=q; player.inv.stone+=q; addFloater(bx,by-16,`+${q} 🪵🪨`,"#ffd166"); }
    else if(roll<0.75){ player.inv.bandage+=2; player.inv.torch+=1; addFloater(bx,by-16,"+🩹🩹 +🔥","#ffd166"); }
    else { player.inv.fruit+=3; gainXp(30); addFloater(bx,by-16,"+🍒🍒🍒 +XP","#ffd166"); }
    player.stats.chests=(player.stats.chests||0)+1;
    gainXp(20); toast("🎁 Baú aberto!",1800); checkQuests();
  }else if(p.kind==="crystal"){
    pois.splice(pois.indexOf(p),1);
    setTimeout(()=>{ if(started&&!player.dead){ const s=randWalkableSpot(); if(s) pois.push({kind:"crystal",...s,cd:0,seed:Math.random()*10}); } },120000);
    burst(bx,by,"#a855f7",12); sfx.craft();
    const q=irand(15,30);
    gainXp(q); player.torchFuel=Math.min(300,(player.torchFuel||0)+20);
    addFloater(bx,by-16,`+${q} XP 🔮`,"#d8b4fe");
  }else if(p.kind==="herb"){
    pois.splice(pois.indexOf(p),1);
    setTimeout(()=>{ if(started&&!player.dead){ const s=randWalkableSpot(); if(s) pois.push({kind:"herb",...s,cd:0,seed:Math.random()*10}); } },60000);
    burst(bx,by,"#4ade80",10); sfx.pickup();
    if(P().id==="sombra"){ player.inv.fruit+=2; player.hp=clamp(player.hp+10,0,player.maxHp); addFloater(bx,by-16,"+2 🍄","#e9d5ff"); }
    else{ player.inv.fruit+=2; if(Math.random()<0.5)player.inv.bandage++; addFloater(bx,by-16,"+2 🍒 +cura","#86efac"); player.hp=clamp(player.hp+8,0,player.maxHp); }
    gainXp(6);
  }else if(p.kind==="obelisk"){
    p.cd=120;
    burst(bx,by,"#38bdf8",16); sfx.level();
    player.buffAtkUntil=elapsed+90; player.buffSpdUntil=elapsed+90; player.stats.obelisk=true;
    addFloater(bx,by-24,"⚡ Poder ancestral! +ataque +velocidade (90s)","#7dd3fc");
    toast("🗿 Obelisco: +ataque e +velocidade por 90s!",2600,true);
    gainXp(25);
  }else if(p.kind==="ruin"){
    p.cd=60;
    burst(bx,by,"#d6d3d1",8); beep(392,0.15,"triangle");
    addFloater(bx,by-20,RUIN_LORE[irand(0,RUIN_LORE.length-1)],"#e7e5e4");
    gainXp(15); toast("🏛️ Ruína examinada +XP",1800);
  }else if(p.kind==="cave"){
    enterInterior("cave",p,bx,by);
    return;
  }
  updateHUD();
}

// ---------- interiores: tenda, cabana, caverna ----------
let interior=null;
function roomLayout(type){
  if(type==="tent") return {w:220,h:150,furn:[{x:18,y:18,w:58,h:38,label:"bed"},{x:150,y:24,w:40,h:26,label:"lamp"}]};
  if(type==="cabin") return {w:300,h:210,furn:[{x:22,y:24,w:60,h:40,label:"bed"},{x:170,y:60,w:76,h:34,label:"table"},{x:238,y:20,w:38,h:46,label:"fire"}]};
  return {w:340,h:240,furn:[{x:40,y:30,w:26,h:40,label:"crys"},{x:274,y:30,w:26,h:40,label:"crys"}]};
}
function enterInterior(type,src,ex,ey){
  if(player.mounted){ const h=player.mounted; player.mounted=null; h.x=wrap(ex+24,WPX); h.y=wrap(ey,WPY); }
  const L=roomLayout(type);
  interior={type,src,ex,ey,px:L.w/2,py:L.h-40,w:L.w,h:L.h,furn:L.furn,door:{x:L.w/2,y:L.h-10},cookT:0,
    chest:type==="cave"?{x:L.w/2-13,y:26,w:26,h:18}:null};
  player.stats.entered=true;
  sfx.build(); gainXp(10);
  toast(type==="cave"?"🕳️ Caverna: saqueie e saia com E!":type==="tent"?"⛺ Dentro da tenda: protegido 🛡️":"🏠 Dentro da cabana: protegido 🛡️",2600,true);
  updateQuestHUD();
}
function exitInterior(){
  if(!interior) return;
  const {ex,ey}=interior;
  const offs=[[0,26],[20,20],[-20,20],[0,-26],[30,0],[-30,0]];
  for(const [ox,oy] of offs){
    const nx=wrap(ex+ox,WPX), ny=wrap(ey+oy,WPY);
    if(!collidesAt(nx,ny,player.r)){ player.x=nx; player.y=ny; break; }
  }
  interior=null; sfx.build(); updateHUD();
}
function enemiesNearEntrance(maxD){
  if(!interior) return [];
  return enemies.filter(e=>wdist(interior.ex,interior.ey,e.x,e.y)<maxD);
}
function interiorAction(){
  if(!interior) return;
  const I=interior;
  if(I.chest && !I.src.looted && Math.hypot(I.px-(I.chest.x+I.chest.w/2),I.py-(I.chest.y+I.chest.h/2))<34){
    I.src.looted=true;
    burst(I.ex,I.ey,"#ffd166",8); sfx.pickup();
    const roll=Math.random();
    if(roll<0.4){ player.inv.cooked+=2; addFloater(I.ex,I.ey-20,"+2 🍗","#ffd166"); }
    else if(roll<0.7){ player.inv.wood+=5; player.inv.stone+=5; }
    else { player.inv.bandage+=2; player.inv.torch+=1; }
    player.stats.chests=(player.stats.chests||0)+1;
    gainXp(30); toast("🎁 Tesouro da caverna!",2200,true); checkQuests(); updateHUD();
    return;
  }
  if(Math.hypot(I.px-I.door.x,I.py-I.door.y)<30){ exitInterior(); }
}
function interiorUpdate(dt,dx,dy){
  const I=interior;
  // abrigo destruído enquanto dentro? sai
  if((I.type==="tent"||I.type==="cabin")&&!buildings.includes(I.src)){ exitInterior(); return; }
  const sp=player.speed*0.9;
  const len=Math.hypot(dx,dy);
  player.moving=len>0.15;
  if(player.moving){
    if(len>1){dx/=len;dy/=len;}
    if(dx>0.2)player.facing=1; else if(dx<-0.2)player.facing=-1;
    player.animT+=dt*10;
    const tryMove=(nx,ny)=>{
      if(nx<20||ny<20||nx>I.w-20||ny>I.h-16) return false;
      for(const f of I.furn){ if(nx>f.x-8&&nx<f.x+f.w+8&&ny>f.y-4&&ny<f.y+f.h+8) return false; }
      if(I.chest&&nx>I.chest.x-10&&nx<I.chest.x+I.chest.w+10&&ny>I.chest.y-8&&ny<I.chest.y+I.chest.h+10) return false;
      return true;
    };
    if(tryMove(I.px+dx*sp*dt,I.py)) I.px+=dx*sp*dt;
    if(tryMove(I.px,I.py+dy*sp*dt)) I.py+=dy*sp*dt;
  } else player.frame=0;
  player.frame=Math.floor(player.animT)%4;
  // cura de abrigo + fogão da cabana cozinha
  const heal=I.type==="cabin"?8:I.type==="tent"?5:2;
  player.hp=clamp(player.hp+heal*dt,0,player.maxHp);
  if(I.type==="cabin"){
    const f=I.furn.find(f=>f.label==="fire");
    const fx=f.x+f.w/2, fy=f.y+f.h/2;
    if(Math.hypot(I.px-fx,I.py-fy)<70){
      I.cookT+=dt;
      if(I.cookT>6 && player.inv.raw>0){I.cookT=0;player.inv.raw--;player.inv.cooked++;sfx.eat();updateHUD();}
    }
  }
}
function drawInterior(){
  const W=canvas.width,H=canvas.height;
  ctx.fillStyle="#05060f"; ctx.fillRect(0,0,W,H);
  const I=interior, ox=(W-I.w)/2, oy=(H-I.h)/2;
  const X=(x)=>ox+x, Y=(y)=>oy+y;
  // chão
  const floor=I.type==="tent"?"#b45309":I.type==="cabin"?"#92400e":"#44403c";
  const floor2=I.type==="tent"?"#d97706":I.type==="cabin"?"#a16207":"#57534c";
  ctx.fillStyle=floor; ctx.fillRect(ox,oy,I.w,I.h);
  for(let y=0;y<I.h;y+=16)for(let x=0;x<I.w;x+=16){ if(((x+y)/16)%2===0){ ctx.fillStyle=floor2; ctx.fillRect(ox+x,oy+y,16,1); } }
  // tapete
  ctx.fillStyle=I.type==="cave"?"#292524":"#78350f";
  ctx.fillRect(X(I.w/2-40),Y(I.h/2-16),80,40);
  ctx.fillStyle=I.type==="cave"?"#44403c":"#92400e";
  ctx.fillRect(X(I.w/2-40),Y(I.h/2-16),80,4);
  // móveis
  for(const f of I.furn){
    if(f.label==="bed"){
      px(X(f.x),Y(f.y),f.w,f.h,"#78350f");
      px(X(f.x+4),Y(f.y+4),f.w-8,f.h-8,"#f8fafc");
      px(X(f.x+4),Y(f.y+4),f.w-8,10,"#38bdf8");
    }else if(f.label==="table"){
      px(X(f.x),Y(f.y),f.w,f.h,"#573818");
      px(X(f.x+6),Y(f.y+5),20,10,"#fde68a"); px(X(f.x+32),Y(f.y+5),12,12,"#b45309");
    }else if(f.label==="fire"){
      px(X(f.x-6),Y(f.y+f.h-4),f.w+12,10,"#57534c");
      const fl=Math.sin(elapsed*9)*2;
      px(X(f.x+6),Y(f.y+6+fl),f.w-12,f.h-12,"#ef4444");
      px(X(f.x+11),Y(f.y+12+fl),f.w-22,f.h-22,"#f97316");
      px(X(f.x+16),Y(f.y+18+fl),f.w-32,f.h-30,"#fde047");
    }else if(f.label==="lamp"){
      px(X(f.x+16),Y(f.y+8),8,18,"#78350f");
      px(X(f.x+10),Y(f.y)+Math.sin(elapsed*8),20,12,"#f59e0b");
      px(X(f.x+13),Y(f.y+2)+Math.sin(elapsed*8),14,8,"#fde047");
    }else if(f.label==="crys"){
      px(X(f.x+6),Y(f.y+8),14,30,"#0ea5e9"); px(X(f.x+9),Y(f.y),8,12,"#67e8f9");
      px(X(f.x),Y(f.y),f.w,f.h,"rgba(103,232,249,.15)");
    }
  }
  // baú da caverna
  if(I.chest){
    const c=I.chest, opened=I.src.looted;
    px(X(c.x),Y(c.y),c.w,c.h,opened?"#57534c":"#92400e");
    px(X(c.x),Y(c.y),c.w,5,opened?"#78716c":"#fde047");
    if(!opened&&Math.sin(elapsed*4)>0.6){ px(X(c.x+8),Y(c.y-8),8,5,"#fef9c3"); }
  }
  // janela da cabana mostra lá fora (dia/noite)
  if(I.type==="cabin"){
    px(X(30),Y(60),44,30,isNight()?"#0b0e2a":"#7dd3fc");
    px(X(30),Y(60),44,4,"#422006"); px(X(48),Y(60),4,30,"#422006"); px(X(30),Y(72),44,4,"#422006");
    if(isNight()){ px(X(38),Y(66),3,3,"#fff"); px(X(58),Y(70),2,2,"#fff"); }
  }
  // paredes + porta
  ctx.strokeStyle=I.type==="cave"?"#1c1917":"#422006"; ctx.lineWidth=12;
  ctx.strokeRect(ox,oy,I.w,I.h);
  px(X(I.door.x-16),Y(I.h-8),32,12,I.type==="cave"?"#0c0a09":"#292524");
  px(X(I.door.x-16),Y(I.h-8),32,3,"#fde047");
  // 👀 inimigos lá fora nas bordas
  const near=enemiesNearEntrance(520).slice(0,6);
  near.forEach((e,i)=>{
    const ex=ox+30+i*((I.w-60)/Math.max(1,near.length-1||1));
    const bob=Math.sin(elapsed*5+i)*2;
    px(ex-6,oy+16+bob,5,5,"#ef4444"); px(ex+2,oy+16+bob,5,5,"#ef4444");
  });
  // jogador
  drawPlayer(X(I.px),Y(I.py));
  // textos
  ctx.font="bold 13px monospace"; ctx.textAlign="center";
  ctx.fillStyle="#000"; ctx.fillText(I.type==="cave"?"🕳️ CAVERNA":I.type==="tent"?"⛺ TENDA — protegido 🛡️":"🏠 CABANA — protegido 🛡️",W/2+1,oy-10+1);
  ctx.fillStyle="#ffd166"; ctx.fillText(I.type==="cave"?"🕳️ CAVERNA":I.type==="tent"?"⛺ TENDA — protegido 🛡️":"🏠 CABANA — protegido 🛡️",W/2,oy-10);
  if(near.length>0){
    ctx.fillStyle="#000"; ctx.fillText(`👁️ ${near.length} inimigo(s) rondando lá fora`,W/2+1,oy+I.h+20+1);
    ctx.fillStyle="#f87171"; ctx.fillText(`👁️ ${near.length} inimigo(s) rondando lá fora`,W/2,oy+I.h+20);
  }
  ctx.textAlign="left";
}

// ---------- missões (poucas, diretas) ----------
const QUESTS=[
  {t:"Colete 5 🪵 (E nas árvores)", p:()=>clamp(player.stats.wood/5,0,1), d:()=>player.stats.wood>=5, rw:{xp:25,fruit:2}},
  {t:"Colete 4 🪨 (E nas pedras)", p:()=>clamp(player.stats.stone/4,0,1), d:()=>player.stats.stone>=4, rw:{xp:25,fiber:2}},
  {t:"Crie o Machado 🪓 (C)", p:()=>player.tools.axe?1:0, d:()=>player.tools.axe, rw:{xp:30}},
  {t:"Crie Tochas 🔥 e acenda (T)", p:()=>clamp((player.stats.craftedTorch||0),0,1), d:()=>(player.stats.craftedTorch||0)>=1, rw:{xp:30}},
  {t:"Construa Fogueira (B)", p:()=>buildings.some(b=>b.kind==="campfire")?1:0, d:()=>buildings.some(b=>b.kind==="campfire"), rw:{xp:40,cooked:1}},
  {t:"Construa um Abrigo ⛺ (B)", p:()=>buildings.some(b=>b.kind==="tent"||b.kind==="cabin")?1:0, d:()=>buildings.some(b=>b.kind==="tent"||b.kind==="cabin"), rw:{xp:50,bandage:1}},
  {t:"Construa o Foguete 🚀 (B)", p:()=>anyBuilding("rocket")?1:0, d:()=>anyBuilding("rocket"), rw:{xp:60,torch:1}},
  {t:"Viaje a Kharos 🏜️ (E no foguete)", p:()=>player.stats.visited.areia?1:0, d:()=>!!player.stats.visited.areia, rw:{xp:60}},
  {t:"Viaje a Glacius ❄️", p:()=>player.stats.visited.gelo?1:0, d:()=>!!player.stats.visited.gelo, rw:{xp:80,bandage:1}},
  {t:"Abra 3 🎁 baús perdidos (E)", p:()=>clamp((player.stats.chests||0)/3,0,1), d:()=>(player.stats.chests||0)>=3, rw:{xp:80,cooked:1}},
  {t:"Ative um 🗿 obelisco (E)", p:()=>player.stats.obelisk?1:clamp((player.stats.poisUsed||0)/4,0,1), d:()=>!!player.stats.obelisk, rw:{xp:80}},
  {t:"Entre em Noctis 🌑 e vença o Chefão 👑", p:()=>player.stats.boss?1:0, d:()=>!!player.stats.boss, rw:{xp:200}},
  {t:"Entre na Tenda/Cabana 🏠 (E) p/ se proteger", p:()=>player.stats.entered?1:0, d:()=>!!player.stats.entered, rw:{xp:60,bandage:1}},
  {t:"Consiga 3 🥚 ou adote um 🐶 / monte um 🐎", p:()=>player.stats.companion?1:clamp((player.stats.eggs||0)/3,0,1), d:()=>!!player.stats.companion||(player.stats.eggs||0)>=3, rw:{xp:80,cooked:1}},
  {t:"Construa um Barco ⛵ (C)", p:()=>player.inv.boat?1:0, d:()=>!!player.inv.boat, rw:{xp:60,fiber:2}},
  {t:"Pesque 3 🐟 (vara: E na água / tarrafa: R)", p:()=>clamp((player.stats.fish||0)/3,0,1), d:()=>(player.stats.fish||0)>=3, rw:{xp:80,cooked:1}},
  {t:"Mergulhe e ache 1 🦪 pérola (E na água sem barco)", p:()=>clamp((player.stats.pearls||0),0,1), d:()=>(player.stats.pearls||0)>=1, rw:{xp:80,bandage:1}},
];
function anyBuilding(kind){
  if(buildings.some(b=>b.kind===kind)) return true;
  for(const k in storeBuildings) if((storeBuildings[k]||[]).some(b=>b.kind===kind)) return true;
  return false;
}
function checkQuests(){
  if(!player) return;
  let adv=false;
  while(player.questIdx<QUESTS.length && QUESTS[player.questIdx].d()){
    const q=QUESTS[player.questIdx];
    gainXpSilent(q.rw.xp||0);
    for(const k of ["fruit","fiber","wood","stone","cooked","bandage","torch","fish","pearl"])
      if(q.rw[k]) player.inv[k]=(player.inv[k]||0)+q.rw[k];
    toast("🎯 "+QUESTS[player.questIdx].t+" ✓", 2600, true);
    sfx.level();
    player.questIdx++; adv=true;
  }
  if(adv) updateHUD();
  updateQuestHUD();
}
function gainXpSilent(n){
  n = Math.round(n * P().xpMul);
  player.xp+=n;
  while(player.xp>=player.xpNext){
    player.xp-=player.xpNext; player.level++;
    player.xpNext=Math.round(player.xpNext*1.28+10);
    player.maxHp+=20; player.hp=Math.min(player.maxHp,player.hp+40); player.atk+=3;
  }
}
function gainXp(n){
  const before=player.level;
  gainXpSilent(n);
  if(player.level>before){ sfx.level(); toast("⬆️ Nv "+player.level+"! +vida, +ataque", 2200, true); checkQuests(); }
  updateHUD();
}
function updateQuestHUD(){
  const t=$("obj-title"), f=$("obj-fill");
  if(!player||!t) return;
  if(player.questIdx>=QUESTS.length){ t.textContent="👑 Explore os planetas e sobreviva"; f.style.width="100%"; return; }
  const q=QUESTS[player.questIdx];
  t.textContent="🎯 "+q.t;
  f.style.width=(q.p()*100)+"%";
}

// ---------- receitas / construções ----------
const RECIPES=[
  {id:"axe", icon:"🪓", name:"Machado", cost:{wood:3,stone:2}, desc:"Na mão: coleta 2x e +4 dano.", can:()=>!player.tools.axe, apply(){player.tools.axe=true; player.hand="axe";}},
  {id:"sword1", icon:"🗡️", name:"Espada", cost:{wood:2,stone:2}, desc:"Na mão: +10 dano.", can:()=>player.tools.sword<1, apply(){player.tools.sword=1; player.hand="sword1";}},
  {id:"sword2", icon:"⚔️", name:"Espada Afiada", cost:{wood:3,stone:4,fiber:2}, desc:"Na mão: +16 dano. Perto da bancada.", can:()=>player.tools.sword===1, needBench:true, apply(){player.tools.sword=2; player.hand="sword2";}},
  {id:"vest", icon:"🦺", name:"Colete", cost:{fiber:3,wood:2}, desc:"+20 vida máx. Perto da bancada.", needBench:true, apply(){player.maxHp+=20; player.hp=Math.min(player.maxHp,player.hp+20);}},
  {id:"bandage", icon:"🩹", name:"Bandagem x2", cost:{fiber:2}, desc:"Cura 40 cada (Q usa a melhor comida; bandagem pelo 3).", apply(){player.inv.bandage+=2;}},
  {id:"torchkit", icon:"🔥", name:"Tochas x2", cost:{wood:2,fiber:1}, desc:"Luz portátil (T). Cada uma dura 75s.", apply(){player.inv.torch+=2; if(player.torchFuel<=0) player.torchFuel=75;}},
  {id:"campkit", icon:"🔥", name:"Kit Fogueira", cost:{wood:4,stone:2}, desc:"Coloca fogueira ao seu lado.", apply(){addBuildingAuto("campfire");}},
  {id:"tentkit", icon:"⛺", name:"Kit Tenda", cost:{wood:5,fiber:3}, desc:"Abrigo ao seu lado: protege e cura.", apply(){addBuildingAuto("tent");}},
  {id:"rod", icon:"🎣", name:"Vara de Pesca", cost:{wood:3,fiber:2}, desc:"E de frente p/ água p/ pescar.", can:()=>!player.inv.rod, apply(){player.inv.rod=1;}},
  {id:"net", icon:"🕸️", name:"Tarrafa", cost:{fiber:5,wood:1}, desc:"R mirando a água: pega cardumes.", can:()=>!player.inv.net, apply(){player.inv.net=1;}},
  {id:"boat", icon:"⛵", name:"Barco", cost:{wood:10,fiber:4}, desc:"E na margem p/ navegar.", can:()=>!player.inv.boat, apply(){player.inv.boat=1;}},
];
const BUILDS=[
  {id:"wall", icon:"🧱", name:"Parede", cost:{wood:2}, desc:"60 vida. Segura inimigos."},
  {id:"fence", icon:"🪵", name:"Cerca", cost:{wood:1}, desc:"35 vida. Barata."},
  {id:"tent", icon:"⛺", name:"Tenda (abrigo)", cost:{wood:5,fiber:3}, desc:"100 vida. Perto: -40% dano + cura."},
  {id:"cabin", icon:"🏠", name:"Cabana (abrigo+)", cost:{wood:12,stone:6,fiber:4}, desc:"250 vida. -50% dano + cura maior."},
  {id:"workbench", icon:"🛠️", name:"Bancada", cost:{wood:4,stone:2}, desc:"Libera espada afiada e colete."},
  {id:"campfire", icon:"🔥", name:"Fogueira", cost:{wood:4,stone:2}, desc:"Cozinha carne e cura perto."},
  {id:"torch", icon:"🕯️", name:"Tocha no chão", cost:{wood:2,fiber:1}, desc:"Luz fixa. Leve a portátil (T)."},
  {id:"rocket", icon:"🚀", name:"Foguete", cost:{wood:15,stone:10,fiber:6}, desc:"Aperte E ao lado para viajar entre planetas."},
  {id:"deck", icon:"⚓", name:"Deck (píer)", cost:{wood:6}, desc:"Só na água, junto à margem. Ande e embarque.", water:true},
];
function hasCost(c){ for(const k in c) if((player.inv[k]||0)<c[k]) return false; return true; }
function payCost(c){ for(const k in c) player.inv[k]-=c[k]; }
function costText(c){
  const n={wood:"🪵",stone:"🪨",fiber:"🌾",fruit:"🍒",raw:"🥩",cooked:"🍗",bandage:"🩹",torch:"🔥",fish:"🐟",pearl:"🦪",rod:"🎣",net:"🕸️",boat:"⛵"};
  return Object.entries(c).map(([k,v])=>`${n[k]||k}${v}`).join(" ");
}
function nearWorkbench(maxD=90){
  for(const b of buildings){
    if(b.kind!=="workbench") continue;
    if(wdist(player.x,player.y,b.tx*TILE+16,b.ty*TILE+16)<maxD) return true;
  }
  return false;
}

// ---------- construções ----------
function addBuildingAuto(kind){
  const tx=Math.floor(player.x/TILE), ty=Math.floor(player.y/TILE);
  for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1]])
    if(placeBuilding(kind, wrap(tx+dx,WORLD_W), wrap(ty+dy,WORLD_H), true)) return;
}
function placeBuilding(kind, tx, ty, ignoreMode){
  const t=tileAt(tx,ty);
  const isDeck=kind==="deck";
  if(!isDeck && (t===0||t===4)) return false;
  if(isDeck){
    // píer: só sobre a água e junto à margem (terra a 1 tile)
    if(t!==0) return false;
    let shore=false;
    for(const [ox,oy] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const nt=tileAt(wrap(tx+ox,WORLD_W),wrap(ty+oy,WORLD_H));
      if(nt===1||nt===2||nt===3){shore=true;break;}
    }
    if(!shore) return false;
  }
  if(buildings.some(b=>b.tx===tx&&b.ty===ty)) return false;
  const ri=resources.findIndex(r=>r.tx===tx&&r.ty===ty);
  if(ri>=0){
    const rk=resources[ri].kind;
    if(isDeck){
      if(rk==="kelp"||rk==="clam"||rk==="coral") resources.splice(ri,1);
      else return false;
    }
    else if(kind==="rocket"||kind==="tent"||kind==="cabin"||kind==="campfire"||kind==="workbench"){
      if(rk!=="grass") return false;
      resources.splice(ri,1);
    } else if(rk!=="grass") return false;
  }
  const def=BUILDS.find(b=>b.id===kind);
  if(!ignoreMode){
    if(!hasCost(def.cost)) return false;
    payCost(def.cost);
  }
  const B={kind,tx,ty};
  if(kind==="wall"){B.hp=B.maxHp=60;}
  else if(kind==="fence"){B.hp=B.maxHp=35;}
  else if(kind==="workbench"){B.hp=B.maxHp=70;}
  else if(kind==="torch"){B.hp=B.maxHp=30;B.light=170;}
  else if(kind==="campfire"){B.hp=B.maxHp=80;B.light=230;B.cookT=0;}
  else if(kind==="tent"){B.hp=B.maxHp=100;B.light=140;B.shelter=90;B.heal=4;}
  else if(kind==="cabin"){B.hp=B.maxHp=250;B.light=180;B.shelter=120;B.heal=6;}
  else if(kind==="rocket"){B.hp=B.maxHp=150;B.light=120;}
  else if(kind==="deck"){B.hp=B.maxHp=120;}
  buildings.push(B);
  sfx.build(); gainXp(kind==="tent"||kind==="cabin"||kind==="rocket"?12:6); checkQuests(); updateHUD();
  return true;
}
function damageBuilding(b, dmg, byPlayer){
  b.hp-=dmg;
  burst(b.tx*TILE+16,b.ty*TILE+16,"#c08457",4);
  if(b.hp<=0){
    buildings.splice(buildings.indexOf(b),1);
    burst(b.tx*TILE+16,b.ty*TILE+16,"#78716c",12);
    updateHUD();
    // deck quebrou embaixo do player: cai na água (nada, não trava)
    if(b.kind==="deck"&&player&&!player.dead){
      const ptx=Math.floor(player.x/TILE), pty=Math.floor(player.y/TILE);
      if(waterAt(ptx,pty)&&!player.sailing&&!player.swimming){
        player.swimming=true; player.breath=player.breathMax;
        toast("🌊 O deck quebrou! Nadando…",2200);
      }
    }
    return true;
  }
  return false;
}
function isWaterTile(tx,ty){ return tileAt(tx,ty)===0; }
function onMountain(px,py){ return tileAt(Math.floor(wrap(px,WPX)/TILE),Math.floor(wrap(py,WPY)/TILE))===4; }
function collidesAt(px,py,r){
  px=wrap(px,WPX); py=wrap(py,WPY);
  // água bloqueia; montanha agora é escalável (lento, cansa)
  for(const [ox,oy] of [[-r,-r],[r,-r],[-r,r],[r,r]])
    if(isWaterTile(Math.floor((px+ox)/TILE), Math.floor((py+oy)/TILE))) return true;
  for(const b of buildings){
    if(b.kind==="torch") continue;
    const bx=b.tx*TILE+TILE/2, by=b.ty*TILE+TILE/2;
    if(Math.abs(wdx(px,bx,WPX))<TILE/2+r-4 && Math.abs(wdx(py,by,WPY))<TILE/2+r-4) return true;
  }
  for(const res of resources){
    if(res.kind!=="tree"&&res.kind!=="rock") continue;
    const bx=res.tx*TILE+TILE/2, by=res.ty*TILE+TILE/2;
    if(Math.abs(wdx(px,bx,WPX))<12+r-4 && Math.abs(wdx(py,by,WPY))<12+r-4) return true;
  }
  return false;
}
function nearestShelter(){
  let best=null,bd=1e9;
  for(const b of buildings){
    if(!b.shelter) continue;
    const d=wdist(player.x,player.y,b.tx*TILE+16,b.ty*TILE+16);
    if(d<b.shelter && d<bd){bd=d;best=b;}
  }
  return best;
}
function heatNear(maxD=140){
  if(player.torchLit && player.torchFuel>0) return true;
  for(const b of buildings){
    if(b.kind!=="campfire"&&b.kind!=="torch"&&b.kind!=="tent"&&b.kind!=="cabin") continue;
    if(wdist(player.x,player.y,b.tx*TILE+16,b.ty*TILE+16)<maxD) return true;
  }
  return false;
}

// ---------- mar: água, barco, deck, mergulho ----------
// deck (píer) torna o tile andável sobre a água
function deckAt(tx,ty){ return buildings.some(b=>b.kind==="deck"&&b.tx===tx&&b.ty===ty); }
function waterAt(tx,ty){ return tileAt(tx,ty)===0; }
// ponto de água mais próximo do player, até maxD px
function nearestWaterSpot(maxD){
  const ptx=Math.floor(player.x/TILE), pty=Math.floor(player.y/TILE);
  let best=null,bd=maxD;
  const R=Math.ceil(maxD/TILE)+1;
  for(let oy=-R;oy<=R;oy++)for(let ox=-R;ox<=R;ox++){
    const tx=wrap(ptx+ox,WORLD_W), ty=wrap(pty+oy,WORLD_H);
    if(!waterAt(tx,ty)) continue;
    const cx=tx*TILE+16, cy=ty*TILE+16;
    const d=wdist(player.x,player.y,cx,cy);
    if(d<bd){bd=d;best={x:cx,y:cy,tx,ty};}
  }
  return best;
}
// ponto de água na direção do olhar (p/ vara e tarrafa)
function facingWaterSpot(maxD){
  for(const [ox,oy] of [[30,0],[44,-12],[44,12],[58,0],[72,-14],[72,14],[90,0],[108,0]]){
    const x=player.x+player.facing*ox, y=player.y+oy;
    const tx=Math.floor(wrap(x,WPX)/TILE), ty=Math.floor(wrap(y,WPY)/TILE);
    if(waterAt(tx,ty)) return {x:wrap(x,WPX),y:wrap(y,WPY),tx,ty};
  }
  if(maxD>=95){
    const s=nearestWaterSpot(maxD);
    if(s) return s;
  }
  return null;
}
// profundidade: anéis de água ao redor (polvo/lula vivem no fundo)
function waterDepth(tx,ty){
  let d=0;
  outer: for(let r=1;r<=3;r++){
    for(let a=0;a<8;a++){
      const nx=wrap(tx+Math.round(Math.cos(a/8*Math.PI*2)*r),WORLD_W);
      const ny=wrap(ty+Math.round(Math.sin(a/8*Math.PI*2)*r),WORLD_H);
      if(!waterAt(nx,ny)) break outer;
    }
    d=r;
  }
  return d;
}
// colisão do player: barco/nado passam na água; deck é pisável
function playerCollidesAt(px,py,r){
  px=wrap(px,WPX); py=wrap(py,WPY);
  for(const [ox,oy] of [[-r,-r],[r,-r],[-r,r],[r,r]]){
    const tx=Math.floor(wrap(px+ox,WPX)/TILE), ty=Math.floor(wrap(py+oy,WPY)/TILE);
    const t=tileAt(tx,ty);
    if(t===0){
      if(player&&(player.sailing||player.swimming)) continue;
      if(deckAt(tx,ty)) continue;
      return true;
    }
  }
  for(const b of buildings){
    if(b.kind==="torch"||b.kind==="deck") continue;
    const bx=b.tx*TILE+TILE/2, by=b.ty*TILE+TILE/2;
    if(Math.abs(wdx(px,bx,WPX))<TILE/2+r-4 && Math.abs(wdx(py,by,WPY))<TILE/2+r-4) return true;
  }
  for(const res of resources){
    if(res.kind!=="tree"&&res.kind!=="rock") continue;
    const bx=res.tx*TILE+TILE/2, by=res.ty*TILE+TILE/2;
    if(Math.abs(wdx(px,bx,WPX))<12+r-4 && Math.abs(wdx(py,by,WPY))<12+r-4) return true;
  }
  return false;
}
function onDeckTile(){
  const tx=Math.floor(player.x/TILE), ty=Math.floor(player.y/TILE);
  return deckAt(tx,ty);
}
// a água (sem deck) bloqueia este ponto?
function waterBlocksAt(px,py,r){
  px=wrap(px,WPX); py=wrap(py,WPY);
  for(const [ox,oy] of [[-r,-r],[r,-r],[-r,r],[r,r]]){
    const tx=Math.floor(wrap(px+ox,WPX)/TILE), ty=Math.floor(wrap(py+oy,WPY)/TILE);
    if(tileAt(tx,ty)===0&&!deckAt(tx,ty)) return true;
  }
  return false;
}
// entra nadando sozinho ao andar para dentro da água
function autoSwim(){
  if(player.sailing||player.swimming) return;
  player.swimming=true; player.fishing=null;
  burst(player.x,player.y,"#7dd3fc",8);
  if(!player.stats.swam){ player.stats.swam=true; toast("🏊 Nadando! 🌬️ de olho no fôlego",2300); }
  updateHUD();
}
// sair da água (desembarcar ou parar de nadar) na terra/deck mais próxima
function leaveWater(){
  const ox=player.x, oy=player.y, os=player.sailing, ow=player.swimming;
  const ptx=Math.floor(ox/TILE), pty=Math.floor(oy/TILE);
  for(let R=1;R<=2;R++)for(let oy2=-R;oy2<=R;oy2++)for(let ox2=-R;ox2<=R;ox2++){
    const tx=wrap(ptx+ox2,WORLD_W), ty=wrap(pty+oy2,WORLD_H);
    const t=tileAt(tx,ty);
    if((t===0&&!deckAt(tx,ty))||t===4) continue;
    const cx=tx*TILE+16, cy=ty*TILE+16;
    player.sailing=false;
    if(playerCollidesAt(cx,cy,player.r)){ player.sailing=os; continue; }
    player.x=cx; player.y=cy; player.swimming=false; player.sailing=false;
    updateHUD();
    return true;
  }
  player.sailing=os; player.swimming=ow;
  return false;
}
function boardBoat(){
  if(!player.inv.boat||player.sailing||player.swimming) return false;
  if(!nearestWaterSpot(66)) return false;
  player.sailing=true; player.fishing=null;
  beep(440,0.12,"triangle");
  toast("⛵ Navegando! E desembarca na margem",2200);
  updateHUD(); return true;
}
function diveIn(){
  if(player.sailing||player.swimming) return false;
  if(!nearestWaterSpot(50)) return false;
  player.swimming=true; player.fishing=null;
  player.breath=player.breathMax;
  beep(300,0.15,"sine");
  burst(player.x,player.y,"#7dd3fc",10);
  toast("🏊 Mergulhando! E sai • 🌬️ de olho no fôlego",2300);
  updateHUD(); return true;
}

// ---------- inimigos ----------
function spawnEnemy(force){
  const night=isNight(), Pn=P();
  let kind = force;
  if(!kind){
    const table = night ? Pn.nightTable : Pn.dayTable;
    kind = table[irand(0,table.length-1)];
    if(night && !enemies.some(e=>e.kind==="orc")){
      const bossP = P().id==="sombra" ? 0.06 : (day>=3 ? 0.04 : 0);
      if(Math.random()<bossP) kind="orc";
    }
  }
  const ang=rand(0,Math.PI*2), d=rand(420,620);
  const x=wrap(player.x+Math.cos(ang)*d,WPX), y=wrap(player.y+Math.sin(ang)*d,WPY);
  const t=ETYPES[kind], m=Pn.enemyMul;
  const scale=(1+(day-1)*0.05+(night?0.15:0))*m;
  enemies.push({kind,x,y,r:kind==="orc"?15:kind==="golem"?13:10,
    hp:t.hp*scale,maxHp:t.hp*scale,dmg:Math.round(t.dmg*scale*(night?1.2:1)),
    speed:t.speed*(night?1.15:1),xp:t.xp,atkCD:0,siegeCD:0,wx:x,wy:y,wt:0,frame:rand(0,9),flash:0});
  if(kind==="orc") toast("👑 O CHEFÃO apareceu!", 3000, true);
}
function enemyUpdate(e,dt){
  e.frame+=dt*6; e.flash=Math.max(0,e.flash-dt);
  const night=isNight(), def=ETYPES[e.kind];
  if(!night && def.nightOnly && e.kind!=="orc"){
    e.hp-=14*dt;
    if(Math.random()<dt*6) burst(e.x,e.y-10,"#f59e0b",2);
    if(e.hp<=0){
      enemies.splice(enemies.indexOf(e),1);
      addFloater(e.x,e.y-16,"☀️","#fde047");
      gainXp(Math.round(def.xp/2));
      return;
    }
  }
  const d=wdist(e.x,e.y,player.x,player.y);
  let tx,ty;
  if(d<def.range){tx=player.x;ty=player.y;}
  else{
    e.wt-=dt;
    if(e.wt<=0){e.wt=rand(1,3); e.wx=wrap(e.x+rand(-120,120),WPX); e.wy=wrap(e.y+rand(-120,120),WPY);}
    tx=e.wx;ty=e.wy;
    if(wdist(e.x,e.y,tx,ty)<10) return;
  }
  const ang=angTo(e.x,e.y,tx,ty);
  const nx=wrap(e.x+Math.cos(ang)*e.speed*dt,WPX), ny=wrap(e.y+Math.sin(ang)*e.speed*dt,WPY);
  const ghost=def.ghost;
  const mx=ghost?true:!collidesAt(nx,e.y,e.r*0.7); if(mx) e.x=nx;
  const my=ghost?true:!collidesAt(e.x,ny,e.r*0.7); if(my) e.y=ny;
  e.siegeCD-=dt;
  if((!mx||!my)&&d<def.range&&e.siegeCD<=0&&!ghost){
    let best=null,bd=48;
    for(const b of buildings){
      if(b.kind==="torch") continue;
      const dd=wdist(e.x,e.y,b.tx*TILE+16,b.ty*TILE+16);
      if(dd<bd){bd=dd;best=b;}
    }
    if(best){ e.siegeCD=1.0; damageBuilding(best,e.dmg,false); burst(best.tx*TILE+16,best.ty*TILE+16,"#ef4444",5); }
  }
  e.atkCD-=dt;
  if(d<26 && e.atkCD<=0){ e.atkCD=1.0; hurtPlayer(e.dmg,e.x,e.y); }
  if(e.kind==="slime"){
    for(const b of buildings){
      if(b.kind!=="torch"&&b.kind!=="campfire") continue;
      const bx=b.tx*TILE+16, by=b.ty*TILE+16;
      if(wdist(e.x,e.y,bx,by)<70){ e.x=wrap(e.x+wdx(e.x,bx,WPX)*dt*0.6,WPX); e.y=wrap(e.y+wdx(e.y,by,WPY)*dt*0.6,WPY); }
    }
  }
}

// ---------- dano ----------
function hurtPlayer(dmg,sx,sy){
  if(player.dead||player.hurtCD>0||interior) return; // dentro do abrigo: protegido
  player.hurtCD=0.4; hurtFlash=0.35;
  let real=dmg;
  if(player.tools.sword>=2) real=Math.max(1,real-2);
  if(player.sheltered) real=Math.max(1,Math.round(real*0.55));
  player.hp-=real; sfx.hurt();
  addFloater(player.x,player.y-18,"-"+real,"#ff5555");
  const a=angTo(sx,sy,player.x,player.y);
  const nx=wrap(player.x+Math.cos(a)*14,WPX), ny=wrap(player.y+Math.sin(a)*14,WPY);
  if(!collidesAt(nx,player.y,player.r)) player.x=nx;
  if(!collidesAt(player.x,ny,player.r)) player.y=ny;
  if(player.hp<=0){ player.hp=0; die(); }
  updateHUD();
}
function die(){
  player.dead=true; gameOver=true; sfx.die();
  try{localStorage.removeItem(SAVE_KEY);}catch(e){}
  $("over-stats").textContent=`${P().icon} ${P().name} • Dia ${day} • Nv ${player.level} • ${kills} abates`;
  setTimeout(()=>$("screen-over").classList.remove("hidden"),600);
}

// ---------- ação única (E): coletar / pegar / embarcar ----------
function itemName(k){return {wood:"🪵",stone:"🪨",fiber:"🌾",fruit:"🍒",raw:"🥩",cooked:"🍗",bandage:"🩹",torch:"🔥",egg:"🥚",fish:"🐟",pearl:"🦪",rod:"🎣",net:"🕸️",boat:"⛵"}[k]||k}
// ---------- vida marinha ----------
const SEATYPES={
  fish:   {hp:12, dmg:0,  speed:75,  xp:6,   r:7,  hostile:false, deep:0, name:"Peixe"},
  squid:  {hp:26, dmg:0,  speed:95,  xp:14,  r:9,  hostile:false, deep:1, name:"Lula"},
  shark:  {hp:130,dmg:14, speed:128, xp:65,  r:12, hostile:true,  deep:0, range:430, name:"Tubarão"},
  octopus:{hp:230,dmg:20, speed:64,  xp:140, r:14, hostile:true,  deep:2, range:330, name:"Polvo gigante"},
  whale:  {hp:480,dmg:0,  speed:42,  xp:170, r:26, hostile:false, deep:1, name:"Baleia"},
};
function seaName(k){ return (SEATYPES[k]&&SEATYPES[k].name)||k; }
// pega o drop flutuante mais próximo (vale nadando/navegando também)
function pickupNearDrop(maxD){
  let bi=-1,bd=maxD;
  drops.forEach((d,i)=>{const dd=wdist(player.x,player.y,d.x,d.y); if(dd<bd){bd=dd;bi=i;}});
  if(bi<0) return false;
  const d=drops.splice(bi,1)[0];
  player.inv[d.item]=(player.inv[d.item]||0)+d.qtd;
  if(d.item==="egg"){ player.stats.eggs=(player.stats.eggs||0)+d.qtd; checkQuests(); }
  if(d.item==="pearl"){ player.stats.pearls=(player.stats.pearls||0)+d.qtd; checkQuests(); }
  sfx.pickup(); addFloater(player.x,player.y-20,"+"+d.qtd+" "+itemName(d.item),"#ffd166");
  updateHUD(); return true;
}
function spawnSealife(force){
  if(!player||player.dead) return;
  let kind=force;
  if(!kind){
    const table=[["fish",0.46],["squid",0.20],["shark",0.18],["octopus",0.08],["whale",0.08]];
    const r=Math.random(); let acc=0;
    for(const [k,w] of table){ acc+=w; if(r<=acc){kind=k;break;} }
    kind=kind||"fish";
  }
  const def=SEATYPES[kind];
  for(let i=0;i<14;i++){
    const a=rand(0,Math.PI*2), d=rand(360,640);
    const x=wrap(player.x+Math.cos(a)*d,WPX), y=wrap(player.y+Math.sin(a)*d,WPY);
    const tx=Math.floor(x/TILE), ty=Math.floor(y/TILE);
    if(!waterAt(tx,ty)) continue;
    if(def.deep>0 && waterDepth(tx,ty)<def.deep) continue;
    sealife.push({kind,x,y,r:def.r,hp:def.hp,maxHp:def.hp,dmg:def.dmg,speed:def.speed,xp:def.xp,
      wx:x,wy:y,wt:0,frame:rand(0,9),flash:0,atkCD:0,bumpCD:0,inkCD:0});
    return;
  }
}
// move s em direção a (tx,ty); vida marinha nunca sai da água
function swimMoveTo(s,tx,ty,speed,dt){
  const a=angTo(s.x,s.y,tx,ty);
  const nx=wrap(s.x+Math.cos(a)*speed*dt,WPX), ny=wrap(s.y+Math.sin(a)*speed*dt,WPY);
  const ok=(x,y)=>waterAt(Math.floor(wrap(x,WPX)/TILE),Math.floor(wrap(y,WPY)/TILE));
  if(ok(nx,ny)){ s.x=nx; s.y=ny; return true; }
  if(ok(nx,s.y)){ s.x=nx; return true; }
  if(ok(s.x,ny)){ s.y=ny; return true; }
  return false;
}
function sealifeUpdate(s,dt){
  s.frame+=dt*6; s.flash=Math.max(0,s.flash-dt);
  s.atkCD=Math.max(0,(s.atkCD||0)-dt); s.bumpCD=Math.max(0,(s.bumpCD||0)-dt); s.inkCD=Math.max(0,(s.inkCD||0)-dt);
  const def=SEATYPES[s.kind];
  const dp=wdist(s.x,s.y,player.x,player.y);
  const playerInWater=(player.swimming||player.sailing)&&!player.dead;
  if(def.hostile && playerInWater && dp<def.range){
    if(!swimMoveTo(s,player.x,player.y,s.speed,dt)) s.wt=0;
    if(dp<30 && s.atkCD<=0){ s.atkCD=1.2; hurtPlayer(s.dmg,s.x,s.y); burst(s.x,s.y,"#ef4444",8); }
    return;
  }
  if(s.kind==="whale"){
    // gigante gentil: esbarra no barco sem dano
    if(player.sailing && dp<s.r+24 && s.bumpCD<=0){
      s.bumpCD=4;
      const a=angTo(s.x,s.y,player.x,player.y);
      const nx=wrap(player.x+Math.cos(a)*36,WPX), ny=wrap(player.y+Math.sin(a)*36,WPY);
      if(!playerCollidesAt(nx,player.y,player.r)) player.x=nx;
      if(!playerCollidesAt(player.x,ny,player.r)) player.y=ny;
      burst(player.x,player.y,"#bae6fd",12);
      addFloater(player.x,player.y-26,"🐋!!","#bae6fd");
      beep(140,0.3,"sine",0.06);
    }
  } else if(!def.hostile && dp<110 && (s.kind==="fish"||s.kind==="squid")){
    // foge do player/barco (lula solta tinta)
    const a=angTo(player.x,player.y,s.x,s.y);
    swimMoveTo(s,s.x+Math.cos(a)*60,s.y+Math.sin(a)*60,s.speed*1.4,dt);
    if(s.kind==="squid"&&s.inkCD<=0){ s.inkCD=3; burst(s.x,s.y,"#a78bfa",10); }
    return;
  }
  s.wt-=dt;
  if(s.wt<=0){
    s.wt=rand(1.5,3.5); s.wx=s.x; s.wy=s.y;
    for(let i=0;i<6;i++){
      const a=rand(0,Math.PI*2), d=rand(60,160);
      const nx=wrap(s.x+Math.cos(a)*d,WPX), ny=wrap(s.y+Math.sin(a)*d,WPY);
      if(waterAt(Math.floor(nx/TILE),Math.floor(ny/TILE))){ s.wx=nx; s.wy=ny; break; }
    }
  }
  if(wdist(s.x,s.y,s.wx,s.wy)>14) swimMoveTo(s,s.wx,s.wy,s.speed*0.5,dt);
}
// ---------- pesca: vara ----------
function castRod(){
  if(!player.inv.rod||player.fishing||player.swimming) return false;
  const s=facingWaterSpot(95);
  if(!s) return false;
  player.fishing={x:s.x,y:s.y,tx:s.tx,ty:s.ty,t:0,wait:rand(2.2,5),phase:"wait"};
  beep(620,0.1,"sine",0.05);
  burst(s.x,s.y,"#7dd3fc",6);
  updateHUD(); return true;
}
function reelFish(){
  const F=player.fishing;
  if(!F||F.phase!=="bite") return false;
  player.fishing=null;
  const deep=waterDepth(F.tx,F.ty)>=2;
  const q=irand(1,2)+(deep&&Math.random()<0.35?1:0);
  player.inv.fish=(player.inv.fish||0)+q; player.stats.fish=(player.stats.fish||0)+q;
  gainXp(10); sfx.pickup();
  burst(F.x,F.y,"#7dd3fc",10); beep(880,0.12,"sine",0.05);
  addFloater(player.x,player.y-20,`+${q} 🐟`,"#7dd3fc");
  if(deep&&Math.random()<0.15){
    player.inv.pearl=(player.inv.pearl||0)+1; player.stats.pearls=(player.stats.pearls||0)+1;
    addFloater(player.x,player.y-38,"+1 🦪","#f0abfc"); gainXp(12);
  }
  checkQuests(); updateHUD();
  return true;
}
// ---------- pesca: tarrafa (rede de arremesso) ----------
function throwNet(){
  if(player.dead||!started||interior) return;
  if(!player.inv.net) return;
  if(player.netCD>0) return;
  const s=facingWaterSpot(115);
  if(!s){ addFloater(player.x,player.y-20,"mire a água 🕸️","#94a3b8"); return; }
  player.netCD=8; player.fishing=null;
  player.netAnim={x:s.x,y:s.y,t:0};
  burst(s.x,s.y,"#e0f2fe",16);
  beep(300,0.12,"triangle",0.05);
  let n=0;
  for(let i=sealife.length-1;i>=0&&n<4;i--){
    const f=sealife[i];
    if(f.kind!=="fish"&&f.kind!=="squid") continue;
    if(wdist(s.x,s.y,f.x,f.y)<70){
      sealife.splice(i,1); n++;
      player.inv.fish=(player.inv.fish||0)+1; player.stats.fish=(player.stats.fish||0)+1;
      gainXp(8); burst(f.x,f.y,"#7dd3fc",6);
    }
  }
  if(n>0){ addFloater(player.x,player.y-20,`+${n} 🐟`,"#7dd3fc"); sfx.pickup(); toast(`🕸️ ${n} peixe${n>1?"s":""} na tarrafa!`,2000); }
  else addFloater(s.x,s.y-14,"nada por aqui…","#94a3b8");
  checkQuests(); updateHUD();
}
function nearestResource(maxD){
  let best=null,bd=maxD;
  for(const r of resources){
    const d=wdist(player.x,player.y,r.tx*TILE+16,r.ty*TILE+16);
    if(d<bd){bd=d;best=r}
  }
  return best;
}
function nearestRocket(){
  for(const b of buildings){
    if(b.kind!=="rocket") continue;
    if(wdist(player.x,player.y,b.tx*TILE+16,b.ty*TILE+16)<64) return b;
  }
  return null;
}
function nearestCritter(kinds,maxD){
  let best=null,bd=maxD;
  for(const c of critters){
    if(kinds&&!kinds.includes(c.kind)) continue;
    if(c===player.mounted) continue;
    const d=wdist(player.x,player.y,c.x,c.y);
    if(d<bd){bd=d;best=c;}
  }
  return best;
}
function nearestShelterEnter(maxD){
  let best=null,bd=maxD;
  for(const b of buildings){
    if(b.kind!=="tent"&&b.kind!=="cabin") continue;
    const d=wdist(player.x,player.y,b.tx*TILE+16,b.ty*TILE+16);
    if(d<bd){bd=d;best=b;}
  }
  return best;
}
function petCount(){ return critters.filter(c=>c.pet).length; }
function tameDog(c){
  const inv=player.inv;
  const food=(inv.raw||0)>0?"raw":(inv.cooked||0)>0?"cooked":(inv.egg||0)>0?"egg":null;
  if(!food){ toast("🐶 Ele quer comida! Traga 🥩 ou 🥚",2200,true); return; }
  if(petCount()>=2){ toast("🐶 Máximo 2 companheiros!",2200,true); return; }
  inv[food]--;
  c.pet=true; c.atkCD=0;
  player.stats.companion=true;
  burst(c.x,c.y,"#fbbf24",10); sfx.pickup();
  addFloater(c.x,c.y-18,"🐶 amigo!","#fde047");
  toast("🐶 Cachorro adotado! Ele te protege.",2600,true);
  checkQuests(); updateHUD();
}
function mountHorse(c){
  if(player.mounted) return;
  player.mounted=c; c.x=player.x; c.y=player.y;
  player.stats.companion=true;
  sfx.craft(); addFloater(player.x,player.y-24,"🐎 montado! E p/ descer","#d2a679");
  checkQuests(); updateHUD();
}
function dismount(){
  const h=player.mounted; if(!h) return;
  player.mounted=null;
  h.x=wrap(player.x+22,WPX); h.y=wrap(player.y,WPY);
  sfx.build(); updateHUD();
}
function doAction(){
  if(player.dead||!started) return;
  if(interior){ interiorAction(); return; }
  if(player.mounted){ dismount(); return; }
  // no barco: E pega drop, desembarca na margem; longe dela, colhe ou pesca
  if(player.sailing){
    if(player.fishing&&player.fishing.phase==="bite"){ reelFish(); return; }
    if(pickupNearDrop(52)) return;
    if(shoreNear(58)){
      if(leaveWater()) toast("🦶 Em terra!",1400);
      else toast("⛵ Sem espaço p/ desembarcar",1800);
      return;
    }
    const wr2=nearestResource(64);
    if(wr2&&(wr2.kind==="kelp"||wr2.kind==="clam"||wr2.kind==="coral")){ harvest(wr2); return; }
    if(player.inv.rod){
      if(!player.fishing) castRod();
      return;
    }
    toast("⛵ Reme até a margem p/ desembarcar (E)",1800); return;
  }
  // nadando: E pega drop, colhe fundo do mar ou sai da água
  if(player.swimming){
    if(pickupNearDrop(46)) return;
    if(leaveWater()){ toast("🦶 Em terra!",1400); return; }
    const wr=nearestResource(64);
    if(wr&&(wr.kind==="kelp"||wr.kind==="clam"||wr.kind==="coral")){ harvest(wr); return; }
    toast("🌊 Longe da margem!",1600);
    return;
  }
  // fisgou? E recolhe na hora (antes de foguete/POI p/ não perder a janela)
  if(player.fishing&&player.fishing.phase==="bite"){ reelFish(); return; }
  const rk=nearestRocket();
  if(rk){ toggle("panel-travel",true); renderTravel(); return; }
  const poi=nearestPOI(58);
  if(poi){ interactPOI(poi); return; }
  const dog=nearestCritter(["dog"],54);
  if(dog&&!dog.pet){ tameDog(dog); return; }
  const horse=nearestCritter(["horse"],54);
  if(horse){ mountHorse(horse); return; }
  if(pickupNearDrop(44)) return;
  const sh=(!player.swimming)&&nearestShelterEnter(48);
  if(sh){ enterInterior(sh.kind,sh,sh.tx*TILE+16,sh.ty*TILE+16); updateHUD(); return; }
  const r=nearestResource(54);
  if(r) harvest(r);
  // mar: pescar com a vara, embarcar no barco, mergulhar
  const fw=facingWaterSpot(95);
  if(player.inv.rod&&fw&&castRod()) return;
  if(player.inv.boat&&nearestWaterSpot(66)&&boardBoat()) return;
  if(nearestWaterSpot(50)) diveIn();
}
function harvest(r){
  const bonus=player.hand==="axe"?2:1;
  const bx=r.tx*TILE+16, by=r.ty*TILE+16;
  if(r.kind==="tree"){
    r.hp-=bonus; burst(bx,by,"#7b4a2b",6);
    if(r.hp<=0){
      removeRes(r);
      const q=irand(2,3)*bonus;
      player.inv.wood+=q; player.stats.wood+=q; sfx.pickup(); gainXp(5);
      addFloater(player.x,player.y-20,`+${q} 🪵`,"#d2a679");
      if(Math.random()<0.3) player.inv.fiber++, player.stats.fiber++;
      if(Math.random()<0.25) drops.push({x:bx+rand(-10,10),y:by+rand(-10,10),item:"fruit",qtd:1});
      checkQuests();
    } else beep(200,0.05,"square",0.04);
  }else if(r.kind==="rock"){
    r.hp-=bonus; burst(bx,by,"#9ca3af",6);
    if(r.hp<=0){
      removeRes(r);
      const q=irand(2,3)*bonus;
      player.inv.stone+=q; player.stats.stone+=q; sfx.pickup(); gainXp(5);
      addFloater(player.x,player.y-20,`+${q} 🪨`,"#d1d5db"); checkQuests();
    } else beep(180,0.05,"square",0.04);
  }else if(r.kind==="bush"){
    removeRes(r);
    player.inv.fruit+=r.berries; sfx.pickup(); gainXp(4);
    addFloater(player.x,player.y-20,`+${r.berries} 🍒`,"#f87171");
    burst(bx,by,"#ef4444",8);
  }else if(r.kind==="grass"){
    removeRes(r);
    const q=irand(1,2);
    player.inv.fiber+=q; player.stats.fiber+=q; sfx.pickup(); gainXp(3);
    addFloater(player.x,player.y-20,"+"+q+" 🌾","#a3e635");
    checkQuests();
  }else if(r.kind==="kelp"){
    removeRes(r);
    player.inv.fiber+=2; player.stats.fiber+=2; sfx.pickup(); gainXp(4);
    addFloater(player.x,player.y-20,"+2 🌾","#4ade80");
    burst(bx,by,"#22c55e",8); checkQuests();
  }else if(r.kind==="clam"){
    removeRes(r);
    player.inv.pearl=(player.inv.pearl||0)+1; player.stats.pearls=(player.stats.pearls||0)+1;
    sfx.pickup(); gainXp(12);
    addFloater(player.x,player.y-20,"+1 🦪","#f0abfc");
    burst(bx,by,"#e9d5ff",10);
    toast("🦪 Pérola!",2000); checkQuests();
  }else if(r.kind==="coral"){
    removeRes(r);
    gainXp(8); sfx.pickup();
    burst(bx,by,"#f9a8d4",10);
    if(Math.random()<0.3){
      player.inv.pearl=(player.inv.pearl||0)+1; player.stats.pearls=(player.stats.pearls||0)+1;
      addFloater(player.x,player.y-20,"+1 🦪","#f0abfc");
    } else addFloater(player.x,player.y-20,"+🪸","#f9a8d4");
    checkQuests();
  }
  updateHUD(); updateQuestHUD();
}
function removeRes(r){
  resources.splice(resources.indexOf(r),1);
  setTimeout(()=>{
    if(resources.length<900 && !player.dead && started)
      resources.push({...r,hp:r.maxHp,berries:r.kind==="bush"?irand(2,4):undefined});
  },90000);
}

// ---------- ataque ----------
function doAttack(forceAngle){
  if(player.dead||player.atkCD>0||player.stamina<5||!started) return;
  player.atkCD=0.35; player.stamina=Math.max(0,player.stamina-6); attackAnim=0.18;
  player.fishing=null; // atacar recolhe a vara
  const range=48, arc=Math.PI*0.9;
  let ang = forceAngle!=null ? forceAngle : angTo(player.x,player.y,mouse.wx,mouse.wy);
  sfx.hit();
  burst(player.x+Math.cos(ang)*26,player.y+Math.sin(ang)*26,"#fef08a",4);
  let hit=false;
  for(let i=enemies.length-1;i>=0;i--){
    const e=enemies[i];
    if(wdist(player.x,player.y,e.x,e.y)>range+e.r) continue;
    let da=Math.abs(angTo(player.x,player.y,e.x,e.y)-ang); if(da>Math.PI) da=2*Math.PI-da;
    if(da>arc/2) continue;
    hit=true;
    const crit=Math.random()<0.12;
    const atkBuff=elapsed<(player.buffAtkUntil||0)?1.5:1;
    const dmg=Math.round(atkTotal()*atkBuff*rand(0.85,1.2)*(crit?1.8:1));
    e.hp-=dmg; e.flash=0.15;
    const ka=angTo(player.x,player.y,e.x,e.y);
    e.x=wrap(e.x+Math.cos(ka)*10,WPX); e.y=wrap(e.y+Math.sin(ka)*10,WPY);
    burst(e.x,e.y,"#ff5555",6);
    addFloater(e.x,e.y-16,(crit?"! ":"")+dmg,crit?"#facc15":"#fff");
    if(e.hp<=0){
      enemies.splice(i,1); kills++; player.stats.kills++;
      gainXp(ETYPES[e.kind].xp);
      burst(e.x,e.y,ETYPES[e.kind].color,14);
      if(e.kind==="orc"){ drops.push({x:e.x,y:e.y,item:"cooked",qtd:2}); drops.push({x:e.x+10,y:e.y,item:"raw",qtd:3}); player.stats.boss=true; toast("👑 Chefão vencido!",3000,true); }
      else if(e.kind==="boar"||e.kind==="golem") drops.push({x:e.x,y:e.y,item:"raw",qtd:irand(2,3)});
      else if(e.kind==="bee"){ if(Math.random()<0.6) drops.push({x:e.x,y:e.y,item:"fruit",qtd:2}); }
      else if(e.kind==="ghost"||e.kind==="shade"){ if(Math.random()<0.4) drops.push({x:e.x,y:e.y,item:"bandage",qtd:1}); }
      else{
        if(e.kind==="wolf"||Math.random()<0.5) drops.push({x:e.x,y:e.y,item:"raw",qtd:e.kind==="wolf"?irand(1,2):1});
        if(Math.random()<0.3) drops.push({x:e.x+rand(-12,12),y:e.y+rand(-12,12),item:"fruit",qtd:1});
      }
      beep(500,0.1,"square");
      checkQuests();
    }
  }
  // bichinhos caçáveis: galinha, pintinho, porco, coelho, pássaro, esquilo
  for(let i=critters.length-1;i>=0;i--){
    const c=critters[i];
    if(!CRITTER_HP[c.kind]||c.pet||c===player.mounted) continue;
    if(wdist(player.x,player.y,c.x,c.y)>range+8) continue;
    let da=Math.abs(angTo(player.x,player.y,c.x,c.y)-ang); if(da>Math.PI) da=2*Math.PI-da;
    if(da>arc/2) continue;
    hit=true;
    const atkBuff=elapsed<(player.buffAtkUntil||0)?1.5:1;
    const dmg=Math.round(atkTotal()*atkBuff*rand(0.85,1.2));
    c.hp-=dmg;
    const ka=angTo(player.x,player.y,c.x,c.y);
    c.x=wrap(c.x+Math.cos(ka)*12,WPX); c.y=wrap(c.y+Math.sin(ka)*12,WPY);
    burst(c.x,c.y,"#ff5555",5);
    addFloater(c.x,c.y-14,dmg,"#fff");
    if(c.hp<=0){
      critters.splice(i,1); kills++; player.stats.kills++;
      burst(c.x,c.y,"#f8fafc",12); gainXp(8); beep(500,0.1,"square");
      if(c.kind==="chicken"){ drops.push({x:c.x,y:c.y,item:"raw",qtd:1}); drops.push({x:c.x+8,y:c.y,item:"egg",qtd:irand(1,2)}); }
      else if(c.kind==="chick"){ drops.push({x:c.x,y:c.y,item:"egg",qtd:1}); }
      else if(c.kind==="pig"){ drops.push({x:c.x,y:c.y,item:"raw",qtd:irand(2,3)}); }
      else if(c.kind==="rabbit"){ drops.push({x:c.x,y:c.y,item:"raw",qtd:irand(1,2)}); }
      else if(c.kind==="bird"){ drops.push({x:c.x,y:c.y,item:"raw",qtd:1}); if(Math.random()<0.3) drops.push({x:c.x+8,y:c.y,item:"fruit",qtd:1}); }
      else if(c.kind==="squirrel"){ drops.push({x:c.x,y:c.y,item:"fruit",qtd:2}); }
      checkQuests();
    }
  }
  // vida marinha: peixes, lulas, tubarões, polvos, baleias
  for(let i=sealife.length-1;i>=0;i--){
    const s=sealife[i];
    if(wdist(player.x,player.y,s.x,s.y)>range+s.r) continue;
    let da=Math.abs(angTo(player.x,player.y,s.x,s.y)-ang); if(da>Math.PI) da=2*Math.PI-da;
    if(da>arc/2) continue;
    hit=true;
    const atkBuff2=elapsed<(player.buffAtkUntil||0)?1.5:1;
    const dmg2=Math.round(atkTotal()*atkBuff2*rand(0.85,1.2));
    s.hp-=dmg2; s.flash=0.15;
    const ka2=angTo(player.x,player.y,s.x,s.y);
    const ox=s.x, oy=s.y;
    s.x=wrap(s.x+Math.cos(ka2)*10,WPX); s.y=wrap(s.y+Math.sin(ka2)*10,WPY);
    if(!waterAt(Math.floor(s.x/TILE),Math.floor(s.y/TILE))){ s.x=ox; s.y=oy; }
    burst(s.x,s.y,"#ff5555",6);
    addFloater(s.x,s.y-16,dmg2,"#fff");
    if(s.hp<=0){
      sealife.splice(i,1); kills++; player.stats.kills++;
      burst(s.x,s.y,"#7dd3fc",12); gainXp(SEATYPES[s.kind].xp); beep(500,0.1,"square");
      if(s.kind==="fish") drops.push({x:s.x,y:s.y,item:"fish",qtd:irand(1,2)});
      else if(s.kind==="squid"){ drops.push({x:s.x,y:s.y,item:"fish",qtd:irand(1,2)}); if(Math.random()<0.25) drops.push({x:s.x+8,y:s.y,item:"pearl",qtd:1}); }
      else if(s.kind==="shark"){ drops.push({x:s.x,y:s.y,item:"raw",qtd:3}); toast("🦈 Tubarão vencido!",2200,true); }
      else if(s.kind==="octopus"){ drops.push({x:s.x,y:s.y,item:"raw",qtd:4}); drops.push({x:s.x+10,y:s.y,item:"pearl",qtd:1}); toast("🐙 Polvo gigante vencido!",2600,true); }
      else if(s.kind==="whale") drops.push({x:s.x,y:s.y,item:"raw",qtd:6});
      checkQuests();
    }
  }
  if(!hit){
    for(const r of [...resources]){
      const bx=r.tx*TILE+16, by=r.ty*TILE+16;
      if(wdist(player.x,player.y,bx,by)>range) continue;
      let da=Math.abs(angTo(player.x,player.y,bx,by)-ang); if(da>Math.PI) da=2*Math.PI-da;
      if(da<arc/2 && (r.kind==="tree"||r.kind==="rock")){ harvest(r); break; }
    }
    for(const b of [...buildings]){
      const bx=b.tx*TILE+16, by=b.ty*TILE+16;
      if(wdist(player.x,player.y,bx,by)>range+8) continue;
      let da=Math.abs(angTo(player.x,player.y,bx,by)-ang); if(da>Math.PI) da=2*Math.PI-da;
      if(da<arc/2){ damageBuilding(b,Math.max(10,player.atk),true); break; }
    }
  }
  updateHUD();
}

// ---------- comer / tocha ----------
// ---------- mão: equipa ferramenta/arma (1/2/3 ou toque no 🤜) ----------
function handBonus(){
  if(!player) return 0;
  if(player.hand==="axe") return 4;
  if(player.hand==="sword1") return 10;
  if(player.hand==="sword2") return 16;
  return 0;
}
function atkTotal(){ return (player?player.atk:6)+handBonus(); }
function handIcon(){
  return {none:"🤜",axe:"🪓",sword1:"🗡️",sword2:"⚔️"}[(player&&player.hand)||"none"]||"🤜";
}
function handName(){
  return {none:"punhos",axe:"machado",sword1:"espada",sword2:"espada afiada"}[(player&&player.hand)||"none"]||"punhos";
}
function equipHand(id){
  if(!player||player.dead) return false;
  if(id==="axe"&&!player.tools.axe) return false;
  if(id==="sword"&&(player.tools.sword||0)<1) return false;
  if(id==="sword") id=player.tools.sword>=2?"sword2":"sword1";
  player.hand=id;
  toast("🤜 "+handName(),1400);
  beep(520,0.07,"triangle",0.04);
  updateHUD();
  return true;
}
function cycleHand(){
  const opts=["none"];
  if(player.tools.axe) opts.push("axe");
  if((player.tools.sword||0)>=1) opts.push("sword");
  const cur=(player.hand==="sword1"||player.hand==="sword2")?"sword":(player.hand||"none");
  equipHand(opts[(opts.indexOf(cur)+1)%opts.length]);
}
function eatBest(){
  const inv=player.inv;
  if(inv.cooked>0){inv.cooked--;player.hunger=clamp(player.hunger+40,0,100);player.hp=clamp(player.hp+12,0,player.maxHp);}
  else if((inv.pearl||0)>0){inv.pearl--;player.hunger=clamp(player.hunger+35,0,100);player.hp=clamp(player.hp+20,0,player.maxHp);}
  else if((inv.fish||0)>0){inv.fish--;player.hunger=clamp(player.hunger+28,0,100);player.hp=clamp(player.hp+8,0,player.maxHp);}
  else if((inv.egg||0)>0){inv.egg--;player.hunger=clamp(player.hunger+22,0,100);player.hp=clamp(player.hp+6,0,player.maxHp);}
  else if(inv.fruit>0){inv.fruit--;player.hunger=clamp(player.hunger+15,0,100);player.hp=clamp(player.hp+5,0,player.maxHp);}
  else if(inv.bandage>0){inv.bandage--;player.hp=clamp(player.hp+40,0,player.maxHp);}
  else if(inv.raw>0){inv.raw--;player.hunger=clamp(player.hunger+10,0,100);player.hp=clamp(player.hp-8,0,player.maxHp);}
  else return;
  sfx.eat(); updateHUD();
}
function gainEgg(q){
  player.inv.egg=(player.inv.egg||0)+q; player.stats.eggs=(player.stats.eggs||0)+q;
  addFloater(player.x,player.y-20,`+${q} 🥚`,"#fef9c3"); sfx.pickup(); checkQuests(); updateHUD();
}
function toggleTorch(){
  if(player.torchLit){ player.torchLit=false; beep(300,0.08,"triangle"); }
  else{
    if((player.inv.torch||0)<=0 && player.torchFuel<=0) return; // dica aparece no context-tip
    player.torchLit=true; beep(520,0.1,"triangle");
  }
  updateHUD();
}
function lightRadius(){
  if(player.torchLit && player.torchFuel>0) return 210;
  return 70;
}

// ---------- partículas ----------
function burst(x,y,color,n){for(let i=0;i<n;i++)particles.push({x,y,vx:rand(-70,70),vy:rand(-70,70),life:rand(.25,.6),t:0,color,size:irand(2,4)});}
function addFloater(x,y,txt,color){floaters.push({x,y,txt,color,t:0,life:1.1});}

// ---------- save ----------
function save(silent){
  if(!started||player.dead) return;
  try{
    storeBuildings[P().id]=buildings;
    storePOIs[P().id]=pois;
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      planetIdx, seeds, storeBuildings, storePOIs, day, timeOfDay, kills,
      player:{...player,inv:{...player.inv},tools:{...player.tools},stats:{...player.stats,visited:{...player.stats.visited}}}
    }));
    if(!silent) toast("💾",1500);
  }catch(e){}
}
function load(){
  try{
    const s=JSON.parse(localStorage.getItem(SAVE_KEY));
    if(!s||!s.player) return false;
    planetIdx=s.planetIdx||0; seeds=s.seeds||{}; storeBuildings=s.storeBuildings||{}; storePOIs=s.storePOIs||{};
    day=s.day||1; timeOfDay=s.timeOfDay??0.3; kills=s.kills||0;
    enterPlanet(planetIdx, seeds[PLANETS[planetIdx].id], true);
    const st=s.player.stats||{};
    Object.assign(player,s.player);
    player.atk=6; // dano agora vem da mão equipada (saves antigos acumulavam)
    if(!player.hand) player.hand="none";
    player.stats={wood:0,stone:0,fiber:0,kills:0,craftedTorch:0,boss:false,visited:{verde:true},chests:0,poisUsed:0,...st};
    player.inv={wood:0,stone:0,fiber:0,fruit:0,raw:0,cooked:0,bandage:0,torch:0,egg:0,fish:0,pearl:0,rod:0,net:0,boat:0,...s.player.inv};
    player.sailing=false; player.swimming=false; player.fishing=null; player.netCD=0;
    player.breath=player.breathMax||25;
    if(player.buffAtkUntil===undefined) player.buffAtkUntil=0;
    if(player.buffSpdUntil===undefined) player.buffSpdUntil=0;
    return true;
  }catch(e){return false}
}

// ---------- planetas: entrar / viajar ----------
function enterPlanet(idx, seed, keepPlayer){
  storeBuildings[P().id]=buildings;
  storePOIs[P().id]=pois;
  // companheiros viajam junto 🚀🐶
  const pets=critters.filter(c=>c.pet).slice(0,2);
  const horse=player&&player.mounted?player.mounted:null;
  interior=null;
  if(player) player.mounted=null;
  if(player){ player.sailing=false; player.swimming=false; player.fishing=null; player.netCD=0; player.breath=player.breathMax||25; }
  planetIdx=idx;
  const Pn=P();
  const sd = seed || irand(1,999999);
  seeds[Pn.id]=sd;
  genWorld(sd,Pn);
  genResources(Pn);
  buildings = storeBuildings[Pn.id]||[];
  if(storePOIs[Pn.id]){ pois=storePOIs[Pn.id]; critters=[]; ambientP=[]; for(let i=0;i<10;i++) spawnCritter(true); }
  else genPOIs(Pn);
  const s=findSpawn();
  if(keepPlayer && player){ player.x=s.x; player.y=s.y; }
  else player=newPlayer(s.x,s.y);
  for(const p of pets){ p.x=wrap(s.x+rand(-50,50),WPX); p.y=wrap(s.y+rand(-50,50),WPY); critters.push(p); }
  if(horse){ critters.push(horse); horse.x=wrap(s.x+30,WPX); horse.y=wrap(s.y,WPY); }
  if(Pn.eternalNight) timeOfDay=0.0;
  else if(timeOfDay<0.22||timeOfDay>0.78) timeOfDay=0.3;
  buildMode=null;
  updateHUD(); renderRecipes(); renderBuilds(); updateQuestHUD();
}
function goToPlanet(idx){
  if(idx===planetIdx){ toggle("panel-travel",false); return; }
  sfx.rocket();
  $("panel-travel").classList.add("hidden");
  enterPlanet(idx, seeds[PLANETS[idx].id], true);
  player.stats.visited[PLANETS[idx].id]=true;
  toast(`${PLANETS[idx].icon} ${PLANETS[idx].name}: ${PLANETS[idx].desc}`, 3200, true);
  checkQuests(); save(true);
}

// ---------- HUD / painéis ----------
function updateHUD(){
  if(!player) return;
  $("bar-hp").style.width=(player.hp/player.maxHp*100)+"%";
  $("bar-hunger").style.width=player.hunger+"%";
  $("bar-stamina").style.width=player.stamina+"%";
  $("txt-hp").textContent=Math.ceil(player.hp);
  $("txt-hunger").textContent=Math.ceil(player.hunger);
  $("txt-stamina").textContent=Math.ceil(player.stamina);
  $("bar-breath").style.width=(player.breath/player.breathMax*100)+"%";
  $("txt-breath").textContent=Math.ceil(player.breath);
  $("breath-row").style.opacity=(player.swimming||player.breath<player.breathMax-0.5)?1:0.35;
  $("level").textContent=player.level; $("xp").textContent=player.xp; $("xp-next").textContent=player.xpNext;
  const hasBuff=elapsed<(player.buffAtkUntil||0);
  $("atk").textContent=atkTotal()+(hasBuff?" ⚡":"");
  $("c-hand").textContent=handIcon();
  $("xp-fill").style.width=(player.xp/player.xpNext*100)+"%";
  $("c-food").textContent=(player.inv.fruit||0)+(player.inv.cooked||0)+(player.inv.egg||0)+(player.inv.fish||0)+(player.inv.pearl||0);
  $("c-torch").textContent=(player.inv.torch||0)+(player.torchLit?" 🔥":"");
  $("c-wood").textContent=player.inv.wood; $("c-stone").textContent=player.inv.stone; $("c-fiber").textContent=player.inv.fiber;
  const n=(player.tools.axe?1:0)+(player.tools.sword>0?1:0);
  $("c-tools").textContent=n;
  $("slot-torch").classList.toggle("lit",!!player.torchLit);
  $("shelter-ico").classList.toggle("on",!!player.sheltered);
  const Pn=P();
  $("planet-chip").textContent=`${Pn.icon} ${Pn.name} • Dia ${day} • ${isNight()?"🌙":"☀️"}`;
  renderRecipes(); renderBuilds();
}
function renderRecipes(){
  const w=$("recipes"); if(!w||!player) return;
  w.innerHTML="";
  const bench=nearWorkbench();
  for(const r of RECIPES){
    const ok=r.can?r.can():true;
    const nb=r.needBench&&!bench;
    const afford=hasCost(r.cost);
    const d=document.createElement("div"); d.className="recipe";
    d.innerHTML=`<div style="font-size:26px">${r.icon}</div><h4>${r.name}</h4><p>${r.desc}</p><p>💰 ${costText(r.cost)}</p>${nb?'<p>⚠️ perto da 🛠️</p>':''}`;
    const b=document.createElement("button");
    b.textContent=!ok?"✔":nb?"🛠️ longe":afford?"Criar":"—";
    b.disabled=!ok||!afford||nb;
    b.onclick=()=>{
      if(!hasCost(r.cost)||(r.needBench&&!nearWorkbench())) return;
      payCost(r.cost); r.apply();
      if(r.id==="torchkit") player.stats.craftedTorch=(player.stats.craftedTorch||0)+1;
      gainXp(15); sfx.craft(); checkQuests(); updateHUD(); updateQuestHUD();
    };
    d.appendChild(b); w.appendChild(d);
  }
}
function renderBuilds(){
  const w=$("builds"); if(!w||!player) return;
  w.innerHTML="";
  for(const b of BUILDS){
    const afford=hasCost(b.cost);
    const d=document.createElement("div"); d.className="recipe buildable";
    d.innerHTML=`<div style="font-size:26px">${b.icon}</div><h4>${b.name}</h4><p>${b.desc}</p><p>💰 ${costText(b.cost)}</p>`;
    const btn=document.createElement("button");
    btn.textContent=buildMode===b.id?"✔ toque no chão":"Escolher";
    btn.disabled=!afford&&buildMode!==b.id;
    btn.onclick=()=>{
      buildMode=buildMode===b.id?null:b.id;
      $("panel-build").classList.add("hidden");
      renderBuilds();
    };
    d.appendChild(btn); w.appendChild(d);
  }
}
function renderTravel(){
  const w=$("travel-cards"); if(!w) return;
  w.innerHTML="";
  PLANETS.forEach((pn,i)=>{
    const d=document.createElement("div"); d.className="recipe planet";
    d.innerHTML=`<div style="font-size:26px">${pn.icon}</div><h4>${pn.name} ${"☠️".repeat(pn.danger)}</h4><p>${pn.desc}</p>${i===planetIdx?'<p>📍 você está aqui</p>':''}`;
    const b=document.createElement("button");
    b.textContent=i===planetIdx?"Aqui":"Voar";
    b.disabled=i===planetIdx;
    b.onclick=()=>goToPlanet(i);
    d.appendChild(b); w.appendChild(d);
  });
}
function updateContextTip(){
  const el=$("context-tip");
  if(!el||!player||player.dead||!started){ if(el) el.classList.add("hidden"); return; }
  const ACT = IS_TOUCH ? "✋" : "<b>E</b>";
  const TORCH = IS_TOUCH ? "🔥" : "<b>T</b>";
  if(interior){
    const I=interior;
    if(I.chest&&!I.src.looted&&Math.hypot(I.px-(I.chest.x+I.chest.w/2),I.py-(I.chest.y+I.chest.h/2))<34){ el.innerHTML=`🎁 ${ACT} abrir tesouro`; el.classList.remove("hidden"); return; }
    if(Math.hypot(I.px-I.door.x,I.py-I.door.y)<40){ el.innerHTML=`🚪 ${ACT} sair`; el.classList.remove("hidden"); return; }
    const n=enemiesNearEntrance(520).length;
    el.innerHTML=n>0?`🛡️ protegido • 👁️ ${n} lá fora`:`🛡️ protegido`;
    el.classList.remove("hidden"); return;
  }
  if(player.mounted){ el.innerHTML=`🐎 ${ACT} descer do cavalo`; el.classList.remove("hidden"); return; }
  if(player.sailing){
    if(player.fishing&&player.fishing.phase==="bite"){ el.innerHTML=`🐟 ${ACT} fisgar!`; el.classList.remove("hidden"); return; }
    if(shoreNear(58)){ el.innerHTML=`⛵ ${ACT} desembarcar`; el.classList.remove("hidden"); return; }
    if(player.inv.rod){ el.innerHTML=player.fishing?`🎣 esperando o peixe… (mova-se p/ recolher)`:`🎣 ${ACT} pescar`; el.classList.remove("hidden"); return; }
    el.innerHTML=`⛵ reme até a margem p/ desembarcar`; el.classList.remove("hidden"); return;
  }
  if(player.swimming){ el.innerHTML=`🌬️ ${ACT} sair da água (${Math.ceil(player.breath)}s)`; el.classList.remove("hidden"); return; }
  if(player.fishing&&player.fishing.phase==="bite"){ el.innerHTML=`🐟 ${ACT} fisgar!`; el.classList.remove("hidden"); return; }
  if(player.fishing){ el.innerHTML=`🎣 esperando… (mova-se p/ recolher)`; el.classList.remove("hidden"); return; }
  if(nearestRocket()){ el.innerHTML=`🚀 ${ACT} embarcar e viajar`; el.classList.remove("hidden"); return; }
  const poi=nearestPOI(58);
  if(poi){ el.innerHTML=`${ACT} ${poiLabel(poi)}`; el.classList.remove("hidden"); return; }
  const dogI=nearestCritter(["dog"],54);
  if(dogI&&!dogI.pet){ el.innerHTML=`🐶 ${ACT} adotar (1 🥩/🥚)`; el.classList.remove("hidden"); return; }
  const horseI=nearestCritter(["horse"],54);
  if(horseI){ el.innerHTML=`🐎 ${ACT} montar`; el.classList.remove("hidden"); return; }
  let bi=-1,bd=44;
  drops.forEach((d,i)=>{ if(wdist(player.x,player.y,d.x,d.y)<bd){bd=99;bi=i;} });
  if(bi>=0){ el.innerHTML=`✨ ${ACT} pegar ${itemName(drops[bi].item)}`; el.classList.remove("hidden"); return; }
  const shI=nearestShelterEnter(48);
  if(shI){ el.innerHTML=`🏠 ${ACT} entrar p/ se proteger`; el.classList.remove("hidden"); return; }
  const r=nearestResource(54);
  if(r){
    const n={tree:"🪵",rock:"🪨",bush:"🍒",grass:"🌾",kelp:"🌿 alga",clam:"🦪 ostra",coral:"🪸 coral"};
    el.innerHTML=`${ACT} coletar ${n[r.kind]||""}`;
    el.classList.remove("hidden"); return;
  }
  const fw=facingWaterSpot(95);
  if(player.inv.rod&&fw){ el.innerHTML=`🎣 ${ACT} lançar a vara`; el.classList.remove("hidden"); return; }
  if(player.inv.boat&&nearestWaterSpot(66)){ el.innerHTML=`⛵ ${ACT} embarcar`; el.classList.remove("hidden"); return; }
  if(nearestWaterSpot(50)){ el.innerHTML=`🏊 ${ACT} mergulhar`; el.classList.remove("hidden"); return; }
  if(player.inv.net&&player.netCD<=0&&nearestWaterSpot(115)){ el.innerHTML=IS_TOUCH?`🕸️ rede: toque em 🕸️`:`🕸️ <b>R</b> jogar a tarrafa`; el.classList.remove("hidden"); return; }
  const e=enemies.find(e=>wdist(player.x,player.y,e.x,e.y)<100);
  if(e){ el.innerHTML=IS_TOUCH?`⚔️ ${ETYPES[e.kind].name} — toque em ⚔️`:`⚔️ ${ETYPES[e.kind].name} — <b>clique</b> p/ atacar`; el.classList.remove("hidden"); return; }
  if(isNight()&&!player.torchLit&&(player.inv.torch>0||player.torchFuel>0)){ el.innerHTML=`🌙 ${TORCH} acende a tocha`; el.classList.remove("hidden"); return; }
  if(isNight()&&!player.torchLit&&!(player.inv.torch>0)){ el.innerHTML=`🌙 sem tocha — crie no 🛠️ (C)`; el.classList.remove("hidden"); return; }
  if(P().cold&&!heatNear()){ el.innerHTML=`❄️ frio! Volte ao 🔥`; el.classList.remove("hidden"); return; }
  el.classList.add("hidden");
}

// ---------- sprites ----------
function px(x,y,w,h,c){ctx.fillStyle=c;ctx.fillRect(x|0,y|0,w,h);}
function drawShadow(x,y,r){ctx.fillStyle="rgba(0,0,0,.3)";ctx.beginPath();ctx.ellipse(x,y+r*0.8,r,r*0.4,0,0,7);ctx.fill();}
function tileColor(t,x,y){
  const id=P().id, v=hash2(x,y,7)*14-7;
  if(id==="areia"){
    if(t===0) return `rgb(38,${90+v},${170+v})`;
    if(t===1) return `rgb(${224+v},${196+v},${140+v})`;
    if(t===2) return `rgb(${205+v},${180+v},${120+v})`;
    if(t===3) return `rgb(${150+v},${130+v},${80+v})`;
    return `rgb(${140+v},${110+v},${90+v})`;
  }
  if(id==="gelo"){
    if(t===0) return `rgb(${150+v},${190+v},${230+v})`;
    if(t===1) return `rgb(${220+v},${230+v},${240+v})`;
    if(t===2) return `rgb(${190+v},${215+v},${230+v})`;
    if(t===3) return `rgb(${140+v},${175+v},${195+v})`;
    return `rgb(${170+v},${185+v},${205+v})`;
  }
  if(id==="sombra"){
    if(t===0) return `rgb(25,${40+v},${80+v})`;
    if(t===1) return `rgb(${90+v},${85+v},${110+v})`;
    if(t===2) return `rgb(${50+v},${70+v},${60+v})`;
    if(t===3) return `rgb(${35+v},${55+v},${50+v})`;
    return `rgb(${70+v},${65+v},${85+v})`;
  }
  if(t===0) return `rgb(38,${90+v},${170+v})`;
  if(t===1) return `rgb(${222+v},${203+v},${140+v})`;
  if(t===2) return `rgb(${74+v},${150+v},${70+v})`;
  if(t===3) return `rgb(${46+v},${110+v},${52+v})`;
  return `rgb(${120+v},${120+v},${128+v})`;
}
function drawPlayer(x,y){
  drawShadow(x,y,10);
  const f=Math.floor(player.frame)%2, bob=player.moving?(f?-1:1):0;
  const s=2, ox=x-8*s/1.4, oy=y-14+bob;
  px(ox+3*s,oy+10*s,s,3*s,"#2b3a55"); px(ox+6*s,oy+10*s,s,3*s,"#2b3a55");
  px(ox+2*s,oy+6*s,6*s,4*s,player.tools.sword>=1?"#7c2d12":"#1d4ed8");
  px(ox+2*s,oy+6*s,6*s,s,"#fbbf24");
  px(ox+2*s,oy+2*s,6*s,4*s,"#ffcc99");
  px(ox+3*s,oy+3*s,s,s,"#000"); px(ox+6*s,oy+3*s,s,s,"#000");
  px(ox+2*s,oy+1*s,6*s,s,"#4a2c17");
  if(attackAnim>0){
    const a=player.facing>0?0.5:-0.5;
    ctx.save();ctx.translate(x,y-6);ctx.rotate(a+(0.18-attackAnim)*8*(player.facing>0?1:-1));
    px(player.facing>0?6:-12,-2,10,3,player.hand==="sword2"?"#fde047":player.hand==="sword1"?"#e5e7eb":player.hand==="axe"?"#9ca3af":"#92400e");
    ctx.restore();
  }
  if(player.torchLit && player.torchFuel>0){
    const tx2=x+player.facing*12, ty2=y-10+Math.sin(elapsed*10)*1.5;
    px(tx2-1,ty2-4,3,9,"#78350f");
    px(tx2-3,ty2-9,7,6,"#f59e0b"); px(tx2-2,ty2-8,5,4,"#fde047");
  }
  const hx=x+player.facing*13, hy=y-8;
  if(player.hand==="axe"){ px(hx-2,hy-6,3,10,"#92400e"); px(hx-4,hy-8,7,5,"#9ca3af"); }
  else if(player.hand==="sword1"){ px(hx-1,hy-10,2,12,"#e5e7eb"); px(hx-3,hy-4,6,2,"#b45309"); }
  else if(player.hand==="sword2"){ px(hx-1,hy-11,2,14,"#fde047"); px(hx-3,hy-4,6,2,"#7c2d12"); }
  if(hurtFlash>0){ctx.fillStyle=`rgba(255,0,0,${hurtFlash})`;ctx.fillRect(x-12,y-22,24,30);}
}
function drawTree(x,y,r){
  drawShadow(x,y,10);
  const id=P().id, wob=Math.sin(elapsed*2+x)*1, v=r.v||"oak";
  if(v==="cactus"){
    px(x-4,y-16,8,18,"#2d7a2d"); px(x-10,y-12,5,8,"#2d7a2d"); px(x+5,y-10,5,8,"#2d7a2d");
    px(x-4,y-16,8,3,"#3fb950"); px(x-2,y-12,2,2,"#86efac"); px(x+1,y-8,2,2,"#86efac");
  }else if(v==="palm"){
    px(x-2,y-14,5,16,"#92400e");
    px(x-14+wob,y-20,12,5,"#16a34a"); px(x+2+wob,y-20,12,5,"#16a34a"); px(x-8+wob,y-24,16,5,"#22c55e");
    px(x-2,y-10,4,4,"#92400e"); px(x+2,y-8,4,4,"#78350f");
  }else if(v==="dead"){
    px(x-3,y-14,6,16,"#78716c");
    px(x-3,y-14,10,3,"#57534c"); px(x-9,y-10,7,3,"#57534c"); px(x+1,y-8,8,3,"#57534c");
  }else if(v==="snowpine"||v==="pine"){
    px(x-3,y-2,6,10,"#5b3a1e");
    const snow=v==="snowpine";
    px(x-10+wob,y-16,20,10,snow?"#7fa8c9":"#1f6b2d");
    px(x-7+wob,y-24,14,9,snow?"#93b8d4":"#2d8a3d");
    px(x-4+wob,y-30,8,7,snow?"#a8c8e0":"#3fb950");
    if(snow){ px(x-7+wob,y-24,14,3,"#f1f5f9"); px(x-4+wob,y-30,8,3,"#f8fafc"); }
  }else if(v==="birch"){
    px(x-3,y-2,6,10,"#e7e5e4"); px(x-3,y-6,6,2,"#44403c"); px(x-3,y-10,6,2,"#44403c");
    px(x-11+wob,y-22,22,14,"#4ade80"); px(x-7+wob,y-26,14,7,"#86efac");
    px(x-5+wob,y-24,3,3,"#fef08a"); px(x+3+wob,y-22,3,3,"#fef08a");
  }else if(v==="icetree"){
    px(x-3,y-2,6,10,"#64748b");
    px(x-9+wob,y-20,18,14,"rgba(186,230,253,.9)"); px(x-5+wob,y-24,10,8,"#e0f2fe");
    px(x-2+wob,y-18,3,6,"#fff");
    if(isNight()) px(x-11,y-24,22,20,"rgba(125,211,252,.15)");
  }else if(v==="shroomtree"){
    px(x-4,y-8,8,12,"#e7e5e4");
    px(x-12+wob,y-22,24,12,"#7c3aed"); px(x-12+wob,y-14,24,3,"#a78bfa");
    px(x-6+wob,y-20,4,4,"#fef9c3"); px(x+2+wob,y-18,4,4,"#fef9c3");
    if(isNight()) px(x-13,y-24,26,18,"rgba(167,139,250,.18)");
  }else if(v==="twisted"){
    px(x-4,y-16,7,18,"#3f3f46");
    px(x-4,y-16,12,3,"#52525b"); px(x-12,y-12,9,3,"#52525b");
    px(x-6,y-20,4,4,"#a855f7");
  }else if(v==="crystaltree"){
    px(x-3,y-8,6,12,"#475569");
    px(x-8+wob,y-22,7,14,"#67e8f9"); px(x+1+wob,y-24,7,16,"#a78bfa"); px(x-3,y-20,4,4,"#fff");
    if(isNight()) px(x-10,y-26,20,22,"rgba(168,85,247,.2)");
  }else{ // oak
    px(x-3,y-2,6,10,"#5b3a1e");
    px(x-11+wob,y-22,22,16,id==="gelo"?"#7fa8c9":"#1f6b2d");
    px(x-8+wob,y-26,16,8,id==="gelo"?"#a8c8e0":"#2d8a3d");
    px(x-4+wob,y-29,8,4,id==="gelo"?"#f1f5f9":"#3fb950");
  }
  if(r.hp<r.maxHp){ctx.fillStyle="#000";ctx.fillRect(x-10,y-32,20,3);ctx.fillStyle="#f00";ctx.fillRect(x-10,y-32,20*(r.hp/r.maxHp),3);}
}
function drawRock(x,y,r){
  drawShadow(x,y,9);
  px(x-10,y-10,20,12,P().id==="gelo"?"#94a3b8":"#6b7280");
  px(x-8,y-12,14,4,"#cbd5e1"); px(x-4,y-8,5,5,"#475569");
  if(r.hp<r.maxHp){ctx.fillStyle="#000";ctx.fillRect(x-10,y-16,20,3);ctx.fillStyle="#f00";ctx.fillRect(x-10,y-16,20*(r.hp/r.maxHp),3);}
}
function drawBush(x,y,r){
  drawShadow(x,y,8);
  const v=(r&&r.v)||"berry";
  if(v==="glowshroom"){
    px(x-8,y-4,16,8,"#4c1d95");
    px(x-6,y-10,4,8,"#a78bfa"); px(x+1,y-12,5,10,"#c4b5fd"); px(x-1,y-8,3,3,"#fef9c3");
    if(isNight()) px(x-10,y-14,20,16,"rgba(167,139,250,.2)");
  }else if(v==="darkberry"){
    px(x-10,y-8,20,10,"#3b2d5c"); px(x-7,y-11,14,5,"#5b4a8a");
    px(x-6,y-6,3,3,"#a78bfa"); px(x+1,y-8,3,3,"#a78bfa"); px(x+5,y-5,3,3,"#a78bfa");
  }else if(v==="frostberry"){
    px(x-10,y-8,20,10,"#3b6b8a"); px(x-7,y-11,14,5,"#7fb8d4");
    px(x-6,y-6,3,3,"#bae6fd"); px(x+1,y-8,3,3,"#ef4444"); px(x-8,y-11,14,2,"#f1f5f9");
  }else if(v==="iceherb"){
    px(x-8,y-4,16,7,"#0ea5e9"); px(x-4,y-9,8,6,"#bae6fd"); px(x-1,y-11,2,3,"#fff");
  }else if(v==="drybush"){
    px(x-9,y-6,18,8,"#a8a029"); px(x-5,y-9,10,4,"#ca8a04");
  }else if(v==="aloevera"){
    px(x-8,y-2,4,8,"#16a34a"); px(x-3,y-4,4,10,"#22c55e"); px(x+2,y-2,4,8,"#4ade80");
  }else if(v==="medical"){
    px(x-10,y-8,20,10,"#2d7a2d"); px(x-7,y-11,14,5,"#3fb950");
    px(x-5,y-7,4,4,"#f8fafc"); px(x+1,y-7,2,4,"#ef4444");
  }else if(v==="flowerbush"){
    px(x-10,y-8,20,10,"#2d7a2d"); px(x-7,y-11,14,5,"#4ade80");
    px(x-6,y-7,3,3,"#f472b6"); px(x+1,y-9,3,3,"#fde047"); px(x+5,y-6,3,3,"#f8fafc");
  }else{
    px(x-10,y-8,20,10,P().id==="gelo"?"#3b6b8a":"#2d7a2d");
    px(x-7,y-11,14,5,"#3fb950");
    px(x-6,y-6,3,3,"#ef4444"); px(x+1,y-8,3,3,"#ef4444"); px(x+5,y-5,3,3,"#ef4444");
  }
}
function drawGrassTuft(x,y){
  const c=P().id==="areia"?"#a8a029":P().id==="gelo"?"#bae6fd":"#65a30d";
  px(x-6,y-4,2,6,c); px(x-2,y-6,2,8,c); px(x+2,y-5,2,7,c); px(x+5,y-3,2,5,c);
}
// ---------- desenho: mar (algas, ostras, corais, barco, vida marinha) ----------
function drawKelp(x,y){
  const s1=Math.sin(elapsed*2+x*0.1)*2, s2=Math.sin(elapsed*2.4+x*0.13+2)*2;
  px(x-5,y-14+s1,4,16,"#16a34a"); px(x-1,y-18+s2,4,20,"#22c55e"); px(x+3,y-12-s1,4,14,"#15803d");
}
function drawClam(x,y){
  const bob=Math.sin(elapsed*3+x)*1;
  px(x-8,y-4+bob,16,8,"#94a3b8"); px(x-8,y-4+bob,16,3,"#cbd5e1");
  px(x-2,y-6+bob,4,3,"#f0abfc");
}
function drawCoral(x,y){
  px(x-2,y-12,4,14,"#f472b6"); px(x-9,y-10,8,4,"#ec4899"); px(x+1,y-8,8,4,"#ec4899");
  px(x-2,y-12,4,3,"#fbcfe8");
}
function drawBoat(x,y){
  const bob=Math.sin(elapsed*2+x*0.05)*2;
  px(x-15,y-3+bob,30,9,"#92400e"); px(x-15,y-3+bob,30,3,"#b45309");
  px(x-2,y-22+bob,4,20,"#573818"); px(x+2,y-22+bob,11,15,"#fef3c7"); px(x+2,y-22+bob,11,3,"#e7c873");
}
function drawSealife(s,x,y){
  const wob=Math.sin(s.frame)*1.5;
  if(s.kind==="fish"){
    px(x-7,y-3+wob,13,7,"#38bdf8"); px(x-7,y-3+wob,13,2,"#7dd3fc");
    px(x+5,y-4+wob,5,9,"#0284c7"); px(x-4,y-2+wob,2,2,"#fff");
  }else if(s.kind==="squid"){
    px(x-5,y-12,10,10,"#c084fc"); px(x-5,y-12,10,3,"#e9d5ff");
    px(x-4,y-2,3,8,"#a855f6"); px(x-1,y-2,3,10,"#a855f6"); px(x+2,y-2,3,8,"#a855f6");
    px(x-3,y-9,2,2,"#fff"); px(x+1,y-9,2,2,"#fff");
  }else if(s.kind==="shark"){
    px(x-13,y-5,26,10,"#94a3b8"); px(x-13,y+1,26,4,"#e2e8f0");
    px(x-3,y-11,6,7,"#64748b"); px(x-18,y-4,6,9,"#64748b");
    px(x+6,y-3,3,3,"#0f172a"); px(x+2,y+2,10,2,"#f8fafc");
  }else if(s.kind==="octopus"){
    px(x-10,y-12,20,13,"#ef4444"); px(x-10,y-12,20,4,"#fca5a5");
    px(x-9,y+1+wob,4,9,"#dc2626"); px(x-3,y+1-wob,4,11,"#dc2626"); px(x+3,y+1+wob,4,9,"#dc2626");
    px(x-6,y-8,4,4,"#fff"); px(x+2,y-8,4,4,"#fff"); px(x-5,y-7,2,2,"#000"); px(x+3,y-7,2,2,"#000");
  }else if(s.kind==="whale"){
    px(x-26,y-9,52,18,"#3b82f6"); px(x-26,y+3,52,6,"#bfdbfe");
    px(x-32,y-7,8,12,"#2563eb"); px(x+26,y-11,8,12,"#2563eb");
    px(x+14,y-5,4,4,"#0f172a");
    if(Math.sin(elapsed*0.5+s.x*0.01)>0.96){ px(x-4,y-22,3,8,"#e0f2fe"); px(x+1,y-24,3,6,"#e0f2fe"); }
  }
  if(s.flash>0){ ctx.fillStyle="rgba(255,255,255,.65)"; ctx.fillRect(x-s.r-2,y-s.r-2,(s.r+2)*2,(s.r+2)*2); }
  if(s.hp<s.maxHp){ctx.fillStyle="#000";ctx.fillRect(x-12,y-s.r-10,24,3);ctx.fillStyle="#ef4444";ctx.fillRect(x-12,y-s.r-10,24*(s.hp/s.maxHp),3);}
}
function drawEnemy(e,x,y){
  drawShadow(x,y,e.r);
  const b=Math.sin(e.frame)*2;
  if(e.kind==="slime"){
    px(x-10,y-8+b,20,12,"#22c55e"); px(x-10,y-8+b,20,4,"#86efac");
    px(x-5,y-4+b,4,4,"#000"); px(x+2,y-4+b,4,4,"#000");
  }else if(e.kind==="bee"){
    px(x-8,y-6+b,16,12,"#facc15"); px(x-8,y-6+b,4,12,"#000"); px(x-1,y-6+b,4,12,"#000");
    px(x-12,y-12+b,8,6,"rgba(255,255,255,.8)"); px(x+4,y-12+b,8,6,"rgba(255,255,255,.8)");
    px(x-3,y-3+b,3,3,"#000"); px(x+2,y-3+b,3,3,"#000");
  }else if(e.kind==="boar"){
    px(x-14,y-10,28,12,P().id==="gelo"?"#e2e8f0":"#92400e");
    px(x+8,y-14,10,8,P().id==="gelo"?"#e2e8f0":"#92400e");
    px(x+11,y-12,3,3,"#000"); px(x+10,y-6,6,3,"#fef3c7");
    px(x-10,y+0,5,6,"#573818"); px(x+6,y+0,5,6,"#573818");
  }else if(e.kind==="wolf"){
    const fur=P().id==="gelo"?"#e2e8f0":"#6b7280";
    px(x-12,y-8,24,10,fur); px(x+6,y-12,8,6,fur);
    px(x+8,y-10,3,3,"#ef4444");
    px(x-12,y-4,4,6,"#4b5563"); px(x+8,y-4,4,6,"#4b5563");
    px(x-14+b,y-8,4,4,fur);
  }else if(e.kind==="scorpion"){
    px(x-12,y-4,24,8,"#b45309"); px(x+8,y-10,10,4,"#b45309");
    px(x+14,y-16+b,4,8,"#92400e"); px(x+13,y-18+b,6,4,"#ef4444");
    px(x-14,y-2,6,3,"#78350f"); px(x-14,y+2,6,3,"#78350f");
    px(x-4,y-2,3,3,"#ef4444"); px(x+2,y-2,3,3,"#ef4444");
  }else if(e.kind==="golem"){
    px(x-12,y-18,24,20,"#78716c"); px(x-12,y-18,24,5,"#a8a29e");
    px(x-8,y-12,6,5,"#fde047"); px(x+3,y-12,6,5,"#fde047");
    px(x-14,y-8+b,5,12,"#57534c"); px(x+10,y-8-b,5,12,"#57534c");
  }else if(e.kind==="skeleton"){
    px(x-7,y-20,14,12,"#f8fafc"); px(x-4,y-16,3,3,"#000"); px(x+2,y-16,3,3,"#000");
    px(x-6,y-8,12,10,"#e2e8f0"); px(x-9,y-6,3,8,"#f8fafc"); px(x+7,y-6,3,8,"#f8fafc");
    px(x-6,y+2,5,5,"#cbd5e1"); px(x+2,y+2,5,5,"#cbd5e1");
  }else if(e.kind==="ghost"||e.kind==="shade"){
    const c=e.kind==="shade"?"#7c3aed":"#ddd6fe";
    ctx.globalAlpha=0.75+Math.sin(e.frame*0.5)*0.15;
    px(x-10,y-20+b,20,20,c);
    px(x-10,y-6+b,4,8,c); px(x-2,y-6+b,4,10,c); px(x+6,y-6+b,4,8,c);
    px(x-5,y-14+b,4,6,e.kind==="shade"?"#f00":"#000"); px(x+2,y-14+b,4,6,e.kind==="shade"?"#f00":"#000");
    ctx.globalAlpha=1;
  }else if(e.kind==="bat"){
    const w=Math.sin(e.frame*2)*6;
    px(x-14,y-10+w,10,5,"#6d28d9"); px(x+4,y-10-w,10,5,"#6d28d9");
    px(x-6,y-8+b,12,10,"#4c1d95"); px(x-3,y-5+b,3,3,"#ef4444"); px(x+1,y-5+b,3,3,"#ef4444");
  }else{
    px(x-14,y-22,28,18,"#15803d"); px(x-10,y-28,8,8,"#15803d"); px(x+3,y-28,8,8,"#15803d");
    px(x-10,y-27,4,4,"#fbbf24"); px(x+7,y-27,4,4,"#fbbf24");
    px(x-8,y-16,16,5,"#fff"); px(x-16,y-10,8,12,"#166534"); px(x+9,y-10,8,12,"#166534");
    px(x+12,y-12+b,10,4,"#78350f");
  }
  if(e.flash>0){ctx.fillStyle="rgba(255,255,255,.6)";ctx.fillRect(x-e.r-2,y-24,e.r*2+4,e.r+26);}
  if(e.hp<e.maxHp){ctx.fillStyle="#000";ctx.fillRect(x-12,y-32,24,4);ctx.fillStyle=e.kind==="orc"?"#f97316":"#ef4444";ctx.fillRect(x-12,y-32,24*(e.hp/e.maxHp),4);}
}
function drawBuilding(b, sx, sy){
  const x=(sx===undefined?b.tx*TILE+16:sx), y=(sy===undefined?b.ty*TILE+16:sy);
  if(b.kind==="wall"){
    px(x-15,y-14,30,26,"#92400e"); px(x-15,y-14,30,5,"#b45309");
    for(let i=0;i<3;i++) px(x-15,y-4+i*8,30,2,"#78350f");
  }else if(b.kind==="fence"){
    px(x-14,y-2,28,5,"#92400e"); px(x-14,y-10,28,4,"#b45309");
    px(x-11,y-14,5,22,"#78350f"); px(x+6,y-14,5,22,"#78350f");
  }else if(b.kind==="torch"){
    px(x-2,y-8,4,12,"#78350f");
    const f=Math.sin(elapsed*10+x)*2;
    px(x-5,y-16+f,10,8,"#f59e0b"); px(x-3,y-14+f,6,5,"#fde047");
  }else if(b.kind==="campfire"){
    px(x-12,y+2,24,8,"#57534c"); px(x-9,y-4,18,8,"#78350f");
    const f=Math.sin(elapsed*9+x)*2;
    px(x-7,y-14+f,14,12,"#ef4444"); px(x-4,y-11+f,8,8,"#f97316"); px(x-1,y-8+f,4,5,"#fde047");
  }else if(b.kind==="tent"){
    px(x-16,y+4,32,4,"#573818");
    px(x-14,y-8,28,14,"#d97706"); px(x-14,y-8,28,4,"#f59e0b");
    px(x-4,y-12,8,6,"#78350f"); px(x-2,y-6,4,10,"#422006");
  }else if(b.kind==="cabin"){
    px(x-16,y-14,32,20,"#92400e"); px(x-16,y-14,32,5,"#b45309");
    px(x-18,y-20,36,8,"#573818");
    px(x-5,y-6,10,12,"#422006"); px(x-10,y-10,6,6,"#fde047"); px(x+5,y-10,6,6,"#fde047");
  }else if(b.kind==="workbench"){
    px(x-14,y-2,28,12,"#78350f"); px(x-14,y-2,28,3,"#a16207");
    px(x-11,y+8,5,6,"#451a03"); px(x+7,y+8,5,6,"#451a03");
    px(x-8,y-8,10,7,"#d6d3d1"); px(x+3,y-9,8,8,"#92400e");
  }else if(b.kind==="rocket"){
    drawShadow(x,y+6,10);
    px(x-8,y-22,16,28,"#e2e8f0"); px(x-8,y-22,16,5,"#ef4444");
    px(x-2,y-26,4,6,"#94a3b8"); px(x-4,y-14,8,6,"#38bdf8");
    px(x-14,y-10,6,14,"#ef4444"); px(x+8,y-10,6,14,"#ef4444");
    const f=Math.sin(elapsed*12)*2;
    px(x-4,y+8+f,8,7,"#f97316"); px(x-2,y+10+f,4,5,"#fde047");
  }else if(b.kind==="deck"){
    px(x-13,y+2,5,9,"#573818"); px(x+8,y+2,5,9,"#573818");
    px(x-16,y-6,32,10,"#a16207");
    for(let i=0;i<4;i++) px(x-16,y-6+i*3,32,1,"#78350f");
    px(x-16,y-6,32,2,"#d6a55c");
  }
  if(b.hp<b.maxHp){ctx.fillStyle="#000";ctx.fillRect(x-14,y-22,28,3);ctx.fillStyle="#22c55e";ctx.fillRect(x-14,y-22,28*(b.hp/b.maxHp),3);}
}
function drawDrop(d){
  const b=Math.sin(elapsed*4+d.x)*2;
  if(d.item==="raw"){px(d.x-5,d.y-4+b,10,7,"#ef4444"); px(d.x-5,d.y-4+b,10,2,"#fecaca");}
  else if(d.item==="cooked"){px(d.x-6,d.y-4+b,12,7,"#b45309"); px(d.x-2,d.y-7+b,4,4,"#fde68a");}
  else if(d.item==="fruit"){px(d.x-3,d.y-5+b,6,6,"#ef4444"); px(d.x-1,d.y-7+b,2,2,"#22c55e");}
  else if(d.item==="bandage"){px(d.x-6,d.y-4+b,12,7,"#f8fafc"); px(d.x-2,d.y-3+b,4,5,"#ef4444");}
  else if(d.item==="fish"){px(d.x-6,d.y-3+b,12,6,"#38bdf8"); px(d.x+4,d.y-4+b,4,6,"#0284c7"); px(d.x-4,d.y-2+b,2,2,"#fff");}
  else if(d.item==="pearl"){px(d.x-4,d.y-4+b,8,7,"#cbd5e1"); px(d.x-2,d.y-2+b,3,3,"#fff");}
}
// ---------- desenho: POIs, bichos, decoração ----------
function drawPOI(p,x,y){
  drawShadow(x,y,10);
  const bob=Math.sin(elapsed*3+p.seed)*1.5;
  if(p.kind==="chest"){
    px(x-11,y-6+bob,22,12,"#92400e"); px(x-11,y-6+bob,22,4,"#b45309");
    px(x-2,y-4+bob,4,10,"#fde047");
    px(x-11,y-6+bob,22,2,"#78350f");
    if(Math.sin(elapsed*4+p.seed)>0.7){ px(x-3,y-12+bob,6,4,"#fef9c3"); px(x-1,y-14+bob,2,2,"#fff"); }
  }else if(p.kind==="crystal"){
    const c=P().id==="gelo"?"#bae6fd":P().id==="sombra"?"#c4b5fd":"#67e8f9";
    const c2=P().id==="gelo"?"#38bdf8":P().id==="sombra"?"#8b5cf6":"#0ea5e9";
    px(x-6,y-12+bob,12,16,c2); px(x-4,y-16+bob,8,6,c);
    px(x-2,y-10+bob,3,8,"rgba(255,255,255,.8)");
    if(isNight()){ px(x-8,y-18+bob,16,22,"rgba(168,85,247,.15)"); }
  }else if(p.kind==="herb"){
    if(P().id==="sombra"){
      px(x-8,y-4,16,8,"#6d28d9"); px(x-6,y-10+bob,4,8,"#a78bfa"); px(x+1,y-12+bob,5,10,"#c4b5fd"); px(x-1,y-8+bob,3,3,"#fef9c3");
    }else if(P().id==="gelo"){
      px(x-6,y-4,12,6,"#0ea5e9"); px(x-4,y-8+bob,8,5,"#bae6fd"); px(x-1,y-11+bob,2,3,"#fff");
    }else if(P().id==="areia"){
      px(x-5,y-6,10,8,"#65a30d"); px(x-3,y-10+bob,6,5,"#84cc16"); px(x-1,y-12+bob,2,2,"#fef08a");
    }else{
      px(x-6,y-4,12,6,"#16a34a"); px(x-4,y-8,3,5,"#ef4444"); px(x+1,y-9+bob,3,5,"#f472b6"); px(x-1,y-7,3,4,"#fde047");
    }
  }else if(p.kind==="obelisk"){
    const off=p.cd>0;
    px(x-8,y-20,16,24,off?"#475569":"#334155"); px(x-8,y-20,16,4,off?"#64748b":"#38bdf8");
    px(x-5,y-16,10,12,off?"#334155":"#0f172a");
    px(x-3,y-14+Math.sin(elapsed*5)*1,6,6,off?"#475569":"#7dd3fc");
    if(!off&&Math.sin(elapsed*4)>0) px(x-10,y-22,20,28,"rgba(56,189,248,.12)");
  }else if(p.kind==="ruin"){
    px(x-12,y-8,24,12,"#78716c"); px(x-12,y-8,24,3,"#a8a29e");
    px(x-9,y-14,6,8,"#57534c"); px(x+3,y-16,6,10,"#57534c");
    px(x-4,y-5,8,2,"#0ea5e9");
    if(P().id==="areia"){ px(x-12,y-8,24,3,"#d6a55c"); }
  }else if(p.kind==="cave"){
    drawShadow(x,y+4,14);
    px(x-18,y-24,36,28,"#57534c"); px(x-18,y-24,36,6,"#78716c");
    px(x-11,y-14,22,18,"#0c0a09"); px(x-11,y-14,22,4,"#292524");
    px(x-8,y-2+bob,5,4,"#a855f7"); px(x+3,y-4+bob,5,4,"#67e8f9");
    px(x-18,y-24,6,28,"#44403c"); px(x+12,y-24,6,28,"#44403c");
  }
  if(p.cd>0&&(p.kind==="obelisk"||p.kind==="ruin")){ ctx.fillStyle="rgba(0,0,0,.4)"; ctx.fillRect(x-10,y-24,20,3); }
}
function drawCritter(c,x,y){
  const f=Math.sin(c.frame*6)*2;
  if(c.kind==="butterfly"){
    px(x-6,y+f,5,4,"#f472b6"); px(x+1,y-f,5,4,"#60a5fa"); px(x-1,y,2,4,"#000");
  }else if(c.kind==="bird"){
    drawShadow(x,y,6);
    px(x-7,y-4+f,14,7,"#94a3b8"); px(x+3,y-7+f,6,4,"#64748b"); px(x+7,y-6+f,3,2,"#fbbf24");
  }else if(c.kind==="owl"){
    px(x-6,y-6,12,12,"#92400e"); px(x-4,y-4,3,3,"#fde047"); px(x+1,y-4,3,3,"#fde047");
  }else if(c.kind==="rabbit"){
    drawShadow(x,y,6);
    px(x-7,y-5,14,8,"#e2e8f0"); px(x-7,y-13,3,8,"#e2e8f0"); px(x+4,y-13,3,8,"#e2e8f0");
    px(x+3,y-3,2,2,"#ef4444");
  }else if(c.kind==="penguin"){
    drawShadow(x,y,6);
    px(x-5,y-10,10,14,"#1e293b"); px(x-3,y-8,6,10,"#f8fafc"); px(x-2,y-6,2,2,"#000"); px(x+1,y-6,2,2,"#000"); px(x-1,y-2,3,2,"#f59e0b");
  }else if(c.kind==="firefly"){
    const g=0.5+Math.sin(elapsed*6+c.frame)*0.5;
    px(x-1,y-1,3,3,`rgba(253,224,71,${0.4+g*0.6})`);
    if(isNight()) px(x-6,y-6,12,12,"rgba(253,224,71,.12)");
  }else if(c.kind==="bee2"){
    px(x-5,y-3+f,10,6,"#facc15"); px(x-2,y-3+f,2,6,"#000");
  }else if(c.kind==="chicken"){
    drawShadow(x,y,6);
    px(x-6,y-8,12,10,"#f8fafc"); px(x+4,y-12,6,6,"#f8fafc");
    px(x+7,y-10,4,3,"#f59e0b"); px(x+5,y-11,3,3,"#ef4444");
    px(x-2,y-6,2,2,"#000"); px(x-6,y,3,5,"#f59e0b"); px(x+3,y,3,5,"#f59e0b");
  }else if(c.kind==="chick"){
    px(x-4,y-5,8,7,"#fde047"); px(x+2,y-8,4,4,"#fde047");
    px(x+4,y-7,2,2,"#f59e0b"); px(x-1,y-4,2,2,"#000");
  }else if(c.kind==="pig"){
    drawShadow(x,y,7);
    px(x-11,y-8,22,11,"#f9a8d4"); px(x+7,y-12,8,7,"#f9a8d4");
    px(x+9,y-10,2,2,"#000"); px(x+9,y-6,5,4,"#f472b6"); px(x+10,y-5,3,2,"#be185d");
    px(x-7,y+1,4,4,"#f472b6"); px(x+4,y+1,4,4,"#f472b6");
  }else if(c.kind==="horse"){
    drawShadow(x,y,9);
    const gallop=Math.sin(c.frame*8)*2;
    px(x-14,y-14,26,12,c.pet?"#92400e":"#78350f");
    px(x+8,y-22+gallop,10,10,"#78350f"); px(x+10,y-28+gallop,6,8,"#92400e");
    px(x+12,y-26+gallop,2,2,"#000");
    px(x-12,y-4+gallop,4,8,"#573818"); px(x-4,y-4-gallop,4,8,"#573818");
    px(x+4,y-4+gallop,4,8,"#573818"); px(x+10,y-4-gallop,4,8,"#573818");
    px(x-16,y-14,5,4,"#3f2a14");
  }else if(c.kind==="dog"){
    drawShadow(x,y,6);
    const wag=Math.sin(c.frame*10)*3;
    px(x-9,y-7,18,9,c.pet?"#b45309":"#78716c"); px(x+6,y-12,7,6,c.pet?"#b45309":"#78716c");
    px(x+8,y-10,2,2,"#000"); px(x+10,y-6,3,3,"#000");
    px(x-12,y-8+wag,3,6,c.pet?"#b45309":"#78716c");
    if(c.pet){ px(x-2,y-14,4,3,"#ef4444"); } // coleira
  }else if(c.kind==="squirrel"){
    drawShadow(x,y,5);
    const tail=Math.sin(c.frame*7)*3;
    px(x-5,y-6,10,8,P().id==="gelo"?"#e2e8f0":"#b45309");
    px(x+1,y-12,6,6,P().id==="gelo"?"#e2e8f0":"#b45309");
    px(x+3,y-10,2,2,"#000"); px(x-11,y-12+tail,4,10,P().id==="gelo"?"#cbd5e1":"#92400e");
  }else{ // batty
    px(x-8,y-4+f,7,4,"#6d28d9"); px(x+1,y-4-f,7,4,"#6d28d9"); px(x-3,y-3,6,6,"#4c1d95");
  }
  if(c.hp!==undefined&&c.hp<c.maxHp){ctx.fillStyle="#000";ctx.fillRect(x-10,y-20,20,3);ctx.fillStyle="#ef4444";ctx.fillRect(x-10,y-20,20*(c.hp/c.maxHp),3);}
}
function drawMount(x,y){
  drawShadow(x,y,10);
  px(x-14,y-12,28,13,"#92400e");
  px(x+8,y-22,11,11,"#92400e"); px(x+11,y-28,7,9,"#b45309");
  px(x-14,y-4,5,9,"#573818"); px(x-4,y-4,5,9,"#573818"); px(x+5,y-4,5,9,"#573818"); px(x+11,y-4,5,9,"#573818");
  px(x-2,y-20,10,5,"#422006");
}
// decoração barata por hash: flores, ossos, cogumelos, pedrinhas
function drawDecorTile(tx,ty,sx,sy,t){
  const h1=hash2(tx,ty,1234), h2=hash2(tx,ty,5678), id=P().id;
  if(t===0){
    if(h1>0.93){ px(sx+6,sy+8,3,3,"rgba(255,255,255,.5)"); }
    return;
  }
  if(t===1){
    if(id==="areia"&&h1>0.94){ px(sx+10,sy+8,8,3,"#e7e5e4"); px(sx+12,sy+4,3,5,"#e7e5e4"); } // ossos
    else if(h1>0.9){ px(sx+8,sy+12,4,2,"rgba(0,0,0,.15)"); }
    else if(h1>0.86){ px(sx+14,sy+6,3,3,"#d6a55c"); }
    return;
  }
  if(t===4) return;
  if(id==="sombra"){
    if(h1>0.90){ const g=Math.sin(elapsed*3+tx)*1; px(sx+12,sy+10,5,8,"#7c3aed"); px(sx+13,sy+6+g,3,4,"#a78bfa"); }
    else if(h1>0.82){ px(sx+6,sy+14,3,5,"#4c1d95"); }
  }else if(id==="gelo"){
    if(h1>0.90){ px(sx+10,sy+8,6,6,"rgba(186,230,253,.9)"); px(sx+11,sy+9,2,2,"#fff"); }
    else if(h1>0.80){ px(sx+5,sy+12,8,3,"#f1f5f9"); }
  }else if(id==="areia"){
    if(h1>0.90){ px(sx+12,sy+10,3,8,"#4d7c0f"); px(sx+13,sy+8,2,2,"#a3e635"); }
    else if(h1>0.84&&h2>0.5){ px(sx+6,sy+14,5,2,"#92400e"); }
  }else{
    if(h1>0.88){ const c=h2>0.5?"#f472b6":h2>0.3?"#fde047":"#f8fafc"; px(sx+10,sy+10,3,5,"#16a34a"); px(sx+9,sy+7,5,4,c); }
    else if(h1>0.80){ px(sx+16,sy+14,4,2,"#65a30d"); }
    else if(h1>0.76){ px(sx+4,sy+8,3,3,"#a8a29e"); }
  }
}

// ---------- render (mundo redondo: wrap em tudo) ----------
function render(){
  const W=canvas.width,H=canvas.height;
  if(interior){ drawInterior(); drawMinimap(); return; }
  const vw=W/ZOOM, vh=H/ZOOM;
  ctx.fillStyle="#05060f"; ctx.fillRect(0,0,W,H);
  cam.x=wrap(player.x-vw/2,WPX); cam.y=wrap(player.y-vh/2,WPY);

  ctx.save();
  ctx.scale(ZOOM,ZOOM);
  const offX=cam.x%TILE, offY=cam.y%TILE;
  const startTx=Math.floor(cam.x/TILE), startTy=Math.floor(cam.y/TILE);
  const nx=Math.ceil(vw/TILE)+1, ny=Math.ceil(vh/TILE)+1;
  for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){
    const tx=wrap(startTx+i,WORLD_W), ty=wrap(startTy+j,WORLD_H);
    ctx.fillStyle=tileColor(tileAt(tx,ty),tx,ty);
    ctx.fillRect(i*TILE-offX,j*TILE-offY,TILE+1,TILE+1);
    const h=hash2(tx,ty,99);
    const t=tileAt(tx,ty);
    if(t===2&&h>0.8){ctx.fillStyle="rgba(0,0,0,.12)";ctx.fillRect(i*TILE-offX+8,j*TILE-offY+10,3,3);}
    if(t===0&&h>0.6){ctx.fillStyle="rgba(255,255,255,.3)";ctx.fillRect(i*TILE-offX+((elapsed*8+tx*7)%TILE),j*TILE-offY+8,6,2);}
    drawDecorTile(tx,ty,i*TILE-offX,j*TILE-offY,t);
  }
  const SX=(wx)=>wdx(wx,cam.x,WPX), SY=(wy)=>wdx(wy,cam.y,WPY);
  const vis=(wx,wy,m)=>{const sx=SX(wx),sy=SY(wy);return sx>-m&&sy>-m&&sx<vw+m&&sy<vh+m;};
  for(const d of drops) if(vis(d.x,d.y,20)) drawDrop(d);
  for(const p of pois){
    const bx=p.tx*TILE+16, by=p.ty*TILE+16;
    if(!vis(bx,by,50)) continue;
    drawPOI(p,SX(bx),SY(by));
  }
  for(const c of critters) if(vis(c.x,c.y,30)) drawCritter(c,SX(c.x),SY(c.y));
  for(const s of sealife) if(vis(s.x,s.y,44)) drawSealife(s,SX(s.x),SY(s.y));
  for(const r of resources){
    const bx=r.tx*TILE+16, by=r.ty*TILE+16;
    if(!vis(bx,by,40)) continue;
    const sx=SX(bx), sy=SY(by);
    if(r.kind==="tree") drawTree(sx,sy,r);
    else if(r.kind==="rock") drawRock(sx,sy,r);
    else if(r.kind==="bush") drawBush(sx,sy,r);
    else if(r.kind==="kelp") drawKelp(sx,sy);
    else if(r.kind==="clam") drawClam(sx,sy);
    else if(r.kind==="coral") drawCoral(sx,sy);
    else drawGrassTuft(sx,sy);
  }
  for(const b of buildings){
    const bx=b.tx*TILE+16, by=b.ty*TILE+16;
    if(!vis(bx,by,40)) continue;
    drawBuilding(b,SX(bx),SY(by));
  }
  const sorted=[...enemies].sort((a,b2)=>wdx(a.y,cam.y,WPY)-wdx(b2.y,cam.y,WPY));
  for(const e of sorted) if(vis(e.x,e.y,40)) drawEnemy(e,SX(e.x),SY(e.y));
  const pSX=SX(player.x), pSY=SY(player.y);
  if(player.sailing) drawBoat(pSX,pSY+6);
  if(player.mounted){ drawMount(pSX,pSY); drawPlayer(pSX,pSY-12); }
  else drawPlayer(pSX,pSY);
  if(player.swimming){
    ctx.globalAlpha=0.35; ctx.fillStyle="#0284c7";
    ctx.fillRect(pSX-13,pSY-4,26,14); ctx.globalAlpha=1;
  }
  if(player.fishing){
    const F=player.fishing, bx=SX(F.x), by=SY(F.y);
    ctx.strokeStyle="rgba(255,255,255,.7)"; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(pSX,pSY-14); ctx.lineTo(bx,by); ctx.stroke();
    const bob=Math.sin(elapsed*6)*2;
    px(bx-3,by-6+bob,6,6,"#ef4444"); px(bx-3,by-3+bob,6,3,"#fff");
    if(F.phase==="bite"){ ctx.fillStyle="#fde047"; ctx.font="bold 15px monospace"; ctx.textAlign="center"; ctx.fillText("❗",bx,by-13+bob); ctx.textAlign="left"; }
  }
  if(player.netAnim&&player.netAnim.t<0.45){
    const N=player.netAnim, nx2=SX(N.x), ny2=SY(N.y), rr=10+N.t*95;
    ctx.strokeStyle="rgba(224,242,254,.9)"; ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(nx2,ny2,rr,0,7); ctx.stroke();
  }

  for(const p of particles){ctx.fillStyle=p.color;ctx.globalAlpha=1-p.t/p.life;ctx.fillRect(SX(p.x),SY(p.y),p.size,p.size);}
  for(const a of ambientP){
    const sx=SX(a.x), sy=SY(a.y);
    ctx.globalAlpha=0.7*(1-a.t/a.life);
    if(a.id==="gelo"){ ctx.fillStyle="#f1f5f9"; ctx.fillRect(sx,sy,2,2); }
    else if(a.id==="areia"){ ctx.fillStyle="#e7c873"; ctx.fillRect(sx,sy,2,1); }
    else if(a.id==="sombra"){ ctx.fillStyle="#a78bfa"; ctx.fillRect(sx,sy,2,2); }
    else{ ctx.fillStyle="#86efac"; ctx.fillRect(sx,sy,2,2); }
  }
  ctx.globalAlpha=1;
  ctx.font="bold 12px monospace"; ctx.textAlign="center";
  for(const f of floaters){ctx.globalAlpha=1-f.t/f.life;ctx.fillStyle="#000";ctx.fillText(f.txt,SX(f.x)+1,SY(f.y)+1);ctx.fillStyle=f.color;ctx.fillText(f.txt,SX(f.x),SY(f.y));}
  ctx.globalAlpha=1; ctx.textAlign="left";

  if(buildMode&&started&&!gameOver){
    const tx=wrap(Math.floor(wrap(mouse.wx,WPX)/TILE),WORLD_W), ty=wrap(Math.floor(wrap(mouse.wy,WPY)/TILE),WORLD_H);
    ctx.globalAlpha=0.55;
    ctx.fillStyle="#fff";
    ctx.fillRect(SX(tx*TILE+16)-14,SY(ty*TILE+16)-14,28,28);
    ctx.globalAlpha=1;
    let ok=!buildings.some(b=>b.tx===tx&&b.ty===ty);
    if(ok){
      if(buildMode==="deck"){
        ok=tileAt(tx,ty)===0;
        if(ok){
          let shore=false;
          for(const [ox,oy] of [[1,0],[-1,0],[0,1],[0,-1]]){
            const nt=tileAt(wrap(tx+ox,WORLD_W),wrap(ty+oy,WORLD_H));
            if(nt===1||nt===2||nt===3){shore=true;break;}
          }
          ok=shore;
        }
      } else ok=!isSolidTile(tx,ty);
    }
    ctx.strokeStyle=ok?"#4ade80":"#ef4444";ctx.lineWidth=2/ZOOM;
    ctx.strokeRect(SX(tx*TILE),SY(ty*TILE),TILE,TILE);
  }
  ctx.restore();

  // noite / clima do planeta
  const night=isNight();
  const nA=night?(player.torchLit&&player.torchFuel>0?0.5:0.68):0;
  if(nA>0.02){
    ctx.fillStyle=`rgba(5,5,30,${nA})`;ctx.fillRect(0,0,W,H);
    ctx.globalCompositeOperation="lighter";
    const lights=[];
    for(const b of buildings) if(b.light) lights.push({x:wdx(b.tx*TILE+16,cam.x,WPX)*ZOOM,y:wdx(b.ty*TILE+16,cam.y,WPY)*ZOOM,r:b.light*ZOOM});
    for(const p of pois){
      if(p.kind==="crystal") lights.push({x:wdx(p.tx*TILE+16,cam.x,WPX)*ZOOM,y:wdx(p.ty*TILE+16,cam.y,WPY)*ZOOM,r:90*ZOOM,col:"168,85,247"});
      else if(p.kind==="obelisk"&&p.cd<=0) lights.push({x:wdx(p.tx*TILE+16,cam.x,WPX)*ZOOM,y:wdx(p.ty*TILE+16,cam.y,WPY)*ZOOM,r:110*ZOOM,col:"56,189,248"});
      else if(p.kind==="herb"&&P().id==="sombra") lights.push({x:wdx(p.tx*TILE+16,cam.x,WPX)*ZOOM,y:wdx(p.ty*TILE+16,cam.y,WPY)*ZOOM,r:70*ZOOM,col:"167,139,250"});
    }
    lights.push({x:wdx(player.x,cam.x,WPX)*ZOOM,y:wdx(player.y,cam.y,WPY)*ZOOM,r:lightRadius()*ZOOM});
    for(const L of lights){
      if(L.x<-L.r||L.y<-L.r||L.x>W+L.r||L.y>H+L.r) continue;
      const g=ctx.createRadialGradient(L.x,L.y,10,L.x,L.y,L.r);
      if(L.col){ g.addColorStop(0,`rgba(${L.col},.55)`); g.addColorStop(1,`rgba(${L.col},0)`); }
      else{ g.addColorStop(0,"rgba(255,200,100,.6)");g.addColorStop(1,"rgba(255,200,100,0)"); }
      ctx.fillStyle=g;ctx.beginPath();ctx.arc(L.x,L.y,L.r,0,7);ctx.fill();
    }
    ctx.globalCompositeOperation="source-over";
  }
  if(P().heat&&!night){ ctx.fillStyle="rgba(255,120,0,.08)"; ctx.fillRect(0,0,W,H); }
  if(P().cold){ ctx.fillStyle="rgba(120,180,255,.07)"; ctx.fillRect(0,0,W,H); }

  // efeito planeta: vinheta redonda (curvatura)
  const vg=ctx.createRadialGradient(W/2,H/2,Math.min(W,H)*0.35,W/2,H/2,Math.max(W,H)*0.72);
  vg.addColorStop(0,"rgba(0,0,0,0)");vg.addColorStop(1,"rgba(2,4,16,.5)");
  ctx.fillStyle=vg;ctx.fillRect(0,0,W,H);

  if(hurtFlash>0){ctx.fillStyle=`rgba(255,0,0,${hurtFlash*0.5})`;ctx.fillRect(0,0,W,H);}
  if(player.hunger<=20){ctx.fillStyle=`rgba(255,150,0,${0.08+Math.sin(elapsed*4)*0.04})`;ctx.fillRect(0,0,W,H);}
  if(player.swimming&&player.breath<8){ctx.fillStyle=`rgba(2,132,199,${0.10+Math.sin(elapsed*5)*0.05})`;ctx.fillRect(0,0,W,H);}
  if(P().cold&&!heatNear()){ctx.fillStyle=`rgba(150,200,255,${0.10+Math.sin(elapsed*3)*0.05})`;ctx.fillRect(0,0,W,H);}

  drawMinimap();
}
function nightAlphaUnused(){return 0;}
function drawMinimap(){
  const S=128, Z=4; // zoom: 4px por tile (~32 tiles visíveis, segue o player)
  mctx.clearRect(0,0,S,S);
  mctx.save();
  mctx.beginPath(); mctx.arc(S/2,S/2,S/2-1,0,7); mctx.clip();
  const pcx=player.x/TILE, pcy=player.y/TILE;
  const img=mctx.createImageData(S,S);
  for(let y=0;y<S;y++)for(let x=0;x<S;x++){
    const dx=x-S/2, dy=y-S/2;
    let r=5,g=8,b=20;
    if(dx*dx+dy*dy<=(S/2)*(S/2)){
      const t=tileAt(Math.floor(pcx+dx/Z),Math.floor(pcy+dy/Z));
      if(t===0){r=38;g=100;b=190}else if(t===1){r=222;g=203;b=140}
      else if(t===2){r=74;g=150;b=70}else if(t===3){r=40;g=110;b=50}
      else{r=130;g=130;b=140}
    }
    const i=(y*S+x)*4; img.data[i]=r;img.data[i+1]=g;img.data[i+2]=b;img.data[i+3]=255;
  }
  mctx.putImageData(img,0,0);
  // pontos relativos ao player (mundo redondo: usa a menor distância)
  const dot=(wx,wy)=>[S/2+wdx(wx,player.x,WPX)/TILE*Z, S/2+wdx(wy,player.y,WPY)/TILE*Z];
  const inCircle=(sx,sy)=>{const dx=sx-S/2,dy=sy-S/2;return dx*dx+dy*dy<(S/2-2)*(S/2-2);};
  mctx.fillStyle="#f59e0b";
  for(const b of buildings){ const [sx,sy]=dot(b.tx*TILE+16,b.ty*TILE+16); if(inCircle(sx,sy)) mctx.fillRect(sx,sy,2,2); }
  for(const p of pois){
    const [sx,sy]=dot(p.tx*TILE+16,p.ty*TILE+16);
    if(!inCircle(sx,sy)) continue;
    if(p.kind==="chest"){ mctx.fillStyle="#ffd166"; mctx.fillRect(sx,sy,3,3); }
    else if(p.kind==="crystal"){ mctx.fillStyle="#c084fc"; mctx.fillRect(sx,sy,2,2); }
    else if(p.kind==="obelisk"&&p.cd<=0){ mctx.fillStyle="#7dd3fc"; mctx.fillRect(sx,sy,3,3); }
    else if(p.kind==="cave"){ mctx.fillStyle="#3f3f46"; mctx.fillRect(sx,sy,3,3); }
  }
  mctx.fillStyle="#22d3ee";
  for(const c of critters) if(c.pet||c===player.mounted){ const [sx,sy]=dot(c.x,c.y); if(inCircle(sx,sy)) mctx.fillRect(sx-1,sy-1,4,4); }
  mctx.fillStyle="#7dd3fc";
  for(const s of sealife){ const [sx,sy]=dot(s.x,s.y); if(inCircle(sx,sy)) mctx.fillRect(sx,sy,2,2); }
  mctx.fillStyle="#ff4444";
  for(const e of enemies){ const [sx,sy]=dot(e.x,e.y); if(inCircle(sx,sy)) mctx.fillRect(sx,sy,2,2); }
  if(player.sailing||player.swimming) mctx.fillStyle="#38bdf8";
  else mctx.fillStyle="#fff";
  mctx.fillRect(S/2-2,S/2-2,5,5);
  mctx.restore();
  mctx.strokeStyle="rgba(255,255,255,.8)";mctx.lineWidth=2;
  mctx.beginPath();mctx.arc(S/2,S/2,S/2-1,0,7);mctx.stroke();
}

// ---------- update ----------
let last=0, saveT=0, spawnT=2, seaT=4;
function loop(ts){
  requestAnimationFrame(loop);
  if(!started||gameOver||!player) {last=ts;return;}
  const dt=Math.min(0.05,(ts-last)/1000||0.016); last=ts;
  elapsed+=dt; timeOfDay+=dt/P().dayLen;
  if(timeOfDay>=1){timeOfDay-=1;day++;}
  attackAnim=Math.max(0,attackAnim-dt); hurtFlash=Math.max(0,hurtFlash-dt);
  player.atkCD=Math.max(0,player.atkCD-dt); player.hurtCD=Math.max(0,player.hurtCD-dt);
  const night=isNight(), Pn=P();

  // movimento (mundo redondo: atravessa a borda)
  let dx=0,dy=0;
  if(keys.w||keys.arrowup)dy-=1; if(keys.s||keys.arrowdown)dy+=1;
  if(keys.a||keys.arrowleft){dx-=1;player.facing=-1} if(keys.d||keys.arrowright){dx+=1;player.facing=1}
  if(touchMove.active){dx+=touchMove.x; dy+=touchMove.y;}
  if(dx>0.2)player.facing=1; else if(dx<-0.2)player.facing=-1;
  player.moving=Math.hypot(dx,dy)>0.15;
  if(interior){ interiorUpdate(dt,dx,dy); }
  else if(player.moving){
    const run=((keys.shift||touchRun)&&player.stamina>1);
    const spdBuff=elapsed<(player.buffSpdUntil||0)?1.25:1;
    const mountK=player.mounted?1.7:1;
    const sailK=player.sailing?1.7:1, swimK=player.swimming?0.55:1;
    const climb=onMountain(player.x,player.y)?0.5:1;
    const sp=player.speed*(run?1.6:1)*(Pn.cold?0.95:1)*spdBuff*mountK*sailK*swimK*climb;
    player.animT+=dt*(run?12:8); player.frame=Math.floor(player.animT)%4;
    if(run) player.stamina=Math.max(0,player.stamina-12*dt);
    else if(Pn.cold) player.stamina=Math.max(0,player.stamina-2*dt);
    if(climb<1){
      player.stamina=Math.max(0,player.stamina-4*dt);
      if(!player.stats.climbed){ player.stats.climbed=true; toast("⛰️ Escalando! Devagar e cansa.",2200,true); }
    }
    if(player.mounted){ player.mounted.x=player.x; player.mounted.y=player.y; }
    const len=Math.hypot(dx,dy); if(len>1){dx/=len;dy/=len;}
    const nx=wrap(player.x+dx*sp*dt,WPX), ny=wrap(player.y+dy*sp*dt,WPY);
    if(!playerCollidesAt(nx,player.y,player.r)) player.x=nx;
    else if(!player.sailing&&!player.swimming&&waterBlocksAt(nx,player.y,player.r)){
      autoSwim();
      if(!playerCollidesAt(nx,player.y,player.r)) player.x=nx;
    }
    if(!playerCollidesAt(player.x,ny,player.r)) player.y=ny;
    else if(!player.sailing&&!player.swimming&&waterBlocksAt(player.x,ny,player.r)){
      autoSwim();
      if(!playerCollidesAt(player.x,ny,player.r)) player.y=ny;
    }
    if(player.swimming&&!player.sailing){
      const cx=Math.floor(player.x/TILE), cy=Math.floor(player.y/TILE);
      if(!waterAt(cx,cy)||deckAt(cx,cy)) player.swimming=false; // saiu andando: para de nadar
    }
    if(player.fishing) player.fishing=null; // mexeu: recolhe a vara
    if(player.mounted){ player.mounted.x=player.x; player.mounted.y=player.y; }
  } else {
    player.stamina=clamp(player.stamina+(Pn.cold?6:14)*dt,0,100);
    player.frame=0;
  }
  const rect=canvas.getBoundingClientRect();
  mouse.wx=cam.x+mouse.x*(canvas.width/rect.width/ZOOM);
  mouse.wy=cam.y+mouse.y*(canvas.height/rect.height/ZOOM);

  // fome / clima
  let drain=0.5*Pn.hungerMul;
  if(Pn.heat&&!night) drain*=2;
  player.hunger=clamp(player.hunger-dt*drain,0,100);
  if(player.hunger<=0){ player.hp-=3*dt; if(player.hp<=0){player.hp=0;die();} }
  if(Pn.cold&&!heatNear()){
    player.hp-=1.6*dt;
    if(player.hp<=0){player.hp=0;die();}
    else if(elapsed-coldWarned>6){ coldWarned=elapsed; addFloater(player.x,player.y-22,"❄️ frio! ache fogo","#bae6fd"); }
  }
  // mar: fôlego, vara, tarrafa, vida marinha
  if(player.swimming&&!player.sailing){
    player.breath-=dt;
    if(Pn.cold){
      player.hp-=1.2*dt;
      if(player.hp<=0){player.hp=0;die();}
    }
    if(player.breath<=0){
      player.breath=0; player.hp-=6*dt;
      if(Math.floor(elapsed*3)%3===0) addFloater(player.x,player.y-24,"😮‍💨","#7dd3fc");
      if(player.hp<=0){player.hp=0;die();}
    }
    if(Math.random()<dt*4) particles.push({x:player.x+rand(-8,8),y:player.y-6,vx:rand(-8,8),vy:rand(-50,-25),life:rand(.5,1),t:0,color:"#bae6fd",size:2});
  } else {
    player.breath=clamp(player.breath+8*dt,0,player.breathMax);
  }
  if(player.fishing){
    const F=player.fishing;
    F.t+=dt;
    if(F.phase==="wait"&&F.t>=F.wait){
      F.phase="bite"; F.t=0;
      beep(880,0.15,"sine",0.06);
      burst(F.x,F.y,"#fde047",8);
      toast("🐟 Fisgou! Aperte E!",1800);
    } else if(F.phase==="bite"&&F.t>4){
      player.fishing=null;
      addFloater(player.x,player.y-20,"escapou…","#94a3b8");
    }
  }
  if(player.netCD>0) player.netCD-=dt;
  if(player.netAnim){ player.netAnim.t+=dt; if(player.netAnim.t>0.45) player.netAnim=null; }
  seaT-=dt;
  if(seaT<=0){
    seaT=3;
    if(nearestWaterSpot(700)&&sealife.length<14){
      const nF=sealife.filter(s=>s.kind==="fish").length;
      const nQ=sealife.filter(s=>s.kind==="squid").length;
      if(nF<6) spawnSealife("fish");
      else if(nQ<2) spawnSealife("squid");
      else{
        const r=Math.random();
        const inWater=player.swimming||player.sailing;
        if(!sealife.some(s=>s.kind==="shark")&&(inWater?r<0.55:r<0.2)) spawnSealife("shark");
        else if(!sealife.some(s=>s.kind==="octopus")&&r>=0.55&&r<0.66) spawnSealife("octopus");
        else if(!sealife.some(s=>s.kind==="whale")&&r>=0.66&&r<0.72) spawnSealife("whale");
        else spawnSealife();
      }
    }
  }
  for(const s of [...sealife]) sealifeUpdate(s,dt);
  if(sealife.length>40) sealife.splice(0,sealife.length-40);
  if(player.torchLit){
    player.torchFuel-=dt;
    if(player.torchFuel<=0){
      player.torchFuel=0;
      if((player.inv.torch||0)>0){ player.inv.torch--; player.torchFuel=75; }
      else player.torchLit=false;
      updateHUD();
    }
  }
  const sh=nearestShelter();
  player.sheltered=!!sh;
  if(sh) player.hp=clamp(player.hp+(sh.kind==="cabin"?6:4)*dt,0,player.maxHp);
  for(const b of buildings){
    if(b.kind!=="campfire") continue;
    if(wdist(player.x,player.y,b.tx*TILE+16,b.ty*TILE+16)<70){
      player.hp=clamp(player.hp+3*dt,0,player.maxHp);
      b.cookT+=dt;
      if(b.cookT>6 && player.inv.raw>0){b.cookT=0;player.inv.raw--;player.inv.cooked++;sfx.eat();updateHUD();}
    }
  }

  // POIs: cooldowns
  for(const p of pois) if(p.cd>0) p.cd-=dt;
  // bichinhos: IA simples (vagam, fogem do player; 🐶 segue e protege; 🐔 bota ovos)
  if(critters.length<10 && Math.random()<dt*0.8) spawnCritter(false);
  for(const c of critters){
    c.frame+=dt;
    if(c===player.mounted) continue;
    // galinhas botam ovos
    if((c.kind==="chicken"||c.kind==="chick")&&!c.pet){
      c.layT=(c.layT??25)-dt;
      if(c.layT<=0){ c.layT=rand(25,45); if(drops.length<40) drops.push({x:c.x+rand(-8,8),y:c.y+rand(-8,8),item:"egg",qtd:1}); }
    }
    // cachorro companheiro: segue e morde inimigos
    if(c.pet){
      const dp=wdist(c.x,c.y,player.x,player.y);
      if(interior){ /* espera na porta */ }
      else if(dp>700){ c.x=wrap(player.x+rand(-40,40),WPX); c.y=wrap(player.y+rand(-40,40),WPY); }
      else if(dp>64){
        const a=angTo(c.x,c.y,player.x,player.y);
        c.x=wrap(c.x+Math.cos(a)*170*dt,WPX); c.y=wrap(c.y+Math.sin(a)*170*dt,WPY);
      }
      c.atkCD=(c.atkCD||0)-dt;
      if(c.atkCD<=0&&!interior){
        let tgt=null,td=80;
        for(const e of enemies){ const d=wdist(c.x,c.y,e.x,e.y); if(d<td){td=d;tgt=e;} }
        if(tgt){
          c.atkCD=1.0;
          const dmg=5+player.level*2;
          tgt.hp-=dmg; tgt.flash=0.12;
          burst(tgt.x,tgt.y,"#fbbf24",4);
          addFloater(tgt.x,tgt.y-14,dmg,"#fde047");
          if(tgt.hp<=0){
            enemies.splice(enemies.indexOf(tgt),1); kills++; player.stats.kills++;
            gainXp(Math.round(ETYPES[tgt.kind].xp/2)); burst(tgt.x,tgt.y,ETYPES[tgt.kind].color,10);
            addFloater(c.x,c.y-18,"🐶 Au!","#fde047");
            checkQuests();
          }
        }
      }
      continue;
    }
    const dp=wdist(c.x,c.y,player.x,player.y);
    c.wt-=dt;
    if(dp<90){
      const a=angTo(player.x,player.y,c.x,c.y);
      const sp=c.kind==="bird"||c.kind==="owl"?120:c.kind==="rabbit"||c.kind==="squirrel"?140:c.kind==="horse"?150:c.kind==="pig"?55:c.kind==="chicken"?75:c.kind==="chick"?65:c.kind==="dog"?100:60;
      c.x=wrap(c.x+Math.cos(a)*sp*dt,WPX); c.y=wrap(c.y+Math.sin(a)*sp*dt,WPY);
    }else{
      if(c.wt<=0){ c.wt=rand(1,3); c.wx=wrap(c.x+rand(-100,100),WPX); c.wy=wrap(c.y+rand(-100,100),WPY); }
      const a=angTo(c.x,c.y,c.wx,c.wy);
      if(wdist(c.x,c.y,c.wx,c.wy)>12){
        const sp=c.kind==="bird"?90:c.kind==="butterfly"?35:c.kind==="horse"?40:50;
        c.x=wrap(c.x+Math.cos(a)*sp*dt,WPX); c.y=wrap(c.y+Math.sin(a)*sp*dt,WPY);
      }
    }
  }
  if(critters.length>28) critters.splice(0,critters.length-28);
  // clima ambiente: partículas que caem (folha/neve/areia/esporo)
  if(Math.random()<dt*22 && ambientP.length<70){
    const id=Pn.id;
    ambientP.push({x:wrap(cam.x+Math.random()*(canvas.width/ZOOM),WPX),y:wrap(cam.y-20,WPY),vx:rand(-15,15),vy:id==="gelo"?rand(25,60):id==="areia"?rand(40,90):rand(15,45),t:0,life:rand(2,4),id});
  }
  for(let i=ambientP.length-1;i>=0;i--){const a=ambientP[i];a.t+=dt;if(a.t>=a.life){ambientP.splice(i,1);continue;}a.x=wrap(a.x+(a.vx+Math.sin(elapsed*2+a.y*0.05)*12)*dt,WPX);a.y=wrap(a.y+a.vy*dt,WPY);}

  // spawns (noite sempre mais perigosa)
  spawnT-=dt;
  const want = Pn.eternalNight ? Math.min(5+day,12) : night ? Math.min(4+day,11) : Math.min(1+Math.floor(day/2),4);
  if(spawnT<=0){ spawnT=night||Pn.eternalNight?2.5:9; if(enemies.length<want) spawnEnemy(); }
  if((day%3===0||Pn.eternalNight)&&(night||Pn.eternalNight)&&!enemies.some(e=>e.kind==="orc")&&Math.random()<dt*0.08) spawnEnemy("orc");
  for(const e of [...enemies]) enemyUpdate(e,dt);

  for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.t+=dt;if(p.t>=p.life){particles.splice(i,1);continue;}p.x=wrap(p.x+p.vx*dt,WPX);p.y=wrap(p.y+p.vy*dt,WPY);p.vx*=0.95;p.vy*=0.95;}
  for(let i=floaters.length-1;i>=0;i--){const f=floaters[i];f.t+=dt;f.y-=22*dt;if(f.t>=f.life)floaters.splice(i,1);}

  updateContextTip();
  const orc=enemies.find(e=>e.kind==="orc"), bb=$("boss-bar");
  if(orc){ bb.classList.remove("hidden"); $("boss-fill").style.width=(orc.hp/orc.maxHp*100)+"%"; }
  else bb.classList.add("hidden");

  saveT+=dt; if(saveT>20){saveT=0;save(true);}
  if(Math.floor(elapsed*2)%20===0){ updateHUD(); updateQuestHUD(); }
  render();
}

// ---------- input ----------
window.addEventListener("keydown",(e)=>{
  const k=e.key.toLowerCase();
  keys[k]=true;
  if(["tab"," "].includes(k)) e.preventDefault();
  if(!started){ if(k==="enter") startGame(false); return; }
  if(k==="e"){ if(!$("panel-travel").classList.contains("hidden")) toggle("panel-travel",false); else doAction(); }
  if(k==="q") eatBest();
  if(k===" ") doAttack();
  if(k==="t") toggleTorch();
  if(k==="r") throwNet();
  if(k==="1") equipHand("none");
  if(k==="2") equipHand("axe");
  if(k==="3") equipHand("sword");
  if(k==="c") toggle("panel-craft");
  if(k==="b") toggle("panel-build");
  if(k==="h"||k==="escape") toggle("panel-help");
});
window.addEventListener("keyup",(e)=>{keys[e.key.toLowerCase()]=false;});
canvas.addEventListener("mousemove",(e)=>{const r=canvas.getBoundingClientRect();mouse.x=e.clientX-r.left;mouse.y=e.clientY-r.top;});
canvas.addEventListener("mousedown",(e)=>{
  if(e.button===2){buildMode=null;renderBuilds();return;}
  if(buildMode){
    const tx=wrap(Math.floor(wrap(mouse.wx,WPX)/TILE),WORLD_W), ty=wrap(Math.floor(wrap(mouse.wy,WPY)/TILE),WORLD_H);
    placeBuilding(buildMode,tx,ty,false);
    return;
  }
  doAttack();
});
canvas.addEventListener("contextmenu",(e)=>e.preventDefault());

function touchAngle(){
  if(touchMove.active && Math.hypot(touchMove.x,touchMove.y)>0.2)
    return Math.atan2(touchMove.y,touchMove.x);
  return player&&player.facing>0?0:Math.PI;
}
function attackFromPlayer(angle){
  // converte ângulo de tela p/ mundo (mesma coisa aqui: sem rotação de câmera)
  doAttack(angle);
}
function bindHold(id, down, up){
  const el=$(id); if(!el) return;
  const on=(e)=>{e.preventDefault(); down();};
  const off=(e)=>{e.preventDefault(); if(up)up();};
  el.addEventListener("touchstart",on,{passive:false});
  el.addEventListener("touchend",off,{passive:false});
  el.addEventListener("touchcancel",off,{passive:false});
  el.addEventListener("mousedown",on); el.addEventListener("mouseup",off);
}
bindHold("t-atk", ()=>attackFromPlayer(touchAngle()));
bindHold("t-act", ()=>doAction());
bindHold("t-eat", ()=>eatBest());
bindHold("t-torch", ()=>toggleTorch());
bindHold("t-net", ()=>throwNet());
(function initJoystick(){
  const base=$("joystick"), knob=$("stick");
  if(!base||!knob) return;
  let tid=null;
  function setKnob(dx,dy){ knob.style.transform=`translate(calc(-50% + ${dx*34}px), calc(-50% + ${dy*34}px))`; }
  function handle(t){
    const r=base.getBoundingClientRect();
    let dx=(t.clientX-(r.left+r.width/2))/(r.width/2);
    let dy=(t.clientY-(r.top+r.height/2))/(r.height/2);
    const l=Math.hypot(dx,dy); if(l>1){dx/=l;dy/=l;}
    touchMove.x=dx; touchMove.y=dy; touchMove.active=true;
    setKnob(dx,dy);
  }
  base.addEventListener("touchstart",(e)=>{e.preventDefault(); const t=e.changedTouches[0]; tid=t.identifier; handle(t);},{passive:false});
  base.addEventListener("touchmove",(e)=>{e.preventDefault(); for(const t of e.changedTouches) if(t.identifier===tid) handle(t);},{passive:false});
  const end=(e)=>{ for(const t of e.changedTouches) if(t.identifier===tid){tid=null; touchMove.x=0;touchMove.y=0;touchMove.active=false; setKnob(0,0);} };
  base.addEventListener("touchend",end); base.addEventListener("touchcancel",end);
})();
canvas.addEventListener("touchstart",(e)=>{
  e.preventDefault();
  if(!started||gameOver) return;
  const r=canvas.getBoundingClientRect();
  const t=e.changedTouches[0];
  mouse.wx=cam.x+(t.clientX-r.left)*(canvas.width/r.width/ZOOM);
  mouse.wy=cam.y+(t.clientY-r.top)*(canvas.height/r.height/ZOOM);
  if(buildMode){
    const tx=wrap(Math.floor(wrap(mouse.wx,WPX)/TILE),WORLD_W), ty=wrap(Math.floor(wrap(mouse.wy,WPY)/TILE),WORLD_H);
    placeBuilding(buildMode,tx,ty,false);
    return;
  }
  // toque esperto: se há algo para agir perto (foguete/baú/cristal/drop/recurso), age; senão ataca
  if(nearestRocket()||nearestPOI(58)||nearestResource(54)||drops.some(d=>wdist(player.x,player.y,d.x,d.y)<44)){ doAction(); return; }
  attackFromPlayer(touchAngle());
},{passive:false});
// dica de contexto tocável = age (equivale ao E no celular)
$("context-tip").addEventListener("click",()=>doAction());
// minimapa tocável: abre o mapa grande (evita toque atravessar e atacar)
function drawBigmap(){
  const bc=$("bigmap"); if(!bc) return;
  const bctx=bc.getContext("2d");
  bctx.imageSmoothingEnabled=false;
  const S=bc.width, sc=S/WORLD_W;
  for(let y=0;y<WORLD_H;y++)for(let x=0;x<WORLD_W;x++){
    const t=tileAt(x,y);
    if(t===0)bctx.fillStyle="#265aae";
    else if(t===1)bctx.fillStyle="#decb8c";
    else if(t===2)bctx.fillStyle="#4a9646";
    else if(t===3)bctx.fillStyle="#286e32";
    else bctx.fillStyle="#82828c";
    bctx.fillRect(x*sc,y*sc,sc+0.5,sc+0.5);
  }
  for(const b of buildings){ bctx.fillStyle="#f59e0b"; bctx.fillRect(b.tx*sc-1,b.ty*sc-1,3,3); }
  for(const p of pois){
    if(p.kind==="chest"){ bctx.fillStyle="#ffd166"; bctx.fillRect(p.tx*sc-1,p.ty*sc-1,4,4); }
    else if(p.kind==="crystal"){ bctx.fillStyle="#c084fc"; bctx.fillRect(p.tx*sc-1,p.ty*sc-1,3,3); }
    else if(p.kind==="obelisk"&&p.cd<=0){ bctx.fillStyle="#7dd3fc"; bctx.fillRect(p.tx*sc-1,p.ty*sc-1,4,4); }
    else if(p.kind==="cave"){ bctx.fillStyle="#3f3f46"; bctx.fillRect(p.tx*sc-1,p.ty*sc-1,5,5); }
  }
  bctx.fillStyle="#ff4444";
  for(const e of enemies) bctx.fillRect(Math.floor(wrap(e.x,WPX)/TILE)*sc-1,Math.floor(wrap(e.y,WPY)/TILE)*sc-1,3,3);
  const ptx=Math.floor(wrap(player.x,WPX)/TILE)*sc, pty=Math.floor(wrap(player.y,WPY)/TILE)*sc;
  bctx.fillStyle="#fff"; bctx.fillRect(ptx-3,pty-3,7,7);
  bctx.strokeStyle="#fff"; bctx.lineWidth=2;
  bctx.beginPath(); bctx.arc(ptx,pty,8,0,7); bctx.stroke();
}
$("minimap").addEventListener("click",(e)=>{ e.stopPropagation(); drawBigmap(); $("bigmap-wrap").classList.remove("hidden"); });
$("bigmap-wrap").addEventListener("click",()=>{ $("bigmap-wrap").classList.add("hidden"); });

function toggle(id,force){
  const el=$(id);
  if(force===true){ el.classList.remove("hidden"); }
  else if(force===false){ el.classList.add("hidden"); }
  else el.classList.toggle("hidden");
  if(id==="panel-build")renderBuilds();
  if(id==="panel-craft")renderRecipes();
  if(id==="panel-travel"&&!el.classList.contains("hidden"))renderTravel();
}
document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>$(b.dataset.close).classList.add("hidden"));
$("slot-eat").onclick=()=>eatBest();
$("slot-torch").onclick=()=>toggleTorch();
$("slot-hand").onclick=()=>cycleHand();
$("btn-act").onclick=()=>doAction();
$("btn-atk").onclick=()=>doAttack();
$("btn-craft").onclick=()=>toggle("panel-craft");
$("btn-build").onclick=()=>toggle("panel-build");
$("btn-sound").onclick=(e)=>{audioOn=!audioOn;e.target.textContent=audioOn?"🔊":"🔇";};
$("link-help").onclick=(e)=>{e.preventDefault();toggle("panel-help");};
$("link-help2").onclick=(e)=>{e.preventDefault();toggle("panel-help");};

function startGame(useSave){
  if(useSave&&load()){}
  else{
    planetIdx=0; seeds={}; storeBuildings={}; storePOIs={}; day=1; timeOfDay=0.3; elapsed=0; kills=0;
    const sd=irand(1,999999); seeds.verde=sd;
    genWorld(sd,P()); genResources(P());
    const s=findSpawn(); player=newPlayer(s.x,s.y);
    buildings=[];
    genPOIs(P());
  }
  started=true; gameOver=false;
  $("screen-start").classList.add("hidden");$("screen-over").classList.add("hidden");
  fitCanvas();
  updateHUD(); updateQuestHUD();
  requestAnimationFrame((t)=>{last=t;});
}
$("btn-start").onclick=()=>startGame(false);
$("btn-continue").onclick=()=>startGame(true);
$("btn-restart").onclick=()=>{
  try{localStorage.removeItem(SAVE_KEY);}catch(e){}
  planetIdx=0; seeds={}; storeBuildings={}; storePOIs={}; day=1; timeOfDay=0.3; elapsed=0; kills=0;
  const sd=irand(1,999999); seeds.verde=sd;
  genWorld(sd,P()); genResources(P());
  const s=findSpawn(); player=newPlayer(s.x,s.y);
  buildings=[]; interior=null; genPOIs(P()); started=true; gameOver=false;
  $("screen-over").classList.add("hidden");
  updateHUD(); updateQuestHUD();
};
try{ if(localStorage.getItem(SAVE_KEY)) $("btn-continue").classList.remove("hidden"); }catch(e){}

function isMobileLayout(){
  return window.matchMedia("(pointer:coarse)").matches || window.innerWidth<700;
}
function fitCanvas(){
  const wrapEl=$("game-wrap");
  if(!wrapEl) return;
  if(isMobileLayout()){
    const w=Math.max(320, Math.floor(wrapEl.clientWidth));
    const h=Math.max(320, Math.floor(wrapEl.clientHeight));
    if(canvas.width!==w||canvas.height!==h){ canvas.width=w; canvas.height=h; }
  }else{
    if(canvas.width!==960||canvas.height!==600){ canvas.width=960; canvas.height=600; }
  }
}
window.addEventListener("resize", fitCanvas);
window.addEventListener("orientationchange", ()=>setTimeout(fitCanvas,200));
fitCanvas();

// boot: planeta verde de fundo
(function boot(){
  const sd=irand(1,999999); seeds.verde=sd;
  genWorld(sd,PLANETS[0]); genResources(PLANETS[0]);
  const s=findSpawn(); player=newPlayer(s.x,s.y);
  buildings=[]; genPOIs(PLANETS[0]);
  updateHUD(); updateQuestHUD();
  requestAnimationFrame(loop);
  setInterval(()=>{if(started&&!gameOver)updateHUD();},1500);
})();
})();
