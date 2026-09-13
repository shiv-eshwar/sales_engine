import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useSession } from "../state/session";
import { fetchProposalBySession } from "../state/api";
import { ReviewChat } from "../components/ReviewChat";
import { EmptyState } from "../components/EmptyState";
import { ReviewSkeleton } from "../components/LoadingSkeleton";
import { EMPTY_COPY } from "../copy";
import type { PublicProposal } from "../../shared/contracts";

export function ReviewPage() {
  const { sessionId } = useParams();
  const { setReview, afterWrite, pending, error, refresh } = useSession();
  const [proposal, setProposal] = useState<PublicProposal | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!sessionId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setFetchError(null);
    void fetchProposalBySession(sessionId)
      .then((result) => {
        if (cancelled) return;
        setProposal(result);
        setReview(result);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setFetchError(err instanceof Error ? err.message : "Proposal is not ready");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  if (!sessionId) {
    return (
      <div>
        <div className="mt-8">
          <EmptyState
            icon="review"
            title={EMPTY_COPY.reviewSession.title}
            description={EMPTY_COPY.reviewSession.description}
            action={
              <Link to="/leads" className="text-sm font-medium underline underline-offset-2">
                Back to ready
              </Link>
            }
          />
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <ReviewSkeleton />
      </div>
    );
  }

  if (fetchError || !proposal) {
    return (
      <div>
        <div className="mt-8">
          <EmptyState
            icon="review"
            title={EMPTY_COPY.reviewMissing.title}
            description={fetchError ?? EMPTY_COPY.reviewMissing.description}
            action={
              <Link to="/leads" className="text-sm font-medium underline underline-offset-2">
                Back to ready
              </Link>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col">
        <ReviewChat
          proposal={proposal}
          pending={pending}
          error={error}
          onProposal={(next) => {
            setProposal(next);
            setReview(next);
          }}
          onFinished={async (path, result) => {
            if (result.sheet) {
              await afterWrite({
                proposal: result.proposal,
                lead: result.lead,
                leads: result.leads,
                sheet: result.sheet
              });
            } else {
              setReview(null);
              await refresh();
            }
            navigate(path);
          }}
        />
      </div>
    </div>
  );
}
