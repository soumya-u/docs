# Mintlify Starter Kit

Use the starter kit to get your docs deployed and ready to customize.

Click the green **Use this template** button at the top of this repo to copy the Mintlify starter kit. The starter kit contains examples with

- Guide pages
- Navigation
- Customizations
- API reference pages
- Use of popular components

**[Follow the full quickstart guide](https://starter.mintlify.com/quickstart)**

## AI-assisted writing

Set up your AI coding tool to work with Mintlify:

```bash
npx skills add https://mintlify.com/docs
```

This command installs Mintlify's documentation skill for your configured AI tools like Claude Code, Cursor, Windsurf, and others. The skill includes component reference, writing standards, and workflow guidance.

See the [AI tools guides](/ai-tools) for tool-specific setup.

## Development

Install the [Mintlify CLI](https://www.npmjs.com/package/mint) to preview your documentation changes locally. To install, use the following command:

```
npm i -g mint
```

Run the following command at the root of your documentation, where your `docs.json` is located:

```
mint dev
```

View your local preview at `http://localhost:3000`.

## Content gating

This site is private: **every page requires a login by default**, and pages become readable
without one only when explicitly marked. Three tiers are in use, and each tab maps to one
directory so that "who can see this page?" is answered by where the file lives:

| Tier | Directory | Configured by |
| --- | --- | --- |
| Public | `index.mdx`, `quickstart.mdx` | `"public": true` on the group in `docs.json` |
| Any logged-in user | `platform/` | nothing — the site-wide default |
| A specific group | `internal/`, `early-access/` | `groups: [...]` in each page's frontmatter |

Preview any audience locally without an auth provider:

```bash
mint dev                      # the default logged-in view
mint dev --groups beta        # as a beta customer
mint dev --groups internal    # as an employee
```

See [`platform/gating.mdx`](platform/gating.mdx) for the full guide — how each control composes, and
why an unauthorized request returns a 404 rather than a 403.

### Why `scripts/check-gating.mjs` exists

```bash
node scripts/check-gating.mjs
```

Run this before publishing. It guards an invariant that Mintlify cannot enforce itself.

`public` works at the group level in `docs.json`, so it is reasonable to assume `groups`
does too. It does not — `groups` is **page-level only** and must appear in every single
page's frontmatter. Writing it at group level is worse than merely ineffective: the schema
does not define the field, but `mint validate` accepts the file anyway and silently ignores
it. You can configure a section you believe is gated, see a passing build, and have
protected nothing.

The failure is quiet in the other direction too. Add a new page to `internal/` and forget
its frontmatter, and there is no error, no warning, and no failed build — just a runbook
readable by every logged-in customer.

So the check treats **directories** as the source of truth, not page lists: a hand-kept list
of pages goes stale the moment someone adds a file, which is the exact failure being
guarded against. It reads **both** `docs.json` and page frontmatter, because visibility is
declared in two places — an earlier version read frontmatter alone and passed while the
gating guide itself was sitting in the public Guides group.

Five rules, configured by two objects at the top of the script:

1. Every page in a gated directory declares its required group.
2. No page combines `public: true` with `groups` — the combination is ambiguous.
3. No group-gated page sits inside a `public: true` group in `docs.json`.
4. No page in a login-only or gated directory sits in a public group.
5. No orphans — every page is reachable from the navigation, since a page missing from
   `docs.json` is still live at its URL.

## Publishing changes

Install our GitHub app from your [dashboard](https://dashboard.mintlify.com/settings/organization/github-app) to propagate changes from your repo to your deployment. Changes are deployed to production automatically after pushing to the default branch.

## Need help?

### Troubleshooting

- If your dev environment isn't running: Run `mint update` to ensure you have the most recent version of the CLI.
- If a page loads as a 404: Make sure you are running in a folder with a valid `docs.json`.

### Resources
- [Mintlify documentation](https://mintlify.com/docs)
