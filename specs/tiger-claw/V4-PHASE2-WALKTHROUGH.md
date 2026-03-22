# V4 Deployment & Google Integration Proof of Work

*Generated: 2026-03-19*

This phase officially moved Tiger Claw off local emulation and permanently seeded it into Google Cloud Platform (GCP). The entire backend is now running flawlessly on the Google stack.

## 1. Google Cloud Run Native Port
- **Infrastructure Secured**: Your Terraform module successfully provisioned the `tiger-claw-api` Cloud Run container, a Cloud SQL High Availability database, and the Google Memorystore Redis cluster natively inside `us-central1`.
- **Database Rescue**: Diagnosed and resolved a bash injection bug in the Secret Manager password pipeline, forcing a clean re-deployment so the application could securely connect to SQL.
- **BullMQ Queue Permanent Fix**: Identified a critical error in the production logs where the default Google Redis eviction policy (`volatile-lru`) threatened to randomly delete background bot jobs. Hot-patched `ops/gcp-terraform/main.tf` to permanently enforce `noeviction`.

## 2. Gemini RAG Brain Upgrade
- **OpenAI Deprecation**: Ripped out the OpenAI provider from your custom `Mini-RAG` engine.
- **Gemini Native Injection**: Wrote a custom `GeminiProvider` class using `google-generativeai` to power the answering pipeline natively off the `GOOGLE_API_KEY`.
- **Engine Routing**: Repointed `engines.json` so the entire pipeline defaults to `gemini-2.5-flash` for high-speed, cost-effective reasoning.
- **RAG Native Tooling**: Built `api/src/tools/tiger_knowledge.ts`, configuring standard `application/x-www-form-urlencoded` shapes to bypass the Python Pydantic routing errors. Injected the tool completely into `ai.ts` so all Tiger Claw bots can natively query your second brain.

## 3. Stan Store Webhook Failures
- **Legacy Logic Rewritten**: Extracted the disconnected PR #14 code and hardwired it directly into the primary `webhooks.ts`.
- **Magic Link Dispatcher**: Engineered `sendStanStoreWelcome` in `email.ts` utilizing the Resend API. When Stan Store bypasses typical Stripe checkout variables, the system securely generates a personalized HTML wizard email directly to the buyer to manually begin onboarding.

## Next Steps Signed Over
1. Execute the Mini-RAG `Tiger-Brain` ingestion on your physical desktop files.
2. Complete the physical batch provisioning of the SIM cards on your desk and write them into the db.
3. Configure the official Google MCP wrapper for external CLI agents.
