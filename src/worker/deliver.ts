const defaultRequestTimeoutMs = Number(
  process.env.DELIVERY_REQUEST_TIMEOUT_MS ?? "5000"
);
const retryDelayMs = Number(process.env.DELIVERY_RETRY_DELAY_MS ?? "1000");

type DeliveryResult = {
  success: boolean;
  statusCode: number | null;
  error: string | null;
};

type DeliveryAttempt = {
  attemptNumber: number;
  success: boolean;
  statusCode: number | null;
  error: string | null;
};

export async function deliverToSubscriber(
  url: string,
  payload: unknown
): Promise<DeliveryResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), defaultRequestTimeoutMs);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    return {
      success: true,
      statusCode: res.status,
      error: null,
    };
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown delivery error";

    return {
      success: false,
      statusCode: null,
      error: message,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function deliverWithRetry(
  url: string,
  payload: unknown,
  maxAttempts = 3
) {
  const attempts: DeliveryAttempt[] = [];

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = await deliverToSubscriber(url, payload);

    attempts.push({
      attemptNumber: attempt,
      success: result.success,
      statusCode: result.statusCode,
      error: result.error,
    });

    if (result.success) {
      return {
        success: true,
        attempts,
      };
    }

    if (attempt < maxAttempts) {
      await new Promise((r) => setTimeout(r, retryDelayMs * attempt));
    }
  }

  return {
    success: false,
    attempts,
  };
}
