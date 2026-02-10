import { Client } from '@notionhq/client';
import type { Logger } from '../utils/logger.js';

const DEFAULT_DELAY_MS = 350;

export interface NotionClientOptions {
  apiKey: string;
  dryRun?: boolean;
  delayMs?: number;
  logger: Logger;
}

export class NotionClientWrapper {
  public readonly client: Client;
  public readonly dryRun: boolean;
  private readonly delayMs: number;
  private readonly logger: Logger;
  private lastRequestTime = 0;

  constructor(options: NotionClientOptions) {
    this.client = new Client({ auth: options.apiKey });
    this.dryRun = options.dryRun ?? false;
    this.delayMs = options.delayMs ?? DEFAULT_DELAY_MS;
    this.logger = options.logger;
  }

  /**
   * Enforce rate limiting by waiting between requests.
   */
  async throttle(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.delayMs) {
      const wait = this.delayMs - elapsed;
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
    this.lastRequestTime = Date.now();
  }

  /**
   * Query a database with automatic throttling and pagination.
   */
  async queryDatabase(params: Parameters<Client['databases']['query']>[0]): Promise<any[]> {
    const allResults: any[] = [];
    let startCursor: string | undefined;
    let hasMore = true;

    while (hasMore) {
      await this.throttle();
      const response = await this.client.databases.query({
        ...params,
        start_cursor: startCursor,
      });
      allResults.push(...response.results);
      hasMore = response.has_more;
      startCursor = response.next_cursor ?? undefined;
    }

    return allResults;
  }

  /**
   * Retrieve a page with throttling.
   */
  async retrievePage(pageId: string): Promise<any> {
    await this.throttle();
    return this.client.pages.retrieve({ page_id: pageId });
  }

  /**
   * Get all block children for a block/page, handling pagination.
   */
  async getBlockChildren(blockId: string): Promise<any[]> {
    const allBlocks: any[] = [];
    let startCursor: string | undefined;
    let hasMore = true;

    while (hasMore) {
      await this.throttle();
      const response = await this.client.blocks.children.list({
        block_id: blockId,
        start_cursor: startCursor,
        page_size: 100,
      });
      allBlocks.push(...response.results);
      hasMore = response.has_more;
      startCursor = response.next_cursor ?? undefined;
    }

    return allBlocks;
  }

  /**
   * Create a page. Respects dry-run mode.
   */
  async createPage(params: Parameters<Client['pages']['create']>[0]): Promise<any> {
    if (this.dryRun) {
      this.logger.info('[DRY RUN] Would create page', { parent: (params as any).parent });
      return { id: 'dry-run-page-id', url: 'https://notion.so/dry-run' };
    }
    await this.throttle();
    return this.client.pages.create(params);
  }

  /**
   * Update a page. Respects dry-run mode.
   */
  async updatePage(params: Parameters<Client['pages']['update']>[0]): Promise<any> {
    if (this.dryRun) {
      this.logger.info('[DRY RUN] Would update page', { pageId: params.page_id });
      return {};
    }
    await this.throttle();
    return this.client.pages.update(params);
  }

  /**
   * Append block children. Respects dry-run mode.
   */
  async appendBlockChildren(
    blockId: string,
    children: any[],
  ): Promise<any> {
    if (this.dryRun) {
      this.logger.info('[DRY RUN] Would append blocks', {
        blockId,
        blockCount: children.length,
      });
      return {};
    }
    await this.throttle();
    return this.client.blocks.children.append({
      block_id: blockId,
      children,
    });
  }
}
