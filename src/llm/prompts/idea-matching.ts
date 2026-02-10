import type { IdeaWithContent } from '../../notion/types.js';

export function buildIdeaMatchingPrompt(params: {
  systemPrompt: string;
  frTitle: string;
  frContent: string;
  productInfo: string;
  ideaCandidates: IdeaWithContent[];
}): { system: string; user: string } {
  // Format idea docs as: ID - Title : Content
  const ideaDocs = params.ideaCandidates
    .map((i) => `${i.id} - ${i.title} : ${i.content || '(no content)'}`)
    .join('\n\n');

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
      `Potential project ideas (JSON):`,
      JSON.stringify(params.ideaCandidates, null, 2),
    ].join('\n'),
  };
}
