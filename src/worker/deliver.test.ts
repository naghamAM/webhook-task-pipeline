import test from "node:test";
import assert from "node:assert/strict";
import { deliverToSubscriber, deliverWithRetry } from "./deliver";

test("deliverToSubscriber returns success for 2xx responses", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () =>
    new Response(null, {
      status: 204,
    });

  try {
    const result = await deliverToSubscriber("https://example.com/webhook", {
      ok: true,
    });

    assert.deepEqual(result, {
      success: true,
      statusCode: 204,
      error: null,
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("deliverWithRetry retries until a later attempt succeeds", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;

  globalThis.fetch = async () => {
    calls += 1;

    if (calls === 1) {
      throw new Error("temporary failure");
    }

    return new Response(null, {
      status: 200,
    });
  };

  try {
    const result = await deliverWithRetry(
      "https://example.com/webhook",
      { ok: true },
      2
    );

    assert.equal(result.success, true);
    assert.equal(result.attempts.length, 2);
    assert.equal(result.attempts[0].success, false);
    assert.equal(result.attempts[1].success, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("deliverWithRetry returns failed attempts after max retries", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () => {
    throw new Error("subscriber unavailable");
  };

  try {
    const result = await deliverWithRetry(
      "https://example.com/webhook",
      { ok: true },
      2
    );

    assert.equal(result.success, false);
    assert.equal(result.attempts.length, 2);
    assert.match(result.attempts[1].error ?? "", /subscriber unavailable/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
