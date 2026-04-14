'use client';

import { useMemo } from 'react';
import { List, Hash } from 'lucide-react';

interface OutlineEntry {
  level: number;
  title: string;
  line: number;
}

interface OutlineViewProps {
  content: string;
  onNavigate?: (line: number) => void;
}

const SECTION_COMMANDS: Record<string, number> = {
  '\\part': 0,
  '\\chapter': 1,
  '\\section': 2,
  '\\subsection': 3,
  '\\subsubsection': 4,
  '\\paragraph': 5,
  '\\subparagraph': 6,
};

function parseOutline(content: string): OutlineEntry[] {
  const entries: OutlineEntry[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    for (const [cmd, level] of Object.entries(SECTION_COMMANDS)) {
      const starredCmd = cmd + '*';
      const idx = line.indexOf(cmd);
      if (idx === -1) continue;

      const afterCmd = line.slice(idx + cmd.length);
      const isStarred = afterCmd.startsWith('*');
      const rest = isStarred ? afterCmd.slice(1) : afterCmd;

      const braceIdx = rest.indexOf('{');
      if (braceIdx === -1) continue;

      // Only match if what's between the command and { is whitespace or nothing
      const between = rest.slice(0, braceIdx).trim();
      if (between.length > 0) continue;

      const closeBrace = rest.indexOf('}', braceIdx);
      if (closeBrace === -1) continue;

      const title = rest.slice(braceIdx + 1, closeBrace);
      entries.push({ level, title, line: i + 1 });
      break;
    }
  }

  return entries;
}

export function OutlineView({ content, onNavigate }: OutlineViewProps) {
  const entries = useMemo(() => parseOutline(content), [content]);

  if (entries.length === 0) {
    return (
      <div className="p-3 text-xs text-[#5c6370]">
        No sections found in this document.
      </div>
    );
  }

  const minLevel = Math.min(...entries.map((e) => e.level));

  return (
    <div className="h-full flex flex-col text-sm">
      <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-[#5c6370] border-b border-[#3e4451] flex items-center gap-1.5">
        <List size={14} />
        Outline
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {entries.map((entry, i) => (
          <button
            key={`${entry.line}-${i}`}
            onClick={() => onNavigate?.(entry.line)}
            className="flex items-center gap-1.5 w-full px-2 py-1 text-left text-[#abb2bf] hover:bg-[#2c313a] transition-colors"
            style={{ paddingLeft: `${(entry.level - minLevel) * 12 + 8}px` }}
          >
            <Hash size={12} className="text-[#5c6370] shrink-0" />
            <span className="truncate">{entry.title}</span>
            <span className="ml-auto text-xs text-[#5c6370]">{entry.line}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
