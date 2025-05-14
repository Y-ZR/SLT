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
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"

interface TweetListProps {
  tweets: Tweet[]
  groupKeywords: string
}

export function TweetList({ tweets, groupKeywords }: TweetListProps) {
  const [minImpressions, setMinImpressions] = useState<number>(0)
  const [mentionFilter, setMentionFilter] = useState<string>("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [tweetsPerPage, setTweetsPerPage] = useState("10")

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

  // Pagination calculations
  const totalTweets = filteredTweets.length
  const tweetsPerPageNumber = parseInt(tweetsPerPage)
  const totalPages = Math.ceil(totalTweets / tweetsPerPageNumber)
  
  // Get current page tweets
  const currentTweets = useMemo(() => {
    const startIndex = (currentPage - 1) * tweetsPerPageNumber
    return filteredTweets.slice(startIndex, startIndex + tweetsPerPageNumber)
  }, [filteredTweets, currentPage, tweetsPerPageNumber])

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

  // Generate page numbers for pagination
  const getPageNumbers = () => {
    const pages = []
    const maxVisiblePages = 5 // Show max 5 page numbers
    
    if (totalPages <= maxVisiblePages) {
      // If total pages is less than max visible, show all pages
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      // Always show first page
      pages.push(1)
      
      if (currentPage > 3) {
        pages.push('ellipsis')
      }
      
      // Show pages around current page
      for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
        pages.push(i)
      }
      
      if (currentPage < totalPages - 2) {
        pages.push('ellipsis')
      }
      
      // Always show last page
      if (totalPages > 1) {
        pages.push(totalPages)
      }
    }
    
    return pages
  }

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

      <div className="flex flex-col sm:flex-row items-start gap-4 w-full">
        <div className="w-full sm:w-[250px]">
          <Label htmlFor="min-impressions">Minimum Impressions</Label>
          <Input
            id="min-impressions"
            type="number"
            value={minImpressions}
            onChange={(e) => setMinImpressions(Number(e.target.value))}
            className="mt-1"
          />
        </div>

        <div className="w-full sm:w-[200px]">
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

        <div className="flex-1"></div>

        <div className="sm:w-32 flex flex-col items-end">
          <Label htmlFor="tweets-per-page" className="text-right">Tweets per Page</Label>
          <Select
            value={tweetsPerPage}
            onValueChange={(value) => {
              setTweetsPerPage(value);
              setCurrentPage(1); // Reset to first page when changing items per page
            }}
          >
            <SelectTrigger id="tweets-per-page" className="mt-1 w-full">
              <SelectValue placeholder="Select amount" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="5">5 tweets</SelectItem>
              <SelectItem value="10">10 tweets</SelectItem>
              <SelectItem value="20">20 tweets</SelectItem>
              <SelectItem value="50">50 tweets</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="text-sm text-muted-foreground">
        Showing {Math.min(tweetsPerPageNumber, currentTweets.length)} of{" "}
        {totalTweets} tweets
      </div>

      {currentTweets.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          {tweets.length === 0
            ? "No tweets found in Redis for this group. Add tweets to Redis to see them here."
            : "No tweets match your filters"}
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {currentTweets.map((tweet) => (
              <Card key={tweet.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage
                        src={tweet.authorProfileImage || "/placeholder.svg"}
                        alt={tweet.author}
                      />
                      <AvatarFallback>
                        {tweet.author ? tweet.author.substring(0, 2) : "??"}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <CardTitle className="text-base">
                        {tweet.author || "Unknown Author"}
                      </CardTitle>
                      <CardDescription>
                        @{tweet.authorUsername || "unknown"}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pb-2">
                  <p>{tweet.text || "No content"}</p>
                  {Array.isArray(tweet.mentions) &&
                    tweet.mentions.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {tweet.mentions.map((mention, index) => (
                          <Badge
                            key={`${mention}-${index}`}
                            variant="secondary"
                            className="text-xs"
                          >
                            {mention}
                          </Badge>
                        ))}
                      </div>
                    )}
                </CardContent>
                <CardFooter className="pt-2 text-sm text-muted-foreground flex justify-between">
                  <span>
                    {tweet.createdAt
                      ? formatDistanceToNow(new Date(tweet.createdAt), {
                          addSuffix: true,
                        })
                      : "Unknown date"}
                  </span>
                  <span>
                    {tweet.impressions?.toLocaleString() || 0} impressions
                  </span>
                </CardFooter>
              </Card>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center mt-6">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      className={
                        currentPage === 1
                          ? "pointer-events-none opacity-50"
                          : "cursor-pointer"
                      }
                    />
                  </PaginationItem>

                  {getPageNumbers().map((page, index) =>
                    page === "ellipsis" ? (
                      <PaginationItem key={`ellipsis-${index}`}>
                        <PaginationEllipsis />
                      </PaginationItem>
                    ) : (
                      <PaginationItem key={page}>
                        <PaginationLink
                          onClick={() => setCurrentPage(page as number)}
                          isActive={currentPage === page}
                          className="cursor-pointer"
                        >
                          {page}
                        </PaginationLink>
                      </PaginationItem>
                    )
                  )}

                  <PaginationItem>
                    <PaginationNext
                      onClick={() =>
                        setCurrentPage((p) => Math.min(totalPages, p + 1))
                      }
                      className={
                        currentPage === totalPages
                          ? "pointer-events-none opacity-50"
                          : "cursor-pointer"
                      }
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </>
      )}
    </div>
  );
}
