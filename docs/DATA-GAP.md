# Data gap

The appendix in the build brief was truncated in transmission. It ends mid-section at:

```
{id:'isodp-accred',stream:'isodp',title:'Accre
```

## What was received

134 items across 18 sections:

| Stream | Sections | Items |
|---|---|---|
| `cttl` Commonwealth Tribute to Life | 4 | 24 |
| `isodp` ISODP 2027 | 14 | 110 |
| **Total** | **18** | **134** |

18 items carry a `p:1` do-now flag. No item in the received data carries a `due` date.

## What is missing

- the remainder of section `isodp-accred` (Accreditation)
- any ISODP sections after `isodp-accred`
- the entire `dir` (Directorate) stream
- the entire `career` stream
- the entire `per` (Personal) stream — including the Property section, which
  section 7 of the brief says holds one task
- the entire `WATCH` block — roughly 50 "needs remembering" items

Approximately 56 items, against the brief's stated total of ~190.

## What is needed

Re-send the appendix from `{id:'isodp-accred'` onward. Everything before that
point is already committed to `data/register.seed.ts` and does not need resending.

## Open question

Section 7 of the brief refers to "Property has one task". Property is modelled
here as a **section inside the `per` stream**, not a sixth stream, since the
brief names exactly five streams. To be confirmed.
