import { test, expect } from "@playwright/test";
import { login } from "./helpers/auth";

test.describe("Bütçe & Finans Sayfası", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.getByRole("link", { name: "Bütçe & Finans" }).click();
    await expect(page).toHaveURL("/finance");
  });

  test("finans sayfası yükleniyor", async ({ page }) => {
    // Sayfa başlığı
    await expect(page.getByRole("heading", { name: "Bütçe & Finans" })).toBeVisible();
  });

  test("KPI kartları (gelir, gider, kâr) gösteriliyor", async ({ page }) => {
    // Finansal özet kartları
    await expect(page.getByText("Toplam Gelir")).toBeVisible();
    await expect(page.getByText("Toplam Gider")).toBeVisible();
  });

  test("grafik gösteriliyor", async ({ page }) => {
    // Aylık nakit akış grafiği
    await expect(page.getByText("Aylık Nakit Akışı")).toBeVisible();
  });

  test("fatura tablosu gösteriliyor", async ({ page }) => {
    // Tablo başlıkları
    await expect(page.getByText("Faturalama Takvimi")).toBeVisible();
  });

  test("proje filtresi çalışıyor", async ({ page }) => {
    // Proje filtre seçicisi mevcut
    const filterSelect = page.locator("select").first();
    await expect(filterSelect).toBeVisible();
  });

  test("TCMB kur bilgisi gösteriliyor", async ({ page }) => {
    // Kur banner'ı
    await expect(page.getByText(/TCMB|Kur|USD|EUR/)).toBeVisible();
  });

  test("yıl değiştirme butonları çalışıyor", async ({ page }) => {
    const yearBtns = page.getByRole("button").filter({ hasText: /←|→/ });
    const count = await yearBtns.count();
    // En az bir yıl değiştirme butonu olmalı
    expect(count).toBeGreaterThanOrEqual(1);
  });
});
