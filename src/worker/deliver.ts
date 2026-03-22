export async function deliverToSubscriber(url: string, payload: any) {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
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
  } catch (error: any) {
    return {
      success: false,
      statusCode: null,
      error: error.message,
    };
  }
}

export async function deliverWithRetry(
  url: string,
  payload: any,
  maxAttempts = 3
) {
  const attempts = [];

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

    await new Promise((r) => setTimeout(r, 1000));
  }

  return {
    success: false,
    attempts,
  };
}
