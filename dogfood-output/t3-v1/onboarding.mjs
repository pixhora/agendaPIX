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
 console.log(JSON.stringify(results));writeFileSync('dogfood-output/t3-v1/results.json',JSON.stringify(results,null,2));
} finally {await browser.close();}
