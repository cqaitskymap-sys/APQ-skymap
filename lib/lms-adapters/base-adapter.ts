import type { LmsConnection } from '../lms-types';

export interface LmsFetchResult<T> {
  success: boolean;
  data: T[];
  error?: string;
}

export interface LmsRemoteUser {
  external_id: string;
  employee_id: string;
  email: string;
  full_name: string;
  department: string;
  status: string;
}

export interface LmsRemoteCourse {
  external_id: string;
  course_code: string;
  course_title: string;
  course_type: string;
  duration_hours: number;
  status: string;
}

export interface LmsRemoteCompletion {
  external_id: string;
  employee_id: string;
  employee_email: string;
  course_id: string;
  course_title: string;
  completion_date: string;
  score: number | null;
  status: string;
}

export interface LmsRemoteCertificate {
  external_id: string;
  employee_id: string;
  employee_name: string;
  course_title: string;
  certificate_number: string;
  issued_date: string;
  expiry_date: string | null;
  file_url: string | null;
}

export interface LmsRemoteAssignment {
  external_id: string;
  employee_id: string;
  employee_email: string;
  course_id: string;
  course_title: string;
  assigned_date: string;
  due_date: string;
  status: string;
}

export abstract class BaseLmsAdapter {
  constructor(protected connection: LmsConnection) {}

  protected getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
    const auth = this.connection.authentication_type;
    if (auth === 'API Key') {
      headers['X-API-Key'] = this.connection.api_key;
    } else if (auth === 'Bearer Token' || auth === 'JWT') {
      headers.Authorization = `Bearer ${this.connection.api_key}`;
    } else if (auth === 'Basic Authentication') {
      const creds = btoa(`${this.connection.username}:${this.connection.encrypted_password}`);
      headers.Authorization = `Basic ${creds}`;
    }
    return headers;
  }

  protected async fetchJson<T>(path: string): Promise<T | null> {
    try {
      const url = `${this.connection.base_url.replace(/\/$/, '')}${path}`;
      const res = await fetch(url, { headers: this.getAuthHeaders(), signal: AbortSignal.timeout(15000) });
      if (!res.ok) return null;
      return (await res.json()) as T;
    } catch {
      return null;
    }
  }

  abstract testConnection(): Promise<{ success: boolean; message: string }>;
  abstract fetchUsers(): Promise<LmsFetchResult<LmsRemoteUser>>;
  abstract fetchCourses(): Promise<LmsFetchResult<LmsRemoteCourse>>;
  abstract fetchCompletions(): Promise<LmsFetchResult<LmsRemoteCompletion>>;
  abstract fetchCertificates(): Promise<LmsFetchResult<LmsRemoteCertificate>>;
  abstract fetchAssignments(): Promise<LmsFetchResult<LmsRemoteAssignment>>;
}

function mapPlatformEndpoints(platform: string): Record<string, string> {
  const endpoints: Record<string, Record<string, string>> = {
    Moodle: { users: '/webservice/rest/server.php?wsfunction=core_user_get_users', courses: '/webservice/rest/server.php?wsfunction=core_course_get_courses' },
    Docebo: { users: '/manage/v1/user', courses: '/learn/v1/courses' },
    'Custom REST API LMS': { users: '/api/users', courses: '/api/courses', completions: '/api/completions', certificates: '/api/certificates', assignments: '/api/assignments' },
  };
  return endpoints[platform] ?? { users: '/api/v1/users', courses: '/api/v1/courses', completions: '/api/v1/completions', certificates: '/api/v1/certificates', assignments: '/api/v1/assignments' };
}

export class RestLmsAdapter extends BaseLmsAdapter {
  private endpoints = mapPlatformEndpoints(this.connection.lms_name);

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const url = this.connection.base_url.replace(/\/$/, '');
      const res = await fetch(url, { method: 'HEAD', headers: this.getAuthHeaders(), signal: AbortSignal.timeout(10000) });
      if (res.ok || res.status === 401 || res.status === 403) {
        return { success: true, message: `Connection reachable (${res.status}). Credentials will be validated on sync.` };
      }
      return { success: false, message: `Connection failed: HTTP ${res.status}` };
    } catch (e) {
      return { success: false, message: e instanceof Error ? e.message : 'Connection unreachable' };
    }
  }

  private parseArray<T>(data: unknown, keys: string[]): T[] {
    if (Array.isArray(data)) return data as T[];
    if (data && typeof data === 'object') {
      for (const key of keys) {
        const val = (data as Record<string, unknown>)[key];
        if (Array.isArray(val)) return val as T[];
      }
    }
    return [];
  }

  async fetchUsers(): Promise<LmsFetchResult<LmsRemoteUser>> {
    const raw = await this.fetchJson<unknown>(this.endpoints.users ?? '/api/users');
    if (!raw) return { success: false, data: [], error: 'Failed to fetch users' };
    const items = this.parseArray<Record<string, unknown>>(raw, ['users', 'data', 'results']);
    return {
      success: true,
      data: items.map((u) => ({
        external_id: String(u.id ?? u.user_id ?? u.external_id ?? ''),
        employee_id: String(u.employee_id ?? u.employeeId ?? u.id ?? ''),
        email: String(u.email ?? u.mail ?? ''),
        full_name: String(u.full_name ?? u.fullName ?? u.name ?? `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim()),
        department: String(u.department ?? u.dept ?? ''),
        status: String(u.status ?? 'Active'),
      })),
    };
  }

  async fetchCourses(): Promise<LmsFetchResult<LmsRemoteCourse>> {
    const raw = await this.fetchJson<unknown>(this.endpoints.courses ?? '/api/courses');
    if (!raw) return { success: false, data: [], error: 'Failed to fetch courses' };
    const items = this.parseArray<Record<string, unknown>>(raw, ['courses', 'data', 'results']);
    return {
      success: true,
      data: items.map((c) => ({
        external_id: String(c.id ?? c.course_id ?? c.external_id ?? ''),
        course_code: String(c.code ?? c.course_code ?? c.id ?? ''),
        course_title: String(c.title ?? c.course_title ?? c.name ?? ''),
        course_type: String(c.type ?? c.course_type ?? 'Online'),
        duration_hours: Number(c.duration ?? c.duration_hours ?? 1),
        status: String(c.status ?? 'Active'),
      })),
    };
  }

  async fetchCompletions(): Promise<LmsFetchResult<LmsRemoteCompletion>> {
    const raw = await this.fetchJson<unknown>(this.endpoints.completions ?? '/api/completions');
    if (!raw) return { success: false, data: [], error: 'Failed to fetch completions' };
    const items = this.parseArray<Record<string, unknown>>(raw, ['completions', 'data', 'results']);
    return {
      success: true,
      data: items.map((c) => ({
        external_id: String(c.id ?? c.completion_id ?? `${c.user_id}-${c.course_id}`),
        employee_id: String(c.employee_id ?? c.user_id ?? ''),
        employee_email: String(c.email ?? c.employee_email ?? ''),
        course_id: String(c.course_id ?? ''),
        course_title: String(c.course_title ?? c.title ?? ''),
        completion_date: String(c.completion_date ?? c.completed_at ?? new Date().toISOString()),
        score: c.score != null ? Number(c.score) : null,
        status: String(c.status ?? 'Completed'),
      })),
    };
  }

  async fetchCertificates(): Promise<LmsFetchResult<LmsRemoteCertificate>> {
    const raw = await this.fetchJson<unknown>(this.endpoints.certificates ?? '/api/certificates');
    if (!raw) return { success: false, data: [], error: 'Failed to fetch certificates' };
    const items = this.parseArray<Record<string, unknown>>(raw, ['certificates', 'data', 'results']);
    return {
      success: true,
      data: items.map((c) => ({
        external_id: String(c.id ?? c.certificate_id ?? ''),
        employee_id: String(c.employee_id ?? c.user_id ?? ''),
        employee_name: String(c.employee_name ?? c.user_name ?? ''),
        course_title: String(c.course_title ?? c.title ?? ''),
        certificate_number: String(c.certificate_number ?? c.number ?? c.id ?? ''),
        issued_date: String(c.issued_date ?? c.issue_date ?? new Date().toISOString()),
        expiry_date: c.expiry_date ? String(c.expiry_date) : null,
        file_url: c.file_url ? String(c.file_url) : null,
      })),
    };
  }

  async fetchAssignments(): Promise<LmsFetchResult<LmsRemoteAssignment>> {
    const raw = await this.fetchJson<unknown>(this.endpoints.assignments ?? '/api/assignments');
    if (!raw) return { success: false, data: [], error: 'Failed to fetch assignments' };
    const items = this.parseArray<Record<string, unknown>>(raw, ['assignments', 'data', 'results']);
    return {
      success: true,
      data: items.map((a) => ({
        external_id: String(a.id ?? a.assignment_id ?? ''),
        employee_id: String(a.employee_id ?? a.user_id ?? ''),
        employee_email: String(a.email ?? a.employee_email ?? ''),
        course_id: String(a.course_id ?? ''),
        course_title: String(a.course_title ?? a.title ?? ''),
        assigned_date: String(a.assigned_date ?? a.created_at ?? new Date().toISOString()),
        due_date: String(a.due_date ?? a.deadline ?? new Date().toISOString()),
        status: String(a.status ?? 'Assigned'),
      })),
    };
  }
}

export function createLmsAdapter(connection: LmsConnection): BaseLmsAdapter {
  return new RestLmsAdapter(connection);
}
