"use client";

import { Button, buttonVariants } from "@/components/ui/button";
import { UserControl } from "@/components/user-control";
import { useScroll } from "@/hooks/use-scroll";
import { cn } from "@/lib/utils";
import { SignedIn, SignedOut, SignInButton, SignUpButton } from "@clerk/nextjs";
import { Github } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export const  Navbar = () => {

    const isScrolled = useScroll();

    return (
        <nav
        className={cn(
            "p-4 bg-transparent fixed top-0 left-0 right-0 z-50 transparent-all duration-200 border-b border-transparent",
            isScrolled && "bg-background/80 backdrop-blur-md border-border"
        )}
        >
            <div className="max-w-5xl mx-auto flex justify-between items-center">
                <Link
                href="/"
                className="flex items-center gap-2"
                >
                    <Image
                    src="/logo.svg"
                    alt="DevAI"
                    width={32}
                    height={32}
                    />
                    <span className="font-semibold text-lg">DevAI</span>
                </Link>
                <SignedOut>
                    <div className="flex gap-2">
                        <Link href="https://github.com/Saurabh-shukla1/Dev-AI" >
                            <Image
                                src="github.svg"
                                alt="GitHub"
                                width={30}
                                height={30}
                                className="rounded-full hover:opacity-75 transition-opacity bg-white"
                            />
                        </Link>
                        <SignUpButton>
                            <Button variant="default" size="sm">
                                Sign Up
                            </Button>
                        </SignUpButton>
                        <SignInButton>
                            <Button variant="outline" size="sm">
                                Sign In
                            </Button>
                        </SignInButton>
                    </div>
                </SignedOut>
                <SignedIn>
                    <UserControl showName/>
                </SignedIn>
            </div>
        </nav>
    )
}