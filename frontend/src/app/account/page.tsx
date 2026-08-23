"use client";

import { useState, type FormEvent } from "react";
import { KeyRound, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changeOwnPassword } from "@/app/actions/account";

export default function AccountPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (newPassword !== confirmPassword) {
      setError("Yeni şifreler eşleşmiyor.");
      return;
    }

    setLoading(true);
    const result = await changeOwnPassword({ currentPassword, newPassword });
    setLoading(false);

    if (result.ok) {
      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } else {
      setError(result.error);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <KeyRound className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-lg font-bold">Hesabım</h1>
          <p className="text-sm text-muted-foreground">Şifreni değiştir</p>
        </div>
      </div>

      <form
        onSubmit={onSubmit}
        className="space-y-4 rounded-xl border bg-card p-6 shadow-sm"
      >
        <div>
          <Label htmlFor="currentPassword">Mevcut Şifre</Label>
          <Input
            id="currentPassword"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
            required
            autoFocus
          />
        </div>
        <div>
          <Label htmlFor="newPassword">Yeni Şifre</Label>
          <Input
            id="newPassword"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            required
            minLength={6}
          />
        </div>
        <div>
          <Label htmlFor="confirmPassword">Yeni Şifre (Tekrar)</Label>
          <Input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            required
            minLength={6}
          />
        </div>

        {error && (
          <p className="text-sm font-medium text-destructive">{error}</p>
        )}
        {success && (
          <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-600">
            <CheckCircle2 className="h-4 w-4" />
            Şifreniz güncellendi.
          </p>
        )}

        <Button type="submit" disabled={loading} className="w-full">
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Şifreyi Güncelle
        </Button>
      </form>
    </div>
  );
}
