'use client';

import { TypingUser } from '../../lib/socket';

interface TypingIndicatorProps {
  users: TypingUser[];
}

export function TypingIndicator({ users }: TypingIndicatorProps) {
  if (users.length === 0) return null;

  const getTypingText = () => {
    if (users.length === 1) {
      return `${users[0].user.firstName} is typing...`;
    } else if (users.length === 2) {
      return `${users[0].user.firstName} and ${users[1].user.firstName} are typing...`;
    } else {
      return `${users[0].user.firstName} and ${users.length - 1} others are typing...`;
    }
  };

  return (
    <div className="flex items-center space-x-2 text-sm text-gray-500">
      <div className="flex space-x-1">
        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
      </div>
      <span>{getTypingText()}</span>
    </div>
  );
}

