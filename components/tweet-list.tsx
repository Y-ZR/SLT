"use client"

import { useState, useMemo } from "react"
import type { Tweet } from "@/lib/redis"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { formatDistanceToNow } from "date-fns"

interface TweetListProps {
  tweets: Tweet[]
  groupKeywords: string
}

export function TweetList({ tweets, groupKeywords }: TweetListProps) {
  const [minImpressions, setMinImpressions] = useState<number>(0)
  const [mentionFilter, setMentionFilter] = useState<string>("all")

  const filteredTweets = useMemo(() => {
    return tweets.filter((tweet) => {
      // Filter by impressions
      if (tweet.impressions < minImpressions) {
        return false
      }

      // Filter by mentions
      if (mentionFilter !== "all" && !tweet.mentions.includes(mentionFilter)) {
        return false
      }

      return true
    })
  }, [tweets, minImpressions, mentionFilter])

  // Get unique mentions from all tweets for the filter dropdown
  const uniqueMentions = useMemo(() => {
    const mentions = new Set<string>()
    tweets.forEach((tweet) => {
      if (Array.isArray(tweet.mentions)) {
        tweet.mentions.forEach((mention) => {
          if (mention) mentions.add(mention)
        })
      }
    })
    return Array.from(mentions)
  }, [tweets])

  return (
    <div className="space-y-6">
      <div className="bg-muted/50 p-4 rounded-lg">
        <div className="text-sm font-medium mb-2">Keywords</div>
        <div className="flex flex-wrap gap-2">
          {groupKeywords.split(",").map((keyword, i) => (
            <Badge key={i} variant="outline" className="bg-background">
              {keyword.trim()}
            </Badge>
          ))}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="w-full sm:w-1/2">
          <Label htmlFor="min-impressions">Minimum Impressions</Label>
          <Input
            id="min-impressions"
            type="number"
            value={minImpressions}
            onChange={(e) => setMinImpressions(Number(e.target.value))}
            className="mt-1"
          />
        </div>

        <div className="w-full sm:w-1/2">
          <Label htmlFor="mention-filter">Filter by Mention</Label>
          <Select value={mentionFilter} onValueChange={setMentionFilter}>
            <SelectTrigger id="mention-filter" className="mt-1">
              <SelectValue placeholder="All mentions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All mentions</SelectItem>
              {uniqueMentions.map((mention) => (
                <SelectItem key={mention} value={mention}>
                  {mention}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="text-sm text-muted-foreground">
        Showing {filteredTweets.length} of {tweets.length} tweets
      </div>

      {filteredTweets.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          {tweets.length === 0
            ? "No tweets found in Redis for this group. Add tweets to Redis to see them here."
            : "No tweets match your filters"}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredTweets.map((tweet) => (
            <Card key={tweet.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarImage src={tweet.authorProfileImage || "/placeholder.svg"} alt={tweet.author} />
                    <AvatarFallback>{tweet.author ? tweet.author.substring(0, 2) : "??"}</AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-base">{tweet.author || "Unknown Author"}</CardTitle>
                    <CardDescription>@{tweet.authorUsername || "unknown"}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pb-2">
                <p>{tweet.text || "No content"}</p>
                {Array.isArray(tweet.mentions) && tweet.mentions.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {tweet.mentions.map((mention, index) => (
                      <Badge key={`${mention}-${index}`} variant="secondary" className="text-xs">
                        {mention}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
              <CardFooter className="pt-2 text-sm text-muted-foreground flex justify-between">
                <span>
                  {tweet.createdAt
                    ? formatDistanceToNow(new Date(tweet.createdAt), { addSuffix: true })
                    : "Unknown date"}
                </span>
                <span>{tweet.impressions?.toLocaleString() || 0} impressions</span>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
