import { getTranslations } from "next-intl/server";

export async function generateMetadata() {
  const t = await getTranslations("auth");
  return { title: t("signupTitle") };
}

export default async function Page() {
  const t = await getTranslations();
  return (
    <div className="rounded-2xl border bg-card p-6 shadow-card">
      <h1 className="font-semibold text-xl">{t("auth.signupTitle")}</h1>
      <p className="mt-2 text-muted-foreground text-sm">
        {t("common.comingSoon")}
      </p>
    </div>
  );
}
