const {defineConfig}=require('@playwright/test');
const chromium=require('@sparticuz/chromium').default;
module.exports=defineConfig({testDir:'./tests',reporter:process.env.CI?[['github'],['list']]:'list',workers:1,use:{baseURL:'http://127.0.0.1:8080',viewport:{width:390,height:844},launchOptions:{executablePath:process.env.CHROMIUM_PATH||'/tmp/chromium',args:chromium.args.filter(a=>a!=='--single-process')}},webServer:{command:'python3 -m http.server 8080 --bind 0.0.0.0',port:8080,reuseExistingServer:true}});
