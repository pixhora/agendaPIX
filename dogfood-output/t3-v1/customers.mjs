import {createRequire} from 'node:module';
import {readFileSync,writeFileSync} from 'node:fs';
const {chromium,expect}=createRequire(process.cwd()+'/package.json')('@playwright/test');
const fixture=JSON.parse(readFileSync('/tmp/agenda-t2-final/fixture.json'));
const browser=await chromium.launch();
try {
 const context=await browser.newContext({storageState:'/tmp/agenda-t2-final/navigation-state.json'});
 const page=await context.newPage();
 const results=[];
 for(const width of [375,1280]){
  await page.setViewportSize({width,height:812});
  await page.goto(`http://127.0.0.1:3343/dashboard/customers?businessId=${fixture.businessId}`);
  await expect(page.getByRole('heading',{name:'Clientes',exact:true})).toBeVisible();
  const link=page.getByRole('link',{name:/WhatsApp/}).first();
  await expect(link).toBeVisible();
  await link.focus();await expect(link).toBeFocused();
  const height=(await link.boundingBox()).height;
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
  expect(height).toBeGreaterThanOrEqual(44);expect(overflow).toBe(false);
  await page.screenshot({path:`dogfood-output/t3-v1/customers-${width}.png`,fullPage:true});
  results.push({width,height,overflow});
 }
 console.log(JSON.stringify(results));writeFileSync('dogfood-output/t3-v1/customers-results.json',JSON.stringify(results,null,2));
} finally{await browser.close();}
