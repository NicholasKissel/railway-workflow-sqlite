import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { registry } from "./actors";
import { html } from "hono/html";

const app = new Hono();

// Mount Rivet actors at /api/rivet
app.all("/api/rivet/*", (c) => registry.handler(c.req.raw));

// Health check
app.get("/health", (c) => c.json({ status: "ok" }));

// Web UI
app.get("/", (c) => {
  return c.html(html`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Task Manager - Rivet Workflow + SQLite Demo</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        * { box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background: #0a0a0a;
          color: #e0e0e0;
        }
        h1 { color: #fff; margin-bottom: 5px; }
        .subtitle { color: #888; margin-bottom: 20px; }
        .form-row {
          display: flex;
          gap: 10px;
          margin-bottom: 20px;
        }
        input[type="text"] {
          flex: 1;
          padding: 12px;
          border: 1px solid #333;
          border-radius: 6px;
          background: #1a1a1a;
          color: #fff;
          font-size: 16px;
        }
        select {
          padding: 12px;
          border: 1px solid #333;
          border-radius: 6px;
          background: #1a1a1a;
          color: #fff;
          font-size: 16px;
        }
        button {
          padding: 12px 20px;
          background: #3b82f6;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 16px;
        }
        button:hover { background: #2563eb; }
        button:disabled { background: #555; cursor: not-allowed; }
        .task {
          display: flex;
          align-items: center;
          padding: 12px;
          background: #1a1a1a;
          border-radius: 6px;
          margin-bottom: 8px;
          gap: 12px;
        }
        .task.completed { opacity: 0.5; }
        .task-title { flex: 1; }
        .task.completed .task-title { text-decoration: line-through; }
        .priority {
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 600;
        }
        .priority.high { background: #dc2626; }
        .priority.medium { background: #f59e0b; }
        .priority.low { background: #22c55e; }
        .complete-btn {
          padding: 6px 12px;
          background: #22c55e;
          font-size: 14px;
        }
        .stats {
          display: flex;
          gap: 20px;
          margin-bottom: 20px;
          padding: 15px;
          background: #1a1a1a;
          border-radius: 6px;
        }
        .stat { text-align: center; }
        .stat-value { font-size: 24px; font-weight: bold; color: #3b82f6; }
        .stat-label { font-size: 12px; color: #888; }
        .loading { text-align: center; padding: 20px; color: #888; }
        .error { color: #dc2626; padding: 10px; background: #1a1a1a; border-radius: 6px; }
      </style>
    </head>
    <body>
      <h1>Task Manager</h1>
      <p class="subtitle">Rivet Workflow + SQLite Demo</p>

      <div class="stats">
        <div class="stat">
          <div class="stat-value" id="created">-</div>
          <div class="stat-label">Created</div>
        </div>
        <div class="stat">
          <div class="stat-value" id="completed">-</div>
          <div class="stat-label">Completed</div>
        </div>
      </div>

      <div class="form-row">
        <input type="text" id="title" placeholder="New task..." />
        <select id="priority">
          <option value="high">High</option>
          <option value="medium" selected>Medium</option>
          <option value="low">Low</option>
        </select>
        <button onclick="createTask()">Add</button>
      </div>

      <div id="tasks"><div class="loading">Loading...</div></div>

      <script type="module">
        import { createClient } from "https://esm.sh/rivetkit@2.1.3/client";

        const client = createClient({
          endpoint: window.location.origin + "/api/rivet",
        });

        const taskManager = client.taskManager.getOrCreate(["web-ui"]);
        window.taskManager = taskManager;

        async function loadTasks() {
          try {
            const [tasks, stats] = await Promise.all([
              taskManager.getTasks(),
              taskManager.getStats()
            ]);

            document.getElementById("created").textContent = stats.tasksCreated;
            document.getElementById("completed").textContent = stats.tasksCompleted;

            const container = document.getElementById("tasks");
            if (tasks.length === 0) {
              container.innerHTML = '<div class="loading">No tasks yet. Add one above!</div>';
              return;
            }

            container.innerHTML = tasks.map(task => \`
              <div class="task \${task.status}">
                <span class="task-title">\${task.title}</span>
                <span class="priority \${task.priority}">\${task.priority.toUpperCase()}</span>
                \${task.status === 'pending' ? \`<button class="complete-btn" onclick="completeTask(\${task.id})">Done</button>\` : ''}
              </div>
            \`).join("");
          } catch (err) {
            document.getElementById("tasks").innerHTML = '<div class="error">Error: ' + err.message + '</div>';
          }
        }

        window.createTask = async function() {
          const title = document.getElementById("title").value.trim();
          if (!title) return;

          const priority = document.getElementById("priority").value;
          document.getElementById("title").value = "";

          await taskManager.send("tasks", { action: "create", title, priority });
          setTimeout(loadTasks, 300);
        };

        window.completeTask = async function(taskId) {
          await taskManager.send("tasks", { action: "complete", taskId });
          setTimeout(loadTasks, 300);
        };

        document.getElementById("title").addEventListener("keypress", (e) => {
          if (e.key === "Enter") createTask();
        });

        loadTasks();
        setInterval(loadTasks, 2000);
      </script>
    </body>
    </html>
  `);
});

const port = Number(process.env.PORT) || 3000;

console.log(`Server starting on port ${port}`);
console.log(`Rivet metadata: http://localhost:${port}/api/rivet/metadata`);

serve({ fetch: app.fetch, port });
