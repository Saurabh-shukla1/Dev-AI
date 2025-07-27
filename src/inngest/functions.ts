
import { Sandbox } from "@e2b/code-interpreter"
import { inngest } from "./client";
import { gemini, createAgent, createTool, createNetwork, Tool, Message, createState} from "@inngest/agent-kit";
import { getsandbox, lastAssitantTextMessageContent } from "./utils";
import { z } from "zod";
import { FRAGMENT_TITLE_PROMPT, PROMPT, RESPONSE_PROMPT } from "@/prompt";
import { prisma } from "@/lib/db";
import { SANDBOX_TIMEOUT } from "./types";


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
        await sandbox.setTimeout(SANDBOX_TIMEOUT); // 10 minutes
        return sandbox.sandboxId;
      },
    );

    const previousMessages = await step.run("get-previous-messages", async () => {
      const formattedMessages: Message[] = [];

      const messages = await prisma.message.findMany({
        where:{
          projectId: event.data.projectId,
        },
        orderBy: {
          createdAt: "desc"
        },
        take: 5, // Limit to the last 5 messages
      });
      for(const message of messages) {
        formattedMessages.push({
          type: "text",
          role: message.role === "ASSISTANT" ? "assistant" : "user",
          content: message.content,
        });
      }
      return formattedMessages.reverse();
    });
    
    const state = createState<AgentState> (
      {
        summary: "",
        files: {},
      },
      {
        messages: previousMessages,
      }
    );


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
      defaultState: state,
      router: async ({ network }) => {
        const summary = network.state.data.summary;

        if(summary){
          return;
        }
        return codeAgent;
      }
    });


    const result = await network.run(event.data.value, {state});

    const fragmentTitleGenerator = createAgent({
      name: "fragment-title-generator",
      description: "An agent that generates fragment titles",
      system: FRAGMENT_TITLE_PROMPT,
      model: gemini({ model: "gemini-1.5-flash" }),
    })

    const ResponseGenerator = createAgent({
      name: "response-generator",
      description: "An agent that generates responses",
      system: RESPONSE_PROMPT,
      model: gemini({ model: "gemini-1.5-flash" }),
    })

    const { output: fragmentTitleOutput } = await fragmentTitleGenerator.run(result.state.data.summary);
    const { output: responseOutput } = await ResponseGenerator.run(result.state.data.summary);

    const generateFragmentTitle = () => {
      if(fragmentTitleOutput[0].type !== "text") {
        return "Fragment";
      }

      if(Array.isArray(fragmentTitleOutput[0].content)) {
        return fragmentTitleOutput[0].content.map((txt) => txt).join(" ");
      }
      else{
        return fragmentTitleOutput[0].content;
      } 
    }

    const generateResponse = () => {
      if(responseOutput[0].type !== "text") {
        return "Here you go";
      }

      if(Array.isArray(responseOutput[0].content)) {
        return responseOutput[0].content.map((txt) => txt).join(" ");
      }
      else{
        return responseOutput[0].content;
      } 
    }

    const isError = 
      !result.state.data.summary ||
      Object.keys(result.state.data.files || {}).length === 0;


    const sandboxUrl = await step.run("get-sandbox-url", async () => {
      const sandbox = await getsandbox(sandboxId);
      const host = sandbox.getHost(3000);
      return `https://${host}`;
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
          content: generateResponse(),
          projectId: event.data.projectId,
          role: "ASSISTANT",
          type: "RESULT",
          fragment: {
            create: {
              sandboxUrl: sandboxUrl,
              title: generateFragmentTitle(),
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