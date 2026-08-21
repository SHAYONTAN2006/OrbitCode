import { useEffect, useState } from 'react';
import { Editor } from './Editor';
import { File, RemoteFile, Type } from './external/editor/utils/file-manager';
import { useSearchParams } from 'react-router-dom';
import styled from '@emotion/styled';
import { Output } from './Output';
import { TerminalComponent as Terminal } from './Terminal';
import { Socket, io } from 'socket.io-client';
import { EXECUTION_ENGINE_URI } from '../config';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
`;

const ButtonContainer = styled.div`
  display: flex;
  justify-content: flex-end; /* Aligns children (button) to the right */
  padding: 10px; /* Adds some space around the button */
`;

const Workspace = styled.div`
  display: flex;
  margin: 0;
  font-size: 16px;
  width: 100%;
`;

const LeftPanel = styled.div`
  flex: 1;
  width: 60%;
`;

const RightPanel = styled.div`
  flex: 1;
  width: 40%;
`;

function useSocket(replId: string, runnerUri: string) {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [connectionError, setConnectionError] = useState<string | null>(null);

    useEffect(() => {
        console.log(`Connecting to runner at: ${runnerUri}`);
        setConnectionError(null);
        // Connect directly to the specific container assigned to this user
        const newSocket = io(`${runnerUri}`);
        newSocket.on('connect_error', () => {
            setConnectionError(`Unable to connect to runner at ${runnerUri}`);
        });
        setSocket(newSocket);

        return () => {
            newSocket.disconnect();
        };
    }, [replId, runnerUri]);

    return { socket, connectionError };
}

export const CodingPage = () => {
    const [searchParams] = useSearchParams();
    const replId = searchParams.get('replId') ?? '';
    
    const taskInfo = searchParams.get('taskInfo');
    let runnerUri = EXECUTION_ENGINE_URI;

    if (taskInfo) {
        try {
            const parsedTaskInfo: unknown = JSON.parse(taskInfo);
            if (typeof parsedTaskInfo === 'string') {
                runnerUri = parsedTaskInfo;
            }
        } catch {
            console.error('Invalid runner task information in URL');
        }
    }
    
    const [loaded, setLoaded] = useState(false);
    const { socket, connectionError } = useSocket(replId, runnerUri);
    const [fileStructure, setFileStructure] = useState<RemoteFile[]>([]);
    const [selectedFile, setSelectedFile] = useState<File | undefined>(undefined);
    const [output, setOutput] = useState("");

    useEffect(() => {
        if (socket) {
            socket.on('loaded', ({ rootContent }: { rootContent: RemoteFile[]}) => {
                setLoaded(true);
                setFileStructure(rootContent);
            });
            socket.on('runOutput', ({ output: runOutput }: { output: string }) => {
                setOutput(runOutput);
            });
        }
    }, [socket]);

    const onSelect = (file: File) => {
        if (file.type === Type.DIRECTORY) {
            socket?.emit("fetchDir", file.path, (data: RemoteFile[]) => {
                setFileStructure(prev => {
                    const allFiles = [...prev, ...data];
                    return allFiles.filter((file, index, self) => 
                        index === self.findIndex(f => f.path === file.path)
                    );
                });
            });

        } else {
            socket?.emit("fetchContent", { path: file.path }, (data: string) => {
                file.content = data;
                setSelectedFile(file);
            });
        }
    };
    
    if (!loaded) {
        return connectionError || "Loading...";
    }

    return (
        <Container>
             <ButtonContainer>
                <button disabled={!selectedFile} onClick={() => {
                    if (selectedFile) {
                        setOutput("Running...");
                        socket?.emit("run", { path: selectedFile.path });
                    }
                }}>Run</button>
            </ButtonContainer>
            <Workspace>
                <LeftPanel>
                    <Editor socket={socket} selectedFile={selectedFile} onSelect={onSelect} files={fileStructure} />
                </LeftPanel>
                <RightPanel>
                    {output && <Output output={output} />}
                    <Terminal socket={socket} />
                </RightPanel>
            </Workspace>
        </Container>
    );
}
