"use client";

import { useCallback, useRef, useState, type FormEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  Factory,
  UserCog,
  AppWindow,
  Upload,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  ShieldCheck,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import {
  createUser,
  updateUser,
  deleteUser,
  upsertFactory,
  deleteFactory,
  upsertMember,
  deleteMember,
  upsertApplication,
  deleteApplication,
} from "@/app/actions/admin";
import {
  bulkImportFactories,
  bulkImportMembers,
  bulkImportApplications,
  bulkImportProjects,
  bulkImportAssignments,
  bulkImportBudgetItems,
  bulkImportFinancials,
  bulkImportLicenses,
  bulkImportInvoices,
  type BulkResult,
} from "@/app/actions/bulk-import";
import {
  downloadTemplate,
  parseExcelFile,
  type ImportType,
  type ParsedRow,
  IMPORT_TYPE_LABELS,
  getTemplateHeaders,
} from "@/lib/excel-helpers";
import { cn, formatDate } from "@/lib/utils";

type UserRow = { id: string; name: string; email: string; role: string; createdAt: string };
type FactoryRow = {
  id: string;
  name: string;
  location: string | null;
  projectCount: number;
  licenseCount: number;
};
type MemberRow = {
  id: string;
  name: string;
  title: string | null;
  active: boolean;
  assignmentCount: number;
};
type AppRow = { id: string; name: string; vendor: string | null; licenseCount: number };

type Tab = "users" | "factories" | "members" | "applications" | "bulk";

const tabs: { id: Tab; label: string; icon: typeof Users }[] = [
  { id: "users", label: "Kullanıcılar", icon: UserCog },
  { id: "factories", label: "Fabrikalar", icon: Factory },
  { id: "members", label: "Ekip Üyeleri", icon: Users },
  { id: "applications", label: "Uygulamalar", icon: AppWindow },
  { id: "bulk", label: "Toplu Yükleme", icon: Upload },
];

export function AdminClient({
  currentUserId,
  users,
  factories,
  members,
  applications,
}: {
  currentUserId: string;
  users: UserRow[];
  factories: FactoryRow[];
  members: MemberRow[];
  applications: AppRow[];
}) {
  const [tab, setTab] = useState<Tab>("users");
  const [error, setError] = useState<string | null>(null);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Yönetim Paneli</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Kullanıcılar ve temel verilerin (fabrika, ekip, uygulama) yönetimi — yalnızca
          adminler erişebilir
        </p>
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-lg border bg-card p-1">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => {
              setTab(id);
              setError(null);
            }}
            className={cn(
              "relative flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors",
              tab === id ? "text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab === id && (
              <motion.div
                layoutId="admin-tab"
                className="absolute inset-0 rounded-md bg-accent"
                transition={{ type: "spring", stiffness: 400, damping: 32 }}
              />
            )}
            <Icon className="relative z-10 h-4 w-4" />
            <span className="relative z-10">{label}</span>
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.15 }}
        >
          {tab === "users" && (
            <UsersTab users={users} currentUserId={currentUserId} onError={setError} />
          )}
          {tab === "factories" && <FactoriesTab factories={factories} onError={setError} />}
          {tab === "members" && <MembersTab members={members} onError={setError} />}
          {tab === "applications" && (
            <ApplicationsTab applications={applications} onError={setError} />
          )}
          {tab === "bulk" && <BulkTab onError={setError} />}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}

// ── Kullanıcılar ────────────────────────────────────────

function UsersTab({
  users,
  currentUserId,
  onError,
}: {
  users: UserRow[];
  currentUserId: string;
  onError: (e: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    onError(null);
    const fd = new FormData(e.currentTarget);
    const res = editing
      ? await updateUser(editing.id, {
          name: String(fd.get("name")),
          role: fd.get("role") as "ADMIN" | "USER",
          password: (fd.get("password") as string) || undefined,
        })
      : await createUser({
          name: String(fd.get("name")),
          email: String(fd.get("email")),
          password: String(fd.get("password")),
          role: fd.get("role") as "ADMIN" | "USER",
        });
    setLoading(false);
    if (!res.ok) onError(res.error);
    else {
      setOpen(false);
      setEditing(null);
    }
  }

  async function onDelete(u: UserRow) {
    onError(null);
    if (!confirm(`${u.name} (${u.email}) silinsin mi?`)) return;
    const res = await deleteUser(u.id);
    if (!res.ok) onError(res.error);
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle>Kullanıcı Yönetimi</CardTitle>
          <CardDescription>Yeni kullanıcı ve admin tanımlayın</CardDescription>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <Plus className="h-4 w-4" /> Yeni Kullanıcı
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <THead>
            <TR>
              <TH>Ad</TH>
              <TH>E-posta</TH>
              <TH>Rol</TH>
              <TH>Kayıt Tarihi</TH>
              <TH></TH>
            </TR>
          </THead>
          <TBody>
            {users.map((u) => (
              <TR key={u.id}>
                <TD className="font-medium">
                  {u.name}
                  {u.id === currentUserId && (
                    <span className="ml-2 text-xs text-muted-foreground">(siz)</span>
                  )}
                </TD>
                <TD className="text-muted-foreground">{u.email}</TD>
                <TD>
                  <Badge tone={u.role === "ADMIN" ? "info" : "muted"}>
                    {u.role === "ADMIN" ? "Admin" : "Kullanıcı"}
                  </Badge>
                </TD>
                <TD className="text-muted-foreground">{formatDate(u.createdAt)}</TD>
                <TD>
                  <div className="flex justify-end">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Düzenle"
                      onClick={() => {
                        setEditing(u);
                        setOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {u.id !== currentUserId && (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Sil"
                        onClick={() => onDelete(u)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </CardContent>

      <Dialog
        open={open}
        onClose={() => {
          setOpen(false);
          setEditing(null);
        }}
        title={editing ? "Kullanıcıyı Düzenle" : "Yeni Kullanıcı"}
      >
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label>Ad Soyad</Label>
            <Input name="name" defaultValue={editing?.name} required />
          </div>
          {!editing && (
            <div>
              <Label>E-posta</Label>
              <Input name="email" type="email" required />
            </div>
          )}
          <div>
            <Label>{editing ? "Yeni Şifre (boş bırakılırsa değişmez)" : "Şifre"}</Label>
            <Input
              name="password"
              type="password"
              minLength={editing ? undefined : 6}
              required={!editing}
              placeholder={editing ? "••••••" : "En az 6 karakter"}
            />
          </div>
          <div>
            <Label>Rol</Label>
            <Select name="role" defaultValue={editing?.role ?? "USER"}>
              <option value="USER">Kullanıcı</option>
              <option value="ADMIN">Admin</option>
            </Select>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setOpen(false);
                setEditing(null);
              }}
            >
              Vazgeç
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {editing ? "Güncelle" : "Oluştur"}
            </Button>
          </div>
        </form>
      </Dialog>
    </Card>
  );
}

// ── Fabrikalar ──────────────────────────────────────────

function FactoriesTab({
  factories,
  onError,
}: {
  factories: FactoryRow[];
  onError: (e: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FactoryRow | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    onError(null);
    const fd = new FormData(e.currentTarget);
    const res = await upsertFactory({
      id: editing?.id,
      name: String(fd.get("name")),
      location: (fd.get("location") as string) || null,
    });
    setLoading(false);
    if (!res.ok) onError(res.error);
    else {
      setOpen(false);
      setEditing(null);
    }
  }

  async function onDelete(f: FactoryRow) {
    onError(null);
    if (!confirm(`${f.name} silinsin mi?`)) return;
    const res = await deleteFactory(f.id);
    if (!res.ok) onError(res.error);
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle>Fabrikalar</CardTitle>
          <CardDescription>Projelerin ve lisansların bağlandığı lokasyonlar</CardDescription>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <Plus className="h-4 w-4" /> Yeni Fabrika
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <THead>
            <TR>
              <TH>Ad</TH>
              <TH>Lokasyon</TH>
              <TH className="text-right">Proje</TH>
              <TH className="text-right">Lisans</TH>
              <TH></TH>
            </TR>
          </THead>
          <TBody>
            {factories.map((f) => (
              <TR key={f.id}>
                <TD className="font-medium">{f.name}</TD>
                <TD className="text-muted-foreground">{f.location ?? "—"}</TD>
                <TD className="text-right tabular-nums">{f.projectCount}</TD>
                <TD className="text-right tabular-nums">{f.licenseCount}</TD>
                <TD>
                  <div className="flex justify-end">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Düzenle"
                      onClick={() => {
                        setEditing(f);
                        setOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Sil"
                      onClick={() => onDelete(f)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </CardContent>

      <Dialog
        open={open}
        onClose={() => {
          setOpen(false);
          setEditing(null);
        }}
        title={editing ? "Fabrikayı Düzenle" : "Yeni Fabrika"}
      >
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label>Fabrika Adı</Label>
            <Input name="name" defaultValue={editing?.name} required />
          </div>
          <div>
            <Label>Lokasyon</Label>
            <Input
              name="location"
              defaultValue={editing?.location ?? ""}
              placeholder="örn. Gebze / Kocaeli"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setOpen(false);
                setEditing(null);
              }}
            >
              Vazgeç
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {editing ? "Güncelle" : "Oluştur"}
            </Button>
          </div>
        </form>
      </Dialog>
    </Card>
  );
}

// ── Ekip Üyeleri ────────────────────────────────────────

function MembersTab({
  members,
  onError,
}: {
  members: MemberRow[];
  onError: (e: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MemberRow | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    onError(null);
    const fd = new FormData(e.currentTarget);
    const res = await upsertMember({
      id: editing?.id,
      name: String(fd.get("name")),
      title: (fd.get("title") as string) || null,
      active: fd.get("active") === "on",
    });
    setLoading(false);
    if (!res.ok) onError(res.error);
    else {
      setOpen(false);
      setEditing(null);
    }
  }

  async function onDelete(m: MemberRow) {
    onError(null);
    if (!confirm(`${m.name} silinsin mi?`)) return;
    const res = await deleteMember(m.id);
    if (!res.ok) onError(res.error);
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle>Ekip Üyeleri</CardTitle>
          <CardDescription>Projelere atanan Endüstri 4.0 ekibi</CardDescription>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <Plus className="h-4 w-4" /> Yeni Üye
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <THead>
            <TR>
              <TH>Ad</TH>
              <TH>Ünvan</TH>
              <TH className="text-right">Atama Sayısı</TH>
              <TH>Durum</TH>
              <TH></TH>
            </TR>
          </THead>
          <TBody>
            {members.map((m) => (
              <TR key={m.id}>
                <TD className="font-medium">{m.name}</TD>
                <TD className="text-muted-foreground">{m.title ?? "—"}</TD>
                <TD className="text-right tabular-nums">{m.assignmentCount}</TD>
                <TD>
                  <Badge tone={m.active ? "success" : "muted"}>
                    {m.active ? "Aktif" : "Pasif"}
                  </Badge>
                </TD>
                <TD>
                  <div className="flex justify-end">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Düzenle"
                      onClick={() => {
                        setEditing(m);
                        setOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Sil"
                      onClick={() => onDelete(m)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </CardContent>

      <Dialog
        open={open}
        onClose={() => {
          setOpen(false);
          setEditing(null);
        }}
        title={editing ? "Üyeyi Düzenle" : "Yeni Ekip Üyesi"}
      >
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label>Ad Soyad</Label>
            <Input name="name" defaultValue={editing?.name} required />
          </div>
          <div>
            <Label>Ünvan</Label>
            <Input
              name="title"
              defaultValue={editing?.title ?? ""}
              placeholder="örn. SCADA Mühendisi"
            />
          </div>
          <div className="flex items-center gap-2 rounded-lg border p-3">
            <input
              id="active"
              name="active"
              type="checkbox"
              defaultChecked={editing?.active ?? true}
              className="h-4 w-4 accent-[var(--primary)]"
            />
            <label htmlFor="active" className="text-sm font-medium">
              Aktif (kaynak planında görünür)
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setOpen(false);
                setEditing(null);
              }}
            >
              Vazgeç
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {editing ? "Güncelle" : "Oluştur"}
            </Button>
          </div>
        </form>
      </Dialog>
    </Card>
  );
}

// ── Uygulamalar ─────────────────────────────────────────

function ApplicationsTab({
  applications,
  onError,
}: {
  applications: AppRow[];
  onError: (e: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AppRow | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    onError(null);
    const fd = new FormData(e.currentTarget);
    const res = await upsertApplication({
      id: editing?.id,
      name: String(fd.get("name")),
      vendor: (fd.get("vendor") as string) || null,
    });
    setLoading(false);
    if (!res.ok) onError(res.error);
    else {
      setOpen(false);
      setEditing(null);
    }
  }

  async function onDelete(a: AppRow) {
    onError(null);
    if (!confirm(`${a.name} silinsin mi?`)) return;
    const res = await deleteApplication(a.id);
    if (!res.ok) onError(res.error);
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle>Uygulamalar</CardTitle>
          <CardDescription>Lisansların bağlandığı yazılım/uygulama tanımları</CardDescription>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <Plus className="h-4 w-4" /> Yeni Uygulama
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <THead>
            <TR>
              <TH>Ad</TH>
              <TH>Üretici</TH>
              <TH className="text-right">Lisans Sayısı</TH>
              <TH></TH>
            </TR>
          </THead>
          <TBody>
            {applications.map((a) => (
              <TR key={a.id}>
                <TD className="font-medium">{a.name}</TD>
                <TD className="text-muted-foreground">{a.vendor ?? "—"}</TD>
                <TD className="text-right tabular-nums">{a.licenseCount}</TD>
                <TD>
                  <div className="flex justify-end">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Düzenle"
                      onClick={() => {
                        setEditing(a);
                        setOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Sil"
                      onClick={() => onDelete(a)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </CardContent>

      <Dialog
        open={open}
        onClose={() => {
          setOpen(false);
          setEditing(null);
        }}
        title={editing ? "Uygulamayı Düzenle" : "Yeni Uygulama"}
      >
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label>Uygulama Adı</Label>
            <Input name="name" defaultValue={editing?.name} required />
          </div>
          <div>
            <Label>Üretici</Label>
            <Input
              name="vendor"
              defaultValue={editing?.vendor ?? ""}
              placeholder="örn. Inductive Automation"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setOpen(false);
                setEditing(null);
              }}
            >
              Vazgeç
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {editing ? "Güncelle" : "Oluştur"}
            </Button>
          </div>
        </form>
      </Dialog>
    </Card>
  );
}

// ── Toplu Yükleme (Initial Load) ────────────────────────

const IMPORT_ACTIONS: Record<ImportType, (rows: ParsedRow[]) => Promise<BulkResult>> = {
  factories: bulkImportFactories,
  members: bulkImportMembers,
  applications: bulkImportApplications,
  projects: bulkImportProjects,
  assignments: bulkImportAssignments,
  budgetItems: bulkImportBudgetItems,
  financials: bulkImportFinancials,
  licenses: bulkImportLicenses,
  invoices: bulkImportInvoices,
};

const IMPORT_ORDER: ImportType[] = [
  "factories",
  "members",
  "applications",
  "projects",
  "assignments",
  "budgetItems",
  "financials",
  "licenses",
  "invoices",
];

function BulkTab({ onError }: { onError: (e: string | null) => void }) {
  const [importType, setImportType] = useState<ImportType>("factories");
  const [parsedData, setParsedData] = useState<{ headers: string[]; rows: ParsedRow[] } | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [bulkResult, setBulkResult] = useState<BulkResult | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const resetState = useCallback(() => {
    setParsedData(null);
    setFileName(null);
    setBulkResult(null);
    onError(null);
  }, [onError]);

  async function handleFile(file: File) {
    resetState();
    try {
      const data = await parseExcelFile(file);
      // Başlık doğrulaması
      const expected = getTemplateHeaders(importType);
      const missing = expected.filter((h) => !data.headers.includes(h));
      if (missing.length > 0) {
        onError(
          `Eksik sütunlar: ${missing.join(", ")}. Lütfen doğru şablonu kullanın.`
        );
        return;
      }
      setParsedData(data);
      setFileName(file.name);
    } catch (err) {
      onError((err as Error).message);
    }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  }

  async function onImport() {
    if (!parsedData) return;
    setLoading(true);
    setBulkResult(null);
    onError(null);
    try {
      const action = IMPORT_ACTIONS[importType];
      const res = await action(parsedData.rows);
      setBulkResult(res);
    } catch (err) {
      onError((err as Error).message);
    }
    setLoading(false);
  }

  const previewRows = parsedData ? parsedData.rows.slice(0, 5) : [];

  return (
    <div className="space-y-5">
      {/* Sıra uyarısı */}
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
        <div className="flex items-center gap-2 font-medium text-amber-700 dark:text-amber-400">
          <AlertTriangle className="h-4 w-4" />
          Yükleme sırası önemlidir
        </div>
        <div className="mt-1 flex flex-wrap gap-x-1 gap-y-0.5 text-muted-foreground">
          {IMPORT_ORDER.map((t, i) => (
            <span key={t}>
              <span className="font-medium text-foreground">{i + 1}.</span>{" "}
              {IMPORT_TYPE_LABELS[t]}
              {i < IMPORT_ORDER.length - 1 && <span className="mx-1">→</span>}
            </span>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Excel ile Toplu Veri Yükleme
          </CardTitle>
          <CardDescription>
            Şablonu indirin, verilerinizi doldurun ve sisteme yükleyin.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Adım 1: Veri tipi ve şablon */}
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[200px]">
              <Label>Veri Tipi</Label>
              <Select
                value={importType}
                onChange={(e) => {
                  setImportType(e.target.value as ImportType);
                  resetState();
                }}
              >
                {IMPORT_ORDER.map((t) => (
                  <option key={t} value={t}>
                    {IMPORT_TYPE_LABELS[t]}
                  </option>
                ))}
              </Select>
            </div>
            <Button
              variant="outline"
              onClick={() => downloadTemplate(importType)}
            >
              <Download className="h-4 w-4" />
              Şablon İndir (.xlsx)
            </Button>
          </div>

          {/* Adım 2: Dosya yükleme */}
          <div
            className={cn(
              "relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 transition-colors",
              dragging
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25 hover:border-primary/50"
            )}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
          >
            <Upload
              className={cn(
                "h-10 w-10",
                dragging ? "text-primary" : "text-muted-foreground/50"
              )}
            />
            <div className="text-center">
              <p className="text-sm font-medium">
                {fileName ? (
                  <>
                    <FileSpreadsheet className="mr-1 inline h-4 w-4 text-green-600" />
                    {fileName}
                  </>
                ) : (
                  "Excel dosyanızı sürükleyip bırakın"
                )}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                veya{" "}
                <button
                  type="button"
                  className="font-medium text-primary underline"
                  onClick={() => inputRef.current?.click()}
                >
                  dosya seçin
                </button>{" "}
                (.xlsx, .xls, .csv)
              </p>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={onFileChange}
            />
          </div>

          {/* Adım 3: Ön izleme */}
          {parsedData && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">
                  Ön İzleme ({parsedData.rows.length} satır)
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetState}
                  className="text-muted-foreground"
                >
                  <XCircle className="h-4 w-4" /> Temizle
                </Button>
              </div>
              <div className="max-h-64 overflow-auto rounded-lg border">
                <Table>
                  <THead>
                    <TR>
                      <TH className="w-10 text-center">#</TH>
                      {parsedData.headers.map((h) => (
                        <TH key={h}>{h}</TH>
                      ))}
                    </TR>
                  </THead>
                  <TBody>
                    {previewRows.map((row, i) => (
                      <TR key={i}>
                        <TD className="text-center text-muted-foreground">
                          {i + 1}
                        </TD>
                        {parsedData.headers.map((h) => (
                          <TD key={h} className="text-xs">
                            {row[h] != null ? String(row[h]) : "—"}
                          </TD>
                        ))}
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </div>
              {parsedData.rows.length > 5 && (
                <p className="text-xs text-muted-foreground">
                  … ve {parsedData.rows.length - 5} satır daha
                </p>
              )}

              <div className="flex justify-end">
                <Button onClick={onImport} disabled={loading}>
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  {parsedData.rows.length} satırı yükle
                </Button>
              </div>
            </div>
          )}

          {/* Adım 4: Sonuç raporu */}
          {bulkResult && (
            <div className="space-y-3 rounded-lg border p-4">
              <h3 className="text-sm font-semibold">Yükleme Sonucu</h3>
              <div className="flex flex-wrap gap-3">
                <div className="flex items-center gap-2 rounded-md bg-green-500/10 px-3 py-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="font-semibold text-green-700 dark:text-green-400">
                    {bulkResult.inserted}
                  </span>{" "}
                  eklendi
                </div>
                {bulkResult.updated > 0 && (
                  <div className="flex items-center gap-2 rounded-md bg-blue-500/10 px-3 py-2 text-sm">
                    <RefreshCw className="h-4 w-4 text-blue-600" />
                    <span className="font-semibold text-blue-700 dark:text-blue-400">
                      {bulkResult.updated}
                    </span>{" "}
                    güncellendi (zaten vardı)
                  </div>
                )}
                {bulkResult.skipped > 0 && (
                  <div className="flex items-center gap-2 rounded-md bg-amber-500/10 px-3 py-2 text-sm">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <span className="font-semibold text-amber-700 dark:text-amber-400">
                      {bulkResult.skipped}
                    </span>{" "}
                    atlandı (zaten var)
                  </div>
                )}
                {bulkResult.errors.length > 0 && (
                  <div className="flex items-center gap-2 rounded-md bg-red-500/10 px-3 py-2 text-sm">
                    <XCircle className="h-4 w-4 text-red-600" />
                    <span className="font-semibold text-red-700 dark:text-red-400">
                      {bulkResult.errors.length}
                    </span>{" "}
                    hata
                  </div>
                )}
              </div>
              {bulkResult.errors.length > 0 && (
                <div className="max-h-48 overflow-auto rounded-lg border border-destructive/30 bg-destructive/5">
                  <Table>
                    <THead>
                      <TR>
                        <TH className="w-16">Satır</TH>
                        <TH>Hata</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {bulkResult.errors.map((err, i) => (
                        <TR key={i}>
                          <TD className="font-medium text-destructive">
                            {err.row}
                          </TD>
                          <TD className="text-xs text-muted-foreground">
                            {err.message}
                          </TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
