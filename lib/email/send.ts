import "server-only";
import { randomUUID } from "node:crypto";
import { render } from "@react-email/render";
import { eq, sql } from "drizzle-orm";
import { Resend } from "resend";
import { db } from "@/db";
import {
  type EmailLocale,
  type EntitlementFeatures,
  type EntitlementLimits,
  inviteEmailLogs,
  signupInvites,
} from "@/db/schema";
import ShopInviteEmail, { shopInviteSubject } from "@/emails/shop-invite";

// Resend wrapper. Without RESEND_API_KEY (local dev) messages are logged to the
// server console and reported as sent with a fake id.

export class EmailDeliveryError extends Error {}

const FROM = () => process.env.EMAIL_FROM ?? "Talad POS <no-reply@example.com>";

let client: Resend | null = null;
function resend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  client ??= new Resend(key);
  return client;
}

export async function deliverEmail(message: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<{ id: string }> {
  const api = resend();
  if (!api) {
    console.info(
      `[email:dev] to=${message.to} subject=${message.subject}\n${message.text}`,
    );
    return { id: `dev-${randomUUID()}` };
  }
  const { data, error } = await api.emails.send({
    from: FROM(),
    to: message.to,
    subject: message.subject,
    text: message.text,
    ...(message.html ? { html: message.html } : {}),
  });
  if (error || !data) {
    throw new EmailDeliveryError(error?.message ?? "Unknown email error");
  }
  return { id: data.id };
}

export function supportEmail() {
  // TODO(decision): official support address.
  return process.env.SUPPORT_EMAIL ?? "support@talad.app";
}

export type InviteEmailInput = {
  inviteId: string;
  to: string;
  locale: EmailLocale;
  url: string;
  label: string;
  limits: EntitlementLimits;
  features: EntitlementFeatures;
  expiresAt: Date;
  sentBy: string;
};

/**
 * Send one invite email and log it: a `queued` invite_email_logs row first,
 * then `sent` (provider id) or `failed` (error). On success the invite's
 * sent_at / send_count are updated. Never throws for delivery errors.
 */
export async function sendInviteEmail(
  input: InviteEmailInput,
): Promise<{ ok: true; messageId: string } | { ok: false; error: string }> {
  const [log] = await db
    .insert(inviteEmailLogs)
    .values({
      inviteId: input.inviteId,
      toEmail: input.to,
      status: "queued",
      sentBy: input.sentBy,
    })
    .returning({ id: inviteEmailLogs.id });

  try {
    const element = ShopInviteEmail({
      locale: input.locale,
      url: input.url,
      label: input.label,
      limits: input.limits,
      features: input.features,
      expiresAt: input.expiresAt.toISOString(),
      supportEmail: supportEmail(),
    });
    const [html, text] = await Promise.all([
      render(element),
      render(element, { plainText: true }),
    ]);
    const { id } = await deliverEmail({
      to: input.to,
      subject: shopInviteSubject(input.locale),
      html,
      text,
    });
    await db.transaction(async (tx) => {
      await tx
        .update(inviteEmailLogs)
        .set({ status: "sent", providerMessageId: id })
        .where(eq(inviteEmailLogs.id, log.id));
      await tx
        .update(signupInvites)
        .set({
          sentAt: new Date(),
          sendCount: sql`${signupInvites.sendCount} + 1`,
        })
        .where(eq(signupInvites.id, input.inviteId));
    });
    return { ok: true, messageId: id };
  } catch (err) {
    const error = (err instanceof Error ? err.message : String(err)).slice(
      0,
      500,
    );
    console.error("[email] invite send failed", error);
    await db
      .update(inviteEmailLogs)
      .set({ status: "failed", error })
      .where(eq(inviteEmailLogs.id, log.id));
    return { ok: false, error };
  }
}
