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

Placeholders beginning with `REPLACE_ME` are treated as unconfigured and return a friendly 503 without calling providers. Replace them with real values in each environment you use, then **redeploy**. Neither secret uses the `NEXT_PUBLIC_` prefix. Secrets are read only in server API routes; there are no credential fields, client credential headers, credential storage in the browser, or exported keys. Caller-supplied credential headers are ignored. The deployment owner's credentials back provider requests.

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

Each option has an editable post-only box, Copy post, and Post on X. Copy and X's composer receive only the edited text. Reasoning appears in a separate box below; edits mark it as referring to the original draft. `twitter-text` checks weighted length (including URLs, emoji, and CJK) against the selected mode. Room to talk defaults to 450–900 characters with a 1,200-character app limit; Standard is capped at 280. Longer posts require long-post access on X. Invalid or over-limit drafts cannot open the composer until edited. Posting is completed by the user in X, never automatically.

`GET /api/models` reads OpenRouter's public catalog without credentials and caches it for one hour. A catalog outage retains the default Sonnet option and provides Retry. Model availability and output quality vary by provider and account.

## Your voice, onboarding, and X-Rex help

The **Your writing style** panel at the top accepts a public X profile or pasted examples. Import reuses the server-only X API route and loads up to five recent original posts for review. Save applies examples and optional style preferences to both audience and reader-profile briefs. Writing samples are labeled as data, not instructions; they guide style without changing scoring or training model weights. Saved data uses the versioned `xrex:voice:v1` localStorage key on this browser. Remove voice deletes it. If browser storage is unavailable, voice can still be used for the session. Copied prompts include the saved examples; generation sends them to OpenRouter.

A five-step first-visit tour has Back, Next, direct step navigation, and Skip. Skip/completion sets `xrex_tour_v1=done`, a one-year first-party SameSite=Lax cookie (Secure on HTTPS), with no profile content. **Quick tour** replays it anytime.

**Talk to X-Rex** opens a session-only chat using the selected model and the existing server credential. The help endpoint accepts bounded user/assistant history and minimal UI context (tab, voice configured); it does not automatically receive writing samples, imported profiles, or post text. Responses contain a short explanation and allowlisted navigation suggestions. Navigation happens only when the user clicks a button; chat cannot publish, change configuration, or call arbitrary tools. Welcome shortcuts work even before AI is configured.

## Creator discovery and inspiration

**Discover creators** searches the official X recent-search API, starting with Restaurants and the topic AI services. Other verticals include AI & technology, Small business, and Creators & marketing. Topic words are quoted and sanitized; callers cannot inject X search operators or arbitrary URLs. The server uses only `X_BEARER_TOKEN`. Search endpoint access/credits are required in the X developer account.

Rankings cover up to 100 recent matching English-language original posts from the last seven days, not all accounts or all-time performance. Each card shows a public bio, follower count when available, and the highest-engagement matching post observed for that account, with its date and original X link. Engagement is likes + reposts + replies + quotes, not the For You score. Missing counts remain unavailable; no follower numbers, reach claims, or posts are fabricated. The user can also sort accounts by followers within the same sample.

**Write like @username** opens the audience builder with up to five observed public examples and a suggested topic. The session borrows high-level style traits rather than copying posts or impersonating an author. A toggle includes/excludes the user's saved voice, giving it priority when blended. Examples remain in the browser session and are sent to OpenRouter only on explicit generation (or included in a copied prompt). A direct username flow imports recent public original posts through the existing profile route. Clear creator inspiration returns to the ordinary audience workflow.

Prompts now explicitly welcome relevant emoji, contractions, conversational detail, and short paragraphs. The default expanded mode gives a thought room to develop rather than compressing every idea into a short slogan.
