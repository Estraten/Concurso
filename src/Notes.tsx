import { useRef, useState } from 'react';
import {
  Plus,
  Search,
  FileText,
  Paperclip,
  Download,
  Trash2,
  ChevronLeft,
  Clock3,
} from 'lucide-react';
import { uid, type Note } from './model';
import { downloadAttachment } from './storage';
import { PageTitle, Modal, Empty } from './ui';
import { NoteForm, SubjectTopicFields } from './forms';
import RichEditor from './Editor';
import type { SharedProps } from './App';

const readFile = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
export default function Notes({ state, mutate, notify, confirm }: SharedProps) {
  const [search, setSearch] = useState(''),
    [subjectId, setSubject] = useState('all'),
    [noteId, setNote] = useState<string | null>(null),
    [create, setCreate] = useState(false),
    [move, setMove] = useState(false),
    [uploading, setUploading] = useState(false),
    [mobileEditor, setMobileEditor] = useState(false);
  const attachmentsInput = useRef<HTMLInputElement>(null);
  const filtered = state.notes
    .filter(
      (n) =>
        (subjectId === 'all' || n.subjectId === subjectId) &&
        (n.title + n.html.replace(/<[^>]*>/g, ' ')).toLowerCase().includes(search.toLowerCase()),
    )
    .sort((a, b) => b.updated.localeCompare(a.updated));
  const note = filtered.find((n) => n.id === noteId) ?? filtered[0],
    subject = state.subjects.find((s) => s.id === note?.subjectId),
    topic = subject?.topics.find((t) => t.id === note?.topicId);
  function update(id: string, patch: Partial<Note>) {
    mutate((s) => ({
      ...s,
      notes: s.notes.map((n) =>
        n.id === id ? { ...n, ...patch, updated: new Date().toISOString() } : n,
      ),
    }));
  }
  async function attach(files: FileList | null) {
    if (!files || !note) return;
    const selected = Array.from(files),
      id = note.id;
    if (selected.some((f) => f.size > 5 * 1024 * 1024)) {
      notify('Cada arquivo deve ter no máximo 5 MB.', 'error');
      return;
    }
    if (note.attachments.length + selected.length > 30) {
      notify('O limite é de 30 arquivos por anotação.', 'error');
      return;
    }
    const currentBytes = state.notes.reduce(
      (sum, n) => sum + n.attachments.reduce((bytes, f) => bytes + f.size, 0),
      0,
    );
    if (currentBytes + selected.reduce((sum, f) => sum + f.size, 0) > 100 * 1024 * 1024) {
      notify(
        'Os anexos atingiram o limite total de 100 MB. Remova materiais antigos antes de anexar mais.',
        'error',
      );
      return;
    }
    setUploading(true);
    try {
      const attachments = await Promise.all(
        selected.map(async (file) => ({
          id: uid(),
          name: file.name,
          size: file.size,
          type: file.type,
          data: await readFile(file),
        })),
      );
      mutate((s) => ({
        ...s,
        notes: s.notes.map((n) =>
          n.id === id
            ? {
                ...n,
                attachments: [...n.attachments, ...attachments].slice(0, 30),
                updated: new Date().toISOString(),
              }
            : n,
        ),
      }));
      notify('Arquivos anexados à aula.');
    } catch {
      notify('Não foi possível ler o arquivo. Tente novamente.', 'error');
    } finally {
      setUploading(false);
      if (attachmentsInput.current) attachmentsInput.current.value = '';
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="UM LUGAR PARA SUAS IDEIAS"
        title="Suas anotações."
        description="Resumos, ideias e materiais que fazem o conteúdo ficar."
        actions={
          <button className="button primary" onClick={() => setCreate(true)}>
            <Plus size={17} />
            Nova anotação
          </button>
        }
      />
      <div className={`notes-layout ${mobileEditor ? 'mobile-editor' : ''}`}>
        <section className="panel notes-library">
          <div className="notes-library-head">
            <div className="search-input">
              <Search size={16} />
              <input
                aria-label="Buscar anotações"
                placeholder="Buscar anotações..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              aria-label="Disciplina das anotações"
              value={subjectId}
              onChange={(e) => setSubject(e.target.value)}
            >
              <option value="all">Todas as disciplinas</option>
              {state.subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="notes-count">
            {filtered.length} {filtered.length === 1 ? 'anotação' : 'anotações'}
          </div>
          {filtered.map((item) => {
            const discipline = state.subjects.find((s) => s.id === item.subjectId);
            return (
              <button
                className={`note-preview ${note?.id === item.id ? 'selected' : ''}`}
                key={item.id}
                onClick={() => {
                  setNote(item.id);
                  setMobileEditor(true);
                }}
              >
                <span className="note-preview-subject" style={{ color: discipline?.color }}>
                  {discipline?.name}
                </span>
                <h3>{item.title}</h3>
                <p>
                  {item.html
                    .replace(/<[^>]*>/g, ' ')
                    .replace(/&nbsp;/g, ' ')
                    .slice(0, 90)
                    .trim() || 'Uma página em branco para suas ideias.'}
                </p>
                <div>
                  <span>
                    {new Date(item.updated).toLocaleDateString('pt-BR', {
                      timeZone: 'America/Rio_Branco',
                    })}
                  </span>
                  {item.attachments.length > 0 && (
                    <span>
                      <Paperclip size={12} />
                      {item.attachments.length}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
          {!filtered.length && (
            <div className="note-list-empty">
              <FileText size={24} />
              <p>
                {state.notes.length
                  ? 'Nenhuma anotação neste filtro.'
                  : 'Seus resumos vão morar aqui.'}
              </p>
            </div>
          )}
        </section>
        <section className="panel note-workspace">
          {note ? (
            <>
              <div className="note-workspace-head">
                <button
                  className="icon-button mobile-note-back"
                  aria-label="Voltar às anotações"
                  onClick={() => setMobileEditor(false)}
                >
                  <ChevronLeft size={20} />
                </button>
                <div className="note-breadcrumb">
                  <span style={{ color: subject?.color }}>{subject?.name}</span>
                  <span>/</span>
                  <span>{topic?.name}</span>
                </div>
                <button
                  className="icon-button danger"
                  aria-label="Excluir anotação"
                  onClick={() =>
                    confirm(
                      'Excluir anotação?',
                      'O texto e todos os arquivos anexados serão excluídos.',
                      () => {
                        mutate((s) => ({ ...s, notes: s.notes.filter((n) => n.id !== note.id) }));
                        setNote(null);
                        setMobileEditor(false);
                      },
                    )
                  }
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <div className="note-title-section">
                <input
                  aria-label="Título da anotação"
                  className="note-title-input"
                  value={note.title}
                  maxLength={500}
                  onChange={(e) => {
                    if (e.target.value.trim()) update(note.id, { title: e.target.value });
                  }}
                />
                <div className="note-metadata">
                  <span>
                    <Clock3 size={13} />
                    Editada em{' '}
                    {new Date(note.updated).toLocaleDateString('pt-BR', {
                      timeZone: 'America/Rio_Branco',
                    })}
                  </span>
                  <button onClick={() => setMove(true)}>Alterar disciplina / aula</button>
                </div>
              </div>
              <RichEditor
                key={note.id}
                noteId={note.id}
                html={note.html}
                onChange={(html) => {
                  if (html.length > 1000000) {
                    notify(
                      'Esta anotação atingiu o limite de texto. Crie outra para continuar.',
                      'error',
                    );
                    return;
                  }
                  update(note.id, { html });
                }}
              />
              <div className="attachments">
                <div className="attachments-heading">
                  <h3>
                    <Paperclip size={17} />
                    Materiais desta aula <span>{note.attachments.length}</span>
                  </h3>
                  <button
                    className="button small"
                    disabled={uploading}
                    onClick={() => attachmentsInput.current?.click()}
                  >
                    <Plus size={14} />
                    {uploading ? 'Anexando...' : 'Anexar arquivo'}
                  </button>
                  <input
                    ref={attachmentsInput}
                    className="visually-hidden"
                    type="file"
                    multiple
                    aria-label="Anexar materiais"
                    onChange={(e) => void attach(e.target.files)}
                  />
                </div>
                {note.attachments.length ? (
                  <div className="attachment-list">
                    {note.attachments.map((file) => (
                      <div className="attachment" key={file.id}>
                        <div className="attachment-icon">
                          <FileText size={20} />
                        </div>
                        <div>
                          <strong>{file.name}</strong>
                          <small>
                            {(file.size / 1024).toLocaleString('pt-BR', {
                              maximumFractionDigits: 1,
                            })}{' '}
                            KB
                          </small>
                        </div>
                        <button
                          className="icon-button"
                          aria-label={`Baixar ${file.name}`}
                          onClick={() => {
                            try {
                              downloadAttachment(file);
                            } catch {
                              notify(
                                'O arquivo está inválido. Restaure um backup válido.',
                                'error',
                              );
                            }
                          }}
                        >
                          <Download size={16} />
                        </button>
                        <button
                          className="icon-button danger"
                          aria-label={`Remover ${file.name}`}
                          onClick={() =>
                            confirm(
                              'Remover arquivo?',
                              `“${file.name}” será removido desta anotação.`,
                              () =>
                                update(note.id, {
                                  attachments: note.attachments.filter((f) => f.id !== file.id),
                                }),
                            )
                          }
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="form-help">
                    Anexe PDFs, documentos, imagens e outros materiais interessantes. Até 5 MB por
                    arquivo; os anexos entram no backup.
                  </p>
                )}
              </div>
            </>
          ) : (
            <Empty
              title="Seu conhecimento, com suas palavras"
              description="Crie uma anotação por aula. Use fontes, cores, grifos e listas, e guarde seus materiais junto do resumo."
              action={
                <button className="button primary small" onClick={() => setCreate(true)}>
                  <Plus size={16} />
                  Criar primeira anotação
                </button>
              }
            />
          )}
        </section>
      </div>
      {create && (
        <Modal
          title="Nova anotação"
          description="Escolha a aula e dê um título às suas ideias."
          onClose={() => setCreate(false)}
        >
          <NoteForm
            subjects={state.subjects}
            onSave={(note) => {
              mutate((s) => ({ ...s, notes: [...s.notes, note] }));
              setNote(note.id);
              setSubject('all');
              setSearch('');
              setCreate(false);
              setMobileEditor(true);
              notify('Anotação criada.');
            }}
            onClose={() => setCreate(false)}
          />
        </Modal>
      )}
      {move && note && (
        <Modal title="Organizar anotação" onClose={() => setMove(false)}>
          <MoveNote
            note={note}
            subjects={state.subjects}
            onSave={(subjectId, topicId) => {
              update(note.id, { subjectId, topicId });
              setMove(false);
              setSubject('all');
            }}
            onClose={() => setMove(false)}
          />
        </Modal>
      )}
    </>
  );
}
function MoveNote({
  note,
  subjects,
  onSave,
  onClose,
}: {
  note: Note;
  subjects: SharedProps['state']['subjects'];
  onSave: (subjectId: string, topicId: string) => void;
  onClose: () => void;
}) {
  const [subjectId, setSubject] = useState(note.subjectId),
    [topicId, setTopic] = useState(note.topicId);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(subjectId, topicId);
      }}
    >
      <SubjectTopicFields
        subjects={subjects}
        subjectId={subjectId}
        topicId={topicId}
        onSubject={setSubject}
        onTopic={setTopic}
      />
      <div className="form-actions">
        <button type="button" className="button" onClick={onClose}>
          Cancelar
        </button>
        <button className="button primary">Salvar organização</button>
      </div>
    </form>
  );
}
