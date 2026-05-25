import handler from './api/[...path].js';
import login from './api/auth/login.js';
import { Readable } from 'node:stream';
function makeReq(method,url,body,headers={}){ const req=new Readable({read(){this.push(body?JSON.stringify(body):null); this.push(null)}}); req.method=method; req.url=url; req.headers={'content-type':'application/json',...headers}; return req; }
function makeRes(){ return {statusCode:200,headers:{},writeHead(status,h){this.statusCode=status; this.headers={...this.headers,...h}},setHeader(k,v){this.headers[k]=v},end(data){this.data=data; console.log('RES',this.statusCode,data?.slice?.(0,160))}} }
let res=makeRes(); await login(makeReq('POST','/api/auth/login',{email:'admin@demo.local',password:'Admin@123'}),res); const token=JSON.parse(res.data).token;
for(const path of ['/api/messages','/api/auto-replies','/api/users','/api/settings/whatsapp']){ console.log(path); let r=makeRes(); await handler(makeReq('GET',path,null,{authorization:'Bearer '+token}),r); }
