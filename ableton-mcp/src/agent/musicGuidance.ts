/**
 * Musical guidance injected into the generation prompt. Kept separate from prompt
 * plumbing so the craft knowledge can be tuned without touching the workflow text.
 * All velocities are MIDI 0-127; all times are in beats (1 bar of 4/4 = 4 beats,
 * one 16th-note step = 0.25 beats, so grid step s → startTime = s * 0.25).
 *
 * Numbers distilled from standard drum-programming / music-theory practice; see
 * docs/research/2026-06-03-midi-generation-techniques.md for the full rationale.
 */

/** Drum programming: pitches, velocity tiers, accents, ghosts, hats, humanization. */
export const DRUM_GUIDANCE = [
  "DRUMS — General MIDI pitches: kick 36, side-stick 37, snare 38, clap 39, low-tom 41, closed-hat 42, open-hat 46, ride 51, crash 49.",
  "Velocity is what makes a beat breathe — never leave it flat. Keep a realized spread of at least 30-40 points across a part. Tiers:",
  "  • Accent (beat-1 kick, backbeat snare/clap, crash): 112-127. Accents should sit ~20-35 above the surrounding normal hits.",
  "  • Normal hit: 95-110.   • Secondary (supporting hats/kicks/rides): 75-95.   • Soft (quiet half of a hat pattern): 55-75.",
  "  • Ghost note (quiet snare/hat detail, felt not heard): 10-40 — must sit ~50-80 below the backbeat it surrounds.",
  "Hi-hats are where machine-vs-human is most audible: NEVER use one constant hat velocity. Minimum is a two-value alternation, e.g. on-beat ~100 / off-beat ~60 across the 16ths, accent the downbeats a few points higher, and drop the odd ghost (~40). A crescendo into each downbeat (e.g. 70→100 per beat) also works well.",
  "Snares/claps land on the backbeat and get accented. Sprinkle 1-4 ghost snares per bar on weak 16ths just before/after the backbeat (vel ~25) for groove.",
  "Humanize: add ±5-12 velocity jitter to every hit (bias accents up, ghosts down, never crossing tier boundaries). Nudge non-downbeat starts by up to ±0.02 beats; keep the main kick/downbeats tight on the grid. Identical repeated velocities are the #1 robotic tell.",
  "Swing (house/hip-hop feel): delay every off-beat note by (swing/100 - 0.5) * 2 * subdivLen beats — e.g. 16th swing at 60% = (0.10)*0.5 = 0.05 beats late — and drop that note's velocity ~5-15. Use 54-62% for house/hip-hop; techno & D&B are usually straight.",
  "Genre starting points on a 16-step bar (step s → startTime s*0.25):",
  "  • House (120-128 BPM): kick 0,4,8,12 (~115); clap/snare 4,12 (~110); open-hat on off-beats 2,6,10,14 (~95, the signature); closed-hats on 16ths with loud/soft alternation.",
  "  • Techno (125-140): steady kick 0,4,8,12 (~118); clap 4,12; off-beat hats 2,6,10,14 plus low (40-60) ghost 16ths for drive; groove lives in velocity/timing, not note count.",
  "  • Trap/Hip-hop (130-150, half-time feel): 808 kick 0 + syncopated push (e.g. 6 and 10); snare/clap on step 8 = beat 3 (~115, the anchor); straight-16th hats with big velocity swings and the odd 1/32 roll (two hats 0.125 apart) ramping 60→110.",
  "  • Boom-bap (85-95): kick 0 + a syncopated second (step 3 or 10); snare 4,12 slightly behind the grid (often rimshot ~90) with ghosts at 7,11,15 (~25); swung 16th hats (~80) at 55-62% swing.",
  "  • Drum & Bass (160-175): kick 0 + ghost kick ~10; snare on step 8 (~115) plus Amen-style ghost snares at 3,11,13 (~25); busy 16th hats.",
].join("\n");

/** Melody/bass: scale awareness, contour, rhythm, harmony, register, dynamics. */
export const MELODY_GUIDANCE = [
  "MELODY & BASS — Build pitched material from the song's key/scale: call get_song_overview for rootNote (0-11 pitch class, 0=C) + scaleName, and stay diatonic unless asked otherwise. Mode moods: natural minor = dark/serious (default for electronic); Dorian = minor-but-hopeful; Phrygian = dark/tense (trap); minor pentatonic = safe, hard to play a wrong note.",
  "Contour: state a short motif (3-7 notes), then REPEAT it (repetition = memorability) and VARY it — transpose within the scale, change a note or two, tweak the rhythm. Aim ~60-70% familiar / 30-40% new. Give each phrase one clear high point (climax); don't wander aimlessly.",
  "Motion: ~70-80% stepwise (1-2 scale degrees), leaps (3rd+) sparingly for interest — and after a large leap, reverse direction by step. Keep a phrase mostly within an octave to a 10th.",
  "Harmony: land chord tones (root/3rd/5th) on strong beats (1 and 3); use passing/neighbour tones on weak beats and off-beats, resolving them by step. Root and 5th are the most restful; the 3rd sets major/minor colour.",
  "Rhythm: vary note lengths and USE RESTS — silence is part of the phrase; let it breathe at phrase ends. Add syncopation/anticipations (a note landing just before the downbeat). All-equal note lengths is the #1 robotic tell for melodies.",
  "Bass: play the chord ROOT on the downbeat (the single most important bass rule); lock the rhythm to the kick (in house/EDM the bass often rolls on the off-beats between kicks); use octave jumps for energy; mostly roots and 5ths, walking up/down by step into the next chord. Keep it simpler than the lead.",
  "Velocity: accent phrase starts and downbeats (100-115), ease off mid-phrase (80-95) and on off-beats (70-85), let the climax peak (~110-120), and add ±5-10 jitter so repeated notes aren't identical.",
  "Register (MIDI): sub bass 24-43, bass 28-48 (most lines 36-48), pad/chords 48-72, lead/melody 60-84. Keep at least an octave between the bass and the chords' lowest note to avoid mud.",
].join("\n");

/** Deriving a new part from an existing clip (e.g. a bass from a melody). */
export const DERIVATION_GUIDANCE = [
  "DERIVING A PART FROM SOURCE MATERIAL — When the producer references existing content (\"from this melody\", \"based on this\", \"make a bass for this\"), first read the source clip with get_clip_notes, then build the new part to fit it.",
  "Match the source's clip length (lengthBeats) and its key/scale (from get_song_overview). Keep the new part in the same harmonic world — reuse the source's chord tones; don't introduce a clashing key.",
  "Deriving a BASS from a melody/chords: take the strong-beat / chord-root pitches of the source and play them an octave or two down (target register 28-48); simplify the rhythm toward downbeats and sustained roots, lock to the kick if drums exist, and leave space — the bass should be simpler than the source, not a copy.",
  "Deriving a COUNTER-MELODY or HARMONY: move mostly in contrary motion to the source, land chord tones (3rds/6ths above) on strong beats, and rest where the source is busy so the two parts interlock rather than collide.",
].join("\n");

/** The full musical brief appended to the generation prompt. */
export const MUSICAL_GUIDANCE = [DRUM_GUIDANCE, "", MELODY_GUIDANCE, "", DERIVATION_GUIDANCE].join("\n");
