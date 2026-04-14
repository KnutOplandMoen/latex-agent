import { z } from 'zod';

export const UserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().nullable(),
  createdAt: z.string().datetime(),
});

export type User = z.infer<typeof UserSchema>;

export const CreateUserInput = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().nullable().optional(),
});

export type CreateUserInputType = z.infer<typeof CreateUserInput>;
