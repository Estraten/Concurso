import { useState } from 'react';
import {
  BarChart3,
  Clock3,
  CheckCheck,
  Target,
  ListChecks,
  Download,
  TrendingUp,
  Activity,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  AreaChart,
  Area,
} from 'recharts';
import { aggregate, minutesLabel, today } from './model';
import { download } from './storage';
import { PageTitle, Metric, Empty, Progress } from './ui';
import type { SharedProps } from './App';

const compact = (s: string, n = 22) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
function ago(days: number) {
  const date = new Date(`${today()}T12:00:00`);
  date.setDate(date.getDate() - days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export default function Statistics({ state }: SharedProps) {
  const [subjectId, setSubject] = useState('all'),
    [period, setPeriod] = useState('all'),
    [cycleId, setCycle] = useState('all'),
    [chart, setChart] = useState('subjects');
  const sessions = state.sessions.filter(
      (s) =>
        (subjectId === 'all' || s.subjectId === subjectId) &&
        (cycleId === 'all' || s.cycleId === cycleId) &&
        (period === 'all' || (s.date >= ago(Number(period) - 1) && s.date <= today())),
    ),
    stats = aggregate(sessions);
  const subjects = state.subjects
    .filter((s) => subjectId === 'all' || s.id === subjectId)
    .map((subject) => ({
      ...subject,
      ...aggregate(sessions.filter((s) => s.subjectId === subject.id)),
    }));
  const subjectData = subjects
    .filter((s) => s.count)
    .map((s) => ({
      name: s.name,
      label: compact(s.name, 15),
      hours: Math.round((s.minutes / 60) * 100) / 100,
      color: s.color,
    }));
  const topicData = subjects
    .flatMap((subject) =>
      subject.topics.map((topic) => ({
        ...topic,
        subjectName: subject.name,
        color: subject.color,
        ...aggregate(sessions.filter((s) => s.topicId === topic.id)),
      })),
    )
    .filter((t) => t.count);
  const accuracyData = topicData
    .filter((t) => t.questions > 0)
    .map((t) => ({
      name: t.name,
      label: compact(t.name, 17),
      accuracy: t.accuracy,
      color: t.color,
    }));
  const days = [...new Set(sessions.map((s) => s.date))].sort();
  const timeline = days.map((date) => ({
    name: date.split('-').reverse().slice(0, 2).join('/'),
    fullDate: date,
    hours:
      Math.round((aggregate(sessions.filter((s) => s.date === date)).minutes / 60) * 100) / 100,
  }));
  function exportCsv() {
    const escape = (s: string) => `"${s.replaceAll('"', '""')}"`;
    const csv = [
      'disciplina;aula;minutos;questoes;acertos;aproveitamento_percentual',
      ...topicData.map((t) =>
        [
          escape(t.subjectName),
          escape(t.name),
          t.minutes,
          t.questions,
          t.correct,
          t.accuracy?.toString().replace('.', ',') ?? '',
        ].join(';'),
      ),
    ].join('\n');
    download(
      'aprova-estatisticas.csv',
      new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }),
    );
  }
  return (
    <>
      <PageTitle
        eyebrow="CADA AVANÇO, VISÍVEL"
        title="Sua evolução em números."
        description="Entenda onde seu tempo vai e onde seu conhecimento cresce."
        actions={
          <button className="button" onClick={exportCsv}>
            <Download size={17} />
            Exportar relatório
          </button>
        }
      />
      <div className="filter-strip">
        <div>
          <span className="field-label">Disciplina</span>
          <select
            aria-label="Filtrar estatísticas por disciplina"
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
        </div>
        <div>
          <span className="field-label">Período</span>
          <select
            aria-label="Período das estatísticas"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          >
            <option value="all">Todo o período</option>
            <option value="7">Últimos 7 dias</option>
            <option value="30">Últimos 30 dias</option>
            <option value="90">Últimos 90 dias</option>
          </select>
        </div>
        <div>
          <span className="field-label">Ciclo</span>
          <select
            aria-label="Filtrar estatísticas por ciclo"
            value={cycleId}
            onChange={(e) => setCycle(e.target.value)}
          >
            <option value="all">Todos os ciclos</option>
            {state.cycles.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-info">
          <Activity size={16} />
          <span>Atualizado a cada sessão</span>
        </div>
      </div>
      <div className="metric-grid">
        <Metric
          icon={Clock3}
          label="Tempo de dedicação"
          value={minutesLabel(stats.minutes)}
          detail={`${stats.count} sessões de estudo`}
        />
        <Metric
          icon={ListChecks}
          tone="blue"
          label="Questões resolvidas"
          value={stats.questions}
          detail="no período selecionado"
        />
        <Metric
          icon={CheckCheck}
          tone="ochre"
          label="Questões corretas"
          value={stats.correct}
          detail={`${stats.questions - stats.correct} questões incorretas`}
        />
        <Metric
          icon={Target}
          tone="purple"
          label="Aproveitamento geral"
          value={
            stats.accuracy === null ? (
              '—'
            ) : (
              <>
                {stats.accuracy.toLocaleString('pt-BR')}
                <span>%</span>
              </>
            )
          }
          detail="total de acertos ÷ total de questões"
        />
      </div>
      <div className="charts-grid">
        <section className="panel chart-panel">
          <div className="panel-title">
            <div>
              <h2>Horas de estudo</h2>
              <p>
                {chart === 'subjects' ? 'Seu tempo por disciplina' : 'Seu ritmo ao longo dos dias'}
              </p>
            </div>
            <div className="segmented">
              <button
                aria-label="Horas por disciplina"
                className={chart === 'subjects' ? 'active' : ''}
                onClick={() => setChart('subjects')}
              >
                <BarChart3 size={16} />
              </button>
              <button
                aria-label="Horas ao longo do tempo"
                className={chart === 'time' ? 'active' : ''}
                onClick={() => setChart('time')}
              >
                <TrendingUp size={16} />
              </button>
            </div>
          </div>
          {!stats.count ? (
            <Empty
              title="Seu gráfico começa com uma sessão"
              description="Registre um estudo no ciclo para acompanhar suas horas."
            />
          ) : (
            <div className="chart-area">
              <ResponsiveContainer width="100%" height={280}>
                {chart === 'subjects' ? (
                  <BarChart
                    data={subjectData}
                    margin={{ top: 12, right: 12, bottom: 26, left: -16 }}
                  >
                    <CartesianGrid strokeDasharray="3 5" vertical={false} stroke="#e7ebe5" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 10, fill: '#7e8a80' }}
                      axisLine={false}
                      tickLine={false}
                      interval={0}
                      angle={-18}
                      textAnchor="end"
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#7e8a80' }}
                      axisLine={false}
                      tickLine={false}
                      unit="h"
                    />
                    <Tooltip
                      labelFormatter={(_, payload) => payload?.[0]?.payload?.name ?? ''}
                      formatter={(value) => [
                        `${Number(value).toLocaleString('pt-BR')} h`,
                        'Tempo estudado',
                      ]}
                      contentStyle={{ borderRadius: 12, borderColor: '#e1e6de', fontSize: 12 }}
                    />
                    <Bar dataKey="hours" radius={[5, 5, 0, 0]} maxBarSize={42}>
                      {subjectData.map((d) => (
                        <Cell key={d.name} fill={d.color} />
                      ))}
                    </Bar>
                  </BarChart>
                ) : (
                  <AreaChart data={timeline} margin={{ top: 12, right: 20, bottom: 10, left: -16 }}>
                    <defs>
                      <linearGradient id="study-gradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#4d8369" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#4d8369" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 5" vertical={false} stroke="#e7ebe5" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis unit="h" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      formatter={(value) => [
                        `${Number(value).toLocaleString('pt-BR')} h`,
                        'Tempo estudado',
                      ]}
                    />
                    <Area
                      type="monotone"
                      dataKey="hours"
                      stroke="#447e63"
                      fill="url(#study-gradient)"
                      strokeWidth={2.5}
                      dot={{ r: 3 }}
                    />
                  </AreaChart>
                )}
              </ResponsiveContainer>
            </div>
          )}
        </section>
        <section className="panel chart-panel">
          <div className="panel-title">
            <div>
              <h2>Aproveitamento por aula</h2>
              <p>Percentual de questões corretas</p>
            </div>
            <Target size={19} className="muted" />
          </div>
          {!accuracyData.length ? (
            <Empty
              title="Conhecimento que vira resultado"
              description="Informe as questões e os acertos nas sessões para ver o aproveitamento por aula."
            />
          ) : (
            <div
              className="chart-area horizontal-chart"
              style={{ minHeight: Math.max(280, accuracyData.length * 38) }}
            >
              <ResponsiveContainer width="100%" height={Math.max(280, accuracyData.length * 38)}>
                <BarChart
                  data={accuracyData}
                  layout="vertical"
                  margin={{ top: 8, right: 25, bottom: 8, left: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 5" horizontal={false} stroke="#e7ebe5" />
                  <XAxis
                    type="number"
                    domain={[0, 100]}
                    tick={{ fontSize: 11, fill: '#7e8a80' }}
                    unit="%"
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    dataKey="label"
                    type="category"
                    width={126}
                    tick={{ fontSize: 10, fill: '#64736b' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    labelFormatter={(_, payload) => payload?.[0]?.payload?.name ?? ''}
                    formatter={(value) => [`${Number(value).toLocaleString('pt-BR')}%`, 'Acertos']}
                  />
                  <Bar dataKey="accuracy" radius={[0, 5, 5, 0]} maxBarSize={18}>
                    {accuracyData.map((d, i) => (
                      <Cell key={i} fill={d.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
      </div>
      <section className="panel">
        <div className="panel-title">
          <div>
            <h2>Resultado por disciplina</h2>
            <p>O total de cada disciplina reúne todas as suas aulas.</p>
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>DISCIPLINA</th>
                <th>TEMPO ESTUDADO</th>
                <th>QUESTÕES</th>
                <th>ACERTOS / TOTAL</th>
                <th>APROVEITAMENTO</th>
              </tr>
            </thead>
            <tbody>
              {subjects.map((subject) => (
                <tr key={subject.id}>
                  <td>
                    <span className="table-subject">
                      <i className="subject-color" style={{ background: subject.color }} />
                      {subject.name}
                    </span>
                  </td>
                  <td>{minutesLabel(subject.minutes)}</td>
                  <td>{subject.questions}</td>
                  <td>
                    {subject.correct} / {subject.questions}
                  </td>
                  <td>
                    <div className="accuracy-cell">
                      <span>
                        {subject.accuracy === null
                          ? '—'
                          : `${subject.accuracy.toLocaleString('pt-BR')}%`}
                      </span>
                      <Progress value={subject.accuracy ?? 0} color={subject.color} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel topic-statistics">
        <div className="panel-title">
          <div>
            <h2>Detalhamento por aula</h2>
            <p>Identifique os tópicos que merecem mais atenção.</p>
          </div>
        </div>
        {!topicData.length ? (
          <Empty
            title="Suas aulas vão aparecer aqui"
            description="O detalhamento é preenchido conforme você registra as sessões de estudo."
          />
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>AULA / TÓPICO</th>
                  <th>HORAS</th>
                  <th>SESSÕES</th>
                  <th>QUESTÕES</th>
                  <th>APROVEITAMENTO</th>
                </tr>
              </thead>
              <tbody>
                {topicData.map((topic) => (
                  <tr key={topic.id}>
                    <td>
                      <span className="table-primary">{topic.name}</span>
                      <small>{topic.subjectName}</small>
                    </td>
                    <td>{minutesLabel(topic.minutes)}</td>
                    <td>{topic.count}</td>
                    <td>
                      {topic.correct} / {topic.questions}
                    </td>
                    <td>
                      {topic.accuracy === null ? '—' : `${topic.accuracy.toLocaleString('pt-BR')}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <p className="statistics-help">
        Os percentuais usam a soma dos acertos dividida pela soma das questões, tanto por aula
        quanto por disciplina. Sessões sem questões não alteram o aproveitamento. No gráfico de
        tempo, dias sem sessões não são exibidos.
      </p>
    </>
  );
}
