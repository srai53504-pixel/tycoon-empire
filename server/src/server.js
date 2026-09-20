import http from 'node:http';
import crypto from 'node:crypto';
import {URL} from 'node:url';
import {getDb,nextId,save} from './db.js';

const PORT=Number(process.env.PORT||8080), HOST=process.env.HOST||'0.0.0.0';
const ONLINE_MS=30000;
const BUSINESS_TYPES=[
  {type:'shop',name:'Retail Shop',price:10000,income:300},
  {type:'factory',name:'Factory',price:50000,income:1800},
  {type:'tech',name:'Tech Company',price:150000,income:6500},
  {type:'bank',name:'Private Bank',price:500000,income:24000}
];

function json(res,status,body){
  const out=JSON.stringify(body);
  res.writeHead(status,{
    'Content-Type':'application/json; charset=utf-8',
    'Content-Length':Buffer.byteLength(out),
    'Access-Control-Allow-Origin':'*',
    'Access-Control-Allow-Headers':'Content-Type, Authorization',
    'Access-Control-Allow-Methods':'GET,POST,OPTIONS'
  });res.end(out);
}
function readBody(req){return new Promise((resolve,reject)=>{let d='';req.on('data',c=>{d+=c;if(d.length>1000000)req.destroy()});req.on('end',()=>{if(!d)return resolve({});try{resolve(JSON.parse(d))}catch{resolve(Object.fromEntries(new URLSearchParams(d)))}});req.on('error',reject)})}
const hash=p=>crypto.createHash('sha256').update(String(p)).digest('hex');
const cleanEmail=x=>String(x||'').trim().toLowerCase();
const now=()=>Date.now();
const token=()=>crypto.randomBytes(24).toString('hex');
function auth(req){const t=(req.headers.authorization||'').replace(/^Bearer\s+/i,'');return getDb().sessions.find(s=>s.token===t)}
function me(req){const s=auth(req);return s?getDb().players.find(p=>p.id===s.playerId):null}
function pub(p){if(!p)return null;const {passwordHash,...x}=p;return x}
function playerRanks(){return [...getDb().players].sort((a,b)=>(b.netWorth||0)-(a.netWorth||0)).map((p,i)=>({rank:i+1,...pub(p)}))}
function companyRanks(){return [...getDb().companies].sort((a,b)=>(b.value||0)-(a.value||0)).map((c,i)=>({rank:i+1,...c}))}
function onlinePlayers(){const cutoff=now()-ONLINE_MS;return getDb().players.filter(p=>(p.lastActive||0)>=cutoff).map(p=>({id:p.id,username:p.username,country:p.country,netWorth:p.netWorth||0})).sort((a,b)=>b.netWorth-a.netWorth)}
function addEvent(type,message,playerId=null){const db=getDb();db.events ||= [];db.events.push({id:nextId('event'),type,message,playerId,createdAt:now()});if(db.events.length>200)db.events=db.events.slice(-200);save()}
function ensureDb(){const db=getDb();db.events ||= [];db.counters ||= {};for(const k of ['player','company','business','contract','alliance','war','chat','event'])db.counters[k] ||= 1;for(const p of db.players){p.lastActive ||= 0;p.netWorth ??= p.money ?? 0;p.money ??= 0;p.army ??= 0;p.country ||= 'IN';}for(const b of db.businesses){b.incomePerCycle=Number(b.incomePerCycle||0);b.lastCollected ||= b.createdAt||now();}save()}
function accrue(player){
  const db=getDb();let total=0;const t=now();
  for(const b of db.businesses.filter(x=>x.ownerId===player.id)){
    const rate=Math.max(0,Number(b.incomePerCycle)||0);
    const elapsed=Math.max(0,t-(b.lastIncomeAt||b.createdAt||t));
    const cycles=Math.floor(elapsed/60000);
    if(cycles>0){const gain=rate*cycles;player.money+=gain;player.netWorth+=gain;b.lastIncomeAt=(b.lastIncomeAt||b.createdAt||t)+cycles*60000;total+=gain;}
  }
  if(total) save();
  return total;
}

async function route(req,res){
  const u=new URL(req.url,`http://${req.headers.host}`),p=u.pathname,m=req.method,b=await readBody(req),db=getDb();
  if(m==='OPTIONS')return json(res,200,{ok:true});
  if(m==='GET'&&p==='/health')return json(res,200,{ok:true,service:'tycoon-private-server',version:'0.3.0',time:now(),online:onlinePlayers().length});

  if(m==='POST'&&p==='/api/auth/register'){
    const email=cleanEmail(b.email),password=String(b.password||''),username=String(b.username||email.split('@')[0]).trim().slice(0,32),country=String(b.country||'IN').trim().slice(0,3).toUpperCase(),companyName=String(b.company_name||b.companyName||`${username} Industries`).trim().slice(0,64);
    if(!email||password.length<4)return json(res,400,{ok:false,error:'email and password (4+ chars) required'});
    if(db.players.some(x=>x.email===email))return json(res,409,{ok:false,error:'account exists'});
    if(db.players.some(x=>x.username?.toLowerCase()===username.toLowerCase()))return json(res,409,{ok:false,error:'username already exists'});
    const id=nextId('player'),pl={id,email,username,country,companyId:null,allianceId:null,money:100000,netWorth:100000,army:0,createdAt:now(),lastActive:now(),passwordHash:hash(password)};
    db.players.push(pl);const c={id:nextId('company'),ownerId:id,name:companyName,value:100000,cash:100000,level:1,patriotism:0,createdAt:now()};db.companies.push(c);pl.companyId=c.id;
    const t=token();db.sessions.push({token:t,playerId:id,createdAt:now()});save();addEvent('join',`${username} joined the empire` ,id);
    return json(res,201,{ok:true,token:t,player:pub(pl),company:c});
  }
  if(m==='POST'&&p==='/api/auth/login'){
    const email=cleanEmail(b.email),pl=db.players.find(x=>x.email===email);if(!pl||pl.passwordHash!==hash(b.password||''))return json(res,401,{ok:false,error:'invalid credentials'});
    pl.lastActive=now();const t=token();db.sessions.push({token:t,playerId:pl.id,createdAt:now()});save();return json(res,200,{ok:true,token:t,player:pub(pl)});
  }
  if(m==='POST'&&p==='/api/auth/logout'){const s=auth(req);if(s){const pl=db.players.find(x=>x.id===s.playerId);if(pl)pl.lastActive=0}const t=(req.headers.authorization||'').replace(/^Bearer\s+/i,'');db.sessions=db.sessions.filter(s=>s.token!==t);save();return json(res,200,{ok:true})}

  if(p.startsWith('/api/')&&!me(req)&&!['/api/rankings/global','/api/rankings/company','/api/players/online','/api/events','/api/businesses/catalog'].includes(p))return json(res,401,{ok:false,error:'authentication required'});
  const player=me(req);
  if(player){player.lastActive=now();accrue(player);}

  if(m==='GET'&&p==='/api/players/me')return json(res,200,{ok:true,player:pub(player),company:db.companies.find(c=>c.id===player.companyId)||null,alliance:db.alliances.find(a=>a.id===player.allianceId)||null});
  if(m==='POST'&&p==='/api/players/me'){if(b.country!==undefined)player.country=String(b.country).trim().slice(0,3).toUpperCase();if(b.username!==undefined){const u2=String(b.username).trim().slice(0,32);if(u2.length<2)return json(res,400,{ok:false,error:'username too short'});if(db.players.some(x=>x.id!==player.id&&x.username.toLowerCase()===u2.toLowerCase()))return json(res,409,{ok:false,error:'username already exists'});player.username=u2}save();return json(res,200,{ok:true,player:pub(player)})}
  if(m==='GET'&&p==='/api/players/online')return json(res,200,{ok:true,count:onlinePlayers().length,players:onlinePlayers()});

  if(m==='POST'&&p==='/api/heartbeat'){player.lastActive=now();save();return json(res,200,{ok:true,serverTime:now(),online:onlinePlayers().length})}

  if(m==='POST'&&p==='/api/companies'){if(player.companyId)return json(res,409,{ok:false,error:'player already owns a company'});const name=String(b.name||'Company').trim().slice(0,64);if(name.length<2)return json(res,400,{ok:false,error:'company name too short'});if(db.companies.some(x=>x.name.toLowerCase()===name.toLowerCase()))return json(res,409,{ok:false,error:'company name already exists'});const c={id:nextId('company'),ownerId:player.id,name,value:100000,cash:100000,level:1,patriotism:0,createdAt:now()};db.companies.push(c);player.companyId=c.id;save();addEvent('company',`${player.username} created ${name}`,player.id);return json(res,201,{ok:true,company:c})}
  if(m==='GET'&&p.startsWith('/api/companies/')){const c=db.companies.find(x=>x.id===Number(p.split('/').pop()));return c?json(res,200,{ok:true,company:c}):json(res,404,{ok:false,error:'company not found'})}
  if(m==='POST'&&/^\/api\/companies\/\d+\/upgrade$/.test(p)){const c=db.companies.find(x=>x.id===Number(p.split('/')[3]));if(!c||c.ownerId!==player.id)return json(res,403,{ok:false,error:'not owner'});const cost=c.level*25000;if(c.cash<cost||player.money<cost)return json(res,400,{ok:false,error:'insufficient cash'});c.cash-=cost;player.money-=cost;c.level++;c.value+=cost*2;player.netWorth=Math.max(player.netWorth,c.value+player.money);save();addEvent('company',`${player.username} upgraded ${c.name} to level ${c.level}`,player.id);return json(res,200,{ok:true,company:c,player:pub(player)})}

  if(m==='GET'&&p==='/api/businesses/catalog')return json(res,200,{ok:true,businesses:BUSINESS_TYPES});
  if(m==='GET'&&p==='/api/businesses')return json(res,200,{ok:true,businesses:db.businesses.filter(x=>x.ownerId===player.id)});
  if(m==='POST'&&p==='/api/businesses/buy'){
    const type=String(b.type||'shop');const spec=BUSINESS_TYPES.find(x=>x.type===type);if(!spec)return json(res,400,{ok:false,error:'unknown business type'});if(player.money<spec.price)return json(res,400,{ok:false,error:'insufficient funds'});
    const x={id:nextId('business'),ownerId:player.id,name:spec.name,type:spec.type,purchasePrice:spec.price,incomePerCycle:spec.income,createdAt:now(),lastIncomeAt:now()};player.money-=spec.price;db.businesses.push(x);player.netWorth=Math.max(player.netWorth,player.money+db.companies.find(c=>c.id===player.companyId)?.value||player.netWorth);save();addEvent('business',`${player.username} bought a ${spec.name}`,player.id);return json(res,201,{ok:true,business:x,player:pub(player)})
  }
  if(m==='POST'&&p==='/api/businesses/collect'){const total=accrue(player);return json(res,200,{ok:true,collected:total,player:pub(player)})}
  if(m==='POST'&&p==='/api/businesses/sell'){const x=db.businesses.find(x=>x.id===Number(b.id)&&x.ownerId===player.id);if(!x)return json(res,404,{ok:false,error:'business not found'});const refund=Math.floor(x.purchasePrice*.8);player.money+=refund;db.businesses=db.businesses.filter(y=>y!==x);save();addEvent('business',`${player.username} sold a ${x.name}`,player.id);return json(res,200,{ok:true,refund,player:pub(player)})}

  if(m==='POST'&&p==='/api/contracts'){const x={id:nextId('contract'),ownerId:player.id,title:String(b.title||'Contract'),reward:Number(b.reward||5000),status:'running',createdAt:now()};db.contracts.push(x);save();return json(res,201,{ok:true,contract:x})}
  if(m==='GET'&&p==='/api/contracts')return json(res,200,{ok:true,contracts:db.contracts});
  if(m==='POST'&&p==='/api/alliances'){const name=String(b.name||'Alliance').trim().slice(0,64);if(db.alliances.some(a=>a.name.toLowerCase()===name.toLowerCase()))return json(res,409,{ok:false,error:'alliance name exists'});const a={id:nextId('alliance'),name,leaderId:player.id,createdAt:now()};db.alliances.push(a);db.allianceMembers.push({allianceId:a.id,playerId:player.id,role:'leader'});player.allianceId=a.id;save();addEvent('alliance',`${player.username} founded ${name}`,player.id);return json(res,201,{ok:true,alliance:a})}
  if(m==='POST'&&p==='/api/alliances/join'){const a=db.alliances.find(x=>x.id===Number(b.allianceId));if(!a)return json(res,404,{ok:false,error:'alliance not found'});if(!db.allianceMembers.some(x=>x.allianceId===a.id&&x.playerId===player.id))db.allianceMembers.push({allianceId:a.id,playerId:player.id,role:'member'});player.allianceId=a.id;save();addEvent('alliance',`${player.username} joined ${a.name}`,player.id);return json(res,200,{ok:true,alliance:a})}
  if(m==='GET'&&p==='/api/alliances')return json(res,200,{ok:true,alliances:db.alliances,members:db.allianceMembers});

  if(m==='POST'&&p==='/api/chat'){const text=String(b.text??b.message??'').trim().slice(0,500);if(!text)return json(res,400,{ok:false,error:'message required'});const x={id:nextId('chat'),playerId:player.id,username:player.username,text,createdAt:now()};db.chat.push(x);if(db.chat.length>200)db.chat=db.chat.slice(-200);save();return json(res,201,{ok:true,message:x})}
  if(m==='GET'&&p==='/api/chat')return json(res,200,{ok:true,messages:db.chat.slice(-100)});
  if(m==='GET'&&p==='/api/events')return json(res,200,{ok:true,events:(db.events||[]).slice(-50).reverse()});

  if(m==='GET'&&p==='/api/rankings/global')return json(res,200,{ok:true,players:playerRanks()});
  if(m==='GET'&&p==='/api/rankings/company')return json(res,200,{ok:true,companies:companyRanks()});
  if(m==='GET'&&p==='/api/rankings/country'){const c=String(u.searchParams.get('country')||'');return json(res,200,{ok:true,players:playerRanks().filter(x=>!c||x.country===c)})}
  if(m==='POST'&&p==='/api/wars'){const target=Number(b.targetPlayerId||0);const targetPlayer=db.players.find(x=>x.id===target);if(!targetPlayer||target===player.id)return json(res,400,{ok:false,error:'valid target player required'});const w={id:nextId('war'),attackerId:player.id,targetPlayerId:target,status:'pending',score:0,createdAt:now()};db.wars.push(w);save();addEvent('war',`${player.username} challenged ${targetPlayer.username}`,player.id);return json(res,201,{ok:true,war:w})}
  if(m==='GET'&&p==='/api/wars')return json(res,200,{ok:true,wars:db.wars});
  return json(res,404,{ok:false,error:'unknown endpoint',method:m,path:p});
}
ensureDb();
http.createServer((req,res)=>route(req,res).catch(e=>json(res,500,{ok:false,error:String(e.message||e)}))).listen(PORT,HOST,()=>console.log(`Tycoon multiplayer server v0.3 listening on http://${HOST}:${PORT}`));
