import { expect } from "@playwright/test";
import { test } from "./helpers";

test.describe("select único: seta, altura e movimento", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("a seta fica a 12px, a altura segue o campo e a lista escala sem deslize", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/onboarding");
    const select = page.getByRole("combobox", { name: "Duração" });
    await expect(select).toBeVisible();
    const box = await select.evaluate((trigger) => {
      const icon = trigger.querySelector("[data-slot=select-icon]");
      const input = document.querySelector("#store-name")?.parentElement;
      if (!icon || !input) throw new Error("seta ou campo ausente");
      const triggerBox = trigger.getBoundingClientRect();
      const iconBox = icon.getBoundingClientRect();
      const inputBox = input.getBoundingClientRect();
      return {
        iconWidth: iconBox.width,
        iconHeight: iconBox.height,
        gap: triggerBox.right - iconBox.right,
        triggerHeight: triggerBox.height,
        inputHeight: inputBox.height,
      };
    });
    expect(box.iconWidth).toBeGreaterThanOrEqual(15);
    expect(box.iconWidth).toBeLessThanOrEqual(17);
    expect(box.iconHeight).toBeGreaterThanOrEqual(15);
    expect(box.iconHeight).toBeLessThanOrEqual(17);
    // 12px até a borda interna; a borda do campo soma cerca de 1px.
    expect(box.gap).toBeGreaterThanOrEqual(12);
    expect(box.gap).toBeLessThanOrEqual(14);
    expect(Math.abs(box.triggerHeight - box.inputHeight)).toBeLessThanOrEqual(1);

    await select.click();
    const menu = page.locator("[data-slot=select-content]");
    await expect(menu).toBeVisible();
    const motion = await menu.evaluate((element) => {
      const computed = getComputedStyle(element);
      const frames: string[] = [];
      for (const sheet of document.styleSheets) {
        let rules: CSSRuleList;
        try { rules = sheet.cssRules; } catch { continue; }
        for (const rule of rules) {
          if (rule instanceof CSSKeyframesRule && (rule.name === "select-menu-in" || rule.name === "select-menu-out")) {
            frames.push(`${rule.name} ${rule.cssText}`);
          }
        }
      }
      return {
        duration: computed.animationDuration,
        name: computed.animationName,
        origin: computed.transformOrigin,
        frames: frames.join("\n"),
      };
    });
    expect(motion.duration).toBe("0.15s");
    expect(motion.name).toContain("select-menu-in");
    expect(motion.frames).toContain("scale: 0.96");
    expect(motion.frames).not.toMatch(/translate|slide/i);
    expect(motion.origin.length).toBeGreaterThan(0);
    await page.getByRole("option", { name: "45 min" }).click();
    await expect(select).toContainText("45 min");
    await select.click();
    await expect(page.getByRole("option", { name: "45 min" }).locator("[data-slot=select-item-indicator]")).toBeVisible();
  });

  test("com movimento reduzido a lista não anima", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/onboarding");
    await page.getByRole("combobox", { name: "Duração" }).click();
    const menu = page.locator("[data-slot=select-content]");
    await expect(menu).toBeVisible();
    const animation = await menu.evaluate((element) => getComputedStyle(element).animationName);
    expect(animation).toBe("none");
  });
});
