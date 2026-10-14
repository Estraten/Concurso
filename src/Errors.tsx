import { useState } from 'react';
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Check,
  RotateCcw,
  BookOpen,
  CircleAlert,
  CheckCheck,
} from 'lucide-react';
import { type StudyError } from './model';
import { PageTitle, Modal, Empty } from './ui';
import { ErrorForm } from './forms';
import { sanitizeRichHtml } from './storage';
import type { SharedProps } from './App';

export default function Errors({ state, mutate, notify, confirm }: SharedProps) {
  const [search, setSearch] = useState(''),
    [subjectId, setSubject] = useState('all'),
    [status, setStatus] = useState('pending'),
    [edit, setEdit] = useState<{ item?: StudyError } | null>(null);
  const filtered = state.errors.filter(
    (e) =>
      (subjectId === 'all' || e.subjectId === subjectId) &&
      (status === 'all' || (status === 'reviewed' ? e.reviewed : !e.reviewed)) &&
      [
        e.title,
        e.description.replace(/<[^>]*>/g, ' '),
        e.answer.replace(/<[^>]*>/g, ' '),
        state.subjects.find((s) => s.id === e.subjectId)?.topics.find((t) => t.id === e.topicId)
          ?.name ?? '',
      ]
        .join(' ')
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const groups = state.subjects
    .flatMap((s) =>
      s.topics.map((t) => ({
        subject: s,
        topic: t,
        errors: filtered.filter((e) => e.topicId === t.id),
      })),
    )
    .filter((g) => g.errors.length);
  function save(item: StudyError) {
    mutate((s) => ({
      ...s,
      errors: s.errors.some((e) => e.id === item.id)
        ? s.errors.map((e) => (e.id === item.id ? item : e))
        : [...s.errors, item],
    }));
    setEdit(null);
    notify('Erro salvo no seu caderno.');
  }
  return (
    <>
      <PageTitle
        eyebrow="ERRE. ENTENDA. EVOLUA."
        title="Seu caderno de erros."
        description="Transforme os pontos de dificuldade em oportunidades de aprender."
        actions={
          <button className="button primary" onClick={() => setEdit({})}>
            <Plus size={17} />
            Registrar erro
          </button>
        }
      />
      <div className="error-summary">
        <div>
          <span className="error-summary-icon">
            <CircleAlert size={20} />
          </span>
          <strong>{state.errors.filter((e) => !e.reviewed).length}</strong>
          <span>para revisar</span>
        </div>
        <div>
          <span className="review-summary-icon">
            <CheckCheck size={20} />
          </span>
          <strong>{state.errors.filter((e) => e.reviewed).length}</strong>
          <span>revisados</span>
        </div>
        <p>Uma boa revisão começa entendendo o porquê do erro.</p>
      </div>
      <div className="panel library-controls">
        <div className="search-input">
          <Search size={17} />
          <input
            aria-label="Buscar erros"
            placeholder="Buscar no caderno de erros..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          aria-label="Disciplina dos erros"
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
        <select
          aria-label="Situação dos erros"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="pending">Para revisar</option>
          <option value="reviewed">Revisados</option>
          <option value="all">Todos os erros</option>
        </select>
      </div>
      {groups.length ? (
        groups.map((group) => (
          <section key={group.topic.id} className="error-group">
            <div className="error-group-heading">
              <span
                className="subject-symbol"
                style={{ background: `${group.subject.color}16`, color: group.subject.color }}
              >
                <BookOpen size={18} />
              </span>
              <div>
                <small>{group.subject.name}</small>
                <h2>{group.topic.name}</h2>
              </div>
              <span className="count-pill">
                {group.errors.length} {group.errors.length === 1 ? 'erro' : 'erros'}
              </span>
            </div>
            <div className="error-cards">
              {group.errors.map((item) => (
                <article className={`error-card ${item.reviewed ? 'reviewed' : ''}`} key={item.id}>
                  <div className="error-card-top">
                    <span className={`badge ${item.reviewed ? 'low' : 'medium'}`}>
                      {item.reviewed ? 'Revisado' : 'Para revisar'}
                    </span>
                    <div className="row-actions">
                      <button
                        className="icon-button"
                        aria-label="Editar erro"
                        onClick={() => setEdit({ item })}
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        className="icon-button danger"
                        aria-label="Excluir erro"
                        onClick={() =>
                          confirm(
                            'Excluir este erro?',
                            'O registro será removido do seu caderno de erros.',
                            () =>
                              mutate((s) => ({
                                ...s,
                                errors: s.errors.filter((e) => e.id !== item.id),
                              })),
                          )
                        }
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                  <h3>{item.title}</h3>
                  {(item.description.replace(/<[^>]*>/g, '').trim() ||
                    /<img\b/.test(item.description)) && (
                    <div className="error-section">
                      <small>O QUE ACONTECEU</small>
                      <div
                        className="rich-display"
                        dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(item.description) }}
                      />
                    </div>
                  )}
                  {(item.answer.replace(/<[^>]*>/g, '').trim() || /<img\b/.test(item.answer)) && (
                    <div className="correct-answer">
                      <small>O QUE PRECISO LEMBRAR</small>
                      <div
                        className="rich-display"
                        dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(item.answer) }}
                      />
                    </div>
                  )}
                  <div className="error-card-foot">
                    <span>{item.date.split('-').reverse().join('/')}</span>
                    <button
                      className="button small"
                      onClick={() => {
                        mutate((s) => ({
                          ...s,
                          errors: s.errors.map((e) =>
                            e.id === item.id ? { ...e, reviewed: !e.reviewed } : e,
                          ),
                        }));
                        notify(
                          item.reviewed ? 'Erro marcado para revisar.' : 'Revisão registrada.',
                        );
                      }}
                    >
                      {item.reviewed ? <RotateCcw size={14} /> : <Check size={14} />}
                      {item.reviewed ? 'Revisar novamente' : 'Marcar como revisado'}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))
      ) : (
        <div className="panel">
          <Empty
            title={
              state.errors.length ? 'Nenhum erro neste filtro' : 'Aprender também passa pelos erros'
            }
            description={
              state.errors.length
                ? 'Altere os filtros para encontrar seus registros.'
                : 'Guarde a questão, explique o que confundiu você e registre o que precisa lembrar. Tudo fica separado por aula.'
            }
            action={
              <button className="button primary small" onClick={() => setEdit({})}>
                <Plus size={16} />
                Registrar um erro
              </button>
            }
          />
        </div>
      )}
      {edit && (
        <Modal
          wide
          title={edit.item ? 'Editar erro' : 'Registrar um erro'}
          description="Não é sobre acertar sempre. É sobre aprender a cada vez."
          onClose={() => setEdit(null)}
        >
          <ErrorForm
            subjects={state.subjects}
            item={edit.item}
            onSave={save}
            onClose={() => setEdit(null)}
          />
        </Modal>
      )}
    </>
  );
}
