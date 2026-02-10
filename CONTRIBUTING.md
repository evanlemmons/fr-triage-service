# Contributing to FR Triage Service

Thanks for contributing! This guide will help you make changes safely and efficiently.

## Quick Start

1. **Clone the repo** (if you haven't already):
   ```bash
   git clone https://github.com/evanlemmons/fr-triage-service.git
   cd fr-triage-service
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Create a feature branch**:
   ```bash
   git checkout -b my-feature-name
   ```

## Making Changes

### Editing Product Configurations

**Most common task:** Updating your product's YAML config in `src/products/{product-name}.yml`

You can update:
- **Product description** - Improve context for the LLM
- **LLM prompts** - Fine-tune classification and matching logic
- **Confidence thresholds** - Adjust matching sensitivity
- **Slack notifications** - Change notification targets
- **Schedule** - Adjust when the workflow runs

**Example workflow:**
```bash
# 1. Edit your product's YAML
code src/products/people.yml

# 2. Validate locally
npm run typecheck
npm test

# 3. Commit your changes
git add src/products/people.yml
git commit -m "Update People product alignment prompt"

# 4. Push to GitHub
git push origin my-feature-name

# 5. Open a PR on GitHub
gh pr create --title "Update People product alignment prompt" --body "Fine-tuned the prompt to better handle Church Center profile requests"
```

### Testing Your Changes

**⚠️ NEVER test locally with production credentials!**

After your PR is merged:
1. Go to https://github.com/evanlemmons/fr-triage-service/actions
2. Select "Feature Request Triage" workflow
3. Click "Run workflow"
4. Choose your product and enable `--write-audit` flag
5. Review audit pages in Notion to validate your changes

**Test modes:**
- `--write-audit` - Creates audit docs but doesn't touch FR properties (RECOMMENDED)
- `--dry-run` - Console output only, no Notion writes
- `--backtest` - Re-process recent FRs to compare against n8n

See [README.md](README.md#test-modes-via-github-actions) for full details.

## Pull Request Guidelines

### Before Opening a PR

- ✅ Run `npm run typecheck` - Ensure TypeScript compiles
- ✅ Run `npm test` - All tests must pass
- ✅ Commit messages are clear and descriptive
- ✅ Only change files related to your feature

### PR Requirements

All PRs must:
1. **Pass automated checks** - Tests, typecheck, and config validation
2. **Get approved** - At least one review (CODEOWNERS will auto-request reviewers)
3. **Have a clear description** - Explain what changed and why

The PR validation workflow will automatically:
- Run all tests
- Type-check the codebase
- Validate product YAML configs
- Comment on your PR with results

### After Your PR is Merged

1. **Test in staging mode** - Use `--write-audit` to validate changes
2. **Review audit docs** - Check classification and matching quality
3. **Monitor Slack** - Watch for error notifications
4. **Iterate** - Open new PRs to fine-tune based on results

## File Structure

```
src/
├── products/          # Product-specific YAML configs (EDIT THESE!)
│   ├── home.yml      # Home product configuration
│   ├── people.yml    # People product configuration
│   └── _template.yml # Template for new products
├── config/           # Config loader and validation
├── pipeline/         # Triage orchestration
├── llm/              # LLM provider abstraction
├── notion/           # Notion API client
└── utils/            # Helpers and utilities
```

## Adding a New Product

1. Copy `src/products/_template.yml` to `src/products/{product-name}.yml`
2. Fill in product metadata, database IDs, and Slack channels
3. Write product-specific LLM prompts (model after `home.yml` or `people.yml`)
4. Add your product to `.github/workflows/triage.yml` options
5. Update CODEOWNERS with your GitHub username
6. Open a PR!

See [README.md#adding-a-new-product](README.md#adding-a-new-product) for full details.

## Common Tasks

### Update LLM Prompts

Edit the `llm.prompts.*` section in your product's YAML:
- `productAlignment` - Routes FRs to correct product
- `pulseMatching` - Matches to strategic Pulse items
- `ideaShortlist` - Filters backlog Ideas (recall)
- `ideaMatching` - Final Idea matching (precision)

### Adjust Confidence Thresholds

Edit `matching.pulse.confidenceThreshold` or `matching.ideas.confidenceThreshold`:
- Higher (0.85) - More conservative, fewer matches
- Lower (0.65) - More aggressive, more matches
- Default: 0.75

### Change Slack Notifications

Edit `notifications.slack.summaryTarget` or `notifications.slack.errorTarget`:
```yaml
summaryTarget:
  type: "channel"  # or "user"
  id: "C12345678"  # Slack channel ID or user ID
```

### Adjust Batch Size

Edit `matching.batchSize` (default: 25):
- Smaller: More manageable audit docs, more Slack notifications
- Larger: Fewer audit docs, but harder to review

## Getting Help

- **GitHub Issues** - Report bugs or request features
- **Slack** - Ping Evan in #product-ops
- **Documentation** - Read [README.md](README.md) and [docs/notion-integration.md](docs/notion-integration.md)

## Security & Access

- **Repo access** - Public repo, open to contributions
- **Secrets** - Only admins can edit GitHub secrets (API keys)
- **Branch protection** - All changes to `main` require PRs and passing tests
- **CODEOWNERS** - Automatic review requests for critical files

## Code of Conduct

Be respectful, collaborative, and constructive. We're all trying to make FR triage better!
