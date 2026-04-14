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
  mountKey: number;
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
  const [mountKey, setMountKey] = useState(0);

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
        setIsSynced(false);
      },
      // isSynced is set in handleSynced below, which also coordinates editor mount
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

    setIsSynced(false);
    setIsConnected(false);

    // Mount the editor only after BOTH IndexedDB and Hocuspocus have synced.
    // This prevents the blank-editor bug where IDB resolves immediately (empty)
    // while Hocuspocus is still fetching server content, causing CodeMirror to
    // initialise with an empty Y.Text that yCollab never re-initialises.
    //
    // Offline fallback: if Hocuspocus hasn't synced within 5 seconds (e.g. the
    // collab server is down), mount anyway with whatever IDB has.
    let destroyed = false;
    let idbReady = false;
    let hocuspocusSynced = false;
    let offlineTimer: ReturnType<typeof setTimeout> | null = null;
    let offlineTimerFired = false;

    const tryMount = () => {
      if (!destroyed && idbReady && (hocuspocusSynced || offlineTimer === null)) {
        setYtext(ydoc.getText('content'));
        setProvider(hocuspocus);
      }
    };

    idb.whenSynced.then(() => {
      idbReady = true;
      if (hocuspocusSynced) {
        tryMount();
      } else {
        // Start the offline fallback timer now that IDB is ready.
        offlineTimer = setTimeout(() => {
          offlineTimerFired = true;
          offlineTimer = null; // signals tryMount that the timer fired
          tryMount();
        }, 5000);
      }
    });

    const handleSynced = () => {
      if (!hocuspocusSynced) {
        hocuspocusSynced = true;
        setIsSynced(true);
        if (offlineTimer !== null) {
          clearTimeout(offlineTimer);
          offlineTimer = null;
        }
        if (offlineTimerFired) {
          // The offline fallback already mounted the editor with potentially empty content.
          // Force a remount now that Hocuspocus has actual server content.
          setMountKey((k) => k + 1);
        }
        tryMount();
      }
    };

    hocuspocus.on('synced', handleSynced);

    return () => {
      destroyed = true;
      if (offlineTimer !== null) clearTimeout(offlineTimer);
      hocuspocus.off('synced', handleSynced);
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

  return { ytext, provider, isConnected, isSynced, connectedUsers, mountKey };
}
