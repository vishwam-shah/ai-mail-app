import { redirect } from "next/navigation";
import { auth, signOut } from "@/lib/auth";
import { MailSidebar } from "@/components/mail/MailSidebar";
import { NewMailNotifier } from "@/components/mail/NewMailNotifier";
import { CopilotProvider } from "@/components/assistant/CopilotProvider";
import { AssistantPanel } from "@/components/assistant/AssistantPanel";
import { AssistantActions } from "@/components/assistant/AssistantActions";
import { SWRProvider } from "@/components/swr-provider";

export default async function MailLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = session.user;

  async function handleSignOut() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <SWRProvider>
      <CopilotProvider>
        <div className="flex flex-1 min-h-0">
          <MailSidebar
            user={{ name: user.name, email: user.email, image: user.image }}
            signOutAction={handleSignOut}
          />
          <main className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</main>
          <AssistantPanel />
          <AssistantActions />
          <NewMailNotifier />
        </div>
      </CopilotProvider>
    </SWRProvider>
  );
}
