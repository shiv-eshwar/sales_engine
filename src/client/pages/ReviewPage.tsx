import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useSession, discardProposal, retryProposalProcessing } from "../state/session";
import { approveProposal, fetchProposalBySession, skipProposal, retryProposalWrite } from "../state/api";
import { ReviewPanel } from "../components/ReviewPanel";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { EmptyState } from "../components/EmptyState";
import { ContactCardSkeleton } from "../components/LoadingSkeleton";
import { EMPTY_COPY, nextLeadPath } from "../copy";
import type { PublicProposal, PublicWriteFields } from "../../shared/contracts";

export function ReviewPage() {
  const { sessionId } = useParams();
  const { setReview, afterWrite, pending, setError, error, refresh, data } = useSession();
  const [proposal, setProposal] = useState<PublicProposal | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [localPending, setLocalPending] = useState(false);
  const navigate = useNavigate();
  const busy = pending || localPending;

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
    if (!proposal) return;
    const proposalId = proposal.id;
    await withLocal(async () => {
      const bootstrap = await afterWrite(await approveProposal(proposalId, fields));
      const next = bootstrap?.leads.find((item) => item.dialable) ?? bootstrap?.lead ?? null;
      navigate(nextLeadPath(next));
    });
  }

  if (!sessionId) {
    return (
      <div>
        <Breadcrumbs items={[{ label: "Ready", to: "/leads" }, { label: "Review" }]} />
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

  const leadName = proposal?.contactName ?? data.leads.find((item) => item.leadId === proposal?.leadId)?.fullName;
  const crumbs = [
    { label: "Ready", to: "/leads" },
    ...(proposal ? [{ label: leadName || proposal.leadId, to: `/leads/${encodeURIComponent(proposal.leadId)}` }] : []),
    { label: "Review" },
  ];

  if (loading) {
    return (
      <div>
        <Breadcrumbs items={crumbs} />
        <div className="mt-10">
          <ContactCardSkeleton />
        </div>
      </div>
    );
  }

  if (fetchError || !proposal) {
    return (
      <div>
        <Breadcrumbs items={crumbs} />
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

  const proposalValue = proposal;

  return (
    <div>
      <Breadcrumbs items={crumbs} />
      <ReviewPanel
        proposal={proposalValue}
        pending={busy}
        error={error}
        onApprove={(fields) => void onApprove(fields)}
        onRetryWrite={() => void withLocal(async () => {
          const bootstrap = await afterWrite(await retryProposalWrite(proposalValue.id));
          if (bootstrap) {
            const next = bootstrap.leads.find((item) => item.dialable) ?? bootstrap.lead;
            navigate(nextLeadPath(next));
          }
        })}
        onRetryProcessing={() => void withLocal(async () => {
          setProposal(await retryProposalProcessing(proposalValue.id));
        })}
        onSkip={() => void withLocal(async () => {
          const bootstrap = await afterWrite(await skipProposal(proposalValue.id));
          const next = bootstrap?.leads.find((item) => item.dialable) ?? bootstrap?.lead ?? null;
          navigate(nextLeadPath(next));
        })}
        onDiscard={() => void withLocal(async () => {
          await discardProposal(proposalValue.id);
          setProposal(null);
          setReview(null);
          await refresh();
          navigate("/leads");
        })}
      />
    </div>
  );
}
