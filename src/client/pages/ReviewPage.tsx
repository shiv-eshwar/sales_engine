import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useSession, discardProposal, retryProposalProcessing } from "../state/session";
import { approveProposal, fetchProposalBySession, skipProposal, retryProposalWrite } from "../state/api";
import { ReviewPanel } from "../components/ReviewPanel";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { LoadingSkeleton } from "../components/LoadingSkeleton";
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
      await afterWrite(await approveProposal(proposalId, fields));
      navigate("/leads");
    });
  }

  if (!sessionId) {
    return (
      <div>
        <Breadcrumbs items={[{ label: "Leads", to: "/leads" }, { label: "Review" }]} />
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">Review</h1>
        <p className="mt-2 text-sm text-slate-600">
          Missing call session. Open a lead, finish a call, then review its CRM update here.
        </p>
        <Link to="/leads" className="mt-4 inline-block rounded-md border border-slate-300 px-4 py-2 text-sm font-medium">
          Back to leads
        </Link>
      </div>
    );
  }

  const leadName = proposal?.contactName ?? data.leads.find((item) => item.leadId === proposal?.leadId)?.fullName;
  const crumbs = [
    { label: "Leads", to: "/leads" },
    ...(proposal ? [{ label: leadName || proposal.leadId, to: `/leads/${encodeURIComponent(proposal.leadId)}` }] : []),
    { label: `Review ${sessionId.slice(0, 8)}` },
  ];

  if (loading) {
    return (
      <div>
        <Breadcrumbs items={crumbs} />
        <div className="mt-4">
          <LoadingSkeleton title="Loading review…" detail="Fetching the proposed CRM update for this call." lines={4} />
        </div>
      </div>
    );
  }

  if (fetchError || !proposal) {
    return (
      <div>
        <Breadcrumbs items={crumbs} />
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">Review not ready</h1>
        <p className="mt-2 text-sm text-slate-600">
          {fetchError ?? "Nothing waiting for review for this call yet."}
        </p>
        <Link to="/leads" className="mt-4 inline-block rounded-md border border-slate-300 px-4 py-2 text-sm font-medium">
          Back to leads
        </Link>
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
          await afterWrite(await retryProposalWrite(proposalValue.id));
          navigate("/leads");
        })}
        onRetryProcessing={() => void withLocal(async () => {
          setProposal(await retryProposalProcessing(proposalValue.id));
        })}
        onSkip={() => void withLocal(async () => {
          await afterWrite(await skipProposal(proposalValue.id));
          navigate("/leads");
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
