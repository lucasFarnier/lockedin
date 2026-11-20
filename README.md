# LockedIn

LockedIn helps job seekers turn a shortlist of recruiters and hiring contacts into thoughtful outreach. Build a profile, track contacts, find genuine common ground, and draft a message to review and send yourself. The app does not scrape LinkedIn or send messages on your behalf.

**Team git gud · 5th place at Hack the Trent.** Software engineering students built this prototype in 3.5 hours at Nottingham Trent University’s AI-enabled hackathon. The experiment was to see what students could build with AI tools under a tight deadline, and where engineering judgment was still needed to make a useful, working product for a real problem.

## What you can do

- Create a profile with your experience, skills and job-search goals. CV import is optional.
- Save contacts in a shortlist.
- Compare a contact’s profile with your own and draft outreach based on shared facts. Review drafts before copying them; mark messages as sent manually.

This snapshot is a hackathon prototype, not a production service. The original backend, accounts, credentials, and user data are not included.

## Demo

[Watch the app walkthrough (MP4)](docs/lockedin-demo.mp4). It shows sign-in options, profile editing, target lookup, common ground and the outreach composer. All profiles are fictional; profile lookup uses the mock provider and AI output is simulated. No social accounts were connected or messaged.

## Run locally

Prerequisites: Node.js 22.12+ (or 24 LTS), [Bun](https://bun.sh/) for dependency installation, and a fresh [Supabase](https://supabase.com/) project or [local Supabase stack](https://supabase.com/docs/guides/local-development). Do not reuse the hackathon backend.

1. Install dependencies, then create your own local configuration:

   ```sh
   bun install --frozen-lockfile
   cp .env.example .env
   ```

2. Apply the four SQL files under `drizzle/migrations/` in numeric order, from `0000` through `0003`, using the fresh project’s SQL editor or `psql`. These schema-only migrations expect Supabase's Auth schema and database roles. Run them before creating accounts.
3. Set both `SUPABASE_URL` and `VITE_SUPABASE_URL` to your project’s API URL. Set both publishable-key variables to the project's publishable (or legacy `anon`) key. Set `SUPABASE_SERVICE_ROLE_KEY` to the backend-only service-role key for server functions. Never prefix a privileged key with `VITE_` or commit a populated `.env`.
4. In Supabase Auth, turn on the email provider, set the Site URL to your app’s URL, and allow `<app-origin>/dashboard` and `<app-origin>/auth` as redirect destinations. Email confirmation uses your Supabase email settings; a standard local Supabase stack delivers mail to Mailpit.
5. Start the app with `bun run dev` and open the URL printed by Vite (usually `http://localhost:3000`). Keep `PROFILE_PROVIDER=mock` to try contact lookup with fictional data and no vendor calls.

`bun run test` runs the unit tests; `bun run build` creates the production build.

### Optional integrations

| Integration                      | Configuration                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Google sign-in                   | Follow [Supabase’s Google setup guide](https://supabase.com/docs/guides/auth/social-login/auth-google). Create a Google OAuth web client, register the callback shown by Supabase (usually `https://<project-ref>.supabase.co/auth/v1/callback`), and enter the client ID and secret in Supabase Auth. Keep the app’s `/auth` redirect allow-listed.                                                                                                                                                                                                |
| LinkedIn sign-in                 | Enable [Sign In with LinkedIn using OpenID Connect](https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/sign-in-with-linkedin-v2) on your own LinkedIn app. Register `https://<app-host>/api/public/linkedin/callback`; set `LINKEDIN_SIGN_IN_ORIGIN` to that HTTPS origin (no trailing slash), plus `LINKEDIN_CLIENT_ID` and `LINKEDIN_CLIENT_SECRET` on the server. The app requests `openid profile email` and expects a verified email. Serve the app at that exact origin for the sign-in cookie and callback to work. |
| Profile lookup                   | Keep the fictional `mock` provider for demos. To opt into People Data Labs, set `PROFILE_PROVIDER=pdl` and supply a server-side `PDL_API_KEY`.                                                                                                                                                                                                                                                                                                                                                                                                      |
| CV import, common ground, drafts | Set a server-side `LOVABLE_API_KEY` with access to the Lovable AI Gateway. The app sends relevant CV or profile text to the gateway for these features. Use fictional data until you’ve reviewed vendor and retention settings.                                                                                                                                                                                                                                                                                                                     |

Google and LinkedIn are sign-in providers, not ways to import contacts or send messages. Live OAuth requires your own app credentials and has not been verified against a new deployment. Before inviting real users, review OAuth account linking, database access policies and deletion/retention across lookup caches and logs; the prototype does not guarantee complete data erasure.

## Code map

| Path                         | Purpose                                                                                       |
| ---------------------------- | --------------------------------------------------------------------------------------------- |
| `src/routes/`                | TanStack Start pages, signed-in workspace and LinkedIn OAuth endpoints                        |
| `src/components/`            | React UI, branding and reusable forms                                                         |
| `src/lib/`                   | Profile normalization, provider lookup, CV import, common-ground matching and outreach drafts |
| `src/integrations/supabase/` | Supabase clients, authentication and database types                                           |
| `drizzle/migrations/`        | PostgreSQL schema and row-level security policies; no data dump                               |
