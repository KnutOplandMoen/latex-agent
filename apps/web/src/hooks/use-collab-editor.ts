'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import * as Y from 'yjs';
import { HocuspocusProvider } from '@hocuspocus/provider';
import { IndexeddbPersistence } from 'y-indexeddb';
import { useAuth, useUser } from '@clerk/nextjs';
import { colorForUser } from '@/lib/collab-colors';

const COLLAB_URL = process.env.NEXT_PUBLIC_COLLAB_URL ?? 'ws://localhost:3030';
const clerkEnabled = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

export interface AwarenessUser {
  clientId: number;
  name: string;
  color: string;
}

export interface CollabEditorState {
  ytext: Y.Text | null;
  provider: HocuspocusProvider | null;
  isConnected: boolean;
  isSynced: boolean;
  connectedUsers: AwarenessUser[];
}

export function useCollabEditor(
  projectId: string,
  fileId: string | null,
): CollabEditorState {
  const [isConnected, setIsConnected] = useState(false);
  const [isSynced, setIsSynced] = useState(false);
  const [connectedUsers, setConnectedUsers] = useState<AwarenessUser[]>([]);
  const [ytext, setYtext] = useState<Y.Text | null>(null);
  const [provider, setProvider] = useState<HocuspocusProvider | null>(null);

  const ydocRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<HocuspocusProvider | null>(null);
  const idbRef = useRef<IndexeddbPersistence | null>(null);

  const clerkGetToken = clerkEnabled
    // eslint-disable-next-line react-hooks/rules-of-hooks
    ? useAuth().getToken
    : null;

  const getToken = useCallback(
    async (): Promise<string> => {
      if (!clerkGetToken) return '';
      return (await clerkGetToken()) ?? '';
    },
    [clerkGetToken],
  );

  const clerkUser = clerkEnabled
    // eslint-disable-next-line react-hooks/rules-of-hooks
    ? useUser().user
    : null;

  const userName = clerkUser?.fullName ?? clerkUser?.username ?? 'Anonymous';
  const userId = clerkUser?.id ?? 'dev_user';

  useEffect(() => {
    if (!fileId) return;

    const documentName = `project:${projectId}:file:${fileId}`;

    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;

    const idb = new IndexeddbPersistence(documentName, ydoc);
    idbRef.current = idb;

    const hocuspocus = new HocuspocusProvider({
      url: COLLAB_URL,
      name: documentName,
      document: ydoc,
      token: getToken,
      onConnect() {
        setIsConnected(true);
      },
      onDisconnect() {
        setIsConnected(false);
      },
      onSynced() {
        setIsSynced(true);
      },
    });
    providerRef.current = hocuspocus;

    hocuspocus.awareness?.setLocalStateField('user', {
      name: userName,
      color: colorForUser(userId),
    });

    const updateUsers = () => {
      const states = hocuspocus.awareness?.getStates();
      if (!states) return;
      const users: AwarenessUser[] = [];
      states.forEach((state, clientId) => {
        if (clientId === ydoc.clientID) return;
        const user = state.user as { name?: string; color?: string } | undefined;
        if (user) {
          users.push({
            clientId,
            name: user.name ?? 'Anonymous',
            color: user.color ?? '#888',
          });
        }
      });
      setConnectedUsers(users);
    };

    hocuspocus.awareness?.on('change', updateUsers);

    const text = ydoc.getText('content');
    setYtext(text);
    setProvider(hocuspocus);
    setIsSynced(false);
    setIsConnected(false);

    return () => {
      hocuspocus.awareness?.off('change', updateUsers);
      hocuspocus.destroy();
      idb.destroy();
      ydoc.destroy();
      ydocRef.current = null;
      providerRef.current = null;
      idbRef.current = null;
      setYtext(null);
      setProvider(null);
      setIsConnected(false);
      setIsSynced(false);
      setConnectedUsers([]);
    };
  }, [projectId, fileId, getToken, userName, userId]);

  return { ytext, provider, isConnected, isSynced, connectedUsers };
}
