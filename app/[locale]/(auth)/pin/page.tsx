import { MonitorX, Users } from "lucide-react";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { EmptyState } from "@/components/common/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { AuthCard } from "@/features/auth/components/auth-card";
import { PinLogin } from "@/features/auth/components/pin-login";
import { TrustDeviceButton } from "@/features/auth/components/trust-device-button";
import { getShopName, listPinStaff } from "@/features/auth/queries";
import { Link } from "@/i18n/navigation";
import { DEVICE_COOKIE, findTrustedDevice } from "@/lib/devices";
import { requireMember } from "@/lib/permissions";

export async function generateMetadata() {
  const t = await getTranslations("auth");
  return { title: t("pinTitle") };
}

export default async function PinPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full rounded-3xl" />}>
      <PinGate />
    </Suspense>
  );
}

async function isOwnerSignedIn() {
  try {
    const ctx = await requireMember({ roles: ["owner"] });
    return Boolean(ctx);
  } catch {
    return false;
  }
}

async function PinGate() {
  const t = await getTranslations("auth");
  const device = await findTrustedDevice(
    (await cookies()).get(DEVICE_COOKIE)?.value,
  );

  if (!device) {
    const owner = await isOwnerSignedIn();
    return (
      <AuthCard title={t("pinTitle")}>
        <EmptyState
          icon={MonitorX}
          title={t("deviceNotTrusted")}
          description={t("deviceNotTrustedHint")}
          action={
            owner ? (
              <TrustDeviceButton />
            ) : (
              <Link
                href="/login?next=/pin"
                className="text-gold-text text-sm hover:underline"
              >
                {t("ownerLogin")}
              </Link>
            )
          }
        />
      </AuthCard>
    );
  }

  const [staff, shopName] = await Promise.all([
    listPinStaff(device.organizationId),
    getShopName(device.organizationId),
  ]);

  return (
    <AuthCard title={shopName || t("pinTitle")} subtitle={t("pinSubtitle")}>
      {staff.length === 0 ? (
        <EmptyState
          icon={Users}
          title={t("noStaff")}
          description={t("noStaffHint")}
        />
      ) : (
        <PinLogin staff={staff} />
      )}
      <Link
        href="/login"
        className="mt-6 block text-center text-muted-foreground text-sm hover:underline"
      >
        {t("ownerLogin")}
      </Link>
    </AuthCard>
  );
}
