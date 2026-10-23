// Optional browser integration check. Requires Playwright and a Chromium executable.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox','--no-proxy-server']});
 try{
 const page=await browser.newPage({viewport:{width:1440,height:1050}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.GAME_URL||'http://127.0.0.1:8765');await page.click('#start');await page.click('#pause');
 assert.equal(await page.locator('#view').isDisabled(),true);
 async function cell(x,y,options={}){const box=await page.locator('#map').boundingBox();await page.mouse.click(box.x+(x+.5)*box.width/32,box.y+(y+.5)*box.height/22,options);}
 await cell(3,11);await page.getByRole('button',{name:'补充战斗群 · 130'}).click();assert.equal(await page.evaluate(()=>currentGame.owned(0,'army').length),2);
 await cell(3,12);await cell(3,5,{button:'right'});await page.evaluate(()=>{for(let i=0;i<100;i++)currentGame.tick(.1)});
 await cell(3,5);await page.locator('[data-build="outpost"]').click();await cell(3,5);
 assert.equal(await page.evaluate(()=>currentGame.owned(0,'engineer')[0].jobs.at(-1)?.type),'outpost');
 await page.evaluate(()=>{for(let i=0;i<1000;i++)currentGame.tick(.1)});
 assert.equal(await page.evaluate(()=>currentGame.owned(0,'outpost')[0].progress),null);
 // Real UI manual pipe planning, not just direct simulation calls.
 for(let i=0;i<4&&await page.locator('[data-build="pipe"]').isDisabled();i++)await cell(3,5);await page.locator('[data-build="pipe"]').click();await cell(3,5);await cell(3,3);
 assert.ok(await page.evaluate(()=>currentGame.owned(0,'engineer')[0].jobs.length>0));
 const before=await page.evaluate(()=>currentGame.time);await page.click('#step');const after=await page.evaluate(()=>currentGame.time);assert.ok(Math.abs(after-before-1)<.001);
 await page.click('#help');assert.ok(await page.locator('#guide').isVisible());await page.click('#close-guide');
 await page.click('#restart');await page.selectOption('#mode','ai');await page.click('#start');await page.click('#pause');assert.equal(await page.locator('#view').isDisabled(),false);
 await page.selectOption('#view','1');await page.selectOption('#speed','8');await page.selectOption('#view','all');
 await page.evaluate(()=>{for(let i=0;i<3000&&currentGame.winner===null;i++)currentGame.tick(.1)});await page.waitForTimeout(300);assert.equal(await page.locator('#banner').isVisible(),true);
 // New-game dialog cancellation must not erase the current match.
 const t=await page.evaluate(()=>currentGame.time);await page.click('#restart');await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>currentGame.time),t);
 assert.deepEqual(errors,[]);await page.screenshot({path:'/tmp/energy-frontier-tested.png',fullPage:true});
 await page.setViewportSize({width:800,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 console.log('PASS browser: human game, selection, recruit, movement, build, manual pipes, pause/step, help, observer views, speed, terminal state, cancel dialog, 800px layout. No page errors.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
