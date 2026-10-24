import { describe, expect, it } from 'vitest';
import { initialState, today } from './model';
import {
  addContest,
  initialWorkspace,
  migrateWorkspace,
  selectContest,
  updateContest,
  workspaceSchema,
  type NewContest,
} from './contests';

const police: NewContest = {
  name: 'Polícia Federal',
  role: 'Agente',
  category: 'Área policial',
  copySyllabus: false,
};
function existingData() {
  const data = initialState();
  data.subjects[0].topics[0].completed = true;
  data.syllabusVerified = true;
  data.sessions = [
    {
      id: 'session-original',
      cycleId: data.cycles[0].id,
      subjectId: data.subjects[0].id,
      topicId: data.subjects[0].topics[0].id,
      date: today(),
      minutes: 90,
      questions: 10,
      correct: 8,
      kind: 'Questões',
    },
  ];
  data.errors = [
    {
      id: 'error-original',
      subjectId: data.subjects[0].id,
      topicId: data.subjects[0].topics[0].id,
      title: 'Erro antigo',
      description: '<p>Minha dificuldade.</p>',
      answer: '<p>Minha revisão.</p>',
      date: today(),
      reviewed: false,
    },
  ];
  data.notes = [
    {
      id: 'note-original',
      subjectId: data.subjects[0].id,
      topicId: data.subjects[0].topics[0].id,
      title: 'Anotação antiga',
      html: '<p><strong>Resumo original.</strong></p>',
      updated: new Date().toISOString(),
      attachments: [
        {
          id: 'file-original',
          name: 'material.txt',
          type: 'text/plain',
          size: 3,
          data: 'data:text/plain;base64,YWJj',
        },
      ],
    },
  ];
  return data;
}

describe('Vários concursos', () => {
  it('migra o concurso existente com todos os seus registros e materiais', () => {
    const data = existingData(),
      workspace = migrateWorkspace(data);
    expect(workspace.version).toBe(3);
    expect(workspace.contests).toHaveLength(1);
    expect(workspace.activeContestId).toBe(workspace.contests[0].id);
    expect(workspace.contests[0].category).toBe('Área fiscal');
    expect(workspace.contests[0].data).toEqual(data);
    expect(workspaceSchema.safeParse(workspace).success).toBe(true);
  });
  it('cria um concurso em branco com ciclo próprio e mantém o concurso original', () => {
    const workspace = initialWorkspace(existingData()),
      original = structuredClone(workspace);
    const next = addContest(workspace, police),
      created = next.contests[1];
    expect(next.contests[0]).toEqual(original.contests[0]);
    expect(workspace).toEqual(original);
    expect(next.activeContestId).toBe(created.id);
    expect(created.category).toBe('Área policial');
    expect(created.data).toMatchObject({
      exam: 'Polícia Federal · Agente',
      subjects: [],
      sessions: [],
      errors: [],
      notes: [],
      syllabusVerified: false,
    });
    expect(created.data.cycles).toHaveLength(1);
    expect(created.data.cycles[0].subjects).toEqual([]);
    expect(created.data.cycles[0].id).not.toBe(next.contests[0].data.cycles[0].id);
    expect(workspaceSchema.safeParse(next).success).toBe(true);
  });
  it('copia só o edital, com identificadores novos e progresso zerado', () => {
    const workspace = initialWorkspace(existingData());
    const next = addContest(workspace, { ...police, copySyllabus: true });
    const copied = next.contests[1].data;
    expect(copied.subjects).toHaveLength(workspace.contests[0].data.subjects.length);
    expect(copied.subjects[0].name).toBe(workspace.contests[0].data.subjects[0].name);
    expect(copied.subjects[0].id).not.toBe(workspace.contests[0].data.subjects[0].id);
    expect(copied.subjects[0].topics[0].id).not.toBe(
      workspace.contests[0].data.subjects[0].topics[0].id,
    );
    expect(
      copied.subjects.every((subject) => subject.topics.every((topic) => !topic.completed)),
    ).toBe(true);
    expect(copied.sessions).toEqual([]);
    expect(copied.errors).toEqual([]);
    expect(copied.notes).toEqual([]);
    expect(copied.cycles[0].subjects).toEqual([]);
    expect(copied.syllabusVerified).toBe(false);
    expect(workspace.contests[0].data.subjects[0].topics[0].completed).toBe(true);
  });
  it('alterna concursos e salva uma atualização atrasada no concurso que a originou', () => {
    const workspace = initialWorkspace(existingData()),
      originalId = workspace.activeContestId;
    const next = addContest(workspace, police),
      policeId = next.activeContestId;
    const updated = updateContest(next, originalId, (data) => ({
      ...data,
      notes: data.notes.map((note) => ({ ...note, html: '<p>Arquivo anexado após a troca.</p>' })),
    }));
    expect(updated.activeContestId).toBe(policeId);
    expect(updated.contests[1].data.notes).toEqual([]);
    expect(updated.contests[0].data.notes[0].html).toBe('<p>Arquivo anexado após a troca.</p>');
    const switched = selectContest(updated, originalId);
    expect(switched.activeContestId).toBe(originalId);
    expect(switched.contests).toEqual(updated.contests);
  });
  it('mantém todos os concursos, a seleção e os anexos num backup completo', () => {
    const workspace = addContest(initialWorkspace(existingData()), police);
    const restored = migrateWorkspace(JSON.parse(JSON.stringify(workspace)));
    expect(restored).toEqual(workspace);
    expect(restored.contests[0].data.notes[0].attachments[0].data).toBe(
      'data:text/plain;base64,YWJj',
    );
  });
  it('rejeita seleção inexistente e concursos com identificadores repetidos', () => {
    const workspace = initialWorkspace(existingData());
    expect(() => selectContest(workspace, 'missing')).toThrow();
    expect(workspaceSchema.safeParse({ ...workspace, activeContestId: 'missing' }).success).toBe(
      false,
    );
    expect(
      workspaceSchema.safeParse({
        ...workspace,
        contests: [workspace.contests[0], workspace.contests[0]],
      }).success,
    ).toBe(false);
  });
});
