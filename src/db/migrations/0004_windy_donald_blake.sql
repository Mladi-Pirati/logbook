CREATE TABLE "helm_directory_syncs" (
	"key" text PRIMARY KEY NOT NULL,
	"last_completed_at" timestamp with time zone,
	"lease_until" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "profile_picture_version" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "profile_picture_blurhash" text;