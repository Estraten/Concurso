import { z } from 'zod';

const id = z.string().min(1).max(150);
const text = z.string().max(20000);
const incidence = z.number().min(0).max(100).nullable();
const day = z.iso.date();
export const topicSchema = z.object({ id, name: text.min(1), incidence, completed: z.boolean() });
export const subjectSchema = z.object({
  id,
  name: text.min(1),
  color: z.string().regex(/^#[a-fA-F0-9]{6}$/),
  incidence,
  topics: z.array(topicSchema),
});
const cycleSchema = z.object({
  id,
  name: text.min(1),
  hoursPerDay: z.number().min(0.25).max(24),
  days: z.array(z.number().int().min(0).max(6)).min(1).max(7),
  subjects: z.array(z.object({ subjectId: id, weight: z.number().min(1).max(10) })),
});
const sessionSchema = z
  .object({
    id,
    cycleId: id,
    subjectId: id,
    topicId: id,
    date: day,
    minutes: z.number().int().min(1).max(1440),
    questions: z.number().int().min(0).max(100000),
    correct: z.number().int().min(0),
    kind: z.enum(['Teoria', 'Questões', 'Revisão']),
  })
  .refine((s) => s.correct <= s.questions, 'Acertos não podem exceder questões.');
const errorSchema = z.object({
  id,
  subjectId: id,
  topicId: id,
  title: text.min(1),
  description: text,
  answer: text,
  date: day,
  reviewed: z.boolean(),
});
const attachmentSchema = z.object({
  id,
  name: z.string().max(500),
  type: z.string().max(200),
  size: z
    .number()
    .int()
    .min(0)
    .max(5 * 1024 * 1024),
  data: z
    .string()
    .max(8 * 1024 * 1024)
    .regex(/^data:[^,]*;base64,[A-Za-z0-9+/=\r\n]*$/),
});
const noteSchema = z.object({
  id,
  subjectId: id,
  topicId: id,
  title: text.min(1),
  html: z.string().max(1000000),
  updated: z.iso.datetime(),
  attachments: z.array(attachmentSchema).max(30),
});
export const stateSchema = z
  .object({
    version: z.literal(1),
    exam: z.string().min(1).max(500),
    syllabusVerified: z.boolean(),
    subjects: z.array(subjectSchema).max(200),
    cycles: z.array(cycleSchema).min(1).max(200),
    sessions: z.array(sessionSchema).max(100000),
    errors: z.array(errorSchema).max(20000),
    notes: z.array(noteSchema).max(20000),
  })
  .superRefine((state, ctx) => {
    const subjects = new Map(state.subjects.map((s) => [s.id, new Set(s.topics.map((t) => t.id))]));
    const cycles = new Set(state.cycles.map((c) => c.id));
    for (const group of [
      state.subjects,
      state.cycles,
      state.sessions,
      state.errors,
      state.notes,
      ...state.subjects.map((s) => s.topics),
    ]) {
      if (new Set(group.map((x) => x.id)).size !== group.length)
        ctx.addIssue({ code: 'custom', message: 'Identificadores duplicados.' });
    }
    const allTopicIds = state.subjects.flatMap((s) => s.topics.map((t) => t.id));
    if (new Set(allTopicIds).size !== allTopicIds.length)
      ctx.addIssue({ code: 'custom', message: 'Tópicos com identificadores duplicados.' });
    if (
      state.notes.reduce(
        (sum, n) => sum + n.attachments.reduce((bytes, f) => bytes + f.size, 0),
        0,
      ) >
      100 * 1024 * 1024
    )
      ctx.addIssue({ code: 'custom', message: 'Os anexos excedem o limite total de 100 MB.' });
    for (const record of [...state.sessions, ...state.errors, ...state.notes]) {
      if (!subjects.get(record.subjectId)?.has(record.topicId))
        ctx.addIssue({ code: 'custom', message: 'Aula ou disciplina inexistente.' });
    }
    for (const session of state.sessions)
      if (!cycles.has(session.cycleId))
        ctx.addIssue({ code: 'custom', message: 'Ciclo inexistente.' });
    for (const cycle of state.cycles) {
      if (
        new Set(cycle.days).size !== cycle.days.length ||
        new Set(cycle.subjects.map((s) => s.subjectId)).size !== cycle.subjects.length
      )
        ctx.addIssue({ code: 'custom', message: 'Configuração de ciclo duplicada.' });
      for (const subject of cycle.subjects)
        if (!subjects.has(subject.subjectId))
          ctx.addIssue({ code: 'custom', message: 'Disciplina do ciclo inexistente.' });
    }
  });
export type State = z.infer<typeof stateSchema>;
export type Subject = z.infer<typeof subjectSchema>;
export type Topic = z.infer<typeof topicSchema>;
export type Cycle = State['cycles'][number];
export type Session = State['sessions'][number];
export type StudyError = State['errors'][number];
export type Note = State['notes'][number];
export const uid = () => crypto.randomUUID();
export const today = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Rio_Branco',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
export function minutesLabel(minutes: number) {
  const value = Math.round(minutes);
  return `${Math.floor(value / 60)}h${value % 60 ? ` ${String(value % 60).padStart(2, '0')}min` : ''}`;
}
export const percent = (correct: number, total: number) =>
  total > 0 ? Math.round((correct / total) * 1000) / 10 : null;
export function aggregate(sessions: Session[]) {
  const minutes = sessions.reduce((sum, s) => sum + s.minutes, 0);
  const questions = sessions.reduce((sum, s) => sum + s.questions, 0);
  const correct = sessions.reduce((sum, s) => sum + s.correct, 0);
  return {
    minutes,
    questions,
    correct,
    accuracy: percent(correct, questions),
    count: sessions.length,
  };
}
export function cycleTargets(cycle: Cycle) {
  const weeklyMinutes = cycle.hoursPerDay * cycle.days.length * 60;
  const totalWeight = cycle.subjects.reduce((sum, s) => sum + s.weight, 0);
  return {
    dailyMinutes: cycle.hoursPerDay * 60,
    weeklyMinutes,
    monthlyMinutes: (weeklyMinutes * 52) / 12,
    allocations: cycle.subjects.map((s) => ({
      ...s,
      weeklyMinutes: totalWeight ? (weeklyMinutes * s.weight) / totalWeight : 0,
    })),
  };
}
export function deleteSubject(state: State, subjectId: string): State {
  return {
    ...state,
    subjects: state.subjects.filter((s) => s.id !== subjectId),
    cycles: state.cycles.map((c) => ({
      ...c,
      subjects: c.subjects.filter((s) => s.subjectId !== subjectId),
    })),
    sessions: state.sessions.filter((s) => s.subjectId !== subjectId),
    errors: state.errors.filter((s) => s.subjectId !== subjectId),
    notes: state.notes.filter((s) => s.subjectId !== subjectId),
  };
}
export function deleteTopic(state: State, subjectId: string, topicId: string): State {
  return {
    ...state,
    subjects: state.subjects.map((s) =>
      s.id === subjectId ? { ...s, topics: s.topics.filter((t) => t.id !== topicId) } : s,
    ),
    sessions: state.sessions.filter((s) => s.topicId !== topicId),
    errors: state.errors.filter((s) => s.topicId !== topicId),
    notes: state.notes.filter((s) => s.topicId !== topicId),
  };
}

export function parseCsv(source: string): string[][] {
  const separator = source.split(/\r?\n/)[0].includes(';') ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [],
    cell = '',
    quoted = false;
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (c === '"') {
      if (quoted && source[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (!quoted && c === separator) {
      row.push(cell.trim());
      cell = '';
    } else if (!quoted && (c === '\n' || c === '\r')) {
      if (c === '\r' && source[i + 1] === '\n') i++;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  if (quoted) throw new Error('CSV com aspas não fechadas.');
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}
export function subjectsFromCsv(csv: string, existing: Subject[]): Subject[] {
  const rows = parseCsv(csv.replace(/^\uFEFF/, ''));
  const normalize = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  const headers = rows.shift()?.map(normalize) ?? [];
  const subjectColumn = headers.indexOf('disciplina');
  const topicColumn = headers.findIndex((s) => ['topico', 'aula'].includes(s));
  const incidenceColumn = headers.indexOf('incidencia');
  if (subjectColumn < 0 || topicColumn < 0)
    throw new Error('Use as colunas disciplina, topico e incidencia (opcional).');
  const result = structuredClone(existing);
  let imported = 0;
  for (const row of rows) {
    const name = row[subjectColumn]?.trim(),
      topic = row[topicColumn]?.trim();
    if (!name && !topic) continue;
    if (!name || !topic) throw new Error('Toda linha precisa de disciplina e tópico.');
    const raw =
      incidenceColumn < 0
        ? ''
        : (row[incidenceColumn] ?? '').replace('%', '').replace(',', '.').trim();
    const incidence = raw ? Number(raw) : null;
    if (incidence !== null && (!Number.isFinite(incidence) || incidence < 0 || incidence > 100))
      throw new Error('Incidência deve estar entre 0 e 100.');
    let subject = result.find((s) => normalize(s.name) === normalize(name));
    if (!subject) {
      subject = {
        id: uid(),
        name,
        color: colors[result.length % colors.length],
        incidence: null,
        topics: [],
      };
      result.push(subject);
    }
    const existingTopic = subject.topics.find((t) => normalize(t.name) === normalize(topic));
    if (existingTopic) {
      if (incidence !== null) existingTopic.incidence = incidence;
    } else subject.topics.push({ id: uid(), name: topic, incidence, completed: false });
    imported++;
  }
  if (!imported) throw new Error('O arquivo não contém tópicos.');
  if (result.length > 200) throw new Error('Limite de 200 disciplinas.');
  return result;
}
export const colors = [
  '#537a64',
  '#5e77ac',
  '#b07b42',
  '#9a6e9f',
  '#518c93',
  '#b35f62',
  '#728449',
  '#90775e',
  '#6776a4',
  '#b77b58',
  '#568a78',
];

const base: [string, string[]][] = [
  [
    'Língua Portuguesa',
    [
      'Interpretação e compreensão de textos',
      'Tipologia e gêneros textuais',
      'Ortografia e acentuação',
      'Classes de palavras',
      'Sintaxe da oração e do período',
      'Concordância nominal e verbal',
      'Regência nominal e verbal e crase',
      'Pontuação',
      'Coesão e coerência',
      'Reescrita de frases',
    ],
  ],
  [
    'Língua Inglesa',
    [
      'Compreensão de textos em inglês',
      'Vocabulário e expressões',
      'Estruturas gramaticais',
      'Conectivos e referências textuais',
    ],
  ],
  [
    'Raciocínio Lógico-Matemático',
    [
      'Proposições e conectivos lógicos',
      'Equivalências e negações',
      'Argumentação lógica',
      'Conjuntos e operações',
      'Razões, proporções e porcentagens',
      'Análise combinatória',
      'Probabilidade',
      'Problemas matemáticos',
    ],
  ],
  [
    'Estatística',
    [
      'Estatística descritiva',
      'Medidas de posição e dispersão',
      'Distribuições de probabilidade',
      'Amostragem',
      'Estimação e intervalos de confiança',
      'Testes de hipóteses',
      'Correlação e regressão',
    ],
  ],
  [
    'Contabilidade Geral',
    [
      'Patrimônio e variações patrimoniais',
      'Contas e escrituração contábil',
      'Regime de competência e de caixa',
      'Operações com mercadorias',
      'Ativos, passivos e patrimônio líquido',
      'Demonstrações contábeis',
      'Pronunciamentos contábeis',
    ],
  ],
  [
    'Administração Geral e Pública',
    [
      'Teorias da administração',
      'Planejamento, organização, direção e controle',
      'Gestão de pessoas',
      'Gestão de processos e projetos',
      'Modelos de administração pública',
      'Governança, transparência e accountability',
      'Gestão por resultados',
    ],
  ],
  [
    'Direito Constitucional',
    [
      'Princípios fundamentais',
      'Direitos e garantias fundamentais',
      'Organização do Estado',
      'Administração pública na Constituição',
      'Organização dos poderes',
      'Controle de constitucionalidade',
      'Sistema tributário nacional',
    ],
  ],
  [
    'Direito Administrativo',
    [
      'Princípios da administração pública',
      'Organização administrativa',
      'Atos e poderes administrativos',
      'Agentes públicos',
      'Licitações e contratos',
      'Responsabilidade civil do Estado',
      'Controle da administração',
      'Improbidade administrativa',
    ],
  ],
  [
    'Direito Tributário',
    [
      'Competência tributária',
      'Princípios e limitações ao poder de tributar',
      'Espécies tributárias',
      'Legislação tributária',
      'Obrigação tributária',
      'Crédito tributário',
      'Suspensão, extinção e exclusão do crédito',
      'Administração tributária',
    ],
  ],
  [
    'Legislação Tributária',
    [
      'Imposto sobre a renda da pessoa física',
      'Imposto sobre a renda da pessoa jurídica',
      'Imposto sobre produtos industrializados',
      'Contribuições sociais',
      'Obrigações acessórias',
      'Processo administrativo fiscal',
    ],
  ],
  [
    'Legislação Aduaneira',
    [
      'Território e controle aduaneiro',
      'Tributos incidentes no comércio exterior',
      'Despacho aduaneiro',
      'Regimes aduaneiros especiais',
      'Infrações e penalidades',
      'Bagagem e procedimentos especiais',
    ],
  ],
];
export function initialState(): State {
  const subjects = base.map(([name, topics], i) => ({
    id: `subject-${i}`,
    name,
    color: colors[i],
    incidence: null,
    topics: topics.map((name, j) => ({
      id: `topic-${i}-${j}`,
      name,
      incidence: null,
      completed: false,
    })),
  }));
  return {
    version: 1,
    exam: 'Receita Federal · Analista-Tributário',
    syllabusVerified: false,
    subjects,
    cycles: [
      {
        id: 'cycle-1',
        name: 'Ciclo 1',
        hoursPerDay: 3,
        days: [0, 1, 2, 3, 4],
        subjects: subjects.slice(0, 6).map((s) => ({ subjectId: s.id, weight: 1 })),
      },
    ],
    sessions: [],
    errors: [],
    notes: [],
  };
}
