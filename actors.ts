import { actor, queue, setup } from "rivetkit";

// Task types
interface Task {
  id: number;
  title: string;
  priority: "low" | "medium" | "high";
  status: "pending" | "completed";
  createdAt: number;
  completedAt?: number;
}

type TaskMessage = {
  action: "create" | "complete";
  title?: string;
  priority?: "low" | "medium" | "high";
  taskId?: number;
};

/**
 * Task Manager Actor
 *
 * Uses c.state for persistence (works with Rivet Cloud)
 * For SQLite, deploy directly on Rivet infrastructure
 */
export const taskManager = actor({
  options: {
    name: "Task Manager",
    icon: "tasks",
  },

  state: {
    tasks: [] as Task[],
    nextId: 1,
    tasksCreated: 0,
    tasksCompleted: 0,
  },

  queues: {
    tasks: queue<TaskMessage>(),
  },

  run: async (c) => {
    for await (const message of c.queue.iter()) {
      if (message.body.action === "create" && message.body.title) {
        const task: Task = {
          id: c.state.nextId++,
          title: message.body.title,
          priority: message.body.priority || "medium",
          status: "pending",
          createdAt: Date.now(),
        };
        c.state.tasks.push(task);
        c.state.tasksCreated += 1;
      }

      if (message.body.action === "complete" && message.body.taskId) {
        const task = c.state.tasks.find(t => t.id === message.body.taskId);
        if (task) {
          task.status = "completed";
          task.completedAt = Date.now();
          c.state.tasksCompleted += 1;
        }
      }
    }
  },

  actions: {
    getTasks: (c) => {
      return [...c.state.tasks].sort((a, b) => b.createdAt - a.createdAt);
    },

    getPendingTasks: (c) => {
      const priorityOrder = { high: 1, medium: 2, low: 3 };
      return c.state.tasks
        .filter(t => t.status === "pending")
        .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])
        .map(t => ({ id: t.id, title: t.title, priority: t.priority }));
    },

    getStats: (c) => ({
      tasksCreated: c.state.tasksCreated,
      tasksCompleted: c.state.tasksCompleted,
    }),
  },
});

export const registry = setup({
  use: { taskManager },
});
