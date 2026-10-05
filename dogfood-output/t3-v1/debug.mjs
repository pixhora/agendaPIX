import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const {chromium,expect}=createRequire(process.cwd()+'/package.json')('@playwright/test');
const browser=await chromium.launch();
const results=[];
try {
 for(const status of ['pending_payment','confirmed']) {
  const page=await browser.newPage({viewport:{width:375,height:812}});
  const service={id:'11111111-1111-4111-8111-111111111111',name:'Corte QA',durationMinutes:30,priceCents:5000,depositCents:1000};
  await page.route('**/api/public/qa-v1/services',r=>r.fulfill({json:{name:'QA',timezone:'America/Sao_Paulo',services:[service]}}));
  await page.route('**/api/public/qa-v1/bookings/*/payment',r=>r.fulfill({json:{bookingId:'22222222-2222-4222-8222-222222222222',status,expiresAt:new Date(Date.now()+600000).toISOString(),payment:{id:'33333333-3333-4333-8333-333333333333',provider:'fake',externalId:'fake_qa',amountCents:1000,status:status==='confirmed'?'paid':'pending',expiresAt:new Date(Date.now()+600000).toISOString(),copyPaste:'FAKE-PIX-NOT-PAYABLE:qa:1000',qrCodeDataUrl:''}}}));
  await page.addInitScript(({serviceId})=>sessionStorage.setItem('booking_session_qa-v1',JSON.stringify({bookingId:'22222222-2222-4222-8222-222222222222',accessToken:'qa-synthetic-token',serviceId,expiresAt:new Date(Date.now()+600000).toISOString(),customerName:'QA',customerPhone:'11999999999'})),{serviceId:service.id});
  const seen=[]; page.on('request',r=>seen.push(new URL(r.url()).pathname));
  await page.goto('http://127.0.0.1:3001/qa-v1');
  await expect(page.getByRole('heading',{name:'Escolha o serviço'})).toBeVisible();
  console.log(JSON.stringify({status,seen,storage:await page.evaluate(()=>Boolean(sessionStorage.getItem('booking_session_qa-v1')))}));
  if(status==='pending_payment') console.log('PAYMENT_VISIBLE',await page.getByRole('heading',{name:'Pague o sinal por Pix'}).isVisible());
  else await expect(page.getByRole('heading',{name:'Escolha o serviço'})).toBeVisible();
  results.push({case:'T04',status,confirmedVisible:await page.getByRole('heading',{name:'Horário confirmado!'}).isVisible(),pendingVisible:await page.getByRole('heading',{name:'Pague o sinal por Pix'}).isVisible()});
  await page.screenshot({path:`dogfood-output/t3-v1/restore-${status}.png`,fullPage:true});
  await page.close();
 }
 console.log(JSON.stringify(results));writeFileSync('dogfood-output/t3-v1/results.json',JSON.stringify(results,null,2));
} finally {await browser.close();}
