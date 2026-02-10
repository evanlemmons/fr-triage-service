# FR Triage Service

Automated feature request triage for Planning Center. Replaces the n8n "Feature Request Triage 2.0" workflow with a config-driven GitHub Actions service that's easy to extend to new products.

## How It Works

On a daily schedule (or manual trigger), the service:

1. **Queries** unprocessed feature requests from Notion for a given product
2. **Checks product alignment** — LLM determines if the FR actually belongs to this product
3. **Matches to Pulse items** — LLM links the FR to active strategic themes
4. **Matches to Ideas** — two-phase approach: title-based shortlist, then full-content matching
5. **Updates Notion** — sets FR relation fields and writes a detailed audit page
6. **Sends a Slack summary** — LLM-generated report highlighting items needing attention

All triage happens in Notion. No GitHub issues are created.

## Adding a New Product

1. Copy `src/products/_template.yml` to `src/products/{product-name}.yml`
2. Fill in the product page ID, product info page ID, and database IDs
3. Write a product-specific alignment prompt (model after `home.yml` or `people.yml`)
4. Commit and push to GitHub
5. Test via GitHub Actions with `--write-audit` flag
6. Review audit pages in Notion to validate configuration

## Usage

**⚠️ NEVER RUN THESE COMMANDS LOCALLY IN PRODUCTION**

These commands require production API credentials and will write to production databases. **ALWAYS trigger via GitHub Actions** for testing and production runs.

**Command reference** (for GitHub Actions workflow configuration only):

```bash
# Dry run — console output only, no Notion writes at all
npx tsx src/index.ts --product home --dry-run

# Write audit — creates audit page in Notion but doesn't touch FR properties (RECOMMENDED FOR TESTING)
npx tsx src/index.ts --product home --write-audit

# Triage Home product (live) — updates FR relations
npx tsx src/index.ts --product home

# Triage People product (live)
npx tsx src/index.ts --product people

# Triage all configured products
npx tsx src/index.ts --product all

# List available products
npx tsx src/index.ts --list-products

# Backtest: re-process last 7 days of FRs regardless of status
npx tsx src/index.ts --product home --backtest --backtest-days 7
```

**To test changes:**
1. Make code/config changes locally
2. Commit and push to GitHub
3. Go to https://github.com/evanlemmons/fr-triage-service/actions
4. Trigger "Feature Request Triage" workflow manually
5. Select product, enable `--write-audit` flag
6. Monitor execution and review audit pages in Notion

### Test Modes (via GitHub Actions)

**All testing must be done via GitHub Actions.** Do not run locally with production credentials.

| Mode | Audit page created? | FR relations updated? | Use case |
|------|--------------------|-----------------------|----------|
| `--dry-run` | No | No | Validation only, logs to console |
| `--write-audit` | Yes | No | **Recommended for testing** - Review audit in Notion without touching FRs |
| `--backtest` | Yes | No | Compare against n8n using already-processed FRs |
| (no flags) | Yes | Yes | **Production mode** - Full triage with FR updates |

### Backtest Mode

Use `--backtest` to compare the new service against n8n's existing results. It queries all FRs from the last N days for a product regardless of their current status, then runs the full triage pipeline with audit page creation enabled. FR relation properties are never modified. This lets you review exactly how the service would classify and match FRs that n8n already processed, side-by-side in Notion.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NOTION_API_KEY` | Yes | Notion integration token |
| `LLM_API_KEY` | Yes | Anthropic (or OpenAI) API key |
| `SLACK_BOT_TOKEN` | Yes | Slack bot OAuth token |
| `LLM_PROVIDER` | No | `anthropic` (default) or `openai` |
| `LLM_MODEL` | No | Model ID (default: `claude-sonnet-4-5-20250929`) |
| `DRY_RUN` | No | `true` to skip FR relation updates |
| `WRITE_AUDIT` | No | `true` to create audit page in Notion during dry-run |
| `BACKTEST` | No | `true` to query recent FRs regardless of status (implies dry-run + write-audit) |
| `VERBOSE` | No | `true` for debug logging |

## GitHub Actions

The workflow at `.github/workflows/triage.yml` supports:

- **Scheduled runs**: Weekdays at 6 AM ET
- **Manual dispatch**: Pick a product, toggle dry-run, backtest, and verbose logging

Set secrets in the repo settings: `NOTION_API_KEY`, `LLM_API_KEY`, `SLACK_BOT_TOKEN`.

## Project Structure

```
src/
├── index.ts              # CLI entry point
├── config/               # YAML config loader + Zod validation
├── products/             # Per-product YAML configs (home.yml, _template.yml)
├── notion/               # Notion SDK wrapper, block→text, queries, mutations
├── llm/                  # LLM provider abstraction + prompt builders
├── pipeline/             # Three-phase orchestrator (prep → process → finalize)
├── audit/                # Notion audit page block builders
├── notifications/        # Slack message sender
├── validation/           # Notion ID normalization + hallucination filtering
└── utils/                # Logger, error classes
```

## Development

```bash
npm install
npm test            # Run unit tests
npm run typecheck   # Type-check without emitting
```
