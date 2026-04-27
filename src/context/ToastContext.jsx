import { createContext, useContext, useState, useCallback } from 'react';

const Ctx = createContext(null);

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const [tid,   setTid]   = useState(null);

  const show = useCallback((msg, type = 'default') => {
    if (tid) clearTimeout(tid);
    setToast({ msg, type });
    setTid(setTimeout(() => setToast(null), 2600));
  }, [tid]);

  return (
    <Ctx.Provider value={show}>
      {children}
      {toast && (
        <div className={`toast ${toast.type}`}>{toast.msg}</div>
      )}
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
