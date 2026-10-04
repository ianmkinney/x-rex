# X-Rex · X Audience Lab

A polished, responsive audience scenario tool for HAI Consulting. Paste or upload an X post, compare interest archetypes, inspect the scoring inputs, or reverse the workflow to produce an LLM-ready post brief.

## Important scope

**This is a deterministic simulator, not a replica of X’s live For You feed.** It implements the published weighted-sum and offset arithmetic and selected filters. A documented HAI lexical surrogate supplies hypothetical engagement predictions; X’s production Phoenix checkpoints, viewer histories, candidate retrieval pools, and full ranking stack are not available to this app. Scores are not probabilities of placement or reach. See [SOURCES.md](SOURCES.md).

## Run

Node.js 22+ (tested with 24).

```bash
npm ci
npm run dev
```

Open http://localhost:3000. No API key is required for analysis, custom deterministic archetypes, or prompt generation.

```bash
npm run test
npm run build
npm run start
```

## Workflows

- **Analyze:** paste text, upload TXT or JSON (`text`, `full_text`, or `data.text`), or transcribe a PNG/JPEG/WebP screenshot with Sonnet. Review transcribed text before analyzing.
- **Inspect:** click an archetype to see all 25 predictions, weights, contributions, and the source offset. Override inputs and rerun. Adjust age, relationship, post type, media, and viewer exclusions.
- **Build for an audience:** select several archetypes or create one from a description. Copy a deterministic generation brief or ask Sonnet to draft posts.
- **Export:** download a JSON report with inputs, archetypes, overrides, results, engine version, and pinned upstream revision. API keys are excluded.

## AI configuration

In **AI settings**, enter an **OpenRouter** API key. OpenAI API keys cannot directly call Anthropic Sonnet. The implementation interprets the requested “open-air” provider as OpenRouter.

The default model is OpenRouter’s `~anthropic/claude-sonnet-latest` alias. Optional server configuration:

```dotenv
OPENROUTER_MODEL=~anthropic/claude-sonnet-latest
```

Keys are BYOK, kept in React memory for the current tab, passed to the same-origin server only for an explicitly requested AI operation, and forwarded only to `https://openrouter.ai/api/v1/chat/completions`. Keys are never stored in browser storage, logs, exported reports, or the repository. Refreshing the page clears the key, drafts, and custom profiles. There is no publicly spendable shared server credential. Optional AI actions are not deterministic; accepted text and profiles become fixed inputs to deterministic scoring. The response’s resolved model is displayed with generated drafts.

## Deploy to Vercel

Connect `ianmkinney/x-rex` as a Next.js project, with the repository root as the root directory. No secret environment variables are required; optional model override only. Production branch: `main`.

The project uses the user-selected personal repository `ianmkinney/x-rex`. The original private organization repository was replaced at the user’s request before deployment.

## Verification

`npm test` verifies hand-calculated score parity, negative offsets, conditional weights, eligibility boundaries, reproducibility, custom archetypes, and override behavior. `npm run test:e2e` verifies the main desktop/mobile workflows and API validation (install Chromium with `npx playwright install chromium` first). AI provider UI handling is tested with marked mock responses; a billable live provider request requires a user-supplied key.

To check the 25 weights against the upstream clone:

```bash
python scripts/verify-upstream.py /path/to/x-algorithm
```

## Stack

Next.js App Router, React, TypeScript, plain CSS, Lucide icons, Zod, and a server-side OpenRouter fetch adapter. No database, analytics, or user tracking. Apache-2.0; see LICENSE and NOTICE.
