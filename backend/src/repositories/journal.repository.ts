/**
 * journal.repository.ts — Prisma-backed repository for journal entries.
 * Keeps Prisma-specific query shapes out of the route handlers.
 */

import { PrismaClient, JournalEntry, MarketMode, SignalType, JournalResult } from "@prisma/client";

export interface CreateJournalEntryInput {
  userId: string;
  date: Date;
  pair: string;
  marketMode: MarketMode;
  direction: SignalType;
  entryPrice?: number;
  exitPrice?: number;
  stake?: number;
  result?: JournalResult;
  profit?: number;
  confidence?: number;
  durationSec?: number;
  notes?: string;
  emotion?: string;
  mistakes?: string;
  screenshotUrl?: string;
  indicatorSummary?: object;
}

export class JournalRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: CreateJournalEntryInput): Promise<JournalEntry> {
    return this.prisma.journalEntry.create({ data: input });
  }

  async findById(id: string, userId: string): Promise<JournalEntry | null> {
    return this.prisma.journalEntry.findFirst({ where: { id, userId } });
  }

  async listByUser(userId: string, opts: { from?: Date; to?: Date; pair?: string; limit?: number } = {}): Promise<JournalEntry[]> {
    return this.prisma.journalEntry.findMany({
      where: {
        userId,
        ...(opts.pair ? { pair: opts.pair } : {}),
        ...(opts.from || opts.to ? { date: { gte: opts.from, lte: opts.to } } : {}),
      },
      orderBy: { date: "desc" },
      take: opts.limit ?? 500,
    });
  }

  async update(id: string, userId: string, patch: Partial<CreateJournalEntryInput>): Promise<JournalEntry | null> {
    const existing = await this.findById(id, userId);
    if (!existing) return null;
    return this.prisma.journalEntry.update({ where: { id }, data: patch });
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const existing = await this.findById(id, userId);
    if (!existing) return false;
    await this.prisma.journalEntry.delete({ where: { id } });
    return true;
  }

  async bulkCreate(entries: CreateJournalEntryInput[]): Promise<number> {
    const result = await this.prisma.journalEntry.createMany({ data: entries });
    return result.count;
  }
}
