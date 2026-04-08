import type { BookRecord } from "@/lib/types";

type Props = {
  rows: BookRecord[];
  deletingId?: string;
  onDelete: (id: string) => void;
};

export function ResultsTable({ rows, deletingId, onDelete }: Props) {
  if (rows.length === 0) {
    return <p className="empty-message">該当する書籍はありません。</p>;
  }

  return (
    <div className="table-area">
      <p className="table-scroll-hint">左右にスクロールできます</p>
      <div className="table-wrap">
        <table className="book-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>登録日</th>
              <th>ISBN</th>
              <th>書籍名</th>
              <th>著者名</th>
              <th>出版社名</th>
              <th>発売日</th>
              <th>領域</th>
              <th>科目</th>
              <th>備考</th>
              <th>削除</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.id}-${row.isbn}-${row.createdAt}`}>
                <td>{row.id}</td>
                <td>{row.createdAt}</td>
                <td>{row.isbn}</td>
                <td>{row.title}</td>
                <td>{row.author}</td>
                <td>{row.publisher}</td>
                <td>{row.publishedDate}</td>
                <td>{row.domain}</td>
                <td>{row.subject}</td>
                <td>{row.note}</td>
                <td>
                  <button
                    type="button"
                    className="delete-button"
                    onClick={() => onDelete(row.id)}
                    disabled={deletingId === row.id}
                  >
                    {deletingId === row.id ? "削除中..." : "削除"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
