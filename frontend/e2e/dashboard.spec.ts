import { test, expect } from "@playwright/test";
import { login } from "./helpers/auth";

test.describe("Dashboard (Genel Bakış)", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("KPI kartları gösteriliyor", async ({ page }) => {
    // 5 KPI kartı bekleniyor
    await expect(page.getByText("Aktif Proje")).toBeVisible();
    await expect(page.getByText("Toplam Hedef Bütçe")).toBeVisible();
    await expect(page.getByText("Ekip")).toBeVisible();
    await expect(page.getByText("Lisans Portföyü")).toBeVisible();
    await expect(page.getByText("Yüksek Riskli Proje")).toBeVisible();
  });

  test("nakit akışı ve ekip eforu grafikleri gösteriliyor", async ({ page }) => {
    await expect(page.getByText("Nakit Akışı")).toBeVisible();
    await expect(page.getByText("Ekip Eforu")).toBeVisible();
  });

  test("projeler tablosu gösteriliyor", async ({ page }) => {
    // Dashboard'daki projeler kartı
    const projectsCard = page.getByRole("heading", { name: "Projeler" }).locator("..");
    await expect(projectsCard).toBeVisible();

    // Tablo başlıkları
    await expect(page.getByRole("columnheader", { name: "Kodu" }).first()).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Proje" }).first()).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Fabrika" }).first()).toBeVisible();
  });

  test("yaklaşan faturalar tablosu gösteriliyor", async ({ page }) => {
    await expect(page.getByText("Yaklaşan Faturalar")).toBeVisible();
  });

  test("sidebar navigasyonu çalışıyor", async ({ page }) => {
    // Projeler linkine tıkla
    await page.getByRole("link", { name: "Projeler" }).click();
    await expect(page).toHaveURL("/projects");

    // Genel Bakış'a geri dön
    await page.getByRole("link", { name: "Genel Bakış" }).click();
    await expect(page).toHaveURL("/");
  });
});
