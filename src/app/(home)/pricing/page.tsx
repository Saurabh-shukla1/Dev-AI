"use client";

import { useCurrentTheme } from "@/hooks/use-current-theme";
import { PricingTable } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import Image from "next/image";

const page = () => {
    const currentTheme = useCurrentTheme();
    return (
        <div className="flex flex-col max-w-3xl mx-auto w-full">
            <section className="space-y-2 pt-[16vh] 2xl:pt-48 mb-2">
                <div className="flex flex-col items-center">
                    <Image 
                    src="/logo.svg"
                    alt="DevAI"
                    width={70}
                    height={70}
                    className="hidden sm:block"
                    />
                </div>
                <h1 className="text-xl md:text-3xl font-bold text-center">Pricing</h1>
                <p className="text-muted-foreground text-center text-sm md:text-base">
                    Choose the plan that&apos;s right for you.
                </p>
            </section>
            <PricingTable 
            appearance={{
                baseTheme: currentTheme === "dark" ? dark : undefined,
                elements: {
                    pricingTableCard: "border! shadow-none! rounded-lg!",
                }
            }}
            />
        </div>
    )
}

export default page;