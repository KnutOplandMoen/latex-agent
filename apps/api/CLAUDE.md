# Fastify API conventions

Single source of truth for HTTP routes. The frontend, the collab server, and the agent service all talk to it (or directly to each other for hot paths).

## Project layout

```
apps/api/src/
├── server.ts             Fastify instance, plugin registration
├── plugins/
│   ├── auth.ts           Clerk JWT verification + dev bypass + user upsert
│   ├── db.ts             Drizzle injection + pool lifecycle
│   └── error-handler.ts  Centralized error mapping
├── routes/
│   ├── projects/
│   │   ├── index.ts      GET / POST /projects
│   │   ├── _id.ts        GET / DELETE /projects/:id
│   │   └── files.ts      GET / POST /projects/:id/files
│   └── files/
│       └── _id.ts        GET / PUT / DELETE /files/:id
├── services/
│   ├── projects.ts       Project CRUD + membership checks
│   └── files.ts          File CRUD + RBAC (viewers cannot create/edit/delete)
└── lib/
    └── errors.ts         AppError, NotFoundError, ForbiddenError, etc.
```

> **Planned for future phases:** `routes/projects/compile.ts` (Phase 4), `routes/agent.ts` (Phase 5), `routes/webhooks.ts` (Clerk user sync).

## Route definition pattern

Every route uses **fastify-type-provider-zod** for end-to-end type safety:

```ts
// routes/projects/index.ts
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { CreateProjectInput, ProjectSchema } from '@latex-ide/shared-types';
import { createProject, listUserProjects } from '../../services/projects';

const projectsRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.get('/', {
    schema: {
      response: { 200: z.array(ProjectSchema) },
    },
    handler: async (req) => {
      const userId = req.user.id; // injected by auth plugin
      return listUserProjects(userId);
    },
  });

  fastify.post('/', {
    schema: {
      body: CreateProjectInput,
      response: { 201: ProjectSchema },
    },
    handler: async (req, reply) => {
      const project = await createProject({ ...req.body, ownerId: req.user.id });
      reply.code(201);
      return project;
    },
  });
};

export default projectsRoutes;
```

### Rules for routes

- **Always** provide a `body` and `response` schema. Untyped routes are forbidden.
- **Never** put business logic in the handler. Handlers parse → call a service → return. That's it.
- **Never** access `db` directly from a route. Services own DB access.
- **Never** import from `apps/web` or `apps/agent`. Shared types come from `packages/shared-types`.

## Service layer

```ts
// services/projects.ts
import { db } from '../plugins/db';
import { projects, projectMembers } from '@latex-ide/db';
import { eq, and } from 'drizzle-orm';
import type { CreateProjectInput, Project } from '@latex-ide/shared-types';

export async function createProject(input: CreateProjectInput & { ownerId: string }): Promise<Project> {
  return db.transaction(async (tx) => {
    const [project] = await tx.insert(projects).values({
      name: input.name,
      ownerId: input.ownerId,
    }).returning();

    await tx.insert(projectMembers).values({
      projectId: project.id,
      userId: input.ownerId,
      role: 'owner',
    });

    return project;
  });
}

export async function listUserProjects(userId: string): Promise<Project[]> {
  return db.select({ /* ... */ })
    .from(projects)
    .innerJoin(projectMembers, eq(projects.id, projectMembers.projectId))
    .where(eq(projectMembers.userId, userId));
}
```

Services are pure functions. They take inputs, return outputs, and don't know HTTP exists. This makes them testable without spinning up Fastify.

## Auth — the only correct pattern

```ts
// plugins/auth.ts
import fp from 'fastify-plugin';
import { verifyToken } from '@clerk/backend';

declare module 'fastify' {
  interface FastifyRequest {
    user: { id: string; email: string };
  }
}

export default fp(async (fastify) => {
  fastify.addHook('onRequest', async (req, reply) => {
    if (req.url.startsWith('/webhooks/') || req.url === '/health') return;

    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      reply.code(401).send({ error: 'Unauthorized' });
      return;
    }

    try {
      const payload = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY! });
      req.user = { id: payload.sub, email: payload.email };
    } catch {
      reply.code(401).send({ error: 'Invalid token' });
    }
  });
});
```

**Every** route assumes `req.user` exists except `/webhooks/*` and `/health`.

## Authorization (different from authentication)

Auth tells you *who* the user is. Authorization tells you *what* they can do. Always check both:

```ts
// services/projects.ts
export async function getProject(projectId: string, userId: string): Promise<Project> {
  const member = await db.query.projectMembers.findFirst({
    where: and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)),
  });
  if (!member) throw new ForbiddenError('Not a project member');
  return db.query.projects.findFirst({ where: eq(projects.id, projectId) });
}
```

Never trust a `projectId` from the request body without checking membership. The most common bug in multi-tenant apps is forgetting this check on one route.

## Errors

Define typed errors in `lib/errors.ts`:

```ts
export class AppError extends Error {
  constructor(public statusCode: number, message: string, public code: string) {
    super(message);
  }
}
export class NotFoundError extends AppError {
  constructor(message = 'Not found') { super(404, message, 'NOT_FOUND'); }
}
export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') { super(403, message, 'FORBIDDEN'); }
}
export class ValidationError extends AppError {
  constructor(message: string) { super(400, message, 'VALIDATION_ERROR'); }
}
```

Centralized error handler:

```ts
// plugins/error-handler.ts
fastify.setErrorHandler((error, req, reply) => {
  if (error instanceof AppError) {
    reply.code(error.statusCode).send({ error: error.code, message: error.message });
    return;
  }
  if (error.validation) {
    reply.code(400).send({ error: 'VALIDATION_ERROR', details: error.validation });
    return;
  }
  req.log.error(error);
  reply.code(500).send({ error: 'INTERNAL_ERROR' });
});
```

Services throw typed errors. Routes don't need try/catch — the handler picks up errors automatically.

## Logging

Fastify ships with pino. Use `req.log.info({ projectId }, 'Created project')` — structured logging only. Never use `console.log`.

## Anti-patterns

- ❌ `app.get('/route', async (req, reply) => { /* 100 lines of logic */ })`. Extract to a service.
- ❌ Returning raw Drizzle query results without a Zod schema. The shape will drift.
- ❌ Catching errors in routes. Let them bubble to the error handler.
- ❌ Using `any` to silence Fastify's type errors. The Zod provider gives you full inference — use it.
- ❌ Hardcoding `process.env.X` inside services. Validate env at boot in `server.ts` and pass values down.
- ❌ Cross-importing between routes. Shared logic lives in services.
- ❌ Long-running synchronous work in handlers. Push to BullMQ, return a job ID.
