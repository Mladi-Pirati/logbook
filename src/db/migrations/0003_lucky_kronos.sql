CREATE TYPE "public"."ticket_comment_source" AS ENUM('logbook', 'discord');--> statement-breakpoint
CREATE TYPE "public"."ticket_comment_sync_operation" AS ENUM('create', 'update', 'delete');--> statement-breakpoint
CREATE TYPE "public"."ticket_comment_sync_status" AS ENUM('pending', 'synced', 'failed');--> statement-breakpoint
CREATE TABLE "ticket_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"body" text,
	"attachments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source" "ticket_comment_source" NOT NULL,
	"author_user_id" text,
	"discord_user_id" text,
	"discord_username" text,
	"discord_display_name" text,
	"discord_avatar_url" text,
	"discord_message_id" text,
	"discord_message_url" text,
	"sync_status" "ticket_comment_sync_status" DEFAULT 'pending' NOT NULL,
	"pending_operation" "ticket_comment_sync_operation",
	"last_sync_error" text,
	"last_sync_attempt_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"edited_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "ticket_discord_messages" ADD COLUMN "thread_id" text;--> statement-breakpoint
ALTER TABLE "ticket_comments" ADD CONSTRAINT "ticket_comments_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_comments" ADD CONSTRAINT "ticket_comments_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ticket_comments_ticket_created_idx" ON "ticket_comments" USING btree ("ticket_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ticket_comments_discord_message_id_uq" ON "ticket_comments" USING btree ("discord_message_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ticket_discord_messages_thread_id_uq" ON "ticket_discord_messages" USING btree ("thread_id");