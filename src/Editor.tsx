import { useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TextStyleKit } from '@tiptap/extension-text-style';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import Image from '@tiptap/extension-image';
import { IMAGE_SIZE_LIMIT, RICH_TEXT_LIMIT } from './model';
import { sanitizeRichHtml } from './storage';
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
  ImagePlus,
} from 'lucide-react';

export default function RichEditor({
  html,
  onChange,
  noteId,
  ariaLabel = 'Conteúdo da anotação',
  onError,
}: {
  html: string;
  onChange: (html: string) => void;
  noteId: string;
  ariaLabel?: string;
  onError?: (message: string) => void;
}) {
  const callback = useRef(onChange);
  callback.current = onChange;
  const errorCallback = useRef(onError);
  errorCallback.current = onError;
  const lastHtml = useRef(html);
  const imageInput = useRef<HTMLInputElement>(null);
  const pasteHandler = useRef<(files: File[], html?: string) => void>(() => {});
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
        Image.configure({ allowBase64: true }),
      ],
      content: html,
      editorProps: {
        attributes: {
          class: 'writing-area',
          'aria-label': ariaLabel,
          role: 'textbox',
          'aria-multiline': 'true',
        },
        handlePaste: (_view, event) => {
          const files = Array.from(event.clipboardData?.items ?? [])
            .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
            .map((item) => item.getAsFile())
            .filter((file): file is File => !!file);
          const pastedHtml = event.clipboardData?.getData('text/html');
          if (files.length) {
            event.preventDefault();
            pasteHandler.current(files, pastedHtml);
            return true;
          }
          return false;
        },
      },
      onUpdate: ({ editor }) => {
        const content = editor.getHTML();
        if (content.length > RICH_TEXT_LIMIT) {
          editor.commands.setContent(lastHtml.current, { emitUpdate: false });
          errorCallback.current?.(
            'Este texto atingiu o limite de 12 MB. Use outra anotação ou erro para continuar.',
          );
          return;
        }
        lastHtml.current = content;
        callback.current(content);
      },
    },
    [noteId],
  );
  if (!editor) return null;
  pasteHandler.current = (files, pastedHtml) => {
    if (files.some((file) => !/^image\/(png|jpeg|gif|webp)$/i.test(file.type))) {
      errorCallback.current?.('Use uma imagem PNG, JPEG, GIF ou WebP.');
      return;
    }
    if (files.some((file) => file.size > IMAGE_SIZE_LIMIT)) {
      errorCallback.current?.('Cada imagem deve ter no máximo 3 MB.');
      return;
    }
    if (
      editor.getHTML().length + files.reduce((sum, f) => sum + Math.ceil((f.size * 4) / 3), 0) >
      RICH_TEXT_LIMIT
    ) {
      errorCallback.current?.('As imagens ultrapassam o limite de 12 MB deste texto.');
      return;
    }
    let insertion = { from: editor.state.selection.from, to: editor.state.selection.to };
    const selection = window.getSelection();
    if (
      selection?.anchorNode &&
      selection.focusNode &&
      editor.view.dom.contains(selection.anchorNode) &&
      editor.view.dom.contains(selection.focusNode)
    ) {
      const anchor = editor.view.posAtDOM(selection.anchorNode, selection.anchorOffset);
      const focus = editor.view.posAtDOM(selection.focusNode, selection.focusOffset);
      insertion = { from: Math.min(anchor, focus), to: Math.max(anchor, focus) };
    }
    if (pastedHtml) {
      const template = document.createElement('template');
      template.innerHTML = sanitizeRichHtml(pastedHtml);
      template.content.querySelectorAll('img').forEach((img) => img.remove());
      if (template.content.textContent?.trim()) {
        editor.chain().focus().insertContentAt(insertion, template.innerHTML).run();
        insertion = { from: editor.state.selection.from, to: editor.state.selection.to };
      }
    }
    Promise.all(
      files.map(
        (file) =>
          new Promise<{ src: string; alt: string }>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () =>
              resolve({ src: String(reader.result), alt: file.name || 'Imagem colada' });
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
          }),
      ),
    )
      .then((images) => {
        if (!editor.isDestroyed)
          editor
            .chain()
            .focus()
            .insertContentAt(
              {
                from: Math.min(insertion.from, editor.state.doc.content.size),
                to: Math.min(insertion.to, editor.state.doc.content.size),
              },
              images.map((attrs) => ({ type: 'image', attrs })),
            )
            .run();
      })
      .catch(() => errorCallback.current?.('Não foi possível inserir a imagem. Tente novamente.'));
  };
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
        {tool('Inserir imagem', <ImagePlus size={17} />, editor.isActive('image'), () =>
          imageInput.current?.click(),
        )}
        <input
          ref={imageInput}
          className="visually-hidden"
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          aria-label={`Inserir imagem em ${ariaLabel}`}
          multiple
          onChange={(e) => {
            if (e.target.files) pasteHandler.current(Array.from(e.target.files));
            e.target.value = '';
          }}
        />
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
        <div className="link-entry">
          <input
            type="url"
            aria-label="Endereço do link"
            placeholder="https://..."
            value={link}
            onChange={(e) => setLink(e.target.value)}
            required
            pattern="https?://.*"
          />
          <button
            type="button"
            className="button primary small"
            onClick={() => {
              if (/^https?:\/\//i.test(link)) {
                editor.chain().focus().extendMarkRange('link').setLink({ href: link }).run();
                setLinkOpen(false);
              } else errorCallback.current?.('Informe um link começando com https:// ou http://.');
            }}
          >
            Aplicar link
          </button>
          <button type="button" className="button small" onClick={() => setLinkOpen(false)}>
            Cancelar
          </button>
        </div>
      )}
      <EditorContent editor={editor} />
      <div className="editor-footer">
        <span>Cole imagens com Ctrl+V · até 3 MB por imagem.</span>
        <span>{editor.getText().length.toLocaleString('pt-BR')} caracteres</span>
      </div>
    </div>
  );
}
