import test from "node:test";
import assert from "node:assert/strict";
import { diagnosticKey, shouldPublish } from "../src/domain.js";

test("only a clean passed build is publishable", () => {
  assert.equal(shouldPublish({ tenantId: "acme", buildId: "b-7", status: "passed", diagnostics: [] }), true);
  assert.equal(shouldPublish({ tenantId: "acme", buildId: "b-8", status: "failed", diagnostics: ["type error"] }), false);
  assert.equal(diagnosticKey({ tenantId: "acme", buildId: "b-7", status: "passed", diagnostics: [] }), "builds/b-7/diagnostics.json");
});
