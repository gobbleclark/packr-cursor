import { Card, CardContent } from "@/components/ui/card";
import { User } from "lucide-react";

interface MessageThreadProps {
  comments: any[];
}

export default function MessageThread({ comments }: MessageThreadProps) {
  if (!comments || comments.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {comments.map((commentData: any, index: number) => {
        const { comment, user } = commentData;
        
        return (
          <Card key={comment.id} className="ml-8">
            <CardContent className="pt-4">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  {user?.profileImageUrl ? (
                    <img 
                      className="h-8 w-8 rounded-full object-cover" 
                      src={user.profileImageUrl} 
                      alt="User avatar"
                    />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-gray-300 flex items-center justify-center">
                      <User className="h-4 w-4 text-gray-600" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm">
                    <span className="font-medium text-gray-900">
                      {user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : user?.email || 'Unknown User'}
                    </span>
                    <span className="text-gray-500"> • {new Date(comment.createdAt).toLocaleDateString()} at {new Date(comment.createdAt).toLocaleTimeString()}</span>
                  </div>
                  <div className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">
                    {comment.content}
                  </div>
                  
                  {/* Comment Attachments */}
                  {comment.attachments && comment.attachments.length > 0 && (
                    <div className="mt-3">
                      <div className="flex items-center space-x-2">
                        <i className="fas fa-paperclip text-gray-400"></i>
                        <div className="flex space-x-2">
                          {comment.attachments.map((attachment: any, attachIndex: number) => (
                            <span 
                              key={attachIndex}
                              className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-800 cursor-pointer hover:bg-gray-200"
                            >
                              {attachment.name || `Attachment ${attachIndex + 1}`}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
