import { lazy, Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  BookOpen,
  Repeat2,
  BarChart3,
  NotebookPen,
  FileWarning,
  ChevronRight,
  ChevronDown,
  Check,
  CheckCircle2,
  LoaderCircle,
  Download,
  Upload,
  Settings2,
  Menu,
  X,
  ShieldCheck,
  GraduationCap,
  ArrowUpRight,
  CircleAlert,
} from 'lucide-react';
import { today, type State } from './model';
import { loadState, saveState, validateState, download } from './storage';
import { Modal, Progress } from './ui';
import Syllabus from './Syllabus';
const CyclePage = lazy(() => import('./Cycle'));
const Statistics = lazy(() => import('./Statistics'));
const Errors = lazy(() => import('./Errors'));
const Notes = lazy(() => import('./Notes'));

export type SharedProps = {
  state: State;
  mutate: (update: (state: State) => State) => void;
  notify: (message: string, type?: 'success' | 'error') => void;
  confirm: (title: string, description: string, action: () => void) => void;
};
const navigation = [
  { id: 'syllabus', label: 'Meu edital', subtitle: 'Organize seu conteúdo', icon: BookOpen },
  { id: 'cycle', label: 'Ciclo de estudos', subtitle: 'Encontre seu ritmo', icon: Repeat2 },
  { id: 'statistics', label: 'Estatísticas', subtitle: 'Acompanhe sua evolução', icon: BarChart3 },
  { id: 'errors', label: 'Caderno de erros', subtitle: 'Aprenda com cada erro', icon: FileWarning },
  { id: 'notes', label: 'Anotações', subtitle: 'Guarde suas ideias', icon: NotebookPen },
];
const currentPage = () =>
  navigation.some((n) => n.id === window.location.hash.slice(1))
    ? window.location.hash.slice(1)
    : 'syllabus';

export default function App() {
  const [state, setState] = useState<State | null>(null),
    [loadError, setLoadError] = useState(false),
    [saved, setSaved] = useState<'saving' | 'saved' | 'error'>('saving'),
    [page, setPage] = useState(currentPage),
    [menu, setMenu] = useState(false),
    [settings, setSettings] = useState(false),
    [toast, setToast] = useState<{ message: string; type: string } | null>(null),
    [confirmation, setConfirmation] = useState<{
      title: string;
      description: string;
      action: () => void;
    } | null>(null),
    [restore, setRestore] = useState<State | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null),
    importInput = useRef<HTMLInputElement>(null),
    saveQueue = useRef<Promise<void>>(Promise.resolve()),
    revision = useRef(0);
  const notify = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ message, type });
    timer.current = setTimeout(() => setToast(null), 5000);
  }, []);
  useEffect(() => {
    let active = true;
    loadState()
      .then((data) => {
        if (active) setState(data);
      })
      .catch(() => {
        if (active) setLoadError(true);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!state) return;
    const current = ++revision.current;
    setSaved('saving');
    saveQueue.current = saveQueue.current
      .catch(() => {})
      .then(() => saveState(state))
      .then(() => {
        if (current === revision.current) setSaved('saved');
      })
      .catch(() => {
        if (current === revision.current) {
          setSaved('error');
          notify(
            'O navegador não conseguiu salvar. Exporte um backup para proteger seus dados.',
            'error',
          );
        }
      });
  }, [state, notify]);
  useEffect(() => {
    const change = () => {
      setPage(currentPage());
      setMenu(false);
    };
    window.addEventListener('hashchange', change);
    return () => window.removeEventListener('hashchange', change);
  }, []);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const mutate = useCallback(
    (update: (state: State) => State) => setState((s) => (s ? update(s) : s)),
    [],
  );
  const confirm = useCallback(
    (title: string, description: string, action: () => void) =>
      setConfirmation({ title, description, action }),
    [],
  );
  const navigate = (id: string) => {
    window.location.hash = id;
    setPage(id);
    setMenu(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  async function readBackup(file?: File) {
    if (!file) return;
    try {
      if (file.size > 250 * 1024 * 1024) throw new Error('Backup maior que 250 MB.');
      const data = validateState(JSON.parse(await file.text()));
      setRestore(data);
    } catch {
      notify(
        'Backup inválido. Selecione um arquivo JSON exportado pelo Aprova (até 250 MB).',
        'error',
      );
    } finally {
      if (importInput.current) importInput.current.value = '';
    }
  }
  if (!state)
    return (
      <div className="loading-screen">
        <div className="brand-mark">
          <GraduationCap size={29} />
        </div>
        <h1>
          Aprova<span>.</span>
        </h1>
        {loadError ? (
          <>
            <p>Não foi possível ler seus dados neste navegador.</p>
            <p className="muted">
              Seus registros não foram substituídos. Verifique se o navegador permite armazenamento
              local e tente novamente.
            </p>
            <button className="button primary" onClick={() => window.location.reload()}>
              Tentar novamente
            </button>
          </>
        ) : (
          <>
            <LoaderCircle size={25} className="spin" />
            <p>Preparando seu espaço de estudos...</p>
          </>
        )}
      </div>
    );
  const active = navigation.find((n) => n.id === page) ?? navigation[0],
    ActiveIcon = active.icon,
    allTopics = state.subjects.flatMap((s) => s.topics),
    completed = allTopics.filter((t) => t.completed).length,
    progress = allTopics.length ? (completed / allTopics.length) * 100 : 0;
  const props: SharedProps = { state, mutate, notify, confirm };
  const backup = () =>
    download(
      `aprova-backup-${today()}.json`,
      new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }),
    );
  let content: ReactNode;
  switch (page) {
    case 'cycle':
      content = <CyclePage {...props} />;
      break;
    case 'statistics':
      content = <Statistics {...props} />;
      break;
    case 'errors':
      content = <Errors {...props} />;
      break;
    case 'notes':
      content = <Notes {...props} />;
      break;
    default:
      content = <Syllabus {...props} navigate={navigate} />;
  }
  return (
    <div className="app-shell">
      {menu && (
        <button
          className="sidebar-overlay"
          aria-label="Fechar menu"
          onClick={() => setMenu(false)}
        />
      )}
      <aside className={`sidebar ${menu ? 'open' : ''}`}>
        <a className="brand" href="#syllabus" aria-label="Aprova, ir para edital">
          <span className="brand-mark">
            <GraduationCap size={29} strokeWidth={1.7} />
          </span>
          <span>
            Aprova<span className="brand-period">.</span>
          </span>
        </a>
        <div className="brand-caption">SEU ESTUDO, COM DIREÇÃO</div>
        <button
          className="exam-switcher"
          onClick={() => {
            setSettings(true);
            setMenu(false);
          }}
        >
          <span className="exam-icon">
            <ShieldCheck size={20} />
          </span>
          <span>
            <small>MEU OBJETIVO</small>
            <strong>{state.exam.split('·')[0].trim()}</strong>
            <span>{state.exam.split('·')[1]?.trim() || 'Meu concurso'}</span>
          </span>
          <ChevronDown size={15} />
        </button>
        <div className="nav-caption">MEU PLANEJAMENTO</div>
        <nav aria-label="Navegação principal">
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={`nav-item ${page === item.id ? 'active' : ''}`}
                aria-current={page === item.id ? 'page' : undefined}
                onClick={() => navigate(item.id)}
              >
                <Icon size={20} strokeWidth={1.7} />
                <span>{item.label}</span>
                {page === item.id && <span className="nav-active-dot" />}
              </button>
            );
          })}
        </nav>
        <div className="sidebar-journey">
          <div>
            <span>Sua jornada</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} color="#c5dfa0" />
          <p>
            {completed} de {allTopics.length} tópicos concluídos.
            <br />
            Continue. Você está construindo o caminho.
          </p>
          <span className="journey-spark">
            <GraduationCap size={22} />
          </span>
        </div>
        <div className="sidebar-bottom">
          <div className="user-avatar">EU</div>
          <div>
            <strong>Meu espaço de estudos</strong>
            <span>Um dia de cada vez.</span>
          </div>
          <button
            className="icon-button"
            aria-label="Configurações"
            onClick={() => {
              setSettings(true);
              setMenu(false);
            }}
          >
            <Settings2 size={18} />
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label="Abrir menu"
              onClick={() => setMenu(true)}
            >
              <Menu size={22} />
            </button>
            <span className="breadcrumb-home">Meu espaço</span>
            <ChevronRight size={14} />
            <span>
              <ActiveIcon size={15} />
              {active.label}
            </span>
          </div>
          <div className="topbar-actions">
            <span className={`save-indicator ${saved}`} role="status">
              {saved === 'saving' ? (
                <LoaderCircle className="spin" size={15} />
              ) : saved === 'saved' ? (
                <CheckCircle2 size={16} />
              ) : (
                <CircleAlert size={16} />
              )}
              <span>
                {saved === 'saving'
                  ? 'Salvando...'
                  : saved === 'saved'
                    ? 'Tudo salvo neste navegador'
                    : 'Falha ao salvar'}
              </span>
            </span>
            <span className="topbar-divider" />
            <button className="topbar-button" onClick={backup} aria-label="Exportar backup">
              <Download size={16} />
              <span>Backup</span>
            </button>
            <button
              className="icon-button"
              aria-label="Abrir configurações"
              onClick={() => setSettings(true)}
            >
              <Settings2 size={18} />
            </button>
          </div>
        </header>
        <main>
          <div className="workspace-context">
            <span className="context-pill">
              <span className="small-dot" />
              {state.exam}
            </span>
            <span className="workspace-motto">
              Seu próximo passo começa hoje <ArrowUpRight size={14} />
            </span>
          </div>
          {!state.syllabusVerified && (
            <div className="syllabus-warning">
              <CircleAlert size={16} />
              <span>
                <strong>Base inicial editável.</strong> Disciplinas e tópicos sugeridos para sua
                preparação; confira com o edital oficial. A planilha vinculada não pôde ser
                consultada.
              </span>
              <button onClick={() => setSettings(true)}>
                Revisar
                <ChevronRight size={14} />
              </button>
            </div>
          )}
          <Suspense
            fallback={
              <div className="page-loading">
                <LoaderCircle className="spin" size={24} />
                <span>Preparando sua página...</span>
              </div>
            }
          >
            {content}
          </Suspense>
          <footer className="page-footer">
            <span className="footer-brand">
              Aprova<span>.</span>
            </span>
            <span>Menos dispersão. Mais direção.</span>
            <span>Dados neste navegador · Faça backups regularmente.</span>
          </footer>
        </main>
      </div>
      <input
        type="file"
        ref={importInput}
        accept=".json,application/json"
        className="visually-hidden"
        aria-label="Restaurar backup"
        onChange={(e) => void readBackup(e.target.files?.[0])}
      />
      {toast && (
        <div className={`toast ${toast.type}`} role={toast.type === 'error' ? 'alert' : 'status'}>
          {toast.type === 'error' ? <CircleAlert size={18} /> : <Check size={18} />}
          <span>{toast.message}</span>
          <button onClick={() => setToast(null)} aria-label="Fechar aviso">
            <X size={16} />
          </button>
        </div>
      )}
      {confirmation && (
        <Modal title={confirmation.title} onClose={() => setConfirmation(null)}>
          <p className="confirmation-description">{confirmation.description}</p>
          <div className="form-actions">
            <button className="button" onClick={() => setConfirmation(null)}>
              Cancelar
            </button>
            <button
              className="button destructive"
              onClick={() => {
                confirmation.action();
                setConfirmation(null);
              }}
            >
              Confirmar exclusão
            </button>
          </div>
        </Modal>
      )}
      {settings && (
        <Modal
          title="Seu espaço, do seu jeito"
          description="Personalize o concurso e proteja seus registros."
          onClose={() => setSettings(false)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const data = new FormData(e.currentTarget),
                exam = String(data.get('exam')).trim();
              if (exam) {
                mutate((s) => ({ ...s, exam, syllabusVerified: data.get('verified') === 'on' }));
                setSettings(false);
                notify('Configurações salvas.');
              }
            }}
          >
            <label>
              Concurso e cargo
              <input name="exam" maxLength={500} defaultValue={state.exam} required />
            </label>
            <label className="check-label verify-label">
              <input type="checkbox" name="verified" defaultChecked={state.syllabusVerified} />
              <span>Conferi as disciplinas e os tópicos com meu edital oficial.</span>
            </label>
            <div className="info-box">
              <ShieldCheck size={21} />
              <p>
                Os dados e anexos ficam neste navegador, sem conta ou sincronização entre
                dispositivos. O backup JSON inclui seu edital, ciclos, sessões, erros, anotações e
                arquivos. Mantenha uma cópia segura.
              </p>
            </div>
            <div className="backup-actions">
              <button type="button" className="button" onClick={backup}>
                <Download size={16} />
                Exportar backup
              </button>
              <button
                type="button"
                className="button"
                onClick={() => {
                  setSettings(false);
                  importInput.current?.click();
                }}
              >
                <Upload size={16} />
                Restaurar backup
              </button>
            </div>
            <div className="form-actions">
              <button type="button" className="button" onClick={() => setSettings(false)}>
                Cancelar
              </button>
              <button className="button primary">Salvar configurações</button>
            </div>
          </form>
        </Modal>
      )}
      {restore && (
        <Modal
          title="Restaurar seu backup?"
          description="Confira os registros que serão recuperados."
          onClose={() => setRestore(null)}
        >
          <div className="restore-summary">
            <strong>{restore.exam}</strong>
            <span>
              {restore.subjects.length} disciplinas · {restore.sessions.length} sessões
            </span>
            <span>
              {restore.errors.length} erros · {restore.notes.length} anotações
            </span>
          </div>
          <p className="danger-box">
            Todos os registros atuais deste navegador serão substituídos, incluindo anexos. Exporte
            um backup dos dados atuais antes de continuar.
          </p>
          <button className="button small" onClick={backup}>
            <Download size={15} />
            Salvar backup atual
          </button>
          <div className="form-actions">
            <button className="button" onClick={() => setRestore(null)}>
              Cancelar
            </button>
            <button
              className="button primary"
              onClick={() => {
                setState(restore);
                setRestore(null);
                navigate('syllabus');
                notify('Backup restaurado.');
              }}
            >
              Substituir e restaurar
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
