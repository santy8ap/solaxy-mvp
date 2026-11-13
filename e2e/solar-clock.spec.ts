import { expect, test } from "@playwright/test";

test("el reloj solar permite explorar la curva y volver a la hora actual", async ({ page, isMobile }) => {
  await page.goto("/#reloj");
  const clock = page.getByRole("region", { name: /^Reloj solar$/i });
  const slider = clock.getByRole("slider", { name: "Explorar por hora" });
  const peak = clock.getByRole("button", { name: /^Pico solar/ });
  const now = clock.getByRole("button", { name: "Volver a ahora" });
  const reading = clock.getByRole("status");

  await expect(clock.getByText("Hora en la planta", { exact: true })).toBeVisible();
  await expect(now).toBeDisabled();
  if (isMobile) {
    await peak.tap();
  } else {
    await peak.press("Enter");
  }
  await expect(peak).toHaveAttribute("aria-pressed", "true");
  await expect(slider).toHaveAttribute("aria-valuetext", /12:30/);
  await expect(reading).toContainText("8.000 kW de potencia");
  await expect(reading).toContainText("33.104 kWh acumulados");
  await expect(clock.getByRole("img", { name: /^Curva solar a la hora consultada/ })).toHaveAccessibleName(/8\.000 kW/);

  await slider.press("ArrowRight");
  await expect(slider).toHaveAttribute("aria-valuetext", /12:45/);
  await expect(peak).toHaveAttribute("aria-pressed", "false");
  await slider.press("Home");
  await expect(reading).toContainText("0 kW de potencia y 0 kWh acumulados");
  await slider.press("End");
  await expect(reading).toContainText("0 kW de potencia y 66.208 kWh acumulados");

  await now.click();
  await expect(now).toBeDisabled();
  await expect(slider).toBeFocused();
  await expect(clock.getByText("Hora en la planta", { exact: true })).toBeVisible();
  await expect(reading).toBeEmpty();
});
