# AI Learning Starmap Engineering Guide

## Product direction

- Keep the interface futuristic, technical, code-oriented, and calm. Prefer functional terminal cues, grids, status signals, and data feedback over decorative hacker clichés.
- Every interaction should help learning: expose state, explain outcomes, and give the learner a useful next action.
- User-facing copy is Simplified Chinese. Technical identifiers and concise system labels may use English.
- Accessibility is part of the design: keyboard operation, visible focus, semantic HTML, readable contrast, responsive layouts, and reduced-motion support are required.

## Current stack

- Keep Django Templates and vanilla HTML/CSS/JavaScript unless the user explicitly approves a frontend framework migration.
- Do not add Node.js or a frontend build step for changes that the current stack can handle cleanly.
- Reuse Django URL names instead of hardcoding internal links in new templates.

## Frontend boundaries

- Design tokens belong in `learning/static/learning/css/tokens.css`.
- Shared shell and reusable component rules belong in `learning/static/learning/css/shell.css`.
- Page-only rules belong in `learning/static/learning/css/pages/<page>.css`.
- Do not append new page-specific sections to the legacy `style.css`.
- Global browser behavior belongs in `learning/static/learning/js/app.js`; page behavior belongs in a page controller file.
- Keep computation and workers independent from DOM manipulation. Communicate through explicit messages or data contracts.

## Backend boundaries

- Views validate requests, enforce permissions, call domain or service code, and build responses.
- Put reusable business rules in focused modules or services, not in templates or large view functions.
- Do not add repository or service abstractions around trivial one-line queries. Split when behavior, reuse, retries, caching, or test complexity justifies it.
- Keep learning catalog content separate from browser execution code.

## User code safety

- Never run learner code with Python `exec`, `eval`, `subprocess`, or shell commands inside the Django web process.
- Browser JavaScript exercises run in a disposable Web Worker with a hard timeout.
- A future server-side runner must be a separately deployed, network-isolated, resource-limited, non-root container or microVM service.
- Do not describe Web Workers as a security boundary for hostile public code.

## Quality checks

Run at minimum:

```powershell
.\.venv\Scripts\python.exe manage.py check
.\.venv\Scripts\python.exe manage.py test
git diff --check
```

For frontend changes also verify page responses, static asset availability, JavaScript syntax, keyboard behavior, mobile layout, and browser-console errors. If browser automation is unavailable, report that limitation explicitly rather than claiming visual verification.

Architecture details and the planned isolated runner design are documented in `docs/ARCHITECTURE.md`.
