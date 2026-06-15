import "./style.css";
import { Sidebar } from "./Sidebar";
import { ReadingArea } from "./ReadingArea";
import { SubmitFloat } from "./SubmitFloat";

export function App() {
  const { data } = useDocument();
  return (
    <div className="app">
      <Sidebar
        sections={data.sections}
        comments={data.comments}
      />
      <ReadingArea
        blocks={data.blocks}
        comments={data.comments}
      />
      <SubmitFloat pending={data.pendingCount} />
    </div>
  );
}
