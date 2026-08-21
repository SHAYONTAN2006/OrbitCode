import axios from 'axios';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from '@emotion/styled';
import { ORCHESTRATOR_URL } from '../config';

const SLUG_WORKS = ["car", "dog", "computer", "person", "inside", "word", "for", "please", "to", "cool", "open", "source"];

/** Styled components */
const Container = styled.div`
  padding: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const Title = styled.h1`
  color: white;
`;

const StyledInput = styled.input`
  margin: 10px 0;
  padding: 10px;
  border: 1px solid #ccc;
  border-radius: 5px;
`;

const StyledSelect = styled.select`
  margin: 10px 0;
  padding: 10px;
  border: 1px solid #ccc;
  border-radius: 5px;
`;

const StyledButton = styled.button`
  padding: 10px 20px;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  &:hover {
    background-color: #0056b3;
  }
`;

/** Helper function */
function getRandomSlug() {
    let slug = "";
    for (let i = 0; i < 3; i++) {
        slug += SLUG_WORKS[Math.floor(Math.random() * SLUG_WORKS.length)];
    }
    return slug;
}

/** Component */
export const Landing = () => {
    const [language, setLanguage] = useState("node-js");
    const [replId, setReplId] = useState(getRandomSlug());
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    return (
      <Container>
        <Title>Lepl lit</Title>
        <StyledInput
          onChange={(e) => setReplId(e.target.value)}
          type="text"
          placeholder="Repl ID"
          value={replId}
        />
        <StyledSelect
          name="language"
          id="language"
          onChange={(e) => setLanguage(e.target.value)}
        >
          <option value="node-js">Node.js</option>
          <option value="python">Python</option>
        </StyledSelect>
        <StyledButton disabled={loading} onClick={async () => {
          setLoading(true);
          try {
          const response = await axios.post(`${ORCHESTRATOR_URL}/project`, { replId, language });
            const taskInfo = response.data.taskInfo;
            console.log("Task Info from Orchestrator:", taskInfo);
            // In a full production setup with AWS ALB, taskInfo would be the URL to connect to.
            // For now, we pass the replId and assume the CodingPage knows where to route,
            // or pass the IP dynamically if your aws.ts returned it.
            setLoading(false);
            navigate(`/coding/?replId=${replId}&taskInfo=${encodeURIComponent(JSON.stringify(taskInfo))}`);
          } catch (error) {
            console.error(error);
            setLoading(false);
            alert("Failed to start project.");
          }
        }}>{loading ? "Starting ..." : "Start Coding"}</StyledButton>
      </Container>
    );
}
