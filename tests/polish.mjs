import { chromium, webkit } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
const stage = process.argv[2] || 'after';
const out = `test-results/polish/${stage}`;
await mkdir(out, { recursive: true });
const url = process.env.PELICAN_DEV_URL || 'http://localhost:5175';
const results = { stage, hardware: `${os.platform()} ${os.arch()} ${os.cpus()[0].model}`, viewport: '390x844, DPR 2, canvas 960x1700', browsers: {} };
for (const [name, engine] of [['chromium', chromium], ['webkit', webkit]]) {
  const browser = await engine.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await page.route('**/polish-preview', r => r.fulfill({ contentType: 'text/html', body: '<body style="margin:0;background:#fff5df"></body>' }));
  await page.goto(`${url}/polish-preview`);
  await page.evaluate(async stage => {
    const prefix = stage === 'before' ? '/test-results/polish/before' : '/src';
    const { drawWorld, pelican } = await import(`${prefix}/art.js`);
    const { createGame } = await import(`${prefix}/game.js`);
    const reefStage = stage === 'before' ? 2 : (await import('/src/stages.js')).STAGES.findIndex(stage => stage.id === 'reef');
    const canvas = document.createElement('canvas'); canvas.width = 960; canvas.height = 1700; canvas.getContext('2d').scale(2,2); canvas.style.width = '390px'; document.body.append(canvas);
    const g = createGame(() => .5); g.player.y = 530; g.player.wet = true; g.cargo = 20;
    const scenes = {
      reef: [{kind:'reef',x:150},{kind:'puffer',x:350,y:665,phase:'puffed',timer:1},{kind:'jelly',x:450,y:660,phase:.6}],
      animals: [{kind:'shark',x:290,y:640,phase:'warn'}, {kind:'turtle',x:280,y:450,baseY:450}, {kind:'gull',x:290,y:280}, {kind:'jelly',x:390,y:550,phase:.7}, {kind:'fish',x:170,y:420}, {kind:'fish',x:220,y:400,golden:true}, {kind:'fish',x:350,y:580}],
      people: [{kind:'boat',x:180,y:360,cast:1.2}, {kind:'surfer',x:370,y:360}, {kind:'diver',x:320,y:620,phase:'locked',aimX:118,aimY:530}, {kind:'harpoon',x:230,y:580,vx:-100,vy:-30}, {kind:'driftwood',x:60,y:360}],
      terrain: [{kind:'island',x:130},{kind:'reef',x:355},{kind:'whirlpool',x:350,y:540},{kind:'bubble',x:290,y:530}],
      nest: [{kind:'nest',x:250,y:360,served:true,celebration:2}],
      dense: [{kind:'shark',x:270,y:440,phase:'warn'}, {kind:'turtle',x:410,y:440,baseY:440}, {kind:'shark',x:240,y:660}, {kind:'shark',x:390,y:660}, ...Array.from({length:8},(_,i)=>({kind:'fish',x:130+i*43,y:530,golden:false}))],
    };
    window.paint = (scene, t=1, reduced=false) => { g.stage=scene==='reef'?reefStage:0;g.items=scenes[scene]||[]; g.feeding=scene==='nest'?1:0; g.player.wet=scene!=='nest'; g.player.y=scene==='nest'?285:530; g.player.feedX=scene==='nest'?175:undefined; drawWorld(canvas.getContext('2d'),g,scene==='menu'?'menu':'playing',t,'classic',[],reduced); };
    window.gallery = () => {
      const sheet=document.createElement('canvas');sheet.width=960;sheet.height=1000;const ctx=sheet.getContext('2d');ctx.fillStyle='#fff5df';ctx.fillRect(0,0,960,1000);ctx.fillStyle='#285652';ctx.font='18px sans-serif';
      const tiles=[['animals','Hai',200,570,190,150],['animals','Schildkröte',210,390,160,110],['animals','Möwe',230,235,130,85],['animals','Qualle',345,505,95,150],['animals','Fische',140,370,120,85],['animals','Fliegender Fisch',305,185,105,85],['people','Fischer / Netz',90,200,205,205],['people','Surfer',305,245,150,140],['people','Taucher',245,570,150,100],['nest','Küken',190,265,140,125]];
      tiles.forEach(([scene,label,x,y,w,h],i)=>{window.paint(scene);const dx=(i%4)*240,dy=Math.floor(i/4)*240;ctx.fillStyle='#285652';ctx.fillText(label,dx+12,dy+23);ctx.drawImage(canvas,x*2,y*2,w*2,h*2,dx+12,dy+38,w,h)});
      ['classic','flower','sailor'].forEach((outfit,i)=>{ctx.fillStyle='#285652';ctx.fillText('Pip · '+outfit,12+i*300,780);stage === 'before' ? pelican(ctx,100+i*300,900,.76,1,0,outfit,false,true,.2,0,20) : pelican(ctx,{x:100+i*300,y:900,scale:.76,time:1,outfit,happy:true,gulp:.2,cargo:20})});
      canvas.replaceWith(sheet);window.restore=()=>sheet.replaceWith(canvas);
    };
    window.paint('dense');
    window.measure = (scene='dense') => new Promise(resolve => { let start,last; const frames=[]; function tick(now) { start??=now; if(last) frames.push(now-last); last=now; window.paint(scene,(now-start)/1000); if(now-start<30000) requestAnimationFrame(tick); else { frames.sort((a,b)=>a-b); resolve({frames:frames.length,p95:frames[Math.floor(frames.length*.95)]}); } } requestAnimationFrame(tick); });
  }, stage);
  for (const scene of ['menu','animals','people','terrain','nest','dense']) {
    await page.evaluate(s => window.paint(s), scene);
    await page.screenshot({ path: `${out}/${name}-${scene}.png` });
  }
  await page.evaluate(() => window.gallery());
  await page.screenshot({path:`${out}/${name}-contact.png`,fullPage:true});
  await page.evaluate(() => window.restore());
  if(stage==='after') {
    const stable=await page.evaluate(()=>{window.paint('terrain',1,true);const a=document.querySelector('canvas').toDataURL();window.paint('terrain',2,true);return a===document.querySelector('canvas').toDataURL()});
    if(!stable) throw new Error('Reduced-motion terrain still has decorative animation');
  }
  if (!process.env.POLISH_SHOTS_ONLY) results.browsers[name] = { version: browser.version(), ...await page.evaluate(() => window.measure()), ...(stage==='after'?{reef:await page.evaluate(()=>window.measure('reef'))}:{}) };
  await browser.close();
}
if (!process.env.POLISH_SHOTS_ONLY) await writeFile(`${out}/performance.json`, JSON.stringify(results,null,2));
console.log(JSON.stringify(results));
