import { db } from "../db/client";
import { processPayload } from "./process-job";
import { deliverWithRetry } from "./deliver";

async function processJobs() {
  while (true) {
    try {
      const result = await db.query(
        `
        SELECT 
          jobs.id,
          jobs.payload,
          jobs.pipeline_id,
          pipelines.action_type,
          pipelines.action_config
        FROM jobs
        JOIN pipelines ON pipelines.id = jobs.pipeline_id
        WHERE jobs.status = 'pending'
        ORDER BY jobs.created_at ASC
        LIMIT 1
        `
      );

      if (result.rows.length === 0) {
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }

      const job = result.rows[0];

      console.log("Processing job:", job.id);

      await db.query(
        `UPDATE jobs SET status = 'processing', updated_at = NOW() WHERE id = $1`,
        [job.id]
      );

      const processedPayload = processPayload(job.payload, {
        action_type: job.action_type,
        action_config: job.action_config,
      });

      const subscribers = await db.query(
        `SELECT id, target_url FROM subscribers WHERE pipeline_id = $1`,
        [job.pipeline_id]
      );

      let deliveryFailed = false;
      let lastDeliveryError: string | null = null;

      for (const sub of subscribers.rows) {
        const delivery = await deliverWithRetry(
          sub.target_url,
          processedPayload,
          3
        );

        for (const attempt of delivery.attempts) {
          await db.query(
            `
            INSERT INTO delivery_attempts (
              id,
              job_id,
              subscriber_id,
              attempt_number,
              status,
              response_status,
              error_message,
              created_at
            )
            VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, NOW())
            `,
            [
              job.id,
              sub.id,
              attempt.attemptNumber,
              attempt.success ? "success" : "failed",
              attempt.statusCode,
              attempt.error,
            ]
          );
        }

        console.log("Delivery attempts:", delivery.attempts);

        if (!delivery.success) {
          deliveryFailed = true;
          lastDeliveryError =
            delivery.attempts[delivery.attempts.length - 1]?.error ??
            "Delivery failed";
        }
      }

      await db.query(
        `
        UPDATE jobs
        SET status = $2,
            processed_payload = $3,
            error_message = $4,
            updated_at = NOW()
        WHERE id = $1
        `,
        [
          job.id,
          deliveryFailed ? "failed" : "completed",
          JSON.stringify(processedPayload),
          lastDeliveryError,
        ]
      );

      console.log("Job completed:", job.id);
      console.log("Processed payload:", processedPayload);
    } catch (error) {
      console.error("Worker error:", error);
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}

processJobs();
