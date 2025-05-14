"use server"

import { revalidatePath } from "next/cache"
import { getGroups, getTweetsForGroup, addGroup, deleteGroup, type Group, type Tweet } from "@/lib/redis"

export async function fetchGroups(): Promise<Group[]> {
  try {
    return await getGroups()
  } catch (error) {
    console.error("Error fetching groups:", error)
    return []
  }
}

export async function fetchTweetsForGroup(groupName: string): Promise<Tweet[]> {
  try {
    return await getTweetsForGroup(groupName)
  } catch (error) {
    console.error(`Error fetching tweets for group ${groupName}:`, error)
    return []
  }
}

export async function createGroup(formData: FormData) {
  try {
    const name = formData.get("name") as string
    const keywords = formData.get("keywords") as string

    if (!name || !keywords) {
      throw new Error("Name and keywords are required")
    }

    await addGroup(name, keywords)
    revalidatePath("/")

    return { success: true }
  } catch (error) {
    console.error("Error creating group:", error)
    return { success: false, error: (error as Error).message }
  }
}

export async function removeGroup(formData: FormData) {
  try {
    const name = formData.get("name") as string

    if (!name) {
      throw new Error("Group name is required")
    }

    await deleteGroup(name)
    revalidatePath("/")

    return { success: true }
  } catch (error) {
    console.error("Error removing group:", error)
    return { success: false, error: (error as Error).message }
  }
}
