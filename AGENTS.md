<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This repository is a standalone export from [Lovable](https://lovable.dev).
> It is not connected to the original hackathon deployment.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Project rules
- Site-wide visual roles are defined in global CSS tokens; the signed-in shell scopes workspace tokens, and shared logo, page-heading, and control components apply branding consistently. Why: every private page must share the visual system without changing profile, lookup, or messaging logic.
- Signed-in pages live under `src/routes/_authenticated/` (client-only gate, redirects to `/auth`); public pages stay top-level. Why: the session lives in browser storage, so server-side gating would loop.
- Server logic uses `createServerFn` (not edge functions); profile-lookup vendors sit behind one server-only `ProfileProvider` interface chosen by a setting. Why: swapping vendors must be a config change.
- The app never fetches linkedin.com pages or sends messages; LinkedIn data comes only from official sign-in, user uploads, or the lookup provider. Why: hard product constraint.
- LinkedIn sign-in uses our own OIDC flow (`/api/public/linkedin/start` + `/callback`, secrets LINKEDIN_CLIENT_ID/SECRET) that mints a session via admin magic-link token; not the built-in custom:app-oidc provider. Why: LinkedIn only accepts client_secret_post, which the built-in provider does not send.
- LinkedIn sign-in starts and finishes on the configured canonical sign-in origin. Why: the OAuth state cookie must be set on the same host as the registered callback.
- Profile lookups go through `runLookup` in `src/lib/profile/lookup.server.ts` (cache by normalized URL/email, per-user + global monthly caps, every call logged to `provider_calls`, raw responses kept for the first 20). Why: one place enforces free-tier limits and logging.
