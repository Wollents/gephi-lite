import { FC, useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { FaPlay, FaTimes } from "react-icons/fa";

import { Loader } from "../../../../components/Loader";
import { Modal } from "../../../../components/modals";
import { ModalProps } from "../../../../core/modals/types";
import { useNotifications } from "../../../../core/notifications";
import { DropInput } from "../../../../components/DropInput";

interface ModelData {
  models: Array<{ id: string; name: string }>;
  datasets: Array<{ id: string; name: string }>;
}
// 本地存储键名
const TASK_ID_STORAGE_KEY = "modelTrainTaskId";
const SELECTED_MODEL_KEY = "selectedModel";
const FILE_NAME_KEY = "fileName";
export const ModelTrain: FC<ModalProps<unknown>> = ({ cancel }) => {
  const { notify } = useNotifications();
  const { t } = useTranslation();
  const [modelData, setModelData] = useState<ModelData>({ models: [], datasets: [] });
  const [selectedModel, setSelectedModel] = useState("");
  const [progress, setProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);


 // 启动进度轮询
 const startProgressPolling = useCallback((taskId: string) => {
  intervalRef.current = setInterval(async () => {
    try {
      const response = await fetch(`http://localhost:8080/graph/run/progress?taskId=${taskId}`);
      const { progress, status } = await response.json();
      console.log("progress:", progress, "status:", status)
      if (status === "completed") {
        clearInterval(intervalRef.current);
        cleanupLocalStorage();
        setProgress(100);
        notify({ type: "success", message: t("graph.run.completed").toString() });
        setTimeout(() => cancel(), 2000);
        setIsSubmitting(false);
      }  else if (status == "running") {
        setProgress(progress);
      } else{
        clearInterval(intervalRef.current);
        cleanupLocalStorage();
        notify({ type: "error", message: t("graph.run.progress_error").toString() });
        setIsSubmitting(false);
      }
    } catch (error) {
      console.log("error occurs")
      cleanupLocalStorage();
      notify({ type: "error", message: t("graph.run.progress_error").toString() });
      setIsSubmitting(false);
      clearInterval(intervalRef.current);
    }
  }, 2000);
}, [cancel, notify, t]);

useEffect(() => {
  // 初始化：获取模型数据和恢复任务状态
  const fetchModelData = () => {
    fetch("http://localhost:8080/graph/run/modeldata")
      .then(response => response.json())
      .then(data => {
        setModelData(data);
        setIsLoading(false);
      })
      .catch(error => console.error('Error fetching datasets:', error));
  };

  // 检查本地存储中的任务ID
  const savedTaskId = localStorage.getItem(TASK_ID_STORAGE_KEY);
  const savedModel = localStorage.getItem(SELECTED_MODEL_KEY);
  if (savedTaskId) {
    setTaskId(savedTaskId);
    setIsSubmitting(true);
    savedModel && setSelectedModel(savedModel);
    startProgressPolling(savedTaskId);
  }
  
  fetchModelData();
  return () => {
    intervalRef.current && clearInterval(intervalRef.current);
  };
  
}, [startProgressPolling]);

 // 清理轮询和本地存储
 useEffect(() => {
  return () => {
    if (taskId) {
      clearInterval(intervalRef.current);
    }
  };
}, [taskId]);
 
 

  const intervalRef = useRef<NodeJS.Timeout>();
  const handleFileChange = (uploadFile: File|null) => {
    setFile(uploadFile || null);
    localStorage.setItem(FILE_NAME_KEY, uploadFile?.name || t("graph.open.local.dragndrop_text_train").toString());
  };



 

  const cleanupLocalStorage = () => {
    localStorage.removeItem(TASK_ID_STORAGE_KEY);
    localStorage.removeItem(SELECTED_MODEL_KEY);
    localStorage.removeItem(FILE_NAME_KEY);
  };
  // 提交训练任务
  const handleSubmit = async () => {
    if (!selectedModel || !file) {
      notify({ type: "warning", message: t("graph.run.select_both").toString() });
      return;
    }

    setIsSubmitting(true);
    const formData = new FormData();
    formData.append('modelId', selectedModel);
    formData.append('dataset_file', file);
    localStorage.setItem(SELECTED_MODEL_KEY, selectedModel);
    localStorage.setItem(FILE_NAME_KEY, file.name);

    try {
      const response = await fetch("http://localhost:8080/graph/run/start/progress", {
        method: "POST",
        body: formData,
      });
      console.log("response is ", response)
      const data = await response.json();
      if(response.status != 200){
        throw new Error(data.error + "");
      }
      console.log("getting sub data", data)

      localStorage.setItem(TASK_ID_STORAGE_KEY, data.taskId); // 保存到本地存储
      
      setTaskId(data.taskId);
      startProgressPolling(data.taskId);
    } catch (error) {
      cleanupLocalStorage();
      setIsSubmitting(false);
      notify({ type: "error", message:  " ".toString() + error});
    }
  };
  const handleCancel = () => {
    clearInterval(intervalRef.current);
    cancel();
  };

  return (
    <Modal title={t("graph.run.train").toString()} onClose={() => handleCancel()}>
      <>
        {isLoading ? (
          <Loader />
        ) : (
          <>
            <div className="row g-3 mb-4">
            <div className="col">
                <label className="form-label">{t("graph.run.select_model")}</label>
                <select
                  className="form-select"
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  disabled={isSubmitting}
                >
                  <option value="">{t("graph.run.select_option")}</option>
                  {modelData.models.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name}
                    </option>
                  ))}
                </select>
              </div>
            <DropInput
                value={file}
                onChange={(file) => handleFileChange(file)}
                helpText={localStorage.getItem(FILE_NAME_KEY) || t("graph.open.local.dragndrop_text_train").toString()}
                accept={{ "application/mat": [".mat"] }} // 根据MAT文件类型调整
            />
            </div>

            {progress > 0 && (
              <div className="progress mb-3">
                <div
                  className="progress-bar progress-bar-striped"
                  role="progressbar"
                  style={{ width: `${progress}%` }}
                  aria-valuenow={progress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  {progress}%
                </div>
              </div>
            )}
          </>
        )}
      </>

      <>
        <button
          title={t("common.cancel").toString()}
          className="btn btn-danger"
          onClick={() => cancel()}
          disabled={isSubmitting}
        >
          <FaTimes className="me-1" />
          {t("common.cancel").toString()}
        </button>
        <button
          className="btn btn-primary"
          disabled={!selectedModel || !file || isSubmitting}
          onClick={handleSubmit}
        >
          {isSubmitting ? (
            <Loader />
          ) : (
            <FaPlay className="me-1" />
          )}
          {t("graph.run.start").toString()}
        </button>
      </>
    </Modal>
  );
};