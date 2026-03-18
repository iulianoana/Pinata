import { useState, useEffect, useCallback } from "react";
import { saveAttempt as dbSave, getAttempts, deleteAttempt as dbDelete } from "./db.js";

export function useQuizHistory() {
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    setLoading(true);
    getAttempts(50).then((data) => {
      setAttempts(data);
      setLoading(false);
    });
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const saveAttempt = useCallback(async (record) => {
    const id = await dbSave(record);
    if (id != null) {
      setAttempts((prev) => [{ ...record, id }, ...prev]);
    }
  }, []);

  const deleteAttempt = useCallback(async (id) => {
    await dbDelete(id);
    setAttempts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  return { attempts, loading, saveAttempt, deleteAttempt, refresh };
}
