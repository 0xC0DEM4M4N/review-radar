import Layout from '@/components/Layout';

export default function GuidePage() {
  return (
    <Layout>
      <div className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="mb-10 text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
          Getting Started Guide
        </h1>

        <section className="mb-10">
          <h2 className="mb-3 text-xl font-semibold" style={{ color: 'var(--cyan)' }}>
            1. Create a GitHub Personal Access Token
          </h2>
          <p className="mb-3 text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
            ReviewRadar uses the GitHub API to fetch your pull request data. To get started, you need a Personal Access Token (PAT):
          </p>
          <ol className="list-inside list-decimal space-y-2 text-sm" style={{ color: 'var(--text-primary)' }}>
            <li>
              Go to{' '}
              <a
                href="https://github.com/settings/tokens"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:opacity-80"
                style={{ color: 'var(--cyan)' }}
              >
                GitHub Settings &rarr; Developer settings &rarr; Personal access tokens
              </a>
            </li>
            <li>Click <strong>Generate new token</strong> (classic) or <strong>Fine-grained token</strong>.</li>
            <li>
              For <strong>classic tokens</strong>, select the <code>repo</code> scope (and <code>read:org</code> if you need private org repos).
            </li>
            <li>
              For <strong>fine-grained tokens</strong>, select the repositories you want and grant <strong>Pull requests</strong> read access.
            </li>
            <li>Copy the generated token and paste it into ReviewRadar when prompted.</li>
          </ol>
        </section>

        <section className="mb-10">
          <h2 className="mb-3 text-xl font-semibold" style={{ color: 'var(--cyan)' }}>
            2. Add Repositories
          </h2>
          <p className="mb-3 text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
            Once your token is saved, add the repositories you want to track:
          </p>
          <ul className="list-inside list-disc space-y-2 text-sm" style={{ color: 'var(--text-primary)' }}>
            <li>Open the <strong>Settings</strong> panel in the app.</li>
            <li>Enter repository names in <code>owner/repo</code> format (e.g. <code>facebook/react</code>).</li>
            <li>Click <strong>Add</strong> — the repo will appear in your tracked list.</li>
            <li>You can add or remove repositories at any time.</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold" style={{ color: 'var(--cyan)' }}>
            3. Use the Dashboard
          </h2>
          <p className="mb-3 text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
            The dashboard gives you a real-time overview of all open pull requests across your tracked repositories:
          </p>
          <ul className="list-inside list-disc space-y-2 text-sm" style={{ color: 'var(--text-primary)' }}>
            <li>Sort and filter PRs by status, author, label, and more.</li>
            <li>See build status, review status, and how long each PR has been open.</li>
            <li>Click any PR title to open it directly on GitHub.</li>
            <li>Use the refresh button to pull the latest data on demand.</li>
          </ul>
        </section>
      </div>
    </Layout>
  );
}
