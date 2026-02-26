import { actor, queue, setup } from "rivetkit";
import { db } from "rivetkit/db";
import { workflow } from "rivetkit/workflow";

// Task types
interface Task {
  id: number;
  title: string;
  priority: string;
  status: string;
  createdAt: number;
  completedAt: number | null;
}

type TaskMessage = {
  action: "create" | "complete";
  title?: string;
  priority?: "low" | "medium" | "high";
  taskId?: number;
};

/**
 * Task Manager Actor with Workflow + SQLite
 */
export const taskManager = actor({
  options: {
    name: "Task Manager",
    icon: "tasks",
  },

  state: {
    tasksCreated: 0,
    tasksCompleted: 0,
  },

  // SQLite database
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
        )
      `);
    },
  }),

  queues: {
    tasks: queue<TaskMessage>(),
  },

  // Workflow-wrapped run loop
  run: workflow(async (ctx) => {
    await ctx.loop("task-processor", async (loopCtx) => {
      const message = await loopCtx.queue.next("wait-task");

      if (message.body.action === "create" && message.body.title) {
        await loopCtx.step("create-task", async () => {
          await loopCtx.db.execute(
            `INSERT INTO tasks (title, priority, status, created_at) VALUES (?, ?, 'pending', ?)`,
            message.body.title!,
            message.body.priority || "medium",
            Date.now()
          );
          loopCtx.state.tasksCreated += 1;
        });
      }

      if (message.body.action === "complete" && message.body.taskId) {
        await loopCtx.step("complete-task", async () => {
          await loopCtx.db.execute(
            `UPDATE tasks SET status = 'completed', completed_at = ? WHERE id = ? AND status = 'pending'`,
            Date.now(),
            message.body.taskId
          );
          loopCtx.state.tasksCompleted += 1;
        });
      }
    });
  }),

  actions: {
    getTasks: async (c): Promise<Task[]> => {
      return await c.db.execute(
        `SELECT id, title, priority, status, created_at as createdAt, completed_at as completedAt
         FROM tasks ORDER BY created_at DESC`
      ) as Task[];
    },

    getPendingTasks: async (c) => {
      return await c.db.execute(
        `SELECT id, title, priority FROM tasks
         WHERE status = 'pending'
         ORDER BY
           CASE priority
             WHEN 'high' THEN 1
             WHEN 'medium' THEN 2
             WHEN 'low' THEN 3
           END`
      ) as { id: number; title: string; priority: string }[];
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
