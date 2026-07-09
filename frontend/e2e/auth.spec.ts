import { test, expect } from "@playwright/test";
import { login, logout, TEST_USER } from "./helpers/auth";

test.describe("Kimlik Doğrulama (Auth)", () => {
  test("giriş yapmadan korumalı sayfalara erişim → login'e yönlendirme", async ({
    page,
  }) => {
    // Dashboard'a git
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);

    // Projeler sayfasına git
    await page.goto("/projects");
    await expect(page).toHaveURL(/\/login/);

    // Admin sayfasına git
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login/);
  });

  test("yanlış şifre ile giriş → hata mesajı", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("E-posta").fill(TEST_USER.email);
    await page.getByLabel("Şifre").fill("yanlis-sifre");
    await page.getByRole("button", { name: "Giriş Yap" }).click();

    // Hata mesajı gösterilmeli
    await expect(page.getByText("E-posta veya şifre hatalı")).toBeVisible({
      timeout: 10_000,
    });
    // Hala login sayfasındayız
    await expect(page).toHaveURL(/\/login/);
  });

  test("doğru bilgiyle giriş → dashboard", async ({ page }) => {
    await login(page);
    // Dashboard yüklendi
    await expect(page.getByRole("heading", { name: "Genel Bakış" })).toBeVisible();
  });

  test("çıkış yapma → login sayfasına dönüş", async ({ page }) => {
    await login(page);
    await logout(page);
    await expect(page).toHaveURL(/\/login/);
  });

  test("giriş yapılmışken /login sayfasına gitmek → dashboard'a yönlendirme", async ({
    page,
  }) => {
    await login(page);
    await page.goto("/login");
    await expect(page).toHaveURL("/");
  });
});
