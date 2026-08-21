
export const Output = ({ output }: { output: string }) => {
    return <div style={{height: "40vh", background: "#111", color: "white", padding: "12px", overflow: "auto"}}>
        <pre style={{margin: 0, whiteSpace: "pre-wrap"}}>{output}</pre>
    </div>
}