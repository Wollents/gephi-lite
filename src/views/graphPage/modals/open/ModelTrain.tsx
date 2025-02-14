import { FC, useState, useEffect, useRef } from "react";
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
  useEffect(() => {
    // 模拟网络请求
    fetch("http://localhost:8080/graph/run/modeldata")
      .then(response => response.json())
      .then(data => {
          setModelData(data);
          setIsLoading(false);
          console.log(data);
      })
      .catch(error => console.error('Error fetching datasets:', error));
  }, []);

  useEffect(() => {
    // 清理进度轮询
    return () => {
      if (taskId) {
        clearInterval(intervalRef.current);
      }
    };
  }, [taskId]);

  const intervalRef = useRef<NodeJS.Timeout>();
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setFile(file || null);
  };

  const startProgressPolling = (taskId: string) => {
    intervalRef.current = setInterval(async () => {
      try {
        const response = await fetch(`http://localhost:8080/graph/run/progress?taskId=${taskId}`);
        const { progress, status } = await response.json();
        
        if (status === "completed") {
          setProgress(100);
          clearInterval(intervalRef.current);
          notify({
            type: "success",
            message: t("graph.run.completed").toString(),
          });
          setTimeout(() => cancel(), 2000);
        } else if (status === "error") {
          clearInterval(intervalRef.current);
          notify({
            type: "error",
            message: t("graph.run.progress_error").toString(),
          });
        } else {
          setProgress(progress);
        }
      } catch (error) {
        clearInterval(intervalRef.current);
        notify({
          type: "error",
          message: t("graph.run.progress_error").toString(),
        });
      }
    }, 1000);
  };

  const handleSubmit = async () => {
    if (!selectedModel || !file) {
      notify({
        type: "warning",
        message: t("graph.run.select_both").toString(),
      });
      return;
    }

    setIsSubmitting(true);
    console.log("file is ", file)
    try {
      const formData = new FormData();
      formData.append('modelId', selectedModel);
      formData.append('dataset_file', file);
      console.log("formData is ", file)
      fetch("http://localhost:8080/graph/run/start/progress", {
        method: "POST",
        body: formData,
      }).then(response => response.json())
      .then(data => {
        console.log("data is ")
        console.log(data)
        const taskId = data.taskId
        setTaskId(taskId);
        startProgressPolling(taskId);
      })
      .catch(error => console.error('Error fetching datasets:', error));
      
      
      
    } catch (error) {
      setIsSubmitting(false);
      notify({
        type: "error",
        message: t("graph.run.start_error").toString(),
        title: t("gephi-lite.title").toString(),
      });
    }
  };

  return (
    <Modal title={t("graph.run.title").toString()} onClose={() => cancel()}>
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
              <input
                  type="file"
                  className="form-control"
                  onChange={handleFileChange}
                  accept=".mat"
                  disabled={isSubmitting}
                />
            <DropInput
                value={file}
                onChange={(file) => setFile(file)}
                helpText={t("graph.open.local.dragndrop_text_train").toString()}
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