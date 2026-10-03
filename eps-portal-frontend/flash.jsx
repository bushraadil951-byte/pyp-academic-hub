import { createContext, useContext, useState, useCallback } from 'react';

const FlashCtx = createContext(() => {});
export const useFlash = () => useContext(FlashCtx);

// Replaces Flask's flash(): flash('Saved', 'success') | flash('Oops', 'error'); auto-dismisses after 4s.
export function FlashProvider({ children }) {
  const [items, setItems] = useState([]);
  const flash = useCallback((msg, cat = 'success') => {
    const id = Math.random().toString(36).slice(2);
    setItems((x) => [...x, { id, msg, cat }]);
    setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 4000);
  }, []);
  return (
    <FlashCtx.Provider value={flash}>
      {children}
      <div className="flash-stack" role="status">
        {items.map((i) => <div key={i.id} className={`alert alert-${i.cat === 'success' ? 'success' : 'error'}`}>{i.msg}</div>)}
      </div>
    </FlashCtx.Provider>
  );
}
