# Publish Agent Orchard as a NEW public GitHub repository

GitHub connected account: **Bombitcrypto**. As of the current check, the only existing repository was `Bombitcrypto/FRACTION-AI` (unrelated; untouched). The connected GitHub operations cannot create a new repository in this session, so create the empty repository in GitHub first.

1. Open https://github.com/new in your browser.
2. Repository owner: `Bombitcrypto`; name: `AgentOrchard` (or another name you choose); Visibility: **Public**. **Do not initialize with README, .gitignore, or license**, because this ZIP already contains them.
3. Unzip this source bundle to a folder such as `D:\AgentOrchard-Public`.
4. Open PowerShell **inside that unzipped source folder**, then run:

```powershell
# Check files before publishing (all secrets must remain on your local machine)
Get-ChildItem -Force
Get-ChildItem -Recurse -Force -File | Where-Object { $_.Name -match '^(\.env|wrangler\.toml$|\.dev\.vars)' }

git init -b main
git add .
git status --short
# ONLY after reviewing staged files:
git commit -m "Public source release: Agent Orchard v2.3"
git remote add origin https://github.com/Bombitcrypto/AgentOrchard.git
git push -u origin main
```

If your repository name differs, replace the remote URL. GitHub authentication uses your own Git Credential Manager / browser login. **Never paste a Personal Access Token into chat.**

5. Open the new GitHub repo and check `README.md`, `.github/workflows/ci.yml` and `docs/SUBMISSION_EN.md`.
6. Replace placeholders in `docs/SUBMISSION_EN.md` with public repo URL, demo video, and real on-chain proof; do not invent figures.

**This package does not execute git push and has not created any repository.** GitHub publication is a separate action performed by the repository owner after checking no sensitive files have been added.
