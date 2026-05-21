import React from "react";

export default function InstallScriptCard({ userId }) {
  const curl = `curl -sSL https://yourgrid.com/install.sh | USER_ID=${userId} bash`;

  return (
    <div className="card p-6">
      <h4 className="text-lg font-semibold mb-2">
        One-line install for your providers
      </h4>
      <p className="text-sm muted mb-4">
        Copy and run this on the provider machine to install the agent and
        register it to your account.
      </p>
      <pre className="code-block">{curl}</pre>
    </div>
  );
}
