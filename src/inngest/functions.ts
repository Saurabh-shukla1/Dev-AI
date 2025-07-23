
import { Sandbox } from "@e2b/code-interpreter"
import { inngest } from "./client";
import { gemini, createAgent, createTool, createNetwork} from "@inngest/agent-kit";
import { getsandbox, lastAssitantTextMessageContent } from "./utils";
import { z } from "zod";
import { PROMPT } from "@/prompt";

export const helloWorld = inngest.createFunction(
  { id: "hello-world" },
  { event: "test/hello.world" },
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
    const codeAgent = createAgent({
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
            { step, network }
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


    const network = createNetwork({
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


    const sandboxUrl = await step.run("get-sandbox-url", async () => {
      const sandbox = await getsandbox(sandboxId);
      const host = sandbox.getHost(3000);
      return `http://${host}`;
    })


    return {
      url: sandboxUrl,
      title: "Fragment",
      files: result.state.data.files,
      summary: result.state.data.summary,
    };
  },
);