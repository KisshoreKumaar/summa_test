'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { Flag } from 'lucide-react';
import { fileReportAction, type AdminActionState } from '@/lib/actions/admin';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Textarea } from '@/components/ui/textarea';
import type { ReportTargetType } from '@/lib/types/database';

const initialState: AdminActionState = {};

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant="danger" loading={pending}>
      Send report
    </Button>
  );
}

/** Lets any signed-in user flag a post, message, or profile for moderation. */
export function ReportButton({
  targetType,
  targetId,
  label = 'Report',
  compact,
}: {
  targetType: ReportTargetType;
  targetId: string;
  label?: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useFormState(fileReportAction, initialState);

  return (
    <>
      {compact ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={label}
          title={label}
          className="rounded p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
        >
          <Flag className="h-4 w-4" />
        </button>
      ) : (
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(true)}>
          <Flag className="h-4 w-4" aria-hidden />
          {label}
        </Button>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Report to moderators"
        description="Tell us what is wrong. A moderator will review it."
      >
        {state.message ? (
          <Alert tone="success">{state.message}</Alert>
        ) : (
          <form action={formAction} className="space-y-4">
            <input type="hidden" name="targetType" value={targetType} />
            <input type="hidden" name="targetId" value={targetId} />

            {state.errors?._form && <Alert tone="error">{state.errors._form}</Alert>}

            <Textarea
              name="reason"
              rows={4}
              placeholder="What is the problem?"
              aria-label="Reason for reporting"
              maxLengthCounter={1000}
              error={state.errors?.reason}
              required
            />

            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Submit />
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
