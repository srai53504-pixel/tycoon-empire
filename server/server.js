const express=require("express"), cors=require("cors"), fs=require("fs"), path=require("path");
const bcrypt=require("bcryptjs"), jwt=require("jsonwebtoken");
const app=express(); app.use(cors()); app.use(express.json());
const PORT=process.env.PORT||8080, SECRET=process.env.JWT_SECRET||"change-this-secret";
const DB=path.join(__dirname,"data.json");

const catalog={
 business:[
  ["Pub",200,"Leisure"],["Dance club",220,"Leisure"],["Coffee shop",150,"Leisure"],["Restaurant",220,"Leisure"],
  ["Movie theater",350,"Leisure"],["Mall",500,"Commerce"],["Clothes shop",150,"Commerce"],
  ["Supermarket",250,"Commerce"],["Fast food",150,"Commerce"]
 ],
 transportation:[
  ["Taxi",100,"Ground lines"],["Bus",150,"Ground lines"],["Train",250,"Ground lines"],
  ["VIP Limousines",500,"Ground lines"],["Passengers plane",800,"Air lines"],["Cargo plane",850,"Air lines"]
 ],
 concessions:[
  ["Ground Transport",25000],["Commerce",30000],["Leisure",75000],["Air Lines",150000],["Sea Lines",400000],
  ["Real Estate",800000],["War Industry",1000000],["Space",2000000],["Robotics",5000000],
  ["Nuclear",10000000],["Advanced war",50000000]
 ],
 resources:[["Salt",93],["Iron",157],["Aluminum",30],["Copper",202],["Silver",242],["Oil",588],["Gold",201],["Diamonds",286],["Gems",880]],
 subsidiaries:[
  ["Mining company",15000],["Traveling company",45000],["Soccer team",30000],["Brokerage company",300000],
  ["Army experiments",150000],["Robotics program",350000],["Nuclear program",500000],
  ["Advanced medical",35,"gold"],["Space center",35,"gold"]
 ],
 products:[
  ["Spa Products",3025],["Silverware",6490],["Remote Control Cars",7150],["Gold Plated Watch",9185],
  ["Iron Furniture's",8992],["Cameras",10835],["Diamonds Jewelery",44000],["Gemstones",29150],
  ["luxury-jewelry",44000],["Computers",28875],["Smart-phones",24420],["Gaming Consoles",25575],
  ["Family Cars",40425],["Sports Cars",49280],["Advanced Tactical Weapons",67100],["Armored Vehicles",66550]
 ]
};

function load(){if(!fs.existsSync(DB)) fs.writeFileSync(DB,JSON.stringify({users:[],assets:[],messages:[],alliances:[],contracts:[],wars:[],sites:[]},null,2));return JSON.parse(fs.readFileSync(DB));}
function save(db){fs.writeFileSync(DB,JSON.stringify(db,null,2));}
function auth(req,res,next){try{let h=req.headers.authorization||"";let t=h.replace("Bearer ","");req.user=jwt.verify(t,SECRET);next();}catch(e){res.status(401).json({error:"Unauthorized"});}}
function id(){return Math.random().toString(36).slice(2)+Date.now().toString(36);}
function money(v){return Math.max(0,Math.floor(v));}

app.get("/health",(req,res)=>res.json({ok:true,service:"Entrepreneur Empire",time:new Date().toISOString()}));

app.post("/api/auth/register",async(req,res)=>{
 const db=load(),u=String(req.body.username||"").trim(),p=String(req.body.password||"");
 if(u.length<3||p.length<4)return res.status(400).json({error:"Invalid username/password"});
 if(db.users.some(x=>x.username.toLowerCase()===u.toLowerCase()))return res.status(409).json({error:"Username already exists"});
 const user={id:id(),username:u,password:await bcrypt.hash(p,10),cash:10000,gold:10,level:1,createdAt:Date.now(),lastIncome:Date.now()};
 db.users.push(user);save(db);
 res.json({token:jwt.sign({id:user.id,username:user.username},SECRET),user:{id:user.id,username:u,cash:user.cash,gold:user.gold,level:user.level}});
});

app.post("/api/auth/login",async(req,res)=>{
 const db=load(),u=db.users.find(x=>x.username===req.body.username);
 if(!u||!(await bcrypt.compare(String(req.body.password||""),u.password)))return res.status(401).json({error:"Invalid credentials"});
 res.json({token:jwt.sign({id:u.id,username:u.username},SECRET),user:{id:u.id,username:u.username,cash:u.cash,gold:u.gold,level:u.level}});
});

app.get("/api/players/me",auth,(req,res)=>{let u=load().users.find(x=>x.id===req.user.id);if(!u)return res.status(404).json({error:"Player not found"});res.json({...u,password:undefined});});
app.get("/api/players/online",auth,(req,res)=>res.json({players:load().users.map(u=>({id:u.id,username:u.username,level:u.level})),online:true}));

function income(db,u){
 const owned=db.assets.filter(a=>a.userId===u.id);
 return owned.reduce((s,a)=>s+(a.income||0),0);
}
app.post("/api/assets/buy",auth,(req,res)=>{
 const db=load(),u=db.users.find(x=>x.id===req.user.id),name=String(req.body.assetName||"");
 let item=null,cat=String(req.body.category||"");
 for(const k of Object.keys(catalog)){const f=catalog[k].find(x=>x[0]===name);if(f){item=f;cat=k;break;}}
 if(!item)return res.status(404).json({error:"Asset not found"});
 const price=Number(item[1]); if(!Number.isFinite(price))return res.status(400).json({error:"Item requires an unlock/concession"});
 if(u.cash<price)return res.status(400).json({error:"Not enough cash"});
 u.cash-=price; db.assets.push({id:id(),userId:u.id,name,category:cat,price,income:Math.max(1,Math.floor(price*0.05)),ownedAt:Date.now()}); save(db);
 res.json({ok:true,cash:u.cash,asset:name});
});

app.post("/api/assets/collect",auth,(req,res)=>{
 const db=load(),u=db.users.find(x=>x.id===req.user.id);if(!u)return res.status(404).json({error:"Player not found"});
 const now=Date.now(),cycle=60000,elapsed=Math.floor((now-u.lastIncome)/cycle);
 const inc=income(db,u)*Math.max(0,elapsed);
 if(inc>0){u.cash+=inc;u.lastIncome+=elapsed*cycle;save(db);}
 res.json({ok:true,amount:inc,cash:u.cash});
});

app.post("/api/assets/sell",auth,(req,res)=>{
 const db=load(),u=db.users.find(x=>x.id===req.user.id),a=db.assets.find(x=>x.id===req.body.assetId&&x.userId===u.id);
 if(!a)return res.status(404).json({error:"Asset not found"});
 u.cash+=Math.floor(a.price*0.7);db.assets=db.assets.filter(x=>x!==a);save(db);res.json({ok:true,cash:u.cash});
});

app.get("/api/assets",auth,(req,res)=>{
 const db=load(),u=db.users.find(x=>x.id===req.user.id);
 res.json({catalog,owned:db.assets.filter(a=>a.userId===u.id)});
});

app.get("/api/rankings",auth,(req,res)=>{
 const db=load();res.json(db.users.map(u=>({username:u.username,level:u.level,cash:u.cash,worth:u.cash+db.assets.filter(a=>a.userId===u.id).reduce((s,a)=>s+a.price,0)})).sort((a,b)=>b.worth-a.worth));
});

app.get("/api/alliances",auth,(req,res)=>res.json(load().alliances));
app.post("/api/alliances",auth,(req,res)=>{const db=load();let a={id:id(),name:String(req.body.name||"Alliance"),owner:req.user.id,members:[req.user.id]};db.alliances.push(a);save(db);res.json(a);});
app.get("/api/chat",auth,(req,res)=>res.json(load().messages.slice(-100)));
app.post("/api/chat",auth,(req,res)=>{const db=load();let m={id:id(),userId:req.user.id,username:req.user.username,text:String(req.body.text||"").slice(0,500),time:Date.now()};db.messages.push(m);save(db);res.json(m);});
app.get("/api/contracts",auth,(req,res)=>res.json(load().contracts));
app.get("/api/contracts/running",auth,(req,res)=>res.json(load().contracts.filter(x=>x.status==="running")));
app.get("/api/contracts/bids/ranking",auth,(req,res)=>res.json([]));
app.get("/api/army",auth,(req,res)=>{const db=load();res.json(db.assets.filter(a=>a.userId===req.user.id&&a.category==="army"));});
app.post("/api/army/upgrade",auth,(req,res)=>res.json({ok:true,message:"Army upgrade queued"}));
app.get("/api/wars",auth,(req,res)=>res.json(load().wars));
app.get("/api/world/sites",auth,(req,res)=>res.json(load().sites));
app.post("/api/world/sites/claim",auth,(req,res)=>{const db=load();let s=db.sites.find(x=>x.id===req.body.siteId);if(!s)return res.status(404).json({error:"Site not found"});s.owner=req.user.id;save(db);res.json(s);});

app.listen(PORT,()=>console.log("Entrepreneur Empire server listening on "+PORT));
