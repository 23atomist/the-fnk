export interface ClaudeResult {
  isError: boolean;
  resultText: string;
  costUsd: number | null;
  numTurns: number | null;
}

/** Parse `claude --output-format json` stdout into a structured result. Never throws. */
export function parseClaudeResult(stdout: string): ClaudeResult {
  try {
    const obj = JSON.parse(stdout) as Record<string, unknown>;
    const isError = obj.is_error === true;
    const resultText = typeof obj.result === "string" ? obj.result : JSON.stringify(obj.result ?? "");
    const costUsd = typeof obj.total_cost_usd === "number" ? obj.total_cost_usd : null;
    const numTurns = typeof obj.num_turns === "number" ? obj.num_turns : null;
    return { isError, resultText, costUsd, numTurns };
  } catch {
    return { isError: true, resultText: `Unparseable claude output: ${stdout.slice(0, 500)}`, costUsd: null, numTurns: null };
  }
}
