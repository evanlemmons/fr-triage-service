import type { PulseItem } from '../../notion/types.js';

export function buildPulseMatchingPrompt(params: {
  systemPrompt: string;
  frTitle: string;
  frContent: string;
  productInfo: string;
  pulseData: PulseItem[];
}): { system: string; user: string } {
  const pulseJson = JSON.stringify(
    params.pulseData.map((p) => ({
      PulseID: p.id,
      PulseTitle: p.title,
      PulseContent: p.content,
    })),
    null,
    2,
  );

  return {
    system: params.systemPrompt,
    user: [
      `Feature request title:`,
      params.frTitle,
      ``,
      `Feature request content:`,
      params.frContent,
      ``,
      `Product information:`,
      params.productInfo,
      ``,
      `All available pulse items (JSON):`,
      pulseJson,
    ].join('\n'),
  };
}
