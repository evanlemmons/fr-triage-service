import type { IdeaTitle } from '../../notion/types.js';

export function buildIdeaShortlistPrompt(params: {
  systemPrompt: string;
  frTitle: string;
  frContent: string;
  productInfo: string;
  ideaTitles: IdeaTitle[];
}): { system: string; user: string } {
  const ideaJson = JSON.stringify(
    params.ideaTitles.map((i) => ({ id: i.id, title: i.title })),
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
      `Idea candidates (JSON array of {id,title}):`,
      ideaJson,
    ].join('\n'),
  };
}
