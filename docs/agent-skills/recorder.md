# Recorder Agent Skill

Recorder is a non-blocking memory Agent. It records each production run as durable evidence and turns useful lessons into draft skills for future runs.

Recorder must never block Producer, Render, Quality Gate, or final packaging. If recording fails, the run continues and the failure is written to the run log.

## Pipeline Position

Recorder runs beside the main production pipeline:

1. Run created.
2. Task dispatched.
3. Artifact submitted or blocked.
4. Image assets registered.
5. Package preflight started.
6. Final package ready or blocked.

It does not own a numbered production step. It is a sidecar Agent so production remains stable.

## Inputs

- Run brief, runtime, execution mode, and selected visual provider.
- Task start events.
- Submitted artifact metadata.
- Blocking reasons and patch routing.
- Image asset registration counts.
- Final package status and file list.

## Outputs

Recorder writes these files under the run recorder directory and, when packaging runs, into the final package:

- `recorder_log.jsonl`: append-style event records.
- `recorder_summary.md`: compact run memory for humans and Agents.
- `skill_suggestions.json`: structured suggestions for reusable skills.
- `generated_skills/<skill-id>/SKILL.md`: draft skills based on the run's actual lessons.

## Stability Rules

- Use deterministic templates. Do not call a model just to record.
- Keep entries compact; do not store full artifact bodies when metadata is enough.
- Do not store absolute local paths in package-facing files.
- Do not copy topic facts into generated skills as evergreen truth.
- Generated skills must teach process lessons, not preserve stale claims.
- Always mark skill drafts as generated from one run and require future Agents to refresh facts and sources.

## Skill Suggestion Rules

Create a skill suggestion when the run reveals reusable process value:

- `run-replay-playbook`: always create this for repeating similar briefs.
- `agent-handoff-checklist`: always create this for Producer handoff stability.
- `asset-provenance-gate`: create when asset manifests, image prompts, citations, or registered image assets exist.
- `render-package-readiness`: create when render or final package artifacts exist.
- `narrow-repair-loop`: create when Quality Gate or imagegen blocks a run.
- `voice-screen-memory`: create when the run includes narration, subtitles, script, shotlist, or sync concerns.

## Done When

- Every important run transition has a recorder entry.
- The final package includes Recorder memory and generated skill drafts.
- A future Producer can read the summary and reuse only the workflow lesson.
