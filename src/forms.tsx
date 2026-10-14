import { useState, type FormEvent } from 'react';
import { Upload, Download, Info } from 'lucide-react';
import {
  colors,
  subjectsFromCsv,
  today,
  uid,
  type Subject,
  type Topic,
  type State,
  type Session,
  type StudyError,
  type Note,
  type Cycle,
} from './model';
import { download } from './storage';

const formData = (e: FormEvent<HTMLFormElement>) => {
  e.preventDefault();
  return new FormData(e.currentTarget);
};
const value = (data: FormData, key: string) => String(data.get(key) ?? '').trim();
const incidenceValue = (data: FormData) =>
  value(data, 'incidence') === '' ? null : Number(value(data, 'incidence'));
function Actions({ onClose, label = 'Salvar' }: { onClose: () => void; label?: string }) {
  return (
    <div className="form-actions">
      <button type="button" className="button" onClick={onClose}>
        Cancelar
      </button>
      <button className="button primary" type="submit">
        {label}
      </button>
    </div>
  );
}
export function SubjectForm({
  subject,
  onSave,
  onClose,
}: {
  subject?: Subject;
  onSave: (subject: Subject) => void;
  onClose: () => void;
}) {
  return (
    <form
      onSubmit={(e) => {
        const data = formData(e);
        const name = value(data, 'name');
        if (name)
          onSave({
            id: subject?.id ?? uid(),
            name,
            incidence: incidenceValue(data),
            color: value(data, 'color'),
            topics: subject?.topics ?? [],
          });
      }}
    >
      <label>
        Nome da disciplina
        <input
          autoComplete="off"
          name="name"
          placeholder="Ex.: Direito Tributário"
          maxLength={200}
          defaultValue={subject?.name}
          required
        />
      </label>
      <div className="form-grid">
        <label>
          Incidência em provas (%)
          <input
            name="incidence"
            type="number"
            min="0"
            max="100"
            step="0.1"
            placeholder="Não informada"
            defaultValue={subject?.incidence ?? ''}
          />
        </label>
        <label>
          Cor da disciplina
          <select
            aria-label="Cor da disciplina"
            name="color"
            defaultValue={subject?.color ?? colors[0]}
          >
            {colors.map((c, i) => (
              <option key={c} value={c}>
                {
                  [
                    'Verde',
                    'Azul',
                    'Âmbar',
                    'Lilás',
                    'Turquesa',
                    'Coral',
                    'Oliva',
                    'Terra',
                    'Índigo',
                    'Pêssego',
                    'Menta',
                  ][i]
                }
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="form-help">
        Informe a incidência com base nas provas que você analisou. Deixe em branco se ainda não
        tiver essa informação.
      </p>
      <Actions onClose={onClose} label={subject ? 'Salvar disciplina' : 'Adicionar disciplina'} />
    </form>
  );
}
export function TopicForm({
  topic,
  onSave,
  onClose,
}: {
  topic?: Topic;
  onSave: (topic: Topic) => void;
  onClose: () => void;
}) {
  return (
    <form
      onSubmit={(e) => {
        const data = formData(e);
        const name = value(data, 'name');
        if (name)
          onSave({
            id: topic?.id ?? uid(),
            name,
            incidence: incidenceValue(data),
            completed: topic?.completed ?? false,
          });
      }}
    >
      <label>
        Título da aula / tópico
        <input
          name="name"
          placeholder="Ex.: Crédito tributário"
          maxLength={500}
          defaultValue={topic?.name}
          required
        />
      </label>
      <label>
        Incidência em provas (%)
        <input
          name="incidence"
          type="number"
          min="0"
          max="100"
          step="0.1"
          placeholder="Não informada"
          defaultValue={topic?.incidence ?? ''}
        />
      </label>
      <Actions onClose={onClose} label={topic ? 'Salvar tópico' : 'Adicionar tópico'} />
    </form>
  );
}
export function SubjectTopicFields({
  subjects,
  subjectId,
  topicId,
  onSubject,
  onTopic,
}: {
  subjects: Subject[];
  subjectId: string;
  topicId: string;
  onSubject: (id: string) => void;
  onTopic: (id: string) => void;
}) {
  return (
    <>
      <label>
        Disciplina
        <select
          aria-label="Disciplina"
          name="subjectId"
          required
          value={subjectId}
          onChange={(e) => {
            onSubject(e.target.value);
            onTopic('');
          }}
        >
          <option value="">Selecione uma disciplina</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Aula / tópico
        <select
          aria-label="Aula / tópico"
          name="topicId"
          required
          value={topicId}
          onChange={(e) => onTopic(e.target.value)}
          disabled={!subjectId}
        >
          <option value="">Selecione a aula</option>
          {subjects
            .find((s) => s.id === subjectId)
            ?.topics.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
        </select>
      </label>
    </>
  );
}
export function SessionForm({
  state,
  cycle,
  session,
  onSave,
  onClose,
}: {
  state: State;
  cycle: Cycle;
  session?: Session;
  onSave: (session: Session) => void;
  onClose: () => void;
}) {
  const [subjectId, setSubject] = useState(session?.subjectId ?? ''),
    [topicId, setTopic] = useState(session?.topicId ?? ''),
    [error, setError] = useState('');
  const subjects = state.subjects.filter(
    (s) => cycle.subjects.some((c) => c.subjectId === s.id) || s.id === session?.subjectId,
  );
  return (
    <form
      onSubmit={(e) => {
        const data = formData(e),
          questions = Number(value(data, 'questions')),
          correct = Number(value(data, 'correct')),
          minutes = Number(value(data, 'hours')) * 60 + Number(value(data, 'minutes'));
        if (minutes < 1 || minutes > 1440)
          return setError('A duração deve ser de 1 minuto a 24 horas.');
        if (correct > questions)
          return setError('O número de acertos não pode superar o de questões.');
        onSave({
          id: session?.id ?? uid(),
          cycleId: session?.cycleId ?? cycle.id,
          subjectId,
          topicId,
          date: value(data, 'date'),
          minutes,
          questions,
          correct,
          kind: value(data, 'kind') as Session['kind'],
        });
      }}
    >
      <div className="form-grid">
        <SubjectTopicFields
          subjects={subjects}
          subjectId={subjectId}
          topicId={topicId}
          onSubject={setSubject}
          onTopic={setTopic}
        />
      </div>
      {!subjects.length && (
        <p className="form-error">Selecione pelo menos uma disciplina no planejamento do ciclo.</p>
      )}
      <div className="form-grid">
        <label>
          Data do estudo
          <input
            name="date"
            type="date"
            defaultValue={session?.date ?? today()}
            max={today()}
            required
          />
        </label>
        <label>
          Tipo de estudo
          <select aria-label="Tipo de estudo" name="kind" defaultValue={session?.kind ?? 'Teoria'}>
            <option>Teoria</option>
            <option>Questões</option>
            <option>Revisão</option>
          </select>
        </label>
      </div>
      <div className="form-grid">
        <label>
          Duração · horas
          <input
            name="hours"
            type="number"
            min="0"
            max="24"
            step="1"
            defaultValue={Math.floor((session?.minutes ?? 60) / 60)}
            required
          />
        </label>
        <label>
          Duração · minutos
          <input
            name="minutes"
            type="number"
            min="0"
            max="59"
            step="1"
            defaultValue={(session?.minutes ?? 60) % 60}
            required
          />
        </label>
      </div>
      <div className="form-grid">
        <label>
          Questões respondidas
          <input
            name="questions"
            type="number"
            min="0"
            max="100000"
            step="1"
            defaultValue={session?.questions ?? 0}
            required
          />
        </label>
        <label>
          Questões corretas
          <input
            name="correct"
            type="number"
            min="0"
            max="100000"
            step="1"
            defaultValue={session?.correct ?? 0}
            required
          />
        </label>
      </div>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <p className="form-help">
        Sessões sem questões contam para as horas, mas não entram no percentual de acertos.
      </p>
      <Actions onClose={onClose} label="Salvar sessão" />
    </form>
  );
}
export function ErrorForm({
  subjects,
  item,
  onSave,
  onClose,
}: {
  subjects: Subject[];
  item?: StudyError;
  onSave: (item: StudyError) => void;
  onClose: () => void;
}) {
  const [subjectId, setSubject] = useState(item?.subjectId ?? ''),
    [topicId, setTopic] = useState(item?.topicId ?? '');
  return (
    <form
      onSubmit={(e) => {
        const data = formData(e);
        const title = value(data, 'title');
        if (title)
          onSave({
            id: item?.id ?? uid(),
            subjectId,
            topicId,
            title,
            description: value(data, 'description'),
            answer: value(data, 'answer'),
            date: item?.date ?? today(),
            reviewed: item?.reviewed ?? false,
          });
      }}
    >
      <label>
        Tópico ou questão que errei
        <input
          name="title"
          maxLength={500}
          defaultValue={item?.title}
          placeholder="Ex.: Confundi imunidade com isenção"
          required
        />
      </label>
      <div className="form-grid">
        <SubjectTopicFields
          subjects={subjects}
          subjectId={subjectId}
          topicId={topicId}
          onSubject={setSubject}
          onTopic={setTopic}
        />
      </div>
      <label>
        O que aconteceu?
        <textarea
          name="description"
          rows={3}
          maxLength={10000}
          defaultValue={item?.description}
          placeholder="Anote a questão, a dúvida ou o motivo do erro."
        />
      </label>
      <label>
        Resposta correta / o que preciso lembrar
        <textarea
          name="answer"
          rows={3}
          maxLength={10000}
          defaultValue={item?.answer}
          placeholder="Explique com suas palavras para revisar depois."
        />
      </label>
      <Actions onClose={onClose} label="Salvar erro" />
    </form>
  );
}
export function NoteForm({
  subjects,
  onSave,
  onClose,
}: {
  subjects: Subject[];
  onSave: (note: Note) => void;
  onClose: () => void;
}) {
  const [subjectId, setSubject] = useState(''),
    [topicId, setTopic] = useState('');
  return (
    <form
      onSubmit={(e) => {
        const data = formData(e),
          title = value(data, 'title');
        if (title)
          onSave({
            id: uid(),
            subjectId,
            topicId,
            title,
            html: '<p></p>',
            updated: new Date().toISOString(),
            attachments: [],
          });
      }}
    >
      <label>
        Título da anotação
        <input
          name="title"
          placeholder="Ex.: Resumo da aula e materiais"
          maxLength={500}
          required
        />
      </label>
      <SubjectTopicFields
        subjects={subjects}
        subjectId={subjectId}
        topicId={topicId}
        onSubject={setSubject}
        onTopic={setTopic}
      />
      <Actions onClose={onClose} label="Criar anotação" />
    </form>
  );
}
export function CycleForm({
  onSave,
  onClose,
  cycle,
}: {
  cycle?: Cycle;
  onSave: (name: string) => void;
  onClose: () => void;
}) {
  return (
    <form
      onSubmit={(e) => {
        const data = formData(e),
          name = value(data, 'name');
        if (name) onSave(name);
      }}
    >
      <label>
        Nome do ciclo
        <input
          name="name"
          maxLength={120}
          defaultValue={cycle?.name}
          placeholder="Ex.: Ciclo 2 · Revisão"
          required
        />
      </label>
      <p className="form-help">
        Um novo ciclo começa com o planejamento atual. As sessões ficam separadas por ciclo, e as
        estatísticas podem consolidar todos eles.
      </p>
      <Actions onClose={onClose} label={cycle ? 'Renomear ciclo' : 'Criar ciclo'} />
    </form>
  );
}
export function CsvForm({
  existing,
  onSave,
  onClose,
}: {
  existing: Subject[];
  onSave: (subjects: Subject[], replace: boolean) => void;
  onClose: () => void;
}) {
  const [csv, setCsv] = useState(''),
    [replace, setReplace] = useState(false),
    [error, setError] = useState(''),
    [fileName, setFileName] = useState('');
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        try {
          onSave(subjectsFromCsv(csv, replace ? [] : existing), replace);
        } catch (e) {
          setError((e as Error).message);
        }
      }}
    >
      <div className="info-box">
        <Info size={19} />
        <p>
          Exporte os dados da planilha como CSV e organize as colunas <b>disciplina</b>,{' '}
          <b>topico</b> e <b>incidencia</b> (opcional, de 0 a 100). Cada linha representa uma aula
          ou tópico.
        </p>
      </div>
      <button
        type="button"
        className="button small"
        onClick={() =>
          download(
            'modelo-edital.csv',
            new Blob(
              [
                '\uFEFFdisciplina;topico;incidencia\nDireito Tributário;Obrigação tributária;\nDireito Tributário;Crédito tributário;\n',
              ],
              { type: 'text/csv;charset=utf-8' },
            ),
          )
        }
      >
        <Download size={15} />
        Baixar modelo CSV
      </button>
      <label className="file-drop">
        <Upload size={22} />
        <span>{fileName || 'Selecionar arquivo CSV'}</span>
        <input
          aria-label="Arquivo CSV do edital"
          type="file"
          accept=".csv,text/csv"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (file) {
              if (file.size > 2 * 1024 * 1024) return setError('O CSV deve ter no máximo 2 MB.');
              setCsv(await file.text());
              setFileName(file.name);
              setError('');
            }
          }}
        />
      </label>
      <label>
        Ou cole o conteúdo do CSV
        <textarea
          aria-label="Conteúdo CSV"
          rows={5}
          placeholder={'disciplina;topico;incidencia\nDireito Tributário;Crédito tributário;'}
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          required
        />
      </label>
      <label className="check-label">
        <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} />
        <span>Substituir as disciplinas atuais</span>
      </label>
      {replace && (
        <div className="danger-box">
          A substituição apaga as sessões, os erros e as anotações vinculadas ao edital anterior.
          Exporte um backup antes de continuar.
          <label className="check-label">
            <input type="checkbox" required />
            Confirmo que quero substituir o edital e apagar esses registros.
          </label>
        </div>
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <Actions onClose={onClose} label="Importar edital" />
    </form>
  );
}
