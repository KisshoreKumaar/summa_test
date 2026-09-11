'use client';

import { useRef } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { Send } from 'lucide-react';
import { sendMessageAction, type MessageActionState } from '@/lib/actions/messages';
import { Button } from '@/components/ui/button';

const initialState: MessageActionState = {};

function SendButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="icon" loading={pending} aria-label="Send message">
      {!pending && <Send className="h-4 w-4" aria-hidden />}
    </Button>
  );
}

export function MessageComposer({
  conversationId,
  disabled,
  disabledReason,
}: {
  conversationId: string;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useFormState(sendMessageAction, initialState);

  if (disabled) {
    return (
      <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 text-center text-sm text-slate-500">
        {disabledReason ?? 'You cannot send messages in this conversation.'}
      </div>
    );
  }

  return (
    <div className="border-t border-slate-200 bg-white px-4 py-3">
      {state.error && <p className="mb-2 text-sm text-red-600">{state.error}</p>}

      <form
        ref={formRef}
        action={async (formData) => {
          await formAction(formData);
          formRef.current?.reset();
        }}
        className="flex items-end gap-2"
      >
        <input type="hidden" name="conversationId" value={conversationId} />
        <textarea
          name="content"
          rows={1}
          required
          placeholder="Write a message…"
          aria-label="Write a message"
          onKeyDown={(e) => {
            // Enter sends; Shift+Enter makes a new line.
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
          className="max-h-32 min-h-[2.5rem] flex-1 resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
        />
        <SendButton />
      </form>
    </div>
  );
}
