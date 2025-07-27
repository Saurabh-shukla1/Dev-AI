import { inngest } from "@/inngest/client";
import { prisma } from "@/lib/db";
import { consumedCredits } from "@/lib/usage";
import { protectedProcedure, createTRPCRouter } from "@/trpc/init";
import { TRPCError } from "@trpc/server";
import { z } from "zod";



export const messagesRouter = createTRPCRouter({
    
    getMany: protectedProcedure
        .input(
            z.object({
                projectId: z.string().min(1, {message: "Project ID is required"}),
            })
        )

        .query( async ({ input, ctx }) => {
            const messages = await prisma.message.findMany({
                where: {
                    projectId: input.projectId,
                    project: {
                        userId: ctx.auth.userId,
                    },
                },
                orderBy: {
                    updatedAt: "asc",
                },
                include: {
                    fragment: true,
                },
            });
            return messages;
        }),
    create: protectedProcedure
        .input(
            z.object({
                value: z.string()
                    .min(1, {message: "Value is required"})
                    .max(10000, {message: "Value is too long"}),
                projectId: z.string().min(1, {message: "Project ID is required"}),
            })
        )
        .mutation(async ({ input, ctx }) => {
            const existingProject = await prisma.project.findUnique({
                where: {
                    id: input.projectId,
                    userId: ctx.auth.userId,
                },
            });
            if(!existingProject) {
                throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
            }

            try {
                await consumedCredits();
            } catch (error) {
                if(error instanceof Error){
                    throw new TRPCError({ code: "BAD_REQUEST", message: "something went wrong, please try again later" });
                } else {
                    throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Youy have exceeded your usage limit, please upgrade your plan" });
                }
            }

            const createMessage = await prisma.message.create({
                data: {
                   content: input.value,
                   projectId: existingProject.id,
                   role: "USER",
                   type: "RESULT",
                },
            });
            

            await inngest.send({
                name: "code-agent/run",
                data: {
                    value: input.value,
                    projectId: input.projectId,
                },
            });

            return createMessage;
        })
});