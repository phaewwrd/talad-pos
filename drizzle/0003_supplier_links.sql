CREATE TABLE "product_suppliers" (
	"organization_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"supplier_id" uuid NOT NULL,
	CONSTRAINT "product_suppliers_supplier_id_product_id_pk" PRIMARY KEY("supplier_id","product_id")
);
--> statement-breakpoint
CREATE TABLE "shop_stock_versions" (
	"organization_id" uuid PRIMARY KEY NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supplier_link_attempts" (
	"link_id" uuid NOT NULL,
	"ip_hash" text NOT NULL,
	"kind" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"window_started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_until" timestamp with time zone,
	CONSTRAINT "supplier_link_attempts_link_id_ip_hash_kind_pk" PRIMARY KEY("link_id","ip_hash","kind"),
	CONSTRAINT "supplier_link_attempts_kind_check" CHECK ("supplier_link_attempts"."kind" IN ('pin', 'page', 'api'))
);
--> statement-breakpoint
CREATE TABLE "supplier_link_views" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"link_id" uuid NOT NULL,
	"viewed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_hash" text NOT NULL,
	"user_agent" text
);
--> statement-breakpoint
CREATE TABLE "supplier_share_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"supplier_id" uuid NOT NULL,
	"token" text NOT NULL,
	"is_enabled" boolean DEFAULT false NOT NULL,
	"pin_hash" text,
	"pin_updated_at" timestamp with time zone,
	"display_mode" text DEFAULT 'QUANTITY' NOT NULL,
	"low_stock_threshold" integer,
	"view_count" integer DEFAULT 0 NOT NULL,
	"last_viewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"regenerated_at" timestamp with time zone,
	CONSTRAINT "supplier_share_links_token_unique" UNIQUE("token"),
	CONSTRAINT "supplier_share_links_org_supplier_key" UNIQUE("organization_id","supplier_id"),
	CONSTRAINT "supplier_share_links_display_mode_check" CHECK ("supplier_share_links"."display_mode" IN ('QUANTITY', 'STATUS')),
	CONSTRAINT "supplier_share_links_low_stock_threshold_check" CHECK ("supplier_share_links"."low_stock_threshold" IS NULL OR "supplier_share_links"."low_stock_threshold" >= 0)
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"contact" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "suppliers_org_name_key" UNIQUE("organization_id","name")
);
--> statement-breakpoint
ALTER TABLE "product_suppliers" ADD CONSTRAINT "product_suppliers_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_suppliers" ADD CONSTRAINT "product_suppliers_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_suppliers" ADD CONSTRAINT "product_suppliers_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_stock_versions" ADD CONSTRAINT "shop_stock_versions_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_link_attempts" ADD CONSTRAINT "supplier_link_attempts_link_id_supplier_share_links_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."supplier_share_links"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_link_views" ADD CONSTRAINT "supplier_link_views_link_id_supplier_share_links_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."supplier_share_links"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_share_links" ADD CONSTRAINT "supplier_share_links_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_share_links" ADD CONSTRAINT "supplier_share_links_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_product_suppliers_product" ON "product_suppliers" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_supplier_link_views_link_ip" ON "supplier_link_views" USING btree ("link_id","ip_hash","viewed_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_suppliers_org" ON "suppliers" USING btree ("organization_id");