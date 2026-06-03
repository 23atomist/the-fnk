import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as ableton from "@ableton-extensions/sdk";
import { buildQuestionModalHtml, toDataUrl, CANCEL_SENTINEL } from "../../selection/modalHtml.js";
import { withSafeHandler } from "../../core/errors.js";

export const AskUserShape = { question: z.string() };

type AskUserArgs = z.infer<ReturnType<typeof z.object<typeof AskUserShape>>>;

export function registerAskUserTool(
  server: McpServer,
  context: ableton.ExtensionContext<"1.0.0">,
): void {
  server.registerTool(
    "ask_user",
    {
      title: "Ask the producer a question",
      description:
        "Open a small dialog in Ableton to ask the producer one short clarifying question and return their typed answer. " +
        "Use ONLY when the request is genuinely ambiguous (e.g. count or length truly unclear). Returns the answer string, or 'CANCELLED' if they cancel.",
      inputSchema: AskUserShape,
    },
    withSafeHandler("ask_user", async (args: AskUserArgs) => {
      const answer = await context.ui.showModalDialog(toDataUrl(buildQuestionModalHtml(args.question)), 460, 220);
      const text = !answer || answer === CANCEL_SENTINEL ? "CANCELLED" : answer;
      return { content: [{ type: "text", text }] };
    }),
  );
}
