import { expect, test } from "@playwright/test";

test("los tres temas se aplican y la preferencia se conserva", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/");
  const root = page.locator("html");
  const trigger = page.getByRole("button", { name: /^Cambiar tema/ });
  const choices = page.getByRole("group", { name: "Apariencia" });
  const login = page.getByRole("banner").getByRole("link", { name: "Ingresar" });
  const themeColor = page.locator('meta[name="theme-color"]');
  const clockLink = page.getByRole("link", { name: "Ver reloj solar", exact: true });
  const photo = clockLink.locator("img");
  await expect(login).toBeVisible();
  await expect(root).toHaveAttribute("data-theme", "dark");
  await expect(root).toHaveCSS("background-color", "rgb(5, 5, 5)");
  await expect(photo).toHaveCSS("filter", "none");

  await trigger.press("Enter");
  await expect(choices.getByRole("button", { name: "Oscuro" })).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Escape");
  await expect(choices).toBeHidden();
  await expect(trigger).toBeFocused();

  await trigger.click();
  await choices.getByRole("button", { name: "Verde" }).click();
  await expect(root).toHaveAttribute("data-theme", "green");
  await expect(root).toHaveCSS("background-color", "rgb(40, 76, 53)");
  await expect(page.getByRole("heading", { level: 1 })).toHaveCSS("color", "rgb(255, 237, 170)");
  await expect(trigger).toHaveAccessibleName(/Verde seleccionado/);

  await expect(clockLink).toHaveCSS("position", "relative");
  await expect.poll(() => photo.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  await clockLink.click();
  await expect(page).toHaveURL(/\/#reloj$/);
  await expect(page.getByRole("heading", { name: /^Reloj solar$/i })).toBeInViewport();

  await page.reload();
  await expect(root).toHaveAttribute("data-theme", "green");
  await expect(themeColor).toHaveCount(1);
  await expect(themeColor).toHaveAttribute("content", "#284c35");

  await trigger.click();
  await choices.getByRole("button", { name: "Oscuro" }).click();
  await expect(root).toHaveAttribute("data-theme", "dark");
  await expect(photo).toHaveCSS("filter", "none");

  await login.click();
  await expect(page).toHaveURL(/\/ingresar$/);
  await expect(trigger).toHaveAccessibleName(/Oscuro seleccionado/);

  await trigger.click();
  await choices.getByRole("button", { name: "Claro" }).click();
  await expect(root).toHaveAttribute("data-theme", "light");
  await expect(root).toHaveCSS("background-color", "rgb(246, 245, 238)");
  await expect(root).toHaveCSS("color-scheme", "light");
  await expect(themeColor).toHaveAttribute("content", "#f6f5ee");

  await page.getByRole("button", { name: /Entrar con la cuenta de pruebas/i }).click();
  await expect(page).toHaveURL(/\/panel$/);
  await expect(trigger).toHaveAccessibleName(/Claro seleccionado/);

  await page.goto("/comprar?plan=p180");
  await expect(trigger).toHaveAccessibleName(/Claro seleccionado/);
  await trigger.click();
  await choices.getByRole("button", { name: "Oscuro" }).click();
  await expect(root).toHaveAttribute("data-theme", "dark");
  await expect(root).toHaveCSS("background-color", "rgb(5, 5, 5)");
  expect(errors).toEqual([]);
});

test("la portada respeta la preferencia de movimiento reducido", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  const photo = page.getByRole("link", { name: "Ver reloj solar", exact: true }).locator("img");
  await expect(photo).not.toHaveCSS("animation-name", "none");

  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(photo).toHaveCSS("animation-name", "none");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: "Ver los planes" })).toBeVisible();
});
