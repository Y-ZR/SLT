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
import { Check, ChevronsUpDown, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface TweetListProps {
  tweets: Tweet[]
  groupKeywords: string
}

export function TweetList({ tweets, groupKeywords }: TweetListProps) {
  const [minImpressions, setMinImpressions] = useState<number>(0)
  const [mentionFilter, setMentionFilter] = useState<string>("all")
  const [selectedMentions, setSelectedMentions] = useState<string[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [tweetsPerPage, setTweetsPerPage] = useState("10")
  const [open, setOpen] = useState(false)
  const [sortField, setSortField] = useState<"date" | "impressions">("date")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")

  // Utility to extract @mentions from tweet text
  const extractMentions = (text: string | undefined) => {
    if (!text) return [] as string[]
    const matches = text.match(/@[A-Za-z0-9_]+/g) || []
    return matches
  }

  const filteredTweets = useMemo(() => {
    let filtered = tweets.filter((tweet) => {
      // Filter by impressions
      if (tweet.impressions < minImpressions) {
        return false
      }

      // Determine mentions for this tweet (from payload or extracted)
      const tweetMentions = (Array.isArray(tweet.mentions) && tweet.mentions.length > 0)
        ? tweet.mentions
        : extractMentions(tweet.text)

      if (selectedMentions.length > 0) {
        return tweetMentions.some((m) => selectedMentions.includes(m))
      }

      return true
    })

    // Apply sorting
    filtered.sort((a, b) => {
      if (sortField === "date") {
        const dateA = new Date(a.createdAt).getTime()
        const dateB = new Date(b.createdAt).getTime()
        return sortOrder === "asc" 
          ? (isNaN(dateA) || isNaN(dateB) ? 0 : dateA - dateB)
          : (isNaN(dateB) || isNaN(dateA) ? 0 : dateB - dateA)
      } else {
        return sortOrder === "asc"
          ? a.impressions - b.impressions
          : b.impressions - a.impressions
      }
    })

    return filtered
  }, [tweets, minImpressions, selectedMentions, sortField, sortOrder])

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
      const tweetMentions = (Array.isArray(tweet.mentions) && tweet.mentions.length > 0)
        ? tweet.mentions
        : extractMentions(tweet.text)
      tweetMentions.forEach((mention) => {
        if (mention) mentions.add(mention)
      })
    })
    return Array.from(mentions)
  }, [tweets])

  // Define Binance-related mentions
  const binanceMentions = ["@binance", "@cz_binance", "@heyibinance"]

  // Create a combined list of all mentions for the combobox
  const allMentionOptions = useMemo(() => {
    const allOptions = new Set([...binanceMentions, ...uniqueMentions])
    return Array.from(allOptions).map(mention => ({
      value: mention,
      label: mention,
      isBinanceRelated: binanceMentions.includes(mention)
    }))
  }, [uniqueMentions])

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
        <div className="w-38">
          <Label htmlFor="min-impressions">Minimum Impressions</Label>
          <Input
            id="min-impressions"
            type="number"
            value={minImpressions}
            onChange={(e) => setMinImpressions(Number(e.target.value))}
            className="mt-1"
          />
        </div>

        <div className="w-72">
          <Label htmlFor="mention-filter">Filter by Mentions</Label>
          <div className="mt-1 w-full relative z-10">
            <Popover open={open} onOpenChange={setOpen} modal>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={open}
                  className="w-full justify-between h-9"
                  id="mention-filter"
                >
                  {selectedMentions.length > 0
                    ? `${selectedMentions.length} selected`
                    : "Select mentions..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                sideOffset={5}
                className="p-0"
                style={{ width: "var(--radix-popover-trigger-width)" }}
              >
                <Command>
                  <CommandInput placeholder="Search mentions..." className="h-9" />
                  <CommandList>
                    <CommandEmpty>No mentions found.</CommandEmpty>
                    <CommandGroup>
                      {allMentionOptions.map((option) => (
                        <>
                          <CommandItem
                            key={option.value}
                            value={option.value}
                            onSelect={(currentValue) => {
                              setSelectedMentions((prev) => {
                                if (prev.includes(currentValue)) {
                                  return prev.filter(item => item !== currentValue);
                                } else {
                                  return [...prev, currentValue];
                                }
                              });
                            }}
                          >
                            {option.label}
                            <Check
                              className={cn(
                                "ml-auto h-4 w-4",
                                selectedMentions.includes(option.value) ? "opacity-100" : "opacity-0"
                              )}
                            />
                          </CommandItem>
                          {option.value === "@heyibinance" && <CommandSeparator />}
                        </>
                      ))}
                    </CommandGroup>
                  </CommandList>
                  {selectedMentions.length > 0 && (
                    <div className="border-t px-2 py-2 flex flex-col gap-1 max-h-40 overflow-y-auto">
                      {selectedMentions.map(mention => (
                        <Badge key={mention} variant="secondary" className="px-2 py-1 w-fit">
                          {mention}
                          <X 
                            className="ml-1 h-3 w-3 cursor-pointer" 
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedMentions(prev => prev.filter(item => item !== mention));
                            }}
                          />
                        </Badge>
                      ))}
                      {selectedMentions.length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="self-start mt-1 h-7"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedMentions([]);
                          }}
                        >
                          Clear
                        </Button>
                      )}
                    </div>
                  )}
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div className="flex-1"></div>

        <div className="flex items-start gap-4">
          <div className="w-40">
            <Label htmlFor="sort-field">Sort By</Label>
            <Select value={sortField} onValueChange={(value: "date" | "impressions") => setSortField(value)}>
              <SelectTrigger id="sort-field" className="mt-1 w-full">
                <SelectValue placeholder="Select field" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">Last Posted</SelectItem>
                <SelectItem value="impressions">Impressions</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="w-40">
            <Label htmlFor="sort-order">Order</Label>
            <Select value={sortOrder} onValueChange={(value: "asc" | "desc") => setSortOrder(value)}>
              <SelectTrigger id="sort-order" className="mt-1 w-full">
                <SelectValue placeholder="Select order" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="asc">Ascending</SelectItem>
                <SelectItem value="desc">Descending</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="w-32">
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
                <CardHeader className="pb-1">
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
                <CardContent className="pb-1">
                  <p>{tweet.text || "No content"}</p>
                  {Array.isArray(tweet.mentions) &&
                    tweet.mentions.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
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
                <CardFooter className="pt-1 text-sm text-muted-foreground flex justify-between items-center">
                  <div className="flex items-center gap-4">
                    <span>
                      {tweet.createdAt
                        ? formatDistanceToNow(new Date(tweet.createdAt), {
                            addSuffix: true,
                          })
                        : "Unknown date"}
                    </span>
                    <a
                      href={`https://twitter.com/${tweet.authorUsername}/status/${tweet.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#1DA1F2] hover:text-[#1a8cd8] hover:underline underline-offset-2 transition-colors duration-200 font-medium"
                    >
                      View on X
                    </a>
                  </div>
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
