import { type Page, expect } from "@playwright/test";

/**
 * E2E testlerinde yeniden kullanılan login yardımcı fonksiyonu.
 * Seed veritabanındaki admin kullanıcısı ile giriş yapar.
 */
export const TEST_USER = {
  email: "admin@bgr.local",
  password: "admin123",
  name: "Yönetici",
  role: "ADMIN",
};

/**
 * Login sayfasından giriş yapar ve dashboard'a yönlendirilmeyi bekler.
 */
export async function login(page: Page, user = TEST_USER) {
  await page.goto("/login");
  await page.getByLabel("E-posta").fill(user.email);
  await page.getByLabel("Şifre").fill(user.password);
  await page.getByRole("button", { name: "Giriş Yap" }).click();

  // Dashboard'a yönlendirilmeyi bekle
  await expect(page).toHaveURL("/", { timeout: 15_000 });
  // Dashboard başlığı yüklenene kadar bekle
  await expect(page.getByRole("heading", { name: "Genel Bakış" })).toBeVisible({
    timeout: 15_000,
  });
}

/**
 * Çıkış yapar ve login sayfasına dönüşü doğrular.
 */
export async function logout(page: Page) {
  // Sidebar'daki kullanıcı menüsünü aç
  await page.getByText(TEST_USER.name).click();
  await page.getByText("Çıkış Yap").click();
  await expect(page).toHaveURL("/login", { timeout: 10_000 });
}
