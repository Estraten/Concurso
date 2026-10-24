import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Check, ChevronDown, Plus, ShieldCheck } from 'lucide-react';
import { CONTEST_CATEGORIES, newContestSchema, type NewContest, type Workspace } from './contests';

export default function ContestSwitcher({
  workspace,
  onSelect,
  onCreate,
}: {
  workspace: Workspace;
  onSelect: (id: string) => void;
  onCreate: () => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null),
    trigger = useRef<HTMLButtonElement>(null),
    menu = useRef<HTMLDivElement>(null);
  const focusIntent = useRef<'selected' | 'first' | 'last'>('selected');
  const id = useId();
  const active = workspace.contests.find((contest) => contest.id === workspace.activeContestId)!;
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    const items = menu.current?.querySelectorAll<HTMLButtonElement>(
      '[role="menuitemradio"], [role="menuitem"]',
    );
    const selected = menu.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]');
    if (focusIntent.current === 'last') items?.[items.length - 1]?.focus();
    else if (focusIntent.current === 'first') items?.[0]?.focus();
    else selected?.focus();
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  function menuKeys(event: KeyboardEvent<HTMLDivElement>) {
    const items = [
      ...(menu.current?.querySelectorAll<HTMLButtonElement>(
        '[role="menuitemradio"], [role="menuitem"]',
      ) ?? []),
    ];
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      trigger.current?.focus();
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      items[(index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      items[event.key === 'Home' ? 0 : items.length - 1]?.focus();
    } else if (event.key === 'Tab') {
      setOpen(false);
      trigger.current?.focus();
    }
  }
  return (
    <div className="contest-control" ref={wrapper}>
      <button
        ref={trigger}
        id={`${id}-trigger`}
        className="exam-switcher"
        aria-label="Selecionar concurso"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={`${id}-menu`}
        title={active.data.exam}
        onClick={() => {
          focusIntent.current = 'selected';
          setOpen(!open);
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            focusIntent.current = event.key === 'ArrowDown' ? 'first' : 'last';
            setOpen(true);
          }
          if (event.key === 'Escape') setOpen(false);
        }}
      >
        <span className="exam-icon">
          <ShieldCheck size={20} />
        </span>
        <span>
          <small>MEU OBJETIVO</small>
          <strong>{active.data.exam.split('·')[0].trim()}</strong>
          <span>{active.data.exam.split('·').slice(1).join(' · ').trim() || active.category}</span>
        </span>
        <ChevronDown size={15} />
      </button>
      {open && (
        <div
          ref={menu}
          id={`${id}-menu`}
          className="contest-dropdown"
          role="menu"
          aria-labelledby={`${id}-trigger`}
          onKeyDown={menuKeys}
        >
          <div className="contest-dropdown-heading">
            MEUS CONCURSOS<span>{workspace.contests.length}</span>
          </div>
          <div className="contest-options">
            {workspace.contests.map((contest) => (
              <button
                type="button"
                key={contest.id}
                role="menuitemradio"
                aria-checked={contest.id === workspace.activeContestId}
                className={`contest-option ${contest.id === workspace.activeContestId ? 'selected' : ''}`}
                tabIndex={-1}
                onClick={() => {
                  setOpen(false);
                  onSelect(contest.id);
                  trigger.current?.focus();
                }}
              >
                <span className="contest-option-icon">
                  <ShieldCheck size={17} />
                </span>
                <span className="contest-option-text">
                  <strong>{contest.data.exam.split('·')[0].trim()}</strong>
                  {contest.data.exam.includes('·') && (
                    <span>{contest.data.exam.split('·').slice(1).join(' · ').trim()}</span>
                  )}
                  <small>{contest.category}</small>
                </span>
                {contest.id === workspace.activeContestId && <Check size={16} />}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="contest-create-item"
            role="menuitem"
            tabIndex={-1}
            onClick={() => {
              setOpen(false);
              onCreate();
            }}
          >
            <Plus size={17} />
            Criar novo concurso
          </button>
        </div>
      )}
    </div>
  );
}

export function NewContestForm({
  onSave,
  onClose,
  canCopy,
}: {
  onSave: (input: NewContest) => void;
  onClose: () => void;
  canCopy: boolean;
}) {
  const [error, setError] = useState('');
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const result = newContestSchema.safeParse({
          name: form.get('name'),
          role: form.get('role'),
          category: form.get('category'),
          copySyllabus: form.get('copySyllabus') === 'on',
        });
        if (!result.success) return setError(result.error.issues[0].message);
        try {
          onSave(result.data);
        } catch (cause) {
          setError((cause as Error).message);
        }
      }}
    >
      <label>
        Nome do concurso
        <input
          name="name"
          placeholder="Ex.: Polícia Federal, SEFAZ ou Tribunal de Justiça"
          maxLength={200}
          required
        />
      </label>
      <label>
        Cargo <span className="optional-field">(opcional)</span>
        <input
          name="role"
          placeholder="Ex.: Agente, Auditor ou Técnico Judiciário"
          maxLength={200}
        />
      </label>
      <label>
        Tipo de concurso
        <select name="category" aria-label="Tipo de concurso" defaultValue="" required>
          <option value="" disabled>
            Selecione uma área
          </option>
          {CONTEST_CATEGORIES.map((category) => (
            <option key={category}>{category}</option>
          ))}
        </select>
      </label>
      {canCopy && (
        <label className="check-label">
          <input name="copySyllabus" type="checkbox" />
          <span>Copiar disciplinas e tópicos do concurso atual, com progresso zerado.</span>
        </label>
      )}
      <div className="info-box">
        <ShieldCheck size={20} />
        <p>
          O novo concurso terá seus próprios ciclos, estudos, erros e anotações. Você poderá
          cadastrar ou importar o edital depois de criar.
        </p>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="form-actions">
        <button type="button" className="button" onClick={onClose}>
          Cancelar
        </button>
        <button type="submit" className="button primary">
          <Plus size={16} />
          Criar concurso
        </button>
      </div>
    </form>
  );
}
