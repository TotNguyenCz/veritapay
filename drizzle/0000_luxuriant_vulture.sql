CREATE TABLE "attestations" (
	"id" serial PRIMARY KEY NOT NULL,
	"tx_hash" text NOT NULL,
	"block_number" bigint NOT NULL,
	"subscription_id" bigint NOT NULL,
	"period_index" integer NOT NULL,
	"vendor" text NOT NULL,
	"uptime_bps" smallint NOT NULL,
	"latency_ms" integer NOT NULL,
	"error_rate_bps" smallint NOT NULL,
	"evidence_hash" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "disputes" (
	"id" serial PRIMARY KEY NOT NULL,
	"tx_hash" text NOT NULL,
	"block_number" bigint NOT NULL,
	"subscription_id" bigint NOT NULL,
	"period_index" integer NOT NULL,
	"subscriber" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "indexer_cursors" (
	"event_type" text PRIMARY KEY NOT NULL,
	"last_block" bigint NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "periods" (
	"id" serial PRIMARY KEY NOT NULL,
	"subscription_id" bigint NOT NULL,
	"period_index" integer NOT NULL,
	"period_start" bigint NOT NULL,
	"period_end" bigint NOT NULL,
	"state" smallint DEFAULT 0 NOT NULL,
	"attested_uptime_bps" smallint,
	"attested_latency_ms" integer,
	"attested_error_rate_bps" smallint,
	"attested_evidence_hash" text,
	"attested_at" timestamp,
	"attested_block" bigint,
	"settled_amount" numeric(40),
	"settled_at" timestamp,
	"settled_block" bigint,
	"disputed_at" timestamp,
	"disputed_block" bigint,
	"resolved_at" timestamp,
	"resolved_block" bigint,
	"synced_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" serial PRIMARY KEY NOT NULL,
	"service_id" bigint NOT NULL,
	"vendor" text NOT NULL,
	"name" text NOT NULL,
	"metadata_uri" text DEFAULT '' NOT NULL,
	"price_per_period" numeric(40) NOT NULL,
	"period_duration" integer NOT NULL,
	"challenge_window" integer NOT NULL,
	"grace_period" integer NOT NULL,
	"target_uptime_bps" smallint NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at_block" bigint NOT NULL,
	"created_at_ts" timestamp NOT NULL,
	"total_subscribers" integer DEFAULT 0 NOT NULL,
	"total_periods_settled" integer DEFAULT 0 NOT NULL,
	"total_usdc_settled" numeric(40) DEFAULT '0' NOT NULL,
	"synced_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"subscription_id" bigint NOT NULL,
	"service_id" bigint NOT NULL,
	"subscriber" text NOT NULL,
	"max_budget_per_period" numeric(40) NOT NULL,
	"periods_remaining" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"started_at_block" bigint NOT NULL,
	"started_at_ts" timestamp NOT NULL,
	"total_paid" numeric(40) DEFAULT '0' NOT NULL,
	"periods_completed" integer DEFAULT 0 NOT NULL,
	"synced_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "attestations_tx_hash_idx" ON "attestations" USING btree ("tx_hash");--> statement-breakpoint
CREATE INDEX "attestations_vendor_idx" ON "attestations" USING btree ("vendor");--> statement-breakpoint
CREATE INDEX "attestations_sub_id_idx" ON "attestations" USING btree ("subscription_id");--> statement-breakpoint
CREATE UNIQUE INDEX "disputes_tx_hash_idx" ON "disputes" USING btree ("tx_hash");--> statement-breakpoint
CREATE INDEX "disputes_subscriber_idx" ON "disputes" USING btree ("subscriber");--> statement-breakpoint
CREATE INDEX "disputes_sub_id_idx" ON "disputes" USING btree ("subscription_id");--> statement-breakpoint
CREATE UNIQUE INDEX "periods_sub_period_idx" ON "periods" USING btree ("subscription_id","period_index");--> statement-breakpoint
CREATE INDEX "periods_subscription_id_idx" ON "periods" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX "periods_state_idx" ON "periods" USING btree ("state");--> statement-breakpoint
CREATE INDEX "periods_period_end_idx" ON "periods" USING btree ("period_end");--> statement-breakpoint
CREATE UNIQUE INDEX "services_service_id_idx" ON "services" USING btree ("service_id");--> statement-breakpoint
CREATE INDEX "services_vendor_idx" ON "services" USING btree ("vendor");--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_sub_id_idx" ON "subscriptions" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX "subscriptions_subscriber_idx" ON "subscriptions" USING btree ("subscriber");--> statement-breakpoint
CREATE INDEX "subscriptions_service_id_idx" ON "subscriptions" USING btree ("service_id");