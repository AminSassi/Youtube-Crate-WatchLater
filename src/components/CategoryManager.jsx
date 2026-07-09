import { useState, memo, useCallback } from "react";
import { Icons } from "../utils/icons";

export const CategoryManager = memo(function CategoryManager({ categories, onAdd, onDelete }) {
  const [showInput, setShowInput] = useState(false);
  const [name, setName] = useState("");

  const handleAdd = useCallback(() => {
    if (name.trim()) {
      onAdd(name.trim());
      setName("");
      setShowInput(false);
    }
  }, [name, onAdd]);

  const handleCancel = useCallback(() => {
    setShowInput(false);
    setName("");
  }, []);

  return (
    <div style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
      <span style={{ fontSize: 11, color: "#40405a", display: "flex", alignItems: "center", gap: 4 }}>
        <Icons.folder /> Categories
      </span>
      {categories.map(cat => (
        <div key={cat.id} style={{ display: "flex", alignItems: "center" }}>
          <button
            className="cat-pill"
            style={{
              background: "#0f0f1a",
              border: "1px solid #1c1c2e",
              color: "#70709a",
            }}
          >
            <span style={{
              width: 6, height: 6, borderRadius: "50%", background: cat.color,
              display: "inline-block",
            }}/>
            {cat.name}
          </button>
          <button
            className="icon-btn"
            style={{ color: "#30304a", padding: "3px" }}
            onClick={() => onDelete(cat.id)}
            aria-label={`Delete category ${cat.name}`}
          ><Icons.x /></button>
        </div>
      ))}
      {showInput ? (
        <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") handleAdd();
              if (e.key === "Escape") handleCancel();
            }}
            placeholder="Category name\u2026"
            autoFocus
            style={{
              background: "#0f0f1a", border: "1px solid #2a2a44", borderRadius: 7,
              padding: "4px 10px", color: "#d0d0e8", fontSize: 12, outline: "none",
              fontFamily: "inherit", width: 130,
            }}
            aria-label="New category name"
          />
          <button className="ghost-btn" onClick={handleAdd}>Add</button>
          <button className="icon-btn del-btn" onClick={handleCancel}><Icons.x /></button>
        </div>
      ) : (
        <button className="ghost-btn" onClick={() => setShowInput(true)}
          style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <Icons.plus /> New
        </button>
      )}
    </div>
  );
});
