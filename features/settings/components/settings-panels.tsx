"use client";

import {
  Check,
  KeyRound,
  Lock,
  MonitorSmartphone,
  Plus,
  Store,
  UserPlus,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { useAppForm } from "@/components/form/app-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { TrustDeviceButton } from "@/features/auth/components/trust-device-button";
import { useRouter } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";
import { useDateTime } from "@/lib/format";
import { useErrorMessage } from "@/lib/use-error-message";
import {
  createShop,
  createStaff,
  resetStaffPin,
  revokeDevice,
  updateStaff,
} from "../actions";
import {
  issuesToFields,
  type SettingsBundle,
  useInvalidateSettings,
} from "../hooks";
import {
  changePasswordSchema,
  createShopSchema,
  createStaffSchema,
  STAFF_ROLES,
} from "../schemas";

function useRun(orgId: string) {
  const errorMessage = useErrorMessage();
  const invalidate = useInvalidateSettings(orgId);
  return async (
    p: Promise<
      | { ok: true }
      | { ok: false; code: string; details?: Record<string, string | number> }
    >,
    success: string,
  ) => {
    const r = await p;
    if (!r.ok) {
      toast.error(errorMessage(r.code, r.details));
      return false;
    }
    toast.success(success);
    invalidate();
    return true;
  };
}

// ---------- Staff ----------

export function StaffPanel({
  orgId,
  data,
}: {
  orgId: string;
  data: SettingsBundle;
}) {
  const t = useTranslations("settings");
  const tr = useTranslations("roles");
  const run = useRun(orgId);
  const [adding, setAdding] = useState(false);
  const [pinFor, setPinFor] = useState<{ id: string; name: string } | null>(
    null,
  );
  const [pin, setPin] = useState("");
  const active = data.staff.filter((s) => s.isActive).length;
  const max = data.entitlements.limits.maxStaffPerShop;
  const atStaffLimit = max !== null && active >= max;

  const form = useAppForm({
    defaultValues: {
      name: "",
      role: "cashier" as (typeof STAFF_ROLES)[number],
      pin: "",
    },
    validators: {
      onSubmit: ({ value }) => {
        const r = createStaffSchema.safeParse(value);
        return r.success ? undefined : issuesToFields(r.error.issues);
      },
    },
    onSubmit: async ({ value, formApi }) => {
      if (await run(createStaff(value), t("staffCreated"))) {
        formApi.reset();
        setAdding(false);
      }
    },
  });

  return (
    <div className="grid max-w-3xl gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-muted-foreground text-sm">
          {t("staffUsage", { count: active, max: max ?? "∞" })}
        </p>
        <Button
          className="ml-auto h-11 rounded-full"
          disabled={atStaffLimit}
          onClick={() => setAdding(true)}
        >
          <UserPlus className="size-4" /> {t("addStaff")}
        </Button>
      </div>
      {atStaffLimit && (
        <p className="rounded-xl bg-gold-soft p-3 text-gold-text text-sm">
          {t("limitReached")}
        </p>
      )}
      {data.staff.length === 0 ? (
        <EmptyState title={t("noStaff")} description={t("noStaffHint")} />
      ) : (
        <ul className="grid gap-2">
          {data.staff.map((s) => (
            <li
              key={s.id}
              className="flex flex-wrap items-center gap-3 rounded-2xl border bg-card p-3 shadow-card"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium">{s.name}</p>
                <p className="flex items-center gap-2 text-muted-foreground text-xs">
                  {!s.isActive && (
                    <Badge variant="outline" className="rounded-full">
                      {t("inactive")}
                    </Badge>
                  )}
                  {s.lockedUntil && new Date(s.lockedUntil) > new Date() && (
                    <span className="inline-flex items-center gap-1 text-primary">
                      <Lock className="size-3" /> {t("locked")}
                    </span>
                  )}
                </p>
              </div>
              <Select
                value={s.role}
                onValueChange={(role) =>
                  run(updateStaff({ userId: s.id, role }), t("saved"))
                }
              >
                <SelectTrigger
                  className="h-10 w-36 rounded-full"
                  aria-label={t("role")}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STAFF_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {tr(r)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                className="h-10 rounded-full"
                onClick={() => setPinFor({ id: s.id, name: s.name })}
              >
                <KeyRound className="size-4" /> {t("resetPin")}
              </Button>
              <div className="flex items-center gap-2">
                <Switch
                  checked={s.isActive}
                  aria-label={t("active")}
                  onCheckedChange={(isActive) =>
                    run(updateStaff({ userId: s.id, isActive }), t("saved"))
                  }
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle>{t("addStaff")}</DialogTitle>
          </DialogHeader>
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              form.handleSubmit();
            }}
            className="grid gap-4"
          >
            <form.AppField name="name">
              {(f) => <f.TextField label={t("staffName")} />}
            </form.AppField>
            <form.AppField name="role">
              {(f) => (
                <f.SelectField
                  label={t("role")}
                  options={STAFF_ROLES.map((r) => ({ value: r, label: tr(r) }))}
                />
              )}
            </form.AppField>
            <form.AppField name="pin">
              {(f) => (
                <f.TextField
                  label={t("pin")}
                  inputMode="numeric"
                  type="password"
                  autoComplete="new-password"
                  hint={t("pinHint")}
                />
              )}
            </form.AppField>
            <form.AppForm>
              <form.SubmitButton>{t("addStaff")}</form.SubmitButton>
            </form.AppForm>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={pinFor !== null}
        onOpenChange={(o) => {
          if (!o) {
            setPinFor(null);
            setPin("");
          }
        }}
      >
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle>
              {t("resetPinFor", { name: pinFor?.name ?? "" })}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="new-pin">{t("newPin")}</Label>
            <Input
              id="new-pin"
              inputMode="numeric"
              type="password"
              value={pin}
              maxLength={6}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              className="h-11 rounded-xl"
            />
            <p className="text-muted-foreground text-xs">{t("pinHint")}</p>
          </div>
          <Button
            className="h-12 rounded-full"
            disabled={!/^\d{4,6}$/.test(pin)}
            onClick={async () => {
              if (
                pinFor &&
                (await run(
                  resetStaffPin({ userId: pinFor.id, pin }),
                  t("pinReset"),
                ))
              ) {
                setPinFor(null);
                setPin("");
              }
            }}
          >
            {t("resetPin")}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------- Devices ----------

export function DevicesPanel({
  orgId,
  data,
}: {
  orgId: string;
  data: SettingsBundle;
}) {
  const t = useTranslations("settings");
  const { dateTime } = useDateTime();
  const run = useRun(orgId);
  return (
    <div className="grid max-w-3xl gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-muted-foreground text-sm">{t("devicesHint")}</p>
        <div className="ml-auto">
          <TrustDeviceButton />
        </div>
      </div>
      {data.devices.length === 0 ? (
        <EmptyState icon={MonitorSmartphone} title={t("noDevices")} />
      ) : (
        <ul className="grid gap-2">
          {data.devices.map((d) => (
            <li
              key={d.id}
              className="flex flex-wrap items-center gap-3 rounded-2xl border bg-card p-3 shadow-card"
            >
              <MonitorSmartphone
                className="size-5 text-muted-foreground"
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{d.name}</p>
                <p className="text-muted-foreground text-xs">
                  {t("addedBy", {
                    name: d.createdByName ?? "—",
                    time: dateTime(d.createdAt),
                  })}
                  {d.lastSeenAt &&
                    ` · ${t("lastSeen", { time: dateTime(d.lastSeenAt) })}`}
                </p>
              </div>
              {d.revokedAt ? (
                <Badge variant="outline" className="rounded-full">
                  {t("revoked")}
                </Badge>
              ) : (
                <ConfirmDialog
                  title={t("revokeTitle", { name: d.name })}
                  description={t("revokeDescription")}
                  confirmLabel={t("revoke")}
                  destructive
                  onConfirm={() => run(revokeDevice(d.id), t("revoked"))}
                >
                  <Button
                    variant="outline"
                    className="h-10 rounded-full text-destructive"
                  >
                    {t("revoke")}
                  </Button>
                </ConfirmDialog>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------- Shops ----------

export function ShopsPanel({ data }: { data: SettingsBundle }) {
  const t = useTranslations("settings");
  const router = useRouter();
  const errorMessage = useErrorMessage();
  const { date } = useDateTime();
  const [name, setName] = useState("");
  const max = data.entitlements.features.multiShop
    ? data.entitlements.limits.maxShops
    : 1;
  const atLimit = max !== null && data.shops.length >= max;

  async function switchTo(id: string) {
    await authClient.organization.setActive({ organizationId: id });
    router.replace("/pos");
    router.refresh();
  }

  return (
    <div className="grid max-w-3xl gap-4">
      <p className="text-muted-foreground text-sm">
        {t("shopUsage", { count: data.shops.length, max: max ?? "∞" })}
      </p>
      <ul className="grid gap-2">
        {data.shops.map((s) => (
          <li
            key={s.id}
            className="flex items-center gap-3 rounded-2xl border bg-card p-3 shadow-card"
          >
            <Store className="size-5 text-muted-foreground" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="font-medium">{s.name}</p>
              <p className="text-muted-foreground text-xs">
                {date(s.createdAt)}
              </p>
            </div>
            {s.id === data.activeShopId ? (
              <Badge className="rounded-full bg-success/15 text-success">
                <Check className="size-3" /> {t("current")}
              </Badge>
            ) : (
              <Button
                variant="outline"
                className="h-10 rounded-full"
                onClick={() => switchTo(s.id)}
              >
                {t("switch")}
              </Button>
            )}
          </li>
        ))}
      </ul>
      {atLimit ? (
        <p className="rounded-xl bg-gold-soft p-3 text-gold-text text-sm">
          {t("shopLimit")}
        </p>
      ) : (
        <form
          className="flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!createShopSchema.safeParse({ name }).success) return;
            const r = await createShop({ name });
            if (!r.ok) return void toast.error(errorMessage(r.code, r.details));
            toast.success(t("shopCreated"));
            setName("");
            await switchTo(r.data.id);
          }}
        >
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("newShopName")}
            aria-label={t("newShopName")}
            maxLength={80}
            className="h-11 rounded-full"
          />
          <Button
            type="submit"
            className="h-11 rounded-full"
            disabled={!name.trim()}
          >
            <Plus className="size-4" /> {t("createShop")}
          </Button>
        </form>
      )}
    </div>
  );
}

// ---------- Account ----------

export function AccountForm() {
  const t = useTranslations("settings");
  const form = useAppForm({
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
    validators: {
      onSubmit: ({ value }) => {
        const r = changePasswordSchema.safeParse(value);
        return r.success ? undefined : issuesToFields(r.error.issues);
      },
    },
    onSubmit: async ({ value, formApi }) => {
      const { error } = await authClient.changePassword({
        currentPassword: value.currentPassword,
        newPassword: value.newPassword,
        revokeOtherSessions: true,
      });
      if (error) return void toast.error(t("passwordFailed"));
      toast.success(t("passwordChanged"));
      formApi.reset();
    },
  });
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
      className="grid max-w-md gap-4"
    >
      <form.AppField name="currentPassword">
        {(f) => (
          <f.TextField
            label={t("currentPassword")}
            type="password"
            autoComplete="current-password"
          />
        )}
      </form.AppField>
      <form.AppField name="newPassword">
        {(f) => (
          <f.TextField
            label={t("newPassword")}
            type="password"
            autoComplete="new-password"
          />
        )}
      </form.AppField>
      <form.AppField name="confirmPassword">
        {(f) => (
          <f.TextField
            label={t("confirmPassword")}
            type="password"
            autoComplete="new-password"
          />
        )}
      </form.AppField>
      <form.AppForm>
        <form.SubmitButton>{t("changePassword")}</form.SubmitButton>
      </form.AppForm>
    </form>
  );
}
