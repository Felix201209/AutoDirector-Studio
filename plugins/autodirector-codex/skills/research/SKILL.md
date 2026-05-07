---
name: autodirector-research
description: Use for AutoDirector research tasks: web/source investigation, source notes, factual risk, public asset discovery, and citations.
---

# AutoDirector Research

Research turns a vague topic into evidence the video can safely use.

## Sources

Use the best available browsing/search capability in this order:

1. Codex web/browser tools if available.
2. AutoDirector/browser-use task if the MCP task explicitly asks for it.
3. User-provided URLs/assets.
4. If no browsing tool is available, submit `blocked` with the exact missing capability.

## Workflow

1. Read the current task with `autodirector_get_agent_task`.
2. Identify the video claim types:
   - evergreen explanation
   - current news/conflict
   - product/company facts
   - visual references or public figures
3. Gather 5-10 credible sources. Prefer primary sources, official blogs, SEC/legal filings, direct posts, high-reputation journalism, and dated pages.
4. For every claim, store:
   - claim
   - source title
   - source URL
   - publish/update date when available
   - why the claim matters visually
   - risk level
5. Discover public/source assets separately from generated visuals:
   - real photos or screenshots: source, usage risk, crop notes
   - diagrams/abstract visuals: route to Visual/Imagegen skill
6. Submit `research_pack`.

## Output Schema

```json
{
  "summary": "What the video can truthfully say",
  "key_facts": [
    {
      "claim": "...",
      "source_url": "...",
      "source_title": "...",
      "date": "...",
      "visual_use": "...",
      "risk": "low|medium|high"
    }
  ],
  "asset_leads": [
    {
      "kind": "photo|screenshot|chart|logo|document",
      "source_url": "...",
      "intended_scene": "...",
      "license_risk": "low|medium|high",
      "fallback": "imagegen|upload|omit"
    }
  ],
  "do_not_claim": ["..."]
}
```

## Done When

- Every time-sensitive fact has a source and date.
- Visual asset leads are not mixed with generated-image prompts.
- High-risk claims are either softened, cited, or rejected.
