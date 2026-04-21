# 73-01 Summary

- Replaced permissive token-by-token highlight selection with short phrase-level chunk selection, especially in the summary.
- Added stronger suppression for isolated single words and stand-alone technology names such as `Microsoft` when they are not part of a more meaningful improvement chunk.
- Kept premium bullet behavior intact: materially improved metric/scope bullets can still receive whole-line emphasis.
- Reduced summary highlight density and softened the green visual treatment so the optimized preview feels more premium and less like a technical diff.
