const http=require("http");
const crypto=require("crypto");
const {Pool}=require("pg");

const PORT=Number(process.env.PORT||8080);
if(!process.env.DATABASE_URL){console.error("DATABASE_URL is missing.");process.exit(1);}
const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false}});

function send(res,status,obj){const s=JSON.stringify(obj);res.writeHead(status,{"Content-Type":"application/json","Content-Length":Buffer.byteLength(s)});res.end(s);}
function body(req){return new Promise((resolve,reject)=>{let s="";req.on("data",c=>s+=c);req.on("end",()=>{try{resolve(s?JSON.parse(s):{})}catch(e){reject(e)}});req.on("error",reject)})}
function hash(x){return crypto.createHash("sha256").update(String(x)).digest("hex")}
async function q(sql,p=[]){return pool.query(sql,p)}
async function init(){
 await q(`CREATE TABLE IF NOT EXISTS players(
 id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, email TEXT,
 password_hash TEXT, company_name TEXT NOT NULL DEFAULT 'My Company',
 country_id TEXT NOT NULL DEFAULT 'india', level INTEGER NOT NULL DEFAULT 1,
 xp BIGINT NOT NULL DEFAULT 0, cash NUMERIC NOT NULL DEFAULT 100000,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
 await q(`CREATE TABLE IF NOT EXISTS sessions(
 token TEXT PRIMARY KEY, player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
}
async function rankings(){
 const r=await q(`SELECT id,username,company_name,country_id,level,xp,cash FROM players ORDER BY cash DESC,xp DESC,id ASC`);
 return r.rows.map((p,i)=>({rank:i+1,worldRank:i+1,companyId:p.id,ownerId:p.id,
 companyName:p.company_name,ownerName:p.username,country:p.country_id,
 level:Number(p.level),xp:Number(p.xp),money:Number(p.cash),netWorth:Number(p.cash)}));
}
async function handler(req,res){
 const u=new URL(req.url,"http://localhost");
 try{
  if(req.method==="GET"&&u.pathname==="/health"){await q("SELECT 1");return send(res,200,{success:true,status:"ok",version:"global-ranking-1.0.0",database:"connected"});}
  if(req.method==="POST"&&u.pathname==="/api/auth/register"){
   const b=await body(req); if(!b.username||!b.password)return send(res,400,{success:false,error:"username and password are required"});
   const id="usr_"+crypto.randomBytes(8).toString("hex");
   try{await q(`INSERT INTO players(id,username,email,password_hash,company_name,country_id) VALUES($1,$2,$3,$4,$5,$6)`,
    [id,b.username,b.email||null,hash(b.password),b.companyName||b.company_name||"My Company",b.country||"india"])}
   catch(e){if(e.code==="23505")return send(res,409,{success:false,error:"username already exists"});throw e}
   const token=crypto.randomBytes(32).toString("hex"); await q("INSERT INTO sessions(token,player_id) VALUES($1,$2)",[token,id]);
   return send(res,201,{success:true,token,user:{id,username:b.username,companyName:b.companyName||b.company_name||"My Company",country:b.country||"india",level:1,xp:0,money:100000,netWorth:100000}});
  }
  if(req.method==="POST"&&u.pathname==="/api/auth/login"){
   const b=await body(req);const r=await q("SELECT * FROM players WHERE username=$1 AND password_hash=$2",[b.username,hash(b.password||"")]);
   if(!r.rows[0])return send(res,401,{success:false,error:"invalid credentials"});
   const p=r.rows[0],token=crypto.randomBytes(32).toString("hex");await q("INSERT INTO sessions(token,player_id) VALUES($1,$2)",[token,p.id]);
   return send(res,200,{success:true,token,user:{id:p.id,username:p.username,companyName:p.company_name,country:p.country_id,level:Number(p.level),xp:Number(p.xp),money:Number(p.cash),netWorth:Number(p.cash)}});
  }
  if(req.method==="GET"&&u.pathname==="/api/rankings"){const r=await rankings();return send(res,200,{success:true,result:"success",rankings:r,total_companies:r.length});}
  if(req.method==="POST"&&u.pathname==="/api/admin/set-cash"){
   if(process.env.ADMIN_KEY&&req.headers["x-admin-key"]!==process.env.ADMIN_KEY)return send(res,403,{success:false,error:"forbidden"});
   const b=await body(req);await q("UPDATE players SET cash=$1 WHERE id=$2",[Number(b.cash),b.playerId]);
   return send(res,200,{success:true});
  }
  return send(res,404,{success:false,error:"not found"});
 }catch(e){console.error(e);return send(res,500,{success:false,error:e.message});}
}
init().then(()=>http.createServer(handler).listen(PORT,"0.0.0.0",()=>console.log("Global ranking server listening on "+PORT))).catch(e=>{console.error(e);process.exit(1)});
