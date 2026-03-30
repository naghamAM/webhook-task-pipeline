import test from "node:test";
import assert from "node:assert/strict";
import { pipelinePatchSchema, pipelineSchema } from "./validation";

test("pipeline schema accepts valid add_field pipelines", () => {
  const result = pipelineSchema.safeParse({
    source_key: "demo-source",
    action_type: "add_field",
    action_config: {
      fieldName: "processed",
      fieldValue: true,
    },
    subscriber_urls: ["https://example.com/webhook"],
  });

  assert.equal(result.success, true);
});

test("pipeline schema rejects add_field pipelines without fieldName", () => {
  const result = pipelineSchema.safeParse({
    source_key: "demo-source",
    action_type: "add_field",
    action_config: {
      fieldValue: true,
    },
    subscriber_urls: ["https://example.com/webhook"],
  });

  assert.equal(result.success, false);

  if (!result.success) {
    assert.equal(
      result.error.issues.some(
        (issue) =>
          issue.path.join(".") === "action_config.fieldName" &&
          issue.message.length > 0
      ),
      true
    );
  }
});

test("pipeline schema rejects filter_fields pipelines without allowedFields", () => {
  const result = pipelineSchema.safeParse({
    source_key: "demo-source",
    action_type: "filter_fields",
    action_config: {},
    subscriber_urls: ["https://example.com/webhook"],
  });

  assert.equal(result.success, false);

  if (!result.success) {
    assert.equal(
      result.error.issues.some(
        (issue) =>
          issue.path.join(".") === "action_config.allowedFields" &&
          issue.message.length > 0
      ),
      true
    );
  }
});

test("pipeline patch schema requires at least one field", () => {
  const result = pipelinePatchSchema.safeParse({});

  assert.equal(result.success, false);
});
