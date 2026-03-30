import http from "http";
import { db } from "../db/client";
import { processPayload } from "./process-job";
import { deliverWithRetry } from "./deliver";

const pollIntervalMs = Number(process.env.WORKER_POLL_INTERVAL_MS ?? "1000");
const port = Number(process.env.PORT ?? "0");

async function processJobs() {
  while (true) {
    try {
      const result = await db.query(
        `
        WITH next_job AS (
          SELECT jobs.id
          FROM jobs
          WHERE jobs.status = 'pending'
          ORDER BY jobs.created_at ASC
          LIMIT 1
          FOR UPDATE SKIP LOCKED
        )
        UPDATE jobs
        SET status = 'processing',
            updated_at = NOW()
        WHERE jobs.id IN (SELECT id FROM next_job)
        RETURNING jobs.id, jobs.payload, jobs.pipeline_id
        `
      );

      if (result.rows.length === 0) {
        await new Promise((r) => setTimeout(r, pollIntervalMs));
        continue;
      }

      const claimedJob = result.rows[0];
      const pipelineResult = await db.query(
        `
        SELECT action_type, action_config
        FROM pipelines
        WHERE id = $1
        `,
        [claimedJob.pipeline_id]
      );

      if (pipelineResult.rows.length === 0) {
        await db.query(
          `
          UPDATE jobs
          SET status = 'failed',
              error_message = 'Pipeline not found during processing',
              updated_at = NOW()
          WHERE id = $1
          `,
          [claimedJob.id]
        );
        continue;
      }

      const job = {
        ...claimedJob,
        ...pipelineResult.rows[0],
      };

      try {
        console.log("Processing job:", job.id);

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
        const message =
          error instanceof Error ? error.message : "Job processing failed";

        await db.query(
          `
          UPDATE jobs
          SET status = 'failed',
              error_message = $2,
              updated_at = NOW()
          WHERE id = $1
          `,
          [job.id, message]
        );

        console.error("Job failed:", job.id, message);
      }
    } catch (error) {
      console.error("Worker error:", error);
      await new Promise((r) => setTimeout(r, pollIntervalMs));
    }
  }
}

if (port > 0) {
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", role: "worker" }));
  });

  server.listen(port, () => {
    console.log(`Worker health server listening on port ${port}`);
  });
}

processJobs();
