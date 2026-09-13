import { useCallback, useEffect, useRef, useState } from "react";
import type { PublicLead } from "../../shared/contracts";
import {
  LEADS_PAGE_SIZE,
  cursorForLeadsQuery,
  leadsListQueryKey,
  type LeadSortKey
} from "../../shared/leadsQueue";
import { fetchLeads } from "./api";

export function usePaginatedLeads(input: {
  campaignId: string | null;
  query: string;
  dialableOnly: boolean;
  sortKey: LeadSortKey;
  sortDir: 1 | -1;
  enabled: boolean;
  queueStamp: string;
  limit?: number;
}) {
  const limit = input.limit ?? LEADS_PAGE_SIZE;
  const [debouncedQuery, setDebouncedQuery] = useState(input.query);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(input.query), 150);
    return () => window.clearTimeout(timer);
  }, [input.query]);

  const queryKey = leadsListQueryKey({
    campaignId: input.campaignId,
    q: debouncedQuery,
    dialableOnly: input.dialableOnly,
    sort: input.sortKey,
    dir: input.sortDir
  });

  const [rows, setRows] = useState<PublicLead[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [queueSize, setQueueSize] = useState(0);
  const [undialableCount, setUndialableCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const queryKeyRef = useRef(queryKey);
  const cursorRef = useRef<string | null>(null);
  const loadingMoreRef = useRef(false);

  useEffect(() => {
    const nextCursorForKey = cursorForLeadsQuery(queryKeyRef.current, queryKey, cursorRef.current);
    queryKeyRef.current = queryKey;
    if (nextCursorForKey === null) {
      cursorRef.current = null;
      setNextCursor(null);
    }
  }, [queryKey]);

  useEffect(() => {
    if (!input.enabled) {
      setRows([]);
      setNextCursor(null);
      cursorRef.current = null;
      setTotal(0);
      setQueueSize(0);
      setUndialableCount(0);
      return;
    }
    const ac = new AbortController();
    setLoading(true);
    void fetchLeads({
      campaignId: input.campaignId,
      q: debouncedQuery,
      dialableOnly: input.dialableOnly,
      sort: input.sortKey,
      dir: input.sortDir,
      cursor: null,
      limit,
      signal: ac.signal
    })
      .then((result) => {
        setRows(result.leads);
        setNextCursor(result.nextCursor);
        cursorRef.current = result.nextCursor;
        setTotal(result.total);
        setQueueSize(result.queueSize);
        setUndialableCount(result.undialableCount);
      })
      .catch(() => {
        /* Abort or a failed page leaves current rows; avoid a stuck spinner. */
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false);
      });
    return () => ac.abort();
  }, [
    input.enabled,
    input.campaignId,
    input.dialableOnly,
    input.sortKey,
    input.sortDir,
    input.queueStamp,
    debouncedQuery,
    limit
  ]);

  const loadMore = useCallback(() => {
    if (!input.enabled || !cursorRef.current || loadingMoreRef.current) return;
    const cursor = cursorRef.current;
    const keyAtStart = queryKeyRef.current;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    void fetchLeads({
      campaignId: input.campaignId,
      q: debouncedQuery,
      dialableOnly: input.dialableOnly,
      sort: input.sortKey,
      dir: input.sortDir,
      cursor,
      limit
    })
      .then((result) => {
        if (queryKeyRef.current !== keyAtStart) return;
        setRows((current) => {
          const seen = new Set(current.map((lead) => lead.leadId));
          return [...current, ...result.leads.filter((lead) => !seen.has(lead.leadId))];
        });
        setNextCursor(result.nextCursor);
        cursorRef.current = result.nextCursor;
        setTotal(result.total);
        setQueueSize(result.queueSize);
        setUndialableCount(result.undialableCount);
      })
      .catch(() => {
        /* Keep existing rows; sentinel can retry after loadingMore clears. */
      })
      .finally(() => {
        loadingMoreRef.current = false;
        setLoadingMore(false);
      });
  }, [
    input.enabled,
    input.campaignId,
    input.dialableOnly,
    input.sortKey,
    input.sortDir,
    debouncedQuery,
    limit
  ]);

  return {
    rows,
    nextCursor,
    hasMore: Boolean(nextCursor),
    total,
    queueSize,
    undialableCount,
    loading,
    loadingMore,
    loadMore
  };
}
