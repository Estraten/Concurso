import { describe, it, expect } from 'vitest';
import {
  aggregate,
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
  it('calcula metas e reparte todas as horas conforme pesos', () => {
    const cycle = initialState().cycles[0];
    cycle.subjects = [
      { subjectId: 'subject-0', weight: 2 },
      { subjectId: 'subject-1', weight: 1 },
    ];
    const result = cycleTargets(cycle);
    expect(result.dailyMinutes).toBe(180);
    expect(result.weeklyMinutes).toBe(900);
    expect(result.monthlyMinutes).toBe(3900);
    expect(result.allocations.map((a) => a.weeklyMinutes)).toEqual([600, 300]);
  });
  it('permite planejar após excluir todas as disciplinas sem dividir por zero', () => {
    const cycle = initialState().cycles[0];
    cycle.subjects = [];
    expect(cycleTargets(cycle).allocations).toEqual([]);
  });
});
describe('Integridade de dados', () => {
  it('remove registros vinculados à disciplina e ao tópico excluídos', () => {
    const state = initialState();
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
    const state = initialState();
    state.sessions = [session({ correct: 11 })];
    expect(stateSchema.safeParse(state).success).toBe(false);
    state.sessions = [session({ topicId: 'missing' })];
    expect(stateSchema.safeParse(state).success).toBe(false);
    state.sessions = [session({ cycleId: 'missing' })];
    expect(stateSchema.safeParse(state).success).toBe(false);
  });
  it('valida a base inicial sem inventar horas, incidências ou resultados', () => {
    const state = initialState();
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
    const state = initialState();
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
