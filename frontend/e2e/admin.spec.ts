import { test, expect } from "@playwright/test";
import { login } from "./helpers/auth";

test.describe("Admin Paneli", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.getByRole("link", { name: "Yönetim" }).click();
    await expect(page).toHaveURL("/admin");
  });

  test("admin sayfası yükleniyor", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Yönetim Paneli" })).toBeVisible();
  });

  test("kullanıcılar sekmesi gösteriliyor", async ({ page }) => {
    // Kullanıcılar sekmesi varsayılan açık olmalı veya tıklanabilir
    await expect(page.getByText("Kullanıcılar")).toBeVisible();
    // Tablo başlığı
    await expect(page.getByText(/(admin@bgr\.local|Yönetici)/)).toBeVisible();
  });

  test("fabrikalar sekmesi çalışıyor", async ({ page }) => {
    await page.getByText("Fabrikalar").click();
    // Fabrika ekleme butonu
    await expect(
      page.getByRole("button", { name: /Ekle|Fabrika/ }).first()
    ).toBeVisible();
  });

  test("ekip üyeleri sekmesi çalışıyor", async ({ page }) => {
    await page.getByText("Ekip Üyeleri").click();
    await expect(
      page.getByRole("button", { name: /Ekle|Üye/ }).first()
    ).toBeVisible();
  });

  test("uygulamalar sekmesi çalışıyor", async ({ page }) => {
    await page.getByText("Uygulamalar").click();
    await expect(
      page.getByRole("button", { name: /Ekle|Uygulama/ }).first()
    ).toBeVisible();
  });

  test("toplu yükleme sekmesi açılıyor", async ({ page }) => {
    await page.getByText("Toplu Yükleme").click();
    // Veri tipi seçici ve şablon indir butonu
    await expect(page.getByText("Şablon İndir")).toBeVisible();
  });

  test("yeni kullanıcı ekleme diyaloğu açılıyor", async ({ page }) => {
    // Kullanıcılar sekmesindeyiz
    await page.getByText("Kullanıcılar").click();
    await page
      .getByRole("button", { name: /Ekle|Kullanıcı/ })
      .first()
      .click();

    // Form alanları
    await expect(page.getByLabel("E-posta")).toBeVisible();
  });

  test("fabrika ekleme diyaloğu açılıyor", async ({ page }) => {
    await page.getByText("Fabrikalar").click();
    await page
      .getByRole("button", { name: /Ekle|Fabrika/ })
      .first()
      .click();

    await expect(page.getByLabel("Ad")).toBeVisible();
  });
});
