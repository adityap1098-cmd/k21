import { Queue } from 'bullmq'
import { redisConnection } from './connection.js'

// Phase 0: queue definitions only — no workers yet.
// Workers are added in Phase 6 (marketplace) and Phase 7 (finance reports).
export const marketplaceQueue = new Queue('marketplace', {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 500 },
  },
})

export const reportQueue = new Queue('reports', {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: { count: 200 },
    removeOnFail: { count: 100 },
  },
})
