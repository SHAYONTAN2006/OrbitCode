import React, { ReactNode, useState, useRef, useEffect } from 'react';
import styled from "@emotion/styled";

interface SidebarProps {
  children: ReactNode;
  onCreateFile: (name: string) => void;
  onCreateFolder: (name: string) => void;
}

export const Sidebar = ({ children, onCreateFile, onCreateFolder }: SidebarProps) => {
  const [inputMode, setInputMode] = useState<'file' | 'folder' | null>(null);
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputMode) {
      inputRef.current?.focus();
    }
  }, [inputMode]);

  const handleConfirm = () => {
    const trimmed = inputValue.trim();
    if (trimmed) {
      if (inputMode === 'file') onCreateFile(trimmed);
      else if (inputMode === 'folder') onCreateFolder(trimmed);
    }
    setInputMode(null);
    setInputValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleConfirm();
    if (e.key === 'Escape') {
      setInputMode(null);
      setInputValue('');
    }
  };

  return (
    <Aside>
      <Header>
        <Title>EXPLORER</Title>
        <Actions>
          <IconButton
            title="New File"
            onClick={() => { setInputMode('file'); setInputValue(''); }}
          >
            {/* New File icon */}
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M9 1H3a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V5L9 1zm0 1.5L12.5 5H9V2.5zM3 14V2h5v4h4v8H3z"/>
              <path d="M8 7.5v2H6.5v1H8v2h1v-2h1.5v-1H9v-2H8z"/>
            </svg>
          </IconButton>
          <IconButton
            title="New Folder"
            onClick={() => { setInputMode('folder'); setInputValue(''); }}
          >
            {/* New Folder icon */}
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M1 3.5A1.5 1.5 0 0 1 2.5 2h2.764c.958 0 1.76.56 2.09 1.328L7.5 4H13A1.5 1.5 0 0 1 14.5 5.5v7A1.5 1.5 0 0 1 13 14H3A1.5 1.5 0 0 1 1.5 12.5v-9zm1.5 0v9A.5.5 0 0 0 3 13h10a.5.5 0 0 0 .5-.5v-7A.5.5 0 0 0 13 5H7.5L7 3.672C6.86 3.26 6.454 3 5.764 3H2.5a.5.5 0 0 0-.5.5z"/>
              <path d="M8 7.5v2H6.5v1H8v2h1v-2h1.5v-1H9v-2H8z"/>
            </svg>
          </IconButton>
          <IconButton title="Refresh" onClick={() => window.location.reload()}>
            {/* Refresh icon */}
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 3a5 5 0 1 0 5 5h-1.5A3.5 3.5 0 1 1 8 4.5V3z"/>
              <path d="M8 3V1L5 4l3 3V4.5A3.5 3.5 0 0 1 11.5 8H13A5 5 0 0 0 8 3z"/>
            </svg>
          </IconButton>
        </Actions>
      </Header>

      {inputMode && (
        <InputRow>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="#ccc" style={{ flexShrink: 0 }}>
            {inputMode === 'file'
              ? <path d="M9 1H3a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V5L9 1zm0 1.5L12.5 5H9V2.5zM3 14V2h5v4h4v8H3z"/>
              : <path d="M1 3.5A1.5 1.5 0 0 1 2.5 2h2.764c.958 0 1.76.56 2.09 1.328L7.5 4H13A1.5 1.5 0 0 1 14.5 5.5v7A1.5 1.5 0 0 1 13 14H3A1.5 1.5 0 0 1 1.5 12.5v-9zm1.5 0v9A.5.5 0 0 0 3 13h10a.5.5 0 0 0 .5-.5v-7A.5.5 0 0 0 13 5H7.5L7 3.672C6.86 3.26 6.454 3 5.764 3H2.5a.5.5 0 0 0-.5.5z"/>
            }
          </svg>
          <NameInput
            ref={inputRef}
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleConfirm}
            placeholder={inputMode === 'file' ? 'filename.js' : 'folder-name'}
          />
        </InputRow>
      )}

      {children}
    </Aside>
  );
};

const Aside = styled.aside`
  width: 250px;
  height: 100vh;
  border-right: 2px solid #242424;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 8px;
  border-bottom: 1px solid #2a2a2a;
  flex-shrink: 0;
`;

const Title = styled.span`
  font-size: 11px;
  font-weight: 600;
  color: #bbb;
  letter-spacing: 0.08em;
  user-select: none;
`;

const Actions = styled.div`
  display: flex;
  gap: 2px;
`;

const IconButton = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  color: #bbb;
  padding: 3px 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s, color 0.15s;

  &:hover {
    background: #2a2a2a;
    color: #fff;
  }
`;

const InputRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  background: #1e1e1e;
  border-bottom: 1px solid #2a2a2a;
  flex-shrink: 0;
`;

const NameInput = styled.input`
  flex: 1;
  background: #2d2d2d;
  border: 1px solid #007acc;
  color: #fff;
  font-size: 13px;
  padding: 2px 6px;
  border-radius: 3px;
  outline: none;

  &::placeholder {
    color: #666;
  }
`;

export default Sidebar;

