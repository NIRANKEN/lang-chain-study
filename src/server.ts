import { createApp, startServer } from "./app";

async function main() {
  try {
    const app = await createApp();
    startServer(app);
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

main();