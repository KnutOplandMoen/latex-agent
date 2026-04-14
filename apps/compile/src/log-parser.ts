import type { CompileError } from '@latex-ide/shared-types';

interface ParsedLog {
  errors: CompileError[];
  warnings: CompileError[];
}

/**
 * Parse a LaTeX log file into structured errors and warnings.
 *
 * LaTeX logs are notoriously unstructured. This parser handles the most common
 * patterns: `! ...` error lines with file/line context, and `LaTeX Warning:` lines.
 * It won't catch everything — add cases as real users hit unparsed errors.
 */
export function parseLatexLog(logContent: string): ParsedLog {
  const errors: CompileError[] = [];
  const warnings: CompileError[] = [];
  const lines = logContent.split('\n');

  let currentFile = 'main.tex';
  const fileStack: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;

    trackFileContext(line, fileStack);
    currentFile = fileStack[fileStack.length - 1] ?? 'main.tex';

    // Fatal errors: lines starting with "! "
    if (line.startsWith('! ')) {
      const message = line.slice(2).trim();
      const lineNum = extractLineNumber(lines, i);
      errors.push({
        file: currentFile,
        line: lineNum,
        message,
        level: 'error',
      });
      continue;
    }

    // File-line-error format: "./main.tex:42: Undefined control sequence."
    const fileLineMatch = line.match(/^\.\/(.+?):(\d+):\s*(.+)/);
    if (fileLineMatch) {
      errors.push({
        file: fileLineMatch[1]!,
        line: parseInt(fileLineMatch[2]!, 10),
        message: fileLineMatch[3]!,
        level: 'error',
      });
      continue;
    }

    // LaTeX warnings
    const warnMatch = line.match(/LaTeX Warning:\s*(.+)/);
    if (warnMatch) {
      let message = warnMatch[1]!;
      // Warnings can span multiple lines, ending at a blank line
      let j = i + 1;
      while (j < lines.length && lines[j]!.trim() !== '' && !lines[j]!.startsWith('!')) {
        message += ' ' + lines[j]!.trim();
        j++;
      }
      const warnLine = extractLineNumberFromWarning(message);
      warnings.push({
        file: currentFile,
        line: warnLine,
        message: message.trim(),
        level: 'warning',
      });
      continue;
    }

    // Overfull/Underfull box warnings
    const boxMatch = line.match(/((?:Over|Under)full \\[hv]box .+)/);
    if (boxMatch) {
      const boxLine = extractLineNumberFromWarning(line);
      warnings.push({
        file: currentFile,
        line: boxLine,
        message: boxMatch[1]!,
        level: 'warning',
      });
    }
  }

  return { errors, warnings };
}

/**
 * Track the current file by following TeX's parenthesized file-open/close markers.
 * TeX logs show `(./file.tex` when opening and `)` when closing.
 */
function trackFileContext(line: string, fileStack: string[]): void {
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '(' && i + 1 < line.length && line[i + 1] !== ')') {
      // Extract filename: everything after ( until whitespace or end of line
      const rest = line.slice(i + 1);
      const match = rest.match(/^(\.\/[^\s)]+|[^\s)]+\.(?:tex|sty|cls|bib|aux|bbl|toc|lof|lot|idx|ind|out))/);
      if (match) {
        let file = match[1]!;
        if (file.startsWith('./')) file = file.slice(2);
        fileStack.push(file);
        i += match[0].length;
      }
    } else if (line[i] === ')') {
      if (fileStack.length > 1) {
        fileStack.pop();
      }
    }
  }
}

/**
 * Look ahead from an error line to find "l.NNN" which TeX prints as the line reference.
 */
function extractLineNumber(lines: string[], errorIndex: number): number | null {
  for (let j = errorIndex + 1; j < Math.min(errorIndex + 6, lines.length); j++) {
    const match = lines[j]!.match(/^l\.(\d+)/);
    if (match) return parseInt(match[1]!, 10);
  }
  return null;
}

function extractLineNumberFromWarning(message: string): number | null {
  const match = message.match(/on input line (\d+)/);
  if (match) return parseInt(match[1]!, 10);
  const match2 = message.match(/at lines? (\d+)/);
  if (match2) return parseInt(match2[1]!, 10);
  return null;
}
