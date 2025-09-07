import { createClient } from 'redis'

let redisClient: ReturnType<typeof createClient> | null = null
let connectionPromise: Promise<void> | null = null

export async function getRedisClient() {
  // If already connected, return the client
  if (redisClient && redisClient.isOpen) {
    return redisClient
  }

  // If connection is in progress, wait for it
  if (connectionPromise) {
    await connectionPromise
    return redisClient
  }

  // Create new connection
  connectionPromise = new Promise(async (resolve, reject) => {
    try {
      const url = process.env.REDIS_URL || process.env.KV_URL || process.env.KV_REST_API_URL
      
      if (!url) {
        console.log('No Redis URL found, using in-memory storage')
        reject(new Error('No Redis URL configured'))
        return
      }

      console.log('Connecting to Redis...')
      redisClient = createClient({ url })
      
      redisClient.on('error', (err) => {
        console.error('Redis Client Error:', err)
      })

      await redisClient.connect()
      console.log('Successfully connected to Redis')
      resolve()
    } catch (error) {
      console.error('Failed to connect to Redis:', error)
      redisClient = null
      reject(error)
    } finally {
      connectionPromise = null
    }
  })

  await connectionPromise
  return redisClient
}

export async function disconnectRedis() {
  if (redisClient) {
    await redisClient.quit()
    redisClient = null
  }
}