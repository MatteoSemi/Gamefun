// Test the actual static production build, with every external request blocked.
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4173','--strictPort'],{stdio:'pipe'});
let logs='';server.stdout.on('data',d=>logs+=d);server.stderr.on('data',d=>logs+=d);
let browser;
try{
 for(let i=0;i<100;i++){try{const r=await fetch('http://localhost:4173');if(r.ok)break;}catch{}await new Promise(r=>setTimeout(r,100));if(i===99)throw Error(`Preview startup failed: ${logs}`);}
 const path=process.env.CHROMIUM_PATH??(existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined);
 browser=await chromium.launch({...(path?{executablePath:path}:{}),args:['--no-sandbox']});
 const p=await browser.newPage({viewport:{width:1200,height:900},deviceScaleFactor:2});const errors=[],external=[],results=[];
 p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
 await p.route('**/*',r=>{if(new URL(r.request().url()).hostname==='localhost')return r.continue();external.push(r.request().url());return r.abort();});
 await p.goto('http://localhost:4173');assert.equal(await p.evaluate(()=>typeof window.arcade),'undefined','production must exclude debug harness');
 for(const id of ['maze','snake','runner','road','breakout'])for(const mode of ['solo','duo']){
  await p.locator(`[data-game=${id}]`).click();await p.locator('#start').click();
  if(mode==='duo'){await p.locator('#multiplayer').click();await p.locator('[data-mode=duo]').click();await p.locator('#mode-start').click();}
  // Deliberately real time: verify countdown and keyboard play in the minified build.
  await p.waitForFunction(()=>document.querySelector('.status')?.textContent==='RUNNING');
  const key=id==='breakout'?(mode==='solo'?'Space':'KeyW'):id==='runner'?'KeyW':'ArrowUp';
  await p.keyboard.down(key);if(mode==='duo')await p.keyboard.down(id==='breakout'?'ArrowUp':id==='runner'?'ArrowDown':'KeyW');await p.waitForTimeout(240);await p.keyboard.up(key);if(mode==='duo')await p.keyboard.up(id==='breakout'?'ArrowUp':id==='runner'?'ArrowDown':'KeyW');
  const count=await p.locator('.world').count();assert.equal(count,mode==='solo'?1:2);
  const canvas=await p.locator('canvas').first().evaluate(c=>({w:c.width,h:c.height,clientW:c.getBoundingClientRect().width}));assert.ok(canvas.w>=840);assert.ok(canvas.h>=920);assert.ok(canvas.clientW>100);
  await p.locator('#pause').click();assert.match(await p.locator('#pause').textContent(),/Resume/);await p.locator('#home').click();results.push({game:id,mode,keyboard:true,highDPI:true,countdown:true,pause:true});
 }
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 writeFileSync('evidence/production-results.json',JSON.stringify({browser:browser.version(),externalRequests:external,errors,results},null,2));console.log(`Production static build: ${results.length} game/mode flows passed; external requests 0; errors 0.`);
}finally{await browser?.close();server.kill('SIGTERM');}
