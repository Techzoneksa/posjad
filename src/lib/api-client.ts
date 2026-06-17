"use client";

import { useCallback } from "react";
import { useMutation } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type ApiMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type ApiAction<Input = any, Output = any> = {
  action: string;
  endpoint: string;
  method: ApiMethod;
  __input?: Input;
  __output?: Output;
};

export type ServerFnInput<T = any> = T extends undefined ? void | { data?: undefined } : { data: T } | T;

export async function getAccessToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export function createApiAction<Input = any, Output = any>(
  action: string,
  method: ApiMethod = "POST",
): ApiAction<Input, Output> {
  return {
    action,
    endpoint: `/api/rpc/${action}`,
    method,
  };
}

function unwrapServerFnInput<Input>(input?: ServerFnInput<Input>): Input | undefined {
  if (
    input &&
    typeof input === "object" &&
    "data" in input &&
    Object.keys(input as Record<string, unknown>).length === 1
  ) {
    return (input as { data?: Input }).data;
  }
  return input as Input | undefined;
}

export async function apiFetch<Output = any, Input = any>(
  action: ApiAction<Input, Output> | string,
  input?: ServerFnInput<Input>,
  options?: { accessToken?: string | null },
): Promise<Output> {
  const descriptor =
    typeof action === "string" ? createApiAction<Input, Output>(action) : action;
  const data = unwrapServerFnInput(input);
  const token = options?.accessToken ?? await getAccessToken();
  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (token) headers.Authorization = `Bearer ${token}`;

  let url = descriptor.endpoint;
  const init: RequestInit = {
    method: descriptor.method,
    headers,
    credentials: "include",
  };

  if (descriptor.method === "GET") {
    if (data && typeof data === "object") {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
        if (value != null) params.set(key, String(value));
      }
      const qs = params.toString();
      if (qs) url += `?${qs}`;
    }
  } else {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(data ?? {});
  }

  const response = await fetch(url, init);
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message =
      body?.message ?? body?.error ?? `Request failed with HTTP ${response.status}`;
    throw new Error(message);
  }

  return body as Output;
}

export function useApiAction<Input = any, Output = any>(
  action: ApiAction<Input, Output>,
) {
  const { mutateAsync } = useMutation({
    mutationKey: ["api-action", action.action],
    mutationFn: (input?: ServerFnInput<Input>) => apiFetch<Output, Input>(action, input),
  });

  return useCallback(
    (input?: ServerFnInput<Input>) => mutateAsync(input),
    [mutateAsync],
  );
}
