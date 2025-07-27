"use client";

import { Ban } from "lucide-react";
import Link from "next/link";

const ErrorPage = () => {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-100">
            <h1 className="text-2xl font-bold text-rose-700 flex flex-row"> <Ban className="mr-2 mt-2"/> An error occurred</h1>
            <p className="mt-2 text-gray-600">Please try again later or contact support.</p>
            <div className="mt-4">
                <Link href="/" className="text-blue-500 hover:underline">Go back to home</Link>
            </div>
        </div>
    )
}

export default ErrorPage;