import type {
  Project,
  File as LatexFile,
  FileWithContent,
  CreateProjectInputType,
  CreateFileInputType,
  CompileResult,
  AgentSession,
  AgentSessionPutBody,
  Snapshot,
  CreateSnapshotInputType,
  Comment,
  CreateCommentInputType,
  UpdateCommentInputType,
  Invite,
  CreateInviteInputType,
  ProjectMemberWithUser,
  Template,
  CreateProjectFromTemplateInputType,
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
        request<LatexFile[]>(`/projects/${projectId}/files`, getToken),

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

    snapshots: {
      list: (projectId: string, fileId?: string) =>
        request<Snapshot[]>(
          `/projects/${projectId}/snapshots${fileId ? `?fileId=${fileId}` : ''}`,
          getToken,
        ),

      create: (projectId: string, input: CreateSnapshotInputType) =>
        request<Snapshot>(`/projects/${projectId}/snapshots`, getToken, {
          method: 'POST',
          body: JSON.stringify(input),
        }),

      getContent: (projectId: string, snapshotId: string) =>
        request<{ content: string }>(`/projects/${projectId}/snapshots/${snapshotId}/content`, getToken),

      remove: (projectId: string, snapshotId: string) =>
        request<void>(`/projects/${projectId}/snapshots/${snapshotId}`, getToken, { method: 'DELETE' }),
    },

    comments: {
      list: (projectId: string, fileId: string, resolved = false) =>
        request<Comment[]>(
          `/projects/${projectId}/comments?fileId=${fileId}${resolved ? '&resolved=true' : ''}`,
          getToken,
        ),

      create: (projectId: string, input: CreateCommentInputType) =>
        request<Comment>(`/projects/${projectId}/comments`, getToken, {
          method: 'POST',
          body: JSON.stringify(input),
        }),

      update: (projectId: string, commentId: string, input: UpdateCommentInputType) =>
        request<Comment>(`/projects/${projectId}/comments/${commentId}`, getToken, {
          method: 'PATCH',
          body: JSON.stringify(input),
        }),

      remove: (projectId: string, commentId: string) =>
        request<void>(`/projects/${projectId}/comments/${commentId}`, getToken, { method: 'DELETE' }),
    },

    members: {
      list: (projectId: string) =>
        request<ProjectMemberWithUser[]>(`/projects/${projectId}/members`, getToken),

      updateRole: (projectId: string, userId: string, role: 'editor' | 'viewer') =>
        request<ProjectMemberWithUser>(`/projects/${projectId}/members/${userId}`, getToken, {
          method: 'PATCH',
          body: JSON.stringify({ role }),
        }),

      remove: (projectId: string, userId: string) =>
        request<void>(`/projects/${projectId}/members/${userId}`, getToken, { method: 'DELETE' }),
    },

    invites: {
      list: (projectId: string) =>
        request<Invite[]>(`/projects/${projectId}/invites`, getToken),

      create: (projectId: string, input: CreateInviteInputType) =>
        request<Invite>(`/projects/${projectId}/invites`, getToken, {
          method: 'POST',
          body: JSON.stringify(input),
        }),

      cancel: (projectId: string, inviteId: string) =>
        request<void>(`/projects/${projectId}/invites/${inviteId}`, getToken, { method: 'DELETE' }),

      accept: (token: string) =>
        request<{ projectId: string }>(`/invites/${token}/accept`, getToken, { method: 'POST' }),
    },

    export: {
      downloadZip: async (projectId: string): Promise<Blob> => {
        const token = await getToken();
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const res = await fetch(`${BASE_URL}/projects/${projectId}/export`, { headers });
        if (!res.ok) throw new ApiError(res.status, null);
        return res.blob();
      },

      importZip: async (name: string, file: globalThis.File): Promise<{ projectId: string; skipped: string[] }> => {
        const token = await getToken();
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const form = new FormData();
        form.append('name', name);
        form.append('file', file);
        const res = await fetch(`${BASE_URL}/projects/import`, {
          method: 'POST',
          headers,
          body: form,
        });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new ApiError(res.status, body);
        }
        return res.json();
      },
    },

    templates: {
      list: () => request<Template[]>('/templates', getToken),

      clone: (templateId: string, input: CreateProjectFromTemplateInputType) =>
        request<{ projectId: string }>(`/templates/${templateId}/clone`, getToken, {
          method: 'POST',
          body: JSON.stringify(input),
        }),
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
