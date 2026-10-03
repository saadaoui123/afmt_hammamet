CREATE TABLE "assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"version_id" integer NOT NULL,
	"teaching_id" integer,
	"day" integer NOT NULL,
	"start_slot" integer NOT NULL,
	"hours" integer NOT NULL,
	"kind" text DEFAULT 'COURS' NOT NULL,
	"group_id" integer NOT NULL,
	"subject_id" integer NOT NULL,
	"instructor_id" integer NOT NULL,
	"room_id" integer NOT NULL,
	"source" text DEFAULT 'gen' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"at" timestamp DEFAULT now() NOT NULL,
	"author" text DEFAULT 'Ines Khrifech' NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text DEFAULT '' NOT NULL,
	"action" text NOT NULL,
	"details" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "groups" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"level" text DEFAULT 'CAP' NOT NULL,
	"year" integer DEFAULT 1 NOT NULL,
	"specialty" text DEFAULT '' NOT NULL,
	"student_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "instructors" (
	"id" serial PRIMARY KEY NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"specialty" text DEFAULT '' NOT NULL,
	"competences" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"max_hours_per_week" integer DEFAULT 18 NOT NULL,
	"max_hours_per_day" integer DEFAULT 8 NOT NULL,
	"blocked" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"preferences" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rooms" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"kind" text DEFAULT 'normale' NOT NULL,
	"capacity" integer DEFAULT 30 NOT NULL,
	"allowed_kinds" jsonb DEFAULT '["COURS"]'::jsonb NOT NULL,
	"blocked" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"period_name" text DEFAULT 'Semestre' NOT NULL,
	"start_date" text DEFAULT '2025-10-06' NOT NULL,
	"end_date" text DEFAULT '2026-01-23' NOT NULL,
	"boundaries" jsonb DEFAULT '["08:00","10:00","12:00","13:30","15:30","17:30"]'::jsonb NOT NULL,
	"enabled_days" jsonb DEFAULT '[0,1,2,3,4]'::jsonb NOT NULL,
	"cours_durations" jsonb DEFAULT '[2,4]'::jsonb NOT NULL,
	"tp_durations" jsonb DEFAULT '[4]'::jsonb NOT NULL,
	"weights" jsonb DEFAULT '{"gaps":6,"overload":5,"balance":5,"prefs":3,"compact":8}'::jsonb NOT NULL,
	"holidays" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"special_rules" jsonb DEFAULT '{"pause1214Enabled":true,"after18Enabled":true,"allowedSpecialties":["Cuisine","Pâtisserie","Restaurant","Restauration"]}'::jsonb NOT NULL,
	"active_version_id" integer,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subjects" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"competence_key" text NOT NULL,
	"kind" text DEFAULT 'COURS' NOT NULL,
	"category" text DEFAULT 'generale' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teachings" (
	"id" serial PRIMARY KEY NOT NULL,
	"group_id" integer NOT NULL,
	"subject_id" integer NOT NULL,
	"hours_per_week" integer DEFAULT 2 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schedule_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"label" text DEFAULT 'Version' NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"author" text DEFAULT 'Ines Khrifech' NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"conflict_count" integer DEFAULT 0 NOT NULL,
	"unplaced_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_version_id_schedule_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."schedule_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_teaching_id_teachings_id_fk" FOREIGN KEY ("teaching_id") REFERENCES "public"."teachings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_instructor_id_instructors_id_fk" FOREIGN KEY ("instructor_id") REFERENCES "public"."instructors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teachings" ADD CONSTRAINT "teachings_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teachings" ADD CONSTRAINT "teachings_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE cascade ON UPDATE no action;