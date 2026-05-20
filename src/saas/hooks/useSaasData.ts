import { useCallback, useEffect, useState } from 'react';
import { getBilling, getMyOrganization, listIssues, listProducts, listTours, listUsers } from '../services/tenantApi';
import type { Billing, Issue, Organization, Product, SaaSUser, Tour } from '../types';

export function useOrganization() {
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setOrganization(await getMyOrganization());
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  return { organization, loading, refresh };
}

export function useUsers() {
  const [items, setItems] = useState<SaaSUser[]>([]);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await listUsers());
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  return { items, loading, refresh };
}

export function useProducts(limit = 100, offset = 0) {
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await listProducts(limit, offset));
    } finally {
      setLoading(false);
    }
  }, [limit, offset]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  return { items, loading, refresh };
}

export function useTours(limit = 50) {
  const [items, setItems] = useState<Tour[]>([]);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await listTours(limit));
    } finally {
      setLoading(false);
    }
  }, [limit]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  return { items, loading, refresh };
}

export function useIssues(limit = 50) {
  const [items, setItems] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await listIssues(limit));
    } finally {
      setLoading(false);
    }
  }, [limit]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  return { items, loading, refresh };
}

export function useBilling() {
  const [billing, setBilling] = useState<Billing | null>(null);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setBilling(await getBilling());
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  return { billing, loading, refresh };
}
