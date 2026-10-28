CREATE TABLE "order_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"action" text NOT NULL,
	"actor_id" uuid,
	"reason" text,
	"before" jsonb,
	"after" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_audit_logs_action_check" CHECK ("order_audit_logs"."action" IN ('create', 'update', 'status_change', 'payment', 'delete', 'restore'))
);
--> statement-breakpoint
CREATE TABLE "owner_entitlements" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"limits" jsonb NOT NULL,
	"features" jsonb NOT NULL,
	"source_invite_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shop_settings" (
	"organization_id" uuid PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"logo_url" text,
	"address" text,
	"phone" text,
	"tax_id" text,
	"promptpay_id" text,
	"order_number_prefix" text DEFAULT 'TL' NOT NULL,
	"vat_enabled" boolean DEFAULT false NOT NULL,
	"vat_mode" text DEFAULT 'inclusive' NOT NULL,
	"vat_rate" numeric(5, 2) DEFAULT '7.00' NOT NULL,
	"service_charge_enabled" boolean DEFAULT false NOT NULL,
	"service_charge_rate" numeric(5, 2) DEFAULT '10.00' NOT NULL,
	"receipt_header" text,
	"receipt_footer" text,
	"expiry_alert_days" integer DEFAULT 7 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shop_settings_vat_mode_check" CHECK ("shop_settings"."vat_mode" IN ('inclusive', 'exclusive')),
	CONSTRAINT "shop_settings_vat_rate_check" CHECK ("shop_settings"."vat_rate" >= 0 AND "shop_settings"."vat_rate" <= 100),
	CONSTRAINT "shop_settings_service_charge_rate_check" CHECK ("shop_settings"."service_charge_rate" >= 0 AND "shop_settings"."service_charge_rate" <= 100),
	CONSTRAINT "shop_settings_expiry_alert_days_check" CHECK ("shop_settings"."expiry_alert_days" >= 0)
);
--> statement-breakpoint
CREATE TABLE "signup_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" text NOT NULL,
	"label" text NOT NULL,
	"email" text,
	"limits" jsonb NOT NULL,
	"features" jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"used_by_user_id" uuid,
	"revoked_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "signup_invites_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "staff_credentials" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"pin_hash" text NOT NULL,
	"failed_attempts" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_adjustments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"lot_id" uuid,
	"type" text NOT NULL,
	"quantity" integer NOT NULL,
	"reason" text,
	"actor_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_adjustments_type_check" CHECK ("stock_adjustments"."type" IN ('stock_in', 'adjust_up', 'adjust_down', 'waste', 'sale_return')),
	CONSTRAINT "stock_adjustments_quantity_check" CHECK ("stock_adjustments"."quantity" <> 0)
);
--> statement-breakpoint
CREATE TABLE "trusted_devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"token_hash" text NOT NULL,
	"created_by" uuid,
	"last_seen_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trusted_devices_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "payment_method" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "cash_received" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "change_amount" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "service_charge_rate" numeric(5, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "service_charge_amount" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "vat_mode" text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "vat_rate" numeric(5, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "vat_amount" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "paid_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "deleted_by" uuid;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "delete_reason" text;--> statement-breakpoint
ALTER TABLE "session" ADD COLUMN "impersonated_by" uuid;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "role" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "banned" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "ban_reason" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "ban_expires" timestamp;--> statement-breakpoint
ALTER TABLE "order_audit_logs" ADD CONSTRAINT "order_audit_logs_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_audit_logs" ADD CONSTRAINT "order_audit_logs_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_audit_logs" ADD CONSTRAINT "order_audit_logs_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "owner_entitlements" ADD CONSTRAINT "owner_entitlements_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "owner_entitlements" ADD CONSTRAINT "owner_entitlements_source_invite_id_signup_invites_id_fk" FOREIGN KEY ("source_invite_id") REFERENCES "public"."signup_invites"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_settings" ADD CONSTRAINT "shop_settings_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signup_invites" ADD CONSTRAINT "signup_invites_used_by_user_id_user_id_fk" FOREIGN KEY ("used_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signup_invites" ADD CONSTRAINT "signup_invites_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_credentials" ADD CONSTRAINT "staff_credentials_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_credentials" ADD CONSTRAINT "staff_credentials_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_lot_id_product_stock_lots_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."product_stock_lots"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trusted_devices" ADD CONSTRAINT "trusted_devices_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trusted_devices" ADD CONSTRAINT "trusted_devices_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_order_audit_logs_order" ON "order_audit_logs" USING btree ("order_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_order_audit_logs_org" ON "order_audit_logs" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_signup_invites_created" ON "signup_invites" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_staff_credentials_org" ON "staff_credentials" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_stock_adjustments_org_created" ON "stock_adjustments" USING btree ("organization_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_stock_adjustments_product" ON "stock_adjustments" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_trusted_devices_org" ON "trusted_devices" USING btree ("organization_id");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_deleted_by_user_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_orders_org_deleted_created" ON "orders" USING btree ("organization_id","deleted_at","created_at" DESC NULLS LAST);--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_payment_method_check" CHECK ("orders"."payment_method" IS NULL OR "orders"."payment_method" IN ('cash', 'promptpay'));--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_vat_mode_check" CHECK ("orders"."vat_mode" IN ('none', 'inclusive', 'exclusive'));