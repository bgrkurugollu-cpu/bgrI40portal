"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

type Result = { ok: true } | { ok: false; error: string };

export async function changeOwnPassword(input: {
  currentPassword: string;
  newPassword: string;
}): Promise<Result> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Oturum bulunamadı." };

  if (input.newPassword.length < 6)
    return { ok: false, error: "Yeni şifre en az 6 karakter olmalı." };

  const user = await prisma.user.findUnique({ where: { id: session.sub } });
  if (!user) return { ok: false, error: "Kullanıcı bulunamadı." };

  const valid = await bcrypt.compare(input.currentPassword, user.passwordHash);
  if (!valid) return { ok: false, error: "Mevcut şifre yanlış." };

  await prisma.user.update({
    where: { id: session.sub },
    data: { passwordHash: await bcrypt.hash(input.newPassword, 10) },
  });
  return { ok: true };
}
