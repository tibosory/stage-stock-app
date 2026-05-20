import type { EnhancedResult } from './AIService';
import type { StructuredQuery } from '../../core/stock/stockEngine';

type Runner = (input: string, base: StructuredQuery) => Promise<EnhancedResult | null>;

type QueueJob = {
  id: number;
  input: string;
  base: StructuredQuery;
  debounceMs: number;
  onDone: (id: number, value: EnhancedResult | null) => void;
  onError?: (id: number, error: unknown) => void;
};

/**
 * Worker léger côté app:
 * - debounce des requêtes IA
 * - annulation logique (ignore les anciennes réponses)
 * - exécution séquentielle (1 requête active max)
 */
export class AIWorkerQueue {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private currentId = 0;
  private activeId = 0;
  private running = false;
  private pending: QueueJob | null = null;

  constructor(private readonly runner: Runner) {}

  enqueue(input: string, base: StructuredQuery, debounceMs: number, onDone: QueueJob['onDone'], onError?: QueueJob['onError']) {
    this.currentId += 1;
    const id = this.currentId;
    this.pending = { id, input, base, debounceMs, onDone, onError };
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      void this.runLatest();
    }, debounceMs);
    return id;
  }

  cancelAll() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.pending = null;
    this.activeId = this.currentId + 1;
  }

  private async runLatest() {
    if (this.running || !this.pending) return;
    const job = this.pending;
    this.pending = null;
    this.running = true;
    this.activeId = job.id;
    try {
      const value = await this.runner(job.input, job.base);
      if (job.id === this.activeId) job.onDone(job.id, value);
    } catch (e) {
      if (job.id === this.activeId) job.onError?.(job.id, e);
    } finally {
      this.running = false;
      if (this.pending) {
        void this.runLatest();
      }
    }
  }
}
