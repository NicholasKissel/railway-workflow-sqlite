import { createClient } from "rivetkit/client";
import type { registry } from "./actors";

const client = createClient<typeof registry>({
  endpoint: "http://localhost:3000/api/rivet",
});

async function main() {
  console.log("Connecting to Task Manager actor...\n");

  // Get or create a task manager instance
  const taskManager = client.taskManager.getOrCreate(["my-tasks"]);

  // Create some tasks via the queue (durable workflow)
  console.log("Creating tasks...");
  await taskManager.send("tasks", { action: "create", title: "Learn Rivet Actors", priority: "high" });
  await taskManager.send("tasks", { action: "create", title: "Build a workflow", priority: "medium" });
  await taskManager.send("tasks", { action: "create", title: "Test SQLite persistence", priority: "high" });

  // Give the workflow a moment to process
  await new Promise((resolve) => setTimeout(resolve, 500));

  // Query tasks using actions (reads from SQLite)
  console.log("\nPending tasks (sorted by priority):");
  const pendingTasks = await taskManager.getPendingTasks();
  for (const task of pendingTasks) {
    console.log(`  [${task.priority.toUpperCase()}] ${task.id}: ${task.title}`);
  }

  // Complete the first task
  if (pendingTasks.length > 0) {
    console.log(`\nCompleting task ${pendingTasks[0].id}...`);
    await taskManager.send("tasks", { action: "complete", taskId: pendingTasks[0].id });
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  // Get all tasks
  console.log("\nAll tasks:");
  const allTasks = await taskManager.getTasks();
  for (const task of allTasks) {
    const status = task.status === "completed" ? "[DONE]" : "[    ]";
    console.log(`  ${status} ${task.id}: ${task.title}`);
  }

  // Show workflow stats
  console.log("\nWorkflow stats:");
  const stats = await taskManager.getStats();
  console.log(`  Tasks created: ${stats.tasksCreated}`);
  console.log(`  Tasks completed: ${stats.tasksCompleted}`);
}

main().catch(console.error);
