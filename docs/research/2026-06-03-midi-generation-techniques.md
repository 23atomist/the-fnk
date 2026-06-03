# MIDI Generation Techniques for Musically Excellent LLM Output

**Date:** 2026-06-03
**Purpose:** Concrete, actionable musical knowledge for prompt-driven MIDI generation (drums + melody/bass) in an Ableton Live extension. Note model: `pitch` 0-127, `startTime` (beats), `duration` (beats), `velocity` 0-127.

> **Sourcing note (important / honesty):** In this run, all web-fetch, web-search, and shell/`curl` tools were denied by the sandbox, so I could **not** pull live pages or attach freshly-fetched citations as requested. The numbers below are synthesized from well-established music-production literature and tooling defaults that I know reliably: the **Attack Magazine** "Beat Dissected" / drum-programming series, **Sound on Sound** technique columns, **Ableton's** Groove Pool / swing documentation, the **MPC / Akai** swing-percentage convention, **Native Instruments** Battery/Maschine humanize defaults, **Toontrack/EZdrummer** velocity layering docs, and standard music-theory references (scales/modes, voice-leading). Where a figure genuinely varies between sources I flag it. **Before shipping, spot-check the swing-percentage mapping and the genre step tables against a live source** — those are the two places small discrepancies matter most. The grid conventions and velocity ranges are stable and widely agreed.

A `beat` below = one quarter note. A 1-bar 4/4 pattern = 4 beats = 16 sixteenth-note steps. **Step `s` (0-indexed, 0-15) → `startTime = s * 0.25` beats.** A 32nd note = 0.125 beats. At tempo BPM, **1 beat = 60000/BPM ms**, and **one 16th step = 15000/BPM ms** (e.g. at 120 BPM a 16th = 125 ms; at 90 BPM = 166.7 ms).

---

## 1. Drum Velocity Dynamics & Humanization

### 1.1 Velocity tiers (general, the load-bearing numbers)

Use these as the backbone for every drum part. Velocities are 0-127.

| Role | Velocity range | Center | Notes |
|---|---|---|---|
| **Accent / downbeat hit** | 112-127 | 120 | The strongest hits: beat-1 kick, backbeat snare, crash, the "1". |
| **Normal / primary hit** | 95-110 | 100 | Standard kicks and on-grid hats that aren't accents. |
| **Secondary hit** | 75-95 | 85 | Supporting hats, secondary kicks, rides. |
| **Soft / unaccented** | 55-75 | 65 | The quiet half of a hat pattern, filler notes. |
| **Ghost note** | 10-40 | 25 | Snare ghosts especially; barely audible, felt not heard. |
| **Very faint ghost** | 5-20 | 12 | Buzz/flam tails, brush detail. |

Rules of thumb:
- **Keep a spread.** A pattern where everything is 100 sounds like a machine. Aim for a realized velocity *range of at least 30-40 points* across a part.
- **Accents should be ~20-35 points above** the surrounding normal hits to read as accents.
- **Ghost notes must be ~50-80 points below** the backbeat they sit around, or they stop sounding like ghosts.

### 1.2 Kick & snare

- **Kick:** main/downbeat kicks 105-120; syncopated/secondary kicks 90-105. In electronic genres (house/techno) the four-on-floor kick is often nearly constant (110-120) by design — the *kick* is the metronome; humanization happens in the hats and percussion instead.
- **Snare backbeat (rock/pop/hip-hop):** 105-120. The backbeat is usually the loudest recurring event after the downbeat.
- **Snare ghost notes:** 10-35, placed on weak 16ths around the backbeat (see 1.4).
- **Rimshot/cross-stick** as a softer backbeat (lo-fi, boom-bap): 70-95.

### 1.3 Accent patterns by genre — which beats get the emphasis

Beats are counted 1, 2, 3, 4 with "&" = the eighth-note off, "e/a" = the 16ths.

| Genre | Primary accents | Feel |
|---|---|---|
| **House (4/4)** | Kick on every beat (1,2,3,4) all strong; **open hat / clap accent on the off-beats (the "&" of every beat, i.e. 8th-note offbeats)**. | Driving, the offbeat open hat is the signature. |
| **Techno** | Kick on 1,2,3,4 strong; accents pushed onto **16th-note ghost hats and offbeat percussion**; clap/snare often on 2 and 4 but sometimes only on 2&4 of alternating bars. | Hypnotic; accents are subtle and percussion-driven. |
| **Trap / Hip-hop** | Kick syncopated (1 and a push around 3); **snare/clap hard on beat 3** (half-time backbeat) — beat 3 is THE accent; hats carry rolls with rising velocity. | Half-time; the "3" snare is the anchor. |
| **Boom-bap (classic hip-hop)** | **Snare on 2 and 4** (strong, often slightly behind the beat); kick on 1 and a syncopated second kick; swung 16th hats. | Laid-back, behind-the-beat snare. |
| **Drum & Bass** | **Snare on beat 3** (the "2 and 4" of the half-time-felt break → lands on the 3 of the bar), kick on 1 and a ghost kick around the "&" of 2 / before the snare; "Amen"-style ghost snares between. | Fast (160-175 BPM), syncopated breakbeat. |
| **Rock** | **Snare backbeat on 2 and 4** (loudest), kick on 1 and 3 (+ pickups), hats steady with a light accent on downbeats. | Backbeat-driven. |

General accent principle across all genres: **emphasize beat 1 most, then the backbeat, then the "&" offbeats; weak 16ths (the "e" and "a") stay quietest** unless you are deliberately building a roll.

### 1.4 Hi-hat velocity variation (the single highest-impact humanization for electronic drums)

Hats are where machine vs. human is most audible. Techniques, with concrete 16th-note velocity sequences (16 steps, left→right):

**A. Alternating loud/soft ("every other hat")** — the classic. On-beat 16ths louder, off 16ths softer:
```
100  60  90  55  100  60  90  55  100  60  90  55  100  60  90  55
```
Downbeats (steps 0,4,8,12) get an extra few points. Spread ~40-50 points between loud and soft.

**B. Downbeat accent, gentle drift** — accent the four quarter positions, everything else mid with small random drift:
```
110  72  78  68  105  70  82  66  108  74  80  70  106  71  79  69
```

**C. Crescendo into the downbeat (builds momentum):**
```
70  78  88  100 | 70  80  90  102 | 72  82  92  104 | 74  84  94  108
```
(grouped per beat; each group rises toward the next downbeat)

**D. Trap hat rolls** — when subdividing into 1/8, 1/16, 1/32 triplet rolls, ramp velocity across the roll, e.g. a 6-note roll: `60 70 80 90 100 110`, and vary roll *length* per bar.

Rules:
- Never use a single constant hat velocity. Minimum: a two-value alternation.
- Put the loudest hat on the downbeat or the offbeat, depending on genre (house = offbeat open hat loud; rock = downbeat closed hat slightly accented).
- Occasionally drop a hat entirely (rest) for groove — see syncopation.

### 1.5 Ghost notes (snare especially)

- **Where:** weak 16th positions *around* the backbeat — typically the "e" and "a" subdivisions adjacent to beats 2 and 4 (steps like 3, 5, 7, 11, 13 in a 16-step bar), and the "&" of 1 and 3.
- **Velocity:** 10-40, center ~25. They should sit ~50-80 below the main snare.
- **Density:** 1-4 ghost notes per bar for subtlety; more (Amen-style) for D&B/funk.
- A common funk/boom-bap move: main snare on 2 and 4 (110), with ghost snares at velocity 20-30 on the 16ths just before/after.

### 1.6 Timing humanization (jitter)

Apply small random timing offsets so notes don't all land exactly on the grid. Ranges that sound human, not sloppy:

| Intensity | Timing jitter (± ms) | ± beats (at 120 BPM) | Use |
|---|---|---|---|
| **Tight / subtle** | ±3-8 ms | ±0.006-0.016 | Modern electronic, keeps it crisp. |
| **Natural** | ±8-15 ms | ±0.016-0.030 | General "played-in" feel. |
| **Loose / human** | ±15-25 ms | ±0.030-0.050 | Live-drummer, funk, jazz. |
| **Sloppy (avoid)** | >30 ms | >0.060 | Sounds like a mistake. |

Convert ms → beats: `offsetBeats = offsetMs * BPM / 60000`.

Refinements that beat pure random jitter:
- **Keep the kick and downbeats tightest** (±0-5 ms). Let hats and ghosts drift more.
- **Correlated push/pull, not per-note random:** real drummers play slightly *ahead* (rushing, e.g. -5 to -10 ms) on energetic sections or *behind* (laid-back, +10 to +20 ms on the snare for boom-bap/lo-fi). A consistent small offset per *instrument* sounds more musical than independent noise per note.
- **Snare slightly behind** (+5 to +15 ms) = laid-back/hip-hop; **snare slightly ahead** = aggressive/punk.

### 1.7 Velocity jitter

- Add **±5 to ±12** random velocity to each hit *on top of* its tier center. This keeps repeated identical hits from sounding sampled/static.
- Don't let jitter cross tier boundaries (a ghost at 25 ± 12 is fine; don't let it jump to 80).
- Bias the jitter so accents trend up and ghosts trend down (asymmetric noise) to preserve the dynamic shape.

### 1.8 Swing / shuffle

Swing delays the **off-beat** notes (the second note of each pair). Conventionally applied to **8th notes** or **16th notes** depending on genre. The MPC/Akai percentage convention (also used by Ableton's groove amounts, Logic, FL Studio) maps as follows — percentage = where the off-beat note lands between two on-beat notes:

| Swing % | Off-beat position | Feel | Maps to |
|---|---|---|---|
| **50%** | exactly halfway | straight, no swing | even subdivision |
| **54%** | slightly late | subtle groove | +8% of the subdivision late |
| **57-58%** | "light swing" | tasteful, common in house/hip-hop | — |
| **62%** | noticeably late | medium shuffle | classic MPC hip-hop swing |
| **66-67%** | ~2:1 ratio | hard triplet shuffle (jazz, shuffle blues) | off-beat lands on the last third of a triplet |
| **75%** | very late | extreme/dotted, rarely musical | — |

**The math (load-bearing):**
- For a subdivision of length `D` beats (8th = 0.5, 16th = 0.25), the off-beat note's start moves from `D/2` to `swing% * D` of the way through the pair.
- **Delay added to the off-beat note** = `(swing% - 50%) * D / 50%`... simpler form: `offBeatStart = pairStart + (swing/100) * (2D)` where `2D` is the full pair length. Equivalent: **delay in beats = (swing/100 - 0.5) * 2D**.
  - Example, **16th-note swing at 62%, D = 0.25** (pair length 0.5): off-beat delay = `(0.62 - 0.5) * 0.5 = 0.06 beats` → at 120 BPM, `0.06 * 500 ms = 30 ms` late.
  - Example, **8th swing at 66%, D = 0.5** (pair length 1.0): delay = `(0.66 - 0.5) * 1.0 = 0.16 beats` → at 120 BPM = 80 ms late.
- **66.7% on 8th notes ≈ true triplet swing** (the off-beat lands on the 3rd triplet of the beat: 2/3 of the way = 0.667).

Genre swing guidance:
- **House:** 8th-note swing 50-56% (subtle) or 16th swing 54-58%.
- **Hip-hop / boom-bap:** 16th swing 55-66%; the MPC "62%" is iconic.
- **Garage (UK):** heavy 16th swing 60-66%.
- **Jazz / shuffle:** 8th swing 62-67% (toward triplet feel).
- **Techno / D&B:** usually straight (50%) or very light; groove comes from velocity and ghost placement, not swing.

> Apply swing only to the off-beat notes (the "&" for 8th swing; the "e"/"a" for 16th swing). Often you also drop the **velocity** of the swung note slightly (-5 to -15) — that combination is what reads as "groove."

---

## 2. Genre-Specific Drum Pattern Templates (16-step grid)

Grid = 16 sixteenth steps, step 0 = beat 1. `K`=kick, `S`=snare/clap, `H`=closed hat, `O`=open hat. Numbers in parentheses are suggested velocities. Steps listed are 0-indexed.

Step ruler:
```
 0   1   2   3   4   5   6   7   8   9  10  11  12  13  14  15
 1   e   &   a   2   e   &   a   3   e   &   a   4   e   &   a
```

### 2.1 House (120-128 BPM)
- **Kick:** 0, 4, 8, 12 (four-on-the-floor) — vel ~115 each.
- **Clap/Snare:** 4, 12 (beats 2 and 4) — vel ~110.
- **Closed hat:** 2, 6, 10, 14 (offbeat 8ths) OR all 8 offbeat+onbeat 16ths with alternation — vel alternating 90/65.
- **Open hat:** 2, 6, 10, 14 (the offbeats — the signature "tss" on the &) — vel ~95. (Choke against next closed hat.)
- Optional shaker/perc on 16ths with the alternating velocity pattern from 1.4.A.

### 2.2 Techno (125-140 BPM)
- **Kick:** 0, 4, 8, 12 — vel ~118, very steady.
- **Clap:** 4, 12 (sometimes only 12, or only on alternating bars) — vel ~105.
- **Closed hat:** offbeats 2, 6, 10, 14 — vel ~85; add 16th ghost hats at 1,3,5,7,9,11,13,15 vel 40-60 for drive.
- **Open hat:** 2, 6, 10, 14 — vel ~90.
- Percussion/ride: syncopated 16ths, low velocity (50-70), this is where the groove lives.

### 2.3 Trap / Hip-hop (130-150 BPM, *felt* half-time ≈ 65-75)
- **Kick:** 0, 6 or 7, 10 (syncopated; common: 0, 6, 10) — vel 110, secondary kicks ~95. The kick "bounces" — booming 808 kick often on 0 and a syncopated push.
- **Snare/Clap:** **8 (beat 3)** — the half-time backbeat, vel ~115. This is the anchor.
- **Closed hat:** all 16 steps (straight 16ths) with velocity variation; insert **rolls** (32nd/triplet subdivisions) on 1-2 steps per bar, ramping velocity 60→110.
- Hats define the genre: use the crescendo (1.4.C) or roll (1.4.D) patterns. Triplet hats are common.

### 2.4 Drum & Bass (160-175 BPM)
- **Kick:** 0, and a second kick around 10 (the "&" of 3) — vel ~112 / 100.
- **Snare:** **8 (beat 3)** main backbeat, vel ~115; plus **ghost snares** at 3, 11, 13 (vel 20-35) for the breakbeat "Amen" feel.
- **Closed hat:** 16ths, often with light swing and velocity alternation; rides/hats at 80/55.
- **Open hat:** occasional on 6 or 14, vel ~85.
- The breakbeat is heavily about ghost-snare placement and velocity contrast.

### 2.5 Boom-bap (classic hip-hop, 85-95 BPM)
- **Kick:** 0, 3 or 10 (a syncopated second kick, e.g. the "a" of 1 = step 3, or the "&" of 3 = step 10) — vel ~110 / 95.
- **Snare:** **4 and 12 (beats 2 and 4)**, vel ~110, placed **slightly behind** the grid (+10-20 ms). Often a rimshot.
- **Ghost snares:** 7, 11, 15 (vel 20-30).
- **Closed hat:** 8th notes (0,2,4,6,8,10,12,14) or swung 16ths, vel ~80 with alternation, **16th swing 55-62%**.
- Laid-back, dusty: the behind-the-beat snare + swing + velocity humanization are the whole vibe.

### 2.6 Rock (100-140 BPM) — for completeness
- **Kick:** 0, 8 (beats 1 and 3) + pickups (e.g. 6 or 10) — vel ~110.
- **Snare:** 4, 12 (beats 2 and 4), vel ~115.
- **Closed hat:** straight 8ths (0,2,4,6,8,10,12,14), vel ~85 with a small downbeat accent; or 16ths for busier feel.
- **Crash:** step 0 of section starts, vel ~120.

---

## 3. Melody & Bassline Generation

### 3.1 Scales / modes and their moods

Build pitches from a scale relative to a root (root = tonic MIDI note). Intervals in semitones from the root:

| Scale / mode | Intervals (semitones) | Mood / use |
|---|---|---|
| **Major (Ionian)** | 0 2 4 5 7 9 11 | Happy, bright, resolved (pop, anthemic). |
| **Natural minor (Aeolian)** | 0 2 3 5 7 8 10 | Sad, serious, dark — default for most electronic/EDM. |
| **Dorian** | 0 2 3 5 7 9 10 | Minor but hopeful/cool (jazz, funk, house, "minor with a lift"); the raised 6th is the signature. |
| **Phrygian** | 0 1 3 5 7 8 10 | Dark, Spanish/exotic, tense (the b2 is dramatic); trap, metal, flamenco. |
| **Phrygian dominant** | 0 1 4 5 7 8 10 | Exotic/Middle-Eastern, aggressive. |
| **Mixolydian** | 0 2 4 5 7 9 10 | Bluesy, dominant, funky (the b7 over a major 3rd). |
| **Lydian** | 0 2 4 6 7 9 11 | Dreamy, floaty, cinematic (the #4). |
| **Harmonic minor** | 0 2 3 5 7 8 11 | Dramatic, classical, neoclassical. |
| **Minor pentatonic** | 0 3 5 7 10 | Safe, bluesy, hard to play a "wrong" note — great default for leads/solos. |
| **Major pentatonic** | 0 2 4 7 9 | Bright, folk, East-Asian flavor; very consonant. |
| **Blues** | 0 3 5 6 7 10 | Bluesy/gritty (pentatonic + b5 "blue note"). |

Defaults: for moody electronic, **natural minor or Dorian**; for trap/dark, **Phrygian or harmonic minor**; for safe melodic improvisation, **minor pentatonic**.

### 3.2 Melodic contour principles

- **Motif + repetition + variation.** State a short motif (2-4 bars, 3-7 notes). Repeat it (literal repetition is *good* — it creates memorability), then vary it: transpose up/down within the scale, change one or two notes, extend or truncate the rhythm, invert the contour. Rule of thumb across a phrase: **~60-70% repetition/familiar material, ~30-40% variation.**
- **Call and response.** Phrase A (the "call", often rising or ending unresolved) followed by phrase B (the "response", often answering with a downward or resolving contour). Common over 4+4 or 2+2 bars.
- **Arc / contour shape.** Give a phrase a shape: rise to a peak then fall, or fall then rise. Avoid aimless wandering. There should be **one clear high note (the climax) per phrase** — don't hit the top note repeatedly.
- **Tension and release.** Build tension with non-chord tones, higher register, rising lines, and rhythmic density; release by landing on a chord tone (especially the root or 5th) on a strong beat, lower register, longer note.
- **Leaps vs steps.** Predominantly **stepwise motion (~70-80% steps**, i.e. moves of 1-2 scale degrees); use **leaps (3rds, 4ths, 5ths, octaves) sparingly (~20-30%)** for interest. **After a large leap (4th+), reverse direction and move by step** — this is a core voice-leading rule that makes lines sound intentional. Avoid multiple consecutive large leaps in the same direction.
- **Range:** keep a single melodic phrase mostly within an **octave to a 10th**; wider ranges feel disjointed unless deliberate.

### 3.3 Rhythmic interest

- **Use rests.** Silence is a note. A melody that plays on every beat is exhausting; leave gaps, especially at phrase ends (let the phrase "breathe" for a beat or two).
- **Note-length variation.** Mix durations: e.g. mostly 8ths and 16ths punctuated by a held quarter/half at phrase ends. Avoid all-equal note lengths (the #1 robotic tell for melodies).
- **Syncopation.** Place some accented notes on off-beats (the "&" or the "e/a") and tie across beats. Anticipations (a note landing an 8th *before* the downbeat and holding through it) are very effective.
- **Rhythmic motif.** Reuse a rhythmic cell even when pitches change — rhythm is as memorable as pitch.

### 3.4 Chord tones vs passing tones (strong vs weak beats)

- **Strong beats (1 and 3, and the downbeat of each beat) → chord tones** (root, 3rd, 5th, 7th of the current chord). This anchors the harmony.
- **Weak beats / off-beats (the "&", "e", "a") → passing tones and neighbor tones** (non-chord scale tones that connect chord tones by step). They create motion and are quickly resolved.
- **Resolve non-chord tones by step**, usually to the nearest chord tone, ideally on the next strong beat.
- The strongest, most "resting" notes are the **root and 5th**; the **3rd** defines major/minor color; the **7th** and tensions (9, 11, 13) add sophistication and want to resolve.

### 3.5 Bassline conventions

- **Root emphasis.** The bass should play the **root of the current chord on the downbeat** of each chord change (or each bar). This is the single most important bass rule — it defines the harmony.
- **Lock to the kick.** The bass rhythm should relate to the kick drum: in EDM/house, bass often plays the **off-beats between kicks** (kick on beats, bass on the "&") to avoid clashing — the "rolling" bassline. In trap, the 808 *is* the kick (bass and kick are one). In rock/funk, the bass often doubles or answers the kick.
- **Octave jumps.** A classic bass move is root → root-up-an-octave (e.g. on the "&") and back. Adds energy without changing harmony. Common in house, disco, techno.
- **Movement:** mostly roots and 5ths; approach the next chord's root by step or by a chromatic/scale **walk-up or walk-down** (great in the last beat before a chord change). Passing tones between chord roots.
- **Keep it simple.** Basslines are usually less busy than melodies; a strong repeating rhythmic figure beats a noodly bass.

### 3.6 Velocity dynamics for melodies/bass

- **Accent phrase starts and downbeats:** first note of a phrase and notes on strong beats ~100-115.
- **Mid-phrase / passing notes:** ~80-95.
- **Off-beat / weak notes:** ~70-85.
- **The climax / peak note** of a phrase can be the loudest (~110-120) for emphasis.
- Add **±5-10 velocity jitter** so repeated notes aren't identical.
- For bass: downbeat root notes loudest (~105-115); ghost/passing notes softer (~75-90). Synth bass often near-constant by design, but acoustic/finger bass benefits from the same accenting as melody.

### 3.7 Octave / pitch ranges (MIDI note numbers; C3 = MIDI 60 in the C3-convention; ranges given as MIDI numbers)

| Part | MIDI range | Notes (octaves) | Comment |
|---|---|---|---|
| **Sub bass** | 24-43 | C1-G2 | Below ~40 Hz is felt not heard; keep sub mono. |
| **Bass** | 28-48 | E1-C3 | Core bass register; most basslines live 36-48. |
| **Lead / melody** | 60-84 | C4-C6 | Sits above the vocal range, cuts through. |
| **Mid melody / vocal-range** | 55-72 | G3-C5 | Warmer, "singable". |
| **Pad / chords** | 48-72 | C3-C5 | Mid register; avoid muddiness below ~48 with wide voicings. |
| **Plucks / arps** | 60-88 | C4-E6 | Bright, can go high. |

Avoid stacking bass and pads in the same low octave (mud). Keep at least an octave separation between the bass and the chord voicing's lowest note.

---

## 4. "Make It Not Sound Like a Robot" Checklist

Highest-impact rules, ordered by impact:

1. **Vary velocity — always.** Never repeat the same velocity for repeated hits/notes. Hi-hats especially must alternate or drift (spread ≥30-40 points). This is the #1 fix.
2. **Add accents.** Make downbeats and backbeats clearly louder (20-35 points) than surrounding hits. Give every phrase one peak.
3. **Add ghost notes** (vel 10-40) on weak subdivisions around the snare — instant "human drummer".
4. **Apply timing jitter** of ±8-15 ms (natural) — but keep the kick/downbeats tight; let hats and ghosts drift more. Consider a consistent per-instrument push/pull (snare slightly behind = laid-back).
5. **Swing the off-beats** where the genre calls for it (54-62% for house/hip-hop), and drop the swung note's velocity slightly.
6. **Use rests and varied note lengths** in melodies — don't play on every beat; don't make every note the same length.
7. **Stepwise melodic motion (~70-80%)**, leaps sparingly, and reverse direction after a leap.
8. **Chord tones on strong beats, passing tones on weak beats**, resolve non-chord tones by step.
9. **Root of the chord in the bass on the downbeat**; lock bass rhythm to the kick.
10. **Repeat then vary** a motif (don't generate 16 bars of unrelated material; don't loop one bar 16x identically either).
11. **Don't quantize everything to a flat grid** — perfect quantization + constant velocity is the definition of robotic.
12. **Leave space.** Density should rise and fall (verse vs drop). Not every track/instrument plays all the time.

### Lightweight deterministic post-processing (apply after LLM generation)

These are cheap, deterministic passes that enforce the above even if the LLM output is too rigid:

- **Velocity humanizer:** add `randint(-8, +8)` to every velocity, clamped to its role's range; bias accents up, ghosts down.
- **Hat alternation enforcer:** if a hat lane has near-constant velocity, impose the loud/soft alternation (1.4.A).
- **Timing humanizer:** add `uniform(-J, +J)` beats per note where `J = jitterMs * BPM / 60000`; use smaller J for kicks/downbeats.
- **Swing pass:** for the target subdivision, delay every off-beat note by `(swing/100 - 0.5) * 2 * D` beats.
- **Accent pass:** boost velocity of notes on beats 1 (and backbeat) by +15-25 if not already accented.
- **Velocity-spread guard:** if (max - min) velocity in a part < 25, scale velocities away from the mean to widen the range.

---

## Quick-reference cheat sheet (for embedding in the system prompt)

```
VELOCITY TIERS: accent 112-127 | normal 95-110 | secondary 75-95 | soft 55-75 | ghost 10-40
GRID: step s -> startTime = s*0.25 beats; 16 steps = 1 bar of 4/4
HATS: never constant; alternate loud/soft ~100/60; accent downbeats
GHOSTS: snare, weak 16ths near backbeat, vel ~25
TIMING JITTER: +-8..15 ms (= +-BPM*ms/60000 beats); keep kick tightest
SWING: offbeat delay = (swing/100 - 0.5) * 2 * subdivLen beats; house/hiphop 54-62%
MELODY: 70-80% steps, leaps sparingly + reverse after leap; chord tones on strong beats;
        motif + repeat + vary; use rests; one climax per phrase
BASS: chord root on downbeat; lock to kick; octave jumps; mostly roots & 5ths
RANGES (MIDI): sub 24-43 | bass 28-48 | pad 48-72 | melody 60-84
GENRE KICKS: house/techno = steps 0,4,8,12 | trap snare = step 8 | boombap snare = steps 4,12
```

---

## Sources (from training knowledge; NOT freshly verified in this run)

The conventions above are the consensus found across these standard references. Live citations could not be fetched (network tools were sandbox-denied):

- **Attack Magazine** — "Beat Dissected" series and drum-programming / velocity-humanization tutorials (genre step patterns, ghost notes, hat velocity techniques).
- **Sound on Sound** — programming-drums and groove/swing technique articles.
- **Ableton Live manual** — Groove Pool, swing/timing and velocity-randomization documentation; Push step-sequencer conventions.
- **Akai MPC / FL Studio / Logic** swing-percentage convention (50% straight, 62% classic hip-hop swing, 66.7% ≈ triplet).
- **Toontrack / EZdrummer / Superior Drummer** velocity-layer and humanization documentation (ghost-note velocity ranges, accent layering).
- **Native Instruments Battery / Maschine** "Humanize" and velocity-randomization defaults.
- Standard music-theory references on **modes/scales, voice-leading (step-after-leap), and chord-tone vs passing-tone placement** (e.g. common-practice harmony texts; Mark Levine-style jazz-theory conventions for modal moods).

> **Recommended verification before shipping:** cross-check the **swing-percentage → timing-offset** formula and the **genre 16-step tables** against a live Attack Magazine / Ableton source, since those are the two areas where a small error would be audible. Velocity tiers, the step-after-leap rule, and chord-tone placement are stable and safe.
