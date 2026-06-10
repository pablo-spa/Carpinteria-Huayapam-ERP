---
invoke: user
---
# ERP Audit

Run a complete bug and quality audit across all HTML pages of the Carpintería Huayapam ERP.

## Context

~40 standalone HTML pages, vanilla JS, Firebase Firestore. State lives in `window.parent.DB_STATE`. Pages run as iframes inside `index.html`. Common patterns: `window.parent.showToast()`, `window.parent.showConfirm()`, `window.parent.navigate()`.

## Audit Checklist

Run each check using grep/Bash across all `*.html` files. For each finding, report: **file:line**, the problematic code, and a one-line fix suggestion.

### 1. Bare `confirm()` / `alert()` calls
These should use `window.parent.showConfirm()` and `window.parent.showToast()` instead.

```bash
grep -rn "^\s*\(if\s*(\s*\)\?confirm(\|if\s*(!confirm(\|if\s*(!window\.confirm(" --include="*.html" .
grep -rn "\balert(" --include="*.html" . | grep -v "//\|window\.parent\.show"
```

### 2. `console.log` / `console.warn` left in production
Acceptable: `console.error` in catch blocks. Flag everything else.

```bash
grep -rn "console\.\(log\|warn\|debug\|info\)" --include="*.html" .
```

### 3. `DB_STATE` accessed without optional chaining
Should always be `window.parent?.DB_STATE?.collection || []`, never bare `window.parent.DB_STATE.collection`.

```bash
grep -rn "window\.parent\.DB_STATE\." --include="*.html" . | grep -v "?\.DB_STATE\b"
```

### 4. Empty or swallowed catch blocks
`catch(e) {}` or catch blocks that never log or show an error to the user.

```bash
grep -rn "catch\s*(e)\s*{}" --include="*.html" .
grep -rn "catch\s*(e)\s*{\s*}" --include="*.html" .
```

### 5. TODO / FIXME / HACK / parche comments
Flag all instances for review.

```bash
grep -rni "TODO\|FIXME\|HACK\|XXX\|parche\|temporal\b" --include="*.html" .
```

### 6. Hardcoded values that belong in settings/Firestore
Values like specific user emails, account names, or magic numbers that should come from `DB_STATE.settings` or a Firestore collection.

```bash
grep -rn "HARDCODED\|'CHU'\|'CAJA'\|'SATP'" --include="*.html" . | grep -v "finanzas\.html"
grep -rn "@gmail\.com\|@hotmail\." --include="*.html" .
```

### 7. Missing null guard on Firestore writes
Any `.add()` or `.set()` call that doesn't check for required fields before executing.

```bash
grep -rn "\.add(\|\.set(" --include="*.html" . | grep -v "if\s*(!\|guard\|return"
```

### 8. `innerHTML` with unsanitized user input
Look for `innerHTML =` assignments using variables that originate from user input or Firestore data without `escapeHTML()`.

```bash
grep -rn "\.innerHTML\s*=" --include="*.html" . | grep -v "escapeHTML\|sanitize\|'<\|\"<\|\`<"
```

## Output Format

Present findings as a prioritized list:

**CRITICAL** — can cause data loss, broken UI, or security issues
**WARNING** — bad practice, likely to cause bugs
**INFO** — cleanup / polish

For each finding:
```
[SEVERITY] file.html:line
Code: <the problematic snippet>
Fix: <one-line description of the fix>
```

At the end, print a summary:
```
Total: X critical, Y warnings, Z info
Files clean: [list of files with zero findings]
```

## After the Audit

Ask the user which findings they want to fix, then fix them one file at a time. Do not auto-fix without confirmation.

---

## Self-Improvement (run every time)

After the audit completes, update THIS FILE (`SKILL.md`) to capture what was learned. This makes every future run smarter.

### What to update:

**1. Known False Positives** — add to the section below so future runs skip them.
If a grep match is intentional/acceptable (e.g. a `confirm()` in a file that can't use `window.parent`), add the file:line to the suppressions list.

**2. New Patterns Found** — if you spotted a bug class not covered by the 8 checks above, add a new numbered check following the same format.

**3. Already Fixed** — log fixes applied in this session so future audits can verify the fix held and don't re-report it.

**4. Grep Refinements** — if a grep command produced too many false positives or missed real issues, update the command directly in the checklist above.

Do this silently — just edit the file. Tell the user "Skill updated with X learnings from this run."

---

## Accumulated Knowledge

### Known False Positives
<!-- Entries added automatically after each run. Format: file.html:line — reason -->

### Checks Added from Past Runs
<!-- New checks discovered during audits get added here, then promoted to the numbered list above -->

### Fix History
<!-- Format: YYYY-MM-DD — file.html:line — what was fixed -->

