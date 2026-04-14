-- Phase 6: History, Comments, Sharing, Import/Export, Templates

-- Add description to projects
ALTER TABLE "projects" ADD COLUMN "description" text;

-- Version history snapshots
CREATE TABLE "project_snapshots" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "file_id" uuid NOT NULL REFERENCES "files"("id") ON DELETE CASCADE,
  "label" text,
  "created_by" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "yjs_state" bytea NOT NULL
);
CREATE INDEX "snapshots_file_created_idx" ON "project_snapshots" ("file_id", "created_at");

-- Inline comments with threading
CREATE TABLE "comments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "file_id" uuid NOT NULL REFERENCES "files"("id") ON DELETE CASCADE,
  "author_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "body" text NOT NULL,
  "resolved_at" timestamptz,
  "resolved_by" text REFERENCES "users"("id") ON DELETE SET NULL,
  "yjs_anchor" text NOT NULL,
  "parent_id" uuid REFERENCES "comments"("id") ON DELETE CASCADE,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "comments_file_resolved_idx" ON "comments" ("file_id", "resolved_at");
CREATE INDEX "comments_parent_idx" ON "comments" ("parent_id");

-- Project invites
CREATE TABLE "project_invites" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "invited_by" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "email" text NOT NULL,
  "role" text NOT NULL CHECK ("role" IN ('editor', 'viewer')),
  "token" text NOT NULL UNIQUE,
  "accepted_at" timestamptz,
  "expires_at" timestamptz NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "invites_token_idx" ON "project_invites" ("token");
CREATE INDEX "invites_project_idx" ON "project_invites" ("project_id");

-- Project templates (built-in starters)
CREATE TABLE "project_templates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "description" text NOT NULL,
  "category" text NOT NULL CHECK ("category" IN ('article', 'thesis', 'beamer', 'cv', 'ieee', 'acm')),
  "thumbnail" text,
  "files" jsonb NOT NULL,
  "is_builtin" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
