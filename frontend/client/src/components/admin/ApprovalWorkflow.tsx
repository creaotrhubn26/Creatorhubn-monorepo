import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  MessageSquare, 
  User, 
  Send,
  AlertCircle,
  ChevronRight,
  Eye
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { QUERY_KEYS } from '@/lib/queryKeys';
import { useToast } from '@/hooks/use-toast';

export type ApprovalStatus = 'pending' | 'in_review' | 'approved' | 'rejected' | 'published';
export type ApprovalRole = 'creator' | 'reviewer' | 'approver';

interface ApprovalRequest {
  id: string;
  contentType: 'social' | 'email' | 'announcement';
  contentId: string;
  title: string;
  status: ApprovalStatus;
  createdBy: {
    id: string;
    name: string;
    role: string;
  };
  currentStage: number;
  totalStages: number;
  createdAt: string;
  updatedAt: string;
  preview?: any;
}

interface ApprovalStage {
  id: string;
  requestId: string;
  stage: number;
  role: ApprovalRole;
  assignedTo?: {
    id: string;
    name: string;
  };
  status: ApprovalStatus;
  comments?: string;
  reviewedAt?: string;
  reviewedBy?: {
    id: string;
    name: string;
  };
}

interface ApprovalComment {
  id: string;
  requestId: string;
  userId: string;
  userName: string;
  userRole: string;
  comment: string;
  createdAt: string;
}

export default function ApprovalWorkflow() {
  const [selectedTab, setSelectedTab] = useState<'pending' | 'in_review' | 'approved' | 'all'>('pending');
  const [selectedRequest, setSelectedRequest] = useState<ApprovalRequest | null>(null);
  const [reviewComment, setReviewComment] = useState('');
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch approval requests
  const { data: requests = [], isLoading } = useQuery({
    queryKey: [...QUERY_KEYS.APPROVALS, selectedTab],
    queryFn: async () => {
      const params = selectedTab !== 'all' ? `?status=${selectedTab}` : ',';
      const res = await fetch(`/api/approvals${params}`);
      if (!res.ok) throw new Error('Failed to fetch approval requests, ');
      return res.json() as Promise<ApprovalRequest[]>;
    }
  });

  // Fetch stages for selected request
  const { data: stages = [] } = useQuery({
    queryKey: [...QUERY_KEYS.APPROVAL_STAGES, selectedRequest?.id],
    queryFn: async () => {
      if (!selectedRequest?.id) return [];
      const res = await fetch(`/api/approvals/${selectedRequest.id}/stages`);
      if (!res.ok) throw new Error('Failed to fetch approval stages, ');
      return res.json() as Promise<ApprovalStage[]>;
    },
    enabled: !!selectedRequest?.id
  });

  // Fetch comments for selected request
  const { data: comments = [] } = useQuery({
    queryKey: [...QUERY_KEYS.APPROVAL_COMMENTS, selectedRequest?.id],
    queryFn: async () => {
      if (!selectedRequest?.id) return [];
      const res = await fetch(`/api/approvals/${selectedRequest.id}/comments`);
      if (!res.ok) throw new Error('Failed to fetch comments');
      return res.json() as Promise<ApprovalComment[]>;
    },
    enabled: !!selectedRequest?.id
  });

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: async ({ requestId, comment }: { requestId: string; comment?: string }) => {
      const res = await fetch(`/api/approvals/${requestId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify({ comment })
      });
      if (!res.ok) throw new Error('Failed to approve request');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.APPROVALS });
      toast({
        title: 'Content approved',
        description: 'The content has been approved successfully.'
      });
      setReviewComment('');
      setSelectedRequest(null);
    }
  });

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: async ({ requestId, comment }: { requestId: string; comment: string }) => {
      const res = await fetch(`/api/approvals/${requestId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify({ comment })
      });
      if (!res.ok) throw new Error('Failed to reject request');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.APPROVALS });
      toast({
        title: 'Content rejected',
        description: 'The content has been rejected with feedback.'
      });
      setReviewComment(', ');
      setSelectedRequest(null);
    }
  });

  // Request changes mutation
  const requestChangesMutation = useMutation({
    mutationFn: async ({ requestId, comment }: { requestId: string; comment: string }) => {
      const res = await fetch(`/api/approvals/${requestId}/request-changes`, {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify({ comment })
      });
      if (!res.ok) throw new Error('Failed to request changes');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.APPROVALS });
      toast({
        title: 'Changes requested',
        description: 'Feedback has been sent to the creator.'
      });
      setReviewComment(', ');
      setSelectedRequest(null);
    }
  });

  // Add comment mutation
  const addCommentMutation = useMutation({
    mutationFn: async ({ requestId, comment }: { requestId: string; comment: string }) => {
      const res = await fetch(`/api/approvals/${requestId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify({ comment })
      });
      if (!res.ok) throw new Error('Failed to add comment');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.APPROVAL_COMMENTS, selectedRequest?.id] });
      setReviewComment(', ');
    }
  });

  const getStatusBadge = (status: ApprovalStatus) => {
    const variants = {
      pending: { variant: 'secondary' as const, icon: Clock, text: 'Pending' },
      in_review: { variant: 'default' as const, icon: Eye, text: 'In Review' },
      approved: { variant: 'default' as const, icon: CheckCircle, text: 'Approved' },
      rejected: { variant: 'destructive' as const, icon: XCircle, text: 'Rejected' },
      published: { variant: 'default' as const, icon: CheckCircle, text: 'Published' }
    };

    const config = variants[status];
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {config.text}
      </Badge>
    );
  };

  const getContentTypeColor = (type: string) => {
    const colors = {
      social: 'bg-blue-500',
      email: 'bg-purple-500',
      announcement: 'bg-green-500'
    };
    return colors[type as keyof typeof colors] || 'bg-gray-500';
  };

  const handleApprove = () => {
    if (selectedRequest) {
      approveMutation.mutate({
        requestId: selectedRequest.id,
        comment: reviewComment || undefined
      });
    }
  };

  const handleReject = () => {
    if (selectedRequest && reviewComment) {
      rejectMutation.mutate({
        requestId: selectedRequest.id,
        comment: reviewComment
      });
    }
  };

  const handleRequestChanges = () => {
    if (selectedRequest && reviewComment) {
      requestChangesMutation.mutate({
        requestId: selectedRequest.id,
        comment: reviewComment
      });
    }
  };

  const handleAddComment = () => {
    if (selectedRequest && reviewComment) {
      addCommentMutation.mutate({
        requestId: selectedRequest.id,
        comment: reviewComment
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Approval Workflow</h2>
        <p className="text-muted-foreground">
          Review and approve content before publishing
        </p>
      </div>

      {/* Tabs */}
      <Tabs value={selectedTab} onValueChange={(v) => setSelectedTab(v as any)}>
        <TabsList>
          <TabsTrigger value="pending">
            Pending
            {requests.filter(r => r.status === 'pending').length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {requests.filter(r => r.status === 'pending').length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="in_review">
            In Review
            {requests.filter(r => r.status === 'in_review').length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {requests.filter(r => r.status === 'in_review').length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>

        <TabsContent value={selectedTab} className="space-y-4">
          {isLoading ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Loading requests...
              </CardContent>
            </Card>
          ) : requests.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No approval requests found
              </CardContent>
            </Card>
          ) : (
            requests.map((request) => (
              <Card key={request.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <div className={`h-2 w-2 rounded-full ${getContentTypeColor(request.contentType)}`} />
                        <CardTitle className="text-lg">{request.title}</CardTitle>
                      </div>
                      <CardDescription className="flex items-center gap-4">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {request.createdBy.name}
                        </span>
                        <span>
                          {new Date(request.createdAt).toLocaleDateString()}
                        </span>
                        <span className="capitalize">
                          {request.contentType}
                        </span>
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(request.status)}
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setSelectedRequest(request)}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            Review
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>{request.title}</DialogTitle>
                            <DialogDescription>
                              Review and provide feedback on this content
                            </DialogDescription>
                          </DialogHeader>

                          <div className="space-y-6">
                            {/* Approval stages */}
                            <div>
                              <h4 className="font-semibold mb-3">Approval Progress</h4>
                              <div className="flex items-center gap-2">
                                {stages.map((stage, idx) => (
                                  <React.Fragment key={stage.id}>
                                    <div className="flex items-center gap-2">
                                      <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
                                        stage.status === 'approved' 
                                          ? 'bg-green-500 text-white' 
                                          : stage.status === 'rejected'
                                          ? 'bg-red-500 text-white' : 'bg-gray-200 text-gray-600'
                                      }`}>
                                        {stage.status === 'approved' ? (
                                          <CheckCircle className="h-4 w-4" />
                                        ) : stage.status === 'rejected' ? (
                                          <XCircle className="h-4 w-4" />
                                        ) : (
                                          idx + 1
                                        )}
                                      </div>
                                      <div className="text-sm">
                                        <div className="font-medium capitalize">{stage.role}</div>
                                        {stage.assignedTo && (
                                          <div className="text-xs text-muted-foreground">
                                            {stage.assignedTo.name}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    {idx < stages.length - 1 && (
                                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                    )}
                                  </React.Fragment>
                                ))}
                              </div>
                            </div>

                            {/* Content preview */}
                            <div>
                              <h4 className="font-semibold mb-3">Content Preview</h4>
                              <Card>
                                <CardContent className="py-4">
                                  {request.preview ? (
                                    <pre className="whitespace-pre-wrap text-sm">
                                      {JSON.stringify(request.preview, null, 2)}
                                    </pre>
                                  ) : (
                                    <p className="text-muted-foreground">No preview available</p>
                                  )}
                                </CardContent>
                              </Card>
                            </div>

                            {/* Comments */}
                            <div>
                              <h4 className="font-semibold mb-3">Comments & Feedback</h4>
                              <div className="space-y-3 mb-4">
                                {comments.length === 0 ? (
                                  <p className="text-sm text-muted-foreground">No comments yet</p>
                                ) : (
                                  comments.map((comment) => (
                                    <div key={comment.id} className="flex gap-3">
                                      <Avatar>
                                        <AvatarFallback>
                                          {comment.userName.slice(0, 2).toUpperCase()}
                                        </AvatarFallback>
                                      </Avatar>
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                          <span className="font-medium text-sm">{comment.userName}</span>
                                          <Badge variant="outline" className="text-xs">
                                            {comment.userRole}
                                          </Badge>
                                          <span className="text-xs text-muted-foreground">
                                            {new Date(comment.createdAt).toLocaleString()}
                                          </span>
                                        </div>
                                        <p className="text-sm">{comment.comment}</p>
                                      </div>
                                    </div>
                                  ))
                                )}
                              </div>

                              <div className="space-y-2">
                                <Textarea
                                  placeholder="Add your feedback or comments..."
                                  value={reviewComment}
                                  onChange={(e) => setReviewComment(e.target.value)}
                                  rows={3}
                                />
                                <div className="flex gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleAddComment}
                                    disabled={!reviewComment}
                                  >
                                    <MessageSquare className="h-4 w-4 mr-2" />
                                    Add Comment
                                  </Button>
                                </div>
                              </div>
                            </div>

                            {/* Actions */}
                            {request.status === 'pending' || request.status ==='in_review' ? (
                              <div className="flex gap-2 pt-4 border-t">
                                <Button
                                  onClick={handleApprove}
                                  disabled={approveMutation.isPending}
                                  className="flex-1"
                                >
                                  <CheckCircle className="h-4 w-4 mr-2" />
                                  Approve
                                </Button>
                                <Button
                                  variant="outline"
                                  onClick={handleRequestChanges}
                                  disabled={!reviewComment || requestChangesMutation.isPending}
                                  className="flex-1"
                                >
                                  <AlertCircle className="h-4 w-4 mr-2" />
                                  Request Changes
                                </Button>
                                <Button
                                  variant="destructive"
                                  onClick={handleReject}
                                  disabled={!reviewComment || rejectMutation.isPending}
                                  className="flex-1"
                                >
                                  <XCircle className="h-4 w-4 mr-2" />
                                  Reject
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 py-4 px-4 bg-muted rounded-md">
                                <AlertCircle className="h-4 w-4" />
                                <span className="text-sm">
                                  This request has been {request.status}
                                </span>
                              </div>
                            )}
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>Stage {request.currentStage} of {request.totalStages}</span>
                    <span>•</span>
                    <span>Updated {new Date(request.updatedAt).toLocaleDateString()}</span>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
