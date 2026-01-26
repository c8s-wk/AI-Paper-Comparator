import axios from "axios";

const API_BASE = "http://127.0.0.1:8000/api";

export const api = {
  // 上传文件
  uploadFile: async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const response = await axios.post(`${API_BASE}/upload`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data; // { id, filename, status }
  },

  // 开始对比
  startComparison: async (sourceId: number, targetId: number) => {
    const response = await axios.post(`${API_BASE}/compare`, {
      source_doc_id: sourceId,
      target_doc_id: targetId,
    });
    return response.data; // { task_id, status }
  },

  // 获取结果 (轮询用)
  getTaskResult: async (taskId: string) => {
    const response = await axios.get(`${API_BASE}/compare/${taskId}`);
    return response.data;
  },
};
