import { access, cp, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Plugin } from "vite";

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

// Packages Sites metadata and migrations after Vite finishes compiling.
export function sites(): Plugin {
  let root = process.cwd();

  return {
    name: "sites",
    apply: "build",
    configResolved(config) {
      root = config.root;
    },
    async closeBundle() {
      const outputDirectory = resolve(root, "dist", ".openai");
      const serverDirectory = resolve(root, "dist", "server");
      const clientDirectory = resolve(root, "dist", "client");
      const hostingConfig = resolve(root, ".openai", "hosting.json");
      const drizzleSource = resolve(root, "drizzle");

      await rm(outputDirectory, { recursive: true, force: true });
      await mkdir(outputDirectory, { recursive: true });
      await mkdir(serverDirectory, { recursive: true });
      // Sites uses the Cloudflare Worker layout: public files belong in dist/client.
      // Keep Vite's root output as well for the existing GitHub Pages workflow.
      await rm(clientDirectory, { recursive: true, force: true });
      await mkdir(clientDirectory, { recursive: true });
      for (const entry of await readdir(resolve(root, "dist"))) {
        if (["client", "server", ".openai"].includes(entry)) continue;
        await cp(
          resolve(root, "dist", entry),
          resolve(clientDirectory, entry),
          {
            recursive: true,
          },
        );
      }

      await writeFile(
        resolve(serverDirectory, "index.js"),
        `export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/") url.pathname = "/index.html";
    let response = await env.ASSETS.fetch(new Request(url, request));
    if (response.status === 404 && request.method === "GET") {
      url.pathname = "/index.html";
      response = await env.ASSETS.fetch(new Request(url, request));
    }
    return response;
  },
};\n`,
        "utf8",
      );

      if (await exists(hostingConfig)) {
        await cp(hostingConfig, resolve(outputDirectory, "hosting.json"));
      }
      if (await exists(drizzleSource)) {
        await cp(drizzleSource, resolve(outputDirectory, "drizzle"), {
          recursive: true,
        });
      }
    },
  };
}
