import test from "node:test";
import assert from "node:assert/strict";
import { processPayload } from "./process-job";

test("processPayload adds a configured field", () => {
  const result = processPayload(
    { event: "user.created" },
    {
      action_type: "add_field",
      action_config: {
        fieldName: "processed",
        fieldValue: true,
      },
    }
  );

  assert.deepEqual(result, {
    event: "user.created",
    processed: true,
  });
});

test("processPayload uppercases nested names", () => {
  const result = processPayload(
    {
      data: {
        name: "alaa",
      },
    },
    {
      action_type: "uppercase_name",
      action_config: {},
    }
  );

  assert.deepEqual(result, {
    data: {
      name: "ALAA",
    },
  });
});

test("processPayload filters to allowed top-level fields", () => {
  const result = processPayload(
    {
      event: "user.created",
      data: { id: 1 },
      ignored: true,
    },
    {
      action_type: "filter_fields",
      action_config: {
        allowedFields: ["event", "data"],
      },
    }
  );

  assert.deepEqual(result, {
    event: "user.created",
    data: { id: 1 },
  });
});

test("processPayload rejects unsupported action types", () => {
  assert.throws(() =>
    processPayload(
      { event: "user.created" },
      {
        action_type: "unsupported",
        action_config: {},
      }
    )
  );
});
