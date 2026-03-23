# Webhook Task Processing Pipeline

This project is a webhook-driven task processing pipeline built with Node.js, TypeScript, PostgreSQL, and Docker.

##  Overview

The system receives webhook events, stores them as jobs, processes them asynchronously using a worker, and delivers the 
processed results to subscribers with retry logic.

##  Architecture

- API Server: Handles webhook ingestion and CRUD operations
- PostgreSQL: Durable job and pipeline storage
- Worker: Processes jobs asynchronously
- Subscribers: Receive processed data via HTTP requests

## ️ Features

- Webhook ingestion (`POST /webhooks/:sourceKey`)
- Asynchronous job processing
- Multiple processing actions:
  - `add_field`
  - `uppercase_name`
  - `filter_fields`
- Retry mechanism (up to 3 attempts)
- Delivery attempt tracking
- Full CRUD for pipelines
- Dockerized database setup

##  Setup

```bash
docker compose up -d
