# Design Study: How Cognition Designs UI/UX

A study of Cognition's public web presence — `cognition.com` (corporate), `devin.ai` (product marketing), `app.devin.ai` (product), and the launch/blog surfaces behind them — distilled into a design language we can apply to this platform.

All values below were measured from the live sites on 2026-11-25 (computed styles and published CSS custom properties) unless labelled *inferred* or *reported* (third-party design audits are cited where used).

---

## 1. The core idea

Cognition designs like a **research lab that ships software**, not a SaaS vendor. Every surface — homepage, launch post, leaderboard, even the careers page — reads as a document: quiet paper background, black ink, one restrained accent, real evidence (leaderboards, code, logs, videos of the product working) instead of marketing chrome.

The product (Devin) is slightly louder than the company (Cognition), but both share the same discipline:

- **Restraint over decoration.** Almost no gradients, no drop shadows on corporate surfaces, no rounded "friendly" cards. Depth comes from hairlines, texture, and spacing.
- **Evidence over claims.** Launch pages lead with what shipped, a benchmark table, a terminal session, a Slack screenshot — the proof is the hero.
- **Editorial structure.** Pages are sectioned and numbered (`01`, `02`, `03`…) like a paper. Long-form sentences. Sentence-case heads.
- **One accent.** A single electric blue (`#2200FF` on cognition.com) marks *where you are*, not everywhere you could click.

## 2. The two-surface system

Cognition actually runs two related but distinct identities, and the split is instructive:

| | cognition.com (company / lab) | devin.ai (product / marketing) |
| --- | --- | --- |
| Ground | Warm paper `#F7F6F5` (~90% of page) | Cooler off-white `#FCFCFC` |
| Ink | `#000000` | `#191919` |
| Accent | `#2200FF` — used for **one** active state or action at a time | `rgb(49,124,255)`-family blue for links/CTAs; text secondary `#191919` at 56% |
| Display type | **NB International Pro** (grotesk), weight 400 | **Skandia** (sans), weight 400 |
| Body type | **STK Bureau Serif** (serif — every running sentence) | Skandia for UI; STK Bureau Serif appears for editorial/blog text; **Inter** inside product-embedded mock UIs |
| Mono | **Geist Mono** — footer links, metadata | **Geist Mono** + **IBM Plex Mono** — code, logs, product UI |
| Buttons | Square (`border-radius: 0`), 1px black outline or solid `#191919`, 15px text | Pills (`border-radius: ~200px`), nav pills and CTAs |
| Borders | `#E8E7E6` hairlines; visible column grid lines | `rgba(0,0,0,.06)`–`.08` borders; hairline section rules |
| Motion | Almost none — the page is a document | Scroll-driven product demos (security scan, triage replay) — measured, not flashy |

> Historical note: the pre-2025 `old.cognition.ai` site used a different, darker system — IBM Plex Sans/Condensed/Mono, a teal accent (`#7EC8C8`), bracketed `[LABEL]` tags, ASCII-art hero textures, and notched "clipped-corner" buttons. Cognition retired the terminal-grunge look for the editorial one. If we borrow anything from the old system, borrow the *bracketed label* and *ASCII/terminal texture* — they're the parts that still read "Cognition-adjacent" and work well for engineering-internal tools. (Reported: fudge.design audit of old.cognition.ai.)

**Lesson for this repo:** we are building *internal* tooling, which sits closer to `app.devin.ai` and `devin.ai` product surfaces than to the corporate site. But the cognition.com editorial system is the better north star for an internal platform: it is cheap to implement (no custom fonts needed to get 80% of the feel), it ages well, and it makes dense information (queues, tables, audit logs) feel considered rather than admin-template-generic.

## 3. Type system

### cognition.com — the document system

| Role | Face | Desktop | Leading | Tracking | Weight |
| --- | --- | --- | --- | --- | --- |
| Hero statement (H1) | NB International | 36px | 1.1 | −0.72px | 400 |
| Section head (H2) | NB International | 20px | 1.3 | −0.2px | 400 |
| Nav / button / UI label | NB International | 15px | 1.3 | 0 | 400 |
| Card title | NB International | 15px | 1.5 | 0 | 500 |
| Table text | NB International | 13px | 1.5 | 0 | 400 |
| Table meta | NB International | 11.5px | 1.5 | 0 | 400 |
| Body | STK Bureau Serif | 15px | 1.5 | 0 | 400 |
| Section index (`01`, `02`) | Serif | 10px | 1.5 | 0 | 400 |
| Footer / meta | Geist Mono | 12px | 1.3 | −0.12px | 400 |

Two things stand out: **headlines are small** (the hero H1 is only 36px — the restraint is the point), and **weight never goes above 500–600** anywhere. Hierarchy is built from size, tracking, and spacing, not bold.

### devin.ai — the product system

- H1/H2: Skandia 36px, −1.08px tracking, lh 1.2
- H3: Skandia 20px, −0.2px, lh 1.2
- Body/lede: Skandia 16px, −0.16px, `#191919` at 56% opacity
- Product-embedded UI (chat bubbles, diffs, code in demos): **Inter 14px**, **IBM Plex Mono 12px** — the "inside the product" voice is deliberately different from the marketing voice.
- Fluid scale: `clamp()` pairs like `--fluid-36-60`, `--fluid-22-40` — type scales smoothly, no breakpoint jumps.

### What we adopt

We don't have licenses for NB International, STK Bureau Serif, or Skandia. Open stand-ins that preserve the *feel*:

| Their face | Open stand-in | Why |
| --- | --- | --- |
| NB International Pro | **Geist** (or Inter with −0.02em tracking) | Neutral grotesk, similar x-height and restraint |
| STK Bureau Serif | **Literata** or **Source Serif 4** | Book serif, warm paper feel |
| Geist Mono / IBM Plex Mono | **Geist Mono** or **JetBrains Mono** | Free, same mechanical character |

## 4. Color

Cognition's palette is a whitelist, not a spectrum:

| Token | Value | Use |
| --- | --- | --- |
| paper | `#F7F6F5` | Ground, ~90% of the page |
| ink | `#000000` | Text, outlines, logos |
| button | `#191919` | Solid buttons only |
| accent | `#2200FF` | Active nav item, single key action — **<1% of pixels** |
| secondary | `#7B7A7A` / `#191919` at 56% | Dates, section numbers, footer |
| hairline | `#E8E7E6` / black at 6–8% | Grid lines, card borders, rules |
| surface tint | `#F2F1F0` | Logo wall / inset panels |

devin.ai adds a semantic layer for the product: `--bg-page #FCFCFC`, `--bg-elevated #FFF`, borders at 6–8% black, `--text-accent-primary` blue `rgb(49,124,255)`, and status colors kept *semantic* (diff green/red, destructive `rgb(176,0,32)`), never decorative.

**Rule of thumb:** color is information. If a pixel isn't ink-on-paper, it should be answering "what state is this?" — active, danger, diff-added, diff-removed — or it's the one blue accent.

## 5. Layout and space

- **Exposed column grid.** cognition.com runs visible vertical hairlines — you can see the page's skeleton. Sections hang on it; a section number (`01`–`05`) sits in the gutter.
- **Numbered sections.** `01 Introducing FrontierCode`, `02 …` — sections are enumerated like a paper, which makes long pages navigable and quietly technical.
- **Generous vertical rhythm.** `--spacing-section: 88px`–`180px`; devin.ai uses fluid clamps up to `12.5rem` between major sections. Sections are separated by hairline rules (`border-y` at 6% black), not by background color blocks.
- **Constrained measure.** Body text ~15px at ~65ch; wide elements (tables, leaderboards, logo walls) get the full grid.
- **Asymmetry in the old system** (IBM Plex era): heroes used a three-zone split — headline left third, descriptor center, CTAs right third — with content floating over full-bleed texture. The new system is more centered and editorial; the old asymmetry is still worth stealing for dashboards.

## 6. Signature elements

These are the things that make a Cognition page identifiable at a glance:

1. **The bracketed label.** `[CAREERS]`, `[GTM]`, `[DEVIN]` — monospace, small, literal square brackets in the text. From the old site, still echoes in how they tag and label. *Use it for: status chips, queue filters, environment tags.*
2. **Section numbers in the gutter.** `01`, `02`, `03` in 10px serif. *Use it for: step indicators, audit-stage markers, settings sections.*
3. **The numbered data table.** The FrontierCode leaderboard is the canonical Cognition component: `#` rank, thin rows, tabular numbers, sortable column headers marked with `▼`, meta text in grey beside values (e.g. reasoning effort next to model names). No card chrome — the table *is* the design.
4. **Evidence blocks.** Embedded terminal/code (IBM Plex Mono 12px, 1px border, small radius), Slack message captures with their own token set (`--slack-*` variables exist for author `#1B1B1B`, muted `#616061`, code `#E01E5A`, link `#088BD7`), screen-recording videos, and score-vs-cost scatter charts. *Use it for: our audit log, approval trails — show the real event, don't summarize it into a badge.*
5. **Square vs. pill as a signal.** cognition.com buttons are square (radius 0) — document-like; devin.ai buttons are pills — product-like. Pick one per surface and stay consistent: we use **square** for platform chrome (it matches the editorial system) and keep pills, if any, inside app-level interactive elements.
6. **Mono for metadata.** Dates (`YYYY.MM.DD`), counts, locations, footers — anything factual goes monospace 11–12px with −0.12px tracking and 56% ink. This single habit does more to make a UI feel "Cognition" than any color.

## 7. Voice and content design

The UI is inseparable from the copy:

- **Write as "we", to "you".** Company pages speak as the company; product copy addresses the reader.
- **Sentence case, no exclamation marks.** Section heads are sentence case with no trailing period; the hero statement is a full sentence *with* a period. Announcement titles are Title Case, usually `Introducing X` or `X: subtitle`.
- **Long, connected sentences.** Homepage paragraphs run 25–40 words with dashes and serial commas — measured, not punchy. No stat brags in prose; numbers live in tables and titles.
- **Dates as `YYYY.MM.DD`.**
- **No marketing adjectives.** "Frontier-size model with hundreds of billions of parameters… 950 tok/s — 6x faster than Haiku 4.5" is a launch headline because it cites a number, not because it says "blazing fast".

## 8. Launch-page anatomy (the repeatable pattern)

Across SWE-1, SWE-1.5, SWE-2/2.1, Devin Bots, Devin Review 2.0, FrontierCode — the same skeleton:

1. **Title**: `Introducing X` or `X: subtitle`.
2. **Byline**: `Cognition` + date `YYYY.MM.DD` + `N min read` — mono metadata.
3. **Opening paragraph**: what it is and why it matters, in the "we built…" voice. No hype; usually a concrete number in the first paragraph (`up to 950 tok/s`, `82% cheaper`, `44 days later`).
4. **Proof artifact near the top**: video/terminal capture, benchmark chart, or Slack screenshot of the thing actually working.
5. **Numbered `###` sections** explaining mechanism: why it matters → how it works → what changed → how to get it.
6. **A table or chart** wherever a comparison exists (cost curves, leaderboards).
7. **Closing CTA**: a short, factual invitation — `Download the latest version of Windsurf`, `Try Devin` — never a "Learn more" graveyard.

## 9. What this means for this platform

Concrete applications for `platform/` and `apps/kyc/`:

**Tokens (to land in `globals.css` / Tailwind theme):**

| Token | Value | Role |
| --- | --- | --- |
| `--color-paper` | `#F7F6F5` | app background |
| `--color-ink` | `#111111` | text (we stay slightly softer than pure black for internal screens) |
| `--color-ink-muted` | `#111111` @ 56% | metadata, secondary text |
| `--color-hairline` | `#111111` @ 8% | borders, dividers — always hairlines, never shadows for structure |
| `--color-accent` | `#2200FF` | one active/primary signal at a time |
| `--color-danger` | `#B00020`-ish | semantic only |
| `--font-display` | `Geist`, system-ui | heads, nav, buttons, tables |
| `--font-body` | `Literata`, Georgia | long-form reading (case notes, policy text) |
| `--font-mono` | `Geist Mono`, ui-monospace | IDs, dates, amounts, audit entries, all metadata |

**Component rules:**

- Tables are the hero component — thin rows, tabular-nums, sortable headers, grey meta beside values, no card wrappers. A KYC queue should look like the FrontierCode leaderboard, not like a CRM demo.
- Status and risk chips use the bracketed-label pattern: `[HIGH RISK]`, `[PEP]`, `[2-PERSON REVIEW]` — mono, uppercase, literal brackets.
- Approval states read like audit entries: `2026.11.25 14:02 — jsmith approved — riskScore 84` in mono, not colored badges everywhere.
- Buttons: square, 1px ink outline or solid ink fill; primary action uses ink (or the one accent), never both on one screen.
- Numbers: always tabular figures; money/percentages right-aligned in tables.
- Section headers in settings/admin pages get gutter numbers.
- Metadata (timestamps, actor IDs, request IDs) is always mono 12px at 56% ink.
- No decorative color, no gradients, no drop shadows for structure (hairlines do that work); a subtle shadow only for floating layers (menus, dialogs) à la devin.ai's `--shadow-L*`.

**Copy rules for the UI:**

- Sentence case everywhere except proper nouns; buttons are short imperatives (`Approve`, `Request documents`, `Escalate`).
- Confirmation and error copy in the "we/you" voice, factual, no exclamation marks.
- Dates `YYYY.MM.DD`, times `HH:MM` 24h, mono.

## 10. Sources

Measured live 2026-11-25:

- `cognition.com` home, `/about`, `/research`, `/blog`, `/frontiercode` — CSS custom properties and computed styles
- `devin.ai` home, `/blog/*` (SWE-1.5, Devin Bots, Devin Review 2.0, Teams plan, more-efficient-devin), `/bots`, `/security`, `/brand`
- `old.cognition.ai` — legacy blog (surviving IBM Plex / bracketed-label system)

Third-party audits (labelled *reported* above):

- fudge.design — [cognition.ai design analysis](https://fudge.design/share/cognition.ai-design) (legacy IBM Plex system)
- unfairly.ai — [Cognition brand book & build spec](https://www.unfairly.ai/brand-guidelines/cognition/spec.md) (unofficial; confirmed against live CSS)
