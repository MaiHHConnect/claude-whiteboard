# Security Policy

## Secrets

Do not commit API keys, GitHub tokens, DingTalk secrets, webhook URLs, `.env` files, scheduler runtime data, workspaces, or local memory.

If a secret is accidentally shared or committed:

1. Revoke it immediately in the provider console.
2. Replace it with a placeholder such as `******` or an environment variable name.
3. Rotate any downstream credentials that may have been exposed.
4. Re-run a repository secret scan before publishing.

## Recommended Scan

```bash
rg -n "ghp_|github_pat_|sk-|api[_-]?key|token|secret|password|Bearer" .
```

This scan is intentionally broad. Review false positives manually before release.
