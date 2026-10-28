# Publish / play online

The production website is published to the `gh-pages` branch of MatteoSemi/Gamefun. It has relative asset URLs and no backend requirements.

If GitHub Pages is not enabled, the repository owner must do this once:

1. Open https://github.com/MatteoSemi/Gamefun/settings/pages
2. Under **Build and deployment**, choose **Deploy from a branch**.
3. Select branch **gh-pages** and folder **/ (root)**; click **Save**.
4. Wait for GitHub's Pages deployment to finish (usually a few minutes). The settings page displays the confirmed live URL.

Expected URL after successful deployment: https://matteosemi.github.io/Gamefun/

Click the link, choose a game, then click Start game. No installation is required for players. A desktop browser and keyboard are recommended. Two-player mode uses one keyboard on the same device. The rulebook shows controls. Records are saved per browser on the website's origin, separately from localhost records.

Deployment status: source and static build uploaded; Pages enablement/live URL cannot be confirmed by the agent because GitHub API access is forbidden in the current environment. The repository owner must enable Pages if it is not already enabled. Repository visibility and GitHub plan may affect Pages availability; do not change visibility solely to enable it without considering whether the source should be public.

To refresh the static site after source changes: run `npm ci`, then `npm run build -- --base=./`, and publish the contents of `dist/` (not the directory itself) to the root of `gh-pages`.
