/* COLONO ESPACIAL — Missão Sistema Solar
   Jogo educativo: acorde na nave-mãe Esperança, explore os planetas,
   aprenda ciências de verdade e prepare colônias. Vanilla JS + Canvas.
*/
const $ = (id) => document.getElementById(id);
const canvas = $("game"), ctx = canvas.getContext("2d");
const mini = $("minimap"), mctx = mini.getContext("2d");
const TILE = 32, WORLD_W = 96, WORLD_H = 96;
const IS_TOUCH = (window.matchMedia && window.matchMedia("(pointer:coarse)").matches) || ("ontouchstart" in window);
const SAVE_KEY = "colono-espacial-v1";
const WPX = WORLD_W * TILE, WPY = WORLD_H * TILE;
let ZOOM = 1.5;
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
const rand = (a,b)=>a+Math.random()*(b-a);
const irand = (a,b)=>Math.floor(rand(a,b+1));
const wrap = (v,m)=>((v%m)+m)%m;
function wdx(a,b,m){ let d=(a-b)%m; if(d>m/2)d-=m; if(d<-m/2)d+=m; return d; }
const wdist = (ax,ay,bx,by)=>Math.hypot(wdx(ax,bx,WPX),wdx(ay,by,WPY));
const angTo = (ax,ay,bx,by)=>Math.atan2(wdx(by,ay,WPY),wdx(bx,ax,WPX));

let lastToastAt = 0;
function toast(msg, ms=2400, force){
  const now = performance.now();
  if(!force && now - lastToastAt < 900) return;
  lastToastAt = now;
  const w = $("toast-wrap");
  while(w.children.length > 1) w.firstChild.remove();
  const d = document.createElement("div");
  d.className = "toast"; d.textContent = msg;
  w.appendChild(d);
  setTimeout(()=>d.remove(), ms);
}
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
  pickup(){beep(660,0.06,"square"); setTimeout(()=>beep(880,0.06,"square"),60)},
  craft(){beep(520,0.08,"triangle"); setTimeout(()=>beep(780,0.1,"triangle"),90)},
  eat(){beep(300,0.09,"triangle")},
  build(){beep(240,0.12,"square")},
  level(){[523,659,784,1046].forEach((f,i)=>setTimeout(()=>beep(f,0.12,"square"),i*100))},
  win(){[523,659,784,1046,1318].forEach((f,i)=>setTimeout(()=>beep(f,0.15,"triangle"),i*130))},
};

// ---------- dados reais (fatos de verdade, linguagem de criança) ----------
const BODIES = [
 {id:"mercurio", name:"Mercúrio", icon:"⚪", order:1, site:null,
  dist:"58 milhões de km do Sol", temp:"+430°C de dia, -180°C à noite", grav:"38% da Terra",
  day:"176 dias terrestres", year:"88 dias", moons:"nenhuma", air:"quase nada",
  made:[["Ferro",40,"#9ca3af"],["Rocha",60,"#78716c"]],
  fact:"Cheio de crateras e com um núcleo de ferro gigante!",
  sample:"pedras cinzentas", hazard:{heat:2,cold:2,wind:0},
  pal:{t0:[90,90,110],t1:[190,180,160],t2:[150,140,125],t3:[120,110,100],t4:[80,75,85]},
  quiz:{q:"Por que Mercúrio é um forno de dia e um freezer à noite?",
    opts:["Não tem ar para segurar o calor","Fica longe do Sol","Tem vulcões ativos"], ok:0,
    why:"Sem atmosfera, o calor do dia escapa todinho à noite!"},
  com:"Mercúrio não tem ar: traje sempre fechado, cadete!"},
 {id:"venus", name:"Vênus", icon:"🟠", order:2, site:null,
  dist:"108 milhões de km do Sol", temp:"465°C o tempo todo!", grav:"90% da Terra",
  day:"243 dias (de costas!)", year:"225 dias", moons:"nenhuma", air:"CO₂ + nuvens de ácido",
  made:[["Gás carbônico",96,"#fbbf24"],["Ácido",4,"#84cc16"]],
  fact:"O dia lá dura mais que o ano — e ele gira ao contrário!",
  sample:"rochas alaranjadas", hazard:{heat:3,cold:0,wind:0},
  pal:{t0:[200,120,40],t1:[230,170,90],t2:[210,140,60],t3:[170,110,50],t4:[120,80,40]},
  quiz:{q:"Por que Vênus é o planeta mais quente?",
    opts:["Ar de CO₂ que prende o calor","Fica colado no Sol","É cheio de lava"], ok:0,
    why:"Efeito estufa descontrolado: o calor entra e não sai mais!"},
  com:"465 graus, cadete! Fique na sombra da base e volte rápido."},
 {id:"marte", name:"Marte", icon:"🔴", order:3, site:null,
  dist:"228 milhões de km do Sol", temp:"-60°C em média", grav:"38% da Terra",
  day:"24h37 (quase igual ao nosso!)", year:"687 dias", moons:"2 (Fobos e Deimos)", air:"CO₂ fininho",
  made:[["Ferro enferrujado",45,"#b45309"],["Rocha",45,"#92400e"],["Gelo",10,"#bae6fd"]],
  fact:"É vermelho de ferrugem! O Monte Olimpo é 3x o Everest.",
  sample:"areia vermelha", hazard:{heat:0,cold:1,wind:1,storm:true},
  pal:{t0:[150,80,50],t1:[220,150,100],t2:[200,110,70],t3:[160,90,55],t4:[110,65,45]},
  quiz:{q:"Por que Marte é vermelho?",
    opts:["Ferrugem (tem muito ferro)","Poeira de tijolo","Pôr do sol eterno"], ok:0,
    why:"O ferro da superfície enferrujou, igual portão velho!"},
  com:"Tempestades de poeira à vista. Se o céu escurecer, volte à base!"},
 {id:"jupiter", name:"Júpiter", icon:"🟤", order:4, site:"Europa, lua de gelo",
  dist:"778 milhões de km do Sol", temp:"-110°C", grav:"235% da Terra!",
  day:"só 10 horas", year:"12 anos", moons:"mais de 90!", air:"Hidrogênio e hélio",
  made:[["Hidrogênio",71,"#fde68a"],["Hélio",24,"#fcd34d"],["Outros",5,"#d97706"]],
  fact:"Cabem 1300 Terras dentro dele! A Mancha Vermelha é uma tempestade maior que a Terra.",
  sample:"gelo brilhante", hazard:{heat:0,cold:1,wind:2},
  pal:{t0:[120,150,200],t1:[200,220,240],t2:[170,200,230],t3:[140,170,210],t4:[100,130,170]},
  quiz:{q:"O que é a Grande Mancha Vermelha de Júpiter?",
    opts:["Uma tempestade gigante","Um vulcão","Um oceano"], ok:0,
    why:"Uma tempestade maior que a Terra, rolando há 300 anos!"},
  com:"Descemos em Europa: oceano escondido sob o gelo. Cuidado com o vento!"},
 {id:"saturno", name:"Saturno", icon:"🪐", order:5, site:"Titã, lua de lagos",
  dist:"1,4 bilhão de km do Sol", temp:"-140°C", grav:"parecida com a Terra",
  day:"10h40", year:"29 anos", moons:"mais de 140!", air:"Hidrogênio e hélio",
  made:[["Hidrogênio",75,"#fef3c7"],["Hélio",25,"#fde68a"]],
  fact:"Flutuaria na água! Os anéis são de gelo e pedra. Titã tem lagos de verdade.",
  sample:"gelo dos anéis", hazard:{heat:0,cold:1,wind:1},
  pal:{t0:[150,160,200],t1:[220,210,180],t2:[200,185,150],t3:[170,150,120],t4:[120,110,100]},
  quiz:{q:"Do que são feitos os anéis de Saturno?",
    opts:["Gelo e pedra","Ouro","Nuvens"], ok:0,
    why:"Bilhões de pedacinhos de gelo e pedra brilhando!"},
  com:"Titã tem lagos (não beba: é metano!). O frio aperta longe da base."},
 {id:"urano", name:"Urano", icon:"🩵", order:6, site:"Ariel, lua de gelo",
  dist:"2,9 bilhões de km do Sol", temp:"-200°C (o mais frio!)", grav:"89% da Terra",
  day:"17h (tombado de lado!)", year:"84 anos", moons:"27", air:"Hidrogênio + metano azul",
  made:[["Hidrogênio",60,"#a5f3fc"],["Metano",25,"#67e8f9"],["Gelo",15,"#bae6fd"]],
  fact:"Gira deitado, como uma bola rolando! O azul é gás metano.",
  sample:"cristais azuis", hazard:{heat:0,cold:2,wind:0},
  pal:{t0:[100,160,190],t1:[170,220,230],t2:[140,200,215],t3:[110,170,190],t4:[80,130,150]},
  quiz:{q:"O que Urano tem de esquisito?",
    opts:["Gira deitado de lado","Tem 100 luas","É quadrado"], ok:0,
    why:"Alguma coisa gigante bateu nele e o deixou tombado!"},
  com:"-200 graus! Fique grudado no calor da base, cadete."},
 {id:"netuno", name:"Netuno", icon:"🔷", order:7, site:"Tritão, lua gelada",
  dist:"4,5 bilhões de km do Sol", temp:"-200°C", grav:"114% da Terra",
  day:"16h", year:"165 anos", moons:"14", air:"Hidrogênio + metano",
  made:[["Hidrogênio",65,"#93c5fd"],["Metano",25,"#60a5fa"],["Gelo",10,"#dbeafe"]],
  fact:"Ventos de 2100 km/h, os mais rápidos! Foi descoberto pela matemática.",
  sample:"gelo azul-escuro", hazard:{heat:0,cold:1,wind:2},
  pal:{t0:[40,70,160],t1:[90,130,200],t2:[60,100,170],t3:[45,80,140],t4:[30,55,100]},
  quiz:{q:"Como Netuno foi descoberto?",
    opts:["Pela matemática, antes do telescópio","Por acaso total","Num sonho"], ok:0,
    why:"Os cálculos mostravam um planeta puxando Urano. Apontaram e lá estava!"},
  com:"Segure o capacete: vento de 2000 km/h! Tritão tem gêiseres de gelo."},
 {id:"plutao", name:"Plutão", icon:"❄️", order:8, site:null, secret:true,
  dist:"5,9 bilhões de km do Sol", temp:"-230°C", grav:"6% da Terra",
  day:"6 dias", year:"248 anos", moons:"5", air:"quase nada",
  made:[["Gelo de nitrogênio",70,"#f1f5f9"],["Rocha",30,"#a8a29e"]],
  fact:"Tem um coração gigante de gelo! Foi planeta até 2006.",
  sample:"gelo-coração", hazard:{heat:0,cold:2,wind:0},
  pal:{t0:[140,150,180],t1:[210,205,195],t2:[185,175,165],t3:[150,140,135],t4:[100,95,105]},
  quiz:{q:"Por que Plutão deixou de ser planeta?",
    opts:["É pequeno demais p/ limpar a órbita","Explodiu","Sumiu"], ok:0,
    why:"Virou planeta-anão em 2006 — mas continua incrível!"},
  com:"O bônus secreto! Um coração de gelo espera por você."},
];
const TERRA = {id:"terra", name:"Terra 💙", icon:"💙",
  fact:"Nosso lar! O único planeta com vida, água líquida e ar para respirar. 71% da superfície é água. Cuidem bem dela!"};

// ---------- estado ----------
let mode="title"; // title | ship | surface | win
let bodyId=null;
let tiles = new Uint8Array(WORLD_W*WORLD_H);
let player=null, resources=[], buildings=[], particles=[], floaters=[], drops=[], fauna=[];
let faunaDefs=[];
let day=1, timeOfDay=0.3, elapsed=0;
let gameOver=false, started=false;
let keys={}, mouse={x:0,y:0,wx:0,wy:0};
let touchMove={x:0,y:0,active:false}, touchRun=false;
let cam={x:0,y:0};
let buildMode=null;
let attackAnim=0, hurtFlash=0;
let stormT=0, stormOn=0, gustT=5;
let state=null;
const P = ()=>BODIES.find(b=>b.id===bodyId) || BODIES[0];

function blankBodyState(){
  return {samples:0, scanned:[], built:{}, quiz:false, done:false, commsSeen:{}};
}
function newState(){
  return {
    unlocked:["mercurio"],
    bodies:{}, player:{level:1,xp:0},
    inv:{metal:0,ice:0,food:1,tanks:1},
    comms:[], supplyAt:-999, victory:false,
  };
}
function bs(){
  if(!state.bodies[bodyId]) state.bodies[bodyId]=blankBodyState();
  return state.bodies[bodyId];
}
function save(silent){
  if(!started) return;
  try{
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      unlocked:state.unlocked, bodies:state.bodies,
      player:state.player, inv:state.inv,
      comms:state.comms.slice(-30), victory:state.victory,
      supplyAt:state.supplyAt, mode, bodyId,
      px:player?player.x:0, py:player?player.y:0,
    }));
    if(!silent) toast("💾",1500);
  }catch(e){}
}
function load(){
  try{
    const s=JSON.parse(localStorage.getItem(SAVE_KEY));
    if(!s||!s.unlocked) return false;
    state=newState();
    state.unlocked=s.unlocked; state.bodies=s.bodies||{};
    state.player=s.player||{level:1,xp:0};
    state.inv=Object.assign({metal:0,ice:0,food:1,tanks:1},s.inv);
    state.comms=s.comms||[]; state.victory=!!s.victory;
    state.supplyAt=(s.supplyAt==null?-999:s.supplyAt);
    return {mode:s.mode||"ship", bodyId:s.bodyId||null, px:s.px||0, py:s.py||0};
  }catch(e){ return false; }
}

// ---------- missões ----------
function missionsFor(b){
  const st=state.bodies[b.id]||blankBodyState();
  const need=b.id==="plutao"?2:3;
  return [
    {t:`Colete ${need} amostras de ${b.sample} 🧪`, p:()=>clamp(st.samples/need,0,1), d:()=>st.samples>=need},
    {t:"Construa um Abrigo 🛖 (B)", p:()=>st.built.habitat?1:0, d:()=>!!st.built.habitat},
    {t:"Construa uma Estufa 🌱 (B)", p:()=>st.built.estufa?1:0, d:()=>!!st.built.estufa},
    {t:"Escaneie 2 bichinhos 👽 (E perto)", p:()=>clamp(st.scanned.length/2,0,1), d:()=>st.scanned.length>=2},
    {t:"Construa um Painel Solar 🔆 (B)", p:()=>st.built.painel?1:0, d:()=>!!st.built.painel},
    {t:"Responda o quiz da ARIA 🛰️ (console da nave)", p:()=>st.quiz?1:0, d:()=>!!st.quiz},
    {t:"Construa a Antena 📡 e chame os colonos (E)", p:()=>st.done?1:(st.built.antena?0.7:0), d:()=>!!st.done},
  ];
}
function curMission(){
  const ms=missionsFor(P());
  return ms.find(m=>!m.d())||null;
}
function gainXp(n){
  const before=state.player.level;
  state.player.xp+=n;
  let acc=0, l=1, nn=60;
  while(state.player.xp>=acc+nn){ acc+=nn; l++; nn=Math.round(nn*1.28+10); }
  state.player.level=l;
  if(l>before){ sfx.level(); toast("⬆️ Nível "+l+"! Vida cheia!",2200,true); if(player){player.hp=player.maxHp;} }
  updateHUD();
}
function pushComm(from, text){
  state.comms.push({from, text});
  if(state.comms.length>40) state.comms.splice(0,state.comms.length-40);
  renderComms();
}

// ---------- ruído / tiles ----------
function hash2(x,y,seed){
  let h = x*374761393 + y*668265263 + seed*1442695041;
  h = (h ^ (h>>13)) * 1274126177;
  return (((h ^ (h>>16)) >>> 0) % 10000) / 10000;
}
function smooth(t){return t*t*(3-2*t)}
function valueNoise(x,y,seed){
  const xi=Math.floor(x), yi=Math.floor(y);
  const xf=x-xi, yf=y-yi;
  const a=hash2(xi,yi,seed), b=hash2(xi+1,yi,seed), c=hash2(xi, yi+1,seed), d=hash2(xi+1,yi+1,seed);
  const u=smooth(xf), v=smooth(yf);
  return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v;
}
function fbm(x,y,seed){
  return valueNoise(x,y,seed)*0.6 + valueNoise(x*2.1+7,y*2.1+3,seed+9)*0.3 + valueNoise(x*4.3,y*4.3,seed+21)*0.1;
}
// tiles: 0 perigo (lava/gás/lago), 1 poeira, 2 solo, 3 rocha, 4 montanha
function genWorld(seed, water, rockAt){
  for(let y=0;y<WORLD_H;y++)for(let x=0;x<WORLD_W;x++){
    const e = fbm(x*0.05, y*0.05, seed);
    const m = fbm(x*0.07+100, y*0.07+100, seed+500);
    let t;
    if(e<water) t=0;
    else if(e<water+0.08) t=1;
    else if(e<0.62) t = m>0.55 ? 3 : 2;
    else if(e<rockAt) t = m>0.45 ? 3 : 2;
    else t=4;
    tiles[y*WORLD_W+x]=t;
  }
}
function tileAt(tx,ty){
  tx = wrap(tx, WORLD_W); ty = wrap(ty, WORLD_H);
  return tiles[ty*WORLD_W+tx];
}
function isSolidTile(tx,ty){ return tileAt(tx,ty)===0; }
function collidesAt(px,py,r){
  px=wrap(px,WPX); py=wrap(py,WPY);
  for(const [ox,oy] of [[-r,-r],[r,-r],[-r,r],[r,r]])
    if(isSolidTile(Math.floor((px+ox)/TILE), Math.floor((py+oy)/TILE))) return true;
  for(const b of buildings){
    if(b.kind==="painel") continue;
    const bx=b.tx*TILE+TILE/2, by=b.ty*TILE+TILE/2;
    if(Math.abs(wdx(px,bx,WPX))<TILE/2+r-4 && Math.abs(wdx(py,by,WPY))<TILE/2+r-4) return true;
  }
  for(const res of resources){
    if(res.kind!=="rocha"&&res.kind!=="gelo") continue;
    const bx=res.tx*TILE+TILE/2, by=res.ty*TILE+TILE/2;
    if(Math.abs(wdx(px,bx,WPX))<12+r-4 && Math.abs(wdx(py,by,WPY))<12+r-4) return true;
  }
  return false;
}

// ---------- nave-mãe ----------
let stars=[];
function shipScene(){
  mode="ship"; bodyId=null;
  document.querySelectorAll(".panel").forEach(p=>p.classList.add("hidden"));
  stars=[];
  for(let i=0;i<160;i++) stars.push({x:Math.random()*canvas.width,y:Math.random()*canvas.height,r:rand(0.5,2),tw:rand(0,6)});
  renderMap(); renderComms();
  toggle("panel-map",true);
  $("planet-chip").textContent="🛸 Nave Esperança";
  updateHUD();
}
function renderMap(){
  const w=$("planet-cards"); if(!w) return;
  w.innerHTML="";
  const all=[...BODIES];
  for(const b of all){
    const locked=b.secret&&!state.bodies[b.id]&&!all.slice(0,7).every(x=>state.bodies[x.id]&&state.bodies[x.id].done);
    const open=state.unlocked.includes(b.id);
    const done=state.bodies[b.id]&&state.bodies[b.id].done;
    const d=document.createElement("div"); d.className="recipe planet"+(locked?" planet-lock":"");
    d.innerHTML=`<div style="font-size:26px">${locked?"🔒":b.icon}</div><h4>${locked?"???":b.name}</h4>`
      +`<p>${locked?"Complete os 8 planetas para revelar!":(b.site?"Pouso: "+b.site:b.dist)}</p>`
      +`${done?'<p>✅ colônia pronta!</p>':(open&&!locked?'<p>🛰️ pronto p/ explorar</p>':'')}`;
    const row=document.createElement("div");
    const bf=document.createElement("button");
    bf.textContent="📖 ficha"; bf.disabled=locked;
    bf.onclick=()=>showInfo(b);
    const b2=document.createElement("button");
    if(locked){ b2.textContent="🔒"; b2.disabled=true; }
    else if(done){ b2.textContent="Revisitar"; b2.onclick=()=>flyTo(b.id); }
    else if(open){ b2.textContent="Voar!"; b2.onclick=()=>flyTo(b.id); }
    else { b2.textContent="🔒 complete o anterior"; b2.disabled=true; }
    row.appendChild(bf); row.appendChild(b2);
    d.appendChild(row); w.appendChild(d);
  }
  // Terra: só ficha
  const t=document.createElement("div"); t.className="recipe planet";
  t.innerHTML=`<div style="font-size:26px">💙</div><h4>Terra (lar)</h4><p>De onde viemos. Sem missão — só saudade!</p>`;
  const tb=document.createElement("button"); tb.textContent="📖 ficha";
  tb.onclick=()=>showInfo({id:"terra",name:"Terra",icon:"💙",dist:"0 km (estamos longe...)",temp:"média 15°C",grav:"100% (referência!)",day:"24h",year:"365 dias",moons:"1 (a Lua!)",air:"Oxigênio — dá p/ respirar!",made:[["Água",71,"#38bdf8"],["Terra",29,"#4ade80"]],fact:TERRA.fact});
  t.appendChild(tb); w.appendChild(t);
}
function renderComms(){
  const w=$("comms-log"); if(!w) return;
  w.innerHTML="";
  const last=state.comms.slice(-4);
  if(!last.length) w.innerHTML=`<div class="comm"><b>ARIA:</b> Canal aberto, cadete. Escolha um planeta e boa missão! 📡</div>`;
  for(const m of last){
    const d=document.createElement("div"); d.className="comm";
    d.innerHTML=`<b>${m.from}:</b> ${m.text} <button class="quiz-opt" style="display:inline-block;width:auto;padding:2px 10px;margin:4px 0 0;" title="Ouvir">🔊</button>`;
    d.querySelector("button").onclick=()=>speak(m.from+": "+m.text);
    w.appendChild(d);
  }
  const row=document.createElement("div");
  const b=document.createElement("button");
  const cd=Math.ceil(90-(elapsed-state.supplyAt));
  b.textContent=cd>0?`📦 suprimentos (${cd}s)`:"📦 pedir suprimentos";
  b.disabled=cd>0;
  b.onclick=()=>dropSupplies();
  row.appendChild(b); w.appendChild(row);
}
function dropSupplies(){
  if(elapsed-state.supplyAt<90) return;
  state.supplyAt=elapsed;
  if(mode!=="surface"||!player){
    // pedido na nave: entrega ao pousar
    state.supplyPending=true;
    toast("📦 Suprimentos reservados p/ o pouso!",2200);
    renderComms(); return;
  }
  for(let i=0;i<3;i++){
    drops.push({x:wrap(player.x+rand(-60,60),WPX),y:wrap(player.y+rand(-60,60),WPY),
      item:["metal","metal","ice","food"][irand(0,3)],qtd:irand(1,2)});
  }
  toast("📦 Cápsula de suprimentos!",2200,true); beep(700,0.12,"sine",0.05);
  renderComms(); updateHUD();
}
function showInfo(b){
  $("info-title").textContent=`${b.icon} ${b.name}`;
  let makeup="";
  if(b.made) makeup=b.made.map(([n,p,c])=>
    `<div>${n} ${p}%<div class="makeup-bar"><div style="width:${p}%;background:${c}"></div></div></div>`).join("");
  $("info-body").innerHTML=`
    <div class="fact-grid">
      <div>📏 <b>Distância</b><br>${b.dist||""}</div>
      <div>🌡️ <b>Temperatura</b><br>${b.temp||""}</div>
      <div>⚖️ <b>Gravidade</b><br>${b.grav||""}</div>
      <div>🔄 <b>Dia / Ano</b><br>${b.day||""} / ${b.year||""}</div>
      <div>🌙 <b>Luas</b><br>${b.moons||""}</div>
      <div>💨 <b>Ar</b><br>${b.air||""}</div>
    </div>
    ${b.site?`<p>🛬 <b>Pouso:</b> ${b.site}</p>`:""}
    ${makeup?`<h4>🧪 Do que é feito</h4><div class="fact-grid">${makeup}</div>`:""}
    <p>💡 <b>Você sabia?</b> ${b.fact||""}</p>`;
  toggle("panel-info",true);
}
function flyTo(id){
  const b=BODIES.find(x=>x.id===id);
  if(!b) return;
  if(!state.unlocked.includes(id)) return;
  toggle("panel-map",false);
  enterSurface(id);
  if(!bs().colonized && !bs().landed){
    bs().landed=true;
    pushComm("ARIA", `Pouso em ${b.name}! ${b.fact}`);
    pushComm("Capitã Duarte", b.com);
    toast(`🛬 ${b.name}! ${b.site?"Pouso: "+b.site:""}`, 3000, true);
  }
  save(true);
}

// ---------- superfície ----------
function newPlayer(x,y){
  return {
    x, y, r:10, hp:100, maxHp:100, o2:100, energy:100,
    speed:140, facing:1, moving:false, frame:0, animT:0,
    inv:{metal:0,ice:0,food:1}, light:true,
    questNote:0,
  };
}
function findClearing(){
  for(let i=0;i<2000;i++){
    const tx=irand(0,WORLD_W-1), ty=irand(0,WORLD_H-1);
    const t=tileAt(tx,ty);
    if(t===2||t===1){
      let ok=true;
      for(let oy=-2;oy<=2&&ok;oy++)for(let ox=-2;ox<=2;ox++){
        const tt=tileAt(tx+ox,ty+oy);
        if(tt===0||tt===4){ok=false;break;}
      }
      if(ok) return {x:tx*TILE+16, y:ty*TILE+16};
    }
  }
  return {x:WPX/2, y:WPY/2};
}
const FAUNA_COLORS=["#f472b6","#4ade80","#facc15","#67e8f9","#fb923c","#c084fc"];
const FAUNA_NAMES=["pulga-de-cristal","esponja-andante","lesma-luz","tatu-bolha","grilo-polar","verme-arco-íris"];
const FAUNA_FACTS=[
  "Bichinhos de verdade vivem nos lugares mais malucos — até em lagos ácidos na Terra!",
  "Na Terra, tardígrados sobrevivem no espaço sem traje. Respeita!",
  "Alguns bichos fazem a própria luz, como vagalumes e peixes do fundo do mar.",
  "Em Titã chove metano em vez de água. Guarda-chuva não adiantaria!",
  "Europa pode ter um oceano com o dobro da água da Terra escondido no gelo!",
  "Tritão tem gêiseres que cospem gelo a 8 km de altura!",
];
function genSurface(b){
  resources=[]; drops=[]; fauna=[]; particles=[]; floaters=[]; buildings=[];
  const seed=irand(1,999999);
  const danger = b.id==="venus"?0.30 : b.id==="mercurio"?0.22 : 0.16;
  genWorld(seed, danger, 0.72);
  // recursos: rocha (metal), gelo, cristais de amostra
  for(let y=0;y<WORLD_H;y++)for(let x=0;x<WORLD_W;x++){
    const t=tileAt(x,y), r=Math.random();
    if(t===4 && r<0.10) resources.push({tx:x,ty:y,kind:"rocha",hp:3,maxHp:3});
    else if((t===2||t===3) && r<0.035) resources.push({tx:x,ty:y,kind:"gelo",hp:2,maxHp:2});
    else if((t===2||t===3) && r>=0.035 && r<0.05) resources.push({tx:x,ty:y,kind:"cristal",hp:2,maxHp:2});
  }
  // amostras brilhantes (missão)
  const need=b.id==="plutao"?2:3;
  for(let i=0;i<need+5;i++){
    for(let k=0;k<80;k++){
      const tx=irand(0,WORLD_W-1), ty=irand(0,WORLD_H-1);
      const t=tileAt(tx,ty);
      if((t===1||t===2||t===3)&&!resources.some(r=>r.tx===tx&&r.ty===ty)){
        resources.push({tx,ty,kind:"amostra",hp:1,maxHp:1}); break;
      }
    }
  }
  // fauna: 2 espécies do planeta
  faunaDefs=[
    {name:FAUNA_NAMES[irand(0,5)], color:FAUNA_COLORS[irand(0,5)], fact:FAUNA_FACTS[irand(0,5)]},
    {name:FAUNA_NAMES[irand(0,5)], color:FAUNA_COLORS[irand(0,5)], fact:FAUNA_FACTS[irand(0,5)]},
  ];
  for(let i=0;i<8;i++){
    const s=randWalkableSpot(); if(!s) continue;
    fauna.push({sp:i%2, x:s.tx*TILE+16, y:s.ty*TILE+16, wx:0, wy:0, wt:0, frame:rand(0,9)});
  }
}
function randWalkableSpot(){
  for(let i=0;i<80;i++){
    const tx=irand(0,WORLD_W-1), ty=irand(0,WORLD_H-1);
    const t=tileAt(tx,ty);
    if(t===1||t===2||t===3) return {tx,ty};
  }
  return null;
}
function enterSurface(id, px, py){
  bodyId=id;
  const b=P();
  mode="surface";
  document.querySelectorAll(".panel").forEach(p=>p.classList.add("hidden"));
  genSurface(b);
  // módulo de pouso (base inicial)
  const c=findClearing();
  player=newPlayer(c.x, c.y);
  if(px!=null&&py!=null){ player.x=px; player.y=py; }
  buildings=[{kind:"shuttle",tx:Math.floor(c.x/TILE),ty:Math.floor(c.y/TILE)}];
  // restaura construções salvas
  const saved=bs().savedBuildings||[];
  for(const s of saved) buildings.push({kind:s.kind,tx:s.tx,ty:s.ty,stock:0,cd:0});
  timeOfDay=0.35; day=1; buildMode=null;
  stormT=rand(30,60); stormOn=0; gustT=6;
  if(state.supplyPending){
    state.supplyPending=false;
    for(let i=0;i<3;i++){
      drops.push({x:wrap(player.x+rand(-60,60),WPX),y:wrap(player.y+rand(-60,60),WPY),
        item:["metal","metal","ice","food"][irand(0,3)],qtd:irand(1,2)});
    }
    setTimeout(()=>toast("📦 Sua cápsula de suprimentos pousou aqui perto!",2600,true),1200);
  }
  $("planet-chip").textContent=`${b.icon} ${b.name}${b.site?" • "+b.site:""}`;
  updateHUD(); renderRecipes(); renderBuilds(); updateMissionHUD();
  save(true);
}

// ---------- receitas / construções ----------
const RECIPES=[
  {id:"tank", icon:"🧪", name:"Tanque O2", cost:{metal:2,ice:1}, desc:"+70 oxigênio na hora.", apply(){player.o2=clamp(player.o2+70,0,100);}},
  {id:"kit", icon:"🩹", name:"Kit Reparo", cost:{metal:2}, desc:"+50 vida.", apply(){player.hp=clamp(player.hp+50,0,player.maxHp);}},
];
const BUILDS=[
  {id:"habitat", icon:"🛖", name:"Abrigo", cost:{metal:6}, desc:"Cura + O₂ por perto. Protege do clima."},
  {id:"estufa", icon:"🌱", name:"Estufa", cost:{metal:4,ice:2}, desc:"Cultiva comida + O₂ devagar."},
  {id:"painel", icon:"🔆", name:"Painel Solar", cost:{metal:3}, desc:"Recarrega energia por perto."},
  {id:"antena", icon:"📡", name:"Antena", cost:{metal:8,ice:4}, desc:"Com tudo pronto, E chama os colonos!"},
];
function hasCost(c){ for(const k in c) if((player.inv[k]||0)<c[k]) return false; return true; }
function payCost(c){ for(const k in c) player.inv[k]-=c[k]; }
function costText(c){
  const n={metal:"🔩",ice:"💧",food:"🍎"};
  return Object.entries(c).map(([k,v])=>`${n[k]||k}${v}`).join(" ");
}
function itemName(k){return {metal:"🔩",ice:"💧",food:"🍎",tank:"🧪"}[k]||k}
function nearKind(kind,maxD){
  for(const b of buildings){
    if(b.kind!==kind) continue;
    if(wdist(player.x,player.y,b.tx*TILE+16,b.ty*TILE+16)<maxD) return b;
  }
  return null;
}
function nearBase(maxD){
  return nearKind("shuttle",maxD)||nearKind("habitat",maxD)||nearKind("estufa",maxD)||nearKind("painel",maxD)||nearKind("antena",maxD);
}
function addBuildingAuto(kind){
  const tx=Math.floor(player.x/TILE), ty=Math.floor(player.y/TILE);
  for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1]])
    if(placeBuilding(kind, wrap(tx+dx,WORLD_W), wrap(ty+dy,WORLD_H), true)) return;
}
function placeBuilding(kind, tx, ty, ignoreMode){
  const t=tileAt(tx,ty);
  if(t===0||t===4) return false;
  if(buildings.some(b=>b.tx===tx&&b.ty===ty)) return false;
  const def=BUILDS.find(b=>b.id===kind);
  if(!def) return false;
  if(!ignoreMode){
    if(!hasCost(def.cost)) return false;
    payCost(def.cost);
  }
  buildings.push({kind,tx,ty,stock:0,cd:0});
  const st=bs(); st.built[kind]=true; st.savedBuildings=buildings.filter(b=>b.kind!=="shuttle").map(b=>({kind:b.kind,tx:b.tx,ty:b.ty}));
  sfx.build(); gainXp(10); toast({habitat:"🛖 Abrigo pronto! Perto dele você respira e se cura.",estufa:"🌱 Estufa pronta! Volte para colher comida.",painel:"🔆 Painel pronto! Energia por perto.",antena:"📡 Antena pronta! Aperte E nela com tudo pronto."}[kind]||"Construído!",2400);
  save(true); updateHUD();
  return true;
}
// ---------- E (agir) ----------
function nearestResource(maxD){
  let best=null,bd=maxD;
  for(const r of resources){
    const d=wdist(player.x,player.y,r.tx*TILE+16,r.ty*TILE+16);
    if(d<bd){bd=d;best=r}
  }
  return best;
}
function nearestFauna(maxD){
  let best=null,bd=maxD;
  for(const f of fauna){
    const d=wdist(player.x,player.y,f.x,f.y);
    if(d<bd){bd=d;best=f}
  }
  return best;
}
function nearestShuttle(){
  for(const b of buildings){
    if(b.kind!=="shuttle") continue;
    if(wdist(player.x,player.y,b.tx*TILE+16,b.ty*TILE+16)<70) return b;
  }
  return null;
}
function nearestAntenna(){
  for(const b of buildings){
    if(b.kind!=="antena") continue;
    if(wdist(player.x,player.y,b.tx*TILE+16,b.ty*TILE+16)<64) return b;
  }
  return null;
}
function doAction(){
  if(player.dead||!started||mode!=="surface") return;
  const sh=nearestShuttle();
  if(sh){ openConsole(); return; }
  const an=nearestAntenna();
  if(an){ useAntenna(); return; }
  let bi=-1,bd=46;
  drops.forEach((d,i)=>{const dd=wdist(player.x,player.y,d.x,d.y); if(dd<bd){bd=dd;bi=i;}});
  if(bi>=0){
    const d=drops.splice(bi,1)[0];
    player.inv[d.item]=(player.inv[d.item]||0)+d.qtd;
    sfx.pickup(); addFloater(player.x,player.y-20,"+"+d.qtd+" "+itemName(d.item),"#ffd166");
    updateHUD(); return;
  }
  const f=nearestFauna(56);
  if(f){ scanFauna(f); return; }
  const r=nearestResource(56);
  if(r){ harvest(r); return; }
  for(const b of buildings){
    if(b.kind!=="estufa") continue;
    if(wdist(player.x,player.y,b.tx*TILE+16,b.ty*TILE+16)<56&&b.stock>0){
      player.inv.food+=b.stock;
      addFloater(player.x,player.y-20,`+${b.stock} 🍎`,"#f87171");
      b.stock=0; sfx.pickup(); updateHUD(); return;
    }
  }
}
function harvest(r){
  const bx=r.tx*TILE+16, by=r.ty*TILE+16;
  const st=bs();
  if(r.kind==="amostra"){
    resources.splice(resources.indexOf(r),1);
    st.samples++; gainXp(15); sfx.pickup();
    addFloater(player.x,player.y-20,"+1 🧪 amostra!","#7dd3fc");
    burst(bx,by,"#7dd3fc",10);
    toast(`🧪 Amostra ${st.samples}! ${P().fact}`, 2600);
  }else if(r.kind==="rocha"){
    r.hp--;
    if(r.hp<=0){
      resources.splice(resources.indexOf(r),1);
      const q=irand(1,2);
      player.inv.metal+=q; sfx.pickup(); gainXp(5);
      addFloater(player.x,player.y-20,`+${q} 🔩`,"#d1d5db");
    } else beep(180,0.05,"square",0.04);
  }else if(r.kind==="gelo"){
    r.hp--;
    if(r.hp<=0){
      resources.splice(resources.indexOf(r),1);
      player.inv.ice+=2; sfx.pickup(); gainXp(5);
      addFloater(player.x,player.y-20,"+2 💧","#bae6fd");
    } else beep(200,0.05,"square",0.04);
  }else if(r.kind==="cristal"){
    r.hp--;
    if(r.hp<=0){
      resources.splice(resources.indexOf(r),1);
      player.inv.metal+=1; player.inv.ice+=1; sfx.pickup(); gainXp(8);
      addFloater(player.x,player.y-20,"+1 🔩 +1 💧","#e9d5ff");
    } else beep(500,0.05,"sine",0.04);
  }
  updateHUD(); updateMissionHUD(); save(true);
}
function scanFauna(f){
  const st=bs();
  const idx=faunaDefs.indexOf(faunaDefs[f.sp]);
  const key="sp"+f.sp;
  burst(f.x,f.y,"#f0abfc",8); beep(760,0.1,"sine",0.05);
  if(!st.scanned.includes(key)){
    st.scanned.push(key);
    gainXp(15);
    toast(`👽 ${faunaDefs[f.sp].name}! ${faunaDefs[f.sp].fact}`, 3400, true);
  } else {
    addFloater(f.x,f.y-16,faunaDefs[f.sp].name,"#f0abfc");
  }
  updateMissionHUD(); save(true);
}
function useAntenna(){
  const ms=missionsFor(P());
  const missing=ms.filter(m=>!m.d()&&m.t.indexOf("Antena")!==0&&m.t.indexOf("colonos")===-1);
  if(missing.length){
    toast(`📡 Faltam: ${missing[0].t}`, 2600);
    beep(220,0.15,"square",0.05);
    return;
  }
  if(!bs().quiz){ toast("📡 Responda o quiz da ARIA no console da nave! (E na nave 🛸)", 2600); return; }
  colonyReady();
}
function colonyReady(){
  const b=P(), st=bs();
  if(st.done) return;
  st.done=true;
  gainXp(100); sfx.win();
  const order=BODIES.filter(x=>!x.secret);
  const idx=order.findIndex(x=>x.id===b.id);
  const next=order[idx+1];
  if(next && !state.unlocked.includes(next.id)){
    state.unlocked.push(next.id);
    pushComm("Capitã Duarte", `Colônia ${b.name} pronta! ${next.icon} ${next.name} liberado. Decolem quando quiserem!`);
  }
  pushComm("ARIA", `Colonos a caminho de ${b.name}! Abrigo, comida e energia prontos. Orgulho de você, cadete! 🎉`);
  toast(`🎉 COLÔNIA ${b.name.toUpperCase()} PRONTA!`, 4000, true);
  const allMain=order.every(x=>state.bodies[x.id]&&state.bodies[x.id].done);
  if(allMain && !state.bodies.plutao){
    state.unlocked.push("plutao");
    pushComm("ARIA", "🪐✨ Detectei um nono mundo: Plutão, o coração de gelo! Destino secreto liberado!");
    toast("🪐✨ Destino secreto: PLUTÃO!", 4000, true);
  }
  if(state.bodies.plutao&&state.bodies.plutao.done&&!state.victory){
    state.victory=true;
    $("win-stats").textContent=`8 planetas + Plutão • Nv ${state.player.level} • ${state.comms.length} mensagens da tripulação`;
    document.querySelector("#screen-win").classList.remove("hidden");
  }
  save(true); updateMissionHUD(); renderMap();
}
function eatBest(){
  if(player.inv.food>0){ player.inv.food--; player.hp=clamp(player.hp+25,0,player.maxHp); sfx.eat(); updateHUD(); }
  else toast("Sem cultivo 🍎 — colha na estufa 🌱",1800);
}
function toggleTorch(){
  player.light=!player.light;
  beep(player.light?520:300,0.08,"triangle");
  updateHUD();
}
// ---------- console da nave (quiz, suprimentos, voltar) ----------
function openConsole(){
  const st=bs();
  $("quiz-body").innerHTML=`
    <p>🛸 <b>Console da nave auxiliar.</b> O₂ recarregado! O que deseja, cadete?</p>
    <button class="quiz-opt" id="cq-quiz">🛰️ Responder o quiz da ARIA ${st.quiz?"(feito ✔)":""}</button>
    <button class="quiz-opt" id="cq-sup">📦 Pedir suprimentos ${elapsed-state.supplyAt<90?"(aguarda)":""}</button>
    <button class="quiz-opt" id="cq-back">🛸 Voltar à nave-mãe</button>`;
  document.querySelector("#panel-quiz .panel-head h2").textContent="🛸 Console da nave";
  toggle("panel-quiz",true);
  $("cq-quiz").onclick=()=>openQuiz();
  $("cq-sup").onclick=()=>{ dropSupplies(); openConsole(); };
  $("cq-back").onclick=()=>{ toggle("panel-quiz",false); shipScene(); save(true); };
  player.o2=100; updateHUD();
}
function openQuiz(){
  const b=P(), st=bs(), q=b.quiz;
  document.querySelector("#panel-quiz .panel-head h2").textContent="🛰️ Quiz da ARIA";
  const w=$("quiz-body");
  w.innerHTML=`<div class="quiz-q">🤖 <b>ARIA pergunta:</b> ${q.q}</div>`;
  const rp=document.createElement("button");
  rp.className="quiz-opt"; rp.textContent="🔊 ouvir de novo";
  rp.onclick=()=>speak(q.q+" Opções: "+q.opts.join(". "));
  w.appendChild(rp);
  speak(q.q+" Opções: "+q.opts.join(". "));
  q.opts.forEach((op,i)=>{
    const btn=document.createElement("button");
    btn.className="quiz-opt"; btn.textContent=op;
    btn.onclick=()=>{
      if(i===q.ok){
        btn.classList.add("ok");
        if(!st.quiz){ st.quiz=true; gainXp(20); }
        pushComm("ARIA","Resposta certa, cadete! Sabedoria também é oxigênio. 🎓");
        const d=document.createElement("div"); d.className="comm";
        d.innerHTML=`💡 <b>Por quê?</b> ${q.why}`;
        w.appendChild(d);
        setTimeout(()=>{ toggle("panel-quiz",false); },1600);
        updateMissionHUD(); save(true);
      } else {
        btn.classList.add("no");
        beep(200,0.15,"square",0.05);
        toast("Ops! Tente de novo — ler a ficha 🪐 ajuda!",2200);
      }
    };
    w.appendChild(btn);
  });
}

// ---------- HUD / painéis ----------
function updateHUD(){
  if(!player) return;
  $("bar-hp").style.width=(player.hp/player.maxHp*100)+"%";
  $("bar-o2").style.width=player.o2+"%";
  $("bar-energy").style.width=player.energy+"%";
  $("txt-hp").textContent=Math.ceil(player.hp);
  $("txt-o2").textContent=Math.ceil(player.o2);
  $("txt-energy").textContent=Math.ceil(player.energy);
  $("level").textContent=state.player.level; $("xp").textContent=state.player.xp;
  let nn=60, acc=0;
  while(acc+nn<=state.player.xp){ acc+=nn; nn=Math.round(nn*1.28+10); }
  $("xp-next").textContent=nn;
  $("xp-fill").style.width=(state.player.xp/(acc+nn)*100)+"%";
  const st=state.bodies[bodyId];
  $("c-samples").textContent=st?st.samples:0;
  $("c-food").textContent=player.inv.food;
  $("c-torch").textContent=player.light?"ON":"OFF";
  $("c-sample").textContent=st?st.samples:0;
  $("c-ice").textContent=player.inv.ice; $("c-metal").textContent=player.inv.metal;
  renderRecipes(); renderBuilds();
}
function updateMissionHUD(){
  const t=$("obj-title"), f=$("obj-fill");
  if(!player||!t) return;
  if(mode!=="surface"){ t.textContent="🛸 Escolha um planeta no mapa"; f.style.width="0%"; return; }
  const ms=missionsFor(P());
  const done=ms.filter(m=>m.d()).length;
  const cur=ms.find(m=>!m.d());
  const st=bs();
  if(st.done){ t.textContent=`✅ ${P().name}: colônia pronta!`; f.style.width="100%"; return; }
  t.textContent="🎯 "+(cur?cur.t:"?");
  f.style.width=(done/ms.length*100)+"%";
  renderMissions();
}
function renderMissions(){
  const w=$("mission-list"); if(!w) return;
  w.innerHTML="";
  if(mode!=="surface"){ w.innerHTML="<p>Abra o mapa na nave-mãe. 🛸</p>"; $("mission-comms").innerHTML=""; return; }
  const ms=missionsFor(P());
  const cur=ms.find(m=>!m.d());
  for(const m of ms){
    const d=document.createElement("div");
    d.className="mission"+(m.d()?" done":(m===cur?" now":""));
    d.textContent=(m.d()?"✔ ":"• ")+m.t;
    w.appendChild(d);
  }
  const mc=$("mission-comms");
  mc.innerHTML="<h4>📻 Mensagens <button id='mis-speak' class='quiz-opt' style='display:inline-block;width:auto;padding:2px 10px;' title='Ouvir missão'>🔊 missão</button></h4>";
  const msb=document.getElementById("mis-speak");
  if(msb) msb.onclick=()=>speakMission();
  for(const m of state.comms.slice(-5)){
    const d=document.createElement("div"); d.className="comm";
    d.innerHTML=`<b>${m.from}:</b> ${m.text} <button class="quiz-opt" style="display:inline-block;width:auto;padding:2px 10px;margin:4px 0 0;" title="Ouvir">🔊</button>`;
    d.querySelector("button").onclick=()=>speak(m.from+": "+m.text);
    mc.appendChild(d);
  }
}
function renderRecipes(){
  const w=$("recipes"); if(!w||!player) return;
  w.innerHTML="";
  for(const r of RECIPES){
    const afford=hasCost(r.cost);
    const d=document.createElement("div"); d.className="recipe";
    d.innerHTML=`<div style="font-size:26px">${r.icon}</div><h4>${r.name}</h4><p>${r.desc}</p><p>💰 ${costText(r.cost)}</p>`;
    const b=document.createElement("button");
    b.textContent=afford?"Criar":"—"; b.disabled=!afford;
    b.onclick=()=>{
      if(!hasCost(r.cost)) return;
      payCost(r.cost); r.apply();
      gainXp(10); sfx.craft(); updateHUD();
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
function updateContextTip(){
  const el=$("context-tip");
  if(!el||!player||player.dead||!started){ if(el) el.classList.add("hidden"); return; }
  if(mode!=="surface"){ el.classList.add("hidden"); return; }
  const ACT = IS_TOUCH ? "✋" : "<b>E</b>";
  if(nearestShuttle()){ el.innerHTML=`🛸 ${ACT} console da nave (quiz, suprimentos, voltar)`; el.classList.remove("hidden"); return; }
  if(nearestAntenna()){ el.innerHTML=`📡 ${ACT} chamar os colonos`; el.classList.remove("hidden"); return; }
  let bi=-1,bd=46;
  drops.forEach((d,i)=>{ if(wdist(player.x,player.y,d.x,d.y)<bd){bd=99;bi=i;} });
  if(bi>=0){ el.innerHTML=`✨ ${ACT} pegar ${itemName(drops[bi].item)}`; el.classList.remove("hidden"); return; }
  const f=nearestFauna(56);
  if(f){ el.innerHTML=`👽 ${ACT} escanear bichinho`; el.classList.remove("hidden"); return; }
  const r=nearestResource(56);
  if(r){
    const n={rocha:"🔩 metal",gelo:"💧 gelo",cristal:"🔩+💧",amostra:"🧪 amostra"};
    el.innerHTML=`${ACT} coletar ${n[r.kind]||""}`;
    el.classList.remove("hidden"); return;
  }
  for(const b of buildings){
    if(b.kind!=="estufa") continue;
    if(wdist(player.x,player.y,b.tx*TILE+16,b.ty*TILE+16)<56&&b.stock>0){
      el.innerHTML=`🍎 ${ACT} colher cultivo`; el.classList.remove("hidden"); return;
    }
  }
  el.classList.add("hidden");
}

// ---------- guia do objetivo (seta p/ quem ainda não lê) ----------
function objectiveTarget(){
  try{
    if(mode!=="surface"||!player||player.dead) return null;
    const ms=missionsFor(P());
    const idx=ms.findIndex(m=>!m.d());
    if(idx<0) return null;
    if(idx===0){
      let best=null,bd=1e12;
      for(const r of resources){
        if(r.kind!=="amostra") continue;
        const d=wdist(player.x,player.y,r.tx*TILE+16,r.ty*TILE+16);
        if(d<bd){bd=d;best=r;}
      }
      if(best) return {x:best.tx*TILE+16,y:best.ty*TILE+16};
    } else if(idx===3){
      const f=nearestFauna(1e9);
      if(f) return {x:f.x,y:f.y};
    } else if(idx===5){
      const sh=buildings.find(b=>b.kind==="shuttle");
      if(sh) return {x:sh.tx*TILE+16,y:sh.ty*TILE+16};
    } else if(idx===6){
      const an=buildings.find(b=>b.kind==="antena");
      if(an) return {x:an.tx*TILE+16,y:an.ty*TILE+16};
    }
  }catch(e){}
  return null;
}
// ---------- voz alta (acessibilidade pré-alfabetizados) ----------
let speechOn=true;
function speak(t){
  try{
    if(!speechOn||!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const clean=String(t).replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{2190}-\u{21FF}\u{2300}-\u{23FF}]/gu," ").replace(/[*_#<>]/g," ").replace(/\s+/g," ").trim();
    if(!clean) return;
    const u=new SpeechSynthesisUtterance(clean);
    u.lang="pt-BR"; u.rate=0.95;
    window.speechSynthesis.speak(u);
  }catch(e){}
}
function speakMission(){
  try{
    if(mode!=="surface"){ speak("Escolha um planeta no mapa para viajar!"); return; }
    const ms=missionsFor(P());
    const cur=ms.find(m=>!m.d());
    speak(cur?("Sua missão: "+cur.t):(bs().done?"Colônia pronta! Parabéns!":"Missão cumprida!"));
  }catch(e){}
}
// ---------- partículas ----------
function burst(x,y,color,n){for(let i=0;i<n;i++)particles.push({x,y,vx:rand(-70,70),vy:rand(-70,70),life:rand(.25,.6),t:0,color,size:irand(2,4)});}
function addFloater(x,y,txt,color){floaters.push({x,y,txt,color,t:0,life:1.1});}

// ---------- loop ----------
let last=0, saveT=0;
function loop(ts){
  requestAnimationFrame(loop);
  if(!started||gameOver||!player) {last=ts;return;}
  const dt=Math.min(0.05,(ts-last)/1000||0.016); last=ts;
  elapsed+=dt;
  if(mode==="ship"){ drawStars(); return; }
  const b=P(), hz=b.hazard;
  timeOfDay+=dt/200;
  if(timeOfDay>=1) timeOfDay-=1;
  const night=timeOfDay<0.22||timeOfDay>0.78;
  attackAnim=Math.max(0,attackAnim-dt); hurtFlash=Math.max(0,hurtFlash-dt);
  player.hurtCD=Math.max(0,(player.hurtCD||0)-dt);

  // movimento
  let dx=0,dy=0;
  if(keys.w||keys.arrowup)dy-=1; if(keys.s||keys.arrowdown)dy+=1;
  if(keys.a||keys.arrowleft){dx-=1;player.facing=-1} if(keys.d||keys.arrowright){dx+=1;player.facing=1}
  if(touchMove.active){dx+=touchMove.x; dy+=touchMove.y;}
  if(dx>0.2)player.facing=1; else if(dx<-0.2)player.facing=-1;
  player.moving=Math.hypot(dx,dy)>0.15;
  if(player.moving){
    const run=((keys.shift||touchRun)&&player.energy>5);
    const sp=player.speed*(run?1.6:1);
    player.animT+=dt*(run?12:8); player.frame=Math.floor(player.animT)%4;
    if(run) player.energy=Math.max(0,player.energy-8*dt);
    const len=Math.hypot(dx,dy); if(len>1){dx/=len;dy/=len;}
    const nx=wrap(player.x+dx*sp*dt,WPX), ny=wrap(player.y+dy*sp*dt,WPY);
    if(!collidesAt(nx,player.y,player.r)) player.x=nx;
    if(!collidesAt(player.x,ny,player.r)) player.y=ny;
  } else {
    player.frame=0;
  }
  const rect=canvas.getBoundingClientRect();
  mouse.wx=cam.x+mouse.x*(canvas.width/rect.width/ZOOM);
  mouse.wy=cam.y+mouse.y*(canvas.height/rect.height/ZOOM);

  // traje: O2 e energia
  const storming=stormOn>0;
  player.o2=clamp(player.o2-dt*(storming?2.4:1.25),0,100);
  let eDrain=100/150;
  if(night||hz.cold>=2) eDrain*=1.8;
  if(!player.light) eDrain*=0.6;
  player.energy=clamp(player.energy-eDrain*dt,0,100);
  const safe=nearBase(115);
  if(safe){
    player.o2=clamp(player.o2+30*dt,0,100);
    player.energy=clamp(player.energy+22*dt,0,100);
    player.hp=clamp(player.hp+4*dt,0,player.maxHp);
  }
  // perigos do planeta
  let dmg=0;
  if(hz.heat>=3) dmg=Math.max(dmg,7);
  else if(hz.heat===2&&!night) dmg=Math.max(dmg,5);
  if(hz.cold>=2&&!safe) dmg=Math.max(dmg,5);
  else if(hz.cold===1&&night&&!safe) dmg=Math.max(dmg,3);
  if(storming) dmg=Math.max(dmg,2);
  if(dmg>0&&safe) dmg=0;
  if(dmg>0){
    player.hp-=dmg*dt; hurtFlash=Math.max(hurtFlash,0.12);
    if(player.hp<=0){ player.hp=0; faint(); }
  }
  if(player.o2<=0){
    player.hp-=8*dt;
    if(Math.floor(elapsed*2)%2===0) addFloater(player.x,player.y-22,"😮‍💨 O₂!","#7dd3fc");
    if(player.hp<=0){ player.hp=0; faint(); }
  }
  // vento: empurra de tempos em tempos
  if(hz.wind>0){
    gustT-=dt;
    if(gustT<=0){
      gustT=rand(5,9)-hz.wind;
      const a=rand(0,Math.PI*2), f=26*hz.wind;
      const nx=wrap(player.x+Math.cos(a)*f,WPX), ny=wrap(player.y+Math.sin(a)*f,WPY);
      if(!collidesAt(nx,ny,player.r)){ player.x=nx; player.y=ny; }
      burst(player.x,player.y,"#e0f2fe",8);
      addFloater(player.x,player.y-22,"💨","#bae6fd");
      beep(180,0.25,"sine",0.04);
    }
  }
  // tempestade de poeira (Marte)
  if(hz.storm){
    if(stormOn>0){
      stormOn-=dt;
      if(Math.random()<dt*8) particles.push({x:wrap(cam.x+Math.random()*(canvas.width/ZOOM),WPX),y:wrap(cam.y-10,WPY),vx:rand(-160,-90),vy:rand(20,60),life:rand(1,2),t:0,color:"#d6a55c",size:2});
    } else {
      stormT-=dt;
      if(stormT<=0){ stormOn=12; stormT=rand(45,70); toast("🌪️ Tempestade de poeira! Volte à base!",3000,true); }
    }
  }
  // estufa produz
  for(const sh of buildings){
    if(sh.kind!=="estufa") continue;
    sh.cd=(sh.cd||0)+dt;
    if(sh.cd>40&&sh.stock<3){ sh.cd=0; sh.stock++; }
  }
  // fauna: vagueia e foge
  for(const c of fauna){
    c.frame+=dt;
    const dp=wdist(c.x,c.y,player.x,player.y);
    c.wt-=dt;
    if(dp<95){
      const a=angTo(player.x,player.y,c.x,c.y);
      const nx=wrap(c.x+Math.cos(a)*85*dt,WPX), ny=wrap(c.y+Math.sin(a)*85*dt,WPY);
      if(tileAt(Math.floor(nx/TILE),Math.floor(ny/TILE))!==0){ c.x=nx; c.y=ny; }
    }else{
      if(c.wt<=0){ c.wt=rand(1.5,3); c.wx=c.x; c.wy=c.y;
        for(let i=0;i<5;i++){
          const a=rand(0,Math.PI*2), d=rand(50,130);
          const nx=wrap(c.x+Math.cos(a)*d,WPX), ny=wrap(c.y+Math.sin(a)*d,WPY);
          if(tileAt(Math.floor(nx/TILE),Math.floor(ny/TILE))!==0){ c.wx=nx; c.wy=ny; break; }
        }
      }
      if(wdist(c.x,c.y,c.wx,c.wy)>12){
        const a=angTo(c.x,c.y,c.wx,c.wy);
        const nx=wrap(c.x+Math.cos(a)*45*dt,WPX), ny=wrap(c.y+Math.sin(a)*45*dt,WPY);
        if(tileAt(Math.floor(nx/TILE),Math.floor(ny/TILE))!==0){ c.x=nx; c.y=ny; }
      }
    }
  }
  for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.t+=dt;if(p.t>=p.life){particles.splice(i,1);continue;}p.x=wrap(p.x+p.vx*dt,WPX);p.y=wrap(p.y+p.vy*dt,WPY);p.vx*=0.95;p.vy*=0.95;}
  for(let i=floaters.length-1;i>=0;i--){const f=floaters[i];f.t+=dt;f.y-=22*dt;if(f.t>=f.life)floaters.splice(i,1);}

  updateContextTip();
  saveT+=dt; if(saveT>20){saveT=0;save(true);}
  if(Math.floor(elapsed*2)%20===0){ updateHUD(); updateMissionHUD(); }
  render();
}
function faint(){
  if(player.dead) return;
  player.dead=true;
  toast("😵 Você desmaiou! Acordou no módulo…",3000,true);
  beep(220,0.4,"sawtooth",0.06);
  setTimeout(()=>{
    const sh=buildings.find(b=>b.kind==="shuttle")||buildings.find(b=>b.kind==="habitat");
    if(sh){ player.x=sh.tx*TILE+16; player.y=sh.ty*TILE+16; }
    player.hp=player.maxHp; player.o2=60; player.energy=60; player.dead=false;
    updateHUD();
  },1600);
}

// ---------- desenho ----------
function px(x,y,w,h,c){ctx.fillStyle=c;ctx.fillRect(x|0,y|0,w,h);}
function drawShadow(x,y,r){ctx.fillStyle="rgba(0,0,0,.3)";ctx.beginPath();ctx.ellipse(x,y+r*0.8,r,r*0.4,0,0,7);ctx.fill();}
function tileColor(t,x,y){
  const pal=P().pal, v=hash2(x,y,7)*16-8;
  const c=pal["t"+t]||pal.t2;
  return `rgb(${Math.round(c[0]+v)},${Math.round(c[1]+v)},${Math.round(c[2]+v)})`;
}
function drawPlayer(x,y){
  drawShadow(x,y,10);
  const f=Math.floor(player.frame)%2, bob=player.moving?(f?-1:1):0;
  const s=2, ox=x-8*s/1.4, oy=y-14+bob;
  // traje espacial branco/laranja + capacete
  px(ox+3*s,oy+10*s,s,3*s,"#94a3b8"); px(ox+6*s,oy+10*s,s,3*s,"#94a3b8");
  px(ox+2*s,oy+6*s,6*s,4*s,"#f97316");
  px(ox+2*s,oy+6*s,6*s,s,"#fdba74");
  px(ox+2*s,oy+2*s,6*s,4*s,"#e2e8f0");
  px(ox+3*s,oy+1*s,4*s,3*s,"#0ea5e9");
  px(ox+2*s,oy+1*s,6*s,s,"#c2410c");
  px(ox-3*s,oy+6*s,2*s,4*s,"#cbd5e1"); // mochila de O2
}
function drawSuitLight(x,y){
  if(!player.light||player.energy<=0) return;
  const tx2=x+player.facing*12, ty2=y-10+Math.sin(elapsed*10)*1.5;
  px(tx2-3,ty2-9,7,6,"#fef9c3"); px(tx2-2,ty2-8,5,4,"#fff");
}
function drawFauna(f,x,y){
  const def=faunaDefs[f.sp]||{color:"#f472b6",name:"?"};
  const b=Math.sin(f.frame*3)*1.5;
  drawShadow(x,y,7);
  px(x-7,y-6+b,14,9,def.color); px(x-7,y-6+b,14,3,"rgba(255,255,255,.5)");
  px(x-5,y-11+b,4,6,def.color); px(x+1,y-11+b,4,6,def.color);
  px(x-3,y-5+b,2,2,"#000"); px(x+1,y-5+b,2,2,"#000");
}
function drawRes(r,x,y){
  const bob=Math.sin(elapsed*3+r.tx)*1.5;
  if(r.kind==="rocha"){ px(x-9,y-8,18,12,"#78716c"); px(x-9,y-8,18,3,"#a8a29e"); px(x-4,y-4,4,4,"#57534c"); }
  else if(r.kind==="gelo"){ px(x-8,y-6,16,10,"#bae6fd"); px(x-8,y-6,16,3,"#fff"); px(x-2,y-3,4,4,"#0284c7"); }
  else if(r.kind==="cristal"){ px(x-6,y-12+bob,12,16,"#a855f7"); px(x-4,y-16+bob,8,6,"#e9d5ff"); }
  else if(r.kind==="amostra"){
    px(x-5,y-10+bob,10,12,"#0ea5e9"); px(x-5,y-10+bob,10,3,"#7dd3fc"); px(x-2,y-7+bob,4,6,"#fff");
    if(Math.sin(elapsed*4)>0) px(x-8,y-14+bob,16,20,"rgba(125,211,252,.15)");
  }
}
function drawBuilding(b, sx, sy){
  const x=(sx===undefined?b.tx*TILE+16:sx), y=(sy===undefined?b.ty*TILE+16:sy);
  if(b.kind==="shuttle"){
    drawShadow(x,y+6,12);
    px(x-10,y-20,20,26,"#e2e8f0"); px(x-10,y-20,20,5,"#2563eb");
    px(x-2,y-24,4,6,"#94a3b8"); px(x-5,y-12,10,7,"#0ea5e9");
    px(x-16,y-8,7,14,"#ef4444"); px(x+9,y-8,7,14,"#ef4444");
    const f=Math.sin(elapsed*12)*2;
    px(x-4,y+8+f,8,7,"#f97316"); px(x-2,y+10+f,4,5,"#fde047");
  }else if(b.kind==="habitat"){
    px(x-16,y-10,32,16,"#e2e8f0"); px(x-16,y-10,32,4,"#f97316");
    px(x-10,y-14,20,5,"#94a3b8");
    px(x-5,y-6,10,12,"#0ea5e9"); px(x+6,y-6,5,5,"#fde047"); px(x-11,y-6,5,5,"#fde047");
  }else if(b.kind==="estufa"){
    px(x-14,y-8,28,14,"#bbf7d0"); px(x-14,y-8,28,14,"rgba(34,197,94,.35)");
    px(x-14,y-8,28,3,"#16a34a");
    px(x-8,y-4,5,8,"#22c55e"); px(x+1,y-6,5,10,"#4ade80"); px(x-2,y-2,3,3,"#ef4444"); px(x+4,y-4,3,3,"#ef4444");
    if(b.stock>0){ px(x-4,y-16+Math.sin(elapsed*3)*1.5,8,6,"#ef4444"); }
  }else if(b.kind==="painel"){
    px(x-12,y-2,24,4,"#475569");
    px(x-14,y-14,28,12,"#1e3a8a"); px(x-14,y-14,28,12,"rgba(125,211,252,.35)");
    px(x-1,y-14,2,12,"#94a3b8"); px(x-14,y-9,28,2,"#94a3b8");
  }else if(b.kind==="antena"){
    px(x-10,y+2,20,5,"#57534c");
    px(x-2,y-22,4,26,"#a8a29e"); px(x-8,y-20,16,3,"#e2e8f0");
    const on=bs().done;
    const bl=Math.sin(elapsed*6)>0;
    px(x-3,y-28,6,6,on||bl?"#22c55e":"#475569");
    if(on) px(x-8,y-32,16,20,"rgba(34,197,94,.15)");
  }
}
function drawDrop(d){
  const b=Math.sin(elapsed*4+d.x)*2;
  if(d.item==="metal"){px(d.x-5,d.y-4+b,10,7,"#9ca3af"); px(d.x-5,d.y-4+b,10,2,"#e5e7eb");}
  else if(d.item==="ice"){px(d.x-4,d.y-5+b,8,8,"#bae6fd"); px(d.x-2,d.y-3+b,4,4,"#fff");}
  else if(d.item==="food"){px(d.x-4,d.y-5+b,8,8,"#ef4444"); px(d.x-1,d.y-7+b,2,2,"#22c55e");}
}
function drawDecorTile(tx,ty,sx,sy,t){
  const h=hash2(tx,ty,99);
  if(t===2&&h>0.82){ctx.fillStyle="rgba(0,0,0,.15)";ctx.fillRect(sx+8,sy+10,3,3);}
  if(t===0&&h>0.6){ctx.fillStyle="rgba(255,255,255,.25)";ctx.fillRect(sx+((elapsed*8+tx*7)%TILE),sy+8,6,2);}
}
function drawStars(){
  ctx.fillStyle="#05060f"; ctx.fillRect(0,0,canvas.width,canvas.height);
  for(const s of stars){
    const tw=0.5+0.5*Math.sin(elapsed*2+s.tw);
    ctx.globalAlpha=0.3+0.7*tw; ctx.fillStyle="#fff";
    ctx.fillRect(s.x,s.y,s.r,s.r);
  }
  ctx.globalAlpha=1;
  ctx.fillStyle="#fff"; ctx.font="bold 13px monospace"; ctx.textAlign="center";
  ctx.fillText("🛸 NAVE-MÃE ESPERANÇA — abra o mapa (toque no 🪐 ou em Missões)", canvas.width/2, 28);
  ctx.textAlign="left";
}
function render(){
  const W=canvas.width,H=canvas.height;
  if(mode!=="surface"){ drawStars(); return; }
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
    drawDecorTile(tx,ty,i*TILE-offX,j*TILE-offY,tileAt(tx,ty));
  }
  const SX=(wx)=>wdx(wx,cam.x,WPX), SY=(wy)=>wdx(wy,cam.y,WPY);
  const vis=(wx,wy,m)=>{const sx=SX(wx),sy=SY(wy);return sx>-m&&sy>-m&&sx<vw+m&&sy<vh+m;};
  for(const d of drops) if(vis(d.x,d.y,20)) drawDrop(d);
  for(const r of resources){
    const bx=r.tx*TILE+16, by=r.ty*TILE+16;
    if(!vis(bx,by,40)) continue;
    drawRes(r,SX(bx),SY(by));
  }
  for(const b of buildings){
    const bx=b.tx*TILE+16, by=b.ty*TILE+16;
    if(!vis(bx,by,50)) continue;
    drawBuilding(b,SX(bx),SY(by));
  }
  for(const c of fauna) if(vis(c.x,c.y,30)){
    drawFauna(c,SX(c.x),SY(c.y));
    if(!bs().scanned.includes("sp"+faunaDefs.indexOf(faunaDefs[c.sp]))){
      ctx.fillStyle="#f0abfc"; ctx.font="bold 11px monospace"; ctx.textAlign="center";
      ctx.fillText("?",SX(c.x),SY(c.y)-16); ctx.textAlign="left";
    }
  }
  drawPlayer(SX(player.x),SY(player.y));
  drawSuitLight(SX(player.x),SY(player.y));
  // seta-guia: anel pulsante no alvo + seta ao redor do cadete
  const TGT=objectiveTarget();
  if(TGT&&!player.dead){
    const tx=SX(TGT.x), ty=SY(TGT.y);
    if(tx>-20&&ty>-20&&tx<vw+20&&ty<vh+20){
      const pr=14+Math.sin(elapsed*5)*4;
      ctx.strokeStyle="#ffd166"; ctx.lineWidth=3;
      ctx.beginPath(); ctx.arc(tx,ty,pr,0,7); ctx.stroke();
    }
    if(wdist(player.x,player.y,TGT.x,TGT.y)>52){
      const a=angTo(player.x,player.y,TGT.x,TGT.y);
      const ax=SX(player.x)+Math.cos(a)*38, ay=SY(player.y)+Math.sin(a)*38;
      ctx.save(); ctx.translate(ax,ay); ctx.rotate(a);
      ctx.fillStyle="#ffd166";
      ctx.beginPath(); ctx.moveTo(11,0); ctx.lineTo(-5,-8); ctx.lineTo(-5,8); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }
  for(const p of particles){ctx.fillStyle=p.color;ctx.globalAlpha=1-p.t/p.life;ctx.fillRect(SX(p.x),SY(p.y),p.size,p.size);}
  ctx.globalAlpha=1;
  ctx.font="bold 12px monospace"; ctx.textAlign="center";
  for(const f of floaters){ctx.globalAlpha=1-f.t/f.life;ctx.fillStyle="#000";ctx.fillText(f.txt,SX(f.x)+1,SY(f.y)+1);ctx.fillStyle=f.color;ctx.fillText(f.txt,SX(f.x),SY(f.y));}
  ctx.globalAlpha=1; ctx.textAlign="left";
  if(buildMode&&started&&!gameOver&&mode==="surface"){
    const tx=wrap(Math.floor(wrap(mouse.wx,WPX)/TILE),WORLD_W), ty=wrap(Math.floor(wrap(mouse.wy,WPY)/TILE),WORLD_H);
    ctx.globalAlpha=0.55; ctx.fillStyle="#fff";
    ctx.fillRect(SX(tx*TILE+16)-14,SY(ty*TILE+16)-14,28,28);
    ctx.globalAlpha=1;
    const t=tileAt(tx,ty);
    const ok=(t===1||t===2||t===3)&&!buildings.some(b=>b.tx===tx&&b.ty===ty);
    ctx.strokeStyle=ok?"#4ade80":"#ef4444";ctx.lineWidth=2/ZOOM;
    ctx.strokeRect(SX(tx*TILE),SY(ty*TILE),TILE,TILE);
  }
  ctx.restore();
  const night=timeOfDay<0.22||timeOfDay>0.78;
  const nA=night?(player.light&&player.energy>0?0.45:0.65):0;
  if(nA>0.02){
    ctx.fillStyle=`rgba(5,5,30,${nA})`;ctx.fillRect(0,0,W,H);
    ctx.globalCompositeOperation="lighter";
    const lights=[];
    for(const b of buildings) if(b.kind==="habitat"||b.kind==="shuttle") lights.push({x:wdx(b.tx*TILE+16,cam.x,WPX)*ZOOM,y:wdx(b.ty*TILE+16,cam.y,WPY)*ZOOM,r:150*ZOOM});
    lights.push({x:wdx(player.x,cam.x,WPX)*ZOOM,y:wdx(player.y,cam.y,WPY)*ZOOM,r:(player.light&&player.energy>0?200:60)*ZOOM});
    for(const L of lights){
      if(L.x<-L.r||L.y<-L.r||L.x>W+L.r||L.y>H+L.r) continue;
      const g=ctx.createRadialGradient(L.x,L.y,10,L.x,L.y,L.r);
      g.addColorStop(0,"rgba(255,220,150,.6)");g.addColorStop(1,"rgba(255,220,150,0)");
      ctx.fillStyle=g;ctx.beginPath();ctx.arc(L.x,L.y,L.r,0,7);ctx.fill();
    }
    ctx.globalCompositeOperation="source-over";
  }
  if(stormOn>0){ ctx.fillStyle="rgba(214,165,92,.25)";ctx.fillRect(0,0,W,H); }
  const vg=ctx.createRadialGradient(W/2,H/2,Math.min(W,H)*0.35,W/2,H/2,Math.max(W,H)*0.72);
  vg.addColorStop(0,"rgba(0,0,0,0)");vg.addColorStop(1,"rgba(2,4,16,.5)");
  ctx.fillStyle=vg;ctx.fillRect(0,0,W,H);
  if(hurtFlash>0){ctx.fillStyle=`rgba(255,0,0,${hurtFlash*0.5})`;ctx.fillRect(0,0,W,H);}
  if(player.o2<=25){ctx.fillStyle=`rgba(2,132,199,${0.10+Math.sin(elapsed*4)*0.05})`;ctx.fillRect(0,0,W,H);}
  drawMinimap();
}
function drawMinimap(){
  const S=128, Z=4;
  mctx.clearRect(0,0,S,S);
  mctx.save();
  mctx.beginPath(); mctx.arc(S/2,S/2,S/2-1,0,7); mctx.clip();
  const pcx=player?player.x/TILE:WORLD_W/2, pcy=player?player.y/TILE:WORLD_H/2;
  const img=mctx.createImageData(S,S);
  for(let y=0;y<S;y++)for(let x=0;x<S;x++){
    const dx=x-S/2, dy=y-S/2;
    let r=5,g=8,b=20;
    if(dx*dx+dy*dy<=(S/2)*(S/2)){
      const t=tileAt(Math.floor(pcx+dx/Z),Math.floor(pcy+dy/Z));
      const pal=P().pal, c=pal["t"+t]||pal.t2;
      r=c[0];g=c[1];b=c[2];
    }
    const i=(y*S+x)*4; img.data[i]=r;img.data[i+1]=g;img.data[i+2]=b;img.data[i+3]=255;
  }
  mctx.putImageData(img,0,0);
  if(mode==="surface"&&player){
    const dot=(wx,wy)=>[S/2+wdx(wx,player.x,WPX)/TILE*Z, S/2+wdx(wy,player.y,WPY)/TILE*Z];
    const inCircle=(sx,sy)=>{const dx=sx-S/2,dy=sy-S/2;return dx*dx+dy*dy<(S/2-2)*(S/2-2);};
    mctx.fillStyle="#f59e0b";
    for(const b of buildings){ const [sx,sy]=dot(b.tx*TILE+16,b.ty*TILE+16); if(inCircle(sx,sy)) mctx.fillRect(sx,sy,2,2); }
    mctx.fillStyle="#7dd3fc";
    for(const r of resources) if(r.kind==="amostra"){ const [sx,sy]=dot(r.tx*TILE+16,r.ty*TILE+16); if(inCircle(sx,sy)) mctx.fillRect(sx,sy,2,2); }
    mctx.fillStyle="#fff";
    mctx.fillRect(S/2-2,S/2-2,5,5);
  }
  mctx.restore();
  mctx.strokeStyle="rgba(255,255,255,.8)";mctx.lineWidth=2;
  mctx.beginPath();mctx.arc(S/2,S/2,S/2-1,0,7);mctx.stroke();
}

// ---------- input ----------
window.addEventListener("keydown",(e)=>{
  const k=e.key.toLowerCase();
  keys[k]=true;
  if(["tab"," "].includes(k)) e.preventDefault();
  if(!started){ if(k==="enter") startGame(false); return; }
  if(k==="e") doAction();
  if(k==="q") eatBest();
  if(k==="t") toggleTorch();
  if(k==="c") toggle("panel-craft");
  if(k==="b") toggle("panel-build");
  if(k==="m"){ toggle("panel-missions"); renderMissions(); }
  if(k==="h"||k==="escape") toggle("panel-help");
});
window.addEventListener("keyup",(e)=>{keys[e.key.toLowerCase()]=false;});
canvas.addEventListener("mousemove",(e)=>{const r=canvas.getBoundingClientRect();mouse.x=e.clientX-r.left;mouse.y=e.clientY-r.top;});
canvas.addEventListener("mousedown",(e)=>{
  if(mode!=="surface") return;
  if(e.button===2){buildMode=null;renderBuilds();return;}
  if(buildMode){
    const tx=wrap(Math.floor(wrap(mouse.wx,WPX)/TILE),WORLD_W), ty=wrap(Math.floor(wrap(mouse.wy,WPY)/TILE),WORLD_H);
    placeBuilding(buildMode,tx,ty,false);
    return;
  }
  const r=nearestResource(90);
  if(r) harvest(r);
});
canvas.addEventListener("contextmenu",(e)=>e.preventDefault());
function touchAngle(){
  if(touchMove.active && Math.hypot(touchMove.x,touchMove.y)>0.2)
    return Math.atan2(touchMove.y,touchMove.x);
  return null;
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
bindHold("t-act", ()=>doAction());
bindHold("t-eat", ()=>eatBest());
bindHold("t-torch", ()=>toggleTorch());
bindHold("t-mis", ()=>{toggle("panel-missions"); renderMissions();});
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
  if(mode!=="surface") return;
  const r=canvas.getBoundingClientRect();
  const t=e.changedTouches[0];
  mouse.wx=cam.x+(t.clientX-r.left)*(canvas.width/r.width/ZOOM);
  mouse.wy=cam.y+(t.clientY-r.top)*(canvas.height/r.height/ZOOM);
  if(buildMode){
    const tx=wrap(Math.floor(wrap(mouse.wx,WPX)/TILE),WORLD_W), ty=wrap(Math.floor(wrap(mouse.wy,WPY)/TILE),WORLD_H);
    placeBuilding(buildMode,tx,ty,false);
    return;
  }
  doAction();
},{passive:false});
$("context-tip").addEventListener("click",()=>doAction());
function toggle(id,force){
  const el=$(id); if(!el) return;
  const show=force!==undefined?force:el.classList.contains("hidden");
  if(show) el.classList.remove("hidden");
  else el.classList.add("hidden");
}
document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>$(b.dataset.close).classList.add("hidden"));
$("slot-eat").onclick=()=>eatBest();
$("slot-torch").onclick=()=>toggleTorch();
$("btn-craft").onclick=()=>toggle("panel-craft");
$("btn-build").onclick=()=>toggle("panel-build");
$("btn-craft2").onclick=()=>toggle("panel-craft");
$("btn-build2").onclick=()=>toggle("panel-build");
$("btn-act").onclick=()=>doAction();
$("btn-mis").onclick=()=>{toggle("panel-missions"); renderMissions();};
$("btn-info").onclick=()=>{
  if(mode==="surface"&&bodyId) showInfo(P());
  else toggle("panel-map",true);
};
$("btn-sound").onclick=(e)=>{audioOn=!audioOn;e.target.textContent=audioOn?"🔊":"🔇";};
$("link-help").onclick=(e)=>{e.preventDefault();toggle("panel-help");};
$("link-help2").onclick=(e)=>{e.preventDefault();toggle("panel-help");};
$("planet-chip").onclick=()=>{ if(mode==="ship"){ renderMap(); toggle("panel-map",true); } };
$("btn-keep").onclick=()=>{ document.querySelector("#screen-win").classList.add("hidden"); };
$("btn-speech").onclick=(e)=>{ speechOn=!speechOn; try{window.speechSynthesis.cancel();}catch(_){} e.target.textContent=speechOn?"voz: ligada":"voz: desligada"; toast(speechOn?"🔊 Voz ligada":"🔇 Voz desligada",1500); };

// ---------- início ----------
function startGame(useSave){
  document.querySelector("#screen-start").classList.add("hidden");
  document.querySelector("#screen-win").classList.add("hidden");
  gameOver=false;
  if(useSave){
    const s=load();
    if(s){
      started=true;
      pushComm("ARIA","Bom retorno, cadete! Sistemas ok. Para onde vamos?");
      if(s.mode==="surface"&&s.bodyId){ enterSurface(s.bodyId, s.px, s.py); }
      else shipScene();
      updateHUD(); updateMissionHUD();
      requestAnimationFrame(loop);
      return;
    }
  }
  state=newState();
  state.comms=[];
  pushComm("ARIA","Bip... Cadete, acorde! Sou a ARIA, a inteligência da Esperança. 1000 colonos dormem enquanto conversamos.");
  pushComm("Capitã Duarte","Bem-vindo a bordo! Escolha um planeta no mapa 🪐 e desça de carona. Aprenda tudo sobre ele e prepare abrigo, comida e energia. A humanidade conta com você!");
  pushComm("ARIA","Dica: o botão 🪐 mostra a ficha real de cada planeta. E eu adoro quiz de ciências! 🛰️");
  started=true;
  shipScene();
  updateHUD(); updateMissionHUD();
  requestAnimationFrame(loop);
}
function isMobileLayout(){
  return (window.matchMedia && window.matchMedia("(pointer:coarse)").matches);
}
function fitCanvas(){
  ZOOM = isMobileLayout()?1.6:2.2;
}
window.addEventListener("resize",fitCanvas);
window.addEventListener("load", ()=>{
  fitCanvas();
  const s=load();
  if(s&&s.unlocked) $("btn-continue").classList.remove("hidden");
  $("btn-start").onclick=()=>startGame(false);
  $("btn-continue").onclick=()=>startGame(true);
  $("btn-listen").onclick=()=>speak("Ano 2150. A nave Esperança levou mil colonos dormindo até o Sistema Solar. Você, cadete, foi acordado pela inteligência ARIA. Desça aos planetas, aprenda os segredos de cada um e prepare abrigo, comida e energia para os colonos. Siga a seta amarela!");
});

function updateContextTip(){
  const el=$("context-tip");
  if(!el||!player||player.dead||!started||mode!=="surface"){ if(el) el.classList.add("hidden"); return; }
  const ACT = IS_TOUCH ? "✋" : "<b>E</b>";
  if(nearestShuttle()){ el.innerHTML=`🛸 ${ACT} console: quiz, suprimentos, voltar`; el.classList.remove("hidden"); return; }
  if(nearestAntenna()){ el.innerHTML=bs().done?`📡 colônia pronta! 🎉`:`📡 ${ACT} chamar os colonos`; el.classList.remove("hidden"); return; }
  let bi=-1,bd=46;
  drops.forEach((d,i)=>{ if(wdist(player.x,player.y,d.x,d.y)<bd){bd=99;bi=i;} });
  if(bi>=0){ el.innerHTML=`✨ ${ACT} pegar ${itemName(drops[bi].item)}`; el.classList.remove("hidden"); return; }
  const f=nearestFauna(56);
  if(f){ el.innerHTML=`👽 ${ACT} escanear bichinho`; el.classList.remove("hidden"); return; }
  const r=nearestResource(56);
  if(r){
    const n={rocha:"🔩 metal",gelo:"💧 gelo",cristal:"🔩+💧",amostra:"🧪 amostra"};
    el.innerHTML=`${ACT} coletar ${n[r.kind]||""}`;
    el.classList.remove("hidden"); return;
  }
  for(const b of buildings){
    if(b.kind!=="estufa") continue;
    if(wdist(player.x,player.y,b.tx*TILE+16,b.ty*TILE+16)<56&&b.stock>0){
      el.innerHTML=`🍎 ${ACT} colher cultivo`; el.classList.remove("hidden"); return;
    }
  }
  el.classList.add("hidden");
}
