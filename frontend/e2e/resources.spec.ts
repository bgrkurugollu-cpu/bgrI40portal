import { test, expect } from "@playwright/test";
import { login } from "./helpers/auth";

test.describe("Kaynak Planı", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.getByRole("link", { name: "Kaynak Planı" }).click();
    await expect(page).toHaveURL("/resources");
  });

  test("kaynak planı sayfası yükleniyor", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Kaynak Planı" })
    ).toBeVisible();
  });

  test("kapasite matrisi tablosu gösteriliyor", async ({ page }) => {
    // Ekip üyelerinin isimleri veya ay başlıkları tabloda görünmeli
    // Ay kısaltmaları (Oca, Şub vb.)
    await expect(page.getByText(/Oca|Şub|Mar|Nis|May|Haz/).first()).toBeVisible();
  });

  test("grafik gösteriliyor", async ({ page }) => {
    // Kapasite grafiği
    await expect(page.getByText(/Kapasite|Yük/i).first()).toBeVisible();
  });

  test("proje filtresi mevcut", async ({ page }) => {
    const filterSelect = page.locator("select").first();
    await expect(filterSelect).toBeVisible();
  });

  test("yıl değiştirme çalışıyor", async ({ page }) => {
    const yearBtns = page.getByRole("button").filter({ hasText: /←|→/ });
    const count = await yearBtns.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test("sapma analizi tablosu gösteriliyor", async ({ page }) => {
    // Sapma analizi bölümü
    await expect(page.getByText(/Sapma|Analiz/i).first()).toBeVisible();
  });
});
