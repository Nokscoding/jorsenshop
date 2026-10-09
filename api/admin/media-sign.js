import crypto from 'node:crypto';
import {only,json,requireRole} from '../_lib/shared.js';
export default async function handler(req,res){
 if(!only(req,res,'POST')||!requireRole(req,res,'admin'))return;
 const cloud=process.env.CLOUDINARY_CLOUD_NAME,key=process.env.CLOUDINARY_API_KEY,secret=process.env.CLOUDINARY_API_SECRET;
 if(!cloud||!key||!secret)return json(res,503,{error:'Configurer CLOUDINARY_API_KEY et CLOUDINARY_API_SECRET dans Vercel'});
 const folder='jorsenshop/catalog',timestamp=Math.floor(Date.now()/1000);
 const incoming=req.body?.publicIds;
 if(incoming!==undefined&&(!Array.isArray(incoming)||incoming.length>400||!incoming.every(id=>/^[0-9]{3}$/.test(id))))
   return json(res,400,{error:'Identifiants des images invalides'});
 const sign=(publicId)=>{
   const params={folder,overwrite:'false',timestamp};
   if(publicId)params.public_id=publicId;
   const source=Object.keys(params).sort().map(k=>k+'='+params[k]).join('&')+secret;
   return crypto.createHash('sha1').update(source).digest('hex');
 };
 const base={cloudName:cloud,apiKey:key,folder,timestamp,overwrite:false,maxBytes:10*1024*1024,allowed:['image/jpeg','image/png','image/webp']};
 return json(res,200,incoming?{...base,signatures:Object.fromEntries(incoming.map(id=>[id,sign(id)]))}:{...base,signature:sign(null)});
}
