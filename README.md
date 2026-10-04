# X-Rex · X Post Optimization

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
- **Build for an audience:** select several archetypes or create one from a description. Copy a deterministic generation brief or use a selected OpenRouter model to draft posts.
- **Export:** download a JSON report with inputs, archetypes, overrides, results, engine version, and pinned upstream revision. API keys are excluded.

## Server credentials

Configure these encrypted environment variables in Vercel → Project Settings → Environment Variables:

- `OPENROUTER_API_KEY`: OpenRouter API key for model generation.
- `X_BEARER_TOKEN`: official X API bearer token for public profile imports.

Placeholders beginning with `REPLACE_ME` are treated as unconfigured and return a friendly 503 without calling providers. Replace them with real values in each environment you use, then **redeploy**. Neither secret uses the `NEXT_PUBLIC_` prefix. Secrets are read only in server API routes; there are no credential fields, client credential headers, browser storage, or exported keys. Caller-supplied credential headers are ignored. The deployment owner's credentials back provider requests.

For local development, copy `.env.example` to ignored `.env.local` and replace the placeholders. Never commit real credentials.

The writing-model picker loads the live OpenRouter text-model catalog and defaults to `~anthropic/claude-sonnet-latest`. The selected ID is forwarded to OpenRouter for drafts and AI archetypes; credentials remain server-only. The optional `OPENROUTER_MODEL` sets the fallback for API calls without a selection and the screenshot model (use a vision-capable model). OpenAI API keys cannot directly call Anthropic Sonnet. Optional AI operations are not deterministic; accepted text and profiles become fixed inputs to deterministic scoring.

## Deploy to Vercel

Connect `ianmkinney/x-rex` as a Next.js project, with the repository root as the root directory. Set the two server secrets above to enable AI and profile import; local analysis and prompt generation work while placeholders remain. Production branch: `main`.

The project uses the user-selected personal repository `ianmkinney/x-rex`. The original private organization repository was replaced at the user’s request before deployment.

## Verification

`npm test` verifies hand-calculated score parity, negative offsets, conditional weights, eligibility boundaries, reproducibility, custom archetypes, and override behavior. `npm run test:e2e` verifies the main desktop/mobile workflows and API validation (install Chromium with `npx playwright install chromium` first). AI provider UI handling is tested with marked mock responses; a billable live provider request requires configured server credentials.

To check the 25 weights against the upstream clone:

```bash
python scripts/verify-upstream.py /path/to/x-algorithm
```

## Stack

Next.js App Router, React, TypeScript, plain CSS, Lucide icons, Zod, and a server-side OpenRouter fetch adapter. No database, analytics, or user tracking. Apache-2.0; see LICENSE and NOTICE.

## Target a public profile

The separate **Target a profile** tab accepts an X handle or profile URL. Automatic import uses the official X API (`GET /2/users/by/username/:username` and `GET /2/users/:id/tweets`) with the server-only `X_BEARER_TOKEN` environment variable. It imports the public bio and up to 10 original posts, with source links, a retrieval timestamp, and partial-fetch warnings. Protected profiles are rejected. The token is never sent to the browser, exported, or logged; the server forwards it only to `api.x.com`. X API endpoint access/credits may be needed.

Without X API access, paste a public bio and post excerpts. Pasted evidence is explicitly unverified. The app suggests literal interest matches, lets the user edit them, and generates a deterministic brief containing the evidence and source limitations. Optional model drafting uses the server-only `OPENROUTER_API_KEY`. This does not access or predict a person's private For You feed; no placement is guaranteed. Profile evidence is sent to OpenRouter only when drafting is explicitly requested. Tests mock external profile responses; no live authenticated X fetch was performed during development.

## Readable drafts and X handoff

Generation favors short, natural sentences and varied rhythm, with conversational or playful options when the topic fits. The server validates three structured post options with separate audience explanations, exact marker names, and negative-feedback checks. Malformed output is rejected rather than mixing reasoning into publishable text.

Each option has an editable post-only box, Copy post, and Post on X. Copy and X's composer receive only the edited text. Reasoning appears in a separate box below; edits mark it as referring to the original draft. `twitter-text` checks X's weighted length (including URLs, emoji, and CJK); invalid standard-length posts cannot open the composer until edited. Posting is completed by the user in X, never automatically.

`GET /api/models` reads OpenRouter's public catalog without credentials and caches it for one hour. A catalog outage retains the default Sonnet option and provides Retry. Model availability and output quality vary by provider and account.
