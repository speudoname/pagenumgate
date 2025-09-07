import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-9 w-full min-w-0 rounded-md border-2 border-black bg-white px-3 py-1 text-base shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all duration-100 outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] focus:translate-x-[2px] focus:translate-y-[2px]",
        "placeholder:text-gray-500",
        className
      )}
      {...props}
    />
  )
}

export { Input }
