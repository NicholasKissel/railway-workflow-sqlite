import { actor, queue, setup } from "rivetkit";
import { workflow } from "rivetkit/workflow";

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
 * Task Manager Actor with Workflow + SQLite
 *
 * Uses workflow for durable, visualizable execution
 * Uses SQLite for persistent task storage (enables Database Studio)
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

  queues: {
    tasks: queue<TaskMessage>(),
  },

  // Initialize SQLite table on actor creation
  onCreate: (c) => {
    c.db.exec(`
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

  // Workflow-wrapped run loop for visualization
  run: workflow(async (ctx) => {
    await ctx.loop("task-processor", async (loopCtx) => {
      // Wait for next task message
      const message = await loopCtx.queue.next("wait-task");

      // Process based on action type
      if (message.body.action === "create" && message.body.title) {
        await loopCtx.step("create-task", async () => {
          loopCtx.db.exec(
            `INSERT INTO tasks (title, priority, status, created_at) VALUES (?, ?, 'pending', ?)`,
            [message.body.title!, message.body.priority || "medium", Date.now()]
          );
          loopCtx.state.tasksCreated += 1;
        });
      }

      if (message.body.action === "complete" && message.body.taskId) {
        await loopCtx.step("complete-task", async () => {
          const result = loopCtx.db.exec(
            `UPDATE tasks SET status = 'completed', completed_at = ? WHERE id = ? AND status = 'pending'`,
            [Date.now(), message.body.taskId]
          );
          if (result.changes > 0) {
            loopCtx.state.tasksCompleted += 1;
          }
        });
      }
    });
  }),

  actions: {
    getTasks: (c): Task[] => {
      return c.db.query<Task>(
        `SELECT id, title, priority, status, created_at as createdAt, completed_at as completedAt
         FROM tasks ORDER BY created_at DESC`
      );
    },

    getPendingTasks: (c) => {
      return c.db.query<{ id: number; title: string; priority: string }>(
        `SELECT id, title, priority FROM tasks
         WHERE status = 'pending'
         ORDER BY
           CASE priority
             WHEN 'high' THEN 1
             WHEN 'medium' THEN 2
             WHEN 'low' THEN 3
           END`
      );
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
