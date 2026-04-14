'use client';

import type { AwarenessUser } from '@/hooks/use-collab-editor';

interface PresenceIndicatorProps {
  users: AwarenessUser[];
}

export function PresenceIndicator({ users }: PresenceIndicatorProps) {
  if (users.length === 0) return null;

  const visible = users.slice(0, 4);
  const overflow = users.length - visible.length;

  return (
    <div className="flex items-center gap-1">
      {visible.map((user) => (
        <div
          key={user.clientId}
          className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-medium text-white shrink-0"
          style={{ backgroundColor: user.color }}
          title={user.name}
        >
          {user.name.charAt(0).toUpperCase()}
        </div>
      ))}
      {overflow > 0 && (
        <span className="text-[10px] text-[#7f848e]">
          +{overflow}
        </span>
      )}
    </div>
  );
}
