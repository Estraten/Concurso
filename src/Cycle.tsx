import { useState } from 'react';
import {
  Plus,
  Clock3,
  CalendarDays,
  CalendarRange,
  Layers3,
  Pencil,
  Trash2,
  Check,
  SlidersHorizontal,
  Timer,
  ArrowRight,
} from 'lucide-react';
import {
  aggregate,
  cycleTargets,
  minutesLabel,
  percent,
  today,
  uid,
  type Cycle,
  type Session,
  type State,
} from './model';
import { PageTitle, Metric, Modal, Empty, Progress, Hint } from './ui';
import { CycleForm, SessionForm } from './forms';
import type { SharedProps } from './App';

const days = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
export function weekStart() {
  const now = new Date(`${today()}T12:00:00`);
  now.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
function Planner({
  cycle,
  state,
  onSave,
}: {
  cycle: Cycle;
  state: State;
  onSave: (cycle: Cycle) => void;
}) {
  const [hours, setHours] = useState(String(cycle.hoursPerDay)),
    [weekdays, setWeekdays] = useState(cycle.days),
    [subjects, setSubjects] = useState(cycle.subjects),
    [error, setError] = useState('');
  const draft = { ...cycle, hoursPerDay: Number(hours) || 0, days: weekdays, subjects };
  const targets = cycleTargets(draft);
  return (
    <form
      className="panel planner-panel"
      onSubmit={(e) => {
        e.preventDefault();
        if (!weekdays.length || !subjects.length)
          return setError('Selecione pelo menos um dia e uma disciplina.');
        onSave(draft);
        setError('');
      }}
    >
      <div className="panel-title">
        <div>
          <h2>Encontre seu ritmo</h2>
          <p>Um planejamento que cabe na sua rotina.</p>
        </div>
        <SlidersHorizontal size={20} className="muted" />
      </div>
      <div className="planner-body">
        <div className="planner-top">
          <label>
            Quantas horas por dia?
            <div className="input-with-unit">
              <input
                aria-label="Horas de estudo por dia"
                type="number"
                min="0.25"
                max="24"
                step="0.25"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                required
              />
              <span>horas / dia</span>
            </div>
          </label>
          <div>
            <span className="field-label">Em quais dias?</span>
            <div className="weekday-picker">
              {days.map((day, i) => (
                <button
                  className={weekdays.includes(i) ? 'selected' : ''}
                  type="button"
                  key={day}
                  aria-label={`Estudar ${day}`}
                  aria-pressed={weekdays.includes(i)}
                  onClick={() =>
                    setWeekdays(
                      weekdays.includes(i)
                        ? weekdays.filter((d) => d !== i)
                        : [...weekdays, i].sort(),
                    )
                  }
                >
                  {day}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="planning-preview">
          <div>
            <small>POR DIA</small>
            <strong>{minutesLabel(targets.dailyMinutes)}</strong>
          </div>
          <ArrowRight size={18} />
          <div>
            <small>POR SEMANA</small>
            <strong>{minutesLabel(targets.weeklyMinutes)}</strong>
          </div>
          <ArrowRight size={18} />
          <div>
            <small>POR MÊS*</small>
            <strong>{minutesLabel(targets.monthlyMinutes)}</strong>
          </div>
        </div>
        <div className="selection-heading">
          <h3>Disciplinas do ciclo</h3>
          <span className="count-pill">{subjects.length} selecionadas</span>
        </div>
        <p className="form-help">
          Selecione as disciplinas. O peso divide o tempo semanal: uma disciplina de peso 2 recebe o
          dobro de horas de uma de peso 1.
        </p>
        <div className="cycle-subjects">
          {state.subjects.map((subject) => {
            const selected = subjects.find((s) => s.subjectId === subject.id),
              allocated = targets.allocations.find((s) => s.subjectId === subject.id);
            return (
              <div key={subject.id} className={`cycle-subject ${selected ? 'selected' : ''}`}>
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={!!selected}
                    onChange={(e) =>
                      setSubjects(
                        e.target.checked
                          ? [...subjects, { subjectId: subject.id, weight: 1 }]
                          : subjects.filter((s) => s.subjectId !== subject.id),
                      )
                    }
                  />
                  <span className="subject-color" style={{ background: subject.color }} />
                  <span>{subject.name}</span>
                </label>
                {selected && (
                  <div className="weight-control">
                    <label>
                      Peso
                      <select
                        aria-label={`Peso de ${subject.name}`}
                        value={selected.weight}
                        onChange={(e) =>
                          setSubjects(
                            subjects.map((s) =>
                              s.subjectId === subject.id
                                ? { ...s, weight: Number(e.target.value) }
                                : s,
                            ),
                          )
                        }
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                          <option key={n}>{n}</option>
                        ))}
                      </select>
                    </label>
                    <span>
                      {minutesLabel(allocated?.weeklyMinutes ?? 0)}
                      <small>/ semana</small>
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {!state.subjects.length && (
          <p className="form-help">
            Adicione disciplinas na página Edital antes de planejar seu ciclo.
          </p>
        )}
        <p className="form-help">
          *Estimativa mensal = horas semanais × 52 ÷ 12 (4,33 semanas). A distribuição é
          proporcional aos pesos, sem arredondar os cálculos.
        </p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="button primary" type="submit">
          <Check size={17} />
          Salvar planejamento
        </button>
      </div>
    </form>
  );
}
export default function CyclePage({ state, mutate, notify, confirm }: SharedProps) {
  const [cycleId, setCycleId] = useState(state.cycles[0].id),
    [edit, setEdit] = useState<
      { type: 'session'; session?: Session } | { type: 'cycle'; cycle?: Cycle } | null
    >(null);
  const cycle = state.cycles.find((c) => c.id === cycleId) ?? state.cycles[0],
    targets = cycleTargets(cycle),
    sessions = state.sessions
      .filter((s) => s.cycleId === cycle.id)
      .sort((a, b) => b.date.localeCompare(a.date)),
    stats = aggregate(sessions),
    weeklySessions = sessions.filter((s) => s.date >= weekStart() && s.date <= today()),
    weekly = aggregate(weeklySessions);
  function saveSession(session: Session) {
    mutate((s) => ({
      ...s,
      sessions: s.sessions.some((x) => x.id === session.id)
        ? s.sessions.map((x) => (x.id === session.id ? session : x))
        : [...s.sessions, session],
    }));
    setEdit(null);
    notify('Sessão registrada. Suas estatísticas foram atualizadas.');
  }
  function saveCycle(name: string) {
    if (edit?.type === 'cycle' && edit.cycle) {
      const id = edit.cycle.id;
      mutate((s) => ({ ...s, cycles: s.cycles.map((c) => (c.id === id ? { ...c, name } : c)) }));
    } else {
      const newCycle = { ...cycle, id: uid(), name };
      mutate((s) => ({ ...s, cycles: [...s.cycles, newCycle] }));
      setCycleId(newCycle.id);
    }
    setEdit(null);
    notify('Ciclo salvo.');
  }
  return (
    <>
      <PageTitle
        eyebrow="PLANEJE. ESTUDE. REPITA."
        title="Seu ciclo de estudos."
        description="Dê espaço a cada disciplina e transforme tempo em evolução."
        actions={
          <>
            <button className="button" onClick={() => setEdit({ type: 'cycle' })}>
              <Plus size={17} />
              Novo ciclo
            </button>
            <button className="button primary" onClick={() => setEdit({ type: 'session' })}>
              <Plus size={17} />
              Registrar estudo
            </button>
          </>
        }
      />
      <div className="cycle-selector">
        <span className="field-label">Ciclo atual</span>
        <select
          aria-label="Selecionar ciclo"
          value={cycle.id}
          onChange={(e) => setCycleId(e.target.value)}
        >
          {state.cycles.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button
          className="icon-button"
          aria-label="Renomear ciclo"
          onClick={() => setEdit({ type: 'cycle', cycle })}
        >
          <Pencil size={15} />
        </button>
        <span className="muted">
          {stats.count} sessões · {minutesLabel(stats.minutes)} acumuladas neste ciclo
        </span>
      </div>
      <div className="metric-grid">
        <Metric
          icon={Clock3}
          label="Meta diária"
          value={minutesLabel(targets.dailyMinutes)}
          detail="conforme seu planejamento"
        />
        <Metric
          icon={CalendarDays}
          tone="blue"
          label="Meta semanal"
          value={minutesLabel(targets.weeklyMinutes)}
          detail={`${cycle.days.length} dias de estudo por semana`}
        />
        <Metric
          icon={CalendarRange}
          tone="ochre"
          label="Estimativa mensal"
          value={minutesLabel(targets.monthlyMinutes)}
          detail="média de 4,33 semanas por mês"
        />
        <Metric
          icon={Layers3}
          tone="purple"
          label="Disciplinas no ciclo"
          value={cycle.subjects.length.toString().padStart(2, '0')}
          detail="distribuição por peso"
        />
      </div>
      <div className="cycle-layout">
        <Planner
          key={cycle.id}
          cycle={cycle}
          state={state}
          onSave={(updated) => {
            mutate((s) => ({
              ...s,
              cycles: s.cycles.map((c) => (c.id === updated.id ? updated : c)),
            }));
            notify('Planejamento salvo.');
          }}
        />
        <div className="cycle-right">
          <section className="panel">
            <div className="panel-title">
              <div>
                <h2>Sua semana, em movimento</h2>
                <p>Horas realizadas × planejamento semanal</p>
              </div>
              <Timer size={21} className="muted" />
            </div>
            <div className="weekly-body">
              <div className="weekly-total">
                <strong>{minutesLabel(weekly.minutes)}</strong>
                <span>de {minutesLabel(targets.weeklyMinutes)} planejadas</span>
              </div>
              <Progress
                value={targets.weeklyMinutes ? (weekly.minutes / targets.weeklyMinutes) * 100 : 0}
              />
              <div className="weekly-meta">
                <span>
                  {Math.round(
                    targets.weeklyMinutes ? (weekly.minutes / targets.weeklyMinutes) * 100 : 0,
                  )}
                  % da meta semanal
                </span>
                <span>{weekly.count} sessões</span>
              </div>
              <div className="allocation-list">
                {targets.allocations.map((item) => {
                  const subject = state.subjects.find((s) => s.id === item.subjectId);
                  if (!subject) return null;
                  const done = aggregate(
                    weeklySessions.filter((s) => s.subjectId === item.subjectId),
                  ).minutes;
                  return (
                    <div key={subject.id}>
                      <div className="allocation-label">
                        <span>
                          <i className="subject-color" style={{ background: subject.color }} />
                          {subject.name}
                        </span>
                        <small>
                          {minutesLabel(done)} / {minutesLabel(item.weeklyMinutes)}
                        </small>
                      </div>
                      <Progress
                        color={subject.color}
                        value={item.weeklyMinutes ? (done / item.weeklyMinutes) * 100 : 0}
                      />
                    </div>
                  );
                })}
              </div>
              {!targets.allocations.length && (
                <p className="form-help">
                  Salve as disciplinas do ciclo para acompanhar suas metas.
                </p>
              )}
            </div>
          </section>
          <Hint>
            Revisar também é estudar. Registre suas revisões para acompanhar o tempo real de
            preparação.
          </Hint>
        </div>
      </div>
      <section className="panel sessions-panel">
        <div className="panel-title">
          <div>
            <h2>Diário de estudos</h2>
            <p>Todas as sessões de {cycle.name.toLowerCase()}, em um só lugar.</p>
          </div>
          <span className="count-pill">{sessions.length} registros</span>
        </div>
        {sessions.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>DATA</th>
                  <th>DISCIPLINA / AULA</th>
                  <th>TIPO</th>
                  <th>DURAÇÃO</th>
                  <th>QUESTÕES</th>
                  <th>ACERTOS</th>
                  <th aria-label="Ações" />
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => {
                  const subject = state.subjects.find((s) => s.id === session.subjectId),
                    accuracy = percent(session.correct, session.questions);
                  return (
                    <tr key={session.id}>
                      <td>{session.date.split('-').reverse().join('/')}</td>
                      <td>
                        <span className="table-primary">{subject?.name}</span>
                        <small>{subject?.topics.find((t) => t.id === session.topicId)?.name}</small>
                      </td>
                      <td>
                        <span className="badge neutral">{session.kind}</span>
                      </td>
                      <td className="nowrap">{minutesLabel(session.minutes)}</td>
                      <td>{session.questions}</td>
                      <td>
                        {accuracy === null ? '—' : `${accuracy.toLocaleString('pt-BR')}%`}
                        <small>{session.correct} corretas</small>
                      </td>
                      <td>
                        <div className="row-actions">
                          <button
                            className="icon-button"
                            aria-label="Editar sessão"
                            onClick={() => setEdit({ type: 'session', session })}
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            className="icon-button danger"
                            aria-label="Excluir sessão"
                            onClick={() =>
                              confirm(
                                'Excluir sessão?',
                                'As horas e as questões desta sessão serão removidas das estatísticas.',
                                () =>
                                  mutate((s) => ({
                                    ...s,
                                    sessions: s.sessions.filter((x) => x.id !== session.id),
                                  })),
                              )
                            }
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="O primeiro passo começa aqui"
            description="Registre a disciplina, a aula e o tempo que você estudou. A evolução aparece nas estatísticas."
            action={
              <button className="button primary small" onClick={() => setEdit({ type: 'session' })}>
                <Plus size={16} />
                Registrar primeira sessão
              </button>
            }
          />
        )}
      </section>
      {edit && (
        <Modal
          title={
            edit.type === 'session'
              ? edit.session
                ? 'Editar sessão de estudo'
                : 'Registrar estudo'
              : edit.cycle
                ? 'Renomear ciclo'
                : 'Novo ciclo'
          }
          description={
            edit.type === 'session' ? 'Cada minuto conta. Registre o que você fez.' : undefined
          }
          onClose={() => setEdit(null)}
        >
          {edit.type === 'session' ? (
            <SessionForm
              state={state}
              cycle={cycle}
              session={edit.session}
              onSave={saveSession}
              onClose={() => setEdit(null)}
            />
          ) : (
            <CycleForm cycle={edit.cycle} onSave={saveCycle} onClose={() => setEdit(null)} />
          )}
        </Modal>
      )}
    </>
  );
}
