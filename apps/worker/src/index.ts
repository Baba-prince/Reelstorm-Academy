import { config } from "dotenv";
import { resolve } from "node:path";
config({ path: resolve(process.cwd(), "../../.env") });
config();

import { Worker } from "bullmq";
import { redis, trackJob } from "./lib.js";
import { analyzeVideoJob } from "./jobs/analyzeVideo.js";
import { extractTemplateJob } from "./jobs/extractTemplate.js";
import { generateVideoJob } from "./jobs/generateVideo.js";
import { archiveBlockJob } from "./jobs/archiveBlock.js";
import { mergeMasterJob } from "./jobs/mergeMaster.js";

const connection = redis();

function start(name: string, processor: (job: never) => Promise<unknown>) {
  const worker = new Worker(name, processor as never, {
    connection,
    concurrency: Number(process.env.WORKER_CONCURRENCY || 2),
  });

  worker.on("ready", () => console.log(`[worker] ${name} ready`));
  worker.on("failed", (job, err) => {
    console.error(`[worker] ${name} failed`, job?.id, err.message);
    if (job?.id) {
      trackJob(name, String(job.id), "FAILED", job.data, { error: err.message }).catch(() => undefined);
    }
  });
  worker.on("completed", (job) => {
    console.log(`[worker] ${name} completed`, job.id);
  });

  return worker;
}

start("analyzeVideo", analyzeVideoJob);
start("extractTemplate", extractTemplateJob);
start("generateVideo", generateVideoJob);
start("archiveBlock", archiveBlockJob);
start("mergeMaster", mergeMasterJob);

console.log("REELSTORM Worker online — queues: analyzeVideo, extractTemplate, generateVideo, archiveBlock, mergeMaster");
