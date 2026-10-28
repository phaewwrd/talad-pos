import { createTranslator } from "next-intl";
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "react-email";
import en from "../messages/en.json";
import th from "../messages/th.json";

// Shop-owner signup invite. Bilingual by the invite's email_locale; copy lives
// in messages/*.json under backoffice.inviteEmail. Preview: `pnpm email:dev`.

type Locale = "th" | "en";
type Limits = {
  maxShops: number | null;
  maxStaffPerShop: number | null;
  maxProducts: number | null;
};
type Features = {
  promotions: boolean;
  costProfit: boolean;
  export: boolean;
  platformChannels: boolean;
  multiShop: boolean;
};

export type ShopInviteEmailProps = {
  locale: Locale;
  url: string;
  label: string;
  limits: Limits;
  features: Features;
  /** ISO timestamp. */
  expiresAt: string;
  supportEmail: string;
};

const MESSAGES = { th, en };
const LIMIT_KEYS = ["maxShops", "maxStaffPerShop", "maxProducts"] as const;
const FEATURE_KEYS = [
  "promotions",
  "costProfit",
  "export",
  "platformChannels",
  "multiShop",
] as const;

const RED = "#C8102E";
const GOLD = "#C9A227";
const BLACK = "#111111";

function translator(locale: Locale) {
  return createTranslator({
    locale,
    messages: MESSAGES[locale],
    namespace: "backoffice",
  });
}

export function shopInviteSubject(locale: Locale) {
  return translator(locale)("inviteEmail.subject");
}

function formatExpiry(iso: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-GB", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Asia/Bangkok",
  }).format(new Date(iso));
}

export default function ShopInviteEmail({
  locale,
  url,
  label,
  limits,
  features,
  expiresAt,
  supportEmail,
}: ShopInviteEmailProps) {
  const t = translator(locale);
  const fmtNumber = new Intl.NumberFormat(locale === "th" ? "th-TH" : "en-US");
  const enabled = FEATURE_KEYS.filter((k) => features[k]);

  return (
    <Html lang={locale}>
      <Head />
      <Preview>{t("inviteEmail.preview")}</Preview>
      <Body
        style={{
          backgroundColor: "#FAF8F5",
          fontFamily:
            "'IBM Plex Sans Thai','Noto Sans Thai',Helvetica,Arial,sans-serif",
          margin: 0,
          padding: "24px 0",
          color: "#1A1A1A",
        }}
      >
        <Container
          style={{
            maxWidth: 560,
            backgroundColor: "#FFFFFF",
            border: "1px solid #ECE6DC",
            borderRadius: 16,
            overflow: "hidden",
          }}
        >
          <Section
            style={{
              backgroundColor: BLACK,
              padding: "20px 28px",
              borderBottom: `4px solid ${GOLD}`,
            }}
          >
            <Text style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>
              <span
                style={{
                  display: "inline-block",
                  width: 34,
                  height: 34,
                  lineHeight: "34px",
                  textAlign: "center",
                  borderRadius: 10,
                  backgroundColor: RED,
                  color: "#FFFFFF",
                  marginRight: 10,
                }}
              >
                ต
              </span>
              <span style={{ color: "#FFFFFF" }}>Talad</span>{" "}
              <span style={{ color: GOLD }}>POS</span>
            </Text>
          </Section>

          <Section style={{ padding: "28px" }}>
            <Heading as="h1" style={{ fontSize: 22, margin: "0 0 12px" }}>
              {t("inviteEmail.greeting")}
            </Heading>
            <Text style={{ fontSize: 15, lineHeight: "24px", margin: 0 }}>
              {t("inviteEmail.intro", { label })}
            </Text>

            <Section
              style={{
                marginTop: 20,
                padding: "16px 20px",
                backgroundColor: "#F7EFD8",
                borderRadius: 12,
              }}
            >
              <Text
                style={{
                  margin: "0 0 8px",
                  fontWeight: 600,
                  color: "#8A6D12",
                }}
              >
                {t("inviteEmail.planTitle")}
              </Text>
              {LIMIT_KEYS.map((k) => (
                <Text key={k} style={{ margin: "2px 0", fontSize: 14 }}>
                  {t(`limits.${k}`)}:{" "}
                  <strong>
                    {limits[k] === null
                      ? t("inviteEmail.unlimited")
                      : fmtNumber.format(limits[k])}
                  </strong>
                </Text>
              ))}
              <Text style={{ margin: "10px 0 2px", fontSize: 14 }}>
                {t("inviteEmail.featuresTitle")}:{" "}
                <strong>
                  {enabled.length === 0
                    ? t("inviteEmail.noFeatures")
                    : enabled.map((k) => t(`features.${k}`)).join(", ")}
                </strong>
              </Text>
            </Section>

            <Section style={{ textAlign: "center", margin: "28px 0 8px" }}>
              <Button
                href={url}
                style={{
                  backgroundColor: RED,
                  color: "#FFFFFF",
                  fontSize: 17,
                  fontWeight: 700,
                  padding: "16px 32px",
                  borderRadius: 999,
                  textDecoration: "none",
                  display: "inline-block",
                }}
              >
                {t("inviteEmail.cta")}
              </Button>
            </Section>
            <Text
              style={{
                textAlign: "center",
                fontSize: 13,
                color: "#6B6B6B",
                margin: "8px 0 0",
              }}
            >
              {t("inviteEmail.expires", {
                date: formatExpiry(expiresAt, locale),
              })}
            </Text>

            <Text style={{ fontSize: 12, color: "#6B6B6B", marginTop: 24 }}>
              {t("inviteEmail.linkFallback")}
              <br />
              <Link
                href={url}
                style={{ color: "#8A6D12", wordBreak: "break-all" }}
              >
                {url}
              </Link>
            </Text>

            <Hr style={{ borderColor: "#ECE6DC", margin: "24px 0" }} />
            <Text style={{ fontSize: 13, margin: 0 }}>
              {t("inviteEmail.support")}{" "}
              <Link href={`mailto:${supportEmail}`} style={{ color: RED }}>
                {supportEmail}
              </Link>
            </Text>
            <Text style={{ fontSize: 12, color: "#6B6B6B", marginTop: 8 }}>
              {t("inviteEmail.ignore")}
            </Text>
          </Section>

          <Section
            style={{
              backgroundColor: BLACK,
              padding: "14px 28px",
              textAlign: "center",
            }}
          >
            <Text style={{ margin: 0, fontSize: 12, color: "#BDBDBD" }}>
              {t("inviteEmail.footer")}
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

ShopInviteEmail.PreviewProps = {
  locale: "th",
  url: "http://localhost:3000/th/signup?token=preview-token",
  label: "ร้านป้าแดง",
  limits: { maxShops: 1, maxStaffPerShop: 10, maxProducts: 1000 },
  features: {
    promotions: true,
    costProfit: true,
    export: true,
    platformChannels: true,
    multiShop: false,
  },
  expiresAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
  supportEmail: "support@talad.app",
} satisfies ShopInviteEmailProps;
