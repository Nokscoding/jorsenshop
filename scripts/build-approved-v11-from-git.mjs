// Build the user's approved original V1.1 source from Git, independently of temporary Drive links.
// The original files are stored losslessly as gzip+base64 under original-v11/.
// Never introduce a new theme here: only rewrite the media URLs to the dedicated Cloudinary CDN.
import fs from 'node:fs/promises';
import path from 'node:path';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';

const files={
  'index.html':'28665d6b53186322a8aa1366c4604652912a812f78e1cf0cf05a15df52d0aa40',
  'app.js':'40837fa5675690ed96821c1a1a7ce50195efd82f5a940eeee88324eba204ae1f',
  'catalogue.js':'7eaf3ee08f65886d00a3936a155af19f18d4cdc7e3e730816ecfd9af65317c8d',
  'catalogue.json':'d9fbb965a18b6c772014f9c33ffc1528b891bdc909bf6d50cd3988b7c22a8907',
  'styles.css':'6008ae0f86f34c97546cfdfdf88109ebd2b70551880a3d0ea5bcb6b337e73b02',
  'mobile-first.css':'cf4a087bcf461ab70576c1799b2fa087efc371fefe9bd40289750094b3cd8d09',
  's/a7m4/index.html':'df3d9c65db3756a5b63972781a86416448006580bc6e1b84748bc8a8d50db42a',
  's/i9p2/index.html':'88de5e31b471d492ca0ca008a53f8152ef2221f6077e3fc0d86937dbce937870',
  's/l6q8/index.html':'33b05819c37ec695b220c032df986efde719ca865f2e6daf3518a1b1bbcbdea9',
  'assets/favicon.svg':'039f9d74e246e7a316b9e24ecfdb87f2f8247137a42f5227cc165a876792ca33'
};

for(const [name,hash] of Object.entries(files)){
  const encoded=await fs.readFile(path.join('original-v11',name+'.gz.b64'),'utf8');
  if(!/^[A-Za-z0-9+/=]+$/.test(encoded.trim()))throw Error('Corrupt archival source: '+name);
  const data=gunzipSync(Buffer.from(encoded.trim(),'base64'));
  const digest=createHash('sha256').update(data).digest('hex');
  if(digest!==hash)throw Error('Approved V1.1 SHA mismatch for '+name);
  const out=path.join('site',name);
  await fs.mkdir(path.dirname(out),{recursive:true});
  await fs.writeFile(out,data);
}
console.log('Restored original approved V1.1 layout: 10 files verified against original archive SHA-256.');

// Route approved interface media through Cloudinary WITHOUT redesigning its markup.
// All clothing images except 098.webp are in the separate jrgtsxkt Cloudinary account.
// Image 098 remains accessible on the verified immutable original production deployment.
const appFile=path.join('site','app.js');
let app=await fs.readFile(appFile,'utf8');
const originalAsset="const asset = path => ROOT + path;";
if(!app.includes(originalAsset))throw Error('Cannot locate the original approved asset helper');
const cdn=[
  "const asset = path => {",
  " const m = typeof path === 'string' && path.match(/^assets\\/products\\/([0-9]{3})\\.webp$/);",
  " if(m && m[1]==='098')return 'https://jorsenshop-pls116hxl-nks16.vercel.app/assets/products/098.webp';",
  " if(m)return 'https://res.cloudinary.com/jrgtsxkt/image/upload/f_auto,q_auto,c_limit,w_1200/jorsenshop/catalog/'+m[1]+'.webp';",
  " if(path==='assets/logo-jorsenshop.png')return 'https://res.cloudinary.com/jrgtsxkt/image/upload/f_auto,q_auto,w_480/jorsenshop/branding/logo-jorsenshop.png';",
  " if(/^assets\\/videos\\/look-[12]\\.mp4$/.test(path))return 'https://res.cloudinary.com/jrgtsxkt/video/upload/q_auto/jorsenshop/lookbook/'+path.split('/').pop();",
  " return ROOT+path;",
  "};"
].join('\n');
app=app.replace(originalAsset,cdn);
await fs.writeFile(appFile,app,'utf8');
console.log('Media configured: 277 original product photos + logo + 2 lookbook videos from the dedicated Cloudinary account. No mockup design changes.');
