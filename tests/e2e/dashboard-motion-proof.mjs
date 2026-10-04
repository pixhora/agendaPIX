import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(process.cwd() + '/package.json');
const { chromium, expect } = require('@playwright/test');
// Usar exclusivamente fixture e sessão de teste obtida por login real; nunca dados de produção.
if (!process.env.QA_DASHBOARD_FIXTURE || !process.env.QA_DASHBOARD_SESSION)
    throw new Error('Defina QA_DASHBOARD_FIXTURE e QA_DASHBOARD_SESSION de teste.');
const fixture = JSON.parse(fs.readFileSync(process.env.QA_DASHBOARD_FIXTURE));
const browser = await chromium.launch();
const results = [];
try {
    const context = await browser.newContext({ storageState: process.env.QA_DASHBOARD_SESSION });
    const page = await context.newPage();
    for (const width of [375, 390, 1280])
        for (const colorScheme of ['light', 'dark'])
            for (const reducedMotion of ['no-preference', 'reduce']) {
                await page.setViewportSize({ width, height: 812 });
                await page.emulateMedia({ colorScheme, reducedMotion });
                await page.goto(`http://127.0.0.1:3343/dashboard/services?businessId=${fixture.businessId}`);
                await expect(page.getByRole('heading', { name: 'Serviços e preços' })).toBeVisible();
                let motionReport = null;
                if (width < 640) {
                    const trigger = page.getByRole('button', { name: /Painel ·/ });
                    await trigger.focus();
                    await page.keyboard.press('Enter');
                    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
                    const panel = page.locator('nav[data-open]');
                    await expect(panel.getByRole('link', { name: 'Funcionamento' })).toBeVisible();
                    if (reducedMotion === 'reduce')
                        expect(await panel.evaluate(e => getComputedStyle(e).transitionDuration)).toBe('0s');
                    await page.keyboard.press('Escape');
                    const motion = await page.evaluate(async () => {
                        const panel = document.querySelector('nav[data-open]');
                        const button = document.querySelector('button[aria-controls]');
                        button.click();
                        await new Promise(requestAnimationFrame);
                        await new Promise(requestAnimationFrame);
                        const animations = panel.getAnimations();
                        const opacity = getComputedStyle(panel).opacity;
                        await Promise.all(animations.map(animation => animation.finished));
                        return { animations: animations.length, opacity, endOpacity: getComputedStyle(panel).opacity };
                    });
                    motionReport = motion;
                    if (width === 375 && colorScheme === 'light')
                        await page.screenshot({ path: `docs/evidencias/dashboard-a2/menu-${reducedMotion}.png`, fullPage: true });
                    expect(motion.endOpacity).toBe('1');
                    if (reducedMotion === 'reduce')
                        expect(motion.animations).toBe(0);
                    else
                        expect(motion.animations).toBeGreaterThan(0);
                    await trigger.focus();
                    await page.keyboard.press('Tab');
                    await expect(panel.getByRole('link', { name: 'Agenda', exact: true })).toBeFocused();
                    await page.keyboard.press('Escape');
                    await expect(trigger).toBeFocused();
                    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
                }
                expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
                const form = page.getByRole('form', { name: 'Cadastrar serviço' });
                const name = form.getByLabel('Nome do serviço');
                await name.fill('Rascunho A2');
                if (width < 640) {
                    const trigger = page.getByRole('button', { name: /Painel ·/ });
                    await trigger.click();
                    await trigger.click();
                }
                await expect(name).toHaveValue('Rascunho A2');
                await page.screenshot({ path: `docs/evidencias/dashboard-a2/services-${width}-${colorScheme}-${reducedMotion}.png`, fullPage: true });
                results.push({ width, colorScheme, reducedMotion, menuKeyboard: true, draftPreserved: true, noOverflow: true, motion: motionReport });
            }
    // Prova de persistência real: altera e restaura o nome de serviço da fixture.
    const form = page.locator('form[aria-label^="Editar"]').first();
    await form.locator('xpath=ancestor::details').evaluate(e => e.open = true);
    const name = form.getByLabel('Nome do serviço');
    const original = (await name.inputValue()).replace(/(?: A2)+$/, '');
    const serviceId = await form.locator('input[name="id"]').inputValue();
    await name.fill(original + ' A2');
    let release;
    const hold = new Promise(resolve => { release = resolve; });
    let requests = 0;
    await page.route('**/dashboard/services?**', async (route) => { if (route.request().headers()['next-action']) {
        requests++;
        await hold;
    } await route.continue(); });
    await form.getByRole('button', { name: 'Salvar serviço', exact: true }).click();
    try {
        await expect(form).toHaveAttribute('aria-busy', 'true');
        await expect(form.getByRole('status')).toHaveText('Salvando alterações…');
        await expect(form.getByRole('button', { name: 'Salvando serviço…' })).toBeDisabled();
        await expect(name).toHaveValue(original + ' A2');
    }
    finally {
        release();
    }
    await expect(form.getByRole('status')).toContainText('Serviço salvo');
    expect(requests).toBe(1);
    await page.unroute('**/dashboard/services?**');
    await page.reload();
    const modified = page.locator('form').filter({ has: page.locator('input[name="id"][value="' + serviceId + '"]') });
    await modified.locator('xpath=ancestor::details').evaluate(e => e.open = true);
    await expect(modified.getByLabel('Nome do serviço')).toHaveValue(original + ' A2');
    await modified.getByLabel('Nome do serviço').fill(original);
    await modified.getByRole('button', { name: 'Salvar serviço', exact: true }).click();
    await expect(modified.getByRole('status')).toContainText('Serviço salvo');
    // Agenda: status continua vindo do servidor; sem polling ou entrada por card.
    const agenda = [];
    for (const width of [375, 1280]) for (const reducedMotion of ['no-preference', 'reduce']) {
        await page.setViewportSize({ width, height: 812 });
        await page.emulateMedia({ reducedMotion });
        await page.goto(`http://127.0.0.1:3343/dashboard?businessId=${fixture.businessId}&date=${fixture.date}`);
        const statuses = page.locator('[data-status]');
        const statusCount = await statuses.count();
        if (statusCount && reducedMotion === 'reduce') expect(await statuses.first().evaluate(e => getComputedStyle(e).transitionDuration)).toBe('0s');
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await page.screenshot({ path: `docs/evidencias/dashboard-a2/agenda-${width}-${reducedMotion}.png`, fullPage: true });
        agenda.push({ width, reducedMotion, statusCount });
    }
    // Pix: respostas HTTP controladas cobrem somente UI, pois API ainda não integrada nesta branch.
    let pixRelease;
    let pixMethod = 'GET';
    let pixRequests = 0;
    const pixHold = new Promise(resolve => { pixRelease = resolve; });
    await page.route('**/api/businesses/*/pix-key', async (route) => {
        if (route.request().method() === 'GET')
            return route.fulfill({ json: { configured: false, type: null, hint: null } });
        pixRequests++;
        pixMethod = route.request().method();
        await pixHold;
        return route.fulfill({ status: 503, json: { error: { message: 'Configuração Pix indisponível.' } } });
    });
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`http://127.0.0.1:3343/dashboard/settings?businessId=${fixture.businessId}`);
    const hours = page.getByRole('form', { name: 'Horários de funcionamento' });
    await expect(hours.locator('input[type="time"]')).toHaveCount(14);
    const beforeHours = await hours.locator('input[type="time"]').evaluateAll(inputs => inputs.map(input => input.value));
    await hours.getByRole('button', { name: 'Salvar horários de funcionamento' }).click();
    await expect(hours.getByRole('status')).toHaveText('Horários de funcionamento salvos.');
    await page.reload();
    await expect(hours.locator('input[type="time"]')).toHaveCount(14);
    expect(await hours.locator('input[type="time"]').evaluateAll(inputs => inputs.map(input => input.value))).toEqual(beforeHours);
    const pix = page.getByRole('region', { name: 'Chave Pix do negócio' });
    const key = page.locator('#pix-key-value');
    await key.fill('synthetic-pix-key');
    await pix.getByRole('button', { name: 'Salvar chave', exact: true }).click();
    try {
        await expect(pix).toHaveAttribute('aria-busy', 'true');
        await expect(pix.getByRole('status')).toHaveText('Atualizando configuração Pix…');
        await expect(key).toBeDisabled();
    }
    finally {
        pixRelease();
    }
    await expect(pix.getByRole('alert')).toBeFocused();
    await expect(pix.getByRole('alert')).toHaveText('Configuração Pix indisponível.');
    await expect(key).toHaveValue('');
    expect(pixRequests).toBe(1);
    expect(pixMethod).toBe('PUT');
    await page.unroute('**/api/businesses/*/pix-key');
    await page.route('**/api/businesses/*/pix-key', route => route.fulfill({ json: route.request().method() === 'DELETE' ? { configured: false, type: null, hint: null } : { configured: true, type: 'cpf', hint: '***.***.***-00' } }));
    await key.fill('synthetic-pix-key');
    await pix.getByRole('button', { name: 'Salvar chave', exact: true }).click();
    await expect(pix.getByRole('status')).toHaveText('Chave Pix salva com segurança.');
    await expect(key).toHaveValue('');
    expect(await page.locator('body').innerText()).not.toContain('synthetic-pix-key');
    await pix.getByRole('button', { name: 'Remover', exact: true }).click();
    await pix.getByRole('button', { name: 'Confirmar remoção', exact: true }).click();
    await expect(pix.getByRole('status')).toHaveText('Chave Pix removida.');
    await expect(key).toBeFocused();
    fs.writeFileSync('docs/evidencias/dashboard-a2/results.json', JSON.stringify({ url: 'http://127.0.0.1:3343', authentication: 'sessão SMTP local real preexistente; sem bypass', results, persistence: 'salvar/reload/restaurar serviço fixture; horários salvar/reload sem mudar valores', pix: 'UI PUT503/PUT200/DELETE200 controlados; API ausente, não provado integrado' }, null, 2));
    console.log(JSON.stringify({ cases: results.length, persistence: true }));
}
finally {
    await browser.close();
}
