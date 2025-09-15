const fs = require("fs/promises");
const path = require("path");
const axios = require("axios");
const { createWriteStream } = require("fs");
const { pipeline } = require("stream/promises");

const {
  logInfo,
  logSuccess,
  logError,
  logWarn,
} = require("./logger");

/**
 * @typedef {Object} CardData
 * @property {string} cardName
 * @property {Object<string,string>} [fees]
 * @property {Object<string,any>} [rewards]
 * @property {string[]} [benefits]
 * @property {Object<string,any>} [eligibility]
 * @property {Object<string,any>} [documents]
 * @property {string[]} [terms]
 */


async function saveJSON(filePath, data) {
  try {
    const dir = path.dirname(filePath);
    await ensureDirectoryExists(dir);

    const jsonString = JSON.stringify(data, null, 2);
    await fs.writeFile(filePath, jsonString, "utf8");

    logSuccess(`JSON saved successfully: ${filePath}`);
  } catch (error) {
    logError(`Error saving JSON to ${filePath}`, error);
    throw error;
  }
}


async function downloadFile(url, outputPath, options = {}) {
  try {
    const dir = path.dirname(outputPath);
    await ensureDirectoryExists(dir);

    logInfo(`Downloading: ${url}`);

    const axiosConfig = {
      method: "GET",
      url,
      responseType: "stream",
      timeout: options.timeout || 30000,
      headers: {
        "User-Agent":
          options.userAgent ||
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        ...options.headers,
      },
    };

    const response = await axios(axiosConfig);

    if (response.status !== 200) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const mimeType = response.headers["content-type"];
    if (!path.extname(outputPath) && mimeType) {
      const ext = mimeType.split("/")[1]?.split(";")[0];
      if (ext) outputPath += `.${ext}`;
    }

    const writer = createWriteStream(outputPath);
    await pipeline(response.data, writer);

    logSuccess(`File downloaded successfully: ${outputPath}`);

    const stats = await fs.stat(outputPath);
    return { path: outputPath, size: stats.size, url, mimeType };
  } catch (error) {
    logError(`Error downloading ${url}`, error);
    try {
      await fs.unlink(outputPath);
    } catch (_) {}
    throw error;
  }
}

async function ensureDirectoryExists(dirPath) {
  try {
    await fs.access(dirPath);
  } catch (error) {
    if (error.code === "ENOENT") {
      await fs.mkdir(dirPath, { recursive: true });
      logInfo(`Created directory: ${dirPath}`);
    } else {
      throw error;
    }
  }
}

async function readJSON(filePath) {
  try {
    const data = await fs.readFile(filePath, "utf8");
    return JSON.parse(data);
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new Error(`File not found: ${filePath}`);
    }
    throw error;
  }
}

async function fileExists(filePath) {
  try {
    const stats = await fs.stat(filePath);
    return stats.isFile();
  } catch (_) {
    return false;
  }
}

async function getFileInfo(filePath) {
  try {
    const stats = await fs.stat(filePath);
    return {
      path: filePath,
      size: stats.size,
      sizeFormatted: formatFileSize(stats.size),
      created: stats.birthtime,
      modified: stats.mtime,
      isFile: stats.isFile(),
      isDirectory: stats.isDirectory(),
    };
  } catch (error) {
    throw new Error(
      `Unable to get file info for ${filePath}: ${error.message}`
    );
  }
}

function formatFileSize(bytes) {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

async function saveMultipleFormats(basePath, data, formats = ["json"]) {
  const tasks = formats.map(async (format) => {
    const filePath = `${basePath}.${format}`;
    try {
      switch (format.toLowerCase()) {
        case "json":
          await saveJSON(filePath, data);
          break;
        case "csv":
          await saveAsCSV(filePath, data);
          break;
        case "txt":
          await saveAsText(filePath, data);
          break;
        default:
          logWarn(`Unsupported format: ${format}`);
          return null;
      }
      return filePath;
    } catch (error) {
      logError(`Failed to save ${format} format`, error);
      return null;
    }
  });

  return (await Promise.all(tasks)).filter(Boolean);
}

async function saveAsCSV(filePath, data) {
  try {
    const dir = path.dirname(filePath);
    await ensureDirectoryExists(dir);

    let csvContent = "";

    if (Array.isArray(data)) {
      if (data.length === 0) throw new Error("No data to save as CSV");
      const headers = Object.keys(data[0]);
      csvContent += headers.join(",") + "\n";
      data.forEach((row) => {
        csvContent +=
          headers
            .map((h) => `"${(row[h] ?? "").toString().replace(/"/g, '""')}"`)
            .join(",") + "\n";
      });
    } else {
      const flatten = (obj, prefix = "") => {
        let result = [];
        for (const key in obj) {
          if (Object.prototype.hasOwnProperty.call(obj, key)) {
            const newKey = prefix ? `${prefix}.${key}` : key;
            if (
              typeof obj[key] === "object" &&
              obj[key] !== null &&
              !Array.isArray(obj[key])
            ) {
              result = result.concat(flatten(obj[key], newKey));
            } else {
              result.push([
                newKey,
                Array.isArray(obj[key]) ? obj[key].join("; ") : obj[key],
              ]);
            }
          }
        }
        return result;
      };

      const flatData = flatten(data);
      csvContent += "Field,Value\n";
      for (const [key, value] of flatData) {
        const escapedValue =
          typeof value === "string"
            ? `"${value.replace(/"/g, '""')}"`
            : value;
        csvContent += `"${key}",${escapedValue}\n`;
      }
    }

    await fs.writeFile(filePath, csvContent, "utf8");
    logSuccess(`CSV saved successfully: ${filePath}`);
  } catch (error) {
    logError(`Error saving CSV to ${filePath}`, error);
    throw error;
  }
}

async function saveAsText(filePath, data) {
  try {
    const dir = path.dirname(filePath);
    await ensureDirectoryExists(dir);

    let textContent = `${data.cardName || "Credit Card"} - Extracted Data\n`;
    textContent += "=".repeat(50) + "\n";
    textContent += `Extraction Date: ${new Date().toLocaleString()}\n\n`;

    const formatSection = (title, content) => {
      let section = `${title.toUpperCase()}:\n${"-".repeat(20)}\n`;
      if (Array.isArray(content)) {
        content.forEach((item, i) => (section += `${i + 1}. ${item}\n`));
      } else if (typeof content === "object") {
        for (const [k, v] of Object.entries(content)) {
          section += `${k}: ${v}\n`;
        }
      } else {
        section += `${content}\n`;
      }
      return section + "\n";
    };

    for (const [key, value] of Object.entries(data)) {
      if (["cardName"].includes(key)) continue;
      textContent += formatSection(key, value);
    }

    await fs.writeFile(filePath, textContent, "utf8");
    logSuccess(`Text summary saved successfully: ${filePath}`);
  } catch (error) {
    logError(`Error saving text to ${filePath}`, error);
    throw error;
  }
}

module.exports = {
  saveJSON,
  downloadFile,
  ensureDirectoryExists,
  readJSON,
  fileExists,
  getFileInfo,
  formatFileSize,
  saveMultipleFormats,
  saveAsCSV,
  saveAsText,
};
