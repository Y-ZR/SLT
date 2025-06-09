import { Redis } from "@upstash/redis"

// Initialize Redis client with environment variables
export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

// Types for our data structure
export interface Tweet {
  id: string
  text: string
  author: string
  authorUsername: string
  authorProfileImage: string
  createdAt: string
  impressions: number
  mentions: string[]
  groupName: string
}

export interface Group {
  name: string
  keywords: string
}

// Helper functions for Redis operations
export async function getGroups(): Promise<Group[]> {
  try {
    const groupsHash = (await redis.hgetall("groups")) as Record<string, string>

    if (!groupsHash) return []

    return Object.entries(groupsHash).map(([name, keywords]) => ({
      name,
      keywords,
    }))
  } catch (error) {
    console.error("Error fetching groups:", error)
    return []
  }
}

export async function addGroup(name: string, keywords: string): Promise<void> {
  await redis.hset("groups", { [name]: keywords })
}

export async function deleteGroup(name: string): Promise<void> {
  await redis.hdel("groups", name)
  // Also delete all tweets for this group
  await redis.del(`tweets:${name}`)
}

export async function getTweetsForGroup(groupName: string): Promise<Tweet[]> {
  try {
    // Get all tweets for the group from the hash
    const tweetsHash = await redis.hgetall(`tweets:${groupName}`)
    if (!tweetsHash) return []

    const tweets: Tweet[] = []

    // Process each tweet in the hash
    for (const [id, tweetData] of Object.entries(tweetsHash)) {
      try {
        // Parse the tweet data, handling both string and object cases
        const tweetJson = typeof tweetData === 'string' ? JSON.parse(tweetData) : tweetData
        
        // Extract impression count safely
        const impressionCount = tweetJson.public_metrics?.impression_count || 
                              tweetJson.public_metrics?.impressions || 
                              0

        const tweet: Tweet = {
          id: tweetJson.id || id,
          text: tweetJson.text || '',
          author: tweetJson.author_name || '',
          authorUsername: tweetJson.author_username || '',
          authorProfileImage: tweetJson.profile_image_url || '',
          createdAt: tweetJson.created_at || '',
          impressions: impressionCount,
          mentions: [], // Twitter API doesn't provide mentions directly
          groupName,
        }
        tweets.push(tweet)
      } catch (error) {
        console.error(`Error parsing tweet data for ID ${id}:`, error)
        // Try to log the problematic data for debugging
        console.error('Problematic tweet data:', tweetData)
      }
    }

    // Sort by createdAt (newest first)
    return tweets.sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime()
      const dateB = new Date(b.createdAt).getTime()
      return isNaN(dateB) || isNaN(dateA) ? 0 : dateB - dateA
    })
  } catch (error) {
    console.error(`Error fetching tweets for group ${groupName}:`, error)
    return []
  }
}

// For adding tweets to Redis
export async function addTweet(tweet: Tweet): Promise<void> {
  const { id, groupName } = tweet

  try {
    // Check if tweet already exists
    const exists = await redis.exists(`tweet:${id}`)
    if (exists) return

    // Store tweet data
    await redis.hset(`tweet:${id}`, {
      ...tweet,
      mentions: Array.isArray(tweet.mentions) ? tweet.mentions.join(",") : tweet.mentions,
    })

    // Check if the tweets:<group> key exists and its type
    const keyExists = await redis.exists(`tweets:${groupName}`)

    if (keyExists) {
      const keyType = await redis.type(`tweets:${groupName}`)

      if (keyType === "set") {
        // Add tweet ID to group set
        await redis.sadd(`tweets:${groupName}`, id)
      } else if (keyType === "list") {
        // Add tweet ID to group list
        await redis.lpush(`tweets:${groupName}`, id)
      } else if (keyType === "hash") {
        // Add tweet ID as a field in the hash
        await redis.hset(`tweets:${groupName}`, { [id]: "1" })
      } else {
        // For other types, create a new set
        await redis.del(`tweets:${groupName}`)
        await redis.sadd(`tweets:${groupName}`, id)
      }
    } else {
      // Create a new set
      await redis.sadd(`tweets:${groupName}`, id)
    }
  } catch (error) {
    console.error(`Error adding tweet ${id}:`, error)
  }
}

export async function updateGroup(oldName: string, newName: string, keywords: string): Promise<void> {
  // If name hasn't changed, just update keywords
  if (oldName === newName) {
    await redis.hset("groups", { [oldName]: keywords })
    return
  }

  // Start a pipeline to perform multiple operations atomically
  const pipeline = redis.pipeline()

  // 1. Add the new group entry with updated keywords
  pipeline.hset("groups", { [newName]: keywords })

  // 2. Remove the old group entry
  pipeline.hdel("groups", oldName)

  // 3. Rename the tweets key if it exists
  const oldTweetsKey = `tweets:${oldName}`
  const newTweetsKey = `tweets:${newName}`
  try {
    const exists = await redis.exists(oldTweetsKey)
    if (exists) {
      pipeline.rename(oldTweetsKey, newTweetsKey)
    }
  } catch (err) {
    console.error("Error checking/renaming tweets key while updating group:", err)
  }

  await pipeline.exec()
}
