
import { Sandbox } from "@e2b/code-interpreter"
import { inngest } from "./client";
import { gemini, createAgent, createTool, createNetwork, Tool} from "@inngest/agent-kit";
import { getsandbox, lastAssitantTextMessageContent } from "./utils";
import { z } from "zod";
import { PROMPT } from "@/prompt";
import { prisma } from "@/lib/db";


interface AgentState {
  summary: string;
  files: { [path: string]: string };
};

export const codeAgentFunction = inngest.createFunction(
  { id: "code-agent" },
  { event: "code-agent/run" },
  async ({ event, step }) => {
    const sandboxId = await step.run("get-sandbox-id",
      async () => {
        const sandbox = await Sandbox.create("devai-nextjs-saurabh-2");
        return sandbox.sandboxId;
      }
    )
    if (!sandboxId) {
      throw new Error("Failed to create or retrieve sandbox ID");
    }
    const codeAgent = createAgent<AgentState>({
      name: "codeAgent",
      description: "An expert coding agent",
      system: PROMPT,
      model: gemini({ model: "gemini-2.5-flash" }),
      tools: [
        createTool({
          name: 'terminal',
          description: 'Use the terminal to run commands',
          parameters: z.object({
            command: z.string().describe("The command to execute in the terminal"),
          }),
          handler: async ({ command }, { step }) => {
            return await step?.run("terminal", async () => {
              const buffer = { stdout: "", stderr: "" };
              
              try {
                const sandbox = await getsandbox(sandboxId);
                const result = await sandbox.commands.run(command, {
                  onStdout: (data: string) => {
                    buffer.stdout += data;
                  },
                  onStderr: (data: string) => {
                    buffer.stderr += data;
                  }
                });
                return result.stdout;
                } catch (e) {
                  console.error(`Command failed: ${e} \n stdout: ${buffer.stdout} \n stderr: ${buffer.stderr}`);
                  return `Command failed: ${e} \nstdout: ${buffer.stdout}\nstderr: ${buffer.stderr}`;
                  }
              });
          }
        }),
        createTool({
          name: "createOrUpdateFiles",
          description: "Create or update files in the sandbox",
          parameters: z.object({
            files: z.array(
              z.object({
                path: z.string(),
                content: z.string(),
              }),
            ),
          }),
          handler: async (
            { files },
            { step, network }: Tool.Options<AgentState>
          ) => {
            const newFiles = await step?.run("createOrUpdateFiles" , async () => {
              try {
                const updatedFiles = network.state.data.files || {};
                const sandbox = await getsandbox(sandboxId);
                for(const file of files){
                  await sandbox.files.write(file.path, file.content);
                  updatedFiles[file.path] = file.content;
                }
                return updatedFiles;
              } catch (e) {
                return "Error: " + e;
              }
            });
            if(typeof newFiles === "object"){
              network.state.data.files = newFiles;
            }
          }
        }),
        createTool({
          name: "readFiles",
          description: "Read files from the sandbox",
          parameters: z.object({
            files: z.array(z.string()),
          }),
          handler:  async ({ files }, { step }) => {
            return await step?.run("readFiles", async () => {
              try {
                const sandbox = await getsandbox(sandboxId);
                const contents = [];
                for(const file of files) {
                  const content = await sandbox.files.read(file);
                  contents.push({ path: file, content})
                }
                return JSON.stringify(contents);
              } catch (e) {
                return "Error: " + e;
              }
            })
          }
        })
      ],
      lifecycle: {
        onResponse: async ({ result, network }) => {
          const lastAssitantMessageText = 
          lastAssitantTextMessageContent(result);

          if(lastAssitantMessageText && network) {
            if(lastAssitantMessageText.includes("<task_summary>")){
              network.state.data.summary = lastAssitantMessageText;
            }
          }

          return result;
        }
      }
    });


    const network = createNetwork<AgentState>({
      name: "coading-agent-network",
      agents: [codeAgent],
      maxIter: 15,
      router: async ({ network }) => {
        const summary = network.state.data.summary;

        if(summary){
          return;
        }
        return codeAgent;
      }
    });


    const result = await network.run(event.data.value);

    const isError = 
      !result.state.data.summary ||
      Object.keys(result.state.data.files || {}).length === 0;


    const sandboxUrl = await step.run("get-sandbox-url", async () => {
      const sandbox = await getsandbox(sandboxId);
      const host = sandbox.getHost(3000);
      return `http://${host}`;
    });

    await step.run("save-files", async () => {
      if(isError) {
        return await prisma.message.create({
          data: {
            content: "Something went wrong. Please try again.",
            projectId: event.data.projectId,
            role: "ASSISTANT",
            type: "RESULT",
          }
        });
      }

      return await prisma.message.create({
        data: {
          content: result.state.data.summary,
          projectId: event.data.projectId,
          role: "ASSISTANT",
          type: "RESULT",
          fragment: {
            create: {
              sandboxUrl: sandboxUrl,
              title: "Fragment",
              files: result.state.data.files,
            }
          }
        }
      })
    })


    return {
      url: sandboxUrl,
      title: "Fragment",
      files: result.state.data.files,
      summary: result.state.data.summary,
    };
  },
);