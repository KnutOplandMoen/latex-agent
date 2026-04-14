import {
  pgTable,
  uuid,
  text,
  timestamp,
  bigserial,
  customType,
  index,
  primaryKey,
  jsonb,
  boolean,
} from 'drizzle-orm/pg-core';

const bytea = customType<{ data: Buffer }>({
  dataType() {
    return 'bytea';
  },
});
import { relations } from 'drizzle-orm';

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerId: text('owner_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  rootFile: text('root_file').notNull().default('main.tex'),
  lastCompiledJobId: text('last_compiled_job_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const projectMembers = pgTable(
  'project_members',
  {
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role', { enum: ['owner', 'editor', 'viewer'] }).notNull(),
    addedAt: timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.projectId, t.userId] }), index('project_members_user_idx').on(t.userId)],
);

export const files = pgTable(
  'files',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    path: text('path').notNull(),
    type: text('type', { enum: ['tex', 'bib', 'image', 'other'] }).notNull(),
    content: text('content'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('files_project_path_idx').on(t.projectId, t.path)],
);

export const yjsUpdates = pgTable(
  'yjs_updates',
  {
    id: bigserial('id', { mode: 'bigint' }).primaryKey(),
    documentName: text('document_name').notNull(),
    update: bytea('update').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('yjs_updates_doc_idx').on(t.documentName, t.id)],
);

export const agentSessions = pgTable(
  'agent_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    mode: text('mode').notNull(),
    messages: text('messages').notNull(), // JSON array of messages
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('agent_sessions_project_idx').on(t.projectId),
    index('agent_sessions_user_idx').on(t.userId),
  ],
);

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  ownedProjects: many(projects),
  memberships: many(projectMembers),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  owner: one(users, { fields: [projects.ownerId], references: [users.id] }),
  members: many(projectMembers),
  files: many(files),
  snapshots: many(projectSnapshots),
  comments: many(comments),
  invites: many(projectInvites),
}));

export const projectMembersRelations = relations(projectMembers, ({ one }) => ({
  project: one(projects, { fields: [projectMembers.projectId], references: [projects.id] }),
  user: one(users, { fields: [projectMembers.userId], references: [users.id] }),
}));

export const filesRelations = relations(files, ({ one, many }) => ({
  project: one(projects, { fields: [files.projectId], references: [projects.id] }),
  snapshots: many(projectSnapshots),
  comments: many(comments),
}));

export const agentSessionsRelations = relations(agentSessions, ({ one }) => ({
  project: one(projects, { fields: [agentSessions.projectId], references: [projects.id] }),
  user: one(users, { fields: [agentSessions.userId], references: [users.id] }),
}));

// Phase 6 tables

export const projectSnapshots = pgTable(
  'project_snapshots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    fileId: uuid('file_id')
      .notNull()
      .references(() => files.id, { onDelete: 'cascade' }),
    label: text('label'),
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    yjsState: bytea('yjs_state').notNull(),
  },
  (t) => [index('snapshots_file_created_idx').on(t.fileId, t.createdAt)],
);

export const comments = pgTable(
  'comments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    fileId: uuid('file_id')
      .notNull()
      .references(() => files.id, { onDelete: 'cascade' }),
    authorId: text('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    body: text('body').notNull(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    resolvedBy: text('resolved_by').references(() => users.id, { onDelete: 'set null' }),
    yjsAnchor: text('yjs_anchor').notNull(),
    parentId: uuid('parent_id'), // self-reference set up in relations
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('comments_file_resolved_idx').on(t.fileId, t.resolvedAt),
    index('comments_parent_idx').on(t.parentId),
  ],
);

export const projectInvites = pgTable(
  'project_invites',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    invitedBy: text('invited_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    role: text('role', { enum: ['editor', 'viewer'] }).notNull(),
    token: text('token').notNull().unique(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('invites_token_idx').on(t.token),
    index('invites_project_idx').on(t.projectId),
  ],
);

export const projectTemplates = pgTable('project_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  category: text('category', { enum: ['article', 'thesis', 'beamer', 'cv', 'ieee', 'acm'] }).notNull(),
  thumbnail: text('thumbnail'),
  files: jsonb('files').notNull(), // [{path: string, content: string}]
  isBuiltin: boolean('is_builtin').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// Phase 6 relations
export const projectSnapshotsRelations = relations(projectSnapshots, ({ one }) => ({
  project: one(projects, { fields: [projectSnapshots.projectId], references: [projects.id] }),
  file: one(files, { fields: [projectSnapshots.fileId], references: [files.id] }),
  author: one(users, { fields: [projectSnapshots.createdBy], references: [users.id] }),
}));

export const commentsRelations = relations(comments, ({ one, many }) => ({
  project: one(projects, { fields: [comments.projectId], references: [projects.id] }),
  file: one(files, { fields: [comments.fileId], references: [files.id] }),
  author: one(users, { fields: [comments.authorId], references: [users.id] }),
  parent: one(comments, { fields: [comments.parentId], references: [comments.id], relationName: 'thread' }),
  replies: many(comments, { relationName: 'thread' }),
}));

export const projectInvitesRelations = relations(projectInvites, ({ one }) => ({
  project: one(projects, { fields: [projectInvites.projectId], references: [projects.id] }),
  inviter: one(users, { fields: [projectInvites.invitedBy], references: [users.id] }),
}));

