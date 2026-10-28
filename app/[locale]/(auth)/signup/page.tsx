import { TriangleAlert } from "lucide-react";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { AuthCard } from "@/features/auth/components/auth-card";
import { SignupForm } from "@/features/auth/components/signup-form";
import { findActiveInvite } from "@/features/auth/invites";

export async function generateMetadata() {
  const t = await getTranslations("auth");
  return { title: t("signupTitle") };
}

export default async function SignupPage({
  searchParams,
}: PageProps<"/[locale]/signup">) {
  const t = await getTranslations("auth");
  return (
    <AuthCard title={t("signupTitle")} subtitle={t("signupSubtitle")}>
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-2xl" />}>
        <InviteGate searchParams={searchParams} />
      </Suspense>
    </AuthCard>
  );
}

async function InviteGate({
  searchParams,
}: {
  searchParams: PageProps<"/[locale]/signup">["searchParams"];
}) {
  const { token } = await searchParams;
  await connection(); // DB access below must happen at request time
  const raw = typeof token === "string" ? token : "";
  const invite = raw ? await findActiveInvite(raw) : null;

  if (!invite) {
    const t = await getTranslations("auth");
    return (
      <div className="grid gap-2 rounded-2xl bg-primary-soft p-4 text-sm">
        <p className="flex items-center gap-2 font-medium text-primary">
          <TriangleAlert className="size-4" aria-hidden /> {t("inviteInvalid")}
        </p>
        <p className="text-muted-foreground">{t("inviteInvalidHint")}</p>
      </div>
    );
  }

  return <SignupForm token={raw} lockedEmail={invite.email} />;
}
