# ChatGPT Custom GPT Integration Plan

## Goal
Let you add Chameleonaire to ChatGPT as a Custom GPT via OpenAI Actions, so ChatGPT can list your scans, creators, blueprints, channels, and run earnings estimates.

## Why a separate action layer
Your existing `/mcp` endpoint speaks the Model Context Protocol (MCP) with OAuth. ChatGPT Custom GPTs require an OpenAPI schema + HTTP actions. We will reuse the same business logic but expose it as OpenAPI actions with API-key auth.

## What will be built

### 1. API-key auth for ChatGPT
- New table `chatgpt_api_keys` scoped to the authenticated user:
  - `id uuid primary key`, `user_id uuid references auth.users`, `name text`, `key_hash text` (store only a hash), `prefix text`, `created_at`, `last_used_at`, `revoked_at`
  - RLS: users see only their own keys; service_role can read hashes for verification
- Server function `createChatGptApiKey` returns the plaintext key once (like Stripe tokens).
- Server function `revokeChatGptApiKey` and `listChatGptApiKeys`.

### 2. Public action routes under `/api/public/chatgpt/*`
- `GET /api/public/chatgpt/scans` → `list_scans`
- `GET /api/public/chatgpt/creators` → `list_creators`
- `GET /api/public/chatgpt/blueprints` → `list_blueprints`
- `GET /api/public/chatgpt/channels` → `list_channels`
- `POST /api/public/chatgpt/estimate` → `estimate_earnings`
- Each route validates a `Authorization: Bearer <key>` header, looks up the hashed key, and calls the existing server logic as that user.
- Returns JSON matching the existing function outputs.

### 3. OpenAPI schema
- New public route `GET /api/public/chatgpt/openapi.json` serves the OpenAPI 3.1 spec describing the five actions, auth scheme, request/response schemas, and example values.
- The schema is tailored for ChatGPT (descriptions written as instructions to the model).

### 4. In-app key management UI
- New route `/integrations/chatgpt` (or `/profile/integrations`) with:
  - Button to generate a new key (shown once).
  - List of existing keys with revoke action.
  - Copy-paste instructions and the OpenAPI schema URL for ChatGPT.

### 5. ChatGPT setup instructions
- Provide the user with the exact Custom GPT instructions to paste:
  - Schema URL: `https://chameleonaire.lovable.app/api/public/chatgpt/openapi.json`
  - Auth type: API Key, header `Authorization`, prefix `Bearer `
  - Privacy policy / terms URLs.

## Security
- API keys are hashed with SHA-256 before storage; only the prefix is readable.
- Keys are scoped per-user and map to the existing authenticated server functions.
- No key = 401. Revoked key = 401.
- Public routes are read-only for the first release (scans, creators, blueprints, channels, estimate). No write actions exposed to ChatGPT until explicitly requested.

## Out of scope for this plan
- ChatGPT desktop MCP support.
- Lovable "Add to Lovable" connector flow.
- OAuth-based ChatGPT Actions (API key is simpler and sufficient for personal use).

## Verification
- Build passes.
- Each `/api/public/chatgpt/*` endpoint returns 401 without a key and 200 with a valid key.
- `/api/public/chatgpt/openapi.json` returns valid OpenAPI 3.1 JSON.
- Playwright confirms the key-management page generates and revokes keys.
