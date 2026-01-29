import { useState, useRef, useEffect } from 'react';
import { getTaskStatus } from '../api/endpoints'; // 假设你定义了这个API

export function useTaskPoller() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const pollTimer = useRef(null);

  const startPolling = async (taskId, onSuccess) => {
    setLoading(true);
    setError(null);

    const checkStatus = async () => {
      try {
        const res = await getTaskStatus(taskId); // 调用 GET /api/tasks/{id}
        const { status, result, error: taskError } = res.data;

        if (status === 'success') {
          setLoading(false);
          onSuccess(result); // 任务完成，回调数据
        } else if (status === 'failed') {
          setLoading(false);
          setError(taskError || 'Task failed');
        } else {
          // pending 或 processing，继续轮询
          pollTimer.current = setTimeout(checkStatus, 2000); // 2秒查一次
        }
      } catch (err) {
        setLoading(false);
        setError(err.message);
      }
    };

    checkStatus();
  };

  // 组件卸载时清理定时器
  useEffect(() => {
    return () => clearTimeout(pollTimer.current);
  }, []);

  return { startPolling, loading, error };
}