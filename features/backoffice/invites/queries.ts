import "server-only";
import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  lt,
  or,
  type SQL,
  sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { inviteEmailLogs, signupInvites, user } from "@/db/schema";
import {
  getInviteStatus,
  type InviteStatus,
} from "@/lib/backoffice/invite-status";
import {
  bangkokRange,
  likePattern,
  pageOffset,
} from "@/lib/backoffice/list-params";
import { BACKOFFICE_ROLES } from "@/lib/backoffice/roles";
import type { InviteListParams } from "./schemas";

/**
 * SQL mirror of getInviteStatus() (lib/backoffice/invite-status.ts), same
 * order, for server-side filtering and counting. Keep the two in sync.
 */
export const inviteStatusSql = sql<InviteStatus>`CASE
  WHEN ${signupInvites.revokedAt} IS NOT NULL THEN 'revoked'
  WHEN ${signupInvites.usedAt} IS NOT NULL THEN 'used'
  WHEN ${signupInvites.expiresAt} < now() THEN 'expired'
  WHEN ${signupInvites.sentAt} IS NOT NULL THEN 'sent'
  ELSE 'draft' END`;

const creator = alias(user, "creator");
const usedBy = alias(user, "used_by");

/** Columns safe to send to the client — never token_hash. */
const inviteColumns = {
  id: signupInvites.id,
  label: signupInvites.label,
  email: signupInvites.email,
  lockToEmail: signupInvites.lockToEmail,
  emailLocale: signupInvites.emailLocale,
  limits: signupInvites.limits,
  features: signupInvites.features,
  expiresAt: signupInvites.expiresAt,
  sentAt: signupInvites.sentAt,
  sendCount: signupInvites.sendCount,
  usedAt: signupInvites.usedAt,
  revokedAt: signupInvites.revokedAt,
  createdAt: signupInvites.createdAt,
  createdById: creator.id,
  createdByName: creator.name,
  usedById: usedBy.id,
  usedByEmail: usedBy.email,
};

function selectInvites() {
  return db
    .select(inviteColumns)
    .from(signupInvites)
    .leftJoin(creator, eq(creator.id, signupInvites.createdBy))
    .leftJoin(usedBy, eq(usedBy.id, signupInvites.usedByUserId))
    .$dynamic();
}
type InviteRow = Awaited<ReturnType<typeof selectInvites>>[number];

function toDTO(r: InviteRow) {
  return {
    ...r,
    status: getInviteStatus(r),
    expiresAt: r.expiresAt.toISOString(),
    sentAt: r.sentAt?.toISOString() ?? null,
    usedAt: r.usedAt?.toISOString() ?? null,
    revokedAt: r.revokedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
  };
}
export type InviteDTO = ReturnType<typeof toDTO>;

const SORT_COLUMNS = {
  label: signupInvites.label,
  email: signupInvites.email,
  createdAt: signupInvites.createdAt,
  expiresAt: signupInvites.expiresAt,
  sentAt: signupInvites.sentAt,
  sendCount: signupInvites.sendCount,
} as const;

export async function listInvites(p: InviteListParams) {
  const filters: SQL[] = [];
  if (p.status) filters.push(sql`${inviteStatusSql} = ${p.status}`);
  if (p.createdBy) filters.push(eq(signupInvites.createdBy, p.createdBy));
  const { start, end } = bangkokRange(p.from, p.to);
  if (start) filters.push(gte(signupInvites.createdAt, start));
  if (end) filters.push(lt(signupInvites.createdAt, end));
  if (p.q) {
    const pattern = likePattern(p.q);
    const search = or(
      ilike(signupInvites.label, pattern),
      ilike(signupInvites.email, pattern),
    );
    if (search) filters.push(search);
  }
  const where = filters.length ? and(...filters) : undefined;
  const sortCol = SORT_COLUMNS[p.sort ?? "createdAt"];
  const order = p.dir === "asc" ? asc(sortCol) : desc(sortCol);

  const [rows, [{ total }]] = await Promise.all([
    selectInvites()
      .where(where)
      .orderBy(order, desc(signupInvites.id))
      .limit(p.pageSize)
      .offset(pageOffset(p)),
    db.select({ total: count() }).from(signupInvites).where(where),
  ]);
  return { rows: rows.map(toDTO), total };
}

export async function getInvite(id: string) {
  const [row] = await selectInvites().where(eq(signupInvites.id, id)).limit(1);
  return row ? toDTO(row) : null;
}

export async function listInviteEmailLogs(inviteId: string) {
  const rows = await db
    .select({
      id: inviteEmailLogs.id,
      toEmail: inviteEmailLogs.toEmail,
      status: inviteEmailLogs.status,
      providerMessageId: inviteEmailLogs.providerMessageId,
      error: inviteEmailLogs.error,
      sentByName: user.name,
      createdAt: inviteEmailLogs.createdAt,
    })
    .from(inviteEmailLogs)
    .leftJoin(user, eq(user.id, inviteEmailLogs.sentBy))
    .where(eq(inviteEmailLogs.inviteId, inviteId))
    .orderBy(desc(inviteEmailLogs.createdAt));
  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
}
export type InviteEmailLogDTO = Awaited<
  ReturnType<typeof listInviteEmailLogs>
>[number];

/** Backoffice users, for "created by" / "actor" filters. */
export async function listBackofficeUserOptions() {
  return db
    .select({ id: user.id, name: user.name, email: user.email })
    .from(user)
    .where(inArray(user.role, [...BACKOFFICE_ROLES]))
    .orderBy(asc(user.name));
}
