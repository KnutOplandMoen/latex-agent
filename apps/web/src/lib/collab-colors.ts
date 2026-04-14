const COLORS = [
  '#e06c75', // red
  '#61afef', // blue
  '#98c379', // green
  '#c678dd', // purple
  '#e5c07b', // yellow
  '#56b6c2', // cyan
  '#be5046', // dark red
  '#d19a66', // orange
  '#7ec8e3', // light blue
  '#c3e88d', // light green
  '#ff79c6', // pink
  '#50fa7b', // bright green
] as const;

export function colorForUser(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash + userId.charCodeAt(i)) | 0;
  }
  return COLORS[Math.abs(hash) % COLORS.length]!;
}
