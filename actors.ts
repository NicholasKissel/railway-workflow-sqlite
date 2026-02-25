import { actor, queue, setup } from "rivetkit";
import { db } from "rivetkit/db";

// Task message type
type TaskMessage = {
  action: "create" | "complete";
  title?: string;
  priority?: "low" | "medium" | "high";
  taskId?: number;
};

/**
 * Task Manager Actor
 *
 * Demonstrates:
 * - SQLite for persistent task storage
 * - Queue-driven mutations with run loop
 * - State persistence across restarts
 */
export const taskManager = actor({
  options: {
    name: "Task Manager",
    icon: "tasks",
  },

  // SQLite database with task table
  db: db({
    onMigrate: async (database) => {
      await database.execute(`
        CREATE TABLE IF NOT EXISTS tasks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          priority TEXT NOT NULL DEFAULT 'medium',
          status TEXT NOT NULL DEFAULT 'pending',
          created_at INTEGER NOT NULL,
          completed_at INTEGER
        );
      `);

      await database.execute(`
        CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
      `);
    },
  }),

  // Track stats in state (persisted across restarts)
  state: {
    tasksCreated: 0,
    tasksCompleted: 0,
  },

  // Queue for task operations (durable)
  queues: {
    tasks: queue<TaskMessage>(),
  },

  // Run loop that processes queue messages
  run: async (c) => {
    for await (const message of c.queue.iter()) {
      if (message.body.action === "create" && message.body.title) {
        await c.db.execute(
          "INSERT INTO tasks (title, priority, status, created_at) VALUES (?, ?, 'pending', ?)",
          message.body.title,
          message.body.priority || "medium",
          Date.now()
        );
        c.state.tasksCreated += 1;
      }

      if (message.body.action === "complete" && message.body.taskId) {
        await c.db.execute(
          "UPDATE tasks SET status = 'completed', completed_at = ? WHERE id = ?",
          Date.now(),
          message.body.taskId
        );
        c.state.tasksCompleted += 1;
      }
    }
  },

  // Read-only actions for querying tasks
  actions: {
    // Get all tasks
    getTasks: async (c) => {
      return (await c.db.execute(
        "SELECT id, title, priority, status, created_at, completed_at FROM tasks ORDER BY created_at DESC"
      )) as Array<{
        id: number;
        title: string;
        priority: string;
        status: string;
        created_at: number;
        completed_at: number | null;
      }>;
    },

    // Get pending tasks only
    getPendingTasks: async (c) => {
      return (await c.db.execute(
        "SELECT id, title, priority FROM tasks WHERE status = 'pending' ORDER BY CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END"
      )) as Array<{
        id: number;
        title: string;
        priority: string;
      }>;
    },

    // Get stats
    getStats: (c) => ({
      tasksCreated: c.state.tasksCreated,
      tasksCompleted: c.state.tasksCompleted,
    }),
  },
});

export const registry = setup({
  use: { taskManager },
});
