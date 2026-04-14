import type {
  Project,
  File,
  FileWithContent,
  CreateProjectInputType,
  CreateFileInputType,
  CompileResult,
  AgentSession,
  AgentSessionPutBody,
} from '@latex-ide/shared-types';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

type GetToken = () => Promise<string | null>;

class ApiError extends Error {
  constructor(
    public status: number,
    public body: unknown,
  ) {
    super(`API error ${status}`);
    this.name = 'ApiError';
  }
}

async function request<T>(
  path: string,
  getToken: GetToken,
  options: RequestInit = {},
): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, body);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export function createApiClient(getToken: GetToken) {
  return {
    projects: {
      list: () => request<Project[]>('/projects', getToken),

      get: (id: string) => request<Project>(`/projects/${id}`, getToken),

      create: (input: CreateProjectInputType) =>
        request<Project>('/projects', getToken, {
          method: 'POST',
          body: JSON.stringify(input),
        }),

      remove: (id: string) =>
        request<void>(`/projects/${id}`, getToken, { method: 'DELETE' }),
    },

    files: {
      listByProject: (projectId: string) =>
        request<File[]>(`/projects/${projectId}/files`, getToken),

      get: (id: string) => request<FileWithContent>(`/files/${id}`, getToken),

      create: (projectId: string, input: CreateFileInputType) =>
        request<FileWithContent>(`/projects/${projectId}/files`, getToken, {
          method: 'POST',
          body: JSON.stringify(input),
        }),

      update: (id: string, content: string) =>
        request<FileWithContent>(`/files/${id}`, getToken, {
          method: 'PUT',
          body: JSON.stringify({ content }),
        }),

      remove: (id: string) =>
        request<void>(`/files/${id}`, getToken, { method: 'DELETE' }),
    },

    compile: {
      start: (projectId: string, rootFile?: string) =>
        request<{ jobId: string }>(`/projects/${projectId}/compile`, getToken, {
          method: 'POST',
          body: JSON.stringify({ rootFile }),
        }),

      status: (projectId: string, jobId: string) =>
        request<CompileResult>(`/projects/${projectId}/compile/${jobId}`, getToken),

      fetchPdf: async (jobId: string, projectId: string): Promise<string> => {
        const token = await getToken();
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const res = await fetch(`${BASE_URL}/compiles/${jobId}/output.pdf?projectId=${projectId}`, { headers });
        if (!res.ok) throw new ApiError(res.status, null);
        const blob = await res.blob();
        return URL.createObjectURL(blob);
      },
    },

    agentSession: {
      get: (projectId: string) =>
        request<{ session: AgentSession | null }>(`/projects/${projectId}/agent-session`, getToken),

      put: (projectId: string, body: AgentSessionPutBody) =>
        request<AgentSession>(`/projects/${projectId}/agent-session`, getToken, {
          method: 'PUT',
          body: JSON.stringify(body),
        }),
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
