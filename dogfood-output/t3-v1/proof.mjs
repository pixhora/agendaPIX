import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const {chromium,expect}=createRequire(process.cwd()+'/package.json')('@playwright/test');
const browser=await chromium.launch();
const results=[];
try {
 for(const width of [375,1280]) {
  const page=await browser.newPage({viewport:{width,height:812}});
  await page.goto('http://127.0.0.1:3001/onboarding');
  await expect(page.getByLabel('Nome do estabelecimento ou profissional')).toBeVisible();
  const input=page.getByLabel('Seu link personalizado');
  await input.fill('studio-qa-com-nome-comprido');
  await expect(input).toHaveValue('studio-qa-com-nome-comprido');
  results.push({case:'T02',width,overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),inputHeight:(await input.boundingBox()).height});
  await page.screenshot({path:`dogfood-output/t3-v1/onboarding-${width}.png`,fullPage:true});
  await page.close();
 }
 for(const status of ['pending_payment','confirmed']) {
  const page=await browser.newPage({viewport:{width:375,height:812}});
  const service={id:'11111111-1111-4111-8111-111111111111',name:'Corte QA',durationMinutes:30,priceCents:5000,depositCents:1000};
  await page.route('**/api/public/qa-v1/services',r=>r.fulfill({json:{name:'QA',timezone:'America/Sao_Paulo',services:[service]}}));
  await page.route('**/api/public/qa-v1/bookings/*/payment',r=>r.fulfill({json:{bookingId:'22222222-2222-4222-8222-222222222222',status,expiresAt:new Date(Date.now()+600000).toISOString(),payment:{id:'33333333-3333-4333-8333-333333333333',provider:'fake',externalId:'fake_qa',amountCents:1000,status:status==='confirmed'?'paid':'pending',expiresAt:new Date(Date.now()+600000).toISOString(),copyPaste:'FAKE-PIX-NOT-PAYABLE:qa:1000',qrCodeDataUrl:''}}}));
  await page.addInitScript(({serviceId})=>sessionStorage.setItem('booking_session_qa-v1',JSON.stringify({bookingId:'22222222-2222-4222-8222-222222222222',accessToken:'qa-synthetic-token',serviceId,expiresAt:new Date(Date.now()+600000).toISOString(),customerName:'QA',customerPhone:'11999999999'})),{serviceId:service.id});
  const response=page.waitForResponse(r=>r.url().includes('/payment'));
  await page.goto('http://127.0.0.1:3001/qa-v1');
  await response;
  if(status==='pending_payment')await expect(page.getByRole('heading',{name:'Pague o sinal por Pix'})).toBeVisible();
  else await expect(page.getByRole('heading',{name:'Escolha o serviço'})).toBeVisible();
  results.push({case:'T04',status,confirmedVisible:await page.getByRole('heading',{name:'Horário confirmado!'}).isVisible(),pendingVisible:await page.getByRole('heading',{name:'Pague o sinal por Pix'}).isVisible()});
  await page.screenshot({path:`dogfood-output/t3-v1/restore-${status}.png`,fullPage:true});
  await page.close();
 }
 console.log(JSON.stringify(results));writeFileSync('dogfood-output/t3-v1/results.json',JSON.stringify(results,null,2));
} finally {await browser.close();}
