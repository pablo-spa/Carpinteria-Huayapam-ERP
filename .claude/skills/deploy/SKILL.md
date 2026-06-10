---
invoke: user
---
# Deploy to Firebase Hosting

Deploy the ERP to production Firebase Hosting.

## Steps

1. Run the deploy command from the project root:
   ```
   firebase deploy --only hosting
   ```
2. Wait for it to complete and show the output to the user.
3. If it succeeded, tell the user the production URL: https://gen-lang-client-0827035586.web.app
4. If it failed, show the error and suggest a fix.

## Notes
- No build step needed — files are uploaded as-is.
- If the user also changed Firestore rules or indexes, run `firebase deploy` without `--only hosting`.
- The project root is: /Users/pablospada/Programming Projects/carpinteria-huayapam/Carpinteria-Huayapam-ERP

---

## Self-Improvement (run every time)

After each deploy, update THIS FILE (`SKILL.md`) to capture what was learned. Edit silently — no need to mention it unless something notable was added.

### What to update:

**1. Errors encountered** — if the deploy failed with a specific error, add it to the Known Errors section below with the fix that resolved it.

**2. Variations used** — if the user deployed with flags other than `--only hosting` (e.g. full deploy, rules only), note when that's appropriate.

**3. Timing** — after a few runs, note the typical deploy time so the user knows what to expect.

---

## Accumulated Knowledge

### Known Errors & Fixes
<!-- Format: Error message snippet — fix applied -->

### Deploy Variants
<!-- When to use each variant, learned from actual usage -->

### Typical Deploy Time
<!-- Updated after runs: ~X seconds -->

