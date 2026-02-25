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
 * Task Manager Actor with Workflow
 *
 * Uses workflow for durable, visualizable execution
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

  // Workflow-wrapped run loop for visualization
  run: workflow(async (ctx) => {
    await ctx.loop("task-processor", async (loopCtx) => {
      // Wait for next task message
      const message = await loopCtx.queue.next("wait-task");

      // Process based on action type
      if (message.body.action === "create" && message.body.title) {
        await loopCtx.step("create-task", async () => {
          const task: Task = {
            id: loopCtx.state.nextId++,
            title: message.body.title!,
            priority: message.body.priority || "medium",
            status: "pending",
            createdAt: Date.now(),
          };
          loopCtx.state.tasks.push(task);
          loopCtx.state.tasksCreated += 1;
        });
      }

      if (message.body.action === "complete" && message.body.taskId) {
        await loopCtx.step("complete-task", async () => {
          const task = loopCtx.state.tasks.find(t => t.id === message.body.taskId);
          if (task) {
            task.status = "completed";
            task.completedAt = Date.now();
            loopCtx.state.tasksCompleted += 1;
          }
        });
      }
    });
  }),

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
