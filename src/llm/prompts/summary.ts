/**
 * Product name → Slack custom emoji mapping.
 * These are custom emoji in the Planning Center Slack workspace.
 */
const PRODUCT_EMOJI: Record<string, string> = {
  'Accounts': ':accounts:',
  'Calendar': ':calendar:',
  'Check-Ins': ':check-ins:',
  'Church Center': ':church-center:',
  'Giving': ':giving:',
  'Groups': ':groups:',
  'Home': ':home:',
  'Music Stand': ':music-stand:',
  'People': ':people:',
  'Publishing': ':publishing:',
  'Registrations': ':registrations:',
  'Services': ':services:',
};

/**
 * Default system prompt for generating the Slack audit summary.
 * This is used when the product config doesn't specify a custom summary prompt.
 */
const DEFAULT_SUMMARY_SYSTEM_PROMPT = `You are an assistant helping a product manager review a completed feature request triage audit. The deliverable is a Slack message using Slack mrkdwn formatting.

You will be given:
- The product name and its Slack emoji code
- The audit page URL (for linking in Slack)
- The full audit content as plain text

You MUST:
1) Analyze the audit content
2) Produce a concise Slack-ready report exactly in the required output format

Linking rules:
- The output MUST include a clickable link to the audit page using Slack mrkdwn: <URL|text>
- For each FR in "Needs Attention", use the FR URLs provided above to create clickable links
- Format: <FR_URL|FR: Title> — [icon] Reason
- IMPORTANT: Always use the URL provided in the "FR URLs" section for the matching FR title

"Needs attention" criteria (flag an FR if ANY apply):
- Product misalignment: Verdict does not match current product OR verdict is "Uncertain"
- No Pulse matches found for an FR that belongs to this product
- No Idea matches found for an FR that belongs to this product

Status icons for needs-attention reasons:
- 🤷 = Product misalignment (FR doesn't belong to this product)
- 🩺 = No Pulse match found
- 💡 = No Idea match found
- Use multiple icons if an FR has multiple issues (e.g., "🩺💡" for no pulse AND no idea)

Rules:
- Do not invent data. Use only what appears in the audit content
- Keep it short and skimmable for Slack
- Use Slack mrkdwn only: bold headings with *text*, bullet lists with •, and Slack links as <url|text>
- If a FR Notion URL is available, use it in the link; otherwise just show the title without a link
- IMPORTANT: Flag product misalignment AND missing matches (no Pulse or no Idea) in the "Needs Attention" section. Low confidence is NOT flagged — matches below threshold are simply excluded
- Do NOT create a separate "Misaligned FRs" section

OUTPUT FORMAT (must match exactly):

[PRODUCT_EMOJI] *[PRODUCT_NAME]*
*Audit:* <AUDIT_URL|View audit page>

*Summary*
• FRs reviewed: X
• FRs needing attention: X

*Needs Attention*
• <FR_URL|FR: Title> — 🤷 Misaligned (suggested: [product])
• <FR_URL|FR: Title> — 🩺 No pulse match
• <FR_URL|FR: Title> — 🩺💡 No pulse or idea match
• <FR_URL|FR: Title> — 💡 No idea match

(If no FRs need attention, just say "✅ All FRs processed successfully")

OUTPUT RULES:
- You MUST return valid JSON with a single "summary" field containing the Slack message
- The summary field should contain the formatted Slack mrkdwn text exactly as specified above
- Example: {"summary": ":services: *Services*\\n*Audit:* <url|View audit page>\\n\\n*Summary*\\n• FRs reviewed: 5\\n..."}
- Escape all special characters properly for JSON
- Use \\n for newlines within the JSON string`;

export function buildSummaryPrompt(params: {
  systemPrompt?: string;
  productName: string;
  auditPageUrl: string;
  auditContent: string;
  frData: Array<{ title: string; url: string }>;
}): { system: string; user: string } {
  const emoji = PRODUCT_EMOJI[params.productName] ?? `:${params.productName.toLowerCase().replace(/\s+/g, '-')}:`;

  return {
    system: params.systemPrompt ?? DEFAULT_SUMMARY_SYSTEM_PROMPT,
    user: [
      `Product: ${params.productName}`,
      `Product Slack emoji: ${emoji}`,
      `Audit Notion page URL: ${params.auditPageUrl}`,
      ``,
      `FR URLs (for linking in Slack):`,
      ...params.frData.map(fr => `- "${fr.title}": ${fr.url}`),
      ``,
      `Full audit page content:`,
      params.auditContent,
      ``,
      `Produce the Slack-ready report exactly in the required output format.`,
    ].join('\n'),
  };
}
