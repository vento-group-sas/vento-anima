export type TicketStatus = "open" | "in_progress" | "resolved" | "closed";

export type TicketRow = {
  id: string;
  title: string;
  description: string | null;
  status: TicketStatus;
  category: string;
  site_id: string | null;
  created_by: string;
  assigned_to: string | null;
  target_employee_id: string | null;
  created_at: string;
  updated_at: string;
  siteName: string | null;
  lastReadAt: string | null;
  hiddenAt: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
};

export type MessageRow = {
  id: string;
  ticket_id: string;
  author_id: string;
  body: string;
  created_at: string;
};

import { Ionicons } from "@expo/vector-icons";

export type FaqItem = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  content: string[];
};
