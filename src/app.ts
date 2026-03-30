import express from "express";
import { randomUUID } from "crypto";
import { db } from "./db/client";
import { pipelinePatchSchema, pipelineSchema } from "./pipelines/validation";

const app = express();

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.post("/webhooks/:sourceKey", async (req, res) => {
  try {
    const { sourceKey } = req.params;

    const pipelineResult = await db.query(
      "SELECT id FROM pipelines WHERE source_key = $1",
      [sourceKey]
    );

    if (pipelineResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Pipeline not found",
      });
    }

    const pipelineId = pipelineResult.rows[0].id;
    const jobId = randomUUID();

    await db.query(
      `
      INSERT INTO jobs (id, pipeline_id, payload, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, NOW(), NOW())
      `,
      [jobId, pipelineId, req.body, "pending"]
    );

    console.log("Job stored in DB:", jobId);

    return res.status(202).json({
      success: true,
      jobId,
      status: "pending",
    });
  } catch (error) {
    console.error("Webhook ingestion failed:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

app.get("/jobs", async (_req, res) => {
  try {
    const result = await db.query(`
      SELECT
        id,
        pipeline_id,
        status,
        payload,
        processed_payload,
        error_message,
        created_at,
        updated_at
      FROM jobs
      ORDER BY created_at DESC
    `);

    return res.json({
      success: true,
      jobs: result.rows,
    });
  } catch (error) {
    console.error("Fetching jobs failed:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

app.get("/jobs/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `
      SELECT
        id,
        pipeline_id,
        status,
        payload,
        processed_payload,
        error_message,
        created_at,
        updated_at
      FROM jobs
      WHERE id = $1
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

    return res.json({
      success: true,
      job: result.rows[0],
    });
  } catch (error) {
    console.error("Fetching job failed:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

app.get("/jobs/:id/attempts", async (req, res) => {
  try {
    const { id } = req.params;

    const jobResult = await db.query(`SELECT id FROM jobs WHERE id = $1`, [id]);

    if (jobResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

    const attemptsResult = await db.query(
      `
      SELECT
        id,
        job_id,
        subscriber_id,
        attempt_number,
        status,
        response_status,
        error_message,
        created_at
      FROM delivery_attempts
      WHERE job_id = $1
      ORDER BY created_at ASC
      `,
      [id]
    );

    return res.json({
      success: true,
      jobId: id,
      attempts: attemptsResult.rows,
    });
  } catch (error) {
    console.error("Fetching delivery attempts failed:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

app.post("/pipelines", async (req, res) => {
  try {
    const parsed = pipelineSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid pipeline payload",
        errors: parsed.error.issues,
      });
    }

    const { source_key, action_type, action_config, subscriber_urls } =
      parsed.data;

    const pipelineId = randomUUID();

    await db.query("BEGIN");

    try {
      await db.query(
        `
        INSERT INTO pipelines (id, source_key, action_type, action_config, created_at)
        VALUES ($1, $2, $3, $4, NOW())
        `,
        [pipelineId, source_key, action_type, action_config]
      );

      for (const url of subscriber_urls) {
        await db.query(
          `
          INSERT INTO subscribers (id, pipeline_id, target_url, created_at)
          VALUES ($1, $2, $3, NOW())
          `,
          [randomUUID(), pipelineId, url]
        );
      }

      await db.query("COMMIT");
    } catch (error) {
      await db.query("ROLLBACK");
      throw error;
    }

    return res.status(201).json({
      success: true,
      id: pipelineId,
    });
  } catch (error: any) {
    console.error("Creating pipeline failed:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

app.get("/pipelines", async (_req, res) => {
  try {
    const result = await db.query(`
      SELECT
        id,
        source_key,
        action_type,
        action_config,
        created_at
      FROM pipelines
      ORDER BY created_at DESC
    `);

    return res.json({
      success: true,
      pipelines: result.rows,
    });
  } catch (error) {
    console.error("Fetching pipelines failed:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

app.get("/pipelines/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const pipelineResult = await db.query(
      `
      SELECT
        id,
        source_key,
        action_type,
        action_config,
        created_at
      FROM pipelines
      WHERE id = $1
      `,
      [id]
    );

    if (pipelineResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Pipeline not found",
      });
    }

    const subscribersResult = await db.query(
      `
      SELECT id, target_url, created_at
      FROM subscribers
      WHERE pipeline_id = $1
      ORDER BY created_at DESC
      `,
      [id]
    );

    return res.json({
      success: true,
      pipeline: pipelineResult.rows[0],
      subscribers: subscribersResult.rows,
    });
  } catch (error) {
    console.error("Fetching pipeline failed:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});
app.put("/pipelines/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const parsed = pipelinePatchSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid pipeline payload",
        errors: parsed.error.issues,
      });
    }

    const existingPipeline = await db.query(
      `
      SELECT id, source_key, action_type, action_config
      FROM pipelines
      WHERE id = $1
      `,
      [id]
    );

    if (existingPipeline.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Pipeline not found",
      });
    }

    const currentPipeline = existingPipeline.rows[0];
    const subscribersResult = await db.query(
      `
      SELECT target_url
      FROM subscribers
      WHERE pipeline_id = $1
      ORDER BY created_at ASC
      `,
      [id]
    );

    const nextSourceKey = parsed.data.source_key ?? currentPipeline.source_key;
    const nextActionType =
      parsed.data.action_type ?? currentPipeline.action_type;
    const nextActionConfig =
      parsed.data.action_config ?? currentPipeline.action_config;
    const nextSubscriberUrls =
      parsed.data.subscriber_urls ??
      subscribersResult.rows.map((row) => row.target_url);

    const mergedValidation = pipelineSchema.safeParse({
      source_key: nextSourceKey,
      action_type: nextActionType,
      action_config: nextActionConfig,
      subscriber_urls: nextSubscriberUrls,
    });

    if (!mergedValidation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid pipeline payload",
        errors: mergedValidation.error.issues,
      });
    }

    await db.query("BEGIN");

    try {
      await db.query(
        `
        UPDATE pipelines
        SET source_key = $2,
            action_type = $3,
            action_config = $4
        WHERE id = $1
        `,
        [id, nextSourceKey, nextActionType, nextActionConfig]
      );

      if (Array.isArray(parsed.data.subscriber_urls)) {
        await db.query(
          `DELETE FROM subscribers WHERE pipeline_id = $1`,
          [id]
        );

        for (const url of parsed.data.subscriber_urls) {
          await db.query(
            `
            INSERT INTO subscribers (id, pipeline_id, target_url, created_at)
            VALUES ($1, $2, $3, NOW())
            `,
            [randomUUID(), id, url]
          );
        }
      }

      await db.query("COMMIT");
    } catch (error) {
      await db.query("ROLLBACK");
      throw error;
    }

    return res.json({
      success: true,
      message: "Pipeline updated",
    });
  } catch (error) {
    console.error("Updating pipeline failed:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});



app.delete("/pipelines/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `DELETE FROM pipelines WHERE id = $1 RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Pipeline not found",
      });
    }

    return res.json({
      success: true,
      message: "Pipeline deleted",
    });
  } catch (error) {
    console.error("Deleting pipeline failed:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

export default app;
