"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

async function requireAdmin() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") throw new Error("Yetkisiz");
  return session;
}

type Result = { ok: true } | { ok: false; error: string };

// ── Kullanıcı Yönetimi ──────────────────────────────────

export async function createUser(input: {
  name: string;
  email: string;
  password: string;
  role: "ADMIN" | "USER";
}): Promise<Result> {
  await requireAdmin();
  if (input.password.length < 6)
    return { ok: false, error: "Şifre en az 6 karakter olmalı." };

  const exists = await prisma.user.findUnique({ where: { email: input.email } });
  if (exists) return { ok: false, error: "Bu e-posta zaten kayıtlı." };

  await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      role: input.role,
      passwordHash: await bcrypt.hash(input.password, 10),
    },
  });
  revalidatePath("/admin");
  return { ok: true };
}

export async function updateUser(
  id: string,
  input: { name: string; role: "ADMIN" | "USER"; password?: string }
): Promise<Result> {
  const session = await requireAdmin();
  if (id === session.sub && input.role !== "ADMIN")
    return { ok: false, error: "Kendi admin yetkinizi kaldıramazsınız." };

  await prisma.user.update({
    where: { id },
    data: {
      name: input.name,
      role: input.role,
      ...(input.password
        ? { passwordHash: await bcrypt.hash(input.password, 10) }
        : {}),
    },
  });
  revalidatePath("/admin");
  return { ok: true };
}

export async function deleteUser(id: string): Promise<Result> {
  const session = await requireAdmin();
  if (id === session.sub)
    return { ok: false, error: "Kendi hesabınızı silemezsiniz." };
  await prisma.user.delete({ where: { id } });
  revalidatePath("/admin");
  return { ok: true };
}

// ── Fabrikalar ──────────────────────────────────────────

export async function upsertFactory(input: {
  id?: string;
  name: string;
  location: string | null;
}): Promise<Result> {
  await requireAdmin();
  try {
    if (input.id) {
      await prisma.factory.update({
        where: { id: input.id },
        data: { name: input.name, location: input.location },
      });
    } else {
      await prisma.factory.create({
        data: { name: input.name, location: input.location },
      });
    }
  } catch {
    return { ok: false, error: "Bu isimde bir fabrika zaten var." };
  }
  revalidatePath("/admin");
  return { ok: true };
}

export async function deleteFactory(id: string): Promise<Result> {
  await requireAdmin();
  try {
    await prisma.factory.delete({ where: { id } });
  } catch {
    return {
      ok: false,
      error: "Bu fabrikaya bağlı proje veya lisans var; önce onları taşıyın/silin.",
    };
  }
  revalidatePath("/admin");
  return { ok: true };
}

// ── Ekip Üyeleri ────────────────────────────────────────

export async function upsertMember(input: {
  id?: string;
  name: string;
  title: string | null;
  active: boolean;
}): Promise<Result> {
  await requireAdmin();
  if (input.id) {
    await prisma.teamMember.update({
      where: { id: input.id },
      data: input,
    });
  } else {
    await prisma.teamMember.create({
      data: { name: input.name, title: input.title, active: input.active },
    });
  }
  revalidatePath("/admin");
  revalidatePath("/resources");
  return { ok: true };
}

export async function deleteMember(id: string): Promise<Result> {
  await requireAdmin();
  try {
    await prisma.teamMember.delete({ where: { id } });
  } catch {
    return {
      ok: false,
      error:
        "Bu üyenin proje atamaları var; silmek yerine pasife alın veya önce atamaları silin.",
    };
  }
  revalidatePath("/admin");
  revalidatePath("/resources");
  return { ok: true };
}

// ── Uygulamalar ─────────────────────────────────────────

export async function upsertApplication(input: {
  id?: string;
  name: string;
  vendor: string | null;
}): Promise<Result> {
  await requireAdmin();
  try {
    if (input.id) {
      await prisma.application.update({
        where: { id: input.id },
        data: { name: input.name, vendor: input.vendor },
      });
    } else {
      await prisma.application.create({
        data: { name: input.name, vendor: input.vendor },
      });
    }
  } catch {
    return { ok: false, error: "Bu isimde bir uygulama zaten var." };
  }
  revalidatePath("/admin");
  revalidatePath("/licenses");
  return { ok: true };
}

export async function deleteApplication(id: string): Promise<Result> {
  await requireAdmin();
  try {
    await prisma.application.delete({ where: { id } });
  } catch {
    return {
      ok: false,
      error: "Bu uygulamaya bağlı lisans kayıtları var; önce onları silin.",
    };
  }
  revalidatePath("/admin");
  revalidatePath("/licenses");
  return { ok: true };
}
