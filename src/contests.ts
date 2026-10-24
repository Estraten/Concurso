import { z } from 'zod';
import { initialState, migrateState, stateSchema, uid, weekStart, type State } from './model';

export const CONTEST_CATEGORIES = [
  'Área fiscal',
  'Área policial',
  'Tribunais',
  'Administrativo',
  'Bancário',
  'Controle e gestão',
  'Legislativo',
  'Educação',
  'Saúde',
  'Militar',
  'Outro',
] as const;

export const contestSchema = z.object({
  id: z.string().min(1).max(150),
  category: z.enum(CONTEST_CATEGORIES),
  data: stateSchema,
});

export const workspaceSchema = z
  .object({
    version: z.literal(3),
    activeContestId: z.string().min(1).max(150),
    contests: z.array(contestSchema).min(1).max(100),
  })
  .superRefine((workspace, ctx) => {
    if (new Set(workspace.contests.map((contest) => contest.id)).size !== workspace.contests.length)
      ctx.addIssue({ code: 'custom', message: 'Há concursos com identificadores duplicados.' });
    if (!workspace.contests.some((contest) => contest.id === workspace.activeContestId))
      ctx.addIssue({ code: 'custom', message: 'O concurso selecionado não existe no backup.' });
  });

export type Contest = z.infer<typeof contestSchema>;
export type Workspace = z.infer<typeof workspaceSchema>;
export type ContestCategory = Contest['category'];

export function inferContestCategory(name: string): ContestCategory {
  if (/receita|sefaz|fiscal/i.test(name)) return 'Área fiscal';
  if (/pol[ií]cia|policial/i.test(name)) return 'Área policial';
  if (/tribunal|\b(trt|tre|trf|tj)\b/i.test(name)) return 'Tribunais';
  return 'Outro';
}

export function initialWorkspace(data = initialState()): Workspace {
  const id = uid();
  return {
    version: 3,
    activeContestId: id,
    contests: [{ id, category: inferContestCategory(data.exam), data }],
  };
}

export function migrateWorkspace(input: unknown): Workspace {
  if (input && typeof input === 'object' && 'version' in input && input.version === 3)
    return workspaceSchema.parse(input);
  return initialWorkspace(migrateState(input));
}

export const newContestSchema = z.object({
  name: z.string().trim().min(1, 'Informe o nome do concurso.').max(200),
  role: z.string().trim().max(200),
  category: z.enum(CONTEST_CATEGORIES),
  copySyllabus: z.boolean(),
});
export type NewContest = z.infer<typeof newContestSchema>;

export function addContest(workspace: Workspace, input: NewContest): Workspace {
  if (workspace.contests.length >= 100) throw new Error('O limite é de 100 concursos.');
  const options = newContestSchema.parse(input);
  const source = workspace.contests.find(
    (contest) => contest.id === workspace.activeContestId,
  )!.data;
  const subjects = options.copySyllabus
    ? source.subjects.map((subject) => ({
        ...subject,
        id: uid(),
        topics: subject.topics.map((topic) => ({ ...topic, id: uid(), completed: false })),
      }))
    : [];
  const id = uid();
  const data: State = {
    version: 2,
    exam: options.role ? `${options.name} · ${options.role}` : options.name,
    syllabusVerified: false,
    subjects,
    cycles: [{ id: uid(), name: 'Ciclo 1', weekStart: weekStart(), subjects: [] }],
    sessions: [],
    errors: [],
    notes: [],
  };
  return {
    ...workspace,
    activeContestId: id,
    contests: [...workspace.contests, { id, category: options.category, data }],
  };
}

export function selectContest(workspace: Workspace, id: string): Workspace {
  if (!workspace.contests.some((contest) => contest.id === id))
    throw new Error('Concurso não encontrado.');
  return { ...workspace, activeContestId: id };
}

export function updateContest(
  workspace: Workspace,
  id: string,
  update: (data: State) => State,
): Workspace {
  return {
    ...workspace,
    contests: workspace.contests.map((contest) =>
      contest.id === id ? { ...contest, data: update(contest.data) } : contest,
    ),
  };
}
