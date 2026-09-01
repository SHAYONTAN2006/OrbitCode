import { useEffect, useMemo } from "react";
import Sidebar from "./external/editor/components/sidebar";
import { Code } from "./external/editor/editor/code";
import styled from "@emotion/styled";
import { File, buildFileTree, RemoteFile } from "./external/editor/utils/file-manager";
import { FileTree } from "./external/editor/components/file-tree";
import { Socket } from "socket.io-client";

// credits - https://codesandbox.io/s/monaco-tree-pec7u
export const Editor = ({
    files,
    onSelect,
    selectedFile,
    socket,
    onFileCreated,
}: {
    files: RemoteFile[];
    onSelect: (file: File) => void;
    selectedFile: File | undefined;
    socket: Socket | null;
    onFileCreated?: (file: RemoteFile) => void;
}) => {
  const rootDir = useMemo(() => {
    return buildFileTree(files);
  }, [files]);

  useEffect(() => {
    if (!selectedFile && rootDir.files.length > 0) {
      const firstFile = rootDir.files[0];
      const selectionTimeout = window.setTimeout(() => onSelect(firstFile), 0);
      return () => window.clearTimeout(selectionTimeout);
    }
  }, [selectedFile, rootDir, onSelect])

  const handleCreateFile = (name: string) => {
    // Determine parent path (root if nothing selected, else use selected file's parent)
    const parentPath = selectedFile ? selectedFile.path.substring(0, selectedFile.path.lastIndexOf('/')) : '';
    const filePath = parentPath ? `${parentPath}/${name}` : name;
    // Emit to runner: save an empty file at this path
    socket?.emit('updateContent', { path: filePath, content: '' });
    // Optimistically add to the file tree for the UI
    onFileCreated?.({ name, path: filePath, type: 'file' });
  };

  const handleCreateFolder = (name: string) => {
    const parentPath = selectedFile ? selectedFile.path.substring(0, selectedFile.path.lastIndexOf('/')) : '';
    const folderPath = parentPath ? `${parentPath}/${name}` : name;
    // Emit a .gitkeep file inside to persist the folder
    socket?.emit('updateContent', { path: `${folderPath}/.gitkeep`, content: '' });
    onFileCreated?.({ name, path: folderPath, type: 'dir' });
  };

  return (
    <div>
      <Main>
        <Sidebar onCreateFile={handleCreateFile} onCreateFolder={handleCreateFolder}>
          <FileTree
            rootDir={rootDir}
            selectedFile={selectedFile}
            onSelect={onSelect}
          />
        </Sidebar>
        <Code socket={socket} selectedFile={selectedFile} />
      </Main>
    </div>
  );
};

const Main = styled.main`
  display: flex;
`;