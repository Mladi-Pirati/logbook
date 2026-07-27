CREATE TABLE "ticket_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid,
	"draft_id" uuid,
	"uploaded_by_id" text NOT NULL,
	"object_key" text NOT NULL,
	"file_name" text NOT NULL,
	"content_type" text NOT NULL,
	"size" integer NOT NULL,
	"is_inline" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"claimed_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "ticket_attachments_owner_ck" CHECK ((("ticket_attachments"."ticket_id" is not null)::int + ("ticket_attachments"."draft_id" is not null)::int) = 1),
	CONSTRAINT "ticket_attachments_size_ck" CHECK ("ticket_attachments"."size" >= 0)
);
--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "description_document" jsonb DEFAULT '{"type":"doc","content":[{"type":"paragraph"}]}'::jsonb NOT NULL;--> statement-breakpoint
UPDATE "tickets"
SET "description_document" = jsonb_build_object(
  'type', 'doc',
  'content', jsonb_build_array(
    jsonb_build_object(
      'type', 'paragraph',
      'content', COALESCE(
        (
          SELECT jsonb_agg("nodes"."node" ORDER BY "nodes"."position")
          FROM (
            SELECT
              "lines"."ordinality" * 2 AS "position",
              jsonb_build_object('type', 'text', 'text', "lines"."line") AS "node"
            FROM unnest(string_to_array("tickets"."description", E'\n'))
              WITH ORDINALITY AS "lines"("line", "ordinality")
            WHERE "lines"."line" <> ''
            UNION ALL
            SELECT
              "breaks"."ordinality" * 2 + 1 AS "position",
              '{"type":"hardBreak"}'::jsonb AS "node"
            FROM unnest(string_to_array("tickets"."description", E'\n'))
              WITH ORDINALITY AS "breaks"("line", "ordinality")
            WHERE "breaks"."ordinality" < cardinality(string_to_array("tickets"."description", E'\n'))
          ) AS "nodes"
        ),
        '[]'::jsonb
      )
    )
  )
)
WHERE "description" IS NOT NULL AND "description" <> '';--> statement-breakpoint
ALTER TABLE "ticket_attachments" ADD CONSTRAINT "ticket_attachments_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_attachments" ADD CONSTRAINT "ticket_attachments_uploaded_by_id_users_id_fk" FOREIGN KEY ("uploaded_by_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ticket_attachments_object_key_uq" ON "ticket_attachments" USING btree ("object_key");--> statement-breakpoint
CREATE INDEX "ticket_attachments_ticket_idx" ON "ticket_attachments" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "ticket_attachments_draft_idx" ON "ticket_attachments" USING btree ("draft_id");--> statement-breakpoint
CREATE INDEX "ticket_attachments_cleanup_idx" ON "ticket_attachments" USING btree ("deleted_at","created_at");
