import { createClient } from "rivetkit/client";
import type { registry } from "./actors";

const client = createClient<typeof registry>({
  endpoint: "https://api.rivet.dev",
  namespace: "railway-workflow-7uhr-production-qdil",
  token: "pk_zSlGNhlhzjLmBfE8htaOKSLTXew7imddusQE2AHC1J7yYGOHeZvec1EpXyBOHhkI",
});

async function main() {
  // Create fresh actor with new key
  const taskManager = client.taskManager.getOrCreate(["workflow-sqlite-demo"]);

  console.log("Creating new actor with workflow...");
  const stats = await taskManager.getStats();
  console.log("Initial stats:", stats);

  await taskManager.send("tasks", { action: "create", title: "Test workflow visualizer", priority: "high" });
  await new Promise(r => setTimeout(r, 500));

  const tasks = await taskManager.getPendingTasks();
  console.log("Tasks:", tasks);
  console.log("\nDone! Check the Rivet dashboard for 'workflow-demo' actor");
}

main().catch(console.error);
