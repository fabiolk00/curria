# Phase 77 Summary

- Swapped PDF font loading from narrow preview subset files to broader Inter assets and added deterministic PDF text sanitization for spaces, dashes, bullets, and quotes.
- Reworked the PDF experience header so role titles render left-aligned while the period renders on the same line at the right edge; company and location now sit on the next line.
- Reduced the estimated ATS badge tooltip width, padding, and typography so it reads like lightweight contextual help.
- Added regression tests that parse the generated PDF to verify accented strings, technical strings, header ordering, and header positioning.
