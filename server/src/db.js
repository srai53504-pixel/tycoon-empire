import fs from 'node:fs';
import path from 'node:path';
const DATA_DIR=path.resolve('data'); const DB_FILE=path.join(DATA_DIR,'db.json');
const initial={players:[],companies:[],businesses:[],contracts:[],alliances:[],allianceMembers:[],wars:[],chat:[],sessions:[],counters:{player:1,company:1,business:1,contract:1,alliance:1,war:1,chat:1}};
fs.mkdirSync(DATA_DIR,{recursive:true});
let db;
try{db=JSON.parse(fs.readFileSync(DB_FILE,'utf8'));}catch{db=structuredClone(initial);save();}
export function getDb(){return db}
export function nextId(type){const id=db.counters[type]??1;db.counters[type]=id+1;save();return id}
export function save(){fs.writeFileSync(DB_FILE,JSON.stringify(db,null,2))}
