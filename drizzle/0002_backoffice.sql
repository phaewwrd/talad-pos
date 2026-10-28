CREATE TABLE "backoffice_login_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"success" boolean NOT NULL,
	"ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invite_email_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invite_id" uuid NOT NULL,
	"to_email" text NOT NULL,
	"provider_message_id" text,
	"status" text NOT NULL,
	"error" text,
	"sent_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invite_email_logs_status_check" CHECK ("invite_email_logs"."status" IN ('queued', 'sent', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "platform_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"actor_label" text NOT NULL,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"reason" text,
	"before" jsonb,
	"after" jsonb,
	"ip" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "platform_audit_logs_target_type_check" CHECK ("platform_audit_logs"."target_type" IN ('shop', 'user', 'invite', 'backoffice_user'))
);
--> statement-breakpoint
CREATE TABLE "shop_status" (
	"organization_id" uuid PRIMARY KEY NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"reason" text,
	"changed_by" uuid,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shop_status_status_check" CHECK ("shop_status"."status" IN ('active', 'suspended', 'closed'))
);
--> statement-breakpoint
CREATE TABLE "two_factor" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"secret" text NOT NULL,
	"backup_codes" text NOT NULL,
	"user_id" uuid NOT NULL,
	"verified" boolean DEFAULT true,
	"failed_verification_count" integer DEFAULT 0,
	"locked_until" timestamp
);
--> statement-breakpoint
ALTER TABLE "owner_entitlements" ADD COLUMN "updated_by" uuid;--> statement-breakpoint
ALTER TABLE "signup_invites" ADD COLUMN "lock_to_email" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "signup_invites" ADD COLUMN "email_locale" text DEFAULT 'th' NOT NULL;--> statement-breakpoint
ALTER TABLE "signup_invites" ADD COLUMN "sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "signup_invites" ADD COLUMN "send_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "signup_invites" ADD COLUMN "revoked_by" uuid;--> statement-breakpoint
ALTER TABLE "signup_invites" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "two_factor_enabled" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "must_change_password" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "invite_email_logs" ADD CONSTRAINT "invite_email_logs_invite_id_signup_invites_id_fk" FOREIGN KEY ("invite_id") REFERENCES "public"."signup_invites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invite_email_logs" ADD CONSTRAINT "invite_email_logs_sent_by_user_id_fk" FOREIGN KEY ("sent_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_status" ADD CONSTRAINT "shop_status_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_status" ADD CONSTRAINT "shop_status_changed_by_user_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "two_factor" ADD CONSTRAINT "two_factor_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_backoffice_login_attempts_email" ON "backoffice_login_attempts" USING btree ("email","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_invite_email_logs_invite" ON "invite_email_logs" USING btree ("invite_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_platform_audit_logs_target" ON "platform_audit_logs" USING btree ("target_type","target_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_platform_audit_logs_actor" ON "platform_audit_logs" USING btree ("actor_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_platform_audit_logs_created" ON "platform_audit_logs" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "two_factor_secret_idx" ON "two_factor" USING btree ("secret");--> statement-breakpoint
CREATE INDEX "two_factor_user_id_idx" ON "two_factor" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "owner_entitlements" ADD CONSTRAINT "owner_entitlements_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signup_invites" ADD CONSTRAINT "signup_invites_revoked_by_user_id_fk" FOREIGN KEY ("revoked_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signup_invites" ADD CONSTRAINT "signup_invites_email_locale_check" CHECK ("signup_invites"."email_locale" IN ('th', 'en'));--> statement-breakpoint
-- platform_audit_logs is append-only: reject UPDATE / DELETE / TRUNCATE.
CREATE OR REPLACE FUNCTION platform_audit_logs_append_only() RETURNS trigger AS $$
BEGIN
	RAISE EXCEPTION 'platform_audit_logs is append-only (% rejected)', TG_OP;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER platform_audit_logs_no_update_delete BEFORE UPDATE OR DELETE ON "platform_audit_logs" FOR EACH ROW EXECUTE FUNCTION platform_audit_logs_append_only();--> statement-breakpoint
CREATE TRIGGER platform_audit_logs_no_truncate BEFORE TRUNCATE ON "platform_audit_logs" FOR EACH STATEMENT EXECUTE FUNCTION platform_audit_logs_append_only();--> statement-breakpoint
-- TODO(decision): legacy platform admins (role 'admin') become super_admin; they
-- must still enroll 2FA on first backoffice login.
UPDATE "user" SET "role" = 'super_admin' WHERE "role" = 'admin';
