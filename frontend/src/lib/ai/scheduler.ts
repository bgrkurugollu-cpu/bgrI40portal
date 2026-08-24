/**
 * Ollama tek bir modeli aynı anda tek istekle çalıştırır; gelen istekler
 * sıraya girer. Arka plandaki gömme işi yüzlerce istek üretebildiği için,
 * araya giren bir kullanıcı sorusu bu kuyruğun arkasında dakikalarca
 * bekleyebilir (ve Node'un fetch zaman aşımına takılır).
 *
 * Bu modül basit bir öncelik kuralı uygular: kullanıcı sorusu işlenirken
 * gömme işi duraklar, soru bitince kaldığı yerden devam eder.
 */

interface SchedulerState {
  activeChats: number;
}

const globalForScheduler = globalThis as unknown as { __aiScheduler?: SchedulerState };
const state: SchedulerState = (globalForScheduler.__aiScheduler ??= { activeChats: 0 });

/** Kullanıcı sorusu başladı — arka plan işleri beklemeye geçsin. */
export function beginInteractive(): void {
  state.activeChats++;
}

/** Kullanıcı sorusu bitti. */
export function endInteractive(): void {
  state.activeChats = Math.max(0, state.activeChats - 1);
}

export function isInteractiveActive(): boolean {
  return state.activeChats > 0;
}

/** Bir kullanıcı sorusu işleniyorsa, bitene kadar bekler. */
export async function waitForIdle(pollMs = 250): Promise<void> {
  while (state.activeChats > 0) {
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
}

/** Verilen işi "kullanıcı sorusu" olarak işaretleyerek çalıştırır. */
export async function runInteractive<T>(fn: () => Promise<T>): Promise<T> {
  beginInteractive();
  try {
    return await fn();
  } finally {
    endInteractive();
  }
}
