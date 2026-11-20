"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { useActionState } from "react";
import { RiLoader2Fill } from "@remixicon/react";
import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { signUp } from "@/features/dashboard/actions";
import { Logo } from "@/features/dashboard/components/Logo";

type ActionState = {
  message: string | null;
  formData: {
    phone: string;
    country: string;
  };
};

const initialState: ActionState = {
  message: null,
  formData: {
    phone: "",
    country: "US",
  },
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      className="w-full py-2 font-medium"
      disabled={pending}
    >
      {pending ? (
        <RiLoader2Fill className="size-4 shrink-0 animate-spin" />
      ) : (
        "Sign up"
      )}
    </Button>
  );
}

export function SignUpForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [state, formAction] = useActionState(signUp, initialState);

  return (
    <main className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="flex items-center space-x-1.5">
          <Logo aria-hidden="true" />
        </div>
        <h1 className="mt-6 text-lg font-semibold text-foreground dark:text-foreground">
          Create your account
        </h1>
        <p className="mt-2 text-sm text-muted-foreground dark:text-muted-foreground">
          Already have an account?
          <Link
            href="/dashboard/signin"
            className="ml-1 font-medium text-primary hover:text-primary/90 dark:text-primary hover:dark:text-primary/90"
          >
            Sign in
          </Link>
        </p>

        <form action={formAction} className="mt-8 space-y-4">
          <div>
            <Label htmlFor="name" className="text-sm font-medium text-foreground">Name</Label>
            <Input id="name" name="name" autoComplete="name" required className="mt-2 bg-muted/40" />
          </div>
          <div>
            <Label htmlFor="country" className="text-sm font-medium text-foreground">Country</Label>
            <select id="country" name="country" defaultValue={state.formData.country || "US"} className="mt-2 flex h-9 w-full rounded-md border border-input bg-muted/40 px-3 text-sm">
              <option value="US">United States or Canada</option>
              <option value="PE">Peru</option>
            </select>
          </div>
          <div>
            <Label htmlFor="phone" className="text-sm font-medium text-foreground">Phone</Label>
            <Input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" required placeholder="415 555 2671" defaultValue={state.formData.phone} className="mt-2 bg-muted/40" />
          </div>
          <div>
            <Label htmlFor="pin" className="text-sm font-medium text-foreground">PIN</Label>
            <div className="relative mt-2">
              <Input
                type={showPassword ? "text" : "password"}
                id="pin"
                name="pin"
                autoComplete="new-password"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                placeholder="6 digits"
                className="pr-10 bg-muted/40"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-500"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>
          <SubmitButton />
        </form>

        {state.message && (
          <Badge
            variant="destructive"
            className="hover:bg-destructive/10 bg-destructive/5 flex text-base items-start gap-2 border border-destructive/50 p-4 rounded-sm mt-4"
          >
            <div className="flex flex-col gap-1">
              <h2 className="uppercase tracking-wider font-semibold text-sm">
                Error
              </h2>
              <span className="break-all text-sm opacity-75 font-normal">
                {state.message}
              </span>
            </div>
          </Badge>
        )}
      </div>
    </main>
  );
}