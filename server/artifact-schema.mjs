export function normalizeAgentArtifact({ run, task, body = {}, template = [], path, createdAt = new Date().toISOString() }) {
  const checks = Array.isArray(body.checks) && body.checks.length ? body.checks : ["submitted by Agent", "handoff ready"]
  const inputArtifactIds = Array.isArray(task.inputArtifactIds) ? task.inputArtifactIds : []
  return {
    schemaVersion: body.schemaVersion ?? "1.0",
    runId: run.id,
    taskId: task.id,
    agentId: task.agentId,
    id: task.outputId,
    outputType: task.outputId,
    title: body.title ?? template[0] ?? task.outputId,
    type: String(body.type ?? template[1] ?? "json"),
    ownerAgentId: task.agentId,
    path,
    summary: body.summary ?? template[2] ?? "Agent submitted artifact.",
    inputArtifactIds,
    qualityChecks: Array.isArray(body.qualityChecks) ? body.qualityChecks : checks,
    blockingIssues: Array.isArray(body.blockingIssues) ? body.blockingIssues : [],
    nextAgentHints: Array.isArray(body.nextAgentHints) ? body.nextAgentHints : [],
    checks,
    createdAt,
  }
}
