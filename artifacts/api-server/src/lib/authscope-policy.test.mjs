import assert from "node:assert/strict";
import test from "node:test";
import {
  objectMutationStatus,
  objectReadStatus,
} from "./authscope-policy.ts";

test("an owner can read their own resource in both policies", () => {
  assert.equal(objectReadStatus("alice", "alice", "vulnerable"), 200);
  assert.equal(objectReadStatus("alice", "alice", "secure"), 200);
});

test("vulnerable mode reproduces cross-user read access only", () => {
  assert.equal(objectReadStatus("alice", "bob", "vulnerable"), 200);
  assert.equal(objectReadStatus("alice", "bob", "secure"), 403);
});

test("cross-user writes and deletes remain denied in both modes", () => {
  assert.equal(objectMutationStatus("alice", "bob"), 403);
});

test("an owner can mutate their own resource", () => {
  assert.equal(objectMutationStatus("alice", "alice"), 200);
});
