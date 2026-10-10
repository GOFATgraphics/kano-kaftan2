import { useEffect, useId } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Database } from "@/integrations/supabase/types";

export type ConversationSummary = Database["public"]["Functions"]["list_inbox"]["Returns"][number];
export type ChatMessage = Database["public"]["Tables"]["messages"]["Row"];

export function useConversations() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const queryClient = useQueryClient();
  const instanceId = useId();

  const query = useQuery({
    queryKey: ["conversations", userId],
    queryFn: async (): Promise<ConversationSummary[]> => {
      const { data, error } = await supabase.rpc("list_inbox", {});
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!userId,
  });

  // Refresh the inbox whenever one of my conversations changes.
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`inbox-${userId}-${instanceId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () => {
        queryClient.invalidateQueries({ queryKey: ["conversations", userId] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient, instanceId]);

  const unreadCount = (query.data ?? []).filter((c) => c.unread).length;
  return { conversations: query.data ?? [], isLoading: query.isLoading, unreadCount };
}

export function useConversation(conversationId: string | undefined) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const queryClient = useQueryClient();

  const summaryQuery = useQuery({
    queryKey: ["conversation", conversationId],
    queryFn: async (): Promise<ConversationSummary | null> => {
      const { data, error } = await supabase.rpc("list_inbox", { p_conversation_id: conversationId! });
      if (error) throw error;
      return data?.[0] ?? null;
    },
    enabled: !!conversationId && !!userId,
  });

  const messagesQuery = useQuery({
    queryKey: ["messages", conversationId],
    queryFn: async (): Promise<ChatMessage[]> => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId!)
        .order("created_at", { ascending: true })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!conversationId && !!userId,
  });

  useEffect(() => {
    if (!conversationId || !userId) return;
    const channel = supabase
      .channel(`messages-${conversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const message = payload.new as ChatMessage;
          queryClient.setQueryData<ChatMessage[]>(["messages", conversationId], (old = []) =>
            old.some((m) => m.id === message.id) ? old : [...old, message],
          );
          if (message.sender_id !== userId) {
            supabase.rpc("mark_conversation_read", { p_conversation_id: conversationId });
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, userId, queryClient]);

  // Opening the thread marks it read.
  useEffect(() => {
    if (!conversationId || !userId) return;
    supabase.rpc("mark_conversation_read", { p_conversation_id: conversationId }).then(() => {
      queryClient.invalidateQueries({ queryKey: ["conversations", userId] });
    });
  }, [conversationId, userId, queryClient]);

  const sendMessage = useMutation({
    mutationFn: async (body: string) => {
      const { data, error } = await supabase
        .from("messages")
        .insert({ conversation_id: conversationId!, sender_id: userId!, body: body.trim() })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (message) => {
      queryClient.setQueryData<ChatMessage[]>(["messages", conversationId], (old = []) =>
        old.some((m) => m.id === message.id) ? old : [...old, message],
      );
    },
  });

  return {
    conversation: summaryQuery.data ?? null,
    messages: messagesQuery.data ?? [],
    isLoading: summaryQuery.isLoading || messagesQuery.isLoading,
    sendMessage,
    userId,
  };
}

export function useStartConversation() {
  return useMutation({
    mutationFn: async ({ vendorId, productId }: { vendorId: string; productId?: string }) => {
      const { data, error } = await supabase.rpc("start_conversation", {
        p_vendor_id: vendorId,
        p_product_id: productId ?? null,
      });
      if (error) throw new Error(error.message);
      return data;
    },
  });
}

/** Opens (or reuses) the signed-in user's chat with the Kano Kaftan team. */
export function useStartSupportConversation() {
  return useMutation({
    mutationFn: async (productId?: string) => {
      const { data, error } = await supabase.rpc("start_support_conversation", {
        p_product_id: productId ?? null,
      });
      if (error) throw new Error(error.message);
      return data;
    },
  });
}
