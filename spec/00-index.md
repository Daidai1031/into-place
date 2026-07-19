# SPEC Index

This folder is the single source of truth for the implementation; in case of conflict with the PRD/research documents, this takes precedence. Version V1.1 (Hackathon MVP).

| File | Contents |
|---|---|
| `01-data-model.md` | Project / Place / Asset / Frame / Shot data structures |
| `02-ui-pages.md` | Specs for the map landing page + 4 workflow pages |
| `03-api.md` | Server routes and security conventions |
| `04-shot-router.md` | Storyboard frame → I2V model routing, prompt and transition rules |
| `05-assets-audio-files.md` | Asset preprocessing, audio, file directory conventions |
| `06-place-case.md` | Five-act outline for the first case (Roosevelt Island); Shaxi as an alternative; co-creation archive mechanism |

## Global not-implementing list

Three.js / XYZ drag / camera keyframe editor · timeline editor · points-and-tasks system · version branching · user accounts and permissions · webhook (use polling) · Mapbox/real map tiles · automatic copyright determination · locally deployed video models · Preview.io integration (no API; competitive positioning in 06).

## Competitive positioning in one sentence (for demo and repo)

General-purpose AI storyboard workbenches (like Preview.io) help you generate any image faster; Into Place only helps you tell the story of **one real place**—assets must have a source, archive and generated content are always layered and labeled, and personal photos can become part of a place's public archive.
