import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import TextAreaAutoSize from "react-textarea-autosize";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowUpIcon, Loader2Icon } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { useTRPC } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Form, FormField } from "@/components/ui/form";
import { Usage } from "./usages";
import { useRouter } from "next/navigation";

interface Props {
    projectId: string;
}

const formSchema = z.object({
    value: z.string()
        .min(1, {message: "Value is required"})
        .max(10000, {message: "Value is too long"}),
})

export const MessageForm = ({ projectId }: Props) => {
    

    const queryClient = useQueryClient();
    const trpc = useTRPC();
    const router = useRouter();

    const {data: usage} = useQuery(trpc.usage.status.queryOptions());


    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            value: "",
        },
    });

    const createMessage = useMutation(trpc.messages.create.mutationOptions({
        onSuccess: () => {
            form.reset();
            queryClient.invalidateQueries(
                trpc.messages.getMany.queryOptions({
                    projectId,
                })
            );
            queryClient.invalidateQueries(
                trpc.usage.status.queryOptions()
            );
        },
        onError: (error) => {
            //TODO: redirect to pricing page if specific error
            toast.error(error.message || "Failed to create message");
            if (error.data?.code === "BAD_REQUEST") {
                router.push("/pricing");
            }
        },
    }))
    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        await createMessage.mutateAsync({
            value: values.value,
            projectId,
        })
    }

    const [isFocused, setIsFocused] = useState(false);
    const showUsage = !!usage;
    const isPending = createMessage.isPending;
    const isButtonDisabled = isPending || !form.formState.isValid;
    return (
        <Form {...form}>
            {showUsage && (
                <Usage 
                    points={usage.remainingPoints}
                    msBeforeNext={usage.msBeforeNext}
                />
            )}
            <form
            onSubmit={form.handleSubmit(onSubmit)}
            className={cn(
                "relative border p-4 pt-2 rounded-xl bg-sidebar transition-all",
                isFocused && "shadow-xs",
                showUsage && "rounded-t-none"
            )}
            >
               <FormField 
               control={form.control}
               name="value"
               render={({ field}) => (
                <TextAreaAutoSize 
                {...field}
                disabled={isPending}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                minRows={2}
                maxRows={8}
                className="pt-4 resize-none border-none w-full outline-none bg-transparent"
                placeholder="What would you like to build?"
                onKeyDown={(e) => {
                    if(e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                        e.preventDefault();
                        form.handleSubmit(onSubmit)(e);
                    }
                }}
                />
               )}
               /> 
               <div className="flex gap-x-2 items-end justify-between pt-2">
                <div className="text-[10px] text-muted-foreground font-mono">
                    <kbd className="ml-auto pointer-events-none inline-flex  h-5 selected-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                       <span>&#8984;</span>Enter 
                    </kbd>
                    &nbsp;to submit
                </div>
                <Button 
                disabled={isButtonDisabled}
                className={cn(
                    "size-8 rounded-full",
                     isButtonDisabled && "bg-muted-foreground border"  
                    )}
                >
                    {isPending ? (
                        <Loader2Icon className="size-4 animate-spin" />
                    ) : (
                        <ArrowUpIcon className="size-4" />
                    )}
                    
                </Button>
               </div>
            </form>
        </Form>
    )
}