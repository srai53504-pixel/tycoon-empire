const http=require('http'),crypto=require('crypto');
const PORT=process.env.PORT||10000;
const db={players:[],assets:[],sites:[],contracts:[],bids:[],alliances:[],allianceMembers:[],wars:[],chat:[],events:[],loans:[],stocks:[],research:[],missions:[],projects:[],locations:[],sessions:{},next:1};
const catalog=[
['business','Pub',50000,350],['business','Coffee Shop',75000,550],['business','Restaurant',150000,1100],['business','Movie Theater',300000,2100],['business','Mall',1000000,7500],
['transport','Taxi',20000,180],['transport','Bus',80000,600],['transport','Train',500000,4200],['transport','VIP Limousine',250000,1900],['transport','Passenger Plane',5000000,42000],['transport','Cargo Plane',7000000,55000],
['concessions','Ground Transport',1000000,7000],['concessions','Commerce',2000000,14000],['concessions','Leisure',2500000,18000],['concessions','Air Lines',10000000,70000],['concessions','Sea Lines',12000000,85000],
['properties','Office Tower',5000000,35000],['properties','Hotel',8000000,60000],['properties','Industrial Park',15000000,120000],
['subsidiaries','Mining Company',20000000,150000],['subsidiaries','Traveling Company',12000000,90000],['subsidiaries','Soccer Team',18000000,110000],['subsidiaries','Brokerage Company',25000000,170000],['subsidiaries','Robotics Program',30000000,200000],
['resources','Oil Reserve',4000000,28000],['resources','Gold Mine',6000000,42000],['resources','Gem Mine',9000000,65000],
['research','Business AI',3000000,0],['research','Advanced Logistics',5000000,0],['research','Robotics',12000000,0],
['production','Food Factory',5000000,38000],['production','Vehicle Factory',15000000,110000],['production','Electronics Factory',30000000,230000],
['stocks','Blue Chip Portfolio',1000000,12000],['stocks','Tech Portfolio',3000000,38000],
['investments','Startup Fund',5000000,50000],['investments','Football Investment',7000000,60000],
['projects','Nuclear Plant',50000000,400000],['projects','Underground Hotel',35000000,260000]
];
catalog.forEach((x,i)=>db.assets.push({id:i+1,category:x[0],type:x[1],price:x[2],income:x[3],description:'Purchase and operate '+x[1]}));
[['Peru Copper','Peru','Copper',1200],['Brazil Iron','Brazil','Iron',1600],['Indonesia Nickel','Indonesia','Nickel',1100],['Australia Gold','Australia','Gold',700],['Canada Timber','Canada','Timber',900],['South Africa Platinum','South Africa','Platinum',500],['Chile Lithium','Chile','Lithium',1300],['India Bauxite','India','Bauxite',1000]].forEach((x,i)=>db.sites.push({id:i+1,name:x[0],country:x[1],resource:x[2],rate:x[3],ownerId:null}));
for(let i=0;i<12;i++)db.contracts.push({id:i+1,name:['Natural Resources','Transportation','Real Estate','Manufacturing'][i%4]+' Contract #'+(i+1),country:['Indonesia','Mexico','India','Brazil'][i%4],quantity:1000+i*500,marketValue:500000+i*250000,status:'open'});
function hash(s){return crypto.createHash('sha256').update(s).digest('hex')}
function token(){return crypto.randomBytes(24).toString('hex')}
function body(req){return new Promise((res,rej)=>{let s='';req.on('data',c=>s+=c);req.on('end',()=>{try{res(s?JSON.parse(s):{})}catch(e){res({})}})})}
function send(res,code,obj){res.writeHead(code,{'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type, Authorization','Access-Control-Allow-Methods':'GET,POST,OPTIONS'});res.end(JSON.stringify(obj))}
function auth(req){let h=req.headers.authorization||'',t=h.startsWith('Bearer ')?h.slice(7):'';return db.sessions[t]?db.players.find(p=>p.id===db.sessions[t]):null}
function playerView(p){return {...p,companyWorth:p.cash+db.assets.filter(a=>a.ownerId===p.id).reduce((s,a)=>s+a.price*a.quantity,0)}}
function requireP(req,res){let p=auth(req);if(!p){send(res,401,{error:'authentication required'});return null}return p}
function route(req,res,method,path,b){if(method==='OPTIONS')return send(res,204,{});
if(method==='GET'&&path==='/health')return send(res,200,{ok:true,version:'1.0.0',features:['assets','mining','map','army','wars','contracts','alliances','chat','stocks','research','loans','projects']});
if(method==='POST'&&path==='/api/auth/register'){if(db.players.some(p=>p.email===b.email))return send(res,409,{error:'account exists'});let p={id:db.next++,email:b.email,password:hash(b.password||''),username:b.username||'player',companyName:b.companyName||'My Company',country:b.country||'IN',cash:100000,gold:100,level:1,offensiveLevel:1,defense:100};db.players.push(p);let t=token();db.sessions[t]=p.id;return send(res,200,{token:t,player:playerView(p)})}
if(method==='POST'&&path==='/api/auth/login'){let p=db.players.find(x=>x.email===b.email&&x.password===hash(b.password||''));if(!p)return send(res,401,{error:'invalid credentials'});let t=token();db.sessions[t]=p.id;return send(res,200,{token:t,player:playerView(p)})}
if(method==='POST'&&path==='/api/auth/logout'){let p=auth(req);for(const t of Object.keys(db.sessions))if(db.sessions[t]===p?.id)delete db.sessions[t];return send(res,200,{ok:true})}
let p=requireP(req,res);if(!p)return;
if(method==='GET'&&path==='/api/players/me')return send(res,200,{player:playerView(p)});
if(method==='GET'&&path==='/api/players/online')return send(res,200,{players:db.players.map(playerView)});
if(method==='GET'&&path.startsWith('/api/assets')){let q=new URL('http://x'+path).searchParams.get('category');let a=db.assets.filter(x=>!x.ownerId&&( !q||x.category===q)).map(x=>({...x}));let owned=db.assets.filter(x=>x.ownerId===p.id);return send(res,200,{assets:[...a,...owned.map(x=>({...x,owned:true}))]})}
if(method==='POST'&&path==='/api/assets/buy'){let item=db.assets.find(x=>x.type===b.type&&!x.ownerId);let q=Math.max(1,Math.min(100000,Number(b.quantity)||1));if(!item)return send(res,404,{error:'asset not found'});let cost=item.price*q;if(p.cash<cost)return send(res,400,{error:'insufficient cash'});p.cash-=cost;let own=db.assets.find(x=>x.ownerId===p.id&&x.type===item.type);if(own)own.quantity+=q;else db.assets.push({...item,id:db.next++,ownerId:p.id,quantity:q});return send(res,200,{ok:true,cash:p.cash})}
if(method==='POST'&&path==='/api/assets/collect'){let inc=db.assets.filter(x=>x.ownerId===p.id).reduce((s,x)=>s+x.income*x.quantity,0);p.cash+=inc;return send(res,200,{income:inc,cash:p.cash})}
if(method==='GET'&&path==='/api/world/sites')return send(res,200,{sites:db.sites});
if(method==='POST'&&path==='/api/world/sites/claim'){let s=db.sites.find(x=>x.id===Number(b.siteId));if(!s)return send(res,404,{error:'site not found'});if(s.ownerId&&s.ownerId!==p.id)return send(res,409,{error:'site owned'});if(p.cash<100000)return send(res,400,{error:'need $100,000 claim fee'});p.cash-=100000;s.ownerId=p.id;return send(res,200,{ok:true,site:s,cash:p.cash})}
if(method==='GET'&&path==='/api/army'){return send(res,200,{army:{ground:p.ground||0,air:p.air||0,defense:p.defense||100,offensiveLevel:p.offensiveLevel||1}})}
if(method==='POST'&&path==='/api/army/upgrade'){let q=Math.max(1,Math.min(100000,Number(b.quantity)||100)),cost=q*500;if(p.cash<cost)return send(res,400,{error:'insufficient cash'});p.cash-=cost;p.ground=(p.ground||0)+q;p.defense=(p.defense||100)+q;return send(res,200,{ok:true,army:{ground:p.ground,air:p.air||0,defense:p.defense,offensiveLevel:p.offensiveLevel||1},cash:p.cash})}
if(method==='POST'&&path==='/api/wars'){let target=db.players.find(x=>x.id===Number(b.targetPlayerId));if(!target||target.id===p.id)return send(res,400,{error:'invalid target'});let atk=(p.offensiveLevel||1)*100+(p.ground||0)+(p.air||0),def=(target.defense||100)+(target.ground||0)+(target.air||0),win=atk>=def*(0.8+Math.random()*0.4);if(win){p.offensiveLevel=(p.offensiveLevel||1)+1;target.cash=Math.max(0,target.cash-Math.min(target.cash,Math.floor(target.cash*.03)));}let w={id:db.next++,attackerId:p.id,targetId:target.id,win,attackPower:atk,defensePower:def,createdAt:Date.now()};db.wars.push(w);return send(res,200,{result:{win,message:win?'Victory! Offensive level increased.':'Defeat. Rebuild your army.'},war:w,army:{offensiveLevel:p.offensiveLevel}})}
if(method==='GET'&&path==='/api/contracts')return send(res,200,{contracts:db.contracts.filter(x=>x.status==='open')});
if(method==='POST'&&path==='/api/contracts/bid'){let c=db.contracts.find(x=>x.id===Number(b.contractId)&&x.status==='open');if(!c)return send(res,404,{error:'contract unavailable'});let existing=db.bids.find(x=>x.contractId===c.id&&x.playerId===p.id);if(existing)return send(res,409,{error:'already bid'});if(p.cash<c.marketValue*.05)return send(res,400,{error:'5% bid deposit required'});p.cash-=c.marketValue*.05;db.bids.push({id:db.next++,contractId:c.id,playerId:p.id});if(db.bids.filter(x=>x.contractId===c.id).length>=2){let bids=db.bids.filter(x=>x.contractId===c.id),winner=bids[Math.floor(Math.random()*bids.length)];c.status='won';c.winnerId=winner.playerId;if(winner.playerId===p.id)p.cash+=c.marketValue}else{}return send(res,200,{ok:true,contract:c})}
if(method==='GET'&&path==='/api/alliances')return send(res,200,{alliances:db.alliances});
if(method==='POST'&&path==='/api/alliances'){let a={id:db.next++,name:b.name||'Alliance',ownerId:p.id,members:[p.id]};db.alliances.push(a);return send(res,200,{alliance:a})}
if(method==='POST'&&path==='/api/alliances/join'){let a=db.alliances.find(x=>x.id===Number(b.allianceId));if(!a)return send(res,404,{error:'alliance not found'});if(!a.members.includes(p.id))a.members.push(p.id);return send(res,200,{alliance:a})}
if(method==='GET'&&path==='/api/chat')return send(res,200,{messages:db.chat.slice(-100)});
if(method==='POST'&&path==='/api/chat'){db.chat.push({id:db.next++,playerId:p.id,username:p.username,message:String(b.message||'').slice(0,500),at:Date.now()});return send(res,200,{ok:true})}
if(method==='GET'&&path==='/api/rankings/global')return send(res,200,{rankings:db.players.map(playerView).sort((a,b)=>b.companyWorth-a.companyWorth)});
if(method==='GET'&&path==='/api/world/companies')return send(res,200,{companies:db.players.map(x=>({id:x.id,username:x.username,companyName:x.companyName,country:x.country,lat:x.lat||20,lng:x.lng||78}))});
if(method==='GET'&&path==='/api/world/company-location')return send(res,200,{location:{lat:p.lat||20,lng:p.lng||78}});
if(method==='POST'&&path==='/api/world/company-location'){let lat=Number(b.lat),lng=Number(b.lng);if(!Number.isFinite(lat)||!Number.isFinite(lng)||lat<-90||lat>90||lng<-180||lng>180)return send(res,400,{error:'invalid coordinates'});p.lat=lat;p.lng=lng;return send(res,200,{ok:true,location:{lat,lng}})}
if(method==='GET'&&path==='/api/missions')return send(res,200,{missions:[{id:1,name:'First Business',reward:25000,done:db.assets.some(a=>a.ownerId===p.id)},{id:2,name:'First Mining Site',reward:50000,done:db.sites.some(s=>s.ownerId===p.id)}]});
if(method==='GET'&&path==='/api/loans')return send(res,200,{loans:db.loans.filter(x=>x.playerId===p.id)});
if(method==='POST'&&path==='/api/loans'){let amount=Math.max(10000,Math.min(10000000,Number(b.amount)||10000));let due=amount*1.1;let l={id:db.next++,playerId:p.id,amount,due,createdAt:Date.now(),paid:false};db.loans.push(l);p.cash+=amount;return send(res,200,{loan:l,cash:p.cash})}
if(method==='POST'&&path==='/api/loans/repay'){let l=db.loans.find(x=>x.id===Number(b.loanId)&&x.playerId===p.id&&!x.paid);if(!l)return send(res,404,{error:'loan not found'});if(p.cash<l.due)return send(res,400,{error:'insufficient cash'});p.cash-=l.due;l.paid=true;return send(res,200,{ok:true,cash:p.cash})}
if(method==='GET'&&path==='/api/events')return send(res,200,{events:db.events.slice(-100)});
return send(res,404,{error:'endpoint not found'})}
const srv=http.createServer(async(req,res)=>{try{let b=await body(req);route(req,res,req.method,req.url.split('?')[0],b)}catch(e){send(res,500,{error:e.message})}});
srv.listen(PORT,()=>console.log('Empire Manager server '+PORT));
