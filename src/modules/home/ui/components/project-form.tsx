import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import TextAreaAutoSize from "react-textarea-autosize";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowUpIcon, Loader2Icon } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { useTRPC } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Form, FormField } from "@/components/ui/form";
import { useRouter } from "next/navigation";
import { PROJECT_TEMPLATES } from "../constants";
import { useClerk } from "@clerk/nextjs";



const formSchema = z.object({
    value: z.string()
        .min(1, {message: "Value is required"})
        .max(10000, {message: "Value is too long"}),
})

export const ProjectForm = () => {
    

    const queryClient = useQueryClient();
    const trpc = useTRPC();
    const clerk = useClerk();
    const router = useRouter();
    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            value: "",
        },
    });

    const createProject = useMutation(trpc.projects.create.mutationOptions({
        onSuccess: (data) => {
            queryClient.invalidateQueries(
                trpc.projects.getMany.queryOptions()
            );
            router.push(`/projects/${data.id}`);
            queryClient.invalidateQueries(
                trpc.usage.status.queryOptions()
            )
        },
        onError: (error) => {
            if(error.data?.code === "UNAUTHORIZED") {
                clerk.openSignIn()
            }
            router.push("/pricing");
            //TODO: redirect to pricing page if specific error
            toast.error(error.message || "Failed to create message");
        },
    }))
    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        await createProject.mutateAsync({
            value: values.value,
        })
    }

    const onSelect = (value: string) => {
        form.setValue("value", value, {
            shouldValidate: true,
            shouldDirty: true,
            shouldTouch: true,
        });
    }

    const [isFocused, setIsFocused] = useState(false);
    const isPending = createProject.isPending;
    const isButtonDisabled = isPending || !form.formState.isValid;
    return (
        <Form {...form}>
            <section className="space-y-6">
                <form
                onSubmit={form.handleSubmit(onSubmit)}
                className={cn(
                    "relative border p-4 pt-2 rounded-xl bg-sidebar transition-all",
                    isFocused && "shadow-xs",
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
                <div className="flex-wrap justify-center gap-2 hidden md:flex mx-w-3xl">
                        {PROJECT_TEMPLATES.map((template) => (
                        <Button
                            key={template.title}
                            variant="outline"
                            size="sm"
                            className="bg-white dark:bg-sidebar"
                            onClick={() => onSelect(template.prompt)}
                        >
                            {template.emoji} {template.title}
                        </Button> 
                        ))}
                </div>
            </section>
        </Form>
    )
}