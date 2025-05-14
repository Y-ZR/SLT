"use client";

import { useState } from "react";
import type { Group } from "@/lib/redis";
import { createGroup, removeGroup } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface GroupManagerProps {
  groups: Group[];
}

export function GroupManager({ groups }: GroupManagerProps) {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState<string | null>(null);

  const handleAddGroup = async (formData: FormData) => {
    try {
      await createGroup(formData);
      setAddDialogOpen(false);
      toast.success("Group created", {
        description: "The group has been created successfully.",
      });
    } catch (error) {
      toast.error("Error", {
        description: "Failed to create group. Please try again.",
      });
    }
  };

  const handleDeleteGroup = async (name: string) => {
    try {
      const formData = new FormData();
      formData.append("name", name);
      await removeGroup(formData);
      setDeleteDialogOpen(false);
      toast.success("Group deleted", {
        description: "The group has been deleted successfully.",
      });
    } catch (error) {
      toast.error("Error", {
        description: "Failed to delete group. Please try again.",
      });
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Manage Groups</h2>
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Group
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form action={handleAddGroup}>
              <DialogHeader>
                <DialogTitle>Add New Group</DialogTitle>
                <DialogDescription>
                  Create a new group with keywords to monitor tweets.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Group Name</Label>
                  <Input
                    id="name"
                    name="name"
                    placeholder="e.g., KYB, Cards"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="keywords">Keywords (comma separated)</Label>
                  <Textarea
                    id="keywords"
                    name="keywords"
                    placeholder="binance kyb, okx card, ..."
                    required
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit">Create Group</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-2">
        {groups.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            No groups yet. Create your first group to start monitoring tweets.
          </div>
        ) : (
          groups.map((group) => (
            <div
              key={group.name}
              className="flex justify-between items-center p-3 border rounded-md"
            >
              <div>
                <div className="font-medium">{group.name}</div>
                <div className="text-sm text-muted-foreground">
                  {group.keywords}
                </div>
              </div>
              <AlertDialog
                open={deleteDialogOpen && groupToDelete === group.name}
                onOpenChange={(open) => {
                  setDeleteDialogOpen(open);
                  if (!open) setGroupToDelete(null);
                }}
              >
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setGroupToDelete(group.name)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will delete the group "{group.name}" and all its
                      tweets. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => handleDeleteGroup(group.name)}
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
