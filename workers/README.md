# Cloudflare Worker

`ai-worker.js` is the version-controlled source for the optional AI assistant
Worker. `deploy/ai-worker.js` is a legacy local copy and is not a deployment
source or a test dependency.

Deploy this file through the Cloudflare dashboard or a separately configured
Wrangler workflow. Bind `AI_LIMIT_KV` and `AI`, then set any operational values
outside this repository. Do not replace placeholder values in committed source
with real credentials.

The browser-visible `X-Access-Token` is only a friction mechanism. Rate limits,
Cloudflare origin controls, and the KV fail-closed behavior are the actual
abuse controls. Production acceptance must record the Worker deployment URL,
binding names, quota behavior, and the date of a manual abuse-control check.
