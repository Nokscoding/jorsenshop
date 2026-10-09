import crypto from 'node:crypto';
import {only,json,requireRole} from '../_lib/shared.js';
export default async function handler(req,res){
 if(!only(req,res,'POST')||!requireRole(req,res,'admin'))return;
 const cloud=process.env.CLOUDINARY_CLOUD_NAME,key=process.env.CLOUDINARY_API_KEY,secret=process.env.CLOUDINARY_API_SECRET;
 if(!cloud||!key||!secret)return json(res,503,{error:'Configurer Cloudinary sur Vercel (API key et secret)'});
 const folder='jorsenshop/catalog',timestamp=Math.floor(Date.now()/1000);
 const signature=crypto.createHash('sha1').update(`folder=${folder}&timestamp=${timestamp}${secret}`).digest('hex');
 return json(res,200,{cloudName:cloud,apiKey:key,folder,timestamp,signature,maxBytes:10*1024*1024,allowed:['image/jpeg','image/png','image/webp']});
}
