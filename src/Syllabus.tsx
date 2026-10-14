import { useState } from 'react';
import {
  BookOpen,
  ListChecks,
  Clock3,
  Target,
  Plus,
  Search,
  ChevronDown,
  ChevronRight,
  Pencil,
  Trash2,
  FileUp,
  Check,
  ArrowUpRight,
  Sparkles,
  Layers3,
} from 'lucide-react';
import {
  aggregate,
  deleteSubject,
  deleteTopic,
  minutesLabel,
  type State,
  type Subject,
  type Topic,
} from './model';
import { PageTitle, Metric, Progress, Modal, Empty, Incidence } from './ui';
import { SubjectForm, TopicForm, CsvForm } from './forms';
import type { SharedProps } from './App';

type Edit =
  | { type: 'subject'; subject?: Subject }
  | { type: 'topic'; subjectId: string; topic?: Topic }
  | { type: 'csv' };
export default function Syllabus({
  state,
  mutate,
  notify,
  confirm,
  navigate,
}: SharedProps & { navigate: (page: string) => void }) {
  const [search, setSearch] = useState(''),
    [filter, setFilter] = useState('all'),
    [expanded, setExpanded] = useState(new Set([state.subjects[0]?.id])),
    [edit, setEdit] = useState<Edit | null>(null);
  const topics = state.subjects.flatMap((s) => s.topics),
    completed = topics.filter((t) => t.completed).length,
    ratio = topics.length ? (completed / topics.length) * 100 : 0;
  const total = aggregate(state.sessions);
  const match = (s: string) =>
    s.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR'));
  const topicMatch = (t: Topic) =>
    filter === 'all' || (filter === 'done' ? t.completed : !t.completed);
  const visible = state.subjects
    .map((s) => ({
      ...s,
      visibleTopics: s.topics.filter((t) => topicMatch(t) && (match(s.name) || match(t.name))),
    }))
    .filter(
      (s) =>
        (match(s.name) && (!s.topics.length || s.visibleTopics.length)) || s.visibleTopics.length,
    );
  function saveSubject(subject: Subject) {
    mutate((s) => ({
      ...s,
      subjects: s.subjects.some((x) => x.id === subject.id)
        ? s.subjects.map((x) => (x.id === subject.id ? subject : x))
        : [...s.subjects, subject],
    }));
    setEdit(null);
    notify('Disciplina salva.');
  }
  function saveTopic(subjectId: string, topic: Topic) {
    mutate((s) => ({
      ...s,
      subjects: s.subjects.map((x) =>
        x.id === subjectId
          ? {
              ...x,
              topics: x.topics.some((t) => t.id === topic.id)
                ? x.topics.map((t) => (t.id === topic.id ? topic : t))
                : [...x.topics, topic],
            }
          : x,
      ),
    }));
    setExpanded((previous) => new Set([...previous, subjectId]));
    setEdit(null);
    notify('Tópico salvo.');
  }
  function saveCsv(subjects: Subject[], replace: boolean) {
    mutate(
      (s) =>
        ({
          ...s,
          subjects,
          syllabusVerified: false,
          ...(replace
            ? {
                sessions: [],
                errors: [],
                notes: [],
                cycles: s.cycles.map((c) => ({ ...c, subjects: [] })),
              }
            : {}),
        }) as State,
    );
    setEdit(null);
    notify('Edital importado. Confira o conteúdo antes de marcar como revisado.');
  }
  return (
    <>
      <PageTitle
        eyebrow="SEU PONTO DE PARTIDA"
        title="Seu edital, organizado."
        description="Transforme o conteúdo do concurso em um caminho possível."
        actions={
          <>
            <button className="button" onClick={() => setEdit({ type: 'csv' })}>
              <FileUp size={17} />
              Importar edital
            </button>
            <button className="button primary" onClick={() => setEdit({ type: 'subject' })}>
              <Plus size={17} />
              Nova disciplina
            </button>
          </>
        }
      />
      <div className="metric-grid">
        <Metric
          icon={BookOpen}
          label="Disciplinas"
          value={state.subjects.length.toString().padStart(2, '0')}
          detail="organizadas no seu edital"
        />
        <Metric
          icon={ListChecks}
          tone="blue"
          label="Tópicos do edital"
          value={topics.length}
          detail={`${completed} concluído${completed !== 1 ? 's' : ''} até agora`}
        />
        <Metric
          icon={Target}
          tone="ochre"
          label="Edital concluído"
          value={
            <>
              {Math.round(ratio)}
              <span>%</span>
            </>
          }
          detail={<Progress value={ratio} />}
        />
        <Metric
          icon={Clock3}
          tone="purple"
          label="Horas estudadas"
          value={minutesLabel(total.minutes)}
          detail={`${total.count} sessões registradas`}
        />
      </div>
      <div className="syllabus-layout">
        <section className="panel syllabus-panel">
          <div className="panel-title">
            <div>
              <h2>Disciplinas e tópicos</h2>
              <p>Um tópico de cada vez. Cada avanço conta.</p>
            </div>
            <span className="count-pill">{state.subjects.length} disciplinas</span>
          </div>
          <div className="table-controls">
            <div className="search-input">
              <Search size={17} />
              <input
                aria-label="Buscar disciplina ou tópico"
                placeholder="Buscar disciplina ou tópico..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              aria-label="Filtrar tópicos"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="all">Todos os tópicos</option>
              <option value="pending">Pendentes</option>
              <option value="done">Concluídos</option>
            </select>
          </div>
          <div className="subject-list-head">
            <span>DISCIPLINA</span>
            <span>INCIDÊNCIA EM PROVAS</span>
            <span>PROGRESSO</span>
            <span />
          </div>
          {!visible.length && (
            <Empty
              title="Nenhum resultado por aqui"
              description="Ajuste a busca ou adicione sua primeira disciplina."
            />
          )}
          {visible.map((subject, i) => {
            const isOpen = expanded.has(subject.id) || !!search;
            const done = subject.topics.filter((t) => t.completed).length;
            const progress = subject.topics.length ? (done / subject.topics.length) * 100 : 0;
            return (
              <div className={`subject-item ${isOpen ? 'expanded' : ''}`} key={subject.id}>
                <div className="subject-summary">
                  <button
                    className="subject-toggle"
                    aria-expanded={isOpen}
                    onClick={() =>
                      setExpanded((old) => {
                        const next = new Set(old);
                        if (next.has(subject.id)) next.delete(subject.id);
                        else next.add(subject.id);
                        return next;
                      })
                    }
                  >
                    <span
                      className="subject-symbol"
                      style={{ color: subject.color, background: `${subject.color}14` }}
                    >
                      <BookOpen size={19} />
                    </span>
                    <span className="subject-name">
                      <strong>{subject.name}</strong>
                      <small>
                        {String(i + 1).padStart(2, '0')} · {subject.topics.length} tópicos
                      </small>
                    </span>
                  </button>
                  <button
                    className="incidence-button"
                    onClick={() => setEdit({ type: 'subject', subject })}
                    title="Editar incidência"
                  >
                    <Incidence value={subject.incidence} />
                  </button>
                  <div className="subject-progress">
                    <span>
                      {done}/{subject.topics.length}
                      <small>{Math.round(progress)}%</small>
                    </span>
                    <Progress value={progress} color={subject.color} />
                  </div>
                  <div className="subject-actions">
                    <button
                      className="icon-button"
                      aria-label={`Editar ${subject.name}`}
                      onClick={() => setEdit({ type: 'subject', subject })}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      className="icon-button danger"
                      aria-label={`Excluir ${subject.name}`}
                      onClick={() =>
                        confirm(
                          'Excluir disciplina?',
                          `“${subject.name}”, seus tópicos, sessões, erros e anotações serão excluídos. Esta ação não pode ser desfeita.`,
                          () => {
                            mutate((s) => deleteSubject(s, subject.id));
                            notify('Disciplina excluída.');
                          },
                        )
                      }
                    >
                      <Trash2 size={14} />
                    </button>
                    <button
                      className="icon-button"
                      aria-label={isOpen ? `Recolher ${subject.name}` : `Expandir ${subject.name}`}
                      onClick={() =>
                        setExpanded((old) => {
                          const next = new Set(old);
                          if (next.has(subject.id)) next.delete(subject.id);
                          else next.add(subject.id);
                          return next;
                        })
                      }
                    >
                      {isOpen ? <ChevronDown size={17} /> : <ChevronRight size={17} />}
                    </button>
                  </div>
                </div>
                {isOpen && (
                  <div className="topic-list">
                    <div className="topic-head">
                      <span>AULA / TÓPICO</span>
                      <span>INCIDÊNCIA</span>
                      <span>ESTUDO</span>
                      <span />
                    </div>
                    {subject.visibleTopics.map((topic) => {
                      const study = aggregate(state.sessions.filter((s) => s.topicId === topic.id));
                      return (
                        <div
                          key={topic.id}
                          className={`topic-row ${topic.completed ? 'done' : ''}`}
                        >
                          <div className="topic-name">
                            <button
                              className={`topic-check ${topic.completed ? 'checked' : ''}`}
                              aria-label={`${topic.completed ? 'Marcar como pendente' : 'Concluir tópico'}: ${topic.name}`}
                              aria-pressed={topic.completed}
                              onClick={() =>
                                mutate((s) => ({
                                  ...s,
                                  subjects: s.subjects.map((x) =>
                                    x.id === subject.id
                                      ? {
                                          ...x,
                                          topics: x.topics.map((t) =>
                                            t.id === topic.id
                                              ? { ...t, completed: !t.completed }
                                              : t,
                                          ),
                                        }
                                      : x,
                                  ),
                                }))
                              }
                            >
                              {topic.completed && <Check size={12} />}
                            </button>
                            <span>{topic.name}</span>
                          </div>
                          <Incidence value={topic.incidence} />
                          <span className="topic-hours">
                            {study.count ? minutesLabel(study.minutes) : 'Não iniciado'}
                          </span>
                          <div className="row-actions">
                            <button
                              className="icon-button"
                              aria-label={`Editar tópico ${topic.name}`}
                              onClick={() =>
                                setEdit({ type: 'topic', subjectId: subject.id, topic })
                              }
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              className="icon-button danger"
                              aria-label={`Excluir tópico ${topic.name}`}
                              onClick={() =>
                                confirm(
                                  'Excluir tópico?',
                                  'As sessões, os erros, os arquivos e as anotações desta aula também serão excluídos.',
                                  () => mutate((s) => deleteTopic(s, subject.id, topic.id)),
                                )
                              }
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    {!subject.visibleTopics.length && (
                      <p className="muted topic-empty">Adicione os tópicos desta disciplina.</p>
                    )}
                    <button
                      className="add-topic"
                      onClick={() => setEdit({ type: 'topic', subjectId: subject.id })}
                    >
                      <Plus size={15} />
                      Adicionar tópico
                    </button>
                    <div className="mobile-discipline-tools">
                      <button
                        className="button small"
                        onClick={() => setEdit({ type: 'subject', subject })}
                      >
                        <Pencil size={13} />
                        Editar disciplina
                      </button>
                      <button
                        className="button small"
                        onClick={() =>
                          confirm(
                            'Excluir disciplina?',
                            `“${subject.name}”, seus tópicos, sessões, erros e anotações serão excluídos.`,
                            () => mutate((s) => deleteSubject(s, subject.id)),
                          )
                        }
                      >
                        <Trash2 size={13} />
                        Excluir disciplina
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          <div className="panel-foot">
            <span className="small-dot" />
            Seu progresso é salvo automaticamente neste navegador.
          </div>
        </section>
        <aside className="syllabus-aside">
          <div className="journey-card">
            <span className="eyebrow">UM PASSO DE CADA VEZ</span>
            <div className="journey-illustration">
              <div className="orbit orbit-one" />
              <div className="orbit orbit-two" />
              <div className="illustration-book">
                <BookOpen size={48} strokeWidth={1.25} />
              </div>
              <span className="float-star">
                <Sparkles size={20} />
              </span>
              <span className="float-check">
                <Check size={16} />
              </span>
            </div>
            <h2>
              Consistência hoje.
              <br />
              Conquista amanhã.
            </h2>
            <p>Seu edital é o mapa. Seu ciclo de estudos é o próximo passo.</p>
            <button className="button primary" onClick={() => navigate('cycle')}>
              Planejar meu ciclo
              <ArrowUpRight size={17} />
            </button>
          </div>
          <div className="panel overview-panel">
            <div className="aside-title">
              <Layers3 size={18} />
              <h3>Visão do edital</h3>
            </div>
            <div className="overview-line">
              <span>Tópicos concluídos</span>
              <strong>{completed}</strong>
            </div>
            <div className="overview-line">
              <span>Para estudar</span>
              <strong>{topics.length - completed}</strong>
            </div>
            <div className="overview-line">
              <span>Questões respondidas</span>
              <strong>{total.questions}</strong>
            </div>
            <hr />
            <p className="form-help">
              A incidência ajuda a priorizar. Os percentuais são informados por você, a partir das
              provas anteriores.
            </p>
            <div className="incidence-legend">
              <span>
                <i className="legend-dot high" />
                Alta ≥ 60%
              </span>
              <span>
                <i className="legend-dot medium" />
                Média 30–59%
              </span>
              <span>
                <i className="legend-dot low" />
                Baixa &lt; 30%
              </span>
            </div>
          </div>
        </aside>
      </div>
      {edit && (
        <Modal
          title={
            edit.type === 'csv'
              ? 'Importar seu edital'
              : edit.type === 'subject'
                ? edit.subject
                  ? 'Editar disciplina'
                  : 'Nova disciplina'
                : edit.topic
                  ? 'Editar tópico'
                  : 'Novo tópico'
          }
          description={
            edit.type === 'csv' ? 'Traga suas disciplinas e aulas para um só lugar.' : undefined
          }
          onClose={() => setEdit(null)}
        >
          {edit.type === 'subject' ? (
            <SubjectForm
              subject={edit.subject}
              onSave={saveSubject}
              onClose={() => setEdit(null)}
            />
          ) : edit.type === 'topic' ? (
            <TopicForm
              topic={edit.topic}
              onSave={(topic) => saveTopic(edit.subjectId, topic)}
              onClose={() => setEdit(null)}
            />
          ) : (
            <CsvForm existing={state.subjects} onSave={saveCsv} onClose={() => setEdit(null)} />
          )}
        </Modal>
      )}
    </>
  );
}
