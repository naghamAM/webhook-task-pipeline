# Webhook-Driven Task Processing Pipeline

This project is a simplified webhook automation service inspired by tools like
Zapier. It accepts inbound webhooks, stores them as jobs, processes them in a
background worker, and delivers the processed result to one or more subscriber
URLs.

The stack is intentionally aligned with the Boot.dev TypeScript final project:
TypeScript, PostgreSQL, Docker, Docker Compose, and GitHub Actions.

## Features

- CRUD API for pipelines
- Webhook ingestion endpoint per pipeline source key
- Background worker that polls pending jobs from PostgreSQL
- Three processing actions:
  - `add_field`
  - `uppercase_name`
  - `filter_fields`
- Delivery retry logic with delivery attempt history
- Job status and job history endpoints
- Local development with `docker compose up`
- GitHub Actions CI pipeline
- Automated tests for validation, processing actions, and delivery retries

## Architecture

The system has three runtime pieces:

1. `server`
   - Express API for pipeline CRUD, webhook ingestion, and job inspection
2. `postgres`
   - stores pipelines, subscribers, jobs, and delivery attempts
3. `worker`
   - continuously polls for pending jobs, processes them, and sends results to
     subscribers

Flow:

1. A pipeline is created with a unique `source_key`, an `action_type`, and one
   or more subscriber URLs.
2. A webhook is sent to `/webhooks/:sourceKey`.
3. The API stores the payload in the `jobs` table with status `pending`.
4. The worker claims the next pending job, marks it as `processing`, transforms
   the payload, and sends it to each subscriber.
5. Each delivery attempt is stored in `delivery_attempts`.
6. The job is marked as `completed` or `failed`.

## Processing Actions

The worker currently supports these actions:

- `add_field`
  - adds a configured field and value to the payload
- `uppercase_name`
  - uppercases `payload.data.name` when present
- `filter_fields`
  - keeps only the configured top-level fields

These are implemented in
[process-job.ts](/Users/alaamarneh/webhook-task-pipeline/src/worker/process-job.ts).

## Database Schema

Main tables:

- `pipelines`
  - pipeline definition and processing config
- `subscribers`
  - subscriber URLs for each pipeline
- `jobs`
  - queued and processed webhook events
- `delivery_attempts`
  - history of delivery retries and failures

Schema lives in
[schema.sql](/Users/alaamarneh/webhook-task-pipeline/src/db/schema.sql).

## Running Locally

### Requirements

- Docker
- Docker Compose

### Start the project

```bash
docker compose up --build
```

This starts:

- PostgreSQL on port `5433`
- API server on port `3000`
- worker process in a separate container
- a one-off migration container that applies the schema before the app starts

The application containers use the production Docker image, not `tsx` or bind
mounts. That makes local startup closer to the deployment shape and more
reliable for demos.

### Run tests

```bash
npm test
```

This compiles the project and runs the Node test suite against the built files.

### Health check

```bash
curl http://localhost:3000/health
```

## API Reference

### Create pipeline

`POST /pipelines`

Example body:

```json
{
  "source_key": "demo-source",
  "action_type": "add_field",
  "action_config": {
    "fieldName": "processed",
    "fieldValue": true
  },
  "subscriber_urls": [
    "https://example.com/webhook-receiver"
  ]
}
```

Action config rules:

- `add_field` requires `action_config.fieldName`
- `uppercase_name` accepts an empty config object
- `filter_fields` requires `action_config.allowedFields`

### List pipelines

`GET /pipelines`

### Get pipeline

`GET /pipelines/:id`

### Update pipeline

`PUT /pipelines/:id`

### Delete pipeline

`DELETE /pipelines/:id`

### Ingest webhook

`POST /webhooks/:sourceKey`

Example:

```bash
curl -X POST http://localhost:3000/webhooks/demo-source \
  -H "Content-Type: application/json" \
  -d '{
    "event": "user.created",
    "data": {
      "name": "alaa"
    }
  }'
```

Expected response:

```json
{
  "success": true,
  "jobId": "some-uuid",
  "status": "pending"
}
```

### List jobs

`GET /jobs`

### Get job

`GET /jobs/:id`

### Get delivery attempts for a job

`GET /jobs/:id/attempts`

This endpoint returns the retry history recorded for each subscriber delivery.

## Example Demo Flow

1. Start the stack with `docker compose up --build`
2. Create a pipeline with one subscriber URL
3. Send a webhook to `/webhooks/:sourceKey`
4. Check `GET /jobs` and confirm the job leaves `pending`
5. Check `GET /jobs/:id` for the final status and processed payload
6. Check `GET /jobs/:id/attempts` to show retry history per subscriber

That is a good flow for the required video demo.

## Design Decisions

- PostgreSQL is used as both persistence and the simple job queue.
  - This keeps the system small and easy to run locally.
- The worker is separated from the API process.
  - Webhook ingestion stays fast because the API only stores a job.
- Delivery attempts are stored explicitly.
  - This makes retry behavior visible for debugging and evaluation.
- Docker Compose runs all services together.
  - This satisfies the project requirement that the whole system runs locally in
    one command.

## Reliability Notes

- Webhook requests return `202 Accepted` after the job is stored.
- The worker retries subscriber delivery up to 3 times.
- Each delivery request has a timeout so one slow subscriber cannot block the
  worker indefinitely.
- Failed delivery attempts are persisted in the database.
- Jobs are marked `completed` or `failed`.
- The worker uses an atomic job-claim query to reduce double-processing risk.
- Pipeline create and update operations run inside database transactions.

## CI/CD

The core assignment requirement is covered by the CI workflow in
[ci.yml](/Users/alaamarneh/webhook-task-pipeline/.github/workflows/ci.yml),
which:

- installs dependencies with `npm ci`
- builds the TypeScript project
- runs the automated tests
- validates the Docker Compose file
- builds the Docker image

There is also an optional Google Cloud deployment workflow in
[deploy-gcloud.yml](/Users/alaamarneh/webhook-task-pipeline/.github/workflows/deploy-gcloud.yml).
That workflow is a stretch deployment path and is not required to understand the
core project.

## Project Structure

```bash
src/
  app.ts
  server.ts
  db/
    client.ts
    schema.sql
    seed.sql
  worker/
    worker.ts
    process-job.ts
    deliver.ts
docker/
  init/
.github/
  workflows/
Dockerfile
docker-compose.yml
package.json
tsconfig.json
```

## What I Would Improve Next

- move from database polling to a dedicated message queue
- add authentication and webhook signature verification
- expose subscriber-level delivery summaries in job responses
