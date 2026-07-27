CREATE TABLE "ticket_discord_messages" (
	"ticket_id" uuid PRIMARY KEY NOT NULL,
	"channel_id" text NOT NULL,
	"message_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "discord_user_id" text;--> statement-breakpoint
ALTER TABLE "ticket_discord_messages" ADD CONSTRAINT "ticket_discord_messages_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_discord_user_id_unique" UNIQUE("discord_user_id");