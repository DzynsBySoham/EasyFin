// Browser distribution is a development-only dependency; never shipped to the app.
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),os=require('node:os'),{spawnSync}=require('node:child_process');
(async()=>{
  const chromium=require('@sparticuz/chromium').default;
  const executable=process.env.CHROMIUM_PATH||await chromium.executablePath();
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'easyfin-browser-'));
  const pack=path.join(path.dirname(require.resolve('@sparticuz/chromium')),'../bin/al2023.tar.br');
  if(fs.existsSync(pack)){fs.writeFileSync(path.join(dir,'libs.tar'),zlib.brotliDecompressSync(fs.readFileSync(pack)));const unpack=spawnSync('tar',['xf',path.join(dir,'libs.tar'),'-C',dir]);if(unpack.status)throw new Error('Cannot extract browser libraries');}
  const result=spawnSync(process.execPath,[require.resolve('@playwright/test/cli'),'test',...process.argv.slice(2)],{stdio:'inherit',env:{...process.env,CHROMIUM_PATH:executable,LD_LIBRARY_PATH:[path.join(dir,'lib'),process.env.LD_LIBRARY_PATH].filter(Boolean).join(':')}});
  fs.rmSync(dir,{recursive:true,force:true});process.exit(result.status??1);
})().catch(e=>{console.error(e);process.exit(1);});
