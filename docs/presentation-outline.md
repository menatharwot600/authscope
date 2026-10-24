# AuthScope presentation outline

## Suggested screenshots

1. **Dashboard** — live totals, test-result trend, findings by severity, and active lab mode.
2. **Vulnerable-mode API explorer** — the fixed synthetic endpoint, selected demo actor, and actual response for resource 101.
3. **Finding detail** — BOLA evidence, impact, root cause, and remediation.
4. **Secure-mode API explorer** — the same request returning a denial after the ownership check is enabled.
5. **Comparison results** — side-by-side outcomes from both backend policy implementations.
6. **Test history and report** — persisted run results and the JSON/PDF export actions.

Only capture screenshots from an actual run; the sample report fixture is labeled illustrative and must not be represented as executed evidence.

## Live demonstration sequence

1. Sign in through AuthScope's Clerk authentication. Explain that this platform account is separate from the synthetic demo actors.
2. Open **Demo Resources** and show that Alice owns resource 101 and Bob owns resource 202.
3. In **Security Lab**, confirm **Vulnerable** mode. Explain that it affects only synthetic resource detail reads.
4. In **API Explorer**, request resource 101 as Bob. Show the actual HTTP 200 response and the synthetic owner's identity.
5. Run the fixed authorization suite. Open the BOLA finding and point out that the cross-user read is a failing security check while writes and deletes remain denied.
6. Switch to **Secure** mode after the confirmation. Repeat the exact Bob/resource-101 request and show HTTP 403.
7. Run the suite again, then use **Policy Comparison** to compare both backend policies against the same cases.
8. Open **Test History**, inspect a persisted run, and download its JSON and PDF reports.
9. Finish with the in-app guide and Swagger reference. Reiterate that the lab has no arbitrary target URLs and is limited to the synthetic demo API.

## Key explanation

Authentication establishes who is making a request. Object-level authorization decides whether that authenticated actor may access the particular object named in the request. A valid session alone is not sufficient.
