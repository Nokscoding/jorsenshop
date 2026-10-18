import crypto from 'node:crypto';
import { neon } from '@neondatabase/serverless';

export function db(){
  if(!process.env.DATABASE_URL) throw new Error('DATABASE_URL_missing');
  return neon(process.env.DATABASE_URL);
}
export function json(res,status,body){
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  return res.status(status).json(body);
}
export function only(req,res,method){
  if(req.method!==method){json(res,405,{error:'Méthode non autorisée'});return false}
  if(method!=='GET'){
    const origin=req.headers.origin, host=req.headers.host;
    if(origin && new URL(origin).host!==host){json(res,403,{error:'Origine refusée'});return false}
    const len=Number(req.headers['content-length']||0);
    if(len>512_000){json(res,413,{error:'Requête trop volumineuse'});return false}
  }
  return true;
}
export function sessionRole(req){
  const raw=String(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('js_staff='));
  if(!raw||!process.env.SESSION_SECRET)return null;
  const token=raw.slice(9);const parts=token.split('.');
  if(parts.length!==2)return null;
  const expected=crypto.createHmac('sha256',process.env.SESSION_SECRET).update(parts[0]).digest('base64url');
  const a=Buffer.from(expected), b=Buffer.from(parts[1]);
  if(a.length!==b.length||!crypto.timingSafeEqual(a,b))return null;
  try{
    const payload=JSON.parse(Buffer.from(parts[0],'base64url').toString('utf8'));
    if(!['admin','investisseur'].includes(payload.role)||payload.exp<Date.now()||payload.iss!=='jorsenshop')return null;
    return payload.role;
  }catch{return null}
}
export function requireRole(req,res,...accepted){
  const role=sessionRole(req);
  if(!role||!accepted.includes(role)){json(res,401,{error:'Connexion requise'});return null}
  return role;
}
export function issueCookie(res,role){
  const payload=Buffer.from(JSON.stringify({role,iss:'jorsenshop',exp:Date.now()+8*60*60*1000})).toString('base64url');
  const sig=crypto.createHmac('sha256',process.env.SESSION_SECRET).update(payload).digest('base64url');
  res.setHeader('Set-Cookie',`js_staff=${payload}.${sig}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=28800`);
}
export function expireCookie(res){res.setHeader('Set-Cookie','js_staff=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0')}
export function checkPassword(pass,stored){
  if(typeof pass!=='string'||pass.length>512||!stored)return false;
  const [version,rounds,salt,digest]=stored.split('$');
  if(version!=='pbkdf2'||!/^\d+$/.test(rounds))return false;
  const iter=Number(rounds);
  if(iter<200000||iter>1000000)return false;
  try{
    const expected=Buffer.from(digest,'base64');
    const actual=crypto.pbkdf2Sync(pass,Buffer.from(salt,'base64'),iter,expected.length,'sha256');
    return expected.length===actual.length&&crypto.timingSafeEqual(expected,actual);
  }catch{return false}
}
export function cloudUrl(url){
  const cloud=process.env.CLOUDINARY_CLOUD_NAME;
  if(!cloud||typeof url!=='string')return false;
  try{
    const parsed=new URL(url);
    return parsed.protocol==='https:'&&parsed.hostname==='res.cloudinary.com' &&
      parsed.pathname.startsWith('/'+cloud+'/image/upload/') &&
      /\/jorsenshop\/catalog\/[A-Za-z0-9_\/-]+\.(png|jpe?g|webp|avif)$/i.test(parsed.pathname);
  }catch{return false}
}

export async function rateLimit(req,action,maxHits=10,windowMinutes=15){
 const source=String(req.headers['x-forwarded-for']||req.headers['x-real-ip']||req.socket?.remoteAddress||'unknown').split(',')[0].trim().slice(0,128);
 const id=crypto.createHmac('sha256',process.env.SESSION_SECRET||'unconfigured').update(source).digest('hex');
 const sql=db();
 const rows=await sql`SELECT count_api_action(${id},${action},${maxHits},${windowMinutes}) AS allowed`;
 return rows[0]?.allowed===true;
}
