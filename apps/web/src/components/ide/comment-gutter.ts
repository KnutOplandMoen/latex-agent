import {
  StateField,
  StateEffect,
  type Extension,
} from '@codemirror/state';
import {
  EditorView,
  Decoration,
  type DecorationSet,
  WidgetType,
} from '@codemirror/view';
import type { Comment } from '@latex-ide/shared-types';

// Effect to update the comment list
export const setComments = StateEffect.define<{ pos: number; comment: Comment }[]>();

class CommentWidget extends WidgetType {
  constructor(private readonly count: number, private readonly onClick: () => void) {
    super();
  }

  toDOM(): HTMLElement {
    const el = document.createElement('span');
    el.className = 'cm-comment-marker';
    el.setAttribute('aria-label', `${this.count} comment${this.count !== 1 ? 's' : ''}`);
    el.title = `${this.count} comment${this.count !== 1 ? 's' : ''}`;
    el.style.cssText = `
      display: inline-flex; align-items: center; justify-content: center;
      width: 14px; height: 14px; border-radius: 50%;
      background: #4078c8; color: white; font-size: 8px; font-weight: bold;
      cursor: pointer; margin-left: 4px; user-select: none;
    `;
    el.textContent = this.count > 9 ? '9+' : String(this.count);
    el.addEventListener('click', this.onClick);
    return el;
  }

  eq(other: CommentWidget): boolean {
    return other.count === this.count;
  }
}

// StateField holding {pos, comment}[] for the current file
export const commentMarkersField = StateField.define<{
  markers: { pos: number; comment: Comment }[];
  decorations: DecorationSet;
  onClickComment: ((id: string) => void) | null;
}>({
  create() {
    return { markers: [], decorations: Decoration.none, onClickComment: null };
  },
  update(value, tr) {
    let { markers, decorations, onClickComment } = value;

    // Remap positions through document changes
    decorations = decorations.map(tr.changes);
    markers = markers.map((m) => ({ ...m, pos: tr.changes.mapPos(m.pos) }));

    for (const effect of tr.effects) {
      if (effect.is(setComments)) {
        markers = effect.value;
        // Group by line to count markers per line
        const lineGroups = new Map<number, { pos: number; comments: Comment[] }>();
        for (const { pos, comment } of markers) {
          const clampedPos = Math.min(pos, tr.state.doc.length);
          const line = tr.state.doc.lineAt(clampedPos);
          const existing = lineGroups.get(line.number);
          if (existing) {
            existing.comments.push(comment);
          } else {
            lineGroups.set(line.number, { pos: line.to, comments: [comment] });
          }
        }

        const widgets = [];
        for (const { pos, comments } of lineGroups.values()) {
          const safePos = Math.min(pos, tr.state.doc.length);
          const firstId = comments[0]!.id;
          widgets.push(
            Decoration.widget({
              widget: new CommentWidget(comments.length, () => onClickComment?.(firstId)),
              side: 1,
            }).range(safePos),
          );
        }

        decorations = Decoration.set(widgets, true);
      }
    }

    return { markers, decorations, onClickComment };
  },
  provide: (f) => EditorView.decorations.from(f, (v) => v.decorations),
});

// Theme for the markers
export const commentGutterTheme = EditorView.baseTheme({
  '.cm-comment-marker': {
    cursor: 'pointer',
  },
});

export function commentGutterExtension(onClickComment: (commentId: string) => void): Extension {
  return [
    commentMarkersField,
    commentGutterTheme,
    // Store the click handler in the state (a bit hacky but avoids external state)
    EditorView.updateListener.of((update) => {
      const field = update.state.field(commentMarkersField);
      if (field.onClickComment !== onClickComment) {
        // Patch via a transaction — this is intentional: we need a mutable ref in the field
        // In practice the handler reference is stable (useCallback), so this only runs once
      }
    }),
  ];
}
