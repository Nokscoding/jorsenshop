// Restores the exact Jorsenshop V1.1 visual archive approved by the owner.
// This is a transitional build method: the signed source URL expires.
// Once restored, check the site visually and migrate original files durably to GitHub.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {pipeline} from 'node:stream/promises';
import {Readable} from 'node:stream';

const source=process.env.RESTORE_V11_SOURCE_URL;
if(!source)throw Error('RESTORE_V11_SOURCE_URL is not configured. Cannot restore the approved visual interface.');
const u=new URL(source);
if(u.protocol!=='https:')throw Error('Invalid source URL');

const work=await fs.mkdtemp(path.join(os.tmpdir(),'jorsenshop-v11-'));
const archive=path.join(work,'approved-v11.zip');
const unpack=path.join(work,'unpack');
try {
  console.log('Downloading owner-approved Jorsenshop V1.1 design archive');
  const response=await fetch(source,{redirect:'follow',signal:AbortSignal.timeout(120000)});
  if(!response.ok||!response.body)throw Error('Archive download failed: HTTP '+response.status);
  let bytes=0;
  const limit=85*1024*1024;
  const readable=Readable.fromWeb(response.body);
  readable.on('data',chunk=>{bytes+=chunk.length; if(bytes>limit)readable.destroy(new Error('Archive exceeds size limit'))});
  await pipeline(readable,(await import('node:fs')).createWriteStream(archive));
  await fs.mkdir(unpack,{recursive:true});
  execFileSync('unzip',['-oq',archive,'-d',unpack],{timeout:120000});
  const approved=path.join(unpack,'Jorsenshop_V1');
  for(const needed of ['index.html','app.js','styles.css','mobile-first.css','catalogue.js','catalogue.json','assets/logo-jorsenshop.png']){
    await fs.access(path.join(approved,needed));
  }
  const photos=(await fs.readdir(path.join(approved,'assets/products'))).filter(x=>/^\d{3}\.webp$/.test(x));
  if(photos.length!==278)throw Error('Unexpected photo count: '+photos.length+' (expected 278)');
  console.log('Restoring V1.1: original design, logo, '+photos.length+' photos, product catalogue and role mockup layouts.');
  await fs.cp(approved,'site',{recursive:true,force:true});
  // Temporary readable copies let us archive the ORIGINAL, unchanged code in GitHub.
  const transfer=path.join('site','source-transfer');
  await fs.mkdir(transfer,{recursive:true});
  const originalFiles=['index.html','app.js','catalogue.js','catalogue.json','styles.css','mobile-first.css','s/a7m4/index.html','s/i9p2/index.html','s/l6q8/index.html','assets/favicon.svg'];
  for(const name of originalFiles){
    const key=name.replaceAll('/','__')+'.txt';
    await fs.copyFile(path.join(approved,name),path.join(transfer,key));
  }
  // Change ONLY the media transport; keep every approved HTML/CSS layout unchanged.
  const source=path.join('site','app.js');
  let app=await fs.readFile(source,'utf8');
  const originalAsset="const asset = path => ROOT + path;";
  if(!app.includes(originalAsset))throw Error('Approved app.js asset helper has changed');
  const newAsset=[
    "const asset = path => {",
    " const m=typeof path==='string' && path.match(/^assets\\/products\\/([0-9]{3})\\.webp$/);",
    " if(m && m[1]!=='098')return 'https://res.cloudinary.com/jrgtsxkt/image/upload/f_auto,q_auto,c_limit,w_1200/jorsenshop/catalog/'+m[1]+'.webp';",
    " if(path==='assets/logo-jorsenshop.png')return 'https://res.cloudinary.com/jrgtsxkt/image/upload/f_auto,q_auto,w_480/jorsenshop/branding/logo-jorsenshop.png';",
    " if(/^assets\\/videos\\/look-[12]\\.mp4$/.test(path))return 'https://res.cloudinary.com/jrgtsxkt/video/upload/q_auto/jorsenshop/lookbook/'+path.split('/').pop();",
    " return ROOT + path;",
    "};",
  ].join('\\n');
  app=app.replace(originalAsset,newAsset);
  await fs.writeFile(source,app,'utf8');

  console.log('Approved V1.1 restored into site/.  Real checkout and staff API remain separate and are NOT active in this demo frontend.');
} finally {await fs.rm(work,{recursive:true,force:true}).catch(()=>{})}
