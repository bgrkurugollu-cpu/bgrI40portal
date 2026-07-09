"use client";

import { useMemo, useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import {
  Plus,
  Pencil,
  Trash2,
  KeyRound,
  Banknote,
  RefreshCcw,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { MultiSelect } from "@/components/ui/multi-select";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { createLicense, updateLicense, deleteLicense, createApplication } from "@/app/actions/licenses";
import type { ApplicationDTO, FactoryDTO, LicenseDTO, RatesDTO } from "@/lib/types";
import { RatesBanner } from "@/app/finance/finance-client";
import {
  CURRENCIES,
  CURRENCY_LABELS,
  CurrencyCode,
  formatDate,
  formatMoney,
  LICENSE_STATUS_LABELS,
  PERIOD_LABELS,
} from "@/lib/utils";

// Yıllık abonelik maliyetinin TL karşılığı (raporlama toplamları için).
function yearlyCostTRY(l: LicenseDTO) {
  if (!l.isSubscription) return 0;
  switch (l.paymentPeriod) {
    case "MONTHLY":
      return l.subscriptionCostTRY * 12;
    case "QUARTERLY":
      return l.subscriptionCostTRY * 4;
    default:
      return l.subscriptionCostTRY;
  }
}

export function LicensesClient({
  licenses,
  applications,
  factories,
  rates,
}: {
  licenses: LicenseDTO[];
  applications: ApplicationDTO[];
  factories: FactoryDTO[];
  rates: RatesDTO;
}) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<LicenseDTO | null>(null);
  const [factoryFilter, setFactoryFilter] = useState("all");
  const [applicationFilter, setApplicationFilter] = useState("all");

  const filtered = useMemo(
    () =>
      licenses.filter(
        (l) =>
          (factoryFilter === "all" || l.factoryIds.includes(factoryFilter)) &&
          (applicationFilter === "all" || l.applicationId === applicationFilter)
      ),
    [licenses, factoryFilter, applicationFilter]
  );

  const totalInvestment = filtered.reduce((s, l) => s + l.totalInvestmentTRY, 0);
  const totalYearlySub = filtered.reduce((s, l) => s + yearlyCostTRY(l), 0);
  const expiringSoon = filtered.filter(
    (l) =>
      l.renewalDate &&
      new Date(l.renewalDate).getTime() - Date.now() < 60 * 24 * 3600 * 1000 &&
      l.status !== "CANCELLED"
  );

  const tone = (s: string) =>
    s === "ACTIVE"
      ? "success"
      : s === "EXPIRING"
        ? "warning"
        : s === "EXPIRED"
          ? "destructive"
          : "muted";

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Lisans & Key Yönetimi</h1>
          <p className="text-sm text-muted-foreground">
            Uygulama lisansları, abonelikler ve yenileme takibi
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            className="w-44"
            value={applicationFilter}
            onChange={(e) => setApplicationFilter(e.target.value)}
          >
            <option value="all">Tüm Uygulamalar</option>
            {applications.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
          <Select
            className="w-44"
            value={factoryFilter}
            onChange={(e) => setFactoryFilter(e.target.value)}
          >
            <option value="all">Tüm Fabrikalar</option>
            {factories.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </Select>
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> Yeni Lisans
          </Button>
        </div>
      </div>

      <RatesBanner rates={rates} />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Kpi icon={KeyRound} label="Toplam Lisans" value={String(filtered.length)} />
        <Kpi icon={Banknote} label="Toplam Yatırım (TL)" value={formatMoney(totalInvestment)} />
        <Kpi icon={RefreshCcw} label="Yıllık Abonelik (TL)" value={formatMoney(totalYearlySub)} />
        <Kpi
          icon={AlertTriangle}
          label="60 Gün İçinde Yenileme"
          value={String(expiringSoon.length)}
          warn={expiringSoon.length > 0}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lisans Envanteri</CardTitle>
          <CardDescription>
            Lokasyon, maliyet ve durum bilgileriyle tüm lisanslar
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR>
                <TH>Uygulama</TH>
                <TH>Lisans Key</TH>
                <TH>Fabrika</TH>
                <TH className="text-right">Yatırım</TH>
                <TH>Abonelik</TH>
                <TH>Yenileme</TH>
                <TH>Durum</TH>
                <TH></TH>
              </TR>
            </THead>
            <TBody>
              {filtered.map((l) => (
                <TR key={l.id}>
                  <TD>
                    <div className="font-medium">{l.applicationName}</div>
                    <div className="text-xs text-muted-foreground">
                      {l.vendor ?? ""}
                      {l.description ? ` · ${l.description}` : ""}
                    </div>
                  </TD>
                  <TD>
                    <code className="rounded bg-muted px-2 py-0.5 text-xs">{l.licenseKey}</code>
                  </TD>
                  <TD className="text-muted-foreground">{l.factoryNames.join(", ")}</TD>
                  <TD className="text-right font-medium">
                    {formatMoney(l.totalInvestment, l.currency)}
                    {l.currency !== "TRY" && (
                      <div className="text-xs font-normal text-muted-foreground">
                        ≈ {formatMoney(l.totalInvestmentTRY)}
                      </div>
                    )}
                  </TD>
                  <TD>
                    {l.isSubscription ? (
                      <div className="text-sm">
                        {formatMoney(l.subscriptionCost, l.currency)}
                        <span className="text-xs text-muted-foreground">
                          {" "}
                          / {PERIOD_LABELS[l.paymentPeriod]}
                        </span>
                      </div>
                    ) : (
                      <Badge tone="muted">Tek seferlik</Badge>
                    )}
                  </TD>
                  <TD className="text-muted-foreground">{formatDate(l.renewalDate)}</TD>
                  <TD>
                    <Badge tone={tone(l.status)}>{LICENSE_STATUS_LABELS[l.status]}</Badge>
                  </TD>
                  <TD>
                    <div className="flex">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Düzenle"
                        onClick={() => setEditing(l)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Sil"
                        onClick={() => deleteLicense(l.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TD>
                </TR>
              ))}
              {filtered.length === 0 && (
                <TR>
                  <TD colSpan={8} className="py-10 text-center text-muted-foreground">
                    Lisans kaydı bulunamadı.
                  </TD>
                </TR>
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={creating} onClose={() => setCreating(false)} title="Yeni Lisans" wide>
        <LicenseForm
          applications={applications}
          factories={factories}
          onDone={() => setCreating(false)}
        />
      </Dialog>
      <Dialog open={!!editing} onClose={() => setEditing(null)} title="Lisansı Düzenle" wide>
        {editing && (
          <LicenseForm
            applications={applications}
            factories={factories}
            license={editing}
            onDone={() => setEditing(null)}
          />
        )}
      </Dialog>
    </motion.div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  warn,
}: {
  icon: typeof KeyRound;
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-lg ${
            warn ? "bg-warning/20 text-warning" : "bg-accent text-primary"
          }`}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </div>
          <div className="text-lg font-bold">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function LicenseForm({
  applications,
  factories,
  license,
  onDone,
}: {
  applications: ApplicationDTO[];
  factories: FactoryDTO[];
  license?: LicenseDTO;
  onDone: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [isSub, setIsSub] = useState(license?.isSubscription ?? false);
  const [newApp, setNewApp] = useState(false);
  const [factoryIds, setFactoryIds] = useState<string[]>(license?.factoryIds ?? []);
  const [factoryError, setFactoryError] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (factoryIds.length === 0) {
      setFactoryError(true);
      return;
    }
    setFactoryError(false);
    setLoading(true);
    const fd = new FormData(e.currentTarget);

    let applicationId = String(fd.get("applicationId") ?? "");
    if (newApp) {
      const created = await createApplication({
        name: String(fd.get("appName")),
        vendor: (fd.get("appVendor") as string) || null,
      });
      applicationId = created.id;
    }

    const input = {
      applicationId,
      factoryIds,
      licenseKey: String(fd.get("licenseKey")),
      description: (fd.get("description") as string) || null,
      totalInvestment: Number(fd.get("totalInvestment")),
      isSubscription: isSub,
      subscriptionCost: isSub ? Number(fd.get("subscriptionCost")) : 0,
      currency: fd.get("currency") as CurrencyCode,
      paymentPeriod: (isSub ? fd.get("paymentPeriod") : "ONE_TIME") as never,
      renewalDate: (fd.get("renewalDate") as string) || null,
      status: fd.get("status") as never,
    };
    try {
      if (license) await updateLicense(license.id, input);
      else await createLicense(input);
      onDone();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <div className="mb-1.5 flex items-center justify-between">
            <Label className="mb-0">Uygulama</Label>
            {!license && (
              <button
                type="button"
                className="text-xs font-medium text-primary hover:underline"
                onClick={() => setNewApp((v) => !v)}
              >
                {newApp ? "Mevcut uygulamalardan seç" : "+ Yeni uygulama ekle"}
              </button>
            )}
          </div>
          {newApp ? (
            <div className="grid grid-cols-2 gap-2">
              <Input name="appName" placeholder="Uygulama adı" required />
              <Input name="appVendor" placeholder="Üretici (opsiyonel)" />
            </div>
          ) : (
            <Select name="applicationId" defaultValue={license?.applicationId} required>
              {applications.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} {a.vendor ? `— ${a.vendor}` : ""}
                </option>
              ))}
            </Select>
          )}
        </div>
        <div>
          <Label>Fabrika(lar)</Label>
          <MultiSelect
            options={factories.map((f) => ({ value: f.id, label: f.name }))}
            selected={factoryIds}
            onChange={(v) => {
              setFactoryIds(v);
              if (v.length > 0) setFactoryError(false);
            }}
            placeholder="Fabrika seçin"
          />
          {factoryError && (
            <p className="mt-1 text-xs text-destructive">En az bir fabrika seçilmelidir.</p>
          )}
        </div>
        <div>
          <Label>Lisans Key</Label>
          <Input name="licenseKey" defaultValue={license?.licenseKey} required />
        </div>
        <div className="col-span-2">
          <Label>Açıklama</Label>
          <Input
            name="description"
            defaultValue={license?.description ?? ""}
            placeholder="örn. Unlimited tags, MES sunucusu"
          />
        </div>
        <div>
          <Label>Toplam Yatırım</Label>
          <Input
            name="totalInvestment"
            type="number"
            step="0.01"
            min={0}
            defaultValue={license?.totalInvestment ?? 0}
            required
          />
        </div>
        <div>
          <Label>Para Birimi</Label>
          <Select name="currency" defaultValue={license?.currency ?? "TRY"}>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {CURRENCY_LABELS[c]}
              </option>
            ))}
          </Select>
        </div>
        <div className="col-span-2">
          <Label>Durum</Label>
          <Select name="status" defaultValue={license?.status ?? "ACTIVE"}>
            {Object.entries(LICENSE_STATUS_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        </div>
        <div className="col-span-2 flex items-center gap-2 rounded-lg border p-3">
          <input
            id="isSub"
            type="checkbox"
            checked={isSub}
            onChange={(e) => setIsSub(e.target.checked)}
            className="h-4 w-4 accent-[var(--primary)]"
          />
          <label htmlFor="isSub" className="text-sm font-medium">
            Abonelik (subscription) lisansı
          </label>
        </div>
        {isSub && (
          <>
            <div>
              <Label>Abonelik Bedeli</Label>
              <Input
                name="subscriptionCost"
                type="number"
                step="0.01"
                min={0}
                defaultValue={license?.subscriptionCost ?? 0}
                required
              />
            </div>
            <div>
              <Label>Ödeme Periyodu</Label>
              <Select
                name="paymentPeriod"
                defaultValue={
                  license?.paymentPeriod && license.paymentPeriod !== "ONE_TIME"
                    ? license.paymentPeriod
                    : "YEARLY"
                }
              >
                <option value="MONTHLY">Aylık</option>
                <option value="QUARTERLY">3 Aylık</option>
                <option value="YEARLY">Yıllık</option>
              </Select>
            </div>
          </>
        )}
        <div>
          <Label>Yenileme Tarihi</Label>
          <Input name="renewalDate" type="date" defaultValue={license?.renewalDate ?? ""} />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone}>
          Vazgeç
        </Button>
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {license ? "Güncelle" : "Oluştur"}
        </Button>
      </div>
    </form>
  );
}
