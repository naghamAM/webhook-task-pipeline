# Webhook-Driven Task Processing Pipeline

A simple service that receives webhooks, processes them, and prepares them 
for delivery to subscribers.

## Overview

This project is a simplified webhook processing pipeline.

The service is responsible for:

- Receiving incoming webhook events
- Validating the request payload
- Processing the event
- Preparing the event for delivery
- Supporting a scalable architecture for future queue/retry handling

## Tech Stack

- Node.js
- TypeScript
- Express
- Docker
- Docker Compose

## Project Structure

```bash
src/
  app.ts
  index.ts
Dockerfile
docker-compose.yml
package.json
tsconfig.json
