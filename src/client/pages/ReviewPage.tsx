import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSession, discardProposal, retryProposalProcessing } from "../state/session";
import { approveProposal, skipProposal, retryProposalWrite } from "../state/api";
import { ReviewPanel } from "../components/ReviewPanel";
import type { PublicWriteFields } from "../../shared/contracts";

export function ReviewPage() {
  const { review, setReview, afterWrite, pending, setError, error, refresh } = useSession();
  const [localPending, setLocalPending] = useState(false);
  const navigate = useNavigate();
  const busy = pending || localPending;

  const proposal = review;
  if (!proposal) {
    return (
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Review</h1>
        <p className="mt-2 text-sm text-slate-600">
          Nothing waiting for review. Finish a call and the proposed Sheet update will appear here.
        </p>
        <Link to="/leads" className="mt-4 inline-block rounded-md border border-slate-300 px-4 py-2 text-sm font-medium">
          Back to leads
        </Link>
      </div>
    );
  }

  const proposalId = proposal.id;
  const proposalValue = proposal;

  async function withLocal(action: () => Promise<void>) {
    setLocalPending(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLocalPending(false);
    }
  }

  async function onApprove(fields?: PublicWriteFields) {
    await withLocal(async () => {
      await afterWrite(await approveProposal(proposalId, fields));
      navigate("/leads");
    });
  }

  return (
    <ReviewPanel
      proposal={proposalValue}
      pending={busy}
      error={error}
      onApprove={(fields) => void onApprove(fields)}
      onRetryWrite={() => void withLocal(async () => {
        await afterWrite(await retryProposalWrite(proposalId));
        navigate("/leads");
      })}
      onRetryProcessing={() => void withLocal(async () => {
        setReview(await retryProposalProcessing(proposalId));
      })}
      onSkip={() => void withLocal(async () => {
        await afterWrite(await skipProposal(proposalId));
        navigate("/leads");
      })}
      onDiscard={() => void withLocal(async () => {
        await discardProposal(proposalId);
        setReview(null);
        await refresh();
        navigate("/leads");
      })}
    />
  );
}
