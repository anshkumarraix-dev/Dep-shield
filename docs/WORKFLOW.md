# GitHub workflow for four Antigravity agents

The project repository already exists. Do not create a second repository unless Ansh explicitly decides to. First check `git status`, `git branch --show-current`, and `git remote -v`; preserve any existing work.

## Ansh — one-time setup
1. Confirm the repository is the intended DepShield repo.
2. In GitHub Settings → Collaborators, add Aviral, Ayush and Aman. Do not paste access tokens into chat or `.env`.
3. Ensure all four can fetch/push. Each person creates their own feature branch from the latest `main`.
4. If `.env.example`/`AGENTS.md` from this pack are added, inspect `git diff` before committing. Never overwrite a real `.env`.

## Branches
- Ansh: `feat/ansh-backend-core`
- Aviral: `feat/aviral-tinyfish-budget`
- Ayush: `feat/ayush-frontend`
- Aman: `feat/aman-scoring-replay`

Each owner must remain inside their owned file paths. If a cross-contract change is required, send Ansh the exact proposal and wait for his commit.

## Every 20–30 minutes
```powershell
git status
git add <only-owned-files>
git commit -m "feat(scope): concise description"
git push -u origin <your-branch>
```
Later pushes can omit `-u origin <your-branch>`. Open a pull request into `main`; if GitHub CLI is installed, `gh pr create --fill --base main` can be used. Otherwise use the link printed by GitHub after the push.

Before a new increment, fetch and inspect `origin/main`; do not rebase another person's uncommitted work. Resolve conflicts in your own files only. Never force-push `main`. Ansh reviews contracts/tests and merges with **Create a merge commit**, not squash, so incremental history remains visible. No one except Ansh should merge during the time-critical integration unless Ansh explicitly delegates.

## Commit safety
Never stage `.env`, `*.db`, `node_modules`, `.next`, `.venv`, keys or generated fixtures containing secrets. Before commit, inspect `git status` and `git diff --cached --stat`. Do not print keys while debugging.
