/**
 * watchlist.repository.ts — Prisma-backed repository for watchlist items.
 */

import { PrismaClient, WatchlistItem, MarketMode } from "@prisma/client";

export class WatchlistRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listByUser(userId: string): Promise<WatchlistItem[]> {
    return this.prisma.watchlistItem.findMany({
      where: { userId },
      orderBy: [{ isFavorite: "desc" }, { addedAt: "desc" }],
    });
  }

  async add(userId: string, pair: string, marketMode: MarketMode = "LIVE"): Promise<WatchlistItem> {
    return this.prisma.watchlistItem.upsert({
      where: { userId_pair_marketMode: { userId, pair, marketMode } },
      update: {},
      create: { userId, pair, marketMode },
    });
  }

  async remove(userId: string, pair: string, marketMode: MarketMode = "LIVE"): Promise<boolean> {
    try {
      await this.prisma.watchlistItem.delete({
        where: { userId_pair_marketMode: { userId, pair, marketMode } },
      });
      return true;
    } catch {
      return false; // not found — delete on a non-existent unique key throws in Prisma
    }
  }

  async toggleFavorite(userId: string, pair: string, marketMode: MarketMode = "LIVE"): Promise<WatchlistItem | null> {
    const existing = await this.prisma.watchlistItem.findUnique({
      where: { userId_pair_marketMode: { userId, pair, marketMode } },
    });
    if (!existing) return null;
    return this.prisma.watchlistItem.update({
      where: { userId_pair_marketMode: { userId, pair, marketMode } },
      data: { isFavorite: !existing.isFavorite },
    });
  }
}
