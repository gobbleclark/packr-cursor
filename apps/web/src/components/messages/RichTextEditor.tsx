'use client';

import { useState, useRef, useEffect } from 'react';
import { 
  Bold, 
  Italic, 
  Underline, 
  List, 
  ListOrdered, 
  Link, 
  Quote,
  Code,
  Type,
  AlignLeft,
  AlignCenter,
  AlignRight
} from 'lucide-react';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
}

export function RichTextEditor({ 
  value, 
  onChange, 
  placeholder = "Enter your message...",
  className = "",
  minHeight = "200px"
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [isEditorFocused, setIsEditorFocused] = useState(false);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  const handleInput = () => {
    if (editorRef.current) {
      const content = editorRef.current.innerHTML;
      onChange(content);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Handle common keyboard shortcuts
    if (e.ctrlKey || e.metaKey) {
      switch (e.key) {
        case 'b':
          e.preventDefault();
          execCommand('bold');
          break;
        case 'i':
          e.preventDefault();
          execCommand('italic');
          break;
        case 'u':
          e.preventDefault();
          execCommand('underline');
          break;
      }
    }
  };

  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    if (editorRef.current) {
      editorRef.current.focus();
      handleInput();
    }
  };

  const formatButton = (command: string, icon: React.ReactNode, value?: string) => (
    <button
      type="button"
      onClick={() => execCommand(command, value)}
      className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
      title={command}
    >
      {icon}
    </button>
  );

  const insertLink = () => {
    const url = prompt('Enter URL:');
    if (url) {
      execCommand('createLink', url);
    }
  };

  return (
    <div className={`border border-gray-300 rounded-lg overflow-hidden ${className} ${isEditorFocused ? 'ring-2 ring-blue-500 border-transparent' : ''}`}>
      {/* Toolbar */}
      <div className="flex items-center space-x-1 p-2 bg-gray-50 border-b border-gray-200">
        {formatButton('bold', <Bold className="h-4 w-4" />)}
        {formatButton('italic', <Italic className="h-4 w-4" />)}
        {formatButton('underline', <Underline className="h-4 w-4" />)}
        
        <div className="w-px h-6 bg-gray-300 mx-2" />
        
        {formatButton('insertUnorderedList', <List className="h-4 w-4" />)}
        {formatButton('insertOrderedList', <ListOrdered className="h-4 w-4" />)}
        
        <div className="w-px h-6 bg-gray-300 mx-2" />
        
        <button
          type="button"
          onClick={insertLink}
          className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
          title="Insert Link"
        >
          <Link className="h-4 w-4" />
        </button>
        
        {formatButton('formatBlock', <Quote className="h-4 w-4" />, 'blockquote')}
        {formatButton('formatBlock', <Code className="h-4 w-4" />, 'pre')}
        
        <div className="w-px h-6 bg-gray-300 mx-2" />
        
        {formatButton('justifyLeft', <AlignLeft className="h-4 w-4" />)}
        {formatButton('justifyCenter', <AlignCenter className="h-4 w-4" />)}
        {formatButton('justifyRight', <AlignRight className="h-4 w-4" />)}
        
        <div className="flex-1" />
        
        <select
          onChange={(e) => execCommand('formatBlock', e.target.value)}
          className="text-sm border-none bg-transparent focus:outline-none"
          defaultValue=""
        >
          <option value="">Normal</option>
          <option value="h1">Heading 1</option>
          <option value="h2">Heading 2</option>
          <option value="h3">Heading 3</option>
          <option value="h4">Heading 4</option>
          <option value="h5">Heading 5</option>
          <option value="h6">Heading 6</option>
        </select>
      </div>

      {/* Editor */}
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onFocus={() => setIsEditorFocused(true)}
        onBlur={() => setIsEditorFocused(false)}
        className="p-4 focus:outline-none prose max-w-none"
        style={{ minHeight }}
        data-placeholder={placeholder}
        suppressContentEditableWarning={true}
      />

      <style jsx>{`
        [contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: #9CA3AF;
          pointer-events: none;
        }
        
        [contenteditable] h1 {
          font-size: 2em;
          font-weight: bold;
          margin: 0.67em 0;
        }
        
        [contenteditable] h2 {
          font-size: 1.5em;
          font-weight: bold;
          margin: 0.75em 0;
        }
        
        [contenteditable] h3 {
          font-size: 1.17em;
          font-weight: bold;
          margin: 0.83em 0;
        }
        
        [contenteditable] blockquote {
          border-left: 4px solid #E5E7EB;
          padding-left: 1rem;
          margin: 1rem 0;
          font-style: italic;
          color: #6B7280;
        }
        
        [contenteditable] pre {
          background-color: #F3F4F6;
          padding: 1rem;
          border-radius: 0.375rem;
          font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
          font-size: 0.875em;
          overflow-x: auto;
        }
        
        [contenteditable] ul, [contenteditable] ol {
          padding-left: 2rem;
          margin: 1rem 0;
        }
        
        [contenteditable] li {
          margin: 0.5rem 0;
        }
        
        [contenteditable] a {
          color: #3B82F6;
          text-decoration: underline;
        }
        
        [contenteditable] a:hover {
          color: #1D4ED8;
        }
      `}</style>
    </div>
  );
}
