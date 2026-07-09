import { test, expect } from "@playwright/test";
import { login } from "./helpers/auth";

test.describe("Lisans Yönetimi", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.getByRole("link", { name: "Lisanslar" }).click();
    await expect(page).toHaveURL("/licenses");
  });

  test("lisanslar sayfası yükleniyor", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Lisans Yönetimi" })).toBeVisible();
  });

  test("KPI kartları gösteriliyor", async ({ page }) => {
    await expect(page.getByText("Toplam Lisans")).toBeVisible();
    await expect(page.getByText("Yatırım Bedeli")).toBeVisible();
  });

  test("lisans tablosu başlıkları gösteriliyor", async ({ page }) => {
    await expect(page.getByRole("columnheader", { name: "Uygulama" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Lisans Key" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Fabrika" })).toBeVisible();
  });

  test("uygulama filtresi mevcut", async ({ page }) => {
    // Uygulama filtresi select/dropdown
    const appFilter = page.locator("select").first();
    await expect(appFilter).toBeVisible();
  });

  test("yeni lisans ekleme diyaloğu açılıyor", async ({ page }) => {
    await page.getByRole("button", { name: "Lisans Ekle" }).click();
    await expect(page.getByText("Yeni Lisans")).toBeVisible();
    await expect(page.getByLabel("Lisans Key")).toBeVisible();
  });

  test("TCMB kur bilgisi gösteriliyor", async ({ page }) => {
    await expect(page.getByText(/TCMB|Kur|USD|EUR/)).toBeVisible();
  });
});
