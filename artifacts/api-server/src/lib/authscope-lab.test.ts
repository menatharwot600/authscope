import assert from "node:assert/strict";
import { before, test } from "node:test";
import {
  ensureAuthScopeSeedData,
  executeSecuritySuite,
  type TestResultDraft,
} from "./authscope-lab";

let vulnerableResults: TestResultDraft[] = [];
let secureResults: TestResultDraft[] = [];

before(async () => {
  await ensureAuthScopeSeedData();
  vulnerableResults = await executeSecuritySuite("vulnerable");
  secureResults = await executeSecuritySuite("secure");
});

function result(
  results: TestResultDraft[],
  caseKey: string,
): TestResultDraft {
  const found = results.find((item) => item.caseKey === caseKey);
  assert.ok(found, `Expected test case ${caseKey} to run.`);
  return found;
}

test("the safe suite executes all six defined authorization checks", () => {
  assert.equal(vulnerableResults.length, 6);
  assert.equal(secureResults.length, 6);
});

test("a cross-user read fails in vulnerable mode and passes in secure mode", () => {
  const vulnerable = result(vulnerableResults, "cross-user-read");
  const secure = result(secureResults, "cross-user-read");
  assert.equal(vulnerable.actualStatus, 200);
  assert.equal(vulnerable.actualOutcome, "allowed");
  assert.equal(vulnerable.passed, false);
  assert.equal(vulnerable.severity, "high");
  assert.equal(secure.actualStatus, 403);
  assert.equal(secure.actualOutcome, "denied");
  assert.equal(secure.passed, true);
});

test("owners retain read access and unauthenticated requests are blocked", () => {
  for (const results of [vulnerableResults, secureResults]) {
    assert.equal(result(results, "owner-read").actualStatus, 200);
    assert.equal(result(results, "secure-owner-read").actualStatus, 200);
    assert.equal(result(results, "unauthenticated-read").actualStatus, 401);
    assert.equal(result(results, "unauthenticated-read").passed, true);
  }
});

test("cross-user update and delete are denied regardless of lab mode", () => {
  for (const results of [vulnerableResults, secureResults]) {
    assert.equal(result(results, "cross-user-update").actualStatus, 403);
    assert.equal(result(results, "cross-user-update").passed, true);
    assert.equal(result(results, "cross-user-delete").actualStatus, 403);
    assert.equal(result(results, "cross-user-delete").passed, true);
  }
});
