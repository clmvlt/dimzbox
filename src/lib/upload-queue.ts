import { CLIENT_CONFIG } from "./config.client";

// File d'upload côté navigateur :
// - plusieurs fichiers en parallèle (CLIENT_CONFIG.parallelUploads)
// - chaque fichier est envoyé par morceaux, l'offset serveur fait foi
// - coupure réseau, redémarrage serveur, 429/5xx : on attend et on reprend
//   exactement où on en était (aucun octet renvoyé inutilement)
// - après un rechargement de page, redéposer le même fichier reprend l'upload

export type UploadStatus =
  | "queued"
  | "uploading"
  | "retrying"
  | "done"
  | "error"
  | "canceled";

export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  createdAt: string;
}

export interface UploadTask {
  key: string;
  name: string;
  size: number;
  type: string;
  status: UploadStatus;
  /** Octets reçus par le serveur (+ en vol pour le morceau courant) */
  uploaded: number;
  /** Octets/s, lissé sur quelques secondes */
  speed: number;
  error: string | null;
  /** Timestamp de la prochaine tentative (statut "retrying") */
  retryAt: number | null;
  /** Durée totale de l'attente en cours, en ms */
  retryDelay: number;
  resumed: boolean;
  result: UploadedFile | null;
  /** Id de la session d'upload côté serveur */
  uploadId: string | null;
}

export interface PendingUpload {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  clientKey: string | null;
  offset: number;
  updatedAt: string;
}

interface ServerState {
  id: string;
  size: number;
  offset: number;
  completed: boolean;
  file?: UploadedFile;
}

interface Internal extends UploadTask {
  file: File;
  fingerprint: string;
  xhr: XMLHttpRequest | null;
  canceled: boolean;
  samples: { t: number; bytes: number }[];
  wake: (() => void) | null;
}

type QueueEvent =
  | { type: "uploaded"; file: UploadedFile; name: string }
  | { type: "failed"; name: string; error: string }
  | { type: "rejected"; name: string; reason: string }
  | { type: "drained"; succeeded: number; failed: number };

class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public body: Record<string, unknown> | null
  ) {
    super(message);
  }
}
class NetworkError extends Error {}
class CanceledError extends Error {}

const STALL_TIMEOUT = 60_000;
// Au-delà de 15 min d'échecs consécutifs (hors période hors-ligne), on abandonne
const GIVE_UP_AFTER = 15 * 60_000;
const RESUME_KEY = "dimzbox:resumable-uploads";
const RESUME_TTL = 48 * 60 * 60 * 1000;

// --- Mémoire des uploads résumables (survit au rechargement) --------------

type ResumeMap = Record<string, { id: string; savedAt: number }>;

function readResume(): ResumeMap {
  try {
    const raw = JSON.parse(localStorage.getItem(RESUME_KEY) ?? "{}") as ResumeMap;
    const now = Date.now();
    for (const [k, v] of Object.entries(raw)) {
      if (!v?.id || now - v.savedAt > RESUME_TTL) delete raw[k];
    }
    return raw;
  } catch {
    return {};
  }
}

function writeResume(map: ResumeMap) {
  try {
    localStorage.setItem(RESUME_KEY, JSON.stringify(map));
  } catch {
    // Stockage indisponible (navigation privée…) : pas de reprise après reload
  }
}

const resumeStore = {
  get: (fp: string) => readResume()[fp]?.id ?? null,
  set: (fp: string, id: string) => {
    const map = readResume();
    map[fp] = { id, savedAt: Date.now() };
    writeResume(map);
  },
  delete: (fp: string) => {
    const map = readResume();
    delete map[fp];
    writeResume(map);
  },
};

// --- Helpers ---------------------------------------------------------------

function fingerprint(file: File) {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function isOffline() {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

async function requestJson<T>(
  method: string,
  url: string,
  body?: unknown
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
  } catch {
    throw new NetworkError("Erreur réseau");
  }
  const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok) {
    throw new HttpError(
      res.status,
      (data?.error as string) || `Erreur ${res.status}`,
      data
    );
  }
  return data as T;
}

/** Erreurs qui valent la peine d'être réessayées plus tard. */
function isTransient(error: unknown) {
  if (error instanceof NetworkError) return true;
  if (error instanceof HttpError) {
    return error.status === 429 || error.status >= 500 || error.status === 408;
  }
  return false;
}

// --- La file -----------------------------------------------------------------

export class UploadQueue {
  private tasks: Internal[] = [];
  private snapshot: readonly UploadTask[] = [];
  private listeners = new Set<() => void>();
  private eventListeners = new Set<(e: QueueEvent) => void>();
  private chunkSize: number = CLIENT_CONFIG.chunkSize;
  private notifyTimer: ReturnType<typeof setTimeout> | null = null;
  private batch = { succeeded: 0, failed: 0 };
  private wakeLock: { release: () => Promise<void> } | null = null;
  private counter = 0;

  constructor() {
    window.addEventListener("online", () => {
      for (const t of this.tasks) t.wake?.();
    });
  }

  // --- API publique (useSyncExternalStore) ---

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = () => this.snapshot;

  on(listener: (e: QueueEvent) => void) {
    this.eventListeners.add(listener);
    return () => {
      this.eventListeners.delete(listener);
    };
  }

  get isBusy() {
    return this.tasks.some((t) => isActive(t.status));
  }

  add(files: File[]) {
    for (const file of files) {
      if (file.size > CLIENT_CONFIG.maxFileSize) {
        this.emit({ type: "rejected", name: file.name, reason: "trop volumineux (max 100 Go)" });
        continue;
      }
      const ext = file.name.includes(".")
        ? `.${file.name.split(".").pop()!.toLowerCase()}`
        : "";
      if (ext && CLIENT_CONFIG.blockedExtensions.includes(ext)) {
        this.emit({ type: "rejected", name: file.name, reason: "type de fichier non autorisé" });
        continue;
      }
      const fp = fingerprint(file);
      if (this.tasks.some((t) => t.fingerprint === fp && isActive(t.status))) {
        this.emit({ type: "rejected", name: file.name, reason: "déjà en cours d'envoi" });
        continue;
      }

      this.tasks.push({
        key: `u${++this.counter}`,
        name: file.name,
        size: file.size,
        type: file.type,
        status: "queued",
        uploaded: 0,
        speed: 0,
        error: null,
        retryAt: null,
        retryDelay: 0,
        resumed: false,
        result: null,
        file,
        fingerprint: fp,
        uploadId: null,
        xhr: null,
        canceled: false,
        samples: [],
        wake: null,
      });
    }
    this.pump();
    this.notify(true);
  }

  cancel(key: string) {
    const task = this.find(key);
    if (!task || !isActive(task.status)) return;
    task.canceled = true;
    task.xhr?.abort();
    task.wake?.();
    if (task.status === "queued") {
      task.status = "canceled";
      this.notify(true);
    }
  }

  retry(key: string) {
    const task = this.find(key);
    if (!task || (task.status !== "error" && task.status !== "canceled")) return;
    Object.assign(task, {
      status: "queued",
      error: null,
      canceled: false,
      retryAt: null,
      speed: 0,
      samples: [],
    });
    this.pump();
    this.notify(true);
  }

  /** Retire une ligne terminée / en erreur / annulée de la liste. */
  dismiss(key: string) {
    this.tasks = this.tasks.filter((t) => t.key !== key || isActive(t.status));
    this.notify(true);
  }

  clearFinished() {
    this.tasks = this.tasks.filter((t) => isActive(t.status) || t.status === "error");
    this.notify(true);
  }

  // --- Moteur ---

  private find(key: string) {
    return this.tasks.find((t) => t.key === key);
  }

  private emit(event: QueueEvent) {
    for (const l of this.eventListeners) l(event);
  }

  private pump() {
    let running = this.tasks.filter(
      (t) => t.status === "uploading" || t.status === "retrying"
    ).length;
    for (const task of this.tasks) {
      if (running >= CLIENT_CONFIG.parallelUploads) break;
      if (task.status === "queued") {
        running++;
        void this.run(task);
      }
    }
    this.updateWakeLock();
  }

  private async run(task: Internal) {
    task.status = "uploading";
    task.error = null;
    this.notify(true);

    try {
      const file = await this.upload(task);
      task.status = "done";
      task.uploaded = task.size;
      task.result = file;
      task.speed = 0;
      this.batch.succeeded++;
      this.emit({ type: "uploaded", file, name: task.name });
    } catch (error) {
      task.speed = 0;
      task.retryAt = null;
      if (task.canceled || error instanceof CanceledError) {
        task.status = "canceled";
        this.discardServerUpload(task);
      } else {
        task.status = "error";
        task.error = error instanceof Error ? error.message : "Erreur inconnue";
        this.batch.failed++;
        this.emit({ type: "failed", name: task.name, error: task.error });
      }
    } finally {
      task.xhr = null;
      this.pump();
      this.notify(true);
      if (!this.isBusy) {
        const { succeeded, failed } = this.batch;
        this.batch = { succeeded: 0, failed: 0 };
        if (succeeded + failed > 0) this.emit({ type: "drained", succeeded, failed });
      }
    }
  }

  private async upload(task: Internal): Promise<UploadedFile> {
    let state = await this.openSession(task);
    task.uploadId = state.id;
    task.uploaded = state.offset;
    task.resumed = state.offset > 0;
    this.notify();

    let failingSince: number | null = null;
    // Erreurs réseau alors que le serveur répond : fichier illisible côté client
    let unreadable = 0;

    while (!state.completed) {
      if (task.canceled) throw new CanceledError();

      const offset = state.offset;
      const end = Math.min(offset + this.chunkSize, task.size);

      try {
        state = await this.sendChunk(task, state.id, offset, task.file.slice(offset, end));
        failingSince = null;
        unreadable = 0;
        task.uploaded = state.offset;
        if (task.status === "retrying") {
          task.status = "uploading";
          task.retryAt = null;
        }
        continue;
      } catch (error) {
        if (task.canceled) throw new CanceledError();

        if (error instanceof HttpError) {
          const serverOffset = error.body?.offset;
          if (error.status === 409 && typeof serverOffset === "number") {
            // Désynchronisé : le serveur a déjà ces octets, on repart de son offset
            state = { ...state, offset: serverOffset };
            task.uploaded = serverOffset;
            continue;
          }
          if (error.status === 413 && this.chunkSize > CLIENT_CONFIG.minChunkSize) {
            // Un reverse proxy limite la taille des requêtes : morceaux plus petits
            this.chunkSize = Math.max(
              CLIENT_CONFIG.minChunkSize,
              Math.floor(this.chunkSize / 2)
            );
            if (typeof serverOffset === "number") state = { ...state, offset: serverOffset };
            continue;
          }
          if (error.status === 404) {
            resumeStore.delete(task.fingerprint);
            throw new Error("Upload introuvable sur le serveur (expiré ?) — relancez l'envoi");
          }
          const recoverable =
            isTransient(error) ||
            error.status === 409 || // morceau précédent encore en cours d'écriture
            (error.status === 400 && typeof serverOffset === "number"); // morceau coupé
          if (!recoverable) throw error;
        } else if (!(error instanceof NetworkError)) {
          throw error;
        }

        // Erreur temporaire : on patiente puis on se resynchronise sur le serveur.
        // Le temps passé hors-ligne ne compte pas dans le délai d'abandon.
        if (isOffline()) failingSince = Date.now();
        failingSince ??= Date.now();
        if (Date.now() - failingSince > GIVE_UP_AFTER) {
          throw new Error("Serveur injoignable depuis 15 min — cliquez sur Réessayer");
        }
        await this.backoff(task, Date.now() - failingSince);
        if (task.canceled) throw new CanceledError();

        try {
          const fresh = await requestJson<ServerState>("GET", `/api/upload/${state.id}`);
          if (error instanceof NetworkError && fresh.offset === state.offset) {
            // Le serveur répond mais aucun octet du morceau n'est arrivé :
            // un reverse proxy coupe peut-être les requêtes trop grosses,
            // sinon le fichier local n'est plus lisible.
            unreadable++;
            if (unreadable >= 2 && this.chunkSize > CLIENT_CONFIG.minChunkSize) {
              this.chunkSize = Math.max(
                CLIENT_CONFIG.minChunkSize,
                Math.floor(this.chunkSize / 2)
              );
              unreadable = 0;
            } else if (unreadable >= 5) {
              throw new Error("Impossible de lire le fichier (déplacé ou modifié ?)");
            }
          }
          state = fresh;
          task.uploaded = fresh.offset;
        } catch (syncError) {
          if (syncError instanceof HttpError && syncError.status === 404) {
            resumeStore.delete(task.fingerprint);
            throw new Error("Upload introuvable sur le serveur (expiré ?) — relancez l'envoi");
          }
          if (syncError instanceof Error && syncError.message.startsWith("Impossible de lire")) {
            throw syncError;
          }
          // Serveur toujours injoignable : on retentera au tour suivant
        }
      }
    }

    resumeStore.delete(task.fingerprint);
    if (!state.file) throw new Error("Réponse serveur incomplète");
    return state.file;
  }

  /** Reprend un upload précédent du même fichier, sinon en crée un nouveau. */
  private async openSession(task: Internal): Promise<ServerState> {
    const previous =
      task.uploadId ??
      resumeStore.get(task.fingerprint) ??
      (await this.findPendingOnServer(task.fingerprint));
    if (previous) {
      try {
        return await this.withRetry(task, () =>
          requestJson<ServerState>("GET", `/api/upload/${previous}`)
        );
      } catch (error) {
        if (!(error instanceof HttpError) || error.status >= 500) throw error;
        resumeStore.delete(task.fingerprint);
        task.uploadId = null;
      }
    }

    const state = await this.withRetry(task, () =>
      requestJson<ServerState>("POST", "/api/upload", {
        name: task.name,
        size: task.size,
        type: task.type,
        clientKey: task.fingerprint,
      })
    );
    if (!state.completed) resumeStore.set(task.fingerprint, state.id);
    return state;
  }

  private pendingCache: { at: number; list: Promise<PendingUpload[]> } | null = null;

  /** Upload inachevé du même fichier côté serveur (autre onglet, cache vidé…). */
  private async findPendingOnServer(fp: string): Promise<string | null> {
    if (!this.pendingCache || Date.now() - this.pendingCache.at > 10_000) {
      this.pendingCache = {
        at: Date.now(),
        list: requestJson<PendingUpload[]>("GET", "/api/upload").catch(() => []),
      };
    }
    const list = await this.pendingCache.list;
    return list.find((u) => u.clientKey === fp)?.id ?? null;
  }

  private async withRetry<T>(task: Internal, fn: () => Promise<T>): Promise<T> {
    const since = Date.now();
    for (;;) {
      if (task.canceled) throw new CanceledError();
      try {
        const result = await fn();
        if (task.status === "retrying") task.status = "uploading";
        task.retryAt = null;
        return result;
      } catch (error) {
        if (!isTransient(error)) throw error;
        if (!isOffline() && Date.now() - since > GIVE_UP_AFTER) throw error;
        await this.backoff(task, Date.now() - since);
      }
    }
  }

  /** Attente exponentielle (1 s → 15 s), écourtée au retour du réseau. */
  private async backoff(task: Internal, failingFor: number) {
    const delay = isOffline()
      ? 30_000
      : Math.min(15_000, 1000 * 2 ** Math.floor(failingFor / 5000));
    task.status = "retrying";
    task.retryAt = Date.now() + delay;
    task.retryDelay = delay;
    task.speed = 0;
    task.samples = [];
    this.notify(true);

    await new Promise<void>((resolve) => {
      const timer = setTimeout(done, delay);
      function done() {
        clearTimeout(timer);
        task.wake = null;
        resolve();
      }
      task.wake = done;
    });
  }

  private sendChunk(
    task: Internal,
    id: string,
    offset: number,
    blob: Blob
  ): Promise<ServerState> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      task.xhr = xhr;
      let lastActivity = Date.now();
      let stalled = false;

      const watchdog = setInterval(() => {
        if (Date.now() - lastActivity > STALL_TIMEOUT) {
          stalled = true;
          xhr.abort();
        }
      }, 5000);
      const cleanup = () => {
        clearInterval(watchdog);
        task.xhr = null;
      };

      xhr.open("PUT", `/api/upload/${id}`);
      xhr.setRequestHeader("Upload-Offset", String(offset));
      xhr.setRequestHeader("Content-Type", "application/octet-stream");

      xhr.upload.onprogress = (e) => {
        lastActivity = Date.now();
        task.uploaded = offset + e.loaded;
        this.sample(task);
        this.notify();
      };

      xhr.onload = () => {
        cleanup();
        let body: Record<string, unknown> | null = null;
        try {
          body = JSON.parse(xhr.responseText);
        } catch {
          // Réponse non JSON (page d'erreur d'un reverse proxy…)
        }
        if (xhr.status >= 200 && xhr.status < 300) {
          if (body && typeof body.offset === "number") {
            resolve(body as unknown as ServerState);
          } else {
            // 200 inattendu (portail captif, page d'un proxy…) : on réessaiera
            reject(new HttpError(502, "Réponse serveur invalide", null));
          }
        } else {
          reject(
            new HttpError(
              xhr.status,
              (body?.error as string) || `Erreur ${xhr.status}`,
              body
            )
          );
        }
      };
      xhr.onerror = () => {
        cleanup();
        reject(new NetworkError("Erreur réseau"));
      };
      xhr.onabort = () => {
        cleanup();
        reject(stalled ? new NetworkError("Connexion bloquée") : new CanceledError());
      };

      xhr.send(blob);
    });
  }

  private discardServerUpload(task: Internal) {
    resumeStore.delete(task.fingerprint);
    const id = task.uploadId;
    task.uploadId = null;
    if (!id) return;
    // Le serveur peut encore terminer l'écriture du morceau interrompu (409)
    void (async () => {
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          await requestJson("DELETE", `/api/upload/${id}`);
          return;
        } catch {
          await sleep(1000 * (attempt + 1));
        }
      }
    })();
  }

  private sample(task: Internal) {
    const now = Date.now();
    task.samples.push({ t: now, bytes: task.uploaded });
    while (task.samples.length > 2 && now - task.samples[0].t > 5000) {
      task.samples.shift();
    }
    const first = task.samples[0];
    const elapsed = (now - first.t) / 1000;
    if (elapsed >= 0.5) {
      task.speed = Math.max(0, (task.uploaded - first.bytes) / elapsed);
    }
  }

  private notify(immediate = false) {
    if (immediate) {
      if (this.notifyTimer) clearTimeout(this.notifyTimer);
      this.notifyTimer = null;
      this.flush();
      return;
    }
    if (this.notifyTimer) return;
    this.notifyTimer = setTimeout(() => {
      this.notifyTimer = null;
      this.flush();
    }, 150);
  }

  private flush() {
    this.snapshot = this.tasks.map((t) => ({
      key: t.key,
      name: t.name,
      size: t.size,
      type: t.type,
      status: t.status,
      uploaded: t.uploaded,
      speed: t.speed,
      error: t.error,
      retryAt: t.retryAt,
      retryDelay: t.retryDelay,
      resumed: t.resumed,
      result: t.result,
      uploadId: t.uploadId,
    }));
    for (const l of this.listeners) l();
  }

  /** Empêche l'écran (et donc souvent le réseau) de se mettre en veille. */
  private async updateWakeLock() {
    const nav = navigator as Navigator & {
      wakeLock?: { request: (type: "screen") => Promise<{ release: () => Promise<void> }> };
    };
    try {
      if (this.isBusy && !this.wakeLock && nav.wakeLock) {
        this.wakeLock = await nav.wakeLock.request("screen");
      } else if (!this.isBusy && this.wakeLock) {
        const lock = this.wakeLock;
        this.wakeLock = null;
        await lock.release();
      }
    } catch {
      // Non supporté / refusé : sans importance
    }
  }
}

export function isActive(status: UploadStatus) {
  return status === "queued" || status === "uploading" || status === "retrying";
}

let instance: UploadQueue | null = null;

/** Instance unique pour la page (survit aux re-montages React). */
export function getUploadQueue() {
  instance ??= new UploadQueue();
  return instance;
}
