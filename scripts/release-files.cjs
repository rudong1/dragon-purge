'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const yaml=require('js-yaml');

function installerDetails(directory,version) {
  if(!/^\d+\.\d+\.\d+$/.test(version))throw Error('A stable semantic version is required.');
  const name=`DragonGPT-${version}-x64-Setup.exe`;
  const file=path.join(directory,name);
  const bytes=fs.readFileSync(file);
  if(bytes.length<1024*1024||bytes[0]!==0x4d||bytes[1]!==0x5a)throw Error('Installer is missing, incomplete or not a Windows executable.');
  const pe=bytes.readUInt32LE(0x3c);
  if(pe<0x40||pe+4>bytes.length||bytes.subarray(pe,pe+4).toString('hex')!=='50450000')throw Error('Windows PE header is invalid.');
  return {name,size:bytes.length,sha512:crypto.createHash('sha512').update(bytes).digest('base64')};
}
function verifyRelease(directory,version) {
  const installer=installerDetails(directory,version);
  const manifest=yaml.load(fs.readFileSync(path.join(directory,'latest.yml'),'utf8'));
  if(manifest?.version!==version||manifest?.path!==installer.name||manifest?.sha512!==installer.sha512)throw Error('Update manifest does not match the built installer.');
  const entry=manifest.files?.find(f=>f.url===installer.name);
  if(!entry||entry.size!==installer.size||entry.sha512!==installer.sha512)throw Error('Update manifest file size or checksum is invalid.');
  const names=[installer.name,'latest.yml'];
  const blockmap=installer.name+'.blockmap';
  if(fs.existsSync(path.join(directory,blockmap))) {
    if(fs.statSync(path.join(directory,blockmap)).size===0)throw Error('Blockmap must not be empty.');
    names.push(blockmap);
  }
  return {version,installer:installer.name,installerBytes:installer.size,assets:names};
}
function prepareRelease(directory,version) {
  const installer=installerDetails(directory,version);
  const manifestPath=path.join(directory,'latest.yml');
  // Existing builder metadata remains authoritative: a mismatch is a failure,
  // never something to hide by replacing a checksum. If builder omitted its
  // manifest, create the normal NSIS update metadata for our new release.
  if(fs.existsSync(manifestPath))verifyRelease(directory,version);
  else fs.writeFileSync(manifestPath,yaml.dump({version,files:[{url:installer.name,sha512:installer.sha512,size:installer.size}],path:installer.name,sha512:installer.sha512,releaseDate:new Date().toISOString()}));
  const report=verifyRelease(directory,version);
  fs.writeFileSync(path.join(directory,'release-files.json'),JSON.stringify(report,null,2)+'\n');
  return report;
}
if(require.main===module) {
  const directory=path.resolve(__dirname,'../release');
  const version=require('../package.json').version;
  const command=process.argv[2]||'verify';
  try {const report=command==='prepare'?prepareRelease(directory,version):command==='verify'?verifyRelease(directory,version):null;if(!report)throw Error('Use prepare or verify.');console.log(JSON.stringify(report));}
  catch(error){console.error(error.message);process.exitCode=1;}
}
module.exports={installerDetails,prepareRelease,verifyRelease};
