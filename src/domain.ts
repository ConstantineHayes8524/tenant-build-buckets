export type BuildEvent = { tenantId: string; buildId: string; status: "passed" | "failed"; diagnostics: string[] };

export function diagnosticKey(event: BuildEvent): string {
  return `builds/${event.buildId}/diagnostics.json`;
}

export function shouldPublish(event: BuildEvent): boolean {
  return event.status === "passed" && event.diagnostics.length === 0;
}
