import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { format, isSameDay } from "date-fns";
import { ChevronLeft, Loader2, Send, ShieldAlert, ShieldCheck, ShoppingBag } from "lucide-react";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { useConversation, type ConversationSummary } from "@/hooks/useChat";
import { ChatWithUsButton } from "@/components/chat/ChatWithUsButton";
import { CreateOrderDialog } from "@/components/chat/CreateOrderDialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function Conversation() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const { conversation, messages, isLoading, sendMessage, userId } = useConversation(id);
  const [draft, setDraft] = useState("");
  const [orderOpen, setOrderOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate(`/auth?redirect=/messages/${id}`);
  }, [authLoading, user, navigate, id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  const handleSend = async () => {
    const body = draft.trim();
    if (!body) return;
    try {
      await sendMessage.mutateAsync(body);
      setDraft("");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Message not sent");
    }
  };

  const otherLink = conversation?.role === "customer" && conversation.shop_slug ? `/shop/${conversation.shop_slug}` : null;

  return (
    <MobileLayout hideHeader hideBottomNav>
      <div className="flex h-[100dvh] flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 border-b bg-background px-3 py-2">
          <Button variant="ghost" size="icon" onClick={() => navigate("/messages")} aria-label="Back to messages">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          {conversation ? (
            <>
              <Avatar className="h-9 w-9">
                <AvatarImage src={conversation.other_party_avatar || undefined} alt="" />
                <AvatarFallback>{conversation.other_party_name.charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                {otherLink ? (
                  <Link to={otherLink} className="block truncate font-semibold hover:underline">
                    {conversation.other_party_name}
                  </Link>
                ) : (
                  <p className="truncate font-semibold">{conversation.other_party_name}</p>
                )}
                {conversation.product_name && conversation.product_slug && (
                  <Link to={`/products/${conversation.product_slug}`} className="block truncate text-xs text-muted-foreground hover:underline">
                    About: {conversation.product_name}
                  </Link>
                )}
              </div>
            </>
          ) : (
            <Skeleton className="h-9 w-40" />
          )}
          {conversation?.role === "support_team" && conversation.other_party_id && (
            <Button size="sm" className="ml-auto flex-shrink-0" onClick={() => setOrderOpen(true)}>
              <ShoppingBag className="mr-1 h-4 w-4" />
              Create order
            </Button>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 space-y-2 overflow-y-auto px-3 py-4">
          <ChatNotice conversation={conversation} />

          {isLoading ? (
            <Loader2 className="mx-auto h-5 w-5 animate-spin" />
          ) : !conversation ? (
            <p className="text-center text-sm text-muted-foreground">Conversation not found.</p>
          ) : messages.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground">Say hello and ask your question.</p>
          ) : (
            messages.map((message, index) => {
              const mine = message.sender_id === userId;
              const created = new Date(message.created_at);
              const showDate = index === 0 || !isSameDay(created, new Date(messages[index - 1].created_at));
              return (
                <div key={message.id}>
                  {showDate && (
                    <p className="my-3 text-center text-xs text-muted-foreground">{format(created, "EEE, MMM d")}</p>
                  )}
                  <div className={cn("flex", mine ? "justify-end" : "justify-start")}>
                    <div
                      className={cn(
                        "max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm",
                        mine ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-muted",
                      )}
                    >
                      <MessageBody body={message.body} mine={mine} />
                      <span className={cn("mt-1 block text-right text-[10px]", mine ? "text-primary-foreground/70" : "text-muted-foreground")}>
                        {format(created, "h:mm a")}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        {conversation?.role === "support_team" && conversation.other_party_id && (
          <CreateOrderDialog
            open={orderOpen}
            onOpenChange={setOrderOpen}
            customerId={conversation.other_party_id}
            conversationId={conversation.id}
            suggestedProductId={conversation.product_id}
          />
        )}

        {/* Composer */}
        {conversation && (
          <div className="flex items-end gap-2 border-t bg-background p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Write a message"
              rows={1}
              maxLength={2000}
              className="max-h-32 min-h-[40px] resize-none"
            />
            <Button size="icon" onClick={handleSend} disabled={!draft.trim() || sendMessage.isPending} aria-label="Send">
              {sendMessage.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        )}
      </div>
    </MobileLayout>
  );
}

/** Context banner at the top of a thread. */
function ChatNotice({ conversation }: { conversation: ConversationSummary | null }) {
  if (!conversation) return null;

  if (conversation.role === "support_user") {
    return (
      <div className="mx-auto mb-3 flex max-w-md gap-2 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
        <ShieldCheck className="h-4 w-4 flex-shrink-0 text-primary" />
        <p>
          You're chatting with the Kano Kaftan team. Tell us what you'd like to buy: we get it from the seller, arrange
          delivery and send you a secure payment link here. The seller is only fully paid after you receive it.
        </p>
      </div>
    );
  }

  if (conversation.role === "support_team") {
    return (
      <div className="mx-auto mb-3 flex max-w-md gap-2 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
        <ShieldCheck className="h-4 w-4 flex-shrink-0 text-primary" />
        <p>
          Support chat with {conversation.other_party_is_vendor ? "a vendor" : "a customer"}. Replies are sent as Kano
          Kaftan and every admin can see this thread.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto mb-3 max-w-md space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
      <div className="flex gap-2">
        <ShieldAlert className="h-4 w-4 flex-shrink-0" />
        <p>
          {conversation.role === "customer"
            ? "Deals you agree directly with the seller, and payments made outside Kano Kaftan, are at your own risk."
            : "Deals agreed directly with customers are outside Kano Kaftan's protection."}
        </p>
      </div>
      {conversation.role === "customer" && (
        <ChatWithUsButton
          size="sm"
          variant="outline"
          className="w-full bg-background"
          productId={conversation.product_id ?? undefined}
          label="Buy through Kano Kaftan instead (protected)"
        />
      )}
    </div>
  );
}

/** Turns "/orders/<id>" in a message into a tappable link. */
function MessageBody({ body, mine }: { body: string; mine: boolean }) {
  const parts = body.split(/(\/orders\/[0-9a-f-]{36})/g);
  return (
    <>
      {parts.map((part, i) =>
        /^\/orders\/[0-9a-f-]{36}$/.test(part) ? (
          <Link key={i} to={part} className={cn("font-semibold underline", mine ? "text-primary-foreground" : "text-primary")}>
            Open order and pay
          </Link>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}
