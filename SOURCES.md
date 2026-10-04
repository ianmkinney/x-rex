# Model scope and provenance

Source: https://github.com/xai-org/x-algorithm
Pinned revision: `b412112d03f27acbfd668e0cc040abcafa1080c1`
Configuration source sync: 2026-10-02T16:00:41Z
HAI engine version: `x-rex-lexical-v1`

## Implemented public arithmetic

- `home-mixer/params/param.rs`: all 25 default action/continuous-value weights, +15 mutual-follow reply boost, +0 mutual-follow dwell boost, and the disabled out-of-network Phoenix reply flag.
- `xai-value-model/scoring.rs`: `compute_weighted_score` weighted terms and `offset_score` piecewise mapping.
- `xai-value-model/weights.rs`: positive/negative weight sums. Continuous dwell heads are intentionally excluded from `positive_sum`; gated weights remain in the configured denominator.
- `xai-value-model/inputs.rs`: mutual-follow boost only for original posts (not replies/reposts).
- Post-unexplored weight is zero out-of-network, matching the scoring gate. Video-quality and quoted-video predictions default to zero; both configured weights are zero in this revision.

Every score is shown as a **simulated value score**, not a likelihood of actual distribution. Across archetypes it is a scenario comparison, not X’s within-viewer candidate selection. Raw signed values are displayed for interpretability; the source offset is available in the inspector and is used for stable ordering. There is no claim of a calibrated minimum score for placement.

## Selected eligibility checks

- `home-mixer/filters/age_filter.rs` and the README’s documented 48-hour maximum. Exactly 48 hours passes.
- `home-mixer/filters/oon_retweet_reply_filter.rs`: excludes out-of-network replies/reposts under the default disabled Phoenix OON reply override; missing ancestors exclude replies.
- `PreviouslySeenPostsFilter` and `AuthorSocialgraphFilter` are represented by explicit viewer flags, not live data access.
- Muted phrases use a case-insensitive substring approximation. This is labeled an approximation; X’s full keyword matching pipeline is not ported.

Other filters are not modeled: subscription access, duplicate retrievals, self posts, topic restrictions, country-specific constraints, content labels, holdouts, and visibility filtering services, among others. Passing our checks is not proof of X eligibility.

## HAI assumptions — not from X

The nine archetypes and their keyword dictionaries are synthetic HAI scenarios. Custom deterministic profiles extract non-stopword tokens from a description, use a fixed `reader` behavior, and do not infer demographics.

For an archetype, let `m` be the number of distinct matched dictionary terms. Text and terms are NFKC-normalized and lowercased; matching uses whole Unicode tokens (multiword terms require all words). Affinity is `1 - exp(-m / 3)`. The progress bar visualizes this lexical affinity and does **not** visualize a reach probability.

`lib/engine.ts:estimate` contains the complete formula for each head. Representative assumptions:

- Like: `0.015 + 0.20 × affinity`.
- Reply: `(0.001 + 0.027 × affinity × (1 + 0.5 × question)) × conversation factor`.
- Not interested: `0.001 + 0.012 × (1 - affinity)`.
- Copy link: `0.0005 + 0.012 × affinity × (1 + 0.4 × tutorial indicator)`.
- Conversation/curation behavior multipliers are 1.3; other behavior multipliers are 1.
- Dwell estimate depends on text length and affinity; image/video flags gate photo-expand/video-open estimates, not content understanding.
- Block, mute, and report probabilities are fixed tiny baselines; there is no safety classifier or automated judgment that text deserves a report.
- All probability heads are bounded [0,1]. Users can override all values; lab dwell overrides are capped at 300 seconds.

These are transparent product assumptions, not learned or validated behavioral probabilities. They can be wrong. Literal vocabulary misses synonyms, irony, multilingual nuance, context, visual meaning, and actual viewer history. Repeated keywords do not increase match count, and matching more words is not evidence of gaming the real algorithm.

## Not implemented

Phoenix inference/training, model checkpoint acquisition, viewer-history retrieval, Thunder/SimClusters retrieval, actual candidate pools, feature-switch experimentation, author-diversity multipliers, out-of-network rescaling, author exploration, new-author lift, VMRanker reranking, and full visibility filtering. No arbitrary substitute parameters are presented as X defaults for these omitted stages.

## AI boundary

Prompt templates and deterministic custom profiles are generated locally. A user-selected OpenRouter model generates text or proposes archetypes; Sonnet handles screenshots by default. The model catalog is loaded from OpenRouter, while the default writing option remains latest Sonnet. Structured draft responses separate publishable text from short editorial rationales; this separation does not turn model explanations into verified causal evidence. These steps can vary across requests, providers, and model updates. The latest alias is `~anthropic/claude-sonnet-latest` (https://openrouter.ai/~anthropic/claude-sonnet-latest). Scoring never calls an LLM. An accepted AI profile/text plus fixed inputs yields reproducible engine results; an LLM response is not called deterministic.

## Public-profile briefs

`lib/profile.ts` validates handles and profile URLs, reuses the declared archetype dictionaries for literal topic suggestions, and embeds the supplied bio/post evidence in a deterministic prompt. The profile is an interest hypothesis, not a Phoenix viewer representation. Only public data is imported, via the official X API with a server-only bearer token from `X_BEARER_TOKEN`. Unknown/protected status is rejected. Up to 10 original posts are requested; each excerpt is capped at 1,200 characters. Partial timeline failures are shown and never replaced with invented posts. User-pasted text is explicitly unverified and receives no fabricated post URLs. Profile text is untrusted data; the generation brief forbids following embedded instructions or inferring sensitive demographics/private activity.
