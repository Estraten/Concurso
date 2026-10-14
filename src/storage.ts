import DOMPurify from 'dompurify';
import { initialState, stateSchema, type State, type Note } from './model';

export function cleanNote(note: Note): Note {
  return {
    ...note,
    html: DOMPurify.sanitize(note.html, {
      ADD_ATTR: ['style'],
      FORBID_TAGS: ['style', 'iframe', 'object', 'embed'],
      FORBID_ATTR: ['srcdoc'],
    }),
  };
}
export function validateState(input: unknown): State {
  const state = stateSchema.parse(input);
  return { ...state, notes: state.notes.map(cleanNote) };
}
const database = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('aprova-studies', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('data');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
export async function loadState(): Promise<State> {
  const db = await database();
  try {
    const value = await new Promise<unknown>((resolve, reject) => {
      const transaction = db.transaction('data', 'readonly');
      const request = transaction.objectStore('data').get('state');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return value === undefined ? initialState() : validateState(value);
  } finally {
    db.close();
  }
}
export async function saveState(state: State) {
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction('data', 'readwrite');
      transaction.objectStore('data').put(state, 'state');
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
}
export function download(name: string, content: Blob) {
  const url = URL.createObjectURL(content);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function downloadAttachment(attachment: Note['attachments'][number]) {
  const binary = atob(attachment.data.split(',')[1]);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  download(attachment.name, new Blob([bytes], { type: attachment.type }));
}
