'use client';

import { useState } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { RiLoader2Fill } from "@remixicon/react";
import { Eye, EyeOff } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { signIn } from "@/features/dashboard/actions";

type SignInFormProps = {
  from: string;
}

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
    phone: '',
    country: 'US',
  }
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
        "Sign in"
      )}
    </Button>
  );
}

export function SignInForm({ from }: SignInFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [state, formAction] = useActionState(signIn, initialState);

  return (
    <>
      <form action={formAction} className="mt-8 space-y-4">
        <input type="hidden" name="from" value={from} />
        <div>
          <Label htmlFor="country" className="text-sm font-medium text-foreground dark:text-foreground">Country</Label>
          <select id="country" name="country" defaultValue={state.formData.country || 'US'} className="mt-2 flex h-9 w-full rounded-md border border-input bg-muted/40 px-3 text-sm">
            <option value="US">United States or Canada</option>
            <option value="PE">Peru</option>
          </select>
        </div>
        <div>
          <Label
            htmlFor="phone"
            className="text-sm font-medium text-foreground dark:text-foreground"
          >
            Phone
          </Label>
          <Input
            type="tel"
            id="phone"
            name="phone"
            autoComplete="username"
            inputMode="tel"
            placeholder="415 555 2671"
            className="mt-2 bg-muted/40"
            defaultValue={state.formData.phone}
            required
          />
        </div>
        <div>
          <Label
            htmlFor="pin"
            className="text-sm font-medium text-foreground dark:text-foreground"
          >
            PIN
          </Label>
          <div className="relative mt-2">
            <Input
              type={showPassword ? "text" : "password"}
              id="pin"
              name="pin"
              autoComplete="current-password"
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
        <Badge variant="destructive" className="hover:bg-destructive/10 bg-destructive/5 flex text-base items-start gap-2 border border-destructive/50 p-4 rounded-sm mt-4">
          <div className="flex flex-col gap-1">
            <h2 className="uppercase tracking-wider font-semibold text-sm">Error</h2>
            <span className="break-all text-sm opacity-75 font-normal">{state.message}</span>
          </div>
        </Badge>
      )}
    </>
  );
} 