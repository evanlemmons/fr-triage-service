export function buildProductAlignmentPrompt(params: {
  systemPrompt: string;
  frTitle: string;
  frContent: string;
  productInfo: string;
}): { system: string; user: string } {
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
    ].join('\n'),
  };
}
