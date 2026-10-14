import { useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TextStyleKit } from '@tiptap/extension-text-style';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  Highlighter,
  Link,
  Unlink,
  Undo2,
  Redo2,
  Quote,
  RemoveFormatting,
} from 'lucide-react';

export default function RichEditor({
  html,
  onChange,
  noteId,
}: {
  html: string;
  onChange: (html: string) => void;
  noteId: string;
}) {
  const callback = useRef(onChange);
  callback.current = onChange;
  const [linkOpen, setLinkOpen] = useState(false),
    [link, setLink] = useState('');
  const editor = useEditor(
    {
      shouldRerenderOnTransaction: true,
      extensions: [
        StarterKit.configure({ link: { openOnClick: false, protocols: ['http', 'https'] } }),
        TextStyleKit,
        TextAlign.configure({ types: ['heading', 'paragraph'] }),
        Highlight.configure({ multicolor: true }),
      ],
      content: html,
      editorProps: {
        attributes: {
          class: 'writing-area',
          'aria-label': 'Conteúdo da anotação',
          role: 'textbox',
          'aria-multiline': 'true',
        },
      },
      onUpdate: ({ editor }) => callback.current(editor.getHTML()),
    },
    [noteId],
  );
  if (!editor) return null;
  const tool = (
    label: string,
    icon: React.ReactNode,
    active: boolean,
    run: () => void,
    disabled = false,
  ) => (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={active ? 'tool active' : 'tool'}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={run}
    >
      {icon}
    </button>
  );
  return (
    <div className="rich-editor">
      <div className="editor-toolbar" role="toolbar" aria-label="Formatação de texto">
        <select
          aria-label="Fonte"
          value={editor.getAttributes('textStyle').fontFamily || 'Arial'}
          onChange={(e) => editor.chain().focus().setFontFamily(e.target.value).run()}
        >
          <option>Arial</option>
          <option>Georgia</option>
          <option>Verdana</option>
          <option>Times New Roman</option>
          <option>Courier New</option>
        </select>
        <select
          aria-label="Tamanho da fonte"
          value={editor.getAttributes('textStyle').fontSize || '16px'}
          onChange={(e) => editor.chain().focus().setFontSize(e.target.value).run()}
        >
          {[12, 14, 16, 18, 20, 24, 32].map((s) => (
            <option key={s} value={`${s}px`}>
              {s}
            </option>
          ))}
        </select>
        <select
          aria-label="Estilo do parágrafo"
          value={
            editor.isActive('heading', { level: 1 })
              ? '1'
              : editor.isActive('heading', { level: 2 })
                ? '2'
                : '0'
          }
          onChange={(e) =>
            e.target.value === '0'
              ? editor.chain().focus().setParagraph().run()
              : editor
                  .chain()
                  .focus()
                  .setHeading({ level: Number(e.target.value) as 1 | 2 })
                  .run()
          }
        >
          <option value="0">Texto normal</option>
          <option value="1">Título</option>
          <option value="2">Subtítulo</option>
        </select>
        <span className="tool-separator" />
        {tool('Negrito', <Bold size={17} />, editor.isActive('bold'), () =>
          editor.chain().focus().toggleBold().run(),
        )}
        {tool('Itálico', <Italic size={17} />, editor.isActive('italic'), () =>
          editor.chain().focus().toggleItalic().run(),
        )}
        {tool('Sublinhar', <Underline size={17} />, editor.isActive('underline'), () =>
          editor.chain().focus().toggleUnderline().run(),
        )}
        {tool('Tachado', <Strikethrough size={17} />, editor.isActive('strike'), () =>
          editor.chain().focus().toggleStrike().run(),
        )}
        {tool('Grifar texto', <Highlighter size={17} />, editor.isActive('highlight'), () =>
          editor.chain().focus().toggleHighlight({ color: '#fff0a3' }).run(),
        )}
        <label className="color-tool" title="Cor do texto">
          <span>A</span>
          <input
            type="color"
            aria-label="Cor do texto"
            value={editor.getAttributes('textStyle').color || '#253c35'}
            onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
          />
        </label>
        <span className="tool-separator" />
        {tool(
          'Alinhar à esquerda',
          <AlignLeft size={17} />,
          editor.isActive({ textAlign: 'left' }),
          () => editor.chain().focus().setTextAlign('left').run(),
        )}
        {tool(
          'Centralizar',
          <AlignCenter size={17} />,
          editor.isActive({ textAlign: 'center' }),
          () => editor.chain().focus().setTextAlign('center').run(),
        )}
        {tool(
          'Alinhar à direita',
          <AlignRight size={17} />,
          editor.isActive({ textAlign: 'right' }),
          () => editor.chain().focus().setTextAlign('right').run(),
        )}
        {tool(
          'Justificar',
          <AlignJustify size={17} />,
          editor.isActive({ textAlign: 'justify' }),
          () => editor.chain().focus().setTextAlign('justify').run(),
        )}
        {tool('Lista com marcadores', <List size={17} />, editor.isActive('bulletList'), () =>
          editor.chain().focus().toggleBulletList().run(),
        )}
        {tool('Lista numerada', <ListOrdered size={17} />, editor.isActive('orderedList'), () =>
          editor.chain().focus().toggleOrderedList().run(),
        )}
        {tool('Citação', <Quote size={17} />, editor.isActive('blockquote'), () =>
          editor.chain().focus().toggleBlockquote().run(),
        )}
        {tool('Inserir link', <Link size={17} />, editor.isActive('link'), () => {
          setLink(editor.getAttributes('link').href || '');
          setLinkOpen(!linkOpen);
        })}
        {tool(
          'Remover link',
          <Unlink size={17} />,
          false,
          () => editor.chain().focus().unsetLink().run(),
          !editor.isActive('link'),
        )}
        {tool('Limpar formatação', <RemoveFormatting size={17} />, false, () =>
          editor.chain().focus().unsetAllMarks().clearNodes().run(),
        )}
        {tool(
          'Desfazer',
          <Undo2 size={17} />,
          false,
          () => editor.chain().focus().undo().run(),
          !editor.can().undo(),
        )}
        {tool(
          'Refazer',
          <Redo2 size={17} />,
          false,
          () => editor.chain().focus().redo().run(),
          !editor.can().redo(),
        )}
      </div>
      {linkOpen && (
        <form
          className="link-entry"
          onSubmit={(e) => {
            e.preventDefault();
            if (/^https?:\/\//i.test(link)) {
              editor.chain().focus().extendMarkRange('link').setLink({ href: link }).run();
              setLinkOpen(false);
            }
          }}
        >
          <input
            type="url"
            aria-label="Endereço do link"
            placeholder="https://..."
            value={link}
            onChange={(e) => setLink(e.target.value)}
            required
            pattern="https?://.*"
          />
          <button className="button primary small">Aplicar link</button>
          <button type="button" className="button small" onClick={() => setLinkOpen(false)}>
            Cancelar
          </button>
        </form>
      )}
      <EditorContent editor={editor} />
      <div className="editor-footer">
        <span>Seu espaço para conectar ideias.</span>
        <span>{editor.getText().length.toLocaleString('pt-BR')} caracteres</span>
      </div>
    </div>
  );
}
