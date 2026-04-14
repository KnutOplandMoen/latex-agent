import {
  pgTable,
  uuid,
  text,
  timestamp,
  bigserial,
  customType,
  index,
  primaryKey,
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
  rootFile: text('root_file').notNull().default('main.tex'),
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
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
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

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  ownedProjects: many(projects),
  memberships: many(projectMembers),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  owner: one(users, { fields: [projects.ownerId], references: [users.id] }),
  members: many(projectMembers),
  files: many(files),
}));

export const projectMembersRelations = relations(projectMembers, ({ one }) => ({
  project: one(projects, { fields: [projectMembers.projectId], references: [projects.id] }),
  user: one(users, { fields: [projectMembers.userId], references: [users.id] }),
}));

export const filesRelations = relations(files, ({ one }) => ({
  project: one(projects, { fields: [files.projectId], references: [projects.id] }),
}));
