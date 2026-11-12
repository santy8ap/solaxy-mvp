import { expect, test } from "@playwright/test";

test("los tres temas se aplican y la preferencia se conserva", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/");
  const root = page.locator("html");
  const trigger = page.getByRole("button", { name: /^Cambiar tema/ });
  const choices = page.getByRole("group", { name: "Apariencia" });
  const login = page.getByRole("banner").getByRole("link", { name: "Ingresar" });
  await expect(login).toBeVisible();
  await expect(root).toHaveAttribute("data-theme", "dark");
  await expect(root).toHaveCSS("background-color", "rgb(5, 5, 5)");

  await trigger.press("Enter");
  await expect(choices.getByRole("button", { name: "Oscuro" })).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Escape");
  await expect(choices).toBeHidden();
  await expect(trigger).toBeFocused();

  await trigger.click();
  await choices.getByRole("button", { name: "Verde" }).click();
  await expect(root).toHaveAttribute("data-theme", "green");
  await expect(root).toHaveCSS("background-color", "rgb(13, 40, 29)");
  await expect(trigger).toHaveAccessibleName(/Verde seleccionado/);

  await page.reload();
  await expect(root).toHaveAttribute("data-theme", "green");
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#0d281d");
  await login.click();
  await expect(page).toHaveURL(/\/ingresar$/);
  await expect(trigger).toHaveAccessibleName(/Verde seleccionado/);

  await trigger.click();
  await choices.getByRole("button", { name: "Claro" }).click();
  await expect(root).toHaveAttribute("data-theme", "light");
  await expect(root).toHaveCSS("background-color", "rgb(246, 245, 238)");
  await expect(root).toHaveCSS("color-scheme", "light");

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
