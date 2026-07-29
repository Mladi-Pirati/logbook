CREATE TABLE "comment_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"comment_id" uuid,
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
	CONSTRAINT "comment_attachments_owner_ck" CHECK ((("comment_attachments"."comment_id" is not null)::int + ("comment_attachments"."draft_id" is not null)::int) = 1),
	CONSTRAINT "comment_attachments_size_ck" CHECK ("comment_attachments"."size" >= 0)
);
--> statement-breakpoint
ALTER TABLE "ticket_comments" ADD COLUMN "body_document" jsonb DEFAULT '{"type":"doc","content":[{"type":"paragraph"}]}'::jsonb NOT NULL;--> statement-breakpoint
UPDATE "ticket_comments"
SET "body_document" = jsonb_build_object(
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
            FROM unnest(string_to_array("ticket_comments"."body", E'\n'))
              WITH ORDINALITY AS "lines"("line", "ordinality")
            WHERE "lines"."line" <> ''
            UNION ALL
            SELECT
              "breaks"."ordinality" * 2 + 1 AS "position",
              '{"type":"hardBreak"}'::jsonb AS "node"
            FROM unnest(string_to_array("ticket_comments"."body", E'\n'))
              WITH ORDINALITY AS "breaks"("line", "ordinality")
            WHERE "breaks"."ordinality" < cardinality(string_to_array("ticket_comments"."body", E'\n'))
          ) AS "nodes"
        ),
        '[]'::jsonb
      )
    )
  )
)
WHERE "body" IS NOT NULL AND "body" <> '';--> statement-breakpoint
ALTER TABLE "comment_attachments" ADD CONSTRAINT "comment_attachments_comment_id_ticket_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."ticket_comments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_attachments" ADD CONSTRAINT "comment_attachments_uploaded_by_id_users_id_fk" FOREIGN KEY ("uploaded_by_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "comment_attachments_object_key_uq" ON "comment_attachments" USING btree ("object_key");--> statement-breakpoint
CREATE INDEX "comment_attachments_comment_idx" ON "comment_attachments" USING btree ("comment_id");--> statement-breakpoint
CREATE INDEX "comment_attachments_draft_idx" ON "comment_attachments" USING btree ("draft_id");--> statement-breakpoint
CREATE INDEX "comment_attachments_cleanup_idx" ON "comment_attachments" USING btree ("deleted_at","created_at");
