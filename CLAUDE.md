# tidepool

Small, odd things washed up for a look. Each folder here is one build: an
explainer, a tool, a lab, a toy, a proposal, whatever form fits the idea
behind it. Builds come from scheduled idea-tank runs (and later from the
manatee idea generator). The site is served at
`https://jkastl.github.io/tidepool/`.

**Everything in this repo is public.** A build is about its topic, never
about the person whose idea it was: no quoted captures, no names, places, or
personal details. The private checks (a term list and a scanner) live in the
private idea-tank repo, and idea-tank runs apply them before every push. A
session working in this repo alone cannot run them, so it must not add
anything that came from a private capture.

## Branching: builds go straight to main, setup goes through a PR

Pages serves `main`, so a push to `main` is a publish.

| Change | How |
| --- | --- |
| A build: a new `<slug>/` folder and its `builds.json` entry | Commit straight to `main` and push. No pull request. |
| Anything else: `CLAUDE.md`, `index.html`, `README.md`, `.nojekyll`, the manifest's format | A branch and a pull request for Jeff to review |

`main` has a ruleset that blocks force-pushes and deleting the branch. Normal
pushes are allowed. If a push is rejected because `main` moved, run
`git pull --rebase origin main` and push again.

## Layout

| Path | What it holds |
| --- | --- |
| `index.html` | The front page: every build, newest first, read from `builds.json` |
| `builds.json` | The manifest: one entry per build |
| `<slug>/` | One build. `slug` is `YYYY-MM-DD-short-name`, dated the day it was built |
| `.nojekyll` | Tells Pages to serve files as they are |

Never delete or rename a build folder: links to it may exist. To retire one,
leave it and say so on its page.

## The manifest

`builds.json` is a JSON array, oldest first. Append one entry per build:

```json
{
  "slug": "2026-10-12-tide-clock",
  "title": "Tide Clock",
  "date": "2026-10-12",
  "kind": "idea",
  "form": "tool",
  "style": "nautical chart",
  "summary": "A clock face that tells tide time instead of sun time.",
  "source": "idea-tank#7"
}
```

- `kind`: `question`, `idea`, `musing`, or `follow-up`.
- `form`: what the build is, in a word or two (see [Forms](#forms)).
- `style`: its visual style, in a few words (see [Styles](#styles)).
- `summary`: one public-safe line. It appears on the front page.
- `source`: where the build came from, for runs to detect a build they
  already made. `idea-tank#N` for idea-tank issue N.

## Variety

Before choosing, read the last three entries. Pick a `form` and a `style` that
none of them used, unless the idea plainly calls for one. Name the style
honestly in the manifest: two builds both called "minimal dark" count as the
same style.

The kind sets the build's job:

| Kind | The build's job |
| --- | --- |
| `question` | Answer it and show the reasoning |
| `idea` | Make it, or a first slice of it; a proposal page if it needs more than a static site |
| `musing` | Explore it |
| `follow-up` | Research it, then build from what turned up |

### Forms

A menu, not a limit: explainer, interactive lab or simulation, tool or
calculator, toy, game, visual essay, data story, field guide, timeline,
decision aid, annotated map, proposal (for anything that needs more than a
static page: what it would be, how it would work, the first milestones).

Avoid the lazy moves: "X but with a chatbot", "gamified X", a quiz or
flashcards about X, a generic landing page about X.

### Styles

Also a menu: blueprint, newspaper front page, terminal, risograph print,
field notebook, museum placard, 8-bit, brutalist, Swiss poster, botanical
plate, nautical chart, pulp magazine, subway signage, receipt paper, chalk
board, vintage manual. Invent others. A style is more than a color scheme:
type, layout, and texture should all commit to it.

## Build rules

Every build is a static site in its own folder, unless it is a proposal page
for something bigger.

- `index.html` at the folder root, no build step. Plain HTML, CSS, and JS
  (ES modules are fine). Libraries only from a CDN (jsdelivr, cdnjs, unpkg),
  pinned to an exact version.
- Every path relative: Pages serves the build under `/tidepool/<slug>/`.
- `<meta name="robots" content="noindex">` in every page's `<head>`. Tidepool
  stays out of search engines. (A `robots.txt` would not help: crawlers only
  read it at the domain root.)
- A small link back to the front page (`../`) somewhere unobtrusive.
- State in `localStorage` or IndexedDB, inside try/catch, with export and
  import for anything someone would hate to lose.
- Public APIs only if they need no key and allow browser (CORS) calls.
- Works at phone width, and follows light and dark with
  `prefers-color-scheme`.
- Text and source only. No dependency folders, build output, or file over
  1 MB. No screenshots committed.

### Real people and current events

A build about a real person or recent news makes public claims, so:

- Put the snapshot date at the top ("as of Oct. 12, 2026").
- Attribute every factual claim to the named outlet that reported it, with a
  link, and add nothing beyond what those reports say.
- Separate what happened from what someone said or posted.
- No speculation about motives, health, or private life.

## Test before publishing

Serve the repo root with `python3 -m http.server` and drive the build with
Playwright using the preinstalled Chromium (if a project needs a different
Playwright version, launch with `executablePath: '/opt/pw-browsers/chromium'`;
never run `playwright install`). Open `/<slug>/`, walk the core experience
start to finish, use every control, check the console for errors, and look
at it at desktop and phone width. Also check the front page lists the new
build. Fix what you find before pushing.
