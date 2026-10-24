export type DemoIdentity = "alice" | "bob";
export type PolicyMode = "vulnerable" | "secure";

export function objectReadStatus(
  ownerId: DemoIdentity,
  actor: DemoIdentity,
  mode: PolicyMode,
): number {
  return mode === "secure" && ownerId !== actor ? 403 : 200;
}

export function objectMutationStatus(
  ownerId: DemoIdentity,
  actor: DemoIdentity,
): number {
  return ownerId === actor ? 200 : 403;
}
