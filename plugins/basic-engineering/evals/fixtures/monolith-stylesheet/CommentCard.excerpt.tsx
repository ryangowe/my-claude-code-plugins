import { StatusMenu } from "./StatusMenu";

interface CommentCardProps {
  comment: Comment;
  onStatusChange: (id: string, status: Status) => void;
  onDelete: (id: string) => void;
}

export function CommentCard({ comment, onStatusChange, onDelete }: CommentCardProps) {
  const [editing, setEditing] = useState(false);

  return (
    <div className={`comment-card ${comment.status}`}>
      <div className="comment-header">
        <StatusMenu
          status={comment.status}
          onChange={(s) => onStatusChange(comment.id, s)}
        />
        <span className="comment-id">#{comment.id}</span>
        <div className="comment-actions">
          <button onClick={() => onDelete(comment.id)}>
            <svg width="14" height="14"><use href="#icon-trash" /></svg>
          </button>
        </div>
      </div>
      <div
        className="comment-body mdbody"
        dangerouslySetInnerHTML={{ __html: comment.bodyHtml }}
      />
    </div>
  );
}
