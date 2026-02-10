import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import type { z } from 'zod';
import { LLMError } from '../utils/errors.js';
import type { Logger } from '../utils/logger.js';

export type LLMProvider = 'anthropic' | 'openai';

export interface LLMClientOptions {
  provider: LLMProvider;
  apiKey: string;
  model: string;
  logger: Logger;
}

export interface CompletionOptions<T> {
  systemPrompt: string;
  userMessage: string;
  responseSchema: z.ZodSchema<T>;
  schemaName: string;
}

export class LLMClient {
  private readonly provider: LLMProvider;
  private readonly model: string;
  private readonly logger: Logger;
  private readonly anthropic?: Anthropic;
  private readonly openai?: OpenAI;

  constructor(options: LLMClientOptions) {
    this.provider = options.provider;
    this.model = options.model;
    this.logger = options.logger;

    if (options.provider === 'anthropic') {
      this.anthropic = new Anthropic({ apiKey: options.apiKey });
    } else {
      this.openai = new OpenAI({ apiKey: options.apiKey });
    }
  }

  /**
   * Send a prompt and get a structured JSON response validated against a schema.
   * Retries once on parse failure.
   */
  async complete<T>(options: CompletionOptions<T>): Promise<T> {
    const { systemPrompt, userMessage, responseSchema, schemaName } = options;

    this.logger.debug(`LLM call: ${schemaName}`, {
      provider: this.provider,
      model: this.model,
      systemLength: systemPrompt.length,
      userLength: userMessage.length,
    });

    let rawText: string;
    try {
      rawText = await this.getRawCompletion(systemPrompt, userMessage);
    } catch (err) {
      throw new LLMError(`LLM call failed for ${schemaName}: ${err}`, {
        schemaName,
        provider: this.provider,
      });
    }

    // Parse and validate the response
    const parsed = this.parseJSON(rawText, schemaName);
    const result = responseSchema.safeParse(parsed);

    if (result.success) {
      return result.data;
    }

    // Retry once with error feedback
    this.logger.warn(`LLM response validation failed for ${schemaName}, retrying`, {
      errors: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
    });

    try {
      const retryMessage = `${userMessage}\n\nIMPORTANT: Your previous response had validation errors:\n${result.error.issues.map((i) => `- ${i.path.join('.')}: ${i.message}`).join('\n')}\n\nPlease fix these issues and return valid JSON.`;
      const retryText = await this.getRawCompletion(systemPrompt, retryMessage);
      const retryParsed = this.parseJSON(retryText, schemaName);
      const retryResult = responseSchema.safeParse(retryParsed);

      if (retryResult.success) {
        return retryResult.data;
      }

      throw new LLMError(
        `LLM response validation failed after retry for ${schemaName}`,
        { schemaName, errors: retryResult.error.issues },
      );
    } catch (err) {
      if (err instanceof LLMError) throw err;
      throw new LLMError(`LLM retry failed for ${schemaName}: ${err}`, { schemaName });
    }
  }

  private async getRawCompletion(systemPrompt: string, userMessage: string): Promise<string> {
    if (this.provider === 'anthropic' && this.anthropic) {
      const response = await this.anthropic.messages.create({
        model: this.model,
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      });

      const textBlock = response.content.find((b) => b.type === 'text');
      if (!textBlock || textBlock.type !== 'text') {
        throw new LLMError('No text block in Anthropic response');
      }
      return textBlock.text;
    }

    if (this.provider === 'openai' && this.openai) {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
      });

      return response.choices[0]?.message?.content ?? '';
    }

    throw new LLMError(`Unknown LLM provider: ${this.provider}`);
  }

  private parseJSON(text: string, context: string): unknown {
    // Try to extract JSON from the response (handles markdown code blocks)
    let jsonStr = text.trim();

    // Strip markdown code fences if present
    const jsonMatch = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    try {
      return JSON.parse(jsonStr);
    } catch {
      throw new LLMError(`Failed to parse LLM response as JSON for ${context}`, {
        context,
        responsePreview: jsonStr.slice(0, 200),
      });
    }
  }
}
