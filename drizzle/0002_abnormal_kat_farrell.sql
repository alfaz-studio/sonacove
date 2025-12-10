CREATE TABLE "sonacove"."meeting_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"meeting_id" integer NOT NULL,
	"event_type" varchar(50) NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sonacove"."meetings" (
	"id" serial PRIMARY KEY NOT NULL,
	"room_name" varchar(255) NOT NULL,
	"room_jid" varchar(255) NOT NULL,
	"is_breakout" boolean DEFAULT false NOT NULL,
	"breakout_room_id" varchar(255),
	"is_lobby" boolean DEFAULT false NOT NULL,
	"lobby_room_id" varchar(255),
	"status" varchar(20) DEFAULT 'ongoing' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sonacove"."meeting_events" ADD CONSTRAINT "meeting_events_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "sonacove"."meetings"("id") ON DELETE cascade ON UPDATE no action;