import { WebClient } from '@slack/web-api';
import type { SlackNotificationConfig } from '../config/types.js';
import type { Logger } from '../utils/logger.js';

let slackClient: WebClient | null = null;

function getSlackClient(): WebClient {
  if (!slackClient) {
    const token = process.env.SLACK_BOT_TOKEN;
    if (!token) {
      throw new Error('SLACK_BOT_TOKEN environment variable is required');
    }
    slackClient = new WebClient(token);
  }
  return slackClient;
}

/**
 * Send a message to a Slack user (DM) or channel.
 */
export async function sendSlackMessage(
  config: SlackNotificationConfig,
  text: string,
  logger: Logger,
  dryRun: boolean,
): Promise<void> {
  if (!config.enabled) {
    logger.debug('Slack notifications disabled, skipping');
    return;
  }

  if (dryRun) {
    logger.info('[DRY RUN] Would send Slack message', {
      target: config.summaryTarget,
      textLength: text.length,
    });
    logger.info('[DRY RUN] Message content:', { message: text });
    return;
  }

  const client = getSlackClient();
  const { type, id } = config.summaryTarget;

  if (type === 'user') {
    await client.chat.postMessage({
      channel: id,
      text,
    });
  } else {
    await client.chat.postMessage({
      channel: id,
      text,
    });
  }

  logger.info('Slack message sent', { target: config.summaryTarget });
}

/**
 * Send the "No new FRs" notification.
 */
export async function sendNoFrsMessage(
  config: SlackNotificationConfig,
  logger: Logger,
  dryRun: boolean,
): Promise<void> {
  const channelId = config.noFrsChannelId ?? config.summaryTarget.id;

  if (dryRun) {
    logger.info('[DRY RUN] Would send "No new FRs" message', { channelId });
    return;
  }

  if (!config.enabled) return;

  const client = getSlackClient();
  await client.chat.postMessage({
    channel: channelId,
    text: 'No new FRs to process!',
  });

  logger.info('Sent "No new FRs" message', { channelId });
}

/**
 * Send an error notification to Slack.
 * Uses errorTarget if configured, falls back to summaryTarget.
 */
export async function sendErrorNotification(
  config: SlackNotificationConfig,
  errorMessage: string,
  repoUrl: string,
  logger: Logger,
): Promise<void> {
  if (!config.enabled) {
    logger.debug('Slack notifications disabled, skipping error notification');
    return;
  }

  const client = getSlackClient();
  const target = config.errorTarget ?? config.summaryTarget;

  const text = `:rotating_light: *FR Triage Service Error*\n\n${errorMessage}\n\n<${repoUrl}|View GitHub Repository>`;

  try {
    await client.chat.postMessage({
      channel: target.id,
      text,
    });
    logger.info('Slack error notification sent', { target });
  } catch (err) {
    logger.error(`Failed to send Slack error notification: ${err}`);
    // Don't throw - we don't want Slack failures to mask the original error
  }
}
