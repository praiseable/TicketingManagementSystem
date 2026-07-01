import { useEffect, useState } from 'react';
import { EditorContent, Node, mergeAttributes, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import CharacterCount from '@tiptap/extension-character-count';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import Highlight from '@tiptap/extension-highlight';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Mention from '@tiptap/extension-mention';
import HorizontalRule from '@tiptap/extension-horizontal-rule';
import { all, createLowlight } from 'lowlight';
import { Bold, Code, Heading1, Heading2, Highlighter, Image as ImageIcon, Italic, List, ListOrdered, Table as TableIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const lowlight = createLowlight(all);

const InfoPanel = Node.create({ name: 'infoPanel', group: 'block', content: 'block+', defining: true, addAttributes: () => ({ type: { default: 'note' } }), parseHTML: () => [{ tag: 'div[data-info-panel]' }], renderHTML: ({ HTMLAttributes }) => ['div', mergeAttributes(HTMLAttributes, { 'data-info-panel': '', class: `rounded-lg border p-3 my-3 info-panel-${HTMLAttributes.type}` }), 0] });
const JiraIssueEmbed = Node.create({ name: 'jiraIssueEmbed', group: 'block', atom: true, addAttributes: () => ({ issueKey: { default: '' }, title: { default: 'Linked issue' }, status: { default: 'Todo' } }), parseHTML: () => [{ tag: 'div[data-jira-issue]' }], renderHTML: ({ HTMLAttributes }) => ['div', mergeAttributes(HTMLAttributes, { 'data-jira-issue': '', class: 'rounded-md border bg-muted p-3 my-3' }), `${HTMLAttributes.issueKey} · ${HTMLAttributes.title} · ${HTMLAttributes.status}`] });
const TableOfContents = Node.create({ name: 'tableOfContents', group: 'block', atom: true, parseHTML: () => [{ tag: 'nav[data-toc]' }], renderHTML: () => ['nav', { 'data-toc': '', class: 'rounded-md border p-3 my-3 text-sm' }, 'Table of contents is generated from headings when rendered.'] });
const ExpandCollapse = Node.create({ name: 'expandCollapse', group: 'block', content: 'block+', defining: true, parseHTML: () => [{ tag: 'details[data-expand]' }], renderHTML: () => ['details', { 'data-expand': '', class: 'rounded-md border p-3 my-3', open: 'true' }, ['summary', 'Expandable section'], ['div', 0]] });

export function TiptapEditor({ content = '', onSave }: { pageId?: string; content?: string; onSave?: (html: string, json: unknown) => void }) {
  const [slashOpen, setSlashOpen] = useState(false);
  const [dirty, setDirty] = useState(false);

  const editor = useEditor({
    extensions: [StarterKit.configure({ codeBlock: false }), Placeholder.configure({ placeholder: 'Write docs, type / for commands…' }), CharacterCount, CodeBlockLowlight.configure({ lowlight }), Highlight, TaskList, TaskItem.configure({ nested: true }), Table.configure({ resizable: true }), TableRow, TableHeader, TableCell, Image, Link.configure({ openOnClick: false }), Mention.configure({ HTMLAttributes: { class: 'rounded bg-primary/10 px-1 text-primary' } }), HorizontalRule, InfoPanel, JiraIssueEmbed, TableOfContents, ExpandCollapse],
    content,
    editorProps: {
      attributes: { class: 'prose prose-sm max-w-none dark:prose-invert min-h-[420px] px-4 py-3' },
      handleTextInput: (_view, _from, _to, text) => { if (text === '/') setSlashOpen(true); setDirty(true); return false; }
    },
    onUpdate: () => setDirty(true)
  });

  useEffect(() => {
    if (!editor || !onSave || !dirty) return;
    const id = window.setTimeout(() => {
      onSave(editor.getHTML(), editor.getJSON());
      setDirty(false);
    }, 1500);
    return () => window.clearTimeout(id);
  }, [editor, editor?.state.doc, dirty, onSave]);

  if (!editor) return null;

  const toolbar = [
    { icon: Heading1, action: () => editor.chain().focus().toggleHeading({ level: 1 }).run() },
    { icon: Heading2, action: () => editor.chain().focus().toggleHeading({ level: 2 }).run() },
    { icon: Bold, action: () => editor.chain().focus().toggleBold().run() },
    { icon: Italic, action: () => editor.chain().focus().toggleItalic().run() },
    { icon: Code, action: () => editor.chain().focus().toggleCodeBlock().run() },
    { icon: List, action: () => editor.chain().focus().toggleBulletList().run() },
    { icon: ListOrdered, action: () => editor.chain().focus().toggleOrderedList().run() },
    { icon: Highlighter, action: () => editor.chain().focus().toggleHighlight().run() },
    { icon: TableIcon, action: () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() }
  ];

  return <div className="rounded-xl border bg-background">
    <div className="flex flex-wrap items-center gap-1 border-b p-2">
      {toolbar.map((item, i) => <Button key={i} type="button" size="icon" variant="ghost" onClick={item.action}><item.icon className="h-4 w-4" /></Button>)}
      <Button type="button" variant="ghost" onClick={() => editor.chain().focus().setHorizontalRule().run()}>HR</Button>
      <Button type="button" variant="ghost" onClick={() => editor.chain().focus().insertContent({ type: 'infoPanel', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Note panel' }] }] }).run()}>Panel</Button>
      <Button type="button" variant="ghost" onClick={() => editor.chain().focus().insertContent({ type: 'tableOfContents' }).run()}>TOC</Button>
      <Button type="button" variant="ghost" onClick={() => editor.chain().focus().insertContent({ type: 'jiraIssueEmbed', attrs: { issueKey: 'PM-1', title: 'Embedded issue', status: 'Todo' } }).run()}>Embed issue</Button>
      <Button type="button" size="icon" variant="ghost" onClick={() => { const src = prompt('Image URL'); if (src) editor.chain().focus().setImage({ src }).run(); }}><ImageIcon className="h-4 w-4" /></Button>
    </div>
    <div className="relative">
      <EditorContent editor={editor} />
      {slashOpen && <div className="absolute left-8 top-8 z-20 w-64 rounded-lg border bg-background p-2 shadow-xl">
        <Input placeholder="Slash command" autoFocus onKeyDown={(e) => e.key === 'Escape' && setSlashOpen(false)} />
        <button className="mt-2 w-full rounded-md px-2 py-1 text-left text-sm hover:bg-accent" onClick={() => { editor.chain().focus().insertContent('<h2>New section</h2>').run(); setSlashOpen(false); }}>Heading section</button>
      </div>}
    </div>
    <div className="flex justify-between border-t px-3 py-2 text-xs text-muted-foreground">
      <span>{editor.storage.characterCount.words()} words</span>
      <span>{dirty ? 'Saving…' : 'Saved'} · Autosaves after 1.5s</span>
    </div>
  </div>;
}
