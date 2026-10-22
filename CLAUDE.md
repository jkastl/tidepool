# tidepool

Small, odd things washed up for a look. Each folder here is one build: an
explainer, a tool, a lab, a toy, a proposal, whatever form fits the idea
behind it. Builds come from idea-tank runs and are served at
`https://jkastl.github.io/tidepool/`.

This file is the guide to what a build is and how one is made and checked.
The run that produces a build (intake, the review team, publishing) is
described in the private idea-tank repo's `CLAUDE.md`.

## Public by default

Everything in this repo is public: the builds, this file, the front page,
commit messages, and pull requests. A build is about its topic, never about
the person whose idea it was: no quoted captures, no names, places, or
personal details. Refer to the person who owns the repo as "the owner".

The privacy checks (a term list and a scanner) live in idea-tank, and every
build and revision passes them before it is pushed. A session that has only
this repo cannot run them, so it does not push builds or revisions; it asks
for idea-tank to be attached.

## Branches

Pages serves `main`, so a push to `main` is a publish.

| Change | How |
| --- | --- |
| A new build: its `<slug>/` folder, its `builds.json` entry, and its `sitemap.xml` line | Straight to `main` |
| A revision or tweak to a build (see [Revising a build](#revising-a-build)) | Straight to `main` |
| Anything else: this file, `index.html`, `stats.js`, `README.md`, `.nojekyll`, the manifest's format, the head block's format | A branch and a pull request for the owner |

Builds and revisions go to `main` even when the session was set up with a
branch of its own. `main` blocks force-pushes and deleting the branch. If a
push is rejected because `main` moved, run `git pull --rebase origin main`
and push again.

## Layout

| Path | What it holds |
| --- | --- |
| `index.html` | The front page: every build, newest first, read from `builds.json` |
| `builds.json` | The manifest: one entry per build |
| `sitemap.xml` | Every page's URL for search engines, generated from `builds.json` |
| `stats.js` | Page counts (GoatCounter). Every page loads it; the site code lives only here |
| `<slug>/` | One build. `slug` is `YYYY-MM-DD-short-name`, dated the day it was built |
| `.nojekyll` | Tells Pages to serve files as they are |

Build folders are never deleted or renamed, since links to them may exist.
To retire one, leave it and say so on its page.

## The manifest

`builds.json` is a JSON array, oldest first, with one entry per build:

```json
{
  "slug": "2026-10-12-tide-clock",
  "title": "Tide Clock",
  "date": "2026-10-12",
  "kind": "idea",
  "form": "tool",
  "style": "nautical chart",
  "summary": "A clock face that tells tide time instead of sun time.",
  "source": "idea-tank#7",
  "revised": "2026-10-15"
}
```

- `kind`: `question`, `idea`, `musing`, or `follow-up`.
- `form`: what the build is, in a word or two (see [Form and style](#form-and-style)).
- `style`: its visual style, in a few words.
- `summary`: one public-safe line. It appears on the front page and in the
  page's search and sharing tags.
- `source`: where the build came from. `idea-tank#N` for idea-tank issue N.
  Runs use it to recognise a build they already made.
- `revised`: optional. The date of the build's latest major revision.
  Left out until there is one. The front page shows it.

## What a build is

### Its job

The kind of idea sets what the build is for:

| Kind | The build's job |
| --- | --- |
| `question` | Answer it and show the reasoning |
| `idea` | Make it, or a first slice of it; a proposal page if it needs more than a static site |
| `musing` | Explore it |
| `follow-up` | Research it, then build from what turned up |

### Form and style

Read the last three entries in `builds.json` and pick a form and a style
that none of them used, unless the idea plainly calls for one. Name the
style honestly in the manifest: two builds both called "minimal dark" share
a style.

**Forms**, a menu and not a limit: explainer, interactive lab or
simulation, tool or calculator, toy, game, visual essay, data story, field
guide, timeline, decision aid, annotated map, proposal (for anything that
needs more than a static page: what it would be, how it would work, the
first milestones). The forms that work best get hands-on with the topic
itself. Wrappers around it, like a chatbot about X, a gamified X, a quiz or
flashcards about X, or a generic landing page, tend to say less.

**Styles**, also a menu: blueprint, newspaper front page, terminal,
risograph print, field notebook, museum placard, 8-bit, brutalist, Swiss
poster, botanical plate, nautical chart, pulp magazine, subway signage,
receipt paper, chalkboard, vintage manual. Invent others. A style commits
in type, layout, and texture, not just colour.

### Voice

A build is a first try at something interesting, shared the way a hobbyist
shares notes with a friend: curious, modest, and plain.

- **No narrator.** Talk about the topic, "this page", or "you". The page
  has no "I", "me", "my", or "we". The hobbyist is an attitude, not a
  character on the page.
- **Describe rather than frame.** Say what the build does and what it
  tries. Sweeping framing, like "what X really needs", "what X is really
  about", "the real problem", "the missing piece", "what nobody talks
  about", or "finally", claims more than a first try knows.
- **Other work is a starting point.** When the page mentions what already
  exists, it says what that is and what this build tries. Assume its
  makers thought of the obvious and had their reasons.
- **Modest claims.** Say where the build simplifies, estimates, or
  guesses. Leave out "everything you need", "the definitive", and "the
  right way".
- **Plain words.** Short sentences and everyday vocabulary. A style can be
  playful or dramatic in its type and layout; the prose still talks like a
  person.

For example, an LED-strip build might open: "A lot of the early questions
turn out to be about power and wiring, so that's where this starts."

### Facts and sources

- Facts come from sources found while making the build, not from memory
  alone. Link them on the page, inline or in a short sources list at the
  end.
- Numbers inside a simulation or calculator count as facts. Where a model
  simplifies, the page says so near the control it affects.
- A source you cannot place (a content farm, an anonymous blog) never backs
  a claim by itself. A fact only it reports stays out until a named outlet,
  publisher, institution, or the maker's own page repeats it.
- Medical, legal, and money topics are explained, not advised. The page
  says plainly that it is an explainer and points to a professional for
  decisions.

**Current events** (about a technology, a natural event, or a policy;
never about people) put the snapshot date at the top ("as of Oct. 12,
2026"), attribute every factual claim to the named outlet that reported
it, with a link, and add nothing beyond what those reports say.

### People

Builds are about ideas, not people.

- **Not about a living person.** Not a profile, not their news, not their
  posts, not a ranking or comparison of them.
- **Not about news involving people.** Current events about a technology,
  a natural event, or a policy as policy are fine.
- **Historical people are fine:** people who have died and are discussed
  for their place in history, not current controversy. If in doubt, treat
  the person as living.
- **Passing mentions are fine.** A living person may be named for a
  documented public role ("the protocol Vint Cerf co-designed") when the
  build is not about them.

### Prior art in a build

Idea-tank runs check what already exists before building an idea, and a
build may say what turned up in a short section such as "Already out
there". Other people's work is theirs, so:

- **Name and link.** Use the product's or project's name in plain text and
  link to its own page. Describe it in a line, in the build's own words.
  No logos, icons, screenshots, product photos, embedded media, or text
  copied from their site.
- **Names identify, never brand.** A name appears only to say what the
  thing is: never in the build's title, slug, branding, or `builds.json`
  summary, and never in a way that suggests the build is affiliated with
  or a version of it ("an open-source music player", not "an open-source
  Spotify").
- **Its own look and code.** No imitation of another product's interface,
  layout, colours, or mascot, and no copied code, whatever its license.
  Libraries from a CDN, per the build rules, are fine.
- **Fair and factual.** State only what their own pages or a named source
  say about them; no guessing at prices or features. Say what this build
  tries (see [Voice](#voice)).
- **Projects, not people.** Name the project. A creator appears only in
  passing for a documented public role, as in [People](#people).

## Build rules

Every build is a static site in its own folder, unless it is a proposal
page for something bigger.

- **Plain files.** `index.html` at the folder root, no build step. Plain
  HTML, CSS, and JS (ES modules are fine). Libraries only from a CDN
  (jsdelivr, cdnjs, unpkg), pinned to an exact version.
- **No backend.** A build runs entirely in the browser. Nothing a visitor
  enters, records, or plays is sent to a server.
- **Outside calls are optional and reputable.** A CDN library, a public
  API, or the visit counter may fail to load, so the build still works, or
  says plainly what is missing, when one does. Only from sources you can
  place: the CDNs above, an API's own documented endpoint, GoatCounter. No
  ad or tracking scripts. Public APIs only if they need no key and allow
  browser (CORS) calls. "Nothing leaves your device" in a build means no
  backend, and is true with these calls.
- **Relative paths.** Pages serves the build under `/tidepool/<slug>/`.
- **The head block.** Every page's `<head>` has, right after `<title>`,
  a block between `<!-- site:head -->` and `<!-- /site:head -->` holding
  its search and sharing tags and the `../stats.js` counter. Idea-tank's
  `tools/site.py sync` writes it from the manifest entry, along with
  `sitemap.xml`; it is never written by hand. The block carries no author
  or anything else about the owner, no `noindex`, and no `og:image`. A
  build never loads the counter or any other analytics itself.
- **Small touches.** A small link back to the front page (`../`) somewhere
  unobtrusive. `<link rel="icon" href="data:,">` in every page's `<head>`,
  so browsers never ask for a missing favicon. No emoji or decorative icons.
- **State.** In `localStorage` or IndexedDB, inside try/catch, with export
  and import for anything someone would hate to lose.
- **Everywhere.** Works at phone width, and follows light and dark with
  `prefers-color-scheme`.
- **Text and source only.** No dependency folders, build output, raster
  images, or screenshots, and no file over 1 MB. Pictures are drawn in
  code (SVG, canvas, CSS).

## Test before publishing

Serve the repo root with `python3 -m http.server` and drive the build with
Playwright using the preinstalled Chromium (if a project needs a different
Playwright version, launch with `executablePath: '/opt/pw-browsers/chromium'`;
never run `playwright install`). Open `/<slug>/`, walk the core experience
start to finish, use every control, check the console for errors, and look
at it at desktop and phone width, in light and dark. Keep test scripts and
screenshots outside the repo. Locally `stats.js` does nothing, so tests
never count as visits.

Idea-tank's `tools/lint_build.py` checks the build rules a script can
check, and `tools/site.py check` checks the head blocks and sitemap. Runs
also send each build past a small review team (facts, reading, privacy,
testing) before it is published; idea-tank's `CLAUDE.md` describes it.
Everything in this file is what that team reads the build against.

## Revising a build

After a build is published, the owner sometimes asks for changes: a topic
expanded, a section added, a visual tweak, a correction. Only an
interactive session makes them, and only for a specific change the owner
asked for. Scheduled runs never change a published build; more on a built
idea becomes a new build.

There are two sizes of change:

| Change | Examples | `revised` | Commit |
| --- | --- | --- | --- |
| **Major revision**: changes what the build says or does | A new section, an expanded topic, a new control or feature, a corrected fact | Set to today | `Revise <slug>: <what changed>` |
| **Small tweak**: leaves what it says and does alone | Head block and other meta tags, the counter, sitewide boilerplate, a typo, a polished sentence, a small visual fix | Left as it is | `Tweak <slug>: <what changed>`, or `Tweak all builds: <what changed>` for one change across every build |

If unsure, it is a tweak.

- **Same folder, same URL.** Edit files inside the existing `<slug>/`
  folder and its `builds.json` entry. The slug, folder, URL, `date`,
  `kind`, and `source` never change. Update `title`, `summary`, `form`, or
  `style` only if the change makes them wrong, and resync the head block
  when `title` or `summary` changes.
- **Same scope.** Keep the build's form and style unless the owner asks to
  change them. An ask big enough to be a different build (a new form, a
  different topic) is offered as a new build instead.
- **Same rules.** Everything in this file holds, and a revision cannot turn
  a build into something a new build could not be.
- **Same checks.** Test the changed parts and the core experience as in
  [Test before publishing](#test-before-publishing), and pass the privacy
  check in idea-tank before pushing. Idea-tank's `CLAUDE.md`, "Revising a
  published build", has the whole procedure.
