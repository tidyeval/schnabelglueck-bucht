import { chromium, webkit } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { routeController } from './route-controller.js';
import { STAGES } from '../src/stages.js';
import { createGame, step, press, WORLD } from '../src/game.js';
const out='test-results/adventure/continuous'; await mkdir(out,{recursive:true});
async function serveBuild() {
  const server=createServer(async(req,res)=>{
    try {
      const path=new URL(req.url,'http://localhost').pathname;
      const ext=path.split('.').pop();
      res.setHeader('Content-Type',({js:'text/javascript',css:'text/css',mp3:'audio/mpeg',svg:'image/svg+xml',png:'image/png',webmanifest:'application/manifest+json'})[ext]||'text/html');
      res.setHeader('Cache-Control','no-store');res.setHeader('Vary','Origin');
      res.end(await readFile(new URL('../dist'+(path==='/'?'/index.html':path),import.meta.url)));
    }catch{res.writeHead(404);res.end();}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  return {url:`http://127.0.0.1:${server.address().port}/`,close:()=>new Promise(resolve=>server.close(resolve))};
}
let journeyTime = 0;
function route(stage) {
  const g=createGame(()=>.99,stage,journeyTime), inputs=[]; let last=false, elapsed=0; const control=routeController();
  while(!g.ended && elapsed<110) {
    const holding=control(g);
    if(holding&&!last)press(g);
    if(holding!==last){inputs.push({at:elapsed*1000,holding});last=holding;}
    step(g,.016,holding);elapsed+=.016;
  }
  assert.equal(g.endReason,'complete'); journeyTime += g.time; return inputs;
}
const traces=STAGES.map((_, stage) => route(stage));await writeFile(`${out}/routes.json`,JSON.stringify(traces));
for(const [name,engine] of [['chromium',chromium],['webkit',webkit]].filter(([name])=>!process.env.BROWSER||process.env.BROWSER===name)) {
  const server=await serveBuild(),url=server.url;
  const browser=await engine.launch();const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true,reducedMotion:'reduce'});
  await context.addInitScript(()=>{Math.random=()=>.99;});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.clock.install();
  await page.goto(url);await page.locator('#stages option').first().waitFor({state:'attached'});
  await page.evaluate(()=>localStorage.setItem('pelican-v1',JSON.stringify({record:987,totalFish:100,outfit:'sailor',music:false,sound:false,haptics:false})));
  await page.reload();await page.locator('#stages option').first().waitFor({state:'attached'});
  for(let stage=0;stage<STAGES.length;stage++) {
    if(stage===0) await page.locator('#play').click(); else await page.locator('#next-stage').click();
    await page.evaluate(inputs=>{
      const start=performance.now();let index=0;
      function tick(now){while(index<inputs.length&&inputs[index].at<=now-start){const input=inputs[index++];document.querySelector('canvas').dispatchEvent(new KeyboardEvent(input.holding?'keydown':'keyup',{code:'Space',key:' ',bubbles:true}));}if(now-start<110000)requestAnimationFrame(tick);}
      requestAnimationFrame(tick);
    },traces[stage]);
    await page.clock.runFor(20000);await page.screenshot({path:`${out}/${name}-stage-${stage}.png`});
    await page.clock.runFor(80000);
    assert.deepEqual(errors, [], 'no input or gameplay exceptions');
    const title=await page.locator('#result-title').textContent();
    assert.ok(await page.locator('#result-dialog').isVisible(),`stage ${stage} finished`);
    assert.ok(title.includes(stage===STAGES.length-1?'Alle Küken':'Willkommen'),`${name} stage ${stage}: ${title}`);
    const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('pelican-v1')));
    assert.equal(saved.completed,stage+1);assert.equal(saved.record,987);assert.ok(saved.bests[stage]>0); assert.equal(saved.difficulty,undefined);
    const fish=Number(await page.locator('#result-fish').textContent());
    const previous=stage===0?100:JSON.parse(await page.getAttribute('body','data-bank')).totalFish;
    assert.equal(saved.totalFish,previous+fish,'exactly one banking per attempt');
    await page.evaluate(s=>document.body.setAttribute('data-bank',JSON.stringify(s)),saved);
    await page.screenshot({path:`${out}/${name}-nest-${stage}.png`});
    console.log(`${name}: stage ${stage+1} complete, ${fish} fish banked once`);
    await page.clock.runFor(2000);
    assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('pelican-v1'))),saved,'ended frames cannot bank twice');
  }
  assert.ok(await page.locator('#next-stage').isHidden());
  await page.locator('#again').click();assert.equal(await page.locator('#score').textContent(),'0');
  await page.keyboard.down('Space');await page.clock.runFor(WORLD.breath * 1000 + 1100);await page.keyboard.up('Space');
  assert.equal(await page.locator('#result-title').textContent(),'Die Luft ist aus!');
  await page.locator('#back-home').click();assert.equal(await page.locator('#stages').inputValue(),String(STAGES.length-1));
  await page.locator('#stages').selectOption('0');await page.locator('#play').click();assert.equal(await page.locator('#score').textContent(),'0');
  await page.locator('#pause').click();await page.locator('#quit').click();
  await page.reload();await page.locator('#stages option').first().waitFor({state:'attached'});assert.equal(await page.locator('#stages').inputValue(),String(STAGES.length-1));
  await page.evaluate(()=>navigator.serviceWorker.ready);
  // WebKit's setOffline aborts before service-worker navigation. Stop the origin
  // in both engines instead; no-store responses rule out ordinary HTTP cache.
  await server.close();await assert.rejects(context.request.get(url,{timeout:1000}));
  if(name==='chromium')await context.setOffline(true);
 await page.reload();await page.locator('#stages option').first().waitFor({state:'attached'});
  assert.equal(await page.locator('#stages').inputValue(),String(STAGES.length-1));await page.locator('#play').click();await page.clock.runFor(500);assert.ok(await page.locator('#hud').isVisible());
  assert.deepEqual(errors,[]);await browser.close();console.log(`${name}: all four real-input stages, bank, replay, reload and offline passed`);
}
