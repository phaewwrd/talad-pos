CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"order_no" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "categories_org_name_key" UNIQUE("organization_id","name")
);
--> statement-breakpoint
CREATE TABLE "cost_profit_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"entry_date" date NOT NULL,
	"sales_channel" text NOT NULL,
	"product_id" uuid,
	"product_name" text NOT NULL,
	"quantity" integer NOT NULL,
	"unit_cost" numeric(12, 2) NOT NULL,
	"unit_price" numeric(12, 2) NOT NULL,
	"platform_fee_rate" numeric(6, 4) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cost_profit_entries_sales_channel_check" CHECK ("cost_profit_entries"."sales_channel" IN ('shopee', 'lineman', 'other')),
	CONSTRAINT "cost_profit_entries_quantity_check" CHECK ("cost_profit_entries"."quantity" > 0),
	CONSTRAINT "cost_profit_entries_unit_cost_check" CHECK ("cost_profit_entries"."unit_cost" >= 0),
	CONSTRAINT "cost_profit_entries_unit_price_check" CHECK ("cost_profit_entries"."unit_price" >= 0),
	CONSTRAINT "cost_profit_entries_platform_fee_rate_check" CHECK ("cost_profit_entries"."platform_fee_rate" >= 0)
);
--> statement-breakpoint
CREATE TABLE "order_item_lot_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"order_item_id" uuid NOT NULL,
	"lot_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_item_lot_allocations_quantity_check" CHECK ("order_item_lot_allocations"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"product_name" text NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price" numeric(12, 2) NOT NULL,
	"discount_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"line_total" numeric(12, 2) NOT NULL,
	CONSTRAINT "order_items_quantity_check" CHECK ("order_items"."quantity" > 0),
	CONSTRAINT "order_items_unit_price_check" CHECK ("order_items"."unit_price" >= 0),
	CONSTRAINT "order_items_discount_amount_check" CHECK ("order_items"."discount_amount" >= 0),
	CONSTRAINT "order_items_line_total_check" CHECK ("order_items"."line_total" >= 0)
);
--> statement-breakpoint
CREATE TABLE "order_promotions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"promotion_id" uuid,
	"promotion_name" text NOT NULL,
	"discount_type" text NOT NULL,
	"discount_value" numeric(12, 2) NOT NULL,
	"minimum_type" text DEFAULT 'quantity' NOT NULL,
	"minimum_quantity" integer NOT NULL,
	"minimum_amount" numeric(12, 2),
	"matched_quantity" integer NOT NULL,
	"discount_amount" numeric(12, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_promotions_discount_type_check" CHECK ("order_promotions"."discount_type" IN ('percentage', 'fixed')),
	CONSTRAINT "order_promotions_discount_value_check" CHECK ("order_promotions"."discount_value" >= 0),
	CONSTRAINT "order_promotions_minimum_type_check" CHECK ("order_promotions"."minimum_type" IN ('quantity', 'amount')),
	CONSTRAINT "order_promotions_minimum_quantity_check" CHECK ("order_promotions"."minimum_quantity" > 0),
	CONSTRAINT "order_promotions_matched_quantity_check" CHECK ("order_promotions"."matched_quantity" > 0),
	CONSTRAINT "order_promotions_discount_amount_check" CHECK ("order_promotions"."discount_amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"order_number" text NOT NULL,
	"customer_name" text DEFAULT 'Walk-in' NOT NULL,
	"payment_type" text DEFAULT 'Paid' NOT NULL,
	"sales_channel" text DEFAULT 'storefront' NOT NULL,
	"status" text DEFAULT 'Pending' NOT NULL,
	"subtotal" numeric(12, 2) NOT NULL,
	"discount_total" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total" numeric(12, 2) NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_org_order_number_key" UNIQUE("organization_id","order_number"),
	CONSTRAINT "orders_payment_type_check" CHECK ("orders"."payment_type" IN ('Paid', 'Unpaid')),
	CONSTRAINT "orders_sales_channel_check" CHECK ("orders"."sales_channel" IN ('storefront', 'shopee', 'lineman', 'grab')),
	CONSTRAINT "orders_subtotal_check" CHECK ("orders"."subtotal" >= 0),
	CONSTRAINT "orders_discount_total_check" CHECK ("orders"."discount_total" >= 0),
	CONSTRAINT "orders_total_check" CHECK ("orders"."total" >= 0)
);
--> statement-breakpoint
CREATE TABLE "product_stock_lots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"lot_number" text NOT NULL,
	"stock_in_date" date NOT NULL,
	"expiry_date" date,
	"initial_quantity" integer NOT NULL,
	"remaining_quantity" integer NOT NULL,
	"cost" numeric(12, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_stock_lots_product_id_lot_number_key" UNIQUE("product_id","lot_number"),
	CONSTRAINT "product_stock_lots_initial_quantity_check" CHECK ("product_stock_lots"."initial_quantity" >= 0),
	CONSTRAINT "product_stock_lots_remaining_quantity_check" CHECK ("product_stock_lots"."remaining_quantity" >= 0 AND "product_stock_lots"."remaining_quantity" <= "product_stock_lots"."initial_quantity"),
	CONSTRAINT "product_stock_lots_cost_check" CHECK ("product_stock_lots"."cost" >= 0)
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"sku" text NOT NULL,
	"name" text NOT NULL,
	"image_url" text,
	"category_id" uuid NOT NULL,
	"stock_quantity" integer DEFAULT 0 NOT NULL,
	"minimum_stock" integer DEFAULT 0 NOT NULL,
	"cost" numeric(12, 2) NOT NULL,
	"price" numeric(12, 2) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_org_sku_key" UNIQUE("organization_id","sku"),
	CONSTRAINT "products_stock_quantity_check" CHECK ("products"."stock_quantity" >= 0),
	CONSTRAINT "products_minimum_stock_check" CHECK ("products"."minimum_stock" >= 0),
	CONSTRAINT "products_cost_check" CHECK ("products"."cost" >= 0),
	CONSTRAINT "products_price_check" CHECK ("products"."price" >= 0)
);
--> statement-breakpoint
CREATE TABLE "promotion_categories" (
	"organization_id" uuid NOT NULL,
	"promotion_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	CONSTRAINT "promotion_categories_promotion_id_category_id_pk" PRIMARY KEY("promotion_id","category_id")
);
--> statement-breakpoint
CREATE TABLE "promotion_products" (
	"organization_id" uuid NOT NULL,
	"promotion_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	CONSTRAINT "promotion_products_promotion_id_product_id_pk" PRIMARY KEY("promotion_id","product_id")
);
--> statement-breakpoint
CREATE TABLE "promotions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"discount_type" text NOT NULL,
	"discount_value" numeric(12, 2) NOT NULL,
	"minimum_type" text DEFAULT 'quantity' NOT NULL,
	"minimum_quantity" integer NOT NULL,
	"minimum_amount" numeric(12, 2),
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "promotions_discount_type_check" CHECK ("promotions"."discount_type" IN ('percentage', 'fixed')),
	CONSTRAINT "promotions_discount_value_check" CHECK ("promotions"."discount_value" >= 0),
	CONSTRAINT "promotions_minimum_type_check" CHECK ("promotions"."minimum_type" IN ('quantity', 'amount')),
	CONSTRAINT "promotions_minimum_quantity_check" CHECK ("promotions"."minimum_quantity" > 0),
	CONSTRAINT "promotions_check" CHECK ("promotions"."end_at" >= "promotions"."start_at")
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"inviter_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text DEFAULT 'cashier' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"logo" text,
	"metadata" text,
	"plan" text DEFAULT 'free' NOT NULL,
	"status" text DEFAULT 'trial' NOT NULL,
	"trial_ends_at" timestamp,
	"currency" text DEFAULT 'THB' NOT NULL,
	"timezone" text DEFAULT 'Asia/Bangkok' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "organization_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" uuid NOT NULL,
	"active_organization_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_profit_entries" ADD CONSTRAINT "cost_profit_entries_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_profit_entries" ADD CONSTRAINT "cost_profit_entries_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_item_lot_allocations" ADD CONSTRAINT "order_item_lot_allocations_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_item_lot_allocations" ADD CONSTRAINT "order_item_lot_allocations_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_item_lot_allocations" ADD CONSTRAINT "order_item_lot_allocations_lot_id_product_stock_lots_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."product_stock_lots"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_promotions" ADD CONSTRAINT "order_promotions_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_promotions" ADD CONSTRAINT "order_promotions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_promotions" ADD CONSTRAINT "order_promotions_promotion_id_promotions_id_fk" FOREIGN KEY ("promotion_id") REFERENCES "public"."promotions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_stock_lots" ADD CONSTRAINT "product_stock_lots_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_stock_lots" ADD CONSTRAINT "product_stock_lots_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotion_categories" ADD CONSTRAINT "promotion_categories_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotion_categories" ADD CONSTRAINT "promotion_categories_promotion_id_promotions_id_fk" FOREIGN KEY ("promotion_id") REFERENCES "public"."promotions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotion_categories" ADD CONSTRAINT "promotion_categories_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotion_products" ADD CONSTRAINT "promotion_products_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotion_products" ADD CONSTRAINT "promotion_products_promotion_id_promotions_id_fk" FOREIGN KEY ("promotion_id") REFERENCES "public"."promotions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotion_products" ADD CONSTRAINT "promotion_products_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_inviter_id_user_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_categories_org_order" ON "categories" USING btree ("organization_id","order_no");--> statement-breakpoint
CREATE INDEX "idx_cost_profit_entries_org_date" ON "cost_profit_entries" USING btree ("organization_id","entry_date" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_cost_profit_entries_org_channel" ON "cost_profit_entries" USING btree ("organization_id","sales_channel");--> statement-breakpoint
CREATE INDEX "idx_order_item_lot_allocations_order_item_id" ON "order_item_lot_allocations" USING btree ("order_item_id");--> statement-breakpoint
CREATE INDEX "idx_order_item_lot_allocations_lot_id" ON "order_item_lot_allocations" USING btree ("lot_id");--> statement-breakpoint
CREATE INDEX "idx_order_items_order_id" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "idx_order_items_org_product" ON "order_items" USING btree ("organization_id","product_id");--> statement-breakpoint
CREATE INDEX "idx_order_promotions_order_id" ON "order_promotions" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "idx_orders_org_created_at" ON "orders" USING btree ("organization_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_product_stock_lots_org" ON "product_stock_lots" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_product_stock_lots_fifo" ON "product_stock_lots" USING btree ("product_id","stock_in_date","created_at");--> statement-breakpoint
CREATE INDEX "idx_products_org_category" ON "products" USING btree ("organization_id","category_id");--> statement-breakpoint
CREATE INDEX "idx_promotion_categories_category_id" ON "promotion_categories" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "idx_promotion_products_product_id" ON "promotion_products" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_promotions_org_active_window" ON "promotions" USING btree ("organization_id","is_active","start_at","end_at");--> statement-breakpoint
CREATE INDEX "account_user_id_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "invitation_organization_id_idx" ON "invitation" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "invitation_email_idx" ON "invitation" USING btree ("email");--> statement-breakpoint
CREATE INDEX "member_organization_id_idx" ON "member" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "member_user_id_idx" ON "member" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_user_id_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");