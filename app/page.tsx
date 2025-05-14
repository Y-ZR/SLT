import { Suspense } from "react";
import { fetchGroups, fetchTweetsForGroup } from "@/app/actions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TweetList } from "@/components/tweet-list";
import { GroupManager } from "@/components/group-manager";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

export default async function Dashboard() {
  const groups = await fetchGroups();

  return (
    <div className="container mx-auto py-6 max-w-6xl">
      <h1 className="text-3xl font-bold mb-6">Twitter Monitoring Dashboard</h1>

      {groups.length === 0 ? (
        <div className="space-y-8">
          <div className="text-center py-10 bg-muted/50 rounded-lg">
            <h2 className="text-xl font-medium mb-2">No Groups Found</h2>
            <p className="text-muted-foreground mb-4">
              Create your first group to start viewing tweets from Redis.
            </p>
          </div>
          <GroupManager groups={groups} />
        </div>
      ) : (
        <Tabs defaultValue={groups[0]?.name} className="space-y-6">
          <div className="flex justify-between items-center">
            <TabsList>
              {groups.map((group) => (
                <TabsTrigger key={group.name} value={group.name}>
                  {group.name}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {groups.map((group) => (
            <TabsContent
              key={group.name}
              value={group.name}
              className="space-y-6"
            >
              <Suspense fallback={<TweetListSkeleton />}>
                <TweetTabContent
                  groupName={group.name}
                  keywords={group.keywords}
                />
              </Suspense>
            </TabsContent>
          ))}

          <div className="mt-12 pt-6 border-t">
            <GroupManager groups={groups} />
          </div>
        </Tabs>
      )}
    </div>
  );
}

async function TweetTabContent({
  groupName,
  keywords,
}: {
  groupName: string;
  keywords: string;
}) {
  try {
    const tweets = await fetchTweetsForGroup(groupName);
    return <TweetList tweets={tweets} groupKeywords={keywords} />;
  } catch (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>
          Failed to load tweets for this group. Please check your Redis
          configuration.
        </AlertDescription>
      </Alert>
    );
  }
}

function TweetListSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-20 w-full" />
      <div className="flex flex-col sm:flex-row gap-4">
        <Skeleton className="h-10 w-full sm:w-1/2" />
        <Skeleton className="h-10 w-full sm:w-1/2" />
      </div>
      <div className="space-y-4">
        {Array(3)
          .fill(0)
          .map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
      </div>
    </div>
  );
}
