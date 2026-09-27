# Fresh library evaluation PDFs (v1)

This is a separate, document-held-out synthetic corpus for library retrieval and
fixed-evidence answer evaluation. It does not replace or modify the seven earlier
PDF fixtures. All parties, dates and terms are fictional. The authored criteria
were source-reviewed by the project assistant, not independently validated as
legal advice or a measure of real-world contract quality.

| PDF | Physical pages | Deliberate challenge |
| --- | ---: | --- |
| `equipment-maintenance-3p.pdf` | 3 | A late, narrowly scoped pump-response amendment; weekend and repair-completion near-matches. |
| `data-processing-5p.pdf` | 5 | A confirmed-breach baseline and later Platform Data-only notice amendment; other supplier and transfer clauses. |
| `research-services-7p.pdf` | 7 | Acceptance, publication and invoice periods that must not be conflated; a conditional final-report amendment. |

`source.json` is the deterministic authored source. `generate.py` uses the
repository's existing PDF renderer and writes only this subdirectory. The
checked-in `manifest.json` freezes source and PDF SHA-256 values. Verify without
rewriting any file:

```bash
backend/venv/bin/python tests/fixtures/pdfs/fresh-library-v1/generate.py --check
```

All 15 pages were rendered and visually checked as contact sheets, then checked
for extractable page text. The complete PDF bytes, extraction version, passage
version, exact page/passage coordinates and labels are additionally checked by
`backend/tests/test_library_quality_cases.py`. Changes to text or rendering
require an explicit new fixture version and renewed source review; do not silently
edit this held-out set after measuring a candidate system.

The retrieval questions and fixed-evidence answer criteria live outside the
PDFs in `backend/fixtures/library_quality_v2`. Neither those labels nor model
answers are part of these contracts.
