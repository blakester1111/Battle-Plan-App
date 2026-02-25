// API client for database operations

const API_BASE = "/api";

// Auth API
export const authApi = {
  async login(username: string, password: string) {
    const res = await fetch(`${API_BASE}/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Login failed");
    }
    return res.json();
  },

  async register(username: string, password: string) {
    const res = await fetch(`${API_BASE}/auth?action=register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Registration failed");
    }
    return res.json();
  },

  async logout() {
    const res = await fetch(`${API_BASE}/auth`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error("Logout failed");
    return res.json();
  },

  async getCurrentUser() {
    const res = await fetch(`${API_BASE}/auth`);
    if (!res.ok) throw new Error("Failed to get current user");
    return res.json();
  },
};

// Tasks API
export const tasksApi = {
  async getAll() {
    const res = await fetch(`${API_BASE}/tasks`);
    if (!res.ok) throw new Error("Failed to fetch tasks");
    return res.json();
  },

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async create(task: any) {
    const res = await fetch(`${API_BASE}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(task),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: "Failed to create task" }));
      throw new Error(data.error || "Failed to create task");
    }
    return res.json();
  },

  async update(
    id: string,
    updates: Record<string, unknown>
  ) {
    const res = await fetch(`${API_BASE}/tasks`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...updates }),
    });
    if (!res.ok) throw new Error("Failed to update task");
    return res.json();
  },

  async delete(id: string) {
    const res = await fetch(`${API_BASE}/tasks?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error("Failed to delete task");
    return res.json();
  },

  async reorder(tasks: { id: string; order: number; status: string }[]) {
    const res = await fetch(`${API_BASE}/tasks`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reorder", tasks }),
    });
    if (!res.ok) throw new Error("Failed to reorder tasks");
    return res.json();
  },

  async forward(data: {
    sourceTaskIds: string[];
    targetBpId?: string;
    createBp?: {
      id: string;
      title: string;
      weekStart: string;
      formulaId: string;
      formulaName: string;
      formulaCode: string;
      notes?: string;
    };
  }) {
    const res = await fetch(`${API_BASE}/tasks/forward`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({ error: "Failed to forward tasks" }));
      throw new Error(errData.error || "Failed to forward tasks");
    }
    return res.json();
  },
};

// Notes API
export const notesApi = {
  async getAll() {
    const res = await fetch(`${API_BASE}/notes`);
    if (!res.ok) throw new Error("Failed to fetch notes");
    return res.json();
  },

  async create(note: { id: string; title: string; content: string; updatedAt: string }) {
    const res = await fetch(`${API_BASE}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(note),
    });
    if (!res.ok) throw new Error("Failed to create note");
    return res.json();
  },

  async update(id: string, updates: { title?: string; content?: string; updatedAt?: string }) {
    const res = await fetch(`${API_BASE}/notes`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...updates }),
    });
    if (!res.ok) throw new Error("Failed to update note");
    return res.json();
  },

  async delete(id: string) {
    const res = await fetch(`${API_BASE}/notes?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error("Failed to delete note");
    return res.json();
  },
};

// Settings API
export const settingsApi = {
  async getAll() {
    const res = await fetch(`${API_BASE}/settings`);
    if (!res.ok) throw new Error("Failed to fetch settings");
    return res.json();
  },

  async set(key: string, value: unknown) {
    const res = await fetch(`${API_BASE}/settings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value }),
    });
    if (!res.ok) throw new Error("Failed to update setting");
    return res.json();
  },
};

// Categories API
export const categoriesApi = {
  async getAll() {
    const res = await fetch(`${API_BASE}/categories`);
    if (!res.ok) throw new Error("Failed to fetch categories");
    return res.json();
  },

  async add(name: string) {
    const res = await fetch(`${API_BASE}/categories`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) throw new Error("Failed to add category");
    return res.json();
  },

  async delete(name: string) {
    const res = await fetch(`${API_BASE}/categories?name=${encodeURIComponent(name)}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error("Failed to delete category");
    return res.json();
  },
};

// Users API
export const usersApi = {
  async getProfile() {
    const res = await fetch(`${API_BASE}/users?action=profile`);
    if (!res.ok) throw new Error("Failed to fetch profile");
    return res.json();
  },

  async updateProfile(profile: {
    firstName?: string;
    lastName?: string;
    org?: string;
    division?: number;
    department?: number;
    postTitle?: string;
  }) {
    const res = await fetch(`${API_BASE}/users`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
    });
    if (!res.ok) throw new Error("Failed to update profile");
    return res.json();
  },

  async getAll() {
    const res = await fetch(`${API_BASE}/users`);
    if (!res.ok) throw new Error("Failed to fetch users");
    return res.json();
  },

  async create(user: {
    username: string;
    password: string;
    firstName?: string;
    lastName?: string;
    org?: string;
    division?: number;
    department?: number;
    postTitle?: string;
    role?: string;
  }) {
    const res = await fetch(`${API_BASE}/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(user),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed to create user");
    }
    return res.json();
  },

  async resetPassword(targetUserId: string, newPassword: string) {
    const res = await fetch(`${API_BASE}/users`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetUserId, newPassword }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed to reset password");
    }
    return res.json();
  },

  async changeUsername(targetUserId: string, newUsername: string) {
    const res = await fetch(`${API_BASE}/users`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetUserId, newUsername }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed to change username");
    }
    return res.json();
  },

  async delete(id: string) {
    const res = await fetch(`${API_BASE}/users?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error("Failed to delete user");
    return res.json();
  },
};

// Relationships API
export const relationshipsApi = {
  async getMyJuniors() {
    const res = await fetch(`${API_BASE}/relationships?action=my-juniors`);
    if (!res.ok) throw new Error("Failed to fetch juniors");
    return res.json();
  },

  async getAll() {
    const res = await fetch(`${API_BASE}/relationships`);
    if (!res.ok) throw new Error("Failed to fetch relationships");
    return res.json();
  },

  async create(seniorId: string, juniorId: string) {
    const res = await fetch(`${API_BASE}/relationships`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seniorId, juniorId }),
    });
    if (!res.ok) throw new Error("Failed to create relationship");
    return res.json();
  },

  async delete(id: number) {
    const res = await fetch(`${API_BASE}/relationships?id=${id}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error("Failed to delete relationship");
    return res.json();
  },
};

// Task Notes API
export const taskNotesApi = {
  async getByTaskId(taskId: string) {
    const res = await fetch(`${API_BASE}/task-notes?taskId=${encodeURIComponent(taskId)}`);
    if (!res.ok) throw new Error("Failed to fetch notes");
    return res.json();
  },

  async getMyNotes() {
    const res = await fetch(`${API_BASE}/task-notes?action=my-notes`);
    if (!res.ok) throw new Error("Failed to fetch my notes");
    return res.json();
  },

  async create(taskId: string, content: string) {
    const res = await fetch(`${API_BASE}/task-notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId, content }),
    });
    if (!res.ok) throw new Error("Failed to create note");
    return res.json();
  },

  async markAsRead(taskId: string) {
    const res = await fetch(`${API_BASE}/task-notes`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId }),
    });
    if (!res.ok) throw new Error("Failed to mark notes as read");
    return res.json();
  },

  async delete(id: string) {
    const res = await fetch(`${API_BASE}/task-notes?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed to delete note");
    }
    return res.json();
  },
};

// BP Notes API
export const bpNotesApi = {
  async getByBpId(bpId: string) {
    const res = await fetch(`${API_BASE}/bp-notes?bpId=${encodeURIComponent(bpId)}`);
    if (!res.ok) throw new Error("Failed to fetch notes");
    return res.json();
  },

  async getMyNotes() {
    const res = await fetch(`${API_BASE}/bp-notes?action=my-notes`);
    if (!res.ok) throw new Error("Failed to fetch my BP notes");
    return res.json();
  },

  async getJuniorNotes(juniorId: string) {
    const res = await fetch(`${API_BASE}/bp-notes?juniorId=${encodeURIComponent(juniorId)}`);
    if (!res.ok) throw new Error("Failed to fetch junior BP notes");
    return res.json();
  },

  async create(bpId: string, content: string) {
    const res = await fetch(`${API_BASE}/bp-notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bpId, content }),
    });
    if (!res.ok) throw new Error("Failed to create note");
    return res.json();
  },

  async markAsRead(bpId: string) {
    const res = await fetch(`${API_BASE}/bp-notes`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bpId }),
    });
    if (!res.ok) throw new Error("Failed to mark notes as read");
    return res.json();
  },

  async delete(id: string) {
    const res = await fetch(`${API_BASE}/bp-notes?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed to delete note");
    }
    return res.json();
  },
};

// Junior Tasks API
export const juniorTasksApi = {
  async get(juniorId: string) {
    const res = await fetch(`${API_BASE}/junior-tasks?juniorId=${encodeURIComponent(juniorId)}`);
    if (!res.ok) throw new Error("Failed to fetch junior tasks");
    return res.json();
  },
};

// Weekly Battle Plans API
export const weeklyBPApi = {
  async getAll(juniorId?: string) {
    const url = juniorId
      ? `${API_BASE}/weekly-battle-plans?juniorId=${encodeURIComponent(juniorId)}`
      : `${API_BASE}/weekly-battle-plans`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to fetch weekly battle plans");
    return res.json();
  },

  async create(bp: {
    id: string;
    title: string;
    weekStart: string;
    formulaId: string;
    formulaName: string;
    formulaCode: string;
    notes?: string;
    stepWriteups?: Record<string, string>;
    tasks?: Array<{
      id: string;
      title: string;
      description?: string;
      order: number;
      formulaStepId?: string;
      label?: string;
      priority?: string;
      category?: string;
    }>;
  }) {
    const res = await fetch(`${API_BASE}/weekly-battle-plans`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bp),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: "Failed to create weekly battle plan" }));
      throw new Error(data.error || "Failed to create weekly battle plan");
    }
    return res.json();
  },

  async update(id: string, updates: { title?: string; weekStart?: string; notes?: string; stepWriteups?: Record<string, string> }) {
    const res = await fetch(`${API_BASE}/weekly-battle-plans`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...updates }),
    });
    if (!res.ok) throw new Error("Failed to update weekly battle plan");
    return res.json();
  },

  async delete(id: string) {
    const res = await fetch(`${API_BASE}/weekly-battle-plans?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error("Failed to delete weekly battle plan");
    return res.json();
  },
};

// Trash API
export const trashApi = {
  async getAll() {
    const res = await fetch(`${API_BASE}/trash`);
    if (!res.ok) throw new Error("Failed to fetch trash");
    return res.json();
  },

  async restore(id: string, type: "task" | "bp") {
    const res = await fetch(`${API_BASE}/trash`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, type }),
    });
    if (!res.ok) throw new Error("Failed to restore item");
    return res.json();
  },

  async permanentDelete(id: string, type: "task" | "bp") {
    const res = await fetch(`${API_BASE}/trash?id=${encodeURIComponent(id)}&type=${type}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error("Failed to permanently delete item");
    return res.json();
  },
};

// Stats API
export const statsApi = {
  async getAll(periodType?: string) {
    const url = periodType
      ? `${API_BASE}/stats?periodType=${encodeURIComponent(periodType)}`
      : `${API_BASE}/stats`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to fetch stats");
    return res.json();
  },

  async create(stat: {
    id: string;
    name: string;
    abbreviation?: string;
    assignedUserId?: string;
    division?: number;
    department?: number;
    gds?: boolean;
    isMoney?: boolean;
    isPercentage?: boolean;
    isInverted?: boolean;
    linkedStatIds?: string[];
  }) {
    const res = await fetch(`${API_BASE}/stats`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(stat),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: "Failed to create stat" }));
      throw new Error(data.error || "Failed to create stat");
    }
    return res.json();
  },

  async update(id: string, updates: { name?: string; abbreviation?: string; division?: number; department?: number; assignedUserId?: string; gds?: boolean; isMoney?: boolean; isPercentage?: boolean; isInverted?: boolean; linkedStatIds?: string[] | null }) {
    const res = await fetch(`${API_BASE}/stats`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...updates }),
    });
    if (!res.ok) throw new Error("Failed to update stat");
    return res.json();
  },

  async delete(id: string) {
    const res = await fetch(`${API_BASE}/stats?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error("Failed to delete stat");
    return res.json();
  },
};

// Stat Entries API
export const statEntriesApi = {
  async getByStatId(statId: string, startDate?: string, endDate?: string) {
    let url = `${API_BASE}/stat-entries?statId=${encodeURIComponent(statId)}`;
    if (startDate) url += `&startDate=${encodeURIComponent(startDate)}`;
    if (endDate) url += `&endDate=${encodeURIComponent(endDate)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to fetch stat entries");
    return res.json();
  },

  async upsert(entry: {
    id: string;
    statId: string;
    value: number;
    date: string;
    periodType: string;
  }) {
    const res = await fetch(`${API_BASE}/stat-entries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: "Failed to save entry" }));
      throw new Error(data.error || "Failed to save entry");
    }
    return res.json();
  },

  async bulkImport(statId: string, entries: { date: string; value: number; periodType: string }[]) {
    const res = await fetch(`${API_BASE}/stat-entries`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statId, entries }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: "Failed to import entries" }));
      throw new Error(data.error || "Failed to import entries");
    }
    return res.json();
  },

  async update(id: string, value: number) {
    const res = await fetch(`${API_BASE}/stat-entries`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, value }),
    });
    if (!res.ok) throw new Error("Failed to update entry");
    return res.json();
  },

  async delete(id: string) {
    const res = await fetch(`${API_BASE}/stat-entries?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error("Failed to delete entry");
    return res.json();
  },
};

// Stat Quotas API (Exec Series 7)
export const statQuotasApi = {
  async getForWeek(statId: string, weekEndingDate: string) {
    const res = await fetch(
      `${API_BASE}/stat-quotas?statId=${encodeURIComponent(statId)}&weekEndingDate=${encodeURIComponent(weekEndingDate)}`
    );
    if (!res.ok) throw new Error("Failed to fetch quota");
    return res.json();
  },

  async upsert(quota: {
    id: string;
    statId: string;
    weekEndingDate: string;
    quotas: number[];
  }) {
    const res = await fetch(`${API_BASE}/stat-quotas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(quota),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      let errorMsg = `Failed to save quota (HTTP ${res.status})`;
      try {
        const data = JSON.parse(text);
        if (data.error) errorMsg = data.error;
      } catch {
        if (text) errorMsg += `: ${text.slice(0, 200)}`;
      }
      throw new Error(errorMsg);
    }
    return res.json();
  },

  async delete(id: string) {
    const res = await fetch(`${API_BASE}/stat-quotas?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error("Failed to delete quota");
    return res.json();
  },
};

// Archive API
export const archiveApi = {
  async getAll() {
    const res = await fetch(`${API_BASE}/archive`);
    if (!res.ok) throw new Error("Failed to fetch archived tasks");
    return res.json();
  },

  async restore(id: string) {
    const res = await fetch(`${API_BASE}/archive`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) throw new Error("Failed to restore archived task");
    return res.json();
  },
};
