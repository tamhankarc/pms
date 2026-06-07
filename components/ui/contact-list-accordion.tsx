"use client";

import { useState } from "react";

type ContactListItem =
  | string
  | {
      id?: string;
      name: string;
      email?: string | null;
    };

type ContactListAccordionProps = {
  contacts?: ContactListItem[] | string | null;
};

function normalizeContacts(contacts?: ContactListItem[] | string | null) {
  if (!contacts) return [];

  const rawItems = Array.isArray(contacts) ? contacts : contacts.split(",");

  return rawItems
    .map((item) => {
      if (typeof item === "string") return item.trim();
      const email = item.email?.trim();
      return `${item.name}${email ? ` (${email})` : ""}`.trim();
    })
    .filter(Boolean)
    .filter((item) => item !== "-");
}

export function ContactListAccordion({ contacts }: ContactListAccordionProps) {
  const items = normalizeContacts(contacts);
  const [open, setOpen] = useState(false);

  if (!items.length) return null;

  return (
    <div className="mt-1 text-xs text-slate-600">
      <div>{items[0]}</div>
      {items.length > 1 ? (
        <div>
          <button
            type="button"
            className="mt-1 text-xs font-semibold text-brand-700 hover:text-brand-900"
            onClick={() => setOpen((value) => !value)}
          >
            {open ? "Hide" : `Show ${items.length - 1} more contact(s)`}
          </button>
          {open ? (
            <div className="mt-1 space-y-1">
              {items.slice(1).map((item, index) => (
                <div key={`${item}-${index}`}>{item}</div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
