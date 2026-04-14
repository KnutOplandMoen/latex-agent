'use client';

import { useEffect } from 'react';
import { Command } from 'cmdk';
import { DialogTitle } from '@radix-ui/react-dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import {
  FileCode,
  PanelLeftClose,
  PanelRightClose,
  Play,
  Type,
  Sigma,
  FileSearch,
} from 'lucide-react';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  files: string[];
  onFileSelect: (fileName: string) => void;
  onToggleLeftPanel: () => void;
  onToggleRightPanel: () => void;
  onInsertText?: (text: string) => void;
}

const GREEK_SYMBOLS = [
  { label: '\\alpha', insert: '\\alpha' },
  { label: '\\beta', insert: '\\beta' },
  { label: '\\gamma', insert: '\\gamma' },
  { label: '\\delta', insert: '\\delta' },
  { label: '\\epsilon', insert: '\\epsilon' },
  { label: '\\theta', insert: '\\theta' },
  { label: '\\lambda', insert: '\\lambda' },
  { label: '\\mu', insert: '\\mu' },
  { label: '\\pi', insert: '\\pi' },
  { label: '\\sigma', insert: '\\sigma' },
  { label: '\\omega', insert: '\\omega' },
  { label: '\\phi', insert: '\\phi' },
  { label: '\\psi', insert: '\\psi' },
];

const MATH_OPERATORS = [
  { label: '\\frac{}{}', insert: '\\frac{}{}' },
  { label: '\\sqrt{}', insert: '\\sqrt{}' },
  { label: '\\sum', insert: '\\sum' },
  { label: '\\int', insert: '\\int' },
  { label: '\\prod', insert: '\\prod' },
  { label: '\\lim', insert: '\\lim' },
  { label: '\\infty', insert: '\\infty' },
  { label: '\\partial', insert: '\\partial' },
  { label: '\\nabla', insert: '\\nabla' },
  { label: '\\forall', insert: '\\forall' },
  { label: '\\exists', insert: '\\exists' },
  { label: '\\rightarrow', insert: '\\rightarrow' },
  { label: '\\Rightarrow', insert: '\\Rightarrow' },
  { label: '\\leq', insert: '\\leq' },
  { label: '\\geq', insert: '\\geq' },
  { label: '\\neq', insert: '\\neq' },
  { label: '\\approx', insert: '\\approx' },
];

export function CommandPalette({
  open,
  onOpenChange,
  files,
  onFileSelect,
  onToggleLeftPanel,
  onToggleRightPanel,
  onInsertText,
}: CommandPaletteProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onOpenChange]);

  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label="Command palette"
      className="fixed inset-0 z-50"
      overlayClassName="fixed inset-0 bg-black/50"
    >
      <VisuallyHidden>
        <DialogTitle>Command palette</DialogTitle>
      </VisuallyHidden>
      <div className="fixed top-[20%] left-1/2 -translate-x-1/2 w-full max-w-[520px] bg-[#21252b] rounded-lg border border-[#3e4451] shadow-2xl overflow-hidden">
        <Command.Input
          placeholder="Type a command or search..."
          className="w-full px-4 py-3 bg-transparent text-[#abb2bf] text-sm outline-none border-b border-[#3e4451] placeholder:text-[#5c6370]"
        />

        <Command.List className="max-h-[320px] overflow-y-auto p-2">
          <Command.Empty className="py-6 text-center text-sm text-[#5c6370]">
            No results found.
          </Command.Empty>

          <Command.Group heading="Files" className="text-xs text-[#5c6370] px-2 py-1.5">
            {files.map((file) => (
              <Command.Item
                key={file}
                value={`file ${file}`}
                onSelect={() => {
                  onFileSelect(file);
                  onOpenChange(false);
                }}
                className="flex items-center gap-2 px-2 py-1.5 rounded text-sm text-[#abb2bf] cursor-pointer data-[selected=true]:bg-[#2c313a]"
              >
                <FileCode size={14} className="text-green-400 shrink-0" />
                {file}
              </Command.Item>
            ))}
          </Command.Group>

          <Command.Group heading="Actions" className="text-xs text-[#5c6370] px-2 py-1.5">
            <Command.Item
              value="compile project"
              onSelect={() => {
                onOpenChange(false);
              }}
              className="flex items-center gap-2 px-2 py-1.5 rounded text-sm text-[#abb2bf] cursor-pointer data-[selected=true]:bg-[#2c313a]"
            >
              <Play size={14} className="text-blue-400 shrink-0" />
              Compile Project
            </Command.Item>
            <Command.Item
              value="toggle sidebar"
              onSelect={() => {
                onToggleLeftPanel();
                onOpenChange(false);
              }}
              className="flex items-center gap-2 px-2 py-1.5 rounded text-sm text-[#abb2bf] cursor-pointer data-[selected=true]:bg-[#2c313a]"
            >
              <PanelLeftClose size={14} className="text-purple-400 shrink-0" />
              Toggle Sidebar
            </Command.Item>
            <Command.Item
              value="toggle pdf preview"
              onSelect={() => {
                onToggleRightPanel();
                onOpenChange(false);
              }}
              className="flex items-center gap-2 px-2 py-1.5 rounded text-sm text-[#abb2bf] cursor-pointer data-[selected=true]:bg-[#2c313a]"
            >
              <PanelRightClose size={14} className="text-purple-400 shrink-0" />
              Toggle PDF Preview
            </Command.Item>
            <Command.Item
              value="find in files"
              onSelect={() => {
                onOpenChange(false);
              }}
              className="flex items-center gap-2 px-2 py-1.5 rounded text-sm text-[#abb2bf] cursor-pointer data-[selected=true]:bg-[#2c313a]"
            >
              <FileSearch size={14} className="text-orange-400 shrink-0" />
              Find in Files
            </Command.Item>
          </Command.Group>

          <Command.Group heading="Insert Symbol" className="text-xs text-[#5c6370] px-2 py-1.5">
            {GREEK_SYMBOLS.map((sym) => (
              <Command.Item
                key={sym.label}
                value={`insert symbol ${sym.label}`}
                onSelect={() => {
                  onInsertText?.(sym.insert);
                  onOpenChange(false);
                }}
                className="flex items-center gap-2 px-2 py-1.5 rounded text-sm text-[#abb2bf] cursor-pointer data-[selected=true]:bg-[#2c313a]"
              >
                <Type size={14} className="text-teal-400 shrink-0" />
                <code className="font-mono text-xs">{sym.label}</code>
              </Command.Item>
            ))}
          </Command.Group>

          <Command.Group heading="Math Operators" className="text-xs text-[#5c6370] px-2 py-1.5">
            {MATH_OPERATORS.map((op) => (
              <Command.Item
                key={op.label}
                value={`insert math ${op.label}`}
                onSelect={() => {
                  onInsertText?.(op.insert);
                  onOpenChange(false);
                }}
                className="flex items-center gap-2 px-2 py-1.5 rounded text-sm text-[#abb2bf] cursor-pointer data-[selected=true]:bg-[#2c313a]"
              >
                <Sigma size={14} className="text-pink-400 shrink-0" />
                <code className="font-mono text-xs">{op.label}</code>
              </Command.Item>
            ))}
          </Command.Group>
        </Command.List>
      </div>
    </Command.Dialog>
  );
}
