'use client';

import { useMemo } from 'react';
import { useAuth } from '@clerk/nextjs';
import { createApiClient, type ApiClient } from './api';

const clerkEnabled = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

export function useGetToken(): () => Promise<string | null> {
  if (clerkEnabled) {
    // Safe to call — ClerkProvider is in the tree when clerkEnabled is true
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const { getToken } = useAuth();
    return getToken;
  }
  return async () => null;
}

export function useApi(): ApiClient {
  const getToken = useGetToken();
  return useMemo(() => createApiClient(getToken), [getToken]);
}
