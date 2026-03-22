# Tiger Claw GCP / Cloud Run Deployment Guide

Welcome to the modernized, enterprise-grade deployment strategy for the Tiger Claw engine. This architecture relies on a highly scalable, stateless Google Cloud Run deployment powered exclusively by Google Gemini.

## Why Cloud Run rather than Kubernetes?
1. **True Stateless Multi-Tenancy**: One API server handles all tenants instantly. No Docker containers to spin up per client.
2. **Serverless Scaling**: Auto-scales dynamically based on traffic.
3. **Zero-Downtime Rollouts**: Traffic is automatically shifted to the new revision only after it proves healthy.

## Architecture Components
- **Cloud Run**: Runs the master Tiger Claw API server (v4 Stateless Gemini Architecture).
- **Google Cloud SQL**: A managed PostgreSQL 15 database for platform-wide tenant, config, and bot data.
- **Google Cloud Memorystore (Redis)**: High-speed caching for 7-day TTL chat history.
- **Bot Pool Management**: Scripts in `ops/botpool/` ensure the platform always has warm Telegram bot tokens automatically.

## Prerequisites
1. [Google Cloud CLI (`gcloud`)](https://cloud.google.com/sdk/docs/install) installed and authenticated.
2. [Terraform](https://developer.hashicorp.com/terraform/downloads) installed.

---

## 🚀 Step 1: Provision the Infrastructure

We use Terraform to automatically spin up the VPC, Cloud Run service, Redis, and database.

```bash
cd ops/gcp-terraform
terraform init
terraform apply -var="project_id=YOUR_GCP_PROJECT_ID" -var="db_password=YOUR_SUPER_SECRET_PASSWORD"
```

## 🤖 Step 2: Ensure Warm Bot Pool

Generate or import enough Telegram bots via the `ops/botpool/create_bots.ts` pipeline before putting the platform into production.

## 🕸 Step 3: CI/CD Deployment Updates

To build and push a new version of the API to Cloud Run from your local machine:
```bash
./ops/build.sh
./ops/deploy-cloudrun.sh
```
