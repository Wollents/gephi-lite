import { FC, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { FaPlay, FaTimes } from "react-icons/fa";

import { Loader } from "../../../../components/Loader";
import { Modal } from "../../../../components/modals";
import { ModalProps } from "../../../../core/modals/types";
import { useNotifications } from "../../../../core/notifications";
import { useImportActions } from "../../../../core/context/dataContexts";

interface ModelData {
  models: Array<{ id: string; name: string }>;
  datasets: Array<{ id: string; name: string }>;
}

export const ModalRun: FC<ModalProps<unknown>> = ({ cancel }) => {
  const { importFile } = useImportActions();
  const { notify } = useNotifications();
  const { t } = useTranslation();
  const [modelData, setModelData] = useState<ModelData>({ models: [], datasets: [] });
  const [selectedModel, setSelectedModel] = useState("");
  const [selectedDataset, setSelectedDataset] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

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



  const handleSubmit = async () => {
    if (!selectedModel || !selectedDataset) {
      notify({
        type: "warning",
        message: t("graph.run.select_both").toString(),
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("http://localhost:8080/graph/run/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          modelId: selectedModel,
          datasetId: selectedDataset,
        }),
      });

      if (!response.ok) throw new Error("Request failed");

      const blob = await response.blob();
      const fileReader = new FileReader();
      const filename = `${selectedDataset}_result.gexf`;
      const file = new File([blob], filename, { type: "application/gexf" });

      fileReader.onerror = (event) => {
        console.error('FileReader error:', event);
        notify({ type: "error", message: t("menu.open.fetch_error").toString() });
      };
      fileReader.readAsText(blob);
      console.log("blog is")
      console.log(blob)
      console.log("file is")
      console.log(file)
      if(file){
        try {
            await importFile({
              type: "local",
              filename: file.name,
              updatedAt: new Date(file.lastModified),
              size: file.size,
              source: file,
            });
            notify({
              type: "success",
              message: t("graph.open.local.success", { filename: file.name }).toString(),
            });
          } catch (e) {
            console.error(e);
            notify({
              type: "error",
              message: t("graph.open.local.error") as string,
              title: t("gephi-lite.title") as string,
            });
          }
      }
    } catch (error) {
      setIsSubmitting(false);
      console.error(error);
      notify({
        type: "error",
        message: t("graph.run.start_error").toString(),
        title: t("gephi-lite.title").toString(),
      });
    }finally {
      setIsSubmitting(false);
      cancel();
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
              <div className="col">
                <label className="form-label">{t("graph.run.select_dataset")}</label>
                <select
                  className="form-select"
                  value={selectedDataset}
                  onChange={(e) => setSelectedDataset(e.target.value)}
                  disabled={isSubmitting}
                >
                  <option value="">{t("graph.run.select_option")}</option>
                  {modelData.datasets.map((dataset) => (
                    <option key={dataset.id} value={dataset.id}>
                      {dataset.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
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
          disabled={!selectedModel || !selectedDataset || isSubmitting}
          onClick={handleSubmit}
        >
          {isSubmitting ? (
            <Loader/>
          ) : (
            <FaPlay className="me-1" />
          )}
          {t("graph.run.start").toString()}
        </button>
      </>
    </Modal>
  );
};