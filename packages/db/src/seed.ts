import { createDb } from './client.js';
import { users, projects, projectMembers, files } from './schema.js';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

const db = createDb(DATABASE_URL);

async function seed() {
  console.log('Seeding database...');

  const [testUser] = await db
    .insert(users)
    .values({
      id: 'test_user_001',
      email: 'test@example.com',
      name: 'Test User',
    })
    .onConflictDoNothing()
    .returning();

  if (!testUser) {
    console.log('Test user already exists, skipping seed.');
    return;
  }

  const [project] = await db
    .insert(projects)
    .values({
      ownerId: testUser.id,
      name: 'Hello World',
      rootFile: 'main.tex',
    })
    .returning();

  await db.insert(projectMembers).values({
    projectId: project!.id,
    userId: testUser.id,
    role: 'owner',
  });

  await db.insert(files).values([
    { projectId: project!.id, path: 'main.tex', type: 'tex' as const },
    { projectId: project!.id, path: 'references.bib', type: 'bib' as const },
  ]);

  console.log(`Seeded: user "${testUser.email}", project "${project!.name}"`);
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
