

import { Hint } from "@/components/hint";
import { Button } from "@/components/ui/button";
import { Fragment } from "@/generated/prisma";
import { ExternalLinkIcon, RefreshCcwIcon } from "lucide-react";
import { useState } from "react";


interface Props {
    data: Fragment
};

export const FragmentWeb = ({ data }: Props) => {
    const [fragmentKey, setFragmentKey] = useState(0);
    const [copied, setCopied] = useState(false);

    const onRefresh = () => {
        setFragmentKey((prev) => prev + 1);
    }

    const handleCopy = () => {
        navigator.clipboard.writeText(data.sandboxUrl);
        setCopied(true);
        setTimeout(() => {
            setCopied(false);
        }, 2000);
    }
    return (
        <div className="flex flex-col w-full h-full">
            <div className="p-2 border-b bg-sidebar flex items-center gap-x-2">
                <Hint text="Refresh the page" side="bottom" align="start">
                    <Button size="sm" variant="outline" onClick={onRefresh}>
                        <RefreshCcwIcon />
                    </Button>
                </Hint>
                <Hint text="copy URL" side="bottom" align="start">
                    <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={handleCopy}
                    disabled={!data.sandboxUrl || copied}
                    className="flex-1 justify-start text-start font-normal"
                    >
                        <span className="truncate">{data.sandboxUrl}</span>
                    </Button>
                </Hint>
                <Hint text="Open in new tab" side="bottom" align="start">
                    <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                        if (!data.sandboxUrl) return;
                        window.open(data.sandboxUrl, "_blank");
                    }}
                    disabled={!data.sandboxUrl}
                    >
                    <ExternalLinkIcon />
                    </Button>
                </Hint>
            </div>
            <iframe
                key={fragmentKey}
                className="h-full w-full"
                sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-top-navigation"
                loading="lazy"
                src={data.sandboxUrl}
            />
        </div>
    )
}