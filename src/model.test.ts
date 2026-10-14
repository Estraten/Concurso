import { describe, it, expect } from 'vitest';
import {
  aggregate,
  addDays,
  migrateState,
  weekStart,
  cycleSchema,
  cycleTargets,
  deleteSubject,
  deleteTopic,
  initialState,
  minutesLabel,
  percent,
  stateSchema,
  subjectsFromCsv,
  parseCsv,
  type Session,
} from './model';

const studyState = () => {
  const state = initialState();
  state.cycles[0].weekStart = '2026-10-12';
  return state;
};
const session = (patch: Partial<Session> = {}): Session => ({
  id: crypto.randomUUID(),
  cycleId: 'cycle-1',
  subjectId: 'subject-0',
  topicId: 'topic-0-0',
  date: '2026-10-13',
  minutes: 60,
  questions: 10,
  correct: 8,
  kind: 'Questões',
  ...patch,
});
describe('Resultados de estudo', () => {
  it('pondera aproveitamento pelas questões em vez de fazer média dos percentuais', () => {
    const result = aggregate([
      session({ questions: 10, correct: 10 }),
      session({ questions: 90, correct: 45 }),
    ]);
    expect(result).toMatchObject({
      minutes: 120,
      questions: 100,
      correct: 55,
      accuracy: 55,
      count: 2,
    });
  });
  it('conta horas de teoria sem alterar o aproveitamento e distingue zero de ausência de questões', () => {
    expect(
      aggregate([session(), session({ minutes: 30, questions: 0, correct: 0 })]),
    ).toMatchObject({ minutes: 90, accuracy: 80 });
    expect(percent(0, 0)).toBeNull();
    expect(percent(0, 10)).toBe(0);
    expect(minutesLabel(95)).toBe('1h 35min');
  });
});
describe('Dimensionamento do ciclo', () => {
  it('soma os horários individuais por dia, semana e disciplina', () => {
    const cycle = studyState().cycles[0];
    cycle.subjects = [
      {
        subjectId: 'subject-0',
        schedule: [
          { day: 0, minutes: 90 },
          { day: 2, minutes: 60 },
        ],
      },
      {
        subjectId: 'subject-1',
        schedule: [
          { day: 1, minutes: 120 },
          { day: 4, minutes: 120 },
        ],
      },
    ];
    const result = cycleTargets(cycle);
    expect(result.dailyTotals.map((day) => day.minutes)).toEqual([90, 120, 60, 0, 120, 0, 0]);
    expect(result.studyDays).toBe(4);
    expect(result.dailyMinutes).toBe(97.5);
    expect(result.weeklyMinutes).toBe(390);
    expect(result.monthlyMinutes).toBe(1690);
    expect(result.allocations.map((a) => a.weeklyMinutes)).toEqual([150, 240]);
  });
  it('inicia na segunda e encerra no domingo, inclusive na virada de ano', () => {
    expect(weekStart('2026-10-18')).toBe('2026-10-12');
    expect(weekStart('2026-10-19')).toBe('2026-10-19');
    expect(weekStart('2027-01-01')).toBe('2026-12-28');
    expect(addDays('2026-12-28', 6)).toBe('2027-01-03');
    const cycle = studyState().cycles[0];
    expect(cycleSchema.safeParse({ ...cycle, weekStart: '2026-10-13' }).success).toBe(false);
  });
  it('impede duplicação de dias e metas acima de 24 horas no mesmo dia', () => {
    const cycle = studyState().cycles[0];
    cycle.subjects = [
      {
        subjectId: 'subject-0',
        schedule: [
          { day: 0, minutes: 60 },
          { day: 0, minutes: 60 },
        ],
      },
    ];
    expect(cycleSchema.safeParse(cycle).success).toBe(false);
    cycle.subjects = [
      { subjectId: 'subject-0', schedule: [{ day: 0, minutes: 900 }] },
      { subjectId: 'subject-1', schedule: [{ day: 0, minutes: 600 }] },
    ];
    expect(cycleSchema.safeParse(cycle).success).toBe(false);
  });
  it('permite planejar após excluir todas as disciplinas sem dividir por zero', () => {
    const cycle = studyState().cycles[0];
    cycle.subjects = [];
    expect(cycleTargets(cycle).allocations).toEqual([]);
  });
});
describe('Integridade de dados', () => {
  it('remove registros vinculados à disciplina e ao tópico excluídos', () => {
    const state = studyState();
    state.sessions = [session(), session({ subjectId: 'subject-1', topicId: 'topic-1-0' })];
    state.errors = [
      {
        id: 'e',
        subjectId: 'subject-0',
        topicId: 'topic-0-0',
        title: 'Erro',
        description: '',
        answer: '',
        date: '2026-10-13',
        reviewed: false,
      },
    ];
    const afterTopic = deleteTopic(state, 'subject-0', 'topic-0-0');
    expect(afterTopic.sessions).toHaveLength(1);
    expect(afterTopic.errors).toHaveLength(0);
    expect(stateSchema.safeParse(afterTopic).success).toBe(true);
    const afterSubject = deleteSubject(state, 'subject-0');
    expect(afterSubject.subjects).toHaveLength(10);
    expect(afterSubject.cycles[0].subjects.some((s) => s.subjectId === 'subject-0')).toBe(false);
    expect(stateSchema.safeParse(afterSubject).success).toBe(true);
  });
  it('rejeita acertos superiores a questões e referências inexistentes no backup', () => {
    const state = studyState();
    state.sessions = [session({ correct: 11 })];
    expect(stateSchema.safeParse(state).success).toBe(false);
    state.sessions = [session({ topicId: 'missing' })];
    expect(stateSchema.safeParse(state).success).toBe(false);
    state.sessions = [session({ cycleId: 'missing' })];
    expect(stateSchema.safeParse(state).success).toBe(false);
  });
  it('valida a base inicial sem inventar horas, incidências ou resultados', () => {
    const state = studyState();
    expect(stateSchema.safeParse(state).success).toBe(true);
    expect(state.sessions).toHaveLength(0);
    expect(state.syllabusVerified).toBe(false);
    expect(state.subjects.every((s) => s.incidence === null)).toBe(true);
  });
});
describe('Importação de edital por CSV', () => {
  it('suporta separador ponto e vírgula, aspas e números brasileiros', () => {
    const subjects = subjectsFromCsv(
      'disciplina;topico;incidencia\r\nDireito;"Crédito; tributário";"45,5%"\r\nDireito;"Obrigação ""principal""";\r\n',
      [],
    );
    expect(subjects).toHaveLength(1);
    expect(subjects[0].topics[0]).toMatchObject({ name: 'Crédito; tributário', incidence: 45.5 });
    expect(subjects[0].topics[1].name).toBe('Obrigação "principal"');
    expect(subjects[0].topics[1].incidence).toBeNull();
  });
  it('mescla aulas existentes sem perder progresso ou duplicar disciplinas', () => {
    const state = studyState();
    state.subjects[0].topics[0].completed = true;
    const subjects = subjectsFromCsv(
      'disciplina,topico,incidencia\nLíngua Portuguesa,Interpretação e compreensão de textos,80',
      state.subjects,
    );
    expect(subjects).toHaveLength(11);
    expect(subjects[0].topics).toHaveLength(state.subjects[0].topics.length);
    expect(subjects[0].topics[0]).toMatchObject({ completed: true, incidence: 80 });
    expect(state.subjects[0].topics[0].incidence).toBeNull();
  });
  it('rejeita arquivos sem colunas, linhas incompletas, incidências inválidas e aspas abertas', () => {
    expect(() => subjectsFromCsv('nome,aula\nTeste,Aula', [])).toThrow();
    expect(() => subjectsFromCsv('disciplina,topico\nTeste,', [])).toThrow();
    expect(() => subjectsFromCsv('disciplina,topico,incidencia\nTeste,Aula,101', [])).toThrow();
    expect(() => parseCsv('disciplina,topico\nTeste,"Aula')).toThrow();
  });
});

describe('Migração de dados e limites das semanas', () => {
  function legacy() {
    const state = studyState();
    return {
      ...state,
      version: 1,
      cycles: [
        {
          id: 'cycle-1',
          name: 'Ciclo 1',
          hoursPerDay: 3,
          days: [0, 1, 2, 3, 4],
          subjects: [
            { subjectId: 'subject-0', weight: 2 },
            { subjectId: 'subject-1', weight: 1 },
          ],
        },
      ],
    };
  }
  it('divide ciclos antigos entre semanas sem perder sessões, questões ou horas', () => {
    const old = legacy();
    old.sessions = [
      session({ date: '2026-10-11' }),
      session({ date: '2026-10-12' }),
      session({ date: '2026-10-18' }),
      session({ date: '2026-10-19' }),
    ];
    old.errors = [
      {
        id: 'error',
        subjectId: 'subject-0',
        topicId: 'topic-0-0',
        title: 'Erro antigo',
        description: '<b>Texto</b>\nSegunda linha',
        answer: 'Minha resposta',
        date: '2026-10-13',
        reviewed: true,
      },
    ];
    const migrated = migrateState(old);
    expect(migrated.version).toBe(2);
    expect(migrated.cycles.map((c) => c.weekStart)).toEqual([
      '2026-10-05',
      '2026-10-12',
      '2026-10-19',
    ]);
    expect(aggregate(migrated.sessions)).toEqual(aggregate(old.sessions));
    expect(migrated.sessions.map((s) => s.id)).toEqual(old.sessions.map((s) => s.id));
    expect(migrated.errors[0]).toMatchObject({
      id: 'error',
      reviewed: true,
      description: '<p>&lt;b&gt;Texto&lt;/b&gt;<br>Segunda linha</p>',
      answer: '<p>Minha resposta</p>',
    });
    expect(cycleTargets(migrated.cycles[0]).allocations.map((s) => s.weeklyMinutes)).toEqual([
      600, 300,
    ]);
    expect(stateSchema.safeParse(migrated).success).toBe(true);
  });
  it('mantém o orçamento diário exato na migração de pesos fracionados', () => {
    const old = legacy();
    old.cycles[0].hoursPerDay = 0.25;
    old.cycles[0].subjects = [0, 1, 2, 3].map((i) => ({ subjectId: `subject-${i}`, weight: 1 }));
    const targets = cycleTargets(migrateState(old).cycles[0]);
    expect(targets.weeklyMinutes).toBe(75);
    expect(targets.dailyTotals.slice(0, 5).every((day) => day.minutes === 15)).toBe(true);
  });
  it('aceita segunda e domingo, mas rejeita sessões da semana seguinte', () => {
    const state = studyState();
    state.sessions = [session({ date: '2026-10-12' }), session({ date: '2026-10-18' })];
    expect(stateSchema.safeParse(state).success).toBe(true);
    state.sessions.push(session({ date: '2026-10-19' }));
    expect(stateSchema.safeParse(state).success).toBe(false);
  });
});
