import { createClient } from "rivetkit/client";
import type { registry } from "./actors";

// Connect to production via Rivet Cloud
const client = createClient<typeof registry>({
  endpoint: "https://api.rivet.dev",
  namespace: "railway-workflow-7uhr-production-qdil",
  token: "pk_zSlGNhlhzjLmBfE8htaOKSLTXew7imddusQE2AHC1J7yYGOHeZvec1EpXyBOHhkI",
});

async function main() {
  console.log("Connecting to Task Manager actor on Rivet Cloud...\n");

  // Get or create a task manager instance
  const taskManager = client.taskManager.getOrCreate(["my-tasks"]);

  // First call an action to ensure the actor is created
  console.log("Initializing actor...");
  const initialStats = await taskManager.getStats();
  console.log(`  Current stats: ${initialStats.tasksCreated} created, ${initialStats.tasksCompleted} completed`);

  // Create some tasks via the queue
  console.log("\nCreating tasks...");
  await taskManager.send("tasks", { action: "create", title: "Deploy to Railway", priority: "high" });
  await taskManager.send("tasks", { action: "create", title: "Connect to Rivet Cloud", priority: "high" });
  await taskManager.send("tasks", { action: "create", title: "Test production deployment", priority: "medium" });

  // Give the workflow a moment to process
  await new Promise((resolve) => setTimeout(resolve, 1000));

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
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  // Get all tasks
  console.log("\nAll tasks:");
  const allTasks = await taskManager.getTasks();
  for (const task of allTasks) {
    const status = task.status === "completed" ? "[DONE]" : "[    ]";
    console.log(`  ${status} ${task.id}: ${task.title}`);
  }

  // Show stats
  console.log("\nStats:");
  const stats = await taskManager.getStats();
  console.log(`  Tasks created: ${stats.tasksCreated}`);
  console.log(`  Tasks completed: ${stats.tasksCompleted}`);
}

main().catch(console.error);
