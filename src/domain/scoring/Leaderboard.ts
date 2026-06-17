import { LeaderboardEntry } from './LeaderboardEntry';

/**
 * Leaderboard aggregate for a single benchmark.
 *
 * Owns the ordered set of entries and the ranking rules. Ranking is by
 * `resolveRate` descending; `percentile` is the share of entries this one beats
 * or ties (top = 100, bottom = 0).
 */
export class Leaderboard {
  readonly benchmarkId: string;
  entries: LeaderboardEntry[];
  lastUpdated: Date;

  constructor(benchmarkId: string, entries: LeaderboardEntry[] = [], lastUpdated: Date = new Date()) {
    this.benchmarkId = benchmarkId;
    this.entries = entries;
    this.lastUpdated = lastUpdated;
  }

  /** Add (or replace, by agentId) an entry and re-rank. */
  addEntry(entry: LeaderboardEntry): void {
    this.entries = this.entries.filter((e) => e.agentId !== entry.agentId);
    this.entries.push(entry);
    this.computeRanks();
  }

  /**
   * Sort by resolveRate desc and assign 1-based ranks and percentiles.
   * Mutates entries in place and bumps `lastUpdated`.
   */
  computeRanks(): void {
    this.entries.sort((a, b) => b.resolveRate - a.resolveRate);

    const n = this.entries.length;
    this.entries.forEach((entry, index) => {
      entry.rank = index + 1;
      // Top entry => 100, bottom => 0. Single entry => 100.
      entry.percentile = n > 1 ? ((n - (index + 1)) / (n - 1)) * 100 : 100;
    });

    this.lastUpdated = new Date();
  }

  /** The top `n` entries by rank. */
  getTopN(n: number): LeaderboardEntry[] {
    return [...this.entries]
      .sort((a, b) => (a.rank ?? Number.MAX_SAFE_INTEGER) - (b.rank ?? Number.MAX_SAFE_INTEGER))
      .slice(0, n);
  }

  /** The entry for a given agent, if present. */
  getEntryForAgent(agentId: string): LeaderboardEntry | undefined {
    return this.entries.find((e) => e.agentId === agentId);
  }
}
