# LoanPlan2026

Free, no-login calculators for the student-loan decisions that got complicated in 2026.

**Live site: <https://hnyxgxm.github.io/loan-plan-2026/>**

| Tool | Question it answers |
|---|---|
| [Plan comparer](https://hnyxgxm.github.io/loan-plan-2026/student-loans/) | RAP vs Standard vs PSLF — total paid, months, forgiveness, **and the tax bill on the forgiven balance**, which is the number most comparisons leave out. |
| [SAVE is gone](https://hnyxgxm.github.io/loan-plan-2026/student-loans/save-transition.html) | What happens to a SAVE balance now, and which plan to land in. |
| [$50k salary](https://hnyxgxm.github.io/loan-plan-2026/student-loans/income-50k.html) | What an income-driven payment actually is at a specific salary, before the abstractions. |
| [Nurses](https://hnyxgxm.github.io/loan-plan-2026/student-loans/nurses.html) | RAP and PSLF when the employer is a tax-exempt hospital. |

## Where the numbers come from

Public analyses of P.L. 119-21 — TICAS, Brookings, CRS IF13075 — cited on the page that
uses them, with every assumption editable next to the input. Estimates only; not financial,
tax or legal advice. Confirm your situation with your servicer or StudentAid.gov.

## Privacy

No account, no email, nothing you type is stored or transmitted — the arithmetic runs in
your browser. Google Analytics records page views and, when you run a comparison, which
plan came out on top, as an anonymous aggregate so we know which tool is worth maintaining.

## How it is built

Plain HTML and one `calc.js`. No framework and no build step: the shipped file is the
served file, which is why a crawler sees the whole calculator without running JavaScript.

```bash
python3 -m http.server 8790   # preview at /loan-plan-2026/
```

## Licence

No licence file, which means **all rights reserved**. The derivations and the wording are
original; the underlying statute and the cited analyses are not ours to license.
