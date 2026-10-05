import {createRequire} from 'node:module';
import {writeFileSync} from 'node:fs';
const {chromium,expect}=createRequire(process.cwd()+'/package.json')('@playwright/test');
const browser=await chromium.launch();const results=[];
try {
 for(const width of [375,1280]) {
  const page=await browser.newPage({viewport:{width,height:812}});page.setDefaultTimeout(7000);
  const errors=[],api=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/'))api.push({method:r.method(),path:new URL(r.url()).pathname});});
  let stage='serviço';const checks=[];
  try{
   await page.goto('http://127.0.0.1:3001/preview/booking');
   await page.getByRole('radio',{name:/Corte \+ escova/}).click();
   await expect(page.getByRole('radio',{name:/Corte \+ escova/})).toHaveAttribute('aria-checked','true');
   const audit=async()=>{checks.push({stage,overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)});await page.screenshot({path:`dogfood-output/journey-current/${width}-${checks.length}.png`,fullPage:true});};
   await audit();await page.getByRole('button',{name:'Continuar para escolher horário'}).click();
   stage='horário';const slot=page.getByRole('radiogroup',{name:'Horários disponíveis',exact:true}).getByRole('radio').first();await expect(slot).toBeVisible({timeout:7000});await slot.click();await audit();
   await page.getByRole('button',{name:'Preencher meus dados'}).click();stage='dados';await page.getByLabel('Nome completo').fill('Cliente QA');await page.getByLabel('WhatsApp para confirmação').fill('11999999999');await audit();
   await page.getByRole('button',{name:/Pagar sinal de/}).click();stage='sinal';await expect(page.getByRole('heading',{name:'Pague o sinal por Pix'})).toBeVisible({timeout:7000});await expect(page.getByRole('heading',{name:'Horário confirmado!'})).not.toBeVisible();
   await page.getByRole('button',{name:'Já fiz o pagamento no banco'}).click();await expect(page.getByRole('button',{name:'Já fiz o pagamento no banco'})).toBeEnabled({timeout:7000});await expect(page.getByRole('heading',{name:'Horário confirmado!'})).not.toBeVisible();await audit();
   await page.getByRole('button',{name:/Simular Pix Pago/}).click();stage='confirmação';await expect(page.getByRole('heading',{name:'Horário confirmado!'})).toBeVisible({timeout:7000});await audit();
   results.push({width,status:'PASS',stage,checks,api,errors,mode:'Preview simulado'});
  }catch(e){await page.screenshot({path:`dogfood-output/journey-current/${width}-failure.png`,fullPage:true});results.push({width,status:'FAIL',stage,error:e.message.split('\n').slice(0,5).join('\n'),checks,api,errors});}
  await page.close();
 }
}finally{await browser.close();writeFileSync('dogfood-output/journey-current/results.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results));}
