import { signIn, auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RiMailFill, RiSparkling2Line } from "@remixicon/react";
import { ThemeToggle } from "@/components/theme-toggle";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/inbox");

  return (
    <div className="relative flex flex-1 items-center justify-center p-6">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-sm shadow-xl">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
            <RiMailFill className="size-6" />
          </div>
          <CardTitle className="text-xl tracking-tight">AI Mail</CardTitle>
          <CardDescription className="text-balance">
            Sign in with Google to connect your Gmail inbox and let the assistant drive it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: "/inbox" });
            }}
          >
            <Button type="submit" className="w-full rounded-full shadow-sm">
              Sign in with Google
            </Button>
          </form>
          <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <RiSparkling2Line className="size-3.5" />
            Powered by an AI assistant that drives the UI
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
