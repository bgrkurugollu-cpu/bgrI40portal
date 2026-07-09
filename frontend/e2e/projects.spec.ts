import { test, expect } from "@playwright/test";
import { login } from "./helpers/auth";

test.describe("Proje Yönetimi", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.getByRole("link", { name: "Projeler" }).click();
    await expect(page).toHaveURL("/projects");
  });

  test("projeler listesi yükleniyor", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Projeler" })).toBeVisible();
    // Tablo başlıkları
    await expect(page.getByRole("columnheader", { name: "Proje İsmi" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Fabrika" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Risk" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Durum" })).toBeVisible();
  });

  test("yeni proje oluşturma diyaloğu açılıyor", async ({ page }) => {
    await page.getByRole("button", { name: "Yeni Proje" }).click();
    // Diyalog başlığı
    await expect(page.getByText("Yeni Proje").nth(1)).toBeVisible();
    // Form alanları
    await expect(page.getByLabel("Proje Kodu")).toBeVisible();
    await expect(page.getByLabel("Proje Adı")).toBeVisible();
    await expect(page.getByText("Fabrika(lar)")).toBeVisible();
    await expect(page.getByLabel("Gerçekleşme İhtimali (%)")).toBeVisible();
  });

  test("yeni proje oluşturma — form gönderimi", async ({ page }) => {
    await page.getByRole("button", { name: "Yeni Proje" }).click();

    const testCode = `PRJ-E2E-${Date.now()}`;
    const testName = `E2E Test Projesi ${Date.now()}`;

    await page.getByLabel("Proje Kodu").fill(testCode);
    await page.getByLabel("Proje Adı").fill(testName);

    // Fabrika seçimi (MultiSelect) — ilk seçeneği seç
    await page.getByText("Fabrika seçin").click();
    const firstOption = page.locator(
      'button:has-text("Fabrika"):not([type="button"]):not(:has-text("Fabrika seçin")):not(:has-text("Fabrika(lar)"))'
    );
    // Dropdown'daki ilk fabrikayı seç
    const options = page.locator(".absolute.z-20 button");
    if ((await options.count()) > 0) {
      await options.first().click();
    }

    await page.getByLabel("Gerçekleşme İhtimali (%)").fill("80");
    await page.getByLabel("Hedef Bütçe").fill("500000");

    // Kaydet
    await page.getByRole("button", { name: "Kaydet" }).click();

    // Proje listesinde görünmeli
    await expect(page.getByText(testName)).toBeVisible({ timeout: 15_000 });
  });

  test("proje detay sayfası açılıyor", async ({ page }) => {
    // İlk projenin linkine tıkla
    const firstProjectLink = page.locator("table a").first();
    const projectName = await firstProjectLink.textContent();
    await firstProjectLink.click();

    // Detay sayfasında proje başlığı görünmeli
    await expect(page.getByText("Projeler").first()).toBeVisible({ timeout: 10_000 });

    // Sekmeler görünmeli
    await expect(page.getByText("Ekip & Efor")).toBeVisible();
    await expect(page.getByText("Bütçe Kırılımı")).toBeVisible();
    await expect(page.getByText("Aylık Finans")).toBeVisible();
    await expect(page.getByText("Faturalar")).toBeVisible();
    await expect(page.getByText("Değişiklik Geçmişi")).toBeVisible();
  });

  test("proje düzenleme diyaloğu açılıyor", async ({ page }) => {
    // İlk projeyi aç
    await page.locator("table a").first().click();
    await expect(page.getByText("Ekip & Efor")).toBeVisible({ timeout: 10_000 });

    // Düzenle butonuna tıkla
    await page.getByRole("button", { name: "Düzenle" }).click();
    await expect(page.getByText("Projeyi Düzenle")).toBeVisible();
  });

  test("ekip ataması diyaloğu açılıyor", async ({ page }) => {
    // İlk projeyi aç
    await page.locator("table a").first().click();
    await expect(page.getByText("Ekip & Efor")).toBeVisible({ timeout: 10_000 });

    // Atama Ekle
    await page.getByRole("button", { name: "Atama Ekle" }).click();
    await expect(page.getByText("Atama Ekle / Güncelle")).toBeVisible();
    await expect(page.getByText("Ekip Üyesi")).toBeVisible();
    await expect(page.getByText("Plan (adam-gün)")).toBeVisible();
  });

  test("bütçe kırılımı sekmesi ve kalem ekleme diyaloğu", async ({ page }) => {
    // İlk projeyi aç
    await page.locator("table a").first().click();
    await expect(page.getByText("Bütçe Kırılımı")).toBeVisible({ timeout: 10_000 });

    // Bütçe sekmesine tıkla
    await page.getByText("Bütçe Kırılımı").click();

    // Tablo başlıkları
    await expect(page.getByRole("columnheader", { name: "Kategori" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Açıklama" })).toBeVisible();

    // Kalem Ekle
    await page.getByRole("button", { name: "Kalem Ekle" }).click();
    await expect(page.getByText("Bütçe Kalemi Ekle")).toBeVisible();
  });

  test("aylık finans sekmesi gösteriliyor", async ({ page }) => {
    // İlk projeyi aç
    await page.locator("table a").first().click();
    await expect(page.getByText("Aylık Finans")).toBeVisible({ timeout: 10_000 });

    // Aylık Finans sekmesine tıkla
    await page.getByText("Aylık Finans").click();

    // Gelir otomatik uyarı
    await expect(page.getByText("Gelir otomatik")).toBeVisible();
    // Yıl butonları
    await expect(page.getByRole("button", { name: /←/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /→/ })).toBeVisible();
  });

  test("fatura sekmesi ve fatura ekleme diyaloğu", async ({ page }) => {
    // İlk projeyi aç
    await page.locator("table a").first().click();
    await expect(page.getByText("Faturalar")).toBeVisible({ timeout: 10_000 });

    // Faturalar sekmesine tıkla
    await page.getByText("Faturalar").click();

    // Fatura Ekle
    await page.getByRole("button", { name: "Fatura Ekle" }).click();
    await expect(page.getByText("Fatura Ekle").nth(1)).toBeVisible();
    await expect(page.getByLabel("Açıklama")).toBeVisible();
    await expect(page.getByLabel("Tutar")).toBeVisible();
    await expect(page.getByLabel("Kesim Tarihi")).toBeVisible();
  });

  test("değişiklik geçmişi sekmesi gösteriliyor", async ({ page }) => {
    // İlk projeyi aç
    await page.locator("table a").first().click();
    await expect(page.getByText("Değişiklik Geçmişi")).toBeVisible({ timeout: 10_000 });

    // Değişiklik Geçmişi sekmesine tıkla
    await page.getByText("Değişiklik Geçmişi").click();

    // Log başlığı
    await expect(page.getByText("Tarihsel Değişiklik Logu")).toBeVisible();
  });
});
