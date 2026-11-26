import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Bold, Heading2, Italic, List, ListOrdered, Quote, Strikethrough } from 'lucide-react';
import { cx } from '../lib/utils';

export function RichText({ value, onChange, placeholder = 'Write something…', autoFocus }: {
  value: string; onChange: (html: string) => void; placeholder?: string; autoFocus?: boolean;
}) {
  const editor = useEditor({
    extensions: [StarterKit.configure({ link: { openOnClick: true, autolink: true } }), Placeholder.configure({ placeholder })],
    content: value,
    autofocus: autoFocus ? 'end' : false,
    editorProps: { attributes: { class: 'prose-note min-h-[40vh] py-2' } },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });
  const active = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e?.isActive('bold'), italic: e?.isActive('italic'), strike: e?.isActive('strike'),
      h2: e?.isActive('heading', { level: 2 }), ul: e?.isActive('bulletList'), ol: e?.isActive('orderedList'), quote: e?.isActive('blockquote'),
    }),
  });
  if (!editor) return null;
  const tools = [
    { k: 'bold', icon: Bold, run: () => editor.chain().focus().toggleBold().run() },
    { k: 'italic', icon: Italic, run: () => editor.chain().focus().toggleItalic().run() },
    { k: 'strike', icon: Strikethrough, run: () => editor.chain().focus().toggleStrike().run() },
    { k: 'h2', icon: Heading2, run: () => editor.chain().focus().toggleHeading({ level: 2 }).run() },
    { k: 'ul', icon: List, run: () => editor.chain().focus().toggleBulletList().run() },
    { k: 'ol', icon: ListOrdered, run: () => editor.chain().focus().toggleOrderedList().run() },
    { k: 'quote', icon: Quote, run: () => editor.chain().focus().toggleBlockquote().run() },
  ] as const;
  return (
    <div>
      <div className="sticky top-0 z-10 -mx-1 mb-1 flex gap-0.5 overflow-x-auto bg-panel py-1 scrollbar-none">
        {tools.map(({ k, icon: I, run }) => (
          <button key={k} type="button" onMouseDown={(e) => e.preventDefault()} onClick={run}
            className={cx('rounded-lg p-2 transition', active?.[k] ? 'bg-panel2 text-[var(--accent)]' : 'text-mute hover:bg-panel2')}>
            <I size={16} />
          </button>
        ))}
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
