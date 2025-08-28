'use client';

import { useState, useRef, useEffect } from 'react';
import { User, X } from 'lucide-react';

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role?: string;
}

interface UserMentionsProps {
  users: User[];
  selectedUsers: User[];
  onUsersChange: (users: User[]) => void;
  placeholder?: string;
  className?: string;
}

export function UserMentions({ 
  users, 
  selectedUsers, 
  onUsersChange, 
  placeholder = "Type @ to mention users...",
  className = ""
}: UserMentionsProps) {
  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (inputValue.startsWith('@')) {
      const searchTerm = inputValue.slice(1).toLowerCase();
      const filtered = users.filter(user => 
        !selectedUsers.find(selected => selected.id === user.id) &&
        (user.firstName.toLowerCase().includes(searchTerm) ||
         user.lastName.toLowerCase().includes(searchTerm) ||
         user.email.toLowerCase().includes(searchTerm))
      );
      setFilteredUsers(filtered);
      setShowSuggestions(filtered.length > 0);
      setSelectedIndex(0);
    } else {
      setShowSuggestions(false);
      setFilteredUsers([]);
    }
  }, [inputValue, users, selectedUsers]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showSuggestions && filteredUsers.length > 0) {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => 
            prev < filteredUsers.length - 1 ? prev + 1 : 0
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => 
            prev > 0 ? prev - 1 : filteredUsers.length - 1
          );
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredUsers[selectedIndex]) {
            selectUser(filteredUsers[selectedIndex]);
          }
          break;
        case 'Escape':
          setShowSuggestions(false);
          break;
      }
    }
  };

  const selectUser = (user: User) => {
    const newSelectedUsers = [...selectedUsers, user];
    onUsersChange(newSelectedUsers);
    setInputValue('');
    setShowSuggestions(false);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const removeUser = (userId: string) => {
    const newSelectedUsers = selectedUsers.filter(user => user.id !== userId);
    onUsersChange(newSelectedUsers);
  };

  const handleInputFocus = () => {
    if (inputValue.startsWith('@') && filteredUsers.length > 0) {
      setShowSuggestions(true);
    }
  };

  const handleInputBlur = () => {
    // Delay hiding suggestions to allow for clicks
    setTimeout(() => {
      setShowSuggestions(false);
    }, 200);
  };

  return (
    <div className={`relative ${className}`}>
      <div className="flex flex-wrap items-center gap-2 p-3 border border-gray-300 rounded-lg focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent">
        {/* Selected Users */}
        {selectedUsers.map((user) => (
          <div
            key={user.id}
            className="flex items-center space-x-1 bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm"
          >
            <User className="h-3 w-3" />
            <span>{user.firstName} {user.lastName}</span>
            <button
              type="button"
              onClick={() => removeUser(user.id)}
              className="ml-1 hover:bg-blue-200 rounded-full p-0.5"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        
        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          placeholder={selectedUsers.length === 0 ? placeholder : ""}
          className="flex-1 min-w-32 outline-none bg-transparent"
        />
      </div>

      {/* Suggestions Dropdown */}
      {showSuggestions && filteredUsers.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto"
        >
          {filteredUsers.map((user, index) => (
            <button
              key={user.id}
              type="button"
              onClick={() => selectUser(user)}
              className={`w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center space-x-3 ${
                index === selectedIndex ? 'bg-blue-50 border-l-2 border-blue-500' : ''
              }`}
            >
              <div className="flex-shrink-0">
                <div className="h-8 w-8 bg-gray-200 rounded-full flex items-center justify-center">
                  <User className="h-4 w-4 text-gray-600" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">
                  {user.firstName} {user.lastName}
                </p>
                <p className="text-xs text-gray-500 truncate">{user.email}</p>
                {user.role && (
                  <p className="text-xs text-gray-400 capitalize">
                    {user.role.replace('_', ' ').toLowerCase()}
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
