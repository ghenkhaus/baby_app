import { useState, useEffect } from "react";
import { DEFAULT_CATEGORIES } from "../utils/categories";

interface CategoryManagerProps {
  categories: string[];
  onAddCategory: (name: string) => void;
  onRemoveCategory: (name: string) => boolean | void | Promise<boolean | void>;
  onClose: () => void;
}

export function CategoryManager({
  categories,
  onAddCategory,
  onRemoveCategory,
  onClose,
}: CategoryManagerProps) {
  const [newCategory, setNewCategory] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  const handleAdd = () => {
    const trimmed = newCategory.trim();
    if (!trimmed) return;
    if (categories.includes(trimmed)) {
      setError("Category already exists");
      return;
    }
    onAddCategory(trimmed);
    setNewCategory("");
    setError("");
  };

  const handleRemove = async (name: string) => {
    const result = await onRemoveCategory(name);
    if (result === false) {
      setError(`Cannot remove "${name}" — it has items assigned to it`);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-[fadeIn_150ms_ease-out]"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl shadow-slate-900/20 ring-1 ring-slate-900/5 w-full max-w-md max-h-[80vh] overflow-y-auto animate-[scaleIn_160ms_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <h2 className="text-xl font-bold text-slate-900 mb-4 tracking-tight">
            Manage Categories
          </h2>

          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={newCategory}
              onChange={(e) => {
                setNewCategory(e.target.value);
                setError("");
              }}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              placeholder="New category name..."
              className="flex-1 px-3.5 py-2 text-sm border border-slate-200 rounded-xl bg-white text-slate-800 placeholder:text-slate-400 hover:border-slate-300 focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-colors"
              autoFocus
            />
            <button
              onClick={handleAdd}
              className="px-4 py-2 text-sm font-semibold text-white bg-gradient-to-b from-indigo-500 to-indigo-600 rounded-xl hover:from-indigo-500 hover:to-indigo-700 transition-all shadow-sm shadow-indigo-600/25 ring-1 ring-inset ring-white/10"
            >
              Add
            </button>
          </div>

          {error && (
            <p className="text-xs text-rose-600 mb-3 px-1">{error}</p>
          )}

          <ul className="space-y-0.5">
            {categories.map((cat) => {
              const isDefault = DEFAULT_CATEGORIES.includes(cat);
              return (
                <li
                  key={cat}
                  className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-slate-50 transition-colors"
                >
                  <span className="text-sm text-slate-800">
                    {cat}
                    {isDefault && (
                      <span className="text-xs text-slate-400 ml-2">
                        (default)
                      </span>
                    )}
                  </span>
                  {!isDefault && (
                    <button
                      onClick={() => handleRemove(cat)}
                      className="text-xs font-medium text-rose-500 hover:text-rose-700 hover:bg-rose-50 px-2 py-1 rounded-md transition-colors"
                    >
                      Remove
                    </button>
                  )}
                </li>
              );
            })}
          </ul>

          <div className="flex justify-end mt-6">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
