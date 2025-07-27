

import { RateLimiterPrisma} from "rate-limiter-flexible";
import { prisma } from "./db";
import { auth } from "@clerk/nextjs/server";
import { Usage } from "@/modules/ui/components/usages";


const FREE_POINTS = 2;
const PRO_POINTS = 1000; // Assuming Pro plan has 1000 points
const DURATION = 30 * 24 * 60 * 60; // 30
const GENERATION_COST = 1;

export async function getUsageTracker() {
    const { has } = await auth();
    const hasProAccess = has({plan: "pro"});

    const usageTracker = new RateLimiterPrisma({
        storeClient: prisma,
        tableName: "Usage",
        points: hasProAccess ? PRO_POINTS : FREE_POINTS,
        duration: DURATION,
    });

    return usageTracker;
};

export async function consumedCredits(){
    const { userId } = await auth();
    if (!userId) {
        throw new Error("User not authenticated");
    }

    const usage = await getUsageTracker();
    const result = await usage.consume(userId, GENERATION_COST);
    return result;
}

export async function getUsageStatus() {
    const { userId } =await auth();
    if (!userId) {
        throw new Error("User not authenticated");
    }

    const usage = await getUsageTracker();
    const result = await usage.get(userId);
    return result;
}