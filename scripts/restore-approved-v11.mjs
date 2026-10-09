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
  console.log('Approved V1.1 restored into site/.  Real checkout and staff API remain separate and are NOT active in this demo frontend.');
} finally {await fs.rm(work,{recursive:true,force:true}).catch(()=>{})}
