"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { gradientFor } from "@/lib/avatar-gradient";
import { cn } from "@/lib/utils";
import { AssistantCard, AssistantCardList, AssistantCardRow } from "./AssistantCard";
import type { Contact } from "@/app/api/gmail/contacts/route";

export function ContactPickerCard({
  name,
  contacts,
  onSelect,
}: {
  name: string;
  contacts: Contact[];
  onSelect: (contact: Contact) => void;
}) {
  return (
    <AssistantCard eyebrow={`Multiple matches for "${name}"`} eyebrowBordered>
      <AssistantCardList>
        {contacts.map((contact) => (
          <AssistantCardRow
            key={contact.email}
            onClick={() => onSelect(contact)}
            avatar={
              <Avatar className="size-7 shrink-0">
                <AvatarFallback className={cn("bg-gradient-to-br text-[10px] text-white", gradientFor(contact.name))}>
                  {contact.name[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
            }
          >
            <p className="truncate font-medium">{contact.name}</p>
            <p className="truncate text-xs text-muted-foreground">{contact.email}</p>
          </AssistantCardRow>
        ))}
      </AssistantCardList>
    </AssistantCard>
  );
}
