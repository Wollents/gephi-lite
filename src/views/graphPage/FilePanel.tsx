import fileSaver from "file-saver";
import React, { useState, useEffect } from 'react';
import Select from "react-select";
import { FC } from "react";
import { useTranslation } from "react-i18next";
import { BsFiletypePng } from "react-icons/bs";
import { FaDownload, FaRegFolderOpen, FaRegSave } from "react-icons/fa";
import { ImFileEmpty } from "react-icons/im";
import { FaFolderOpen } from "react-icons/fa";
import { Loader } from "../../components/Loader";
import { FileIcon } from "../../components/common-icons";
import { useCloudProvider } from "../../core/cloud/useCloudProvider";
import {
  useExportActions,
  useExportState,
  useGraphDataset,
  useGraphDatasetActions,
} from "../../core/context/dataContexts";
import { useModal } from "../../core/modals";
import { useNotifications } from "../../core/notifications";
import { useConnectedUser } from "../../core/user";
import { checkFilenameExtension } from "../../utils/check";
import ConfirmModal from "./modals/ConfirmModal";
import { CloudFileModal } from "./modals/open/CloudFileModal";
import { LocalFileModal } from "./modals/open/LocalFileModal";
import { ExportPNGModal } from "./modals/save/ExportPNGModal";
import { SaveCloudFileModal } from "./modals/save/SaveCloudFileModal";
import { DEFAULT_SELECT_PROPS } from "../../components/consts";
import { useImportActions } from "../../core/context/dataContexts";

type MetricOption = {
  // id/name of the metric
  value: string;
  label: string;
};

export const FilePanel: FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const { importFile } = useImportActions();
  const { openModal } = useModal();
  const [user] = useConnectedUser();
  const { notify } = useNotifications();
  const { t } = useTranslation("translation");
  const { origin } = useGraphDataset();
  const { loading, saveFile } = useCloudProvider();
  const { exportAsGexf } = useExportActions();
  const { type: exportState } = useExportState();
  const { resetGraph } = useGraphDatasetActions();
  const [datasets, setDatasets] = useState<MetricOption[]>([]);
  const [selectedDataset, setSelectedDataset] = useState<MetricOption | null>(null);
  useEffect(() => {
    // 模拟网络请求
    fetch('http://localhost:8080/graph/list')
      .then(response => response.json())
      .then(data => {
        const options = data.map((dataset: string) => ({
          value: dataset,
          label: dataset,
        }));
        setDatasets(options);
      })
      .catch(error => console.error('Error fetching datasets:', error));
  }, []);
  const handleDatasetChange = (option: MetricOption | null) => {
    setSelectedDataset(option);
    // 处理选择的数据集
    console.log('Selected dataset:', option?.value);
  };
  const handleFetchData = async () => {
    if (!selectedDataset) {
      notify({ type: "error", message: t("menu.open.no_dataset_selected").toString() });
      return;
    }

    try {
      const response = await fetch(`http://localhost:8080/graph/data/${selectedDataset.value}`);
      console.log('Response:', response);
      if (!response.ok) {
        throw new Error(response.statusText);
      }
      const blob = await response.blob();
      const fileReader = new FileReader();
      fileReader.onload = (event) => {
        if (event.target?.result) {
          const fileContent = event.target.result as string
          const blob_file = new Blob([fileContent], { type: "application/graph" })

          setFile(new File([blob_file], selectedDataset.value + ".gexf"))
        }
      };
      fileReader.onerror = (event) => {
        console.error('FileReader error:', event);
        notify({ type: "error", message: t("menu.open.fetch_error").toString() });
      };
      fileReader.readAsText(blob);
    } catch (error) {
      console.error('Error fetching data:', error);
      notify({ type: "error", message: t("menu.open.fetch_error").toString() });
    }
  };

  return (
    <>
      <div className="panel-block">
        <h2 className="fs-4">
          <FileIcon className="me-1" /> {t("file.title")}
        </h2>
      </div>

      <hr className="m-0" />

      <div className="panel-block-grow">
        {!user?.provider && (
          <>
          </>
        )}

        <div className="position-relative">
          

          {/* Open links */}
          <h3 className="fs-5 mt-3">{t("graph.open.title")}</h3>
          {user && user.provider && (
            <div>
              <button
                className="btn btn-sm btn-outline-dark mb-1"
                onClick={() => {
                  openModal({ component: CloudFileModal, arguments: {} });
                }}
              >
                <FaRegFolderOpen className="me-1" />
                {t(`menu.open.cloud`, { provider: t(`providers.${user.provider.type}`) }).toString()}
              </button>
            </div>
          )}





          <div>
            <Select<MetricOption, false>
              {...DEFAULT_SELECT_PROPS}
              options={datasets}
              value={selectedDataset}
              onChange={handleDatasetChange}
              placeholder={t("menu.open.placeholder.title")}
            />

            <div>
              <button
                className="btn btn-primary mt-3"
                disabled={!selectedDataset}
                title={file ? t("common.open_file", { filename: file.name }).toString() : ""}
                onClick={async () => {
                  handleFetchData()
                  if (file) {
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
                }}
              >
                <FaFolderOpen className="me-1" />
                {t("common.open").toString()}
              </button>
            </div>
          </div>


          <div>
            <button
              className="btn btn-sm btn-outline-dark mb-1 mt-3"
              onClick={() => {
                openModal({ component: LocalFileModal, arguments: {} });
              }}
            >
              <FaRegFolderOpen className="me-1" />
              {t(`menu.open.local`).toString()}
            </button>
          </div>
          <div>
            <button
              className="btn btn-sm btn-outline-dark mb-1"
              title={t(`menu.open.new`).toString()}
              onClick={() => {
                openModal({
                  component: ConfirmModal,
                  arguments: {
                    title: t(`graph.open.new.title`),
                    message: t(`graph.open.new.message`),
                    successMsg: t(`graph.open.new.success`),
                  },
                  beforeSubmit: () => resetGraph(),
                });
              }}
            >
              <ImFileEmpty className="me-1" />
              {t("menu.open.new").toString()}
            </button>
          </div>

          {/* Save links */}
          <h3 className="fs-5 mt-3">{t("graph.save.title")}</h3>
          {user && user.provider && (
            <>
              {origin && origin.type === "cloud" && checkFilenameExtension(origin.filename, "gexf") && (
                <div>
                  <button
                    className="btn btn-sm btn-outline-dark mb-1"
                    onClick={async () => {
                      try {
                        await saveFile();
                        notify({
                          type: "success",
                          message: t("graph.save.cloud.success", { filename: origin.filename }).toString(),
                        });
                      } catch (e) {
                        notify({ type: "error", message: t("graph.save.cloud.error").toString() });
                      }
                    }}
                  >
                    <FaRegSave className="me-1" />
                    {t("menu.save.default").toString()}
                  </button>
                </div>
              )}
              <div>
                <button
                  className="btn btn-sm btn-outline-dark mb-1"
                  onClick={() => {
                    openModal({ component: SaveCloudFileModal, arguments: {} });
                  }}
                >
                  <FaRegSave className="me-1" />
                  {t("menu.save.cloud", { provider: t(`providers.${user.provider.type}`) }).toString()}
                </button>
              </div>
              <div>
                <hr className="dropdown-divider" />
              </div>
            </>
          )}

          <div>
            <button
              className="btn btn-sm btn-outline-dark mb-1"
              onClick={async () => {
                try {
                  await exportAsGexf((content) => {
                    fileSaver(new Blob([content]), origin?.filename || "gephi-lite.gexf");
                  });
                } catch (e) {
                  console.error(e);
                  notify({ type: "error", message: t("menu.download.gexf-error").toString() });
                }
              }}
            >
              <FaDownload className="me-1" />
              {t("menu.download.gexf").toString()}
            </button>
          </div>

          {/* Export links */}
          <h3 className="fs-5 mt-3">{t("graph.export.title")}</h3>
          <div>
            <button
              className="btn btn-sm btn-outline-dark"
              onClick={() => {
                openModal({ component: ExportPNGModal, arguments: {} });
              }}
            >
              <BsFiletypePng className="me-1" />
              {t("graph.export.png.title").toString()}
            </button>
          </div>

          {(loading || exportState === "loading") && <Loader />}
        </div>
      </div>
    </>
  );
};
