import { render } from "@react-email/render";
import { describe, expect, it } from "vitest";
import ShopInviteEmail, {
  type ShopInviteEmailProps,
  shopInviteSubject,
} from "@/emails/shop-invite";

const props: ShopInviteEmailProps = {
  locale: "th",
  url: "https://pos.example/th/signup?token=abc123",
  label: "ร้านป้าแดง",
  limits: { maxShops: 1, maxStaffPerShop: 10, maxProducts: null },
  features: {
    promotions: true,
    costProfit: false,
    export: true,
    platformChannels: false,
    multiShop: false,
  },
  expiresAt: "2026-11-04T05:00:00.000Z",
  supportEmail: "help@talad.app",
};

describe("shop invite email", () => {
  it("renders Thai with the red CTA, plan and Bangkok expiry", async () => {
    const html = await render(ShopInviteEmail(props));
    expect(html).toContain("สร้างบัญชีร้านค้า");
    expect(html).toContain('href="https://pos.example/th/signup?token=abc123"');
    expect(html).toContain("#C8102E");
    expect(html).toContain("ไม่จำกัด"); // maxProducts = null
    expect(html).toContain("โปรโมชัน");
    expect(html).not.toContain("ต้นทุนและกำไร"); // disabled feature
    expect(html).toContain("12:00"); // 05:00 UTC → 12:00 Bangkok
    expect(html).toContain("help@talad.app");
    expect(shopInviteSubject("th")).toContain("Talad POS");
  });

  it("renders English and a plain-text version", async () => {
    const element = ShopInviteEmail({ ...props, locale: "en" });
    const text = await render(element, { plainText: true });
    expect(text).toContain("Create your shop account");
    expect(text).toContain("https://pos.example/th/signup?token=abc123");
    expect(text).toContain("Unlimited");
    expect(text).not.toContain("<");
    expect(shopInviteSubject("en")).toMatch(/invited/i);
  });
});
