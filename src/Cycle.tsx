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
} from 'lucide-react';
import {
  addDays,
  aggregate,
  cycleSchema,
  cycleTargets,
  minutesLabel,
  percent,
  shortDate,
  uid,
  weekStart,
  WEEKDAYS,
  type Cycle,
  type Session,
  type State,
} from './model';
import { PageTitle, Metric, Modal, Empty, Progress, Hint } from './ui';
import { CycleForm, SessionForm } from './forms';
import type { SharedProps } from './App';

const fullDays = [
  'segunda-feira',
  'terça-feira',
  'quarta-feira',
  'quinta-feira',
  'sexta-feira',
  'sábado',
  'domingo',
];
function Planner({
  cycle,
  state,
  onSave,
}: {
  cycle: Cycle;
  state: State;
  onSave: (cycle: Cycle) => void;
}) {
  const [subjects, setSubjects] = useState(cycle.subjects),
    [hourInputs, setHourInputs] = useState<Record<string, string>>({}),
    [error, setError] = useState('');
  const draft = { ...cycle, subjects },
    targets = cycleTargets(draft);
  function toggleDay(subjectId: string, day: number, checked: boolean) {
    setHourInputs((previous) => {
      const next = { ...previous };
      delete next[`${subjectId}:${day}`];
      return next;
    });
    setSubjects((previous) =>
      previous.map((subject) =>
        subject.subjectId === subjectId
          ? {
              ...subject,
              schedule: checked
                ? [...subject.schedule, { day, minutes: 60 }].sort((a, b) => a.day - b.day)
                : subject.schedule.filter((slot) => slot.day !== day),
            }
          : subject,
      ),
    );
  }
  return (
    <form
      className="panel planner-panel weekly-planner"
      onSubmit={(e) => {
        e.preventDefault();
        if (!subjects.length || subjects.some((s) => !s.schedule.length))
          return setError('Escolha pelo menos um dia para cada disciplina selecionada.');
        const result = cycleSchema.safeParse(draft);
        if (!result.success) return setError(result.error.issues[0].message);
        onSave(result.data);
        setError('');
      }}
    >
      <div className="panel-title">
        <div>
          <h2>Planeje cada disciplina</h2>
          <p>Escolha os dias da semana e quanto tempo dedicar em cada dia.</p>
        </div>
        <SlidersHorizontal size={20} className="muted" />
      </div>
      <div className="planner-body">
        <div className="schedule-instructions">
          <span className="count-pill">{subjects.length} disciplinas selecionadas</span>
          <span>Use 1,5 hora para 1h30min. As metas são a soma dos horários definidos.</span>
        </div>
        <div className="discipline-schedule-list">
          {state.subjects.map((subject) => {
            const selected = subjects.find((s) => s.subjectId === subject.id),
              allocated = targets.allocations.find((s) => s.subjectId === subject.id);
            return (
              <section
                key={subject.id}
                className={`discipline-schedule ${selected ? 'selected' : ''}`}
              >
                <div className="schedule-heading">
                  <label className="check-label">
                    <input
                      aria-label={`Incluir ${subject.name} no ciclo`}
                      type="checkbox"
                      checked={!!selected}
                      onChange={(e) =>
                        setSubjects(
                          e.target.checked
                            ? [...subjects, { subjectId: subject.id, schedule: [] }]
                            : subjects.filter((s) => s.subjectId !== subject.id),
                        )
                      }
                    />
                    <span className="subject-color" style={{ background: subject.color }} />
                    <span>{subject.name}</span>
                  </label>
                  <span>
                    {selected
                      ? `${minutesLabel(allocated?.weeklyMinutes ?? 0)} / semana`
                      : 'Fora deste ciclo'}
                  </span>
                </div>
                {selected && (
                  <div className="schedule-days">
                    {WEEKDAYS.map((name, day) => {
                      const slot = selected.schedule.find((s) => s.day === day);
                      return (
                        <div className={`schedule-day ${slot ? 'active' : ''}`} key={day}>
                          <label className="schedule-day-toggle">
                            <input
                              type="checkbox"
                              aria-label={`Estudar ${subject.name} na ${fullDays[day]}`}
                              checked={!!slot}
                              onChange={(e) => toggleDay(subject.id, day, e.target.checked)}
                            />
                            <span>
                              {name}
                              <small>{shortDate(addDays(cycle.weekStart, day))}</small>
                            </span>
                          </label>
                          <div className="schedule-hours">
                            <input
                              aria-label={`Horas de ${subject.name} na ${fullDays[day]}`}
                              type="text"
                              inputMode="decimal"
                              pattern="[0-9]+([.,][0-9]+)?"
                              maxLength={6}
                              disabled={!slot}
                              required={!!slot}
                              placeholder="—"
                              value={
                                slot
                                  ? (hourInputs[`${subject.id}:${day}`] ??
                                    (slot.minutes
                                      ? String(Number((slot.minutes / 60).toFixed(2))).replace(
                                          '.',
                                          ',',
                                        )
                                      : ''))
                                  : ''
                              }
                              onChange={(e) => {
                                setHourInputs((previous) => ({
                                  ...previous,
                                  [`${subject.id}:${day}`]: e.target.value,
                                }));
                                setSubjects(
                                  subjects.map((s) =>
                                    s.subjectId === subject.id
                                      ? {
                                          ...s,
                                          schedule: s.schedule.map((d) =>
                                            d.day === day
                                              ? {
                                                  ...d,
                                                  minutes:
                                                    Math.round(
                                                      Number(e.target.value.replace(',', '.')) * 60,
                                                    ) || 0,
                                                }
                                              : d,
                                          ),
                                        }
                                      : s,
                                  ),
                                );
                              }}
                            />
                            <span>h</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>
        {!state.subjects.length && (
          <p className="form-help">Adicione disciplinas em Meu edital para montar sua semana.</p>
        )}
        <div className="schedule-live-total">
          <div>
            <small>DIAS DE ESTUDO</small>
            <strong>{targets.studyDays} / 7</strong>
          </div>
          <div>
            <small>META DA SEMANA</small>
            <strong>{minutesLabel(targets.weeklyMinutes)}</strong>
          </div>
          <div>
            <small>MÉDIA MENSAL*</small>
            <strong>{minutesLabel(targets.monthlyMinutes)}</strong>
          </div>
        </div>
        <p className="form-help">
          *Estimativa mensal se este ritmo semanal for repetido: horas da semana × 52 ÷ 12. Um ciclo
          dura exatamente 7 dias, incluindo dias de descanso.
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
  const [cycleId, setCycleId] = useState(
      (
        state.cycles.find((c) => c.weekStart === weekStart()) ??
        [...state.cycles].sort((a, b) => b.weekStart.localeCompare(a.weekStart))[0]
      ).id,
    ),
    [edit, setEdit] = useState<
      { type: 'session'; session?: Session } | { type: 'cycle'; cycle?: Cycle } | null
    >(null);
  const cycle = state.cycles.find((c) => c.id === cycleId) ?? state.cycles[0],
    targets = cycleTargets(cycle),
    sessions = state.sessions
      .filter((s) => s.cycleId === cycle.id)
      .sort((a, b) => b.date.localeCompare(a.date)),
    stats = aggregate(sessions),
    end = addDays(cycle.weekStart, 6);
  const suggestedWeek = addDays(
    [...state.cycles]
      .map((c) => c.weekStart)
      .sort()
      .at(-1)!,
    7,
  );
  function saveSession(session: Session) {
    mutate((s) => ({
      ...s,
      sessions: s.sessions.some((x) => x.id === session.id)
        ? s.sessions.map((x) => (x.id === session.id ? session : x))
        : [...s.sessions, session],
    }));
    setEdit(null);
    notify('Sessão registrada na semana do ciclo.');
  }
  function saveCycle(name: string, start: string) {
    if (edit?.type === 'cycle' && edit.cycle) {
      const id = edit.cycle.id;
      mutate((s) => ({
        ...s,
        cycles: s.cycles.map((c) => (c.id === id ? { ...c, name, weekStart: start } : c)),
      }));
    } else {
      const newCycle = {
        ...cycle,
        id: uid(),
        name,
        weekStart: start,
        subjects: structuredClone(cycle.subjects),
      };
      mutate((s) => ({ ...s, cycles: [...s.cycles, newCycle] }));
      setCycleId(newCycle.id);
    }
    setEdit(null);
    notify('Ciclo semanal salvo.');
  }
  return (
    <>
      <PageTitle
        eyebrow="UMA SEMANA. UM PASSO A MAIS."
        title="Seu ciclo de estudos."
        description="Cada ciclo representa uma semana de 7 dias, de segunda-feira a domingo."
        actions={
          <>
            <button className="button" onClick={() => setEdit({ type: 'cycle' })}>
              <Plus size={17} />
              Novo ciclo semanal
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
              {c.name} · {shortDate(c.weekStart)} a {shortDate(addDays(c.weekStart, 6))}
            </option>
          ))}
        </select>
        <button
          className="icon-button"
          aria-label="Editar nome e semana do ciclo"
          onClick={() => setEdit({ type: 'cycle', cycle })}
        >
          <Pencil size={15} />
        </button>
        <span className="muted">
          {stats.count} sessões · {minutesLabel(stats.minutes)} estudadas nesta semana
        </span>
      </div>
      <div className="week-period">
        <CalendarDays size={21} />
        <div>
          <strong>
            Segunda, {cycle.weekStart.split('-').reverse().join('/')} → Domingo,{' '}
            {end.split('-').reverse().join('/')}
          </strong>
          <span>
            As sessões deste ciclo pertencem a essa semana. O próximo ciclo começa em uma nova
            segunda-feira.
          </span>
        </div>
        <span className="count-pill">7 dias</span>
      </div>
      <div className="metric-grid">
        <Metric
          icon={Clock3}
          label="Média por dia de estudo"
          value={minutesLabel(targets.dailyMinutes)}
          detail={`${targets.studyDays} dias planejados dos 7 da semana`}
        />
        <Metric
          icon={CalendarDays}
          tone="blue"
          label="Meta desta semana"
          value={minutesLabel(targets.weeklyMinutes)}
          detail="soma dos horários das disciplinas"
        />
        <Metric
          icon={CalendarRange}
          tone="ochre"
          label="Estimativa mensal"
          value={minutesLabel(targets.monthlyMinutes)}
          detail="se repetir o ritmo semanal (4,33 semanas)"
        />
        <Metric
          icon={Layers3}
          tone="purple"
          label="Disciplinas nesta semana"
          value={cycle.subjects.length.toString().padStart(2, '0')}
          detail="dias e horas definidos individualmente"
        />
      </div>
      <section className="panel week-summary">
        <div className="panel-title">
          <div>
            <h2>Sua semana, dia a dia</h2>
            <p>Tempo planejado e realizado em cada um dos sete dias.</p>
          </div>
        </div>
        <div className="week-overview">
          {targets.dailyTotals.map((day) => {
            const date = addDays(cycle.weekStart, day.day),
              done = aggregate(sessions.filter((s) => s.date === date));
            return (
              <div key={day.day} className="weekday-total">
                <div>
                  <strong>{WEEKDAYS[day.day]}</strong>
                  <small>{shortDate(date)}</small>
                </div>
                <span>{minutesLabel(day.minutes)}</span>
                <small>{day.minutes ? 'planejadas' : 'dia livre'}</small>
                <Progress value={day.minutes ? (done.minutes / day.minutes) * 100 : 0} />
                <small>{minutesLabel(done.minutes)} realizadas</small>
              </div>
            );
          })}
        </div>
      </section>
      <div className="cycle-layout weekly-layout">
        <Planner
          key={`${cycle.id}:${cycle.weekStart}`}
          cycle={cycle}
          state={state}
          onSave={(updated) => {
            mutate((s) => ({
              ...s,
              cycles: s.cycles.map((c) => (c.id === updated.id ? updated : c)),
            }));
            notify('Dias e horas por disciplina salvos.');
          }}
        />
        <section className="panel">
          <div className="panel-title">
            <div>
              <h2>Acompanhamento desta semana</h2>
              <p>
                {shortDate(cycle.weekStart)} a {shortDate(end)} · estudo realizado × meta
              </p>
            </div>
            <Timer size={21} className="muted" />
          </div>
          <div className="weekly-body">
            <div className="weekly-total">
              <strong>{minutesLabel(stats.minutes)}</strong>
              <span>de {minutesLabel(targets.weeklyMinutes)} planejadas para este ciclo</span>
            </div>
            <Progress
              value={targets.weeklyMinutes ? (stats.minutes / targets.weeklyMinutes) * 100 : 0}
            />
            <div className="weekly-meta">
              <span>
                {Math.round(
                  targets.weeklyMinutes ? (stats.minutes / targets.weeklyMinutes) * 100 : 0,
                )}
                % da meta semanal
              </span>
              <span>{stats.count} sessões</span>
            </div>
            <div className="allocation-list weekly-allocation">
              {targets.allocations.map((item) => {
                const subject = state.subjects.find((s) => s.id === item.subjectId);
                if (!subject) return null;
                const done = aggregate(
                  sessions.filter((s) => s.subjectId === item.subjectId),
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
                    <p className="allocation-days">
                      {item.schedule
                        .map((slot) => `${WEEKDAYS[slot.day]} ${minutesLabel(slot.minutes)}`)
                        .join(' · ') || 'Sem dias definidos'}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>
      <Hint>
        O planejamento é a sua meta. As horas efetivamente estudadas entram no diário e nas
        estatísticas da semana correspondente.
      </Hint>
      <section className="panel sessions-panel">
        <div className="panel-title">
          <div>
            <h2>Diário de estudos</h2>
            <p>
              {cycle.name} · semana de {shortDate(cycle.weekStart)} a {shortDate(end)}
            </p>
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
            title="O primeiro passo desta semana começa aqui"
            description="Registre a disciplina, a aula e o tempo estudado dentro dos sete dias deste ciclo."
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
                ? 'Editar ciclo semanal'
                : 'Novo ciclo semanal'
          }
          description={
            edit.type === 'session'
              ? 'Cada minuto conta. Registre o que você fez nesta semana.'
              : undefined
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
            <CycleForm
              cycle={edit.cycle}
              suggestedWeek={suggestedWeek}
              sessions={state.sessions}
              onSave={saveCycle}
              onClose={() => setEdit(null)}
            />
          )}
        </Modal>
      )}
    </>
  );
}
