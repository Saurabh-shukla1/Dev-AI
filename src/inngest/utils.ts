import {Sandbox} from "@e2b/code-interpreter";
import { AgentResult, TextMessage } from "@inngest/agent-kit";
import { SANDBOX_TIMEOUT } from "./types";

export async function getsandbox(sandboxId: string) {
    const sandbox = await Sandbox.connect(sandboxId)
    await sandbox.setTimeout(SANDBOX_TIMEOUT); // Set timeout to 10 minutes
    return sandbox;
}

export function lastAssitantTextMessageContent(result: AgentResult) {
    const lastAssitantTextMessageIndex = result.output.findLastIndex(
        (message) => message.role === "assistant"
    );
    const message = result.output[lastAssitantTextMessageIndex] as
    | TextMessage
    | undefined;

    return message?.content
    ? typeof message.content === "string"
        ? message.content
        : message.content.map((c) => c.text).join("")
    : undefined;
}