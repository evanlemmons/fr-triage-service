import { parseArgs } from 'node:util';
import { loadProductConfig, listAvailableProducts } from './config/loader.js';
import { runTriage } from './pipeline/orchestrator.js';
import { createLogger } from './utils/logger.js';

const FR_DATABASE_ID = 'cf945aaf-4235-4717-9fb9-71717fa0844f';

async function main() {
  const { values } = parseArgs({
    options: {
      product: { type: 'string', short: 'p', default: 'home' },
      'dry-run': { type: 'boolean', default: false },
      'write-audit': { type: 'boolean', default: false },
      'test-slack': { type: 'boolean', default: false },
      backtest: { type: 'boolean', default: false },
      'backtest-days': { type: 'string', default: '7' },
      verbose: { type: 'boolean', short: 'v', default: false },
      'list-products': { type: 'boolean', default: false },
    },
    strict: true,
  });

  const verbose = values.verbose || process.env.VERBOSE === 'true';
  const backtest = values.backtest || process.env.BACKTEST === 'true';
  const backtestDays = parseInt(values['backtest-days'] ?? '7', 10);
  const testSlack = values['test-slack'] || process.env.TEST_SLACK === 'true';
  // Backtest always implies dry-run — it should never modify FR properties
  const dryRun = backtest || values['dry-run'] || process.env.DRY_RUN === 'true';
  // Backtest implies write-audit so you can review in Notion
  const writeAudit = backtest || values['write-audit'] || process.env.WRITE_AUDIT === 'true';
  const logger = createLogger(verbose);

  if (backtest) {
    logger.info(`BACKTEST MODE: Re-processing last ${backtestDays} days of FRs (audit page will be created, FR properties untouched)`);
  } else if (dryRun && writeAudit) {
    logger.info('DRY RUN with audit: audit page will be created in Notion, FR properties untouched');
  } else if (dryRun) {
    logger.info('DRY RUN: no Notion writes at all (use --write-audit to create audit page)');
  }

  if (testSlack) {
    logger.info('TEST SLACK MODE: Slack notification will be sent even in dry-run mode');
  }

  // List available products and exit
  if (values['list-products']) {
    const products = await listAvailableProducts();
    console.log('Available products:');
    for (const p of products) {
      console.log(`  - ${p}`);
    }
    return;
  }

  const productName = values.product!;

  // Handle "all" product mode
  const productNames = productName === 'all'
    ? await listAvailableProducts()
    : [productName];

  for (const name of productNames) {
    logger.info(`\n${'='.repeat(60)}`);
    logger.info(`Starting triage for product: ${name}`);
    logger.info(`${'='.repeat(60)}`);

    try {
      const config = await loadProductConfig(name);
      const batchSize = config.matching.batchSize ?? 25;

      // Import query functions and Notion client to query all FRs upfront
      const { queryUnprocessedFRs, queryRecentFRs } = await import('./notion/queries.js');
      const { NotionClientWrapper } = await import('./notion/client.js');

      const notionClient = new NotionClientWrapper({
        apiKey: process.env.NOTION_API_KEY!,
        dryRun: false, // Need to query real data
        logger,
      });

      // Query ALL unprocessed FRs for this product
      let allFRs;
      if (backtest) {
        logger.info(`[BACKTEST] Querying last ${backtestDays} days of FRs (any status)`);
        allFRs = await queryRecentFRs(
          notionClient,
          FR_DATABASE_ID,
          config.product.selectValue,
          backtestDays,
        );
      } else {
        logger.info(`Querying unprocessed FRs for product: ${name}`);
        allFRs = await queryUnprocessedFRs(
          notionClient,
          FR_DATABASE_ID,
          config.product.selectValue,
        );
      }

      if (allFRs.length === 0) {
        logger.info(`No unprocessed FRs for ${name}.`);
        continue;
      }

      // Split into batches
      const batches = [];
      for (let i = 0; i < allFRs.length; i += batchSize) {
        batches.push(allFRs.slice(i, i + batchSize));
      }

      logger.info(`Found ${allFRs.length} FRs, processing in ${batches.length} batch(es) of up to ${batchSize} FRs each`);

      // Process each batch
      let totalProcessed = 0;
      let totalErrors = 0;

      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        const batchLabel = batches.length > 1 ? ` (Batch ${batchIndex + 1}/${batches.length})` : '';

        logger.info(`\n${'─'.repeat(60)}`);
        logger.info(`Processing batch ${batchIndex + 1}/${batches.length}: ${batch.length} FRs${batchLabel}`);
        logger.info(`${'─'.repeat(60)}`);

        try {
          const result = await runTriage(
            {
              product: config,
              frDatabaseId: FR_DATABASE_ID,
              dryRun,
              writeAudit,
              testSlack,
              verbose,
              backtest,
              backtestDays,
              batchInfo: batches.length > 1 ? {
                current: batchIndex + 1,
                total: batches.length,
              } : undefined,
              preQueriedFRs: batch,
            },
            logger,
          );

          if (result.status === 'complete') {
            logger.info(`Batch ${batchIndex + 1}/${batches.length} complete. Processed ${result.frCount} FRs.`);
            totalProcessed += result.frCount;
          } else if (result.status === 'error') {
            logger.warn(`Batch ${batchIndex + 1}/${batches.length} completed with errors.`);
            totalErrors++;
            totalProcessed += result.frCount;
          }
        } catch (err) {
          logger.error(`Batch ${batchIndex + 1}/${batches.length} failed: ${err}`);
          totalErrors++;

          // Send error notification for batch failure
          try {
            const { sendErrorNotification } = await import('./notifications/slack.js');
            const repoUrl = 'https://github.com/evanlemmons/fr-triage-service';
            await sendErrorNotification(
              config.notifications.slack,
              `Batch ${batchIndex + 1}/${batches.length} failed for product "${name}": ${err}`,
              repoUrl,
              logger,
            );
          } catch (slackErr) {
            logger.error(`Failed to send error notification: ${slackErr}`);
          }

          // Continue with next batch even if this one fails
        }

        // Add delay between batches to avoid rate limits (except for last batch)
        if (batchIndex < batches.length - 1) {
          logger.info('Waiting 5 seconds before next batch...');
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }

      logger.info(`\nTriage complete for ${name}. Processed ${totalProcessed} FRs across ${batches.length} batch(es).`);
      if (totalErrors > 0) {
        logger.warn(`${totalErrors} batch(es) had errors.`);
      }

    } catch (err) {
      logger.error(`Triage failed for ${name}: ${err}`);

      // Send Slack error notification
      try {
        const { sendErrorNotification } = await import('./notifications/slack.js');
        const repoUrl = 'https://github.com/evanlemmons/fr-triage-service';
        const config = await loadProductConfig(name);
        await sendErrorNotification(
          config.notifications.slack,
          `Triage failed for product "${name}": ${err}`,
          repoUrl,
          logger,
        );
      } catch (slackErr) {
        logger.error(`Failed to send error notification: ${slackErr}`);
      }

      if (productNames.length === 1) {
        process.exit(1);
      }
      // Continue with other products if running "all"
    }
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
