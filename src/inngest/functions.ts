
import { Sandbox } from "@e2b/code-interpreter"
import { inngest } from "./client";
import { gemini, createAgent } from "@inngest/agent-kit";
import { getsandbox } from "./utils";

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
    
    const summerizer = createAgent({
      name: "summerizer",
      system: "You are a React developer.  You write scalable and readable code.",
      model: gemini({ model: "gemini-1.5-flash"}),
    });


    const { output } = await summerizer.run(
      `Write the code for : ${event.data.value}`,
    );
    console.log(output);

    const sandboxUrl = await step.run("get-sandbox-url", async () => {
      const sandbox = await getsandbox(sandboxId);
      const host = sandbox.getHost(3000);
      return `http://${host}`;
    })


    return { output, sandboxUrl };
  },
);